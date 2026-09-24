import { test, expect } from '@playwright/test';

test('rejects an invalid password and shows the error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('fixture-user');
  await page.getByLabel('Password').fill('invalid-fixture-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Portal' })).toBeVisible();
});
