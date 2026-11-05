// CAFÉ + ROLL — a combinação de uma bebida gelada do Âmbar com um cinnamon roll da Roll.
// Nomes de bebida e roll vêm do catálogo oficial, pelo id estável: um produto que sair do cardápio derruba o build em vez de seguir na
// home. Só a foto (real, da Roll, autorizada em 2026-10-17) e a frase são daqui. As duplas são SUGESTÕES editoriais de combinação
// (nada de combo, preço ou disponibilidade do dia). O copo da cena é um desenho (SVG), não é foto nem mockup de embalagem; a caixa é a
// embalagem real da Roll. A dupla Biscoff saiu em 2026-11-05: o roll Biscoff não está no cardápio oficial.
import { FOTOS_PRODUTO, type FotoCardapio } from './cardapio';
import type { Catalogo } from '../lib/cardapio/contrato';

interface Par {
  id: string;
  bebidaId: string;
  rollId: string;
  frase: string;
  /** cores do desenho do copo: base e topo do líquido (tokens) */
  liquido: [string, string];
}

const PARES: Par[] = [
  { id: 'matcha', bebidaId: 'cafes_gelados.matcha_geleia_de_morango', rollId: 'cinnamon_rolls.mood_cheesecake', frase: 'verde, vermelho e cremoso', liquido: ['var(--berry)', 'var(--leaf)'] },
  { id: 'iced', bebidaId: 'cafes_gelados.iced_latte', rollId: 'cinnamon_rolls.smores', frase: 'o gelado encontra o tostado', liquido: ['var(--cacao)', 'var(--caramel-dk)'] },
  { id: 'honey', bebidaId: 'cafes_gelados.honey_latte', rollId: 'cinnamon_rolls.kinder_bueno', frase: 'mel, leite e chocolate', liquido: ['var(--caramel-lt)', 'var(--glaze)'] },
];

export const cafeRoll = {
  caixa: { src: 'roll/caixa-roll.webp', alt: 'Caixa da Roll aberta com quatro cinnamon rolls de sabores diferentes' },
  nota: 'os sabores da Roll mudam com a fornada',
};

export interface ParVista { id: string; bebida: string; roll: string; frase: string; liquido: [string, string]; foto: FotoCardapio }

export function resolverPares(catalogo: Catalogo): ParVista[] {
  const itens = new Map(catalogo.categorias.flatMap((c) => c.itens.map((i) => [i.id, i.nome] as const)));
  return PARES.map((p) => {
    const bebida = itens.get(p.bebidaId);
    const roll = itens.get(p.rollId);
    const foto = FOTOS_PRODUTO[p.rollId];
    if (!bebida || !roll || !foto) throw new Error(`Dupla Café + Roll “${p.id}” aponta para um produto fora do catálogo ou sem foto.`);
    return { id: p.id, bebida, roll, frase: p.frase, liquido: p.liquido, foto };
  });
}
