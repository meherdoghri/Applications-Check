const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function normalizeLabel(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeAndSort(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

async function gotoWithRetry(page, url, timeoutMs, retries) {
  for (let i = 0; i <= retries; i += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      return;
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      await page.waitForTimeout(1000 * (i + 1));
    }
  }
}

async function extractVisibleNavTexts(page) {
  return page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll(
        [
          'a',
          'button',
          '[role="button"]',
          '[role="menuitem"]',
        ].join(',')
      )
    );

    const out = [];
    for (const el of candidates) {
      const isVisible = !!el.offsetParent || getComputedStyle(el).position === 'fixed';
      if (!isVisible) {
        continue;
      }

      const text = (el.textContent || '').trim();
      const title = (el.getAttribute('title') || '').trim();
      const aria = (el.getAttribute('aria-label') || '').trim();
      const parts = [text, title, aria].filter(Boolean);

      for (const part of parts) {
        if (part.length >= 2 && part.length <= 120) {
          out.push(part);
        }
      }
    }

    return out;
  });
}

async function extractS7MenuTexts(page) {
  return page.evaluate(() => {
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const out = [];

    const menuRoots = Array.from(
      document.querySelectorAll('[id*="menu" i], [class*="menu" i], [role="menu"]')
    ).filter((el) => !!el.offsetParent);

    for (const root of menuRoots) {
      const nodes = root.querySelectorAll('a,button,[role="menuitem"],li,span,div');
      for (const node of nodes) {
        if (!node || !node.offsetParent) continue;
        const values = [
          normalize(node.textContent),
          normalize(node.getAttribute('title') || ''),
          normalize(node.getAttribute('aria-label') || ''),
        ].filter(Boolean);
        for (const value of values) {
          if (value.length >= 2 && value.length <= 120) {
            out.push(value);
          }
        }
      }
    }

    return Array.from(new Set(out));
  });
}

async function collect4YouItems(browser, cfg) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    storageState: path.resolve(__dirname, '../auth/4you.json'),
  });
  const page = await context.newPage();

  await gotoWithRetry(page, `${cfg.appABase}/#/sydexpert`, cfg.timeoutMs, 2);
  await page.waitForTimeout(3000);

  // Recover from partial shell loads by retrying until Menu is present.
  let menuReady = false;
  for (let attempt = 0; attempt < 4 && !menuReady; attempt += 1) {
    const menuCount = await page.getByRole('button', { name: 'Menu' }).count();
    menuReady = menuCount > 0;
    if (!menuReady) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs }).catch(() => null);
      await page.waitForTimeout(1200 * (attempt + 1));
    }
  }

  if (!menuReady) {
    await context.close();
    throw new Error('4YOU authenticated shell is not fully loaded (Menu unavailable).');
  }

  const menuBtn = page.getByRole('button', { name: 'Menu' });
  if (await menuBtn.count()) {
    await menuBtn.click({ timeout: cfg.timeoutMs }).catch(() => null);
    await page.waitForTimeout(1000);
  }

  // Restrict 4YOU scope to entries that appear after opening Gestion administrative/Paie.
  const beforeOpen = await extractVisibleNavTexts(page);

  let clicked = false;
  for (let attempt = 0; attempt < 3 && !clicked; attempt += 1) {
    const menuToggle = page.getByRole('button', { name: 'Menu' }).first();
    if (await menuToggle.count()) {
      await menuToggle.click({ timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(700);
    }

    const strictButton = page.getByRole('button', { name: 'Gestion administrative/Paie' }).first();
    if (await strictButton.count()) {
      clicked = await strictButton.click({ timeout: 7000 }).then(() => true).catch(() => false);
    }

    if (!clicked) {
      const fallbackButton = page
        .locator(':is(button,[role="button"],a):has-text("Gestion administrative")')
        .first();
      if (await fallbackButton.count()) {
        clicked = await fallbackButton.click({ timeout: 7000 }).then(() => true).catch(() => false);
      }
    }

    if (!clicked) {
      await page.waitForTimeout(500 * (attempt + 1));
    }
  }

  if (!clicked) {
    await context.close();
    throw new Error('Unable to open 4YOU menu Gestion administrative/Paie.');
  }

  await page.waitForTimeout(1200);

  const afterOpen = await extractVisibleNavTexts(page);
  const beforeNormalized = new Set(beforeOpen.map((value) => normalizeLabel(value)));
  const deepItems = afterOpen
    .filter((value) => !beforeNormalized.has(normalizeLabel(value)))
    .filter((value) => {
      const normalized = normalizeLabel(value);
      return (
        normalized !== 'gestion administrative paie' &&
        normalized !== 'menu' &&
        normalized !== 'menu principal'
      );
    });

  await context.close();
  return dedupeAndSort(deepItems);
}

async function collectS7Items(browser, cfg) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await gotoWithRetry(page, cfg.appBBase, cfg.timeoutMs, 2);

  const username = page.locator('#loginid').first();
  if (await username.count()) {
    await username.fill(cfg.appBUser, { timeout: cfg.timeoutMs });
    await page.locator('#password').first().fill(cfg.appBPass, { timeout: cfg.timeoutMs });
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: cfg.timeoutMs }).catch(() => null),
      page.locator('input[type="submit"]').first().click({ timeout: cfg.timeoutMs }),
    ]);
  }

  await page.waitForTimeout(2500);

  // Restrict S7 scope to entries visible under Menu only.
  const beforeOpen = await extractVisibleNavTexts(page);

  let clicked = false;
  const menuButton = page.getByRole('button', { name: 'Menu' }).first();
  if (await menuButton.count()) {
    clicked = await menuButton.click({ timeout: 7000 }).then(() => true).catch(() => false);
  }

  if (!clicked) {
    const fallbackButton = page.locator('button:has-text("Menu")').first();
    if (await fallbackButton.count()) {
      clicked = await fallbackButton.click({ timeout: 7000 }).then(() => true).catch(() => false);
    }
  }

  await page.waitForTimeout(1200);

  const menuScoped = await extractS7MenuTexts(page);
  let menuItems = menuScoped;

  if (!menuItems.length) {
    const afterOpen = await extractVisibleNavTexts(page);
    if (clicked) {
      const beforeNormalized = new Set(beforeOpen.map((value) => normalizeLabel(value)));
      menuItems = afterOpen.filter((value) => !beforeNormalized.has(normalizeLabel(value)));
    } else {
      menuItems = afterOpen;
    }
  }

  await context.close();
  return dedupeAndSort(menuItems);
}

