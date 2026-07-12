const { CITIES, COLOR_GROUPS } = require('./constants');

const SAVE_VERSION = 3;

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
  const heldByAny = game && game.players && game.players.some(p => p.jailCards && p.jailCards.includes(type));
  const filtered = master.filter(c => !(c.type === 'jail_card' && heldByAny));
  return [...filtered].sort(() => Math.random() - 0.5);
};

function createInitialGame({ hostId, hostKey }) {
  const game = {
    saveVersion: SAVE_VERSION,
    hostId,
    hostKey,
    hostConnected: true,
    players: [],
    gameStatus: 'lobby',
    currentTurn: 0,
    auction: { status: false, activePlayers: [] },
    boardState: {},
    logs: [],
    landedTile: null,
    pendingBuy: null,
    pendingTrade: null,
    chanceDeck: [],
    chestDeck: [],
    hasRolled: false,
    bankruptcyResolveQueue: [],
    bankruptcyAuctionQueue: [],
    availableHouses: 32,
    availableHotels: 12
  };
  game.chanceDeck = createDeck('chance', game);
  game.chestDeck = createDeck('chest', game);
  return game;
}

function migrateGame(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Saves must be an object');
  }

  // Deep clone raw to avoid side-effects
  const game = JSON.parse(JSON.stringify(raw));

  // Ensure arrays/objects exist and are normalized
  game.players = Array.isArray(game.players) ? game.players : [];
  game.boardState = (game.boardState && typeof game.boardState === 'object') ? game.boardState : {};
  game.logs = Array.isArray(game.logs) ? game.logs : [];
  game.gameStatus = game.gameStatus || 'active';
  game.currentTurn = Number.isFinite(game.currentTurn) ? game.currentTurn : 0;
  game.auction = game.auction && typeof game.auction === 'object' ? game.auction : { status: false, activePlayers: [] };
  game.bankruptcyResolveQueue = Array.isArray(game.bankruptcyResolveQueue) ? game.bankruptcyResolveQueue : [];
  game.bankruptcyAuctionQueue = Array.isArray(game.bankruptcyAuctionQueue) ? game.bankruptcyAuctionQueue : [];
  game.pendingBuy = game.pendingBuy === undefined ? null : game.pendingBuy;
  game.pendingTrade = game.pendingTrade === undefined ? null : game.pendingTrade;

  // Remove testDiceQueue
  delete game.testDiceQueue;

  // Clamp inventory
  game.availableHouses = Math.min(32, Math.max(0, Number.isFinite(game.availableHouses) ? game.availableHouses : 32));
  game.availableHotels = Math.min(12, Math.max(0, Number.isFinite(game.availableHotels) ? game.availableHotels : 12));

  // Set all players disconnected
  game.players.forEach(p => {
    p.connected = false;
  });

  // Convert old getOutOfJailCards into max one Chance and one Chest identity globally
  let hasChance = false;
  let hasChest = false;

  // First pass: keep valid existing jailCards
  game.players.forEach(p => {
    p.jailCards = Array.isArray(p.jailCards) ? p.jailCards : [];
    p.jailCards = p.jailCards.filter(type => {
      if (type === 'chance' && !hasChance) {
        hasChance = true;
        return true;
      }
      if (type === 'chest' && !hasChest) {
        hasChest = true;
        return true;
      }
      return false;
    });
  });

  // Second pass: map getOutOfJailCards to chance/chest if jailCards is empty
  game.players.forEach(p => {
    if (p.jailCards.length === 0 && Number(p.getOutOfJailCards || 0) > 0) {
      const needed = Number(p.getOutOfJailCards);
      if (needed >= 1 && !hasChance) {
        p.jailCards.push('chance');
        hasChance = true;
      }
      if (p.jailCards.length < needed && !hasChest) {
        p.jailCards.push('chest');
        hasChest = true;
      }
    }
    p.getOutOfJailCards = p.jailCards.length;
  });

  // Decks safety filter
  const filterDeck = (deck, type) => {
    if (!Array.isArray(deck)) return [];
    const heldByAny = game.players.some(p => p.jailCards && p.jailCards.includes(type));
    if (heldByAny) {
      return deck.filter(c => c.type !== 'jail_card');
    }
    return deck;
  };
  game.chanceDeck = filterDeck(game.chanceDeck, 'chance');
  game.chestDeck = filterDeck(game.chestDeck, 'chest');

  // Fill decks if empty
  if (game.chanceDeck.length === 0) game.chanceDeck = createDeck('chance', game);
  if (game.chestDeck.length === 0) game.chestDeck = createDeck('chest', game);

  game.saveVersion = SAVE_VERSION;
  return game;
}

