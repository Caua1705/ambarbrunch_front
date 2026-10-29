// Reserva pública em modo API (como em produção), contra a API falsa no formato real do backend.
// "Hoje" = 28/10/2026 em Fortaleza; abertura = 09/11/2026 (dias anteriores chegam em datasFechadas, como no backend, e o
// site também os bloqueia sozinho).
import { test, expect, type Page } from '@playwright/test';
import { apiFalsa, relogio, API, ABERTURA, DIA_EVENTO, DIA_LOTADO, DIA_PARCIAL, type Cenario } from './api-falsa';

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

test.describe('datas: primeira data 09/11, janela de 60 dias e dias fechados', () => {
  test('o calendário abre em novembro: 08/11 e antes bloqueados; 09/11 é a primeira data e mostra os horários da API', async ({ page }) => {
    const reg = await abrir(page);
    await abrirCalendario(page);
    // abre direto no mês da primeira data; outubro (hoje = 28/10) nem é alcançável
    await expect(page.locator('.cal__mes')).toHaveText(/novembro/i);
    await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
    for (const d of ['2026-11-01', '2026-11-03', '2026-11-06', '2026-11-07', '2026-11-08']) await expect(dia(page, d), d).toBeDisabled();
    await expect(dia(page, ABERTURA)).toBeEnabled();
    await expect(dia(page, '2026-11-10')).toBeEnabled();
    // o único dia focável pelo Tab é 09/11
    await expect(page.locator('.cal__dia[tabindex="0"]')).toHaveAttribute('data-valor', ABERTURA);
    await dia(page, ABERTURA).click();
    const horas = page.getByRole('radiogroup', { name: /horário/i }).getByRole('radio');
    await expect(horas).toHaveCount(19);
    await expect(horas.first()).toHaveText('07:00');
    await expect(horas.last()).toHaveText('16:00');
    // nenhum pedido de horários para datas antes da abertura
    expect(reg.disponibilidades.every((q) => q.data >= ABERTURA)).toBe(true);
  });

  test('API mal configurada (abertura em 03/11): o site continua sem oferecer 03–08/11 nem pedir horários deles', async ({ page }) => {
    const reg = await abrir(page, { aberturaApi: '2026-11-03' });
    await abrirCalendario(page);
    for (const d of ['2026-11-03', '2026-11-05', '2026-11-08']) await expect(dia(page, d), d).toBeDisabled();
    await expect(dia(page, ABERTURA)).toBeEnabled();
    // clique forçado num dia desabilitado (como quem mexe no DOM) não escolhe nada
    await dia(page, '2026-11-08').evaluate((b) => { (b as HTMLButtonElement).disabled = false; (b as HTMLButtonElement).click(); });
    await expect(page.getByText('Escolha uma data para ver os horários.')).toBeVisible();
    expect(reg.disponibilidades).toHaveLength(0);
  });

  test('teclado: das setas a partir de 09/11 não se chega a 08/11 nem a 02/11', async ({ page }) => {
    const reg = await abrir(page, { aberturaApi: '2026-11-03' });
    await abrirCalendario(page);
    await dia(page, ABERTURA).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.cal__dia[aria-checked="true"]')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(dia(page, '2026-11-10')).toHaveAttribute('aria-checked', 'true');
    // o foco anda para o dia escolhido no quadro seguinte
    await expect(dia(page, '2026-11-10')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(dia(page, ABERTURA)).toHaveAttribute('aria-checked', 'true');
    await expect(dia(page, ABERTURA)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(dia(page, ABERTURA)).toHaveAttribute('aria-checked', 'true');
    expect(reg.disponibilidades.every((q) => q.data >= ABERTURA)).toBe(true);
  });

  test('data recusada por ser antes da abertura (422 antes_da_abertura): mensagem do backend no topo, nada confirmado', async ({ page }) => {
    await abrir(page, { envio: 'abertura' });
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('alert')).toContainText('Reservas a partir de 09/11/2026.');
    await expect(page.getByText('Mesa reservada')).toHaveCount(0);
  });

  test('10/11 com ocupação parcial (alguns horários esgotados) e 14/11 fechado por evento', async ({ page }) => {
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

  test('sem conexão no envio: avisa e nada é confirmado; com a conexão de volta, a mesma reserva segue', async ({ page }) => {
    const reg = await abrir(page);
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.route(`${API}/reservas`, (r) => (r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.fallback()));
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('alert')).toContainText('Sem conexão');
    await expect(page.getByText('Mesa reservada')).toHaveCount(0);
    await page.unroute(`${API}/reservas`);
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText('Mesa reservada')).toBeVisible();
    expect(reg.envios).toHaveLength(1);
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
    // o aviso fica à vista: o foco volta ao topo da comanda
    await expect(page.locator('.ticket__title')).toBeFocused();
  });

  test('reserva pendente (ambiente com aprovação): "pedido recebido", nunca "mesa reservada" nem "garantida"', async ({ page }) => {
    await abrir(page, { envio: 'pendente' });
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.locator('.ticket__title')).toHaveText('Pedido recebido');
    await expect(comanda(page)).toContainText('A reserva só vale depois de aprovada pela equipe do Âmbar.');
    const texto = (await comanda(page).innerText()).toLowerCase();
    for (const falso of ['mesa reservada', 'garantida', 'whatsapp']) expect(texto, falso).not.toContain(falso);
  });

  test('confirmação não promete WhatsApp; .ics no horário de Fortaleza (UTC); nova reserva pede o aceite de novo', async ({ page }) => {
    await abrir(page);
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByText('Mesa reservada')).toBeVisible();
    expect((await comanda(page).innerText()).toLowerCase()).not.toContain('whatsapp');
    const ics = decodeURIComponent((await page.getByRole('link', { name: 'Adicionar à agenda' }).getAttribute('href'))!);
    expect(ics).toContain('DTSTART:20261109T120000Z');  // 09:00 em Fortaleza (UTC−3)
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    await page.getByRole('button', { name: 'Fazer outra reserva' }).click();
    await escolherData(page, ABERTURA);
    await page.getByRole('radio', { name: '10:00', exact: true }).click();
    await expect(page.getByLabel('Nome')).toHaveValue('Maria Teste');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
  });

  test('429: mostra a mensagem do backend (alguns minutos) e nada é confirmado', async ({ page }) => {
    await abrir(page, { envio: 'limite' });
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('alert')).toContainText('Muitas tentativas. Tente de novo em alguns minutos.');
    await expect(page.getByText('Mesa reservada')).toHaveCount(0);
  });

  test('e-mail e aceite recusados pelo backend: mensagem em português no campo certo, dados mantidos', async ({ page }) => {
    const c: Cenario = { envio: 'email' };
    await abrir(page, c);
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.locator(`#rf-email-erro`)).toHaveText('Confira o e-mail.');
    await expect(page.getByLabel('Nome')).toHaveValue('Maria Teste');
    c.envio = 'consentimento';
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.locator('#rf-consentimento-erro')).toContainText('É preciso aceitar a política de privacidade');
  });

  test('sem conexão e "Editar" sem mudar nada: a nova confirmação usa a mesma chave (não duplica)', async ({ page }) => {
    const reg = await abrir(page);
    await escolherData(page, ABERTURA);
    await preencherEConfirmar(page);
    let primeiraChave = '';
    await page.route(`${API}/reservas`, (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      primeiraChave = r.request().headers()['idempotency-key'] ?? '';
      return r.abort('internetdisconnected');
    });
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('alert')).toContainText('A reserva pode já ter sido registrada');
    await page.unroute(`${API}/reservas`);
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByText('Mesa reservada')).toBeVisible();
    // o primeiro pedido foi cortado; o segundo, depois de "Editar" sem mudanças, leva a mesma chave
    expect(primeiraChave.length).toBeGreaterThanOrEqual(8);
    expect(reg.envios.map((e) => e.chave)).toEqual([primeiraChave]);
  });
});

