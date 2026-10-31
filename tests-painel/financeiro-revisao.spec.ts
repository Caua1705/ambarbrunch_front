// Financeiro → Revisão com o contrato da 0018/0019 (HANDOFF-FRONT-REVISAO-CATEGORIAS.md), na demonstração: a categoria
// que a Júlia sugeriu, comprovante sem data, nota e boleto que nunca viram pagamento sozinhos, vínculos com conta e
// pagamento já lançados, documento ambíguo, correção de unidade e a tela que não quebra com a API falhando.
// Cada teste resolve um documento DIFERENTE da demonstração (o estado do servidor é compartilhado entre os testes).
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
const API = `${DEMO}/admin/api/financeiro`;
const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO };

async function abrirRevisao(page: Page) {
  await page.goto(`${DEMO}/admin/financeiro?aba=revisao`);
  await expect(page.getByRole('heading', { name: /Documentos do grupo/ })).toBeVisible();
}
/** Abre o documento da fila pelo texto do item e devolve a gaveta. */
async function abrirDocumento(page: Page, texto: RegExp) {
  await page.getByRole('button', { name: texto }).click();
  const gaveta = page.getByRole('dialog');
  await expect(gaveta.getByRole('heading', { name: 'O que a Júlia leu' })).toBeVisible();
  return gaveta;
}
async function idDoDocumento(page: Page, texto: string) {
  const fila = await (await page.request.get(`${API}/revisao`)).json();
  return fila.documentos.itens.find((d: { extraido: { recebedor_nome?: string } }) => d.extraido.recebedor_nome === texto)?.id as string;
}
async function idDaDespesa(page: Page, descricao: string) {
  const l = await (await page.request.get(`${API}/lancamentos?de=2000-01-01&ate=2100-01-01&tipo=despesa&busca=${encodeURIComponent(descricao)}`)).json();
  return l.itens.find((x: { descricao: string }) => x.descricao === descricao)?.id as string | undefined;
}

// Nenhum erro de JavaScript na tela, em nenhum cenário.
let erros: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrarDemo(page, 'gerente');
});
test.afterEach(() => expect(erros).toEqual([]));

