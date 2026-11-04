// Nova reserva: os horários vêm do backend (GET /admin/reservas/disponibilidade), a tela não deixa gravar o que ele recusa e
// trata a resposta do POST. Demonstração e respostas simuladas; a prova contra o backend real, com a equipe abaixo das 2 h do
// site, concorrência e isolamento de unidades, está em tests-painel-real/reservas-e-visao.spec.ts e nos testes do backend.
import { test, expect, type Page, type Locator } from '@playwright/test';
import { DEMO, entrarDemo } from './apoio';

const DISP = '**/admin/api/reservas/disponibilidade*';

function daquiA(n: number) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const [a, m, d] = hoje.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
const HOJE = daquiA(0);
const AMANHA = daquiA(1);

type Parcial = { aviso?: string | null; horarios?: { hora: string; disponivel: boolean; motivo: string | null; ocupadas: number }[]; proxima_data?: string | null; criacao_manual?: boolean };

/** Resposta do backend por ambiente, sem depender de consulta real durante o teste (a tela relê sozinha). */
async function simular(page: Page, porAmbiente: (nome: string, data: string) => Parcial) {
  const ambientes: { id: string; nome: string; capacidade_max: number; duracao_min: number }[] = await (await page.request.get(`${DEMO}/admin/api/reservas/ambientes`)).json();
  await page.route(DISP, (r) => {
    const q = new URL(r.request().url()).searchParams;
    const a = ambientes.find((x) => x.id === q.get('ambiente_id'))!;
    const data = q.get('data')!;
    return r.fulfill({ json: { ambiente_id: a.id, ambiente: a.nome, unidade: 'ambar_cafe', data, pessoas: Number(q.get('pessoas')), capacidade_max: a.capacidade_max, duracao_min: a.duracao_min, criacao_manual: true, aviso: null, horarios: [], proxima_data: null, ...porAmbiente(a.nome, data) } });
  });
}

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
const livres = (g: Locator, nome: string) => ambiente(g, nome).locator('button[role="radio"]:enabled');
const HORARIO_PERDIDO = 'O horário escolhido não está mais disponível. Escolha outro.';

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
  const livre = livres(g, 'Salão').first();
  await livre.waitFor();
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

test('horário lotado fica desligado, com o motivo; o que já passou nem aparece; o mínimo de pessoas vem do backend', async ({ page }) => {
  await simular(page, (nome) => (nome === 'Sala Privativa'
    ? { aviso: 'Sala Privativa recebe reservas a partir de 6 pessoas.' }
    : { horarios: [
        { hora: '08:00:00', disponivel: false, motivo: 'passado', ocupadas: 0 },
        { hora: '09:00:00', disponivel: false, motivo: 'lotado', ocupadas: 55 },
        { hora: '10:00:00', disponivel: true, motivo: null, ocupadas: 4 },
      ] }));
  const g = await abrir(page);
  const salao = ambiente(g, 'Salão');
  await expect(salao.getByRole('radio', { name: '09:00 (lotado)' })).toBeDisabled();
  await expect(salao.getByRole('radio', { name: '10:00', exact: true })).toBeEnabled();
  await expect(salao.getByRole('radio', { name: /08:00/ })).toHaveCount(0);
  await expect(salao).toContainText('1 horário livre');
  await expect(ambiente(g, 'Sala Privativa')).toContainText('Sala Privativa recebe reservas a partir de 6 pessoas.');
  await expect(ambiente(g, 'Sala Privativa').getByRole('radio')).toHaveCount(0);
});

test('reserva de última hora: horário para daqui a pouco, hoje, pode ser escolhido e gravado', async ({ page }) => {
  // O backend libera para a equipe o que o site recusaria pela antecedência de 2 h: a tela só mostra o que ele responde.
  await simular(page, (nome) => (nome === 'Salão' ? { horarios: [{ hora: '23:59:00', disponivel: true, motivo: null, ocupadas: 0 }] } : {}));
  const g = await abrir(page, HOJE);
  await livres(g, 'Salão').first().click();
  await preencher(g);
  await page.route('**/admin/api/reservas', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 422, json: { detail: [{ loc: ['body', 'hora'], msg: 'Esse horário já passou.', type: 'horario_passado' }], codigo: 'horario_passado' } }) : r.fallback()));
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  // Quem recusa é o backend: a tela devolve a escolha e mantém o que foi digitado.
  await expect(g.getByText(HORARIO_PERDIDO)).toBeVisible();
  await expect(g.getByLabel('Nome do cliente')).toHaveValue('Cliente do Teste');
});

test('grupo acima do limite online: a equipe vê os horários enquanto couber na lotação', async ({ page }) => {
  const g = await abrir(page);
  await g.getByLabel('Pessoas').fill('13');
  await expect(livres(g, 'Salão').first()).toBeVisible();
  await expect(ambiente(g, 'Salão')).toContainText(/horários? livres?/);
});