test('navegador sem AbortSignal.any/timeout (iOS < 17.4): horários carregam e a reserva é enviada', async ({ page }) => {
  await page.addInitScript(() => {
    const s = AbortSignal as unknown as Record<string, unknown>;
    delete s.any;
    delete s.timeout;
  });
  await abrir(page);
  await escolherData(page, ABERTURA);
  await expect(page.getByRole('radio', { name: '09:00', exact: true })).toBeVisible();
  await preencherEConfirmar(page);
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();
  await expect(page.getByText('Mesa reservada')).toBeVisible();
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
  test('em outro fuso (Tóquio já em 29/10), a janela conta de 28/10 de Fortaleza: 27/12 é o último dia', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T23:30:00-03:00'));
    await apiFalsa(page);
    await page.goto('/reservar/');
    await abrirCalendario(page);
    await expect(dia(page, ABERTURA)).toBeEnabled();
    await irParaMes(page, '2026-12-27');
    await expect(dia(page, '2026-12-27')).toBeEnabled();
    await expect(dia(page, '2026-12-28')).toBeDisabled();
  });
});

test.describe('fuso de Fortaleza a oeste', () => {
  test.use({ timezoneId: 'America/Manaus' });
  test('Fortaleza já em 09/11 de madrugada com o navegador ainda em 08/11 (Manaus): 09/11 é hoje e reservável', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-09T00:30:00-03:00'));
    await apiFalsa(page, { hoje: '2026-11-09' });
    await page.goto('/reservar/');
    await abrirCalendario(page);
    await expect(page.locator('.cal__dia[data-hoje]')).toHaveAttribute('data-valor', ABERTURA);
    await expect(dia(page, ABERTURA)).toBeEnabled();
    await expect(dia(page, '2026-11-08')).toBeDisabled();
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

for (const largura of [360, 375, 390, 430]) {
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

test('acessibilidade (axe): comanda com campos, erros de validação e confirmação', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const checar = async (onde: string) => {
    const { violations } = await new AxeBuilder({ page }).include('form.ticket').analyze();
    const serias = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serias.map((v) => `${onde} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
  };
  await abrir(page);
  await escolherData(page, ABERTURA);
  await page.getByRole('radio', { name: '09:00', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('#rf-nome-erro')).not.toBeEmpty();
  await checar('erros');
  await preencherEConfirmar(page);
  await checar('revisão');
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();
  await expect(page.getByText('Mesa reservada')).toBeVisible();
  await checar('confirmação');
});
