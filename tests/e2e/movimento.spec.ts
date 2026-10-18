// Movimento: reduzido respeitado, sem botão de pausa no site (decisão de 2026-10-17), nada segurando o scroll.
import { test, expect } from '@playwright/test';

test.describe('com movimento normal', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a faixa, os selos e as peças vivas animam; sem botão de pausa e sem pausa antiga presa', async ({ page }) => {
    // uma pausa salva por versões anteriores não pode deixar o site parado sem botão para voltar
    await page.addInitScript(() => { try { localStorage.setItem('ambar:motion', 'paused'); } catch { /* bloqueado */ } });
    await page.goto('/');
    await expect(page.locator('[data-motion-toggle]')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'paused');
    expect(await page.evaluate(() => localStorage.getItem('ambar:motion'))).toBeNull();
    const rodando = () => page.evaluate(() => document.getAnimations()
      .filter((a) => a.playState === 'running' && /ticker|spin|boia/.test((a as CSSAnimation).animationName ?? '')).length);
    await expect.poll(rodando).toBeGreaterThan(2);
  });

  test('entrada do hero só no 1º carregamento e sem esconder o título', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.classList.contains('enter'))).toBe(true);
    // o título (maior texto da 1ª tela) nunca fica transparente
    const opacidades = await page.$$eval('.hero__headline > span', (els) => els.map((e) => Number(getComputedStyle(e).opacity)));
    for (const o of opacidades) expect(o).toBe(1);
    // a cena inteira (etiqueta → palavras → fotos → carimbo → CTA) cabe em 1,0–1,4 s; o CTA entra por último
    const tempos = await page.evaluate(() => document.getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity && (a.effect as KeyframeEffect).target?.closest('.hero'))
      .map((a) => ({ alvo: ((a.effect as KeyframeEffect).target as Element).className, fim: Number(a.effect!.getComputedTiming().endTime) })));
    const fim = Math.max(...tempos.map((t) => t.fim));
    expect(fim).toBeGreaterThanOrEqual(1000);
    expect(fim).toBeLessThanOrEqual(1400);
    // fecham a cena o CTA e a anotação “quentinho da fornada”, que se escreve por último
    expect(tempos.find((t) => t.fim === fim)?.alvo).toMatch(/btn|hero__anota/);
    // a etiqueta (LCP) também nunca fica transparente
    expect(Number(await page.locator('.hero__label').evaluate((e) => getComputedStyle(e).opacity))).toBe(1);
    // a cena acaba e não repete ao rolar de volta ao topo
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('enter')), { timeout: 3000 }).toBe(false);
    await page.evaluate(() => scrollTo({ top: 3000, behavior: 'instant' }));
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.classList.contains('enter'))).toBe(false);
  });

  test('F5: a entrada do hero roda em cinco recarregamentos seguidos, mesmo depois de rolar ou de clicar numa âncora', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 5; i++) {
      // estado que antes desligava a entrada: página rolada (restauração do scroll) e âncora na URL
      await page.evaluate((n) => { scrollTo({ top: 2500, behavior: 'instant' }); if (n % 2) location.hash = '#reservar'; }, i);
      await page.waitForTimeout(150);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const r = await page.evaluate(() => ({
        enter: document.documentElement.classList.contains('enter'),
        hash: location.hash,
        cena: document.getAnimations().filter((a) => ((a.effect as KeyframeEffect)?.target as Element | null)?.closest?.('.hero')).length,
      }));
      expect(r.enter, `recarga ${i + 1}`).toBe(true);
      expect(r.hash).toBe('');
      expect(r.cena).toBeGreaterThan(8);
      await page.waitForLoadState('load');
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      // o título continua visível desde o 1º quadro (sem tela branca)
      expect(Number(await page.locator('.hero__label').evaluate((e) => getComputedStyle(e).opacity))).toBe(1);
    }
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
