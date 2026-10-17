// Comanda de reserva.
//  - :4321 (build de revisão): modo “indisponível” — não pode parecer funcional nem enviar nada.
//  - :4322 (build de testes): modo “simulado” do contrato proposto — sempre com aviso visível de simulação.
import { test, expect, type Page } from '@playwright/test';

const SIM = 'http://127.0.0.1:4322/';
const irParaComanda = async (page: Page, url = '/') => {
  await page.goto(url);
  await page.locator('#reservar').evaluate((el) => el.scrollIntoView());
  await page.locator('.chips--dates .chip[role="radio"]').first().waitFor();
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
    const datas = page.locator('[aria-labelledby="rf-l3"] [role="radio"]');
    await expect(datas).toHaveCount(10);
    await datas.nth(2).click();
    await expect(datas.nth(2)).toHaveAttribute('aria-checked', 'true');
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
    const datas = page.locator('[aria-labelledby="rf-l3"] [role="radio"]');
    for (let i = 0; i < 3; i++) {
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
  const datas = page.locator('[aria-labelledby="rf-l3"] [role="radio"]');
  for (let i = 0; i < 3; i++) {
    await datas.nth(i).click();
    await page.locator('.ticket__slots:has-text("Carregando")').waitFor({ state: 'detached' });
    if (await page.locator('[aria-labelledby="rf-l4"] [role="radio"]:not([disabled])').count()) break;
  }
  await page.locator('[aria-labelledby="rf-l4"] [role="radio"]:not([disabled])').first().click();
}
