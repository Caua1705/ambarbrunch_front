// Ponto rápido no tablet (18/11/2026), contra o BACKEND REAL local (motor falso que aprova a funcionária cadastrada).
// Rodar com AMBAR_PONTO_JANELA_REPETICAO_SEGUNDOS=3 no backend de teste (entrada e saída na mesma rodada).
// Prova: câmera desligada e "Registrando ponto…" logo depois dos quadros (a pessoa não fica parada esperando o servidor),
// backend lento mostra "Registrando ponto…", Cancelar não envia nada, uma captura por tentativa, sem internet / rosto
// desconhecido / pouca luz dizem que nada foi registrado, confirmar duas vezes grava uma marcação só, entrada e saída.
import { readFileSync } from 'node:fs';
import { test, expect, devices, type BrowserContext, type Page, type Route } from '@playwright/test';
import { ruidoDeSensor } from './ruido';

const SEGREDOS = JSON.parse(readFileSync(process.env.TABLET_REAL_SEGREDOS!, 'utf-8')) as { senha: string };
const ANDROID = { ...devices['Galaxy Tab S4'], baseURL: 'http://127.0.0.1:4497' };
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
const CAPTURA = /\/admin\/ponto\/terminal\/sessoes\/[^/]+\/captura-direta$/;
const PREVIA = /\/admin\/ponto\/terminal\/sessoes\/[^/]+\/previa$/;

