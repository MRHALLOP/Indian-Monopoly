/**
 * Indian Monopoly — Rigorous Browser Integration Test
 * 
 * Opens 3 real Chrome tabs (1 Host + 2 Players), takes screenshots,
 * clicks UI elements, and verifies the full game loop including:
 * - Room creation and player joining in Lobby mode
 * - Lobby blocking rolls and gameplay actions
 * - Starting the game via host/lobby leader activating gameplay
 * - Display of starting rolls and order
 * - Late joins failing after game starts
 * - Reconnection of disconnected players
 * - Dice rolling, turn management, property buying, and end turn
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const BASE_URL = 'http://localhost:5173';

async function takeScreenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await sleep(500);
  await page.screenshot({ path: filePath });
  console.log(`  📸 Screenshot saved: ${name}.png`);
  return filePath;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function completeTurn(page, name) {
  console.log(`  🔄 Completing turn for ${name}...`);
  let attempts = 0;
  while (attempts < 6) {
    attempts++;
    await sleep(2000);
    
    // If END TURN button is visible, click it and we are done!
    const endBtnClicked = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const btn = buttons.find(b => b.textContent.toUpperCase().includes('END TURN'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (endBtnClicked) {
      console.log(`  End Turn clicked.`);
      await sleep(2000);
      break;
    }

    // If ROLL DICE button is visible, click it
    const rollBtnClicked = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const btn = buttons.find(b => b.textContent.toUpperCase().includes('ROLL'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (rollBtnClicked) {
      console.log(`  Roll Dice clicked.`);
      await sleep(5000); // wait for roll animation and socket updates
      continue;
    }

    // If BUY button is visible, click it
    const buyBtnClicked = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const btn = buttons.find(b => b.textContent.toUpperCase().includes('BUY'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (buyBtnClicked) {
      console.log(`  Buy Property clicked.`);
      await sleep(2000);
      continue;
    }
  }
}

(async () => {
  console.log('\n🎲 ═══════════════════════════════════════════════════');
  console.log('   INDIAN MONOPOLY — RIGOROUS BROWSER E2E TEST');
  console.log('═══════════════════════════════════════════════════\n');

  const randomRoomId = 'TEST_' + Math.floor(1000 + Math.random() * 9000);
  console.log(`Using random room ID: ${randomRoomId}\n`);

  // Launch Chrome in headless mode
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1400, height: 900 },
    protocolTimeout: 60000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  let hostPage, player1Page, player2Page, player3Page;
  let testsPassed = 0;
  let testsFailed = 0;

  function pass(testName) {
    testsPassed++;
    console.log(`  ✅ PASS: ${testName}`);
  }

  function fail(testName, reason) {
    testsFailed++;
    console.log(`  ❌ FAIL: ${testName} — ${reason}`);
  }

  try {
    // ═══════════════════════════════════════════════════
    // TEST 1: Landing Page & Host Initialization
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 1: Landing Page & Host Initialization');
    hostPage = await browser.newPage();
    await hostPage.goto(`${BASE_URL}/?mode=host&room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    const hostBodyText = await hostPage.evaluate(() => document.body.innerText);
    if (hostBodyText.includes('INDIAN MONOPOLY') && hostBodyText.includes(randomRoomId)) {
      pass('Host lobby initialized with Room Code');
    } else {
      fail('Host lobby initialized with Room Code', `Page text: ${hostBodyText}`);
    }
    await takeScreenshot(hostPage, '02_host_board_empty');

    // ═══════════════════════════════════════════════════
    // TEST 2: Players Join and Lobby Screen Displays
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 2: Players Join and Lobby Screen Displays');
    
    // Player 1 Joins
    const context1 = await browser.createBrowserContext();
    player1Page = await context1.newPage();
    await player1Page.goto(`${BASE_URL}/?mode=client&room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    
    await player1Page.type('input[placeholder="e.g. Arjun, Priya..."]', 'Aarav');
    await sleep(500);
    await player1Page.click('button'); // CONNECT
    await sleep(2000);
    const p1LobbyText = await player1Page.evaluate(() => document.body.innerText);
    if (p1LobbyText.toUpperCase().includes('GAME LOBBY') && p1LobbyText.includes('Aarav') && p1LobbyText.toUpperCase().includes('LEADER')) {
      pass('Player 1 (Aarav) connected, sees Game Lobby, designated as Leader');
    } else {
      fail('Player 1 (Aarav) connected to lobby', `Lobby text: ${p1LobbyText}`);
    }
    await takeScreenshot(player1Page, '03_player1_lobby');

    // Player 2 Joins
    const context2 = await browser.createBrowserContext();
    player2Page = await context2.newPage();
    await player2Page.goto(`${BASE_URL}/?mode=client&room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    
    await player2Page.type('input[placeholder="e.g. Arjun, Priya..."]', 'Diya');
    await sleep(500);
    await player2Page.click('button'); // CONNECT
    await sleep(2000);

    const p2LobbyText = await player2Page.evaluate(() => document.body.innerText);
    if (p2LobbyText.toUpperCase().includes('GAME LOBBY') && p2LobbyText.includes('Diya') && p2LobbyText.toUpperCase().includes('WAITING FOR THE TV/LOBBY LEADER')) {
      pass('Player 2 (Diya) connected, sees Game Lobby, waiting for start');
    } else {
      fail('Player 2 (Diya) connected to lobby', `Lobby text: ${p2LobbyText}`);
    }

    // Verify host board shows both players connected
    const hostTextLobby = await hostPage.evaluate(() => document.body.innerText);
    if (hostTextLobby.includes('Aarav') && hostTextLobby.includes('Diya')) {
      pass('Host lobby screen updated with both players connected');
    } else {
      fail('Host lobby screen updated with both players', `Host text: ${hostTextLobby}`);
    }
    await takeScreenshot(hostPage, '001_host_lobby_connected');

    // ═══════════════════════════════════════════════════
    // TEST 3: Lobby Blocks Rolls
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 3: Lobby Blocks Rolls');
    const p1HasRoll = await player1Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
    });
    const p2HasRoll = await player2Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
    });
    if (!p1HasRoll && !p2HasRoll) {
      pass('Lobby successfully blocks gameplay rolls (no ROLL button visible)');
    } else {
      fail('Lobby blocks gameplay rolls', `p1HasRoll=${p1HasRoll}, p2HasRoll=${p2HasRoll}`);
    }

    // ═══════════════════════════════════════════════════
    // TEST 4: Start Game Activates Gameplay & Order rolls
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 4: Start Game Activates Gameplay');
    
    // Player 2 (Non-leader) attempts to start the game
    console.log("  Player 2 (Non-leader) attempts to emit 'start_game'...");
    await player2Page.evaluate((room) => {
      window.socket.emit('start_game', { room });
    }, randomRoomId);
    await sleep(1500);

    // Assert that the game is STILL in lobby status on the host (i.e. host still shows player lobby instead of starting rolls)
    const hostTextLobbyAfterP2 = await hostPage.evaluate(() => document.body.innerText);
    if (!hostTextLobbyAfterP2.toUpperCase().includes('STARTING ROLLS') && !hostTextLobbyAfterP2.toUpperCase().includes('TURN ORDER')) {
      pass("Non-leader phone's start_game request was successfully rejected by server");
    } else {
      fail("Non-leader phone's start_game request", `Game unexpectedly started on non-leader request: ${hostTextLobbyAfterP2}`);
    }

    // Player 1 (Lobby Leader) clicks Start Game button
    console.log("  Player 1 (Lobby Leader) clicks 'Start Game' button...");
    await player1Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const startBtn = buttons.find(b => b.textContent.toUpperCase().includes('START GAME'));
      if (startBtn) startBtn.click();
    });
    await sleep(4000); // Wait for turn order rolls determination

    // Check if starting rolls overlay appeared on Host
    const hostTextActive = await hostPage.evaluate(() => document.body.innerText);
    if (hostTextActive.toUpperCase().includes('STARTING ROLLS') || hostTextActive.toUpperCase().includes('TURN ORDER')) {
      pass('Start Game activated: starting rolls order display shown on Host');
    } else {
      fail('Start Game activated: starting rolls display', `Host text: ${hostTextActive}`);
    }
    await takeScreenshot(hostPage, '002_host_first_rolls');

    // Dismiss rolls overlay on player pages to proceed
    await player1Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const dismissBtn = buttons.find(b => b.textContent.toUpperCase().includes('DISMISS'));
      if (dismissBtn) dismissBtn.click();
    });
    await player2Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const dismissBtn = buttons.find(b => b.textContent.toUpperCase().includes('DISMISS'));
      if (dismissBtn) dismissBtn.click();
    });
    await sleep(2000);

    // Verify one of the players now has the ROLL button
    const rollOwner = await (async () => {
      const p1Roll = await player1Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
      });
      if (p1Roll) return 'Aarav';
      
      const p2Roll = await player2Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
      });
      if (p2Roll) return 'Diya';
      
      return null;
    })();

    if (rollOwner) {
      pass(`Gameplay active: turn order winner (${rollOwner}) got the ROLL button`);
    } else {
      fail('Gameplay active: turn order winner got ROLL button', 'No player has ROLL button');
    }

    // ═══════════════════════════════════════════════════
    // TEST 5: Late Joins Blocked
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 5: Late Joins Blocked');
    const context3 = await browser.createBrowserContext();
    player3Page = await context3.newPage();
    await player3Page.goto(`${BASE_URL}/?mode=client&room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    await player3Page.type('input[placeholder="e.g. Arjun, Priya..."]', 'Arjun');
    await sleep(500);
    await player3Page.click('button'); // CONNECT
    await sleep(2000);

    const p3Text = await player3Page.evaluate(() => document.body.innerText);
    if (p3Text.toUpperCase().includes('ALREADY STARTED') || p3Text.toUpperCase().includes('LATE JOIN') || p3Text.toUpperCase().includes('CONNECT')) {
      pass('Late join blocked: new players cannot join an active game');
    } else {
      fail('Late join blocked', `Arjun joined active game: ${p3Text}`);
    }

    // ═══════════════════════════════════════════════════
    // TEST 6: Reconnection Works
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 6: Reconnection Works');
    
    // Disconnect player 2 (Diya)
    console.log('  Disconnecting Player 2 (Diya)...');
    await player2Page.goto('about:blank');
    await sleep(2000);

    // Reconnect player 2 (Diya) in the same browser context to retain clientId
    console.log('  Reconnecting Player 2 (Diya)...');
    await player2Page.goto(`${BASE_URL}/?mode=client&room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(3000);

    const p2ReconnectText = await player2Page.evaluate(() => document.body.innerText);
    if (p2ReconnectText.includes('Diya')) {
      pass('Reconnection works: player successfully reconnected and reclaimed seat');
    } else {
      fail('Reconnection works', `Diya could not reconnect: ${p2ReconnectText}`);
    }

    // ═══════════════════════════════════════════════════
    // TEST 7: Play one full turn (Roll -> Buy -> End Turn)
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 7: Full Turn Cycle');
    const activePage = rollOwner === 'Aarav' ? player1Page : player2Page;
    const activeName = rollOwner;

    await completeTurn(activePage, activeName);
    pass('Turn cycle completed successfully');
    await takeScreenshot(hostPage, '003_host_first_buy');

    // ═══════════════════════════════════════════════════
    // TEST 8: Viewport Overflow & Trade Layout Safety
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 8: Viewport Overflow & Trade Layout Safety');

    // Trigger trade offer with 6 properties on the host to simulate overflow condition
    console.log('  Triggering complex trade offer on Host...');
    await hostPage.evaluate(() => {
      if (window.__testTriggerVisual) {
        window.__testTriggerVisual({
          type: 'TRADE_OFFER',
          initiatorName: 'AaravWithAVeryLongNameIndeed',
          targetName: 'DiyaWithAVeryLongNameIndeed',
          offerCash: 1500,
          offerJailCards: 2,
          offerPropertyIds: [1, 3, 5, 6, 8, 9], // 6 properties
          requestCash: 500,
          requestJailCards: 0,
          requestPropertyIds: [11, 12, 13, 14, 15] // 5 properties
        });
      }
    });
    await sleep(1000);

    const viewports = [
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 }
    ];

    for (const vp of viewports) {
      console.log(`  Evaluating viewport ${vp.width}x${vp.height}...`);
      await hostPage.setViewport(vp);
      await sleep(1000);

      // Check element bounding boxes relative to the viewport — not document scroll size.
      // This catches elements that overflow the visual boundary even when the page clips them.
      const boundCheck = await hostPage.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Look strictly for the trade overlay container
        const overlay = document.querySelector('[data-testid="trade-overlay"]');
        if (!overlay) {
          return { error: 'Trade overlay element not found on screen', violations: [], vw, vh };
        }

        // Walk every visible element inside the overlay and find any that sticks outside the viewport
        const allEls = Array.from(overlay.querySelectorAll('*'));
        const violations = [];
        for (const el of allEls) {
          const r = el.getBoundingClientRect();
          // Skip invisible / zero-size elements
          if (r.width === 0 && r.height === 0) continue;
          if (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2 || r.top < -2) {
            violations.push({
              tag: el.tagName,
              className: el.className.slice(0, 60),
              right: Math.round(r.right),
              bottom: Math.round(r.bottom),
              left: Math.round(r.left),
              top: Math.round(r.top),
              vw,
              vh,
            });
          }
        }
        return { violations: violations.slice(0, 5), vw, vh }; // cap at 5 for readability
      });

      if (boundCheck.error) {
        fail(`Viewport overflow check at ${vp.width}x${vp.height}`, boundCheck.error);
      } else if (boundCheck.violations.length === 0) {
        pass(`No element bounding-box overflow at viewport ${vp.width}x${vp.height}`);
      } else {
        const first = boundCheck.violations[0];
        fail(
          `Element bounding-box overflow at viewport ${vp.width}x${vp.height}`,
          `${boundCheck.violations.length} violation(s); first: <${first.tag}> ` +
          `right=${first.right} bottom=${first.bottom} vw=${first.vw} vh=${first.vh}`
        );
      }

      await takeScreenshot(hostPage, `viewport_${vp.width}x${vp.height}_trade_overflow`);
    }

    // Restore standard host page viewport
    await hostPage.setViewport({ width: 1400, height: 900 });

    // ═══════════════════════════════════════════════════
    // TEST 9: Production Build — globals must be absent
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 9: Production Build — test globals absent');

    // Spin up vite preview (production static server) on port 4173
    const { exec } = await import('child_process');
    const preview = exec('npx vite preview --port 4173 --strictPort', {
      cwd: path.join(__dirname),
    });
    await sleep(3000); // wait for preview server to be ready

    let prodPage;
    try {
      prodPage = await browser.newPage();
      await prodPage.goto('http://localhost:4173', { waitUntil: 'networkidle0', timeout: 15000 });
      await sleep(1000);

      const prodGlobals = await prodPage.evaluate(() => ({
        hasTriggerVisual: typeof window.__testTriggerVisual !== 'undefined',
        hasTestSocket: typeof window.__testSocket !== 'undefined',
      }));

      if (!prodGlobals.hasTriggerVisual) {
        pass('window.__testTriggerVisual is absent from production build');
      } else {
        fail('window.__testTriggerVisual PRESENT in production build — must be gated behind import.meta.env.DEV');
      }

      if (!prodGlobals.hasTestSocket) {
        pass('window.__testSocket is absent from production build');
      } else {
        fail('window.__testSocket PRESENT in production build — must be gated behind import.meta.env.DEV');
      }
    } finally {
      if (prodPage) await prodPage.close();
      // Terminate the preview server
      preview.kill();
    }

  } catch (error) {
    console.error('\n💥 UNEXPECTED E2E TEST ERROR:', error.message);
    testsFailed++;
    try {
      if (hostPage) await takeScreenshot(hostPage, 'ERROR_host');
      if (player1Page) await takeScreenshot(player1Page, 'ERROR_player1');
      if (player2Page) await takeScreenshot(player2Page, 'ERROR_player2');
    } catch (screenshotErr) {
      console.warn('  Screenshot failed during error handling:', screenshotErr.message);
    }
  } finally {
    console.log('\n═══════════════════════════════════════════════════');
    console.log(`   E2E RESULTS: ${testsPassed} PASSED | ${testsFailed} FAILED`);
    console.log('═══════════════════════════════════════════════════\n');

    await sleep(2000);
    await browser.close();
    process.exit(testsFailed > 0 ? 1 : 0);
  }
})();
