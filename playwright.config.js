const { defineConfig } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

const defaultTimeout = Number(process.env.DEFAULT_TIMEOUT_MS || 30000);
const headless = (process.env.HEADLESS || 'true').toLowerCase() === 'true';
const browserChannel = process.env.BROWSER_CHANNEL || '';
const viewportWidth = Number(process.env.VIEWPORT_WIDTH || 1440);
const viewportHeight = Number(process.env.VIEWPORT_HEIGHT || 900);

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    browserName: 'chromium',
    channel: browserChannel || undefined,
    headless,
    viewport: { width: viewportWidth, height: viewportHeight },
    actionTimeout: defaultTimeout,
    navigationTimeout: defaultTimeout,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
});
