// Estoque em três abas (08/11/2026, refinado em 09/11) na demonstração: Insumos (tabela compacta, saldo desconhecido ≠
// zero, situações, cadastro com quantidade inicial, "Ajustar estoque" — entrada identificada sem rota, perda/uso interno e
// correção de inventário com motivo e responsável —, "Contar estoque" em três passos), Compras (só conferência: nada
// cria compra pelo Estoque; comprovante da Júlia pendente) e Fichas técnicas (catálogo dos mais vendidos, ficha com margem
// parcial, editor com o seletor único de insumos, Custos e CMV sem número inventado). O último teste faz o caminho inteiro:
// cadastrar um insumo, escolhê-lo (e cadastrar outro pelo seletor) numa compra, conferir e usá-lo numa ficha.
// A demonstração reproduz as regras do backend (insumos.situacao, operacoes.registrar_perda, fechar_inventario); a
// integração real fica em tests-painel-real. O estado do servidor é compartilhado: cada teste mexe num insumo DIFERENTE,
// e a ordem importa (1 worker).
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

let erros: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrarDemo(page, 'gerente');
});
test.afterEach(() => expect(erros).toEqual([]));

const linha = (page: Page, nome: string) => page.getByRole('table', { name: 'Insumos' }).getByRole('row', { name: new RegExp(nome) });
const confirmar = async (page: Page, titulo: string | RegExp, botao: string) => {
  const d = page.getByRole('dialog', { name: titulo });
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: botao }).click();
};

