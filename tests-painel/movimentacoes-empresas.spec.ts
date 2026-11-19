// Movimentações (18/11/2026, pedido do dono) na demonstração (backend falso, nada real é lançado):
//  - só as TRÊS empresas (ÂMBAR, ROLL, ÂMBARXROLL): sem "pessoal", "gastos pessoais" ou quarta opção, no computador e no
//    celular; o filtro Empresa muda a lista e os totais;
//  - Receitas: a receita a receber aparece (marcada) e o topo soma só o que entrou, com o a receber à parte;
//  - extrato: a saída de R$ 574,96 quita a conta de R$ 500,00 com R$ 74,96 de juros/encargos (0042) — só quando a pessoa
//    marca que a diferença é encargo.
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo, semRolagemHorizontal } from './apoio';

const despesas = (page: Page) => page.getByRole('table', { name: 'Despesas do período' });
const receitas = (page: Page) => page.getByRole('table', { name: 'Receitas do período' });
const PESSOAL = /pessoa(l|is)/i;

let erros: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrarDemo(page, 'gerente');
});
test.afterEach(() => expect(erros).toEqual([]));

test('Despesas: só as três empresas, sem "pessoal", e o filtro Empresa muda a lista e o total', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?periodo=todo`);
  await page.getByLabel('Período', { exact: true }).selectOption('todo');
  const tabela = despesas(page);
  await expect(tabela.getByRole('row').nth(1)).toBeVisible();
  const empresa = page.getByLabel('Empresa');
  await expect(empresa.locator('option')).toHaveText(['Todas as empresas', 'ÂMBAR', 'ROLL', 'ÂMBARXROLL']);
  await expect(page.locator('main')).not.toContainText(PESSOAL);
  await expect(page.getByText('Pago com conta pessoal')).toHaveCount(0);

  const totalPago = page.locator('.fin-totais').getByText('Total pago').locator('xpath=following-sibling::strong');
  const total = await totalPago.textContent();
  // Cada empresa só traz as suas linhas; a soma das três dá o total de "Todas".
  const centavos = (t: string | null) => Math.round(Number((t ?? '').replace(/[^\d,]/g, '').replace(',', '.')) * 100);
  let soma = 0;
  for (const [valor, rotulo] of [['ambar', 'ÂMBAR'], ['roll', 'ROLL'], ['conjunta', 'ÂMBARXROLL']] as const) {
    await empresa.selectOption(valor);
    await expect(page).toHaveURL(new RegExp(`empresa=${valor}`));
    await expect(tabela.or(page.getByText('Nenhuma movimentação no período'))).toBeVisible();
    const pagadores = await tabela.locator('tbody td[data-col="pagador"]').allTextContents();
    for (const p of pagadores) expect(p.trim()).toBe(rotulo);
    soma += centavos(await totalPago.textContent());
  }
  // Pagamento ainda sem pagador (pendência; em produção, 18/11, nenhum) não é de empresa nenhuma — nunca uma quarta.
  const semPagador = await (await page.request.get(`${DEMO}/admin/api/financeiro/lancamentos?grupo=despesas&pagador=nenhum&limite=500`)).json();
  expect(soma + Math.round(Number(semPagador.totais.valor) * 100)).toBe(centavos(total));
  await empresa.selectOption('');
  await expect(totalPago).toHaveText(total!);
});

test('Receitas: a receita a receber aparece marcada e o topo separa recebido de a receber', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?tipo=receitas`);
  await expect(page.getByLabel('Empresa')).toHaveCount(0);           // receita não tem empresa pagadora
  await page.getByRole('button', { name: 'Outra receita' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Outra receita' });
  await gaveta.getByLabel('Descrição').fill('Evento a receber — teste');
  await gaveta.getByLabel('Valor').fill('800,00');
  await gaveta.getByLabel('Categoria').selectOption('locacao_espaco');
  await gaveta.getByRole('group', { name: 'Situação do recebimento' }).getByRole('button', { name: 'A receber' }).click();
  await gaveta.getByRole('button', { name: 'Lançar receita' }).click();
  await expect(receitas(page).getByRole('row', { name: /Evento a receber — teste/ })).toContainText('a receber');
  await expect(page.locator('.fin-totais')).toContainText('A receber');
  await expect(page.locator('.fin-totais')).toContainText('800,00');
});

test('Celular: Movimentações sem "pessoal", só as três empresas e sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${DEMO}/admin/financeiro`);
  await page.getByLabel('Período', { exact: true }).selectOption('todo');
  await expect(despesas(page).getByRole('row').nth(1)).toBeVisible();
  await expect(page.locator('main')).not.toContainText(PESSOAL);
  await expect(page.getByLabel('Empresa').locator('option')).toHaveText(['Todas as empresas', 'ÂMBAR', 'ROLL', 'ÂMBARXROLL']);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: 'test-results/movimentacoes-celular.png', fullPage: true });
});

test('Extrato: saída de R$ 574,96 quita a conta de R$ 500,00 só marcando os R$ 74,96 como juros/encargos', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=conciliacao`);
  await page.getByRole('row', { name: /PIX ENVIADO MAQUINA DE CAFE/ }).click();
  const gaveta = page.getByRole('dialog', { name: /Saída de R\$\s?574,96/ });
  await gaveta.getByRole('radio').first().check();
  await expect(gaveta.getByText(/é maior que a conta/)).toContainText('74,96');
  await expect(gaveta.getByText(/continuam a conciliar/)).toBeVisible();      // sem marcar: nada presumido
  await gaveta.getByLabel('A diferença é juros, multa ou encargos').check();
  await expect(gaveta.getByRole('textbox', { name: 'Juros, multa ou encargos' })).toHaveValue('74,96');
  await expect(gaveta.getByText(/Conta quitada: R\$\s?500,00/)).toBeVisible();
  await page.getByRole('button', { name: 'Marcar esta conta como paga' }).click();
  await expect(page.getByText(/Conta quitada: R\$\s?500,00 da conta \+ R\$\s?74,96 de juros\/encargos/)).toBeVisible();
  await expect(gaveta).toHaveCount(0);

  // A conta sai de Contas a pagar e Despesas mostra UM pagamento de 574,96 com os encargos.
  await page.goto(`${DEMO}/admin/financeiro?aba=contas`);
  await page.getByLabel('Buscar conta a pagar').fill('Aluguel de Máquina de Café (extrato)');
  await expect(page.getByText('Nenhuma conta com essa busca')).toBeVisible();
  await page.goto(`${DEMO}/admin/financeiro`);
  await page.getByLabel('Buscar movimentação').fill('Aluguel de Máquina de Café (extrato)');
  const linha = despesas(page).getByRole('row', { name: /Aluguel de Máquina de Café \(extrato\)/ });
  await expect(linha).toHaveCount(1);
  await expect(linha).toContainText('574,96');
  await expect(linha).toContainText('inclui R$ 74,96 de juros/encargos');
});
