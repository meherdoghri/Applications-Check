const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const TIMEOUT = Number(process.env.DEFAULT_TIMEOUT_MS || 30000);
const APP_A_STORAGE = path.resolve(__dirname, '../auth/4you.json');

// Common menu entries between S7/Menu and 4YOU/Gestion administrative/Paie.
const COMMON_PAGES = [
  'Dossier individuel',
  'GTA',
  'Mes rapports',
  'Organisation',
  'Outils d\'administration',
  'Paie',
  'Prélèvement à la source',
  'Déclaration légale',
];

function normalize(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a, b) {
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  const words1 = new Set(s1.split(' '));
  const words2 = new Set(s2.split(' '));
  const inter = [...words1].filter((w) => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size || 1;
  return inter / union;
}

async function gotoWithRetry(page, url, retries = 2) {
  for (let i = 0; i <= retries; i += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      return;
    } catch (error) {
      if (i === retries) throw error;
      await page.waitForTimeout(1000 * (i + 1));
    }
  }
}

async function ensure4YouReady(page, appABase) {
  await gotoWithRetry(page, `${appABase}/#/sydexpert`, 2);
  await page.waitForTimeout(2500);

  for (let i = 0; i < 4; i += 1) {
    const menuCount = await page.getByRole('button', { name: 'Menu' }).count();
    if (menuCount > 0) return;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: TIMEOUT }).catch(() => null);
    await page.waitForTimeout(1200 * (i + 1));
  }

  throw new Error('4YOU shell not ready (Menu not available).');
}

async function open4YouGestionMenu(page) {
  const menu = page.getByRole('button', { name: 'Menu' }).first();
  await menu.click({ timeout: 7000 });
  await page.waitForTimeout(700);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const strict = page.getByRole('button', { name: 'Gestion administrative/Paie' }).first();
    if ((await strict.count()) > 0) {
      const ok = await strict.click({ timeout: 7000 }).then(() => true).catch(() => false);
      if (ok) {
        await page.waitForTimeout(700);
        return;
      }
    }

    const fallback = page
      .locator(':is(button,[role="button"],a):has-text("Gestion administrative")')
      .first();
    if ((await fallback.count()) > 0) {
      const ok = await fallback.click({ timeout: 7000 }).then(() => true).catch(() => false);
      if (ok) {
        await page.waitForTimeout(700);
        return;
      }
    }

    await menu.click({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(600);
  }

  throw new Error('Unable to open Gestion administrative/Paie submenu in 4YOU.');
}

async function loginS7(page, cfg) {
  await gotoWithRetry(page, cfg.appBBase, 2);

  const user = page.locator('#loginid').first();
  if ((await user.count()) > 0) {
    await user.fill(cfg.appBUser, { timeout: TIMEOUT });
    await page.locator('#password').first().fill(cfg.appBPass, { timeout: TIMEOUT });
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: TIMEOUT }).catch(() => null),
      page.locator('input[type="submit"]').first().click({ timeout: TIMEOUT }),
    ]);
  }

  await page.waitForTimeout(1500);
}

async function openS7Menu(page) {
  const menuBtn = page.getByRole('button', { name: 'Menu' }).first();
  if ((await menuBtn.count()) > 0) {
    await menuBtn.click({ timeout: 7000 }).catch(() => null);
    await page.waitForTimeout(700);
  }
}

async function clickByLabel(page, label) {
  const selectors = [
    () => page.getByRole('link', { name: label }).first(),
    () => page.getByRole('button', { name: label }).first(),
    () => page.locator(`:is(a,button,[role="button"],[role="menuitem"]):has-text("${label.replace(/"/g, '\\"')}")`).first(),
  ];

  for (const build of selectors) {
    const locator = build();
    if ((await locator.count()) > 0) {
      const clicked = await Promise.all([
        page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null),
        locator.click({ timeout: 10000 }),
      ])
        .then(() => true)
        .catch(() => false);
      if (clicked) {
        await page.waitForTimeout(900);
        return true;
      }
    }
  }

  return false;
}

