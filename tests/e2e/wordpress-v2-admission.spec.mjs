import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const lesson=JSON.parse(readFileSync(new URL('../../experiences/git/git-repository-practice.json',import.meta.url),'utf8'));

const base=process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';
test.use({colorScheme:'dark',reducedMotion:'reduce'});

test('registered WordPress v2 lesson presents full Player consumers while legacy remains isolated',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const requests=[];page.on('request',request=>requests.push(request.url()));
  await page.goto(base+'/?pagename=cim-e2e-v2');
  const root=page.locator('[data-cim-instance="admission-v2"]');
  const legacy=page.locator('[data-cim-instance="admission-legacy"]');
  await expect(root).toHaveAttribute('data-cim-state','ready');
  await expect(legacy).toHaveAttribute('data-cim-state','ready');
  expect(requests.some(url=>url.includes('/src/contracts/engine-identity.mjs'))).toBe(true);
  await expect(root.getByLabel('Theme',{exact:true})).toBeVisible();
  await expect(legacy.getByLabel('Theme',{exact:true})).toHaveCount(0);
  await expect(root.locator('[data-cim-cli="bash"]')).toHaveText('Bash');
  await expect(legacy.locator('[data-cim-cli]')).toHaveCount(0);
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s02');
  await root.locator('[data-role="copy"]').first().click();
  await expect(root.locator('[data-cim-copy-status]')).toHaveText('Copied command: git status');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('git status');
  await root.locator('[data-cim-commentary-entry] button').first().click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s01');
  await expect(root.locator('[data-role="command-line"][data-cim-line-limn="steady"]')).toHaveCount(1);
  await expect(legacy.locator('[data-cim-line-limn]')).toHaveCount(0);
  await expect(root.locator('[data-cim-line-limn] [data-role="prompt"]')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(root.locator('[data-cim-line-limn]')).toHaveCSS('border-left-width','6px');
  expect(requests.some(url=>url.endsWith('/wordpress/assets/console-line-limn.mjs'))).toBe(true);
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s02');
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','stage-hunk--s04');
  await root.locator('[data-cim-commentary-anchor="response"] button').first().click();
  await expect(root.locator('[data-cim-line-limn="steady"] [data-role="response"]')).toHaveText('y');
  await root.locator('[data-cim-control="end"]').click();
  const indentedOutput = root.locator('[data-role="output-line"]').filter({hasText:'to discard changes in working directory'}).first();
  await expect.poll(()=>indentedOutput.evaluate(node=>node.style.getPropertyValue('--cim-continuation-indent'))).toBe('4ch');
  expect(requests.some(url=>url.endsWith('/wordpress/assets/console-wrap-binding.mjs'))).toBe(true);
  await expect(root.locator('[data-cim-commentary-entry]:visible')).toHaveCount(18);
  await expect(root.locator('[data-cim-commentary-evidence-label]')).toHaveCount(0);
  await expect(root).not.toContainText(/Related (output|response): \d+ lines?/);
  await expect(root.locator('[data-cim-commentary-risk]:visible')).toHaveCount(lesson.steps.filter(step=>step.commentary.risk).length);
  await expect(root.locator('[data-cim-risk-guidance]').last()).toBeVisible();
  await root.getByLabel('Theme',{exact:true}).selectOption('light');
  await expect(root.locator('[data-cim-pane="console"]')).toHaveCSS('background-color','rgb(246, 248, 251)');
  await page.evaluate(()=>{location.hash='#cim/git-repository-practice/stage-hunk';});
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','stage-hunk--s04');
});

test('WordPress v2 engine rejection preserves static fallback and healthy legacy sibling',async({page})=>{
  const errors=[];page.on('console',async message=>{if(message.type()==='error') errors.push(...await Promise.all(message.args().map(argument=>argument.jsonValue().catch(()=>null))));});
  await page.route('**/wordpress/experiences/git-repository-practice.json*',async route=>{
    const response=await route.fetch();const lesson=await response.json();lesson.engine_min='1.0.2';
    await route.fulfill({response,json:lesson});
  });
  await page.goto(base+'/?pagename=cim-e2e-v2');
  const root=page.locator('[data-cim-instance="admission-v2"]');
  await expect(root).toHaveAttribute('data-cim-state','fallback');
  await expect(root.locator('[data-cim-player]')).toHaveCount(0);
  await expect(root.locator('[data-cim-renderer-root] > *')).toHaveCount(0);
  await expect(root.locator('.cim-fallback')).toBeVisible();
  await expect(page.locator('[data-cim-instance="admission-legacy"]')).toHaveAttribute('data-cim-state','ready');
  await expect.poll(()=>errors.some(record=>record?.code==='CIM-EXP-015')).toBe(true);
});


test('WordPress installed v2 playback stops for reading and resumes at the next beat',async({page})=>{
  await page.goto(base+'/?pagename=cim-e2e-v2');
  const root=page.locator('[data-cim-instance="admission-v2"]');
  await expect(root).toHaveAttribute('data-cim-state','ready');
  const play=root.locator('[data-cim-control="playback"]');
  const current=root.locator('[data-cim-commentary-entry][aria-current="step"]');
  for(const id of ['check-status--s02','stage-hunk--s04']) {
    await play.click();
    await expect(current).toHaveAttribute('data-cim-step-id',id,{timeout:15000});
    await expect(play).toHaveText('Play');
    await page.waitForTimeout(1200);
    await expect(current).toHaveAttribute('data-cim-step-id',id);
  }
  const order=await root.evaluate(node=>{
    const controls=node.querySelector('[data-cim-transport-controls]');
    const player=node.querySelector('[data-cim-player]');
    return Boolean(controls.compareDocumentPosition(player)&Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
});
