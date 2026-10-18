// Kit de fotos complementares v2 (AMBAR_KIT_FOTOS_COMPLEMENTARES_FINAL_v2.zip) → src/assets/media, só o que o site usa.
// O kit é extraído em creative/inbox/kit-complementar-v2/ (fora do Git; originais preservados). Idempotente.
//
//   npm run media:kit
//
// Origem de cada arquivo (MANIFESTO_ORIGENS.json do kit):
//   real        → foto do Âmbar ou da Roll (ambientes novos; 9 fotos da Roll autorizadas pelo responsável do projeto)
//   ilustrativa → recorte de imagem gerada por IA ou arte da proposta Âmbar × Roll: no site sai SEMPRE com o selo
//                 “imagem ilustrativa” (src/data/cardapio.ts → origem) e nunca com preço, ingrediente ou dado nutricional próprio.
// Os recortes tiram os rótulos gravados nas pranchas de IA (“BRUSCHETTAS”, “CAFÉS DIVERSOS”…) e as anotações das artes da Roll.
// Fotos do kit que já estavam no projeto (ambientes legados, 3 fotos de gastronomia, 2 bandejas) não são copiadas de novo.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const KIT = path.join(ROOT, 'creative/inbox/kit-complementar-v2');
const REV = path.join(ROOT, 'src/assets/media/revisao/cardapio');   // artes da proposta, já no acervo local
// As fotos da Roll do kit são versões reduzidas dos originais do Instagram da Roll (creative/source, fora do Git).
// Com o original disponível, o recorte sai dele (mesma foto, ~1,4–2× mais pixels; coordenadas escaladas).
const IG = path.join(ROOT, 'creative/source/photography/roll_instagram');
const ORIGINAL = {
  'bandeja-espirais-coloridas.webp': '2026-08-07_DbvbwuOg_vg_image.jpg',
  'embalagem-real-roll.webp': '2026-10-03_DeCm12SAfCp_image.jpg',
  'roll-individual-biscoff.webp': '2026-08-07_Dbvj0DhAd6G_image.jpg',
  'roll-individual-frutas-vermelhas.webp': '2026-10-01_Dd9TYOdA8Ch_image.jpg',
  'roll-individual-kinder.webp': '2026-10-01_Dd9VieXADfy_image.jpg',
  'roll-individual-nutella.webp': '2026-09-01_DcwqVtvgCSI_image.jpg',
  'roll-individual-smores.webp': '2026-10-01_Dd9Z7OBAGSP_image.jpg',
};
const OUT = (p) => path.join(ROOT, 'src/assets/media', p);

/** crop = [left, top, width, height] em px do original; escala = ampliação (lanczos) para fotos pequenas exibidas grandes; branco = retângulos pintados de branco antes do recorte (anotações
 *  sobre o fundo branco das artes da Roll); max = largura máxima do arquivo salvo */
