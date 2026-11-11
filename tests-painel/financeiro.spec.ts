// Financeiro na demonstração (backend falso, nada real é lançado): as três abas (Movimentações, Contas a pagar,
// Pendências), os endereços antigos abrindo a parte nova certa, Movimentações em Receitas | Despesas sem filtros nem
// indicadores (fase final, 0031), o responsável Conjunto como padrão,
// criar despesa e outra receita, pagar uma conta sem duplicar registros, Pendências com dois motivos corrigidas na mesma
// despesa, Relatórios fora da navegação (o endereço antigo ainda abre), os cadastros em Configurações e o que é só do
// Proprietário (participação da Roll, acertos, contas pagadoras) — a gerente não vê na tela e a rota responde 403.
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const API = `${DEMO}/admin/api/financeiro`;
const aba = (page: Page, nome: RegExp) => page.getByRole('tablist', { name: 'Seções' }).getByRole('tab', { name: nome });
const visao = (page: Page) => page.getByRole('group', { name: 'Visão de Movimentações' });
const despesas = (page: Page) => page.getByRole('table', { name: 'Despesas do período' });
const receitas = (page: Page) => page.getByRole('table', { name: 'Receitas do período' });
const listaPendencias = (page: Page) => page.getByRole('table', { name: 'Pendências: sem categoria ou sem pagador' });
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

