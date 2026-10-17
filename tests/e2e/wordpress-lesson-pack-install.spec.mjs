import { test, expect } from '@playwright/test';
const base=process.env.CIM_WP_BASE_URL??'http://localhost:8890';
test('installed companion pack mounts through the release plugin and keeps lesson text inert',async({page})=>{
 await page.goto(base+'/?pagename=cim-pack-proof');
 const root=page.locator('.cim[data-cim-experience="my-first-lesson"]');
 await expect(root).toHaveAttribute('data-cim-state','ready');
 await expect(root).toHaveAttribute('data-cim-theme','light');
 if(process.env.CIM_PACK_EXPECT_TITLE) await expect(root.getByText(process.env.CIM_PACK_EXPECT_TITLE,{exact:true})).toBeVisible();
 await expect(root.locator('[data-cim-player="console-explanation"]')).toHaveCount(1);
 await root.getByRole('button',{name:'End',exact:true}).click();
 await expect(root.getByLabel('Lesson beat progress')).toContainText('3 / 3');
 await expect(root.getByRole('button',{name:'Copy command: count * 2',exact:true})).toBeVisible();
});
