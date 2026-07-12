import io from 'socket.io-client';

console.log("Starting Indian Monopoly Gameplay Integration Test...");

const socketUrl = 'http://localhost:3001';

// Create connections
const hostSocket = io(socketUrl);
const player1Socket = io(socketUrl, { autoConnect: false });
const player2Socket = io(socketUrl, { autoConnect: false });

let gameState = null;
let p1Done = false;
let p2Done = false;

// Helpers
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

hostSocket.on('connect', () => {
  console.log('Host connected to server');
  hostSocket.emit('create_room', 'ABCD');
});

hostSocket.on('game_update', (state) => {
  gameState = state;
  console.log('\n--- HOST GAME UPDATE ---');
  console.log(`Current Turn: ${state.players[state.currentTurn]?.name}`);
  console.log(`Logs:`);
  state.logs.slice(0, 3).forEach(log => console.log(`  ${log}`));
  console.log('Players:');
  state.players.forEach(p => {
    console.log(`  - ${p.name}: Cash = ₹${p.cash}, Position = ${p.position}, Properties = ${p.properties.join(', ')}`);
  });
  console.log('------------------------\n');
});

hostSocket.on('trigger_visual', (data) => {
  console.log(`[Visual Event triggered on Host]:`, data);
});

// Setup Player 1
player1Socket.on('connect', () => {
  console.log('Player 1 (Aarav) connected');
  player1Socket.emit('join_game', { room: 'ABCD', name: 'Aarav' });
});

player1Socket.on('prompt_buy', (tile) => {
  console.log(`[Player 1] Prompted to buy: ${tile.name} (Price: ₹${tile.price})`);
  console.log(`[Player 1] Buying property ${tile.id}...`);
  player1Socket.emit('buy_property', { room: 'ABCD', propertyId: tile.id });
});

player1Socket.on('trade_offer', (offer) => {
  console.log(`[Player 1] Received trade offer:`, offer);
});

// Setup Player 2
player2Socket.on('connect', () => {
  console.log('Player 2 (Diya) connected');
  player2Socket.emit('join_game', { room: 'ABCD', name: 'Diya' });
});

player2Socket.on('prompt_buy', (tile) => {
  console.log(`[Player 2] Prompted to buy: ${tile.name} (Price: ₹${tile.price})`);
  console.log(`[Player 2] Buying property ${tile.id}...`);
  player2Socket.emit('buy_property', { room: 'ABCD', propertyId: tile.id });
});

async function runTest() {
  await delay(1000); // Let Host connect and create room first
  console.log("Connecting Player 1 (Aarav)...");
  player1Socket.connect();
  
  await delay(1000); // Give Player 1 time to connect and join
  console.log("Connecting Player 2 (Diya)...");
  player2Socket.connect();

  // Wait until we have 2 players in the game state
  let attempts = 0;
  while ((!gameState || gameState.players.length < 2) && attempts < 10) {
    await delay(500);
    attempts++;
  }

  if (!gameState || gameState.players.length < 2) {
    console.error("Test failed: Players could not join room ABCD. Current players in state:", gameState?.players);
    process.exit(1);
  }

  console.log("\n>>> STARTING GAMEPLAY SIMULATION <<<\n");

  // Round 1 - Player 1 (Aarav) Turn
  console.log(">>> [Round 1] Aarav's Turn: Rolling dice...");
  player1Socket.emit('roll_dice', { room: 'ABCD' });
  await delay(1500);

  console.log(">>> [Round 1] Aarav: Ending turn...");
  player1Socket.emit('end_turn', { room: 'ABCD' });
  await delay(1000);

  // Round 1 - Player 2 (Diya) Turn
  console.log(">>> [Round 1] Diya's Turn: Rolling dice...");
  player2Socket.emit('roll_dice', { room: 'ABCD' });
  await delay(1500);

  console.log(">>> [Round 1] Diya: Ending turn...");
  player2Socket.emit('end_turn', { room: 'ABCD' });
  await delay(1000);

  // Round 2 - Player 1 (Aarav) Turn
  console.log(">>> [Round 2] Aarav's Turn: Rolling dice...");
  player1Socket.emit('roll_dice', { room: 'ABCD' });
  await delay(1500);

  console.log(">>> [Round 2] Aarav: Ending turn...");
  player1Socket.emit('end_turn', { room: 'ABCD' });
  await delay(1000);

  // Round 2 - Player 2 (Diya) Turn
  console.log(">>> [Round 2] Diya's Turn: Rolling dice...");
  player2Socket.emit('roll_dice', { room: 'ABCD' });
  await delay(1500);

  console.log(">>> [Round 2] Diya: Ending turn...");
  player2Socket.emit('end_turn', { room: 'ABCD' });
  await delay(1000);

  console.log("\n>>> SIMULATION COMPLETE. CLOSING SOCKETS. <<<\n");
  hostSocket.disconnect();
  player1Socket.disconnect();
  player2Socket.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Error in gameplay simulation:", err);
  process.exit(1);
});