test('data sem horários (antes da abertura, dia fechado): explica e leva à próxima data aberta', async ({ page }) => {
  const aberta = daquiA(3);
  await simular(page, (_, data) => (data === aberta ? { horarios: [{ hora: '12:00:00', disponivel: true, motivo: null, ocupadas: 0 }] } : { proxima_data: aberta }));
  const g = await abrir(page);
  await expect(g.getByText(/^Sem horários em /)).toBeVisible();
  await expect(ambiente(g, 'Salão')).toContainText('Sem horários nesta data');
  await g.getByRole('button', { name: /^Ver / }).click();
  await expect(g.getByLabel('Data')).toHaveValue(aberta);
  await expect(livres(g, 'Salão').first()).toBeVisible();
});

test('hoje sem mais horários: os que passaram somem e a tela aponta o próximo dia', async ({ page }) => {
  await simular(page, () => ({ horarios: [{ hora: '08:00:00', disponivel: false, motivo: 'passado', ocupadas: 0 }], proxima_data: AMANHA }));
  const g = await abrir(page, HOJE);
  await expect(g.getByText(/^Sem horários em /)).toBeVisible();
  await expect(g.getByRole('radio')).toHaveCount(0);
});

test('backend fora do ar: nenhum horário, nada a gravar, e "Tentar de novo" recupera', async ({ page }) => {
  let falhar = true;
  await page.route(DISP, (r) => (falhar ? r.fulfill({ status: 503, json: { detail: 'Disponibilidade fora do ar.', codigo: 'integracao_indisponivel' } }) : r.fallback()));
  const envios = contarGravacoes(page);
  const g = await abrir(page);
  await expect(g.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expect(g.getByRole('radio')).toHaveCount(0);
  await expect(g.locator('input[type="time"]')).toHaveCount(0);
  await preencher(g);
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText('Escolha um horário disponível.')).toBeVisible();
  expect(envios.n).toBe(0);
  falhar = false;
  await g.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(livres(g, 'Salão').first()).toBeVisible();
});

test('o horário é conferido de novo ao gravar: se acabou de esgotar, não grava e pede outro', async ({ page }) => {
  const envios = contarGravacoes(page);
  const g = await abrir(page);
  const livre = livres(g, 'Salão').first();
  await livre.waitFor();
  const horario = (await livre.innerText()).trim();
  await livre.click();
  await preencher(g);
  await simular(page, () => ({ horarios: [{ hora: `${horario}:00`, disponivel: false, motivo: 'lotado', ocupadas: 56 }] }));
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText(HORARIO_PERDIDO)).toBeVisible();
  expect(envios.n).toBe(0);
  await expect(g.getByRole('status').filter({ hasText: 'Salão ·' })).toHaveCount(0);
});

for (const [titulo, status, codigo] of [
  ['duas reservas ao mesmo tempo (409)', 409, 'lotacao_excedida'],
  ['ambiente deixou de funcionar nesse horário (422)', 422, 'fora_da_agenda'],
] as const) {
  test(`${titulo}: nada é criado e a escolha volta para a pessoa`, async ({ page }) => {
    await page.route('**/admin/api/reservas', (r) => (r.request().method() === 'POST' ? r.fulfill({ status, json: { detail: 'Recusado.', codigo } }) : r.fallback()));
    const g = await abrir(page);
    const livre = livres(g, 'Salão').first();
    await livre.waitFor();
    await livre.click();
    await preencher(g);
    await g.getByRole('button', { name: 'Criar reserva' }).click();
    await expect(g.getByText(HORARIO_PERDIDO)).toBeVisible();
    await expect(g.getByLabel('Nome do cliente')).toHaveValue('Cliente do Teste');
    await expect(page.getByRole('dialog', { name: 'Nova reserva' })).toBeVisible();
  });
}

test('criação desligada no backend: o aviso aparece antes de preencher e o botão fica desligado', async ({ page }) => {
  await simular(page, () => ({ criacao_manual: false, horarios: [{ hora: '12:00:00', disponivel: true, motivo: null, ocupadas: 0 }] }));
  const g = await abrir(page);
  await expect(g.getByText('A criação de reservas pelo painel está desligada.')).toBeVisible();
  await expect(g.getByRole('button', { name: 'Criar reserva' })).toBeDisabled();
});

test('POST recusado com 403 criacao_manual_desativada: mesma mensagem e botão desligado', async ({ page }) => {
  await page.route('**/admin/api/reservas', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 403, json: { detail: 'Nesta versão, reservas novas são feitas só pelo site.', codigo: 'criacao_manual_desativada' } }) : r.fallback()));
  const g = await abrir(page);
  const livre = livres(g, 'Salão').first();
  await livre.waitFor();
  await livre.click();
  await preencher(g);
  await g.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(g.getByText('A criação de reservas pelo painel está desligada.')).toBeVisible();
  await expect(g.getByRole('button', { name: 'Criar reserva' })).toBeDisabled();
});

test('Atendente não consulta a disponibilidade da equipe nem vê Nova reserva', async ({ page }) => {
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin/reservas`);
  await expect(page.getByRole('button', { name: 'Buscar reserva' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova reserva' })).toHaveCount(0);
  const r = await page.request.get(`${DEMO}/admin/api/reservas/disponibilidade?ambiente_id=x&data=${AMANHA}&pessoas=2`);
  expect(r.status()).toBe(403);
});
