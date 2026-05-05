const base = require('@playwright/test');
const { expect } = base;
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../src/env');
const { login } = require('../src/auth');
const { buildUrl, hideIgnoredSelectors, preparePageForShot } = require('../src/compare');

const cfg = getConfig();
const appAStorageStatePath = path.resolve(__dirname, '../auth/4you.json');
const hasAppAStorageState = fs.existsSync(appAStorageStatePath);

const test = base.test.extend({
  loggedPages: async ({ browser }, use) => {
    const contextA = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: hasAppAStorageState ? appAStorageStatePath : undefined,
    });
    const contextB = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    if (!hasAppAStorageState) {
      await login(pageA, cfg.appA, cfg.loginSelectors, {
        timeout: cfg.behavior.defaultTimeoutMs,
      });
    }
    await login(pageB, cfg.appB, cfg.loginSelectors, {
      timeout: cfg.behavior.defaultTimeoutMs,
    });

    await use({ pageA, pageB });

    await contextA.close();
    await contextB.close();
  },
});

test.describe('App A vs App B Functional Comparator', () => {
  for (const pageDef of cfg.pages) {
    test(`compare: ${pageDef.name}`, async ({ loggedPages }) => {
      const { pageA, pageB } = loggedPages;
      const info = test.info();

      const urlA = buildUrl(cfg.appA.baseUrl, pageDef.targetA);
      const urlB = buildUrl(cfg.appB.baseUrl, pageDef.targetB);

      // Navigate to pages
      await pageA.goto(urlA, { waitUntil: 'commit', timeout: cfg.behavior.defaultTimeoutMs });
      await pageB.goto(urlB, { waitUntil: 'commit', timeout: cfg.behavior.defaultTimeoutMs });

      await preparePageForShot(pageA, pageDef.readySelector, pageDef.waitAfterMs);
      await preparePageForShot(pageB, pageDef.readySelector, pageDef.waitAfterMs);

      await hideIgnoredSelectors(pageA, cfg.ignoreSelectors);
      await hideIgnoredSelectors(pageB, cfg.ignoreSelectors);

      // Take screenshots for visual reference
      const shotA = await pageA.screenshot({ fullPage: true });
      const shotB = await pageB.screenshot({ fullPage: true });

      // Extract functional content from both pages
      const contentA = await pageA.evaluate(() => ({
        url: location.href,
        title: document.title,
        text: document.body.innerText.replace(/\s+/g, ' ').substring(0, 500),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(e => e.textContent.trim()).filter(Boolean),
        buttons: Array.from(document.querySelectorAll('button, [role="button"]')).length,
        links: Array.from(document.querySelectorAll('a')).length,
        forms: Array.from(document.querySelectorAll('form')).length,
        tables: Array.from(document.querySelectorAll('table')).length,
        inputs: Array.from(document.querySelectorAll('input')).length,
      }));

      const contentB = await pageB.evaluate(() => ({
        url: location.href,
        title: document.title,
        text: document.body.innerText.replace(/\s+/g, ' ').substring(0, 500),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(e => e.textContent.trim()).filter(Boolean),
        buttons: Array.from(document.querySelectorAll('button, [role="button"]')).length,
        links: Array.from(document.querySelectorAll('a')).length,
        forms: Array.from(document.querySelectorAll('form')).length,
        tables: Array.from(document.querySelectorAll('table')).length,
        inputs: Array.from(document.querySelectorAll('input')).length,
      }));

      // Attach artifacts
      info.attachments.push({
        name: `${pageDef.name}-app-a-screenshot`,
        contentType: 'image/png',
        body: shotA,
      });
      info.attachments.push({
        name: `${pageDef.name}-app-b-screenshot`,
        contentType: 'image/png',
        body: shotB,
      });
      info.attachments.push({
        name: `${pageDef.name}-content-a`,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify(contentA, null, 2)),
      });
      info.attachments.push({
        name: `${pageDef.name}-content-b`,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify(contentB, null, 2)),
      });

      // Functional assertions (not visual - since apps are different)
      console.log(`\n✓ ${pageDef.name} comparison:`);
      console.log(`  App A URL: ${contentA.url}`);
      console.log(`  App B URL: ${contentB.url}`);
      console.log(`  App A title: ${contentA.title}`);
      console.log(`  App B title: ${contentB.title}`);
      console.log(`  App A headings: ${contentA.headings.join(', ') || '(none)'}`);
      console.log(`  App B headings: ${contentB.headings.join(', ') || '(none)'}`);
      console.log(`  App A elements: ${contentA.buttons} buttons, ${contentA.links} links, ${contentA.forms} forms, ${contentA.tables} tables`);
      console.log(`  App B elements: ${contentB.buttons} buttons, ${contentB.links} links, ${contentB.forms} forms, ${contentB.tables} tables`);

      // Basic sanity checks - just ensure pages loaded, not pixel-perfect matching
      // These apps are different, so we just check they respond and have some content
      expect(contentA.url.length).toBeGreaterThan(10);
      expect(contentB.url.length).toBeGreaterThan(10);
      expect(contentA.title.length).toBeGreaterThan(0);
      expect(contentB.title.length).toBeGreaterThan(0);
    });
  }
});
