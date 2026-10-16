// Lighthouse (perfil MÓVEL padrão: celular intermediário, 4G lento simulado, CPU 4× mais lenta).
//   node scripts/lighthouse.mjs [url ...]      (padrão: build de produção em :4323 e de revisão em :4321)
// Usa o Chromium do Playwright. Resultado: reports/lighthouse-*.json + resumo no terminal.
import fs from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '@playwright/test';

const RODADAS = Number(process.env.RODADAS ?? 3);
const urls = process.argv.slice(2).length ? process.argv.slice(2) : ['http://127.0.0.1:4323/', 'http://127.0.0.1:4324/'];
fs.mkdirSync('reports', { recursive: true });
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
try {
  for (const url of urls) {
    const execucoes = [];
    for (let k = 0; k < RODADAS; k++) execucoes.push((await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] })).lhr);
    execucoes.sort((x, y) => x.categories.performance.score - y.categories.performance.score);
    const r = { lhr: execucoes[Math.floor(execucoes.length / 2)] };   // mediana
    const lhr = r.lhr;
    const a = lhr.audits;
    const itens = a['resource-summary']?.details?.items ?? [];
    const kb = (t) => Math.round((itens.find((i) => i.resourceType === t)?.transferSize ?? 0) / 1024);
    const resumo = {
      url,
      notas: Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, Math.round(c.score * 100)])),
      FCP: a['first-contentful-paint'].displayValue,
      LCP: a['largest-contentful-paint'].displayValue,
      TBT: a['total-blocking-time'].displayValue,
      CLS: a['cumulative-layout-shift'].displayValue,
      SpeedIndex: a['speed-index'].displayValue,
      elementoLCP: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 120),
      transferenciaKB: { total: kb('total'), imagens: kb('image'), fontes: kb('font'), scripts: kb('script'), css: kb('stylesheet'), html: kb('document'), video: kb('media') },
    };
    resumo.rodadas = execucoes.map((e) => Math.round(e.categories.performance.score * 100) + ' / LCP ' + e.audits['largest-contentful-paint'].displayValue);
    const nome = new URL(url).port === '4323' ? 'producao' : 'revisao';
    fs.writeFileSync(path.join('reports', `lighthouse-${nome}.json`), JSON.stringify(lhr, null, 1));
    console.log(JSON.stringify(resumo, null, 2));
  }
} finally { await chrome.kill(); }
