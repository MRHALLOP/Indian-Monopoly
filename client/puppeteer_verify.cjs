const puppeteer = require('puppeteer');

const ARTIFACT_DIR = 'C:/Users/choud/.gemini/antigravity/brain/10f230fc-1250-4a4b-81d7-237a9e9bc7a1';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // --- Bug Fix Verification Screenshot ---
    console.log('Navigating to host board...');
    await page.goto('http://localhost:5173/?mode=host&room=BUGTEST', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));

    // Dismiss start overlay if present (try common button selectors)
    try {
      const btn = await page.$('button');
      if (btn) {
        await btn.click();
        await new Promise(r => setTimeout(r, 500));
      }
    } catch(e) { /* ignore */ }

    await page.screenshot({ path: `${ARTIFACT_DIR}/bug_fix_verification.png`, fullPage: false });
    console.log('Screenshot saved: bug_fix_verification.png');

    // --- Bug 1: FREE_PARKING initial trigger ---
    console.log('Testing Bug 1: FREE_PARKING visual trigger...');
    try {
      await page.evaluate(() => {
        if (typeof window.__testTriggerVisual === 'function') {
          window.__testTriggerVisual({ type: 'FREE_PARKING', player: 'Pops' });
        } else {
          console.warn('__testTriggerVisual not available on this page state');
        }
      });
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: `${ARTIFACT_DIR}/bug1_free_parking_initial.png`, fullPage: false });
      console.log('Screenshot saved: bug1_free_parking_initial.png');
    } catch(e) {
      console.warn('Bug 1 trigger failed:', e.message);
    }

    // Report results
    console.log('\n=== PAGE ERROR REPORT ===');
    if (consoleErrors.length === 0) {
      console.log('No console errors detected. Page loaded cleanly.');
    } else {
      console.log('Console errors found:');
      consoleErrors.forEach((e, i) => console.log(`  [${i+1}] ${e}`));
    }

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Puppeteer script failed:', err);
  process.exit(1);
});
