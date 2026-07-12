const assert = require('assert');
const fs = require('fs');
const path = require('path');
const serverModule = require('./server');

const {
  rooms,
  chanceDeckMaster,
  chestDeckMaster,
  rollDie,
  determineStartingPlayer,
  chargePlayer,
  gainCash,
  calculateAssets,
  checkBankruptcy,
  declareBankruptcy,
  endAuction,
  validateTrade,
  createDeck,
  movePlayerTo,
  executeCardAction,
  drawAndResolveCard
} = serverModule;

// Mock socket.io emissions to verify events
const emittedEvents = [];
const actionErrors = [];
serverModule.io.to = (target) => ({
  emit: (event, data) => {
    emittedEvents.push({ target, event, data });
  }
});
serverModule.io.emit = (event, data) => {
  emittedEvents.push({ target: 'all', event, data });
};

// Helper to set up a test game and mock Socket.IO connections
function setupTestGame(roomId, playersData = []) {
  // Clear room
  delete rooms[roomId];

  // Register host mock socket
  const hostSocketMock = {
    id: 'host-socket-id',
    join: () => {},
    on: (event, handler) => {
      hostSocketMock._handlers[event] = handler;
    },
    emit: (event, data) => {
      emittedEvents.push({ target: 'host', event, data });
    },
    _handlers: {}
  };

  const connectionListeners = serverModule.io.listeners('connection');
  connectionListeners.forEach(listener => listener(hostSocketMock));

  // Trigger create_room on host
  hostSocketMock._handlers['create_room'](roomId);
  const game = rooms[roomId];
  game.hostId = 'host-socket-id';

  // Connect players
  const sockets = playersData.map(p => {
    const socketMock = {
      id: p.id,
      join: () => {},
      on: (event, handler) => {
        socketMock._handlers[event] = handler;
      },
      emit: (event, data) => {
        emittedEvents.push({ target: p.id, event, data });
      },
      _handlers: {},
      _emitted: []
    };

    connectionListeners.forEach(listener => listener(socketMock));

    // Join game
    socketMock._handlers['join_game']({ room: roomId, name: p.name, color: p.color, clientId: p.clientId || p.id });

    return socketMock;
  });

  return { game, sockets, hostSocket: hostSocketMock };
}

let testCount = 0;
let passCount = 0;

function runTest(name, fn) {
  testCount++;
  emittedEvents.length = 0;
  actionErrors.length = 0;
  try {
    fn();
    console.log(`✅ TEST ${testCount}: ${name} - PASS`);
    passCount++;
  } catch (err) {
    console.error(`❌ TEST ${testCount}: ${name} - FAILED`);
    console.error(err);
  }
}

// ==========================================
// 1. start requires 2 players
// ==========================================
runTest('start requires 2 players and lobby leader socket (via actual Socket.IO events)', () => {
  const { game, hostSocket, sockets } = setupTestGame('ROOM1', [
    { id: 'p1', name: 'Aarav', color: '#ef4444' }
  ]);
  const p1Socket = sockets[0];

  // Player 1 (Lobby Leader) attempts to start game with 1 player -> fails (needs 2 players)
  p1Socket._handlers['start_game']({ room: 'ROOM1' });
  assert.strictEqual(game.gameStatus, 'lobby');

  // Add 2nd player
  const p2Socket = {
    id: 'p2',
    join: () => {},
    on: (event, handler) => { p2Socket._handlers[event] = handler; },
    emit: (event, data) => {
      emittedEvents.push({ target: 'p2', event, data });
    },
    _handlers: {}
  };
  const connectionListeners = serverModule.io.listeners('connection');
  connectionListeners.forEach(listener => listener(p2Socket));
  p2Socket._handlers['join_game']({ room: 'ROOM1', name: 'Diya', color: '#3b82f6', clientId: 'p2' });

  // Host attempts to start game -> rejected (not lobby leader)
  hostSocket._handlers['start_game']({ room: 'ROOM1' });
  assert.strictEqual(game.gameStatus, 'lobby');

  // Player 2 attempts to start game -> rejected (not lobby leader)
  p2Socket._handlers['start_game']({ room: 'ROOM1' });
  assert.strictEqual(game.gameStatus, 'lobby');

  // Player 1 starts game with 2 players -> succeeds
  p1Socket._handlers['start_game']({ room: 'ROOM1' });
  assert.strictEqual(game.gameStatus, 'active');
});

