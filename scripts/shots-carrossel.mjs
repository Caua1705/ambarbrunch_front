// Capturas dos estados do carrossel “Reações reais” e da anatomia do roll (movimento normal).
//   node scripts/shots-carrossel.mjs [--base http://127.0.0.1:4321] [--sizes 390x844] [--out reports/shots-carrossel]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:4321');
const SIZES = arg('sizes', '390x844').split(',').map((s) => s.split('x').map(Number));
const OUT = path.resolve(arg('out', 'reports/shots-carrossel'));
const b = await chromium.launch();
try {
  for (const [w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const dir = path.join(OUT, `${w}x${h}`); fs.mkdirSync(dir, { recursive: true });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.sticky-cta,.menu-btn--fixo,.review-flag{display:none!important}' });
    const shot = (nome) => page.screenshot({ path: path.join(dir, `${nome}.png`) });
    // anatomia: entrando e montada
    await page.locator('.anatomia').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(350); await shot('a1-anatomia-montando');
    await page.waitForTimeout(1800); await shot('a2-anatomia-montada');
    // carrossel em feed: dois vídeos tocando lado a lado, mudos
    await page.locator('[data-trilho]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const card = (i) => page.locator('[data-trilho] .story').nth(i);
    await page.waitForTimeout(2600); await shot('c1-tres-tocando-mudos');
    await card(1).locator('[data-som]').click(); await page.waitForTimeout(900); await shot('c2-som-no-central');
    await card(2).locator('[data-som]').click(); await page.waitForTimeout(900); await shot('c3-som-passa-ao-vizinho');
    // o horizontal no centro, pelos pontos (o palco é um laço, sem rolagem nativa)
    const largo = await page.locator('[data-trilho] .story--wide').evaluate((c) => [...c.parentElement.children].indexOf(c)).catch(() => -1);
    if (largo >= 0) await page.locator('[data-ponto]').nth(largo).click();
    await page.waitForTimeout(2500); await shot('c5-horizontal');
    const r = await page.$$eval('[data-trilho] video', (vs) => vs.map((v) => `${v.paused ? 'P' : 'T'}${v.muted ? 'm' : 'S'}`).join(' '));
    console.log(`${w}×${h} estados finais dos vídeos: ${r}`);
    await ctx.close();
  }
} finally { await b.close(); }
