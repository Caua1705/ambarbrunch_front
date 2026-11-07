// Confere se os canais mostram o mesmo cardápio: npm run cardapio:conferir [site]
// Lê a API oficial e compara, item a item (id, nome e preço), com /cardapio/ do site indicado (padrão: produção) e com o PDF
// público, pela assinatura gravada ao gerá-lo. PDF entregue pelo dono é só imagem: confere pelo sha256 gravado ao assiná-lo (o conteúdo foi conferido
// a olho). Sai 0 com tudo igual e 1 na primeira divergência. Rodar depois de todo deploy.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assinaturaCatalogo, validarCatalogo } from '../src/lib/cardapio/contrato.ts';
import { lerFonte } from '../src/lib/cardapio/fonte.ts';

const site = (process.argv[2] || 'https://ambarbrunch.com').replace(/\/$/, '');
const manifesto = JSON.parse(fs.readFileSync('src/data/cardapio-pdf.json', 'utf8'));
const catalogo = validarCatalogo(await lerFonte());
const erros = [];
const ler = async (rota) => {
  const r = await fetch(`${site}${rota}?conferir=${Date.now()}`, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${rota}: HTTP ${r.status}`);
  return r;
};

const esperados = new Map([
  ...catalogo.categorias.flatMap((c) => c.itens.map((i) => [i.id, i.preco_centavos])),
  ...catalogo.adicionais.flatMap((g) => g.itens.map((i) => [i.id, i.preco_centavos])),
]);
const itensNoHtml = (html) => [...html.matchAll(/data-item="([^"]+)" data-preco="(\d+)"/g)].map((m) => [m[1], Number(m[2])]);

const pagina = itensNoHtml(await (await ler('/cardapio/')).text());
const vistos = new Set();
for (const [id, preco] of pagina) {
  if (vistos.has(id)) erros.push(`/cardapio/: produto repetido na página: ${id}`);
  vistos.add(id);
  if (!esperados.has(id)) erros.push(`/cardapio/: produto fora do catálogo: ${id}`);
  else if (esperados.get(id) !== preco) erros.push(`/cardapio/: preço de ${id} = ${preco}, catálogo = ${esperados.get(id)}`);
}
for (const id of esperados.keys()) if (!vistos.has(id)) erros.push(`/cardapio/: faltou ${id}`);

// a home não mostra produto nem preço: tudo mora em /cardapio/
const home = itensNoHtml(await (await ler('/')).text());
if (home.length) erros.push(`home: ${home.length} produtos com preço, a home não deveria ter nenhum`);

// o PDF público é o que o site publicou? E ele foi gerado deste catálogo?
if (assinaturaCatalogo(catalogo) !== manifesto.assinatura) erros.push(`PDF gerado do catálogo ${manifesto.versao}, a API está em ${catalogo.versao}: rode npm run cardapio:pdf`);
const pdf = Buffer.from(await (await ler('/cardapio/cardapio-ambar.pdf')).arrayBuffer());
const local = fs.readFileSync('public/cardapio/cardapio-ambar.pdf');
const hash = (b) => createHash('sha256').update(b).digest('hex');
if (hash(pdf) !== hash(local)) erros.push('o PDF público não é o do repositório (deploy pendente?)');

if (manifesto.pdf_sha256) {
  if (hash(pdf) !== manifesto.pdf_sha256) erros.push('o PDF público não é o entregue pelo dono');
} else {
  // e, lendo o PDF que está no ar, os mesmos nomes e preços (mesma conferência da geração)
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cardapio-conferir-'));
  fs.writeFileSync(path.join(pasta, 'cardapio.pdf'), pdf);
  fs.writeFileSync(path.join(pasta, 'catalogo.json'), JSON.stringify(catalogo));
  const r = spawnSync('uv', ['run', '--no-project', '--with', 'pymupdf', 'python', 'scripts/cardapio_pdf_conferir.py', path.join(pasta, 'cardapio.pdf'), path.join(pasta, 'catalogo.json'), pasta], { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } });
  if (r.status !== 0) erros.push('o PDF público não confere com o catálogo');
}

if (erros.length) {
  console.error(erros.map((e) => `ERRO ${e}`).join('\n'));
  process.exit(1);
}
// PDF do dono: confere o arquivo, não o conteúdo, e os Cinnamon Rolls ficam fora dele de propósito (docs/technical/CARDAPIO.md)
const noPdf = manifesto.pdf_sha256 ? 'o PDF no ar é o arquivo assinado (conferido pelo sha256)' : 'o PDF traz os mesmos itens';
console.log(`Catálogo ${catalogo.versao}: ${esperados.size} itens iguais na API e em ${site}/cardapio/; ${noPdf}; a home não mostra preços.`);
