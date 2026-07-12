import puppeteer from 'puppeteer';
import path from 'path';

const OUT = 'C:\\Users\\choud\\.gemini\\antigravity\\brain\\0844a26f-cbc7-4b49-81e4-fb7161c4cc9c';
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("Connecting to the running game to inspect state...");
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Capture browser console messages
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    
    // Capture browser page errors
    page.on('pageerror', err => {
      console.error(`[BROWSER ERROR] ${err.toString()}`);
    });

    console.log("Navigating to Host screen...");
    await page.goto('http://localhost:5173/?mode=host', { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(3000);
    
    // Let's inspect the game state from the window or DOM
    const state = await page.evaluate(() => {
      // We can try to find the React state or socket state
      // Let's check if the React app has rendered players
      const players = Array.from(document.querySelectorAll('[class*="TokenIcon"]')).map(el => el.outerHTML);
      return {
        url: window.location.href,
        title: document.title,
        playersCount: players.length,
        htmlSample: document.body.innerHTML.slice(0, 1000)
      };
    });
    
    console.log("Inspected page state:", state);
    
    // Take a screenshot of the current board
    await page.screenshot({ path: path.join(OUT, 'current_game_state.png') });
    console.log("📸 Screenshot of current board saved to current_game_state.png");

  } catch (e) {
    console.error("Failed to inspect game state:", e);
  } finally {
    await browser.close();
  }
})();
