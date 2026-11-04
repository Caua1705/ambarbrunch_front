// Nova reserva: os horários vêm do serviço do site, a tela não deixa gravar o que ele recusa, e o horário é conferido de
// novo ao gravar. Demonstração e respostas simuladas; a prova contra o backend real está em tests-painel-real/reservas-nova.
import { test, expect, type Page, type Locator } from '@playwright/test';
import { DEMO, API, entrarDemo } from './apoio';

const SITE = '**/admin/api/reservas/publica/disponibilidade*';
const CONFIG = '**/admin/api/reservas/publica/config*';

function daquiA(n: number) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const [a, m, d] = hoje.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
const AMANHA = daquiA(1);

async function abrir(page: Page, data = AMANHA): Promise<Locator> {
  await page.getByRole('button', { name: 'Nova reserva' }).click();
  const g = page.getByRole('dialog', { name: 'Nova reserva' });
  await g.getByLabel('Data').fill(data);
  return g;
}

async function preencher(g: Locator) {
  await g.getByLabel('Nome do cliente').fill('Cliente do Teste');
  await g.getByLabel('Telefone (WhatsApp)').fill('85999998888');
}

const ambiente = (g: Locator, nome: string) => g.getByRole('group', { name: nome, exact: true });

/** Contador de POST /reservas: nenhuma tentativa de gravar passa despercebida. */
function contarGravacoes(page: Page) {
  const envios = { n: 0 };
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/admin\/api\/reservas$/.test(new URL(r.url()).pathname)) envios.n++;
  });
  return envios;
}

