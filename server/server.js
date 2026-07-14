const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CITIES, COLOR_GROUPS } = require('./constants');
const { createInitialGame, migrateGame, validateGame, publicGameState } = require('./gameState');

const SAVES_DIR = path.join(__dirname, 'game_saves');
if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });

// ─── Room code validation ───────────────────────────────────────────────────
const ROOM_CODE_RE = /^[A-Z0-9_-]{4,12}$/;

function normalizeRoomCode(value) {
  if (typeof value !== 'string') return null;
  const room = value.trim().toUpperCase();
  return ROOM_CODE_RE.test(room) ? room : null;
}

function requireRoom(raw, socket) {
  const room = normalizeRoomCode(raw);
  if (!room) {
    socket && socket.emit('action_error', 'Invalid room code. Use 4-12 letters or numbers.');
    return null;
  }
  return room;
}

function getSavePath(room) {
  const safeRoom = normalizeRoomCode(room);
  if (!safeRoom) throw new Error('Invalid room code');
  const savePath = path.resolve(SAVES_DIR, `${safeRoom}.json`);
  const savesRoot = `${path.resolve(SAVES_DIR)}${path.sep}`;
  if (!savePath.startsWith(savesRoot)) throw new Error('Unsafe save path');
  return savePath;
}

// ─── Atomic and recoverable saves ───────────────────────────────────────────
function cloneForSave(game) {
  return JSON.parse(JSON.stringify(game, (key, value) => {
    if (key === 'testDiceQueue') return undefined;
    return value;
  }));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveGame(room, game) {
  if (game && game.gameStatus === 'finished') {
    deleteSave(room);
    return;
  }
  const savePath = getSavePath(room);
  const tempPath = `${savePath}.tmp`;
  const backupPath = `${savePath}.bak`;
  // Validate before saving
  const { valid, errors } = validateGame(game);
  if (!valid) {
    if (process.env.NODE_ENV === 'test') throw new Error(`Invalid game state: ${errors.join('; ')}`);
    console.warn('[PERSIST] Refusing to save invalid state:', errors.join('; '));
    return;
  }
  try {
    const payload = JSON.stringify(cloneForSave(game));
    fs.writeFileSync(tempPath, payload, 'utf8');
    if (fs.existsSync(savePath)) fs.copyFileSync(savePath, backupPath);
    fs.renameSync(tempPath, savePath);
  } catch (error) {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    console.warn('[PERSIST] Failed to save game:', error.message);
  }
}

function loadGame(room) {
  const savePath = getSavePath(room);
  const backupPath = `${savePath}.bak`;
  try {
    if (!fs.existsSync(savePath)) return null;
    const loaded = migrateGame(readJsonFile(savePath));
    console.log(`[PERSIST] Restored game for room ${room}`);
    return loaded;
  } catch (primaryError) {
    console.warn('[PERSIST] Primary save invalid:', primaryError.message);
    try {
      if (!fs.existsSync(backupPath)) return null;
      const recovered = migrateGame(readJsonFile(backupPath));
      saveGame(room, recovered);
      console.warn(`[PERSIST] Recovered ${room} from backup`);
      return recovered;
    } catch (backupError) {
      console.warn('[PERSIST] Backup save invalid:', backupError.message);
      return null;
    }
  }
}

function deleteSave(room) {
  const savePath = getSavePath(room);
  for (const target of [savePath, `${savePath}.tmp`, `${savePath}.bak`]) {
    try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch {}
  }
}

process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] Unhandled Rejection:', reason);
});

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isLocal = origin.startsWith('http://localhost:') ||
                      origin.startsWith('http://127.0.0.1:') ||
                      /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
      if (isLocal) {
        callback(null, true);
      } else {
        callback(new Error('CORS blocked'));
      }
    }
  }
});

const rooms = {};

// Replaces /api/rooms (which exposed private data). Returns only safe aggregate stats.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, activeRooms: Object.keys(rooms).length });
});

