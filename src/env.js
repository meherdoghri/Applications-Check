const dotenv = require('dotenv');

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

function parseBool(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }
  return String(value).toLowerCase() === 'true';
}

function parsePages() {
  const raw = required('COMPARE_PAGES_JSON');
  let pages;
  try {
    pages = JSON.parse(raw);
  } catch (error) {
    throw new Error(`COMPARE_PAGES_JSON must be valid JSON: ${error.message}`);
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('COMPARE_PAGES_JSON must be a non-empty JSON array.');
  }

  return pages.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`COMPARE_PAGES_JSON[${index}] must be an object.`);
    }

    const name = item.name || `page-${index + 1}`;
    const commonTarget = item.path || item.url;
    const targetA = item.pathA || item.urlA || commonTarget;
    const targetB = item.pathB || item.urlB || commonTarget;

    if (!targetA || typeof targetA !== 'string') {
      throw new Error(
        `COMPARE_PAGES_JSON[${index}] must define "pathA"/"urlA" or shared "path"/"url".`
      );
    }

    if (!targetB || typeof targetB !== 'string') {
      throw new Error(
        `COMPARE_PAGES_JSON[${index}] must define "pathB"/"urlB" or shared "path"/"url".`
      );
    }

    return {
      name,
      targetA,
      targetB,
      readySelector: item.readySelector,
      waitAfterMs: Number(item.waitAfterMs || 0),
    };
  });
}

function parseIgnoreSelectors() {
  const raw = process.env.IGNORE_SELECTORS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getConfig() {
  return {
    appA: {
      baseUrl: required('APP_A_BASE_URL'),
      username: required('APP_A_USERNAME'),
      password: required('APP_A_PASSWORD'),
    },
    appB: {
      baseUrl: required('APP_B_BASE_URL'),
      username: required('APP_B_USERNAME'),
      password: required('APP_B_PASSWORD'),
    },
    loginSelectors: {
      username: required('LOGIN_USERNAME_SELECTOR'),
      password: required('LOGIN_PASSWORD_SELECTOR'),
      submit: required('LOGIN_SUBMIT_SELECTOR'),
      success: process.env.LOGIN_SUCCESS_SELECTOR || '',
    },
    pages: parsePages(),
    ignoreSelectors: parseIgnoreSelectors(),
    visual: {
      maxDiffRatio: Number(process.env.VISUAL_MAX_DIFF_RATIO || 0.01),
      threshold: Number(process.env.VISUAL_THRESHOLD || 0.2),
    },
    behavior: {
      headless: parseBool(process.env.HEADLESS, true),
      defaultTimeoutMs: Number(process.env.DEFAULT_TIMEOUT_MS || 30000),
    },
  };
}

module.exports = {
  getConfig,
};