test.beforeEach(async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin/reservas`);
});

// A tela relê a disponibilidade sozinha: sem isto, um handler pode ficar pendurado depois do fim do teste.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('data e pessoas mostram os horários por ambiente; escolher um preenche ambiente e horário e cria a reserva', async ({ page }) => {
  const g = await abrir(page);
  await g.getByLabel('Pessoas').fill('3');
  const salao = ambiente(g, 'Salão');
  await salao.getByRole('radio').first().waitFor();
  const livre = salao.getByRole('radio').and(page.locator(':enabled')).first();
  const horario = (await livre.innerText()).trim();
  await livre.click();
  await expect(g.getByRole('status')).toContainText(`Salão · ${horario} às`);
  await expect(g.getByRole('status')).toContainText('3 pessoas');
  await preencher(g);
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(page.getByText('Reserva de Cliente do Teste criada.')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Cliente do Teste' })).toBeVisible();
});

test('sem horário escolhido não grava', async ({ page }) => {
  const envios = contarGravacoes(page);
  const g = await abrir(page);
  await preencher(g);
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText('Escolha um horário disponível.')).toBeVisible();
  expect(envios.n).toBe(0);
});

test('horário lotado e fora do prazo ficam desligados, com o motivo; o mínimo de pessoas vem do backend', async ({ page }) => {
  await page.route(SITE, (r) => {
    const a = new URL(r.request().url()).searchParams.get('ambiente');
    if (a === 'sala_privativa') return r.fulfill({ status: 422, json: { detail: [{ loc: ['body', 'pessoas'], msg: 'Sala Privativa recebe reservas a partir de 6 pessoas.', type: 'abaixo_do_minimo' }], codigo: 'abaixo_do_minimo' } });
    return r.fulfill({ json: { data: AMANHA, horarios: [{ hora: '08:00', disponivel: false }, { hora: '09:00', disponivel: true }, { hora: '10:00', disponivel: false }] } });
  });
  await page.route('**/admin/api/reservas/lotacao*', (r) => r.fulfill({ json: { ambiente_id: 'x', ambiente: 'x', data: AMANHA, capacidade_max: 56, duracao_min: 120, ativo: true, pessoas: 2, horarios: [{ hora: '08:00:00', ocupadas: 55, cabe: false }, { hora: '09:00:00', ocupadas: 4, cabe: true }, { hora: '10:00:00', ocupadas: 0, cabe: true }] } }));
  const g = await abrir(page);
  const salao = ambiente(g, 'Salão');
  await expect(salao.getByRole('radio', { name: '08:00 (lotado)' })).toBeDisabled();
  await expect(salao.getByRole('radio', { name: '10:00 (fora do prazo do site)' })).toBeDisabled();
  await expect(salao.getByRole('radio', { name: '09:00', exact: true })).toBeEnabled();
  await expect(salao).toContainText('1 horário livre');
  await expect(ambiente(g, 'Sala Privativa')).toContainText('Sala Privativa recebe reservas a partir de 6 pessoas.');
  await expect(ambiente(g, 'Sala Privativa').getByRole('radio')).toHaveCount(0);
});

test('ambiente que o site não oferece não tem horário', async ({ page }) => {
  await page.route(CONFIG, async (r) => {
    const res = await r.fetch();
    const corpo = await res.json();
    corpo.ambientes = corpo.ambientes.filter((a: { id: string }) => a.id !== 'lounge');
    return r.fulfill({ response: res, json: corpo });
  });
  const g = await abrir(page);
  await expect(ambiente(g, 'Lounge')).toContainText('não recebe reservas pelo site');
  await expect(ambiente(g, 'Lounge').getByRole('radio')).toHaveCount(0);
});

test('grupo acima do limite online: segue o que o backend permite à equipe, só pela lotação', async ({ page }) => {
  const g = await abrir(page);
  await g.getByLabel('Pessoas').fill('13');
  // no Salão (até 12 por reserva online e 56 de lotação) o site recusa, e a lotação decide
  await expect(ambiente(g, 'Salão').getByRole('radio').first()).toBeVisible();
  await expect(ambiente(g, 'Salão')).toContainText(/horários? livres?/);
});

test('data sem horários (antes da abertura, dia fechado): explica e leva à próxima data aberta', async ({ page }) => {
  const fechadas = [daquiA(0), daquiA(1), daquiA(2)];
  await page.route(CONFIG, async (r) => {
    const res = await r.fetch();
    const corpo = await res.json();
    for (const a of corpo.ambientes) a.datasFechadas = fechadas;
    return r.fulfill({ response: res, json: corpo });
  });
  await page.route(SITE, (r) => {
    const q = new URL(r.request().url()).searchParams;
    return fechadas.includes(q.get('data')!) ? r.fulfill({ json: { data: q.get('data'), horarios: [] } }) : r.fallback();
  });
  const g = await abrir(page);
  await expect(g.getByText(/^Sem horários em /)).toBeVisible();
  await expect(ambiente(g, 'Salão')).toContainText('Sem horários nesta data');
  await g.getByRole('button', { name: /^Ver / }).click();
  await expect(g.getByLabel('Data')).toHaveValue(daquiA(3));
  await expect(ambiente(g, 'Salão').getByRole('radio').first()).toBeVisible();
});

test('serviço de disponibilidade fora do ar: nenhum horário, nada a gravar, e "Tentar de novo" recupera', async ({ page }) => {
  let falhar = true;
  await page.route(SITE, (r) => (falhar ? r.fulfill({ status: 503, json: { detail: 'Reservas online indisponíveis no momento.', codigo: 'reservas_indisponiveis' } }) : r.fallback()));
  const envios = contarGravacoes(page);
  const g = await abrir(page);
  await expect(g.getByText('Reservas online indisponíveis no momento.')).toBeVisible();
  await expect(g.getByRole('radio')).toHaveCount(0);
  await expect(g.locator('input[type="time"]')).toHaveCount(0);
  await preencher(g);
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText('Escolha um horário disponível.')).toBeVisible();
  expect(envios.n).toBe(0);
  falhar = false;
  await g.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(ambiente(g, 'Salão').getByRole('radio').first()).toBeVisible();
});

test('o horário é conferido de novo ao gravar: se acabou de esgotar, não grava e pede outro', async ({ page }) => {
  const envios = contarGravacoes(page);
  const g = await abrir(page);
  const livre = ambiente(g, 'Salão').getByRole('radio').and(page.locator(':enabled')).first();
  await livre.waitFor();
  const horario = (await livre.innerText()).trim();
  await livre.click();
  await preencher(g);
  await page.route(SITE, (r) => r.fulfill({ json: { data: AMANHA, horarios: [{ hora: horario, disponivel: false }] } }));
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText('O horário escolhido não está mais disponível. Escolha outro.')).toBeVisible();
  expect(envios.n).toBe(0);
  await expect(g.getByRole('status').filter({ hasText: 'Salão ·' })).toHaveCount(0);
});

test('duas reservas ao mesmo tempo: o 409 do backend não cria nada e devolve a escolha à pessoa', async ({ page }) => {
  await page.route('**/admin/api/reservas', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 409, json: { detail: 'Lotação do ambiente excedida nesse horário.', codigo: 'lotacao_excedida' } }) : r.fallback()));
  const g = await abrir(page);
  const livre = ambiente(g, 'Salão').getByRole('radio').and(page.locator(':enabled')).first();
  await livre.waitFor();
  await livre.click();
  await preencher(g);
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText('O horário escolhido não está mais disponível. Escolha outro.')).toBeVisible();
  await expect(g.getByLabel('Nome do cliente')).toHaveValue('Cliente do Teste');
  await expect(page.getByRole('dialog', { name: 'Nova reserva' })).toBeVisible();
});

test('criação pelo painel desligada no sistema: mensagem e botão desligado, como antes', async ({ page }) => {
  await page.route('**/admin/api/reservas', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 403, json: { detail: 'Nesta versão, reservas novas são feitas só pelo site.', codigo: 'criacao_manual_desativada' } }) : r.fallback()));
  const g = await abrir(page);
  const livre = ambiente(g, 'Salão').getByRole('radio').and(page.locator(':enabled')).first();
  await livre.waitFor();
  await livre.click();
  await preencher(g);
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText('Nesta versão, reservas novas são feitas só pelo site.')).toBeVisible();
  await expect(g.getByRole('button', { name: 'Criar reserva' })).toBeDisabled();
});

test('ponte: lê o serviço público sem token e sem unidade, só por GET e só com sessão', async ({ page, request }) => {
  const anonimo = await request.get(`${API}/admin/api/reservas/publica/config`);
  expect(anonimo.status()).toBe(401);

  await page.context().clearCookies();
  await page.goto(`${API}/admin/login?volta=/admin/reservas`);
  await page.getByLabel('E-mail').fill('gerente@teste.invalid');
  await page.getByLabel('Senha', { exact: true }).fill('senha-certa');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`${API}/admin/reservas`);

  const r = await page.request.get(`${API}/admin/api/reservas/publica/disponibilidade?ambiente=salao&data=${AMANHA}&pessoas=2&unidade=ambar_cafe`);
  expect(r.status()).toBe(200);
  const eco = await r.json();
  expect(eco.rota).toBe('/reservas/disponibilidade');
  expect(eco.autorizacao).toBeNull();
  expect(eco.query).toBe(`ambiente=salao&data=${AMANHA}&pessoas=2`);

  const escrever = await page.request.post(`${API}/admin/api/reservas/publica/config`, { headers: { 'X-Painel': '1', Origin: API, 'Content-Type': 'application/json' }, data: {} });
  expect(escrever.status()).toBe(405);
  // qualquer outra rota pública continua fora do alcance: vira /admin/... como sempre
  const outra = await page.request.get(`${API}/admin/api/reservas/publica/outra`);
  expect(outra.status()).toBe(404);
});
