---
name: erix-webapp-testing
description: >
  Test and debug ERIX / ECODrIx web apps in a real browser with Playwright
  (TypeScript): smoke tests, end-to-end flows (login, lead create, WhatsApp
  send, Razorpay checkout in test mode), screenshots at mobile and desktop,
  console and network errors, accessibility checks, and visual review of UI
  changes. Use whenever the user asks to test, verify, reproduce a UI bug,
  screenshot, or "check if the dashboard works" for a local or staging app.
---

# erix-webapp-testing

Prove the UI works the way a user would use it. Never against production data.

## Environment rules (risk controls)

- Targets: `localhost` or staging only. Refuse prod URLs for write flows; read-only smoke on prod needs explicit OK.
- Data: seeded test tenant (`org: qa-test`), synthetic leads and phones (`+91 90000 0000x`). Never real client records.
- Payments: Razorpay **test mode** keys only. Assert key prefix `rzp_test_` before running checkout tests.
- WhatsApp/SMS/email: sandbox numbers or a mock provider. Never send to real contacts from tests.
- Secrets from env (`E2E_USER`, `E2E_PASS`), never in test files or screenshots.

## Setup

```bash
npm i -D @playwright/test @axe-core/playwright
npx playwright install chromium
```

`playwright.config.ts` essentials:
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'en-IN', timezoneId: 'Asia/Kolkata' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 5'], storageState: 'e2e/.auth/user.json' }, dependencies: ['setup'] },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' }, dependencies: ['setup'] },
  ],
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
});
```
Add `e2e/.auth/` to `.gitignore`.

## Workflow: recon, then act

1. Load page, wait for real readiness (a key element visible, not arbitrary timeouts).
2. Screenshot + list roles/labels to find selectors.
3. Use user-facing locators: `getByRole`, `getByLabel`, `getByText`. Add `data-testid` only where no accessible name exists.
4. Act, assert visible outcomes, not implementation details.

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('create lead from CRM', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('response', r => r.status() >= 500 && errors.push(`${r.status()} ${r.url()}`));

  await page.goto('/crm/leads');
  await page.getByRole('button', { name: 'Add lead' }).click();
  await page.getByLabel('Full name').fill('QA Test Clinic');
  await page.getByLabel('Phone').fill('+91 90000 00001');
  await page.getByRole('button', { name: 'Save lead' }).click();

  await expect(page.getByText('Lead saved')).toBeVisible();
  await expect(page.getByRole('row', { name: /QA Test Clinic/ })).toBeVisible();
  expect(errors).toEqual([]);

  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations).toEqual([]);
});
```

## What every flow test checks

- Visible success state + data actually persisted (reload and re-check).
- No console errors, no 5xx responses.
- INR shown as `₹` with Indian grouping; dates `dd/mm/yyyy` or `17 Oct 2026`; IST times.
- Works on `mobile` project (360-412 px). Nothing overflows horizontally.
- Keyboard: primary action reachable via Tab, focus visible.
- Empty, error, and loading states render (mock with `page.route`).

## Debug a UI bug

1. Reproduce with a minimal test first. It must fail.
2. `npx playwright test --trace on` → `npx playwright show-trace` to inspect DOM, network, console at failure.
3. Fix at the narrowest layer (see `caveman-workflows` surgical-patch). Test must pass; keep it as regression.

## Visual review of a UI change

Screenshot affected pages at 360 px and 1280 px before and after. Review against `erix-ui` craft rules. Only add `toHaveScreenshot()` baselines for stable, high-value screens; they are noisy elsewhere.

## Run

```bash
npx playwright test                    # all
npx playwright test --project=mobile   # mobile only
npx playwright test e2e/crm --headed   # watch it
```
CI: run on every PR against preview/staging; upload traces on failure.

---
Adapted from anthropics/skills `webapp-testing` (Apache-2.0): TypeScript + Playwright Test for the ECODrIx stack.
