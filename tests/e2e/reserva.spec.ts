// Comanda de reserva.
//  - :4321 (build de revisão): modo “indisponível” — não pode parecer funcional nem enviar nada.
//  - :4322 (build de testes): modo “simulado” do contrato proposto — sempre com aviso visível de simulação.
import { test, expect, type Page } from '@playwright/test';

const SIM = 'http://127.0.0.1:4322/';
const irParaComanda = async (page: Page, url = '/') => {
  await page.goto(url);
  await page.locator('#reservar').evaluate((el) => el.scrollIntoView());
  await page.locator('#reservar .data-campo').waitFor();
  // a ilha precisa estar hidratada (antes disso o campo é só HTML)
  await page.locator('#reservar astro-island:not([ssr])').waitFor({ state: 'attached' });
};
// celular (2026-10-22): o calendário começa fechado no campo “Escolher uma data”; um toque num dia escolhe e fecha
const abrirCalendario = async (page: Page) => {
  const campo = page.locator('#reservar .data-campo');
  if ((await campo.getAttribute('aria-expanded')) !== 'true') await campo.click();
  await page.locator('.cal__dia[role="radio"]:not([disabled])').first().waitFor();
};

test.describe('modo indisponível (padrão)', () => {
  test('deixa claro que a reserva online não está ativa e não envia nada', async ({ page }) => {
    const externos: string[] = [];
    // blob:/data: são do próprio navegador (o WebKit cria blob: para as faixas de legenda), não saem do site
    page.on('request', (r) => { const u = new URL(r.url()); if (['blob:', 'data:'].includes(u.protocol)) return; if (!['127.0.0.1', 'localhost'].includes(u.hostname)) externos.push(r.url()); });
    await irParaComanda(page);
    const botao = page.locator('.ticket .btn');
    await expect(botao).toBeDisabled();
    await expect(botao).toHaveText('Reservas online em breve');
    await expect(page.locator('#ticket-note')).toContainText('ainda não estão ativas');
    await expect(page.locator('.ticket__stamp')).toHaveText('em breve');
    await expect(page.locator('.ticket__sim')).toHaveCount(0);
    await expect(page.locator('#reservar .ticket')).not.toContainText('05 · seus dados');
    // nenhum horário inventado
    await expect(page.locator('#reservar .ticket')).toContainText('Os horários aparecem aqui quando as reservas pelo site forem ativadas.');
    expect(externos, 'requisições para fora do site').toEqual([]);
  });

  test('ambiente, pessoas e data respondem a toque e teclado', async ({ page }) => {
    await irParaComanda(page);
    const amb = page.locator('[role="radiogroup"][aria-labelledby="rf-l1"]');
    await amb.locator('[role="radio"]', { hasText: 'Lounge' }).click();
    await expect(amb.locator('[aria-checked="true"]')).toHaveText('Lounge');
    await amb.locator('[aria-checked="true"]').press('ArrowLeft');
    await expect(amb.locator('[aria-checked="true"]')).toHaveText('Salão principal');
    await page.getByRole('button', { name: 'Mais uma pessoa' }).click();
    await expect(page.locator('.stepper output')).toHaveText('3');
    // campo de data: fechado, sem data escolhida; abre dentro da comanda
    const campo = page.locator('#reservar .data-campo');
    await expect(campo).toHaveText(/Escolher uma data/);
    await expect(campo).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#rf-cal')).toBeHidden();
    await abrirCalendario(page);
    await expect(campo).toHaveAttribute('aria-expanded', 'true');
    // calendário mensal: qualquer dia válido do mês; dias passados desabilitados; setas trocam o mês (janela de 60 dias)
    const dias = page.locator('[aria-labelledby="rf-l3"] [role="radio"]');
    const validos = page.locator('[aria-labelledby="rf-l3"] [role="radio"]:not([disabled])');
    await expect(page.locator('[aria-labelledby="rf-l3"] [aria-checked="true"]')).toHaveCount(0);
    expect(await dias.count()).toBeGreaterThanOrEqual(28);
    await validos.last().click();
    // o toque escolhe e fecha: o campo mostra a data e volta a ter o foco
    await expect(page.locator('#rf-cal')).toBeHidden();
    await expect(campo).not.toHaveText(/Escolher uma data/);
    await expect(campo).toBeFocused();
    await abrirCalendario(page);
    await expect(validos.last()).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(validos.first()).toHaveText('1');
    await validos.nth(14).click();
    await abrirCalendario(page);
    await expect(validos.nth(14)).toHaveAttribute('aria-checked', 'true');
    // teclado: → anda um dia, sem fechar o calendário; Esc fecha
    await validos.nth(14).press('ArrowRight');
    await expect(validos.nth(15)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#rf-cal')).toBeVisible();
    await validos.nth(15).press('Escape');
    await expect(page.locator('#rf-cal')).toBeHidden();
    await expect(campo).toBeFocused();
  });

  test('rota /reservar mostra a mesma comanda', async ({ page }) => {
    await irParaComanda(page, '/reservar/');
    await expect(page.locator('h1#reserva-titulo')).toBeVisible();
    await expect(page.locator('.ticket .btn')).toBeDisabled();
  });
});

test.describe('modo simulado (só testes)', () => {
  test('fluxo completo: horário → dados → revisão → confirmação, sempre marcado como simulação', async ({ page }) => {
    await irParaComanda(page, SIM);
    await expect(page.locator('.ticket__sim')).toBeVisible();
    await expect(page.locator('.ticket__stamp')).toHaveText('simulação');
    // escolhe uma data que não seja segunda (a simulação não tem horários às segundas)
    // sem data, nenhum horário é buscado
    await expect(page.locator('#reservar .ticket')).toContainText('Escolha uma data para ver os horários.');
    const datas = page.locator('[aria-labelledby="rf-l3"] [role="radio"]:not([disabled])');
    for (let i = 0; i < 3; i++) {
      await abrirCalendario(page);
      await datas.nth(i).click();
      await page.locator('.ticket__slots:has-text("Carregando")').waitFor({ state: 'detached' });
      if (await page.locator('[aria-labelledby="rf-l4"] [role="radio"]:not([disabled])').count()) break;
    }
    await page.locator('[aria-labelledby="rf-l4"] [role="radio"]:not([disabled])').first().click();
    await expect(page.locator('legend', { hasText: '05 · seus dados' })).toBeVisible();
    // validação
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('#rf-nome-erro')).toHaveText(/Diga como podemos chamar você/);
    await expect(page.locator('#rf-nome')).toBeFocused();
    await page.locator('#rf-nome').fill('Cliente de Teste');
    await page.locator('#rf-telefone').fill('85999990000');
    await expect(page.locator('#rf-telefone')).toHaveValue('(85) 99999-0000');
    await page.locator('#rf-consentimento').click();
    await expect(page.locator('#rf-consentimento')).toBeChecked();
    await page.getByRole('button', { name: 'Continuar' }).click();
    // revisão
    await expect(page.locator('#reservar .ticket__title')).toHaveText('Confira sua reserva');
    await expect(page.locator('.ticket__review')).toContainText('Cliente de Teste');
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    // confirmação (simulada)
    await expect(page.locator('#reservar .ticket__title')).toHaveText('Reserva simulada');
    await expect(page.locator('.ticket__stamp')).toHaveText('simulado');
    await expect(page.locator('.ticket__code')).toHaveText(/^SIM-/);
    await expect(page.locator('.ticket__sim')).toBeVisible();
  });

  test('telefone: celular sem o nono dígito ou com dígito a mais é recusado com a explicação — nada é completado nem cortado', async ({ page }) => {
    await irParaComanda(page, SIM);
    await escolherHorario(page);
    await page.locator('#rf-nome').fill('Cliente de Teste');
    await page.locator('#rf-consentimento').click();
    const tel = page.locator('#rf-telefone');
    for (const [digitado, mostrado, erro] of [
      ['8599990000', '(85) 9999-0000', /Celular tem 9 dígitos depois do DDD/],
      ['859999900001', '(85) 99999-00001', /dígitos a mais/],
      ['10999990000', '(10) 99999-0000', /DDD 10 não existe/],
    ] as const) {
      await tel.fill(digitado);
      await expect(tel).toHaveValue(mostrado);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.locator('#rf-telefone-erro')).toHaveText(erro);
      await expect(tel).toHaveValue(mostrado);
    }
    // fixo com DDD continua valendo na reserva
    await tel.fill('8532345678');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('#reservar .ticket__title')).toHaveText('Confira sua reserva');
  });

  test('falha de envio: mensagem, carimbo de erro e nova tentativa', async ({ page }) => {
    await irParaComanda(page, SIM);
    await escolherHorario(page);
    await page.locator('#rf-nome').fill('erro proposital');
    await page.locator('#rf-telefone').fill('85999990000');
    await page.locator('#rf-consentimento').click();
    await expect(page.locator('#rf-consentimento')).toBeChecked();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.locator('.ticket__status[data-tone="error"]')).toContainText('Não foi possível concluir');
    await expect(page.locator('.ticket__stamp')).toHaveText('tente de novo');
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled();
  });

  test('horário tomado no envio: volta à escolha com aviso e recarrega os horários', async ({ page }) => {
    await irParaComanda(page, SIM);
    await escolherHorario(page);
    await page.locator('#rf-nome').fill('ocupado');
    await page.locator('#rf-telefone').fill('85999990000');
    await page.locator('#rf-consentimento').click();
    await expect(page.locator('#rf-consentimento')).toBeChecked();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page.locator('.ticket__status[data-tone="error"]')).toContainText('acabou de ser reservado');
    await expect(page.locator('[aria-labelledby="rf-l4"] [aria-checked="true"]')).toHaveCount(0);
  });
});

async function escolherHorario(page: Page) {
  const datas = page.locator('[aria-labelledby="rf-l3"] [role="radio"]:not([disabled])');
  for (let i = 0; i < 3; i++) {
    await abrirCalendario(page);
    await datas.nth(i).click();
    await page.locator('.ticket__slots:has-text("Carregando")').waitFor({ state: 'detached' });
    if (await page.locator('[aria-labelledby="rf-l4"] [role="radio"]:not([disabled])').count()) break;
  }
  await page.locator('[aria-labelledby="rf-l4"] [role="radio"]:not([disabled])').first().click();
}
