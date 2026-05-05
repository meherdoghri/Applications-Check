const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const BASE_TIMEOUT = Number(process.env.DEFAULT_TIMEOUT_MS || 30000);
const COMMON_FLOWS = [
  { key: 'menu', label: 'Menu', role: 'button' },
  { key: 'accueil', label: 'Accueil', role: 'link' },
  { key: 'aide', label: 'Aide', role: 'button' },
];

function normalizeLabel(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function gotoWithRetry(page, url, retries = 2) {
  for (let i = 0; i <= retries; i += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: BASE_TIMEOUT });
      return;
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      await page.waitForTimeout(1000 * (i + 1));
    }
  }
}

async function loginS7(page) {
  await gotoWithRetry(page, process.env.APP_B_BASE_URL, 2);

  const user = page.locator('#loginid').first();
  if ((await user.count()) > 0) {
    await user.fill(process.env.APP_B_USERNAME, { timeout: BASE_TIMEOUT });
    await page.locator('#password').first().fill(process.env.APP_B_PASSWORD, { timeout: BASE_TIMEOUT });
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: BASE_TIMEOUT }).catch(() => null),
      page.locator('input[type="submit"]').first().click({ timeout: BASE_TIMEOUT }),
    ]);
  }

  await page.waitForTimeout(2000);
}

async function open4You(page) {
  const appABase = process.env.APP_A_BASE_URL || 'https://cacib4you-dev.soprahronline.sopra/app/foryou';
  await gotoWithRetry(page, `${appABase}/#/sydexpert`, 2);
  await page.waitForTimeout(2500);
}

async function hasVisibleByRole(page, role, name) {
  const locator = page.getByRole(role, { name }).first();
  return locator.isVisible().catch(() => false);
}

async function clickFlow(page, flow) {
  const before = {
    url: page.url(),
    title: await page.title(),
  };

  let available = false;
  let clicked = false;
  let error = '';

  const roleCandidates = flow.role === 'link' ? ['link', 'button'] : ['button', 'link'];
  let chosenRole = null;

  for (const role of roleCandidates) {
    const isVisible = await hasVisibleByRole(page, role, flow.label);
    if (isVisible) {
      available = true;
      chosenRole = role;
      break;
    }
  }

  if (available && chosenRole) {
    try {
      const target = page.getByRole(chosenRole, { name: flow.label }).first();
      await Promise.all([
        page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null),
        target.click({ timeout: 10000 }),
      ]);
      await page.waitForTimeout(900);
      clicked = true;
    } catch (e) {
      error = e.message.split('\n')[0];
    }
  }

  const after = {
    url: page.url(),
    title: await page.title(),
  };

  return {
    key: flow.key,
    label: flow.label,
    available,
    clicked,
    error,
    before,
    after,
    changedUrl: before.url !== after.url,
    changedTitle: before.title !== after.title,
  };
}

function compareFlowResult(a, b) {
  return {
    flow: a.label,
    availableIn4You: a.available,
    availableInS7: b.available,
    clickableIn4You: a.clicked,
    clickableInS7: b.clicked,
    behaviorMatch:
      a.available === b.available &&
      a.clicked === b.clicked &&
      a.changedUrl === b.changedUrl,
    notes: [
      a.error ? `4YOU error: ${a.error}` : '',
      b.error ? `S7 error: ${b.error}` : '',
    ].filter(Boolean),
    snapshots: {
      appA: a,
      appB: b,
    },
  };
}

function buildSummary(report) {
  const total = report.flowComparisons.length;
  const matches = report.flowComparisons.filter((f) => f.behaviorMatch).length;
  return {
    comparedFlows: total,
    matchedFlows: matches,
    mismatchedFlows: total - matches,
  };
}

async function run() {
  const storageState4You = path.resolve(__dirname, '../auth/4you.json');
  if (!fs.existsSync(storageState4You)) {
    throw new Error('Missing auth/4you.json. Please capture 4YOU session first.');
  }

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'chrome',
  });

  const context4You = await browser.newContext({
    ignoreHTTPSErrors: true,
    storageState: storageState4You,
  });
  const contextS7 = await browser.newContext({ ignoreHTTPSErrors: true });

  const pageA = await context4You.newPage();
  const pageB = await contextS7.newPage();

  try {
    await open4You(pageA);
    await loginS7(pageB);

    const appAFlows = [];
    const appBFlows = [];

    for (const flow of COMMON_FLOWS) {
      appAFlows.push(await clickFlow(pageA, flow));
      appBFlows.push(await clickFlow(pageB, flow));
    }

    const flowComparisons = appAFlows.map((a, idx) => compareFlowResult(a, appBFlows[idx]));

    const report = {
      generatedAt: new Date().toISOString(),
      comparedFlowKeys: COMMON_FLOWS.map((f) => f.key),
      flowComparisons,
    };

    report.summary = buildSummary(report);

    const outDir = path.resolve(__dirname, '../test-results');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.resolve(outDir, 'business-common-diff.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('Business comparison report:', outPath);
    console.log('Summary:', report.summary);

    for (const row of flowComparisons) {
      console.log(
        `- ${row.flow}: match=${row.behaviorMatch} | 4YOU(avail:${row.availableIn4You}, click:${row.clickableIn4You}) | S7(avail:${row.availableInS7}, click:${row.clickableInS7})`
      );
      if (row.notes.length) {
        console.log(`  notes: ${row.notes.join(' | ')}`);
      }
    }
  } finally {
    await context4You.close();
    await contextS7.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error('Business comparison failed:', error.message);
  process.exit(1);
});
