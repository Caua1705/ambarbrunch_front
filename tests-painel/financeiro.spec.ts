// Financeiro na demonstração (backend falso, nada real é lançado): as três abas (Movimentações, Pendências, Relatórios),
// os endereços antigos abrindo a parte nova certa, os filtros simples de Movimentações, criar despesa e outra receita,
// pagar uma conta sem duplicar registros, os contadores de Pendências, Relatórios em dois níveis, os cadastros em
// Configurações e o que é só do Proprietário (participação da Roll) — a gerente não vê na tela e a rota responde 403.
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const API = `${DEMO}/admin/api/financeiro`;
const aba = (page: Page, nome: RegExp) => page.getByRole('tablist', { name: 'Seções' }).getByRole('tab', { name: nome });
const tipo = (page: Page) => page.getByRole('group', { name: 'Tipo de movimentação' });
const pendencias = (page: Page) => page.getByRole('group', { name: 'Pendências' });
async function fecharDetalhe(page: Page, nome: string) {
  const detalhe = page.getByRole('dialog', { name: nome });
  await detalhe.getByRole('button', { name: 'Fechar' }).click();
  await expect(detalhe).toHaveCount(0);
}

let erros: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrarDemo(page, 'gerente');
});
test.afterEach(() => expect(erros).toEqual([]));

