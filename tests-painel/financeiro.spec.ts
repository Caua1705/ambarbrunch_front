// Financeiro na demonstração: as cinco áreas (Lançamentos, Contas a pagar, Revisão, Conciliação, Relatórios e cadastros),
// os endereços antigos abrindo a tela nova certa e o que é só do Proprietário (participação da Roll) — a gerente não vê
// na tela e a rota responde 403.
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const ABAS = [/^Lançamentos/, /^Contas a pagar/, /^Revisão/, /^Conciliação/, /^Relatórios e cadastros/];

test('cinco áreas, sem segundo dashboard; endereços antigos caem na tela nova', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro`);
  const abas = page.getByRole('tablist', { name: 'Seções' }).getByRole('tab');
  await expect(abas).toHaveCount(5);
  for (const [i, nome] of ABAS.entries()) await expect(abas.nth(i)).toHaveText(nome);
  await expect(page.getByRole('tab', { name: /^Lançamentos/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.indicador')).toHaveCount(0);

  for (const [antigo, aba, item] of [
    ['relatorios', /^Relatórios/, 'Resultado do mês'],
    ['resultado', /^Relatórios/, 'Resultado do mês'],
    ['vendas', /^Relatórios/, 'Vendas (Eyemobile)'],
    ['categorias', /^Relatórios/, 'Categorias'],
  ] as const) {
    await page.goto(`${DEMO}/admin/financeiro?aba=${antigo}`);
    await expect(page.getByRole('tab', { name: aba }), antigo).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('navigation', { name: 'Relatórios e cadastros' }).getByRole('button', { name: item }), antigo).toHaveAttribute('aria-current', 'page');
  }
  await page.goto(`${DEMO}/admin/financeiro?aba=contas-fixas`);
  await expect(page.getByRole('tab', { name: /^Contas a pagar/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('group', { name: 'Contas a pagar ou recorrentes' }).getByRole('button', { name: 'Recorrentes' })).toHaveAttribute('aria-pressed', 'true');
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
  await page.getByRole('button', { name: /^Filtros/ }).click();
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

test('Recorrentes em Contas a pagar; taxas contratadas em Conciliação → Stone, com nova vigência', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro?aba=contas&vista=recorrentes`);
  await expect(page.getByText('Aluguel da loja')).toBeVisible();
  await page.goto(`${DEMO}/admin/financeiro?aba=conciliacao&vista=stone`);
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
  await entrarDemo(page, 'gerente');
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
  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  await gaveta.getByRole('button', { name: 'Fornecedor e comprovante' }).click();
  await gaveta.locator('input[type="file"]').setInputFiles(arquivo);
  await expect(gaveta.getByText(/Este arquivo já tinha sido enviado/)).toBeVisible();
});

test('Fornecedores: busca no cadastro, recusa o repetido e a Nova despesa escolhe do cadastro', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/financeiro?aba=relatorios&relatorio=fornecedores`);
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
  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const nova = page.getByRole('dialog', { name: 'Nova despesa' });
  await nova.getByRole('button', { name: 'Fornecedor e comprovante' }).click();
  await nova.getByRole('combobox', { name: 'Fornecedor' }).fill(primeiro.slice(0, 4));
  await expect(nova.getByRole('option', { name: new RegExp(primeiro.slice(0, 4)) }).first()).toBeVisible();
});
