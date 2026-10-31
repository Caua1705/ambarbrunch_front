// Financeiro → Categorias (0019, §5.7) na demonstração: as 7 do Âmbar vêm da API (nenhuma lista fixa no painel), a
// categoria criada aparece sozinha nos seletores (e para a Júlia), a desativada some deles e categoria não se exclui.
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const API = `${DEMO}/admin/api/financeiro`;
const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO };
const SETE = ['Insumos', 'Embalagens', 'Folha', 'Fixo', 'Operacional', 'Obras e equipamentos', 'Tributos'];

async function opcoesDaNovaDespesa(page: Page) {
  await page.goto(`${DEMO}/admin/financeiro?aba=lancamentos`);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova despesa' });
  const select = gaveta.getByLabel('Categoria');
  await expect(select.locator('option', { hasText: 'Insumos' })).toHaveCount(1);
  return (await select.locator('option').allTextContents()).filter((t) => t !== 'Escolha…');
}

let erros: string[] = [];
test.beforeEach(async ({ page }) => {
  erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrarDemo(page, 'gerente');
});
test.afterEach(() => expect(erros).toEqual([]));

test('as 7 categorias do Âmbar vêm da API, com grupo, apelidos e uso; os seletores só oferecem elas', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=categorias`);
  const ativas = page.getByRole('list', { name: 'Categorias ativas' });
  for (const nome of SETE) await expect(ativas.locator('li', { hasText: nome }).first()).toBeVisible();
  await expect(ativas.locator('[data-categoria]')).toHaveCount(7);
  const operacional = ativas.locator('[data-categoria="operacional"]');
  await expect(operacional).toContainText('xerox');
  await expect(operacional).toContainText('Ativa aqui');
  await expect(ativas.locator('[data-categoria="compras_insumos"]')).toContainText(/Em uso por \d+ lançamentos/);
  // As antigas ficam no cadastro, fora de uso; a pendência não é categoria de despesa.
  await expect(page.getByRole('list', { name: 'Categorias fora de uso' }).locator('[data-categoria="aluguel"]')).toBeVisible();
  await expect(page.getByText(/Não classificado.*é a pendência de classificação/)).toBeVisible();
  // Excluir não existe: nem botão na tela, e a API responde 405.
  await expect(page.getByRole('button', { name: /Excluir/ })).toHaveCount(0);
  expect((await page.request.delete(`${API}/categorias/aluguel`, { headers: escrever })).status()).toBe(405);

  expect(await opcoesDaNovaDespesa(page)).toEqual(SETE);
});

test('categoria nova: criada no banco, aparece nos seletores e vale para a Júlia na hora', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=categorias`);
  await page.getByRole('button', { name: 'Nova categoria' }).click();
  const gaveta = page.getByRole('dialog', { name: 'Nova categoria' });
  await gaveta.getByLabel('Nome').fill('Eventos e Decoração');
  await expect(gaveta.getByLabel('Código')).toHaveValue('eventos_e_decoracao');
  await gaveta.getByLabel('Código').fill('eventos');
  await gaveta.getByLabel('Grupo').selectOption('marketing');
  await gaveta.getByLabel('Descrição').fill('Decoração, som e atrações de eventos.');
  await gaveta.getByLabel('Apelidos que a Júlia reconhece').fill('decoracao, Som,  atracao, som');
  await expect(gaveta.getByLabel('Âmbar Café (demo)')).toBeChecked();
  await gaveta.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(page.getByText(/Categoria “Eventos e Decoração” criada\. A Júlia já pode usá-la/)).toBeVisible();
  const item = page.getByRole('list', { name: 'Categorias ativas' }).locator('[data-categoria="eventos"]');
  await expect(item).toContainText('Ativa aqui');
  await expect(item).toContainText('Sem lançamentos');

  // No banco: válida na unidade (o que a Júlia e os seletores leem), com os apelidos limpos.
  const validas = await (await page.request.get(`${API}/categorias`)).json();
  const nova = validas.find((c: { codigo: string }) => c.codigo === 'eventos');
  expect(nova).toMatchObject({ nome: 'Eventos e Decoração', grupo: 'marketing', aliases: ['decoracao', 'som', 'atracao'], ativa_na_unidade: true });

  // Repetir o código é recusado (409 categoria_existe), com o erro no campo.
  await page.getByRole('button', { name: 'Nova categoria' }).click();
  await gaveta.getByLabel('Nome').fill('Eventos');
  await gaveta.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(gaveta.getByText('Já existe uma categoria com este código.')).toBeVisible();
  await gaveta.getByRole('button', { name: 'Cancelar' }).click();

  // Editar nome e apelidos (o código não muda).
  await item.getByRole('button', { name: 'Editar Eventos e Decoração' }).click();
  const editar = page.getByRole('dialog', { name: /Editar Eventos/ });
  await expect(editar.getByText('Código eventos (não muda).')).toBeVisible();
  await editar.getByLabel('Nome').fill('Eventos');
  await editar.getByLabel('Apelidos que a Júlia reconhece').fill('decoracao, som, atracao, palco');
  await editar.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Categoria salva.')).toBeVisible();
  await expect(item).toContainText('palco');

  expect(await opcoesDaNovaDespesa(page)).toContain('Eventos');
  // E na Revisão (o seletor que a gerência usa para documentos da Júlia).
  await page.goto(`${DEMO}/admin/financeiro?aba=revisao`);
  await page.getByRole('button', { name: /ENEL/ }).click();
  await expect(page.getByRole('dialog').getByRole('region', { name: 'Registrar como despesa' }).getByLabel('Categoria').locator('option', { hasText: 'Eventos' })).toHaveCount(1);
});

