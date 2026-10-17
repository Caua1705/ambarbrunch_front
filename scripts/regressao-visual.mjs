// Regressão visual do PRÓPRIO site (antes × depois de uma refatoração). Sem dependências além do Playwright.
//
//   node scripts/regressao-visual.mjs capturar <rótulo> [--base http://127.0.0.1:4321] [--browsers chromium,webkit]
//   node scripts/regressao-visual.mjs comparar <rótulo-a> <rótulo-b>
//
// Captura: página inteira de /, /reservar/ e /privacidade/ em 360, 375, 390, 430, 768 e 1440 px, no Chromium e no WebKit,
// com movimento reduzido (tudo no estado final), fixos ocultos e vídeos ocultos (o quadro do vídeo não é determinístico).
// Também grava os ESTILOS CALCULADOS de todos os elementos (Chromium), que pegam o que o pixel não mostra:
// durações, curvas, estados ocultos (erro, desabilitado) e transições.
// Comparação: pixels diferentes por captura (decodificados num canvas do próprio navegador) + diferenças de estilo.
// Saída em reports/regressao/<rótulo>/ (fora do Git).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const [, , modo, a, b] = process.argv;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:4321');
const RAIZ = path.resolve('reports/regressao');
const TAMANHOS = [[360, 740], [375, 667], [390, 844], [430, 932], [768, 1024], [1440, 900]];
const PAGINAS = { home: '/', reservar: '/reservar/', privacidade: '/privacidade/' };
const OCULTAR = '.sticky-cta,.menu-btn--dock,.review-flag{display:none!important} video{visibility:hidden!important} *{caret-color:transparent!important}';
const PROPS = ['display', 'position', 'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch',
  'font-variation-settings', 'letter-spacing', 'line-height', 'text-transform', 'text-align', 'text-decoration-line', 'text-decoration-thickness', 'text-underline-offset',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'gap', 'row-gap', 'column-gap',
  'width', 'height', 'max-width', 'min-height', 'top', 'right', 'bottom', 'left', 'z-index', 'opacity', 'rotate', 'translate', 'scale', 'transform',
  'border-top-width', 'border-top-style', 'border-top-color', 'border-bottom-width', 'border-bottom-style', 'border-bottom-color', 'border-top-left-radius', 'border-bottom-right-radius',
  'box-shadow', 'filter', 'mix-blend-mode', 'mask-image', 'clip-path', 'object-fit', 'aspect-ratio',
  'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay',
  'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count'];

async function preparar(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: OCULTAR });
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }));
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  for (let y = 0; y < h; y += Math.round(vh * 0.8)) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(40); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const espera = (img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }));
    await Promise.race([Promise.all([...document.images].map(espera)), new Promise((r) => setTimeout(r, 8000))]);
  });
  await page.waitForTimeout(250);
}

async function estilos(page) {
  return page.evaluate((props) => {
    const out = {};
    const nome = (el) => {
      const partes = [];
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const irmaos = e.parentElement ? [...e.parentElement.children].filter((x) => x.tagName === e.tagName) : [];
        partes.unshift(`${e.tagName.toLowerCase()}${[...e.classList].filter((c) => c !== 'is-visible').map((c) => '.' + c).join('')}${irmaos.length > 1 ? `:${irmaos.indexOf(e) + 1}` : ''}`);
      }
      return partes.join(' > ');
    };
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const k = nome(el);
      for (const pseudo of ['', '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo || null);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
        const v = {};
        for (const p of props) v[p] = cs.getPropertyValue(p);
        if (pseudo) v.content = cs.content;
        out[k + pseudo] = v;
      }
    }
    return out;
  }, PROPS);
}

async function capturar(rotulo) {
  const dir = path.join(RAIZ, rotulo);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const nomeMotor of arg('browsers', 'chromium,webkit').split(',')) {
    const motor = nomeMotor === 'webkit' ? webkit : chromium;
    const browser = await motor.launch();
    try {
      for (const [w, h] of TAMANHOS) {
        const mobile = w < 960;
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        for (const [nome, rota] of Object.entries(PAGINAS)) {
          await preparar(page, BASE + rota);
          const arq = `${nomeMotor}-${w}-${nome}`;
          await page.screenshot({ path: path.join(dir, `${arq}.png`), fullPage: true, animations: 'disabled' });
          if (nomeMotor === 'chromium') fs.writeFileSync(path.join(dir, `${arq}.json`), JSON.stringify(await estilos(page)));
          process.stdout.write('.');
        }
        await ctx.close();
      }
    } finally { await browser.close(); }
  }
  console.log(`\ncapturado: ${dir}`);
}