test('xerox: a Júlia classificou como Operacional pela legenda e a despesa sai com essa categoria', async ({ page }) => {
  await abrirRevisao(page);
  const gaveta = await abrirDocumento(page, /COPIADORA CENTRAL/);
  const julia = gaveta.locator('[data-categoria-julia]');
  await expect(julia).toContainText('Operacional');
  await expect(julia).toContainText('pela legenda');
  const registrar = gaveta.getByRole('region', { name: 'Registrar como despesa' });
  await expect(registrar.getByLabel('Categoria')).toHaveValue('operacional');
  await expect(registrar.getByRole('button', { name: 'Já está pago' })).toHaveAttribute('aria-pressed', 'true');
  // A data lida veio com o ano errado: corrige na própria resolução.
  await expect(gaveta.getByText('Data do pagamento a conferir')).toBeVisible();
  await registrar.getByLabel('Data do pagamento').fill(hoje());
  await registrar.getByRole('button', { name: 'Registrar como despesa' }).click();
  await expect(page.getByText('Despesa paga registrada a partir do documento.')).toBeVisible();
  await expect(page.getByRole('button', { name: /COPIADORA CENTRAL/ })).toHaveCount(0);

  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos`);
  await page.getByLabel('Buscar lançamento').fill('xerox');
  const linha = page.getByRole('row', { name: /xerox dos cardápios/ }).first();
  await expect(linha).toBeVisible();
  await expect(linha).toContainText('Operacional');
});

test('comprovante sem data: não vira despesa paga até a gerência informar a data', async ({ page }) => {
  await abrirRevisao(page);
  const gaveta = await abrirDocumento(page, /LIMPEZA TOTAL/);
  await expect(gaveta.getByText('Sem data', { exact: true })).toBeVisible();
  const registrar = gaveta.getByRole('region', { name: 'Registrar como despesa' });
  const data = registrar.getByLabel('Data do pagamento');
  await expect(data).toHaveValue('');
  await registrar.getByRole('button', { name: 'Registrar como despesa' }).click();
  await expect(registrar.getByText('Informe a data do pagamento.')).toBeVisible();
  // O backend também recusa sem data (422 data_obrigatoria), mesmo que a tela fosse pulada.
  const id = await idDoDocumento(page, 'LIMPEZA TOTAL DISTRIBUIDORA');
  const r = await page.request.post(`${API}/revisao/documentos/${id}/resolver`, { headers: escrever, data: { acao: 'registrar_despesa', paga: true } });
  expect(r.status()).toBe(422);
  expect((await r.json()).codigo).toBe('data_obrigatoria');

  await data.fill(hoje());
  await registrar.getByRole('button', { name: 'Registrar como despesa' }).click();
  await expect(page.getByText('Despesa paga registrada a partir do documento.')).toBeVisible();
});

test('nota fiscal: vira conta a pagar, sem "marcar como paga"', async ({ page }) => {
  await abrirRevisao(page);
  const gaveta = await abrirDocumento(page, /NFC-e 004512/);
  await expect(gaveta.getByRole('button', { name: /Marcar .* paga/ })).toHaveCount(0);
  const registrar = gaveta.getByRole('region', { name: 'Registrar como despesa' });
  await expect(registrar.getByRole('button', { name: 'É uma conta a pagar' })).toHaveAttribute('aria-pressed', 'true');
  await expect(registrar).toContainText('Nota fiscal é cobrança');
  await expect(registrar.getByLabel('Vencimento')).not.toHaveValue('');
  // Pagar uma nota pela rota de comprovante é recusado (409 documento_nao_comprova_pagamento).
  const id = (await (await page.request.get(`${API}/revisao`)).json()).documentos.itens.find((d: { tipo_documento: string }) => d.tipo_documento === 'nota_compra').id;
  const r = await page.request.post(`${API}/revisao/documentos/${id}/resolver`, { headers: escrever, data: { acao: 'vincular_pagamento', pagamento_id: '00000000-0000-4000-8000-000000000000' } });
  expect(r.status()).toBe(409);
  expect((await r.json()).codigo).toBe('documento_nao_comprova_pagamento');

  await registrar.getByRole('button', { name: 'Registrar conta a pagar' }).click();
  await expect(page.getByText('Conta a pagar registrada a partir do documento.')).toBeVisible();
  const contas = await (await page.request.get(`${API}/contas-a-pagar?situacao=abertas`)).json();
  expect(contas.itens.some((c: { descricao: string; situacao: string }) => c.descricao === 'nota do hortifruti' && c.situacao === 'aberta')).toBe(true);
});

test('boleto: vinculado à conta já lançada, que continua a pagar e passa a mostrar o boleto nos anexos', async ({ page }) => {
  await abrirRevisao(page);
  const gaveta = await abrirDocumento(page, /CONTABIL FORTALEZA/);
  await expect(gaveta.getByRole('button', { name: /Marcar .* paga/ })).toHaveCount(0);
  const contas = gaveta.getByRole('region', { name: 'Contas já lançadas' });
  await expect(contas).toContainText('Honorários contábeis');
  await contas.getByRole('button', { name: 'Vincular a esta conta' }).click();
  await page.getByRole('dialog', { name: 'Vincular a esta conta?' }).getByRole('button', { name: 'Vincular' }).click();
  await expect(page.getByText('Documento vinculado à conta.')).toBeVisible();
  await expect(page.getByRole('button', { name: /CONTABIL FORTALEZA/ })).toHaveCount(0);

  const lista = await (await page.request.get(`${API}/contas-a-pagar?situacao=abertas`)).json();
  const conta = lista.itens.find((c: { descricao: string }) => c.descricao === 'Honorários contábeis');
  expect(conta.situacao).toBe('aberta');
  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos&despesa=${conta.despesa_id}`);
  await expect(page.getByRole('dialog', { name: 'Honorários contábeis' }).getByText('Boleto enviado à Júlia')).toBeVisible();
});

