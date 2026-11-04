// Reservas: período (Dia, Semana, Mês) e visualização (Calendário, Por ambiente) como escolhas independentes, e a visão por
// ambiente com o intervalo certo, a capacidade vinda do backend e os estados vazio e de erro.
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo, semRolagemHorizontal } from './apoio';

const periodo = (page: Page) => page.getByRole('group', { name: 'Período' });
const visualizacao = (page: Page) => page.getByRole('group', { name: 'Visualização' });
const secoes = (page: Page) => page.getByRole('region', { name: 'Reservas por ambiente' });

function diasEntre(de: string, ate: string) {
  return (Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000;
}

/** Espera o pedido da lista de reservas e devolve o intervalo. */
const pedidoDaLista = (page: Page) =>
  page.waitForRequest((r) => /\/admin\/api\/reservas\?/.test(r.url()) && r.url().includes('data_ate=')).then((r) => {
    const q = new URL(r.url()).searchParams;
    return { de: q.get('data_de')!, ate: q.get('data_ate')! };
  });

test.beforeEach(async ({ page }) => {
  await entrarDemo(page, 'gerente');
});

test('Lista saiu da navegação; período e visualização são dois grupos separados', async ({ page }) => {
  await page.goto(`${DEMO}/admin/reservas`);
  for (const nome of ['Dia', 'Semana', 'Mês']) await expect(periodo(page).getByRole('button', { name: nome })).toBeVisible();
  for (const nome of ['Calendário', 'Por ambiente']) await expect(visualizacao(page).getByRole('button', { name: nome })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lista', exact: true })).toHaveCount(0);
});

test('links antigos continuam abrindo: ?vista=lista cai no Dia e ?vista=ambientes em Por ambiente', async ({ page }) => {
  await page.goto(`${DEMO}/admin/reservas?vista=lista&periodo=semana`);
  await expect(periodo(page).getByRole('button', { name: 'Dia' })).toHaveAttribute('aria-pressed', 'true');
  await expect(visualizacao(page).getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).not.toHaveURL(/periodo=/);
  await page.goto(`${DEMO}/admin/reservas?vista=ambientes`);
  await expect(visualizacao(page).getByRole('button', { name: 'Por ambiente' })).toHaveAttribute('aria-pressed', 'true');
  await expect(secoes(page)).toBeVisible();
});

test('Dia, Semana e Mês navegam no calendário e voltam para a mesma data', async ({ page }) => {
  await page.goto(`${DEMO}/admin/reservas`);
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  const titulo = page.locator('.agenda-barra__titulo');
  const diaEscolhido = await titulo.innerText();

  await periodo(page).getByRole('button', { name: 'Semana' }).click();
  await expect(page.getByRole('button', { name: 'Próxima semana' })).toBeVisible();
  await expect(page.locator('section.cartao')).toHaveCount(7);

  await periodo(page).getByRole('button', { name: 'Mês' }).click();
  await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Reservas de / })).toBeVisible();
  await expect(page.locator('.cal-mes__dia[aria-pressed="true"]')).toHaveCount(1);

  await periodo(page).getByRole('button', { name: 'Dia' }).click();
  await expect(titulo).toHaveText(diaEscolhido);
  await expect(visualizacao(page).getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'true');
});

test('escolher um dia na Semana abre o Dia sem trocar a visualização', async ({ page }) => {
  await page.goto(`${DEMO}/admin/reservas?vista=semana`);
  await page.locator('section.cartao').first().getByRole('button').first().click();
  await expect(periodo(page).getByRole('button', { name: 'Dia' })).toHaveAttribute('aria-pressed', 'true');
  await expect(visualizacao(page).getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'true');
});

