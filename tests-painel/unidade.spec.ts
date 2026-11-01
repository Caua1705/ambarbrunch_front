import { test, expect, type Page } from '@playwright/test';
import { API, BACKEND_FALSO, escolherUnidade } from './apoio';

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
  await escolherUnidade(page, 'ambar_teste');
  await expect(page.locator('[data-unidade-teste]')).toContainText('AMBIENTE DE TESTE · Âmbar · TESTES');
  // a faixa vermelha já diz a unidade: sem selo repetido no topo
  await expect(page.locator('[data-unidade-atual]')).toHaveCount(0);
  await expect(page.getByText('Cliente Real de Teste').filter({ visible: true })).toBeVisible();
  expect(await consultada(page)).toBe('ambar_teste');
  // voltar à operação real tira a faixa
  await escolherUnidade(page, 'ambar_cafe');
  await expect(page.locator('[data-unidade-teste]')).toHaveCount(0);
});

test('unidade sem acesso no cookie é trocada pela que a página mostra', async ({ page }) => {
  await entrarApi(page);
  await page.context().addCookies([{ name: 'ambar_painel_unidade', value: 'raizes', url: `${API}/admin` }]);
  await page.goto(`${API}/admin/reservas`);
  await expect(page.getByText('Cliente Real de Teste').filter({ visible: true })).toBeVisible();
  expect(await consultada(page)).toBe('ambar_cafe');
});

test('B4: cada aba fica na unidade que mostra — trocar a unidade em outra aba não redireciona as consultas desta', async ({ context }) => {
  const a = await context.newPage();
  await entrarApi(a);
  await expect(a.locator('[data-unidade]')).toHaveValue('ambar_cafe');
  expect(await consultada(a)).toBe('ambar_cafe');

  // Aba B troca para a unidade de testes: o cookie (compartilhado entre as abas) passa a dizer ambar_teste.
  const b = await context.newPage();
  await b.goto(`${API}/admin/reservas`);
  await escolherUnidade(b, 'ambar_teste');
  await expect(b.locator('[data-unidade-teste]')).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'ambar_painel_unidade')?.value).toBe('ambar_teste');
  expect(await consultada(b)).toBe('ambar_teste');

  // A aba A continua mostrando o Café — e a consulta dela tem de ir ao Café, não à unidade da outra aba.
  await a.bringToFront();
  await expect(a.locator('[data-unidade]')).toHaveValue('ambar_cafe');
  const pedido = a.waitForRequest((r) => r.url().includes('/admin/api/reservas'));
  await a.getByRole('button', { name: 'Atualizar agora' }).click();
  expect((await pedido).headers()['x-painel-unidade']).toBe('ambar_cafe');
  await expect.poll(() => consultada(a)).toBe('ambar_cafe');
});
