// Reserva pública em modo API (como em produção), contra a API falsa no formato real do backend.
// "Hoje" = 28/10/2026 em Fortaleza; abertura = 06/11/2026 (dias anteriores chegam em datasFechadas, como no backend).
import { test, expect, type Page } from '@playwright/test';
import { apiFalsa, relogio, ABERTURA, DIA_EVENTO, DIA_LOTADO, DIA_PARCIAL, type Cenario } from './api-falsa';

const comanda = (page: Page) => page.locator('form.ticket');
const dia = (page: Page, iso: string) => page.locator(`.cal__dia[data-valor="${iso}"]`);

async function abrir(page: Page, c: Cenario = {}, url = '/reservar/') {
  await relogio(page);
  const reg = await apiFalsa(page, c);
  await page.goto(url);
  await comanda(page).scrollIntoViewIfNeeded();
  return reg;
}

/** No celular o calendário abre num campo; no desktop (≥ 960 px) fica sempre aberto. */
async function abrirCalendario(page: Page) {
  // espera a comanda com a configuração da API (o campo de data no celular ou a grade no desktop)
  await expect(page.locator('.data-campo:visible, .cal__grade:visible').first()).toBeVisible();
  const campo = page.locator('.data-campo');
  if ((await campo.isVisible()) && (await campo.getAttribute('aria-expanded')) !== 'true') await campo.click();
  await expect(page.locator('.cal__dia[data-valor]').first()).toBeVisible();
}

async function irParaMes(page: Page, iso: string) {
  for (let i = 0; i < 4 && !(await dia(page, iso).count()); i++) await page.getByRole('button', { name: 'Próximo mês' }).click();
}

async function escolherData(page: Page, iso: string) {
  await abrirCalendario(page);
  await irParaMes(page, iso);
  await dia(page, iso).click();
}

async function preencherEConfirmar(page: Page, hora = '09:00') {
  await page.getByRole('radio', { name: hora, exact: true }).click();
  await page.getByLabel('Nome').fill('Maria Teste');
  await page.getByLabel('WhatsApp ou telefone').fill('85987654321');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar reserva' })).toBeVisible();
}

