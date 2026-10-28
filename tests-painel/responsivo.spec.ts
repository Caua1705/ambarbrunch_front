// Todas as telas principais sem rolagem horizontal da página (375–430 px no celular), sem erro de script, e o menu
// lateral acessível pelo botão no celular.
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo, semRolagemHorizontal } from './apoio';

const PAGINAS = [
  '/admin', '/admin/reservas', '/admin/reservas?vista=semana', '/admin/atendimento', '/admin/clube', '/admin/clube?secao=membros',
  '/admin/financeiro', '/admin/financeiro?aba=lancamentos', '/admin/financeiro?aba=contas', '/admin/financeiro?aba=relatorios',
  '/admin/estoque', '/admin/estoque?aba=insumos', '/admin/estoque?aba=compras', '/admin/estoque?aba=fichas', '/admin/estoque?aba=analises',
  '/admin/configuracoes',
];

for (const largura of [375, 390, 430, 1366]) {
  test(`sem rolagem horizontal em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 860 });
    await entrarDemo(page, 'admin');
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(String(e)));
    for (const p of PAGINAS) {
      await page.goto(DEMO + p);
      await page.waitForLoadState('networkidle');
      expect(await semRolagemHorizontal(page), p).toBe(true);
    }
    expect(erros).toEqual([]);
  });
}

test('menu do celular abre, navega e fecha com Esc', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'só no celular');
  await entrarDemo(page);
  await page.goto(`${DEMO}/admin`);
  const abrir = page.getByRole('button', { name: 'Abrir menu' });
  await abrir.click();
  await expect(page.getByRole('navigation', { name: 'Módulos' }).getByRole('link', { name: 'Reservas' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(abrir).toHaveAttribute('aria-expanded', 'false');
  await abrir.click();
  await page.getByRole('navigation', { name: 'Módulos' }).getByRole('link', { name: 'Reservas' }).click();
  await page.waitForURL(/\/admin\/reservas/);
});
