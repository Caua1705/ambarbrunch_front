// Conversas no tablet (Modo Operação) CONTRA O BACKEND REAL local (playwright.tablet-real.config.ts), 23/11/2026.
// Banco descartável com contas e conversas sintéticas e a Meta FALSA em 127.0.0.1 (nada sai da máquina): o Atendente vê
// as três seções com o contador de pendentes, responde uma conversa (a resposta passa pela API real e chega à Meta falsa),
// a gerência vê quem respondeu, e tudo que é administrativo continua bloqueado — pela tela e por chamada direta à API.
//
//   giardini_back: python <scratchpad>/conversas_real.py preparar  e  ... subir
//   aqui:          TABLET_REAL_SEGREDOS=<conversas_real.json> META_FALSA_ENVIOS=<meta_falsa.jsonl> \
//                  npx playwright test -c playwright.tablet-real.config.ts conversas.spec.ts
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const SEGREDOS = JSON.parse(readFileSync(process.env.TABLET_REAL_SEGREDOS!, 'utf-8')) as { senha: string };
const ENVIOS = process.env.META_FALSA_ENVIOS;
const TABLET = 'tablet@tablet.local';
const GERENTE = 'gerente@tablet.local';

async function entrar(page: Page, email: string, volta = '/admin/operacao') {
  await page.goto(`/admin/login?volta=${encodeURIComponent(volta)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(SEGREDOS.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const enviosDaMeta = () => (ENVIOS ? readFileSync(ENVIOS, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

test.describe.serial('Conversas no tablet', () => {
  test('Atendente: três seções, Reservas primeiro e o contador de conversas esperando a equipe', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page, TABLET);
    await page.waitForURL(/\/admin\/operacao$/);
    const secoes = page.getByRole('navigation', { name: /Seções/ });
    await expect(secoes.getByRole('button')).toHaveCount(3);
    await expect(secoes.getByRole('button', { name: /Reservas/ })).toHaveAttribute('aria-current', 'page');
    // Uma conversa sintética espera a equipe; o número vem do backend real (/admin/atendimento/resumo).
    await expect(secoes.getByRole('button', { name: /^Conversas/ }).locator('.op-secoes__contador')).toHaveText('1');
  });

  test('Atendente: responde pela API real (Meta falsa), com telefone visível e a resposta assinada pela conta', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page, TABLET, '/admin/operacao?secao=atendimento');
    await page.waitForURL(/secao=atendimento/);
    const lista = page.getByRole('list', { name: 'Conversas' });
    await expect(lista.getByRole('button', { name: /Cliente Teste Um/ })).toBeVisible();
    await lista.getByRole('button', { name: /Cliente Teste Um/ }).click();
    await expect(page.getByText(/99999-0001/).first()).toBeVisible();      // telefone visível ao Atendente (dono, 23/11)
    await page.getByRole('textbox', { name: 'Resposta' }).fill('Olá! Aqui é a equipe do Âmbar (teste local).');
    await page.getByRole('button', { name: 'Enviar resposta' }).click();
    await expect(page.locator('.mensagens')).toContainText('teste local');
    await expect(page.locator('.mensagens')).toContainText('Atendimento Âmbar');   // quem respondeu = a conta logada
    // Assumiu ao responder: ninguém mais espera; o contador some.
    await expect(page.getByRole('navigation', { name: /Seções/ }).locator('.op-secoes__contador')).toHaveCount(0, { timeout: 40_000 });
    if (ENVIOS) {
      const envios = enviosDaMeta();
      expect(envios).toHaveLength(1);
      expect(envios[0].corpo.to).toBe('5585999990001');
      expect(envios[0].corpo.text.body).toContain('teste local');
    }
  });

  test('Gerente: vê na conversa que foi o Atendimento Âmbar quem respondeu', async ({ page }) => {
    await entrar(page, GERENTE, '/admin/atendimento');
    await page.waitForURL(/\/admin\/atendimento/);
    await page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: /Cliente Teste Um/ }).click();
    const resposta = page.locator('.mensagens').getByText('teste local').first();
    await expect(resposta).toBeVisible();
    await expect(page.locator('.mensagens')).toContainText('Atendimento Âmbar');
  });

  test('Atendente: nada administrativo — páginas levam ao Modo Operação e a API responde 403', async ({ page }) => {
    await entrar(page, TABLET);
    await page.waitForURL(/\/admin\/operacao$/);
    for (const area of ['', 'reservas', 'financeiro', 'estoque', 'equipe', 'configuracoes', 'clube', 'equipe/cadastro-facial']) {
      await page.goto(`/admin/${area}`);
      await expect(page, area).toHaveURL(/\/admin\/operacao$/);
      await expect(page.getByRole('navigation', { name: 'Módulos' })).toHaveCount(0);
    }
    const proibidas = [
      'financeiro/lancamentos?de=2026-11-01&ate=2026-11-30', 'financeiro/acertos', 'estoque/insumos', 'ponto/funcionarios',
      'ponto/auditoria', 'usuarios', 'reservas/configuracao/ambar_cafe', 'atendimento/campanhas', 'atendimento/duplicidades',
    ];
    for (const caminho of proibidas) expect((await page.request.get(`/admin/api/${caminho}`)).status(), caminho).toBe(403);
    for (const caminho of ['atendimento/campanhas', 'usuarios']) {
      const r = await page.request.post(`/admin/api/${caminho}`, { headers: { 'X-Painel': '1', 'Content-Type': 'application/json' }, data: {} });
      expect(r.status(), caminho).toBe(403);
    }
    // Liberadas: Conversas, Reservas do dia, Ponto (terminal).
    for (const caminho of ['atendimento/conversas', 'atendimento/resumo', 'ponto/terminal/configuracao']) {
      expect((await page.request.get(`/admin/api/${caminho}`)).status(), caminho).toBe(200);
    }
  });

  test('sessão no tablet: token só em cookie HttpOnly e SameSite=Strict; escrita sem X-Painel recusada; sair encerra', async ({ page, context }) => {
    await entrar(page, TABLET);
    await page.waitForURL(/\/admin\/operacao$/);
    const cookies = await context.cookies();
    for (const nome of ['ambar_painel', 'ambar_painel_renovacao']) {
      const c = cookies.find((x) => x.name === nome);
      expect(c, nome).toBeTruthy();
      expect(c!.httpOnly, nome).toBe(true);
      expect(c!.sameSite, nome).toBe('Strict');
    }
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/ambar_painel=|ambar_painel_renovacao=/);
    // Formulário de outro site não manda X-Painel: a ponte recusa a escrita antes de chegar ao backend.
    const semCabecalho = await page.request.post('/admin/api/atendimento/conversas/00000000-0000-4000-8000-000000000000/assumir', { data: {} });
    expect(semCabecalho.status()).toBeGreaterThanOrEqual(400);
    expect(semCabecalho.status()).toBeLessThan(500);
    // Sair: a sessão acaba no servidor e a mesma página manda para o login.
    await page.getByRole('button', { name: /Sair: encerra a sessão/ }).click();
    await page.waitForURL(/\/admin\/login/);
    await page.goto('/admin/operacao?secao=atendimento');
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await page.request.get('/admin/api/atendimento/conversas')).status()).toBe(401);
  });
});