test('três abas, sem segundo dashboard', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro`);
  const abas = page.getByRole('tablist', { name: 'Seções' }).getByRole('tab');
  await expect(abas).toHaveCount(3);
  for (const [i, nome] of [/^Movimentações/, /^Pendências/, /^Relatórios/].entries()) await expect(abas.nth(i)).toHaveText(nome);
  await expect(aba(page, /^Movimentações/)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.indicador')).toHaveCount(0);
  for (const nome of ['Todas', 'Despesas', 'Outras receitas', /^A pagar/]) await expect(tipo(page).getByRole('button', { name: nome })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova despesa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Outra receita' })).toBeVisible();
});

test('endereços antigos caem na aba e na parte novas', async ({ page }) => {
  const casos: [string, RegExp, (p: Page) => Promise<void>][] = [
    ['aba=lancamentos', /^Movimentações/, async (p) => expect(tipo(p).getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')],
    ['aba=contas', /^Movimentações/, async (p) => expect(tipo(p).getByRole('button', { name: /^A pagar/ })).toHaveAttribute('aria-pressed', 'true')],
    ['aba=contas&situacao=vencidas', /^Movimentações/, async (p) => expect(p.getByRole('group', { name: 'Situação das contas' }).getByRole('button', { name: /^Vencidas/ })).toHaveAttribute('aria-pressed', 'true')],
    ['aba=contas-fixas', /^Movimentações/, async (p) => expect(p.getByRole('button', { name: 'Voltar às contas a pagar' })).toBeVisible()],
    ['aba=revisao', /^Pendências/, async (p) => expect(pendencias(p).getByRole('button', { name: /^Revisão da Júlia/ })).toHaveAttribute('aria-pressed', 'true')],
    ['aba=lancamentos&revisar=1', /^Pendências/, async (p) => expect(p.getByRole('heading', { name: /Documentos do grupo/ })).toBeVisible()],
    ['aba=conciliacao', /^Pendências/, async (p) => expect(pendencias(p).getByRole('button', { name: /^Banco/ })).toHaveAttribute('aria-pressed', 'true')],
    ['aba=conciliacao&vista=stone', /^Pendências/, async (p) => expect(p.getByRole('table', { name: 'Repasses por meio' })).toBeVisible()],
    ['aba=conciliacao&vista=divergencias', /^Pendências/, async (p) => expect(pendencias(p).getByRole('button', { name: 'Divergências' })).toHaveAttribute('aria-pressed', 'true')],
    ['aba=taxas', /^Pendências/, async (p) => expect(pendencias(p).getByRole('button', { name: 'Stone e recebíveis' })).toHaveAttribute('aria-pressed', 'true')],
    ['aba=relatorios', /^Relatórios/, async (p) => expect(p.getByRole('navigation', { name: 'Relatórios' }).getByRole('button', { name: 'Resultado do mês' })).toHaveAttribute('aria-current', 'page')],
    ['aba=resultado', /^Relatórios/, async (p) => expect(p.getByRole('navigation', { name: 'Relatórios' }).getByRole('button', { name: 'Resultado do mês' })).toHaveAttribute('aria-current', 'page')],
    ['aba=resultado&vista=evolucao', /^Relatórios/, async (p) => expect(p.getByRole('navigation', { name: 'Relatórios' }).getByRole('button', { name: 'Evolução financeira' })).toHaveAttribute('aria-current', 'page')],
    ['aba=vendas', /^Relatórios/, async (p) => expect(p.getByRole('navigation', { name: 'Relatórios' }).getByRole('button', { name: 'Vendas (Eyemobile)' })).toHaveAttribute('aria-current', 'page')],
  ];
  for (const [antigo, nomeAba, conferir] of casos) {
    await page.goto(`${DEMO}/admin/financeiro?${antigo}`);
    await expect(aba(page, nomeAba), antigo).toHaveAttribute('aria-selected', 'true');
    await conferir(page);
  }
  // A aba nova fica na URL (recarregar abre o mesmo lugar).
  await page.goto(`${DEMO}/admin/financeiro?aba=conciliacao`);
  await expect(page).toHaveURL(/aba=pendencias&vista=banco|vista=banco&aba=pendencias/);

  // Cadastros saíram do Financeiro: os endereços antigos levam a Configurações → Financeiro.
  await page.goto(`${DEMO}/admin/financeiro?aba=categorias`);
  await expect(page).toHaveURL(/\/admin\/configuracoes\?secao=financeiro/);
  await expect(page.getByRole('list', { name: 'Categorias ativas' })).toBeVisible();
  await page.goto(`${DEMO}/admin/financeiro?aba=relatorios&relatorio=fornecedores`);
  await expect(page).toHaveURL(/cadastro=fornecedores/);
  await expect(page.getByRole('table', { name: 'Fornecedores' })).toBeVisible();
});

test('Movimentações: os filtros simples pedem só o tipo escolhido e mostram só os totais que ele calcula', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro`);
  const totais = page.getByLabel('Totais do período');
  await expect(totais).toContainText('Vendas do PDV (Eyemobile)');
  await expect(totais).toContainText('Pagamentos realizados');
  await expect(totais).toContainText('A pagar em aberto');
  // o mesmo número que a vista A pagar mostra em "Falta pagar" (mesma consulta, nunca duas fontes)
  const emAberto = (await totais.locator('span', { hasText: 'A pagar em aberto' }).locator('strong').textContent())!.trim();
  await tipo(page).getByRole('button', { name: /^A pagar/ }).click();
  await expect(page.locator('.fin-totais div', { hasText: 'Falta pagar' }).locator('strong')).toHaveText(emAberto);
  await tipo(page).getByRole('button', { name: 'Todas' }).click();

  const pedido = (t: string) => page.waitForRequest((r) => r.url().includes('/financeiro/lancamentos?') && new URL(r.url()).searchParams.get('tipo') === t);
  const despesas = pedido('despesa');
  await tipo(page).getByRole('button', { name: 'Despesas' }).click();
  await despesas;
  await expect(page).toHaveURL(/tipo=despesas/);
  await expect(totais).toContainText('Despesas confirmadas');
  await expect(totais).not.toContainText('Outras receitas');

  const receitas = pedido('outra_receita');
  await tipo(page).getByRole('button', { name: 'Outras receitas' }).click();
  await receitas;
  await expect(totais).toContainText('Outras receitas');
  await expect(totais).not.toContainText('Despesas confirmadas');

  await tipo(page).getByRole('button', { name: /^A pagar/ }).click();
  const contas = page.getByRole('table', { name: 'Contas a pagar' });
  await expect(contas).toBeVisible();
  await expect(contas.getByRole('button', { name: 'Pagar' }).first()).toBeVisible();
  // A busca da barra vale também para as contas.
  const primeira = (await contas.getByRole('row').nth(1).locator('.principal-celula').textContent())!.trim().split(' · ')[0];
  await page.getByLabel('Buscar movimentação').fill('zzz-nada-com-isso');
  await expect(page.getByText('Nenhuma conta com essa busca')).toBeVisible();
  await page.getByLabel('Buscar movimentação').fill(primeira.slice(0, 6));
  await expect(contas.getByRole('row', { name: new RegExp(primeira.slice(0, 6)) }).first()).toBeVisible();
});

