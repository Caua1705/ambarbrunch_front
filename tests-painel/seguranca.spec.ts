// Autenticação e proteção das rotas do painel nos três modos (demo, api com backend falso, indisponível).
import { test, expect } from '@playwright/test';
import { DEMO, API, INDISPONIVEL, BACKEND_FALSO, entrarDemo, post } from './apoio';

test.describe('rotas protegidas', () => {
  for (const base of [DEMO, API, INDISPONIVEL]) {
    test(`sem sessão, toda página manda para o login (${base.slice(-4)})`, async ({ request }) => {
      for (const p of ['/admin', '/admin/reservas', '/admin/financeiro', '/admin/estoque', '/admin/configuracoes']) {
        const r = await request.get(base + p, { maxRedirects: 0 });
        expect(r.status(), p).toBe(303);
        expect(r.headers().location).toMatch(/^\/admin\/login/);
      }
    });
    test(`sem sessão, a ponte da API responde 401 (${base.slice(-4)})`, async ({ request }) => {
      const r = await request.get(`${base}/admin/api/reservas`);
      expect(r.status()).toBe(401);
    });
  }

  test('cookie forjado de demonstração não abre o painel no modo api', async ({ request }) => {
    const r = await request.get(`${API}/admin`, { headers: { Cookie: 'ambar_painel=demo:admin' }, maxRedirects: 0 });
    expect(r.status()).toBe(303);
  });

  test('cabeçalhos de segurança e CSP sem unsafe-inline para scripts', async ({ request }) => {
    const r = await request.get(`${DEMO}/admin/login`);
    const h = r.headers();
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['cache-control']).toContain('no-store');
    expect(h['x-robots-tag']).toContain('noindex');
    const csp = h['content-security-policy'];
    expect(csp).toContain("frame-ancestors 'none'");
    const scripts = csp.split(';').find((d) => d.trim().startsWith('script-src'))!;
    expect(scripts).not.toContain('unsafe-inline');
    expect(scripts).not.toContain('unsafe-eval');
  });
});

test.describe('proteção contra requisição forjada', () => {
  test('login sem o cabeçalho do painel é recusado', async ({ request }) => {
    const r = await post(request, `${DEMO}/admin/api/sessao`, { demo: 'admin' });
    expect(r.status()).toBe(403);
  });
  test('ação de outra origem é recusada mesmo com sessão', async ({ page }) => {
    await entrarDemo(page);
    const r = await page.request.patch(`${DEMO}/admin/api/reservas/00000000-0000-4000-8000-000000000000/status`, { headers: { 'X-Painel': '1', Origin: 'https://site-malicioso.invalid', 'Content-Type': 'application/json' }, data: { status: 'cancelada' } });
    expect(r.status()).toBe(403);
  });
  test('a ponte não deixa chegar ao login nem subir de pasta', async ({ page }) => {
    await entrarDemo(page);
    expect((await page.request.get(`${DEMO}/admin/api/auth/me`)).status()).toBe(404);
    expect((await page.request.get(`${DEMO}/admin/api/..%2F..%2Fsaude`)).status()).toBe(404);
  });
});

test.describe('modo indisponível', () => {
  test('a tela de login explica e ninguém entra', async ({ page, request }) => {
    await page.goto(`${INDISPONIVEL}/admin/login`);
    await expect(page.getByText('ainda não está conectado ao sistema do Âmbar')).toBeVisible();
    await expect(page.getByLabel('E-mail')).toHaveCount(0);
    const r = await post(request, `${INDISPONIVEL}/admin/api/sessao`, { email: 'a@b.c', senha: 'x', demo: 'admin' }, { 'X-Painel': '1' });
    expect(r.status()).toBe(503);
  });
});

test.describe('modo api (backend falso)', () => {
  test('senha errada mostra erro humano e não cria sessão', async ({ page }) => {
    await page.goto(`${API}/admin/login`);
    await page.getByLabel('E-mail').fill('gerente@teste.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
    expect((await page.context().cookies()).find((c) => c.name === 'ambar_painel')).toBeUndefined();
  });

  test('login real: cookie HttpOnly, token nunca no navegador e Bearer repassado ao backend', async ({ page, request }) => {
    await page.goto(`${API}/admin/login?volta=/admin/reservas`);
    await page.getByLabel('E-mail').fill('gerente@teste.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('senha-certa');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(`${API}/admin/reservas`);
    await expect(page.getByText('Cliente Real de Teste')).toBeVisible();

    const cookie = (await page.context().cookies()).find((c) => c.name === 'ambar_painel')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    expect(cookie.path).toBe('/admin');
    // o token não aparece no HTML, no armazenamento nem em document.cookie
    const html = await page.content();
    expect(html).not.toContain('token-de-teste-nao-secreto');
    const noNavegador = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie);
    expect(noNavegador).not.toContain('token-de-teste');
    // o servidor do painel mandou o Bearer ao backend
    const ultimo = await (await request.get(`${BACKEND_FALSO}/__ultimo`)).json();
    expect(ultimo.authorization).toBe('Bearer token-de-teste-nao-secreto');
  });

  test('rota que o backend publicado ainda não tem aparece como "ainda não está no ar"', async ({ page }) => {
    await page.goto(`${API}/admin/login`);
    await page.getByLabel('E-mail').fill('gerente@teste.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('senha-certa');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(`${API}/admin`);
    await page.goto(`${API}/admin/atendimento`);
    await expect(page.getByText(/ainda não está no ar/)).toBeVisible();
    // e nada de R$ 0,00 inventado na Visão Geral
    await page.goto(`${API}/admin`);
    await expect(page.getByText('Reservas de hoje')).toBeVisible();
    await expect(page.getByText('R$ 0,00')).toHaveCount(0);
  });

  test('volta= só aceita caminhos do painel (sem redirecionamento aberto)', async ({ page }) => {
    await page.goto(`${API}/admin/login?volta=https://site-malicioso.invalid/`);
    await page.getByLabel('E-mail').fill('gerente@teste.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('senha-certa');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(`${API}/admin`);
  });

  test('sair apaga a sessão', async ({ page }) => {
    await page.goto(`${API}/admin/login`);
    await page.getByLabel('E-mail').fill('gerente@teste.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('senha-certa');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(`${API}/admin`);
    await page.getByRole('button', { name: /Gerente Teste/ }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    await page.waitForURL(`${API}/admin/login`);
    const r = await page.request.get(`${API}/admin`, { maxRedirects: 0 });
    expect(r.status()).toBe(303);
  });
});