test('insumos: três abas, situações reais, item nunca contado sem zero e aviso enquanto as vendas não descontam', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await expect(page.getByRole('tab')).toHaveText([/^Insumos$/, /^Compras\d*$/, /^Fichas técnicas$/]);
  // Sem botão genérico de movimento, sem números decorativos, sem filtro de situação, sem texto técnico.
  await expect(page.getByRole('button', { name: 'Registrar movimento' })).toHaveCount(0);
  await expect(page.locator('.estoque-numero')).toHaveCount(0);
  await expect(page.getByLabel('Situação', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Saldo = contagens')).toHaveCount(0);
  await expect(page.getByText('Baixa automática pelas vendas')).toHaveCount(0);
  // A baixa está desligada na demonstração: uma nota discreta no rodapé (não um banner), sem esconder a limitação.
  await expect(page.locator('[data-teste="baixa-desligada"]')).toHaveText(/As vendas ainda não descontam do estoque./);
  await expect(page.locator('.aviso', { hasText: 'As vendas ainda não descontam' })).toHaveCount(0);

  // Tabela compacta: ideal e última conferência ficam no detalhe.
  const cabecalho = page.getByRole('table', { name: 'Insumos' }).getByRole('columnheader');
  await expect(cabecalho).toHaveText(['Nome', 'Quantidade', 'Estoque mínimo', 'Custo médio', 'Situação', '']);

  // Nunca conferido: nem "0" nem "Esgotado".
  const cogumelo = linha(page, 'Cogumelo paris');
  await expect(cogumelo).toContainText('Não conferido');
  await expect(cogumelo).toContainText('—');
  await expect(cogumelo).not.toContainText('Esgotado');
  await expect(linha(page, 'Canela em pó')).toContainText('só compras, sem contagem');
  await expect(linha(page, 'Cream cheese')).toContainText('Baixo');
  await expect(linha(page, 'Tomate italiano')).toContainText('Esgotado');
  await expect(linha(page, 'Leite integral')).toContainText('Normal');
  await expect(linha(page, 'Açúcar refinado')).toContainText('R$ 4,90/kg');
  await expect(linha(page, 'Açúcar refinado')).toContainText('9 kg');

  // Detalhes: a gaveta traz o ideal (0028) e a última conferência. "Falta para o ideal" só com saldo confiável — com a
  // baixa desligada o backend manda null, e nada aparece (sem número inventado).
  await linha(page, 'Leite integral').getByRole('button', { name: 'Detalhes de Leite integral' }).click();
  const leite = page.getByRole('dialog', { name: 'Leite integral' });
  await expect(leite.locator('.definicoes')).toContainText('Estoque ideal60 L');
  await expect(leite.locator('.definicoes')).not.toContainText('Falta para o ideal');
  await expect(leite.locator('.definicoes')).toContainText('Última conferência');
  await expect(leite.getByRole('button', { name: 'Ajustar estoque' })).toBeVisible();
  await expect(leite.getByRole('button', { name: 'Editar cadastro' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByLabel('Buscar insumo').fill('morango');
  await expect(linha(page, 'Morango')).toBeVisible();
  await expect(linha(page, 'Cogumelo paris')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('usuario:');
});

test('cadastro (0028): em sequência; quantidade, custo inicial e ideal num POST só; parecidos avisam; kg vira gramas', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await page.getByRole('button', { name: 'Novo insumo' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo insumo' });
  await expect(novo.getByLabel('Categoria')).toHaveCount(0);
  await expect(novo.getByText('Mais opções')).toHaveCount(0);
  // Tipo continua (o backend precisa dele), num campo discreto; os textos longos saíram.
  await expect(novo.getByLabel('Tipo')).toHaveValue('comprado');
  await expect(novo).not.toContainText('O preço médio vem das compras');
  await expect(novo).not.toContainText('É um preparo feito aqui');
  await novo.getByLabel('Nome').fill('Açúcar mascavo');
  // Insumo que parece o mesmo: só aviso (nunca bloqueia nem mescla).
  await expect(novo.locator('[data-teste="semelhantes"]')).toContainText('Açúcar refinado');
  await expect(novo.getByLabel('Unidade', { exact: true })).toHaveValue('kg');
  await novo.getByLabel('Quantidade inicial (kg)').fill('2,5');
  await novo.getByLabel('Custo unitário inicial (R$/kg)').fill('12,00');
  await expect(novo).toContainText('Abaixo dele, o insumo aparece como baixo.');
  await expect(novo.getByLabel('Estoque ideal (kg)')).toBeEnabled();
  await expect(novo).not.toContainText('Ainda não é salvo pelo sistema');
  // Sem o mínimo, não cadastra (é ele que liga o alerta); ideal abaixo do mínimo também não.
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(novo.locator('.aviso').first()).toContainText('Informe o estoque mínimo');
  await novo.getByLabel('Estoque mínimo (kg)').fill('1');
  await novo.getByLabel('Estoque ideal (kg)').fill('0,5');
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(novo.locator('.aviso').first()).toContainText('O ideal não pode ser menor que o mínimo');
  await novo.getByLabel('Estoque ideal (kg)').fill('4');
  // Uma chamada só: cadastro + abertura (+ custo) na mesma transação; nenhum POST /ajustes depois.
  const chamadas: string[] = [];
  page.on('request', (r) => r.method() === 'POST' && /\/estoque\/(insumos|ajustes)$/.test(new URL(r.url()).pathname) && chamadas.push(`${new URL(r.url()).pathname.split('/').pop()} ${r.postData()}`));
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  // Cadastrou: a gaveta continua aberta, limpa, com a mesma unidade e o cursor no nome, pronta para o próximo.
  const feitos = novo.getByRole('region', { name: 'Cadastrados agora' });
  await expect(feitos).toContainText('Açúcar mascavo');
  await expect(novo.getByLabel('Nome')).toHaveValue('');
  await expect(novo.getByLabel('Nome')).toBeFocused();
  await expect(novo.getByLabel('Unidade', { exact: true })).toHaveValue('kg');
  await novo.getByLabel('Nome').fill('Farinha de amêndoas');
  await novo.getByLabel('Estoque mínimo (kg)').fill('0,5');
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(novo.getByRole('heading', { name: 'Cadastrados agora (2)' })).toBeVisible();
  await feitos.getByRole('button', { name: /Açúcar mascavo/ }).click();

  const insumo = page.getByRole('dialog', { name: 'Açúcar mascavo' });
  await expect(insumo.locator('.insumo-saldo')).toContainText('2,5 kg');
  await expect(insumo.locator('.insumo-saldo')).toContainText('Normal');
  await expect(insumo.locator('.movimento').first()).toContainText('Contagem inicial');
  await expect(insumo.locator('.movimento').first()).toContainText('Custo inicial informado');
  await expect(insumo.locator('.definicoes')).toContainText('R$ 12,00/kg');
  await expect(insumo.locator('.definicoes')).toContainText('Estoque ideal4 kg');
  const lista = await (await page.request.get(`${DEMO}/admin/api/estoque/insumos?limite=200`)).json();
  const criado = lista.itens.find((i: { nome: string }) => i.nome === 'Açúcar mascavo');
  expect(criado).toMatchObject({ unidade_base: 'g', estoque_minimo: expect.stringMatching(/^1000(\.0+)?$/), estoque_ideal: expect.stringMatching(/^4000(\.0+)?$/) });
  expect(Number(criado.saldo)).toBe(2500);
  expect(Number(criado.custo_medio)).toBeCloseTo(0.012, 6);
  expect(chamadas.filter((c) => c.startsWith('ajustes'))).toHaveLength(0);
  const primeiro = JSON.parse(chamadas.find((c) => c.includes('Açúcar mascavo'))!.slice('insumos '.length));
  expect(primeiro).toMatchObject({ quantidade_inicial: '2500', custo_unitario_inicial: '0.012000', estoque_ideal: '4000' });

  // Editar: apagar o ideal manda null (0028: null limpa) — e o detalhe volta a "Não definido".
  await insumo.getByRole('button', { name: 'Editar cadastro' }).click();
  await insumo.getByLabel('Estoque ideal (kg)').fill('');
  await insumo.getByRole('button', { name: 'Salvar' }).click();
  await expect(insumo.locator('.definicoes')).toContainText('Estoque idealNão definido');
});

test('backend anterior (sem 0028): ideal desligado e identificado, quantidade inicial pela conferência logo depois', async ({ page }) => {
  // Simula o backend publicado antes da 0028: sem a chave estoque_ideal e sem a rota /insumos/opcoes.
  await page.route('**/admin/api/estoque/insumos?*', async (r) => {
    const l = await (await r.fetch()).json();
    await r.fulfill({ json: { ...l, itens: l.itens.map(({ estoque_ideal: _i, falta_para_ideal: _f, ...x }: Record<string, unknown>) => (void _i, void _f, x)) } });
  });
  await page.route('**/admin/api/estoque/insumos/opcoes*', (r) => r.fulfill({ status: 404, json: { detail: 'Not Found' } }));
  await page.route('**/admin/api/estoque/insumos', async (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    const corpo = r.request().postDataJSON();
    // O backend anterior ignora quantidade_inicial: nada de abertura na resposta.
    const resp = await r.fetch({ postData: JSON.stringify({ ...corpo, quantidade_inicial: undefined, custo_unitario_inicial: undefined }) });
    const { abertura: _a, semelhantes: _s, ...cad } = await resp.json();
    void _a; void _s;
    await r.fulfill({ status: resp.status(), json: cad });
  });
  await page.goto(`${DEMO}/admin/estoque`);
  await page.getByRole('button', { name: 'Novo insumo' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo insumo' });
  await expect(novo.getByLabel('Estoque ideal (kg)')).toBeDisabled();
  await expect(novo).toContainText('Ainda não é salvo pelo sistema');
  await expect(novo.getByLabel(/Custo unitário inicial/)).toHaveCount(0);
  await novo.getByLabel('Nome').fill('Farinha de arroz');
  await novo.getByLabel('Quantidade inicial (kg)').fill('1,5');
  await novo.getByLabel('Estoque mínimo (kg)').fill('0,5');
  const ajuste = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/estoque/ajustes'));
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  expect((await ajuste).postDataJSON()).toMatchObject({ quantidade: '1500', motivo: 'contagem_fisica' });
  await expect(novo.getByRole('region', { name: 'Cadastrados agora' })).toContainText('Farinha de arroz');
  await novo.getByRole('button', { name: 'Concluir' }).click();
  // O seletor cai na listagem de insumos (sem /opcoes) e continua achando pelo nome.
  await page.goto(`${DEMO}/admin/estoque?aba=fichas`);
  await page.getByRole('list', { name: 'Produtos da Eyemobile' }).getByRole('button', { name: /Roll de chocolate/ }).click();
  await page.getByRole('button', { name: 'Cadastrar ficha' }).click();
  await page.getByRole('combobox', { name: 'Ingrediente 1' }).fill('farinha de a');
  await expect(page.getByRole('option', { name: /Farinha de arroz/ })).toBeVisible();
});

test('ajustar estoque: entrada identificada (sem rota, nada salvo); perda ou uso interno confirma antes, com motivo próprio e o responsável', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await linha(page, 'Açúcar refinado').click();
  const insumo = page.getByRole('dialog', { name: 'Açúcar refinado' });
  await expect(insumo.locator('.insumo-saldo')).toContainText('9 kg');
  // Duas ações na gaveta: o ajuste (entrada, perda, correção) e o cadastro.
  await expect(insumo.getByRole('button', { name: 'Conferir quantidade' })).toHaveCount(0);
  await expect(insumo.getByRole('button', { name: 'Corrigir saldo' })).toHaveCount(0);
  await insumo.getByRole('button', { name: 'Ajustar estoque' }).click();
  const ajuste = page.getByRole('dialog', { name: 'Ajustar estoque' });
  const tipos = ajuste.getByRole('group', { name: 'Tipo de ajuste' });
  await expect(tipos.getByRole('button')).toHaveText(['Entrada', 'Perda', 'Correção de inventário']);

  // Entrada avulsa não tem rota no backend: identificada, sem formulário que fingiria salvar.
  await tipos.getByRole('button', { name: 'Entrada' }).click();
  await expect(ajuste.locator('[data-teste="entrada-indisponivel"]')).toContainText('Entradas vêm da conferência de compras');
  await expect(ajuste.getByRole('button', { name: /^Revisar/ })).toHaveCount(0);
  await expect(ajuste.getByRole('button', { name: 'Ir para Compras' })).toBeVisible();

  await tipos.getByRole('button', { name: 'Perda' }).click();
  await ajuste.getByLabel('Quantidade que saiu').fill('0,5');
  await expect(ajuste.getByLabel('Unidade')).toHaveValue('1000');
  await ajuste.getByLabel('Motivo').selectOption('uso_interno');
  await ajuste.getByLabel('Observação').fill('café da equipe');
  await expect(ajuste).toContainText('Responsável: Gabriela Gerente (demo)');
  await ajuste.getByRole('button', { name: 'Revisar saída' }).click();
  // Nada saiu ainda: só depois da confirmação.
  expect((await (await page.request.get(`${DEMO}/admin/api/estoque/insumos/e1000000-0000-4000-8000-000000000005`)).json()).saldo).toMatch(/^9000/);
  await expect(page.getByRole('dialog', { name: 'Registrar a saída?' })).toContainText('0,5 kg de Açúcar refinado · Uso interno (café da equipe)');
  await confirmar(page, 'Registrar a saída?', 'Registrar saída');
  await expect(page.getByText('Saída registrada: Açúcar refinado.')).toBeVisible();
  await expect(insumo.locator('.insumo-saldo')).toContainText('8,5 kg');
  const ultimo = insumo.locator('.movimento').first();
  await expect(ultimo).toContainText('Uso interno');
  await expect(ultimo).toContainText('café da equipe');
  await expect(ultimo).not.toContainText('Perda');
  await expect(ultimo).toContainText('Gabriela Gerente (demo)');
  await expect(ultimo).toContainText('-0,5 kg');
  await expect(insumo).not.toContainText('usuario:');
  const movs = await (await page.request.get(`${DEMO}/admin/api/estoque/insumos/e1000000-0000-4000-8000-000000000005/movimentos`)).json();
  expect(movs.itens[0]).toMatchObject({ tipo: 'perda', motivo: 'uso_interno: café da equipe' });
});

test('correção de inventário: erro de registro exige justificativa, confirma e registra saldo anterior, novo, motivo, responsável e data', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await linha(page, 'Farinha de trigo').click();
  const insumo = page.getByRole('dialog', { name: 'Farinha de trigo' });
  await insumo.getByRole('button', { name: 'Ajustar estoque' }).click();
  const ajuste = page.getByRole('dialog', { name: 'Ajustar estoque' });
  // Correção de inventário é o tipo de partida.
  await expect(ajuste.getByRole('group', { name: 'Tipo de ajuste' }).getByRole('button', { name: 'Correção de inventário' })).toHaveAttribute('aria-pressed', 'true');
  await expect(ajuste).toContainText('18 kg');
  await ajuste.getByLabel('Quantidade correta').fill('17,5');
  await expect(ajuste.locator('.ajuste-previa')).toContainText('-0,5 kg');
  await ajuste.getByLabel('Motivo').selectOption('erro_de_registro');
  await ajuste.getByRole('button', { name: 'Revisar ajuste' }).click();
  await expect(ajuste.getByText('Explique a correção (pelo menos 5 caracteres).')).toBeVisible();
  await ajuste.getByLabel('Justificativa').fill('entrada lançada em dobro');
  await ajuste.getByRole('button', { name: 'Revisar ajuste' }).click();
  await expect(page.getByRole('dialog', { name: 'Corrigir o saldo?' })).toContainText('de 18 para 17,5 kg (-0,5 kg)');
  await confirmar(page, 'Corrigir o saldo?', 'Corrigir saldo');
  await expect(ajuste.getByRole('heading', { name: 'Saldo ajustado' })).toBeVisible();
  const registro = ajuste.locator('[data-teste="ajuste-registrado"]');
  await expect(registro).toContainText('18 kg');
  await expect(registro).toContainText('17,5 kg');
  await expect(registro).toContainText('Erro de registro · entrada lançada em dobro');
  await expect(registro).toContainText('Gabriela Gerente (demo)');
  await ajuste.getByRole('button', { name: 'Concluir' }).click();
  await expect(insumo.locator('.insumo-saldo')).toContainText('17,5 kg');
  const ultimo = insumo.locator('.movimento').first();
  await expect(ultimo).toContainText('Erro de registro · entrada lançada em dobro');
  await expect(ultimo).toContainText('de 18 para 17,5 kg');
  await page.keyboard.press('Escape');

  // O ajuste não abre contagem: nada fica pela metade.
  await page.getByRole('button', { name: 'Contar estoque' }).click();
  await expect(page.getByRole('button', { name: /Começar contagem/ })).toBeVisible();
});

test('correção por contagem física: sem diferença não lança nada, só registra a conferência', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await linha(page, 'Chocolate 70%').click();
  const insumo = page.getByRole('dialog', { name: 'Chocolate 70%' });
  await insumo.getByRole('button', { name: 'Ajustar estoque' }).click();
  const ajuste = page.getByRole('dialog', { name: 'Ajustar estoque' });
  await expect(ajuste.getByLabel('Motivo')).toHaveValue('contagem_fisica');
  await ajuste.getByLabel('Quantidade correta').fill('2,1');
  await expect(ajuste.locator('.ajuste-previa')).toContainText('sem diferença');
  await ajuste.getByRole('button', { name: 'Revisar ajuste' }).click();
  await confirmar(page, 'Registrar a contagem?', 'Registrar contagem');
  await expect(ajuste.getByRole('heading', { name: 'Conferido, sem diferença' })).toBeVisible();
  await expect(ajuste).toContainText('Contagem física');
});

test('contar estoque: ação de Insumos em três passos — abertura, diferenças, histórico — e abandonar não muda saldo', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await page.getByRole('button', { name: 'Contar estoque' }).click();
  await expect(page).toHaveURL(/vista=contagem/);
  await expect(page.getByRole('heading', { name: 'Contar estoque' })).toBeVisible();
  // Com insumos nunca conferidos, a sugestão é o inventário completo.
  await expect(page.getByRole('radio', { name: /Todos os insumos/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Só os baixos ou com divergência/ })).toBeVisible();
  await expect(page.locator('.guia-passos__item--atual')).toContainText('Selecionar itens');
  await page.getByRole('radio', { name: /Escolher insumos/ }).check();
  for (const n of ['Cogumelo paris', 'Leite integral', 'Ovos']) await page.getByRole('checkbox', { name: new RegExp(n) }).check();
  await page.getByRole('button', { name: 'Começar contagem (3 itens)' }).click();

  await expect(page.locator('.guia-passos__item--atual')).toContainText('Informar quantidades');
  const tabela = page.getByRole('table', { name: 'Quantidades contadas' });
  await expect(tabela.getByRole('row', { name: /Cogumelo paris/ })).toContainText('Não conferido');
  for (const [nome, valor] of [['Cogumelo paris', '1200'], ['Leite integral', '40'], ['Ovos', '100']] as const) {
    const campo = tabela.getByLabel(new RegExp(`Quantidade contada de ${nome}`));
    await campo.fill(valor);
    await campo.press('Enter');
    await expect(tabela.getByRole('row', { name: new RegExp(nome) })).toContainText('Salvo');
  }
  // Sair no meio não muda saldo: o leite continua 42 L até a confirmação.
  await page.getByRole('button', { name: 'Insumos', exact: true }).click();
  await expect(linha(page, 'Leite integral')).toContainText('42');
  await page.getByRole('button', { name: 'Contar estoque' }).click();
  await page.getByRole('button', { name: 'Revisar diferenças' }).click();

  await expect(page.locator('.guia-passos__item--atual')).toContainText('Revisar e confirmar');
  const revisao = page.getByRole('table', { name: 'Diferenças da contagem' });
  await expect(revisao.getByRole('row', { name: /Cogumelo paris/ })).toContainText('Saldo inicial');
  await expect(revisao.getByRole('row', { name: /Leite integral/ })).toContainText('-2 L');
  await expect(revisao.getByRole('row', { name: /Ovos/ })).toContainText(/\+\d+ un/);
  await page.getByRole('button', { name: 'Confirmar contagem' }).click();
  await confirmar(page, 'Confirmar a contagem?', 'Confirmar contagem');
  const ajustes = page.getByRole('table', { name: 'Ajustes da contagem' });
  await expect(ajustes.getByRole('row', { name: /Leite integral/ })).toContainText('-2 L');
  await expect(ajustes.getByRole('row', { name: /Cogumelo paris/ })).toContainText('Saldo inicial');
  await page.getByRole('button', { name: 'Concluir' }).click();

  // Concluir volta para a lista de insumos, já com os saldos novos.
  await expect(linha(page, 'Cogumelo paris')).toContainText('Normal');
  await expect(linha(page, 'Leite integral')).toContainText('40');
  await linha(page, 'Cogumelo paris').click();
  await expect(page.getByRole('dialog', { name: 'Cogumelo paris' }).locator('.movimento').first()).toContainText('Contagem inicial');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Contar estoque' }).click();
  await expect(page.getByRole('table', { name: 'Contagens anteriores' }).getByRole('row')).toHaveCount(3);
});

test('compras: só conferência — sem "Registrar compra" nem "Com nota / Sem nota"; Pendentes e Histórico continuam', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=compras`);
  await expect(page.getByRole('table', { name: 'Compras pendentes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar compra' })).toHaveCount(0);
  await expect(page.getByText('Com nota fiscal')).toHaveCount(0);
  await expect(page.getByText('Sem nota', { exact: true })).toHaveCount(0);
  await page.getByRole('group', { name: 'Quais compras' }).getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByRole('table', { name: 'Histórico de compras' }).getByRole('row', { name: /Distribuidora Fortaleza/i })).toContainText('Confirmada');
});

test('conferência de nota lida: sugestão da leitura não passa sozinha — cada item é confirmado por uma pessoa', async ({ page }) => {
  // Nota XML com itens de confiança alta ("sugerido"): antes entravam no estoque ao confirmar a compra sem ninguém olhar.
  await page.goto(`${DEMO}/admin/estoque?aba=compras&compra=e2000000-0000-4000-8000-000000000001`);
  const gaveta = page.getByRole('dialog', { name: 'Laticínios Serra Azul Ltda' });
  // Cabeçalho enxuto: fornecedor, data e total; sem faixas amarelas de explicação.
  await expect(gaveta.locator('.nota-cabeca dt')).toHaveText(['Fornecedor', 'Data', 'Total']);
  await expect(gaveta.locator('.aviso--atencao')).toHaveCount(0);
  const itens = gaveta.getByRole('list', { name: 'Itens lidos' });
  const sugeridos = itens.locator('.item-lido[data-situacao="sugerido"]');
  const total = await sugeridos.count();
  expect(total).toBeGreaterThan(0);
  await expect(gaveta.locator('[data-teste="status-conferencia"]')).toContainText(`${total === 1 ? '1 sugestão a confirmar' : `${total} sugestões a confirmar`}`);
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  // O rodapé não repete a mesma coisa duas vezes (o backend também manda item_N_sugestao_nao_confirmada).
  await expect(page.locator('[data-teste="pendencias-conferencia"]')).toHaveText(`${total} sugestões a confirmar`);
  // E a API recusa também (backend e78d36a): não basta a tela.
  const det = await (await page.request.get(`${DEMO}/admin/api/estoque/compras/e2000000-0000-4000-8000-000000000001`)).json();
  expect(det.pendencias).toContain('item_1_sugestao_nao_confirmada');
  const forcada = await page.request.post(`${DEMO}/admin/api/estoque/compras/e2000000-0000-4000-8000-000000000001/confirmar`, { headers: { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO }, data: { versao: det.versao, despesa: {} } });
  expect(forcada.status()).toBe(409);
  expect((await forcada.json()).dados.pendencias).toContain('item_1_sugestao_nao_confirmada');
  // A linha mostra o insumo escolhido pelo id, com a unidade cadastrada.
  const primeira = sugeridos.first();
  await expect(primeira.getByRole('combobox')).not.toHaveValue('');
  await expect(primeira.locator('.seletor-insumo__unidade')).toBeVisible();
  for (let k = 0; k < total; k++) {
    await itens.locator('.item-lido[data-situacao="sugerido"]').first().getByRole('button', { name: /^Confirmar / }).click();
    await expect(itens.locator('.item-lido[data-situacao="sugerido"]')).toHaveCount(total - k - 1);
  }
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  await expect(gaveta.locator('[data-teste="status-conferencia"]')).toContainText('Itens conferidos');
});

test('compras: comprovante da Júlia aparece pendente com "faltam os produtos"; endereço antigo de Recebimentos continua valendo', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=recebimentos`);
  await expect(page.getByRole('tab', { name: /Compras/ })).toHaveAttribute('aria-selected', 'true');
  const pix = page.getByRole('table', { name: 'Compras pendentes' }).getByRole('row', { name: /Padaria Trigo de Ouro/ }).filter({ hasText: 'comprovante' });
  await expect(pix).toContainText('Júlia');
  await expect(pix).toContainText('comprovante de pagamento');
  await expect(pix).toContainText('Faltam os produtos');
  await expect(pix.getByRole('button', { name: 'Conferir' })).toBeVisible();
  await expect(page.getByText(/O mais antigo chegou/)).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Quais compras' }).getByRole('button')).toHaveText([/Pendentes/, 'Histórico']);
});

test('fichas técnicas: catálogo dos mais vendidos só com a busca, situação de cada ficha e a margem parcial que não é lucro', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=custos`);
  await expect(page.getByRole('tab', { name: 'Fichas técnicas' })).toHaveAttribute('aria-selected', 'true');
  const produtos = page.getByRole('list', { name: 'Produtos da Eyemobile' });
  // Do mais vendido para o menos vendido.
  await expect(produtos.locator('.produto-cartao__nome').first()).toHaveText('Cinnamon roll tradicional');
  await expect(produtos.getByRole('button', { name: /Roll de pistache/ })).toContainText('Incompleta');
  await expect(produtos.getByRole('button', { name: /Roll de chocolate/ })).toContainText('Sem ficha');
  await expect(produtos.getByRole('button', { name: /Cappuccino/ })).toContainText('Completa');
  // Sem vínculo com o catálogo oficial no backend: nenhuma foto inventada.
  await expect(produtos.locator('img')).toHaveCount(0);
  // A falta de vínculo não se repete em cada cartão (fica na gaveta); sem filtros nem o texto de ordenação.
  await expect(produtos).not.toContainText('Não vinculado');
  await expect(page.getByRole('group', { name: 'Situação da ficha' })).toHaveCount(0);
  await expect(page.getByText(/Do mais vendido ao menos vendido/)).toHaveCount(0);
  const cappuccinoCartao = produtos.getByRole('button', { name: /Cappuccino/ });
  await expect(cappuccinoCartao).toContainText('vendidos em 30 dias');
  await expect(cappuccinoCartao).toContainText('Preço de venda');
  await expect(cappuccinoCartao).toContainText('Custo calculado');
  await page.getByLabel('Buscar produto').fill('roll de');
  await expect(produtos.getByRole('button', { name: /Roll de pistache/ })).toBeVisible();
  await expect(produtos.getByRole('button', { name: /Cappuccino/ })).toHaveCount(0);
  await page.getByLabel('Buscar produto').fill('');

  await produtos.getByRole('button', { name: /Roll de pistache/ }).click();
  const pistache = page.getByRole('dialog', { name: 'Roll de pistache' });
  await expect(pistache).toContainText('Produto da Eyemobile');
  await expect(pistache.locator('.ficha-numeros')).toContainText('Indisponível');
  await expect(pistache.locator('[data-teste="aviso-margem"]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await produtos.getByRole('button', { name: /Cappuccino/ }).click();
  const cappuccino = page.getByRole('dialog', { name: 'Cappuccino' });
  await expect(cappuccino.locator('.ficha-numeros')).toContainText('R$ 14,00');
  await expect(cappuccino.locator('.ficha-numeros')).toContainText('Margem de contribuição parcial');
  await expect(cappuccino.locator('[data-teste="aviso-margem"]')).toContainText('Não é lucro líquido');
  await expect(cappuccino.getByText('Sem vínculo com o cardápio do site')).toBeVisible();
  await expect(cappuccino.getByLabel('Item do cardápio do site')).toBeVisible();
});

test('produtos sem venda (0028): o cardápio da loja aparece em Fichas para cadastrar antes de vender; Custos não muda', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=fichas`);
  const produtos = page.getByRole('list', { name: 'Produtos da Eyemobile' });
  const croissant = produtos.getByRole('button', { name: /Croissant clássico/ });
  await expect(croissant).toContainText('Sem venda em 30 dias · no cardápio da loja');
  await expect(croissant).toContainText('Sem ficha');
  // Os mais vendidos continuam primeiro; o que não vendeu vai para o fim.
  await expect(produtos.locator('.produto-cartao__nome').first()).toHaveText('Cinnamon roll tradicional');
  await expect(produtos.locator('.produto-cartao__nome').last()).toHaveText('Croissant clássico');
  const sem = await (await page.request.get(`${DEMO}/admin/api/estoque/fichas?situacao=todas&dias=30`)).json();
  expect(sem.some((f: { produto: string }) => f.produto === 'Croissant clássico')).toBe(false);
  const com = await (await page.request.get(`${DEMO}/admin/api/estoque/fichas?situacao=todas&dias=30&incluir_sem_venda=true`)).json();
  expect(com.find((f: { produto: string }) => f.produto === 'Croissant clássico')).toMatchObject({ vendido_no_periodo: false, no_cardapio_pdv: true });
});