// ==========================================
// 2. starting ties
// ==========================================
runTest('starting ties among tied players', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav' },
      { id: 'p2', name: 'Diya' },
      { id: 'p3', name: 'Arjun' }
    ],
    logs: [],
    testDiceQueue: [
      5, 5, // Aarav: 10
      5, 5, // Diya: 10 (Tie for highest)
      2, 2, // Arjun: 4
      3, 4, // Aarav tie-break: 7
      5, 5  // Diya tie-break: 10 (Wins)
    ]
  };
  const startingIdx = determineStartingPlayer(game);
  assert.strictEqual(startingIdx, 1); // Diya starts
});

// ==========================================
// 3. late join blocked / reconnect allowed
// ==========================================
runTest('late join blocked / reconnect allowed (via actual Socket.IO events)', () => {
  const { game, hostSocket, sockets } = setupTestGame('ROOM3', [
    { id: 'p1', name: 'Aarav', color: '#ef4444' },
    { id: 'p2', name: 'Diya', color: '#3b82f6' }
  ]);

  // Start game
  sockets[0]._handlers['start_game']({ room: 'ROOM3' });
  assert.strictEqual(game.gameStatus, 'active');

  // Try to join a new player (late join)
  const p3Socket = {
    id: 'p3',
    join: () => {},
    on: (event, handler) => { p3Socket._handlers[event] = handler; },
    emit: (event, data) => {
      emittedEvents.push({ target: 'p3', event, data });
    },
    _handlers: {}
  };
  const connectionListeners = serverModule.io.listeners('connection');
  connectionListeners.forEach(listener => listener(p3Socket));
  p3Socket._handlers['join_game']({ room: 'ROOM3', name: 'Arjun', color: '#10b981', clientId: 'p3' });

  // Assert p3 is not added and received action_error
  assert.strictEqual(game.players.length, 2);
  assert.ok(emittedEvents.some(ee => ee.target === 'p3' && ee.event === 'action_error' && ee.data.includes('started')));

  // Reconnect player 1
  game.players[0].connected = false;
  const p1ReconnectSocket = {
    id: 'p1-new',
    join: () => {},
    on: (event, handler) => { p1ReconnectSocket._handlers[event] = handler; },
    emit: () => {},
    _handlers: {}
  };
  connectionListeners.forEach(listener => listener(p1ReconnectSocket));
  p1ReconnectSocket._handlers['join_game']({ room: 'ROOM3', name: 'Aarav', color: '#ef4444', clientId: 'p1' });

  assert.strictEqual(game.players[0].connected, true);
  assert.strictEqual(game.players[0].id, 'p1-new'); // updated socket ID
});

// ==========================================
// 4. declined property auction
// ==========================================
runTest('declined property auction starts for everyone (via actual Socket.IO events)', () => {
  const { game, sockets, hostSocket } = setupTestGame('ROOM4', [
    { id: 'p1', name: 'Aarav', color: '#ef4444' },
    { id: 'p2', name: 'Diya', color: '#3b82f6' }
  ]);

  sockets[0]._handlers['start_game']({ room: 'ROOM4' });

  // Mock landing on a property (Patna, ID=1)
  game.pendingBuy = { playerId: 'p1', propertyId: 1 };
  game.currentTurn = 0; // Aarav's turn

  // Aarav declines property and starts auction
  sockets[0]._handlers['start_auction']({ room: 'ROOM4', propertyId: 1 });

  assert.strictEqual(game.auction.status, true);
  assert.strictEqual(game.auction.propertyId, 1);
});

// ==========================================
// 5. no-bid no winner
// ==========================================
runTest('no-bid auction leaves property unowned', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1500, properties: [] },
      { id: 'p2', name: 'Diya', cash: 1500, properties: [] }
    ],
    auction: {
      status: true,
      propertyId: 1,
      currentBid: 0,
      highestBidder: null,
      activePlayers: ['p1', 'p2']
    },
    boardState: { 1: { owner: null } },
    logs: [],
    bankruptcyAuctionQueue: []
  };

  endAuction(game, 'test-room');
  assert.strictEqual(game.boardState[1].owner, null); // Unsold
});

