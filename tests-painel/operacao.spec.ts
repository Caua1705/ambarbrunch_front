// Modo Operação (/admin/operacao), a tela do tablet do café: sessão, permissões, dados do backend, "Cliente chegou"
// (um pedido só, mesmo com toque duplo), erros, sessão vencida, filtros, tablet em pé e deitado, celular, desktop e
// acessibilidade. No modo api, o backend falso responde no formato da produção de hoje (sem PUT …/comparecimento).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DEMO, API, INDISPONIVEL, BACKEND_FALSO, entrarDemo, semRolagemHorizontal } from './apoio';

const hojeFortaleza = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
/** Meio do movimento: 12:40 de hoje em Fortaleza (o cenário do backend falso é montado em volta desse instante). */
const BASE = () => `${hojeFortaleza()}T12:40:00-03:00`;

async function controle(page: Page, q: string) {
  const r = await page.request.post(`${BACKEND_FALSO}/__controle?${q}`);
  expect(r.ok()).toBe(true);
}
const patches = async (page: Page) => ((await (await page.request.get(`${BACKEND_FALSO}/__ultimo`)).json()) as { patches: unknown[] }).patches;

async function entrarApi(page: Page) {
  const r = await page.request.post(`${API}/admin/api/sessao`, { headers: { 'X-Painel': '1', Origin: API }, data: { email: 'gerente@teste.invalid', senha: 'senha-certa' } });
  expect(r.ok()).toBe(true);
}

/** Abre o Modo Operação no modo api com o dia de movimento e o relógio do navegador às 12:40 de Fortaleza. */
async function abrirCenario(page: Page) {
  await controle(page, `cenario=${encodeURIComponent(BASE())}&zerar=1`);
  await page.clock.setFixedTime(new Date(BASE()));
  await entrarApi(page);
  await page.goto(`${API}/admin/operacao`);
  await expect(page.locator('.op-reserva').first()).toBeVisible();
}

const linha = (page: Page, nome: string) => page.locator('.op-reserva', { hasText: nome });

test.afterAll(async ({ request }) => {
  await request.post(`${BACKEND_FALSO}/__controle?cenario=&zerar=1`);
});

