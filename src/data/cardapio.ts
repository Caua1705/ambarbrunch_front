// Cardápio do Âmbar Brunch — cardápio oficial “Âmbar Café & Brunch” (2 páginas, recebido em 2026-10-20): cafés, sucos,
// cafés gelados, croissants, toasts, sanduíches e bowls. Só os produtos dele, mais os cinnamon rolls da Roll (cardápio
// “Roll · cinnamon rolls”; pág. 12 da proposta para os salgados). Descrições: as do cardápio oficial, sem ingrediente a
// mais. Sem preço e sem disponibilidade do dia.
// Foto principal só quando a imagem mostra de fato a categoria (real ou ilustrativa, ver lib/conteudo.ts → Origem);
// sem uma foto correta, o cartão abre só com o título — nunca a foto de um prato que não está no cardápio.
import type { Origem } from '../lib/conteudo';

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
  linha?: string;                                  // subtítulo do cardápio do cliente (ex.: “pão de longa fermentação”)
  /** foto principal da categoria — só quando mostra a categoria de verdade */
  foto?: FotoCardapio;
  grupos: Grupo[];
  /** grupos viram abas (ex.: doces | salgados) */
  abas?: boolean;
  nota?: string;
  ancora?: { href: string; texto: string };       // leva à seção que aprofunda a categoria
}
export interface Categoria { id: string; nome: string; cor: Cor; detalhe: Detalhe }

const real = (src: string, alt: string): FotoCardapio => ({ src, alt, origem: 'real' });
const ilustrativa = (src: string, alt: string): FotoCardapio => ({ src, alt, origem: 'ilustrativa' });

/** Sabores da Roll em destaque no cartão (cardápio “Roll · cinnamon rolls”): foto + uma linha curta. */
const rollsDoces: Item[] = [
  { nome: 'Tradicional', desc: 'canela, açúcar mascavo e glacê', foto: ilustrativa('cardapio/roll-tradicional.webp', 'Cinnamon roll tradicional com glacê') },
  { nome: 'Mood cheesecake', desc: 'cheesecake, morango e crumble', foto: real('roll/roll-mood-cheesecake.webp', 'Cinnamon roll Mood cheesecake com geleia de morango e crumble') },
  { nome: 'S’mores', desc: 'chocolate e marshmallow tostado', foto: real('roll/roll-smores.webp', 'Cinnamon roll S’mores com marshmallow tostado') },
  { nome: 'Kinder Bueno', desc: 'Kinder Bueno e Nutella', foto: real('roll/roll-kinder-bueno.webp', 'Cinnamon roll Kinder Bueno com fios de Nutella') },
];

const FAIXA = ['Croissants', 'Cafés', 'Toasts', 'Cafés gelados', 'Sanduíches', 'Sucos', 'Bowls', 'Cinnamon rolls'];