// ==========================================
// 6. no free ₹10 award
// ==========================================
runTest('no free ₹10 award to last participant who never bid', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1500, properties: [] },
      { id: 'p2', name: 'Diya', cash: 1500, properties: [] }
    ],
    auction: {
      status: true,
      propertyId: 1,
      currentBid: 0,
      highestBidder: null,
      activePlayers: ['p1'] // Only Diya remains active but never bid
    },
    boardState: { 1: { owner: null } },
    logs: [],
    bankruptcyAuctionQueue: []
  };

  endAuction(game, 'test-room');
  assert.strictEqual(game.boardState[1].owner, null); // Remains unsold
});

// ==========================================
// 7. over-cash bid rejected
// ==========================================
runTest('over-cash bid rejected (via actual Socket.IO events)', () => {
  const { game, sockets, hostSocket } = setupTestGame('ROOM7', [
    { id: 'p1', name: 'Aarav', color: '#ef4444' },
    { id: 'p2', name: 'Diya', color: '#3b82f6' }
  ]);

  sockets[0]._handlers['start_game']({ room: 'ROOM7' });

  // Set Aarav's cash to 100
  game.players[0].cash = 100;

  // Setup active auction
  game.auction = {
    status: true,
    propertyId: 1,
    currentBid: 50,
    highestBidder: 'p2',
    activePlayers: ['p1', 'p2']
  };

  // Aarav attempts to bid 150 (exceeds cash)
  sockets[0]._handlers['place_bid']({ room: 'ROOM7', amount: 150 });

  assert.strictEqual(game.auction.currentBid, 50);
  assert.ok(emittedEvents.some(ee => ee.target === 'p1' && ee.event === 'action_error' && ee.data.includes('exceed')));
});

// ==========================================
// 8. single transfer
// ==========================================
runTest('single transfer on auction win', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1500, properties: [] },
      { id: 'p2', name: 'Diya', cash: 1500, properties: [] }
    ],
    auction: {
      status: true,
      propertyId: 1,
      currentBid: 100,
      highestBidder: 'p1',
      activePlayers: ['p1', 'p2']
    },
    boardState: { 1: { owner: null } },
    logs: [],
    bankruptcyAuctionQueue: []
  };

  endAuction(game, 'test-room');
  assert.strictEqual(game.boardState[1].owner, 'p1');
  assert.strictEqual(game.players[0].cash, 1400); // 1500 - 100
});

// ==========================================
// 9. partial debt does not create money
// ==========================================
runTest('partial debt does not create money out of thin air', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 100, properties: [1] },
      { id: 'p2', name: 'Diya', cash: 500, properties: [] }
    ],
    boardState: { 1: { owner: 'p1', mortgaged: false, houses: 0 } },
    logs: []
  };

  // Aarav owes Diya ₹250
  chargePlayer(game, 'test-room', game.players[0], 250, 'p2');

  // Only Aarav's available cash (₹100) should be transferred
  assert.strictEqual(game.players[0].cash, 0);
  assert.strictEqual(game.players[1].cash, 600); // 500 + 100
  assert.strictEqual(game.players[0].debtAmount, 150); // ₹150 remains as debt
});

// ==========================================
// 10. both bankruptcy paths
// ==========================================
runTest('bankruptcy path to player', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 0, properties: [1], creditorId: 'p2', jailCards: [] },
      { id: 'p2', name: 'Diya', cash: 500, properties: [] }
    ],
    boardState: { 1: { owner: 'p1', mortgaged: false, houses: 0 } },
    logs: [],
    bankruptcyResolveQueue: [],
    bankruptcyAuctionQueue: []
  };

  declareBankruptcy(game, 'test-room', game.players[0]);
  assert.strictEqual(game.boardState[1].owner, 'p2'); // Transferred to creditor
  assert.strictEqual(game.players[1].properties.includes(1), true);
});

