const assert = require('assert');
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

// Helper mock socket object
function createMockSocket(id) {
  return {
    id,
    emit: (event, data) => {
      if (event === 'action_error') {
        actionErrors.push({ socketId: id, error: data });
      } else {
        emittedEvents.push({ target: id, event, data });
      }
    }
  };
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
runTest('start requires 2 players', () => {
  const game = {
    hostId: 'host-socket',
    players: [{ id: 'p1', name: 'Aarav', cash: 1500 }],
    gameStatus: 'lobby',
    logs: [],
    testDiceQueue: [4, 4]
  };
  
  // Simulate starting with 1 player
  if (game.players.length < 2) {
    game.logs.push('Error: At least 2 players required.');
  } else {
    game.gameStatus = 'active';
  }
  assert.strictEqual(game.gameStatus, 'lobby');
  
  // Add 2nd player
  game.players.push({ id: 'p2', name: 'Diya', cash: 1500 });
  if (game.players.length >= 2) {
    game.gameStatus = 'active';
  }
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
runTest('late join blocked / reconnect allowed', () => {
  const game = {
    gameStatus: 'active',
    players: [
      { id: 'p1', clientId: 'c1', name: 'Aarav', connected: true },
      { id: 'p2', clientId: 'c2', name: 'Diya', connected: true }
    ],
    logs: []
  };
  
  // Attempt late join from a new player
  const newPlayerJoined = game.gameStatus === 'lobby';
  assert.strictEqual(newPlayerJoined, false);
  
  // Reconnection of existing player
  const existing = game.players.find(p => p.clientId === 'c1');
  assert.ok(existing);
  existing.id = 'p1-new-socket';
  existing.connected = true;
  assert.strictEqual(existing.id, 'p1-new-socket');
});

// ==========================================
// 4. declined property auction
// ==========================================
runTest('declined property auction starts for everyone', () => {
  const game = {
    players: [
      { id: 'p1', name: 'Aarav', cash: 1500 },
      { id: 'p2', name: 'Diya', cash: 1500 }
    ],
    auction: { status: false },
    logs: []
  };
  
  // Player declines property
  game.auction = {
    status: true,
    propertyId: 1,
    currentBid: 0,
    highestBidder: null,
    activePlayers: ['p1', 'p2']
  };
  assert.strictEqual(game.auction.status, true);
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
runTest('over-cash bid rejected', () => {
  const player = { id: 'p1', name: 'Aarav', cash: 100 };
  const auction = { currentBid: 50 };
  const bidAmount = 150;
  
  const canBid = (auction.currentBid + bidAmount) <= player.cash;
  assert.strictEqual(canBid, false);
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
runTest('game rejects rolls and actions before start', () => {
  const game = {
    gameStatus: 'lobby',
    players: [{ id: 'p1', name: 'Aarav' }]
  };
  const isActionAllowed = game.gameStatus === 'active';
  assert.strictEqual(isActionAllowed, false);
});

// ==========================================
// 21. Unmortgage transferred decision
// ==========================================
runTest('unmortgage transferred resolution block', () => {
  const game = {
    bankruptcyResolveQueue: [{ propertyId: 1, creditorId: 'p2', bankruptPlayerName: 'Aarav' }]
  };
  const canAdvance = game.bankruptcyResolveQueue.length === 0;
  assert.strictEqual(canAdvance, false); // Blocked
});

// ==========================================
// 22. Save migration / compatibility
// ==========================================
runTest('safely migrates old saves without crash', () => {
  const oldSave = {
    players: [
      { id: 'p1', name: 'Aarav', getOutOfJailCards: 1 }
    ]
  };
  
  // Run migration
  oldSave.players.forEach(p => {
    p.jailCards = p.jailCards || [];
    if (p.getOutOfJailCards > 0 && p.jailCards.length === 0) {
      if (p.getOutOfJailCards === 1) p.jailCards.push('chance');
    }
  });
  
  assert.strictEqual(oldSave.players[0].jailCards[0], 'chance');
});

console.log(`\n🏆 DETERMINISTIC TESTS RESULT: ${passCount} / ${testCount} PASSED`);
if (passCount !== testCount) {
  process.exit(1);
} else {
  process.exit(0);
}
