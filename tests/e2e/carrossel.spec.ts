// “Quem provou, conta”: o card ativo no centro, o anterior e o próximo nas bordas; os visíveis tocam mudos (no máximo 2);
// som por card, um de cada vez, só com toque; fora da tela pausa e silencia; pausa manual e movimento reduzido
// respeitados; sem @ nem descrição sobrepostos; legendas só por CC; MP4 só dos cards que vão tocar.
import { test, expect, type Page } from '@playwright/test';

type Estado = { i: number; muted: boolean };
// índice = posição do CARD (o <video> só é criado quando o card vai tocar)
const tocando = (page: Page): Promise<Estado[]> => page.$$eval('[data-trilho] .story', (cs) => cs.flatMap((c, i) => {
  const v = c.querySelector('video');
  return v && !v.paused ? [{ i, muted: v.muted }] : [];
}));
const audiveis = async (page: Page) => (await tocando(page)).filter((v) => !v.muted).map((v) => v.i);
const card = (page: Page, i: number) => page.locator('[data-trilho] .story').nth(i);
// toque na posição do controle, sem a rolagem automática do Playwright (no WebKit ela também rola o trilho)
const tocar = async (page: Page, l: import('@playwright/test').Locator) => { const b = (await l.boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const irAoCarrossel = (page: Page) => page.locator('[data-trilho]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
// como um swipe: rola o trilho até o card i ficar no centro
const swipeAte = (page: Page, i: number) => page.locator('[data-trilho]').evaluate((t, i) => {
  const c = t.querySelectorAll<HTMLElement>('.story')[i];
  const r = c.getBoundingClientRect(); const tr = t.getBoundingClientRect();
  t.scrollTo({ left: t.scrollLeft + r.left - tr.left - (tr.width - r.width) / 2 });
}, i);
const ativo = (page: Page) => page.$$eval('[data-trilho] .story', (cs) => cs.findIndex((c) => c.hasAttribute('data-ativo')));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  test.skip((await page.locator('[data-trilho] .story').count()) < 3, 'menos de 3 vídeos de criadores neste build');
});

for (const w of [360, 375, 390, 430]) {
  test(`${w} px: card ativo centralizado, o próximo aparece na borda, respiro entre cards, sem vazar a página`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 });
    await irAoCarrossel(page);
    await expect.poll(() => ativo(page)).toBe(0);
    const c0 = (await card(page, 0).boundingBox())!;
    const c1 = (await card(page, 1).boundingBox())!;
    expect(Math.abs(c0.x + c0.width / 2 - w / 2), 'ativo no centro').toBeLessThan(6);
    expect(w - c1.x, 'ponta do próximo').toBeGreaterThan(20);
    expect(c1.x - (c0.x + c0.width), 'respiro').toBeGreaterThan(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    // no fim, o último também centraliza (extremidades equilibradas)
    const n = await page.locator('[data-trilho] .story').count();
    await swipeAte(page, n - 1);
    await expect.poll(() => ativo(page)).toBe(n - 1);
    const cl = (await card(page, n - 1).boundingBox())!;
    expect(Math.abs(cl.x + cl.width / 2 - w / 2)).toBeLessThan(6);
  });
}

test('cards limpos: sem @, descrição, transcrição fixa ou aviso sobrepostos pelo site', async ({ page }) => {
  await expect(page.locator('[data-trilho] .story__by, [data-trilho] .story__tag, .provou__nota, [data-fala]')).toHaveCount(0);
  await expect(page.locator('[data-trilho] [data-legenda]:visible')).toHaveCount(0);
  await expect(page.locator('#quem-provou')).not.toContainText('não são avaliações');
  await expect(page.locator('#quem-provou')).toContainText('Reviews reais de quem provou a Roll.');
});

test('setas e contador andam de card ativo em card ativo', async ({ page }) => {
  await irAoCarrossel(page);
  await page.locator('[data-next]').click();
  await expect.poll(() => ativo(page)).toBe(1);
  await expect(page.locator('[data-contador]')).toHaveText('02');
  await page.locator('[data-prev]').click();
  await expect.poll(() => ativo(page)).toBe(0);
  await expect(page.locator('[data-prev]')).toBeDisabled();
});

