// Estoque em três abas (08/11/2026) na demonstração: Insumos (saldo desconhecido ≠ zero, situações, cadastro com
// quantidade inicial, conferir, corrigir com justificativa, perda/uso interno com confirmação, "Contar estoque" em três
// passos), Compras (comprovante da Júlia pendente, compra sem nota pela mesma conferência) e Fichas técnicas (catálogo
// dos mais vendidos, ficha com margem parcial, editor só com insumos do estoque, Custos e CMV sem número inventado).
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
  // A baixa está desligada na demonstração: o aviso diz o que isso significa, sem esconder.
  await expect(page.getByText('As vendas ainda não descontam do estoque.')).toBeVisible();

  const cabecalho = page.getByRole('table', { name: 'Insumos' }).getByRole('columnheader');
  await expect(cabecalho).toContainText(['Insumo', 'Quantidade', 'Mínimo', 'Preço médio', 'Situação', 'Conferido em']);
  // O backend ainda não guarda o estoque ideal: a coluna não aparece vazia.
  await expect(cabecalho.filter({ hasText: 'Ideal' })).toHaveCount(0);

  // Nunca conferido: nem "0" nem "Esgotado".
  const cogumelo = linha(page, 'Cogumelo paris');
  await expect(cogumelo).toContainText('Não conferido');
  await expect(cogumelo).toContainText('—');
  await expect(cogumelo).toContainText('Nunca');
  await expect(cogumelo).not.toContainText('Esgotado');
  await expect(linha(page, 'Canela em pó')).toContainText('só compras, sem contagem');
  await expect(linha(page, 'Cream cheese')).toContainText('Baixo');
  await expect(linha(page, 'Tomate italiano')).toContainText('Esgotado');
  await expect(linha(page, 'Leite integral')).toContainText('Normal');
  await expect(linha(page, 'Açúcar refinado')).toContainText('R$ 4,90/kg');
  await expect(linha(page, 'Açúcar refinado')).toContainText('9 kg');

  await page.getByLabel('Buscar insumo').fill('morango');
  await expect(linha(page, 'Morango')).toBeVisible();
  await expect(linha(page, 'Cogumelo paris')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('usuario:');
});

