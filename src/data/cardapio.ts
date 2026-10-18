// Cardápio do Âmbar Brunch — 13 CATEGORIAS da proposta Âmbar × Roll (PDF, págs. 5–6), confirmadas em 2026-10-17.
// Itens e descrições: só os dos cardápios do próprio cliente (artes recebidas por WhatsApp: Âmbar Café, Cafés gelados e
// Roll · cinnamon rolls; pág. 12 da proposta para os rolls salgados). Sem preço e sem disponibilidade do dia.
// Cada categoria tem uma foto principal (real ou ilustrativa, ver lib/conteudo.ts → Origem); miniaturas só nos itens
// principais. Categoria sem itens confirmados mostra só a foto e uma nota neutra — nunca sabores inventados.
// Rodada final: cartões enxutos — nome e, quando acrescenta, uma descrição curta; nada de ficha de catálogo.
import type { Origem } from '../lib/conteudo';
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

export interface FotoCardapio { src: string; alt: string; origem: Origem }
/** `foto` = miniatura: só nos itens principais, quando acrescenta. */
export interface Item { nome: string; desc?: string; foto?: FotoCardapio }
export interface Grupo {
  id?: string;
  titulo?: string;
  itens: Item[];
  /** itens válidos guardados atrás de um “ver mais” (não pesam no cartão) */
  mais?: { rotulo: string; itens: string[] };
  nota?: string;
}
export interface Detalhe {
  linha?: string;                                  // subtítulo do cardápio do cliente (ex.: “no pão rústico tostado”)
  foto: FotoCardapio;                              // foto principal da categoria
  grupos: Grupo[];
  /** grupos viram abas (ex.: doces | salgados) */
  abas?: boolean;
  nota?: string;
  ancora?: { href: string; texto: string };       // leva à seção que aprofunda a categoria
}
export interface Categoria { id: string; nome: string; cor: Cor; detalhe: Detalhe }

const real = (src: string, alt: string): FotoCardapio => ({ src, alt, origem: 'real' });
const ilustrativa = (src: string, alt: string): FotoCardapio => ({ src, alt, origem: 'ilustrativa' });
const VARIA = 'as opções variam · consulte a equipe';

/** Sabores da Roll em destaque no cartão (cardápio “Roll · cinnamon rolls”): foto + uma linha curta. */
const rollsDoces: Item[] = [
  { nome: 'Tradicional', desc: 'canela, açúcar mascavo e glacê', foto: ilustrativa('cardapio/roll-tradicional.webp', 'Cinnamon roll tradicional com glacê') },
  { nome: 'Mood cheesecake', desc: 'cheesecake, morango e crumble', foto: real('roll/roll-mood-cheesecake.webp', 'Cinnamon roll Mood cheesecake com geleia de morango e crumble') },
  { nome: 'S’mores', desc: 'chocolate e marshmallow tostado', foto: real('roll/roll-smores.webp', 'Cinnamon roll S’mores com marshmallow tostado') },
  { nome: 'Kinder Bueno', desc: 'Kinder Bueno e Nutella', foto: real('roll/roll-kinder-bueno.webp', 'Cinnamon roll Kinder Bueno com fios de Nutella') },
];