test.describe('com movimento', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('o ativo toca mudo; no swipe, nunca mais de dois e nenhum com som', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual([{ i: 0, muted: true }]);
    const n = await page.locator('[data-trilho] .story').count();
    for (let i = 1; i < n; i++) {
      await swipeAte(page, i);
      await page.waitForTimeout(400);
      const t = await tocando(page);
      expect(t.length, `após swipe até ${i}`).toBeLessThanOrEqual(2);
      expect(t.every((v) => v.muted)).toBe(true);
    }
    await expect.poll(async () => (await tocando(page)).map((v) => v.i)).toContain(n - 1);
  });

  test('som: só o escolhido fica audível; ativar outro silencia o anterior; tocar de novo desliga', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await tocar(page, card(page, 0).locator('[data-som]'));
    await expect(card(page, 0).locator('[data-som]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => audiveis(page)).toEqual([0]);
    await swipeAte(page, 1);
    await expect.poll(() => ativo(page)).toBe(1);
    await page.waitForTimeout(500);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => audiveis(page)).toEqual([1]);
    await expect(card(page, 0).locator('[data-som]')).toHaveAttribute('aria-pressed', 'false');
    expect(await card(page, 0).locator('video').evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => audiveis(page)).toEqual([]);
  });

  test('fora da tela: pausa e o som desliga; de volta, toca de novo mudo', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await tocar(page, card(page, 0).locator('[data-som]'));
    await expect.poll(() => audiveis(page)).toEqual([0]);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => tocando(page)).toEqual([]);
    await expect(card(page, 0).locator('[data-som]')).toHaveAttribute('aria-pressed', 'false');
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 0, muted: true }]);
  });

  test('swipe tira o card audível da tela: ele pausa e fica mudo', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await tocar(page, card(page, 0).locator('[data-som]'));
    await expect.poll(() => audiveis(page)).toEqual([0]);
    await swipeAte(page, 3);
    await expect.poll(() => card(page, 0).locator('video').evaluate((v: HTMLVideoElement) => v.paused && v.muted)).toBe(true);
    await expect.poll(() => audiveis(page)).toEqual([]);
  });

  test('pausa manual é respeitada, inclusive fora e de volta à tela', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await tocar(page, card(page, 0).locator('.story__toggle'));
    await expect.poll(() => tocando(page)).toEqual([]);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await irAoCarrossel(page);
    await page.waitForTimeout(1500);
    expect(await tocando(page)).toEqual([]);
    await tocar(page, card(page, 0).locator('.story__toggle'));
    await expect.poll(async () => (await tocando(page)).map((v) => v.i)).toEqual([0]);
  });

  test('legendas opcionais (CC): aparecem sobre o vídeo só quando pedidas e somem ao desligar', async ({ page }) => {
    await irAoCarrossel(page);
    const c = card(page, 0);
    test.skip(!(await c.locator('[data-cc]').count()), '1º vídeo sem legendas');
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
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
  await tocar(page, card(page, 0).locator('.story__toggle'));
  await expect.poll(() => tocando(page)).toEqual([{ i: 0, muted: true }]);
  await tocar(page, card(page, 0).locator('[data-som]'));
  await expect.poll(() => tocando(page)).toEqual([{ i: 0, muted: false }]);
});

test('card horizontal: o vídeo inteiro cabe na janela (sem zoom, sem corte)', async ({ page }) => {
  const largo = page.locator('[data-trilho] .story--wide');
  test.skip(!(await largo.count()), 'sem vídeo horizontal');
  await irAoCarrossel(page);
  const i = await largo.evaluate((c) => [...c.parentElement!.children].indexOf(c));
  await swipeAte(page, i);
  await expect.poll(() => ativo(page)).toBe(i);
  await tocar(page, largo.locator('.story__toggle'));
  await expect(largo.locator('video')).toHaveCount(1);
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
  test('nenhum <video> nem MP4 no carregamento; perto da tela, no máximo 2 vídeos criados', async ({ page, browserName }) => {
    // o WebKit do Playwright no Windows baixa mídia fora da rede da página (não aparece em page.on('request'))
    const contaRede = browserName !== 'webkit';
    const mp4: string[] = [];
    page.on('request', (r) => { if (/criador|larizgomes/.test(r.url()) && r.url().endsWith('.mp4')) mp4.push(r.url().split('/').pop()!); });
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(await page.locator('[data-trilho] video').count()).toBe(0);
    expect(mp4).toEqual([]);
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(800);
    expect(await page.locator('[data-trilho] video').count()).toBeLessThanOrEqual(2);
    if (contaRede) expect(new Set(mp4).size).toBeLessThanOrEqual(2);
  });
});