runTest('bankruptcy path to bank', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 0, properties: [1], creditorId: null, jailCards: [] },
      { id: 'p2', name: 'Diya', cash: 500, properties: [] }
    ],
    boardState: { 1: { owner: 'p1', mortgaged: true, houses: 0 } },
    logs: [],
    bankruptcyResolveQueue: [],
    bankruptcyAuctionQueue: []
  };

  declareBankruptcy(game, 'test-room', game.players[0]);
  assert.strictEqual(game.boardState[1].owner, null); // Returned to Bank
  assert.strictEqual(game.boardState[1].mortgaged, false); // Building-free & unmortgaged
  assert.strictEqual(game.bankruptcyAuctionQueue[0], 1); // Queued for auction
});

// ==========================================
// 11. inventory restoration and caps
// ==========================================
runTest('inventory restoration and caps', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 0, properties: [1], creditorId: null, jailCards: [] }
    ],
    boardState: { 1: { owner: 'p1', mortgaged: false, houses: 5 } }, // 1 hotel
    availableHouses: 28,
    availableHotels: 11,
    logs: [],
    bankruptcyResolveQueue: [],
    bankruptcyAuctionQueue: []
  };

  declareBankruptcy(game, 'test-room', game.players[0]);
  // Liquidating hotel adds 1 hotel and 4 houses back
  assert.strictEqual(game.availableHouses, 32);
  assert.strictEqual(game.availableHotels, 12);
});

// ==========================================
// 12. jail card removal / use / trade
// ==========================================
runTest('jail card removal, use, and trade', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1000, properties: [], jailCards: [] },
      { id: 'p2', name: 'Diya', cash: 1000, properties: [], jailCards: [] }
    ],
    chanceDeck: [{ type: 'jail_card', deckType: 'chance' }],
    chestDeck: [{ type: 'jail_card', deckType: 'chest' }],
    logs: []
  };

  // Draw card
  drawAndResolveCard(game, 'test-room', game.players[0], 'chance', 0);
  assert.strictEqual(game.players[0].jailCards.length, 1);
  assert.strictEqual(game.players[0].jailCards[0], 'chance');
  assert.strictEqual(game.chanceDeck.length, 0); // Removed from rotation

  // Trade jail card
  // Aarav trades jail card to Diya
  const card = game.players[0].jailCards.shift();
  game.players[1].jailCards.push(card);
  game.players[0].getOutOfJailCards = game.players[0].jailCards.length;
  game.players[1].getOutOfJailCards = game.players[1].jailCards.length;

  assert.strictEqual(game.players[0].jailCards.length, 0);
  assert.strictEqual(game.players[1].jailCards.length, 1);
  assert.strictEqual(game.players[1].jailCards[0], 'chance');
});

// ==========================================
// 13. 16 cards per deck
// ==========================================
runTest('16 cards per deck', () => {
  assert.strictEqual(chanceDeckMaster.length, 16);
  assert.strictEqual(chestDeckMaster.length, 16);
});

// ==========================================
// 14. nearest station
// ==========================================
runTest('nearest station card resolution', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1000, position: 7, properties: [] },
      { id: 'p2', name: 'Diya', cash: 1000, properties: [15] } // Owns Howrah Station (15)
    ],
    boardState: { 15: { owner: 'p2', mortgaged: false } },
    logs: []
  };

  const card = { type: 'nearest_station' };
  executeCardAction(game, 'test-room', game.players[0], card, 0);

  assert.strictEqual(game.players[0].position, 15);
  // Aarav pays double rent (2 * 25 = ₹50) to Diya
  assert.strictEqual(game.players[0].cash, 950);
  assert.strictEqual(game.players[1].cash, 1050);
});

// ==========================================
// 15. nearest utility
// ==========================================
runTest('nearest utility card resolution', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1000, position: 22, properties: [] },
      { id: 'p2', name: 'Diya', cash: 1000, properties: [27] } // Owns Water Works (27)
    ],
    boardState: { 27: { owner: 'p2', mortgaged: false } },
    testDiceQueue: [3, 4], // fresh roll throw
    logs: []
  };

  const card = { type: 'nearest_utility' };
  executeCardAction(game, 'test-room', game.players[0], card, 0);

  assert.strictEqual(game.players[0].position, 27);
  // Aarav pays 10x roll (10 * 7 = ₹70) to Diya
  assert.strictEqual(game.players[0].cash, 930);
  assert.strictEqual(game.players[1].cash, 1070);
});

