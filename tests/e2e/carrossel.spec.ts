// “Reações reais” (ajuste de 2026-10-18, referência Zuzzi): palco em laço — o central inteiro e maior, um vizinho cortado
// em cada borda, sempre; OS TRÊS à vista tocam ao mesmo tempo, mudos; depois do 1º toque no som a voz acompanha o
// card central a cada troca (só ele fala; desligar também vale); fora da tela ou com a aba escondida tudo pausa e cala;
// tocar no vídeo central liga/desliga o som (nunca pausa; swipe e toque longo não contam); movimento reduzido respeitado; cards limpos; vídeos criados só para os três à vista quando a seção chega perto.
import { test, expect, type Page, type Locator } from '@playwright/test';

type Estado = { i: number; muted: boolean };
// índice = posição do CARD na lista (o <video> só é criado quando o card fica à vista)
const tocando = (page: Page): Promise<Estado[]> => page.$$eval('[data-trilho] .story', (cs) => cs.flatMap((c, i) => {
  const v = c.querySelector('video');
  return v && !v.paused ? [{ i, muted: v.muted }] : [];
}));
const mudos = (...is: number[]) => is.map((i) => ({ i, muted: true }));
const card = (page: Page, i: number) => page.locator('[data-trilho] .story').nth(i);
const caixa = async (l: Locator) => (await l.boundingBox())!;
// toque na posição do controle, sem a rolagem automática do Playwright
const tocar = async (page: Page, l: Locator) => { const b = await caixa(l); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
// rolagem instantânea: o html tem scroll-behavior: smooth
const irAoCarrossel = (page: Page) => page.locator('[data-trilho]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
const ativo = (page: Page) => page.$$eval('[data-trilho] .story', (cs) => cs.findIndex((c) => c.getAttribute('data-pos') === '0'));
const assentou = (page: Page) => page.waitForTimeout(700);   // transição de 420 ms
// arraste horizontal no palco (dedo ou mouse geram os mesmos pointer events); dx < 0 = rumo ao próximo
const arrastar = async (page: Page, dx: number, passos = 12) => {
  const t = await caixa(page.locator('[data-trilho]'));
  const x = t.x + t.width / 2; const y = t.y + t.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= passos; k++) await page.mouse.move(x + (dx * k) / passos, y, { steps: 1 });
  await page.mouse.up();
  await assentou(page);
};
// a composição: central no meio, um vizinho cortado pela borda de cada lado, respiro de ~12 px
const composicao = async (page: Page, centro: number) => {
  const w = page.viewportSize()!.width;
  const n = await page.locator('[data-trilho] .story').count();
  const [e, c, d] = await Promise.all([centro - 1, centro, centro + 1].map((i) => caixa(card(page, (i + n) % n))));
  expect(Math.abs(c.x + c.width / 2 - w / 2), 'central no centro').toBeLessThan(3);
  expect(c.x, 'central inteiro (esq.)').toBeGreaterThan(0);
  expect(c.x + c.width, 'central inteiro (dir.)').toBeLessThan(w);
  expect(e.x, 'vizinho da esquerda cortado pela borda').toBeLessThan(0);
  expect(e.x + e.width, 'vizinho da esquerda à vista').toBeGreaterThan(40);
  expect(d.x + d.width, 'vizinho da direita cortado pela borda').toBeGreaterThan(w);
  expect(w - d.x, 'vizinho da direita à vista').toBeGreaterThan(40);
  expect(c.width, 'central maior').toBeGreaterThan(d.width * 1.1);
  for (const gap of [c.x - (e.x + e.width), d.x - (c.x + c.width)]) { expect(gap).toBeGreaterThanOrEqual(9); expect(gap).toBeLessThanOrEqual(15); }
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  test.skip((await page.locator('[data-trilho] .story').count()) < 5, 'menos de 5 vídeos de criadores neste build');
});

