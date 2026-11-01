// Regras de 31/10 (dono) na demonstração: o pagamento sem categoria é classificado na Revisão (a MESMA despesa) e
// Compras confere os produtos de um pagamento com o seletor do cadastro, valor unitário e subtotal; produtos que não
// somam o valor do pagamento ficam como rascunho e a confirmação é bloqueada (no painel e na API).
// Cada teste usa um registro DIFERENTE da demonstração (o estado do servidor é compartilhado entre os testes).
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const PIX_HORTIFRUTI = 'e2000000-0000-4000-8000-000000000003'; // compra pendente do Pix de R$ 186,40 (Júlia)
const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO };

let erros: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrarDemo(page, 'gerente');
});
test.afterEach(() => expect(erros).toEqual([]));

test('revisão: filtro "Sem categoria" e classificação da mesma despesa, com descrição opcional', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=revisao`);
  const filtro = page.getByRole('group', { name: 'Filtrar despesas' });
  await filtro.getByRole('button', { name: /Sem categoria \(\d+\)/ }).click();
  const item = page.locator('.fin-revisao-item', { hasText: 'Pix — Distribuidora Bom Preço' });
  await expect(item).toBeVisible();
  await expect(item.locator('.etiqueta', { hasText: 'Sem categoria' })).toBeVisible();
  // Só pagamentos sem categoria no filtro.
  await expect(page.locator('.fin-revisao-item', { hasText: 'Reforma do toldo' })).toHaveCount(0);
  await item.getByLabel(/Categoria de Pix — Distribuidora Bom Preço/).selectOption('compras_insumos');
  await item.getByLabel(/Descrição de Pix — Distribuidora Bom Preço/).fill('Compra de pão');
  await item.getByRole('button', { name: 'Salvar classificação' }).click();
  await expect(page.getByText('Classificada. A compra foi para conferência em Estoque → Compras.')).toBeVisible();
  await expect(page.locator('.fin-revisao-item', { hasText: 'Distribuidora Bom Preço' })).toHaveCount(0);
});

test('compras: produtos do cadastro com subtotal; R$ 222 contra um Pix de R$ 186,40 não confirma, corrigido confirma uma vez', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=compras&compra=${PIX_HORTIFRUTI}`);
  const gaveta = page.getByRole('dialog');
  await expect(gaveta.getByText('Produtos e quantidades ainda não informados.')).toBeVisible();

  // Seletor pesquisável do cadastro de insumos (não é texto livre).
  await gaveta.getByRole('combobox', { name: 'Produto 1' }).fill('ovo');
  await page.getByRole('option', { name: /Ovos/ }).click();
  await gaveta.getByLabel('Qtd.').first().fill('100');
  await gaveta.getByLabel('Valor unit.').first().fill('2,22');
  await expect(gaveta.getByLabel('Subtotal').first()).toHaveText(/222,00/);
  await expect(gaveta.locator('[data-teste="soma-produtos"]')).toContainText('diferença de R$ 35,60');

  // Salvar o rascunho é permitido; confirmar, não.
  await gaveta.getByRole('button', { name: 'Salvar produtos' }).click();
  await expect(gaveta.getByText('Os produtos não batem com o pagamento.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  const lista = await (await page.request.get(`${DEMO}/admin/api/estoque/compras?limite=200`)).json();
  const rascunho = lista.itens.find((c: { despesa_origem_id: string | null; etapa: string; fonte_leitura: string | null }) => c.despesa_origem_id && c.etapa === 'aguardando_conferencia' && c.fonte_leitura === 'manual');
  const detalhe = await (await page.request.get(`${DEMO}/admin/api/estoque/compras/${rascunho.id}`)).json();
  expect(detalhe.pendencias).toContain('total_diverge_do_financeiro');
  const recusa = await page.request.post(`${DEMO}/admin/api/estoque/compras/${rascunho.id}/confirmar`, { headers: escrever, data: { versao: detalhe.versao } });
  expect(recusa.status()).toBe(409);

  // Corrige: 2 × R$ 93,20 = R$ 186,40 (o valor do pagamento). Nasce a compra corrigida; a gaveta passa para ela.
  await gaveta.getByRole('button', { name: 'Corrigir os produtos ou enviar a nota' }).click();
  await gaveta.getByLabel('Qtd.').first().fill('2');
  await gaveta.getByLabel('Valor unit.').first().fill('93,20');
  await expect(gaveta.locator('[data-teste="soma-produtos"]')).toContainText('confere');
  await gaveta.getByRole('button', { name: 'Salvar produtos' }).click();
  await expect(gaveta.getByText(/igual ao pagamento no Financeiro/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(gaveta.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
});