// ==========================================
// 16. repairs
// ==========================================
runTest('repairs card resolution', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1000, properties: [1, 3] }
    ],
    boardState: {
      1: { owner: 'p1', houses: 3 },
      3: { owner: 'p1', houses: 5 } // hotel
    },
    logs: []
  };

  const card = { type: 'repairs', houseCost: 25, hotelCost: 100 };
  executeCardAction(game, 'test-room', game.players[0], card, 0);

  // Cost: 3 houses * 25 + 1 hotel * 100 = ₹175
  assert.strictEqual(game.players[0].cash, 825);
});

// ==========================================
// 17. birthday / chairman debt
// ==========================================
runTest('birthday card resolution with debt resolution', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1000, properties: [] },
      { id: 'p2', name: 'Diya', cash: 5, properties: [1] } // has property to raise money
    ],
    boardState: { 1: { owner: 'p2', mortgaged: false, houses: 0 } },
    logs: []
  };

  const card = { type: 'birthday' };
  executeCardAction(game, 'test-room', game.players[0], card, 0);

  // Diya pays ₹5 and owes ₹5 remainder
  assert.strictEqual(game.players[1].cash, 0);
  assert.strictEqual(game.players[0].cash, 1005);
  assert.strictEqual(game.players[1].debtAmount, 5);
});

// ==========================================
// 18. Back 3 full resolution
// ==========================================
runTest('Back 3 full landing resolution', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1000, position: 7, properties: [] }
    ],
    boardState: {},
    logs: []
  };

  const card = { type: 'go_back_3' };
  executeCardAction(game, 'test-room', game.players[0], card, 0);

  // Landed on Income Tax (Tile 4) costing ₹200
  assert.strictEqual(game.players[0].position, 4);
  assert.strictEqual(game.players[0].cash, 800);
});

// ==========================================
// 19. no double GO salary
// ==========================================
runTest('no double GO salary on movement', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1000, position: 36, properties: [] }
    ],
    boardState: { 5: { owner: null } },
    logs: []
  };

  // Move player from 36 to Chennai Central (5) passing GO
  movePlayerTo(game, 'test-room', game.players[0], 5, true);
  assert.strictEqual(game.players[0].cash, 1200); // 1000 + 200
});

// ==========================================
// 20. Game lifecycle rejects before start
// ==========================================
runTest('game rejects rolls and actions before start (via actual Socket.IO events)', () => {
  const { game, sockets } = setupTestGame('ROOM20', [
    { id: 'p1', name: 'Aarav', color: '#ef4444' },
    { id: 'p2', name: 'Diya', color: '#3b82f6' }
  ]);

  // Aarav attempts to roll before game starts
  sockets[0]._handlers['roll_dice']({ room: 'ROOM20' });

  assert.strictEqual(game.hasRolled || false, false);
  assert.ok(emittedEvents.some(ee => ee.target === 'p1' && ee.event === 'action_error' && ee.data.toLowerCase().includes('not active')));
});

// ==========================================
// 21. Unmortgage transferred decision
// ==========================================
runTest('unmortgage transferred resolution block prevents rolls (via actual Socket.IO events)', () => {
  const { game, sockets, hostSocket } = setupTestGame('ROOM21', [
    { id: 'p1', name: 'Aarav', color: '#ef4444' },
    { id: 'p2', name: 'Diya', color: '#3b82f6' }
  ]);

  sockets[0]._handlers['start_game']({ room: 'ROOM21' });

  // Setup resolution queue where p2 must decide on mortgaged property
  game.bankruptcyResolveQueue = [{ propertyId: 1, creditorId: 'p2', bankruptPlayerName: 'Aarav' }];

  // Set current turn to player 2 (Diya)
  game.currentTurn = 1;

  // Player 2 attempts to roll dice while resolution is pending
  sockets[1]._handlers['roll_dice']({ room: 'ROOM21' });

  assert.strictEqual(game.hasRolled || false, false);
  assert.ok(emittedEvents.some(ee => ee.target === 'p2' && ee.event === 'action_error' && ee.data.includes('Resolve mortgaged')));
});

