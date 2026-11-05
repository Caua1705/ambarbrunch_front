// Gera o PDF oficial do cardápio a partir do catálogo do backend (a mesma fonte do site): npm run cardapio:pdf.
// O PDF é vetorial (texto de verdade, fontes da marca embutidas), em A4. Depois de gerar, confere nome e preço de cada item, procura texto
// cortado e renderiza as páginas para a conferência visual (scripts/cardapio_pdf_conferir.py). Só com tudo certo troca o PDF público e
// grava a assinatura do catálogo em src/data/cardapio-pdf.json, que o build do site compara com a API. Ver docs/technical/CARDAPIO.md.
// Em Node 24: importa o .ts direto (sem tipos em tempo de execução).
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { assinaturaCatalogo, formatarPreco, temCentavos, validarCatalogo } from '../src/lib/cardapio/contrato.ts';
import { lerFonte } from '../src/lib/cardapio/fonte.ts';

const RAIZ = process.cwd();
const FINAL = path.join(RAIZ, 'public/cardapio/cardapio-ambar.pdf');
const MANIFESTO = path.join(RAIZ, 'src/data/cardapio-pdf.json');
const PAGINAS_DIR = path.join(RAIZ, 'reports/cardapio-pdf');

// Onde cada categoria entra (ids do backend). Categoria nova sem lugar interrompe a geração.
const PAGINAS = [
  { titulo: 'Menu', blocos: [['croissants', 'brunches'], ['sanduiches']] },
  { titulo: 'Menu', continuacao: true, blocos: [['bowls'], ['cinnamon_rolls', 'cheesecakes']] },
  // fecho: os adicionais sem categoria definida e esta categoria fecham a página, em três colunas, como na arte
  { titulo: 'Menu Drinks', blocos: [['cafes', 'sucos'], ['cafes_gelados']], fecho: 'outras_bebidas' },
];

const b64 = (f) => fs.readFileSync(path.join(RAIZ, f)).toString('base64');
const fonte = (familia, arquivo, estilo) => `@font-face { font-family: "${familia}"; font-style: ${estilo}; font-weight: 100 900; src: url(data:font/woff2;base64,${b64(`node_modules/@fontsource-variable/${arquivo}`)}) format("woff2"); }`;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const CSS = `
${fonte('Bricolage', 'bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2', 'normal')}
${fonte('Fraunces', 'fraunces/files/fraunces-latin-standard-normal.woff2', 'normal')}
${fonte('Fraunces', 'fraunces/files/fraunces-latin-standard-italic.woff2', 'italic')}
@page { size: A4; margin: 0; }
:root { --vinho: #670D27; --suave: #5b3a3f; --linha: #d9c3c8; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: var(--vinho); font-family: Bricolage, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pagina { width: 210mm; height: 297mm; padding: 13mm 15mm 11mm; display: flex; flex-direction: column; overflow: hidden; break-after: page; }
.pagina:last-child { break-after: auto; }
.topo { border-top: 1.2mm solid var(--vinho); padding-top: 4mm; text-align: center; }
.topo h1 { font-size: 46pt; font-weight: 800; line-height: 1; letter-spacing: .01em; text-transform: uppercase; }
.topo--curto h1 { font-size: 24pt; }
.corpo { flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 4mm; padding-block: 3mm; min-height: 0; }
.pagina--curta .corpo { justify-content: space-evenly; }
.linha { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 9mm; }
.linha + .linha { border-top: .4mm solid var(--vinho); padding-top: 5mm; }
h2 { font-family: Fraunces, Georgia, serif; font-size: 24pt; font-weight: 700; line-height: 1.05; text-transform: uppercase; }
.obs { font-family: Fraunces, Georgia, serif; font-style: italic; font-size: 11pt; line-height: 1.25; color: var(--suave); margin-top: 1mm; }
.itens { list-style: none; margin-top: 3mm; display: grid; gap: 2.6mm; }
.item { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 4mm; align-items: baseline; break-inside: avoid; }
.item b { font-size: 12.5pt; font-weight: 800; line-height: 1.15; }
.item .caixa { text-transform: uppercase; letter-spacing: .02em; }
.item em { font-family: Fraunces, Georgia, serif; font-style: normal; font-size: 13pt; font-weight: 700; white-space: nowrap; font-variant-numeric: lining-nums; }
.item p { grid-column: 1; font-size: 10.5pt; line-height: 1.28; color: var(--suave); margin-top: .5mm; }
.pontos .item { grid-template-columns: auto minmax(6mm, 1fr) auto; column-gap: 2mm; }
.pontos .item i { border-bottom: .35mm dotted var(--vinho); translate: 0 -1mm; }
.gelados { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5mm 7mm; margin-top: 3mm; }
.gelados li { text-align: center; }
.gelados b { display: block; font-size: 12.5pt; font-weight: 800; line-height: 1.12; text-transform: uppercase; letter-spacing: .02em; }
.gelados p { font-size: 10.5pt; line-height: 1.25; color: var(--suave); margin-top: .8mm; }
.gelados em { display: block; font-family: Fraunces, Georgia, serif; font-style: normal; font-size: 14pt; font-weight: 700; margin-top: .8mm; }
.caixa-add { border: .4mm solid var(--vinho); border-radius: 4mm; padding: 3mm 4.5mm; margin-top: 3.5mm; }
.caixa-add h3 { font-family: Fraunces, Georgia, serif; font-size: 13pt; font-weight: 700; text-transform: uppercase; line-height: 1.1; }
.caixa-add ul { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1mm 6mm; margin-top: 1.6mm; }
.caixa-add li { display: flex; justify-content: space-between; gap: 2mm; font-size: 10.5pt; font-weight: 600; white-space: nowrap; }
.tres { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7mm; border-top: .4mm solid var(--vinho); padding-top: 4mm; }
.tres h3 { font-size: 12.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; padding-bottom: 1mm; border-bottom: .3mm solid var(--vinho); }
.tres ul { list-style: none; display: grid; gap: 1.2mm; margin-top: 2mm; }
.tres li { display: flex; justify-content: space-between; gap: 2mm; font-size: 10.5pt; font-weight: 600; }
.tres li span:last-child { white-space: nowrap; }
.rodape { display: flex; align-items: center; gap: 6mm; padding-top: 3mm; }
.rodape::before, .rodape::after { content: ""; flex: 1; border-top: .5mm solid var(--vinho); }
.rodape img { display: block; height: 12mm; width: auto; }
.rodape span { font-size: 13pt; font-weight: 700; }
.versao { text-align: center; font-size: 7.5pt; color: var(--suave); padding-top: 1.2mm; }
`;

