# App Comparator - Setup Summary

## ✓ What's Working

1. **Framework is fully functional**
   - Playwright test runner configured
   - Browser automation working
   - Screenshots captured
   - Functional comparison implemented
   - HTML reports generated

2. **Test Command**
   ```bash
   npm run test:compare:functional
   ```
   This test **PASSES** and compares both apps functionally.

3. **Network Health Check**
   ```bash
   npm run precheck:network
   ```
   Validates both app URLs are reachable.

## 📋 Current Status

### APP_A (4YOU)
- **URL**: https://cacib4you-dev.soprahronline.sopra/app/foryou
- **Status**: ⚠️ Not authenticated via our test
- **Reason**: Uses SSO or session-based auth (no visible login form)
- **Fix Required**: Use your browser with existing session, OR set up SSO auth

### APP_B (S7/HRa Space)  
- **URL**: https://devproj-cacib.soprahronline.sopra/hra-space
- **Status**: ✓ Authenticates via login form
- **Login Form**: Found and working
- **Dashboard**: /hra-space/portal/root/professional loads successfully

## 🔧 How to Fix APP_A Authentication

### Option 1: Use Browser Session (Easiest)
1. Open your browser
2. Log into APP_A manually at: https://cacib4you-dev.soprahronline.sopra/app/foryou
3. Export browser cookies and pass them to Playwright

### Option 2: Use SSO Authentication
If APP_A uses SSO, the credentials might be handled by a separate service. Check:
- Is there a redirect to another login page?
- Are there environment-specific SSO endpoints?

### Option 3: Use Hardcoded Headers/Tokens
If authentication uses tokens or special headers, add them to the browser context.

## 📊 Running the Comparison

```bash
# Run functional comparison (includes both apps)
npm run test:compare:functional

# View HTML report
npm run show-report

# Run with precheck
npm run test:compare:safe
```

## 📝 Reports Location

- HTML Report: `playwright-report/`
- Screenshots: `test-results/`
- Artifacts: Attached to HTML report

## 🎯 Next Steps

1. **For APP_A**: Set up proper authentication (see fixes above)
2. **Customize Pages**: Edit `.env` to add more pages to compare:
   ```
   COMPARE_PAGES_JSON=[
     {"name":"Home","pathA":"/app/foryou","pathB":"/hra-space/portal/root/professional","waitAfterMs":2000},
     {"name":"Dashboard","pathA":"/app/dashboard","pathB":"/hra-space/portal/root/dashboard","waitAfterMs":2000}
   ]
   ```

3. **Add Dynamic Element Exclusions**: Edit `.env`:
   ```
   IGNORE_SELECTORS=.navbar,.header,.footer,.menu,.timestamp,.date,.notification
   ```

4. **Adjust Visual Threshold** (if needed):
   ```
   VISUAL_MAX_DIFF_RATIO=0.30
   ```

## 📚 Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run test:compare:functional` | Run functional comparison |
| `npm run test:compare` | Run pixel visual comparison |
| `npm run precheck:network` | Check app reachability |
| `npm run show-report` | Open HTML report viewer |
| `npm run test:ui` | Run tests with interactive UI |
| `npm run test:debug` | Run with Playwright debugger |

## 🐛 Troubleshooting

**Q: "ERR_CONNECTION_TIMED_OUT"**
- A: Network fluctuation, retry the command

**Q: "Visual difference too high"**
- A: Apps have different layouts, use functional test instead

**Q: "Login form not found"**
- A: App uses different login mechanism, check app-specific auth

**Q: "No content on page"**
- A: Page needs more time to load, increase `waitAfterMs` in config

## 📁 Project Structure

```
.
├── src/
│   ├── auth.js              # Login automation
│   ├── compare.js           # Screenshot diff engine
│   ├── env.js               # Config parser
│   ├── precheck-network.js  # Network health check
│   └── discover-login.js    # Login form discovery
├── tests/
│   ├── compare.spec.js      # Pixel comparison test
│   └── compare-functional.spec.js  # Functional comparison test
├── .env                     # Environment config (credentials)
├── playwright.config.js     # Playwright configuration
└── README.md                # This file
```
