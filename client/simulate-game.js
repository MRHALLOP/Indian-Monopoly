import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function promiseWithTimeout(promise, ms, name) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${name} took more than ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

(async () => {
  console.log('\n🎲 ═══════════════════════════════════════════════════');
  console.log('   INDIAN MONOPOLY — OPTIMIZED GAME SIMULATION');
  console.log('═══════════════════════════════════════════════════\n');

  const randomRoomId = 'SIM_' + Math.floor(1000 + Math.random() * 9000);
  console.log(`Setting up room ID: ${randomRoomId}\n`);

  let gameOver = false;
  let winner = null;

  // Launch Chrome with optimization (disable GPU for headless stability on VMs)
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1400, height: 900 },
    protocolTimeout: 300000, // 5 minutes timeout
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  const hostPage = await browser.newPage();
  const context1 = await browser.createBrowserContext();
  const player1Page = await context1.newPage();
  const context2 = await browser.createBrowserContext();
  const player2Page = await context2.newPage();

  // Console event logging for debugging
  hostPage.on('console', msg => {
    const text = msg.text();
    if (text.includes('[CRASH]') || text.includes('error') || text.includes('Error')) {
      console.log('  🖥️  [HOST CONSOLE]:', text);
    }
  });
  player1Page.on('console', msg => {
    const text = msg.text();
    if (text.includes('error') || text.includes('Error')) {
      console.log('  👤 [P1 CONSOLE]:', text);
    }
  });
  player2Page.on('console', msg => {
    const text = msg.text();
    if (text.includes('error') || text.includes('Error')) {
      console.log('  👤 [P2 CONSOLE]:', text);
    }
  });

  player1Page.on('dialog', async dialog => {
    console.log(`  💬 [P1 DIALOG]: [${dialog.type()}] ${dialog.message()}`);
    await dialog.accept();
  });
  player2Page.on('dialog', async dialog => {
    console.log(`  💬 [P2 DIALOG]: [${dialog.type()}] ${dialog.message()}`);
    await dialog.accept();
  });

  // Helper to take visual checkpoints (only at key milestones to prevent CDP screenshot timeouts)
  let screenshotCounter = 1;
  async function captureCheckpoints(label) {
    try {
      const numStr = String(screenshotCounter++).padStart(3, '0');
      await promiseWithTimeout(
        hostPage.screenshot({ path: path.join(SCREENSHOT_DIR, `${numStr}_host_${label}.png`) }),
        8000,
        `hostPage.screenshot(${label})`
      );
      console.log(`  📸 [MILESTONE ${numStr}] Visual checkpoint saved: host_${label}`);
    } catch (e) {
      console.log(`  ⚠️  Screenshot failed for ${label}:`, e.message);
    }
  }

  try {
    // 1. Load Host Board
    console.log('🖥️ Host: Navigating to host view...');
    await hostPage.goto(`${BASE_URL}/?mode=host&room=${randomRoomId}`, { waitUntil: 'domcontentloaded' });
    console.log('🖥️ Host: Navigated. Waiting 2s...');
    await sleep(2000);
    console.log('🖥️ Host loaded.');

    // 2. Player 1 joins
    console.log('👤 Player 1: Navigating to client view...');
    await player1Page.evaluateOnNewDocument(() => {
      const originalWebSocket = window.WebSocket;
      window.WebSocket = class extends originalWebSocket {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', (event) => {
            try {
              const data = event.data;
              if (typeof data === 'string' && data.startsWith('42[')) {
                const parsed = JSON.parse(data.substring(2));
                if (parsed[0] === 'game_update') {
                  window.__gameState = parsed[1];
                }
              }
            } catch (e) {}
          });
        }
      };
    });
    await player1Page.goto(`${BASE_URL}/?mode=client&room=${randomRoomId}`, { waitUntil: 'domcontentloaded' });
    console.log('👤 Player 1: Waiting for join screen...');
    await player1Page.waitForSelector('input[placeholder="e.g. Arjun, Priya..."]', { timeout: 15000 });
    console.log('👤 Player 1: Typing name Aarav...');
    await player1Page.type('input[placeholder="e.g. Arjun, Priya..."]', 'Aarav');
    await sleep(500);
    console.log('👤 Player 1: Clicking Connect...');
    await player1Page.evaluate(() => {
      const btn = document.querySelector('button');
      if (btn) btn.click();
    });
    await sleep(2500);
    console.log('👤 Player 1 connected.');

    // 3. Player 2 joins
    console.log('👤 Player 2: Navigating to client view...');
    await player2Page.evaluateOnNewDocument(() => {
      const originalWebSocket = window.WebSocket;
      window.WebSocket = class extends originalWebSocket {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', (event) => {
            try {
              const data = event.data;
              if (typeof data === 'string' && data.startsWith('42[')) {
                const parsed = JSON.parse(data.substring(2));
                if (parsed[0] === 'game_update') {
                  window.__gameState = parsed[1];
                }
              }
            } catch (e) {}
          });
        }
      };
    });
    await player2Page.goto(`${BASE_URL}/?mode=client&room=${randomRoomId}`, { waitUntil: 'domcontentloaded' });
    console.log('👤 Player 2: Waiting for join screen...');
    await player2Page.waitForSelector('input[placeholder="e.g. Arjun, Priya..."]', { timeout: 15000 });
    console.log('👤 Player 2: Typing name Diya...');
    await player2Page.type('input[placeholder="e.g. Arjun, Priya..."]', 'Diya');
    await sleep(500);
    console.log('👤 Player 2: Clicking Connect...');
    await player2Page.evaluate(() => {
      const btn = document.querySelector('button');
      if (btn) btn.click();
    });
    await sleep(2500);
    console.log('👤 Player 2 connected.');

    await captureCheckpoints('lobby_connected');

    let turnCount = 0;
    const maxTurns = 80; // limit simulation to 80 turns to fit within memory/time bounds
    let hasCapturedFirstRoll = false;
    let hasCapturedFirstBuy = false;
    let hasCapturedAuction = false;
    let hasCapturedTrade = false;
    let hasCapturedMortgage = false;

    console.log('\n🎮 Simulation Game Loop Started...\n');

    while (!gameOver && turnCount < maxTurns) {
      turnCount++;
      console.log(`\n--- Turn ${turnCount} ---`);

      // Determine who is currently active in the gameState
      const gameState = await player1Page.evaluate(() => {
        return window.__gameState || null;
      });

      if (!gameState || !gameState.players || gameState.players.length === 0) {
        console.log('  ⚠️ Waiting for game state to initialize on host...');
        await sleep(2000);
        continue;
      }

      // Check for winner
      const activePlayers = gameState.players.filter(p => !p.bankrupt);
      if (activePlayers.length === 1) {
        gameOver = true;
        winner = activePlayers[0].name;
        console.log(`\n🏆 GAME OVER! ${winner} is the winner!`);
        break;
      }

      const activeIdx = gameState.currentTurn;
      const activePlayer = gameState.players[activeIdx];
      const activePage = activePlayer.name === 'Aarav' ? player1Page : player2Page;
      const activeName = activePlayer.name;

      console.log(`Active Player: ${activeName} (Cash: ₹${activePlayer.cash})`);

      // Retrieve current page turn status
      const isMyTurn = await activePage.evaluate(() => {
        const text = document.body.innerText.toUpperCase();
        return text.includes('YOUR TURN') || 
               text.includes('ROLL DICE') || 
               text.includes('END TURN') ||
               text.includes('PAYMENT DUE') ||
               text.includes('DECLARE BANKRUPTCY');
      });

      if (!isMyTurn) {
        const text = await activePage.evaluate(() => document.body.innerText);
        console.log(`  ⌛ Syncing... Waiting for client page of ${activeName} to show active turn state. Current page text:`, JSON.stringify(text.trim()));
        await sleep(2000);
        continue;
      }

      // ─── Phase 1: Roll Dice ───
      const hasRollButton = await activePage.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns.some(b => b.textContent.toUpperCase().includes('ROLL'));
      });

      if (hasRollButton) {
        console.log(`  🎲 ${activeName} is rolling dice...`);
        await activePage.evaluate(() => {
          const btns = [...document.querySelectorAll('button')];
          const roll = btns.find(b => b.textContent.toUpperCase().includes('ROLL'));
          if (roll) roll.click();
        });
        await sleep(6500); // wait for rolling animation and token movement
        
        if (!hasCapturedFirstRoll) {
          hasCapturedFirstRoll = true;
          await captureCheckpoints('first_rolls');
        }
      }

      // ─── Phase 2: Action Prompts (Buy/Auction/Pay Rent/Card Draw) ───
      await sleep(1500); // brief sleep to let modal render

      // Check for Raise Money screen (if cash < 0)
      const needsToRaiseMoney = await activePage.evaluate(() => {
        const text = document.body.innerText.toUpperCase();
        return text.includes('RAISE FUNDS TO CONTINUE') || text.includes('DECLARE BANKRUPTCY') || text.includes('PAYMENT DUE');
      });

      if (needsToRaiseMoney) {
        console.log(`  ⚠️ ${activeName} needs to raise money! Current cash: ₹${activePlayer.cash}`);
        // Let's check if there are mortgage buttons
        const mortgageBtnExists = await activePage.evaluate(() => {
          const btns = [...document.querySelectorAll('button')];
          return btns.some(b => b.textContent.includes('Mortgage'));
        });

        if (mortgageBtnExists) {
          console.log(`  🏡 Mortgaging property to cover debt...`);
          await activePage.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const mort = btns.find(b => b.textContent.includes('Mortgage'));
            if (mort) mort.click();
          });
          await sleep(2000);
          if (!hasCapturedMortgage) {
            hasCapturedMortgage = true;
            await captureCheckpoints(`${activeName}_mortgaged`);
          }
          continue; // re-evaluate turn state
        } else {
          // No properties to mortgage, declare bankruptcy
          console.log(`  💀 No assets remaining to liquidate. Declaring Bankruptcy!`);
          await activePage.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const bank = btns.find(b => b.textContent.toUpperCase().includes('DECLARE BANKRUPTCY'));
            if (bank) bank.click();
          });
          await sleep(3000);
          await captureCheckpoints(`${activeName}_bankruptcy`);
          continue;
        }
      }

      // Check for Buy/Auction Modal
      const isBuyModalOpen = await activePage.evaluate(() => {
        const text = document.body.innerText.toUpperCase();
        return text.includes('PURCHASE PRICE') && 
               text.includes('AUCTION') && 
               (text.includes('BUY NOW') || text.includes('BUY ON CREDIT') || text.includes('CANNOT AFFORD'));
      });

      if (isBuyModalOpen) {
        // 15% chance to auction, otherwise buy if affordable
        const rollAuction = Math.random() < 0.15;
        const buyButtonState = await activePage.evaluate(() => {
          const btns = [...document.querySelectorAll('button')];
          const buyBtn = btns.find(b => b.textContent.toUpperCase().includes('BUY NOW') || b.textContent.toUpperCase().includes('BUY ON CREDIT'));
          return buyBtn && !buyBtn.disabled ? buyBtn.textContent.toUpperCase() : null;
        });

        const canBuy = !!buyButtonState;

        if (rollAuction || !canBuy) {
          console.log(`  ⚖️ Starting AUCTION for the property (or cannot buy)...`);
          await activePage.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const aucBtn = btns.find(b => b.textContent.toUpperCase().includes('AUCTION'));
            if (aucBtn) aucBtn.click();
          });
          await sleep(3000); // let auction screen initialize
          
          if (!hasCapturedAuction) {
            hasCapturedAuction = true;
            await captureCheckpoints('auction_started');
          }

          // Handle live bidding between players
          let auctionEnd = false;
          let bidCount = 0;

          while (!auctionEnd && bidCount < 6) {
            bidCount++;
            // Check current bids on player1Page
            const auctionState = await player1Page.evaluate(() => {
              const game = window.__gameState;
              return game ? game.auction : null;
            });

            if (!auctionState || !auctionState.status) {
              console.log('  ⚖️ Auction concluded.');
              auctionEnd = true;
              break;
            }

            // Both pages check if they are active and who's winning
            for (const [pName, pPage] of [['Aarav', player1Page], ['Diya', player2Page]]) {
              const activeInAuction = await pPage.evaluate(() => {
                const text = document.body.innerText.toUpperCase();
                return text.includes('LIVE AUCTION') && 
                       !text.includes('YOU FOLDED');
              });

              if (activeInAuction) {
                const winningText = await pPage.evaluate(() => {
                  return document.body.innerText.toUpperCase().includes("YOU'RE WINNING");
                });

                if (!winningText) {
                  // Bid +10 or withdraw/fold if run out of cash
                  const playerState = await player1Page.evaluate((name) => {
                    return window.__gameState.players.find(p => p.name === name);
                  }, pName);

                  const nextBidPrice = (auctionState.currentBid || 0) + 10;
                  if (playerState.cash >= nextBidPrice && Math.random() < 0.8) {
                    console.log(`    💰 Player ${pName} bids +₹10 (Current bid: ₹${auctionState.currentBid})`);
                    await pPage.evaluate(() => {
                      const btns = [...document.querySelectorAll('button')];
                      const bidBtn = btns.find(b => b.textContent.toUpperCase().includes('+ ₹10'));
                      if (bidBtn) bidBtn.click();
                    });
                    await sleep(1500);
                  } else {
                    console.log(`    🏳️ Player ${pName} withdraws / folds.`);
                    await pPage.evaluate(() => {
                      const btns = [...document.querySelectorAll('button')];
                      const foldBtn = btns.find(b => b.textContent.toUpperCase().includes('WITHDRAW / FOLD'));
                      if (foldBtn) foldBtn.click();
                    });
                    await sleep(2000);
                  }
                }
              }
            }
          }
          await sleep(2000);
        } else {
          console.log(`  🛒 ${activeName} buys property directly (button: ${buyButtonState})!`);
          await activePage.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const buyBtn = btns.find(b => b.textContent.toUpperCase().includes('BUY NOW') || b.textContent.toUpperCase().includes('BUY ON CREDIT'));
            if (buyBtn) buyBtn.click();
          });
          await sleep(2000);
          
          if (!hasCapturedFirstBuy) {
            hasCapturedFirstBuy = true;
            await captureCheckpoints('first_buy');
          }
        }
      }

      // Check if we want to run a test Trade Offer (only at turn 10 to keep simulation fast)
      if (turnCount === 10) {
        console.log('\n🤝 Initiating test trade offer to verify trade interface and visual sync...');
        // Open trade tab on Player 1
        await player1Page.evaluate(() => {
          const navBtns = [...document.querySelectorAll('nav button')];
          const tradeTab = navBtns.find(b => b.textContent.toUpperCase().includes('TRADE'));
          if (tradeTab) tradeTab.click();
        });
        await sleep(1500);

        const p1HasProperties = await player1Page.evaluate(() => {
          const selects = [...document.querySelectorAll('select')];
          return selects.length > 0;
        });

        if (p1HasProperties) {
          await player1Page.evaluate(() => {
            const selects = document.querySelectorAll('select');
            // Select Diya (target)
            if (selects[0]) {
              const options = [...selects[0].options];
              const diyaOpt = options.find(o => o.text.includes('Diya'));
              if (diyaOpt) selects[0].value = diyaOpt.value;
              selects[0].dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          await sleep(1000);

          // Select first property to offer
          await player1Page.evaluate(() => {
            const selects = document.querySelectorAll('select');
            if (selects[1]) {
              const options = [...selects[1].options];
              if (options.length > 1) {
                selects[1].value = options[1].value;
                selects[1].dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
            // Request ₹100
            const inputs = document.querySelectorAll('input');
            if (inputs[1]) {
              inputs[1].value = '100';
              inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
            }
          });
          await sleep(1000);

          // Send
          await player1Page.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const sendBtn = btns.find(b => b.textContent.toUpperCase().includes('SEND OFFER'));
            if (sendBtn) sendBtn.click();
          });
          await sleep(2000);

          // P2 accepts
          console.log('  🤝 Player 2 (Diya) accepting trade offer...');
          if (!hasCapturedTrade) {
            hasCapturedTrade = true;
            await captureCheckpoints('trade_offer');
          }
          await player2Page.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const acceptBtn = btns.find(b => b.textContent.includes('Accept'));
            if (acceptBtn) acceptBtn.click();
          });
          await sleep(2000);
        } else {
          console.log('  ℹ️ Aarav has no properties to trade yet, skipping trade.');
          // Click back to Board tab
          await player1Page.evaluate(() => {
            const navBtns = [...document.querySelectorAll('nav button')];
            const boardTab = navBtns.find(b => b.textContent.toUpperCase().includes('BOARD'));
            if (boardTab) boardTab.click();
          });
          await sleep(1000);
        }
      }

      // ─── Phase 3: End Turn ───
      const hasEndTurnButton = await activePage.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns.some(b => b.textContent.toUpperCase().includes('END TURN'));
      });

      if (hasEndTurnButton) {
        console.log(`  🔚 ${activeName} ends their turn.`);
        await activePage.evaluate(() => {
          const btns = [...document.querySelectorAll('button')];
          const end = btns.find(b => b.textContent.toUpperCase().includes('END TURN'));
          if (end) end.click();
        });
        await sleep(1500);
      } else {
        console.log('  ⚠️ No End Turn button found. Waiting to let game progress.');
        await sleep(2000);
      }
    }

    // Determine final stats if loop finished without bankruptcy
    if (!gameOver) {
      console.log('\n⏳ Turn limit reached without bankruptcy. Calculating winner based on assets...');
      const finalPlayers = await player1Page.evaluate(() => {
        return window.__gameState.players;
      });

      const p1 = finalPlayers[0];
      const p2 = finalPlayers[1];

      console.log(`Final Balances:`);
      console.log(`- ${p1.name}: Cash ₹${p1.cash}, Properties: ${p1.properties.length}`);
      console.log(`- ${p2.name}: Cash ₹${p2.cash}, Properties: ${p2.properties.length}`);

      if (p1.cash + p1.properties.length * 150 > p2.cash + p2.properties.length * 150) {
        winner = p1.name;
      } else {
        winner = p2.name;
      }
      console.log(`🏆 Winner by asset calculation: ${winner}`);
    }

    // Final board view checkpoint
    await captureCheckpoints('final_board_state');

  } catch (error) {
    console.error('💥 Simulation Error:', error);
  } finally {
    await browser.close();
    console.log('\n🎲 ═══════════════════════════════════════════════════');
    console.log(`   SIMULATION COMPLETE. WINNER IS: ${winner || 'N/A'}`);
    console.log('🎲 ═══════════════════════════════════════════════════\n');
    process.exit(0);
  }
})();
