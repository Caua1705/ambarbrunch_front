// Teste de paridade visual: protótipo aprovado (v1, congelado) × página montada com o design system.
// Compara seção por seção, pixel a pixel, num <canvas> do próprio navegador. Sem dependências.
//
//   node experiments/serve.mjs                         (em outro terminal)
//   node experiments/design-system/tools/parity.mjs    [--base http://127.0.0.1:4173] [--sizes 390x844,360x740]
//
// Saída: experiments/screenshots/paridade/ (fora do Git) com v1, ds e diff de cada seção + relatorio.json.
// Determinismo: prefers-reduced-motion emulado nas duas páginas (sem loops, sem revelação), mesmo dia, mesmas fontes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const BASE = arg('base', 'http://127.0.0.1:4173');
const SIZES = arg('sizes', '390x844,360x740,375x667,430x932').split(',').map((s) => s.split('x').map(Number));
const V1 = arg('v1', `${BASE}/experiments/concept-b-aprovado-v1/`);
const DS = arg('ds', `${BASE}/experiments/design-system/paridade-v1.html`);
const OUT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../screenshots/paridade');
const SECTIONS = { hero: 'header.hero', ticker: '.ticker', mesa: '#gastronomia', roll: '#roll', climas: '#ambientes', reserva: '#reservar', footer: 'footer' };
const T0 = Date.now();
const step = process.env.DEBUG ? (m) => console.error('·', ((Date.now() - T0) / 1000).toFixed(1) + 's', m) : () => {};
const TOL = 24; // diferença máxima por canal (0–255) para contar como igual (antialiasing de subpixel)

fs.mkdirSync(OUT, { recursive: true });
step('iniciando navegador');
const b = await launch({ port: 9351, profile: fs.mkdtempSync(path.join(os.tmpdir(), 'ambar-parity-')) });

async function capture(page, url, w, h, prefix) {
  await page.send('Page.bringToFront'); // aba de fundo não gera quadros: a captura travaria
  await page.viewport(w, h, 2, true);
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  step(`abrindo ${url} em ${w}×${h}`);
  await page.goto(url, 1200);
  step('carregou');
  await page.eval(`document.fonts.ready.then(() => true)`);
  // percorre a página para carregar as imagens lazy, volta ao topo e espera tudo decodificar
  const total = await page.eval('document.documentElement.scrollHeight');
  for (let y = 0; y < total; y += 500) { await page.eval(`scrollTo(0, ${y})`); await sleep(80); }
  await page.eval(`scrollTo(0, 0)`);
  step('rolou');
  await page.eval(`Promise.race([
    Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))),
    new Promise((r) => setTimeout(r, 8000)),
  ]).then(() => [...document.images].filter((i) => !i.complete).length)`);
  await sleep(500);
  step('imagens prontas');
  const shots = {};
  for (const [name, sel] of Object.entries(SECTIONS)) {
    const r = await page.eval(`(() => { const e = document.querySelector('${sel}').getBoundingClientRect(); return { x: 0, y: Math.round(e.top + scrollY), w: innerWidth, h: Math.round(e.height) } })()`);
    const file = path.join(OUT, `${w}x${h}`, `${prefix}-${name}.png`);
    await page.shot(file, { clip: r });
    step(`captura ${name} ${r.h}px`);
    shots[name] = { file, h: r.h, y: r.y };
  }
  return shots;
}

async function compare(page, fileA, fileB, diffFile) {
  await page.send('Page.bringToFront');
  const a = fs.readFileSync(fileA).toString('base64');
  const c = fs.readFileSync(fileB).toString('base64');
  const res = await page.eval(`(async () => {
    const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const [A, B] = await Promise.all([load('data:image/png;base64,${a}'), load('data:image/png;base64,${c}')]);
    const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
    const ctx = (img) => { const cv = new OffscreenCanvas(w, h); const x = cv.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = ctx(A), db = ctx(B);
    const out = new OffscreenCanvas(w, h), ox = out.getContext('2d'), od = ox.createImageData(w, h);
    let diff = 0;
    for (let p = 0; p < da.length; p += 4) {
      const d = Math.max(Math.abs(da[p] - db[p]), Math.abs(da[p + 1] - db[p + 1]), Math.abs(da[p + 2] - db[p + 2]));
      if (d > ${TOL}) { diff++; od.data[p] = 230; od.data[p + 1] = 20; od.data[p + 2] = 60; od.data[p + 3] = 255; }
      else { const g = (da[p] + da[p + 1] + da[p + 2]) / 3; od.data[p] = od.data[p + 1] = od.data[p + 2] = 200 + g / 5; od.data[p + 3] = 255; }
    }
    ox.putImageData(od, 0, 0);
    const blob = await out.convertToBlob({ type: 'image/png' });
    const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { w, h, sameSize: A.width === B.width && A.height === B.height, diff, ratio: diff / (w * h), png: btoa(bin) };
  })()`);
  fs.writeFileSync(diffFile, Buffer.from(res.png, 'base64'));
  delete res.png;
  return res;
}

const report = { data: new Date().toISOString(), v1: V1, ds: DS, tolerancia: TOL, dpr: 2, resultados: {} };
try {
  const page = await b.newPage();
  const cmp = await b.newPage({ width: 400, height: 400, dpr: 1, mobile: false });
  await cmp.goto('about:blank', 100);
  for (const [w, h] of SIZES) {
    const A = await capture(page, V1, w, h, 'v1');
    const B = await capture(page, DS, w, h, 'ds');
    const res = {};
    for (const name of Object.keys(SECTIONS)) {
      res[name] = await compare(cmp, A[name].file, B[name].file, path.join(OUT, `${w}x${h}`, `diff-${name}.png`));
      res[name].alturas = [A[name].h, B[name].h];
    }
    report.resultados[`${w}x${h}`] = res;
    console.log(`\n${w}×${h}`);
    for (const [name, r] of Object.entries(res)) console.log(`  ${name.padEnd(8)} ${r.sameSize ? 'mesmo tamanho' : `TAMANHO ${r.alturas.join(' → ')}`}  ${(r.ratio * 100).toFixed(3)}% dos pixels (${r.diff})`);
  }
  if (page.logs.length) console.log('\nconsole:', page.logs);
  fs.writeFileSync(path.join(OUT, 'relatorio.json'), JSON.stringify(report, null, 2));
  console.log(`\nrelatório: ${path.join(OUT, 'relatorio.json')}`);
} finally { await b.close(); }
