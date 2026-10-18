// “Provou, conta”: três cards à vista (o central em destaque, os vizinhos nas bordas), só o central toca, mudo até o
// toque no som; o vídeo vai até o fim (máx. 40 s) e o próximo vira o central; pontos escolhem o card; fora da tela pausa e
// silencia; pausa manual e movimento reduzido respeitados; cards limpos (sem @, sem legenda, sem CC); MP4 só do central.
import { test, expect, type Page } from '@playwright/test';

type Estado = { i: number; muted: boolean };
// índice = posição do CARD (o <video> só é criado quando o card vai tocar)
const tocando = (page: Page): Promise<Estado[]> => page.$$eval('[data-trilho] .story', (cs) => cs.flatMap((c, i) => {
  const v = c.querySelector('video');
  return v && !v.paused ? [{ i, muted: v.muted }] : [];
}));
const card = (page: Page, i: number) => page.locator('[data-trilho] .story').nth(i);
// toque na posição do controle, sem a rolagem automática do Playwright (no WebKit ela também rola o trilho)
const tocar = async (page: Page, l: import('@playwright/test').Locator) => { const b = (await l.boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
// rolagem instantânea: o html tem scroll-behavior: smooth, e medir/tocar no meio da rolagem acertava outro ponto da página
const irAoCarrossel = (page: Page) => page.locator('[data-trilho]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
// como um swipe: rola o trilho até o card i ficar no centro
const swipeAte = (page: Page, i: number) => page.locator('[data-trilho]').evaluate((t, i) => {
  const c = t.querySelectorAll<HTMLElement>('.story')[i];
  const r = c.getBoundingClientRect(); const tr = t.getBoundingClientRect();
  t.scrollTo({ left: t.scrollLeft + r.left - tr.left - (tr.width - r.width) / 2 });
}, i);
// pula para o fim só depois que o vídeo andou de verdade: o WebKit aceita o seek logo no “playing”, antes de a mídia
// ser navegável, e fica preso em currentTime NaN (o visitante nunca faz isso)
const irAoFim = async (page: Page, i: number) => {
  const v = card(page, i).locator('video');
  await expect.poll(() => v.evaluate((el: HTMLVideoElement) => el.currentTime > 0.3 && el.seekable.length > 0), { timeout: 10000 }).toBe(true);
  await v.evaluate((el: HTMLVideoElement) => { el.currentTime = Math.max(0, el.duration - 0.3); });
};
const ativo = (page: Page) => page.$$eval('[data-trilho] .story', (cs) => cs.findIndex((c) => c.hasAttribute('data-ativo')));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  test.skip((await page.locator('[data-trilho] .story').count()) < 3, 'menos de 3 vídeos de criadores neste build');
});

for (const w of [360, 375, 390, 430]) {
  test(`${w} px: abre no 2º card, centralizado, com um vizinho visível de cada lado e respiro entre eles`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 });
    await irAoCarrossel(page);
    await expect.poll(() => ativo(page)).toBe(1);
    const [c0, c1, c2] = await Promise.all([0, 1, 2].map(async (i) => (await card(page, i).boundingBox())!));
    expect(Math.abs(c1.x + c1.width / 2 - w / 2), 'ativo no centro').toBeLessThan(6);
    expect(c0.x + c0.width, 'ponta do anterior').toBeGreaterThan(20);
    expect(w - c2.x, 'ponta do próximo').toBeGreaterThan(20);
    expect(c1.width, 'central maior que os vizinhos').toBeGreaterThan(c2.width);
    expect(c2.x - (c1.x + c1.width), 'respiro').toBeGreaterThan(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test('cards limpos: sem @, descrição, legenda, CC ou aviso sobrepostos pelo site', async ({ page }) => {
  await expect(page.locator('[data-trilho] :is(.story__by, .story__tag, [data-legenda], [data-cc], track), .provou__nota')).toHaveCount(0);
  const html = await page.locator('#quem-provou').innerHTML();
  expect(html).not.toMatch(/@[a-z_]/i);
  await expect(page.locator('#quem-provou')).toContainText('Reviews reais de quem provou a Roll.');
  await expect(page.locator('#quem-provou h2')).toHaveText(/provou,\s*conta/i);
});

test('pontos mostram e escolhem o card central', async ({ page }) => {
  await irAoCarrossel(page);
  const pontos = page.locator('[data-ponto]');
  await expect(pontos).toHaveCount(await page.locator('[data-trilho] .story').count());
  await expect(pontos.nth(1)).toHaveAttribute('aria-current', 'true');
  await pontos.nth(3).click();
  await expect.poll(() => ativo(page)).toBe(3);
  await expect(pontos.nth(3)).toHaveAttribute('aria-current', 'true');
  await expect(pontos.nth(1)).toHaveAttribute('aria-current', 'false');
});

test.describe('com movimento', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('só o central toca, mudo; no swipe continua um só', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual([{ i: 1, muted: true }]);
    const n = await page.locator('[data-trilho] .story').count();
    for (let i = 2; i < n; i++) {
      await swipeAte(page, i);
      await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i, muted: true }]);
    }
  });

  test('o vídeo termina e o próximo vira o central (e do último volta ao primeiro)', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await irAoFim(page, 1);
    await expect.poll(() => ativo(page), { timeout: 8000 }).toBe(2);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 2, muted: true }]);
    const n = await page.locator('[data-trilho] .story').count();
    await swipeAte(page, n - 1);
    await expect.poll(async () => (await tocando(page)).map((v) => v.i), { timeout: 8000 }).toEqual([n - 1]);
    await irAoFim(page, n - 1);
    await expect.poll(() => ativo(page), { timeout: 8000 }).toBe(0);
  });

  test('som: o botão libera a voz, que segue para o próximo; tocar de novo desliga', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect(card(page, 1).locator('[data-som]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => tocando(page)).toEqual([{ i: 1, muted: false }]);
    await swipeAte(page, 2);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 2, muted: false }]);
    await expect(card(page, 1).locator('[data-som]')).toHaveAttribute('aria-pressed', 'false');
    await tocar(page, card(page, 2).locator('[data-som]'));
    await expect.poll(() => tocando(page)).toEqual([{ i: 2, muted: true }]);
  });

  test('fora da tela: pausa e o som desliga; de volta, toca de novo mudo', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => tocando(page)).toEqual([{ i: 1, muted: false }]);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => tocando(page)).toEqual([]);
    await expect(card(page, 1).locator('[data-som]')).toHaveAttribute('aria-pressed', 'false');
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 1, muted: true }]);
  });

  test('pausa manual é respeitada, inclusive fora e de volta à tela', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(1);
    await tocar(page, card(page, 1).locator('.story__toggle'));
    await expect.poll(() => tocando(page)).toEqual([]);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await irAoCarrossel(page);
    await page.waitForTimeout(1500);
    expect(await tocando(page)).toEqual([]);
    await tocar(page, card(page, 1).locator('.story__toggle'));
    await expect.poll(async () => (await tocando(page)).map((v) => v.i)).toEqual([1]);
  });

  test('toque num vizinho traz o card para o centro', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => ativo(page)).toBe(1);
    await page.waitForTimeout(600);   // o trilho assenta no card inicial
    // toca na parte visível do vizinho (a borda direita da tela)
    const b = (await card(page, 2).boundingBox())!;
    const w = page.viewportSize()!.width;
    await page.mouse.click((b.x + w) / 2, b.y + b.height / 2);
    await expect.poll(() => ativo(page), { timeout: 8000 }).toBe(2);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 2, muted: true }]);
  });
});

