// Estoque CONTRA O BACKEND REAL local (base isolada `ambar_integracao_estoque`, dados fictícios, baixa automática
// desligada). O JSON vem de um preparo fora dos repositórios: unidades ambar_cafe/ambar_noite, gerente só no Café, dono
// nas duas, quatro insumos sem movimento e um Pix de insumos lançado pela Júlia com a pendência no Estoque.
//   PAINEL_REAL_API=http://127.0.0.1:8766 PAINEL_REAL_CHAVE=<painel_chave> PAINEL_REAL_ESTOQUE=<estoque.json> \
//     npx playwright test -c playwright.painel-real.config.ts tests-painel-real/estoque.spec.ts
// A ordem importa (1 worker, um arquivo): abertura do estoque → recebimento da Júlia → saída → contagem posterior → ajuste.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const PAINEL = 'http://127.0.0.1:4494';
const API = `${PAINEL}/admin/api`;
const caminho = process.env.PAINEL_REAL_ESTOQUE ?? '';
test.skip(!caminho, 'Defina PAINEL_REAL_ESTOQUE (JSON do preparo da integração do Estoque).');

interface Integracao {
  senha: string;
  contas: Record<'gerente' | 'dono', string>;
  ids: Record<'Leite integral' | 'Café em grãos' | 'Ovos' | 'Cogumelo paris' | 'pix_despesa_id' | 'pix_compra_id', string>;
}
const E: Integracao = caminho ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : ({} as Integracao);
const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: PAINEL };

async function entrar(page: Page, conta: 'gerente' | 'dono') {
  const r = await page.request.post(`${API}/sessao`, { headers: escrever, data: { email: E.contas[conta], senha: E.senha } });
  if (!r.ok()) throw new Error(`login ${conta} falhou: ${r.status()}`);
}
const saldo = async (page: Page, nome: keyof Integracao['ids']) => {
  const l = await (await page.request.get(`${API}/estoque/insumos?limite=200`)).json();
  return l.itens.find((i: { id: string }) => i.id === E.ids[nome]) as { saldo: string; ultima_contagem_em: string | null; motivo_nao_confiavel: string | null };
};
const linha = (page: Page, nome: string) => page.getByRole('table', { name: 'Estoque atual' }).getByRole('row', { name: new RegExp(nome) });

