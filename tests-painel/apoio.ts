import type { Page, APIRequestContext } from '@playwright/test';

export const DEMO = 'http://127.0.0.1:4490';
export const API = 'http://127.0.0.1:4492';
export const INDISPONIVEL = 'http://127.0.0.1:4493';
export const BACKEND_FALSO = 'http://127.0.0.1:4491';

/** Entra na demonstração com um perfil (mesma chamada que o botão da tela de login faz). */
export async function entrarDemo(page: Page, papel: 'admin' | 'gerente' | 'operador' = 'gerente') {
  const r = await page.request.post(`${DEMO}/admin/api/sessao`, { headers: { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO }, data: { demo: papel } });
  if (!r.ok()) throw new Error(`login demo falhou: ${r.status()}`);
}

export async function semRolagemHorizontal(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

export const post = (req: APIRequestContext, url: string, data: unknown, headers: Record<string, string> = {}) =>
  req.post(url, { data, headers: { 'Content-Type': 'application/json', ...headers } });

/** A unidade de trabalho mora no menu do perfil (não fica mais exposta no topo de toda página). */
export async function escolherUnidade(page: Page, codigo: string) {
  await page.locator('#perfil button.perfil').click();
  await page.locator('[data-unidade]').selectOption(codigo);
  await page.waitForLoadState('load');
}