function validateGame(game) {
  const errors = [];

  if (!game || typeof game !== 'object' || Array.isArray(game)) {
    return { valid: false, errors: ['Game state must be a non-null object'] };
  }

  // 1. Players array exists and names/client IDs are unique
  if (!Array.isArray(game.players)) {
    errors.push('players is not an array');
  } else {
    const names = new Set();
    const clientIds = new Set();
    game.players.forEach((p, idx) => {
      if (!p || typeof p !== 'object') {
        errors.push(`player at index ${idx} is not an object`);
        return;
      }
      if (typeof p.name !== 'string' || !p.name.trim()) {
        errors.push(`player at index ${idx} has invalid name`);
      } else {
        const normName = p.name.trim().toLowerCase();
        if (names.has(normName)) {
          errors.push(`duplicate player name: ${p.name}`);
        }
        names.add(normName);
      }
      if (p.clientId) {
        if (clientIds.has(p.clientId)) {
          errors.push(`duplicate clientId: ${p.clientId}`);
        }
        clientIds.add(p.clientId);
      }
      if (!Number.isFinite(p.cash)) {
        errors.push(`player ${p.name} has non-finite cash`);
      }
      if (!Number.isInteger(p.position) || p.position < 0 || p.position > 39) {
        errors.push(`player ${p.name} has invalid position: ${p.position}`);
      }
      if (!Array.isArray(p.properties)) {
        errors.push(`player ${p.name} properties is not an array`);
      } else {
        const props = new Set();
        p.properties.forEach(pid => {
          if (!Number.isInteger(pid) || pid < 0 || pid > 39) {
            errors.push(`player ${p.name} has invalid property ID: ${pid}`);
          }
          if (props.has(pid)) {
            errors.push(`player ${p.name} has duplicate property ID: ${pid}`);
          }
          props.add(pid);
        });
      }
    });
  }

  // 2. currentTurn is in range
  if (game.players && game.players.length > 0) {
    if (!Number.isInteger(game.currentTurn) || game.currentTurn < 0 || game.currentTurn >= game.players.length) {
      errors.push(`currentTurn ${game.currentTurn} out of range (0-${game.players.length - 1})`);
    }
  }

  // 3. Finite house counts, inventory, bids, and deadlines
  if (!Number.isInteger(game.availableHouses) || game.availableHouses < 0 || game.availableHouses > 32) {
    errors.push(`invalid availableHouses: ${game.availableHouses}`);
  }
  if (!Number.isInteger(game.availableHotels) || game.availableHotels < 0 || game.availableHotels > 12) {
    errors.push(`invalid availableHotels: ${game.availableHotels}`);
  }

  // 4. Property ownership agreement
  if (game.boardState && typeof game.boardState === 'object') {
    const ownerPropertiesMap = {};
    if (game.players) {
      game.players.forEach(p => {
        ownerPropertiesMap[p.id] = new Set(p.properties || []);
      });
    }

    Object.entries(game.boardState).forEach(([rawId, state]) => {
      const pid = Number(rawId);
      if (!Number.isInteger(pid) || pid < 0 || pid > 39) {
        errors.push(`invalid boardState key: ${rawId}`);
        return;
      }
      if (!state || typeof state !== 'object') {
        errors.push(`boardState for ${pid} is not an object`);
        return;
      }
      if (state.houses !== undefined && (!Number.isInteger(state.houses) || state.houses < 0 || state.houses > 5)) {
        errors.push(`property ${pid} has invalid house count: ${state.houses}`);
      }
      if (state.mortgaged && state.houses && state.houses > 0) {
        errors.push(`mortgaged property ${pid} cannot have buildings`);
      }
      if (state.owner) {
        if (!ownerPropertiesMap[state.owner]) {
          errors.push(`property ${pid} owner ${state.owner} does not reference a valid player`);
        } else {
          if (!ownerPropertiesMap[state.owner].has(pid)) {
            errors.push(`property ${pid} lists owner ${state.owner}, but player properties array is missing it`);
          }
        }
      }
    });

    if (game.players) {
      game.players.forEach(p => {
        (p.properties || []).forEach(pid => {
          const bs = game.boardState[pid];
          if (!bs || bs.owner !== p.id) {
            errors.push(`player ${p.name} lists property ${pid}, but boardState owner is ${bs ? bs.owner : 'undefined'}`);
          }
        });
      });
    }
  }

  // 5. Pending auction references
  if (game.auction && game.auction.status) {
    const tile = CITIES[game.auction.propertyId];
    if (!tile || !tile.price) {
      errors.push(`auction propertyId ${game.auction.propertyId} is not auctionable`);
    }
    if (game.auction.highestBidder) {
      if (!game.players.some(p => p.id === game.auction.highestBidder)) {
        errors.push(`auction highestBidder ${game.auction.highestBidder} is not a valid player`);
      }
    }
    if (game.auction.endsAt !== undefined && !Number.isFinite(game.auction.endsAt)) {
      errors.push(`auction endsAt is not finite: ${game.auction.endsAt}`);
    }
    if (Array.isArray(game.auction.activePlayers)) {
      game.auction.activePlayers.forEach(id => {
        if (!game.players.some(p => p.id === id)) {
          errors.push(`auction activePlayer ${id} is not a valid player`);
        }
      });
    }
  }

  // 6. Pending trade references
  if (game.pendingTrade && game.pendingTrade.status === 'pending') {
    const init = game.players.find(p => p.id === game.pendingTrade.initiatorId);
    const targ = game.players.find(p => p.id === game.pendingTrade.targetId);
    if (!init) {
      errors.push(`pendingTrade initiatorId ${game.pendingTrade.initiatorId} is not a valid player`);
    }
    if (!targ) {
      errors.push(`pendingTrade targetId ${game.pendingTrade.targetId} is not a valid player`);
    }
    if (game.pendingTrade.expiresAt !== undefined && !Number.isFinite(game.pendingTrade.expiresAt)) {
      errors.push(`pendingTrade expiresAt is not finite: ${game.pendingTrade.expiresAt}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

const PRIVATE_GAME_KEYS = new Set([
  'hostKey',
  'testDiceQueue',
]);

const PRIVATE_PLAYER_KEYS = new Set([
  'clientId',
]);

function publicGameState(game) {
  if (!game || typeof game !== 'object') return game;
  const copy = JSON.parse(JSON.stringify(game));
  for (const key of PRIVATE_GAME_KEYS) delete copy[key];
  copy.players = (copy.players || []).map(player => {
    for (const key of PRIVATE_PLAYER_KEYS) delete player[key];
    return player;
  });
  return copy;
}

module.exports = {
  SAVE_VERSION,
  createInitialGame,
  migrateGame,
  validateGame,
  publicGameState,
  chanceDeckMaster,
  chestDeckMaster,
  createDeck
};
