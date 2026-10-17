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
