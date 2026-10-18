// CAFÉ + ROLL — a combinação de uma bebida gelada do Âmbar com um cinnamon roll da Roll.
// Bebidas: cardápio “Cafés gelados” do cliente. Rolls: sabores e fotos da própria Roll (autorizadas em 2026-10-17).
// As duplas são SUGESTÕES editoriais de combinação (nada de combo, preço ou disponibilidade do dia).
// O copo da cena é um desenho (SVG) — não é foto nem mockup de embalagem; a caixa é a embalagem real da Roll.
import type { Origem } from '../lib/conteudo';

export interface Par {
  id: string;
  bebida: string;
  roll: string;
  frase: string;
  /** cores do desenho do copo: base e topo do líquido (tokens) */
  liquido: [string, string];
  foto: { src: string; alt: string; origem: Origem };
}

export const cafeRoll = {
  /** frase curta sob o título: a seção é uma sugestão editorial, não um cardápio repetido */
  lead: 'Um gelado da casa, um roll da fornada.',
  pares: [
    { id: 'biscoff', bebida: 'Biscoff latte', roll: 'Biscoff', frase: 'Biscoff em dobro', liquido: ['var(--caramel)', 'var(--butter)'],
      foto: { src: 'roll/roll-biscoff.webp', alt: 'Cinnamon roll de Biscoff com creme e biscoito triturado', origem: 'real' } },
    { id: 'matcha', bebida: 'Matcha frutas vermelhas', roll: 'Mood cheesecake', frase: 'verde, vermelho e cremoso', liquido: ['var(--berry)', 'var(--leaf)'],
      foto: { src: 'roll/roll-mood-cheesecake.webp', alt: 'Cinnamon roll Mood cheesecake com geleia de morango e crumble', origem: 'real' } },
    { id: 'americano', bebida: 'Iced americano', roll: 'S’mores', frase: 'o amargo encontra o doce', liquido: ['var(--cacao)', 'var(--caramel-dk)'],
      foto: { src: 'roll/roll-smores.webp', alt: 'Cinnamon roll S’mores com marshmallow tostado e chocolate', origem: 'real' } },
    { id: 'honey', bebida: 'Honey latte', roll: 'Kinder Bueno', frase: 'mel, leite e chocolate', liquido: ['var(--caramel-lt)', 'var(--glaze)'],
      foto: { src: 'roll/roll-kinder-bueno.webp', alt: 'Cinnamon roll Kinder Bueno com fios de Nutella', origem: 'real' } },
  ] satisfies Par[],
  caixa: { src: 'roll/caixa-roll.webp', alt: 'Caixa da Roll aberta com quatro cinnamon rolls de sabores diferentes' },
  nota: 'os sabores da Roll mudam com a fornada',
};
