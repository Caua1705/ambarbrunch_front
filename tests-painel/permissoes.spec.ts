// O painel reflete o papel do backend: menu, páginas e ações. (Quem decide é o backend — a demo imita os 403.)
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

test('Atendente: abre no Modo Operação com Conversas, Reservas e Ponto; o ponto é o terminal oficial do tablet', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin`);
  await page.waitForURL(`${DEMO}/admin/operacao`);
  const secoes = page.getByRole('navigation', { name: /Seções/ });
  await expect(secoes.getByRole('link', { name: /Conversas/ })).toHaveAttribute('href', '/admin/atendimento');
  await expect(secoes.getByRole('button', { name: /Reservas/ })).toHaveAttribute('aria-current', 'page');
  await secoes.getByRole('button', { name: /Ponto/ }).click();
  await expect(page).toHaveURL(/secao=ponto/);
  const terminal = page.locator('iframe[title="Terminal de ponto"]');
  await expect(terminal).toHaveAttribute('src', '/ponto');
  await expect(terminal).toHaveAttribute('allow', 'camera');
  await expect(page.getByText('O ponto é de quem aparece, não de quem está logado.')).toBeVisible();
  // A câmera só é delegada nesta página (e no cadastro facial); o resto do painel continua sem câmera.
  const politica = (await page.request.get(`${DEMO}/admin/operacao`)).headers()['permissions-policy'];
  expect(politica).toContain('camera=(self)');
  expect((await page.request.get(`${DEMO}/admin/reservas`)).headers()['permissions-policy']).toContain('camera=()');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Cadastro facial, registros e tablets ficam com o Proprietário (os 403 da API do ponto: tests/test_atendente_ponto.py no backend).
  expect((await page.request.get(`${DEMO}/admin/api/usuarios`)).status()).toBe(403);
});

test('Atendente: no painel completo, menu só com Reservas e Atendimento, o resto recusado', async ({ page }) => {
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin/reservas`);
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
  await page.goto(`${DEMO}/admin/configuracoes?secao=equipe`);
  const equipe = page.getByRole('table', { name: 'Equipe e acessos' });
  await expect(equipe.getByRole('row')).toHaveCount(4);
  for (const perfil of ['Proprietário', 'Gerente', 'Atendente']) await expect(equipe.getByText(perfil, { exact: true })).toBeVisible();
  await expect(equipe.getByRole('row', { name: /(você)/ }).getByRole('button', { name: 'Gerenciar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Proprietário|Ana Administradora/ }).first()).toBeVisible();
});

test('Gerente: Configurações sem Equipe e sem regras da casa', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/configuracoes?secao=equipe`);
  await expect(page.getByText('Perfis de acesso')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Equipe e acessos' })).toHaveCount(0);
  expect((await page.request.get(`${DEMO}/admin/api/usuarios`)).status()).toBe(403);
});

test('gerência: vê os módulos (sem Clientes) e o financeiro na Visão Geral; o Clube sai do menu, mas a rota segue', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin`);
  const nav = page.getByRole('navigation', { name: 'Módulos' });
  for (const m of ['Visão Geral', 'Reservas', 'Atendimento', 'Financeiro', 'Estoque', 'Equipe']) await expect(nav.getByRole('link', { name: m })).toBeVisible();
  await expect(nav.getByRole('listitem')).toHaveCount(6);
  // a página Clientes saiu (o contato aparece na ficha da conversa do Atendimento)
  await expect(nav.getByRole('link', { name: 'Clientes' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /Clube/ })).toHaveCount(0);
  const kpis = page.getByRole('region', { name: 'Indicadores do período' });
  for (const k of ['Receita', 'Despesas', 'Resultado gerencial', 'Ticket médio']) await expect(kpis.getByText(k, { exact: true })).toBeVisible();
  // Clube oculto da navegação, não apagado: quem tem o link continua entrando.
  await page.goto(`${DEMO}/admin/clube`);
  await expect(page.getByRole('heading', { name: 'Clube Âmbar', level: 1 })).toBeVisible();
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

test('Proprietário cria a conta do Atendente e define uma nova senha (senha nunca exibida)', async ({ page }) => {
  await entrarDemo(page, 'admin');
  await page.goto(`${DEMO}/admin/configuracoes?secao=equipe`);
  await page.getByRole('button', { name: 'Nova conta' }).click();
  const gaveta = page.getByRole('dialog', { name: /Nova conta/ });
  await expect(gaveta.getByLabel('Perfil')).toHaveValue('operador');
  await gaveta.getByLabel('Nome').fill('Tablet do salão');
  await gaveta.getByLabel('E-mail').fill('tablet.salao@exemplo.com');
  await gaveta.getByLabel('Senha inicial').fill('curta');
  await gaveta.getByLabel('Repita a senha').fill('curta');
  await gaveta.getByRole('button', { name: 'Criar conta' }).click();
  await expect(gaveta.getByText('A senha precisa de pelo menos 10 caracteres.')).toBeVisible();
  await expect(gaveta.getByLabel('Senha inicial')).toHaveAttribute('type', 'password');
  await gaveta.getByLabel('Senha inicial').fill('senha-do-tablet-2026');
  await gaveta.getByLabel('Repita a senha').fill('senha-do-tablet-2026');
  await gaveta.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByText(/Conta criada\. Atendente já pode entrar/)).toBeVisible();
  const equipe = page.getByRole('table', { name: 'Equipe e acessos' });
  const linha = equipe.getByRole('row', { name: /Tablet do salão/ });
  await expect(linha).toContainText('Atendente');
  await expect(page.locator('body')).not.toContainText('senha-do-tablet-2026');

  await linha.getByRole('button', { name: 'Ações para Tablet do salão' }).click();
  await page.getByRole('menuitem', { name: 'Definir nova senha' }).click();
  const senha = page.getByRole('dialog', { name: /Definir nova senha/ });
  await senha.getByLabel('Nova senha').fill('outra-senha-forte-2026');
  await senha.getByLabel('Repita a senha').fill('outra-senha-forte-2026');
  await senha.getByRole('button', { name: 'Salvar senha' }).click();
  await expect(page.getByText('Senha definida. As sessões abertas desta conta foram encerradas.')).toBeVisible();
});
