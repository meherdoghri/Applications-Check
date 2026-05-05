const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

async function testAppADynamic() {
  const browser = await chromium.launch({ 
    headless: true, 
    channel: process.env.BROWSER_CHANNEL || 'chrome' 
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    console.log('\n=== APP_A Dynamic Loading Test ===\n');

    // Navigate
    await page.goto(process.env.APP_A_BASE_URL, { waitUntil: 'commit', timeout: 30000 });
    console.log(`1. After goto: ${page.url()}`);
    console.log(`   Title: "${(await page.title())}"`);

    // Wait for various load states
    await page.waitForTimeout(1000);
    console.log(`\n2. After 1s wait:`);
    console.log(`   Title: "${(await page.title())}"`);
    const body1 = await page.evaluate(() => document.body.innerText.trim().length);
    console.log(`   Body text length: ${body1}`);

    await page.waitForTimeout(2000);
    console.log(`\n3. After 3s total:`);
    console.log(`   Title: "${(await page.title())}"`);
    const body2 = await page.evaluate(() => document.body.innerText.trim().length);
    console.log(`   Body text length: ${body2}`);

    // Try to wait for a specific element
    try {
      await page.waitForSelector('body *', { timeout: 5000 });
    } catch(e) {
      // ignore
    }

    console.log(`\n4. After 5s+ wait:`);
    console.log(`   Title: "${(await page.title())}"`);
    const body3 = await page.evaluate(() => document.body.innerText.trim().length);
    console.log(`   Body text length: ${body3}`);

    // Check for any iframes
    const iframes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).map(i => ({
        src: i.getAttribute('src'),
        id: i.getAttribute('id'),
        name: i.getAttribute('name'),
      }));
    });
    console.log(`\n5. Found iframes:`, iframes);

    // Take final screenshot
    const fs = require('fs');
    const screenshot = await page.screenshot({ fullPage: true });
    await fs.promises.mkdir('explore-screenshots', { recursive: true });
    await fs.promises.writeFile('explore-screenshots/APP_A_loaded.png', screenshot);
    console.log(`\n6. Screenshot saved`);

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

testAppADynamic().catch(console.error);