for (const w of [360, 375, 390, 430]) {
  test(`${w} px: abre centralizado no 2º card, com um vizinho cortado de cada lado e ~12 px de respiro`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 844 });
    await irAoCarrossel(page);
    expect(await ativo(page)).toBe(1);
    await composicao(page, 1);
    // os de fora da vista estão invisíveis e fora do foco
    for (const i of [3, 4]) {
      await expect(card(page, i)).toHaveCSS('opacity', '0');
      expect(await card(page, i).evaluate((c) => (c as HTMLElement).inert)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test('cards limpos: sem @, descrição, legenda, CC ou aviso sobrepostos pelo site', async ({ page }) => {
  await expect(page.locator('[data-trilho] :is(.story__by, .story__tag, [data-legenda], [data-cc], track), .provou__nota')).toHaveCount(0);
  const html = await page.locator('#quem-provou').innerHTML();
  expect(html).not.toMatch(/@[a-z_]/i);
  await expect(page.locator('#quem-provou')).toContainText('Reviews reais de quem provou a Roll.');
  await expect(page.locator('#quem-provou h2')).toHaveText(/rea[çc][õo]es\s*reais/i);
});

test('ordem: abre no pistache; elevador e pistache (mesmas meninas) nunca lado a lado — nem na volta do laço; um ponto por vídeo', async ({ page }) => {
  const arquivos = await page.$$eval('[data-trilho] .story template[data-video]', (ts) => ts.map((t) => (t as HTMLTemplateElement).content.querySelector('source')!.getAttribute('src')!.split('/').pop()!.replace('.web.mp4', '')));
  // 2026-10-18: o card só com música (criador-magall-sabores) saiu; o pistache de @dailysocass voltou e é o 1º no centro
  expect(arquivos).toEqual(['criador-magall-viciado', 'criadora-dailysocass-pistache', 'roll-criadora-larizgomes', 'criador-elevador-abrindo', 'criadores-grupo-expectativa']);
  const n = arquivos.length;
  const mesmas = (a: string) => /elevador|dailysocass/.test(a);
  for (let i = 0; i < n; i++) expect(mesmas(arquivos[i]) && mesmas(arquivos[(i + 1) % n]), `${i} e ${(i + 1) % n}`).toBe(false);
  await expect(page.locator('[data-ponto]')).toHaveCount(n);
  await expect(page.locator('[data-ponto]').nth(1)).toHaveAttribute('aria-current', 'true');
  // cada card toca o próprio arquivo (o mesmo do som): rótulo do botão de som × descrição do vídeo
  const pares = await page.$$eval('[data-trilho] .story', (cs) => cs.map((c) => [c.querySelector('[data-som]')?.getAttribute('data-nome'), (c.querySelector('template') as HTMLTemplateElement).content.querySelector('video')!.getAttribute('aria-label')]));
  for (const [nome, rotulo] of pares) expect(rotulo).toBe(`Vídeo: ${nome!.slice(1, -1)}`);
});

test('pontos mostram e escolhem o card central (pelo caminho mais curto do laço)', async ({ page }) => {
  await irAoCarrossel(page);
  const pontos = page.locator('[data-ponto]');
  await expect(pontos).toHaveCount(await page.locator('[data-trilho] .story').count());
  await expect(pontos.nth(1)).toHaveAttribute('aria-current', 'true');
  await pontos.nth(3).click();
  await expect.poll(() => ativo(page)).toBe(3);
  await expect(pontos.nth(3)).toHaveAttribute('aria-current', 'true');
  await expect(pontos.nth(1)).toHaveAttribute('aria-current', 'false');
  await assentou(page);
  await composicao(page, 3);
});

test('teclado: setas trocam o card central', async ({ page }) => {
  await irAoCarrossel(page);
  await page.locator('[data-ponto]').nth(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => ativo(page)).toBe(2);
  await expect(page.locator('[data-ponto]').nth(2)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => ativo(page)).toBe(0);
});

test.describe('com movimento', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('os TRÊS à vista tocam ao mesmo tempo, mudos — e andam de verdade; os de fora nem criam vídeo', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    const tempos = () => page.$$eval('[data-trilho] video', (vs) => vs.map((v) => (v as HTMLVideoElement).currentTime));
    const t0 = await tempos();
    await page.waitForTimeout(1500);
    const t1 = await tempos();
    expect(t0.length).toBe(3);
    t1.forEach((t, k) => expect(t - t0[k], `vídeo ${k} em movimento`).toBeGreaterThan(0.8));
    for (const i of [3, 4]) await expect(card(page, i).locator('video')).toHaveCount(0);
  });

  test('swipe: centraliza o próximo, atualiza os três que tocam, pausa quem saiu — e no laço nunca sobra ponta vazia', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    await arrastar(page, -170);
    expect(await ativo(page)).toBe(2);
    await composicao(page, 2);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual(mudos(1, 2, 3));
    expect(await card(page, 0).locator('video').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    // de volta, além do primeiro: o último aparece à esquerda (laço), sem espaço vazio
    await arrastar(page, 170);
    await arrastar(page, 170);
    expect(await ativo(page)).toBe(0);
    await composicao(page, 0);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual(mudos(0, 1, 4));
  });

  test('swipe curto e lento volta ao lugar; gesto vertical não troca o card', async ({ page }) => {
    await irAoCarrossel(page);
    await arrastar(page, -25, 25);
    expect(await ativo(page)).toBe(1);
    await composicao(page, 1);
    const t = await caixa(page.locator('[data-trilho]'));
    await page.mouse.move(t.x + t.width / 2, t.y + 100);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(t.x + t.width / 2 - k * 3, t.y + 100 + k * 18);
    await page.mouse.up();
    await assentou(page);
    expect(await ativo(page)).toBe(1);
    await composicao(page, 1);
  });

  // áudio: índices dos vídeos tocando com voz (muted false)
  const comVoz = async (page: Page) => (await tocando(page)).filter((v) => !v.muted).map((v) => v.i);
  // amostra a cada quadro quantos vídeos estão audíveis (tocando e sem mudo), durante todo o teste
  const vigiarAudio = (page: Page) => page.evaluate(() => {
    const w = window as unknown as { maxAudiveis: number };
    w.maxAudiveis = 0;
    const amostra = () => { const k = [...document.querySelectorAll<HTMLVideoElement>('[data-trilho] video')].filter((v) => !v.paused && !v.muted).length; w.maxAudiveis = Math.max(w.maxAudiveis, k); requestAnimationFrame(amostra); };
    amostra();
  });
  const maxAudiveis = (page: Page) => page.evaluate(() => (window as unknown as { maxAudiveis: number }).maxAudiveis);
  const semMudo = (page: Page) => page.$$eval('[data-trilho] video', (vs) => vs.filter((v) => !(v as HTMLVideoElement).muted).length);

  test('áudio: começa mudo; o 1º toque liga a voz e ela passa SOZINHA ao novo central a cada troca — inclusive na volta do laço', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    await vigiarAudio(page);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect(card(page, 1).locator('[data-som]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => tocando(page)).toEqual([{ i: 0, muted: true }, { i: 1, muted: false }, { i: 2, muted: true }]);
    // swipe para o próximo: o anterior se cala e o novo central assume a voz, sem novo toque
    await arrastar(page, -170);
    expect(await ativo(page)).toBe(2);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 1, muted: true }, { i: 2, muted: false }, { i: 3, muted: true }]);
    await expect(card(page, 2).locator('[data-som]')).toHaveAttribute('aria-pressed', 'true');
    // de volta ao anterior
    await arrastar(page, 170);
    await expect.poll(() => comVoz(page), { timeout: 8000 }).toEqual([1]);
    // laço: do primeiro para o último e do último para o primeiro, mesma regra
    await arrastar(page, 170);
    expect(await ativo(page)).toBe(0);
    await expect.poll(() => comVoz(page), { timeout: 8000 }).toEqual([0]);
    await arrastar(page, 170);
    expect(await ativo(page)).toBe(4);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual([{ i: 0, muted: true }, { i: 3, muted: true }, { i: 4, muted: false }]);
    await arrastar(page, -170);
    expect(await ativo(page)).toBe(0);
    await expect.poll(() => comVoz(page), { timeout: 8000 }).toEqual([0]);
    // pelos pontos também
    await page.locator('[data-ponto]').nth(3).click();
    await expect.poll(() => comVoz(page), { timeout: 8000 }).toEqual([3]);
    expect(await maxAudiveis(page), 'nunca dois audíveis').toBe(1);
  });

  test('com voz ligada, os três seguem em movimento — inclusive quando um vizinho volta ao início do laço', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => comVoz(page)).toEqual([1]);
    // os dois vizinhos vão para perto do fim, para darem a volta do laço dentro da janela medida (os cortes têm de ~10 a 40 s)
    for (const i of [0, 2]) {
      await card(page, i).locator('video').evaluate(async (v: HTMLVideoElement) => {
        if (!Number.isFinite(v.duration)) await new Promise((ok) => v.addEventListener('loadedmetadata', ok, { once: true }));
        v.currentTime = Math.max(0, v.duration - 1.5);
      });
    }
    // por 6 s (os vizinhos dão a volta em ~1,5 s): maior trecho contínuo com algum vídeo à vista parado
    const parado = await page.evaluate(() => new Promise<number>((ok) => {
      const vs = [...document.querySelectorAll<HTMLVideoElement>('[data-trilho] video')];
      let desde = 0; let pior = 0; const t0 = performance.now();
      const f = (t: number) => {
        const algum = vs.some((v) => v.paused);
        if (algum && !desde) desde = t; else if (!algum && desde) { pior = Math.max(pior, t - desde); desde = 0; }
        if (t - t0 < 6000) requestAnimationFrame(f); else ok(desde ? Math.max(pior, t - desde) : pior);
      };
      requestAnimationFrame(f);
    }));
    expect(parado, 'ms com um vídeo à vista parado').toBeLessThan(300);
    expect(await comVoz(page)).toEqual([1]);
  });

  test('áudio: desligar também é preferência — as próximas trocas seguem mudas até ligar de novo', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    await vigiarAudio(page);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => comVoz(page)).toEqual([1]);
    await tocar(page, card(page, 1).locator('[data-som]'));
    expect(await card(page, 1).locator('video').evaluate((v: HTMLVideoElement) => v.muted), 'cala na hora').toBe(true);
    await expect(card(page, 1).locator('[data-som]')).toHaveAttribute('aria-pressed', 'false');
    await arrastar(page, -170);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual(mudos(1, 2, 3));
    await arrastar(page, -170);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual(mudos(2, 3, 4));
    await tocar(page, card(page, 3).locator('[data-som]'));
    await expect.poll(() => comVoz(page)).toEqual([3]);
    expect(await maxAudiveis(page)).toBe(1);
  });

  test('áudio: som num vizinho traz o card para o centro já com a voz; o anterior se cala no mesmo toque', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    await vigiarAudio(page);
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => comVoz(page)).toEqual([1]);
    await tocar(page, card(page, 2).locator('[data-som]'));
    expect(await card(page, 1).locator('video').evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await expect.poll(() => ativo(page)).toBe(2);
    await expect.poll(() => comVoz(page), { timeout: 8000 }).toEqual([2]);
    expect(await maxAudiveis(page)).toBe(1);
  });

  test('saída da seção: a voz para na hora e tudo pausa (ambientes, reserva, rodapé); na volta, o central retoma a voz', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => comVoz(page)).toEqual([1]);
    for (const sel of ['#ambientes', '#reservar', 'footer.footer']) {
      await page.locator(sel).evaluate((el) => scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'instant' }));
      await expect.poll(() => tocando(page), { message: sel }).toEqual([]);
      expect(await semMudo(page), `${sel}: nenhum vídeo com voz`).toBe(0);
    }
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).map((v) => v.i), { timeout: 8000 }).toEqual([0, 1, 2]);
    // o navegador pode recusar voz sem um toque: aí o central segue mudo e o botão fica pronto para retomar
    await page.waitForTimeout(400);
    const voz = await comVoz(page);
    if (voz.length) expect(voz).toEqual([1]);
    else {
      await expect(card(page, 1).locator('[data-som]')).toHaveAttribute('aria-pressed', 'false');
      await tocar(page, card(page, 1).locator('[data-som]'));
      await expect.poll(() => comVoz(page)).toEqual([1]);
    }
  });

  test('borda da seção: pequenos movimentos não ligam e desligam (histerese)', async ({ page }) => {
    const mostrar = (fracao: number) => page.locator('[data-trilho]').evaluate((el, f) => { const r = el.getBoundingClientRect(); scrollTo({ top: r.top + scrollY - innerHeight + r.height * f, behavior: 'instant' }); }, fracao);
    await mostrar(1);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    for (const f of [0.42, 0.36, 0.45, 0.38]) { await mostrar(f); await page.waitForTimeout(250); expect((await tocando(page)).length, `${f} visível: segue tocando`).toBe(3); }
    await mostrar(0.15);
    await expect.poll(() => tocando(page)).toEqual([]);
    for (const f of [0.38, 0.42, 0.36]) { await mostrar(f); await page.waitForTimeout(250); expect(await tocando(page), `${f} visível: segue parado`).toEqual([]); }
    await mostrar(0.7);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual(mudos(0, 1, 2));
  });

  test('aba escondida: tudo pausa e cala; de volta à aba, retoma', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    await tocar(page, card(page, 1).locator('[data-som]'));
    await expect.poll(() => comVoz(page)).toEqual([1]);
    const aba = (oculta: boolean) => page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, oculta);
    await aba(true);
    await expect.poll(() => tocando(page)).toEqual([]);
    expect(await semMudo(page)).toBe(0);
    await aba(false);
    await expect.poll(async () => (await tocando(page)).map((v) => v.i), { timeout: 8000 }).toEqual([0, 1, 2]);
    await page.waitForTimeout(400);
    const voz = await comVoz(page);
    expect(voz.length === 0 || (voz.length === 1 && voz[0] === 1)).toBe(true);
  });

  test('toque no vídeo central = SOM: liga e desliga a voz, o vídeo nunca pausa e nada aparece no meio', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    await vigiarAudio(page);
    const superficie = card(page, 1).locator('[data-superficie]');
    const som = card(page, 1).locator('[data-som]');
    // nenhum ícone de play/pause sobre o vídeo, nem a superfície no Tab (o controle acessível é o botão de som)
    await expect(page.locator('[data-trilho] .story__toggle svg')).toHaveCount(0);
    expect(await superficie.evaluate((s) => s.tagName === 'DIV' && s.getAttribute('aria-hidden') === 'true')).toBe(true);
    await tocar(page, superficie);
    await expect(som).toHaveAttribute('aria-pressed', 'true');
    await expect(som).toHaveAttribute('aria-label', /^Desativar o som/);
    await expect.poll(() => tocando(page)).toEqual([{ i: 0, muted: true }, { i: 1, muted: false }, { i: 2, muted: true }]);
    await tocar(page, superficie);
    await expect(som).toHaveAttribute('aria-pressed', 'false');
    await expect(som).toHaveAttribute('aria-label', /^Ativar o som/);
    expect(await card(page, 1).locator('video').evaluate((v: HTMLVideoElement) => v.muted), 'cala na hora').toBe(true);
    // continua andando: os três seguem tocando e o tempo do central avança
    const t0 = await card(page, 1).locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);
    await page.waitForTimeout(800);
    expect(await tocando(page)).toEqual(mudos(0, 1, 2));
    expect(await card(page, 1).locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(t0 + 0.4);
    // ligado de novo pelo toque: a voz segue o novo central a cada troca, como com o botão
    await tocar(page, superficie);
    await expect.poll(() => comVoz(page)).toEqual([1]);
    await arrastar(page, -170);
    await expect.poll(() => comVoz(page), { timeout: 8000 }).toEqual([2]);
    await expect(card(page, 2).locator('[data-som]')).toHaveAttribute('aria-pressed', 'true');
    await tocar(page, card(page, 2).locator('[data-superficie]'));
    await expect.poll(() => tocando(page)).toEqual(mudos(1, 2, 3));
    expect(await maxAudiveis(page), 'nunca dois audíveis').toBe(1);
  });

  test('swipe × toque: arrastos (curto, longo, vários em laço, vertical) e toque longo não mexem no som', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    const somDe = (i: number) => card(page, i).locator('[data-som]');
    const nenhumaVoz = async () => { expect(await semMudo(page), 'nenhum vídeo com voz').toBe(0); };
    // arraste curto e lento: volta ao lugar e não liga o som
    await arrastar(page, -25, 25);
    expect(await ativo(page)).toBe(1);
    await expect(somDe(1)).toHaveAttribute('aria-pressed', 'false');
    await nenhumaVoz();
    // seis swipes seguidos para a frente (dá a volta inteira no laço de 5) e dois para trás: composição e três tocando
    const ordem = [2, 3, 4, 0, 1, 2];
    for (const esperado of ordem) {
      await arrastar(page, -170);
      expect(await ativo(page)).toBe(esperado);
      await composicao(page, esperado);
    }
    for (const esperado of [1, 0]) { await arrastar(page, 170); expect(await ativo(page)).toBe(esperado); }
    await composicao(page, 0);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual(mudos(0, 1, 4));
    await nenhumaVoz();
    // gesto vertical sobre o card central
    const b = await caixa(card(page, 0));
    await page.mouse.move(b.x + b.width / 2, b.y + 80);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(b.x + b.width / 2, b.y + 80 + k * 16);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await nenhumaVoz();
    // toque longo (segurar ~0,8 s)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(somDe(0)).toHaveAttribute('aria-pressed', 'false');
    await nenhumaVoz();
    // um toque curto liga; um swipe depois NÃO desliga (a voz passa ao novo central)
    await tocar(page, card(page, 0).locator('[data-superficie]'));
    await expect.poll(() => comVoz(page)).toEqual([0]);
    await arrastar(page, -170);
    await expect.poll(() => comVoz(page), { timeout: 8000 }).toEqual([1]);
  });

  test('toque num vizinho traz o card para o centro', async ({ page }) => {
    await irAoCarrossel(page);
    await expect.poll(() => tocando(page), { timeout: 10000 }).toEqual(mudos(0, 1, 2));
    // toca na parte visível do vizinho (entre a borda dele e a da tela)
    const b = await caixa(card(page, 0));
    await page.mouse.click(Math.max(4, (b.x + b.width) / 2), b.y + b.height * 0.7);
    await expect.poll(() => ativo(page), { timeout: 8000 }).toBe(0);
    await expect.poll(() => tocando(page), { timeout: 8000 }).toEqual(mudos(0, 1, 4));
  });
});

