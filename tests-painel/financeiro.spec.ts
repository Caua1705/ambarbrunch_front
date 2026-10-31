// Financeiro na demonstração: as sete abas do painel antigo mais Categorias (0019), os endereços antigos ainda abrindo a
// aba certa e o que é só do Proprietário (participação da Roll) — a gerente não vê na tela e a rota responde 403.
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const ABAS = [/^Resumo/, /^Vendas/, /^Lançamentos/, /^Contas a pagar/, /^Revisão/, /^Resultado/, /^Contas fixas e taxas/, /^Categorias/];

test('oito abas; endereços antigos (relatorios, revisar=1) caem na aba nova', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro`);
  const abas = page.getByRole('tablist', { name: 'Seções' }).getByRole('tab');
  await expect(abas).toHaveCount(8);
  for (const [i, nome] of ABAS.entries()) await expect(abas.nth(i)).toHaveText(nome);

  await page.goto(`${DEMO}/admin/financeiro?aba=relatorios`);
  await expect(page.getByRole('tab', { name: /^Resultado/ })).toHaveAttribute('aria-selected', 'true');
  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos&revisar=1`);
  await expect(page.getByRole('tab', { name: /^Revisão/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /Documentos do grupo/ })).toBeVisible();
});

test('Vendas: por dia, semana e mês, com o recebido por meio', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro?aba=vendas`);
  await expect(page.getByRole('table', { name: 'Vendas por período', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recebido por meio' })).toBeVisible();
  await page.getByRole('group', { name: 'Agrupar por' }).getByRole('button', { name: 'Mês' }).click();
  await expect(page.getByRole('columnheader', { name: 'Mês' })).toBeVisible();
});

test('Lançamentos: outra receita lançada aparece e pode ser cancelada com motivo', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos`);
  await page.getByRole('button', { name: 'Outra receita' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Outra receita' });
  await gaveta.getByLabel('Descrição').fill('Evento teste da demonstração');
  await gaveta.getByLabel('Valor').fill('1250,00');
  await gaveta.getByRole('button', { name: 'Lançar receita' }).click();
  await expect(gaveta).toHaveCount(0);
  await page.getByLabel('Mostrar').selectOption('outra_receita');
  const linha = page.getByRole('row', { name: /Evento teste da demonstração/ });
  await expect(linha).toBeVisible();
  await linha.getByRole('button', { name: /Ações para/ }).click();
  await page.getByRole('menuitem', { name: 'Cancelar receita' }).click();
  await page.getByRole('alertdialog').getByRole('textbox').fill('Lançada por engano no teste');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar receita' }).click();
  await expect(linha.getByText('Cancelada')).toBeVisible();
});

test('Resultado: participação da Roll só para o Proprietário (simulação)', async ({ page }) => {
  await entrarDemo(page, 'admin');
  await page.goto(`${DEMO}/admin/financeiro?aba=resultado`);
  await expect(page.getByText('Participação da Roll — simulação')).toBeVisible();
  await expect(page.getByRole('table', { name: /Simulação da participação/ })).toBeVisible();

  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro?aba=resultado`);
  await expect(page.getByText(/Resultado gerencial ·/)).toBeVisible();
  await expect(page.getByText(/Participação da Roll/)).toHaveCount(0);
  const mes = new Date().toISOString().slice(0, 7);
  expect((await page.request.get(`${DEMO}/admin/api/financeiro/apuracoes/${mes}/participacao`)).status()).toBe(403);
});

test('Contas fixas e taxas: lista as duas e registra uma nova vigência de taxa', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro?aba=contas-fixas`);
  await expect(page.getByText('Aluguel da loja')).toBeVisible();
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
