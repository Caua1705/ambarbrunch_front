// Imagens de compartilhamento (WhatsApp e redes) de /reservar e /cardapio: node scripts/gerar-previews.mjs
// Saída em public/og/, 1200 × 630, em JPEG leve e num endereço fixo (sem hash de build). Só rodar de novo ao mudar a arte; o
// resultado fica versionado. O WhatsApp recorta a imagem em quadrado no centro em alguns tamanhos de cartão: logo e título
// ficam nesse quadrado central, e as fotos reais do Âmbar só nas laterais.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MIDIA = path.join(RAIZ, 'src/assets/media');
const SAIDA = path.join(RAIZ, 'public/og');
const LARGURA = 1200;
const ALTURA = 630;
const QUADRADO = 630;
const LATERAL = (LARGURA - QUADRADO) / 2;

const CARTOES = [
  { arquivo: 'reservar.jpg', titulo: 'Reserve sua mesa', fotos: ['ambientes/salao-principal.webp', 'ambientes/sala-04-jardim.webp'] },
  { arquivo: 'cardapio.jpg', titulo: 'Cardápio', fotos: ['gastronomia/croissant-prato-azul.webp', 'roll/roll-espiral.webp'] },
];

const dataUri = (buffer, tipo) => `data:${tipo};base64,${buffer.toString('base64')}`;
const lateral = async (foto) => dataUri(await sharp(path.join(MIDIA, foto)).resize(LATERAL, ALTURA, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer(), 'image/jpeg');

const logo = dataUri(fs.readFileSync(path.join(MIDIA, 'brand/logo-ambar.png')), 'image/png');
const fraunces = dataUri(fs.readFileSync(path.join(RAIZ, 'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2')), 'font/woff2');

const html = (titulo, esquerda, direita) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Fraunces;font-style:italic;font-weight:100 900;src:url(${fraunces}) format("woff2")}
*{box-sizing:border-box;margin:0}
body{width:${LARGURA}px;height:${ALTURA}px;display:flex;background:#F4EEE3;overflow:hidden}
.foto{width:${LATERAL}px;height:100%;background-size:cover;background-position:center}
.centro{width:${QUADRADO}px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;border-inline:10px solid #670D27}
img{width:470px;display:block}
h1{font:italic 500 58px/1 Fraunces,Georgia,serif;color:#670D27;letter-spacing:-.01em}
</style><div class="foto" style="background-image:url(${esquerda})"></div><div class="centro"><img src="${logo}" alt=""><h1>${titulo}</h1></div><div class="foto" style="background-image:url(${direita})"></div>`;

fs.mkdirSync(SAIDA, { recursive: true });
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: LARGURA, height: ALTURA } });
for (const { arquivo, titulo, fotos } of CARTOES) {
  const [esquerda, direita] = await Promise.all(fotos.map(lateral));
  await pagina.setContent(html(titulo, esquerda, direita), { waitUntil: 'load' });
  await pagina.evaluate(() => document.fonts.ready);
  const png = await pagina.screenshot({ type: 'png' });
  const destino = path.join(SAIDA, arquivo);
  await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toFile(destino);
  console.log(arquivo, `${Math.round(fs.statSync(destino).size / 1024)} KB`);
}
await navegador.close();
