// No build de produção com as reservas ligadas (modo API): a política mostra os tratamentos reais sem se dizer aprovada,
// o consentimento da comanda é obrigatório e leva a ela, e o Clube continua fora da home.
import { test, expect } from '@playwright/test';
import { apiFalsa, relogio, ABERTURA } from './api-falsa';

test('política: tratamentos reais com o aviso de validação; nada de "não coleta dados" nem de "aprovada"', async ({ page }) => {
  await page.goto('/privacidade/');
  const doc = page.locator('main');
  await expect(doc).toContainText('Texto em validação jurídica');
  for (const fato of ['nome e telefone (WhatsApp)', 'WhatsApp oficial do Âmbar', 'grupo interno de WhatsApp', 'Supabase', 'WhatsApp Business Platform (Meta)', 'Z-API', 'Vercel']) {
    await expect(doc, fato).toContainText(fato);
  }
  const texto = (await doc.innerText()).toLowerCase();
  for (const falso of ['não coleta dados pessoais', 'não envia formulários', 'aprovad', 'a confirmar']) expect(texto, falso).not.toContain(falso);
});

test('consentimento: obrigatório para continuar e com link para a política', async ({ page }) => {
  await relogio(page);
  await apiFalsa(page);
  await page.goto('/reservar/');
  const campo = page.locator('.data-campo');
  await expect(page.locator('.data-campo:visible, .cal__grade:visible').first()).toBeVisible();
  if (await campo.isVisible()) await campo.click();
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
