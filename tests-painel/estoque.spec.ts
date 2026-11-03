// Estoque em quatro áreas (02/11/2026) na demonstração: saldo desconhecido ≠ zero, situações, saída e ajuste com
// histórico e nome do responsável, contagem em três passos (abertura e diferenças positiva/negativa), entrada sem nota
// pela mesma conferência, fichas incompletas e baixa automática desligada. A demonstração reproduz as regras do backend
// (insumos.situacao, operacoes.registrar_perda, fechar_inventario); a integração real fica em tests-painel-real.
// O estado do servidor é compartilhado: cada teste mexe num insumo DIFERENTE, e a ordem importa (1 worker).
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

let erros: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrarDemo(page, 'gerente');
});
test.afterEach(() => expect(erros).toEqual([]));

const linha = (page: Page, nome: string) => page.getByRole('table', { name: 'Estoque atual' }).getByRole('row', { name: new RegExp(nome) });

test('estoque atual: quatro áreas, situações reais, item nunca contado sem zero e baixa automática desligada', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await expect(page.getByRole('tab')).toHaveText([/^Estoque atual$/, /^Recebimentos\d*$/, /^Contagem$/, /^Fichas e custos$/]);
  await expect(page.getByRole('tab', { name: /Mais/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar movimento' })).toBeVisible();

  // Nunca conferido: nem "0" nem "Sem estoque".
  const cogumelo = linha(page, 'Cogumelo paris');
  await expect(cogumelo).toContainText('Não conferido');
  await expect(cogumelo).toContainText('—');
  await expect(cogumelo).not.toContainText('Sem estoque');
  // Entradas sem contagem: o registrado aparece, marcado como tal.
  await expect(linha(page, 'Canela em pó')).toContainText('só entradas, sem contagem');
  await expect(linha(page, 'Cream cheese')).toContainText('Estoque baixo');
  await expect(linha(page, 'Tomate italiano')).toContainText('Sem estoque');
  await expect(linha(page, 'Leite integral')).toContainText('Normal');
  await expect(page.locator('.estoque-numero', { hasText: 'Abaixo do mínimo' })).toContainText('3');
  await expect(page.getByText('Baixa automática pelas vendas:')).toContainText('desligada');

  // Um filtro de situação; o de categoria só existe porque há várias.
  await page.getByLabel('Situação', { exact: true }).selectOption('nao_conferido');
  await expect(linha(page, 'Cogumelo paris')).toBeVisible();
  await expect(linha(page, 'Leite integral')).toHaveCount(0);
  await page.getByLabel('Situação', { exact: true }).selectOption('baixo');
  await expect(linha(page, 'Morango')).toBeVisible();
  await expect(linha(page, 'Cogumelo paris')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('usuario:');
});

test('saída manual (uso interno): sai do saldo e o histórico mostra motivo e o nome de quem registrou', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await linha(page, 'Açúcar refinado').click();
  const insumo = page.getByRole('dialog', { name: 'Açúcar refinado' });
  await expect(insumo.locator('.insumo-saldo')).toContainText('9 kg');
  await insumo.getByRole('button', { name: 'Saída' }).click();
  const saida = page.getByRole('dialog', { name: 'Saída' });
  await saida.getByLabel('Quantidade que saiu').fill('0,5');
  await expect(saida.getByLabel('Unidade')).toHaveValue('1000');
  await saida.getByLabel('Motivo').selectOption('uso_interno');
  await saida.getByLabel('Observação').fill('café da equipe');
  await saida.getByRole('button', { name: 'Registrar saída' }).click();
  await expect(page.getByText('Saída registrada: Açúcar refinado.')).toBeVisible();
  await expect(insumo.locator('.insumo-saldo')).toContainText('8,5 kg');
  const ultimo = insumo.locator('.movimento').first();
  await expect(ultimo).toContainText('Saída manual');
  await expect(ultimo).toContainText('Uso interno: café da equipe');
  await expect(ultimo).toContainText('Gabriela Gerente (demo)');
  await expect(ultimo).toContainText('-0,5 kg');
  await expect(insumo).not.toContainText('usuario:');
});

test('ajuste: vira uma contagem de um item, com antes, contado e diferença, e entra no histórico das contagens', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await linha(page, 'Farinha de trigo').click();
  const insumo = page.getByRole('dialog', { name: 'Farinha de trigo' });
  await insumo.getByRole('button', { name: 'Ajuste' }).click();
  const ajuste = page.getByRole('dialog', { name: 'Ajuste de saldo' });
  await expect(ajuste).toContainText('18 kg');
  await ajuste.getByLabel('Quantidade real agora').fill('17,5');
  await expect(ajuste.locator('.ajuste-previa')).toContainText('-0,5 kg');
  await ajuste.getByRole('button', { name: 'Registrar ajuste' }).click();
  await expect(ajuste.getByRole('heading', { name: 'Saldo ajustado' })).toBeVisible();
  await expect(ajuste.locator('.definicoes')).toContainText('-0,5 kg');
  await ajuste.getByRole('button', { name: 'Concluir' }).click();
  await expect(insumo.locator('.insumo-saldo')).toContainText('17,5 kg');
  await expect(insumo.locator('.movimento').first()).toContainText('Ajuste por contagem');
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: 'Contagem' }).click();
  const historico = page.getByRole('table', { name: 'Contagens anteriores' });
  await expect(historico.getByRole('row')).toHaveCount(3); // cabeçalho + a antiga + o ajuste
  await expect(historico).toContainText('Gabriela Gerente (demo)');
  // Nenhuma contagem ficou aberta pela metade.
  await expect(page.getByRole('button', { name: /Começar contagem/ })).toBeVisible();
});

