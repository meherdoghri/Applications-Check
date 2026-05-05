const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const APP_A_STORAGE = path.resolve(__dirname, '../auth/4you.json');
const OUT_JSON = path.resolve(__dirname, '../test-results/4you-s7-hierarchy-live.json');
const OUT_TXT = path.resolve(__dirname, '../test-results/4you-s7-hierarchy-live.txt');
const MAX_DOMAINS = 8;
const MAX_THEMES = 8;

const KNOWN_DOMAINS = [
  'Dossier individuel',
  'GTA',
  'Paie',
  'Prelevement a la source',
  'Prélèvement à la source',
  'Declaration legale',
  'Déclaration légale',
  'Pre-embauche',
  'Pré-embauche',
  'Organisation',
  'BI & Reporting',
  'Outils d\'administration',
  'Hr Configuration Tool V2',
  'HRCT v2',
  'Gestion documentaire',
  'HRa Channels',
  'Console d\'evenements',
  'Console d\'événements',
  'Administration des GP',
  'GP Administration',
  'Mes rapports',
  'Recherche',
  'Reporting'
];

const NOISE = new Set([
  'Menu',
  'Accueil',
  'Aide',
  'Deconnexion',
  'Déconnexion',
  'A propos',
  'À propos',
  'Mes preferences',
  'Mes préférences',
  'Powered by',
]);

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function uniq(arr) {
  return [...new Set(arr)];
}

function cleanTexts(items) {
  return uniq(
    items
      .map((t) => String(t || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((t) => t.length >= 2 && t.length <= 90)
      .filter((t) => !/^\d+$/.test(t))
      .filter((t) => !norm(t).includes('http'))
      .filter((t) => !NOISE.has(t) && !NOISE.has(norm(t)))
  );
}

function isKnownDomain(text) {
  const n = norm(text);
  return KNOWN_DOMAINS.some((d) => norm(d) === n);
}

function detectDomainsFromText(fullText) {
  const text = norm(fullText);
  return KNOWN_DOMAINS.filter((d) => text.includes(norm(d)));
}

function setDiff(next, prev) {
  const prevSet = new Set(prev.map(norm));
  return next.filter((x) => !prevSet.has(norm(x)));
}

async function gotoWithRetry(page, url, retries = 2) {
  for (let i = 0; i <= retries; i += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);
      return;
    } catch (e) {
      if (i === retries) throw e;
      await page.waitForTimeout(1200 * (i + 1));
    }
  }
}

async function clickByLabel(page, label) {
  const escaped = label.replace(/"/g, '\\"');
  const candidates = [
    page.getByRole('button', { name: label }).first(),
    page.getByRole('link', { name: label }).first(),
    page.locator(`:is(button,a,[role="button"],[role="menuitem"]):has-text("${escaped}")`).first(),
    page.getByText(label, { exact: true }).first(),
  ];

  for (const c of candidates) {
    if ((await c.count()) > 0) {
      const ok = await c.click({ timeout: 8000 }).then(() => true).catch(() => false);
      if (ok) {
        await page.waitForTimeout(800);
        return true;
      }
    }
  }
  return false;
}

async function collectVisibleClickableTexts(page) {
  const raw = await page.evaluate(() => {
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };

    const selector = 'button, a, [role="button"], [role="menuitem"], [aria-expanded], li, span, div';
    const nodes = Array.from(document.querySelectorAll(selector));
    const lines = [];
    for (const el of nodes.filter(isVisible)) {
      const text = (el.innerText || el.textContent || '').trim();
      if (!text) continue;
      text
        .split(/\n+/)
        .map((x) => x.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .forEach((x) => lines.push(x));
    }
    return lines;
  });
  return { raw, cleaned: cleanTexts(raw) };
}

async function loginS7(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoWithRetry(page, process.env.APP_B_BASE_URL);

    const user = page.locator('#loginid').first();
    const hasLoginForm = (await user.count()) > 0;

    if (!hasLoginForm) {
      await page.waitForTimeout(1000);
      return;
    }

    await user.fill('');
    await user.fill(process.env.APP_B_USERNAME || '', { timeout: 15000 });
    const pass = page.locator('#password').first();
    await pass.fill('');
    await pass.fill(process.env.APP_B_PASSWORD || '', { timeout: 15000 });

    const uVal = await user.inputValue().catch(() => '');
    const pLen = (await pass.inputValue().catch(() => '')).length;
    console.log(`[S7] login fields filled: user=${uVal ? 'yes' : 'no'}, passLen=${pLen}`);

    const submit = page.locator('input[type="submit"]').first();
    const clicked = await submit.click({ timeout: 15000 }).then(() => true).catch(() => false);
    if (!clicked) {
      await page.waitForTimeout(1500);
      continue;
    }

    await page.waitForTimeout(2500);
    const stillOnLogin = (await page.locator('#loginid').count()) > 0;
    if (!stillOnLogin) {
      return;
    }
  }
}

