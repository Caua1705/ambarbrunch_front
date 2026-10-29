// Site → API REAL → disponibilidade → (reserva) → resposta. Sem mocks: o que este teste diz vale para a API informada.
//   RESERVAS_API_REAL   URL da API (ex.: http://127.0.0.1:8090) — a mesma usada no build dist-reservas-real
//   RESERVAS_CRIAR=1    cria UMA reserva de teste (nome "TESTE E2E — pode apagar"); recusado em api.ambarbrunch.com
//   RESERVAS_TELEFONE   telefone de teste para a reserva criada (obrigatório com RESERVAS_CRIAR=1)
import { test, expect } from '@playwright/test';

const API = (process.env.RESERVAS_API_REAL ?? '').replace(/\/+$/, '');
const CRIAR = process.env.RESERVAS_CRIAR === '1';
const PRODUCAO = /(^|\.)api\.ambarbrunch\.com$/i.test(API ? new URL(API).hostname : '');
const ABERTURA = '2026-11-09';

test.skip(!API, 'defina RESERVAS_API_REAL (e faça o build dist-reservas-real com a mesma URL)');

interface Ambiente { id: string; nome: string; datasFechadas?: string[] }

async function json<T>(caminho: string): Promise<{ status: number; corpo: T }> {
  const r = await fetch(`${API}${caminho}`, { headers: { Accept: 'application/json' } });
  return { status: r.status, corpo: (await r.json()) as T };
}

test('a API real não oferece nada antes de 09/11 e o site mostra exatamente os horários dela', async ({ page }) => {
  const cfg = await json<{ ambientes: Ambiente[]; antecedencia: { diasMax: number }; fusoHorario: string }>('/reservas/config');
  test.skip(cfg.status === 503, 'reservas fechadas nesta API (503 reservas_indisponiveis)');
  expect(cfg.status).toBe(200);

  // 1. a configuração real: nenhuma data antes da abertura em nenhum ambiente
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.corpo.fusoHorario }).format(new Date());
  for (const a of cfg.corpo.ambientes) {
    const fechadas = new Set(a.datasFechadas ?? []);
    for (let i = 0; i <= cfg.corpo.antecedencia.diasMax; i++) {
      const d = new Date(`${hoje}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      if (iso < ABERTURA) expect(fechadas.has(iso), `${a.nome} oferece ${iso}`).toBe(true);
    }
  }

  // 2. um dia real com horário livre (procurado na própria API)
  const amb = cfg.corpo.ambientes[0];
  let escolhido: { data: string; hora: string; todas: string[] } | null = null;
  for (let i = 0; i <= cfg.corpo.antecedencia.diasMax && !escolhido; i++) {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if ((amb.datasFechadas ?? []).includes(iso)) continue;
    const disp = await json<{ horarios: { hora: string; disponivel: boolean }[] }>(`/reservas/disponibilidade?data=${iso}&pessoas=2&ambiente=${amb.id}`);
    const livre = disp.corpo.horarios.find((h) => h.disponivel);
    if (livre) escolhido = { data: iso, hora: livre.hora, todas: disp.corpo.horarios.map((h) => h.hora) };
  }
  expect(escolhido, 'nenhum horário livre na janela').not.toBeNull();
  expect(escolhido!.data >= ABERTURA).toBe(true);

  // 3. o site, com a mesma API: escolhe ambiente, data e horário; os horários na tela são os da API
  await page.goto('/reservar/');
  await page.getByRole('radio', { name: amb.nome }).click();
  const campo = page.locator('.data-campo');
  await expect(page.locator('.data-campo:visible, .cal__grade:visible').first()).toBeVisible();
  if (await campo.isVisible()) await campo.click();
  for (let i = 0; i < 3 && !(await page.locator(`.cal__dia[data-valor="${escolhido!.data}"]`).count()); i++) await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.locator(`.cal__dia[data-valor="${escolhido!.data}"]`).click();
  const horas = page.getByRole('radiogroup', { name: /horário/i }).getByRole('radio');
  await expect(horas).toHaveText(escolhido!.todas);
  await page.getByRole('radio', { name: escolhido!.hora, exact: true }).click();
  await page.getByLabel('Nome').fill('TESTE E2E — pode apagar');
  await page.getByLabel('WhatsApp ou telefone').fill(process.env.RESERVAS_TELEFONE ?? '85999990000');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar reserva' })).toBeVisible();

  // 4. só com autorização explícita e fora da produção: envia e confere a resposta real
  if (!CRIAR) return;
  test.skip(PRODUCAO, 'nunca criar reserva de teste na API de produção');
  expect(process.env.RESERVAS_TELEFONE, 'informe RESERVAS_TELEFONE (telefone de teste)').toBeTruthy();
  const resposta = page.waitForResponse((r) => r.url().startsWith(`${API}/reservas`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();
  const r = await resposta;
  expect([201, 409]).toContain(r.status());
  if (r.status() === 201) {
    const criada = await r.json();
    await expect(page.locator('.ticket__code')).toHaveText(criada.codigo);
    expect(criada.data).toBe(escolhido!.data);
  } else {
    await expect(page.getByRole('alert')).toBeVisible();
  }
});