test.describe('acesso', () => {
  for (const base of [DEMO, API, INDISPONIVEL]) {
    test(`sem sessão, manda ao login e volta para a operação (${base.slice(-4)})`, async ({ request }) => {
      const r = await request.get(`${base}/admin/operacao`, { maxRedirects: 0 });
      expect(r.status()).toBe(303);
      expect(r.headers().location).toBe('/admin/login?volta=%2Fadmin%2Foperacao');
    });
  }

  test('o painel leva ao Modo Operação e o login volta para ele', async ({ page }) => {
    await page.goto(`${API}/admin/login?volta=/admin/operacao`);
    await page.getByLabel('E-mail').fill('gerente@teste.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('senha-certa');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(`${API}/admin/operacao`);
    await expect(page.locator('.op-topo')).toContainText('Gerente Teste');
    await page.goto(`${API}/admin/reservas`);
    await expect(page.getByRole('link', { name: 'Modo Operação' })).toHaveAttribute('href', '/admin/operacao');
  });
});

test.describe('dados reais do backend (modo api)', () => {
  test('resumo do dia e próximas reservas priorizadas', async ({ page }) => {
    await abrirCenario(page);
    const resumo = page.locator('.op-resumo');
    await expect(resumo.locator('.op-numero').nth(0)).toContainText('10'); // 11 reservas, 1 cancelada
    await expect(resumo.locator('.op-numero').nth(1)).toContainText('39');
    await expect(resumo.locator('.op-numero').nth(2)).toContainText('2');
    await expect(resumo.locator('.op-numero').nth(2)).toContainText('6 pessoas');
    await expect(resumo.locator('.op-numero').nth(3)).toContainText('3');
    // a atrasada primeiro, depois quem já está no horário, depois as próximas
    const nomes = await page.locator('.op-reserva__nome').allInnerTexts();
    expect(nomes.slice(0, 3)).toEqual(['Marcos Teste Viana', 'Clara Teste Nunes', 'Joana Teste Prado']);
    expect(nomes).not.toContain('Helena Teste Martins'); // já chegou
    expect(nomes.at(-1)).toBe('Rita Teste Gomes'); // horário encerrado sem registro: por último
    await expect(linha(page, 'Marcos')).toContainText('Atrasada 35 min');
    await expect(linha(page, 'Caio')).toContainText('Aguardando aprovação');
    await expect(linha(page, 'Caio').getByRole('button', { name: /Cliente chegou/ })).toHaveCount(0);
    // nada de telefone na tela do tablet
    await expect(page.locator('body')).not.toContainText(/\+55|\(\d{2}\) \d{4,5}-\d{4}/);
  });

  test('Cliente chegou: um pedido só, mesmo com toque duplo, e a tela muda na hora', async ({ page }) => {
    await abrirCenario(page);
    const botao = linha(page, 'Clara').getByRole('button', { name: /Cliente chegou/ });
    // dois toques no mesmo instante (antes de qualquer nova pintura)
    await botao.evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });
    await expect(page.locator('.aviso-rapido')).toContainText('Chegada de Clara registrada.');
    await expect.poll(() => patches(page)).toEqual([{ status: 'compareceu', motivo: null }]);
    await expect(page.locator('.op-reserva__nome', { hasText: 'Clara' })).toHaveCount(0); // saiu das próximas
    await expect(page.locator('.op-resumo .op-numero').nth(2)).toContainText('3');
    await page.getByRole('button', { name: 'Dia inteiro' }).click();
    await expect(linha(page, 'Clara')).toContainText(/Chegou às \d{2}:\d{2}/);
  });

  test('chegada muito antes do horário pede confirmação', async ({ page }) => {
    await abrirCenario(page);
    await linha(page, 'Bruno').getByRole('button', { name: /Cliente chegou/ }).click();
    await expect(linha(page, 'Bruno')).toContainText('Chegou antes do horário');
    await linha(page, 'Bruno').getByRole('button', { name: 'Voltar' }).click();
    expect(await patches(page)).toEqual([]);
    await linha(page, 'Bruno').getByRole('button', { name: /Cliente chegou/ }).click();
    await linha(page, 'Bruno').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.locator('.aviso-rapido')).toContainText('Chegada de Bruno registrada.');
    expect(await patches(page)).toHaveLength(1);
  });

  test('erro da API: mensagem clara e a reserva continua a chegar', async ({ page }) => {
    await abrirCenario(page);
    await controle(page, 'falhar=1');
    await linha(page, 'Lia').getByRole('button', { name: /Cliente chegou/ }).click();
    await expect(page.locator('.aviso-rapido')).toContainText('manutenção');
    await expect(linha(page, 'Lia').getByRole('button', { name: /Cliente chegou/ })).toBeEnabled();
    await expect(linha(page, 'Lia')).not.toContainText('Chegou às');
  });

  test('sessão vencida no meio do uso volta ao login e depois à operação', async ({ page }) => {
    await abrirCenario(page);
    await controle(page, 'expirar=1');
    await linha(page, 'Joana').getByRole('button', { name: /Cliente chegou/ }).click();
    await page.waitForURL(/\/admin\/login\?volta=%2Fadmin%2Foperacao/);
    expect((await page.request.get(`${API}/admin/api/reservas/ambientes`)).status()).toBe(401);
  });

  test('filtros: atenção, dia inteiro e ambiente', async ({ page }) => {
    await abrirCenario(page);
    await page.locator('.op-numero', { hasText: 'Precisam de atenção' }).click();
    await expect(page.getByRole('button', { name: 'Atenção (3)' })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.op-reserva__nome').allInnerTexts()).toEqual(['Marcos Teste Viana', 'Caio Teste Duarte', 'Rita Teste Gomes']);
    await page.getByRole('button', { name: 'Dia inteiro' }).click();
    await expect(page.locator('.op-reserva')).toHaveCount(11);
    await expect(page.locator('.op-reserva').last()).toContainText('Cancelada');
    await page.getByRole('group', { name: 'Ambiente' }).getByRole('button', { name: 'Salão' }).click();
    expect(await page.locator('.op-reserva__nome').allInnerTexts()).toEqual(['Otávio Teste Ramos', 'Clara Teste Nunes', 'Bruno Teste Sales']);
    await page.getByRole('group', { name: 'Ambiente' }).getByRole('button', { name: 'Sala Privativa' }).click();
    await expect(page.locator('.op-reserva__nome')).toHaveText(['Joana Teste Prado']);
  });

  test('detalhe da reserva: gerência vê "Não veio" só depois do atraso e o atalho para o painel', async ({ page }) => {
    await abrirCenario(page);
    await linha(page, 'Marcos').locator('.op-reserva__abrir').click();
    const gaveta = page.getByRole('dialog');
    await expect(gaveta).toContainText('Marcos Teste Viana');
    await expect(gaveta.getByRole('button', { name: 'Não veio' })).toBeVisible();
    await expect(gaveta.getByRole('link', { name: /Abrir no painel/ })).toHaveAttribute('href', /\/admin\/reservas\?data=.*&reserva=/);
    await page.keyboard.press('Escape');
    await linha(page, 'Joana').locator('.op-reserva__abrir').click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Não veio' })).toHaveCount(0);
  });

  test('sair encerra a sessão no backend e o próximo login volta à operação', async ({ page }) => {
    await abrirCenario(page);
    await page.getByRole('button', { name: /^Sair/ }).click();
    await page.waitForURL(`${API}/admin/login?saiu=1&volta=%2Fadmin%2Foperacao`);
    expect((await (await page.request.get(`${BACKEND_FALSO}/__ultimo`)).json()).revogado).toBe(true);
    expect((await page.request.get(`${API}/admin/operacao`, { maxRedirects: 0 })).status()).toBe(303);
  });
});

