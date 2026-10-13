import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const lesson=JSON.parse(readFileSync(new URL('../../experiences/git/git-repository-practice.json',import.meta.url),'utf8'));

const base=process.env.CIM_WP_BASE_URL ?? 'http://127.0.0.1:8888';
test.use({colorScheme:'dark',reducedMotion:'reduce'});

test('registered WordPress v2 lesson presents full Player consumers while legacy remains isolated',async({page})=>{
  const requests=[];page.on('request',request=>requests.push(request.url()));
  await page.goto(base+'/?pagename=cim-e2e-v2');
  const root=page.locator('[data-cim-instance="admission-v2"]');
  const legacy=page.locator('[data-cim-instance="admission-legacy"]');
  await expect(root).toHaveAttribute('data-cim-state','ready');
  await expect(legacy).toHaveAttribute('data-cim-state','ready');
  expect(requests.some(url=>url.includes('/src/contracts/engine-identity.mjs'))).toBe(true);
  await expect(root.getByLabel('Theme',{exact:true})).toBeVisible();
  await expect(legacy.getByLabel('Theme',{exact:true})).toHaveCount(0);
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s02');
  await root.locator('[data-cim-commentary-entry] button').first().click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s01');
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','check-status--s02');
  await root.locator('[data-cim-control="next"]').click();
  await expect(root.locator('[data-cim-commentary-entry][aria-current="step"]')).toHaveAttribute('data-cim-step-id','stage-hunk--s04');
  await root.locator('[data-cim-control="end"]').click();
  await expect(root.locator('[data-cim-commentary-entry]:visible')).toHaveCount(18);
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
    const response=await route.fetch();const lesson=await response.json();lesson.engine_min='1.0.1';
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
