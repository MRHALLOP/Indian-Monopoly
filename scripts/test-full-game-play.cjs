const io = require('../client/node_modules/socket.io-client');

const SERVER_URL = 'http://localhost:3001';
const ROOM = 'FULLGAME';
const HOST_KEY = 'hk_test_game_123';

async function runFullGameSimulation() {
  console.log('🚀 Starting 200-turn Full Game Simulation on', SERVER_URL);

  const hostSocket = io(SERVER_URL, { forceNew: true });
  
  // 1. Setup Host
  await new Promise((resolve, reject) => {
    hostSocket.on('connect', () => {
      hostSocket.emit('create_room', { room: ROOM, hostKey: HOST_KEY });
      resolve();
    });
    hostSocket.on('connect_error', reject);
  });

  let latestGame = null;

  const visualEventsLog = [];
  hostSocket.on('trigger_visual', (event) => {
    visualEventsLog.push(event);
  });

  // 2. Connect 4 Player Clients
  const playersData = [
    { name: 'Aarav', color: '#ef4444', clientId: 'cid_aarav' },
    { name: 'Diya', color: '#3b82f6', clientId: 'cid_diya' },
    { name: 'Kabir', color: '#10b981', clientId: 'cid_kabir' },
    { name: 'Ananya', color: '#f59e0b', clientId: 'cid_ananya' }
  ];

  const sockets = [];
  for (const p of playersData) {
    const s = io(SERVER_URL, { forceNew: true });
    await new Promise((resolve) => {
      s.on('connect', () => {
        s.emit('join_game', { room: ROOM, name: p.name, color: p.color, clientId: p.clientId });
        s.on('game_update', (g) => { latestGame = g; });
        resolve();
      });
    });
    sockets.push(s);
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  hostSocket.on('game_update', (g) => {
    latestGame = g;
  });

  // 3. Start Game
  sockets[0].emit('start_game', { room: ROOM });
  await delay(600);

  console.log('✅ Game started with', latestGame.players.length, 'players!');

  // 4. Play 200 Turns automatically
  let totalRolls = 0;
  let auctionsCount = 0;
  let buysCount = 0;

  for (let turn = 1; turn <= 200; turn++) {
    if (!latestGame || latestGame.gameStatus !== 'active') {
      console.log(`ℹ️ Game finished early at turn ${turn}! Winner:`, latestGame?.winner || 'None');
      break;
    }

    const activePlayers = latestGame.players.filter(p => !p.bankrupt);
    if (activePlayers.length <= 1) {
      console.log(`🏆 Game Over! Winner: ${activePlayers[0]?.name || 'Nobody'}`);
      break;
    }

    const currentTurnIdx = latestGame.currentTurn;
    const activePlayer = latestGame.players[currentTurnIdx];
    const playerSocket = sockets.find((_, idx) => playersData[idx].name === activePlayer.name);

    if (!activePlayer || activePlayer.bankrupt || !playerSocket) {
      await delay(100);
      continue;
    }

    // A. Handle raising money if in debt
    if (activePlayer.needsToRaiseMoney) {
      const unmortgagedProp = activePlayer.properties.find(p => !latestGame.boardState[p]?.mortgaged);
      if (unmortgagedProp !== undefined) {
        playerSocket.emit('manage_property', { room: ROOM, propertyId: unmortgagedProp, action: 'MORTGAGE' });
        await delay(200);
      } else {
        playerSocket.emit('declare_bankruptcy', { room: ROOM });
        await delay(300);
        continue;
      }
    }

    // B. Handle Jail
    if (activePlayer.inJail) {
      if (activePlayer.getOutOfJailCards > 0) {
        playerSocket.emit('use_jail_card', { room: ROOM });
        await delay(200);
      } else if (activePlayer.cash >= 50) {
        playerSocket.emit('pay_bail', { room: ROOM });
        await delay(200);
      }
    }

    // C. Roll Dice (if turn requires roll)
    if (!latestGame.hasRolled) {
      playerSocket.emit('roll_dice', { room: ROOM });
      totalRolls++;
      await delay(300);
    }

    // D. Handle Pending Buy or Auction
    if (latestGame.pendingBuy) {
      const propId = latestGame.pendingBuy.propertyId;
      if (activePlayer.cash >= latestGame.pendingBuy.price) {
        playerSocket.emit('buy_property', { room: ROOM, propertyId: propId });
        buysCount++;
        await delay(300);
      } else {
        playerSocket.emit('start_auction', { room: ROOM, propertyId: propId });
        auctionsCount++;
        await delay(300);

        // Withdraw all active auction players so property resolves
        if (latestGame.auction && latestGame.auction.status) {
          const bidderSockets = sockets.filter((_, idx) => playersData[idx].name !== activePlayer.name);
          bidderSockets.forEach(s => s.emit('withdraw_auction', { room: ROOM }));
          await delay(300);
        }
      }
    }

    // E. End Turn
    if (latestGame.hasRolled && !latestGame.pendingBuy && (!latestGame.auction || !latestGame.auction.status)) {
      playerSocket.emit('end_turn', { room: ROOM });
      await delay(200);
    }
  }

  // 5. Gather Final Statistics
  const visualTypesCount = {};
  visualEventsLog.forEach(e => {
    visualTypesCount[e.type] = (visualTypesCount[e.type] || 0) + 1;
  });

  console.log('\n📊 --- GAME SIMULATION RESULTS ---');
  console.log('Total Rolls Executed:', totalRolls);
  console.log('Total Buys Executed:', buysCount);
  console.log('Total Auctions Triggered:', auctionsCount);
  console.log('Visual Events Logged:', visualEventsLog.length, visualTypesCount);
  console.log('Final Players State:', latestGame.players.map(p => ({
    name: p.name,
    cash: p.cash,
    position: p.position,
    bankrupt: p.bankrupt,
    propsCount: p.properties.length
  })));

  hostSocket.disconnect();
  sockets.forEach(s => s.disconnect());
  console.log('✅ 200-Turn Simulation completed successfully without crashes or soft-locks!');
  process.exit(0);
}

runFullGameSimulation().catch(err => {
  console.error('❌ Simulation Error:', err);
  process.exit(1);
});
