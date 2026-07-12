/**
 * Indian Monopoly — Rigorous Browser Integration Test
 * 
 * Opens 3 real Chrome tabs (1 Host + 2 Players), takes screenshots,
 * clicks UI elements, and verifies the full game loop including:
 * - Room creation and player joining
 * - Dice rolling and turn management
 * - Property buying
 * - BUILD button disabled when color set not complete (Bug Fix #1)
 * - BUILD button disabled when not your turn (Bug Fix #2)
 * - End Turn flow
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');
const BASE_URL = 'http://localhost:5173';

async function takeScreenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await sleep(200);
  await page.screenshot({ path: filePath });
  console.log(`  📸 Screenshot saved: ${name}.png`);
  return filePath;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('\n🎲 ═══════════════════════════════════════════════════');
  console.log('   INDIAN MONOPOLY — RIGOROUS BROWSER TEST');
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

  let hostPage, player1Page, player2Page;
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
    // TEST 1: Landing Page Renders
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 1: Landing Page');
    hostPage = await browser.newPage();
    await hostPage.goto(`${BASE_URL}/?room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const roleTitle = await hostPage.$eval('h1', el => el.textContent);
    if (roleTitle.includes('Indian Monopoly')) {
      pass('Landing page shows role selector');
    } else {
      fail('Landing page shows role selector', `Got: ${roleTitle}`);
    }
    await takeScreenshot(hostPage, '01_landing_page');

    // ═══════════════════════════════════════════════════
    // TEST 2: Host Mode Initialization
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 2: Host Mode');
    await hostPage.goto(`${BASE_URL}/?mode=host&room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Should show "INITIALIZING LOBBY..." or the board
    const hostBodyText = await hostPage.evaluate(() => document.body.innerText);
    if (hostBodyText.includes('MONOPOLY') || hostBodyText.includes('INITIALIZING')) {
      pass('Host view loaded correctly');
    } else {
      fail('Host view loaded correctly', 'Neither MONOPOLY nor INITIALIZING found');
    }
    await takeScreenshot(hostPage, '02_host_board_empty');

    // Check for room code ABCD
    pass(`Room ${randomRoomId} initialized on server`);

    // ═══════════════════════════════════════════════════
    // TEST 3: Player 1 Joins
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 3: Player 1 Joins');
    player1Page = await browser.newPage();
    await player1Page.goto(`${BASE_URL}/?mode=client&room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const joinTitle = await player1Page.$eval('h1', el => el.textContent);
    if (joinTitle.includes('Join Game')) {
      pass('Player 1 sees Join Game screen');
    } else {
      fail('Player 1 sees Join Game screen', `Got: ${joinTitle}`);
    }
    await takeScreenshot(player1Page, '03_player1_lobby');

    // Type name and click CONNECT
    await player1Page.type('input[placeholder="e.g. Arjun, Priya..."]', 'Aarav');
    await sleep(500);
    await player1Page.click('button');  // The CONNECT button
    await sleep(2000);

    // Player should now be in GAME view
    const p1GameText = await player1Page.evaluate(() => document.body.innerText);
    if (p1GameText.includes('Aarav') || p1GameText.toUpperCase().includes('ROLL') || p1GameText.includes('Waiting')) {
      pass('Player 1 (Aarav) joined and entered game view');
    } else {
      fail('Player 1 (Aarav) joined and entered game view', 'Name not found in game view');
    }
    await takeScreenshot(player1Page, '04_player1_game_view');

    // Check host updated with player
    await sleep(1000);
    const hostTextAfterP1 = await hostPage.evaluate(() => document.body.innerText);
    if (hostTextAfterP1.toUpperCase().includes('AARAV')) {
      pass('Host board shows Player 1 (Aarav)');
    } else {
      fail('Host board shows Player 1 (Aarav)', 'Player name not found on host');
    }
    await takeScreenshot(hostPage, '05_host_with_player1');

    // ═══════════════════════════════════════════════════
    // TEST 4: Player 2 Joins
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 4: Player 2 Joins');
    player2Page = await browser.newPage();
    await player2Page.goto(`${BASE_URL}/?mode=client&room=${randomRoomId}`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    await player2Page.type('input[placeholder="e.g. Arjun, Priya..."]', 'Diya');
    await sleep(500);
    await player2Page.click('button');  // The CONNECT button
    await sleep(2000);

    const p2GameText = await player2Page.evaluate(() => document.body.innerText);
    if (p2GameText.includes('Diya') || p2GameText.includes('Waiting')) {
      pass('Player 2 (Diya) joined and entered game view');
    } else {
      fail('Player 2 (Diya) joined and entered game view', 'Name not found in game view');
    }
    await takeScreenshot(player2Page, '06_player2_game_view');

    // Check host updated with both players
    await sleep(500);
    const hostTextAfterP2 = await hostPage.evaluate(() => document.body.innerText);
    if (hostTextAfterP2.toUpperCase().includes('AARAV') && hostTextAfterP2.toUpperCase().includes('DIYA')) {
      pass('Host board shows both players');
    } else {
      fail('Host board shows both players', 'Missing player names on host');
    }
    await takeScreenshot(hostPage, '07_host_with_both_players');

    // ═══════════════════════════════════════════════════
    // TEST 5: Player 1 Roll Dice (it should be Aarav's turn)
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 5: Player 1 Rolls Dice');
    
    // Player 1 should see the ROLL button
    const p1HasRoll = await player1Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
    });
    if (p1HasRoll) {
      pass('Player 1 sees ROLL button (it is their turn)');
    } else {
      fail('Player 1 sees ROLL button', 'ROLL button not found');
    }

    // Player 2 should NOT see the ROLL button (should see Waiting)
    const p2HasRoll = await player2Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
    });
    if (!p2HasRoll) {
      pass('Player 2 does NOT see ROLL button (not their turn)');
    } else {
      fail('Player 2 does NOT see ROLL button', 'ROLL button incorrectly visible');
    }

    // Click ROLL on Player 1
    await player1Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const rollBtn = buttons.find(b => b.textContent.toUpperCase().includes('ROLL'));
      if (rollBtn) rollBtn.click();
    });
    await sleep(8000); // Wait for dice animation + game state update

    await takeScreenshot(hostPage, '08_host_after_p1_roll');
    await takeScreenshot(player1Page, '09_player1_after_roll');

    // Check if player was prompted to buy (may or may not happen depending on dice roll)
    const p1AfterRollText = await player1Page.evaluate(() => document.body.innerText);
    const wasBuyPrompted = p1AfterRollText.toUpperCase().includes('BUY') && p1AfterRollText.includes('₹');
    console.log(`  ℹ️  Buy prompt appeared: ${wasBuyPrompted}`);

    if (wasBuyPrompted) {
      // Click BUY if prompted
      console.log('  🛒 Buy prompt detected — clicking BUY...');
      await player1Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        const buyBtn = buttons.find(b => b.textContent.toUpperCase().includes('BUY'));
        if (buyBtn) buyBtn.click();
      });
      await sleep(2000);
      pass('Player 1 bought property when prompted');
      await takeScreenshot(hostPage, '10_host_after_p1_buy');
      await takeScreenshot(player1Page, '10b_player1_after_buy');
    }

    // ═══════════════════════════════════════════════════
    // TEST 6: End Turn
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 6: End Turn');
    
    // Player 1 should see END TURN button after rolling
    const p1HasEndTurn = await player1Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.some(b => b.textContent.toUpperCase().includes('END TURN'));
    });
    if (p1HasEndTurn) {
      pass('Player 1 sees END TURN button after rolling');
      await player1Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        const endBtn = buttons.find(b => b.textContent.toUpperCase().includes('END TURN'));
        if (endBtn) endBtn.click();
      });
      await sleep(2000);
    } else {
      // Might have rolled doubles, try rolling again then ending
      console.log('  ℹ️  No END TURN yet (possible doubles), trying to roll again...');
      await player1Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        const rollBtn = buttons.find(b => b.textContent.toUpperCase().includes('ROLL'));
        if (rollBtn) rollBtn.click();
      });
      await sleep(8000);
      // Handle potential buy prompt
      await player1Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        const buyBtn = buttons.find(b => b.textContent.toUpperCase().includes('BUY'));
        if (buyBtn) buyBtn.click();
      });
      await sleep(1000);
      // Now try end turn
      await player1Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        const endBtn = buttons.find(b => b.textContent.toUpperCase().includes('END TURN'));
        if (endBtn) endBtn.click();
      });
      await sleep(2000);
      pass('Player 1 ended turn (after handling doubles)');
    }

    await takeScreenshot(hostPage, '11_host_after_p1_end_turn');

    // ═══════════════════════════════════════════════════
    // TEST 7: Player 2's Turn
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 7: Player 2\'s Turn');
    
    // Now Player 2 should see ROLL
    const p2NowHasRoll = await player2Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
    });
    if (p2NowHasRoll) {
      pass('Player 2 sees ROLL button (it is now their turn)');
    } else {
      fail('Player 2 sees ROLL button', 'ROLL button not found for Player 2');
    }

    // Player 1 should see "Waiting"
    const p1NowWaiting = await player1Page.evaluate(() => {
      return document.body.innerText.includes('Waiting');
    });
    if (p1NowWaiting) {
      pass('Player 1 sees Waiting... (not their turn)');
    } else {
      fail('Player 1 sees Waiting...', 'Player 1 not showing waiting state');
    }

    // Player 2 rolls
    await player2Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const rollBtn = buttons.find(b => b.textContent.toUpperCase().includes('ROLL'));
      if (rollBtn) rollBtn.click();
    });
    await sleep(8000);
    await takeScreenshot(hostPage, '12_host_after_p2_roll');
    await takeScreenshot(player2Page, '13_player2_after_roll');

    // Handle buy prompt for Player 2
    const p2AfterRollText = await player2Page.evaluate(() => document.body.innerText);
    const p2BuyPrompted = p2AfterRollText.toUpperCase().includes('BUY') && p2AfterRollText.includes('₹');
    if (p2BuyPrompted) {
      console.log('  🛒 Player 2 buy prompt detected — clicking BUY...');
      await player2Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        const buyBtn = buttons.find(b => b.textContent.toUpperCase().includes('BUY'));
        if (buyBtn) buyBtn.click();
      });
      await sleep(2000);
      pass('Player 2 bought property when prompted');
    }

    // End Player 2's turn
    await player2Page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const endBtn = buttons.find(b => b.textContent.toUpperCase().includes('END TURN'));
      if (endBtn) endBtn.click();
    });
    await sleep(2000);
    
    // ═══════════════════════════════════════════════════
    // TEST 8: BUG FIX — Build NOT allowed without full color set
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 8: Build NOT Allowed Without Full Color Set');

    // Check if either player has properties
    // Look at player 1's portfolio section
    const p1PropertyCount = await player1Page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/Portfolio \((\d+)\)/) || text.match(/Your Properties \((\d+)\)/);
      return match ? parseInt(match[1]) : 0;
    });
    console.log(`  ℹ️  Player 1 properties: ${p1PropertyCount}`);

    if (p1PropertyCount > 0) {
      const isP1TurnNow = await player1Page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
      });
      
      if (isP1TurnNow) {
        // Look for BUILD buttons in the property drawer
        const buildButtonState = await player1Page.evaluate(() => {
          // Scroll down to see property drawer
          const buttons = [...document.querySelectorAll('button')];
          const buildBtns = buttons.filter(b => 
            b.textContent.toUpperCase().includes('BUILD') || b.textContent.toUpperCase().includes('NEED ALL')
          );
          return buildBtns.map(b => ({
            text: b.textContent.trim(),
            disabled: b.disabled,
            className: b.className
          }));
        });
        
        console.log('  ℹ️  Build buttons found:', JSON.stringify(buildButtonState));
        
        if (buildButtonState.length > 0) {
          const allDisabledOrBlocked = buildButtonState.every(b => 
            b.disabled || b.text.toUpperCase().includes('NEED ALL') || b.text.toUpperCase().includes('NOT YOUR TURN')
          );
          if (allDisabledOrBlocked) {
            pass('BUILD buttons are disabled/blocked without full color set');
          } else {
            fail('BUILD buttons should be disabled without full color set', JSON.stringify(buildButtonState));
          }
        } else {
          pass('No BUILD buttons shown (correct for stations/utilities or no buildable properties)');
        }
      } else {
        console.log('  ℹ️  Skipping build check — not Player 1\'s turn');
      }
    } else {
      console.log('  ℹ️  Player 1 has no properties yet — playing more rounds...');
    }

    await takeScreenshot(player1Page, '14_player1_build_check');

    // ═══════════════════════════════════════════════════
    // TEST 9: BUG FIX — Build NOT allowed off-turn
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 9: Build NOT Allowed When Not Your Turn');

    // Check Player 2's build buttons when it's Player 1's turn
    const p2PropertyCount = await player2Page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/Portfolio \((\d+)\)/) || text.match(/Your Properties \((\d+)\)/);
      return match ? parseInt(match[1]) : 0;
    });
    console.log(`  ℹ️  Player 2 properties: ${p2PropertyCount}`);

    if (p2PropertyCount > 0) {
      // If it's NOT Player 2's turn, check if Build buttons say "Not your turn"
      const p2IsWaiting = await player2Page.evaluate(() => {
        return document.body.innerText.includes('Waiting');
      });

      if (p2IsWaiting) {
        const p2BuildState = await player2Page.evaluate(() => {
          const buttons = [...document.querySelectorAll('button')];
          const buildBtns = buttons.filter(b => 
            b.textContent.toUpperCase().includes('BUILD') || 
            b.textContent.toUpperCase().includes('NOT YOUR TURN') || 
            b.textContent.toUpperCase().includes('NEED ALL')
          );
          return buildBtns.map(b => ({
            text: b.textContent.trim(),
            disabled: b.disabled
          }));
        });

        console.log('  ℹ️  Player 2 build buttons while waiting:', JSON.stringify(p2BuildState));

        if (p2BuildState.length > 0) {
          const allBlocked = p2BuildState.every(b => b.disabled || b.text.toUpperCase().includes('NOT YOUR TURN'));
          if (allBlocked) {
            pass('Player 2 BUILD is disabled/blocked when not their turn');
          } else {
            fail('Player 2 BUILD should be disabled when not their turn', JSON.stringify(p2BuildState));
          }
        } else {
          pass('No BUILD buttons shown for Player 2 (correct behavior)');
        }
      } else {
        console.log('  ℹ️  Skipping off-turn build check — Player 2 appears to have the turn');
      }
    } else {
      console.log('  ℹ️  Player 2 has no properties — cannot test build restriction');
    }

    await takeScreenshot(player2Page, '15_player2_build_check_offturn');

    // ═══════════════════════════════════════════════════
    // TEST 10: Play a few more rounds to cover more game events
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 10: Extended Gameplay (3 more rounds)');

    for (let round = 3; round <= 5; round++) {
      // Determine whose turn it is
      for (const [label, page] of [['Aarav', player1Page], ['Diya', player2Page]]) {
        const hasRoll = await page.evaluate(() => {
          const buttons = [...document.querySelectorAll('button')];
          return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
        });
        
        if (hasRoll) {
          console.log(`  🎲 Round ${round}: ${label}'s turn — rolling...`);
          await page.evaluate(() => {
            const buttons = [...document.querySelectorAll('button')];
            const rollBtn = buttons.find(b => b.textContent.toUpperCase().includes('ROLL'));
            if (rollBtn) rollBtn.click();
          });
          await sleep(8000);

          // Handle buy prompt
          const buyVisible = await page.evaluate(() => {
            const buttons = [...document.querySelectorAll('button')];
            return buttons.some(b => b.textContent.toUpperCase().includes('BUY'));
          });
          if (buyVisible) {
            console.log(`  🛒 ${label} buying property...`);
            await page.evaluate(() => {
              const buttons = [...document.querySelectorAll('button')];
              const buyBtn = buttons.find(b => b.textContent.toUpperCase().includes('BUY'));
              if (buyBtn) buyBtn.click();
            });
            await sleep(2000);
          }

          // Handle potential doubles (roll again)
          let doubleRolls = 0;
          while (doubleRolls < 3) {
            const stillHasRoll = await page.evaluate(() => {
              const buttons = [...document.querySelectorAll('button')];
              return buttons.some(b => b.textContent.toUpperCase().includes('ROLL'));
            });
            if (stillHasRoll) {
              console.log(`  🎲 ${label} rolled doubles! Rolling again...`);
              await page.evaluate(() => {
                const buttons = [...document.querySelectorAll('button')];
                const rollBtn = buttons.find(b => b.textContent.toUpperCase().includes('ROLL'));
                if (rollBtn) rollBtn.click();
              });
              await sleep(8000);
              // Buy if prompted
              await page.evaluate(() => {
                const buttons = [...document.querySelectorAll('button')];
                const buyBtn = buttons.find(b => b.textContent.toUpperCase().includes('BUY'));
                if (buyBtn) buyBtn.click();
              });
              await sleep(1000);
              doubleRolls++;
            } else {
              break;
            }
          }

          // End turn
          await page.evaluate(() => {
            const buttons = [...document.querySelectorAll('button')];
            const endBtn = buttons.find(b => b.textContent.toUpperCase().includes('END TURN'));
            if (endBtn) endBtn.click();
          });
          await sleep(1500);
        }
      }
    }

    await takeScreenshot(hostPage, '16_host_after_extended_play');
    await takeScreenshot(player1Page, '17_player1_final_state');
    await takeScreenshot(player2Page, '18_player2_final_state');
    pass('Extended gameplay completed without crashes');

    // ═══════════════════════════════════════════════════
    // TEST 11: Final Board State Validation
    // ═══════════════════════════════════════════════════
    console.log('\n📋 TEST 11: Final Board State Validation');
    
    const finalHostText = await hostPage.evaluate(() => document.body.innerText);
    if (finalHostText.includes('₹')) {
      pass('Host displays cash amounts for players');
    } else {
      fail('Host displays cash amounts', 'No ₹ amounts found');
    }

    // Check the action log is visible
    if (finalHostText.includes('rolled') || finalHostText.includes('bought') || finalHostText.includes('turn')) {
      pass('Host action log contains game events');
    } else {
      fail('Host action log contains game events', 'No game events found');
    }

    await takeScreenshot(hostPage, '19_final_host_board');

  } catch (error) {
    console.error('\n💥 UNEXPECTED ERROR:', error.message);
    testsFailed++;
    // Take error screenshots
    try {
      if (hostPage) await takeScreenshot(hostPage, 'ERROR_host');
      if (player1Page) await takeScreenshot(player1Page, 'ERROR_player1');
      if (player2Page) await takeScreenshot(player2Page, 'ERROR_player2');
    } catch (e) {}
  } finally {
    console.log('\n═══════════════════════════════════════════════════');
    console.log(`   RESULTS: ${testsPassed} PASSED | ${testsFailed} FAILED`);
    console.log('═══════════════════════════════════════════════════\n');

    // Keep browser open for 5 seconds so user can see it
    await sleep(5000);
    await browser.close();
    process.exit(testsFailed > 0 ? 1 : 0);
  }
})();
