import { test, expect } from '@playwright/test';
const base=process.env.CIM_WP_BASE_URL??'http://localhost:8890';
test('installed companion pack mounts through the release plugin and keeps lesson text inert',async({page})=>{
 const root=page.locator('.cim[data-cim-experience="my-first-lesson"]');
 // After plugin replacement, allow PHP's opcode revalidation interval to elapse through real requests.
 await expect(async()=>{await page.goto(base+'/?pagename=cim-pack-proof&pack-proof='+Date.now());await expect(root).toHaveAttribute('data-cim-state','ready',{timeout:2000});}).toPass({timeout:15000});
 await expect(root).toHaveAttribute('data-cim-theme','light');
 if(process.env.CIM_PACK_EXPECT_TITLE) await expect(root.getByText(process.env.CIM_PACK_EXPECT_TITLE,{exact:true})).toBeVisible();
 await expect(root.locator('[data-cim-player="console-explanation"]')).toHaveCount(1);
 await root.getByRole('button',{name:'End',exact:true}).click();
 await expect(root.getByLabel('Lesson beat progress')).toContainText('3 / 3');
 await expect(root.getByRole('button',{name:'Copy command: count * 2',exact:true})).toBeVisible();
});

test('WordPress Admin lists healthy and rejected packs before a teacher opens a lesson page',async({page})=>{
 test.skip(process.env.CIM_PACK_ADMIN_CHECK!=='1','Fresh-install job supplies the deliberately invalid companion fixture.');
 await page.goto(base+'/wp-login.php');await page.locator('#user_login').fill('admin');await page.locator('#user_pass').fill('password');await page.locator('#wp-submit').click();
 await page.goto(base+'/wp-admin/admin.php?page=code-in-motion');
 const good=page.locator('[data-cim-pack-lesson="my-first-lesson"]'),bad=page.locator('[data-cim-pack-lesson="invalid-lesson"]');
 await expect(good.locator('[data-cim-pack-status]')).toHaveText('Ready');await expect(bad.locator('[data-cim-pack-status]')).toHaveText('Rejected');await expect(bad.locator('[data-cim-pack-reason]')).toContainText('CIM-EXP');await expect(bad.locator('[data-cim-pack-shortcode]')).toContainText('Unavailable');await expect(good.locator('[data-cim-pack-shortcode]')).toContainText('[cim experience=');
});