test.describe('perfis (demonstração)', () => {
  test('Atendente: só a agenda, sem contato do cliente e sem ações de gerência', async ({ page }) => {
    await entrarDemo(page, 'operador');
    await page.goto(`${DEMO}/admin/operacao`);
    await expect(page.locator('.op-topo')).toContainText('Atendente');
    await page.getByRole('button', { name: 'Dia inteiro' }).click();
    await expect(page.locator('.op-reserva').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/\+55|\(\d{2}\) \d{4,5}-\d{4}|@exemplo/);
    await page.locator('.op-reserva__abrir').first().click();
    const gaveta = page.getByRole('dialog');
    await expect(gaveta).toBeVisible();
    await expect(gaveta.getByRole('button', { name: 'Não veio' })).toHaveCount(0);
    await expect(gaveta.getByRole('link', { name: /Abrir no painel/ })).toHaveCount(0);
    await gaveta.getByRole('button', { name: 'Fechar' }).click();
    await page.locator('.op-conta').click();
    await expect(page.getByRole('menuitem', { name: 'Abrir o painel completo' })).toHaveAttribute('href', '/admin/reservas');
  });

  test('Proprietário e Gerente entram; o painel completo abre na Visão Geral', async ({ page }) => {
    for (const papel of ['admin', 'gerente'] as const) {
      await entrarDemo(page, papel);
      await page.goto(`${DEMO}/admin/operacao`);
      await expect(page.locator('.op-topo')).toContainText(papel === 'admin' ? 'Proprietário' : 'Gerente');
      await page.locator('.op-conta').click();
      await expect(page.getByRole('menuitem', { name: 'Abrir o painel completo' })).toHaveAttribute('href', '/admin');
    }
  });
});

test.describe('tablet, celular e desktop', () => {
  const TELAS: [string, number, number][] = [
    ['tablet 10" deitado', 1280, 800],
    ['tablet 10" em pé', 800, 1280],
    ['tablet 8" em pé', 601, 962],
    ['tablet 8" deitado', 962, 601],
    ['celular 375', 375, 667],
    ['celular 390', 390, 844],
    ['celular 430', 430, 932],
    ['desktop', 1440, 900],
  ];
  for (const [nome, w, h] of TELAS) {
    test(`sem rolagem horizontal e botão de chegada confortável — ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await abrirCenario(page);
      for (const tema of ['claro', 'escuro']) {
        await page.evaluate((t) => document.documentElement.setAttribute('data-tema', t), tema);
        expect(await semRolagemHorizontal(page), tema).toBe(true);
      }
      const caixa = await linha(page, 'Clara').getByRole('button', { name: /Cliente chegou/ }).boundingBox();
      expect(caixa!.height).toBeGreaterThanOrEqual(48);
      expect(caixa!.width).toBeGreaterThanOrEqual(w < 600 ? 200 : 160);
    });
  }

  for (const tema of ['claro', 'escuro']) {
    test(`acessibilidade (axe) no tablet — tema ${tema}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.addInitScript((t) => localStorage.setItem('painel-tema', t), tema);
      await abrirCenario(page);
      const graves = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }

  test('tema escolhido vale depois de recarregar', async ({ page }) => {
    await abrirCenario(page);
    const antes = await page.evaluate(() => document.documentElement.getAttribute('data-tema'));
    await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tema', antes === 'escuro' ? 'claro' : 'escuro');
  });

  // Capturas para revisão visual: CAPTURAS=<pasta> npx playwright test -c playwright.painel.config.ts operacao -g captura
  test('captura das telas', async ({ page }) => {
    test.skip(!process.env.CAPTURAS, 'só com CAPTURAS=<pasta>');
    for (const [nome, w, h] of TELAS.filter(([n]) => !n.startsWith('celular 375') && !n.startsWith('celular 430'))) {
      for (const tema of ['claro', 'escuro']) {
        await page.setViewportSize({ width: w, height: h });
        await page.addInitScript((t) => localStorage.setItem('painel-tema', t), tema);
        await abrirCenario(page);
        await page.screenshot({ path: `${process.env.CAPTURAS}/operacao-${nome.replace(/\W+/g, '-')}-${tema}.png` });
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await abrirCenario(page);
    await linha(page, 'Bruno').getByRole('button', { name: /Cliente chegou/ }).click();
    await page.screenshot({ path: `${process.env.CAPTURAS}/operacao-confirmar-antecipada.png` });
    await linha(page, 'Bruno').getByRole('button', { name: 'Voltar' }).click();
    await linha(page, 'Clara').getByRole('button', { name: /Cliente chegou/ }).click();
    await expect(page.locator('.aviso-rapido')).toBeVisible();
    await page.screenshot({ path: `${process.env.CAPTURAS}/operacao-chegada-registrada.png` });
    await linha(page, 'Marcos').locator('.op-reserva__abrir').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(400); // fim da animação da gaveta
    await page.screenshot({ path: `${process.env.CAPTURAS}/operacao-detalhe.png` });
  });
});