async function comparar(ra, rb) {
  const da = path.join(RAIZ, ra), db = path.join(RAIZ, rb), dd = path.join(RAIZ, `diff-${ra}-${rb}`);
  fs.rmSync(dd, { recursive: true, force: true });
  fs.mkdirSync(dd, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const linhas = [];
  let totalPx = 0, totalEstilos = 0;
  try {
    for (const f of fs.readdirSync(da).filter((x) => x.endsWith('.png')).sort()) {
      if (!fs.existsSync(path.join(db, f))) { linhas.push(`${f}: AUSENTE em ${rb}`); continue; }
      const res = await page.evaluate(async ([x, y]) => {
        const carregar = (src) => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
        const [ia, ib] = await Promise.all([carregar(x), carregar(y)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { tamanho: `${ia.width}×${ia.height} → ${ib.width}×${ib.height}` };
        const ler = (img) => { const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height); };
        const pa = ler(ia).data, pb = ler(ib).data;
        let n = 0, y0 = Infinity, y1 = -1;
        const W = ia.width;
        const mapa = new OffscreenCanvas(W, ia.height); const gm = mapa.getContext('2d'); gm.drawImage(ib, 0, 0); gm.fillStyle = 'rgba(255,255,255,.75)'; gm.fillRect(0, 0, W, ia.height);
        const dm = gm.getImageData(0, 0, W, ia.height);
        for (let i = 0; i < pa.length; i += 4) {
          if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2] || pa[i + 3] !== pb[i + 3]) {
            n++; const yy = Math.floor(i / 4 / W); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
            dm.data[i] = 230; dm.data[i + 1] = 0; dm.data[i + 2] = 60; dm.data[i + 3] = 255;
          }
        }
        if (!n) return { n };
        gm.putImageData(dm, 0, 0);
        const blob = await mapa.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { n, faixa: [y0, y1], png: btoa(bin) };
      }, [`data:image/png;base64,${fs.readFileSync(path.join(da, f)).toString('base64')}`, `data:image/png;base64,${fs.readFileSync(path.join(db, f)).toString('base64')}`]);
      if (res.tamanho) { linhas.push(`${f}: tamanho mudou (${res.tamanho})`); totalPx += 1; continue; }
      totalPx += res.n;
      if (res.n) { fs.writeFileSync(path.join(dd, f), Buffer.from(res.png, 'base64')); linhas.push(`${f}: ${res.n} px diferentes (y ${res.faixa[0]}–${res.faixa[1]})`); }
      else linhas.push(`${f}: 0 px`);
    }
    for (const f of fs.readdirSync(da).filter((x) => x.endsWith('.json')).sort()) {
      if (!fs.existsSync(path.join(db, f))) continue;
      const ja = JSON.parse(fs.readFileSync(path.join(da, f), 'utf8')), jb = JSON.parse(fs.readFileSync(path.join(db, f), 'utf8'));
      const dif = [];
      for (const k of new Set([...Object.keys(ja), ...Object.keys(jb)])) {
        if (!ja[k] || !jb[k]) { dif.push(`${k}: ${ja[k] ? 'removido' : 'novo'}`); continue; }
        for (const p of Object.keys(ja[k])) if (ja[k][p] !== jb[k][p]) dif.push(`${k} { ${p}: ${ja[k][p]} → ${jb[k][p]} }`);
      }
      totalEstilos += dif.length;
      linhas.push(`${f}: ${dif.length} estilos diferentes`);
      if (dif.length) fs.writeFileSync(path.join(dd, f.replace('.json', '.estilos.txt')), dif.join('\n'));
    }
  } finally { await browser.close(); }
  const resumo = `${ra} × ${rb}: ${totalPx} px diferentes · ${totalEstilos} estilos diferentes`;
  fs.writeFileSync(path.join(dd, 'RESUMO.txt'), [resumo, '', ...linhas].join('\n'));
  console.log(linhas.join('\n'));
  console.log(`\n${resumo}\ndetalhes: ${dd}`);
  process.exitCode = totalPx || totalEstilos ? 1 : 0;
}

if (modo === 'capturar' && a) await capturar(a);
else if (modo === 'comparar' && a && b) await comparar(a, b);
else console.log('uso: capturar <rótulo> | comparar <a> <b>');