test('movimento reduzido: nada toca sozinho; o toque põe só o central para tocar, com a voz, e o 2º toque só cala', async ({ page }) => {
  await irAoCarrossel(page);
  await page.waitForTimeout(1500);
  expect(await tocando(page)).toEqual([]);
  await tocar(page, card(page, 1).locator('.story__toggle'));
  await expect.poll(() => tocando(page)).toEqual([{ i: 1, muted: false }]);
  await tocar(page, card(page, 1).locator('.story__toggle'));
  await expect.poll(() => tocando(page)).toEqual(mudos(1));
  await tocar(page, card(page, 1).locator('[data-som]'));
  await expect.poll(() => tocando(page)).toEqual([{ i: 1, muted: false }]);
});

test('card horizontal: o vídeo inteiro cabe na janela (sem zoom, sem corte)', async ({ page }) => {
  const largo = page.locator('[data-trilho] .story--wide');
  test.skip(!(await largo.count()), 'sem vídeo horizontal');
  await irAoCarrossel(page);
  const i = await largo.evaluate((c) => [...c.parentElement!.children].indexOf(c));
  await page.locator('[data-ponto]').nth(i).click();
  await expect.poll(() => ativo(page)).toBe(i);
  await assentou(page);
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
  test('nenhum <video> nem MP4 no carregamento; perto da seção, só os três à vista ganham vídeo', async ({ page, browserName }) => {
    // o WebKit do Playwright no Windows baixa mídia fora da rede da página (não aparece em page.on('request'))
    const contaRede = browserName !== 'webkit';
    const mp4: string[] = [];
    page.on('request', (r) => { if (/criador|larizgomes/.test(r.url()) && r.url().endsWith('.mp4')) mp4.push(r.url().split('/').pop()!); });
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(await page.locator('[data-trilho] video').count()).toBe(0);
    expect(mp4).toEqual([]);
    await irAoCarrossel(page);
    await expect.poll(async () => (await tocando(page)).length, { timeout: 10000 }).toBe(3);
    await page.waitForTimeout(800);
    expect(await page.locator('[data-trilho] video').count()).toBe(3);
    if (contaRede) expect(new Set(mp4).size).toBe(3);
  });
});

