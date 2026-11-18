// Sessão persistente do tablet (conta do Atendente) contra o BACKEND REAL local (playwright.tablet-real.config.ts, acesso de
// 5 min no backend de teste). Cada "reabrir" é um contexto novo SÓ com os cookies que um navegador guarda em disco (os que
// têm validade): é o que sobra depois de fechar o Chrome, matar o app ou reiniciar o tablet. O acesso vencido é o cookie
// `ambar_painel` que some (Max-Age); a renovação (`ambar_painel_renovacao`, 30 dias, teto de 90 desde a senha) continua.
//
// Cenários (18/11/2026): fechar e reabrir em qualquer endereço do painel — inclusive o /admin/login guardado em favorito,
// atalho da tela inicial ou histórico —, atualizar a página, reiniciar o aparelho (navegador novo), chamada de dados com o
// acesso vencido, um 401 do backend que não é da sessão, e a revogação (Sair e "Encerrar sessões") que continua valendo.
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, chromium, devices, type Browser, type BrowserContext, type Page, type Cookie } from '@playwright/test';

const SEGREDOS = JSON.parse(readFileSync(process.env.TABLET_REAL_SEGREDOS!, 'utf-8')) as { senha: string };
const TABLET = 'tablet@tablet.local';
const DONO = 'dono@tablet.local';
const ANDROID = { ...devices['Galaxy Tab S4'], baseURL: 'http://127.0.0.1:4497' };
const ACESSO = 'ambar_painel';
const RENOVACAO = 'ambar_painel_renovacao';