test('categoria desativada na unidade: some dos seletores, lançamento novo é recusado, os antigos ficam', async ({ page }) => {
  await page.goto(`${DEMO}/admin/financeiro?aba=categorias`);
  const ativas = page.getByRole('list', { name: 'Categorias ativas' });
  await ativas.locator('[data-categoria="embalagens"]').getByRole('button', { name: 'Desativar aqui' }).click();
  await page.getByRole('alertdialog', { name: /Desativar “Embalagens”/ }).getByRole('button', { name: 'Desativar' }).click();
  await expect(page.getByText('“Embalagens” desativada em Âmbar Café (demo).')).toBeVisible();
  const fora = page.getByRole('list', { name: 'Categorias fora de uso' }).locator('[data-categoria="embalagens"]');
  await expect(fora).toContainText('Inativa aqui');
  await expect(ativas.locator('[data-categoria="embalagens"]')).toHaveCount(0);

  expect(await opcoesDaNovaDespesa(page)).not.toContain('Embalagens');
  const r = await page.request.post(`${API}/despesas`, { headers: { ...escrever, 'Idempotency-Key': `t-${Date.now()}` }, data: { descricao: 'Copos', valor: '30.00', competencia: '2026-10-01', categoria: 'embalagens' } });
  expect(r.status()).toBe(422);
  expect((await r.json()).codigo).toBe('categoria_inativa_na_unidade');
  // Na unidade de testes ela continua ativa (ativação é por unidade).
  const teste = await (await page.request.get(`${API}/categorias?unidade=ambar_teste`)).json();
  expect(teste.map((c: { codigo: string }) => c.codigo)).toContain('embalagens');

  // Reativa (deixa a demonstração como estava).
  await page.goto(`${DEMO}/admin/financeiro?aba=categorias`);
  await page.getByRole('list', { name: 'Categorias fora de uso' }).locator('[data-categoria="embalagens"]').getByRole('button', { name: 'Ativar aqui' }).click();
  await page.getByRole('dialog', { name: /Ativar “Embalagens”/ }).getByRole('button', { name: 'Ativar' }).click();
  await expect(page.getByRole('list', { name: 'Categorias ativas' }).locator('[data-categoria="embalagens"]')).toContainText('Ativa aqui');
});

test('Atendente: lê as categorias válidas, mas não cria nem desativa', async ({ page }) => {
  await entrarDemo(page, 'operador');
  // O Atendente lê as categorias válidas (conferência de compras), mas não escreve.
  expect((await page.request.get(`${API}/categorias`)).status()).toBe(200);
  expect((await page.request.post(`${API}/categorias`, { headers: escrever, data: { codigo: 'x_teste', nome: 'X', grupo: 'operacional' } })).status()).toBe(403);
  expect((await page.request.put(`${API}/categorias/operacional/unidades/ambar_cafe`, { headers: escrever, data: { ativo: false } })).status()).toBe(403);
});