function getRandomColor() {
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

const chanceDeckMaster = [
  { text: "Advance to GO. Collect ₹200.", type: "advance_go", deckType: "chance" },
  { text: "Advance to Mumbai.", type: "advance_mumbai", deckType: "chance" },
  { text: "Advance to Lucknow. If you pass GO, collect ₹200.", type: "advance_lucknow", deckType: "chance" },
  { text: "Advance to Panaji. If you pass GO, collect ₹200.", type: "advance_panaji", deckType: "chance" },
  { text: "Advance to nearest Station. If owned, pay owner twice the rent.", type: "nearest_station", deckType: "chance" },
  { text: "Advance to nearest Station. If owned, pay owner twice the rent.", type: "nearest_station", deckType: "chance" },
  { text: "Advance to nearest Utility. If owned, throw dice and pay owner 10 times the throw.", type: "nearest_utility", deckType: "chance" },
  { text: "Bank pays you dividend of ₹50.", type: "money", amount: 50, deckType: "chance" },
  { text: "Get Out of Jail Free.", type: "jail_card", deckType: "chance" },
  { text: "Go back 3 spaces.", type: "go_back_3", deckType: "chance" },
  { text: "Go directly to Jail. Do not pass GO.", type: "go_jail", deckType: "chance" },
  { text: "Make general repairs on all your property. For each house pay ₹25. For each hotel pay ₹100.", type: "repairs", houseCost: 25, hotelCost: 100, deckType: "chance" },
  { text: "Speeding challan. Pay ₹15.", type: "money", amount: -15, deckType: "chance" },
  { text: "Advance to Chennai Central. If you pass GO, collect ₹200.", type: "advance_chennai", deckType: "chance" },
  { text: "You have been elected Chairman of the Board. Pay each player ₹50.", type: "chairman", deckType: "chance" },
  { text: "Won Diwali bumper lottery! Collect ₹150.", type: "money", amount: 150, deckType: "chance" }
];

const chestDeckMaster = [
  { text: "Advance to GO. Collect ₹200.", type: "advance_go", deckType: "chest" },
  { text: "Bank error in your favor. Collect ₹200.", type: "money", amount: 200, deckType: "chest" },
  { text: "Doctor's consultation fee. Pay ₹50.", type: "money", amount: -50, deckType: "chest" },
  { text: "From sale of stock you get ₹50.", type: "money", amount: 50, deckType: "chest" },
  { text: "Get Out of Jail Free.", type: "jail_card", deckType: "chest" },
  { text: "Go directly to Jail. Do not pass GO.", type: "go_jail", deckType: "chest" },
  { text: "Holiday fund matures. Receive ₹100.", type: "money", amount: 100, deckType: "chest" },
  { text: "Income tax refund. Collect ₹20.", type: "money", amount: 20, deckType: "chest" },
  { text: "It is your birthday. Collect ₹10 from every player.", type: "birthday", deckType: "chest" },
  { text: "Life insurance matures. Collect ₹100.", type: "money", amount: 100, deckType: "chest" },
  { text: "Pay Apollo Hospital fees. Pay ₹100.", type: "money", amount: -100, deckType: "chest" },
  { text: "Children's private school fees. Pay ₹50.", type: "money", amount: -50, deckType: "chest" },
  { text: "Receive payment for IT consultancy. Collect ₹25.", type: "money", amount: 25, deckType: "chest" },
  { text: "Assessed for street repairs. Pay ₹40 per house. Pay ₹115 per hotel.", type: "repairs", houseCost: 40, hotelCost: 115, deckType: "chest" },
  { text: "Won local beauty contest. Collect ₹10.", type: "money", amount: 10, deckType: "chest" },
  { text: "Receive ₹100 from building loan.", type: "money", amount: 100, deckType: "chest" }
];

const createDeck = (type, game) => {
  const master = type === 'chance' ? chanceDeckMaster : chestDeckMaster;
  // Filter out any held jail cards
  const heldByAny = game && game.players && game.players.some(p => p.jailCards && p.jailCards.includes(type));
  const filtered = master.filter(c => !(c.type === 'jail_card' && heldByAny));
  return [...filtered].sort(() => Math.random() - 0.5);
};

function rollDie(game) {
  if (game && game.testDiceQueue && game.testDiceQueue.length > 0) {
    return game.testDiceQueue.shift();
  }
  return Math.floor(Math.random() * 6) + 1;
}

function determineStartingPlayer(game) {
  let candidates = game.players.map((p, idx) => ({ idx, player: p }));
  let round = 1;
  game.startingRolls = [];
  while (candidates.length > 1) {
    const rolls = candidates.map(c => {
      const d1 = rollDie(game);
      const d2 = rollDie(game);
      return { ...c, roll: d1 + d2, d1, d2 };
    });
    const maxRoll = Math.max(...rolls.map(r => r.roll));
    const winners = rolls.filter(r => r.roll === maxRoll);
    
    game.startingRolls.push({
      round,
      rolls: rolls.map(r => ({ name: r.player.name, color: r.player.color, roll: r.roll, d1: r.d1, d2: r.d2 }))
    });
    
    const rollDesc = rolls.map(r => `${r.player.name} rolled ${r.roll} (${r.d1}+${r.d2})`).join(', ');
    if (round === 1) {
      logEvent(game, `> Starting order rolls: ${rollDesc}.`);
    } else {
      logEvent(game, `> Tie break round ${round - 1}: ${rollDesc}.`);
    }
    
    if (winners.length === 1) {
      logEvent(game, `> ${winners[0].player.name} starts the game!`);
      // Also save the winning starting player name
      game.startingWinnerName = winners[0].player.name;
      return winners[0].idx;
    }
    candidates = winners.map(w => ({ idx: w.idx, player: w.player }));
    round++;
  }
  return 0;
}

function logEvent(game, message) {
  game.logs.unshift(message);
  if (game.logs.length > 50) game.logs.length = 50;
}

const saveTimers = {};

function broadcastUpdate(room, game) {
  io.to(room).emit('game_update', publicGameState(game));
  if (saveTimers[room]) clearTimeout(saveTimers[room]);
  saveTimers[room] = setTimeout(() => {
    saveGame(room, game); // saves the full private game (hostKey etc.)
    delete saveTimers[room];

  }, 500);
}

// FIX #4/#8: advance turn + fully reset per-turn state.
function advanceTurn(game) {
  const outgoing = game.players[game.currentTurn];
  if (outgoing) outgoing.consecutiveDoubles = 0;
  const startTurn = game.currentTurn;
  do {
    game.currentTurn = (game.currentTurn + 1) % game.players.length;
  } while (game.players[game.currentTurn].bankrupt && game.currentTurn !== startTurn);
  game.hasRolled = false;
  game.landedTile = null;
  game.pendingBuy = null;
}

function calculateAssets(game, player) {
  let total = 0;
  for (const propId of player.properties) {
    const tile = CITIES[propId];
    const state = game.boardState[propId];
    if (!state) continue;
    const houses = state.houses || 0;
    if (houses > 0) {
      const houseCost = tile.houseCost || (tile.price / 2);
      total += houses * Math.floor(houseCost / 2);
      total += Math.floor(tile.price / 2);
    } else if (!state.mortgaged) {
      total += Math.floor(tile.price / 2);
    }
  }
  return total;
}

function chargePlayer(game, room, debtor, amount, creditorId) {
  if (amount <= 0) return;
  const available = Math.max(0, debtor.cash);
  const payment = Math.min(amount, available);
  
  debtor.cash -= payment;
  if (creditorId) {
    const creditor = game.players.find(p => p.id === creditorId);
    if (creditor) creditor.cash += payment;
  }
  
  const remainder = amount - payment;
  if (remainder > 0) {
    const assets = calculateAssets(game, debtor);
    if (assets > 0) {
      debtor.needsToRaiseMoney = true;
      debtor.debtAmount = remainder;
      debtor.creditorId = creditorId;
      logEvent(game, `> ${debtor.name} needs to raise ₹${remainder} to ${creditorId ? game.players.find(p => p.id === creditorId).name : 'the Bank'}.`);
      io.to(debtor.id).emit('raise_money', { debt: remainder, assetValue: assets });
    } else {
      debtor.creditorId = creditorId;
      declareBankruptcy(game, room, debtor);
    }
  }
}

function gainCash(game, room, player, amount) {
  if (amount <= 0) return;
  if (player.needsToRaiseMoney && player.debtAmount > 0) {
    const payment = Math.min(amount, player.debtAmount);
    player.debtAmount -= payment;
    
    if (player.creditorId) {
      const creditor = game.players.find(p => p.id === player.creditorId);
      if (creditor) creditor.cash += payment;
    }
    
    logEvent(game, `> ${player.name} paid ₹${payment} towards their debt.`);
    
    const remainder = amount - payment;
    if (player.debtAmount === 0) {
      player.needsToRaiseMoney = false;
      player.creditorId = null;
      logEvent(game, `> ${player.name} paid off their debt completely!`);
      io.to(player.id).emit('raise_money_resolved');
      player.cash += remainder;
    }
  } else {
    player.cash += amount;
  }
}

function checkBankruptcy(game, room, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return;
  if (player.cash < 0) {
    const debt = -player.cash;
    player.cash = 0; // normalize
    chargePlayer(game, room, player, debt, player.creditorId);
  }
}

function declareBankruptcy(game, room, player) {
  player.bankrupt = true;
  
  // 1. Liquidate all buildings of the bankrupt player
  let cashFromBuildings = 0;
  for (const propId of player.properties) {
    const tile = CITIES[propId];
    const state = game.boardState[propId];
    if (state && (state.houses || 0) > 0) {
      const houses = state.houses;
      const houseCost = tile.houseCost || (tile.price / 2);
      const refund = Math.floor(houseCost / 2) * houses;
      cashFromBuildings += refund;
      
      // Restore Bank inventory
      if (houses === 5) {
        game.availableHotels += 1;
      } else {
        game.availableHouses += houses;
      }
      game.availableHouses = Math.min(32, game.availableHouses);
      game.availableHotels = Math.min(12, game.availableHotels);
      state.houses = 0;
      logEvent(game, `> Liquidated buildings on ${tile.name} for ₹${refund}.`);
    }
  }
  
  player.cash += cashFromBuildings;
  
  const creditor = player.creditorId ? game.players.find(p => p.id === player.creditorId) : null;
  const finalCash = Math.max(0, player.cash);
  
  // 2. Transfer cash and properties exactly once
  if (creditor) {
    creditor.cash += finalCash;
    logEvent(game, `> Transferred ₹${finalCash} remaining cash to ${creditor.name}.`);
  }
  player.cash = 0;
  player.needsToRaiseMoney = false;
  player.debtAmount = 0;
  
  // Return jail cards held by bankrupt player back to matching decks
  if (player.jailCards) {
    player.jailCards.forEach(deckType => {
      const deck = deckType === 'chance' ? game.chanceDeck : game.chestDeck;
      const card = (deckType === 'chance' ? chanceDeckMaster : chestDeckMaster).find(c => c.type === 'jail_card');
      if (card) deck.push(card);
    });
    player.jailCards = [];
    player.getOutOfJailCards = 0;
  }
  
  if (creditor) {
    logEvent(game, `> ${player.name} went bankrupt to ${creditor.name}!`);
  } else {
    logEvent(game, `> ${player.name} went bankrupt to the Bank.`);
  }
  
  const mortgagedPropertiesToResolve = [];
  const bankPropertiesToAuction = [];
  
  for (const propId of player.properties) {
    const tile = CITIES[propId];
    const state = game.boardState[propId];
    if (!state) continue;
    if (creditor) {
      state.owner = creditor.id;
      state.houses = 0;
      creditor.properties.push(propId);
      if (state.mortgaged) {
        mortgagedPropertiesToResolve.push(propId);
      } else {
        logEvent(game, `> ${tile.name} transferred to ${creditor.name}.`);
      }
    } else {
      // Returns to Bank building-free and unmortgaged
      state.owner = null;
      state.houses = 0;
      state.mortgaged = false;
      bankPropertiesToAuction.push(propId);
      logEvent(game, `> ${tile.name} returned to the Bank.`);
    }
  }
  player.properties = [];
  
  if (creditor && mortgagedPropertiesToResolve.length > 0) {
    game.bankruptcyResolveQueue = mortgagedPropertiesToResolve.map(propId => ({
      propertyId: propId,
      creditorId: creditor.id,
      bankruptPlayerName: player.name
    }));
    logEvent(game, `> ${creditor.name} must resolve ${mortgagedPropertiesToResolve.length} mortgaged properties.`);
  }
  
  if (!creditor && bankPropertiesToAuction.length > 0) {
    game.bankruptcyAuctionQueue = bankPropertiesToAuction;
    logEvent(game, `> Bank will sequentially auction ${bankPropertiesToAuction.length} returned properties.`);
  }
  
  io.to(room).emit('trigger_visual', { type: 'BANKRUPT', player: player.name });
  resolveBankruptcyStep(game, room, player);
}

function resolveBankruptcyStep(game, room, player) {
  if (game.bankruptcyResolveQueue && game.bankruptcyResolveQueue.length > 0) {
    broadcastUpdate(room, game);
    return;
  }
  
  if (game.bankruptcyAuctionQueue && game.bankruptcyAuctionQueue.length > 0) {
    const nextPropId = game.bankruptcyAuctionQueue[0];
    const activePlayers = game.players.filter(p => !p.bankrupt).map(p => p.id);
    game.auction = { status: true, propertyId: nextPropId, currentBid: 0, highestBidder: null, highestBidderName: null, activePlayers: activePlayers };
    logEvent(game, `> Sequentially auctioning returned property ${CITIES[nextPropId].name}.`);
    io.to(room).emit('auction_start', game.auction);
    startAuctionTimer(room);
    broadcastUpdate(room, game);
    return;
  }
  
  finishBankruptcyDeclaration(game, room, player);
}

function finishBankruptcyDeclaration(game, room, player) {
  const alive = game.players.filter(p => !p.bankrupt);
  if (alive.length === 1) {
    game.gameStatus = 'finished'; // Mark finished before game-over
    logEvent(game, `> 🏆 ${alive[0].name} WINS THE GAME!`);
    io.to(room).emit('trigger_visual', { type: 'GAME_OVER', winner: alive[0].name });
    io.to(room).emit('game_over', { winner: alive[0].name });
    deleteSave(room);
  }
  const currentPlayer = game.players[game.currentTurn];
  if (player && currentPlayer && currentPlayer.id === player.id) {
    do {
      game.currentTurn = (game.currentTurn + 1) % game.players.length;
    } while (game.players[game.currentTurn].bankrupt && game.players.some(p => !p.bankrupt));
    game.hasRolled = false;
    game.landedTile = null;
    game.pendingBuy = null;
    logEvent(game, `> It is now ${game.players[game.currentTurn].name}'s turn.`);
  }
  broadcastUpdate(room, game);
}

// FIX C/D: server-authoritative auction timer + single award path.
const AUCTION_DURATION_MS = 30000;
const TRADE_DURATION_MS = 60000;
const auctionTimers = {};
const tradeTimers = {};

function clearAuctionTimer(room) {
  if (auctionTimers[room]) { clearTimeout(auctionTimers[room]); delete auctionTimers[room]; }
}

function clearTradeTimer(room) {
  if (tradeTimers[room]) { clearTimeout(tradeTimers[room]); delete tradeTimers[room]; }
}

function resumeAuctionTimer(room, game) {
  clearAuctionTimer(room);
  if (!game.auction?.status) return;
  const remaining = Math.max(0, Number(game.auction.endsAt || 0) - Date.now());
  if (remaining === 0) return endAuction(game, room);
  auctionTimers[room] = setTimeout(() => {
    const liveGame = rooms[room];
    if (liveGame) endAuction(liveGame, room);
  }, remaining);
}

function startAuctionTimer(room) {
  const game = rooms[room];
  if (!game) return;
  game.auction.endsAt = Date.now() + AUCTION_DURATION_MS;
  resumeAuctionTimer(room, game);
}

function expireTrade(room, game, tradeId) {
  if (!game || !game.pendingTrade || game.pendingTrade.id !== tradeId) return;
  if (game.pendingTrade.status !== 'pending') return;
  clearTradeTimer(room);
  game.pendingTrade.status = 'expired';
  const initiator = game.players.find(p => p.id === game.pendingTrade.initiatorId);
  const target = game.players.find(p => p.id === game.pendingTrade.targetId);
  logEvent(game, `> Trade between ${initiator ? initiator.name : 'Player'} and ${target ? target.name : 'Player'} expired.`);
  io.to(room).emit('trigger_visual', { type: 'TRADE_DECLINED', initiatorName: initiator ? initiator.name : 'Player', targetName: target ? target.name : 'Player' });
  game.pendingTrade = null;
  broadcastUpdate(room, game);
}

function resumeTradeTimer(room, game) {
  clearTradeTimer(room);
  if (!game.pendingTrade || game.pendingTrade.status !== 'pending') return;
  const remaining = Math.max(0, game.pendingTrade.expiresAt - Date.now());
  if (remaining === 0) return expireTrade(room, game, game.pendingTrade.id);
  tradeTimers[room] = setTimeout(
    () => expireTrade(room, rooms[room], game.pendingTrade.id),
    remaining,
  );
}


function endAuction(game, room) {
  const a = game.auction;
  if (!a || !a.status) return;
  clearAuctionTimer(room);
  const propId = a.propertyId;
  let winner = null;
  let finalPrice = 0;
  if (a.highestBidder) {
    winner = game.players.find(p => p.id === a.highestBidder);
    finalPrice = a.currentBid;
  }
  a.status = false;
  if (winner) {
    winner.cash -= finalPrice;
    winner.properties.push(propId);
    if (!game.boardState[propId]) game.boardState[propId] = {};
    game.boardState[propId].owner = winner.id;
    game.boardState[propId].houses = 0;
    game.boardState[propId].mortgaged = false;
    logEvent(game, `> ${winner.name} won the auction for ₹${finalPrice}.`);
    io.to(room).emit('auction_end', { winner: winner.name, winnerColor: winner.color, propertyId: propId, finalPrice: finalPrice });
    broadcastUpdate(room, game);
    winner.creditorId = null;
    checkBankruptcy(game, room, winner.id);
  } else {
    logEvent(game, `> Auction ended with no winner. Property remains unsold.`);
    io.to(room).emit('auction_end', { propertyId: propId, finalPrice: 0 });
    broadcastUpdate(room, game);
  }
  
  if (game.bankruptcyAuctionQueue && game.bankruptcyAuctionQueue.length > 0 && game.bankruptcyAuctionQueue[0] === propId) {
    game.bankruptcyAuctionQueue.shift();
    resolveBankruptcyStep(game, room, null);
  }
}

// FIX H: reject trades touching a color group that has buildings anywhere.
function validateTrade(game, initiator, target, { offerCash, requestCash, offerPropertyIds, requestPropertyIds, offerJailCards, requestJailCards }) {
  const oProps = (offerPropertyIds || []).map(Number);
  const rProps = (requestPropertyIds || []).map(Number);
  const oCash = Number(offerCash) || 0;
  const rCash = Number(requestCash) || 0;
  const oJail = Math.max(0, Math.floor(Number(offerJailCards) || 0));
  const rJail = Math.max(0, Math.floor(Number(requestJailCards) || 0));
  if (oCash < 0 || rCash < 0) return { error: 'Invalid cash amount.' };
  if (oCash === 0 && rCash === 0 && oProps.length === 0 && rProps.length === 0 && oJail === 0 && rJail === 0)
    return { error: 'The trade is empty.' };
  if (!oProps.every(id => initiator.properties.includes(id)))
    return { error: `${initiator.name} no longer owns an offered property.` };
  if (!rProps.every(id => target.properties.includes(id)))
    return { error: `${target.name} no longer owns a requested property.` };
  if ([...oProps, ...rProps].some(id => (game.boardState[id]?.houses || 0) > 0))
    return { error: 'Properties with buildings cannot be traded. Sell the houses first.' };
  const groupHasBuildings = (id) => {
    const tile = CITIES[id];
    const group = tile && tile.color ? COLOR_GROUPS[tile.color] : null;
    if (!group) return false;
    return group.some(pid => (game.boardState[pid]?.houses || 0) > 0);
  };
  if ([...oProps, ...rProps].some(groupHasBuildings))
    return { error: 'You must sell all buildings in that color set before trading any property from it.' };
  if (oCash > initiator.cash) return { error: `${initiator.name} can't afford ₹${oCash}.` };
  if (rCash > target.cash) return { error: `${target.name} can't afford ₹${rCash}.` };
  if (oJail > (initiator.getOutOfJailCards || 0)) return { error: `${initiator.name} doesn't have ${oJail} jail card(s).` };
  if (rJail > (target.getOutOfJailCards || 0)) return { error: `${target.name} doesn't have ${rJail} jail card(s).` };
  return { oProps, rProps, oCash, rCash, oJail, rJail };
}

function movePlayerTo(game, room, player, targetPos, collectGo = true, specialRules = {}) {
  const beforePos = player.position;
  player.position = targetPos;
  if (collectGo && targetPos < beforePos && targetPos !== 10 && beforePos !== 10) {
    gainCash(game, room, player, 200);
    logEvent(game, `> ${player.name} passed GO and collected ₹200.`);
  }
  
  const tile = CITIES[targetPos];
  game.landedTile = { tileId: tile.id, tileName: tile.name, tileColor: tile.color || null, tilePrice: tile.price || null, tileRent: tile.rent || null, tileType: tile.type || 'property', houseCost: tile.houseCost || (tile.price ? Math.floor(tile.price * 0.5) : null), playerName: player.name, playerColor: player.color, context: null };
  const tileState = game.boardState[tile.id] || {};
  
  if (tile.type === 'special' || tile.type === 'tax') {
    if (tile.id === 30) {
      player.position = 10; player.inJail = true; player.jailTurns = 0; player.consecutiveDoubles = 0; game.hasRolled = true;
      game.landedTile.context = 'jail';
      logEvent(game, `> ${player.name} was sent to Jail.`);
      io.to(room).emit('trigger_visual', {
        type: 'JAIL',
        player: player.name,
        reason: 'go_to_jail'
      });
    } else if (tile.id === 20) {
      logEvent(game, `> ${player.name} landed on Free Parking.`);
    } else if (tile.type === 'tax') {
      game.landedTile.context = 'tax';
      game.landedTile.amount = tile.cost;
      logEvent(game, `> ${player.name} paid ₹${tile.cost} for ${tile.name}.`);
      chargePlayer(game, room, player, tile.cost, null);
    } else if (tile.name.includes("Chance") || tile.name.includes("Community Chest")) {
      drawAndResolveCard(game, room, player, tile.name.includes("Chance") ? 'chance' : 'chest', specialRules.roll || 0);
    }
  } else {
    if (tileState.owner && tileState.owner !== player.id && !tileState.mortgaged) {
      const owner = game.players.find(p => p.id === tileState.owner);
      let rentAmount = 0;
      if (specialRules.doubleRent) {
        const ownedStations = owner.properties.filter(p => CITIES[p].type === 'station').length;
        rentAmount = 2 * ([25, 50, 100, 200][ownedStations - 1] || 25);
      } else if (specialRules['10xUtility']) {
        const d1 = rollDie(game);
        const d2 = rollDie(game);
        io.to(room).emit('trigger_visual', { type: 'DICE_ROLL', dice: [d1, d2] });
        rentAmount = 10 * (d1 + d2);
        logEvent(game, `> Nearest utility dice throw: ${d1} + ${d2} = ${d1+d2}. Rent: ₹${rentAmount}`);
      } else {
        if (tile.type === 'station') {
          const ownedStations = owner.properties.filter(p => CITIES[p].type === 'station').length;
          rentAmount = [25, 50, 100, 200][ownedStations - 1] || 25;
        } else if (tile.type === 'utility') {
          const ownedUtils = owner.properties.filter(p => CITIES[p].type === 'utility').length;
          rentAmount = (specialRules.roll || 0) * (ownedUtils === 2 ? 10 : 4);
        } else {
          rentAmount = tile.rent ? tile.rent[tileState.houses || 0] : 0;
          if ((tileState.houses || 0) === 0 && tile.color && COLOR_GROUPS[tile.color]) {
            const ownsAll = COLOR_GROUPS[tile.color].every(propId => { const ps = game.boardState[propId]; return ps && ps.owner === owner.id; });
            if (ownsAll) rentAmount *= 2;
          }
        }
      }
      chargePlayer(game, room, player, rentAmount, owner.id);
      game.landedTile.context = 'rent_due';
      game.landedTile.amount = rentAmount;
      game.landedTile.ownerName = owner.name;
      game.landedTile.ownerColor = owner.color;
      io.to(room).emit('trigger_visual', { type: 'RENT', payer: player.name, receiver: owner.name, city: tile.name, amount: rentAmount, tileColor: tile.color || null, tilePrice: tile.price, tileRent: tile.rent || null, houseCost: tile.houseCost || (tile.price ? Math.floor(tile.price * 0.5) : null), tileType: tile.type || 'property', houses: tileState.houses || 0 });
    } else if (!tileState.owner && tile.price) {
      game.landedTile.context = 'for_sale';
      game.pendingBuy = { playerId: player.id, propertyId: tile.id };
      io.to(player.id).emit('prompt_buy', tile);
    }
  }
}

function executeCardAction(game, room, player, card, roll) {
  if (card.type === 'money') {
    if (card.amount > 0) {
      gainCash(game, room, player, card.amount);
    } else {
      chargePlayer(game, room, player, -card.amount, null);
    }
  } else if (card.type === 'go_jail') {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    player.consecutiveDoubles = 0;
    game.hasRolled = true;
    logEvent(game, `> ${player.name} went to Jail.`);
    io.to(room).emit('trigger_visual', {
      type: 'JAIL',
      player: player.name,
      reason: 'card'
    });
  } else if (card.type === 'advance_go') {
    movePlayerTo(game, room, player, 0, true);
  } else if (card.type === 'jail_card') {
    player.jailCards = player.jailCards || [];
    player.jailCards.push(card.deckType);
    player.getOutOfJailCards = player.jailCards.length;
  } else if (card.type === 'advance_mumbai') {
    movePlayerTo(game, room, player, 39, true);
  } else if (card.type === 'advance_lucknow') {
    movePlayerTo(game, room, player, 21, true);
  } else if (card.type === 'advance_ludhiana') {
    movePlayerTo(game, room, player, 11, true);
  } else if (card.type === 'advance_chennai') {
    movePlayerTo(game, room, player, 5, true);
  } else if (card.type === 'go_back_3') {
    const targetPos = (player.position - 3 + 40) % 40;
    movePlayerTo(game, room, player, targetPos, false);
  } else if (card.type === 'nearest_station') {
    const stations = [5, 15, 25, 35];
    let targetPos = stations[0];
    let minDist = 40;
    for (const s of stations) {
      let dist = (s - player.position + 40) % 40;
      if (dist === 0) dist = 40;
      if (dist < minDist) {
        minDist = dist;
        targetPos = s;
      }
    }
    movePlayerTo(game, room, player, targetPos, true, { doubleRent: true, roll });
  } else if (card.type === 'nearest_utility') {
    const utils = [12, 27];
    let targetPos = utils[0];
    let minDist = 40;
    for (const u of utils) {
      let dist = (u - player.position + 40) % 40;
      if (dist === 0) dist = 40;
      if (dist < minDist) {
        minDist = dist;
        targetPos = u;
      }
    }
    movePlayerTo(game, room, player, targetPos, true, { '10xUtility': true, roll });
  } else if (card.type === 'repairs') {
    let houses = 0;
    let hotels = 0;
    for (const propId of player.properties) {
      const state = game.boardState[propId];
      if (state) {
        if (state.houses === 5) hotels++;
        else houses += (state.houses || 0);
      }
    }
    const cost = houses * card.houseCost + hotels * card.hotelCost;
    logEvent(game, `> ${player.name} owes ₹${cost} for repairs.`);
    chargePlayer(game, room, player, cost, null);
  } else if (card.type === 'chairman') {
    const opponents = game.players.filter(p => p.id !== player.id && !p.bankrupt);
    opponents.forEach(opp => {
      chargePlayer(game, room, player, 50, opp.id);
    });
  } else if (card.type === 'birthday') {
    const opponents = game.players.filter(p => p.id !== player.id && !p.bankrupt);
    opponents.forEach(opp => {
      chargePlayer(game, room, opp, 10, player.id);
    });
  }
}

function drawAndResolveCard(game, room, player, deckType, roll) {
  const deck = deckType === 'chance' ? game.chanceDeck : game.chestDeck;
  if (deck.length === 0) {
    const created = createDeck(deckType, game);
    deck.push(...created);
  }
  const card = deck.shift();
  if (card.type !== 'jail_card') {
    deck.push(card);
  }
  logEvent(game, `> ${player.name} drew: ${card.text}`);
  const deckName = deckType === 'chance' ? "CHANCE" : "COMMUNITY CHEST";
  io.to(room).emit('trigger_visual', { type: 'CARD_DRAW', card: card.text, player: player.name, deck: deckName });
  executeCardAction(game, room, player, card, roll);
}

io.on('connection', (socket) => {
  socket.on('create_room', (payload) => {
    const rawRoom = payload && typeof payload === 'object' ? payload.room : payload;
    const room = requireRoom(rawRoom, socket);
    if (!room) return;

    const hostKey = payload && typeof payload === 'object' ? payload.hostKey : null;
    if (!hostKey || typeof hostKey !== 'string') {
      socket.emit('host_error', 'Missing host key. Please reload the host page.');
      return;
    }

    // Room already live in memory
    if (rooms[room]) {
      const game = rooms[room];
      if (game.hostKey !== hostKey) {
        socket.emit('host_error', 'Room already has an active host.');
        return;
      }
      // Same host reconnecting: update socket ID and set connected
      game.hostId = socket.id;
      game.hostConnected = true;
      socket.join(room);
      resumeAuctionTimer(room, game);
      resumeTradeTimer(room, game);
      broadcastUpdate(room, game);
      if (game.auction && game.auction.status) socket.emit('auction_start', game.auction);
      return;
    }

    // Try loading from disk
    const savedGame = loadGame(room);
    if (savedGame) {
      // Old save without hostKey: first TV may claim it
      if (!savedGame.hostKey) {
        savedGame.hostKey = hostKey;
        console.log(`[HOST] Room ${room} claimed by first TV (no prior hostKey)`);
      } else if (savedGame.hostKey !== hostKey) {
        socket.emit('host_error', 'Room already has an active host.');
        return;
      }
      savedGame.hostId = socket.id;
      savedGame.hostConnected = true;
      savedGame.pendingTrade = savedGame.pendingTrade || null;
      rooms[room] = savedGame;
      socket.join(room);
      console.log(`[PERSIST] Room ${room} restored from save with ${savedGame.players.length} players`);
      resumeAuctionTimer(room, savedGame);
      resumeTradeTimer(room, savedGame);
      broadcastUpdate(room, savedGame);
      if (savedGame.auction && savedGame.auction.status) socket.emit('auction_start', savedGame.auction);
    } else {
      const game = createInitialGame({ hostId: socket.id, hostKey });
      rooms[room] = game;
      socket.join(room);
    }
  });

  socket.on('join_game', ({ room: rawRoom, name, color, clientId }) => {
    const room = requireRoom(rawRoom, socket);
    if (!room) return;
    const game = rooms[room];
    if (!game) { socket.emit('action_error', 'Room does not exist. Please launch the TV/Host first!'); return; }

    // Reconnect: clientId must exactly match
    if (clientId) {
      const existingPlayer = game.players.find(p => p.clientId === clientId);
      if (existingPlayer) {
        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.connected = true;
        existingPlayer.jailCards = existingPlayer.jailCards || [];
        existingPlayer.getOutOfJailCards = existingPlayer.jailCards.length;
        for (const propId in game.boardState) {
          if (game.boardState[propId].owner === oldId) game.boardState[propId].owner = socket.id;
        }
        game.players.forEach(p => { if (p.creditorId === oldId) p.creditorId = socket.id; });
        if (game.bankruptcyResolveQueue) game.bankruptcyResolveQueue.forEach(item => { if (item.creditorId === oldId) item.creditorId = socket.id; });
        if (game.auction && game.auction.status) {
          if (game.auction.highestBidder === oldId) game.auction.highestBidder = socket.id;
          if (game.auction.activePlayers) game.auction.activePlayers = game.auction.activePlayers.map(id => id === oldId ? socket.id : id);
        }
        if (game.pendingBuy && game.pendingBuy.playerId === oldId) game.pendingBuy.playerId = socket.id;
        if (game.pendingTrade) {
          if (game.pendingTrade.initiatorId === oldId) game.pendingTrade.initiatorId = socket.id;
          if (game.pendingTrade.targetId === oldId) game.pendingTrade.targetId = socket.id;
        }
        socket.join(room);
        logEvent(game, `> ${existingPlayer.name} reconnected.`);
        broadcastUpdate(room, game);
        if (game.auction && game.auction.status) socket.emit('auction_start', game.auction);
        return;
      }
    }

    // Name collision with different/missing clientId: reject
    if (name) {
      const nameTaken = game.players.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (nameTaken) {
        socket.emit('action_error', 'That player name is already in use.');
        return;
      }
    }

    if (game.gameStatus !== 'lobby') {
      socket.emit('action_error', 'Game has already started. New players cannot join.');
      return;
    }

    if (game.players.length >= 4) {
      socket.emit('action_error', 'The lobby is full (maximum 4 players).');
      return;
    }

    let assignedColor = color;
    const takenColors = game.players.map(p => p.color);
    if (!assignedColor || takenColors.includes(assignedColor)) {
      const allColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
      const available = allColors.filter(c => !takenColors.includes(c));
      assignedColor = available.length > 0 ? available[0] : getRandomColor();
    }
    const newPlayer = { id: socket.id, clientId: clientId || null, name, cash: 1500, position: 0, color: assignedColor, properties: [], inJail: false, jailTurns: 0, jailCards: [], getOutOfJailCards: 0, consecutiveDoubles: 0, bankrupt: false, connected: true, creditorId: null };
    game.players.push(newPlayer);
    socket.join(room);
    logEvent(game, `> ${name} joined the game.`);
    broadcastUpdate(room, game);
  });

  socket.on('roll_dice', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    if (game.bankruptcyResolveQueue && game.bankruptcyResolveQueue.length > 0) { io.to(socket.id).emit('action_error', 'Resolve mortgaged properties first!'); return; }
    if (game.hasRolled) return;
    const raisingPlayer = game.players.find(p => p.needsToRaiseMoney && !p.bankrupt);
    if (raisingPlayer) return;
    if (!game.players || game.players.length === 0) return;
    const player = game.players[game.currentTurn];
    if (!player) return;
    if (player.id !== socket.id) { io.to(socket.id).emit('action_error', "It's not your turn."); return; }
    if (game.pendingBuy) { io.to(socket.id).emit('action_error', 'Resolve the property (buy or auction) before rolling.'); return; }
    if (player.bankrupt) { advanceTurn(game); return broadcastUpdate(room, game); }
    
    const die1 = rollDie(game);
    const die2 = rollDie(game);
    const roll = die1 + die2;
    const isDouble = die1 === die2;
    const startedInJail = player.inJail;
    io.to(room).emit('trigger_visual', { type: 'DICE_ROLL', dice: [die1, die2] });
    
    if (player.inJail) {
      if (isDouble) {
        player.inJail = false; player.jailTurns = 0; player.consecutiveDoubles = 0;
        logEvent(game, `> ${player.name} rolled doubles and left Jail!`);
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= 3) {
          player.inJail = false; player.jailTurns = 0;
          logEvent(game, `> ${player.name} paid ₹50 to leave Jail.`);
          chargePlayer(game, room, player, 50, null);
        } else {
          logEvent(game, `> ${player.name} didn't roll doubles. Stays in Jail.`);
          game.hasRolled = true;
          return broadcastUpdate(room, game);
        }
      }
    } else {
      if (isDouble) {
        player.consecutiveDoubles += 1;
        if (player.consecutiveDoubles === 3) {
          player.inJail = true; player.position = 10; player.consecutiveDoubles = 0; game.hasRolled = true;
          logEvent(game, `> ${player.name} rolled 3 doubles! Go to Jail!`);
          io.to(room).emit('trigger_visual', {
            type: 'JAIL',
            player: player.name,
            reason: 'three_doubles'
          });
          return broadcastUpdate(room, game);
        }
      } else {
        player.consecutiveDoubles = 0;
      }
    }
    
    game.hasRolled = startedInJail ? true : !isDouble;
    const targetPos = (player.position + roll) % 40;
    movePlayerTo(game, room, player, targetPos, true, { roll });
    broadcastUpdate(room, game);
  });

  socket.on('end_turn', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    if (game.bankruptcyResolveQueue && game.bankruptcyResolveQueue.length > 0) { io.to(socket.id).emit('action_error', 'Resolve mortgaged properties first!'); return; }
    const raisingPlayer = game.players.find(p => p.needsToRaiseMoney && !p.bankrupt);
    if (raisingPlayer) return;
    if (!game.players || game.players.length === 0) return;
    const player = game.players[game.currentTurn];
    if (!player) return;
    if (player.id !== socket.id) { io.to(socket.id).emit('action_error', "It's not your turn."); return; }
    if (game.pendingBuy) { io.to(socket.id).emit('action_error', 'You must buy or auction the property first.'); return; }
    if (!game.hasRolled) { io.to(socket.id).emit('action_error', 'You still have a roll to take.'); return; }
    advanceTurn(game);
    logEvent(game, `> It is now ${game.players[game.currentTurn].name}'s turn.`);
    broadcastUpdate(room, game);
  });

  socket.on('pay_bail', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const player = game.players.find(p => p.id === socket.id);
    if (player && player.inJail) {
      if (player.cash >= 50) {
        player.cash -= 50;
        player.inJail = false; player.jailTurns = 0;
        logEvent(game, `> ${player.name} paid ₹50 bail.`);
        broadcastUpdate(room, game);
      } else {
        const assets = calculateAssets(game, player);
        if (player.cash + assets >= 50) {
          player.cash -= 50; player.inJail = false; player.jailTurns = 0; player.creditorId = null;
          logEvent(game, `> ${player.name} paid ₹50 bail on credit.`);
          checkBankruptcy(game, room, player.id);
        } else {
          io.to(player.id).emit('action_error', "You cannot afford bail even after mortgaging all your assets.");
        }
      }
    }
  });

  socket.on('use_jail_card', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const player = game.players.find(p => p.id === socket.id);
    if (player && player.inJail && player.jailCards && player.jailCards.length > 0) {
      const deckType = player.jailCards.shift();
      player.getOutOfJailCards = player.jailCards.length;
      player.inJail = false; player.jailTurns = 0;
      
      const deck = deckType === 'chance' ? game.chanceDeck : game.chestDeck;
      const card = (deckType === 'chance' ? chanceDeckMaster : chestDeckMaster).find(c => c.type === 'jail_card');
      if (card) deck.push(card);
      
      logEvent(game, `> ${player.name} used a Get Out of Jail Free card.`);
      broadcastUpdate(room, game);
    }
  });

  socket.on('buy_property', ({ room, propertyId }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    const tile = CITIES[propertyId];
    if (!tile) return;
    if (!game.pendingBuy || game.pendingBuy.playerId !== socket.id || game.pendingBuy.propertyId !== propertyId) {
      io.to(socket.id).emit('action_error', 'You can only buy the property you landed on.');
      return;
    }
    if (!game.boardState[propertyId]?.owner) {
      if (player.cash >= tile.price) {
        player.properties.push(propertyId);
        if (!game.boardState[propertyId]) game.boardState[propertyId] = {};
        game.boardState[propertyId].owner = player.id;
        game.boardState[propertyId].houses = 0;
        game.boardState[propertyId].mortgaged = false;
        logEvent(game, `> ${player.name} bought ${tile.name} for ₹${tile.price}.`);
        game.landedTile = null; game.pendingBuy = null;
        io.to(room).emit('trigger_visual', { type: 'BUY', player: player.name, card: tile.name, cost: tile.price });
        chargePlayer(game, room, player, tile.price, null);
        broadcastUpdate(room, game);
      } else {
        const assets = calculateAssets(game, player);
        if (player.cash + assets >= tile.price) {
          player.properties.push(propertyId);
          if (!game.boardState[propertyId]) game.boardState[propertyId] = {};
          game.boardState[propertyId].owner = player.id;
          game.boardState[propertyId].houses = 0;
          game.boardState[propertyId].mortgaged = false;
          game.landedTile = null; game.pendingBuy = null;
          io.to(room).emit('trigger_visual', { type: 'BUY', player: player.name, card: tile.name, cost: tile.price });
          chargePlayer(game, room, player, tile.price, null);
          broadcastUpdate(room, game);
        } else {
          io.to(player.id).emit('action_error', `You cannot afford ${tile.name}. Even after mortgaging everything, you would be short.`);
        }
      }
    }
  });

  socket.on('manage_property', ({ room, action, propertyId }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    const tile = CITIES[propertyId];
    const state = game.boardState[propertyId];
    if (!state || state.owner !== player.id) return;
    const isRaisingMoney = player.needsToRaiseMoney;
    const isResolvingBankruptcy = game.bankruptcyResolveQueue && game.bankruptcyResolveQueue.some(r => r.creditorId === player.id);
    const currentPlayer = game.players[game.currentTurn];
    const isMyTurn = currentPlayer && currentPlayer.id === player.id;
    if (!isMyTurn && !isRaisingMoney && !isResolvingBankruptcy) { io.to(player.id).emit('action_error', 'You can only manage properties on your turn.'); return; }
    if ((isRaisingMoney || isResolvingBankruptcy) && action !== 'MORTGAGE' && action !== 'SELL_HOUSE') { io.to(player.id).emit('action_error', 'You can only mortgage or sell houses while raising money or resolving bankruptcy.'); return; }
    if (action === 'BUILD_HOUSE' && tile.type !== 'station' && tile.type !== 'utility') {
      const colorGroup = COLOR_GROUPS[tile.color];
      if (colorGroup) {
        const ownsAll = colorGroup.every(propId => { const ps = game.boardState[propId]; return ps && ps.owner === player.id; });
        if (!ownsAll) { io.to(player.id).emit('action_error', `You must own all ${colorGroup.length} properties in this color set to build.`); return; }
        const hasMortgaged = colorGroup.some(propId => { const ps = game.boardState[propId]; return ps && ps.mortgaged; });
        if (hasMortgaged) { io.to(player.id).emit('action_error', `You cannot build if any property in this color set is mortgaged.`); return; }
        const currentHouses = state.houses || 0;
        const canBuild = colorGroup.every(propId => { const ps = game.boardState[propId] || {}; return (ps.houses || 0) >= currentHouses; });
        if (!canBuild) { io.to(player.id).emit('action_error', `You must build evenly. Put houses on other properties in this set first.`); return; }
      }
      const currentHouses = state.houses || 0;
      const isHotel = currentHouses === 4;
      if (isHotel && game.availableHotels <= 0) { io.to(player.id).emit('action_error', 'No hotels left in the bank!'); return; }
      if (!isHotel && game.availableHouses <= 0) { io.to(player.id).emit('action_error', 'No houses left in the bank!'); return; }
      const cost = tile.houseCost || (tile.price / 2);
      if (player.cash >= cost && currentHouses < 5) {
        chargePlayer(game, room, player, cost, null);
        state.houses = currentHouses + 1;
        if (isHotel) { game.availableHotels -= 1; game.availableHouses += 4; } else { game.availableHouses -= 1; }
        logEvent(game, `> ${player.name} built on ${tile.name}.`);
        io.to(room).emit('trigger_visual', { type: 'BUILD', player: player.name, city: tile.name, houses: state.houses, color: tile.color, cost: cost });
        broadcastUpdate(room, game);
      }
    } else if (action === 'SELL_HOUSE' && (state.houses || 0) > 0) {
      const colorGroup = COLOR_GROUPS[tile.color];
      if (colorGroup) {
        const currentHouses = state.houses || 0;
        const canSell = colorGroup.every(propId => { const ps = game.boardState[propId] || {}; return (ps.houses || 0) <= currentHouses; });
        if (!canSell) { io.to(player.id).emit('action_error', `You must sell houses evenly. Sell houses from other properties in this set first.`); return; }
      }
      const houseCost = tile.houseCost || (tile.price / 2);
      const sellValue = Math.floor(houseCost / 2);
      const isHotel = (state.houses === 5);
      if (isHotel && game.availableHouses < 4) { io.to(player.id).emit('action_error', `Not enough houses in bank to replace hotel on ${tile.name}.`); return; }
      state.houses -= 1;
      if (isHotel) { game.availableHotels += 1; game.availableHouses -= 4; } else { game.availableHouses += 1; }
      logEvent(game, `> ${player.name} sold a ${isHotel ? 'hotel' : 'house'} on ${tile.name} for ₹${sellValue}.`);
      gainCash(game, room, player, sellValue);
      broadcastUpdate(room, game);
    } else if (action === 'MORTGAGE' && !state.mortgaged && (state.houses || 0) === 0) {
      const colorGroup = COLOR_GROUPS[tile.color];
      if (colorGroup) {
        const hasHouses = colorGroup.some(propId => { const ps = game.boardState[propId]; return ps && (ps.houses || 0) > 0; });
        if (hasHouses) { io.to(player.id).emit('action_error', `You must sell all buildings in this color set before mortgaging.`); return; }
      }
      const value = Math.floor(tile.price / 2);
      state.mortgaged = true;
      logEvent(game, `> ${player.name} mortgaged ${tile.name}.`);
      gainCash(game, room, player, value);
      broadcastUpdate(room, game);
    } else if (action === 'UNMORTGAGE' && state.mortgaged) {
      const cost = Math.floor((tile.price / 2) * 1.1);
      if (player.cash >= cost) {
        chargePlayer(game, room, player, cost, null);
        state.mortgaged = false;
        logEvent(game, `> ${player.name} unmortgaged ${tile.name}.`);
        broadcastUpdate(room, game);
      }
    }
  });

  socket.on('declare_bankruptcy', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const player = game.players.find(p => p.id === socket.id);
    if (!player || !player.needsToRaiseMoney) return;
    declareBankruptcy(game, room, player);
  });

  socket.on('resolve_transferred_mortgage', ({ room, action }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    if (!game.bankruptcyResolveQueue || game.bankruptcyResolveQueue.length === 0) return;
    const currentResolution = game.bankruptcyResolveQueue[0];
    if (currentResolution.creditorId !== socket.id) return;
    const player = game.players.find(p => p.id === socket.id);
    const tile = CITIES[currentResolution.propertyId];
    const state = game.boardState[currentResolution.propertyId];
    if (!player || !tile || !state) return;
    const mortgageValue = Math.floor(tile.price / 2);
    if (action === 'UNMORTGAGE') {
      const cost = Math.floor(mortgageValue * 1.1);
      if (player.cash >= cost) { chargePlayer(game, room, player, cost, null); state.mortgaged = false; logEvent(game, `> ${player.name} unmortgaged transferred property ${tile.name} for ₹${cost}.`); }
      else { socket.emit('action_error', `You cannot afford the ₹${cost} to unmortgage this property.`); return; }
    } else if (action === 'KEEP_MORTGAGED') {
      const fee = Math.floor(mortgageValue * 0.1);
      if (player.cash >= fee) { chargePlayer(game, room, player, fee, null); state.mortgaged = true; logEvent(game, `> ${player.name} paid ₹${fee} fee to keep ${tile.name} mortgaged.`); }
      else { socket.emit('action_error', `You cannot afford the ₹${fee} fee to keep this property mortgaged.`); return; }
    }
    game.bankruptcyResolveQueue.shift();
    if (game.bankruptcyResolveQueue.length === 0) {
      logEvent(game, `> All transferred properties resolved.`);
      const bankruptPlayer = game.players.find(p => p.name === currentResolution.bankruptPlayerName);
      finishBankruptcyDeclaration(game, room, bankruptPlayer);
    } else {
      broadcastUpdate(room, game);
    }
  });

  socket.on('initiate_trade', (payload) => {
    const { room: rawRoom, targetId } = payload || {};
    const room = requireRoom(rawRoom, socket);
    if (!room) return;
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const initiator = game.players.find(p => p.id === socket.id);
    const target = game.players.find(p => p.id === targetId);
    if (!initiator || !target) return;
    const checked = validateTrade(game, initiator, target, payload);
    if (checked.error) { io.to(socket.id).emit('action_error', checked.error); return; }
    const tradeId = crypto.randomUUID();
    game.pendingTrade = {
      id: tradeId,
      status: 'pending',
      initiatorId: initiator.id,
      targetId: target.id,
      offerCash: checked.oCash,
      requestCash: checked.rCash,
      offerPropertyIds: checked.oProps,
      requestPropertyIds: checked.rProps,
      offerJailCards: checked.oJail,
      requestJailCards: checked.rJail,
      expiresAt: Date.now() + TRADE_DURATION_MS
    };
    resumeTradeTimer(room, game);
    const offer = { initiatorId: initiator.id, initiatorName: initiator.name, offerCash: checked.oCash, requestCash: checked.rCash, offerPropertyIds: checked.oProps, requestPropertyIds: checked.rProps, offerJailCards: checked.oJail, requestJailCards: checked.rJail };
    logEvent(game, `> ${initiator.name} offered a trade to ${target.name}.`);
    io.to(targetId).emit('trade_offer', offer);
    io.to(room).emit('trigger_visual', { type: 'TRADE_OFFER', targetName: target.name, ...offer });
  });

  socket.on('accept_trade', (payload) => {
    const { room: rawRoom, initiatorId } = payload || {};
    const room = requireRoom(rawRoom, socket);
    if (!room) return;
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const target = game.players.find(p => p.id === socket.id);
    const initiator = game.players.find(p => p.id === initiatorId);
    if (!initiator || !target) return;
    const checked = validateTrade(game, initiator, target, payload);
    if (checked.error) { io.to(socket.id).emit('action_error', `Trade failed: ${checked.error}`); io.to(initiatorId).emit('action_error', `Trade failed: ${checked.error}`); return; }
    const { oProps, rProps, oCash, rCash, oJail, rJail } = checked;
    // Clear pending trade and timer before executing
    clearTradeTimer(room);
    game.pendingTrade = null;

    if (oCash > rCash) {
      chargePlayer(game, room, initiator, oCash - rCash, target.id);
    } else if (rCash > oCash) {
      chargePlayer(game, room, target, rCash - oCash, initiator.id);
    }

    oProps.forEach(id => { initiator.properties = initiator.properties.filter(pid => pid !== id); target.properties.push(id); game.boardState[id].owner = target.id; });
    rProps.forEach(id => { target.properties = target.properties.filter(pid => pid !== id); initiator.properties.push(id); game.boardState[id].owner = initiator.id; });

    initiator.jailCards = initiator.jailCards || [];
    target.jailCards = target.jailCards || [];
    for (let i = 0; i < oJail; i++) {
      const card = initiator.jailCards.shift();
      if (card) target.jailCards.push(card);
    }
    for (let i = 0; i < rJail; i++) {
      const card = target.jailCards.shift();
      if (card) initiator.jailCards.push(card);
    }
    initiator.getOutOfJailCards = initiator.jailCards.length;
    target.getOutOfJailCards = target.jailCards.length;

    const chargeMortgageInterest = (receiver, propIds) => { propIds.forEach(id => { if (game.boardState[id]?.mortgaged) { const fee = Math.floor((CITIES[id].price / 2) * 0.1); chargePlayer(game, room, receiver, fee, null); } }); };
    chargeMortgageInterest(target, oProps);
    chargeMortgageInterest(initiator, rProps);
    logEvent(game, `> ${target.name} accepted ${initiator.name}'s trade.`);
    broadcastUpdate(room, game);
    io.to(room).emit('trigger_visual', { type: 'TRADE_ACCEPTED', initiatorName: initiator.name, targetName: target.name });
    checkBankruptcy(game, room, target.id);
    checkBankruptcy(game, room, initiator.id);
  });

  socket.on('decline_trade', ({ room: rawRoom, initiatorId }) => {
    const room = requireRoom(rawRoom, socket);
    if (!room) return;
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const target = game.players.find(p => p.id === socket.id);
    const initiator = game.players.find(p => p.id === initiatorId);
    clearTradeTimer(room);
    game.pendingTrade = null;
    logEvent(game, `> ${target ? target.name : 'Player'} declined the trade.`);
    io.to(room).emit('trigger_visual', { type: 'TRADE_DECLINED', initiatorName: initiator ? initiator.name : "Player", targetName: target ? target.name : "Player" });
    broadcastUpdate(room, game);
  });

  socket.on('start_game', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    const isLobbyLeader = game.players[0] && game.players[0].id === socket.id;
    if (!isLobbyLeader) { io.to(socket.id).emit('action_error', 'Only the Lobby Leader can start the game.'); return; }
    if (game.gameStatus !== 'lobby') { io.to(socket.id).emit('action_error', 'Game has already started.'); return; }
    if (game.players.length < 2) { io.to(socket.id).emit('action_error', 'At least 2 players are required to start the game.'); return; }
    
    game.gameStatus = 'active';
    const startingIdx = determineStartingPlayer(game);
    game.currentTurn = startingIdx;
    logEvent(game, `> The game has started! It is ${game.players[startingIdx].name}'s turn.`);
    broadcastUpdate(room, game);
  });

  socket.on('start_auction', ({ room, propertyId }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    if (game.auction?.status) { io.to(socket.id).emit('action_error', 'An auction is already in progress.'); return; }
    const tile = CITIES[propertyId];
    if (!tile || !tile.price) return;
    if (game.boardState[propertyId]?.owner) { io.to(socket.id).emit('action_error', 'That property is already owned.'); return; }
    const currentPlayer = game.players[game.currentTurn];
    if (!currentPlayer || currentPlayer.id !== socket.id) { io.to(socket.id).emit('action_error', "It's not your turn."); return; }
    if (game.pendingBuy && game.pendingBuy.propertyId !== propertyId) { io.to(socket.id).emit('action_error', 'You can only auction the property you landed on.'); return; }
    const activePlayers = game.players.filter(p => !p.bankrupt).map(p => p.id);
    game.auction = { status: true, propertyId, currentBid: 0, highestBidder: null, highestBidderName: null, activePlayers: activePlayers };
    game.landedTile = null; game.pendingBuy = null;
    logEvent(game, `> Auction started for ${tile.name}.`);
    io.to(room).emit('auction_start', game.auction);
    startAuctionTimer(room);
    broadcastUpdate(room, game);
  });

  socket.on('place_bid', ({ room, amount }) => {
    const game = rooms[room];
    if (!game || !game.auction?.status) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    if (!game.auction.activePlayers.includes(player.id)) return;
    if (game.auction.highestBidder === player.id) return;
    
    const bid = Math.floor(Number(amount));
    if (!Number.isFinite(bid) || bid <= 0) { io.to(player.id).emit('action_error', 'Bid must be a positive integer.'); return; }
    if (game.auction.currentBid === 0) {
      if (bid < 1) { io.to(player.id).emit('action_error', 'Opening bid must be at least ₹1.'); return; }
    } else {
      if (bid <= game.auction.currentBid) { io.to(player.id).emit('action_error', `Bid must be greater than current bid of ₹${game.auction.currentBid}.`); return; }
    }
    const maxBid = player.cash + calculateAssets(game, player);
    if (bid > maxBid) { io.to(player.id).emit('action_error', `Bid cannot exceed your maximum buying power (cash + assets) of ₹${maxBid}.`); return; }
    
    game.auction.currentBid = bid;
    game.auction.highestBidder = player.id;
    game.auction.highestBidderName = player.name;
    logEvent(game, `> ${player.name} bid ₹${bid}.`);
    io.to(room).emit('auction_update', game.auction);
    startAuctionTimer(room);
    broadcastUpdate(room, game);
  });

  socket.on('withdraw_auction', ({ room }) => {
    const game = rooms[room];
    if (!game || !game.auction?.status) return;
    if (game.gameStatus !== 'active') { io.to(socket.id).emit('action_error', 'Game is not active.'); return; }
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    if (!game.auction.activePlayers.includes(player.id)) return;
    if (game.auction.highestBidder === player.id) { io.to(player.id).emit('action_error', "You're the highest bidder and can't withdraw."); return; }
    if (game.auction.activePlayers.length <= 1) { io.to(player.id).emit('action_error', 'You are the last bidder - you must take this property.'); return; }
    game.auction.activePlayers = game.auction.activePlayers.filter(id => id !== socket.id);
    logEvent(game, `> ${player.name} withdrew from the auction.`);
    if (game.auction.activePlayers.length === 1) { endAuction(game, room); return; }
    io.to(room).emit('auction_update', game.auction);
    broadcastUpdate(room, game);
  });

  socket.on('join_room', (rawRoom) => {
    const room = requireRoom(rawRoom, socket);
    if (!room) return;
    socket.join(room);
    if (rooms[room]) socket.emit('game_update', publicGameState(rooms[room]));
  });

  socket.on('disconnect', () => {
    for (const room in rooms) {
      const game = rooms[room];
      // Host disconnect: mark not connected but do NOT delete room
      if (game.hostId === socket.id) {
        game.hostConnected = false;
        broadcastUpdate(room, game);
      }
      const player = game.players.find(p => p.id === socket.id);
      if (player) {
        player.connected = false;
        logEvent(game, `> ${player.name} disconnected.`);
        // FIX F: keep the game moving.
        if (game.auction?.status && game.auction.activePlayers.includes(player.id)) {
          if (game.auction.highestBidder !== player.id) {
            game.auction.activePlayers = game.auction.activePlayers.filter(id => id !== player.id);
            if (game.auction.activePlayers.length === 1) endAuction(game, room);
            else io.to(room).emit('auction_update', game.auction);
          }
        }
        const currentPlayer = game.players[game.currentTurn];
        if (currentPlayer && currentPlayer.id === player.id && !game.pendingBuy) {
          advanceTurn(game);
          logEvent(game, `> ${player.name} was skipped. It is now ${game.players[game.currentTurn].name}'s turn.`);
        }
        broadcastUpdate(room, game);
        break;
      }
    }
  });
});

if (require.main === module) {
  server.listen(process.env.PORT || 3001, () => console.log("Game Engine Running on port " + (process.env.PORT || 3001)));
}
module.exports = { app, server, io, rooms, chanceDeckMaster, chestDeckMaster, rollDie, determineStartingPlayer, chargePlayer, gainCash, calculateAssets, checkBankruptcy, declareBankruptcy, endAuction, validateTrade, createDeck, movePlayerTo, executeCardAction, drawAndResolveCard, normalizeRoomCode, requireRoom, getSavePath, saveGame, loadGame, deleteSave, resumeAuctionTimer, resumeTradeTimer, expireTrade, AUCTION_DURATION_MS, TRADE_DURATION_MS };