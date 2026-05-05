const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

async function inspectAppALoginForm() {
  const browser = await chromium.launch({ 
    headless: true, 
    channel: process.env.BROWSER_CHANNEL || 'chrome' 
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    console.log('\n=== APP_A Login Form Inspection ===\n');

    // Navigate
    await page.goto(process.env.APP_A_BASE_URL, { waitUntil: 'commit', timeout: 30000 });
    console.log(`1. URL: ${page.url()}`);
    console.log(`   Title: "${await page.title()}"`);

    await page.waitForTimeout(3000);

    // Get all form-related elements
    const formElements = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        placeholder: i.placeholder,
        value: i.value,
        visible: i.offsetParent !== null,
        className: i.className,
      }));

      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], [type="submit"]')).map(b => ({
        tag: b.tagName,
        type: b.type,
        id: b.id,
        className: b.className,
        textContent: (b.textContent || '').trim(),
        visible: b.offsetParent !== null,
      }));

      const forms = Array.from(document.querySelectorAll('form')).map((f, i) => ({
        index: i,
        id: f.id,
        name: f.name,
        action: f.action,
        method: f.method,
      }));

      return { inputs, buttons, forms, bodyHTML: document.body.innerHTML.substring(0, 500) };
    });

    console.log('\n2. INPUTS:');
    formElements.inputs.forEach((inp, i) => {
      console.log(`  [${i}] type=${inp.type}, id=${inp.id}, name=${inp.name}, placeholder=${inp.placeholder}, visible=${inp.visible}`);
    });

    console.log('\n3. BUTTONS:');
    formElements.buttons.forEach((btn, i) => {
      console.log(`  [${i}] ${btn.tag} type=${btn.type}, id=${btn.id}, text="${btn.textContent}", visible=${btn.visible}`);
    });

    console.log('\n4. FORMS:');
    formElements.forms.forEach((form, i) => {
      console.log(`  [${i}] id=${form.id}, name=${form.name}, action=${form.action}, method=${form.method}`);
    });

    console.log('\n5. Body HTML (first 500 chars):');
    console.log(formElements.bodyHTML.replace(/></g, '>\n<').substring(0, 500));

    // Try to find the login input using different selectors
    const loginSelectors = [
      'input[name="username"]',
      'input[name="user"]',
      'input[name="login"]',
      'input[name="email"]',
      'input[id*="user"]',
      'input[id*="login"]',
      'input[id*="username"]',
      'input[placeholder*="user"]',
      'input[placeholder*="login"]',
      'input.form-control:first-of-type',
    ];

    console.log('\n6. Testing selectors:');
    for (const selector of loginSelectors) {
      const el = await page.$(selector);
      console.log(`  ${selector} -> ${el ? '✓ FOUND' : '✗ not found'}`);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

inspectAppALoginForm().catch(console.error);
