// FIDELIDADE: site (build de revisão, :4321) × protótipo aprovado congelado (experiments/concept-b-aprovado-v1, :4173).
// Roda só localmente: o v1 lê mídias de creative/source (fora do Git).
//
// Para cada seção do v1, em 390×844:
//  1. Geometria — posição e tamanho de cada peça, relativos ao topo da seção (tolerância de 1 px).
//  2. Estilos calculados — cor, fonte, peso, largura variável, espaçamento, rotação, raio, borda, sombra: idênticos.
//  3. Pixels — só no hero (1ª tela), com fotos mascaradas (no site são AVIF/WebP redimensionados).
//     Nas outras seções o recorte cai em frações de pixel diferentes (a seção 3 é nova e empurra o resto), o que muda a
//     rasterização do texto sem mudar o desenho; por isso elas são verificadas por 1 e 2, e as capturas vão anexas.
//
// Adições aprovadas que não existem no v1 ficam ocultas: selo e doca do menu, créditos e controles dos vídeos, sabores
// do mês, chamada final da Roll, marcações de revisão. A comanda mudou por dentro de propósito (reserva ainda não ativa)
// e o rodapé ganhou links e a pausa: nelas valem só a caixa, o título e o carimbo.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const V1 = 'http://127.0.0.1:4173/experiments/concept-b-aprovado-v1/';
const SITE = 'http://127.0.0.1:4321/';
const OCULTAR_SITE = '.menu-btn, .story__by, .story__progress, .story__toggle, .pending, .roll__sabores, .roll__cta, .roll__pending, .review-flag, .sticky-cta, .na-mesa--vazia, .skip-link { display: none !important; }';
const OCULTAR_V1 = '.proto-ribbon, .sticky-cta { display: none !important; }';

type Secao = { sel: string; pecas: string[]; pixels?: boolean; conta?: (chave: string) => boolean };
const SECOES: Record<string, Secao> = {
  hero: { sel: 'header.hero', pixels: true, pecas: ['.hero__label', '.label', '.hero__headline', '.hero__headline .l1', '.hero__headline .l2', '.hero__headline .l3', '.hero__headline em', '.hero__collage', '.cut--circle', '.cut--polaroid', '.cut--polaroid figcaption', '.cut--tile', '.sticker--roll', '.sticker--roll svg', '.sparks', '.hero__foot .btn', '.hero__note'] },
  faixa: { sel: '.ticker', pecas: ['.ticker__track', '.ticker__track span'] },
  mesa: { sel: '#gastronomia', pecas: ['.mega', '.mega span', '.scribble', '.board', '.board__item--a', '.board__item--b', '.board__item--c', '.tape', '.note--a', '.note--b', '.note--c', '.arrow--a', '.arrow--b', '.arrow--c', '.bands', '.bands__label', '.bands__list li', '.bands__note'] },
  fornadas: { sel: '#roll', pecas: ['.roll__spiral', '.roll__badge', '.mega', '.mega span', '.roll__lead', '.stories', '.story', '.story__tag', '.roll__credit', '.trays', '.trays figure', '.trays img', '.trays figcaption'] },
  climas: { sel: '#ambientes', pecas: ['.mega', '.mega span', '.climas__notice', '.climas__stack', '.panel--day', '.panel--amber', '.panel img', '.tagline', '.panel a', '.bubble--a', '.bubble--b', '.bubble figcaption'] },
  reserva: {
    sel: '#reservar', pecas: ['.mega', '.mega span', '.scribble', '.ticket', '.ticket__title', '.ticket__stamp', '.ticket fieldset', '.ticket legend', '.chips .chip', '.stepper'],
    // a altura da comanda e o conteúdo dos passos mudaram de propósito
    // (o carimbo ganhou text-align: center no design system, para os estados de duas linhas — desvio D11)
    conta: (k) => (/^(\.mega|\.scribble|\.ticket__title|\.ticket__stamp)/.test(k) && k !== '.ticket__stamp#0 text-align') || /^\.ticket#0(?! \(altura\))/.test(k),
  },
  rodape: { sel: 'footer', pecas: ['.footer__logo', '.footer__sig'], conta: (k) => k.startsWith('.footer__logo') },
};

// font-variation-settings/font-stretch entram como EIXOS EFETIVOS (wdth, opsz): o site usa font-stretch para a largura (WebKit).
const PROPS = ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'line-height', 'text-transform', 'text-align', 'rotate', 'transform', 'border-radius', 'border-top-width', 'border-top-color', 'box-shadow', 'padding-top', 'padding-left', 'opacity'];

async function preparar(page: Page, url: string, css: string) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: css });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(40); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

