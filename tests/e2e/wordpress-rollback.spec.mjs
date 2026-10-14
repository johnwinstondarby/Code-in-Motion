import {test,expect} from '@playwright/test';
const base=process.env.CIM_WP_BASE_URL??'http://localhost:8891';
test('RC2 rollback restores prior versioned modules and the captured legacy shortcode',async({page})=>{
  const urls=[];page.on('request',request=>urls.push(request.url()));
  await page.goto(base+'/?pagename=cim-e2e-r16&rollback-proof=1');
  const root=page.locator('.cim[data-cim-experience="synthetic-wordpress"]');
  await expect(root).toHaveAttribute('data-cim-state','ready');
  await expect(root.locator('[data-cim-renderer="synthetic/v1"]')).toHaveAttribute('data-node','A');
  expect(urls.some(url=>url.includes('/modules/0.1.10/wordpress/assets/bootstrap-module.mjs'))).toBe(true);
  expect(urls.some(url=>url.includes('/modules/0.2.0/'))).toBe(false);
  await expect(page.locator('.cim[data-cim-experience="git-repository-practice"]')).toHaveCount(0);
});
