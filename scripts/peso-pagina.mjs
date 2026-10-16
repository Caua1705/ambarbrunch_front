// Bytes transferidos: 1ª tela e página inteira rolada (390×844, DPR 2 e 3), por tipo. Vídeo só se tocar.
//   node scripts/peso-pagina.mjs [url] [--motion reduce|no-preference]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4324/';
const motion = process.argv.includes('--motion') ? process.argv[process.argv.indexOf('--motion') + 1] : 'reduce';
const b = await chromium.launch();
try {
  for (const dpr of [2, 3]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, reducedMotion: motion });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    const porReq = new Map();
    const tipo = new Map();
    cdp.on('Network.responseReceived', (e) => tipo.set(e.requestId, e.type));
    cdp.on('Network.loadingFinished', (e) => porReq.set(e.requestId, e.encodedDataLength));
    const soma = () => { const t = {}; for (const [id, n] of porReq) { const k = tipo.get(id) ?? 'Other'; t[k] = (t[k] ?? 0) + n; } t.total = Object.values(t).reduce((s, x) => s + x, 0); return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, `${Math.round(v / 1024)} KB`])); };
    await page.goto(url, { waitUntil: 'networkidle' });
    const primeira = soma();
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 400) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(120); }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    console.log(JSON.stringify({ url, dpr, movimento: motion, primeiraTela: primeira, paginaInteira: soma() }));
    await ctx.close();
  }
} finally { await b.close(); }
