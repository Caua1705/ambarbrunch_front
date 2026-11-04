// Gaveta "Buscar reserva": consulta o backend em todas as datas, sem depender do dia aberto na agenda. Demonstração e respostas
// simuladas; as regras da busca (acento, formato do telefone, Atendente, outra unidade) têm teste no backend.
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

async function abrir(page: Page, papel: 'gerente' | 'operador' = 'gerente') {
  await entrarDemo(page, papel);
  await page.goto(`${DEMO}/admin/reservas`);
  await page.getByRole('button', { name: 'Buscar reserva' }).click();
  return page.getByRole('dialog', { name: 'Buscar reserva' });
}
const campo = (g: ReturnType<Page['getByRole']>) => g.getByRole('searchbox', { name: 'Buscar em todas as reservas' });

test('procura no backend, em todas as datas: acha reserva fora do dia aberto e abre o detalhe', async ({ page }) => {
  const g = await abrir(page);
  await expect(g.getByText('Em todas as datas')).toBeVisible();
  await expect(g.getByText('Digite ao menos 2 letras ou números')).toBeVisible();

  const lista = await (await page.request.get(`${DEMO}/admin/api/reservas?limite=200`)).json();
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const alvo = lista.itens.find((r: { data: string }) => r.data !== hoje);

  const pedido = page.waitForRequest((r) => new URL(r.url()).pathname.endsWith('/admin/api/reservas') && new URL(r.url()).searchParams.get('busca') === alvo.contato_nome);
  await campo(g).fill(alvo.contato_nome);
  const q = new URL((await pedido).url()).searchParams;
  expect(q.get('data_de')).toBeNull();
  expect(q.get('data_ate')).toBeNull();

  const resultado = g.getByRole('list', { name: 'Resultado da busca' });
  await expect(resultado.getByRole('button').first()).toContainText(alvo.contato_nome);
  await resultado.getByRole('button').first().click();
  await expect(page.getByRole('dialog', { name: 'Buscar reserva' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: alvo.contato_nome })).toBeVisible();

  // Fechar e reabrir volta ao mesmo resultado.
  await page.getByRole('dialog', { name: alvo.contato_nome }).getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: 'Buscar reserva' }).click();
  await expect(campo(page.getByRole('dialog', { name: 'Buscar reserva' }))).toHaveValue(alvo.contato_nome);
});

test('telefone em qualquer formato', async ({ page }) => {
  const g = await abrir(page);
  const lista = await (await page.request.get(`${DEMO}/admin/api/reservas?limite=200`)).json();
  const alvo = lista.itens.find((r: { contato_telefone_e164: string | null }) => r.contato_telefone_e164);
  const d = alvo.contato_telefone_e164.replace(/^\+55/, '');
  await campo(g).fill(`(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`);
  await expect(g.getByRole('list', { name: 'Resultado da busca' }).getByRole('button').first()).toContainText(alvo.contato_nome);
});

test('sem resultado e falha do backend têm estados próprios, com nova tentativa', async ({ page }) => {
  const g = await abrir(page);
  await campo(g).fill('zzzz não existe');
  await expect(g.getByText('Nenhuma reserva encontrada')).toBeVisible();

  let falhar = true;
  await page.route('**/admin/api/reservas?*', (r) => (falhar && new URL(r.request().url()).searchParams.has('busca') ? r.fulfill({ status: 500, json: { detail: 'Erro.' } }) : r.fallback()));
  await campo(g).fill('outra coisa');
  await expect(g.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  falhar = false;
  await g.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(g.getByText('Nenhuma reserva encontrada')).toBeVisible();
});

test('muitos resultados: "Mostrar mais" pede ao backend a página seguinte', async ({ page }) => {
  const g = await abrir(page);
  const base = (await (await page.request.get(`${DEMO}/admin/api/reservas?limite=1`)).json()).itens[0];
  await page.route('**/admin/api/reservas?*', (r) => {
    const q = new URL(r.request().url()).searchParams;
    if (!q.has('busca')) return r.fallback();
    const limite = Number(q.get('limite'));
    return r.fulfill({ json: { total: 45, itens: Array.from({ length: Math.min(limite, 45) }, (_, i) => ({ ...base, id: `id-${i}` })) } });
  });
  await campo(g).fill('ana');
  const resultado = g.getByRole('list', { name: 'Resultado da busca' });
  await expect(resultado.getByRole('listitem')).toHaveCount(30);
  await expect(g.getByText('45 reservas encontradas')).toBeVisible();
  await g.getByRole('button', { name: 'Mostrar mais' }).click();
  await expect(resultado.getByRole('listitem')).toHaveCount(45);
  await expect(g.getByRole('button', { name: 'Mostrar mais' })).toHaveCount(0);
});

test('Atendente: nome e código, na própria janela, sem telefone', async ({ page }) => {
  const g = await abrir(page, 'operador');
  await expect(g.getByText('De hoje até 14 dias à frente')).toBeVisible();
  await expect(campo(g)).toHaveAttribute('placeholder', 'Nome ou código');

  const lista = await (await page.request.get(`${DEMO}/admin/api/reservas?limite=200`)).json();
  const alvo = lista.itens[0];
  await campo(g).fill(alvo.contato_nome);
  const item = g.getByRole('list', { name: 'Resultado da busca' }).getByRole('button').first();
  await expect(item).toContainText(alvo.contato_nome);
  await expect(item).not.toContainText('+55');

  const gerencia = await page.request.get(`${DEMO}/admin/api/reservas?busca=99999`);
  expect((await gerencia.json()).total).toBe(0);
});
