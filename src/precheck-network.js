const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getConfig } = require('./env');

function requestOnce(targetUrl, timeoutMs) {
  return new Promise((resolve) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        resolve({
          ok: true,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
        });
        res.resume();
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });

    req.on('error', (error) => {
      resolve({
        ok: false,
        error: error.message,
        code: error.code || 'UNKNOWN',
      });
    });

    req.end();
  });
}

async function checkUrl(label, targetUrl, timeoutMs) {
  const maxAttempts = 3;
  const start = Date.now();
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Retry network checks to absorb transient VPN/proxy instability.
    lastResult = await requestOnce(targetUrl, timeoutMs);
    if (lastResult.ok) {
      break;
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }

  const durationMs = Date.now() - start;

  if (!lastResult || !lastResult.ok) {
    return {
      label,
      url: targetUrl,
      reachable: false,
      durationMs,
      detail: `${lastResult.code}: ${lastResult.error}`,
    };
  }

  return {
    label,
    url: targetUrl,
    reachable: true,
    durationMs,
    detail: `HTTP ${lastResult.statusCode} ${lastResult.statusMessage || ''}`.trim(),
  };
}

async function run() {
  const cfg = getConfig();
  const timeoutMs = Math.max(cfg.behavior.defaultTimeoutMs, 5000);

  const checks = await Promise.all([
    checkUrl('App A', cfg.appA.baseUrl, timeoutMs),
    checkUrl('App B', cfg.appB.baseUrl, timeoutMs),
  ]);

  console.log('Network precheck results:');
  for (const c of checks) {
    console.log(`- ${c.label}`);
    console.log(`  URL: ${c.url}`);
    console.log(`  Reachable: ${c.reachable ? 'YES' : 'NO'}`);
    console.log(`  Detail: ${c.detail}`);
    console.log(`  Duration: ${c.durationMs}ms`);
  }

  const failed = checks.filter((c) => !c.reachable);
  if (failed.length > 0) {
    console.error('\nPrecheck failed: one or more target URLs are unreachable.');
    console.error('Tips: connect VPN, verify proxy/firewall, and retry.');
    process.exit(1);
  }

  console.log('\nPrecheck passed: both apps are reachable.');
}

run().catch((error) => {
  console.error('Unexpected precheck error:', error.message);
  process.exit(1);
});