test('cadastro: um atrás do outro, sem categoria nem "mais opções"; mínimo obrigatório; kg vira gramas; ideal desligado até o backend guardar', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await page.getByRole('button', { name: 'Novo insumo' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo insumo' });
  await expect(novo.getByLabel('Categoria')).toHaveCount(0);
  await expect(novo.getByText('Mais opções')).toHaveCount(0);
  await expect(novo.getByLabel('Tipo')).toHaveCount(0);
  await novo.getByLabel('Nome').fill('Açúcar mascavo');
  await expect(novo.getByLabel('Unidade', { exact: true })).toHaveValue('kg');
  await novo.getByLabel('Quantidade inicial (kg)').fill('2,5');
  await expect(novo).toContainText('Quantidade que dispara o alerta');
  await expect(novo).toContainText('Quantidade que queremos alcançar depois de comprar.');
  await expect(novo.getByLabel('Estoque ideal (kg)')).toBeDisabled();
  await expect(novo).toContainText('Ainda não é salvo pelo sistema');
  // Sem o mínimo, não cadastra (é ele que liga o alerta).
  await novo.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(novo.locator('.aviso').first()).toContainText('Informe o estoque mínimo');
  await novo.getByLabel('Estoque mínimo (kg)').fill('1');
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
  const lista = await (await page.request.get(`${DEMO}/admin/api/estoque/insumos?limite=200`)).json();
  const criado = lista.itens.find((i: { nome: string }) => i.nome === 'Açúcar mascavo');
  expect(criado).toMatchObject({ unidade_base: 'g', estoque_minimo: expect.stringMatching(/^1000(\.0+)?$/) });
  expect(Number(criado.saldo)).toBe(2500);
});

test('perda ou uso interno: confirma antes, sai do saldo com motivo próprio (não é perda) e o nome de quem registrou', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await linha(page, 'Açúcar refinado').click();
  const insumo = page.getByRole('dialog', { name: 'Açúcar refinado' });
  await expect(insumo.locator('.insumo-saldo')).toContainText('9 kg');
  await expect(insumo.getByRole('button', { name: 'Conferir quantidade' })).toBeVisible();
  await expect(insumo.getByRole('button', { name: 'Corrigir saldo' })).toBeVisible();
  await expect(insumo.getByRole('button', { name: 'Editar' })).toBeVisible();
  await insumo.getByRole('button', { name: 'Perda ou uso interno' }).click();
  const saida = page.getByRole('dialog', { name: 'Perda ou uso interno' });
  await saida.getByLabel('Quantidade que saiu').fill('0,5');
  await expect(saida.getByLabel('Unidade')).toHaveValue('1000');
  await saida.getByLabel('Motivo').selectOption('uso_interno');
  await saida.getByLabel('Observação').fill('café da equipe');
  await saida.getByRole('button', { name: 'Revisar saída' }).click();
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

test('corrigir saldo: exige justificativa, confirma e registra saldo anterior, novo, motivo, responsável e data', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await linha(page, 'Farinha de trigo').click();
  const insumo = page.getByRole('dialog', { name: 'Farinha de trigo' });
  await insumo.getByRole('button', { name: 'Corrigir saldo' }).click();
  const ajuste = page.getByRole('dialog', { name: 'Corrigir saldo' });
  await expect(ajuste).toContainText('18 kg');
  await ajuste.getByLabel('Saldo correto').fill('17,5');
  await expect(ajuste.locator('.ajuste-previa')).toContainText('-0,5 kg');
  await ajuste.getByRole('button', { name: 'Revisar correção' }).click();
  await expect(ajuste.getByText('Explique a correção (pelo menos 5 caracteres).')).toBeVisible();
  await ajuste.getByLabel('Motivo').selectOption('erro_de_registro');
  await ajuste.getByLabel('Justificativa').fill('entrada lançada em dobro');
  await ajuste.getByRole('button', { name: 'Revisar correção' }).click();
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

test('conferir quantidade: sem diferença não lança nada, só registra a conferência', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await linha(page, 'Chocolate 70%').click();
  const insumo = page.getByRole('dialog', { name: 'Chocolate 70%' });
  await insumo.getByRole('button', { name: 'Conferir quantidade' }).click();
  const conferir = page.getByRole('dialog', { name: 'Conferir quantidade' });
  await conferir.getByLabel('Quantidade que há agora').fill('2,1');
  await expect(conferir.locator('.ajuste-previa')).toContainText('sem diferença');
  await conferir.getByRole('button', { name: 'Revisar conferência' }).click();
  await confirmar(page, 'Registrar a conferência?', 'Registrar conferência');
  await expect(conferir.getByRole('heading', { name: 'Conferido, sem diferença' })).toBeVisible();
  await expect(conferir).toContainText('Contagem física');
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

test('compra sem nota: Registrar compra → mesma conferência; o saldo só muda ao confirmar o recebimento', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await expect(linha(page, 'Pão de fermentação natural')).toContainText('18');
  await page.getByRole('tab', { name: /Compras/ }).click();
  await page.getByRole('button', { name: 'Registrar compra' }).click();
  const nova = page.getByRole('dialog', { name: 'Registrar compra' });
  await expect(nova.getByRole('button', { name: /Com nota fiscal/ })).toBeVisible();
  await nova.getByRole('button', { name: /Sem nota/ }).click();
  const rec = page.getByRole('dialog', { name: 'Compra sem nota' });
  await rec.getByLabel('Fornecedor').fill('Padaria do bairro');
  await rec.getByRole('combobox', { name: 'Produto 1' }).fill('pão');
  await page.getByRole('option', { name: /Pão de fermentação natural/ }).click();
  await rec.getByLabel('Qtd.').fill('6');
  await rec.getByLabel('Valor unit.').fill('6,50');
  await rec.getByRole('button', { name: 'Continuar para a conferência' }).click();

  // Caiu em Compras, na conferência da compra nova; nada entrou ainda.
  await expect(page).toHaveURL(/aba=compras&compra=/);
  const conferencia = page.getByRole('dialog');
  await expect(conferencia).toContainText('Digitada');
  const saldoAntes = await (await page.request.get(`${DEMO}/admin/api/estoque/insumos?limite=200`)).json();
  expect(saldoAntes.itens.find((i: { nome: string }) => i.nome === 'Pão de fermentação natural').saldo).toBe('18.0000');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(conferencia.getByText('Conta a pagar')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(conferencia.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
  await page.getByRole('button', { name: 'Concluir' }).click();

  await page.getByRole('group', { name: 'Quais compras' }).getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByRole('table', { name: 'Histórico de compras' }).getByRole('row', { name: /Padaria do bairro/ })).toContainText('sem nota');
  await page.getByRole('tab', { name: 'Insumos' }).click();
  await expect(linha(page, 'Pão de fermentação natural')).toContainText('24');
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
  await expect(cappuccino.getByText(/Ainda sem vínculo com o cardápio do site/)).toBeVisible();
});

test('editor de ficha: ingrediente só do estoque, quantidade em kg vira gramas, e a ficha nova passa a valer', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=fichas`);
  await page.getByRole('list', { name: 'Produtos da Eyemobile' }).getByRole('button', { name: /Cheesecake de morango/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Cheesecake de morango' });
  await gaveta.getByRole('button', { name: 'Cadastrar ficha' }).click();
  const ingrediente = gaveta.getByRole('combobox', { name: 'Ingrediente 1' });
  await ingrediente.fill('cream');
  // Só insumos cadastrados: nada de "criar" com texto livre.
  await expect(page.getByRole('option', { name: /Criar|Usar/ })).toHaveCount(0);
  await page.getByRole('option', { name: /^Cream cheese/ }).click();
  await expect(gaveta).toContainText('Preço médio R$ 38,50/kg');
  await gaveta.getByLabel('Quantidade').fill('1,2');
  await gaveta.getByLabel('Unid.').selectOption({ label: 'kg' });
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