test('comprovante de um pagamento lançado à mão: vira a prova dele, sem pagar de novo', async ({ page }) => {
  await abrirRevisao(page);
  const gaveta = await abrirDocumento(page, /GAS DO BAIRRO/);
  const pagamentos = gaveta.getByRole('region', { name: 'Pagamentos já lançados' });
  await expect(pagamentos).toContainText('Gás de cozinha — botijões');
  await pagamentos.getByRole('button', { name: 'Vincular a este pagamento' }).click();
  await page.getByRole('dialog', { name: 'Vincular a este pagamento?' }).getByRole('button', { name: 'Vincular' }).click();
  await expect(page.getByText('Comprovante vinculado ao pagamento.')).toBeVisible();

  const id = await idDaDespesa(page, 'Gás de cozinha — botijões');
  const despesa = await (await page.request.get(`${API}/despesas/${id}`)).json();
  expect(despesa.parcelas[0].pagamentos.filter((p: { estornado_em: string | null }) => !p.estornado_em)).toHaveLength(1);
  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos&despesa=${id}`);
  const detalhe = page.getByRole('dialog', { name: 'Gás de cozinha — botijões' });
  await expect(detalhe.getByText('Comprovante do pagamento')).toBeVisible();
  await expect(detalhe.getByText('Comprovante enviado à Júlia')).toBeVisible();
});

test('documento ambíguo: exige dizer se está pago ou a pagar, e a categoria', async ({ page }) => {
  await abrirRevisao(page);
  // Sem dizer, o backend recusa (422 informe_se_paga).
  const id = await idDoDocumento(page, 'TOLDOS CEARA');
  const r = await page.request.post(`${API}/revisao/documentos/${id}/resolver`, { headers: escrever, data: { acao: 'registrar_despesa', categoria: 'operacional' } });
  expect(r.status()).toBe(422);
  expect((await r.json()).codigo).toBe('informe_se_paga');

  const gaveta = await abrirDocumento(page, /TOLDOS CEARA/);
  await expect(gaveta.getByText('A legenda não combina com o documento')).toBeVisible();
  await expect(gaveta.locator('[data-categoria-julia]')).toContainText('A Júlia ficou entre: Operacional, Obras e equipamentos');
  const registrar = gaveta.getByRole('region', { name: 'Registrar como despesa' });
  await expect(registrar.getByRole('button', { name: 'Já está pago' })).toHaveAttribute('aria-pressed', 'false');
  await expect(registrar.getByRole('button', { name: 'É uma conta a pagar' })).toHaveAttribute('aria-pressed', 'false');
  await registrar.getByRole('button', { name: 'Registrar como despesa' }).click();
  await expect(registrar.getByText('Escolha a categoria.')).toBeVisible();
  await expect(registrar.getByText('Diga se já está pago ou se é uma conta a pagar.', { exact: true })).toBeVisible();

  await registrar.getByLabel('Categoria').selectOption('obras_e_equipamentos');
  await registrar.getByRole('button', { name: 'É uma conta a pagar' }).click();
  await registrar.getByLabel('Vencimento').fill(hoje());
  await registrar.getByRole('button', { name: 'Registrar conta a pagar' }).click();
  await expect(page.getByText('Conta a pagar registrada a partir do documento.')).toBeVisible();
});

test('unidade errada: o documento e a despesa de teste vão para a unidade de testes', async ({ page }) => {
  await abrirRevisao(page);
  const gaveta = await abrirDocumento(page, /TESTE JULIA/);
  await gaveta.getByRole('button', { name: 'Corrigir leitura' }).click();
  const form = gaveta.getByRole('form', { name: 'Corrigir leitura' });
  await form.getByLabel('Unidade').selectOption('ambar_teste');
  await form.getByRole('button', { name: 'Salvar correção' }).click();
  await expect(form.getByText('Explique a correção (pelo menos 5 caracteres).')).toBeVisible();
  await form.getByLabel('Motivo da correção').fill('teste enviado sem #teste');
  await form.getByRole('button', { name: 'Salvar correção' }).click();
  await expect(page.getByText('Documento levado para Âmbar · TESTES (demo).')).toBeVisible();
  await expect(page.getByRole('button', { name: /TESTE JULIA/ })).toHaveCount(0);

  // Despesa lançada na unidade errada: Mudar unidade (com motivo); despesa de compra é recusada (409).
  const id = await idDaDespesa(page, 'Teste lançado sem #teste');
  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos&despesa=${id}`);
  const detalhe = page.getByRole('dialog', { name: 'Teste lançado sem #teste' });
  await detalhe.getByRole('button', { name: 'Mudar unidade' }).click();
  await detalhe.getByLabel('Motivo').fill('lançamento de teste sem #teste');
  await detalhe.getByRole('form', { name: 'Mudar unidade' }).getByRole('button', { name: 'Mudar unidade' }).click();
  await expect(page.getByText('Despesa levada para Âmbar · TESTES (demo).')).toBeVisible();
  expect(await idDaDespesa(page, 'Teste lançado sem #teste')).toBeUndefined();
  const compra = (await (await page.request.get(`${API}/lancamentos?de=2000-01-01&ate=2100-01-01&tipo=despesa`)).json()).itens.find((x: { compra_id: string | null }) => x.compra_id);
  const recusa = await page.request.post(`${API}/despesas/${compra.id}/unidade`, { headers: escrever, data: { unidade: 'ambar_teste', versao: compra.detalhes.versao, motivo: 'tentativa de teste' } });
  expect(recusa.status()).toBe(409);
  expect((await recusa.json()).codigo).toBe('despesa_de_compra');

  // Na unidade de testes, o documento está na fila e a faixa de teste aparece.
  await page.locator('[data-unidade]').selectOption('ambar_teste');
  await expect(page.locator('[data-unidade-teste]')).toBeVisible();
  await abrirRevisao(page);
  await expect(page.getByRole('button', { name: /TESTE JULIA/ })).toBeVisible();
  expect(await idDaDespesa(page, 'Teste lançado sem #teste')).toBeTruthy();
});