test.describe('datas: abertura em 06/11, janela de 60 dias e dias fechados (tudo vindo da API)', () => {
  test('05/11 e antes ficam bloqueados; 06/11 é a primeira data e mostra os horários da API', async ({ page }) => {
    const reg = await abrir(page);
    await abrirCalendario(page);
    for (const d of ['2026-10-28', '2026-10-29', '2026-10-31']) await expect(dia(page, d)).toBeDisabled();
    await irParaMes(page, ABERTURA);
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']) await expect(dia(page, d), d).toBeDisabled();
    await expect(dia(page, ABERTURA)).toBeEnabled();
    await dia(page, ABERTURA).click();
    const horas = page.getByRole('radiogroup', { name: /horário/i }).getByRole('radio');
    await expect(horas).toHaveCount(19);
    await expect(horas.first()).toHaveText('07:00');
    await expect(horas.last()).toHaveText('16:00');
    // nenhum pedido de horários para datas antes da abertura
    expect(reg.disponibilidades.every((q) => q.data >= ABERTURA)).toBe(true);
  });

  test('07/11 com ocupação parcial (alguns horários esgotados) e 10/11 fechado por evento', async ({ page }) => {
    await abrir(page);
    await abrirCalendario(page);
    await irParaMes(page, DIA_PARCIAL);
    await expect(dia(page, DIA_EVENTO)).toBeDisabled();
    await dia(page, DIA_PARCIAL).click();
    const horas = page.getByRole('radiogroup', { name: /horário/i }).getByRole('radio');
    await expect(horas).toHaveCount(19);
    const desligados = await horas.evaluateAll((bs) => bs.filter((b) => (b as HTMLButtonElement).disabled).length);
    expect(desligados).toBeGreaterThan(0);
    expect(desligados).toBeLessThan(19);
  });

  test('limite de 60 dias: 27/12 é o último dia; 28/12 e o mês seguinte ficam fora', async ({ page }) => {
    await abrir(page);
    await abrirCalendario(page);
    await irParaMes(page, '2026-12-27');
    await expect(dia(page, '2026-12-27')).toBeEnabled();
    await expect(dia(page, '2026-12-28')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
  });

  test('ambiente lotado: sem horários no Jardim em 12/11; no Salão, no mesmo dia, há horários', async ({ page }) => {
    await abrir(page);
    await page.getByRole('radio', { name: 'Jardim externo' }).click();
    await escolherData(page, DIA_LOTADO);
    await expect(page.getByText('Sem horários nesta data. Escolha outro dia.')).toBeVisible();
    await page.getByRole('radio', { name: 'Salão principal' }).click();
    await expect(page.getByRole('radiogroup', { name: /horário/i }).getByRole('radio').first()).toBeEnabled();
  });

  test('máximo por reserva = lotação do ambiente (Lounge 15); acima disso, atendimento pela equipe', async ({ page }) => {
    await abrir(page);
    await page.getByRole('radio', { name: 'Lounge' }).click();
    const mais = page.getByRole('button', { name: /Mais uma pessoa|Mais de 15 pessoas/ });
    for (let i = 0; i < 13; i++) await mais.click();
    await expect(page.locator('.stepper output')).toHaveText('15');
    await page.getByRole('button', { name: 'Mais de 15 pessoas' }).click();
    await expect(page.locator('.stepper output')).toHaveText('+15');
    await expect(page.getByText(/Reservas online em Lounge vão até 15 pessoas/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Falar com a equipe no WhatsApp' })).toBeVisible();
  });
});

test.describe('envio: confirmação, clique duplo, erro e horário esgotado', () => {
  test('confirmação válida envia exatamente o que foi escolhido, com chave de idempotência', async ({ page }) => {
    const reg = await abrir(page);
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByText('Mesa reservada')).toBeVisible();
    await expect(page.locator('.ticket__code')).toHaveText('AMB-7Q2K');
    expect(reg.envios).toHaveLength(1);
    expect(reg.envios[0].corpo).toMatchObject({ ambienteId: 'jardim', pessoas: 2, data: ABERTURA, hora: '09:00', nome: 'Maria Teste', telefone: '85987654321', consentimentoPrivacidade: true, origem: 'site' });
    expect(reg.envios[0].chave?.length).toBeGreaterThanOrEqual(8);
  });

  test('clique duplo em "Confirmar reserva" envia um pedido só', async ({ page }) => {
    const reg = await abrir(page, { atrasoEnvio: 1200 });
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).dblclick();
    await expect(page.getByText('Mesa reservada')).toBeVisible();
    expect(reg.envios).toHaveLength(1);
  });

  test('erro da API: nada é confirmado e a pessoa pode tentar de novo com os mesmos dados', async ({ page }) => {
    const c: Cenario = { envio: 'erro' };
    const reg = await abrir(page, c);
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('alert')).toContainText('Não foi possível concluir');
    await expect(page.getByText('Mesa reservada')).toHaveCount(0);
    c.envio = 'ok';
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText('Mesa reservada')).toBeVisible();
    // a nova tentativa reaproveita a mesma chave: o servidor não duplica se o primeiro pedido tiver chegado
    expect(reg.envios[1].chave).toBe(reg.envios[0].chave);
  });

  test('horário esgotado durante a confirmação: volta à escolha, avisa e recarrega os horários', async ({ page }) => {
    const reg = await abrir(page, { envio: 'esgotado' });
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    const pedidosAntes = reg.disponibilidades.length;
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('alert')).toContainText('Este horário acabou de esgotar');
    await expect.poll(() => reg.disponibilidades.length).toBeGreaterThan(pedidosAntes);
    await expect(page.getByRole('radiogroup', { name: /horário/i }).getByRole('radio', { checked: true })).toHaveCount(0);
  });

  test('data recusada pelo servidor (prazo/abertura): mostra a mensagem do backend e recarrega os horários', async ({ page }) => {
    const reg = await abrir(page, { envio: 'prazo' });
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    const pedidosAntes = reg.disponibilidades.length;
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('alert')).toContainText('fora do prazo de reserva online');
    await expect.poll(() => reg.disponibilidades.length).toBeGreaterThan(pedidosAntes);
  });
});

