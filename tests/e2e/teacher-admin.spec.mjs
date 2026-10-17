import {test, expect} from '@playwright/test';
import {renderTeacherAdmin} from '../helpers/teacher-admin-render.mjs';

test.use({browserName: process.env.CIM_PLAYER_BROWSER ?? 'chromium'});

test('production Admin disclosure is initially closed and keyboard reachable', async ({page}) => {
  await page.setContent(renderTeacherAdmin());
  const support = page.locator('details');
  const summary = support.locator('summary');
  await expect(page.getByLabel('Site motion policy')).not.toBeVisible();
  await page.getByRole('link', {name:'read its reason and troubleshoot'}).focus();
  await page.keyboard.press('Tab');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Site motion policy')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Site motion policy')).toBeFocused();
  await summary.focus(); await page.keyboard.press('Space');
  await expect(page.getByLabel('Site motion policy')).not.toBeVisible();
});