export const cardapio: { comer: Categoria[]; beber: Categoria[]; faixa: string[]; nota: string } = {
  comer: [
    { id: 'bruschettas', nome: 'Bruschettas', cor: 'wine', detalhe: {
      linha: 'bruschettas & toasts',
      foto: real('gastronomia/bruschetta-brunch.webp', 'Torrada coberta vista de cima, com xícara de café ao lado'),
      grupos: [{ itens: [
        { nome: 'Caprese', foto: ilustrativa('cardapio/bruschetta-caprese.webp', 'Bruschetta caprese com tomate, muçarela e manjericão') },
        { nome: 'Confit rústica' }, { nome: 'Vigente cremoso' }, { nome: 'Avocado toast' },
      ] }],
    } },
    { id: 'cheesecakes', nome: 'Cheesecakes', cor: 'caramel', detalhe: {
      foto: ilustrativa('cardapio/cheesecakes.webp', 'Fatia de cheesecake com calda de frutas vermelhas'),
      grupos: [], nota: VARIA,
    } },
    { id: 'sanduiches', nome: 'Sanduíches', cor: 'cacao', detalhe: {
      linha: 'no pão rústico tostado',
      foto: ilustrativa('cardapio/sanduiches.webp', 'Sanduíche no pão rústico tostado com queijo derretido, tomate e folhas'),
      grupos: [{ itens: [
        { nome: 'Brie & mirtilo', desc: 'mirtilo, brie e parmesão', foto: ilustrativa('cardapio/sanduiche-brie.webp', 'Sanduíche de brie com geleia de mirtilo no pão rústico') },
        { nome: 'Ragu', desc: 'ragu, muçarela, tomate confitado e mel' },
        { nome: 'Atum & abacate', desc: 'atum, gergelim, creme de ricota, shoyu e abacate' },
        { nome: 'Mortadela ou parma', desc: 'rúcula, parmesão e tomate confitado' },
      ] }],
    } },
    { id: 'saladas', nome: 'Saladas', cor: 'leaf', detalhe: {
      linha: 'menu saudável',
      foto: ilustrativa('cardapio/salada-atum.webp', 'Salada de atum com abacate, pepino, tomate e folhas'),
      grupos: [{ itens: [
        { nome: 'Salada de atum', desc: 'atum, abacate, mix de folhas, pepino, shoyu e manga' },
        { nome: 'Carne do sol', desc: 'creme de carne do sol, dadinhos de tapioca, folhas e parmesão' },
      ] }],
      ancora: { href: '#saladas', texto: 'saladas & bowls' },
    } },
    { id: 'rolls', nome: 'Cinnamon rolls doces & salgados', cor: 'butter', detalhe: {
      linha: 'com assinatura da Roll',
      foto: real('roll/roll-espiral.webp', 'Cinnamon roll em espiral entre rolls red velvet, na bandeja da Roll'),
      abas: true,
      grupos: [
        // os outros sabores já aparecem em “Direto da fornada” (pílulas): o cartão não repete a lista
        { id: 'doces', titulo: 'doces', itens: rollsDoces, nota: 'os sabores mudam com a fornada' },
        { id: 'salgados', titulo: 'salgados', itens: [
          { nome: 'Pesto & ricota', foto: ilustrativa('cardapio/roll-salgado-pesto.webp', 'Roll salgado de pesto e ricota') },
          { nome: 'Quatro queijos', foto: ilustrativa('cardapio/roll-salgado-quatro-queijos.webp', 'Roll salgado de quatro queijos') },
          { nome: 'Caprese', foto: ilustrativa('cardapio/roll-salgado-caprese.webp', 'Roll salgado caprese') },
          { nome: 'Cogumelos & brie', foto: ilustrativa('cardapio/roll-salgado-cogumelos.webp', 'Roll salgado de cogumelos e brie') },
        ] },
      ],
      ancora: { href: '#roll', texto: 'direto da fornada' },
    } },
    { id: 'bowls', nome: 'Bowls', cor: 'berry', detalhe: {
      foto: ilustrativa('cardapio/bowls-poke.webp', 'Poke com arroz, salmão, milho, abacate e gergelim'),
      grupos: [{ itens: [{ nome: 'Poke', desc: 'arroz, salmão, milho crocante, abacate e gergelim' }] }],
      ancora: { href: '#saladas', texto: 'saladas & bowls' },
    } },
    { id: 'brownies', nome: 'Brownies diferentes', cor: 'cacao-lt', detalhe: {
      foto: ilustrativa('cardapio/brownies.webp', 'Brownies empilhados com calda de chocolate'),
      grupos: [], nota: VARIA,
    } },
  ],
  beber: [
    { id: 'gelados', nome: 'Cafés gelados', cor: 'caramel', detalhe: {
      linha: 'gelados da casa',
      foto: ilustrativa('cardapio/cafes-gelados.webp', 'Latte gelado e matcha latte em copos com gelo'),
      // só os nomes: “café, leite e gelo” não acrescenta nada a um iced latte
      grupos: [{ itens: bebidas.gelados.map((b) => ({ nome: b.nome })), nota: `leites: ${bebidas.leites.join(' · ')}` }],
      ancora: { href: '#cafe-roll', texto: 'café + roll' },
    } },
    { id: 'cappuccino', nome: 'Cappuccino', cor: 'wine', detalhe: {
      foto: ilustrativa('cardapio/cappuccino.webp', 'Cappuccino com desenho de folha na espuma'), grupos: [], nota: VARIA,
    } },
    { id: 'frappe', nome: 'Frappé', cor: 'butter', detalhe: {
      foto: real('gastronomia/bebida-chocolate-creme.webp', 'Bebida gelada de chocolate com calda escorrendo no copo'), grupos: [], nota: VARIA,
    } },
    { id: 'cafes', nome: 'Cafés diversos', cor: 'cacao', detalhe: {
      foto: ilustrativa('cardapio/cafes-diversos.webp', 'Espresso e café com leite em copos de vidro'), grupos: [], nota: VARIA,
    } },
    { id: 'cha', nome: 'Chá', cor: 'leaf', detalhe: {
      foto: ilustrativa('cardapio/cha.webp', 'Chás gelados vermelho e dourado em copos altos'), grupos: [], nota: VARIA,
    } },
    { id: 'smoothies', nome: 'Smoothies proteicos', cor: 'berry', detalhe: {
      foto: ilustrativa('cardapio/smoothies.webp', 'Smoothie de frutas vermelhas em copo alto'), grupos: [], nota: VARIA,
    } },
  ],
  /** Faixa em movimento abaixo do hero: as 13 categorias, alternando comer e beber. */
  faixa: ['Bruschettas', 'Cafés gelados', 'Cheesecakes', 'Cappuccino', 'Sanduíches', 'Frappé', 'Saladas', 'Cafés diversos', 'Cinnamon rolls doces & salgados', 'Chá', 'Bowls', 'Smoothies proteicos', 'Brownies diferentes'],
  nota: 'Cardápio de estreia · pode variar com a fornada e a estação',
};