test('movimento reduzido: nada toca sozinho; o toque toca (mudo) e o som só com o botão', async ({ page }) => {
  await irAoCarrossel(page);
  await expect.poll(() => ativo(page)).toBe(1);
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
  test('nenhum <video> nem MP4 no carregamento; na tela, só o central cria vídeo', async ({ page, browserName }) => {
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
    expect(await page.locator('[data-trilho] video').count()).toBe(1);
    if (contaRede) expect(new Set(mp4).size).toBe(1);
  });
});

test('cortes dos criadores: até 40 s cada, com faixa de áudio (a voz original)', async ({ page, browserName }) => {
  await page.goto('/');
  const fontes = await page.$$eval('[data-trilho] template[data-video]', (ts) => ts.map((t) => (t as HTMLTemplateElement).content.querySelector('source')?.getAttribute('src')).filter(Boolean) as string[]);
  test.skip(!fontes.length, 'sem vídeos de criadores neste build');
  for (const src of fontes) {
    const dur = await page.evaluate((s) => new Promise<number>((ok) => { const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.onloadedmetadata = () => ok(v.duration); v.onerror = () => ok(NaN); v.src = s; }), src);
    expect(dur, src).toBeLessThanOrEqual(40);
    expect(dur, src).toBeGreaterThan(3);
    // a faixa de áudio: lida no MP4 (caixa “soun” do trak de áudio), sem depender do decodificador do navegador
    const temAudio = await page.evaluate(async (s) => { const b = new Uint8Array(await (await fetch(s)).arrayBuffer()); const txt = new TextDecoder('latin1').decode(b.subarray(0, Math.min(b.length, 4_000_000))); return txt.includes('soun'); }, src);
    expect(temAudio, `${src} (${browserName})`).toBe(true);
  }
});
