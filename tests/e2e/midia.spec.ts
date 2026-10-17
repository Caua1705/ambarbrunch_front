// Carregamento de mídia: só a 1ª tela com prioridade, o resto preguiçoso; vídeos sob demanda e um por vez.
import { test, expect } from '@playwright/test';

test('prioridade só na 1ª tela; demais imagens lazy; formatos modernos', async ({ page }) => {
  await page.goto('/');
  const imgs = await page.$$eval('img', (els) => els.map((i) => ({ lazy: i.loading === 'lazy', alta: i.getAttribute('fetchpriority') === 'high', hero: !!i.closest('.hero'), src: i.currentSrc || i.src })));
  const prioritarias = imgs.filter((i) => i.alta);
  expect(prioritarias.length).toBeLessThanOrEqual(2);
  for (const i of imgs.filter((x) => !x.hero)) expect(i.lazy, i.src).toBe(true);
  for (const i of imgs.filter((x) => x.src)) expect(i.src).toMatch(/\.(avif|webp)(\?|$)/);
});

test('vídeos: preload none, mudos, sem baixar nada antes de chegar perto', async ({ page }) => {
  const videos: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('.mp4')) videos.push(r.url()); });
  await page.goto('/', { waitUntil: 'load' });
  // 'networkidle' às vezes não chega no WebKit com testes em paralelo; uma janela fixa basta para ver se algum vídeo foi pedido
  await page.waitForTimeout(2000);
  const n = await page.locator('video').count();
  test.skip(n === 0, 'sem vídeos neste build (autorização pendente fora do modo de revisão)');
  expect(videos, 'nenhum vídeo baixado na 1ª tela').toEqual([]);
  for (const v of await page.locator('video').all()) {
    expect(await v.getAttribute('preload')).toBe('none');
    expect(await v.evaluate((el: HTMLVideoElement) => el.muted)).toBe(true);
  }
});

test.describe('reprodução', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('toca no máximo um vídeo por vez', async ({ page }) => {
    await page.goto('/');
    await page.locator('.stories').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect.poll(() => page.$$eval('video', (vs) => vs.filter((v) => !(v as HTMLVideoElement).paused).length), { timeout: 8000 }).toBe(1);
    // botão do card pausa
    const tocando = page.locator('.story[data-state="playing"] .story__toggle');
    await tocando.click();
    await expect.poll(() => page.$$eval('video', (vs) => vs.filter((v) => !(v as HTMLVideoElement).paused).length)).toBe(0);
  });
});
