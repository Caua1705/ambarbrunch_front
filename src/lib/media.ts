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

/** URL pública do vídeo reexportado (public/media/video/<nome>.web.mp4), se o arquivo existir. */
export function video(nome: string): string | undefined {
  const arquivo = path.join(process.cwd(), 'public/media/video', `${nome}.web.mp4`);
  return fs.existsSync(arquivo) ? `/media/video/${nome}.web.mp4` : undefined;
}