async function entrar(page: Page, email: string, volta = '/admin') {
  await page.goto(`/admin/login?volta=${encodeURIComponent(volta)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(SEGREDOS.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const cookie = async (ctx: BrowserContext, nome: string) => (await ctx.cookies()).find((c) => c.name === nome);
/** O que fica no disco quando o navegador fecha: só cookies com validade (os de sessão somem). */
const guardados = async (ctx: BrowserContext, { acessoVencido = true } = {}) =>
  (await ctx.cookies()).filter((c) => c.expires > 0 && !(acessoVencido && c.name === ACESSO));

async function reabrir(browser: Browser, cookies: Cookie[]) {
  const ctx = await browser.newContext({ ...ANDROID, storageState: { cookies, origins: [] } });
  return { ctx, page: await ctx.newPage() };
}

async function noModoOperacao(page: Page) {
  await expect(page).toHaveURL(/\/admin\/operacao/);
  await expect(page.getByRole('navigation', { name: /Seções/ })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveCount(0);
}

test.describe.serial('sessão persistente do tablet', () => {
  let tablet: BrowserContext;
  let pagina: Page;

  test.beforeAll(async ({ browser }) => {
    tablet = await browser.newContext(ANDROID);
    pagina = await tablet.newPage();
  });
  test.afterAll(async () => tablet.close());

  test('1. o Atendente entra uma vez: acesso e renovação são cookies guardados em disco, HttpOnly, nunca de sessão', async () => {
    await entrar(pagina, TABLET);
    await noModoOperacao(pagina);
    const acesso = (await cookie(tablet, ACESSO))!;
    const renovacao = (await cookie(tablet, RENOVACAO))!;
    for (const c of [acesso, renovacao]) {
      expect(c.httpOnly).toBe(true);
      expect(c.sameSite).toBe('Strict');
      expect(c.path).toBe('/admin');
      expect(c.expires).toBeGreaterThan(Date.now() / 1000);          // validade => sobrevive a fechar o navegador
    }
    expect(renovacao.expires * 1000 - Date.now()).toBeGreaterThan(29 * 24 * 3600_000);   // ~30 dias
    expect(renovacao.expires * 1000 - Date.now()).toBeLessThan(31 * 24 * 3600_000);      // não é eterna
    expect(await pagina.evaluate(() => document.cookie)).not.toContain(RENOVACAO);
  });

  test('2. navegador fechado e reaberto no Modo Operação, com o acesso vencido: entra sem senha', async ({ browser }) => {
    const { ctx, page } = await reabrir(browser, await guardados(tablet));
    await page.goto('/admin/operacao');
    await noModoOperacao(page);
    expect(await cookie(ctx, ACESSO)).toBeTruthy();                 // acesso novo gravado
    await ctx.close();
  });

  for (const endereco of ['/admin/login', '/admin/login?volta=%2Fadmin%2Foperacao', '/admin']) {
    test(`3. reaberto em ${endereco} (favorito, atalho ou histórico), acesso vencido: vai ao Modo Operação sem pedir senha`, async ({ browser }) => {
      const { ctx, page } = await reabrir(browser, await guardados(tablet));
      await page.goto(endereco);
      await noModoOperacao(page);
      await ctx.close();
    });
  }

  test('4. reaberto no /admin/login com o acesso ainda válido: entra direto (sem a pergunta "sessão aberta")', async ({ browser }) => {
    const { ctx, page } = await reabrir(browser, await guardados(tablet, { acessoVencido: false }));
    expect(await cookie(ctx, ACESSO)).toBeTruthy();
    await page.goto('/admin/login');
    await noModoOperacao(page);
    await ctx.close();
  });

  test('5. atualizar a página depois que o acesso venceu: continua no Modo Operação', async () => {
    await pagina.goto('/admin/operacao');
    await tablet.clearCookies({ name: ACESSO });
    await pagina.reload();
    await noModoOperacao(pagina);
    expect(await cookie(tablet, ACESSO)).toBeTruthy();
  });

  test('6. tablet reiniciado (navegador novo, cookies lidos do disco): entra sem senha', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'tablet-'));
    const arquivo = join(pasta, 'estado.json');
    writeFileSync(arquivo, JSON.stringify({ cookies: await guardados(tablet), origins: [] }));
    const outro = await chromium.launch();
    try {
      const ctx = await outro.newContext({ ...ANDROID, storageState: arquivo });
      const page = await ctx.newPage();
      await page.goto('/admin/login');
      await noModoOperacao(page);
    } finally {
      await outro.close();
    }
  });

  test('7. chamada de dados com o acesso vencido renova sozinha e empurra o prazo da renovação', async () => {
    const antes = (await cookie(tablet, RENOVACAO))!;
    await tablet.clearCookies({ name: ACESSO });
    await pagina.waitForTimeout(1100);                               // o prazo novo conta deste segundo
    expect((await pagina.request.get('/admin/api/abertura/hoje')).status()).toBe(200);
    const depois = (await cookie(tablet, RENOVACAO))!;
    expect(await cookie(tablet, ACESSO)).toBeTruthy();
    expect(depois.expires).toBeGreaterThanOrEqual(antes.expires);
  });

  test('8. um 401 do backend que não é da sessão (token de captura) não apaga a renovação', async () => {
    const r = await pagina.request.post(`/admin/api/ponto/terminal/sessoes/${crypto.randomUUID()}/previa`, {
      headers: { 'X-Painel': '1', 'Content-Type': 'image/jpeg' }, data: Buffer.from([0xff, 0xd8, 0xff]),
    });
    // Não é a sessão: 403 para a tela (sem mandar ao login) e os dois cookies continuam.
    expect(r.status()).toBe(403);
    expect((await r.json()).codigo).toBe('nao_autorizado');
    expect(await cookie(tablet, RENOVACAO)).toBeTruthy();
    expect(await cookie(tablet, ACESSO)).toBeTruthy();
    const { ctx, page } = await reabrir(tablet.browser()!, await guardados(tablet));
    await page.goto('/admin/login');
    await noModoOperacao(page);
    await ctx.close();
  });

  test('9. o Proprietário não recebe renovação: só a conta do tablet fica conectada', async ({ browser }) => {
    const dono = await browser.newContext();
    const pd = await dono.newPage();
    await entrar(pd, DONO);
    await pd.waitForURL(/\/admin(\?|$)/);
    expect(await cookie(dono, ACESSO)).toBeTruthy();
    expect(await cookie(dono, RENOVACAO)).toBeFalsy();
    await dono.close();
  });

  test('10. "Encerrar sessões" pelo Proprietário derruba o tablet: reaberto em qualquer endereço, pede a senha', async ({ browser }) => {
    const guardadosAntes = await guardados(tablet);
    const dono = await browser.newContext();
    const pd = await dono.newPage();
    await entrar(pd, DONO);
    await pd.waitForURL(/\/admin(\?|$)/);
    const equipe = (await (await pd.request.get('/admin/api/usuarios')).json()) as { id: string; email: string }[];
    const conta = equipe.find((u) => u.email === TABLET)!;
    expect((await pd.request.post(`/admin/api/usuarios/${conta.id}/revogar-sessoes`, {
      headers: { 'X-Painel': '1', 'Content-Type': 'application/json' }, data: {},
    })).status()).toBe(200);
    await dono.close();

    for (const endereco of ['/admin/login', '/admin/operacao']) {
      const { ctx, page } = await reabrir(browser, guardadosAntes);
      await page.goto(endereco);
      await expect(page).toHaveURL(/\/admin\/login/);
      await expect(page.getByLabel('E-mail')).toBeVisible();
      expect(await cookie(ctx, RENOVACAO)).toBeFalsy();               // a renovação recusada sai do aparelho
      await ctx.close();
    }
  });

  test('11. "Sair" no tablet revoga a renovação: a cópia antiga não entra mais', async ({ browser }) => {
    await entrar(pagina, TABLET);
    await noModoOperacao(pagina);
    const copia = await guardados(tablet);
    const sair = await pagina.request.delete('/admin/api/sessao', { headers: { 'X-Painel': '1' } });
    expect((await sair.json()).revogada).toBe(true);
    expect(await cookie(tablet, RENOVACAO)).toBeFalsy();
    const { ctx, page } = await reabrir(browser, copia);
    await page.goto('/admin/login');
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await ctx.close();
  });
});