test('abas do Gerente (sem Repasses); Movimentações em Receitas | Despesas, sem indicadores, sem Filtros, botões pequenos', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro`);
  const abas = page.getByRole('tablist', { name: 'Seções' }).getByRole('tab');
  await expect(abas).toHaveCount(4);
  for (const [i, nome] of [/^Movimentações/, /^Contas a pagar/, /^Contas recorrentes/, /^Pendências/].entries()) await expect(abas.nth(i)).toHaveText(nome);
  await expect(aba(page, /^Movimentações/)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.indicador')).toHaveCount(0);
  // Sem a faixa dos cinco indicadores e sem o botão Filtros.
  await expect(page.getByLabel('Totais do período')).toHaveCount(0);
  for (const t of ['Vendas do PDV (Eyemobile)', 'Despesas confirmadas', 'Pagamentos realizados', 'A pagar em aberto']) await expect(page.getByText(t, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Filtros/ })).toHaveCount(0);
  await expect(visao(page).getByRole('button')).toHaveText(['Receitas', 'Despesas']);
  // + Receita e + Despesa pequenos, no canto.
  await expect(page.getByRole('button', { name: 'Nova despesa' })).toHaveText('Despesa');
  await expect(page.getByRole('button', { name: 'Outra receita' })).toHaveText('Receita');
  await expect(page.getByRole('button', { name: 'Nova despesa' })).toHaveClass(/btn--p/);
  for (const coluna of ['Data', 'Descrição', 'Categoria', 'Valor', 'Pagador', 'Responsável', 'Situação']) await expect(despesas(page).getByRole('columnheader', { name: coluna })).toBeVisible();
  await expect(despesas(page).getByRole('columnheader', { name: 'Origem' })).toHaveCount(0);
});

test('endereços antigos caem na aba e na parte novas', async ({ page }) => {
  const relatorio = (p: Page, nome: string) => expect(p.getByRole('navigation', { name: 'Relatórios' }).getByRole('button', { name: nome })).toHaveAttribute('aria-current', 'page');
  const casos: [string, RegExp | null, (p: Page) => Promise<void>][] = [
    ['aba=lancamentos', /^Movimentações/, async (p) => expect(despesas(p)).toBeVisible()],
    ['aba=contas', /^Contas a pagar/, async (p) => { await expect(p.getByRole('table', { name: 'Contas a pagar' })).toBeVisible(); await expect(p.getByRole('group', { name: 'Situação das contas' })).toHaveCount(0); }],
    ['tipo=a-pagar', /^Contas a pagar/, async (p) => expect(p.getByRole('table', { name: 'Contas a pagar' })).toBeVisible()],
    ['aba=contas&situacao=vencidas', /^Contas a pagar/, async (p) => { await expect(p.getByRole('table', { name: 'Contas a pagar' })).toBeVisible(); await expect(p.getByRole('group', { name: 'Situação das contas' })).toHaveCount(0); }],
    ['aba=contas-fixas', /^Contas recorrentes/, async (p) => expect(p.getByText('Aluguel da loja')).toBeVisible()],
    ['aba=revisao', /^Pendências/, async (p) => expect(p.getByRole('heading', { name: /Documentos do grupo/ })).toBeVisible()],
    ['aba=lancamentos&revisar=1', /^Pendências/, async (p) => expect(listaPendencias(p)).toBeVisible()],
    ['aba=conciliacao', /^Pendências/, async (p) => expect(p.getByRole('button', { name: 'Importar extrato' })).toBeVisible()],
    ['aba=conciliacao&vista=stone', /^Pendências/, async (p) => expect(p.getByText('Vendido (Eyemobile)')).toBeVisible()],
    ['aba=conciliacao&vista=divergencias', /^Pendências/, async (p) => expect(p.getByRole('heading', { name: 'Movimentações que precisam de decisão' })).toBeVisible()],
    ['aba=taxas', /^Pendências/, async (p) => expect(p.getByText('Vendido (Eyemobile)')).toBeVisible()],
    // Relatórios saiu da navegação, mas o endereço antigo (sino, Visão Geral, link salvo) ainda abre a mesma tela.
    ['aba=relatorios', null, async (p) => relatorio(p, 'Resultado do mês')],
    ['aba=resultado', null, async (p) => relatorio(p, 'Resultado do mês')],
    ['aba=resultado&vista=evolucao', null, async (p) => relatorio(p, 'Evolução financeira')],
    ['aba=vendas', null, async (p) => relatorio(p, 'Vendas (Eyemobile)')],
  ];
  for (const [antigo, nomeAba, conferir] of casos) {
    await page.goto(`${DEMO}/admin/financeiro?${antigo}`);
    if (nomeAba) await expect(aba(page, nomeAba), antigo).toHaveAttribute('aria-selected', 'true');
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

test('Movimentações: Receitas (PDV por dia + outras) e Despesas são consultas separadas; o dia de vendas abre o detalhe', async ({ page }) => {
  const pedido = (grupo: string) => page.waitForRequest((r) => r.url().includes('/financeiro/lancamentos?') && new URL(r.url()).searchParams.get('grupo') === grupo);
  const primeiro = pedido('despesas');
  await page.goto(`${DEMO}/admin/financeiro`);
  const url = new URL((await primeiro).url());
  // Nenhum filtro escondido: só período, visão e (se houver) busca.
  expect([...url.searchParams.keys()].sort()).toEqual(['ate', 'de', 'grupo', 'limite']);
  await expect(despesas(page).getByRole('row').nth(1)).toBeVisible();

  const r = pedido('receitas');
  await visao(page).getByRole('button', { name: 'Receitas' }).click();
  await r;
  await expect(page).toHaveURL(/vista=receitas/);
  const linhaPdv = receitas(page).getByRole('row', { name: /Vendas do PDV/ }).first();
  await expect(linhaPdv).toBeVisible();
  await expect(receitas(page).getByRole('row', { name: /Vendas do PDV/ })).not.toHaveCount(0);
  await linhaPdv.click();
  const dia = page.getByRole('dialog', { name: /^Vendas de / });
  await expect(dia.getByText('Receita líquida')).toBeVisible();
  await expect(dia.getByText(/Venda não é dinheiro já recebido no banco/)).toBeVisible();
  await dia.getByRole('button', { name: 'Fechar' }).click();
});

// Produção em 08/11/2026: as despesas da Júlia têm data de set/out (a do comprovante) e "Este mês" ficava vazio e
// zerado, sem dizer que havia registros antes. O vazio aponta o mais recente e leva até ele.
test('Movimentações: período vazio aponta o lançamento mais recente antes dele e leva até lá', async ({ page }) => {
  const iso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(d);
  const hoje = iso(new Date());
  const ultimo = iso(new Date(Date.now() - 40 * 86_400_000)); // sempre antes do dia 1º do mês atual
  const inicio = `${ultimo.slice(0, 7)}-01`;
  const item = {
    tipo: 'despesa', id: 'd-antiga', data: ultimo, descricao: 'Comprovante antigo da Júlia', valor: '289.00', sinal: -1,
    categoria: 'a_classificar', origem: 'julia', fornecedor_id: null, fornecedor: null, status: 'em_revisao', tem_comprovante: true,
    compra_id: null, despesa_id: 'd-antiga', detalhes: { motivos_revisao: ['categoria_a_classificar'], valor_a_confirmar: false, versao: 1 },
  };
  const pedidos: string[] = [];
  await page.route('**/admin/api/financeiro/lancamentos?**', (rota) => {
    const u = new URL(rota.request().url());
    const de = u.searchParams.get('de')!;
    const ate = u.searchParams.get('ate')!;
    pedidos.push(`${de}..${ate}`);
    const tem = de <= ultimo && ultimo <= ate;
    return rota.fulfill({ json: { total: tem ? 1 : 0, itens: tem ? [item] : [], totais: { receita_pdv: '0', outras_receitas: '0', despesas_confirmadas: '0', despesas_em_revisao: tem ? '289.00' : '0', pagamentos: '0' } } });
  });

  await page.goto(`${DEMO}/admin/financeiro`);
  await expect(page.getByText('Nenhuma movimentação no período')).toBeVisible();
  await expect(page.getByText(/A mais recente antes deste período é de/)).toBeVisible();
  await page.getByRole('button', { name: /^Ver desde/ }).click();
  await expect(despesas(page)).toContainText('Comprovante antigo da Júlia');
  expect(pedidos).toContain(`${inicio}..${hoje}`);
});

test('Nova despesa já paga: Conjunto por padrão, aparece uma vez em Despesas como Paga e não vira conta em aberto', async ({ page }) => {
  const nome = `Despesa paga ${Date.now()}`;
  await page.goto(`${DEMO}/admin/financeiro`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await gaveta.getByLabel('Descrição').fill(nome);
  await gaveta.getByLabel('Valor').fill('37,90');
  await gaveta.getByLabel('Categoria').selectOption({ label: 'Operacional' });
  await expect(gaveta.getByLabel('Responsável')).toHaveValue('conjunto');
  await gaveta.getByRole('group', { name: 'Situação do pagamento' }).getByRole('button', { name: 'Já foi paga' }).click();
  await gaveta.getByRole('button', { name: 'Lançar despesa' }).click();
  await expect(gaveta).toHaveCount(0);
  await fecharDetalhe(page, nome); // o detalhe abre sozinho depois de lançar

  await page.getByLabel('Buscar movimentação').fill(nome);
  const linha = despesas(page).getByRole('row', { name: new RegExp(nome) });
  await expect(linha).toHaveCount(1);                          // a despesa, sem o pagamento repetido
  await expect(linha).toContainText('Conjunto');
  await expect(linha).toContainText('Paga');
  await expect(linha).toContainText('ÂmbarRoll — Empresa');    // a conta padrão (Stone) como pagador

  await aba(page, /^Contas a pagar/).click();
  await page.getByLabel('Buscar conta a pagar').fill(nome);
  await expect(page.getByText('Nenhuma conta com essa busca')).toBeVisible();
});

test('+ Conta a pagar (avulsa): aparece em Contas a pagar, é paga pela lista e a MESMA despesa fica Paga em Despesas', async ({ page }) => {
  const nome = `Conta a pagar ${Date.now()}`;
  await page.goto(`${DEMO}/admin/financeiro?aba=contas`);
  await page.getByRole('button', { name: 'Tipo da conta a pagar' }).click();
  await page.getByRole('menuitem', { name: /^Avulsa/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await expect(gaveta.getByRole('group', { name: 'Situação do pagamento' }).getByRole('button', { name: 'A pagar' })).toHaveAttribute('aria-pressed', 'true');
  await gaveta.getByLabel('Descrição').fill(nome);
  await gaveta.getByLabel('Valor').fill('120,00');
  await gaveta.getByLabel('Categoria').selectOption({ label: 'Operacional' });
  await gaveta.getByRole('button', { name: 'Lançar despesa' }).click();
  await expect(gaveta).toHaveCount(0);
  await fecharDetalhe(page, nome);

  const contas = page.getByRole('table', { name: 'Contas a pagar' });
  await page.getByLabel('Buscar conta a pagar').fill(nome);
  const linha = contas.getByRole('row', { name: new RegExp(nome) });
  await expect(linha).toHaveCount(1);
  // Colunas: Vencimento, Descrição, Valor e Situação (Em aberto | Vencida).
  await expect(linha).toContainText(/Em aberto|Vencida/);
  await linha.getByRole('button', { name: 'Pagar' }).click();
  const pagar = page.getByRole('dialog', { name: 'Registrar pagamento' });
  await expect(pagar.getByLabel('Pago com a conta')).toHaveValue(/.+/); // a conta padrão já vem escolhida
  await pagar.getByRole('button', { name: /^Registrar pagamento/ }).click();
  await expect(pagar).toHaveCount(0);
  await expect(linha).toHaveCount(0);

  await aba(page, /^Movimentações/).click();
  await page.getByLabel('Buscar movimentação').fill(nome);
  const mov = despesas(page).getByRole('row', { name: new RegExp(nome) });
  await expect(mov).toHaveCount(1);
  await expect(mov).toContainText('Paga');
});

test('Contas a pagar: parcelada e recorrente pela mesma aba, sem o botão Contas fixas', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=contas`);
  await expect(page.getByRole('button', { name: /Contas fixas/ })).toHaveCount(0);
  const nome = `Tablet ${Date.now()}`;
  await page.getByRole('button', { name: 'Tipo da conta a pagar' }).click();
  await page.getByRole('menuitem', { name: /^Parcelada/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await expect(gaveta.getByRole('group', { name: 'Situação do pagamento' }).getByRole('button', { name: 'Parcelada' })).toHaveAttribute('aria-pressed', 'true');
  await gaveta.getByLabel('Descrição').fill(nome);
  await gaveta.getByLabel('Valor').fill('900,00');
  await gaveta.getByLabel('Categoria').selectOption({ label: 'Operacional' });
  await gaveta.getByRole('button', { name: 'Lançar despesa' }).click();
  await expect(gaveta).toHaveCount(0);
  await fecharDetalhe(page, nome);
  await page.getByLabel('Buscar conta a pagar').fill(nome);
  const parcelas = page.getByRole('table', { name: 'Contas a pagar' }).getByRole('row', { name: new RegExp(nome) });
  expect(await parcelas.count()).toBeGreaterThan(1); // uma linha por parcela em aberto, uma despesa só

  await aba(page, /^Contas recorrentes/).click();
  await expect(page.getByText('Aluguel da loja')).toBeVisible();
  await page.getByRole('button', { name: 'Tipo da conta a pagar' }).click();
  await page.getByRole('menuitem', { name: /^Recorrente/ }).click();
  const rec = page.getByRole('dialog', { name: 'Nova conta recorrente' });
  await expect(rec.getByLabel('Responsável')).toHaveValue('');
  await rec.getByRole('button', { name: 'Cancelar' }).click();
});