// exceção pedida pelo responsável (2026-10-18): o vídeo horizontal do grupo vai até o fim do story (72 s)
const LIMITE: Record<string, number> = { 'criadores-grupo-expectativa': 75 };
test('cortes dos criadores: até 40 s cada (salvo exceção pedida), com faixa de áudio (a voz original)', async ({ page, browserName }) => {
  await page.goto('/');
  const fontes = await page.$$eval('[data-trilho] template[data-video]', (ts) => ts.map((t) => (t as HTMLTemplateElement).content.querySelector('source')?.getAttribute('src')).filter(Boolean) as string[]);
  test.skip(!fontes.length, 'sem vídeos de criadores neste build');
  for (const src of fontes) {
    const dur = await page.evaluate((s) => new Promise<number>((ok) => { const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.onloadedmetadata = () => ok(v.duration); v.onerror = () => ok(NaN); v.src = s; }), src);
    expect(dur, src).toBeLessThanOrEqual(LIMITE[src.split('/').pop()!.replace('.web.mp4', '')] ?? 40);
    expect(dur, src).toBeGreaterThan(3);
    // a faixa de áudio: lida no MP4 (caixa “soun” do trak de áudio), sem depender do decodificador do navegador
    const temAudio = await page.evaluate(async (s) => { const b = new Uint8Array(await (await fetch(s)).arrayBuffer()); const txt = new TextDecoder('latin1').decode(b.subarray(0, Math.min(b.length, 4_000_000))); return txt.includes('soun'); }, src);
    expect(temAudio, `${src} (${browserName})`).toBe(true);
  }
});
