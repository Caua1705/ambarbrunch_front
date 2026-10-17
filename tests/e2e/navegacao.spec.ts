// Menu, doca e CTA fixo (regras de NAVEGACAO-E-CTA.md §2).
import { test, expect, type Page } from '@playwright/test';

const visivel = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.classList.contains('is-visible') && el.getAttribute('aria-hidden') === 'false');
const rolarAte = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.scrollIntoView({ block: 'start' }));

test('CTA fixo e menu da doca: ocultos no topo, visíveis ao rolar, ambos ocultos na reserva', async ({ page }) => {
  await page.goto('/');
  expect(await visivel(page, '[data-sticky-cta]')).toBe(false);
  expect(await visivel(page, '.menu-btn--dock')).toBe(false);
  await rolarAte(page, '#gastronomia');
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(true);
  await expect.poll(() => visivel(page, '.menu-btn--dock')).toBe(true);
  await rolarAte(page, '#reservar');
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(false);
  await expect.poll(() => visivel(page, '.menu-btn--dock')).toBe(false);
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(false);
  await expect.poll(() => visivel(page, '.menu-btn--dock')).toBe(false);
});

test('CTA oculto não recebe toque nem foco', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('[data-sticky-cta]');
  expect(await cta.getAttribute('tabindex')).toBe('-1');
  expect(await cta.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
});

test('menu: abre pelo selo do hero, prende o foco, fecha com Esc e devolve o foco', async ({ page }) => {
  await page.goto('/');
  const abrir = page.locator('.menu-btn--hero');
  await abrir.click();
  const folha = page.locator('dialog#menu');
  await expect(folha).toBeVisible();
  await expect(abrir).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog#menu'))).toBe(true);
  // CTA e doca somem com o menu aberto
  expect(await visivel(page, '[data-sticky-cta]')).toBe(false);
  await page.keyboard.press('Escape');
  await expect(folha).toBeHidden();
  await expect(abrir).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.activeElement?.classList.contains('menu-btn--hero'))).toBe(true);
});

test('menu: item leva à seção e fecha a folha; “Reservar mesa” é o botão principal', async ({ page }) => {
  await page.goto('/');
  await page.locator('.menu-btn--hero').click();
  await expect(page.locator('.sheet .btn.btn--wine')).toHaveText(/Reservar mesa/);
  await page.locator('.sheet__nav a[href="#ambientes"]').click();
  await expect(page.locator('dialog#menu')).toBeHidden();
  await expect.poll(() => page.locator('#ambientes').evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(40);
});

test('menu da doca abre a mesma folha depois de rolar', async ({ page }) => {
  await page.goto('/');
  await rolarAte(page, '#roll');
  await expect.poll(() => visivel(page, '.menu-btn--dock')).toBe(true);
  await page.locator('.menu-btn--dock').click();
  await expect(page.locator('dialog#menu')).toBeVisible();
  await page.locator('[data-menu-close]').click();
  await expect(page.locator('dialog#menu')).toBeHidden();
});

test('pular para a reserva: primeiro elemento focável', async ({ page, browserName }) => {
  await page.goto('/');
  const link = page.locator('.skip-link');
  if (browserName === 'webkit') {
    // WebKit (como o Safari) não foca links com Tab por padrão, e o Option+Tab não é emulado aqui:
    // verificamos que o link é focável e aparece ao receber foco. Tab no Safari real: verificação manual.
    await link.focus();
  } else {
    await page.keyboard.press('Tab');
  }
  await expect(link).toBeFocused();
  expect((await link.boundingBox())!.width).toBeGreaterThan(100);
});

test('Visite: “Abrir no Maps” aponta para o endereço real; WhatsApp e Instagram corretos', async ({ page }) => {
  await page.goto('/');
  const maps = page.locator('#visite a', { hasText: /abrir no maps/i });
  await expect(maps).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Rua%20Tavares%20Coutinho%2C%20180%2C%20Fortaleza%2C%20CE');
  await expect(maps).toHaveAttribute('target', '_blank');
  await expect(page.locator('#visite a[href="https://wa.me/5585994452724"]')).toContainText('(85) 99445-2724');
  await expect(page.locator('#visite a[href="https://www.instagram.com/ambarbrunch/"]')).toHaveText('@ambarbrunch');
  await expect(page.locator('#visite a[href="https://www.instagram.com/roll.ofc/"]')).toContainText('@roll.ofc');
  await expect(page.locator('#visite iframe')).toHaveCount(0);
  await expect(page.locator('footer')).toContainText('Rua Tavares Coutinho, 180');
});