test.describe('API fechada ou fora do ar: nada de horários por conta própria', () => {
  test('reservas fechadas (503): estado discreto, sem calendário nem horários; reabertas, a página funciona sem novo build', async ({ page }) => {
    const c: Cenario = { fechada: true };
    const reg = await abrir(page, c);
    await expect(comanda(page)).toContainText('As reservas pelo site não estão abertas no momento.');
    await expect(page.locator('.cal__dia')).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: /horário/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);
    await expect(comanda(page).getByRole('link', { name: 'Falar com a equipe no WhatsApp' })).toHaveAttribute('href', /wa\.me/);
    expect(reg.disponibilidades).toHaveLength(0);
    // o backend abre as reservas: ao voltar para a aba, a comanda confere de novo e libera
    c.fechada = false;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await abrirCalendario(page);
    await irParaMes(page, ABERTURA);
    await expect(dia(page, ABERTURA)).toBeEnabled();
  });

  test('erro ao carregar a configuração: aviso com "Tentar de novo", sem janela de datas inventada', async ({ page }) => {
    const c: Cenario = { configFalha: true };
    await abrir(page, c);
    await expect(comanda(page).getByRole('alert')).toContainText('Não foi possível carregar as reservas agora.');
    await expect(page.locator('.cal__dia')).toHaveCount(0);
    c.configFalha = false;
    await comanda(page).getByRole('button', { name: 'Tentar de novo' }).click();
    await abrirCalendario(page);
    await irParaMes(page, ABERTURA);
    await expect(dia(page, ABERTURA)).toBeEnabled();
  });

  test('reservas fechadas no meio do envio: nada é confirmado e a comanda mostra o estado fechado', async ({ page }) => {
    await abrir(page, { envio: 'fechada' });
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(comanda(page)).toContainText('As reservas pelo site não estão abertas no momento.');
    await expect(page.getByText('Mesa reservada')).toHaveCount(0);
  });
});

test.describe('fuso de Fortaleza', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });
  test('em outro fuso (Tóquio já em 29/10), "hoje" do calendário é 28/10 de Fortaleza', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T23:30:00-03:00'));
    await apiFalsa(page);
    await page.goto('/reservar/');
    await abrirCalendario(page);
    await expect(page.locator('.cal__dia[data-hoje]')).toHaveAttribute('data-valor', '2026-10-28');
  });
});

test('da home: o botão de reservar leva à comanda já com os ambientes da API', async ({ page }) => {
  await relogio(page);
  await apiFalsa(page);
  await page.goto('/');
  await page.locator('.hero').getByRole('link', { name: 'Reservar mesa' }).click();
  await expect(page.locator('#reservar')).toBeInViewport();
  await expect(comanda(page).getByRole('radio', { name: 'Salão principal' })).toBeVisible();
  await abrirCalendario(page);
  await irParaMes(page, ABERTURA);
  await expect(dia(page, ABERTURA)).toBeEnabled();
});

for (const largura of [375, 390, 430]) {
  test(`celular ${largura}px: comanda inteira sem rolagem horizontal, calendário e horários abertos`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'larguras de celular');
    await page.setViewportSize({ width: largura, height: 844 });
    await abrir(page);
    await escolherData(page, ABERTURA);
    await expect(page.getByRole('radiogroup', { name: /horário/i }).getByRole('radio').first()).toBeVisible();
    await page.getByRole('radio', { name: '09:00', exact: true }).click();
    await expect(page.getByLabel('Nome')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}
