// Acessibilidade automática (axe-core): nenhuma violação “serious” ou “critical”.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const graves = (r: Awaited<ReturnType<AxeBuilder['analyze']>>) =>
  r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help} (${v.nodes.length}× · ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')})`);

// /clube/#cadastro: a etapa 2 da página do Clube (a ficha), aberta direto pela URL (2026-10-23)
for (const url of ['/', '/reservar/', '/privacidade/', '/clube/', '/clube/#cadastro', '/clube/ativar/', '/clube/entrar/', '/clube/cadastro/', '/clube/conta/', '/clube/historico/', '/clube/recompensas/']) {
  test(`axe ${url}`, async ({ page }) => {
    await page.goto(url);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 600) await page.evaluate((yy) => scrollTo(0, yy), y);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    test.info().annotations.push({ type: 'axe', description: `${r.violations.length} violações (${graves(r).length} graves) · ${r.passes.length} regras ok` });
    expect(graves(r)).toEqual([]);
  });
}

test('axe com o menu aberto', async ({ page }) => {
  await page.goto('/');
  await page.locator('.menu-btn--hero').click();
  await expect(page.locator('dialog#menu')).toBeVisible();
  const r = await new AxeBuilder({ page }).include('dialog#menu').analyze();
  expect(graves(r)).toEqual([]);
});

test('imagens com texto alternativo e dimensões declaradas (sem salto de layout)', async ({ page }) => {
  await page.goto('/');
  const ruins = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.hasAttribute('alt') || !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.outerHTML.slice(0, 80)));
  expect(ruins).toEqual([]);
});
