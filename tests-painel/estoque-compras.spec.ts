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
  const filtro = page.getByRole('group', { name: 'Filtrar a revisão' });
  await filtro.getByRole('button', { name: /Sem categoria \(\d+\)/ }).click();
  const item = page.locator('.fin-revisao-item', { hasText: 'Pix — Distribuidora Bom Preço' });
  await expect(item).toBeVisible();
  await expect(item.locator('.etiqueta', { hasText: 'Sem categoria' })).toBeVisible();
  // Só pagamentos sem categoria no filtro.
  await expect(page.locator('.fin-revisao-item', { hasText: 'Reforma do toldo' })).toHaveCount(0);
  // Lista compacta: o formulário abre na gaveta, com o lançamento à vista.
  await item.getByRole('button', { name: 'Classificar' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Classificar despesa' });
  await gaveta.getByLabel(/Categoria de Pix — Distribuidora Bom Preço/).selectOption('compras_insumos');
  await gaveta.getByLabel(/Descrição de Pix — Distribuidora Bom Preço/).fill('Compra de pão');
  await gaveta.getByRole('button', { name: 'Salvar classificação' }).click();
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
  // A gerência pode seguir, mas só confirma justificando a diferença (02/11); sem motivo, nada é enviado.
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(gaveta.getByRole('group', { name: 'Diferença entre produtos e pagamento' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(gaveta.getByText('Escolha o motivo da diferença entre produtos e pagamento.')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar aos itens' }).click();
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

test('compras (B3): nota parecida com um Pix que espera conferência mostra a diferença, não vincula nem vira conta nova, e leva à conferência do Pix', async ({ page }) => {
  const NOTA_PADARIA = 'e2000000-0000-4000-8000-000000000007'; // nota de R$ 152,40
  const PIX_PADARIA = 'e2000000-0000-4000-8000-000000000008'; // Pix de R$ 150,00 esperando conferência
  await page.goto(`${DEMO}/admin/estoque?aba=compras&compra=${NOTA_PADARIA}`);
  const gaveta = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Continuar' }).click();

  const parecida = gaveta.getByRole('group', { name: 'Pagamento parecido: Pix Padaria Trigo de Ouro' });
  await expect(parecida).toContainText('diferença de R$ 2,40 (a menos que a nota)');
  await expect(parecida.locator('.etiqueta', { hasText: 'Aguarda conferência' })).toBeVisible();
  // Sem "Vincular" para a que não bate, e sem caminho para lançar outra despesa.
  await expect(gaveta.getByRole('radio')).toHaveCount(0);
  await expect(gaveta.getByText('É outra compra: criar uma conta nova')).toHaveCount(0);
  await expect(gaveta.getByText('Conta a pagar')).toHaveCount(0);
  await expect(gaveta.getByText('Esta compra não vira conta nova.')).toBeVisible();

  // Confirmar mesmo assim: o painel nem chama a API.
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(gaveta.getByText(/só pode conferir o pagamento que já espera por ela/)).toBeVisible();

  // A API recusa as duas saídas que criariam o mesmo gasto duas vezes.
  const detalhe = await (await page.request.get(`${DEMO}/admin/api/estoque/compras/${NOTA_PADARIA}`)).json();
  expect(detalhe.despesa.candidatas[0]).toMatchObject({ diferenca: '-2.40', vinculavel: false, aguarda_conferencia: true });
  const semDecisao = await page.request.post(`${DEMO}/admin/api/estoque/compras/${NOTA_PADARIA}/confirmar`, { headers: escrever, data: { versao: detalhe.versao } });
  expect(semDecisao.status()).toBe(409);
  const outra = await page.request.post(`${DEMO}/admin/api/estoque/compras/${NOTA_PADARIA}/confirmar`, { headers: escrever, data: { versao: detalhe.versao, despesa: { criar_nova: true, motivo_nova: 'foi outra entrega' } } });
  expect(outra.status()).toBe(409);
  expect((await outra.json()).codigo).toBe('pagamento_aguarda_conferencia');
  const vincular = await page.request.post(`${DEMO}/admin/api/estoque/compras/${NOTA_PADARIA}/confirmar`, { headers: escrever, data: { versao: detalhe.versao, despesa: { vincular_despesa_id: detalhe.despesa.candidatas[0].despesa_id } } });
  expect((await vincular.json()).codigo).toBe('total_diverge_do_financeiro');

  // O caminho certo: abrir a conferência do Pix e enviar a nota lá.
  await parecida.getByRole('button', { name: 'Abrir a conferência deste pagamento' }).click();
  await expect(page).toHaveURL(new RegExp(`compra=${PIX_PADARIA}`));
  await expect(gaveta.getByText('Produtos e quantidades ainda não informados.')).toBeVisible();
  await expect(gaveta.getByRole('region', { name: 'Enviar a nota fiscal (opcional)' })).toBeVisible();
});