function buildDiffReport(itemsA, itemsB) {
  const normalizedA = new Map(itemsA.map((item) => [normalizeLabel(item), item]));
  const normalizedB = new Map(itemsB.map((item) => [normalizeLabel(item), item]));

  const missingIn4You = [];
  for (const [normalized, original] of normalizedB.entries()) {
    if (!normalizedA.has(normalized)) {
      missingIn4You.push(original);
    }
  }

  const missingInS7 = [];
  for (const [normalized, original] of normalizedA.entries()) {
    if (!normalizedB.has(normalized)) {
      missingInS7.push(original);
    }
  }

  return {
    summary: {
      total4YouItems: itemsA.length,
      totalS7Items: itemsB.length,
      missingIn4YouCount: missingIn4You.length,
      missingInS7Count: missingInS7.length,
    },
    classification: {
      // Items existing in S7 but missing in 4YOU.
      missing: dedupeAndSort(missingIn4You),
      // Items existing in 4YOU but not in S7 (evolution or 4YOU-specific scope).
      evolOuSpecifique4YOU: dedupeAndSort(missingInS7),
    },
    missingIn4You: dedupeAndSort(missingIn4You),
    missingInS7: dedupeAndSort(missingInS7),
    sample4You: itemsA.slice(0, 80),
    sampleS7: itemsB.slice(0, 80),
  };
}

async function main() {
  const cfg = {
    appABase: process.env.APP_A_BASE_URL,
    appBBase: process.env.APP_B_BASE_URL,
    appBUser: process.env.APP_B_USERNAME,
    appBPass: process.env.APP_B_PASSWORD,
    timeoutMs: Number(process.env.DEFAULT_TIMEOUT_MS || 30000),
  };

  if (!cfg.appABase || !cfg.appBBase || !cfg.appBUser || !cfg.appBPass) {
    throw new Error('Missing required .env variables for comparison run.');
  }

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'chrome',
  });

  try {
    const items4You = await collect4YouItems(browser, cfg);
    const itemsS7 = await collectS7Items(browser, cfg);

    const report = buildDiffReport(items4You, itemsS7);
    report.scope = {
      appA: '4YOU/Gestion administrative/Paie',
      appB: 'S7/Menu',
    };

    const outDir = path.resolve(__dirname, '../test-results');
    fs.mkdirSync(outDir, { recursive: true });
    const reportPath = path.resolve(outDir, 'functionality-items-diff.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('Comparison report generated at:', reportPath);
    console.log('Summary:', report.summary);

    const previewMissing = report.missingIn4You.slice(0, 20);
    console.log('\nItems in S7 but missing in 4YOU (top 20):');
    for (const item of previewMissing) {
      console.log('-', item);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Comparison run failed:', error.message);
  process.exit(1);
});
