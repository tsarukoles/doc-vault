import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';

test('login page accepts a sample username', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.submit('example-user');
  await expect(page.getByText('Welcome')).toBeVisible();
});
