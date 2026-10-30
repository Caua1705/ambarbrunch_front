import { test, expect, type Page } from '@playwright/test';
import { API, BACKEND_FALSO } from './apoio';

// Unidade de negócio: o topo e os dados precisam falar da MESMA unidade. Sem `?unidade=`, o backend usa a unidade padrão
// dele (na produção, a de testes) — por isso o painel manda a unidade escolhida desde o primeiro acesso.
async function entrarApi(page: Page) {
  await page.goto(`${API}/admin/login?volta=/admin/reservas`);
  await page.getByLabel('E-mail').fill('gerente@teste.invalid');
  await page.getByLabel('Senha', { exact: true }).fill('senha-certa');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`${API}/admin/reservas`);
}
const consultada = async (page: Page) => (await (await page.request.get(`${BACKEND_FALSO}/__ultimo`)).json()).unidade;

test('primeiro acesso: a ponte já manda a unidade que o topo mostra', async ({ page }) => {
  await entrarApi(page);
  await expect(page.getByText('Cliente Real de Teste').filter({ visible: true })).toBeVisible();
  const cookie = (await page.context().cookies()).find((c) => c.name === 'ambar_painel_unidade');
  expect(cookie?.value).toBe('ambar_cafe');
  expect(cookie?.path).toBe('/admin');
  expect(await consultada(page)).toBe('ambar_cafe');
  await expect(page.locator('[data-unidade-teste]')).toHaveCount(0);
});

test('unidade de testes: faixa de ambiente de teste e dados pedidos dela', async ({ page }) => {
  await entrarApi(page);
  await page.locator('[data-unidade]').selectOption('ambar_teste');
  await page.waitForLoadState('load');
  await expect(page.locator('[data-unidade-teste]')).toContainText('AMBIENTE DE TESTE · Âmbar · TESTES');
  await expect(page.getByText('Cliente Real de Teste').filter({ visible: true })).toBeVisible();
  expect(await consultada(page)).toBe('ambar_teste');
  // voltar à operação real tira a faixa
  await page.locator('[data-unidade]').selectOption('ambar_cafe');
  await page.waitForLoadState('load');
  await expect(page.locator('[data-unidade-teste]')).toHaveCount(0);
});

test('unidade sem acesso no cookie é trocada pela que a página mostra', async ({ page }) => {
  await entrarApi(page);
  await page.context().addCookies([{ name: 'ambar_painel_unidade', value: 'raizes', url: `${API}/admin` }]);
  await page.goto(`${API}/admin/reservas`);
  await expect(page.getByText('Cliente Real de Teste').filter({ visible: true })).toBeVisible();
  expect(await consultada(page)).toBe('ambar_cafe');
});
