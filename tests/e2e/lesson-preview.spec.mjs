import {test,expect} from '@playwright/test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startLessonPreview} from '../../tools/lesson-preview-server.mjs';
test.use({browserName:process.env.CIM_PLAYER_BROWSER??'chromium',viewport:{width:1410,height:900}});
let work,file,server,url;
test.beforeAll(async()=>{work=await mkdtemp(resolve('../v1-preview-e2e-'));file=resolve(work,'lesson.json');await writeFile(file,await readFile('experiences/starter/python-first-steps.authoring.json'));({server,url}=await startLessonPreview(file));});
test.afterAll(async()=>{await new Promise(done=>server.close(done));await rm(work,{recursive:true,force:true});});
test('local Player preview shows saved edits without a build or WordPress installation',async({page})=>{
 await page.goto(url);const root=page.locator('.cim');await expect(root).toHaveAttribute('data-cim-state','ready');await root.getByRole('button',{name:'End',exact:true}).click();await expect(root.getByRole('button',{name:'Copy command: count * 2',exact:true})).toBeVisible();
 const doc=JSON.parse(await readFile(file));doc.title='A typo fixed locally';doc.beats[2].console.command='count * 3';await writeFile(file,JSON.stringify(doc));await page.reload();await expect(root).toHaveAttribute('data-cim-state','ready');await expect(root.getByText(doc.title,{exact:true})).toBeVisible();await root.getByRole('button',{name:'End',exact:true}).click();await expect(root.getByRole('button',{name:'Copy command: count * 3',exact:true})).toBeVisible();
 await writeFile(file,'{');await page.reload();await expect(page.locator('#preview-error')).not.toBeEmpty();await expect(root).toHaveAttribute('data-cim-state','fallback');await expect(root.locator('[data-cim-player]')).toHaveCount(0);
});