/** Medidas (x, y, largura, altura) e estilos de cada peça, por seletor e índice. */
async function medir(page: Page, sel: string, pecas: string[]) {
  return page.evaluate(([s, ps, props]) => {
    const raiz = document.querySelector(s as string)!;
    const r0 = raiz.getBoundingClientRect();
    const geo: Record<string, number[]> = { '': [0, 0, Math.round(r0.width), Math.round(r0.height)] };
    const css: Record<string, string> = {};
    for (const p of ps as string[]) raiz.querySelectorAll(p).forEach((el, i) => {
      const r = el.getBoundingClientRect();
      geo[`${p}#${i}`] = [r.left - r0.left, r.top - r0.top, r.width, r.height].map((n) => Math.round(n * 10) / 10);
      const cs = getComputedStyle(el);
      for (const k of props as string[]) css[`${p}#${i} ${k}`] = cs.getPropertyValue(k).replace(/"/g, '');
      const fvs = cs.fontVariationSettings;
      const wdth = /wdth"?\s+([\d.]+)/.exec(fvs)?.[1] ?? String(parseFloat(cs.fontStretch) || 100);
      const opsz = /opsz"?\s+([\d.]+)/.exec(fvs)?.[1] ?? 'auto';
      css[`${p}#${i} eixos`] = `wdth ${Number(wdth)} · opsz ${opsz}`;
    });
    return { geo, css };
  }, [sel, pecas, PROPS] as const);
}

test.describe('Fidelidade ao protótipo aprovado · 390×844', () => {
  test.beforeEach(async ({ page }) => {
    // O v1 carrega as fontes do Google; trocamos pelos MESMOS arquivos auto-hospedados do site.
    const html = await (await page.request.get(SITE)).text();
    const fontes = [...html.matchAll(/href="(\/_astro\/[^"]+\.woff2)"/g)].map((m) => SITE.replace(/\/$/, '') + m[1]);
    const bric = fontes.find((f) => f.includes('bricolage'));
    const frau = fontes.find((f) => f.includes('fraunces'));
    expect(bric && frau, 'fontes do site').toBeTruthy();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body:
      `@font-face{font-family:"Bricolage Grotesque";font-style:normal;font-weight:200 800;font-stretch:75% 100%;src:url(${bric}) format("woff2")}
       @font-face{font-family:"Fraunces";font-style:italic;font-weight:100 900;src:url(${frau}) format("woff2")}` }));
  });

  for (const [nome, s] of Object.entries(SECOES)) {
    test(nome, async ({ page, browser }) => {
      await preparar(page, V1, OCULTAR_V1);
      const a = await medir(page, s.sel, s.pecas);
      const capV1 = await page.locator(s.sel).first().screenshot({ animations: 'disabled' });
      const pixV1 = s.pixels ? await page.locator(s.sel).first().screenshot({ mask: [page.locator('img, video')], maskColor: '#FF00FF', animations: 'disabled' }) : null;

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const site = await ctx.newPage();
      await preparar(site, SITE, OCULTAR_SITE);
      if (nome === 'reserva') await site.locator('.chips--dates .chip[role="radio"]').first().waitFor();
      const b = await medir(site, s.sel, s.pecas);
      test.info().attach(`${nome}-v1.png`, { body: capV1, contentType: 'image/png' });
      test.info().attach(`${nome}-site.png`, { body: await site.locator(s.sel).first().screenshot({ animations: 'disabled' }), contentType: 'image/png' });

      const conta = s.conta ?? (() => true);
      const geo: string[] = [];
      for (const k of Object.keys(a.geo)) {
        if (!b.geo[k]) { geo.push(`${k}: ausente no site`); continue; }
        const d = a.geo[k].map((v, i) => Math.abs(v - b.geo[k][i]));
        const altura = d[3] > 1 && Math.max(d[0], d[1], d[2]) <= 1;
        if (Math.max(...d) > 1) geo.push(`${k}${altura ? ' (altura)' : ''}: v1 ${a.geo[k].join(',')} · site ${b.geo[k].join(',')}`);
      }
      const css = Object.keys(a.css).filter((k) => a.css[k] !== b.css[k]).map((k) => `${k}: v1 "${a.css[k]}" · site "${b.css[k] ?? '—'}"`);
      const geoReal = geo.filter((d) => conta(d.split(':')[0]));
      const cssReal = css.filter((d) => conta(d.split(':')[0]));
      test.info().annotations.push({ type: 'resultado', description: `${Object.keys(a.geo).length} peças · ${Object.keys(a.css).length} propriedades · ${geo.length - geoReal.length + css.length - cssReal.length} diferenças esperadas` });
      expect(geoReal, `peças fora do lugar em ${nome}`).toEqual([]);
      expect(cssReal, `estilos diferentes em ${nome}`).toEqual([]);

      if (pixV1) {
        const pixSite = await site.locator(s.sel).first().screenshot({ mask: [site.locator('img, video')], maskColor: '#FF00FF', animations: 'disabled' });
        const ref = test.info().snapshotPath(`${nome}.png`);
        fs.mkdirSync(path.dirname(ref), { recursive: true });
        fs.writeFileSync(ref, pixV1); // referência = o v1 capturado nesta execução
        expect(pixSite).toMatchSnapshot(`${nome}.png`, { maxDiffPixelRatio: 0.002, threshold: 0.12 });
      }
      await ctx.close();
    });
  }
});
