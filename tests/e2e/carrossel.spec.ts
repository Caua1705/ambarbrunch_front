// “Quem provou, conta”: só o vídeo ativo toca (mudo), som por botão, troca pausa e silencia o anterior,
// pausa manual e movimento reduzido respeitados, nada toca fora da tela, card horizontal sem corte.
import { test, expect, type Page } from '@playwright/test';

// índice = posição do CARD (o <video> só é criado quando o card fica ativo)
const tocando = (page: Page) => page.$$eval('[data-trilho] .story', (cs) => cs.flatMap((c, i) => { const v = c.querySelector('video'); return v && !v.paused ? [{ i, paused: false, muted: v.muted }] : []; }));
const ativo = (page: Page) => page.$$eval('[data-trilho] .story', (cs) => cs.findIndex((c) => c.hasAttribute('data-ativo')));
const centralizar = (page: Page) => page.locator('[data-trilho]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
const proximo = (page: Page) => page.locator('[data-trilho]').evaluate((t) => {
  const cards = [...t.querySelectorAll<HTMLElement>('.story')];
  const i = cards.findIndex((c) => c.hasAttribute('data-ativo')) + 1;
  const c = cards[i];
  t.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - t.clientWidth / 2 });   // como um swipe: rolagem do trilho
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  test.skip(!(await page.locator('[data-trilho] .story').count()), 'sem vídeos de criadores neste build');
});

test.describe('com movimento', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('só o ativo toca, mudo; o swipe troca, pausa e silencia o anterior', async ({ page }) => {
    await centralizar(page);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 0, paused: false, muted: true }]);
    test.skip((await page.locator('[data-trilho] .story').count()) < 2, 'um vídeo só');
    await proximo(page);
    await expect.poll(() => ativo(page)).toBe(1);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 1, paused: false, muted: true }]);
    expect(await page.locator('[data-trilho] .story').first().locator('video').evaluate((v: HTMLVideoElement) => v.paused && v.muted)).toBe(true);
  });

  test('botão de som liga só o ativo; ao trocar, o anterior pausa e fica mudo', async ({ page }) => {
    await centralizar(page);
    const som = page.locator('.story[data-ativo] [data-som]');
    test.skip(!(await som.count()), 'vídeo ativo sem áudio');
    await som.click();
    await expect(som).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => tocando(page)).toEqual([{ i: 0, paused: false, muted: false }]);
    await proximo(page);
    await expect.poll(() => ativo(page)).toBe(1);
    const primeiro = page.locator('[data-trilho] .story').first().locator('video');
    await expect.poll(() => primeiro.evaluate((v: HTMLVideoElement) => v.paused && v.muted)).toBe(true);
    await expect.poll(async () => (await tocando(page)).every((v) => v.muted)).toBe(true);
  });

  test('pausa manual é respeitada (inclusive fora e de volta à tela); os outros seguem tocando', async ({ page }) => {
    await centralizar(page);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toHaveLength(1);
    await page.locator('.story[data-ativo] .story__toggle').click();
    await expect.poll(() => tocando(page)).toHaveLength(0);
    await page.waitForTimeout(1500);
    expect(await tocando(page)).toHaveLength(0);
    // sai da tela e volta: o vídeo pausado continua pausado
    await page.evaluate(() => scrollTo(0, 0));
    await expect.poll(() => tocando(page)).toHaveLength(0);
    await centralizar(page);
    await page.waitForTimeout(1500);
    expect(await tocando(page)).toHaveLength(0);
    // o próximo segue a regra normal: toca sozinho, mudo
    test.skip((await page.locator('[data-trilho] .story').count()) < 2, 'um vídeo só');
    await proximo(page);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 1, paused: false, muted: true }]);
  });

  test('legendas da fala aparecem abaixo do vídeo enquanto toca', async ({ page }) => {
    await centralizar(page);
    test.skip(!(await page.locator('.story[data-ativo] [data-som]').count()), 'vídeo ativo sem áudio/legendas');
    await expect.poll(() => page.locator('[data-fala]').textContent(), { timeout: 8000 }).not.toBe('');
  });
});

test('movimento reduzido: nada toca sozinho; o toque toca', async ({ page }) => {
  await centralizar(page);
  await page.waitForTimeout(1500);
  expect(await tocando(page)).toHaveLength(0);
  await page.locator('.story[data-ativo] .story__toggle').click();
  await expect.poll(() => tocando(page)).toHaveLength(1);
});

test('card horizontal: o vídeo inteiro cabe na janela (sem zoom, sem corte) e o trilho não vaza a página', async ({ page }) => {
  const largo = page.locator('.story--wide');
  test.skip(!(await largo.count()), 'sem vídeo horizontal');
  await centralizar(page);
  await largo.locator('.story__toggle').click();   // traz o card horizontal para o centro (o vídeo é criado)
  await expect(largo).toHaveAttribute('data-ativo', '');
  const r = await largo.evaluate((card) => {
    // medidas sem transformação (a moldura é levemente girada e os vizinhos ficam em escala menor)
    const v = card.querySelector('video')!;
    return { fit: getComputedStyle(v).objectFit, dentro: v.offsetWidth <= card.clientWidth && v.offsetHeight <= card.clientHeight, prop: v.offsetWidth / v.offsetHeight };
  });
  expect(r.fit).toBe('contain');
  expect(r.dentro).toBe(true);
  expect(r.prop).toBeCloseTo(478 / 266, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('desempenho: nenhum <video> do carrossel no carregamento; só o ativo é criado perto da tela', async ({ page }) => {
  expect(await page.locator('[data-trilho] video').count()).toBe(0);
  expect(await page.locator('[data-trilho] template[data-video]').count()).toBeGreaterThan(0);
  await centralizar(page);
  await expect.poll(() => page.locator('[data-trilho] video').count()).toBe(1);
});
