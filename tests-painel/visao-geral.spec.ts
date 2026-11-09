// Visão Geral (demonstração e respostas simuladas): os números na tela são os do backend, sem loja ligada não há zero nem
// faixa de aviso, e falha de API aparece onde aconteceu, com nova tentativa. Não prova a integração real com a Eyemobile.
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const SEM_LOJA = 'A loja do PDV desta unidade não está ligada: a receita é desconhecida.';
const brl = (v: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
const kpi = (page: Page, nome: string) => page.locator('.indicador', { hasText: nome });

async function semLoja(page: Page) {
  await page.route('**/admin/api/financeiro/relatorios/vendas*', (r) => {
    const u = new URL(r.request().url());
    return r.fulfill({ json: { disponivel: false, de: u.searchParams.get('de'), ate: u.searchParams.get('ate'), agrupar: u.searchParams.get('agrupar'), motivo: SEM_LOJA } });
  });
}

test.beforeEach(async ({ page }) => {
  await entrarDemo(page, 'gerente');
});

test('receita, despesas e ticket médio são os totais do backend no período', async ({ page }) => {
  // "Este mês", o período padrão: do dia 1 até hoje (as outras consultas pedem o mês anterior e a janela do gráfico).
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const doPeriodo = (u: string) => u.includes(`de=${hoje.slice(0, 8)}01`) && u.includes(`ate=${hoje}`);
  const respostaVendas = page.waitForResponse((r) => /relatorios\/vendas\?/.test(r.url()) && doPeriodo(r.url()) && r.ok());
  const respostaCategorias = page.waitForResponse((r) => /despesas-por-categoria\?/.test(r.url()) && doPeriodo(r.url()) && r.ok());
  await page.goto(`${DEMO}/admin`);
  const vendas = await (await respostaVendas).json();
  const categorias = await (await respostaCategorias).json();
  expect(vendas.disponivel).toBe(true);
  await expect(kpi(page, 'Receita').locator('.indicador__valor')).toHaveText(brl(vendas.totais.receita_liquida));
  await expect(kpi(page, 'Despesas').locator('.indicador__valor')).toHaveText(brl(categorias.total));
  await expect(kpi(page, 'Ticket médio').locator('.indicador__valor')).toHaveText(brl(vendas.totais.ticket_medio));
  await expect(kpi(page, 'Receita')).toContainText('Vendas líquidas');
  await expect(kpi(page, 'Despesas')).toContainText('Confirmadas por competência');
  await expect(page.getByRole('heading', { name: 'Produtos mais vendidos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Despesas por categoria' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Receitas × despesas' })).toBeVisible();
});

test('receitas × despesas: receita verde e despesa vermelha nas barras, na legenda e na dica; o vinho fica na marca', async ({ page }) => {
  await page.goto(`${DEMO}/admin`);
  const cartao = page.locator('.cartao', { has: page.getByRole('heading', { name: 'Receitas × despesas' }) });
  const grafico = cartao.locator('.grafico svg');
  await expect(grafico).toBeVisible();
  const VERDE = 'rgb(47, 107, 70)';
  const VERMELHO = 'rgb(192, 71, 59)';
  // legenda: nome + cor (não depende só da cor)
  await expect(cartao.locator('.legenda')).toContainText('Receita');
  await expect(cartao.locator('.legenda')).toContainText('Despesas');
  expect(await cartao.locator('.legenda i').nth(0).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(VERDE);
  expect(await cartao.locator('.legenda i').nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(VERMELHO);
  // barras: só as duas cores das séries
  const fills = await grafico.locator('rect[rx]').evaluateAll((rs) => [...new Set(rs.map((r) => getComputedStyle(r).fill))]);
  expect(fills.length).toBeGreaterThan(0);
  for (const f of fills) expect([VERDE, VERMELHO]).toContain(f);
  // dica ao passar o mouse: amostra da cor ao lado do nome de cada série
  const caixa = (await grafico.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width * 0.9, caixa.y + caixa.height * 0.5);
  const dica = cartao.locator('.grafico__dica');
  await expect(dica).toBeVisible();
  await expect(dica.locator('.grafico__dica-serie')).toHaveText(['Receita', 'Despesas']);
  expect(await dica.locator('.grafico__dica-serie i').nth(0).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(VERDE);
  expect(await dica.locator('.grafico__dica-serie i').nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(VERMELHO);
  // a marca continua vinho
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--marca').trim())).toBe('#670d27');
});

test('receitas × despesas sem vendas sincronizadas: nenhuma barra verde (receita indisponível não vira zero)', async ({ page }) => {
  await semLoja(page);
  await page.goto(`${DEMO}/admin`);
  const cartao = page.locator('.cartao', { has: page.getByRole('heading', { name: 'Receitas × despesas' }) });
  await expect(cartao.getByText(/Receita indisponível/)).toBeVisible();
  const fills = await cartao.locator('.grafico svg rect[rx]').evaluateAll((rs) => rs.map((r) => getComputedStyle(r).fill));
  expect(fills).not.toContain('rgb(47, 107, 70)');
  const caixa = (await cartao.locator('.grafico svg').boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width * 0.9, caixa.y + caixa.height * 0.5);
  await expect(cartao.locator('.grafico__dica')).toContainText('—');
});

test('o filtro de período muda o intervalo pedido ao backend', async ({ page }) => {
  await page.goto(`${DEMO}/admin`);
  await expect(kpi(page, 'Receita').locator('.indicador__valor')).not.toHaveText('—');
  const pedido = page.waitForRequest((r) => /relatorios\/vendas\?/.test(r.url()) && /agrupar=dia/.test(r.url()));
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: '7 dias' }).click();
  const u = new URL((await pedido).url());
  const dias = (Date.parse(u.searchParams.get('ate')!) - Date.parse(u.searchParams.get('de')!)) / 86_400_000;
  expect(dias).toBe(6);
  await expect(page.getByRole('group', { name: 'Período' }).getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');
  await expect(kpi(page, 'Resultado gerencial')).toContainText('Apurado por mês');
});

test('sem a loja do PDV ligada: nenhum aviso amarelo, "—" e nunca R$ 0,00 de receita', async ({ page }) => {
  await semLoja(page);
  await page.goto(`${DEMO}/admin`);
  await expect(kpi(page, 'Receita')).toContainText('Sem vendas sincronizadas');
  await expect(page.getByText('Aguardando dados de vendas')).toHaveCount(0);
  await expect(page.locator('.aviso')).toHaveCount(0);
  await expect(kpi(page, 'Receita').locator('.indicador__valor')).toHaveText('—');
  await expect(kpi(page, 'Ticket médio').locator('.indicador__valor')).toHaveText('—');
  // as despesas continuam: vêm do Financeiro, não da Eyemobile
  await expect(kpi(page, 'Despesas').locator('.indicador__valor')).not.toHaveText('—');
  await expect(page.getByText('Receita indisponível: as vendas da Eyemobile ainda não estão sincronizadas.')).toBeVisible();
});

test('erro da API de vendas não vira "sem vendas": aparece no indicador e o "Tentar de novo" recupera', async ({ page }) => {
  let falhar = true;
  await page.route('**/admin/api/financeiro/relatorios/vendas*', (r) => (falhar ? r.fulfill({ status: 500, json: { detail: 'erro' } }) : r.fallback()));
  await page.goto(`${DEMO}/admin`);
  const receita = kpi(page, 'Receita');
  await expect(receita.locator('.indicador__falha')).toContainText('O sistema teve um problema');
  await expect(receita.getByRole('link')).toHaveCount(0);
  await expect(page.locator('a.indicador', { hasText: 'Receita' })).toHaveCount(0);
  await expect(page.getByText('Sem vendas sincronizadas')).toHaveCount(0);
  await expect(page.getByText('Receita indisponível')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar' }).first()).toBeVisible();
  falhar = false;
  await receita.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(receita.locator('.indicador__falha')).toHaveCount(0);
  await expect(receita.locator('.indicador__valor')).toContainText('R$');
});

test('erro nas despesas fica no indicador e no cartão de despesas, com nova tentativa', async ({ page }) => {
  let falhar = true;
  await page.route('**/admin/api/financeiro/relatorios/despesas-por-categoria*', (r) => (falhar ? r.fulfill({ status: 503, json: { detail: 'Fora do ar.' } }) : r.fallback()));
  await page.goto(`${DEMO}/admin`);
  await expect(kpi(page, 'Despesas').locator('.indicador__falha')).toContainText('Fora do ar.');
  await expect(kpi(page, 'Receita').locator('.indicador__falha')).toHaveCount(0);
  falhar = false;
  await kpi(page, 'Despesas').getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(kpi(page, 'Despesas').locator('.indicador__falha')).toHaveCount(0);
  await expect(kpi(page, 'Despesas').locator('.indicador__valor')).toContainText('R$');
});

test('erro nos produtos aparece no cartão, sem trocar de assunto para as formas de pagamento', async ({ page }) => {
  let falhar = true;
  await page.route('**/admin/api/estoque/analises/produtos*', (r) => (falhar ? r.fulfill({ status: 500, json: { detail: 'erro' } }) : r.fallback()));
  await page.goto(`${DEMO}/admin`);
  const cartao = page.locator('.cartao', { has: page.getByRole('heading', { name: 'Produtos mais vendidos' }) });
  await expect(cartao.getByRole('heading', { name: 'Não foi possível carregar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vendas por forma de pagamento' })).toHaveCount(0);
  falhar = false;
  await cartao.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(cartao.getByRole('list', { name: 'Produtos mais vendidos' }).or(cartao.getByText('Sem vendas por produto no período'))).toBeVisible();
});

test('período sem nenhum dado: estados vazios, não números inventados', async ({ page }) => {
  const zero = { faturamento_bruto: '0.00', descontos: '0.00', receita_liquida_produtos: '0.00', devolucoes: '0.00', receita_liquida: '0.00', taxa_servico: '0.00', recebido_pdv: '0.00', vendas: 0, vendas_canceladas: 0, ticket_medio: null };
  await page.route('**/admin/api/financeiro/relatorios/vendas*', (r) => {
    const u = new URL(r.request().url());
    return r.fulfill({ json: { disponivel: true, de: u.searchParams.get('de'), ate: u.searchParams.get('ate'), agrupar: 'dia', periodos: [], totais: zero, por_meio: [], sincronizacao: { ultimo_sucesso_em: new Date().toISOString(), falhas_seguidas: 0, atrasada: false }, observacao: '' } });
  });
  await page.route('**/admin/api/financeiro/relatorios/despesas-por-categoria*', (r) => r.fulfill({ json: { total: '0.00', itens: [] } }));
  await page.route('**/admin/api/financeiro/lancamentos*', (r) => r.fulfill({ json: { total: 0, itens: [] } }));
  await page.route('**/admin/api/estoque/analises/produtos*', (r) => r.fulfill({ json: [] }));
  await page.goto(`${DEMO}/admin`);
  await expect(page.getByText('Nenhuma despesa confirmada no período')).toBeVisible();
  await expect(page.getByText('Sem vendas por produto no período')).toBeVisible();
  await expect(kpi(page, 'Ticket médio')).toContainText('Nenhuma venda no período');
});
