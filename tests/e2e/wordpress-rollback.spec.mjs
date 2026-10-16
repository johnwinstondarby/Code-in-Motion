import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const candidateVersion=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version;
const base=process.env.CIM_WP_BASE_URL??'http://localhost:8891';
test('release rollback restores exact live 0.2.4 modules and the captured v2 lesson shortcode',async({page})=>{
  const urls=[];page.on('request',request=>urls.push(request.url()));
  await page.goto(base+'/?pagename=cim-e2e-r16&rollback-proof=1');
  const root=page.locator('.cim[data-cim-experience="git-repository-practice"]');
  await expect(root).toHaveAttribute('data-cim-state','ready');
  await expect(root.locator('[data-cim-player="console-explanation"]')).toHaveCount(1);
  expect(urls.some(url=>url.includes('/modules/0.2.4/wordpress/assets/bootstrap-module.mjs'))).toBe(true);
  expect(urls.some(url=>url.includes('/modules/'+candidateVersion+'/'))).toBe(false);
});