test('Por ambiente: cada período consulta o intervalo certo e mantém a visualização', async ({ page }) => {
  await page.goto(`${DEMO}/admin/reservas`);

  let pedido = pedidoDaLista(page);
  await visualizacao(page).getByRole('button', { name: 'Por ambiente' }).click();
  const dia = await pedido;
  expect(dia.de).toBe(dia.ate);
  await expect(periodo(page).getByRole('button', { name: 'Dia' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: /^Salão: .* neste dia$/ })).toBeVisible();

  pedido = pedidoDaLista(page);
  await periodo(page).getByRole('button', { name: 'Semana' }).click();
  const semana = await pedido;
  expect(diasEntre(semana.de, semana.ate)).toBe(6);
  await expect(page.getByRole('region', { name: /^Salão: .* nesta semana$/ })).toBeVisible();
  await expect(visualizacao(page).getByRole('button', { name: 'Por ambiente' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/vista=semana/);
  await expect(page).toHaveURL(/apresentacao=ambiente/);

  pedido = pedidoDaLista(page);
  await periodo(page).getByRole('button', { name: 'Mês' }).click();
  const mes = await pedido;
  expect(mes.de.slice(8)).toBe('01');
  expect(mes.ate.slice(0, 7)).toBe(mes.de.slice(0, 7));
  await expect(page.getByRole('region', { name: /^Salão: .* neste mês$/ })).toBeVisible();

  pedido = pedidoDaLista(page);
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  const seguinte = await pedido;
  expect(seguinte.de > mes.ate).toBe(true);
  await expect(page.getByRole('region', { name: /^Salão: / })).toBeVisible();

  await page.reload();
  await expect(periodo(page).getByRole('button', { name: 'Mês' })).toHaveAttribute('aria-pressed', 'true');
  await expect(visualizacao(page).getByRole('button', { name: 'Por ambiente' })).toHaveAttribute('aria-pressed', 'true');
});

test('Por ambiente: no Dia mostra a ocupação do backend; na Semana, os dias levam ao calendário', async ({ page }) => {
  await page.goto(`${DEMO}/admin/reservas?apresentacao=ambiente`);
  const salao = page.getByRole('region', { name: /^Salão: / });
  await expect(salao.locator('.ocupacao-dia')).toContainText(/Pico de \d+ de 56 lugares às \d\d:\d\d/);

  await periodo(page).getByRole('button', { name: 'Semana' }).click();
  await expect(salao.locator('.ocupacao-dia')).toHaveCount(0);
  await expect(salao.getByText(/\d+ dias? com reserva/)).toBeVisible();
  await salao.getByRole('button', { name: /^Abrir o dia / }).first().click();
  await expect(periodo(page).getByRole('button', { name: 'Dia' })).toHaveAttribute('aria-pressed', 'true');
  await expect(visualizacao(page).getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'true');
});

test('a capacidade de cada ambiente vem do backend', async ({ page }) => {
  const oficiais = [['Jardim externo', 20], ['Salão principal', 30], ['Lounge', 15], ['Sala privativa', 20]] as const;
  await page.route('**/admin/api/reservas/ambientes*', (r) => r.fulfill({ json: oficiais.map(([nome, capacidade_max], i) => ({ id: `a${i}000000-0000-4000-8000-000000000000`, unidade: 'ambar_cafe', codigo: `c${i}`, nome, capacidade_max, duracao_min: 120, ativo: true })) }));
  await page.route('**/admin/api/reservas/lotacao*', (r) => r.fulfill({ json: { ambiente_id: 'x', ambiente: 'x', data: '2026-11-09', capacidade_max: 30, duracao_min: 120, ativo: true, pessoas: 1, horarios: [] } }));
  await page.route(/\/admin\/api\/reservas\?/, (r) => r.fulfill({ json: { total: 0, itens: [] } }));
  await page.goto(`${DEMO}/admin/reservas?apresentacao=ambiente`);
  for (const [nome, capacidade] of oficiais) await expect(page.getByRole('region', { name: new RegExp(`^${nome}: `) })).toContainText(`Até ${capacidade} pessoas`);
  await expect(page.getByText('Sem horários de reserva nesta data').first()).toBeVisible();
});

test('Por ambiente: período sem reservas mostra os ambientes livres', async ({ page }) => {
  await page.route(/\/admin\/api\/reservas\?/, (r) => r.fulfill({ json: { total: 0, itens: [] } }));
  await page.goto(`${DEMO}/admin/reservas?apresentacao=ambiente&vista=semana`);
  await expect(page.getByText('Nenhuma reserva nesta semana.')).toBeVisible();
  await expect(page.getByRole('region', { name: /^Salão: 0 reservas nesta semana$/ })).toContainText('Livre');
  await expect(page.getByText('Sem reservas nesta semana.').first()).toBeVisible();
});

test('Por ambiente: erro da API aparece com nova tentativa', async ({ page }) => {
  let falhar = true;
  await page.route(/\/admin\/api\/reservas\?/, (r) => (falhar ? r.fulfill({ status: 503, json: { detail: 'Fora do ar.' } }) : r.fallback()));
  await page.goto(`${DEMO}/admin/reservas?apresentacao=ambiente`);
  await expect(secoes(page).getByRole('heading', { name: 'Não foi possível carregar' })).toBeVisible();
  falhar = false;
  await secoes(page).getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('region', { name: /^Salão: / })).toBeVisible();
});

test('Atendente: Por ambiente funciona sem passar da janela de 14 dias', async ({ page }) => {
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin/reservas?apresentacao=ambiente`);
  await expect(page.getByRole('region', { name: /^Salão: / })).toBeVisible();
  await periodo(page).getByRole('button', { name: 'Semana' }).click();
  await expect(page.getByRole('region', { name: /^Salão: / })).toBeVisible();
});

test('tablet: barra, calendário e ambientes cabem sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const url of ['/admin/reservas', '/admin/reservas?vista=mes', '/admin/reservas?apresentacao=ambiente', '/admin/reservas?apresentacao=ambiente&vista=semana']) {
    await page.goto(`${DEMO}${url}`);
    await expect(periodo(page)).toBeVisible();
    expect(await semRolagemHorizontal(page), url).toBe(true);
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${DEMO}/admin/reservas?apresentacao=ambiente`);
  await expect(page.getByRole('region', { name: /^Salão: / })).toBeVisible();
  expect(await semRolagemHorizontal(page)).toBe(true);
});