export const cardapio: { comer: Categoria[]; beber: Categoria[]; faixa: string[] } = {
  comer: [
    { id: 'croissants', nome: 'Croissants', cor: 'caramel', detalhe: {
      foto: real('gastronomia/croissant-prato-azul.webp', 'Croissant num prato azul'),
      grupos: [{ itens: [
        { nome: 'Clássico', desc: 'massa folhada e amanteigada' },
        { nome: 'Brie e geleia', desc: 'queijo brie e geleia artesanal · consultar disponibilidade' },
        { nome: 'Caprese', desc: 'mussarela de búfala, manjericão e tomate cereja confitado' },
        { nome: 'Prosciutto', desc: 'presunto de parma, mussarela de búfala, tomate cereja, rúcula e mel' },
      ] }],
    } },
    { id: 'toasts', nome: 'Toasts', cor: 'wine', detalhe: {
      foto: real('gastronomia/bruschetta-brunch.webp', 'Toast servido num prato branco, com xícara de café ao lado'),
      grupos: [{ itens: [
        { nome: 'Figo & brie', desc: 'toast com queijo brie, cottage, figo, finalizado com mel, nozes e parma' },
        { nome: 'Avocado toast', desc: 'avocado, ovos mexidos e cottage, finalizado com mix de grãos' },
        { nome: 'Toast americano', desc: 'ovos mexidos, bacon e maple syrup' },
      ] }],
    } },
    { id: 'sanduiches', nome: 'Sanduíches', cor: 'cacao', detalhe: {
      linha: 'pão de longa fermentação',
      foto: ilustrativa('cardapio/sanduiche-brie.webp', 'Sanduíche de brie derretido com geleia de mirtilo'),
      grupos: [{ itens: [
        { nome: 'Steak & Herbs', desc: 'tiras de carne bovina selada, molho fresco de ervas, provolone derretido e crosta de parmesão maçaricado' },
        { nome: 'Ragú', desc: 'ragú de carne bovina cozida lentamente, provolone derretido, salsa verde e crosta de parmesão maçaricado' },
        { nome: 'Tuna', desc: 'atum fresco, maionese picante, pepino japonês, cebola roxa, cebolinha, gergelim e limão' },
        { nome: 'Brie & Blueberry', desc: 'queijo brie derretido, geleia de mirtilo e mel trufado' },
      ] }],
    } },
    { id: 'bowls', nome: 'Bowls', cor: 'leaf', detalhe: {
      grupos: [{ itens: [
        { nome: 'Ragú', desc: 'quinoa, tomate confitado, rúcula, pesto e picles de cebola roxa' },
        { nome: 'Salmão', desc: 'arroz integral, edamame, salmão, sunomono saudável, ricota, avocado temperado e shoyu de coco' },
        { nome: 'Vegetariano', desc: 'mix de folhas, quinoa, legumes assados, avocado, cenoura, tomate cereja, cottage e molho de tahine com limão' },
        { nome: 'Chicken', desc: 'frango à base de laranja, quinoa, milho, tomates cereja, ricota light e mix de folhas, finalizado com gergelim' },
      ] }],
    } },
    { id: 'rolls', nome: 'Cinnamon rolls doces & salgados', cor: 'butter', detalhe: {
      linha: 'com assinatura da Roll',
      foto: real('roll/roll-espiral.webp', 'Cinnamon roll em espiral entre rolls red velvet, na bandeja da Roll'),
      abas: true,
      grupos: [
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
  ],
  beber: [
    { id: 'cafes', nome: 'Cafés', cor: 'cacao', detalhe: {
      foto: ilustrativa('cardapio/cafes-diversos.webp', 'Café expresso e café com leite em copos de vidro'),
      grupos: [{ itens: [
        { nome: 'Cappuccino' }, { nome: 'Cappuccino gelado' }, { nome: 'Café expresso' }, { nome: 'Macchiato' },
        { nome: 'Café na prensa francesa' }, { nome: 'Coado na mesa' }, { nome: 'Expresso duplo' },
      ] }],
    } },
    // o id continua “gelados”: o atalho “ver bebidas no cardápio” do Café + Roll abre esta etiqueta
    { id: 'gelados', nome: 'Cafés gelados especiais', cor: 'caramel', detalhe: {
      foto: ilustrativa('cardapio/cafes-gelados.webp', 'Latte gelado e matcha latte em copos com gelo'),
      grupos: [{ itens: [
        { nome: 'Matcha latte', desc: 'matcha, leite e gelo' },
        { nome: 'Matcha frutas vermelhas', desc: 'matcha, frutas vermelhas, leite e gelo' },
        { nome: 'Honey latte', desc: 'café, leite, mel e gelo' },
        { nome: 'Iced americano', desc: 'café, água e gelo' },
        { nome: 'Biscoff latte', desc: 'café, leite, pasta Biscoff e gelo' },
        { nome: 'Cinnamon latte', desc: 'café, leite, caramelo e mini cinnamon roll' },
      ], nota: 'leites: integral · desnatado · aveia · amêndoas · vegetal' }],
      ancora: { href: '#cafe-roll', texto: 'café + roll' },
    } },
    { id: 'sucos', nome: 'Sucos', cor: 'berry', detalhe: {
      grupos: [{ itens: [
        { nome: 'Laranja' },
        { nome: 'Retinol', desc: 'cenoura, limão, gengibre, água de coco, cúrcuma e óleo de coco' },
        { nome: 'Green', desc: 'couve-manteiga, laranja, kiwi, hortelã e abacaxi' },
        { nome: 'Antioxidant', desc: 'frutas vermelhas, limão e melancia' },
      ] }],
    } },
  ],
  /** Faixa em movimento abaixo do hero: as categorias do cardápio, alternando comer e beber. A lista vai duas vezes: com
   *  oito nomes, uma volta só (~1.170 px) não cobre uma tela de desktop e o laço abriria um buraco no fim. */
  faixa: [...FAIXA, ...FAIXA],
};
