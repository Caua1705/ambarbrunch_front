// Fluxo da gerente nas Reservas (demonstração): ver o dia, aprovar, abrir o detalhe, filtrar e criar.
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

test.beforeEach(async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/reservas`);
  await expect(page.getByRole('heading', { name: 'Reservas de hoje' })).toBeVisible();
});

test('mostra o resumo e a lista do dia', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Resumo do dia' })).toContainText('Pessoas');
  await expect(page.locator('[data-linha]:visible').first()).toBeVisible();
});

test('aprova uma reserva pendente pela gaveta de pendentes', async ({ page }) => {
  await page.getByRole('button', { name: 'Revisar' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Aguardando aprovação' });
  const primeiro = gaveta.getByRole('button', { name: /^Aprovar a reserva de / }).first();
  const nome = (await primeiro.getAttribute('aria-label'))!.replace('Aprovar a reserva de ', '');
  await primeiro.click();
  await expect(page.getByText(`Reserva de ${nome} aprovada.`)).toBeVisible();
});

test('abre o detalhe com contato e ações coerentes com a situação', async ({ page }) => {
  await page.locator('[data-linha]:visible').first().click();
  const g = page.getByRole('dialog');
  await expect(g.getByText('Contato')).toBeVisible();
  await expect(g.getByRole('link', { name: 'Ligar' })).toBeVisible();
  await g.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('filtro por situação e busca', async ({ page }) => {
  await page.getByRole('button', { name: /^Canceladas/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar reserva' }).fill('zzzz-ninguem');
  await expect(page.getByText('Nenhuma reserva com esses filtros')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('[data-linha]:visible').first()).toBeVisible();
});

test('nova reserva: valida os campos e cria usando a lotação', async ({ page }) => {
  await page.getByRole('button', { name: 'Nova reserva' }).click();
  const g = page.getByRole('dialog', { name: 'Nova reserva' });
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText('Escolha o ambiente.')).toBeVisible();
  await g.getByLabel('Ambiente').selectOption({ index: 1 });
  await g.getByLabel('Pessoas').fill('3');
  await g.getByRole('radio').first().click();
  await g.getByLabel('Nome do cliente').fill('Cliente do Teste');
  await g.getByLabel('Telefone (WhatsApp)').fill('85999998888');
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(page.getByText('Reserva de Cliente do Teste criada.')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Cliente do Teste' })).toBeVisible();
});

test('tema escuro persiste depois de recarregar', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'mesmo comportamento; coberto no desktop');
  await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click();
  const tema = await page.evaluate(() => document.documentElement.dataset.tema);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.tema)).toBe(tema);
});
