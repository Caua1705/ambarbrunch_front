// Acesso às mídias do site. As imagens moram em src/assets/media (preparadas por `npm run media:prepare`)
// e passam pelo astro:assets no build. Mídia com autorização pendente fica fora do Git: quando o arquivo
// não existe (ex.: clone novo, deploy), a função devolve `undefined` e o componente simplesmente não a mostra.
import type { ImageMetadata } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

const imagens = import.meta.glob<{ default: ImageMetadata }>('/src/assets/media/**/*.{png,jpg,jpeg,webp}', { eager: true });

export function imagem(caminho: string): ImageMetadata | undefined {
  return imagens[`/src/assets/media/${caminho}`]?.default;
}

/** URL de um arquivo em public/media, se ele existir. */
function publico(rel: string): string | undefined {
  return fs.existsSync(path.join(process.cwd(), 'public/media', rel)) ? `/media/${rel}` : undefined;
}

/**
 * URL pública do vídeo reexportado, se o arquivo existir: `<nome>` → public/media/video/<nome>.web.mp4;
 * com pasta (`revisao/criadores/<nome>`) → public/media/<pasta>/<nome>.web.mp4 (mídia só de revisão, ignorada no Git).
 */
export function video(nome: string): string | undefined {
  return publico(nome.includes('/') ? `${nome}.web.mp4` : `video/${nome}.web.mp4`);
}

/** Legendas WebVTT ao lado do vídeo (<nome>.vtt), se existirem. */
export function legendas(nome: string): string | undefined {
  return publico(nome.includes('/') ? `${nome}.vtt` : `video/${nome}.vtt`);
}

const cores = new Map<string, Promise<string | undefined>>();
/**
 * Cor dominante de uma imagem opaca de src/assets/media (fundo do <img> enquanto a foto baixa). Imagem com
 * transparência devolve `undefined` (um logo não pode ganhar um retângulo de cor). Calculada uma vez por arquivo no build.
 */
export function corDominante(caminho: string): Promise<string | undefined> {
  let p = cores.get(caminho);
  if (!p) {
    p = (async () => {
      try {
        const sharp = (await import('sharp')).default;
        const st = await sharp(path.join(process.cwd(), 'src/assets/media', caminho)).stats();
        if (!st.isOpaque) return undefined;
        const { r, g, b } = st.dominant;
        return `rgb(${r} ${g} ${b})`;
      } catch { return undefined; }
    })();
    cores.set(caminho, p);
  }
  return p;
}

const previas = new Map<string, Promise<string | undefined>>();
/**
 * Prévia desfocada (blur-up, 2026-10-27) de uma imagem opaca de src/assets/media: miniatura de 16 px embutida no HTML
 * como SVG com desfoque, pronta para `background-image`. Aparece na hora, sem requisição, no lugar do bloco escuro
 * enquanto a foto (ou a capa de um vídeo) baixa — a cor dominante de fotos com sombra dava quase preto. ~0,5 KB cada.
 * Imagem com transparência devolve `undefined`, como em corDominante.
 */
export function previa(caminho: string): Promise<string | undefined> {
  let p = previas.get(caminho);
  if (!p) {
    p = (async () => {
      if (!(await corDominante(caminho))) return undefined;
      try {
        const sharp = (await import('sharp')).default;
        const { data, info } = await sharp(path.join(process.cwd(), 'src/assets/media', caminho))
          .resize(16).webp({ quality: 40 }).toBuffer({ resolveWithObject: true });
        // viewBox na proporção da foto; o feFuncA devolve opacidade às bordas que o desfoque deixaria transparentes.
        // Aspas simples dentro do SVG e só < > # escapados: o base64 segue cru (o encodeURIComponent inflava cada prévia)
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${info.width * 20} ${info.height * 20}'>`
          + "<filter id='b' color-interpolation-filters='sRGB'><feGaussianBlur stdDeviation='20'/>"
          + "<feComponentTransfer><feFuncA type='discrete' tableValues='1 1'/></feComponentTransfer></filter>"
          + `<image width='100%' height='100%' preserveAspectRatio='none' filter='url(#b)' href='data:image/webp;base64,${data.toString('base64')}'/></svg>`;
        return `url("data:image/svg+xml,${svg.replace(/%/g, '%25').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}")`;
      } catch { return undefined; }
    })();
    previas.set(caminho, p);
  }
  return p;
}
