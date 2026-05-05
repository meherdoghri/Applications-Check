const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

dotenv.config();

async function exploreApp(appConfig, loginSelectors, label) {
  const browser = await chromium.launch({ 
    headless: true, 
    channel: process.env.BROWSER_CHANNEL || 'chrome' 
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    console.log(`\n\n=== ${label} ===`);
    console.log(`Base URL: ${appConfig.baseUrl}`);
    
    // Navigate to base with retry
    let attempts = 0;
    while (attempts < 3) {
      try {
        await page.goto(appConfig.baseUrl, { waitUntil: 'commit', timeout: 30000 });
        break;
      } catch (e) {
        attempts += 1;
        if (attempts < 3) {
          console.log(`Retry ${attempts}...`);
          await page.waitForTimeout(1000 * attempts);
        } else {
          throw e;
        }
      }
    }
    console.log(`Initial URL: ${page.url()}`);

    // Check if login form is visible
    const usernameField = page.locator(loginSelectors.username).first();
    const loginFormVisible = await usernameField
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (loginFormVisible) {
      console.log('✓ Login form detected, entering credentials...');
      await usernameField.fill(appConfig.username, { timeout: 10000 });
      await page.locator(loginSelectors.password).first().fill(appConfig.password, { timeout: 10000 });
      await page.locator(loginSelectors.submit).first().click({ timeout: 10000 });
      
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
      await page.waitForTimeout(2000);
      console.log(`✓ After login URL: ${page.url()}`);
    } else {
      console.log('✓ Already authenticated (no login form)');
    }

    // Take screenshot
    const screenshotPath = path.join('explore-screenshots', `${label}.png`);
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✓ Screenshot saved to ${screenshotPath}`);

    // Extract page info
    const pageInfo = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      h1: Array.from(document.querySelectorAll('h1')).map(e => e.textContent.trim()).filter(Boolean),
      buttons: Array.from(document.querySelectorAll('button, a[role="button"]')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 10),
      links: Array.from(document.querySelectorAll('a')).map(e => ({text: e.textContent.trim(), href: e.getAttribute('href')})).filter(e => e.text && e.href).slice(0, 10),
    }));

    console.log('Page title:', pageInfo.title);
    console.log('H1 elements:', pageInfo.h1);
    console.log('Buttons:', pageInfo.buttons);
    console.log('Links:', JSON.stringify(pageInfo.links, null, 2));
    
  } catch (error) {
    console.error(`ERROR in ${label}:`, error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function run() {
  const cfg = {
    appA: {
      baseUrl: process.env.APP_A_BASE_URL,
      username: process.env.APP_A_USERNAME,
      password: process.env.APP_A_PASSWORD,
    },
    appB: {
      baseUrl: process.env.APP_B_BASE_URL,
      username: process.env.APP_B_USERNAME,
      password: process.env.APP_B_PASSWORD,
    },
    loginSelectors: {
      username: process.env.LOGIN_USERNAME_SELECTOR,
      password: process.env.LOGIN_PASSWORD_SELECTOR,
      submit: process.env.LOGIN_SUBMIT_SELECTOR,
    },
  };

  await exploreApp(cfg.appA, cfg.loginSelectors, 'APP_A');
  await exploreApp(cfg.appB, cfg.loginSelectors, 'APP_B');
}

run().catch(console.error);
