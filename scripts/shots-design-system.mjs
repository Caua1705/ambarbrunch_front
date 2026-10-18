// Capturas da página interna /design-system/ (seções principais), para revisão.
//   node scripts/shots-design-system.mjs [--base http://127.0.0.1:4321] [--sizes 390x844,1440x900] [--out reports/design-system]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:4321');
const OUT = path.resolve(arg('out', 'reports/design-system'));
const SIZES = arg('sizes', '390x844').split(',').map((s) => s.split('x').map(Number));
const SECOES = ['topo', 'identidade', 'cores', 'tipografia', 'espaco', 'componentes', 'reserva', 'colagens', 'movimento', 'telas'];

const b = await chromium.launch();
try {
  for (const [w, h] of SIZES) {
    const mobile = w < 960;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    const erros = [];
    p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    p.on('pageerror', (e) => erros.push(String(e)));
    await p.goto(`${BASE}/design-system/`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }));
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += h) { await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(120); }
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(800);
    await p.addStyleTag({ content: '.sticky-cta,.menu-btn--fixo,.review-flag,.ds-nav{visibility:hidden!important}' });
    const dir = path.join(OUT, `${w}`);
    fs.mkdirSync(dir, { recursive: true });
    let i = 0;
    for (const id of SECOES) {
      const el = p.locator(`#${id}`);
      if (await el.count()) await el.screenshot({ path: path.join(dir, `${String(i++).padStart(2, '0')}-${id}.png`), animations: 'disabled' });
    }
    const ox = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(`${w}×${h}: altura ${total}px · overflow-x ${ox}px · erros ${erros.length}${erros.length ? '\n  ' + erros.join('\n  ') : ''}`);
    await ctx.close();
  }
} finally { await b.close(); }
