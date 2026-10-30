// Clientes (demonstração): busca, ficha com histórico e correção de cadastro pela gerência; o Atendente não entra.
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

test('Gerente: busca, abre a ficha e corrige o e-mail', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/clientes`);
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  await expect(page.locator('[data-linha]:visible').first()).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar cliente' }).fill('zzzz-ninguem');
  await expect(page.getByText('Ninguém encontrado com essa busca')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar cliente' }).fill('');
  await page.locator('[data-linha]:visible').first().click();
  const g = page.getByRole('dialog');
  await expect(g.getByRole('heading', { name: 'Reservas' })).toBeVisible();
  await g.getByLabel('E-mail').fill('cliente.corrigido@exemplo.invalid');
  await g.getByRole('button', { name: 'Salvar correções' }).click();
  await expect(page.getByText('Cadastro corrigido.')).toBeVisible();
  await expect(g.getByLabel('E-mail')).toHaveValue('cliente.corrigido@exemplo.invalid');
});

test('Atendente: sem acesso a Clientes (página e API)', async ({ page }) => {
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin/clientes`);
  await expect(page.getByText('Sem acesso a esta área')).toBeVisible();
  expect((await page.request.get(`${DEMO}/admin/api/clientes`)).status()).toBe(403);
});
