// O painel reflete o papel do backend: menu, páginas e ações. (Quem decide é o backend — a demo imita os 403.)
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

test('operação: sem Financeiro no menu, página e API recusadas', async ({ page }) => {
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin`);
  const nav = page.getByRole('navigation', { name: 'Módulos' });
  await expect(nav.getByRole('link', { name: 'Reservas' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Financeiro' })).toHaveCount(0);
  await expect(page.getByText('Faturamento do mês')).toHaveCount(0);
  await page.goto(`${DEMO}/admin/financeiro`);
  await expect(page.getByText('Sem acesso a esta área')).toBeVisible();
  expect((await page.request.get(`${DEMO}/admin/api/financeiro/resumo`)).status()).toBe(403);
});

test('gerência: vê os seis módulos e o financeiro na Visão Geral', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin`);
  const nav = page.getByRole('navigation', { name: 'Módulos' });
  for (const m of ['Visão Geral', 'Reservas', 'Atendimento', 'Clube Âmbar', 'Financeiro', 'Estoque']) await expect(nav.getByRole('link', { name: new RegExp(m) })).toBeVisible();
  await expect(nav.getByRole('listitem')).toHaveCount(6);
  await expect(page.getByText(/Faturamento do mês/)).toBeVisible();
});

test('gerência não reativa membro suspenso do Clube; administrador sim', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/clube?secao=membros`);
  await page.getByRole('row', { name: /Lívia Bastos/ }).click();
  await expect(page.getByRole('dialog').getByText('Suspenso em')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reativar' })).toHaveCount(0);

  await entrarDemo(page, 'admin');
  await page.goto(`${DEMO}/admin/clube?secao=membros`);
  await page.getByRole('row', { name: /Lívia Bastos/ }).click();
  await expect(page.getByRole('button', { name: 'Reativar' })).toBeVisible();
});

test('Clube segue em pré-lançamento: sem convites e sem pontos inventados', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/clube`);
  await expect(page.getByText('O Clube ainda não foi lançado ao público.')).toBeVisible();
  await expect(page.getByText('programa de pontos desligado')).toBeVisible();
  await page.goto(`${DEMO}/admin/clube?secao=vendas`);
  await expect(page.getByRole('button', { name: 'Convidar' })).toHaveCount(0);
});
