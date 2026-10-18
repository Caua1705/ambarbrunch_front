// “Direto da fornada”: o divisor acima dos vídeos da Roll é o progresso do carrossel — o fio de caramelo enche conforme
// a posição HORIZONTAL do trilho (1/3, 2/3 e cheio com 3 vídeos), acompanha o arraste sem pular de estado e não se mexe
// com o tempo dos vídeos nem com a rolagem vertical. Espiral, pontilhado e número continuam lá.
import { test, expect, type Page } from '@playwright/test';

const trilho = (page: Page) => page.locator('[data-fita-trilho]');
// fração da trilha coberta pelo fio, medida na tela
const cheio = (page: Page) => page.locator('[data-fita]').evaluate((f) => {
  const t = f.querySelector('.roll__trilha')!.getBoundingClientRect(); const fio = f.querySelector('.roll__fio')!.getBoundingClientRect();
  return Math.max(0, Math.min(fio.right, t.right) - t.left) / t.width;
});
const rolarTrilho = (page: Page, left: number) => trilho(page).evaluate((t, x) => t.scrollTo({ left: x, behavior: 'instant' }), left);
const encaixe = (page: Page, i: number) => trilho(page).evaluate((t, k) => {
  const pad = parseFloat(getComputedStyle(t).scrollPaddingLeft) || 0;
  const c = t.children[k] as HTMLElement;
  return Math.min(t.scrollWidth - t.clientWidth, c.getBoundingClientRect().left - t.getBoundingClientRect().left + t.scrollLeft - pad);
}, i);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  test.skip((await trilho(page).locator('> li').count()) < 2, 'menos de 2 vídeos da Roll neste build');
  await page.locator('[data-fita]').evaluate((el) => scrollTo({ top: el.getBoundingClientRect().top + scrollY - 120, behavior: 'instant' }));
});

test('divisor preservado: espiral, pontilhado e número; o fio começa marcando o 1º vídeo', async ({ page }) => {
  const fita = page.locator('[data-fita]');
  await expect(fita.locator('svg')).toBeVisible();
  await expect(fita.locator('span')).toHaveText(/^0\d$/);
  expect(await fita.locator('.roll__trilha').evaluate((t) => getComputedStyle(t, '::before').borderTopStyle)).toBe('dashed');
  await expect(fita).toHaveAttribute('aria-hidden', 'true');
  const n = await trilho(page).locator('> li').count();
  expect(await cheio(page)).toBeCloseTo(1 / n, 2);
});

test('acompanha a posição: parcial no meio do caminho, 2º vídeo, último cheio, e volta ao início', async ({ page }) => {
  const n = await trilho(page).locator('> li').count();
  const p1 = await encaixe(page, 1);
  // arrasto lento: com o dedo no trilho o encaixe não age — aqui o snap sai só durante esses passos
  await trilho(page).evaluate((t) => { t.style.scrollSnapType = 'none'; });
  let antes = await cheio(page);
  for (let k = 1; k <= 6; k++) {
    await rolarTrilho(page, (p1 * k) / 7);
    await expect.poll(() => cheio(page)).toBeGreaterThan(antes + 0.005);
    const agora = await cheio(page);
    expect(agora, 'nunca pula para o próximo estado').toBeLessThan(2 / n);
    antes = agora;
  }
  await trilho(page).evaluate((t) => { t.style.removeProperty('scroll-snap-type'); });
  await rolarTrilho(page, p1);
  await expect.poll(() => cheio(page)).toBeCloseTo(2 / n, 2);
  await rolarTrilho(page, 99999);
  await expect.poll(() => cheio(page)).toBeCloseTo(1, 2);
  // de volta: diminui proporcionalmente até o início
  await rolarTrilho(page, p1);
  await expect.poll(() => cheio(page)).toBeCloseTo(2 / n, 2);
  await rolarTrilho(page, 0);
  await expect.poll(() => cheio(page)).toBeCloseTo(1 / n, 2);
});

test('swipe de verdade (arraste e encaixe) e teclado também movem o fio', async ({ page, browserName }) => {
  const n = await trilho(page).locator('> li').count();
  if (browserName === 'chromium') {
    // toque real: o fio acompanha o dedo e assenta com o encaixe
    const cdp = await page.context().newCDPSession(page);
    const b = (await trilho(page).boundingBox())!;
    const x0 = b.x + b.width * 0.8; const y = b.y + b.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    const parciais: number[] = [];
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - k * 22, y }] }); await page.waitForTimeout(30); parciais.push(await cheio(page)); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(parciais.some((p) => p > 1 / n + 0.02 && p < 2 / n - 0.02), 'passou por estados parciais').toBe(true);
    await expect.poll(() => cheio(page), { timeout: 4000 }).toBeCloseTo(2 / n, 2);
  }
  await rolarTrilho(page, 0);
  await expect.poll(() => cheio(page)).toBeCloseTo(1 / n, 2);
  await trilho(page).evaluate((t) => { t.tabIndex = 0; t.focus(); });
  for (let k = 0; k < n; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500); }
  await expect.poll(() => cheio(page), { timeout: 4000 }).toBeCloseTo(1, 2);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => cheio(page), { timeout: 4000 }).toBeLessThan(1);
});

test.describe('com movimento', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('o tempo dos vídeos e a rolagem vertical não mexem no fio', async ({ page }) => {
    await expect.poll(() => page.$$eval('.roll .stories video', (vs) => vs.some((v) => !(v as HTMLVideoElement).paused)), { timeout: 10000 }).toBe(true);
    const a = await cheio(page);
    await page.waitForTimeout(1500);
    expect(await cheio(page)).toBeCloseTo(a, 3);
    await page.evaluate(() => scrollBy({ top: 240, behavior: 'instant' }));
    await page.evaluate(() => scrollBy({ top: -180, behavior: 'instant' }));
    await page.waitForTimeout(300);
    expect(await cheio(page)).toBeCloseTo(a, 3);
  });
});
