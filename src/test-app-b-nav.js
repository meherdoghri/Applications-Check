const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

async function testAppB() {
  const browser = await chromium.launch({ 
    headless: true, 
    channel: process.env.BROWSER_CHANNEL || 'chrome' 
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    console.log('\n=== Testing APP_B Navigation ===');
    
    // Go to base
    await page.goto(process.env.APP_B_BASE_URL, { waitUntil: 'commit', timeout: 30000 });
    console.log(`1. Initial URL: ${page.url()}`);

    // Fill login
    const loginIdField = page.locator('#loginid').first();
    const isVisible = await loginIdField.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    
    if (isVisible) {
      console.log('2. Found login form, logging in...');
      await loginIdField.fill(process.env.APP_B_USERNAME);
      await page.locator('#password').fill(process.env.APP_B_PASSWORD);
      
      // Click submit and wait
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null),
        page.locator('input[type="submit"]').first().click(),
      ]);
      await page.waitForTimeout(2000);
      console.log(`3. After login URL: ${page.url()}`);
    }

    // Check all links on the page to find navigation
    const allLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        title: a.getAttribute('title'),
      })).filter(l => l.href && !l.href.startsWith('javascript:'));
    });

    console.log('\n4. Available navigation links:');
    allLinks.forEach((link, i) => {
      if (link.text) console.log(`  ${i}: "${link.text}" -> ${link.href}`);
    });

    // Try to find and click a main menu link
    const homeLink = allLinks.find(l => 
      l.text.toLowerCase().includes('accueil') || 
      l.text.toLowerCase().includes('home') ||
      l.text.toLowerCase().includes('dashboard') ||
      l.text.toLowerCase().includes('portal')
    );

    if (homeLink && homeLink.href && !homeLink.href.startsWith('javascript')) {
      console.log(`\n5. Found home link: "${homeLink.text}"`);
      await page.goto(new URL(homeLink.href, page.url()).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      console.log(`6. After clicking home: ${page.url()}`);

      const content = await page.evaluate(() => ({
        title: document.title,
        h1: Array.from(document.querySelectorAll('h1, h2')).map(e => e.textContent.trim()).slice(0, 3),
        bodyText: document.body.innerText.slice(0, 200),
      }));
      console.log('7. Page content:', content);
    }

    const screenshot = await page.screenshot({ fullPage: true });
    const fs = require('fs');
    await fs.promises.mkdir('explore-screenshots', { recursive: true });
    await fs.promises.writeFile('explore-screenshots/APP_B_detailed.png', screenshot);
    console.log('\n✓ Detailed screenshot saved');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

testAppB().catch(console.error);
