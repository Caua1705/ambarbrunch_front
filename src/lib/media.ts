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