test('contagem em três passos: abertura de um item nunca contado, diferença negativa e positiva, histórico', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=contagem`);
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
  await page.getByRole('button', { name: 'Revisar diferenças' }).click();

  await expect(page.locator('.guia-passos__item--atual')).toContainText('Revisar e confirmar');
  const revisao = page.getByRole('table', { name: 'Diferenças da contagem' });
  await expect(revisao.getByRole('row', { name: /Cogumelo paris/ })).toContainText('Saldo inicial');
  await expect(revisao.getByRole('row', { name: /Leite integral/ })).toContainText('-2 L');
  await expect(revisao.getByRole('row', { name: /Ovos/ })).toContainText(/\+\d+ un/);
  await page.getByRole('button', { name: 'Confirmar contagem' }).click();
  await page.getByRole('dialog', { name: 'Confirmar a contagem?' }).getByRole('button', { name: 'Confirmar contagem' }).click();
  const ajustes = page.getByRole('table', { name: 'Ajustes da contagem' });
  await expect(ajustes.getByRole('row', { name: /Leite integral/ })).toContainText('-2 L');
  await expect(ajustes.getByRole('row', { name: /Cogumelo paris/ })).toContainText('Saldo inicial');
  await page.getByRole('button', { name: 'Concluir' }).click();

  await page.getByRole('tab', { name: 'Estoque atual' }).click();
  await expect(linha(page, 'Cogumelo paris')).toContainText('Normal');
  await expect(linha(page, 'Leite integral')).toContainText('40');
});

test('entrada sem nota: Registrar movimento → Entrada → mesma conferência; o saldo só muda ao confirmar o recebimento', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque`);
  await expect(linha(page, 'Pão de fermentação natural')).toContainText('18');
  await page.getByRole('button', { name: 'Registrar movimento' }).click();
  const mov = page.getByRole('dialog', { name: 'Registrar movimento' });
  await mov.getByRole('button', { name: /Entrada/ }).click();
  await page.getByRole('dialog', { name: 'Entrada' }).getByRole('button', { name: /Sem nota/ }).click();
  const rec = page.getByRole('dialog', { name: 'Recebimento sem nota' });
  await rec.getByLabel('Fornecedor').fill('Padaria do bairro');
  await rec.getByRole('combobox', { name: 'Produto 1' }).fill('pão');
  await page.getByRole('option', { name: /Pão de fermentação natural/ }).click();
  await rec.getByLabel('Qtd.').fill('6');
  await rec.getByLabel('Valor unit.').fill('6,50');
  await rec.getByRole('button', { name: 'Continuar para a conferência' }).click();

  // Caiu em Recebimentos, na conferência do recebimento novo; nada entrou ainda.
  await expect(page).toHaveURL(/aba=recebimentos&compra=/);
  const conferencia = page.getByRole('dialog');
  await expect(conferencia).toContainText('Digitada');
  const saldoAntes = await (await page.request.get(`${DEMO}/admin/api/estoque/insumos?limite=200`)).json();
  expect(saldoAntes.itens.find((i: { nome: string }) => i.nome === 'Pão de fermentação natural').saldo).toBe('18.0000');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(conferencia.getByText('Conta a pagar')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(conferencia.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
  await page.getByRole('button', { name: 'Concluir' }).click();

  await page.getByRole('tab', { name: 'Estoque atual' }).click();
  await expect(linha(page, 'Pão de fermentação natural')).toContainText('24');
  await page.getByRole('tab', { name: /Recebimentos/ }).click();
  await page.getByRole('group', { name: 'Quais recebimentos' }).getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByRole('table', { name: 'Histórico de recebimentos' }).getByRole('row', { name: /Padaria do bairro/ })).toContainText('sem nota');
});