async function ensure4YouReady(page) {
  await gotoWithRetry(page, `${process.env.APP_A_BASE_URL}/#/login`);
  await page.waitForTimeout(1500);

  // Direct login using provided credentials when form is visible.
  const user = page.getByRole('textbox', { name: 'Votre identifiant *' }).first();
  if ((await user.count()) > 0) {
    await user.fill(process.env.APP_A_USERNAME || '', { timeout: 10000 });
    await page.getByRole('textbox', { name: 'Votre mot de passe *' }).first().fill(process.env.APP_A_PASSWORD || '', { timeout: 10000 });
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null),
      page.getByRole('button', { name: 'Me connecter' }).first().click({ timeout: 10000 }),
    ]);
  }

  await gotoWithRetry(page, `${process.env.APP_A_BASE_URL}/#/sydexpert`);

  await page.waitForTimeout(1500);
}

async function open4YouParent(page) {
  await ensure4YouReady(page);
  await clickByLabel(page, 'Menu');
  await clickByLabel(page, 'Gestion administrative/Paie');
}

async function openS7Parent(page) {
  await loginS7(page);
  await clickByLabel(page, 'Menu').catch(() => null);
  await page.waitForTimeout(700);
}

async function extractAppHierarchy(page, appName, openParentFn) {
  const hierarchy = {};

  console.log(`[${appName}] ouverture menu parent...`);
  await openParentFn(page);
  const baselinePack = await collectVisibleClickableTexts(page);
  const baseline = baselinePack.cleaned;
  const bodyText = await page.locator('body').innerText().catch(() => '');
  fs.writeFileSync(
    path.resolve(__dirname, `../test-results/${appName.toLowerCase()}-visible-clickables-debug.json`),
    JSON.stringify({ appName, baseline, rawSample: baselinePack.raw.slice(0, 250), bodyTextSample: String(bodyText).slice(0, 4000) }, null, 2),
    'utf-8'
  );
  const domainsFromBaseline = baseline.filter((t) => isKnownDomain(t));
  const domainsFromText = detectDomainsFromText(bodyText);
  const domains = uniq([...domainsFromBaseline, ...domainsFromText]).slice(0, MAX_DOMAINS);
  console.log(`[${appName}] domaines detectes: ${domains.length}`);

  for (const domain of domains) {
    console.log(`[${appName}] domaine: ${domain}`);
    try {
      await openParentFn(page);
    } catch (e) {
      hierarchy[domain] = { __status: 'open-parent-failed', themes: {} };
      continue;
    }
    const beforeDomain = (await collectVisibleClickableTexts(page)).cleaned;
    const domainClicked = await clickByLabel(page, domain);

    if (!domainClicked) {
      hierarchy[domain] = { __status: 'not-clickable', themes: {} };
      continue;
    }

    const afterDomain = (await collectVisibleClickableTexts(page)).cleaned;
    let themes = setDiff(afterDomain, beforeDomain)
      .filter((t) => !isKnownDomain(t))
      .filter((t) => t.length > 2)
      .slice(0, MAX_THEMES);

    // fallback: si aucun delta, garder quelques éléments visibles proches de la navigation
    if (themes.length === 0) {
      themes = afterDomain
        .filter((t) => !isKnownDomain(t))
        .filter((t) => t.length > 2)
        .slice(0, MAX_THEMES);
    }

    console.log(`[${appName}] themes detectes pour ${domain}: ${themes.length}`);

    const themeMap = {};

    for (const theme of themes) {
      console.log(`[${appName}]  theme: ${theme}`);
      const beforeTheme = (await collectVisibleClickableTexts(page)).cleaned;
      const themeClicked = await clickByLabel(page, theme);

      if (!themeClicked) {
        themeMap[theme] = [];
        continue;
      }

      const afterTheme = (await collectVisibleClickableTexts(page)).cleaned;
      const actions = setDiff(afterTheme, beforeTheme)
        .filter((t) => !isKnownDomain(t))
        .filter((t) => norm(t) !== norm(theme))
        .filter((t) => t.length > 2)
        .slice(0, 12);

      themeMap[theme] = actions;
    }

    hierarchy[domain] = { __status: 'ok', themes: themeMap };
  }

  return { appName, domainsDetected: domains, hierarchy };
}

