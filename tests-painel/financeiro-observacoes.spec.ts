// Observações (0043, pedido do dono 18/11/2026) na demonstração (backend falso, nada real é lançado): texto livre e
// opcional no cadastro e na edição da despesa e da conta recorrente, visível ao consultar, sem mudar a descrição.
// Caso: "Sistema Financeiro" — Z-API R$ 100 + celulares de R$ 30.
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const aba = (page: Page, nome: RegExp) => page.getByRole('tablist', { name: 'Seções' }).getByRole('tab', { name: nome });
const NOV = 'Z-API R$ 100\ncelular Atendimento R$ 30\ncelular Grupo R$ 30';
const DEZ = `${NOV}\ncelular Delivery R$ 30`;

let erros: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrarDemo(page, 'gerente');
});
test.afterEach(() => expect(erros).toEqual([]));

test('despesa: Observações no cadastro, no detalhe e na edição, sem mudar a descrição', async ({ page }) => {
  const nome = `Sistema Financeiro ${Date.now()}`;
  await page.goto(`${DEMO}/admin/financeiro`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await gaveta.getByLabel('Descrição').fill(nome);
  await gaveta.getByLabel('Valor').fill('160,00');
  await gaveta.getByLabel('Categoria').selectOption({ label: 'Operacional' });
  await gaveta.getByLabel(/^Observações/).fill(NOV);
  await gaveta.getByRole('group', { name: 'Situação do pagamento' }).getByRole('button', { name: 'A pagar' }).click();
  await gaveta.getByRole('button', { name: 'Lançar despesa' }).click();
  await expect(gaveta).toHaveCount(0);

  // O detalhe abre sozinho: título = a descrição; observações à parte, com as quebras de linha.
  const detalhe = page.getByRole('dialog', { name: nome });
  await expect(detalhe.getByRole('heading', { name: 'Observações' })).toBeVisible();
  await expect(detalhe.locator('.fin-observacoes')).toHaveText(NOV);
  await detalhe.getByRole('button', { name: 'Fechar' }).click();

  // Edição (lápis da lista): o campo vem preenchido e muda só as observações. (Despesa PAGA sem motivo: provado no
  // backend real, tests/test_financeiro_observacoes.py — o detalhe da demo não traz o responsável.)
  await aba(page, /^Contas a pagar/).click();
  await page.getByLabel('Buscar conta a pagar').fill(nome);
  await page.getByRole('button', { name: `Editar ${nome}` }).click();
  const editar = page.getByRole('dialog', { name: 'Editar despesa' });
  await expect(editar.getByLabel(/^Observações/)).toHaveValue(NOV);
  await editar.getByLabel(/^Observações/).fill(DEZ);
  await editar.getByRole('button', { name: 'Salvar' }).click();
  await expect(editar).toHaveCount(0);
  // Reaberta: a observação nova ficou e a descrição não mudou.
  await page.getByRole('button', { name: `Editar ${nome}` }).click();
  await expect(editar.getByLabel(/^Observações/)).toHaveValue(DEZ);
  await expect(editar.getByLabel('Descrição')).toHaveValue(nome);
});

test('conta recorrente: Observações no cadastro, no detalhe e na alteração', async ({ page }) => {
  const nome = `Sistema Financeiro ${Date.now()}`;
  await page.goto(`${DEMO}/admin/financeiro?aba=contas`);
  await page.getByRole('button', { name: 'Tipo da conta a pagar' }).click();
  await page.getByRole('menuitem', { name: /^Recorrente/ }).click();
  const nova = page.getByRole('dialog', { name: 'Nova conta recorrente' });
  await nova.getByLabel('Descrição').fill(nome);
  await nova.getByLabel('Categoria').selectOption({ label: 'Operacional' });
  await nova.getByLabel('Valor previsto').fill('160,00');
  await nova.getByLabel(/^Observações/).fill(NOV);
  await nova.getByRole('button', { name: 'Salvar' }).click();
  await expect(nova).toHaveCount(0);

  await aba(page, /^Contas recorrentes/).click();
  await page.getByText(nome).click();
  const detalhe = page.getByRole('dialog', { name: nome });
  await expect(detalhe.locator('.fin-observacoes')).toHaveText(NOV);
  await detalhe.getByRole('button', { name: 'Editar' }).click();
  const alterar = page.getByRole('dialog', { name: 'Alterar conta recorrente' });
  await expect(alterar.getByLabel(/^Observações/)).toHaveValue(NOV);
  await alterar.getByLabel('Valor previsto').fill('190,00');
  await alterar.getByLabel(/^Observações/).fill(DEZ);
  await alterar.getByRole('button', { name: 'Salvar' }).click();
  await expect(alterar).toHaveCount(0);
  await page.getByText(nome).click();
  await expect(page.getByRole('dialog', { name: nome }).locator('.fin-observacoes')).toHaveText(DEZ);
});
