// “Quem provou, conta” em feed: ~2 vídeos lado a lado no celular e a ponta do próximo; os visíveis tocam juntos, mudos
// (no máximo 2); som por card, um de cada vez; fora da tela pausa e silencia; pausa manual e movimento reduzido
// respeitados; legendas só por CC (nada de transcrição fixa); MP4 só dos cards que vão tocar.
import { test, expect, type Page } from '@playwright/test';

type Estado = { i: number; muted: boolean };
// índice = posição do CARD (o <video> só é criado quando o card vai tocar)
const tocando = (page: Page): Promise<Estado[]> => page.$$eval('[data-trilho] .story', (cs) => cs.flatMap((c, i) => {
  const v = c.querySelector('video');
  return v && !v.paused ? [{ i, muted: v.muted }] : [];
}));
const audiveis = async (page: Page) => (await tocando(page)).filter((v) => !v.muted).map((v) => v.i);
const card = (page: Page, i: number) => page.locator('[data-trilho] .story').nth(i);
// toque na posição do controle, sem a rolagem automática do Playwright (no WebKit ela também rola o trilho e troca os
// cards visíveis — o visitante nunca faz isso)
const tocar = async (page: Page, l: import('@playwright/test').Locator) => { const b = (await l.boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const irAoCarrossel = (page: Page) => page.locator('[data-trilho]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
// como um swipe: rola o trilho até o card i ficar no início
const swipeAte = (page: Page, i: number) => page.locator('[data-trilho]').evaluate((t, i) => {
  const c = t.querySelectorAll<HTMLElement>('.story')[i];
  t.scrollTo({ left: t.scrollLeft + c.getBoundingClientRect().left - t.getBoundingClientRect().left - parseFloat(getComputedStyle(t).scrollPaddingLeft) });
}, i);
// cards com pelo menos `f` da largura dentro da tela
const visiveis = (page: Page, f = 0.98) => page.$$eval('[data-trilho] .story', (cs, f) => cs.flatMap((c, i) => {
  const r = c.getBoundingClientRect();
  const dentro = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
  return dentro / r.width >= f ? [i] : [];
}), f);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  test.skip((await page.locator('[data-trilho] .story').count()) < 3, 'menos de 3 vídeos de criadores neste build');
});

for (const w of [360, 390, 430]) {
  test(`${w} px: dois vídeos inteiros lado a lado e a ponta do 3º; o trilho não vaza a página`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 });
    await irAoCarrossel(page);
    expect(await visiveis(page)).toEqual([0, 1]);
    const ponta = await card(page, 2).evaluate((c) => innerWidth - c.getBoundingClientRect().left);
    expect(ponta, 'ponta do 3º card').toBeGreaterThan(24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test('sem transcrição fixa nem frases descritivas nos cards; créditos discretos (só o @)', async ({ page }) => {
  await expect(page.locator('[data-fala], .provou__fala, [data-trilho] .story__tag, [data-trilho] .story__original')).toHaveCount(0);
  await expect(page.locator('[data-trilho] [data-legenda]:visible')).toHaveCount(0);
  for (const t of await page.locator('[data-trilho] .story__by').allTextContents()) expect(t.trim()).toMatch(/^@[\w.]+$/);
});

test.describe('com movimento', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('os dois visíveis tocam juntos, mudos; no swipe, nunca mais de dois', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual([{ i: 0, muted: true }, { i: 1, muted: true }]);
    const n = await page.locator('[data-trilho] .story').count();
    for (let i = 1; i < n; i++) {
      await swipeAte(page, i);
      await page.waitForTimeout(400);
      const t = await tocando(page);
      expect(t.length, `após swipe até ${i}`).toBeLessThanOrEqual(2);
      expect(t.every((v) => v.muted)).toBe(true);
    }
    await expect.poll(async () => (await tocando(page)).length).toBeGreaterThan(0);
  });

  test('som: só o escolhido fica audível; escolher outro silencia o anterior; os dois seguem tocando', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(2);
    await tocar(page, card(page, 0).locator('[data-som]'));
    await expect(card(page, 0).locator('[data-som]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => audiveis(page)).toEqual([0]);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => audiveis(page)).toEqual([1]);
    await expect(card(page, 0).locator('[data-som]')).toHaveAttribute('aria-pressed', 'false');
    expect((await tocando(page)).map((v) => v.i)).toEqual([0, 1]);
    // tocar de novo desliga
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => audiveis(page)).toEqual([]);
  });

  test('fora da tela: pausa e o som desliga; de volta, tocam de novo mudos', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(2);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => audiveis(page)).toEqual([1]);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => tocando(page)).toEqual([]);
    await expect(card(page, 1).locator('[data-som]')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.$$eval('[data-trilho] video', (vs) => vs.every((v) => (v as HTMLVideoElement).muted))).toBe(true);
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 0, muted: true }, { i: 1, muted: true }]);
  });

  test('swipe tira o card audível da tela: ele pausa e fica mudo', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(2);
    await tocar(page, card(page, 0).locator('[data-som]'));
    await expect.poll(() => audiveis(page)).toEqual([0]);
    await swipeAte(page, 3);
    await expect.poll(() => card(page, 0).locator('video').evaluate((v: HTMLVideoElement) => v.paused && v.muted)).toBe(true);
    await expect.poll(() => audiveis(page)).toEqual([]);
  });

  test('pausa manual é respeitada (inclusive fora e de volta à tela); o vizinho segue tocando', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(2);
    await tocar(page, card(page, 0).locator('.story__toggle'));
    await expect.poll(async () => (await tocando(page)).map((v) => v.i)).toEqual([1]);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => tocando(page)).toEqual([]);
    await irAoCarrossel(page);
    await page.waitForTimeout(1500);
    expect((await tocando(page)).map((v) => v.i)).toEqual([1]);
    await tocar(page, card(page, 0).locator('.story__toggle'));
    await expect.poll(async () => (await tocando(page)).map((v) => v.i)).toEqual([0, 1]);
  });

  test('legendas opcionais (CC): aparecem sobre o vídeo só quando pedidas e somem ao desligar', async ({ page }) => {
    await irAoCarrossel(page);
    const c = card(page, 0);
    test.skip(!(await c.locator('[data-cc]').count()), '1º vídeo sem legendas');
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(2);
    await tocar(page, c.locator('[data-cc]'));
    await expect(c.locator('[data-cc]')).toHaveAttribute('aria-pressed', 'true');
    await expect(c.locator('[data-legenda]')).toHaveText(/\S/, { timeout: 8000 });
    await tocar(page, c.locator('[data-cc]'));
    await expect(c.locator('[data-legenda]')).toBeHidden();
  });
});

