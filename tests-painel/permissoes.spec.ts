// O painel reflete o papel do backend: menu, páginas e ações. (Quem decide é o backend — a demo imita os 403.)
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

test('Atendente: abre direto em Reservas, menu só com Reservas e Atendimento, o resto recusado', async ({ page }) => {
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin`);
  await page.waitForURL(`${DEMO}/admin/reservas`);
  const nav = page.getByRole('navigation', { name: 'Módulos' });
  await expect(nav.getByRole('listitem')).toHaveCount(2);
  await expect(nav.getByRole('link', { name: 'Reservas' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Atendimento' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Configurações' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nova reserva' })).toHaveCount(0);
  for (const area of ['financeiro', 'estoque', 'configuracoes', 'clube']) {
    await page.goto(`${DEMO}/admin/${area}`);
    await expect(page.getByText('Sem acesso a esta área')).toBeVisible();
  }
  expect((await page.request.get(`${DEMO}/admin/api/financeiro/resumo`)).status()).toBe(403);
  expect((await page.request.get(`${DEMO}/admin/api/usuarios`)).status()).toBe(403);
});

test('Proprietário: Equipe e acessos com a equipe real; não muda o próprio perfil', async ({ page }) => {
  await entrarDemo(page, 'admin');
  await page.goto(`${DEMO}/admin/configuracoes`);
  const equipe = page.getByRole('table', { name: 'Equipe e acessos' });
  await expect(equipe.getByRole('row')).toHaveCount(4);
  for (const perfil of ['Proprietário', 'Gerente', 'Atendente']) await expect(equipe.getByText(perfil, { exact: true })).toBeVisible();
  await expect(equipe.getByRole('row', { name: /(você)/ }).getByRole('button', { name: 'Gerenciar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Proprietário|Ana Administradora/ }).first()).toBeVisible();
});

test('Gerente: Configurações sem Equipe e sem regras da casa', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/configuracoes`);
  await expect(page.getByText('Perfis de acesso')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Equipe e acessos' })).toHaveCount(0);
  expect((await page.request.get(`${DEMO}/admin/api/usuarios`)).status()).toBe(403);
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
