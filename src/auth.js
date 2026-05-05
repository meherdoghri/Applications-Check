function isRetryableNavigationError(error) {
  const msg = String(error && error.message ? error.message : error || '');
  return (
    msg.includes('ERR_CONNECTION_TIMED_OUT') ||
    msg.includes('ERR_TIMED_OUT') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('Timeout')
  );
}

async function gotoWithRetry(page, url, timeout, retries) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout });
      return;
    } catch (error) {
      if (attempt === retries || !isRetryableNavigationError(error)) {
        throw error;
      }
      attempt += 1;
      await page.waitForTimeout(1000 * attempt);
    }
  }
}

async function login(page, appConfig, loginSelectors, options = {}) {
  const timeout = options.timeout || 30000;
  const retries = Number(options.retries || 2);

  await gotoWithRetry(page, appConfig.baseUrl, timeout, retries);

  const usernameInput = page.locator(loginSelectors.username).first();
  const loginFormVisible = await usernameInput
    .waitFor({ state: 'visible', timeout: Math.min(timeout, 5000) })
    .then(() => true)
    .catch(() => false);

  // Some environments are already authenticated through SSO and do not show a login form.
  if (!loginFormVisible) {
    return;
  }

  await usernameInput.fill(appConfig.username, { timeout });
  await page.locator(loginSelectors.password).first().fill(appConfig.password, { timeout });

  await Promise.all([
    page.waitForLoadState('networkidle', { timeout }).catch(() => null),
    page.locator(loginSelectors.submit).first().click({ timeout }),
  ]);

  if (loginSelectors.success) {
    await page.locator(loginSelectors.success).first().waitFor({ state: 'visible', timeout });
  }
}

module.exports = {
  login,
};