async function extractPageSnapshot(page) {
  return page.evaluate(() => {
    const clean = (text) => (text || '').replace(/\s+/g, ' ').trim();

    const headings = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]'))
      .map((el) => clean(el.textContent))
      .filter(Boolean)
      .slice(0, 20);

    const text = clean(document.body ? document.body.innerText : '').slice(0, 1200);
    const links = Array.from(document.querySelectorAll('a')).filter((el) => !!el.offsetParent).length;
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).filter((el) => !!el.offsetParent).length;
    const tables = document.querySelectorAll('table').length;
    const forms = document.querySelectorAll('form').length;

    return {
      url: location.href,
      title: document.title || '',
      headings,
      text,
      metrics: { links, buttons, tables, forms },
    };
  });
}

function compareSnapshots(a, b) {
  return {
    titleSimilarity: Number(similarity(a.title, b.title).toFixed(3)),
    headingSimilarity: Number(similarity((a.headings || []).join(' '), (b.headings || []).join(' ')).toFixed(3)),
    textSimilarity: Number(similarity(a.text, b.text).toFixed(3)),
  };
}

async function run() {
  const cfg = {
    appABase: process.env.APP_A_BASE_URL,
    appBBase: process.env.APP_B_BASE_URL,
    appBUser: process.env.APP_B_USERNAME,
    appBPass: process.env.APP_B_PASSWORD,
  };

  if (!cfg.appABase || !cfg.appBBase || !cfg.appBUser || !cfg.appBPass) {
    throw new Error('Missing required .env values.');
  }
  if (!fs.existsSync(APP_A_STORAGE)) {
    throw new Error('Missing auth/4you.json. Please capture 4YOU session first.');
  }

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'chrome',
  });

  const contextA = await browser.newContext({ ignoreHTTPSErrors: true, storageState: APP_A_STORAGE });
  const contextB = await browser.newContext({ ignoreHTTPSErrors: true });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const results = [];

  try {
    await ensure4YouReady(pageA, cfg.appABase);
    await loginS7(pageB, cfg);

    for (const label of COMMON_PAGES) {
      // 4YOU path under Gestion administrative/Paie
      await ensure4YouReady(pageA, cfg.appABase);
      await open4YouGestionMenu(pageA);
      const appAClicked = await clickByLabel(pageA, label);
      const appASnapshot = await extractPageSnapshot(pageA);

      // S7 path under Menu
      await loginS7(pageB, cfg);
      await openS7Menu(pageB);
      const appBClicked = await clickByLabel(pageB, label);
      const appBSnapshot = await extractPageSnapshot(pageB);

      const similarityScores = compareSnapshots(appASnapshot, appBSnapshot);

      results.push({
        label,
        appA: {
          clicked: appAClicked,
          snapshot: appASnapshot,
        },
        appB: {
          clicked: appBClicked,
          snapshot: appBSnapshot,
        },
        similarity: similarityScores,
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      scope: {
        appA: '4YOU/Gestion administrative/Paie',
        appB: 'S7/Menu',
      },
      pagesChecked: COMMON_PAGES,
      results,
      summary: {
        totalPages: results.length,
        bothClickable: results.filter((r) => r.appA.clicked && r.appB.clicked).length,
        missingIn4You: results.filter((r) => !r.appA.clicked && r.appB.clicked).map((r) => r.label),
        missingInS7: results.filter((r) => r.appA.clicked && !r.appB.clicked).map((r) => r.label),
      },
    };

    const outDir = path.resolve(__dirname, '../test-results');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.resolve(outDir, 'page-content-diff.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('Page content comparison report:', outPath);
    console.log('Summary:', report.summary);
  } finally {
    await contextA.close();
    await contextB.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error('Page content comparison failed:', error.message);
  process.exit(1);
});
