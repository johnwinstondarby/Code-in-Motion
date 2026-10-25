import {test,expect} from '@playwright/test';
// Runs against the installed release ZIP in CI. CIM_PANES_EXPECT selects the site state the workflow prepared.
const base=process.env.CIM_WP_BASE_URL??'http://localhost:8890';
const expectation=process.env.CIM_PANES_EXPECT;
const openProof=async page=>{
 // After wp-config or plugin changes, allow PHP's opcode revalidation to catch up through real requests.
 await page.goto(base+'/?pagename=cim-panes-proof&proof='+Date.now());
};
const login=async page=>{await page.goto(base+'/wp-login.php');await page.locator('#user_login').fill('admin');await page.locator('#user_pass').fill('password');await page.locator('#wp-submit').click();};

test('[PC-WP-01] a released host refuses the v2 placeholder pack and keeps its fallback',async({page})=>{
 test.skip(expectation!=='refused','The workflow prepares the refusal state first.');
 const root=page.locator('.cim[data-cim-experience="run-custody-placeholder"]');
 await openProof(page);
 await expect(root).not.toHaveAttribute('data-cim-pack-agreement','cim.lesson-pack/v2');
 await expect(root.locator('.cim-fallback')).toContainText('Panes fallback.');
 await expect(root).not.toHaveAttribute('data-cim-state','ready');
 await login(page);await page.goto(base+'/wp-admin/admin.php?page=code-in-motion');
 await expect(page.locator('[data-cim-development-admission-notice]')).toHaveCount(0);
 await expect(page.locator('tr[data-cim-pack-index]').filter({hasText:'run-custody-placeholder'}).locator('[data-cim-pack-reason]')).toContainText('1.1.0');
});

test('[PC-WP-02] development admission mounts the composed Player from the installed pack',async({page})=>{
 test.skip(expectation!=='admitted','The workflow sets the development constant for this state.');
 const root=page.locator('.cim[data-cim-experience="run-custody-placeholder"]');
 await expect(async()=>{await openProof(page);await expect(root).toHaveAttribute('data-cim-state','ready',{timeout:4000});}).toPass({timeout:20000});
 await expect(root).toHaveAttribute('data-cim-pack-agreement','cim.lesson-pack/v2');
 await expect(root.locator('[data-composed-player]')).toHaveCount(1);
 await expect(root).toContainText('Placeholder content');
 await expect(root).toContainText('Start · 8 beats');
 await page.goto(base+'/?pagename=cim-panes-proof&proof='+Date.now()+'#cim/run-custody-placeholder/submit-fail');
 await expect(root).toContainText('Beat 3 / 8');
 await root.getByRole('tab',{name:'Motion – GUI'}).click();
 await expect(root.locator('.motion-pane')).toContainText('GUI recording unavailable');
 await expect(root).not.toContainText('Recorded in the lab');
});

test('[PC-WP-03] Admin shows the development notice and checks the v2 lesson with the Player boundary',async({page})=>{
 test.skip(expectation!=='admitted','The workflow sets the development constant for this state.');
 await login(page);await page.goto(base+'/wp-admin/admin.php?page=code-in-motion');
 await expect(page.locator('[data-cim-development-admission-notice]')).toContainText('Development admission is on');
 const row=page.locator('[data-cim-pack-lesson="run-custody-placeholder"]');
 await expect(row.locator('[data-cim-pack-status]')).toHaveText('Ready');
 await expect(row.locator('[data-cim-pack-shortcode]')).toHaveText('[cim experience="run-custody-placeholder"]');
});
