// Cardápio do Âmbar Brunch — 13 CATEGORIAS da proposta Âmbar × Roll (PDF, págs. 5–6), confirmadas em 2026-10-17.
// Itens: só os que aparecem nos cardápios do próprio cliente (artes recebidas por WhatsApp e pág. 12 da proposta).
// Sem preço. Categoria sem itens confirmados fica como etiqueta editorial (não abre painel).
import { bebidas } from './bebidas';

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

export interface Item { nome: string; desc?: string }
/** Foto de apoio do painel. `confirmado: false` = imagem da proposta do cliente (ilustrativa): só no modo de revisão. */
export interface FotoCardapio { src: string; alt: string; confirmado: boolean }
export interface Detalhe {
  linha?: string;                                  // subtítulo do cardápio do cliente (ex.: “no pão rústico tostado”)
  grupos: { titulo?: string; itens: Item[] }[];
  fotos?: FotoCardapio[];
  ancora?: { href: string; texto: string };       // leva à seção que aprofunda a categoria
}
export interface Categoria { id: string; nome: string; cor: Cor; detalhe?: Detalhe }

const revisao = (src: string, alt: string): FotoCardapio => ({ src: `revisao/cardapio/${src}`, alt, confirmado: false });

export const cardapio: { comer: Categoria[]; beber: Categoria[]; faixa: string[]; nota: string } = {
  comer: [
    { id: 'bruschettas', nome: 'Bruschettas', cor: 'wine', detalhe: {
      linha: 'bruschettas & toasts',
      grupos: [{ itens: [{ nome: 'Caprese' }, { nome: 'Confit rústica' }, { nome: 'Avocado toast' }] }],
      fotos: [{ src: 'gastronomia/bruschetta-brunch.webp', alt: 'Torrada coberta vista de cima com xícara de café', confirmado: true }],
    } },
    { id: 'cheesecakes', nome: 'Cheesecakes', cor: 'caramel' },
    { id: 'sanduiches', nome: 'Sanduíches', cor: 'cacao', detalhe: {
      linha: 'no pão rústico tostado',
      grupos: [{ itens: [
        { nome: 'Brie & mirtilo', desc: 'mirtilo, brie e parmesão' },
        { nome: 'Ragu', desc: 'ragu, muçarela, tomate confitado e mel' },
        { nome: 'Atum & abacate', desc: 'atum, gergelim, creme de ricota, shoyu e abacate' },
        { nome: 'Mortadela ou parma', desc: 'rúcula, parmesão e tomate confitado' },
      ] }],
      fotos: [revisao('sanduiche.webp', 'Sanduíche de brie com geleia de mirtilo no pão rústico')],
    } },
    { id: 'saladas', nome: 'Saladas', cor: 'leaf', detalhe: {
      linha: 'menu saudável',
      grupos: [{ itens: [
        { nome: 'Salada de atum', desc: 'atum, abacate, mix de folhas, pepino, shoyu e manga' },
        { nome: 'Carne do sol', desc: 'creme de carne do sol, dadinhos de tapioca, folhas e parmesão' },
      ] }],
      fotos: [revisao('salada-atum.webp', 'Salada de atum com abacate, pepino e folhas')],
      ancora: { href: '#por-dentro', texto: 'por dentro do prato' },
    } },
    { id: 'rolls', nome: 'Cinnamon roll salgado & doce', cor: 'butter', detalhe: {
      grupos: [
        { titulo: 'doces · Roll', itens: [{ nome: 'Tradicional', desc: 'massa de fermentação lenta, manteiga, açúcar mascavo, canela e glacê' }, { nome: 'Mood cheesecake' }, { nome: 'S’mores' }, { nome: 'Kinder Bueno' }] },
        { titulo: 'salgados', itens: [{ nome: 'Pesto & ricota' }, { nome: 'Quatro queijos' }, { nome: 'Caprese' }, { nome: 'Cogumelos & brie' }] },
      ],
      fotos: [
        revisao('roll-salgado-pesto.webp', 'Roll salgado de pesto e ricota'),
        revisao('roll-salgado-caprese.webp', 'Roll salgado caprese'),
        revisao('roll-salgado-cogumelos.webp', 'Roll salgado de cogumelos e brie'),
      ],
      ancora: { href: '#roll', texto: 'direto da fornada' },
    } },
    { id: 'bowls', nome: 'Bowls', cor: 'berry', detalhe: {
      grupos: [{ itens: [{ nome: 'Poke', desc: 'arroz, salmão, milho crocante, abacate e gergelim' }] }],
    } },
    { id: 'brownies', nome: 'Brownies diferentes', cor: 'cacao-lt' },
  ],
  beber: [
    { id: 'gelados', nome: 'Cafés gelados', cor: 'caramel', detalhe: {
      grupos: [{ itens: bebidas.gelados.map((b) => ({ nome: b.nome, desc: b.desc })) }],
      ancora: { href: '#bebidas', texto: 'café e bebidas' },
    } },
    { id: 'cappuccino', nome: 'Cappuccino', cor: 'wine' },
    { id: 'frappe', nome: 'Frappé', cor: 'butter' },
    { id: 'cafes', nome: 'Cafés diversos', cor: 'cacao' },
    { id: 'cha', nome: 'Chá', cor: 'leaf' },
    { id: 'smoothies', nome: 'Smoothies proteicos', cor: 'berry' },
  ],
  /** Faixa em movimento abaixo do hero: as 13 categorias, alternando comer e beber. */
  faixa: ['Bruschettas', 'Cafés gelados', 'Cheesecakes', 'Cappuccino', 'Sanduíches', 'Frappé', 'Saladas', 'Cafés diversos', 'Cinnamon roll salgado & doce', 'Chá', 'Bowls', 'Smoothies proteicos', 'Brownies diferentes'],
  nota: 'Itens do cardápio de estreia · podem variar com a fornada e a estação',
};
