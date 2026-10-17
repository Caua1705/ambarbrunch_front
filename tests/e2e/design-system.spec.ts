// Página interna /design-system/ (build de revisão): carrega sem erros, lê os tokens reais e as demonstrações funcionam.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('design system · página interna', () => {
  test.beforeEach(async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    (page as unknown as { erros: string[] }).erros = erros;
    await page.goto('/design-system/');
  });

  test('valores lidos do CSS real, sem erros e sem rolagem lateral', async ({ page }) => {
    await expect(page.locator('[data-cor="--wine"]').first()).toContainText('#670D27');
    await expect(page.locator('[data-contraste="--wine|--cream"] [data-razao]')).toContainText('AAA');
    await expect(page.locator('[data-largura]').first()).toContainText('390 px · mobile');
    await expect(page.locator('[data-bp="(max-width: 599px)"]')).toHaveAttribute('data-ativo', '');
    const tipo = page.locator('.ds-tipo', { has: page.locator('code', { hasText: /^--t-mega$/ }) }).locator('[data-medida]');
    await expect(tipo).toContainText('97.5 px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    expect((page as unknown as { erros: string[] }).erros).toEqual([]);
  });

  test('estados da comanda: abas e ilhas reais (simulação sinalizada)', async ({ page }) => {
    await page.locator('#reserva').scrollIntoViewIfNeeded();
    await page.getByRole('tab', { name: 'Confirmada' }).click();
    const painel = page.locator('#painel-confirmada');
    await expect(painel).toBeVisible();
    await expect(painel.locator('.ticket__title')).toHaveText('Reserva simulada');
    await expect(painel.locator('.ticket__sim')).toBeVisible();
    await expect(page.locator('#painel-indisponivel')).toBeHidden();
    await page.getByRole('tab', { name: 'Validação' }).click();
    await expect(page.locator('#painel-validacao .field[data-invalid]')).toHaveCount(2);
  });

  test('rever animação e simular movimento reduzido usam as regras reais', async ({ page }) => {
    // o projeto roda com movimento reduzido; aqui o sistema NÃO pede redução — quem reduz é o alternador da página
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    const peca = page.locator('#prim-piece [data-reveal]');
    await peca.scrollIntoViewIfNeeded();
    await expect(peca).toHaveClass(/is-in/);
    await page.locator('[data-rever="#prim-piece [data-reveal]"]').click();
    await expect(peca).toHaveClass(/is-in/);
    const botao = page.locator('[data-reduzido]');
    await botao.click();
    await expect(botao).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.ticker__track')!).animationName)).toBe('none');
    await botao.click();
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.ticker__track')!).animationName)).not.toBe('none');
  });

  test('telas: troca a largura da pré-visualização', async ({ page }) => {
    await page.locator('#telas').scrollIntoViewIfNeeded();
    await page.locator('[data-tela-w="1440"]').click();
    await expect(page.locator('#frame-tela iframe')).toHaveCSS('width', '1440px');
    await expect(page.locator('[data-tela-rotulo]')).toHaveText('1440 × 900');
  });

  test('acessibilidade: sem violações graves', async ({ page }) => {
    const r = await new AxeBuilder({ page }).exclude('iframe').analyze();
    const graves = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(graves.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
});