test('Nova despesa já paga aparece uma vez em Todas (o pagamento só com "Tudo") e não vira conta em aberto', async ({ page }) => {
  const nome = `Despesa paga ${Date.now()}`;
  await page.goto(`${DEMO}/admin/financeiro`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await gaveta.getByLabel('Descrição').fill(nome);
  await gaveta.getByLabel('Valor').fill('37,90');
  await gaveta.getByLabel('Categoria').selectOption({ label: 'Operacional' });
  await gaveta.getByRole('group', { name: 'Situação do pagamento' }).getByRole('button', { name: 'Já foi paga' }).click();
  await gaveta.getByRole('button', { name: 'Lançar despesa' }).click();
  await expect(gaveta).toHaveCount(0);
  await fecharDetalhe(page, nome); // o detalhe abre sozinho depois de lançar

  const tabela = page.getByRole('table', { name: 'Movimentações do período' });
  await page.getByLabel('Buscar movimentação').fill(nome);
  await expect(tabela.getByRole('row', { name: new RegExp(nome) })).toHaveCount(1);
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByLabel('Mostrar').selectOption('tudo');
  await expect(tabela.getByRole('row', { name: new RegExp(nome) })).toHaveCount(2); // a despesa e o pagamento, de propósito
  await page.getByLabel('Mostrar').selectOption('principal');

  await tipo(page).getByRole('button', { name: /^A pagar/ }).click();
  await expect(page.getByText('Nenhuma conta com essa busca')).toBeVisible();
});

test('Conta a pagar: lançada, paga pela lista e o pagamento aparece em "Só pagamentos feitos"', async ({ page }) => {
  const nome = `Conta a pagar ${Date.now()}`;
  await page.goto(`${DEMO}/admin/financeiro?tipo=a-pagar`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await gaveta.getByLabel('Descrição').fill(nome);
  await gaveta.getByLabel('Valor').fill('120,00');
  await gaveta.getByLabel('Categoria').selectOption({ label: 'Operacional' });
  await gaveta.getByRole('group', { name: 'Situação do pagamento' }).getByRole('button', { name: 'A pagar' }).click();
  await gaveta.getByRole('button', { name: 'Lançar despesa' }).click();
  await expect(gaveta).toHaveCount(0);
  await fecharDetalhe(page, nome);

  const contas = page.getByRole('table', { name: 'Contas a pagar' });
  await page.getByLabel('Buscar movimentação').fill(nome);
  const linha = contas.getByRole('row', { name: new RegExp(nome) });
  await expect(linha).toHaveCount(1);
  await linha.getByRole('button', { name: 'Pagar' }).click();
  const pagar = page.getByRole('dialog', { name: 'Registrar pagamento' });
  await pagar.getByRole('button', { name: /^Registrar pagamento/ }).click();
  await expect(pagar).toHaveCount(0);
  await expect(linha).toHaveCount(0);

  await tipo(page).getByRole('button', { name: 'Todas' }).click();
  await page.getByLabel('Buscar movimentação').fill(nome);
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByLabel('Mostrar').selectOption('pagamento');
  await expect(page.getByRole('table', { name: 'Movimentações do período' }).getByRole('row', { name: new RegExp(nome) })).toHaveCount(1);
});

test('Outras receitas: lançada aparece no filtro e pode ser cancelada com motivo', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?tipo=receitas`);
  await page.getByRole('button', { name: 'Outra receita' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Outra receita' });
  await expect(gaveta.getByText(/Aporte de sócio, empréstimo e transferência entre contas não são receita/)).toBeVisible();
  await gaveta.getByLabel('Descrição').fill('Evento teste da demonstração');
  await gaveta.getByLabel('Valor').fill('1250,00');
  await gaveta.getByRole('button', { name: 'Lançar receita' }).click();
  await expect(gaveta).toHaveCount(0);
  const linha = page.getByRole('row', { name: /Evento teste da demonstração/ });
  await expect(linha).toBeVisible();
  await linha.getByRole('button', { name: /Ações para/ }).click();
  await page.getByRole('menuitem', { name: 'Cancelar receita' }).click();
  await page.getByRole('alertdialog').getByRole('textbox').fill('Lançada por engano no teste');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar receita' }).click();
  await expect(linha.getByText('Cancelada')).toBeVisible();
});

test('Pendências: Revisão e Conciliação num seletor só; a contagem é a do que está em aberto', async ({ page }) => {
  const resumo = await (await page.request.get(`${API}/resumo`)).json();
  const revisar = resumo.revisao.despesas + resumo.revisao.documentos;
  await page.goto(`${DEMO}/admin/financeiro?aba=pendencias`);
  await expect(aba(page, /^Pendências/)).toHaveText(revisar ? `Pendências${revisar}` : 'Pendências');
  await expect(pendencias(page).getByRole('button', { name: /^Revisão da Júlia/ })).toHaveText(revisar ? `Revisão da Júlia${revisar}` : 'Revisão da Júlia');
  // a fila da tela bate com o contador
  const fila = await (await page.request.get(`${API}/revisao?limite=100`)).json();
  expect(fila.despesas.total + fila.documentos.total).toBe(revisar);

  await pendencias(page).getByRole('button', { name: /^Banco/ }).click();
  await expect(page.getByRole('button', { name: 'Importar extrato' })).toBeVisible();
  await expect(page.getByText('O extrato confere o Financeiro: não cria receita nem despesa sozinho.')).toBeVisible();
  await pendencias(page).getByRole('button', { name: 'Stone e recebíveis' }).click();
  await expect(page.getByRole('table', { name: 'Repasses por meio' })).toBeVisible();
  await pendencias(page).getByRole('button', { name: 'Divergências' }).click();
  await expect(page.getByRole('heading', { name: 'Movimentações que precisam de decisão' })).toBeVisible();
  // só três níveis: abas, partes e o conteúdo (nenhum seletor de Conciliação dentro de Pendências)
  await expect(page.getByRole('group', { name: 'Conciliação' })).toHaveCount(0);
});

test('Relatórios: os três principais primeiro, fechamento e vendas num grupo discreto, sem cadastros', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=relatorios`);
  const nav = page.getByRole('navigation', { name: 'Relatórios' });
  await expect(nav.getByRole('list', { name: 'Principais' }).getByRole('button')).toHaveText(['Resultado do mês', 'Despesas por categoria', 'Evolução financeira']);
  await expect(nav.getByRole('list', { name: 'Mais relatórios' }).getByRole('button')).toHaveText(['Fechamento do mês', 'Vendas (Eyemobile)']);
  await expect(nav.getByRole('button', { name: /Categorias|Fornecedores/ })).toHaveCount(0);
  await expect(page.getByText(/Resultado gerencial ·/)).toBeVisible();
  await nav.getByRole('button', { name: 'Despesas por categoria' }).click();
  await expect(page.getByRole('heading', { name: /Despesas por categoria ·/ })).toBeVisible();
  await nav.getByRole('button', { name: 'Evolução financeira' }).click();
  await expect(page.getByRole('heading', { name: 'Evolução mensal' })).toBeVisible();
});