const categoriaHtml = (c, adicionais) => {
  const centavos = temCentavos(c.itens);
  const preco = (p) => esc(formatarPreco(p, centavos));
  const semDescricao = c.itens.every((i) => !i.descricao);
  const itens = c.itens.map((i) => (semDescricao
    ? `<li class="item"><b class="caixa">${esc(i.nome)}</b><i></i><em>${preco(i.preco_centavos)}</em></li>`
    : `<li class="item"><b class="caixa">${esc(i.nome)}</b><em>${preco(i.preco_centavos)}</em>${i.descricao ? `<p>${esc(i.descricao)}</p>` : ''}</li>`)).join('');
  const caixas = adicionais.filter((g) => g.aplicavel_a.includes(c.id)).map((g) => `<div class="caixa-add"><h3>${esc(g.nome)}</h3><ul>${g.itens.map((a) => `<li><span>${esc(a.nome)}</span><span>+ ${esc(formatarPreco(a.preco_centavos))}</span></li>`).join('')}</ul></div>`).join('');
  return `<section><h2>${esc(c.nome)}</h2>${c.observacao ? `<p class="obs">${esc(c.observacao)}</p>` : ''}<ul class="itens${semDescricao ? ' pontos' : ''}">${itens}</ul>${caixas}</section>`;
};

const geladosHtml = (c) => {
  const centavos = temCentavos(c.itens);
  return `<section><h2>${esc(c.nome)}</h2><ul class="gelados">${c.itens.map((i) => `<li><b>${esc(i.nome)}</b>${i.descricao ? `<p>${esc(i.descricao)}</p>` : ''}<em>${esc(formatarPreco(i.preco_centavos, centavos))}</em></li>`).join('')}</ul></section>`;
};

