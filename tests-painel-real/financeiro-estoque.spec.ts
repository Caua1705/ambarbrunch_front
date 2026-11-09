// Painel × backend real (0020 + B1/B2/B3/B5) numa base isolada semeada pelo giardini_back. Ordem importa (1 worker, um
// arquivo): primeiro o que só lê ou é recusado, depois o que grava. Efeitos esperados no banco ao fim:
//  - Sem categoria: a MESMA despesa classificada (nenhuma nova);
//  - B2 e B3: nada gravado (409);
//  - B1: +1 despesa e +1 pagamento (a exceção com motivo, auditada);
//  - Pix com divergência: 1 compra confirmada ligada ao pagamento do Pix, entrada no estoque, nenhuma despesa nova.
import { test, expect } from '@playwright/test';
import { PAINEL, SEED, entrar, escrever } from './apoio';

const API = `${PAINEL}/admin/api`;
const C = SEED.cenarios;
/** O backend aceita até 366 dias por consulta: 60 dias em volta de hoje. */
const janela = () => {
  const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  return `de=${d(-30)}&ate=${d(30)}`;
};

let erros: string[] = [];
test.beforeEach(({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
});
test.afterEach(() => expect(erros).toEqual([]));

test('B5: o Proprietário só vê as vendas do Clube da unidade dele', async ({ page }) => {
  await entrar(page, 'dono');
  const r = await page.request.get(`${API}/clube/vendas`);
  expect(r.status()).toBe(200);
  const ids = (await r.json()).itens.map((v: { eye_transaction_id: string }) => v.eye_transaction_id);
  for (const t of SEED.clube.vendas_cafe) expect(ids).toContain(t);
  for (const t of SEED.clube.vendas_noite) expect(ids).not.toContain(t);
  await page.goto(`${PAINEL}/admin/clube`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('B3: nota parecida com um Pix que espera conferência — diferença visível, sem Vincular nem conta nova; a API recusa', async ({ page }) => {
  await entrar(page, 'gerente');
  const id = C.b3.compra_parecida_id;
  await page.goto(`${PAINEL}/admin/estoque?aba=compras&compra=${id}`);
  const gaveta = page.getByRole('dialog');
  // Sugestões da leitura só valem confirmadas por uma pessoa (09/11).
  const sugestoes = gaveta.getByRole('button', { name: /^Confirmar / });
  for (let n = await sugestoes.count(); n > 0; n--) {
    await sugestoes.first().click();
    await expect(sugestoes).toHaveCount(n - 1);
  }
  await expect(gaveta.locator('.item-lido[data-situacao="sugerido"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const parecida = gaveta.locator(`[data-candidata-bloqueada="${C.b3.pix_despesa_id}"]`);
  await expect(parecida).toContainText('diferença de R$ 2,00 (a menos que a nota)');
  await expect(parecida.locator('.etiqueta', { hasText: 'Aguarda conferência' })).toBeVisible();
  await expect(gaveta.getByRole('radio')).toHaveCount(0);
  await expect(gaveta.getByText('É outra compra: criar uma conta nova')).toHaveCount(0);
  await expect(gaveta.getByText('Esta compra não vira conta nova.')).toBeVisible();

  const detalhe = await (await page.request.get(`${API}/estoque/compras/${id}`)).json();
  const confirmar = (despesa: unknown) => page.request.post(`${API}/estoque/compras/${id}/confirmar`, { headers: escrever, data: { versao: detalhe.versao, despesa } });
  expect((await (await confirmar({})).json()).codigo).toBe('despesa_ja_registrada');
  const outra = await confirmar({ criar_nova: true, motivo_nova: 'teste de integração: outra entrega' });
  expect(outra.status()).toBe(409);
  expect((await outra.json()).codigo).toBe('pagamento_aguarda_conferencia');
  expect((await (await confirmar({ vincular_despesa_id: C.b3.pix_despesa_id })).json()).codigo).toBe('total_diverge_do_financeiro');

  // O atalho leva à conferência do Pix (a pendência), sem mexer nela.
  await parecida.getByRole('button', { name: 'Abrir a conferência deste pagamento' }).click();
  await expect(page).not.toHaveURL(new RegExp(`compra=${id}`));
  await expect(gaveta.locator('[data-teste="status-conferencia"]')).toHaveText('Itens ainda não informados.');
  expect((await (await page.request.get(`${API}/estoque/compras/${id}`)).json()).etapa).toBe('aguardando_conferencia');
});

test('B2: anexar um arquivo já registrado avisa antes e a despesa não é lançada', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/financeiro?aba=movimentacoes`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await gaveta.getByLabel('Descrição').fill('Integração B2 — comprovante repetido');
  await gaveta.getByLabel('Valor', { exact: true }).fill('50,00');
  await gaveta.getByLabel('Categoria').selectOption('operacional');
  await gaveta.getByRole('button', { name: 'Fornecedor e comprovante' }).click();
  await gaveta.locator('input[type="file"]').setInputFiles(C.b2.arquivo);
  await expect(gaveta.getByText(/Este arquivo já tinha sido enviado/)).toBeVisible();
  await gaveta.getByRole('button', { name: 'Lançar despesa' }).click();
  await expect(gaveta.getByText(/Este arquivo já está registrado em outro lançamento/)).toBeVisible();
  const l = await (await page.request.get(`${API}/financeiro/lancamentos?${janela()}&tipo=despesa&busca=${encodeURIComponent('Integração B2')}`)).json();
  expect(l.itens).toHaveLength(0);
});

test('Sem categoria: o filtro mostra o pagamento e a classificação muda a MESMA despesa', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/financeiro?aba=pendencias`);
  await page.getByRole('group', { name: 'Filtrar a revisão' }).getByRole('button', { name: 'Sem categoria (1)' }).click();
  const item = page.locator('.fin-revisao-item', { hasText: 'R$ 37,00' });
  await expect(item.locator('.etiqueta', { hasText: 'Sem categoria' })).toBeVisible();
  await item.getByRole('button', { name: 'Classificar' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Classificar despesa' });
  await gaveta.getByRole('combobox').selectOption('operacional');
  await gaveta.getByLabel(/^Descrição de /).fill('Material de escritório (integração)');
  await gaveta.getByRole('button', { name: 'Salvar classificação' }).click();
  await expect(page.getByText('Classificação salva.')).toBeVisible();
  const d = await (await page.request.get(`${API}/financeiro/despesas/${C.sem_categoria.despesa_id}`)).json();
  expect(d.categoria_codigo).toBe('operacional');
  expect(d.descricao).toBe('Material de escritório (integração)');
  expect((await (await page.request.get(`${API}/financeiro/revisao?limite=100`)).json()).despesas.sem_categoria_total).toBe(0);
});

test('B1: comprovante com pagamento parecido já lançado — 409 sem motivo; a exceção com motivo registra uma vez', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/financeiro?aba=pendencias`);
  await page.getByRole('button', { name: /pix do contador/ }).click();
  const gaveta = page.getByRole('dialog');
  await expect(gaveta.getByRole('region', { name: 'Pagamentos já lançados' })).toBeVisible();
  const registrar = gaveta.getByRole('region', { name: 'Registrar como despesa' });
  await expect(registrar.getByText('Pode ser um pagamento ou uma conta já lançada.')).toBeVisible();
  await registrar.getByLabel('Categoria').selectOption('operacional');
  await registrar.getByRole('button', { name: 'Registrar como despesa' }).click();
  await expect(registrar.getByText('Diga por que é outro pagamento (pelo menos 5 caracteres).')).toBeVisible();

  const doc = await (await page.request.get(`${API}/financeiro/revisao/documentos/${C.b1.comprovante_id}`)).json();
  const recusa = await page.request.post(`${API}/financeiro/revisao/documentos/${C.b1.comprovante_id}/resolver`, { headers: escrever, data: { acao: 'registrar_despesa', categoria: 'operacional', paga: true, versao: doc.versao } });
  expect(recusa.status()).toBe(409);
  const corpo = await recusa.json();
  expect(corpo.codigo).toBe('pagamento_parecido_ja_lancado');
  expect(corpo.dados.pagamentos_candidatos.map((p: { pagamento_id: string }) => p.pagamento_id)).toContain(C.b1.pagamento_existente_id);

  await registrar.getByLabel('Por que é outro pagamento?').fill('Integração: segundo pagamento ao contador, outro serviço');
  await registrar.getByRole('button', { name: 'Registrar como despesa' }).click();
  await expect(page.getByText('Despesa paga registrada a partir do documento.')).toBeVisible();
});

test('Pix com divergência: R$ 85 contra um Pix de R$ 90 não confirma (409); refeito com R$ 90 confirma no mesmo pagamento', async ({ page }) => {
  await entrar(page, 'gerente');
  const pendencia = C.pix_divergencia.pendencia_compra_id;
  await page.goto(`${PAINEL}/admin/estoque?aba=compras&compra=${pendencia}`);
  const gaveta = page.getByRole('dialog');
  await expect(gaveta.locator('[data-teste="status-conferencia"]')).toHaveText('Itens ainda não informados.');
  await gaveta.getByRole('combobox', { name: 'Insumo 1' }).fill('leite');
  await page.getByRole('option', { name: /Leite integral/ }).click();
  await gaveta.getByRole('textbox', { name: 'Quantidade', exact: true }).first().fill('10');
  await gaveta.getByRole('combobox', { name: 'Unidade', exact: true }).first().selectOption('L');
  await gaveta.getByRole('textbox', { name: 'Valor unitário', exact: true }).first().fill('8,50');
  await expect(gaveta.locator('[data-teste="soma-produtos"]')).toContainText('diferença de R$ 5,00');
  await gaveta.getByRole('button', { name: 'Salvar itens' }).click();
  await expect(gaveta.getByText(/Os itens não batem com o Financeiro./)).toBeVisible();
  // A gerência pode seguir, mas só confirma justificando a diferença (02/11); sem motivo, nada é enviado.
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(gaveta.getByRole('group', { name: 'Diferença entre produtos e pagamento' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(gaveta.getByText('Escolha o motivo da diferença entre produtos e pagamento.')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar aos itens' }).click();

  const atual = new URL(page.url()).searchParams.get('compra')!;
  const detalhe = await (await page.request.get(`${API}/estoque/compras/${atual}`)).json();
  expect(detalhe.pendencias).toContain('total_diverge_do_financeiro');
  const recusa = await page.request.post(`${API}/estoque/compras/${atual}/confirmar`, { headers: escrever, data: { versao: detalhe.versao } });
  expect(recusa.status()).toBe(409);

  await gaveta.getByRole('button', { name: 'Corrigir os produtos ou enviar a nota' }).click();
  await gaveta.getByRole('textbox', { name: 'Valor unitário', exact: true }).first().fill('9,00');
  await expect(gaveta.locator('[data-teste="soma-produtos"]')).toContainText('Confere');
  await gaveta.getByRole('button', { name: 'Salvar itens' }).click();
  await expect(gaveta.locator('[data-teste="soma-produtos"]')).toContainText('Confere');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(gaveta.getByText('É o pagamento que a Júlia registrou')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(gaveta.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();

  const final = new URL(page.url()).searchParams.get('compra')!;
  const confirmada = await (await page.request.get(`${API}/estoque/compras/${final}`)).json();
  expect(confirmada.etapa).toBe('confirmada');
  expect(confirmada.despesa.despesa_id).toBe(C.pix_divergencia.pix_despesa_id);
});