test('Vendas: por dia, semana e mês, com o recebido por meio', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=relatorios&relatorio=vendas`);
  await expect(page.getByRole('table', { name: 'Vendas por período', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recebido por meio' })).toBeVisible();
  await page.getByRole('group', { name: 'Agrupar por' }).getByRole('button', { name: 'Mês' }).click();
  await expect(page.getByRole('columnheader', { name: 'Mês' })).toBeVisible();
});

test('Resultado: participação da Roll só para o Proprietário (simulação)', async ({ page }) => {
  await entrarDemo(page, 'admin');
  await page.goto(`${DEMO}/admin/financeiro?aba=relatorios`);
  await expect(page.getByText('Participação da Roll — simulação')).toBeVisible();
  await expect(page.getByRole('table', { name: /Simulação da participação/ })).toBeVisible();

  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro?aba=relatorios`);
  await expect(page.getByText(/Resultado gerencial ·/)).toBeVisible();
  await expect(page.getByText(/Participação da Roll/)).toHaveCount(0);
  const mes = new Date().toISOString().slice(0, 7);
  expect((await page.request.get(`${DEMO}/admin/api/financeiro/apuracoes/${mes}/participacao`)).status()).toBe(403);
});

test('Contas fixas em Movimentações → A pagar; taxas contratadas em Pendências → Stone, com nova vigência', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?tipo=a-pagar`);
  await page.getByRole('button', { name: 'Contas fixas' }).click();
  await expect(page).toHaveURL(/vista=recorrentes/);
  await expect(page.getByText('Aluguel da loja')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar às contas a pagar' }).click();
  await expect(page.getByRole('table', { name: 'Contas a pagar' })).toBeVisible();

  await page.goto(`${DEMO}/admin/financeiro?aba=pendencias&vista=stone`);
  await expect(page.getByRole('table', { name: 'Repasses por meio' })).toBeVisible();
  await page.getByRole('button', { name: 'Taxas contratadas (cadastro)' }).click();
  const taxas = page.getByRole('table', { name: 'Taxas por meio de pagamento' });
  await expect(taxas.getByText('Em vigor').first()).toBeVisible();
  await page.getByRole('button', { name: 'Registrar taxa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Registrar taxa' });
  await gaveta.getByLabel('Meio').selectOption('pix');
  await gaveta.getByLabel('Taxa (%)').fill('0,79');
  await gaveta.getByRole('button', { name: 'Registrar' }).click();
  await expect(gaveta).toHaveCount(0);
  await expect(taxas.getByText('0,79%')).toBeVisible();
});

test('B2: o mesmo arquivo não prova duas despesas; a Nova despesa avisa ao anexar um arquivo já enviado', async ({ page }) => {
  const RAIZ = `${DEMO}/admin/api`;
  const arquivo = { name: 'pix-b2-repetido.png', mimeType: 'image/png', buffer: Buffer.from('comprovante B2 da demonstração') };
  const subir = async () => (await page.request.post(`${RAIZ}/arquivos`, { headers: { 'X-Painel': '1', Origin: DEMO, 'Sec-Fetch-Site': 'same-origin' }, multipart: { arquivo, tipo: 'comprovante' } })).json();
  const primeiro = await subir();
  expect(primeiro.ja_existia).toBe(false);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const despesa = (n: number) => ({ descricao: `Material de limpeza B2 ${n}`, valor: '42.00', competencia: hoje, categoria: 'operacional', arquivo_id: primeiro.id, pagamento: { pago_em: hoje, forma: 'pix' } });
  const json = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO };
  expect((await page.request.post(`${RAIZ}/financeiro/despesas`, { headers: json, data: despesa(1) })).status()).toBe(201);
  const segunda = await page.request.post(`${RAIZ}/financeiro/despesas`, { headers: json, data: despesa(2) });
  expect(segunda.status()).toBe(409);
  expect((await segunda.json()).codigo).toBe('arquivo_ja_registrado');

  // No painel: anexar o mesmo arquivo mostra o aviso antes de lançar.
  await page.goto(`${DEMO}/admin/financeiro`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await gaveta.getByRole('button', { name: 'Fornecedor e comprovante' }).click();
  await gaveta.locator('input[type="file"]').setInputFiles(arquivo);
  await expect(gaveta.getByText(/Este arquivo já tinha sido enviado/)).toBeVisible();
});

test('Fornecedores em Configurações: busca no cadastro, recusa o repetido e a Nova despesa escolhe do cadastro', async ({ page }) => {
  await page.goto(`${DEMO}/admin/configuracoes?secao=financeiro&cadastro=fornecedores`);
  const tabela = page.getByRole('table', { name: 'Fornecedores' });
  await expect(tabela.getByRole('row').nth(1)).toBeVisible();
  const primeiro = (await tabela.getByRole('row').nth(1).locator('.principal-celula').textContent())!.trim();

  // o mesmo nome de novo: o backend devolve 409 fornecedor_existente e o painel oferece o existente
  await page.getByRole('button', { name: 'Novo fornecedor' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Novo fornecedor' });
  await gaveta.getByLabel('Nome').fill(primeiro);
  await gaveta.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(gaveta.getByRole('button', { name: 'Abrir o existente' })).toBeVisible();
  await gaveta.getByRole('button', { name: 'Fechar' }).click();

  // Nova despesa: o fornecedor vem da busca (vai o id), não de um texto livre
  await page.goto(`${DEMO}/admin/financeiro`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const nova = page.getByRole('dialog', { name: 'Nova despesa' });
  await nova.getByRole('button', { name: 'Fornecedor e comprovante' }).click();
  await nova.getByRole('combobox', { name: 'Fornecedor' }).fill(primeiro.slice(0, 4));
  await expect(nova.getByRole('option', { name: new RegExp(primeiro.slice(0, 4)) }).first()).toBeVisible();
});

test('Configurações → Financeiro: Categorias e Fornecedores ali dentro, com atalhos para o que ficou no Financeiro', async ({ page }) => {
  await page.goto(`${DEMO}/admin/configuracoes?secao=financeiro`);
  const cadastros = page.getByRole('group', { name: 'Cadastros do Financeiro' });
  await expect(cadastros.getByRole('button', { name: 'Categorias' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('list', { name: 'Categorias ativas' })).toBeVisible();
  await cadastros.getByRole('button', { name: 'Fornecedores' }).click();
  await expect(page.getByRole('table', { name: 'Fornecedores' })).toBeVisible();
  await page.getByRole('link', { name: /Contas fixas \(recorrentes\)/ }).click();
  await expect(aba(page, /^Movimentações/)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Aluguel da loja')).toBeVisible();
});
