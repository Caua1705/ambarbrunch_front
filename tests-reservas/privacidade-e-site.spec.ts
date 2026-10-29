// No build de produção com as reservas ligadas (modo API): a política mostra os tratamentos reais sem se dizer aprovada,
// o consentimento da comanda é obrigatório e leva a ela, e o Clube continua fora da home.
import { test, expect } from '@playwright/test';
import { apiFalsa, relogio, ABERTURA } from './api-falsa';

test('política aprovada (2026-11-v1): tratamentos reais, sem aviso provisório nem "não coleta dados"', async ({ page }) => {
  await page.goto('/privacidade/');
  const doc = page.locator('main');
  await expect(doc.getByRole('note')).toHaveCount(0);
  // decisões do controlador (29/10/2026): canal = WhatsApp oficial; sem exclusão automática nem prazo inventado
  await expect(doc).toContainText('Canal de privacidade: o WhatsApp oficial do Âmbar, (85) 95855-0369');
  await expect(doc).toContainText('O sistema não apaga nem anonimiza dados automaticamente, e não há um prazo fixo de exclusão.');
  await expect(doc).toContainText('Você pode pedir a eliminação dos seus dados pelo canal de privacidade.');
  for (const fato of ['nome e telefone (WhatsApp)', 'WhatsApp oficial do Âmbar', 'grupo interno de WhatsApp', 'Alterações e cancelamentos de reservas não geram aviso no grupo', 'CNPJ 58.527.734/0001-03', 'Versão 2026-11-v1', 'Supabase', 'WhatsApp Business Platform (Meta)', 'Z-API', 'Vercel']) {
    await expect(doc, fato).toContainText(fato);
  }
  const texto = (await doc.innerText()).toLowerCase();
  // regras de 29/10/2026 no backend: cancelamento (f41d12f) e alteração (3c36019, 075bb84) não vão ao grupo da equipe
  for (const falso of ['não coleta dados pessoais', 'não envia formulários', 'aprovad', 'a confirmar', 'validar:', 'alterada ou cancelada', 'mudança de data', 'validação jurídica', 'parecer', 'aguardando a aprovação']) expect(texto, falso).not.toContain(falso);
});

test('consentimento: obrigatório para continuar e com link para a política', async ({ page }) => {
  await relogio(page);
  await apiFalsa(page);
  await page.goto('/reservar/');
  const campo = page.locator('.data-campo');
  await expect(page.locator('.data-campo:visible, .cal__grade:visible').first()).toBeVisible();
  if (await campo.isVisible()) await campo.click();
  // a grade-esqueleto aparece antes da configuração: só conta os dias depois que os de verdade existem
  await expect(page.locator('.cal__dia[data-valor]').first()).toBeVisible();
  for (let i = 0; i < 2 && !(await page.locator(`.cal__dia[data-valor="${ABERTURA}"]`).count()); i++) await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.locator(`.cal__dia[data-valor="${ABERTURA}"]`).click();
  await page.getByRole('radio', { name: '09:00', exact: true }).click();
  await page.getByLabel('Nome').fill('Maria Teste');
  await page.getByLabel('WhatsApp ou telefone').fill('85987654321');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Para reservar, é preciso concordar com o uso dos dados.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar reserva' })).toHaveCount(0);
  const link = page.locator('form.ticket').getByRole('link', { name: 'política de privacidade' });
  await expect(link).toHaveAttribute('href', '/privacidade/');
});

test('Clube continua fora da home e do menu no build de produção', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#clube, .clube-convite')).toHaveCount(0);
  await expect(page.locator('#menu .sheet__nav a', { hasText: 'Clube' })).toHaveCount(0);
  await expect(page.locator('main a[href^="/clube"]')).toHaveCount(0);
});
