// Categorias da proposta de cardápio Âmbar × Roll (PDF da apresentação, págs. 5–6).
// São CATEGORIAS, não produtos nem preços. Itens e preços: pendentes.

/** Pares fundo/texto aprovados em TOKENS.md §1 (faixas do cardápio). */
export const PARES = {
  wine: { b: 'var(--wine)', t: 'var(--butter)' },
  caramel: { b: 'var(--caramel)' },
  cacao: { b: 'var(--cacao)', t: 'var(--butter)' },
  'cacao-lt': { b: 'var(--cacao)', t: 'var(--caramel-lt)' },
  leaf: { b: 'var(--leaf)', t: 'var(--cream)' },
  butter: { b: 'var(--butter)' },
  berry: { b: 'var(--berry)', t: 'var(--cream)' },
} as const;
export type Cor = keyof typeof PARES;

export const cardapio: {
  fonte: 'proposta-pdf';
  comer: { nome: string; cor: Cor }[];
  beber: { nome: string; cor: Cor }[];
  faixa: string[];
  nota: string;
} = {
  fonte: 'proposta-pdf',
  comer: [
    { nome: 'Bruschettas', cor: 'wine' }, { nome: 'Cheesecakes', cor: 'caramel' }, { nome: 'Sanduíches', cor: 'cacao' },
    { nome: 'Saladas', cor: 'leaf' }, { nome: 'Cinnamon roll salgado & doce', cor: 'butter' }, { nome: 'Bowls', cor: 'berry' },
    { nome: 'Brownies diferentes', cor: 'cacao-lt' },
  ],
  beber: [
    { nome: 'Cafés gelados', cor: 'caramel' }, { nome: 'Cappuccino', cor: 'wine' }, { nome: 'Frappé', cor: 'butter' },
    { nome: 'Cafés diversos', cor: 'cacao' }, { nome: 'Chá', cor: 'leaf' }, { nome: 'Smoothies proteicos', cor: 'berry' },
  ],
  /** Faixa em movimento abaixo do hero (mesma ordem do protótipo). */
  faixa: ['Bruschettas', 'Cheesecakes', 'Sanduíches', 'Cafés gelados', 'Bowls', 'Cinnamon rolls', 'Frappé', 'Saladas', 'Brownies'],
  nota: 'Categorias da proposta de cardápio Âmbar × Roll · itens e preços em definição',
};
