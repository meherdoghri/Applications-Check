const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const { PNG } = require('pngjs');

function buildUrl(baseUrl, target) {
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  return new URL(target, baseUrl).toString();
}

async function hideIgnoredSelectors(page, selectors) {
  if (!selectors || selectors.length === 0) {
    return;
  }

  const css = selectors.map((s) => `${s} { visibility: hidden !important; }`).join('\n');
  await page.addStyleTag({ content: css }).catch(() => null);
}

async function preparePageForShot(page, readySelector, waitAfterMs) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => null);

  if (readySelector) {
    await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 30000 });
  }

  if (waitAfterMs > 0) {
    await page.waitForTimeout(waitAfterMs);
  }
}

function diffImages(imageBufferA, imageBufferB, options) {
  const imgA = PNG.sync.read(imageBufferA);
  const imgB = PNG.sync.read(imageBufferB);

  const width = Math.min(imgA.width, imgB.width);
  const height = Math.min(imgA.height, imgB.height);

  const croppedA = new PNG({ width, height });
  const croppedB = new PNG({ width, height });

  PNG.bitblt(imgA, croppedA, 0, 0, width, height, 0, 0);
  PNG.bitblt(imgB, croppedB, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });
  const mismatchCount = pixelmatch(croppedA.data, croppedB.data, diff.data, width, height, {
    threshold: options.threshold,
  });

  const totalPixels = width * height;
  const diffRatio = totalPixels === 0 ? 0 : mismatchCount / totalPixels;

  return {
    mismatchCount,
    totalPixels,
    diffRatio,
    width,
    height,
    diffPngBuffer: PNG.sync.write(diff),
  };
}

module.exports = {
  buildUrl,
  hideIgnoredSelectors,
  preparePageForShot,
  diffImages,
};
