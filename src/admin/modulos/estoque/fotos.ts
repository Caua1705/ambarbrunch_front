// Foto de um produto do catálogo oficial no painel: a mesma miniatura do cardápio do site, ligada pelo id estável do
// catálogo (ex.: "sucos.antioxidant"), nunca pelo nome. Só aparece para produto da Eyemobile VINCULADO ao catálogo
// (FichaLista.catalogo_item_id) — vínculo que o backend ainda não guarda (PAINEL-ADMIN.md §4h); sem ele, nada de foto.
import type { ImageMetadata } from 'astro';
import { FOTOS_PRODUTO } from '../../../data/cardapio';

const miniaturas = import.meta.glob<{ default: ImageMetadata }>('/src/assets/media/cardapio/miniaturas/**/*.webp', { eager: true });

export function fotoDoCatalogo(catalogoId: string | null | undefined): { src: string; alt: string } | null {
  if (!catalogoId) return null;
  const f = FOTOS_PRODUTO[catalogoId];
  const m = f ? miniaturas[`/src/assets/media/${f.src}`] : undefined;
  return f && m ? { src: m.default.src, alt: f.alt } : null;
}
