// Tablet do café de ponta a ponta, contra o backend REAL local (playwright.tablet-real.config.ts). Em ordem: a conta do
// tablet entra uma vez e continua conectada; o ponto é registrado sem código de tablet e só depois da confirmação; falhas
// (sem internet, câmera bloqueada) dizem que nada foi registrado; o checklist de abertura é assumido pelo rosto, preenchido,
// recebe um vídeo gravado no navegador e é concluído; o Proprietário consulta e assiste; e encerrar a sessão do tablet pelo
// painel derruba a renovação.
import { readFileSync } from 'node:fs';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const SEGREDOS = JSON.parse(readFileSync(process.env.TABLET_REAL_SEGREDOS!, 'utf-8')) as { senha: string };
const TABLET = 'tablet@tablet.local';
const DONO = 'dono@tablet.local';
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());

async function entrar(page: Page, email: string, volta = '/admin/operacao') {
  await page.goto(`/admin/login?volta=${encodeURIComponent(volta)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(SEGREDOS.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const cookie = async (ctx: BrowserContext, nome: string) => (await ctx.cookies()).find((c) => c.name === nome);
const api = (page: Page) => ({
  get: (caminho: string) => page.request.get(`/admin/api/${caminho}`),
  post: (caminho: string, data?: unknown) => page.request.post(`/admin/api/${caminho}`, { headers: { 'X-Painel': '1', 'Content-Type': 'application/json' }, data: data ?? {} }),
});

test.describe.serial('tablet do café', () => {
  let tablet: BrowserContext;
  let pagina: Page;

  test.beforeAll(async ({ browser }) => {
    tablet = await browser.newContext();
    // A câmera falsa do Chromium repete quadros idênticos (byte a byte), o que o backend recusa como reenvio
    // (captura_repetida). Uma câmera de verdade nunca repete: aqui, um pixel aleatório faz o papel do ruído do sensor.
    await tablet.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement['toBlob']>) {
        const ctx = this.getContext('2d');
        if (ctx) {
          ctx.fillStyle = `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`;
          ctx.fillRect(Math.floor(Math.random() * this.width), Math.floor(Math.random() * this.height), 2, 2);
        }
        return original.apply(this, args);
      };
    });
    pagina = await tablet.newPage();
  });
  test.afterAll(async () => tablet.close());

  test('1–4. a conta do tablet entra uma vez, vai direto ao Modo Operação e continua conectada', async ({ browser }) => {
    await entrar(pagina, TABLET, '/admin');
    await pagina.waitForURL(/\/admin\/operacao/);
    const acesso = await cookie(tablet, 'ambar_painel');
    const renovacao = await cookie(tablet, 'ambar_painel_renovacao');
    expect(acesso?.httpOnly && renovacao?.httpOnly).toBe(true);
    expect(renovacao!.expires * 1000 - Date.now()).toBeGreaterThan(20 * 24 * 3600_000);   // ~30 dias, não 5 min
    expect(await pagina.evaluate(() => document.cookie)).not.toContain('ambar_painel=');

    // O acesso venceu (o cookie some com ele): a próxima tela renova sozinha, sem senha.
    await tablet.clearCookies({ name: 'ambar_painel' });
    await pagina.goto('/admin/operacao?secao=ponto');
    await expect(pagina).toHaveURL(/\/admin\/operacao/);
    expect(await cookie(tablet, 'ambar_painel')).toBeTruthy();
    // Também numa chamada de dados (a ponte renova antes de repassar).
    await tablet.clearCookies({ name: 'ambar_painel' });
    expect((await api(pagina).get('abertura/hoje')).status()).toBe(200);

    // Navegador fechado e aberto de novo (ou tablet reiniciado): só a renovação ficou guardada.
    const reaberto = await browser.newContext({ storageState: { cookies: [renovacao!], origins: [] } });
    const p2 = await reaberto.newPage();
    await p2.goto('/admin/operacao');
    await expect(p2).toHaveURL(/\/admin\/operacao/);
    await expect(p2.getByRole('navigation', { name: /Seções/ })).toBeVisible();
    await reaberto.close();
  });

  test('8–12. ponto sem código de tablet: identifica, mostra nome e horário e só grava depois de confirmar', async ({ browser }) => {
    const dono = await browser.newContext();
    const pd = await dono.newPage();
    await entrar(pd, DONO, '/admin');
    await pd.waitForURL(/\/admin(\?|$)/);
    const marcacoes = async () => (await (await api(pd).get(`ponto/marcacoes?de=${hoje()}&ate=${hoje()}`)).json()).total as number;
    const antes = await marcacoes();

    await pagina.goto('/admin/operacao?secao=ponto');
    await expect(pagina.getByText('Tablet não autorizado')).toHaveCount(0);
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    const confirma = pagina.getByRole('dialog', { name: 'Confirmar ponto' });
    await expect(confirma.getByRole('heading', { name: 'Rituane' })).toBeVisible({ timeout: 40_000 });
    await expect(confirma.getByText('Entrada')).toBeVisible();
    expect(await marcacoes()).toBe(antes);            // reconhecer não grava nada
    await confirma.getByRole('button', { name: 'Confirmar' }).click();
    await expect(pagina.getByText('Ponto registrado')).toBeVisible();
    await expect(pagina.locator('.op-recibo h2')).toHaveText('Rituane');
    expect(await marcacoes()).toBe(antes + 1);
    const lista = await (await api(pd).get(`ponto/marcacoes?de=${hoje()}&ate=${hoje()}`)).json();
    expect(lista.itens[0].origem).toBe('facial');

    // De novo logo em seguida: o backend reconhece a marcação recente e nem pede confirmação; nada duplicado.
    await pagina.getByRole('button', { name: 'Próxima pessoa' }).click();
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(pagina.getByRole('heading', { name: 'Ponto já registrado' })).toBeVisible({ timeout: 40_000 });
    expect(await marcacoes()).toBe(antes + 1);
    await pagina.getByRole('button', { name: 'Voltar' }).click();
    await dono.close();
  });

  test('13–15. sem internet e câmera bloqueada: diz que o ponto NÃO foi registrado e mostra o caminho do gestor', async ({ browser }) => {
    await pagina.goto('/admin/operacao?secao=ponto');
    await pagina.getByRole('button', { name: 'Registrar ponto' }).waitFor();
    await tablet.setOffline(true);
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(pagina.getByRole('heading', { name: 'Sem internet' })).toBeVisible();
    await expect(pagina.getByText('O ponto não foi registrado.')).toBeVisible();
    await expect(pagina.getByText('Se o tablet não registrar')).toBeVisible();
    await tablet.setOffline(false);

    const semCamera = await browser.newContext({ storageState: await tablet.storageState() });
    await semCamera.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('negada', 'NotAllowedError'));
    });
    const p = await semCamera.newPage();
    await p.goto('/admin/operacao?secao=ponto');
    await p.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(p.getByRole('heading', { name: 'Câmera indisponível' })).toBeVisible();
    await expect(p.getByText('O ponto não foi registrado.')).toBeVisible();
    await semCamera.close();
  });

  test('17–23. checklist de abertura: assume pelo rosto, preenche, grava o vídeo, envia; o Proprietário consulta e assiste', async ({ browser }) => {
    await pagina.setViewportSize({ width: 800, height: 1280 });   // tablet em pé
    await pagina.goto('/admin/operacao?secao=ponto&ponto=abertura');
    await pagina.getByRole('button', { name: 'Assumir a abertura' }).click();
    const dialogo = pagina.getByRole('dialog', { name: 'Rituane, assumir a abertura de hoje?' });
    await dialogo.getByRole('button', { name: 'Assumir' }).click({ timeout: 40_000 });
    await expect(pagina.getByText('pelo rosto')).toBeVisible();
    const tarefas = pagina.locator('.op-tarefa');
    await expect(tarefas).toHaveCount(13);
    for (let i = 0; i < 13; i++) await tarefas.nth(i).getByRole('button', { name: 'Feito', exact: true }).click();
    await expect(pagina.getByText('13 de 13 feitas')).toBeVisible();
    await expect(pagina.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

    await pagina.getByRole('button', { name: 'Gravar vídeo da abertura' }).click();
    await pagina.getByRole('button', { name: 'Abrir a câmera' }).click();
    await pagina.getByRole('button', { name: 'Gravar', exact: true }).click();
    await pagina.waitForTimeout(3000);
    await pagina.getByRole('button', { name: 'Parar a gravação' }).click();
    await expect(pagina.getByLabel('Prévia do vídeo da abertura')).toBeVisible();
    await pagina.getByRole('button', { name: 'Enviar vídeo' }).click();
    await expect(pagina.getByText(/Vídeo enviado às/)).toBeVisible();
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await pagina.getByRole('button', { name: 'Concluir e enviar' }).click();
    await expect(pagina.getByText('Checklist de hoje concluído.')).toBeVisible();

    // O Proprietário consulta em Equipe → Abertura e assiste ao vídeo (arquivo privado, pelo backend).
    const dono = await browser.newContext();
    const pd = await dono.newPage();
    await entrar(pd, DONO, '/admin/equipe?aba=abertura');
    await pd.waitForURL(/aba=abertura/);
    const linha = pd.getByRole('row', { name: /Rituane/ });
    await expect(linha).toContainText('13/13');
    await linha.click();
    const gaveta = pd.getByRole('dialog');
    await expect(gaveta.getByText('Limpar vidros')).toBeVisible();
    const video = gaveta.locator('video.video-abertura');
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 20_000 }).toBeGreaterThan(0);
    await dono.close();
  });

  test('4. o Proprietário encerra a sessão do tablet e ele volta para o login (sem entrar sem senha)', async ({ browser }) => {
    const dono = await browser.newContext();
    const pd = await dono.newPage();
    await entrar(pd, DONO, '/admin');
    await pd.waitForURL(/\/admin(\?|$)/);
    const equipe = await (await api(pd).get('usuarios')).json() as { id: string; email: string }[];
    const conta = equipe.find((u) => u.email === TABLET)!;
    expect((await api(pd).post(`usuarios/${conta.id}/revogar-sessoes`)).status()).toBe(200);
    await dono.close();

    const renovacao = await cookie(tablet, 'ambar_painel_renovacao');
    await pagina.goto('/admin/operacao');
    await pagina.waitForURL(/\/admin\/login/);
    // Nem a renovação guardada abre de novo.
    const reaberto = await browser.newContext({ storageState: { cookies: [renovacao!], origins: [] } });
    const p2 = await reaberto.newPage();
    await p2.goto('/admin/operacao');
    await p2.waitForURL(/\/admin\/login/);
    expect(await cookie(reaberto, 'ambar_painel_renovacao')).toBeFalsy();
    await reaberto.close();
  });
});
