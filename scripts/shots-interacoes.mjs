// Capturas das interações da rodada de 2026-10-17: cardápio tátil, ficha nutricional, baralho de bebidas,
// anatomia do roll (montando e montada) e carrossel de criadores. Movimento normal.
//   node scripts/shots-interacoes.mjs [--base http://127.0.0.1:4325] [--sizes 390x844] [--out reports/interacoes]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:4325');
const SIZES = arg('sizes', '390x844').split(',').map((s) => s.split('x').map(Number));
const OUT = path.resolve(arg('out', 'reports/interacoes'));
const b = await chromium.launch();
try {
  for (const [w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const erros = []; page.on('pageerror', (e) => erros.push(String(e)));
    const dir = path.join(OUT, `${w}x${h}`); fs.mkdirSync(dir, { recursive: true });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.sticky-cta,.menu-btn--fixo{display:none!important}' });
    const shot = (nome) => page.screenshot({ path: path.join(dir, `${nome}.png`) });
    const centro = (sel) => page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    // cardápio tátil
    await centro('[data-categoria="sanduiches"]'); await page.waitForTimeout(600);
    await page.locator('[data-categoria="sanduiches"]').click(); await page.waitForTimeout(900);
    await centro('#painel-comer'); await page.waitForTimeout(500); await shot('01-cardapio-sanduiches');
    await page.locator('[data-categoria="rolls"]').click(); await page.waitForTimeout(900);
    await centro('#painel-comer'); await page.waitForTimeout(500); await shot('02-cardapio-rolls');
    await page.locator('[data-categoria="rolls"]').click(); await page.waitForTimeout(500);
    // anatomia
    await centro('.anatomia'); await page.waitForTimeout(420); await shot('03-anatomia-montando');
    await page.waitForTimeout(2200); await shot('04-anatomia-montada');
    // baralho de bebidas
    if (await page.locator('[data-baralho]').count()) {
      await centro('[data-baralho]'); await page.waitForTimeout(900); await shot('05-baralho');
      const atras = page.locator('[data-baralho] [data-pos="2"]');
      if (await atras.count()) { const bb = await atras.boundingBox(); await page.mouse.click(bb.x + bb.width * .7, bb.y + 24); await page.waitForTimeout(1100); await shot('06-baralho-cartao-a-frente'); }
    }
    // ficha nutricional
    if (await page.locator('.ficha').count()) {
      await centro('.ficha'); await page.locator('.ficha summary').click(); await page.waitForTimeout(1100);
      await centro('.prato__card'); await page.waitForTimeout(300); await shot('07-ficha-aberta');
    }
    // carrossel
    await centro('[data-trilho]'); await page.waitForTimeout(2600); await shot('08-carrossel');
    await page.locator('[data-trilho] .story').first().locator('[data-som]').click().catch(() => {}); await page.waitForTimeout(800); await shot('09-carrossel-som');
    console.log(`${w}×${h}: erros ${erros.length}${erros.length ? ' ' + erros.join(' | ') : ''}`);
    await ctx.close();
  }
} finally { await b.close(); }
