// Copia os originais APROVADOS do acervo (creative/source, fora do Git) para src/assets/media,
// onde o astro:assets gera AVIF/WebP responsivos no build. Idempotente.
//
//   npm run media:prepare
//
// Regras:
// - só entra o que o site usa (lista abaixo, com o ID do ASSET-MANIFEST);
// - fotos maiores que `max` px de largura são reduzidas (o build gera até 1080 px);
// - `git: false` = mídia com autorização pendente: fica fora do Git (ver .gitignore) e o site
//   só a mostra se o arquivo existir localmente E o conteúdo estiver marcado como autorizado
//   (ou em modo de revisão local). Nada aqui é enviado para lugar nenhum.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = (p) => path.join(ROOT, 'creative/source', p);
const OUT = (p) => path.join(ROOT, 'src/assets/media', p);

const MEDIA = [
  { id: 'OF-15', from: 'brand/derivados/logo-ambar-cafe-brunch-p01-fundo-removido.png', to: 'brand/logo-ambar.png', git: true },
  { id: 'OF-03', from: 'brand/logo-roll-extraido-pdf-original.png', to: 'brand/logo-roll.png', max: 420, git: true },
  { id: 'FR-07', from: 'photography/gastronomia/croissant-prato-azul.webp', to: 'gastronomia/croissant-prato-azul.webp', git: true },
  { id: 'FR-06', from: 'photography/gastronomia/bruschetta-brunch.webp', to: 'gastronomia/bruschetta-brunch.webp', git: true },
  { id: 'FR-05', from: 'photography/gastronomia/bebida-chocolate-creme.webp', to: 'gastronomia/bebida-chocolate-creme.webp', git: true },
  { id: 'FR-01', from: 'photography/ambientes/sala-01.webp', to: 'ambientes/sala-01-lounge.webp', git: true },
  { id: 'FR-02', from: 'photography/ambientes/sala-02.webp', to: 'ambientes/sala-02-leitura.webp', git: true },
  { id: 'FR-03', from: 'photography/ambientes/sala-03.webp', to: 'ambientes/sala-03-salao.webp', git: true },
  { id: 'FR-04', from: 'photography/ambientes/sala-04.webp', to: 'ambientes/sala-04-jardim.webp', git: true },
  // Roll (Instagram) — autorização pendente: fora do Git
  { id: 'IG-OPT-06', from: 'photography/roll_instagram/otimizadas/2026-08-16_DcGojKjlvml_image.webp', to: 'roll/bandeja-biscoff.webp', git: false },
  { id: 'IG-09', from: 'photography/roll_instagram/2026-08-16_DcGojKjlvml_image_3.jpg', to: 'roll/bandeja-red-velvet.webp', max: 1200, git: false },
  { id: 'IG-OPT-07', from: 'photography/roll_instagram/otimizadas/2026-08-16_DcGojKjlvml_image_2.webp', to: 'roll/bandeja-oreo.webp', git: false },
  { id: 'IV-P-06', from: 'video/roll_reels/posters/2026-09-17_DdZ5fRIA4f2_poster.webp', to: 'roll/poster-do-forno.webp', git: false },
  { id: 'IV-P-09', from: 'video/roll_reels/posters/2026-10-02_DeAT31Yg8Un_poster.webp', to: 'roll/poster-sabores-do-mes.webp', git: false },
  { id: 'IV-P-08', from: 'video/roll_reels/posters/2026-10-01_Dd9V9KUz-nV_poster.webp', to: 'roll/poster-bandeja.webp', git: false },
];

let ok = 0;
for (const m of MEDIA) {
  const from = SRC(m.from);
  const to = OUT(m.to);
  if (!fs.existsSync(from)) { console.warn(`! ${m.id} não encontrado no acervo: ${m.from}`); continue; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const meta = await sharp(from).metadata();
  const needsResize = m.max && meta.width > m.max;
  const needsConvert = path.extname(from) !== path.extname(to);
  if (needsResize || needsConvert) {
    let img = sharp(from);
    if (needsResize) img = img.resize({ width: m.max });
    if (to.endsWith('.webp')) img = img.webp({ quality: 86 });
    if (to.endsWith('.png')) img = img.png({ compressionLevel: 9 });
    await img.toFile(to);
  } else {
    fs.copyFileSync(from, to);
  }
  const kb = (fs.statSync(to).size / 1024).toFixed(0);
  console.log(`✓ ${m.id.padEnd(9)} ${m.to.padEnd(36)} ${String(kb).padStart(4)} KB ${m.git ? '' : '(fora do Git: autorização pendente)'}`);
  ok++;
}
console.log(`\n${ok}/${MEDIA.length} arquivos em src/assets/media`);
