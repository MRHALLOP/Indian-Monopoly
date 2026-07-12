const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { CITIES, COLOR_GROUPS } = require('./constants');

const SAVES_DIR = path.join(__dirname, 'game_saves');
if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });

function saveGame(room, game) {
  try {
    const savePath = path.join(SAVES_DIR, `${room}.json`);
    fs.writeFileSync(savePath, JSON.stringify(game), 'utf8');
  } catch (e) {
    console.warn('[PERSIST] Failed to save game:', e.message);
  }
}

function loadGame(room) {
  try {
    const savePath = path.join(SAVES_DIR, `${room}.json`);
    if (fs.existsSync(savePath)) {
      const data = JSON.parse(fs.readFileSync(savePath, 'utf8'));
      console.log(`[PERSIST] Restored game for room ${room}`);
      return data;
    }
  } catch (e) {
    console.warn('[PERSIST] Failed to load save:', e.message);
  }
  return null;
}

function deleteSave(room) {
  try {
    const savePath = path.join(SAVES_DIR, `${room}.json`);
    if (fs.existsSync(savePath)) fs.unlinkSync(savePath);
  } catch (e) { /* ignore */ }
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

app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

function getRandomColor() {
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

const chanceDeckMaster = [
  { text: "Advance to GO. Collect ₹200.", type: "advance_go" },
  { text: "Caught in Mumbai traffic! Go directly to Jail.", type: "go_jail" },
  { text: "Get Out of Jail Free. (Bribe a politician)", type: "jail_card" },
  { text: "Speeding challan caught on camera. Pay ₹15.", type: "money", amount: -15 },
  { text: "Your startup got funded! Collect ₹150.", type: "money", amount: 150 },
  { text: "Pay EMI for your new SUV. Pay ₹50.", type: "money", amount: -50 },
  { text: "Won the Diwali bumper lottery! Collect ₹100.", type: "money", amount: 100 },
  { text: "Bank server down. Error in your favor. Collect ₹50.", type: "money", amount: 50 },
  { text: "Advance to Mumbai.", type: "advance_mumbai" },
  { text: "Go back 3 spaces.", type: "go_back_3" }
];

const chestDeckMaster = [
  { text: "Advance to GO. Collect ₹200.", type: "advance_go" },
  { text: "Doctor's consultation fee. Pay ₹50.", type: "money", amount: -50 },
  { text: "Get Out of Jail Free. (Uncle is a DSP)", type: "jail_card" },
  { text: "Go directly to Jail. Do not pass GO.", type: "go_jail" },
  { text: "Income tax refund! Collect ₹20.", type: "money", amount: 20 },
  { text: "LIC Policy matures. Collect ₹100.", type: "money", amount: 100 },
  { text: "Pay Apollo Hospital fees. Pay ₹100.", type: "money", amount: -100 },
  { text: "Won local beauty contest. Collect ₹10.", type: "money", amount: 10 },
  { text: "Children's private school fees. Pay ₹50.", type: "money", amount: -50 },
  { text: "Received payment for IT consultancy. Collect ₹25.", type: "money", amount: 25 },
  { text: "Assessed for street repairs. Pay ₹40.", type: "money", amount: -40 },
  { text: "Fixed deposit matures. Receive ₹100.", type: "money", amount: 100 }
];

const createDeck = (type) => {
  const master = type === 'chance' ? chanceDeckMaster : chestDeckMaster;
  return [...master].sort(() => Math.random() - 0.5);
};

function logEvent(game, message) {
  game.logs.unshift(message);
  if (game.logs.length > 50) game.logs.length = 50;
}

const saveTimers = {};

function broadcastUpdate(room, game) {
  io.to(room).emit('game_update', game);
  if (saveTimers[room]) clearTimeout(saveTimers[room]);
  saveTimers[room] = setTimeout(() => {
    saveGame(room, game);
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
    }
    if (!state.mortgaged && houses === 0) {
      total += Math.floor(tile.price / 2);
    }
  }
  return total;
}

function checkBankruptcy(game, room, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player || player.cash >= 0) return;
  const assetValue = calculateAssets(game, player);
  const debt = -player.cash;
  if (assetValue > 0) {
    player.needsToRaiseMoney = true;
    player.debtAmount = debt;
    logEvent(game, `> ${player.name} needs to raise ₹${debt}!`);
    io.to(player.id).emit('raise_money', { debt: debt, assetValue: assetValue });
    broadcastUpdate(room, game);
  } else {
    declareBankruptcy(game, room, player);
  }
}

function declareBankruptcy(game, room, player) {
  player.bankrupt = true;
  player.cash = 0;
  player.needsToRaiseMoney = false;
  player.debtAmount = 0;
  const creditor = player.creditorId ? game.players.find(p => p.id === player.creditorId) : null;
  if (creditor) {
    logEvent(game, `> ${player.name} went bankrupt to ${creditor.name}!`);
  } else {
    logEvent(game, `> ${player.name} went bankrupt to the Bank.`);
  }
  const mortgagedPropertiesToResolve = [];
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
      state.owner = null;
      state.houses = 0;
      state.mortgaged = false;
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
  io.to(room).emit('trigger_visual', { type: 'BANKRUPT', player: player.name });
  if (!game.bankruptcyResolveQueue || game.bankruptcyResolveQueue.length === 0) {
    finishBankruptcyDeclaration(game, room, player);
  } else {
    broadcastUpdate(room, game);
  }
}

function finishBankruptcyDeclaration(game, room, player) {
  const alive = game.players.filter(p => !p.bankrupt);
  if (alive.length === 1) {
    logEvent(game, `> 🏆 ${alive[0].name} WINS THE GAME!`);
    io.to(room).emit('trigger_visual', { type: 'GAME_OVER', winner: alive[0].name });
    io.to(room).emit('game_over', { winner: alive[0].name });
    deleteSave(room);
  }
  const currentPlayer = game.players[game.currentTurn];
  if (currentPlayer && currentPlayer.id === player.id) {
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
const auctionTimers = {};

function clearAuctionTimer(room) {
  if (auctionTimers[room]) { clearTimeout(auctionTimers[room]); delete auctionTimers[room]; }
}

function startAuctionTimer(room) {
  clearAuctionTimer(room);
  auctionTimers[room] = setTimeout(() => {
    const game = rooms[room];
    if (game) endAuction(game, room);
  }, AUCTION_DURATION_MS);
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
  } else if (a.activePlayers.length === 1) {
    winner = game.players.find(p => p.id === a.activePlayers[0]);
    finalPrice = 10;
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

io.on('connection', (socket) => {
  socket.on('create_room', (room) => {
    socket.join(room);
    const savedGame = loadGame(room);
    if (savedGame) {
      savedGame.players.forEach(p => { p.connected = false; });
      savedGame.hostId = socket.id;
      if (savedGame.pendingBuy === undefined) savedGame.pendingBuy = null;
      rooms[room] = savedGame;
      console.log(`[PERSIST] Room ${room} restored from save with ${savedGame.players.length} players`);
    } else {
      rooms[room] = {
        hostId: socket.id,
        players: [],
        currentTurn: 0,
        auction: { status: false, activePlayers: [] },
        boardState: {},
        logs: [],
        landedTile: null,
        pendingBuy: null, // FIX #3
        chanceDeck: createDeck('chance'),
        chestDeck: createDeck('chest'),
        hasRolled: false,
        bankruptcyResolveQueue: [],
        availableHouses: 32,
        availableHotels: 12
        // FIX #1: freeParkingPool removed
      };
    }
  });

  socket.on('join_game', ({ room, name, color, clientId }) => {
    const game = rooms[room];
    if (!game) { socket.emit('action_error', 'Room does not exist. Please launch the TV/Host first!'); return; }
    let existingPlayer = null;
    if (clientId) existingPlayer = game.players.find(p => p.clientId === clientId);
    if (!existingPlayer && name) existingPlayer = game.players.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
    if (existingPlayer) {
      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.connected = true;
      if (clientId && !existingPlayer.clientId) existingPlayer.clientId = clientId;
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
      socket.join(room);
      logEvent(game, `> ${existingPlayer.name} reconnected.`);
      broadcastUpdate(room, game);
      if (game.auction && game.auction.status) socket.emit('auction_start', game.auction);
      return;
    }
    let assignedColor = color;
    const takenColors = game.players.map(p => p.color);
    if (!assignedColor || takenColors.includes(assignedColor)) {
      const allColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
      const available = allColors.filter(c => !takenColors.includes(c));
      assignedColor = available.length > 0 ? available[0] : getRandomColor();
    }
    const newPlayer = { id: socket.id, clientId: clientId || null, name, cash: 1500, position: 0, color: assignedColor, properties: [], inJail: false, jailTurns: 0, getOutOfJailCards: 0, consecutiveDoubles: 0, bankrupt: false, connected: true, creditorId: null };
    game.players.push(newPlayer);
    socket.join(room);
    logEvent(game, `> ${name} joined the game.`);
    broadcastUpdate(room, game);
  });

  socket.on('roll_dice', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.hasRolled) return;
    const raisingPlayer = game.players.find(p => p.needsToRaiseMoney && !p.bankrupt);
    if (raisingPlayer) return;
    if (!game.players || game.players.length === 0) return;
    const player = game.players[game.currentTurn];
    if (!player) return;
    if (player.id !== socket.id) { io.to(socket.id).emit('action_error', "It's not your turn."); return; } // FIX #8
    if (game.pendingBuy) { io.to(socket.id).emit('action_error', 'Resolve the property (buy or auction) before rolling.'); return; } // FIX #3
    if (player.bankrupt) { advanceTurn(game); return broadcastUpdate(room, game); }
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const roll = die1 + die2;
    const isDouble = die1 === die2;
    const startedInJail = player.inJail; // FIX #2
    io.to(room).emit('trigger_visual', { type: 'DICE_ROLL', dice: [die1, die2] });
    if (player.inJail) {
      if (isDouble) {
        player.inJail = false; player.jailTurns = 0; player.consecutiveDoubles = 0;
        logEvent(game, `> ${player.name} rolled doubles and left Jail!`);
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= 3) {
          player.cash -= 50; // FIX #1 bail to bank
          player.inJail = false; player.jailTurns = 0;
          logEvent(game, `> ${player.name} paid ₹50 to leave Jail.`);
          player.creditorId = null;
          checkBankruptcy(game, room, player.id);
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
          return broadcastUpdate(room, game);
        }
      } else {
        player.consecutiveDoubles = 0;
      }
    }
    const oldPos = player.position;
    player.position = (player.position + roll) % 40;
    if (player.position < oldPos && player.position !== 10) {
      player.cash += 200;
      logEvent(game, `> ${player.name} passed GO and collected ₹200.`);
    }
    function processTileLanding(game, room, player, roll) {
      const tile = CITIES[player.position];
      logEvent(game, `> ${player.name} landed on ${tile.name}.`);
      game.landedTile = { tileId: tile.id, tileName: tile.name, tileColor: tile.color || null, tilePrice: tile.price || null, tileRent: tile.rent || null, tileType: tile.type || 'property', houseCost: tile.houseCost || (tile.price ? Math.floor(tile.price * 0.5) : null), playerName: player.name, playerColor: player.color, context: null };
      const tileState = game.boardState[tile.id] || {};
      if (tile.type === 'special' || tile.type === 'tax') {
        if (tile.id === 30) {
          player.position = 10; player.inJail = true; player.consecutiveDoubles = 0; game.hasRolled = true;
          game.landedTile.context = 'jail';
          logEvent(game, `> ${player.name} was sent to Jail.`);
        } else if (tile.id === 20) {
          logEvent(game, `> ${player.name} landed on Free Parking.`); // FIX #1: no payout
        } else if (tile.type === 'tax') {
          player.cash -= tile.cost; // FIX #1: to bank
          game.landedTile.context = 'tax';
          game.landedTile.amount = tile.cost;
          logEvent(game, `> ${player.name} paid ₹${tile.cost} for ${tile.name}.`);
          player.creditorId = null;
          checkBankruptcy(game, room, player.id);
        } else if (tile.name.includes("Chance") || tile.name.includes("Community Chest")) {
          const deck = tile.name.includes("Chance") ? game.chanceDeck : game.chestDeck;
          const card = deck.shift();
          deck.push(card);
          logEvent(game, `> ${player.name} drew: ${card.text}`);
          const deckName = tile.name.includes("Chance") ? "CHANCE" : "COMMUNITY CHEST";
          io.to(room).emit('trigger_visual', { type: 'CARD_DRAW', card: card.text, player: player.name, deck: deckName });
          if (card.type === 'money') {
            player.cash += card.amount; // FIX #1: to bank
          } else if (card.type === 'go_jail') {
            player.position = 10; player.inJail = true; game.hasRolled = true;
          } else if (card.type === 'advance_go') {
            player.position = 0; player.cash += 200;
          } else if (card.type === 'jail_card') {
            player.getOutOfJailCards += 1;
          } else if (card.type === 'advance_mumbai') {
            const beforeAdvance = player.position; // FIX #6
            player.position = 39;
            if (39 < beforeAdvance) { player.cash += 200; logEvent(game, `> ${player.name} passed GO and collected ₹200.`); }
            processTileLanding(game, room, player, roll);
            return;
          } else if (card.type === 'go_back_3') {
            player.position = (player.position - 3 + 40) % 40;
            processTileLanding(game, room, player, roll);
            return;
          }
          player.creditorId = null;
          checkBankruptcy(game, room, player.id);
        }
      } else {
        if (tileState.owner && tileState.owner !== player.id && !tileState.mortgaged) {
          const owner = game.players.find(p => p.id === tileState.owner);
          let rentAmount = 0;
          if (tile.type === 'station') {
            const ownedStations = owner.properties.filter(p => CITIES[p].type === 'station').length;
            rentAmount = [25, 50, 100, 200][ownedStations - 1] || 25;
          } else if (tile.type === 'utility') {
            const ownedUtils = owner.properties.filter(p => CITIES[p].type === 'utility').length;
            rentAmount = roll * (ownedUtils === 2 ? 10 : 4);
          } else {
            rentAmount = tile.rent ? tile.rent[tileState.houses || 0] : 0;
            if ((tileState.houses || 0) === 0 && tile.color && COLOR_GROUPS[tile.color]) {
              const ownsAll = COLOR_GROUPS[tile.color].every(propId => { const ps = game.boardState[propId]; return ps && ps.owner === owner.id; });
              if (ownsAll) rentAmount *= 2;
            }
          }
          player.cash -= rentAmount;
          owner.cash += rentAmount;
          logEvent(game, `> ${player.name} paid ₹${rentAmount} rent to ${owner.name}.`);
          game.landedTile.context = 'rent_due';
          game.landedTile.amount = rentAmount;
          game.landedTile.ownerName = owner.name;
          game.landedTile.ownerColor = owner.color;
          io.to(room).emit('trigger_visual', { type: 'RENT', payer: player.name, receiver: owner.name, city: tile.name, amount: rentAmount, tileColor: tile.color || null, tilePrice: tile.price, tileRent: tile.rent || null, houseCost: tile.houseCost || (tile.price ? Math.floor(tile.price * 0.5) : null), tileType: tile.type || 'property', houses: tileState.houses || 0 });
          player.creditorId = owner.id;
          checkBankruptcy(game, room, player.id);
        } else if (!tileState.owner && tile.price) {
          game.landedTile.context = 'for_sale';
          game.pendingBuy = { playerId: player.id, propertyId: tile.id }; // FIX #3
          io.to(player.id).emit('prompt_buy', tile);
        }
      }
    }
    game.hasRolled = startedInJail ? true : !isDouble; // FIX #2
    processTileLanding(game, room, player, roll);
    broadcastUpdate(room, game);
  });

  socket.on('end_turn', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    const raisingPlayer = game.players.find(p => p.needsToRaiseMoney && !p.bankrupt);
    if (raisingPlayer) return;
    if (!game.players || game.players.length === 0) return;
    const player = game.players[game.currentTurn];
    if (!player) return;
    if (player.id !== socket.id) { io.to(socket.id).emit('action_error', "It's not your turn."); return; } // FIX #8
    if (game.pendingBuy) { io.to(socket.id).emit('action_error', 'You must buy or auction the property first.'); return; } // FIX #3
    if (!game.hasRolled) { io.to(socket.id).emit('action_error', 'You still have a roll to take.'); return; } // FIX #4
    advanceTurn(game);
    logEvent(game, `> It is now ${game.players[game.currentTurn].name}'s turn.`);
    broadcastUpdate(room, game);
  });

  socket.on('pay_bail', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (player && player.inJail) {
      if (player.cash >= 50) {
        player.cash -= 50; // FIX #1 to bank
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
    const player = game.players.find(p => p.id === socket.id);
    if (player && player.inJail && player.getOutOfJailCards > 0) {
      player.getOutOfJailCards -= 1; player.inJail = false; player.jailTurns = 0;
      logEvent(game, `> ${player.name} used a Get Out of Jail Free card.`);
      broadcastUpdate(room, game);
    }
  });

  socket.on('buy_property', ({ room, propertyId }) => {
    const game = rooms[room];
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    const tile = CITIES[propertyId];
    if (!tile) return;
    if (!game.pendingBuy || game.pendingBuy.playerId !== socket.id || game.pendingBuy.propertyId !== propertyId) { // FIX B
      io.to(socket.id).emit('action_error', 'You can only buy the property you landed on.');
      return;
    }
    if (!game.boardState[propertyId]?.owner) {
      if (player.cash >= tile.price) {
        player.cash -= tile.price;
        player.properties.push(propertyId);
        if (!game.boardState[propertyId]) game.boardState[propertyId] = {};
        game.boardState[propertyId].owner = player.id;
        game.boardState[propertyId].houses = 0;
        game.boardState[propertyId].mortgaged = false;
        logEvent(game, `> ${player.name} bought ${tile.name} for ₹${tile.price}.`);
        game.landedTile = null; game.pendingBuy = null;
        io.to(room).emit('trigger_visual', { type: 'BUY', player: player.name, card: tile.name, cost: tile.price });
        broadcastUpdate(room, game);
      } else {
        const assets = calculateAssets(game, player);
        if (player.cash + assets >= tile.price) {
          player.cash -= tile.price;
          player.properties.push(propertyId);
          if (!game.boardState[propertyId]) game.boardState[propertyId] = {};
          game.boardState[propertyId].owner = player.id;
          game.boardState[propertyId].houses = 0;
          game.boardState[propertyId].mortgaged = false;
          player.creditorId = null; game.landedTile = null; game.pendingBuy = null;
          logEvent(game, `> ${player.name} bought ${tile.name} on credit (debt: ₹${-player.cash}).`);
          io.to(room).emit('trigger_visual', { type: 'BUY', player: player.name, card: tile.name, cost: tile.price });
          checkBankruptcy(game, room, player.id);
        } else {
          io.to(player.id).emit('action_error', `You cannot afford ${tile.name}. Even after mortgaging everything, you would be short.`);
        }
      }
    }
  });

  socket.on('manage_property', ({ room, action, propertyId }) => {
    const game = rooms[room];
    if (!game) return;
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
        player.cash -= cost;
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
      player.cash += sellValue;
      state.houses -= 1;
      if (isHotel) { game.availableHotels += 1; game.availableHouses -= 4; } else { game.availableHouses += 1; }
      logEvent(game, `> ${player.name} sold a ${isHotel ? 'hotel' : 'house'} on ${tile.name} for ₹${sellValue}.`);
      broadcastUpdate(room, game);
      if (isRaisingMoney && player.cash >= 0) { player.needsToRaiseMoney = false; player.debtAmount = 0; player.creditorId = null; logEvent(game, `> ${player.name} raised enough money!`); io.to(player.id).emit('raise_money_resolved'); broadcastUpdate(room, game); }
    } else if (action === 'MORTGAGE' && !state.mortgaged && (state.houses || 0) === 0) {
      const colorGroup = COLOR_GROUPS[tile.color];
      if (colorGroup) {
        const hasHouses = colorGroup.some(propId => { const ps = game.boardState[propId]; return ps && (ps.houses || 0) > 0; });
        if (hasHouses) { io.to(player.id).emit('action_error', `You must sell all buildings in this color set before mortgaging.`); return; }
      }
      const value = Math.floor(tile.price / 2);
      player.cash += value;
      state.mortgaged = true;
      logEvent(game, `> ${player.name} mortgaged ${tile.name}.`);
      broadcastUpdate(room, game);
      if (isRaisingMoney && player.cash >= 0) { player.needsToRaiseMoney = false; player.debtAmount = 0; player.creditorId = null; logEvent(game, `> ${player.name} raised enough money!`); io.to(player.id).emit('raise_money_resolved'); broadcastUpdate(room, game); }
    } else if (action === 'UNMORTGAGE' && state.mortgaged) {
      const cost = Math.floor((tile.price / 2) * 1.1);
      if (player.cash >= cost) { player.cash -= cost; state.mortgaged = false; logEvent(game, `> ${player.name} unmortgaged ${tile.name}.`); broadcastUpdate(room, game); }
    }
  });

  socket.on('declare_bankruptcy', ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player || !player.needsToRaiseMoney) return;
    declareBankruptcy(game, room, player);
  });

  socket.on('resolve_transferred_mortgage', ({ room, action }) => {
    const game = rooms[room];
    if (!game || !game.bankruptcyResolveQueue || game.bankruptcyResolveQueue.length === 0) return;
    const currentResolution = game.bankruptcyResolveQueue[0];
    if (currentResolution.creditorId !== socket.id) return;
    const player = game.players.find(p => p.id === socket.id);
    const tile = CITIES[currentResolution.propertyId];
    const state = game.boardState[currentResolution.propertyId];
    if (!player || !tile || !state) return;
    const mortgageValue = Math.floor(tile.price / 2);
    if (action === 'UNMORTGAGE') {
      const cost = Math.floor(mortgageValue * 1.1);
      if (player.cash >= cost) { player.cash -= cost; state.mortgaged = false; logEvent(game, `> ${player.name} unmortgaged transferred property ${tile.name} for ₹${cost}.`); }
      else { socket.emit('action_error', `You cannot afford the ₹${cost} to unmortgage this property.`); return; }
    } else if (action === 'KEEP_MORTGAGED') {
      const fee = Math.floor(mortgageValue * 0.1);
      if (player.cash >= fee) { player.cash -= fee; state.mortgaged = true; logEvent(game, `> ${player.name} paid ₹${fee} fee to keep ${tile.name} mortgaged.`); }
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
    const { room, targetId } = payload || {};
    const game = rooms[room];
    if (!game) return;
    const initiator = game.players.find(p => p.id === socket.id);
    const target = game.players.find(p => p.id === targetId);
    if (!initiator || !target) return;
    const checked = validateTrade(game, initiator, target, payload);
    if (checked.error) { io.to(socket.id).emit('action_error', checked.error); return; }
    const offer = { initiatorId: initiator.id, initiatorName: initiator.name, offerCash: checked.oCash, requestCash: checked.rCash, offerPropertyIds: checked.oProps, requestPropertyIds: checked.rProps, offerJailCards: checked.oJail, requestJailCards: checked.rJail };
    logEvent(game, `> ${initiator.name} offered a trade to ${target.name}.`);
    io.to(targetId).emit('trade_offer', offer);
    io.to(room).emit('trigger_visual', { type: 'TRADE_OFFER', targetName: target.name, ...offer });
  });

  socket.on('accept_trade', (payload) => {
    const { room, initiatorId } = payload || {};
    const game = rooms[room];
    if (!game) return;
    const target = game.players.find(p => p.id === socket.id);
    const initiator = game.players.find(p => p.id === initiatorId);
    if (!initiator || !target) return;
    const checked = validateTrade(game, initiator, target, payload);
    if (checked.error) { io.to(socket.id).emit('action_error', `Trade failed: ${checked.error}`); io.to(initiatorId).emit('action_error', `Trade failed: ${checked.error}`); return; }
    const { oProps, rProps, oCash, rCash, oJail, rJail } = checked;
    initiator.cash += rCash - oCash;
    target.cash += oCash - rCash;
    oProps.forEach(id => { initiator.properties = initiator.properties.filter(pid => pid !== id); target.properties.push(id); game.boardState[id].owner = target.id; });
    rProps.forEach(id => { target.properties = target.properties.filter(pid => pid !== id); initiator.properties.push(id); game.boardState[id].owner = initiator.id; });
    initiator.getOutOfJailCards = (initiator.getOutOfJailCards || 0) - oJail + rJail;
    target.getOutOfJailCards = (target.getOutOfJailCards || 0) + oJail - rJail;
    // FIX G: mortgaged property received owes 10% interest to the bank.
    const chargeMortgageInterest = (receiver, propIds) => { propIds.forEach(id => { if (game.boardState[id]?.mortgaged) { const fee = Math.floor((CITIES[id].price / 2) * 0.1); receiver.cash -= fee; logEvent(game, `> ${receiver.name} paid ₹${fee} mortgage interest on ${CITIES[id].name}.`); } }); };
    chargeMortgageInterest(target, oProps);
    chargeMortgageInterest(initiator, rProps);
    logEvent(game, `> ${target.name} accepted ${initiator.name}'s trade.`);
    broadcastUpdate(room, game);
    io.to(room).emit('trigger_visual', { type: 'TRADE_ACCEPTED', initiatorName: initiator.name, targetName: target.name });
    checkBankruptcy(game, room, target.id);
    checkBankruptcy(game, room, initiator.id);
  });

  socket.on('decline_trade', ({ room, initiatorId }) => {
    const game = rooms[room];
    if (!game) return;
    const target = game.players.find(p => p.id === socket.id);
    const initiator = game.players.find(p => p.id === initiatorId);
    logEvent(game, `> ${target ? target.name : 'Player'} declined the trade.`);
    io.to(room).emit('trigger_visual', { type: 'TRADE_DECLINED', initiatorName: initiator ? initiator.name : "Player", targetName: target ? target.name : "Player" });
  });

  socket.on('start_auction', ({ room, propertyId }) => {
    const game = rooms[room];
    if (!game) return;
    const tile = CITIES[propertyId];
    if (!tile || !tile.price) return;
    if (game.boardState[propertyId]?.owner) { io.to(socket.id).emit('action_error', 'That property is already owned.'); return; } // FIX A
    const currentPlayer = game.players[game.currentTurn];
    if (!currentPlayer || currentPlayer.id !== socket.id) { io.to(socket.id).emit('action_error', "It's not your turn."); return; }
    if (game.pendingBuy && game.pendingBuy.propertyId !== propertyId) { io.to(socket.id).emit('action_error', 'You can only auction the property you landed on.'); return; }
    const activePlayers = game.players.filter(p => !p.bankrupt).map(p => p.id);
    game.auction = { status: true, propertyId, currentBid: 0, highestBidder: null, highestBidderName: null, activePlayers: activePlayers };
    game.landedTile = null; game.pendingBuy = null;
    logEvent(game, `> Auction started for ${tile.name}.`);
    io.to(room).emit('auction_start', game.auction);
    startAuctionTimer(room); // FIX C
    broadcastUpdate(room, game);
  });

  socket.on('place_bid', ({ room, amount }) => {
    const game = rooms[room];
    if (!game || !game.auction?.status) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    if (!game.auction.activePlayers.includes(player.id)) return;
    if (game.auction.highestBidder === player.id) return;
    const inc = Math.floor(Number(amount)); // FIX E
    if (!Number.isFinite(inc) || inc <= 0) { io.to(player.id).emit('action_error', 'Invalid bid amount.'); return; }
    const newBid = game.auction.currentBid + inc;
    if (player.cash < newBid) { io.to(player.id).emit('action_error', `You can't afford ₹${newBid}. You have ₹${player.cash}.`); return; }
    game.auction.currentBid = newBid;
    game.auction.highestBidder = player.id;
    game.auction.highestBidderName = player.name;
    logEvent(game, `> ${player.name} bid ₹${newBid}.`);
    io.to(room).emit('auction_update', game.auction);
    startAuctionTimer(room); // FIX C
    broadcastUpdate(room, game);
  });

  socket.on('withdraw_auction', ({ room }) => {
    const game = rooms[room];
    if (!game || !game.auction?.status) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    if (!game.auction.activePlayers.includes(player.id)) return;
    if (game.auction.highestBidder === player.id) { io.to(player.id).emit('action_error', "You're the highest bidder and can't withdraw."); return; } // FIX D
    if (game.auction.activePlayers.length <= 1) { io.to(player.id).emit('action_error', 'You are the last bidder - you must take this property.'); return; }
    game.auction.activePlayers = game.auction.activePlayers.filter(id => id !== socket.id);
    logEvent(game, `> ${player.name} withdrew from the auction.`);
    if (game.auction.activePlayers.length === 1) { endAuction(game, room); return; } // FIX C/D
    io.to(room).emit('auction_update', game.auction);
    broadcastUpdate(room, game);
  });

  socket.on('join_room', (room) => {
    socket.join(room);
    if (rooms[room]) socket.emit('game_update', rooms[room]);
  });

  socket.on('disconnect', () => {
    for (const room in rooms) {
      const game = rooms[room];
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

server.listen(3001, () => console.log("Game Engine Running on port 3001"));