test('vínculo Eyemobile ↔ cardápio do site (0028): sugestão só aplicada com clique, por id; desfazer; duplicado recusado', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=fichas`);
  const produtos = page.getByRole('list', { name: 'Produtos da Eyemobile' });
  await produtos.getByRole('button', { name: /Croissant clássico/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Croissant clássico' });
  // A sugestão por nome aparece como opção, sem estar aplicada.
  await expect(gaveta.getByText('Sem vínculo com o cardápio do site')).toBeVisible();
  const sugestoes = gaveta.getByRole('group', { name: 'Sugestões do cardápio do site' });
  await expect(sugestoes.getByRole('button', { name: 'Croissant Clássico' })).toBeVisible();
  const antes = await (await page.request.get(`${DEMO}/admin/api/estoque/vinculos-cardapio`)).json();
  expect(antes.produtos.find((p: { eye_product_id: string }) => p.eye_product_id === '7003').catalogo_item_id).toBeNull();
  const put = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/estoque/fichas/produto/7003/catalogo'));
  await sugestoes.getByRole('button', { name: 'Croissant Clássico' }).click();
  expect((await put).postDataJSON()).toEqual({ catalogo_item_id: 'croissants.classico' });
  await expect(page.getByText('Produto ligado ao cardápio do site.')).toBeVisible();
  await expect(gaveta).toContainText('No cardápio do site: Croissant Clássico');
  await expect(gaveta.locator('img.ficha-foto')).toHaveCount(1);
  await page.keyboard.press('Escape');
  // O cartão ganha a foto do cardápio pelo id.
  await expect(produtos.getByRole('button', { name: /Croissant clássico/ }).locator('img')).toHaveCount(1);

  // O mesmo item do cardápio em outro produto: o backend recusa (409), e a lista de escolha nem o oferece.
  const dup = await page.request.put(`${DEMO}/admin/api/estoque/fichas/produto/5003/catalogo`, { headers: { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO }, data: { catalogo_item_id: 'croissants.classico' } });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).codigo).toBe('catalogo_ja_vinculado');
  await produtos.getByRole('button', { name: /Roll de chocolate/ }).click();
  const roll = page.getByRole('dialog', { name: 'Roll de chocolate' });
  await expect(roll.getByLabel('Item do cardápio do site').locator('option', { hasText: 'Croissant Clássico' })).toHaveCount(0);
  await roll.getByRole('button', { name: 'Fechar' }).click();

  // Desfazer volta ao estado sem vínculo.
  await produtos.getByRole('button', { name: /Croissant clássico/ }).click();
  await gaveta.getByRole('button', { name: 'Desfazer' }).click();
  await expect(gaveta.getByText('Sem vínculo com o cardápio do site')).toBeVisible();
});

test('editor de ficha: ingrediente só do estoque, quantidade em kg vira gramas, e a ficha nova passa a valer', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=fichas`);
  await page.getByRole('list', { name: 'Produtos da Eyemobile' }).getByRole('button', { name: /Cheesecake de morango/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Cheesecake de morango' });
  await gaveta.getByRole('button', { name: 'Cadastrar ficha' }).click();
  const ingrediente = gaveta.getByRole('combobox', { name: 'Ingrediente 1' });
  await ingrediente.fill('cream');
  // Só insumos cadastrados: nada de texto livre — quem não acha cadastra o insumo (cadastro rápido), nunca usa o texto.
  await expect(page.getByRole('option', { name: /Criar|Usar/ })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Cadastrar “cream”' })).toBeVisible();
  await page.getByRole('option', { name: /^Cream cheese/ }).click();
  await expect(gaveta).toContainText('Preço médio R$ 38,50/kg');
  await gaveta.getByLabel('Quantidade').fill('1,2');
  await gaveta.getByLabel('Unidade').selectOption({ label: 'kg' });
  // Principal: ingrediente, quantidade e unidade. Rendimento, perda e observação ficam nas opções avançadas.
  await expect(gaveta.getByLabel('Perda %')).toHaveCount(0);
  await expect(gaveta.getByLabel('Rendimento (porções)')).toBeHidden();
  await gaveta.getByText(/^Opções avançadas/).click();
  await expect(gaveta.getByLabel('Rendimento (porções)')).toHaveValue('1');
  await expect(gaveta.getByLabel('Perda %')).toBeVisible();
  await gaveta.getByLabel('Rendimento (porções)').fill('12');
  await gaveta.getByRole('button', { name: 'Revisar e salvar' }).click();
  await confirmar(page, 'Cadastrar a ficha técnica?', 'Salvar ficha');
  await expect(gaveta.locator('.ficha-numeros')).toContainText('12 porções');
  await expect(gaveta.getByRole('table', { name: 'Ingredientes' })).toContainText('1,2 kg');
  const ficha = await (await page.request.get(`${DEMO}/admin/api/estoque/fichas/produto/7001`)).json();
  expect(Number(ficha.itens[0].quantidade)).toBe(1200);
});

test('custos e CMV: o essencial sem número inventado; sem nenhuma ficha, uma frase curta', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=fichas&secao=custos`);
  await expect(page.getByText('Como estão os custos')).toBeVisible();
  // CMV do mês indisponível na demonstração: explica, não mostra R$ 0,00.
  await expect(page.locator('.custos-resumo')).toContainText('Ainda não dá para calcular');
  await expect(page.locator('.custos-resumo')).toContainText('da receita dos últimos 30 dias');
  await expect(page.getByRole('table', { name: 'Preço de venda e custo dos ingredientes' })).toBeVisible();
  await expect(page.getByText('Não é lucro')).toBeVisible();
  // Relatórios completos continuam acessíveis.
  await page.getByText('Relatórios avançados').click();
  await expect(page.getByRole('region', { name: 'CMV teórico' })).toContainText('Indisponível');
  await expect(page.getByText(/Pode faltar|Reposição sugerida/)).toHaveCount(0);

  // Nenhuma ficha cadastrada: a orientação, não um zero.
  await page.route('**/admin/api/estoque/fichas?*', async (r) => {
    const lista = await (await r.fetch()).json();
    await r.fulfill({ json: lista.map((f: object) => ({ ...f, ficha: null })) });
  });
  await page.reload();
  await expect(page.getByText('Ainda não há fichas técnicas')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('R$ 0,00');
  await expect(page.getByRole('button', { name: 'Ver produtos sem ficha' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Preço de venda e custo dos ingredientes' })).toHaveCount(0);
});

test('vínculo com o catálogo: só pelo id estável que o backend mandar — aí aparece a foto do cardápio', async ({ page }) => {
  // Simula o contrato pedido ao backend (catalogo_item_id na lista de fichas): a foto vem do id, nunca do nome.
  await page.route('**/admin/api/estoque/fichas?*', async (r) => {
    const lista = await (await r.fetch()).json();
    await r.fulfill({ json: lista.map((f: { produto: string }) => ({ ...f, catalogo_item_id: f.produto === 'Espresso' ? 'cafes.expresso_duplo' : null })) });
  });
  await page.goto(`${DEMO}/admin/estoque?aba=fichas`);
  const produtos = page.getByRole('list', { name: 'Produtos da Eyemobile' });
  const espresso = produtos.getByRole('button', { name: /Espresso/ });
  await expect(espresso.locator('img')).toHaveCount(1);
  await expect(produtos).not.toContainText('Não vinculado');
  await expect(produtos.locator('img')).toHaveCount(1);
});

test('seletor de insumos: carregando e erro dentro da lista, "Tentar de novo" recupera; só insumos ativos do cadastro', async ({ page }) => {
  // A base de insumos falha na primeira vez e demora na segunda: o seletor diz o que está acontecendo, sem lista vazia muda.
  let falhar = true;
  await page.route('**/admin/api/estoque/insumos/opcoes*', async (r) => {
    if (falhar) return r.fulfill({ status: 500, json: { detail: 'erro' } });
    await new Promise((ok) => setTimeout(ok, 600));
    return r.fallback();
  });
  await page.goto(`${DEMO}/admin/estoque?aba=fichas`);
  await page.getByRole('list', { name: 'Produtos da Eyemobile' }).getByRole('button', { name: /Roll de chocolate/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Roll de chocolate' });
  await gaveta.getByRole('button', { name: 'Cadastrar ficha' }).click();
  await gaveta.getByRole('combobox', { name: 'Ingrediente 1' }).click();
  const lista = page.getByRole('listbox', { name: 'Ingrediente 1' });
  await expect(lista).toContainText('Não foi possível carregar os insumos.');
  falhar = false;
  await lista.getByRole('button', { name: 'Tentar de novo' }).dispatchEvent('mousedown');
  await expect(lista).toContainText('Carregando insumos…');
  await expect(lista.getByRole('option', { name: /Leite integral/ })).toBeVisible();
  // A opção mostra a unidade cadastrada (e o preço médio, na ficha).
  await expect(lista.getByRole('option', { name: /Leite integral/ })).toContainText('ml');
  // GET /insumos/opcoes (0028) acha também pelo texto de nota já confirmado.
  await gaveta.getByRole('combobox', { name: 'Ingrediente 1' }).fill('leite uht');
  await expect(lista.getByRole('option', { name: /Leite integral/ })).toContainText('pelo texto da nota');
  await page.keyboard.press('Escape');
});

test('correspondência (0028): candidatos do motor aparecem no item lido como opções; escolher é um clique, nada é aplicado sozinho', async ({ page }) => {
  // Insumo que a nota do Mercadinho tem ("DETERGENTE NEUTRO 500ML") e o cadastro ainda não.
  const criar = await page.request.post(`${DEMO}/admin/api/estoque/insumos`, { headers: { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO }, data: { nome: 'Detergente neutro', unidade_base: 'un', estoque_minimo: '2' } });
  expect(criar.status()).toBe(201);
  await page.goto(`${DEMO}/admin/estoque?aba=compras&compra=e2000000-0000-4000-8000-000000000002`);
  const itens = page.getByRole('list', { name: 'Itens lidos' });
  const item = itens.locator('.item-lido', { hasText: 'DETERGENTE NEUTRO 500ML' });
  const candidatos = item.getByRole('group', { name: /Correspondências para DETERGENTE/ });
  await expect(candidatos.getByRole('button', { name: /Detergente neutro/ })).toBeVisible();
  // Ainda pendente: o motor só sugere.
  await expect(item).toHaveAttribute('data-situacao', 'pendente');
  const patch = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes('/itens/'));
  await candidatos.getByRole('button', { name: /Detergente neutro/ }).click();
  expect((await patch).postDataJSON()).toMatchObject({ insumo_id: (await criar.json()).id });
  await expect(itens.locator('.item-lido', { hasText: 'DETERGENTE NEUTRO 500ML' })).toHaveAttribute('data-situacao', 'confirmado');
});

test('ponta a ponta: cadastrar insumo, escolhê-lo numa compra (e cadastrar outro pelo seletor), conferir e usar numa ficha', async ({ page }) => {
  const PIX_PADARIA = 'e2000000-0000-4000-8000-000000000008'; // Pix de R$ 150,00 da Júlia, só com o comprovante
  // 1. Cadastro de um insumo em Insumos.
  await page.goto(`${DEMO}/admin/estoque`);
  await page.getByRole('button', { name: 'Novo insumo' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo insumo' });
  await novo.getByLabel('Nome').fill('Fermento biológico');
  await novo.getByLabel('Estoque mínimo (kg)').fill('0,5');
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(novo.getByRole('region', { name: 'Cadastrados agora' })).toContainText('Fermento biológico');
  await novo.getByRole('button', { name: 'Concluir' }).click();

  // 2. Conferência da compra que veio do Financeiro (Pix da Júlia sem os itens).
  await page.goto(`${DEMO}/admin/estoque?aba=compras&compra=${PIX_PADARIA}`);
  const gaveta = page.getByRole('dialog', { name: 'Padaria Trigo de Ouro' });
  await expect(gaveta.locator('[data-teste="status-conferencia"]')).toHaveText('Itens ainda não informados.');
  await expect(gaveta.locator('.aviso--atencao')).toHaveCount(0);
  // Seletor único: busca no cadastro real, sem texto livre; carregando/vazio dentro da lista.
  const insumo1 = gaveta.getByRole('combobox', { name: 'Insumo 1' });
  await insumo1.fill('xyz inexistente');
  await expect(page.getByRole('listbox', { name: 'Insumo 1' })).toContainText('Nenhum insumo com “xyz inexistente”.');
  await insumo1.fill('fermento');
  await page.getByRole('option', { name: /Fermento biológico/ }).click();
  await expect(insumo1).toHaveValue('Fermento biológico');
  const linha1 = gaveta.locator('.itens-tabela__linha').nth(1);
  await expect(linha1.locator('.seletor-insumo__unidade')).toHaveText('g');
  // A unidade da compra acompanha a cadastrada (g → KG).
  await expect(linha1.getByLabel('Unidade')).toHaveValue('KG');
  await linha1.getByLabel('Quantidade').fill('2');
  await linha1.getByLabel('Valor unitário').fill('30,00');
  await expect(linha1.getByLabel('Subtotal')).toHaveText(/60,00/);

  // Insumo que não existe: cadastro rápido e volta à compra com ele escolhido (pelo id novo).
  const insumo2 = gaveta.getByRole('combobox', { name: 'Insumo 2' });
  await insumo2.fill('Farinha de centeio');
  await page.getByRole('option', { name: 'Cadastrar “Farinha de centeio”' }).click();
  const rapido = page.getByRole('dialog', { name: 'Cadastrar insumo' });
  await expect(rapido.getByLabel('Nome')).toHaveValue('Farinha de centeio');
  await expect(rapido.getByLabel(/Quantidade inicial/)).toHaveCount(0);
  await rapido.getByLabel('Estoque mínimo (kg)').fill('1');
  await rapido.getByRole('button', { name: 'Cadastrar e usar' }).click();
  await expect(rapido).toHaveCount(0);
  await expect(insumo2).toHaveValue('Farinha de centeio');
  // Sem duplicar: o mesmo nome não oferece outro cadastro.
  const linha2 = gaveta.locator('.itens-tabela__linha').nth(2);
  await linha2.getByLabel('Unidade').selectOption('KG');
  await linha2.getByLabel('Quantidade').fill('10');
  await linha2.getByLabel('Valor unitário').fill('9,00');
  const totais = gaveta.locator('[data-teste="soma-produtos"]');
  await expect(totais).toContainText('Total dos itens');
  await expect(totais).toContainText('R$ 150,00');
  await expect(totais).toContainText('Confere');
  await gaveta.getByRole('button', { name: 'Salvar itens' }).click();
  await expect(gaveta.getByRole('list', { name: 'Itens lidos' }).locator('.item-lido')).toHaveCount(2);
  // Itens escolhidos no seletor já nascem conferidos: nenhuma sugestão a confirmar.
  await expect(gaveta.locator('.item-lido[data-situacao="confirmado"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(gaveta.getByText('É o pagamento que a Júlia registrou')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(gaveta.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
  await page.getByRole('button', { name: 'Concluir' }).click();

  // O estoque entrou só na confirmação, com o custo da compra.
  const lista = await (await page.request.get(`${DEMO}/admin/api/estoque/insumos?limite=200`)).json();
  const fermento = lista.itens.find((i: { nome: string }) => i.nome === 'Fermento biológico');
  const centeio = lista.itens.find((i: { nome: string }) => i.nome === 'Farinha de centeio');
  expect(Number(fermento.saldo)).toBe(2000);
  expect(Number(centeio.saldo)).toBe(10000);
  expect(lista.itens.filter((i: { nome: string }) => i.nome === 'Farinha de centeio')).toHaveLength(1);

  // 3. A ficha técnica de um produto da Eyemobile usa os insumos (pelo id), com o preço médio que veio da compra.
  await page.goto(`${DEMO}/admin/estoque?aba=fichas`);
  await page.getByRole('list', { name: 'Produtos da Eyemobile' }).getByRole('button', { name: /Sanduíche de brie/ }).click();
  const ficha = page.getByRole('dialog', { name: 'Sanduíche de brie' });
  await ficha.getByRole('button', { name: 'Cadastrar ficha' }).click();
  await ficha.getByRole('combobox', { name: 'Ingrediente 1' }).fill('fermento');
  await page.getByRole('option', { name: /Fermento biológico/ }).click();
  await expect(ficha).toContainText('Preço médio R$ 30,00/kg');
  await ficha.getByLabel('Quantidade').fill('15');
  await expect(ficha.getByLabel('Unidade')).toHaveValue('1');
  await ficha.getByRole('button', { name: 'Revisar e salvar' }).click();
  await confirmar(page, 'Cadastrar a ficha técnica?', 'Salvar ficha');
  await expect(ficha.getByRole('table', { name: 'Ingredientes' })).toContainText('Fermento biológico');
  const salva = await (await page.request.get(`${DEMO}/admin/api/estoque/fichas/produto/6002`)).json();
  expect(salva.itens[0]).toMatchObject({ insumo_id: fermento.id });
  expect(Number(salva.itens[0].quantidade)).toBe(15);
});