const MEDIA = [
  // ambientes (reais, out/2026)
  { from: '01_AMBIENTES_REAIS/salao-principal-nova.webp', to: 'ambientes/salao-principal.webp', origem: 'real' },
  { from: '01_AMBIENTES_REAIS/sala-privativa-nova.webp', to: 'ambientes/sala-privativa.webp', origem: 'real' },
  // Roll (reais, autorizadas)
  { from: '02_GASTRONOMIA_REAL_ROLL/bandeja-espirais-coloridas.webp', to: 'roll/roll-espiral.webp', crop: [282, 915, 450, 450], origem: 'real' },
  // roll inteiro (anatomia, exibido em círculo): as anotações da arte da Roll que cairiam dentro do círculo viram fundo branco
  { from: '02_GASTRONOMIA_REAL_ROLL/roll-individual-nutella.webp', to: 'roll/roll-nutella-inteiro.webp', max: 960, branco: [[60, 270, 330, 258], [60, 1236, 370, 120]], crop: [130, 480, 800, 800], origem: 'real' },
  { from: '02_GASTRONOMIA_REAL_ROLL/embalagem-real-roll.webp', to: 'roll/caixa-roll.webp', max: 1100, crop: [0, 180, 1052, 1220], origem: 'real' },
  { from: '02_GASTRONOMIA_REAL_ROLL/roll-individual-biscoff.webp', to: 'roll/roll-biscoff.webp', crop: [230, 500, 620, 620], origem: 'real' },
  { from: '02_GASTRONOMIA_REAL_ROLL/roll-individual-frutas-vermelhas.webp', to: 'roll/roll-mood-cheesecake.webp', crop: [230, 480, 620, 620], origem: 'real' },
  { from: '02_GASTRONOMIA_REAL_ROLL/roll-individual-kinder.webp', to: 'roll/roll-kinder-bueno.webp', crop: [230, 480, 620, 620], origem: 'real' },
  { from: '02_GASTRONOMIA_REAL_ROLL/roll-individual-smores.webp', to: 'roll/roll-smores.webp', crop: [230, 480, 620, 620], origem: 'real' },
  // capa do hero (rodada final): close do topo do roll Kinder Bueno; as setas da arte ficam fora do círculo
  { from: '02_GASTRONOMIA_REAL_ROLL/roll-individual-kinder.webp', to: 'roll/roll-kinder-macro.webp', crop: [200, 431, 585, 585], origem: 'real' },
  // categorias do cardápio (IA, ilustrativas): quadrado sem o rótulo gravado
  { from: '03_IMAGENS_IA_CATEGORIAS/bowls-poke-principal.webp', to: 'cardapio/bowls-poke.webp', crop: [56, 6, 200, 200], origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/brownies-principal.webp', to: 'cardapio/brownies.webp', crop: [62, 8, 190, 190], origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/bruschetta-caprese-conceito.webp', to: 'cardapio/bruschetta-caprese.webp', crop: [10, 4, 232, 232], origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/cafes-diversos-principal.webp', to: 'cardapio/cafes-diversos.webp', crop: [24, 2, 165, 165], origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/cappuccino-principal.webp', to: 'cardapio/cappuccino.webp', crop: [70, 0, 168, 168], origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/cha-principal.webp', to: 'cardapio/cha.webp', crop: [62, 0, 136, 136], origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/cheesecakes-principal.webp', to: 'cardapio/cheesecakes.webp', crop: [64, 4, 196, 196], origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/smoothies-principal.webp', to: 'cardapio/smoothies.webp', crop: [4, 0, 128, 128], origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/cafes-gelados-principal.webp', to: 'cardapio/cafes-gelados.webp', crop: [96, 0, 122, 122], origem: 'ilustrativa' },
  // foto grande de Saladas & bowls: o recorte de IA é pequeno (306 px); ampliado 2× com lanczos para não borrar no navegador
  { from: '03_IMAGENS_IA_CATEGORIAS/bowls-poke-principal.webp', to: 'cardapio/poke-prato.webp', crop: [18, 0, 270, 206], escala: 2, origem: 'ilustrativa' },
  // artes da proposta Âmbar × Roll (pág. 12): pratos do cardápio do cliente, ilustrativos
  { rev: 'sanduiche.webp', to: 'cardapio/sanduiche-brie.webp', crop: [91, 0, 204, 204], origem: 'ilustrativa' },
  { rev: 'salada-atum.webp', to: 'cardapio/salada-atum.webp', escala: 2, origem: 'ilustrativa' },
  { rev: 'roll-salgado-pesto.webp', to: 'cardapio/roll-salgado-pesto.webp', origem: 'ilustrativa' },
  { rev: 'roll-salgado-caprese.webp', to: 'cardapio/roll-salgado-caprese.webp', origem: 'ilustrativa' },
  // rodada final: os quatro rolls salgados com foto (mesma prancha da proposta) e as fotos que faltavam no cardápio
  { rev: 'roll-salgado-quatro-queijos.webp', to: 'cardapio/roll-salgado-quatro-queijos.webp', origem: 'ilustrativa' },
  { rev: 'roll-salgado-cogumelos.webp', to: 'cardapio/roll-salgado-cogumelos.webp', origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/cinnamon-roll-doce-principal.webp', to: 'cardapio/roll-tradicional.webp', crop: [100, 54, 130, 130], escala: 2, origem: 'ilustrativa' },
  { from: '03_IMAGENS_IA_CATEGORIAS/sanduiches-principal.webp', to: 'cardapio/sanduiches.webp', crop: [130, 24, 160, 160], escala: 2, origem: 'ilustrativa' },
];

const preview = process.argv.includes('--preview');
let ok = 0;
for (const m of MEDIA) {
  const doKit = m.rev ? path.join(REV, m.rev) : path.join(KIT, m.from);
  if (!fs.existsSync(doKit)) { console.warn(`! não encontrado: ${path.relative(ROOT, doKit)}`); continue; }
  // original de maior resolução (mesma proporção, ±1%) → escala as coordenadas
  let from = doKit; let k = 1;
  const orig = m.from && ORIGINAL[path.basename(m.from)] && path.join(IG, ORIGINAL[path.basename(m.from)]);
  if (orig && fs.existsSync(orig)) {
    const [a, b] = await Promise.all([sharp(doKit).metadata(), sharp(orig).metadata()]);
    if (Math.abs(a.width / a.height - b.width / b.height) < 0.01) { from = orig; k = b.width / a.width; }
  }
  const esc = (r) => r.map((v) => Math.round(v * k));
  const to = OUT(m.to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  let img = sharp(from);
  if (m.branco) {
    const { width: W, height: H } = await sharp(from).metadata();
    const rects = m.branco.map(esc).map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>`).join('');
    img = sharp(await img.composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${rects}</svg>`) }]).png().toBuffer());
  }
  if (m.crop) { const [left, top, width, height] = esc(m.crop); img = img.extract({ left, top, width, height }); }
  if (m.max) img = img.resize({ width: m.max, withoutEnlargement: true });
  if (m.escala) { const w = m.crop ? m.crop[2] : (await sharp(from).metadata()).width; img = sharp(await img.png().toBuffer()).resize({ width: w * m.escala, kernel: 'lanczos3' }).sharpen({ sigma: 0.6 }); }
  await img.webp({ quality: 90 }).toFile(to);
  const meta = await sharp(to).metadata();
  console.log(`✓ ${m.to.padEnd(34)}${k > 1 ? '↑' : ' '} ${String(meta.width).padStart(4)}×${String(meta.height).padEnd(4)} ${String((fs.statSync(to).size / 1024).toFixed(0)).padStart(4)} KB  ${m.origem}`);
  ok++;
}
console.log(`${ok}/${MEDIA.length} arquivos em src/assets/media${preview ? '' : ''}`);