test('API falhando ou incompleta: a tela avisa e não quebra', async ({ page }) => {
  // 1) Fila fora do ar: mensagem de falha, abas continuam.
  await page.route('**/admin/api/financeiro/revisao?*', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'O sistema do Âmbar está em manutenção.', codigo: 'indisponivel' }) }));
  await page.goto(`${DEMO}/admin/financeiro?aba=revisao`);
  await expect(page.getByText('O sistema do Âmbar está em manutenção.')).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Revisão/ })).toBeVisible();
  await page.unroute('**/admin/api/financeiro/revisao?*');

  // 2) Resposta incompleta (backend antigo: sem as listas novas, `extraido` nulo, despesa misturada em `candidatas`).
  const incompleto = {
    documentos: {
      itens: [
        { id: 'aaaaaaaa-0000-4000-8000-000000000001', tipo_documento: 'nota_compra', legenda: 'nota antiga', autor_nome: null, extraido: null, motivos: null, candidatas: [{ despesa_id: 'bbbbbbbb-0000-4000-8000-000000000001', descricao: 'Compra antiga do atacado', valor: '90.00' }], arquivo_id: null, criado_em: new Date().toISOString() },
        { id: 'aaaaaaaa-0000-4000-8000-000000000002', tipo_documento: 'comprovante_pagamento', legenda: 'pix antigo', autor_nome: null, extraido: { valor: '50.00' }, candidatas: [{ parcela_id: 'cccccccc-0000-4000-8000-000000000001', despesa_id: 'bbbbbbbb-0000-4000-8000-000000000002', descricao: 'Conta sem evidências', saldo: '50.00', vencimento: hoje(), forca: 'fraca' }], arquivo_id: null, criado_em: new Date().toISOString() },
      ],
    },
  };
  await page.route('**/admin/api/financeiro/revisao?*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(incompleto) }));
  await page.route('**/admin/api/financeiro/revisao/documentos/*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not Found' }) }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Despesas para revisar (0)' })).toBeVisible();
  await page.getByRole('button', { name: /nota antiga/ }).click();
  let gaveta = page.getByRole('dialog');
  await expect(gaveta.getByRole('region', { name: 'Despesas já lançadas' })).toContainText('Compra antiga do atacado');
  await expect(gaveta.getByRole('button', { name: /Marcar .* paga/ })).toHaveCount(0);
  await gaveta.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: /pix antigo/ }).click();
  gaveta = page.getByRole('dialog');
  await expect(gaveta.getByRole('region', { name: 'Contas que este comprovante pode pagar' })).toContainText('Conta sem evidências');

  // 3) 409 conflito_versao ao corrigir: avisa e pede para conferir, sem fechar a tela.
  await page.route('**/admin/api/financeiro/revisao/documentos/*', (r) =>
    r.request().method() === 'PATCH'
      ? r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: 'Versão desatualizada.', codigo: 'conflito_versao', dados: { versao: 3 } }) })
      : r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not Found' }) }),
  );
  await gaveta.getByRole('button', { name: 'Corrigir leitura' }).click();
  const form = gaveta.getByRole('form', { name: 'Corrigir leitura' });
  await form.getByLabel('Valor').fill('55,00');
  await form.getByLabel('Motivo da correção').fill('valor lido no papel');
  await form.getByRole('button', { name: 'Salvar correção' }).click();
  await expect(form.getByText(/Alguém alterou isto enquanto você editava/)).toBeVisible();

  // 4) 422 do resolver com o texto do backend.
  await page.route('**/admin/api/financeiro/revisao/documentos/*/resolver', (r) => r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: 'A categoria “Embalagens” não está ativa nesta unidade.', codigo: 'categoria_inativa_na_unidade' }) }));
  await form.getByRole('button', { name: 'Voltar' }).click();
  const registrar = gaveta.getByRole('region', { name: 'Registrar como despesa' });
  await registrar.getByLabel('Categoria').selectOption('embalagens');
  await registrar.getByLabel('Data do pagamento').fill(hoje());
  await registrar.getByRole('button', { name: 'Registrar como despesa' }).click();
  await expect(registrar.getByText('A categoria “Embalagens” não está ativa nesta unidade.')).toBeVisible();
});