let erros: string[] = [];
test.beforeEach(({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
});
test.afterEach(() => expect(erros).toEqual([]));

test('lista real: nada conferido ainda, sem zero inventado, baixa automática desligada', async ({ page }) => {
  await entrar(page, 'gerente');
  const resumo = await (await page.request.get(`${API}/estoque/resumo`)).json();
  expect(resumo.baixa_automatica).toBe(false);
  await page.goto(`${PAINEL}/admin/estoque`);
  for (const n of ['Leite integral', 'Café em grãos', 'Ovos', 'Cogumelo paris']) {
    await expect(linha(page, n)).toContainText('Não conferido');
    await expect(linha(page, n)).toContainText('—');
  }
  await expect(page.locator('.estoque-numero', { hasText: 'Abaixo do mínimo' })).toContainText('0');
  await expect(page.getByText('Baixa automática pelas vendas:')).toContainText('desligada');
});

test('contagem inicial: três itens viram saldo de partida, com o nome de quem confirmou', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/estoque?aba=contagem`);
  await page.getByRole('radio', { name: /Escolher insumos/ }).check();
  for (const n of ['Leite integral', 'Café em grãos', 'Ovos']) await page.getByRole('checkbox', { name: new RegExp(n) }).check();
  await page.getByRole('button', { name: 'Começar contagem (3 itens)' }).click();
  const tabela = page.getByRole('table', { name: 'Quantidades contadas' });
  // Mínimo de 10.000 ml / 2.000 g: a linha é contada em L / kg (o painel envia ml / g ao backend).
  for (const [nome, valor] of [['Leite integral', '12'], ['Café em grãos', '3'], ['Ovos', '40']] as const) {
    const campo = tabela.getByLabel(new RegExp(`Quantidade contada de ${nome}`));
    await campo.fill(valor);
    await campo.press('Enter');
    await expect(tabela.getByRole('row', { name: new RegExp(nome) })).toContainText('Salvo');
  }
  await page.getByRole('button', { name: 'Revisar diferenças' }).click();
  await expect(page.getByRole('table', { name: 'Diferenças da contagem' }).getByText('Saldo inicial')).toHaveCount(3);
  await page.getByRole('button', { name: 'Confirmar contagem' }).click();
  await page.getByRole('dialog', { name: 'Confirmar a contagem?' }).getByRole('button', { name: 'Confirmar contagem' }).click();
  await expect(page.getByRole('table', { name: 'Ajustes da contagem' }).getByText('Saldo inicial')).toHaveCount(3);

  expect((await saldo(page, 'Leite integral')).saldo).toBe('12000.0000');
  expect((await saldo(page, 'Ovos')).ultima_contagem_em).not.toBeNull();
  const movs = await (await page.request.get(`${API}/estoque/insumos/${E.ids['Leite integral']}/movimentos`)).json();
  expect(movs.itens[0]).toMatchObject({ tipo: 'ajuste_inventario', quantidade: '12000.0000' });
  expect(movs.itens[0].inventario_item_id).not.toBeNull();

  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByRole('table', { name: 'Contagens anteriores' })).toContainText('Gabriela Integração');
  await page.getByRole('tab', { name: 'Estoque atual' }).click();
  await expect(linha(page, 'Leite integral')).toContainText('Normal');
  await expect(linha(page, 'Cogumelo paris')).toContainText('Não conferido');
});

test('Pix da Júlia: os produtos conferem o MESMO pagamento, nenhuma despesa nova, e só então entram no estoque', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/estoque?aba=recebimentos`);
  const pix = page.getByRole('table', { name: 'Recebimentos pendentes' }).getByRole('row', { name: /VO CHIQUINHA FOOD LTDA/ });
  await expect(pix).toContainText('Júlia');
  await expect(pix).toContainText('comprovante de pagamento');
  await expect(pix).toContainText('R$ 172,00');
  await expect(pix).toContainText('Faltam os produtos');
  await pix.getByRole('button', { name: 'Conferir' }).click();

  const gaveta = page.getByRole('dialog');
  await expect(gaveta.getByText('Produtos e quantidades ainda não informados.')).toBeVisible();
  await gaveta.getByRole('combobox', { name: 'Produto 1' }).fill('leite');
  await page.getByRole('option', { name: /Leite integral/ }).click();
  await gaveta.getByLabel('Qtd.').nth(0).fill('10');
  await gaveta.getByLabel('Unid.').nth(0).selectOption('L');
  await gaveta.getByLabel('Valor unit.').nth(0).fill('8,60');
  await gaveta.getByRole('combobox', { name: 'Produto 2' }).fill('café');
  await page.getByRole('option', { name: /Café em grãos/ }).click();
  await gaveta.getByLabel('Qtd.').nth(1).fill('1');
  await gaveta.getByLabel('Unid.').nth(1).selectOption('KG');
  await gaveta.getByLabel('Valor unit.').nth(1).fill('86,00');
  await expect(gaveta.locator('[data-teste="soma-produtos"]')).toContainText('confere');
  // Pagamento registrado ≠ produtos recebidos: até confirmar, nada entra.
  expect((await saldo(page, 'Leite integral')).saldo).toBe('12000.0000');
  await gaveta.getByRole('button', { name: 'Salvar produtos' }).click();
  await expect(gaveta.getByText(/igual ao pagamento no Financeiro/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(gaveta.getByText('É o pagamento que a Júlia registrou')).toBeVisible();
  await expect(gaveta.getByText('Conta a pagar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(gaveta.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();

  const final = new URL(page.url()).searchParams.get('compra')!;
  const compra = await (await page.request.get(`${API}/estoque/compras/${final}`)).json();
  expect(compra.etapa).toBe('confirmada');
  expect(compra.despesa.despesa_id).toBe(E.ids.pix_despesa_id);
  const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const lanc = await (await page.request.get(`${API}/financeiro/lancamentos?de=${d(-30)}&ate=${d(30)}&tipo=despesa&busca=${encodeURIComponent('CHIQUINHA')}`)).json();
  expect(lanc.itens).toHaveLength(1);
  expect((await saldo(page, 'Leite integral')).saldo).toBe('22000.0000');
  expect((await saldo(page, 'Café em grãos')).saldo).toBe('4000.0000');
});

test('saída manual (uso interno) pelo Registrar movimento: sai do saldo com motivo e responsável', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/estoque`);
  await page.getByRole('button', { name: 'Registrar movimento' }).click();
  await page.getByRole('dialog', { name: 'Registrar movimento' }).getByRole('button', { name: /Saída/ }).click();
  const saida = page.getByRole('dialog', { name: 'Saída' });
  await saida.getByRole('combobox', { name: 'Insumo' }).fill('ovos');
  await page.getByRole('option', { name: /Ovos/ }).click();
  await saida.getByLabel('Quantidade que saiu').fill('4');
  await saida.getByLabel('Motivo').selectOption('uso_interno');
  await saida.getByLabel('Observação').fill('café da manhã da equipe');
  await saida.getByRole('button', { name: 'Registrar saída' }).click();
  await expect(page.getByText('Saída registrada: Ovos.')).toBeVisible();
  expect((await saldo(page, 'Ovos')).saldo).toBe('36.0000');
  const movs = await (await page.request.get(`${API}/estoque/insumos/${E.ids.Ovos}/movimentos`)).json();
  expect(movs.itens[0]).toMatchObject({ tipo: 'perda', quantidade: '-4.0000', motivo: 'outro: Uso interno: café da manhã da equipe' });

  await linha(page, 'Ovos').click();
  const insumo = page.getByRole('dialog', { name: 'Ovos' });
  const ultimo = insumo.locator('.movimento').first();
  await expect(ultimo).toContainText('Saída manual');
  await expect(ultimo).toContainText('Uso interno: café da manhã da equipe');
  await expect(ultimo).toContainText('Gabriela Integração');
  await expect(insumo).not.toContainText('usuario:');
});

test('contagem posterior: diferença positiva e negativa viram ajustes ligados à contagem', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/estoque?aba=contagem`);
  await page.getByRole('radio', { name: /Escolher insumos/ }).check();
  for (const n of ['Leite integral', 'Ovos']) await page.getByRole('checkbox', { name: new RegExp(n) }).check();
  await page.getByRole('button', { name: 'Começar contagem (2 itens)' }).click();
  const tabela = page.getByRole('table', { name: 'Quantidades contadas' });
  for (const [nome, valor] of [['Leite integral', '21'], ['Ovos', '38']] as const) {
    const campo = tabela.getByLabel(new RegExp(`Quantidade contada de ${nome}`));
    await campo.fill(valor);
    await campo.press('Enter');
    await expect(tabela.getByRole('row', { name: new RegExp(nome) })).toContainText('Salvo');
  }
  await page.getByRole('button', { name: 'Revisar diferenças' }).click();
  const revisao = page.getByRole('table', { name: 'Diferenças da contagem' });
  await expect(revisao.getByRole('row', { name: /Leite integral/ })).toContainText('-1 L');
  await expect(revisao.getByRole('row', { name: /Ovos/ })).toContainText('+2 un');
  await page.getByRole('button', { name: 'Confirmar contagem' }).click();
  await page.getByRole('dialog', { name: 'Confirmar a contagem?' }).getByRole('button', { name: 'Confirmar contagem' }).click();
  const ajustes = page.getByRole('table', { name: 'Ajustes da contagem' });
  await expect(ajustes.getByRole('row', { name: /Leite integral/ })).toContainText('-1 L');
  await expect(ajustes.getByRole('row', { name: /Ovos/ })).toContainText('+2 un');
  expect((await saldo(page, 'Leite integral')).saldo).toBe('21000.0000');
  expect((await saldo(page, 'Ovos')).saldo).toBe('38.0000');
});

test('ajuste avulso: contagem de um item, estoque baixo e nenhuma contagem aberta pela metade', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/estoque`);
  await linha(page, 'Café em grãos').click();
  await page.getByRole('dialog', { name: 'Café em grãos' }).getByRole('button', { name: 'Ajuste' }).click();
  const ajuste = page.getByRole('dialog', { name: 'Ajuste de saldo' });
  await ajuste.getByLabel('Quantidade real agora').fill('1,5');
  await expect(ajuste.locator('.ajuste-previa')).toContainText('-2,5 kg');
  await ajuste.getByRole('button', { name: 'Registrar ajuste' }).click();
  await expect(ajuste.getByRole('heading', { name: 'Saldo ajustado' })).toBeVisible();
  await ajuste.getByRole('button', { name: 'Concluir' }).click();
  await page.keyboard.press('Escape');
  expect((await saldo(page, 'Café em grãos')).saldo).toBe('1500.0000');
  await expect(linha(page, 'Café em grãos')).toContainText('Estoque baixo');
  const abertas = await (await page.request.get(`${API}/estoque/inventarios?status=aberto`)).json();
  expect(abertas).toHaveLength(0);
});

test('isolamento: saldo é por unidade; o gerente do Café não lê a Noite', async ({ page }) => {
  await entrar(page, 'dono');
  const noite = await (await page.request.get(`${API}/estoque/insumos?limite=200`, { headers: { 'X-Painel-Unidade': 'ambar_noite' } })).json();
  const leite = noite.itens.find((i: { id: string }) => i.id === E.ids['Leite integral']);
  expect(leite.saldo).not.toBe('21000.0000');
  expect(leite.motivo_nao_confiavel).toBe('sem_movimento');
  await page.context().clearCookies();
  await entrar(page, 'gerente');
  const proibido = await page.request.get(`${API}/estoque/insumos?limite=200`, { headers: { 'X-Painel-Unidade': 'ambar_noite' } });
  expect(proibido.ok()).toBe(false);
});

test('fichas e custos sem vendas: nada inventado; CMV indisponível com o motivo', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/estoque?aba=custos`);
  await expect(page.getByText('Os produtos aparecem quando chegam vendas da Eyemobile.')).toBeVisible();
  await page.getByRole('group', { name: 'Fichas e custos' }).getByRole('button', { name: 'CMV e custos' }).click();
  await expect(page.getByRole('region', { name: 'CMV teórico' })).toContainText('Indisponível');
  await expect(page.getByText(/Pode faltar|Reposição sugerida/)).toHaveCount(0);
});
