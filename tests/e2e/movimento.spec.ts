// Movimento: reduzido respeitado, pausa global funcionando e persistente, nada segurando o scroll.
import { test, expect } from '@playwright/test';

test.describe('com movimento normal', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a faixa e o selo animam; o botão “pausar animações” para e a escolha persiste', async ({ page }) => {
    await page.goto('/');
    const rodando = () => page.evaluate(() => document.getAnimations()
      .filter((a) => a.playState === 'running' && /ticker|spin/.test((a as CSSAnimation).animationName ?? '')).length);
    expect(await rodando()).toBeGreaterThan(0);
    await page.locator('footer [data-motion-toggle]').evaluate((b: HTMLElement) => b.click());
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
    await expect.poll(rodando).toBe(0);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
    await expect(page.locator('footer [data-motion-toggle]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('entrada do hero só no 1º carregamento e sem esconder o título', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.classList.contains('enter'))).toBe(true);
    // o título (maior texto da 1ª tela) nunca fica transparente
    const opacidades = await page.$$eval('.hero__headline > span', (els) => els.map((e) => Number(getComputedStyle(e).opacity)));
    for (const o of opacidades) expect(o).toBe(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('enter')), { timeout: 3000 }).toBe(false);
    await page.goto('/#reservar');
    expect(await page.evaluate(() => document.documentElement.classList.contains('enter'))).toBe(false);
  });

  test('o scroll não é sequestrado (sem listeners de wheel/touch bloqueantes, sem smooth scroll por JS)', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright: "Mouse wheel is not supported in mobile WebKit" (verificado; coberto no Chromium)');
    await page.goto('/');
    const antes = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(antes + 600);
  });
});

test.describe('com movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nenhuma animação infinita, nada escondido, sem entrada do hero', async ({ page }) => {
    await page.goto('/');
    const infinitas = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length);
    expect(infinitas).toBe(0);
    expect(await page.evaluate(() => document.documentElement.classList.contains('enter'))).toBe(false);
    const ocultos = await page.$$eval('[data-reveal]', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 1).length);
    expect(ocultos).toBe(0);
  });
});
