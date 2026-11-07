// 22. Backend real com o módulo desligado (AMBAR_PONTO_ATIVO=false), como a produção hoje: telas honestas, sem dados de exemplo.
import { test, expect } from '@playwright/test';
import { API, botaoPonto, SEED } from './apoio';

const DESLIGADO = 'http://127.0.0.1:8766';
const PAINEL_DESLIGADO = 'http://127.0.0.1:4496';

test('22. tablet mostra ponto indisponível e não oferece o botão', async ({ page }) => {
  await page.route(`${API}/**`, (r) => r.continue({ url: r.request().url().replace(API, DESLIGADO) }));
  await page.goto('/ponto/');
  await expect(page.locator('.ponto__cartao')).toContainText('Ponto indisponível');
  await expect(botaoPonto(page)).toHaveCount(0);
});

test('22. painel explica que o módulo está desligado', async ({ page }) => {
  const r = await page.request.post(`${PAINEL_DESLIGADO}/admin/api/sessao`, {
    headers: { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: PAINEL_DESLIGADO },
    data: { email: SEED.contas.dono, senha: SEED.senha },
  });
  expect(r.ok()).toBeTruthy();
  await page.goto(`${PAINEL_DESLIGADO}/admin/equipe`);
  await expect(page.getByRole('heading', { name: 'Controle de ponto desligado' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Funcionários' })).toHaveCount(0);
  await page.goto(`${PAINEL_DESLIGADO}/admin/equipe/cadastro-facial`);
  await expect(page.getByRole('heading', { name: 'Escolha o funcionário' })).toBeVisible();
});
