const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

async function testBothLogins() {
  const browser = await chromium.launch({ 
    headless: true, 
    channel: process.env.BROWSER_CHANNEL || 'chrome' 
  });

  try {
    console.log('\n=== Testing Both App Logins ===\n');

    // Test APP_A
    {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      
      console.log('APP_A:');
      await page.goto(process.env.APP_A_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log(`  URL after goto: ${page.url()}`);

      const contentA = await page.evaluate(() => ({
        title: document.title,
        hasText: document.body.innerText.trim().length > 20,
        loginFormVisible: !!document.querySelector('input[name="username"]') || !!document.querySelector('#loginid'),
      }));
      
      console.log(`  Title: "${contentA.title}"`);
      console.log(`  Has content: ${contentA.hasText}`);
      console.log(`  Login form visible: ${contentA.loginFormVisible}`);
      
      // If there's content, maybe we ARE authenticated
      if (contentA.hasText && contentA.title && contentA.title !== 'Se connecter - 4YOU') {
        console.log(`  ✓ APPEARS TO BE AUTHENTICATED!`);
      } else if (contentA.title.includes('connecter') || contentA.title.includes('login')) {
        console.log(`  ✗ Still on login page`);
      }

      await context.close();
    }

    // Test APP_B
    {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      
      console.log('\nAPP_B:');
      await page.goto(process.env.APP_B_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log(`  URL after goto: ${page.url()}`);

      const contentB = await page.evaluate(() => ({
        title: document.title,
        hasText: document.body.innerText.trim().length > 20,
        loginFormVisible: !!document.querySelector('#loginid'),
      }));
      
      console.log(`  Title: "${contentB.title}"`);
      console.log(`  Has content: ${contentB.hasText}`);
      console.log(`  Login form visible: ${contentB.loginFormVisible}`);

      await context.close();
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await browser.close();
  }
}

testBothLogins().catch(console.error);
