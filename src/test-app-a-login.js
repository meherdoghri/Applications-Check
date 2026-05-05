const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

async function testAppALogin() {
  const browser = await chromium.launch({ 
    headless: true, 
    channel: process.env.BROWSER_CHANNEL || 'chrome' 
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    console.log('\n=== Testing APP_A Login (SPA) ===');
    
    // Navigate to base
    await page.goto(process.env.APP_A_BASE_URL, { waitUntil: 'commit', timeout: 30000 });
    console.log(`1. Initial URL: ${page.url()}`);
    await page.waitForTimeout(2000);

    // Try to find login form elements
    const allInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.getAttribute('type'),
        name: i.getAttribute('name'),
        id: i.getAttribute('id'),
        placeholder: i.getAttribute('placeholder'),
        className: i.className,
        visible: i.offsetParent !== null,
      }));
    });

    console.log('\n2. Found inputs:');
    allInputs.forEach((inp, i) => {
      console.log(`  ${i}: type=${inp.type}, name=${inp.name}, id=${inp.id}, placeholder="${inp.placeholder}", visible=${inp.visible}`);
    });

    // Try to find any button or submit element
    const allButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]')).map((b, i) => ({
        index: i,
        tag: b.tagName,
        type: b.getAttribute('type'),
        text: (b.textContent || '').trim(),
        id: b.getAttribute('id'),
        className: b.className,
        visible: b.offsetParent !== null,
      })).slice(0, 10);
    });

    console.log('\n3. Found buttons/clickables:');
    allButtons.forEach((btn) => {
      console.log(`  ${btn.tag} type=${btn.type}, text="${btn.text}", id=${btn.id}, visible=${btn.visible}`);
    });

    // Take screenshot to see what's on the page
    const screenshot = await page.screenshot({ fullPage: true });
    const fs = require('fs');
    await fs.promises.mkdir('explore-screenshots', { recursive: true });
    await fs.promises.writeFile('explore-screenshots/APP_A_login.png', screenshot);
    console.log('\n4. Screenshot saved to explore-screenshots/APP_A_login.png');

    // Get page body text
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('\n5. Page body text (first 300 chars):');
    console.log(bodyText.substring(0, 300));

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

testAppALogin().catch(console.error);
