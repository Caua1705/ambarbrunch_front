// Screenshots de revisão (mobile primeiro): 1ª tela + cada seção, por viewport e navegador.
//   node scripts/shots.mjs [--base http://127.0.0.1:4321] [--sizes 390x844,360x740] [--browser chromium|webkit] [--out reports/shots] [--motion reduce|no-preference]
// A doca fixa é escondida nas capturas de seção (aparece só nas de 1ª tela e de estado).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:4321');
const SIZES = arg('sizes', '390x844,360x740,375x667,430x932').split(',').map((s) => s.split('x').map(Number));
const BROWSER = arg('browser', 'chromium');
const OUT = path.resolve(arg('out', 'reports/shots'));
const MOTION = arg('motion', 'reduce');
const PATH = arg('path', '/');
const SECOES = { hero: 'header.hero', faixa: '.ticker', novo: '#novo', mesa: '#gastronomia', fornada: '#roll', 'cafe-roll': '#cafe-roll', saladas: '#saladas', provou: '#quem-provou', lugar: '#ambientes', reserva: '#reservar', visite: '#visite', rodape: 'footer' };

const engine = BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch();
try {
  for (const [w, h] of SIZES) {
    const mobile = w < 960;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile && BROWSER !== 'firefox', hasTouch: mobile, reducedMotion: MOTION });
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', (e) => erros.push(String(e)));
    page.on('response', (r) => { if (r.status() >= 400) erros.push(`${r.status()} ${r.url()}`); });
    await page.goto(BASE + PATH, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(MOTION === 'reduce' ? 300 : 1600);
    const dir = path.join(OUT, `${BROWSER}-${w}x${h}`);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, '00-primeira-tela.png') });
    // percorre a página (carrega imagens lazy e dispara revelações), volta ao topo
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += Math.round(h * 0.7)) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(MOTION === 'reduce' ? 60 : 250); }
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForLoadState('networkidle');
    const ox = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.addStyleTag({ content: '.sticky-cta,.menu-btn--fixo,.review-flag{display:none!important}' });
    let i = 1;
    for (const [nome, sel] of Object.entries(SECOES)) {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      await el.screenshot({ path: path.join(dir, `${String(i++).padStart(2, '0')}-${nome}.png`), animations: 'disabled' });
    }
    console.log(`${BROWSER} ${w}×${h}: overflow-x ${ox}px · altura ${total}px · erros ${erros.length}${erros.length ? '\n  ' + erros.join('\n  ') : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); }
