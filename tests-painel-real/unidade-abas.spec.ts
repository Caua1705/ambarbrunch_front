// B4 com backend real: duas abas na MESMA sessão (os cookies são compartilhados). A aba A mostra o Café; a aba B troca
// para a Noite. Consultas e lançamentos da aba A precisam continuar no Café — nunca, em silêncio, na unidade da aba B.
// Grava no banco isolado: 1 despesa "Integração B4 — aba Café" (R$ 11,00), que tem de cair no Café.
import { test, expect } from '@playwright/test';
import { PAINEL, entrar } from './apoio';

const API = `${PAINEL}/admin/api`;
const NOME = 'Integração B4 — aba Café';
const janela = () => {
  const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  return `de=${d(-30)}&ate=${d(30)}`;
};

test('B4: com a aba B na Noite, a aba A (Café) consulta e lança no Café', async ({ context }) => {
  const a = await context.newPage();
  const quantas = (u: string) => a.request.get(`${API}/financeiro/lancamentos?${janela()}&tipo=despesa&busca=${encodeURIComponent(NOME)}&unidade=${u}`).then(async (r) => (await r.json()).itens.length as number);
  const erros: string[] = [];
  a.on('pageerror', (e) => erros.push(e.message));
  await entrar(a, 'tecnica');
  await a.goto(`${PAINEL}/admin/financeiro?aba=movimentacoes`);
  const topoA = a.locator('[data-unidade]');
  if ((await topoA.inputValue()) !== 'ambar_cafe') {
    await a.locator('#perfil button.perfil').click(); // a unidade mora no menu do perfil
    await topoA.selectOption('ambar_cafe');
    await a.waitForLoadState('load');
  }
  await expect(topoA).toHaveValue('ambar_cafe');
  const antes = { cafe: await quantas('ambar_cafe'), noite: await quantas('ambar_noite') };

  const b = await context.newPage();
  await b.goto(`${PAINEL}/admin/financeiro?aba=movimentacoes`);
  await b.locator('#perfil button.perfil').click();
  await b.locator('[data-unidade]').selectOption('ambar_noite');
  await b.waitForLoadState('load');
  await expect(b.locator('[data-unidade]')).toHaveValue('ambar_noite');
  // fora da unidade padrão, o topo diz onde a aba está
  await expect(b.locator('[data-unidade-atual]')).toContainText(/Noite/i);
  expect((await context.cookies()).find((c) => c.name === 'ambar_painel_unidade')?.value).toBe('ambar_noite');

  // Aba A: continua mostrando o Café. Lança uma despesa por ela.
  await a.bringToFront();
  await expect(topoA).toHaveValue('ambar_cafe');
  await a.getByRole('button', { name: 'Nova despesa' }).click();
  const gaveta = a.getByRole('dialog', { name: 'Nova despesa' });
  await gaveta.getByLabel('Descrição').fill(NOME);
  await gaveta.getByLabel('Valor', { exact: true }).fill('11,00');
  await gaveta.getByLabel('Categoria').selectOption('operacional');
  const lancamento = a.waitForRequest((r) => r.url().includes('/admin/api/financeiro/despesas') && r.method() === 'POST');
  await gaveta.getByRole('button', { name: 'Lançar despesa' }).click();
  console.log('cabeçalho de unidade do lançamento da aba A:', (await lancamento).headers()['x-painel-unidade'] ?? '(nenhum)');
  await expect(a.getByText(/Despesa lançada/)).toBeVisible();

  // Onde caiu? Contagem por unidade explícita (a ponte respeita ?unidade=), antes × depois.
  const cafe = (await quantas('ambar_cafe')) - antes.cafe;
  const noite = (await quantas('ambar_noite')) - antes.noite;
  console.log(`"${NOME}" novas no Café: ${cafe} · novas na Noite: ${noite}`);
  expect(noite, 'a aba que mostra o Café gravou na Noite').toBe(0);
  expect(cafe).toBe(1);

  // Consulta pela aba A (a lista recarregada depois do lançamento) também é a do Café: mostra a despesa.
  await expect(a.getByText(NOME).first()).toBeVisible();
  expect(erros).toEqual([]);
});
