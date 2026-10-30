// Atendimento (demonstração): as ações do painel anterior — assumir, responder, devolver e encerrar.
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo, post } from './apoio';

test.beforeEach(async ({ page }) => {
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin/atendimento`);
  await expect(page.getByRole('heading', { name: 'Atendimento', level: 1 })).toBeVisible();
});

test('conversa com o assistente: responder assume, devolver e encerrar', async ({ page }) => {
  await page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: /Marcos Sales/ }).click();
  // com o assistente (ou encerrada numa rodada anterior da demonstração): ninguém é dono, qualquer um assume ou responde
  await expect(page.getByRole('button', { name: 'Assumir', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Resposta' }).fill('Oi, Marcos! Aqui é a equipe do Âmbar.');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(page.locator('.mensagens')).toContainText('Aqui é a equipe do Âmbar');
  await page.getByRole('button', { name: 'Devolver ao assistente' }).click();
  await page.getByRole('dialog', { name: 'Devolver ao assistente virtual?' }).getByRole('button', { name: 'Devolver' }).click();
  await expect(page.getByText('Conversa devolvida ao assistente.')).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar conversa' }).click();
  await page.getByRole('dialog', { name: 'Encerrar esta conversa?' }).getByRole('button', { name: 'Encerrar' }).click();
  await expect(page.getByText('Conversa encerrada.')).toBeVisible();
});

test('conversa de outra pessoa: só "Assumir no lugar" libera a resposta', async ({ page }) => {
  // a demonstração guarda o estado no servidor: antes, a Gerente fica com a conversa (transferindo se preciso)
  await entrarDemo(page, 'gerente');
  const [paula] = await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas?busca=Paula`)).json();
  expect((await post(page.request, `${DEMO}/admin/api/atendimento/conversas/${paula.id}/assumir`, { transferir: true }, { 'X-Painel': '1', Origin: DEMO })).ok()).toBe(true);
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin/atendimento`);
  await page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: /Paula Ximenes/ }).click();
  await expect(page.getByRole('textbox', { name: 'Resposta' })).toBeDisabled();
  await page.getByRole('button', { name: /^Assumir no lugar/ }).click();
  await page.getByRole('dialog', { name: /^Assumir a conversa no lugar de / }).getByRole('button', { name: 'Assumir no lugar' }).click();
  await expect(page.getByText('Conversa transferida para você.')).toBeVisible();
});