test('recebimentos: comprovante da Júlia aparece como pendente com "faltam os produtos", sem botões soltos', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=recebimentos`);
  const pix = page.getByRole('table', { name: 'Recebimentos pendentes' }).getByRole('row', { name: /Padaria Trigo de Ouro/ });
  await expect(pix).toContainText('Júlia');
  await expect(pix).toContainText('comprovante de pagamento');
  await expect(pix).toContainText('Faltam os produtos');
  await expect(page.getByRole('button', { name: 'Compra sem nota' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar nota' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Novo recebimento' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo recebimento' });
  await expect(novo.getByRole('button', { name: /Com nota fiscal/ })).toBeVisible();
  await expect(novo.getByRole('button', { name: /Sem nota/ })).toBeVisible();
});

test('fichas e custos: sem ficha e custo indisponível não mostram custo; CMV indisponível explica o motivo', async ({ page }) => {
  await page.goto(`${DEMO}/admin/estoque?aba=custos`);
  const fichas = page.getByRole('table', { name: 'Fichas técnicas' });
  await expect(fichas.getByRole('row', { name: /Roll de pistache/ })).toContainText('Custo indisponível');
  await expect(fichas.getByRole('row', { name: /Roll de chocolate/ })).toContainText('Sem ficha');
  await expect(fichas.getByRole('row', { name: /Cappuccino/ })).toContainText('Completa');
  await fichas.getByRole('row', { name: /Roll de pistache/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Roll de pistache' });
  await expect(gaveta).toContainText('Produto da Eyemobile');
  await expect(gaveta.locator('.indicador', { hasText: 'Custo da porção' })).toContainText('Indisponível');
  await expect(gaveta.locator('.indicador', { hasText: 'Margem hoje' })).toContainText('—');
  await page.keyboard.press('Escape');

  await page.getByRole('group', { name: 'Fichas e custos' }).getByRole('button', { name: 'CMV e custos' }).click();
  await expect(page.getByRole('region', { name: 'CMV teórico' })).toContainText('Indisponível');
  await expect(page.getByRole('region', { name: 'Consumo e diferenças físicas' })).toBeVisible();
  await expect(page.getByText('Por que ainda não há CMV confiável:')).toBeVisible();
  // Com a baixa desligada não há previsão de falta nem reposição sugerida.
  await expect(page.getByText(/Pode faltar|Reposição sugerida/)).toHaveCount(0);
});
