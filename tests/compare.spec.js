const base = require('@playwright/test');
const { expect } = base;
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../src/env');
const { login } = require('../src/auth');
const {
  buildUrl,
  hideIgnoredSelectors,
  preparePageForShot,
  diffImages,
} = require('../src/compare');

const cfg = getConfig();
const appAStorageStatePath = path.resolve(__dirname, '../auth/4you.json');
const hasAppAStorageState = fs.existsSync(appAStorageStatePath);

const test = base.test.extend({
  loggedPages: async ({ browser }, use) => {
    const contextA = await browser.newContext({
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

test.describe('App A vs App B visual comparator', () => {
  for (const pageDef of cfg.pages) {
    test(`compare: ${pageDef.name}`, async ({ loggedPages }) => {
      const info = test.info();
      const { pageA, pageB } = loggedPages;

      const urlA = buildUrl(cfg.appA.baseUrl, pageDef.targetA);
      const urlB = buildUrl(cfg.appB.baseUrl, pageDef.targetB);

      await pageA.goto(urlA, { waitUntil: 'commit', timeout: cfg.behavior.defaultTimeoutMs });
      await pageB.goto(urlB, { waitUntil: 'commit', timeout: cfg.behavior.defaultTimeoutMs });

      await preparePageForShot(pageA, pageDef.readySelector, pageDef.waitAfterMs);
      await preparePageForShot(pageB, pageDef.readySelector, pageDef.waitAfterMs);

      await hideIgnoredSelectors(pageA, cfg.ignoreSelectors);
      await hideIgnoredSelectors(pageB, cfg.ignoreSelectors);

      const shotA = await pageA.screenshot({ fullPage: true });
      const shotB = await pageB.screenshot({ fullPage: true });

      const diff = diffImages(shotA, shotB, {
        threshold: cfg.visual.threshold,
      });

      info.attachments.push({
        name: `${pageDef.name}-app-a`,
        contentType: 'image/png',
        body: shotA,
      });
      info.attachments.push({
        name: `${pageDef.name}-app-b`,
        contentType: 'image/png',
        body: shotB,
      });
      info.attachments.push({
        name: `${pageDef.name}-diff`,
        contentType: 'image/png',
        body: diff.diffPngBuffer,
      });
      info.attachments.push({
        name: `${pageDef.name}-metrics`,
        contentType: 'application/json',
        body: Buffer.from(
          JSON.stringify(
            {
              urlA,
              urlB,
              mismatchCount: diff.mismatchCount,
              totalPixels: diff.totalPixels,
              diffRatio: Number(diff.diffRatio.toFixed(6)),
              width: diff.width,
              height: diff.height,
              threshold: cfg.visual.threshold,
              maxDiffRatio: cfg.visual.maxDiffRatio,
            },
            null,
            2
          )
        ),
      });

      expect(
        diff.diffRatio,
        `Visual difference too high for ${pageDef.name}. Found ${(diff.diffRatio * 100).toFixed(2)}%, max allowed ${(cfg.visual.maxDiffRatio * 100).toFixed(2)}%.`
      ).toBeLessThanOrEqual(cfg.visual.maxDiffRatio);
    });
  }
});