test('Outras receitas: lançada aparece no filtro e pode ser cancelada com motivo', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?tipo=receitas`);
  await page.getByRole('button', { name: 'Outra receita' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Outra receita' });
  await expect(gaveta.getByText(/Venda do PDV entra sozinha/)).toBeVisible();
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

test('Outras receitas: a receber, depois recebida pela correção; aporte fica fora do faturamento', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?tipo=receitas`);
  await expect(visao(page).getByRole('button', { name: 'Receitas' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Outra receita' }).click();
  let gaveta = page.getByRole('dialog', { name: 'Outra receita' });
  await gaveta.getByLabel('Descrição').fill('Locação do salão — teste');
  await gaveta.getByLabel('Valor').fill('900,00');
  await gaveta.getByLabel('Categoria').selectOption('locacao_espaco');
  await gaveta.getByRole('group', { name: 'Situação do recebimento' }).getByRole('button', { name: 'A receber' }).click();
  await gaveta.getByLabel('Forma de recebimento').selectOption('pix');
  await gaveta.getByLabel('Origem').fill('Empresa do evento');
  await gaveta.getByRole('button', { name: 'Lançar receita' }).click();
  await expect(page.getByText('Receita lançada como a receber.')).toBeVisible();
  const linha = receitas(page).getByRole('row', { name: /Locação do salão — teste/ });
  await expect(linha).toContainText('a receber');
  await expect(linha).toContainText('Locação do espaço');

  // A linha abre a correção: marcar como recebida, com motivo (vai para o histórico).
  await linha.click();
  gaveta = page.getByRole('dialog', { name: 'Corrigir receita' });
  await gaveta.getByRole('group', { name: 'Situação do recebimento' }).getByRole('button', { name: 'Recebida' }).click();
  const salvar = gaveta.getByRole('button', { name: 'Salvar correção' });
  await salvar.click();
  await expect(gaveta.getByText('Diga por que está corrigindo.')).toBeVisible();
  await gaveta.getByLabel('Motivo da correção').fill('PIX caiu hoje');
  await salvar.click();
  await expect(page.getByText('Receita corrigida.')).toBeVisible();
  await expect(linha).toContainText('recebida em');

  // Aporte de sócio: registrado, mas fora do faturamento.
  await page.getByRole('button', { name: 'Outra receita' }).click();
  gaveta = page.getByRole('dialog', { name: 'Outra receita' });
  await gaveta.getByLabel('Descrição').fill('Aporte do sócio — teste');
  await gaveta.getByLabel('Valor').fill('5000,00');
  await gaveta.getByLabel('Categoria').selectOption('aporte_socio');
  await expect(gaveta.getByText('Fica registrada, mas não entra no faturamento nem no resultado.')).toBeVisible();
  await gaveta.getByRole('button', { name: 'Lançar receita' }).click();
  await expect(receitas(page).getByRole('row', { name: /Aporte do sócio — teste/ })).toContainText('fora do faturamento');
});

test('Outras receitas: valor igual a uma venda do PDV no mesmo dia só entra se a pessoa confirmar', async ({ page }) => {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const lista = await (await page.request.get(`${API}/lancamentos?de=${hoje.slice(0, 8)}01&ate=${hoje}&tipo=venda_dia`)).json();
  const venda = lista.itens[0] as { data: string; valor: string };
  await page.goto(`${DEMO}/admin/financeiro?tipo=receitas`);
  await page.getByRole('button', { name: 'Outra receita' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Outra receita' });
  await gaveta.getByLabel('Descrição').fill('Caixa do dia lançado à mão');
  await gaveta.getByLabel('Valor').fill(venda.valor.replace('.', ','));
  await gaveta.getByLabel('Data').fill(venda.data);
  await gaveta.getByRole('button', { name: 'Lançar receita' }).click();
  await expect(gaveta.getByText(/Há venda do PDV com este valor no mesmo dia/)).toBeVisible();
  await gaveta.getByRole('button', { name: 'Lançar receita' }).click();
  await expect(gaveta.getByText('Confirme que é outro dinheiro, ou cancele.')).toBeVisible();
  await gaveta.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('row', { name: /Caixa do dia lançado à mão/ })).toHaveCount(0);
});

test('Pendências: uma lista só (sem categoria e/ou sem pagador), corrigida na MESMA despesa pelo modal', async ({ page }) => {
  const resumo = await (await page.request.get(`${API}/resumo`)).json();
  const total = resumo.pendencias.total as number;
  expect(total).toBeGreaterThan(0);
  await page.goto(`${DEMO}/admin/financeiro?aba=pendencias`);
  await expect(aba(page, /^Pendências/)).toHaveText(`Pendências${total}`);
  const lista = listaPendencias(page);
  for (const coluna of ['Descrição', 'Data', 'Valor', 'Categoria', 'Pagador']) await expect(lista.getByRole('columnheader', { name: coluna })).toBeVisible();
  // Sem os filtros antigos, sem "+1", sem botão Classificar.
  await expect(page.getByRole('group', { name: 'Filtrar a revisão' })).toHaveCount(0);
  await expect(lista.getByRole('button', { name: 'Classificar' })).toHaveCount(0);
  await expect(lista.getByRole('row')).toHaveCount(total + 1);

  // A primeira linha sem pagador: o modal escolhe a categoria (se faltar) e o pagador; salva na mesma despesa.
  const antes = await (await page.request.get(`${API}/pendencias`)).json();
  const alvo = antes.itens.find((i: { falta: string[] }) => i.falta.includes('pagador'));
  await lista.getByRole('row', { name: new RegExp(alvo.descricao.slice(0, 12)) }).first().click();
  const modal = page.getByRole('dialog', { name: alvo.descricao });
  if (alvo.falta.includes('categoria')) await modal.getByLabel('Categoria').selectOption({ label: 'Operacional' });
  const { padrao_id } = await (await page.request.get(`${API}/contas-pagadoras`)).json();
  await modal.getByLabel('Pagador').selectOption(padrao_id);
  await expect(modal.getByLabel('Responsável')).toBeVisible();      // ajustável, mas não é pendência
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Pendência resolvida.')).toBeVisible();
  await expect(lista.getByRole('row')).toHaveCount(total);
  const depois = await (await page.request.get(`${API}/despesas/${alvo.despesa_id}`)).json();
  expect(depois.id).toBe(alvo.despesa_id);

  // Sem o aviso de documentos e sem os links secundários na lista (as ferramentas seguem por endereço).
  await expect(page.getByText(/não vir(ou|aram) lançamento/)).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Conferências' })).toHaveCount(0);
  for (const nome of ['Banco', 'Stone e recebíveis', 'Acertos Âmbar × Roll', 'Documentos da Júlia']) await expect(page.getByRole('button', { name: nome, exact: true })).toHaveCount(0);
  await page.goto(`${DEMO}/admin/financeiro?aba=pendencias&vista=stone`);
  await expect(page.getByText('Líquido estimado', { exact: true })).toBeVisible();
  await page.goto(`${DEMO}/admin/financeiro?aba=pendencias&vista=revisao`);
  await expect(page.getByRole('heading', { name: /Documentos do grupo/ })).toBeVisible();
  expect((await page.request.get(`${API}/acertos`)).status()).toBe(403);
});

test('Repasses do Conjunto e contas pagadoras: só o Proprietário', async ({ page }) => {
  await entrarDemo(page, 'admin');
  // Endereço antigo dos Acertos cai em Repasses.
  await page.goto(`${DEMO}/admin/financeiro?aba=pendencias&vista=acertos`);
  await expect(aba(page, /^Repasses/)).toHaveAttribute('aria-selected', 'true');
  for (const t of ['Conjunto → Âmbar', 'Conjunto → Roll']) await expect(page.getByRole('heading', { name: t })).toBeVisible();
  // Sem regra/operação definida: pendente, nunca um saldo inventado.
  await expect(page.getByText('Pendente de identificação')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ver cálculo' }).first().click();
  await expect(page.getByRole('dialog', { name: /Cálculo · Conjunto → Âmbar/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto(`${DEMO}/admin/configuracoes?secao=financeiro&cadastro=contas`);
  // Três grupos, cada um com os seus pagadores; a empresa conjunta (Stone) é a padrão.
  for (const g of ['Âmbar', 'Roll', 'Conjunto']) await expect(page.getByRole('heading', { name: new RegExp(`^${g} ·`) })).toBeVisible();
  const conjunto = page.getByRole('table', { name: 'Pagadores do grupo Conjunto' });
  await expect(conjunto.getByRole('row', { name: /ÂmbarRoll — Empresa/ })).toContainText('padrão');
  await expect(page.getByRole('table', { name: 'Pagadores do grupo Âmbar' }).getByRole('row', { name: /Giardini — Antiga/ })).toContainText('Santander');
  await expect(page.locator('.config-cadastros')).not.toContainText(/\d{3}\.\d{3}\.\d{3}-\d{2}/); // CPF nunca inteiro
  await expect(page.getByLabel('Responsável padrão das despesas novas')).toHaveValue('conjunto');
  await page.getByRole('button', { name: 'Nova conta' }).click();
  const form = page.getByRole('dialog', { name: 'Nova conta' });
  await expect(form.getByLabel('Grupo').locator('option')).toHaveText(['Âmbar', 'Roll', 'Conjunto (Master)']);
  await expect(form.getByLabel('Tipo de conta')).toHaveValue('pessoal');
  await form.getByLabel('Grupo').selectOption('conjunta');
  await expect(form.getByLabel('Tipo de conta')).toHaveValue('empresarial');
  await expect(form.getByLabel('Tipo de conta')).toBeDisabled();
  await form.getByRole('button', { name: 'Cancelar' }).click();

  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/configuracoes?secao=financeiro`);
  await expect(page.getByRole('group', { name: 'Cadastros do Financeiro' }).getByRole('button', { name: 'Contas e pagadores' })).toHaveCount(0);
  expect((await page.request.get(`${API}/contas-pagadoras/cadastro`)).status()).toBe(403);
});

test('Pendências no celular: lista compacta e modal sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${DEMO}/admin/financeiro?aba=pendencias`);
  const lista = listaPendencias(page);
  await expect(lista).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await lista.getByRole('row').nth(1).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
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

test('Recorrentes em aba própria (link antigo também); taxas contratadas em Stone e recebíveis, com nova vigência', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=contas&situacao=recorrentes`);
  await expect(aba(page, /^Contas recorrentes/)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Aluguel da loja')).toBeVisible();
  await aba(page, /^Contas a pagar/).click();
  await expect(page.getByRole('table', { name: 'Contas a pagar' })).toBeVisible();

  await page.goto(`${DEMO}/admin/financeiro?aba=pendencias&vista=stone`);
  await expect(page.getByText('Vendido (Eyemobile)')).toBeVisible();
  await page.getByRole('button', { name: 'Taxas contratadas' }).click();
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
  await page.getByRole('link', { name: /Contas recorrentes/ }).click();
  await expect(aba(page, /^Contas recorrentes/)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Aluguel da loja')).toBeVisible();
});