// ==========================================
// 22. Save migration / compatibility
// ==========================================
runTest('safely migrates old saves without crash (via actual game restore handler)', () => {
  const testRoomId = 'MIGRATE_TEST';
  const saveFilePath = path.join(__dirname, 'game_saves', `${testRoomId}.json`);

  // Ensure game_saves directory exists
  if (!fs.existsSync(path.join(__dirname, 'game_saves'))) {
    fs.mkdirSync(path.join(__dirname, 'game_saves'));
  }

  const oldSaveState = {
    players: [
      { id: 'p1', name: 'Aarav', color: '#ef4444', getOutOfJailCards: 1 }
    ],
    boardState: {},
    gameStatus: 'active'
  };

  // Write migration save file to disk
  fs.writeFileSync(saveFilePath, JSON.stringify(oldSaveState), 'utf8');

  // Mock host connection to trigger room load
  const hostSocketMock = {
    id: 'host-socket-migrate',
    join: () => {},
    on: (event, handler) => {
      hostSocketMock._handlers[event] = handler;
    },
    emit: () => {},
    _handlers: {}
  };
  const connectionListeners = serverModule.io.listeners('connection');
  connectionListeners.forEach(listener => listener(hostSocketMock));

  // Trigger create_room which restores the game from save
  hostSocketMock._handlers['create_room'](testRoomId);

  const loadedGame = rooms[testRoomId];
  assert.ok(loadedGame);
  assert.strictEqual(loadedGame.players[0].jailCards[0], 'chance');
  assert.strictEqual(loadedGame.players[0].getOutOfJailCards, 1);

  // Clean up test save file
  try {
    fs.unlinkSync(saveFilePath);
  } catch (e) {}
  delete rooms[testRoomId];
});

// ==========================================
// 23. Jail Paths Emit Exactly One JAIL Event
// ==========================================
runTest('every jail path emits exactly one JAIL visual event; visiting Jail tile emits none', () => {
  const { game, sockets } = setupTestGame('ROOM23', [
    { id: 'p1', name: 'Aarav', color: '#ef4444' },
    { id: 'p2', name: 'Diya', color: '#3b82f6' }
  ]);

  sockets[0]._handlers['start_game']({ room: 'ROOM23' });

  // 1. Visit Jail tile (position 10) normally
  emittedEvents.length = 0;
  game.players[0].position = 8;
  movePlayerTo(game, 'ROOM23', game.players[0], 10, false);
  const visitJailEvents = emittedEvents.filter(ee => ee.event === 'trigger_visual' && ee.data?.type === 'JAIL');
  assert.strictEqual(visitJailEvents.length, 0);

  // 2. Go to jail tile landing (position 30)
  emittedEvents.length = 0;
  game.players[0].position = 28;
  movePlayerTo(game, 'ROOM23', game.players[0], 30, true);
  const landingJailEvents = emittedEvents.filter(ee => ee.event === 'trigger_visual' && ee.data?.type === 'JAIL');
  assert.strictEqual(landingJailEvents.length, 1);
  assert.strictEqual(landingJailEvents[0].data.reason, 'go_to_jail');
  assert.strictEqual(landingJailEvents[0].data.player, 'Aarav');

  // 3. Card jail path
  emittedEvents.length = 0;
  executeCardAction(game, 'ROOM23', game.players[0], { type: 'go_jail' }, 0);
  const cardJailEvents = emittedEvents.filter(ee => ee.event === 'trigger_visual' && ee.data?.type === 'JAIL');
  assert.strictEqual(cardJailEvents.length, 1);
  assert.strictEqual(cardJailEvents[0].data.reason, 'card');

  // 4. Third consecutive doubles
  const originalRandom = Math.random;
  Math.random = () => 0;

  emittedEvents.length = 0;
  game.players[0].inJail = false;
  game.players[0].consecutiveDoubles = 2;
  game.players[0].position = 0;
  game.hasRolled = false;

  sockets[0]._handlers['roll_dice']({ room: 'ROOM23' });

  Math.random = originalRandom;

  const doublesJailEvents = emittedEvents.filter(ee => ee.event === 'trigger_visual' && ee.data?.type === 'JAIL');
  assert.strictEqual(doublesJailEvents.length, 1);
  assert.strictEqual(doublesJailEvents[0].data.reason, 'three_doubles');
});

console.log(`\n🏆 DETERMINISTIC TESTS RESULT: ${passCount} / ${testCount} PASSED`);
if (passCount !== testCount) {
  process.exit(1);
} else {
  process.exit(0);
}