function montarHtml(catalogo, logoRoll) {
  const porId = new Map(catalogo.categorias.map((c) => [c.id, c]));
  const usadas = PAGINAS.flatMap((p) => [...p.blocos.flat(), ...(p.fecho ? [p.fecho] : [])]);
  const fora = catalogo.categorias.filter((c) => !usadas.includes(c.id)).map((c) => c.id);
  if (fora.length) throw new Error(`Categoria sem lugar no PDF: ${fora.join(', ')}. Acrescente em PAGINAS (scripts/cardapio-pdf.mjs).`);
  const ausentes = usadas.filter((id) => !porId.has(id));
  if (ausentes.length) throw new Error(`Categoria do PDF que não veio no catálogo: ${ausentes.join(', ')}.`);

  const logos = `<img src="data:image/png;base64,${b64('src/assets/media/brand/logo-ambar.png')}" alt="Âmbar Café & Brunch"><span>×</span><img src="data:image/png;base64,${logoRoll}" alt="Roll">`;
  const semGrupo = catalogo.adicionais.filter((g) => !g.aplicavel_a.length);
  const fim = (rest) => rest.map((p) => `<div><h3>${esc(p.nome)}</h3><ul>${p.linhas.map(([n, v]) => `<li><span>${esc(n)}</span><span>${esc(v)}</span></li>`).join('')}</ul></div>`).join('');

  const paginas = PAGINAS.map((p, n) => {
    const blocos = p.blocos.map((ids) => `<div class="linha">${ids.map((id) => (id === 'cafes_gelados' ? geladosHtml(porId.get(id)) : categoriaHtml(porId.get(id), catalogo.adicionais))).join('')}</div>`).join('');
    let extra = '';
    if (p.fecho) {
      const outras = porId.get(p.fecho);
      extra = `<div class="tres">${fim([
        ...semGrupo.map((g) => ({ nome: g.nome, linhas: g.itens.map((a) => [a.nome, `+ ${formatarPreco(a.preco_centavos)}`]) })),
        { nome: outras.nome, linhas: outras.itens.map((i) => [i.nome, formatarPreco(i.preco_centavos, temCentavos(outras.itens))]) },
      ])}</div>`;
    }
    return `<article class="pagina${p.continuacao ? ' pagina--curta' : ''}" data-pagina="${n + 1}">
      <header class="topo${p.continuacao ? ' topo--curto' : ''}"><h1>${esc(p.titulo)}</h1></header>
      <main class="corpo">${blocos}${extra}</main>
      <footer class="rodape">${logos}</footer>
      <p class="versao">Cardápio versão ${esc(catalogo.versao)}</p>
    </article>`;
  }).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cardápio — Âmbar Café &amp; Brunch × Roll</title><style>${CSS}</style></head><body>${paginas}</body></html>`;
}

async function main() {
  const catalogo = validarCatalogo(await lerFonte());
  const assinatura = assinaturaCatalogo(catalogo);
  const trabalho = fs.mkdtempSync(path.join(os.tmpdir(), 'cardapio-pdf-'));
  const pdf = path.join(trabalho, 'cardapio.pdf');
  const dados = path.join(trabalho, 'catalogo.json');
  fs.writeFileSync(dados, JSON.stringify(catalogo));

  // o logo da Roll é preto no arquivo: no cardápio ele sai na tinta vinho, como nas artes
  const mascara = await sharp('src/assets/media/brand/logo-roll.png').ensureAlpha().extractChannel('alpha').toBuffer();
  const { width, height } = await sharp('src/assets/media/brand/logo-roll.png').metadata();
  const logoRoll = (await sharp({ create: { width, height, channels: 3, background: '#670D27' } }).joinChannel(mascara).png().toBuffer()).toString('base64');
  const html = montarHtml(catalogo, logoRoll);

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  await pagina.setContent(html, { waitUntil: 'load' });
  await pagina.evaluate(() => document.fonts.ready);
  const estouros = await pagina.$$eval('.pagina', (l) => l.map((p, n) => {
    const corpo = p.querySelector('.corpo');
    return corpo.scrollHeight > corpo.clientHeight + 1 ? `página ${n + 1}: ${corpo.scrollHeight - corpo.clientHeight}px além do espaço` : null;
  }).filter(Boolean));
  await pagina.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true, tagged: true, outline: false });
  await navegador.close();
  if (estouros.length) throw new Error(`Conteúdo não coube: ${estouros.join('; ')}`);

  fs.rmSync(PAGINAS_DIR, { recursive: true, force: true });
  fs.mkdirSync(PAGINAS_DIR, { recursive: true });
  const conferir = spawnSync('uv', ['run', '--no-project', '--with', 'pymupdf', 'python', 'scripts/cardapio_pdf_conferir.py', pdf, dados, PAGINAS_DIR], { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } });
  if (conferir.status !== 0) throw new Error('A conferência do PDF falhou: nada foi publicado.');

  fs.copyFileSync(pdf, FINAL);
  fs.writeFileSync(MANIFESTO, `${JSON.stringify({ versao: catalogo.versao, assinatura }, null, 2)}\n`);
  fs.rmSync(trabalho, { recursive: true, force: true });
  console.log(`PDF do catálogo ${catalogo.versao}: ${path.relative(RAIZ, FINAL)} (${Math.round(fs.statSync(FINAL).size / 1024)} KB). Páginas renderizadas em ${path.relative(RAIZ, PAGINAS_DIR)}: confira antes de publicar.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