function buildTextReport(result4You, resultS7) {
  const lines = [];
  lines.push('EXTRACTION LIVE 4YOU vs S7');
  lines.push(`GeneratedAt: ${new Date().toISOString()}`);
  lines.push('');

  const section = (title, data) => {
    lines.push(title);
    lines.push('-'.repeat(title.length));
    for (const [domain, payload] of Object.entries(data.hierarchy)) {
      lines.push(domain);
      if (payload.__status !== 'ok') {
        lines.push('  [non cliquable]');
        continue;
      }
      for (const [theme, actions] of Object.entries(payload.themes)) {
        lines.push(`  - Theme: ${theme}`);
        if (!actions || actions.length === 0) {
          lines.push('    - Action: (aucune action detectee)');
        } else {
          for (const a of actions) {
            lines.push(`    - Action: ${a}`);
          }
        }
      }
    }
    lines.push('');
  };

  section('4YOU', result4You);
  section('S7', resultS7);

  return lines.join('\n');
}

function writeOutputs(result4You, resultS7) {
  let prev = null;
  if (fs.existsSync(OUT_JSON)) {
    try {
      prev = JSON.parse(fs.readFileSync(OUT_JSON, 'utf-8'));
    } catch {
      prev = null;
    }
  }

  const has4 = result4You && result4You.domainsDetected && result4You.domainsDetected.length > 0;
  const has7 = resultS7 && resultS7.domainsDetected && resultS7.domainsDetected.length > 0;

  const merged4 = has4
    ? result4You
    : (prev && prev.app4you ? prev.app4you : result4You);
  const merged7 = has7
    ? resultS7
    : (prev && prev.appS7 ? prev.appS7 : resultS7);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'live-ui-extraction',
    app4you: merged4,
    appS7: merged7,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf-8');
  fs.writeFileSync(OUT_TXT, buildTextReport(merged4, merged7), 'utf-8');
}

async function main() {
  if (!process.env.APP_A_BASE_URL || !process.env.APP_B_BASE_URL) {
    throw new Error('APP_A_BASE_URL / APP_B_BASE_URL manquants dans .env');
  }

  const browser = await chromium.launch({
    headless: false,
    channel: process.env.BROWSER_CHANNEL || 'chrome',
  });

  const c4 = fs.existsSync(APP_A_STORAGE)
    ? await browser.newContext({ ignoreHTTPSErrors: true, storageState: APP_A_STORAGE })
    : await browser.newContext({ ignoreHTTPSErrors: true });
  const c7 = await browser.newContext({ ignoreHTTPSErrors: true });
  const p4 = await c4.newPage();
  const p7 = await c7.newPage();

  let result4You = { appName: '4YOU', domainsDetected: [], hierarchy: {} };
  let resultS7 = { appName: 'S7', domainsDetected: [], hierarchy: {} };

  try {
    try {
      result4You = await extractAppHierarchy(p4, '4YOU', open4YouParent);
      writeOutputs(result4You, resultS7);
    } catch (e) {
      console.error('[4YOU] extraction partielle en erreur:', e.message);
      writeOutputs(result4You, resultS7);
    }

    try {
      resultS7 = await extractAppHierarchy(p7, 'S7', openS7Parent);
      writeOutputs(result4You, resultS7);
    } catch (e) {
      console.error('[S7] extraction partielle en erreur:', e.message);
      writeOutputs(result4You, resultS7);
    }

    console.log('OK: extraction live terminee');
    console.log(`- ${OUT_JSON}`);
    console.log(`- ${OUT_TXT}`);
  } finally {
    await c4.close();
    await c7.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error('ERREUR extraction live:', e.message);
  process.exitCode = 1;
});