async function entrar(page: Page, email: string) {
  await page.goto('/admin/login?volta=%2Fadmin');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(SEGREDOS.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe.serial('ponto rápido no tablet', () => {
  let tablet: BrowserContext;
  let pagina: Page;
  let dono: BrowserContext;
  let pd: Page;
  const marcacoes = async () =>
    (await (await pd.request.get(`/admin/api/ponto/marcacoes?de=${hoje()}&ate=${hoje()}`)).json()).total as number;
  const capturas: string[] = [];

  test.beforeAll(async ({ browser }) => {
    tablet = await browser.newContext(ANDROID);
    await tablet.addInitScript(ruidoDeSensor);
    pagina = await tablet.newPage();
    pagina.on('request', (r) => { if (r.method() === 'POST' && CAPTURA.test(r.url())) capturas.push(r.url()); });
    await entrar(pagina, 'tablet@tablet.local');
    await pagina.waitForURL(/\/admin\/operacao/);
    dono = await browser.newContext({ baseURL: 'http://127.0.0.1:4497' });
    pd = await dono.newPage();
    await entrar(pd, 'dono@tablet.local');
    await pd.waitForURL(/\/admin(\?|$)/);
  });
  test.afterAll(async () => { await tablet.close(); await dono.close(); });

  const abrirPonto = async () => {
    await pagina.goto('/admin/operacao?secao=ponto');
    await pagina.getByRole('button', { name: 'Registrar ponto' }).waitFor();
  };

  test('1. backend lento: câmera já desligada e "Registrando ponto…" enquanto o servidor confere; depois a tela Confira', async () => {
    await abrirPonto();
    await pagina.route(CAPTURA, async (rota: Route) => { await new Promise((ok) => setTimeout(ok, 2500)); await rota.continue(); });
    const antes = capturas.length;
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(pagina.getByText('Registrando ponto…')).toBeVisible({ timeout: 20_000 });
    await expect(pagina.getByText('Pronto, pode sair da frente da câmera.')).toBeVisible();
    // Câmera desligada: a pessoa não precisa ficar parada esperando o servidor.
    expect(await pagina.evaluate(() => {
      const v = document.querySelector('.op-camera video') as HTMLVideoElement | null;
      return !v || v.srcObject === null;
    })).toBe(true);
    await expect(pagina.getByRole('dialog', { name: 'Confirmar ponto' })).toBeVisible({ timeout: 20_000 });
    expect(capturas.length - antes).toBe(1);                         // uma captura por tentativa
    // Os tempos de cada etapa foram medidos no aparelho.
    const etapas = await pagina.evaluate(() => performance.getEntriesByType('mark').map((m) => m.name));
    for (const e of ['ponto:sessao', 'ponto:camera', 'ponto:quadros', 'ponto:codificado', 'ponto:resposta']) expect(etapas).toContain(e);
    await pagina.unroute(CAPTURA);
    await pagina.getByRole('button', { name: 'Não sou eu' }).click();
  });

  test('2. Cancelar durante a captura não envia nada (em produção, 18/11 13:58, a captura saiu depois do Cancelar e voltou 409)', async () => {
    await abrirPonto();
    // O caso de produção (18/11 13:58): a prévia diz "rosto ok, de frente" e a pessoa toca em Cancelar logo depois.
    await pagina.route(PREVIA, async (rota: Route) => {
      await new Promise((ok) => setTimeout(ok, 1500));
      await rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4497' },
        body: JSON.stringify({ orientacao: 'ok', rostos: 1, pose: 'frente' }) });
    });
    const antes = capturas.length;
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    // Cancela DEPOIS de "Rosto encontrado", enquanto os quadros são tirados.
    await expect(pagina.getByText('Rosto encontrado. Segure assim')).toBeVisible({ timeout: 15_000 });
    await pagina.getByRole('button', { name: 'Cancelar' }).click({ timeout: 2_000 });
    await expect(pagina.getByRole('button', { name: 'Registrar ponto' })).toBeVisible();
    await pagina.waitForTimeout(4000);
    expect(capturas.length).toBe(antes);
    await pagina.unroute(PREVIA);
  });

  test('3. pouca luz: a tela orienta e não captura enquanto o backend não aprova o enquadramento', async () => {
    await abrirPonto();
    await pagina.route(PREVIA, (rota: Route) => rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4497' }, body: JSON.stringify({ orientacao: 'pouca_luz', rostos: 1, pose: 'frente' }) }));
    const antes = capturas.length;
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(pagina.getByText('Melhore a iluminação')).toBeVisible({ timeout: 15_000 });
    expect(capturas.length).toBe(antes);
    await pagina.getByRole('button', { name: 'Cancelar' }).click();
    await pagina.unroute(PREVIA);
  });

  test('4. rosto não reconhecido: diz que o ponto NÃO foi registrado', async () => {
    await abrirPonto();
    const antes = await marcacoes();
    await pagina.route(CAPTURA, (rota: Route) => rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4497' }, body: JSON.stringify({
      sessao_id: '00000000-0000-0000-0000-000000000000', resultado: 'rosto_desconhecido', mensagem: 'Rosto não reconhecido.',
      nova_tentativa: true, encaminhar_gestor: true }) }));
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(pagina.getByRole('heading', { name: 'Rosto não reconhecido' })).toBeVisible({ timeout: 20_000 });
    await expect(pagina.getByText('O ponto não foi registrado.')).toBeVisible();
    expect(await marcacoes()).toBe(antes);
    await pagina.unroute(CAPTURA);
  });

  test('5. falha de conexão no envio: "Sem internet" e nada registrado', async () => {
    await abrirPonto();
    const antes = await marcacoes();
    await pagina.route(CAPTURA, (rota: Route) => rota.abort('internetdisconnected'));
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(pagina.getByRole('heading', { name: 'Sem internet' })).toBeVisible({ timeout: 20_000 });
    await expect(pagina.getByText('O ponto não foi registrado.')).toBeVisible();
    expect(await marcacoes()).toBe(antes);
    await pagina.unroute(CAPTURA);
  });

  test('6. entrada: confirmar DUAS vezes grava uma marcação só e o recibo aparece', async () => {
    await abrirPonto();
    const antes = await marcacoes();
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    const confira = pagina.getByRole('dialog', { name: 'Confirmar ponto' });
    await expect(confira.getByText('Entrada')).toBeVisible({ timeout: 20_000 });
    await confira.getByRole('button', { name: 'Confirmar ponto' }).dblclick();
    await expect(pagina.getByText('Ponto registrado')).toBeVisible();
    await expect(pagina.locator('.op-recibo__tipo')).toHaveText('Entrada');
    expect(await marcacoes()).toBe(antes + 1);
  });

  test('7. tentativa duplicada logo em seguida: "Ponto já registrado", nada duplicado', async () => {
    const antes = await marcacoes();
    await pagina.getByRole('button', { name: 'Próxima pessoa' }).click();
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(pagina.getByRole('heading', { name: 'Ponto já registrado' })).toBeVisible({ timeout: 20_000 });
    expect(await marcacoes()).toBe(antes);
  });

  test('8. saída: depois da janela de repetição, a próxima marcação é registrada', async () => {
    await pagina.waitForTimeout(3500);
    await abrirPonto();
    const antes = await marcacoes();
    await pagina.getByRole('button', { name: 'Registrar ponto' }).click();
    const confira = pagina.getByRole('dialog', { name: 'Confirmar ponto' });
    await expect(confira).toBeVisible({ timeout: 20_000 });
    const opcao = confira.getByRole('button', { name: 'Saída do expediente' });
    if (await opcao.count()) await opcao.click();
    else await confira.getByRole('button', { name: 'Confirmar ponto' }).click();
    await expect(pagina.getByText('Ponto registrado')).toBeVisible();
    await expect(pagina.locator('.op-recibo__tipo')).not.toHaveText('Entrada');
    expect(await marcacoes()).toBe(antes + 1);
  });
});
