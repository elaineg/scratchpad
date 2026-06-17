import { test, expect } from '@playwright/test';

// Scratchpad smoke: page loads blank canvas, no H1 (zero-chrome design), no console errors.
test('landing page loads blank canvas with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const resp = await page.goto('/');
  expect(resp?.status()).toBe(200);
  // No header — zero chrome design. Editor container is present.
  await expect(page.locator('main')).toBeVisible();
  // Page title confirms it's scratchpad
  await expect(page).toHaveTitle('Scratchpad');
  expect(errors).toEqual([]);
});
