// Fluidez do scroll num celular intermediário (simulado): Chromium com CPU 4× mais lenta, 390×844, DPR 2,
// movimento normal (parallax, revelações, faixa e selo ligados). Rola a página inteira e mede cada quadro.
//   node scripts/scroll-perf.mjs [url] [cpu]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4324/';
const cpu = Number(process.argv[3] ?? 4);
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const r = await page.evaluate(() => new Promise((ok) => {
    const longas = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => longas.push(e.duration))).observe({ type: 'longtask', buffered: false });
    const deltas = []; let t0 = performance.now(); let y = 0;
    const total = document.documentElement.scrollHeight - innerHeight;
    const passo = () => {
      const t = performance.now(); deltas.push(t - t0); t0 = t;
      y += 14; scrollTo(0, y);                     // ~840 px/s a 60 fps: rolagem rápida de dedo
      if (y < total) requestAnimationFrame(passo);
      else ok({ deltas: deltas.slice(2), longas, total });
    };
    requestAnimationFrame(passo);
  }));
  const d = r.deltas;
  const media = d.reduce((s, x) => s + x, 0) / d.length;
  const p = (q) => [...d].sort((a, b2) => a - b2)[Math.floor(d.length * q)];
  console.log(JSON.stringify({
    url, cpu: `${cpu}× mais lenta`, alturaRolada: r.total, quadros: d.length,
    fpsMedio: Math.round(1000 / media),
    quadroMediano: `${p(0.5).toFixed(1)} ms`, p95: `${p(0.95).toFixed(1)} ms`, pior: `${Math.max(...d).toFixed(1)} ms`,
    acimaDe20ms: `${((d.filter((x) => x > 20).length / d.length) * 100).toFixed(1)}%`,
    acimaDe50ms: d.filter((x) => x > 50).length,
    tarefasLongas: r.longas.length, piorTarefa: r.longas.length ? `${Math.max(...r.longas).toFixed(0)} ms` : '—',
  }, null, 2));
} finally { await b.close(); }
