const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

async function dumpFor(url, label) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
    await page.waitForTimeout(2000);

    const details = await page.evaluate(() => {
      const inputInfo = Array.from(document.querySelectorAll('input')).map((el) => ({
        type: el.getAttribute('type') || '',
        id: el.id || '',
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        className: el.className || '',
      }));

      const buttonInfo = Array.from(document.querySelectorAll('button,input[type="submit"]')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        name: el.getAttribute('name') || '',
        type: el.getAttribute('type') || '',
        text: (el.textContent || '').trim(),
        className: el.className || '',
      }));

      return {
        title: document.title,
        url: location.href,
        inputInfo,
        buttonInfo,
      };
    });

    console.log(`\n=== ${label} ===`);
    console.log(`Final URL: ${details.url}`);
    console.log(`Title: ${details.title}`);
    console.log('Inputs:');
    console.log(JSON.stringify(details.inputInfo, null, 2));
    console.log('Buttons:');
    console.log(JSON.stringify(details.buttonInfo, null, 2));
  } catch (error) {
    console.error(`\n=== ${label} ERROR ===`);
    console.error(error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function run() {
  await dumpFor(process.env.APP_A_BASE_URL, 'APP_A');
  await dumpFor(process.env.APP_B_BASE_URL, 'APP_B');
}

run();