test('movimento reduzido: nada toca sozinho; o toque toca (mudo) e o som só com o botão', async ({ page }) => {
  await irAoCarrossel(page);
  await page.waitForTimeout(1500);
  expect(await tocando(page)).toEqual([]);
  await tocar(page, card(page, 1).locator('.story__toggle'));
  await expect.poll(() => tocando(page)).toEqual([{ i: 1, muted: true }]);
  await tocar(page, card(page, 1).locator('[data-som]'));
  await expect.poll(() => tocando(page)).toEqual([{ i: 1, muted: false }]);
});

test('card horizontal: o vídeo inteiro cabe na janela (sem zoom, sem corte)', async ({ page }) => {
  const largo = page.locator('[data-trilho] .story--wide');
  test.skip(!(await largo.count()), 'sem vídeo horizontal');
  await irAoCarrossel(page);
  await largo.locator('.story__toggle').click();   // traz o card para a tela e cria o vídeo
  const r = await largo.evaluate((card) => {
    const v = card.querySelector('video')!;
    return { fit: getComputedStyle(v).objectFit, dentro: v.offsetWidth <= card.clientWidth && v.offsetHeight <= card.clientHeight, prop: v.offsetWidth / v.offsetHeight };
  });
  expect(r.fit).toBe('contain');
  expect(r.dentro).toBe(true);
  expect(r.prop).toBeCloseTo(478 / 266, 1);
});

test.describe('desempenho', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('nenhum <video> nem MP4 no carregamento; perto da tela, só os 2 visíveis baixam', async ({ page, browserName }) => {
    // o WebKit do Playwright no Windows baixa mídia fora da rede da página (não aparece em page.on('request'))
    const contaRede = browserName !== 'webkit';
    const mp4: string[] = [];
    page.on('request', (r) => { if (/criador|larizgomes/.test(r.url()) && r.url().endsWith('.mp4')) mp4.push(r.url().split('/').pop()!); });
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(await page.locator('[data-trilho] video').count()).toBe(0);
    expect(mp4).toEqual([]);
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(2);
    await page.waitForTimeout(800);
    expect(await page.locator('[data-trilho] video').count()).toBe(2);
    if (contaRede) expect(new Set(mp4).size).toBe(2);
  });
});
