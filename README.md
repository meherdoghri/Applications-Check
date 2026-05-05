# App Comparator (Playwright)

Automated visual comparator for two web applications with the same functional scope.

## What this project does

- Logs into App A and App B automatically.
- Navigates to the same configured pages in both apps.
- Captures screenshots for both sides.
- Computes pixel-level difference ratio.
- Fails the test when difference ratio is above threshold.
- Produces HTML report with screenshots and diff artifacts.

## Setup

1. Install dependencies:

```bash
npm install
npx playwright install chromium
```

2. Create `.env` from `.env.example` and fill values.

3. Update `COMPARE_PAGES_JSON` with your pages.

## Run

```bash
npm run test:compare
```

Recommended (includes network precheck first):

```bash
npm run test:compare:safe
```

Open the report:

```bash
npm run show-report
```

Run precheck only:

```bash
npm run precheck:network
```

## Environment variables

See `.env.example` for all options.

Key variables:

- `APP_A_BASE_URL`, `APP_A_USERNAME`, `APP_A_PASSWORD`
- `APP_B_BASE_URL`, `APP_B_USERNAME`, `APP_B_PASSWORD`
- `LOGIN_USERNAME_SELECTOR`, `LOGIN_PASSWORD_SELECTOR`, `LOGIN_SUBMIT_SELECTOR`
- `COMPARE_PAGES_JSON`
- `VISUAL_MAX_DIFF_RATIO`
- `IGNORE_SELECTORS`

## Notes for reliability

- Prefer stable selectors (`data-testid`) for login and page readiness.
- Add dynamic elements (dates, clocks, random ids) to `IGNORE_SELECTORS`.
- Start with a small page set, then extend progressively.
