// Apresentação do cardápio no site: como cada categoria do catálogo oficial aparece (cor, grupo, ícone) e qual foto cada produto usa.
// NÃO guarda produto, descrição nem preço: tudo isso vem da API do backend (lib/cardapio/catalogo.ts). Foto e categoria se ligam pelo id
// estável do backend, nunca pelo nome. Regra das imagens de produto: só imagem em que dá para reconhecer aquele produto, com o que o catálogo
// descreve. Sem uma, o site mostra a apresentação neutra (sem inventar imagem). Produtos sem imagem: docs/technical/CARDAPIO-FOTOS-PENDENTES.md.
import type { Origem } from '../lib/conteudo';
import { formatarPreco, temCentavos, type Catalogo, type CategoriaCatalogo, type GrupoAdicionais } from '../lib/cardapio/contrato';

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
const real = (src: string, alt: string): FotoCardapio => ({ src, alt, origem: 'real' });
const ilustrativa = (src: string, alt: string): FotoCardapio => ({ src, alt, origem: 'ilustrativa' });

export type Icone = 'croissant' | 'prato' | 'sanduiche' | 'bowl' | 'roll' | 'fatia' | 'cafe' | 'gelado' | 'suco' | 'lata';

interface ApresentacaoCategoria {
  /** âncora em /cardapio/ e etiqueta da home */
  ancora: string;
  grupo: 'comer' | 'beber';
  cor: Cor;
  icone: Icone;
  /** foto de abertura da categoria (só real) em /cardapio/ */
  capa?: FotoCardapio;
  /** foto do cartão da home: pode ser ilustrativa aprovada, nunca apresentada como um produto específico */
  fotoHome?: FotoCardapio;
  /** leva à seção da home que aprofunda a categoria */
  atalho?: { href: string; texto: string };
}

const croissantReal = real('gastronomia/croissant-prato-azul.webp', 'Croissant recheado num prato azul');
const rollReal = real('roll/caixa-roll.webp', 'Caixa da Roll aberta com quatro cinnamon rolls de sabores diferentes');

/** Chave: id da categoria no backend (o id de “Brunchs” segue `brunches`). */
const CATEGORIAS: Record<string, ApresentacaoCategoria> = {
  croissants: { ancora: 'croissants', grupo: 'comer', cor: 'caramel', icone: 'croissant', capa: croissantReal, fotoHome: croissantReal },
  brunches: { ancora: 'brunchs', grupo: 'comer', cor: 'wine', icone: 'prato',
    fotoHome: real('gastronomia/bruschetta-brunch.webp', 'Prato de brunch servido com xícara de café ao lado') },
  sanduiches: { ancora: 'sanduiches', grupo: 'comer', cor: 'cacao', icone: 'sanduiche',
    fotoHome: ilustrativa('cardapio/sanduiche-brie.webp', 'Sanduíche de brie derretido com geleia de mirtilo') },
  bowls: { ancora: 'bowls', grupo: 'comer', cor: 'leaf', icone: 'bowl' },
  cinnamon_rolls: { ancora: 'rolls', grupo: 'comer', cor: 'butter', icone: 'roll', capa: rollReal, fotoHome: rollReal,
    atalho: { href: '#roll', texto: 'direto da fornada' } },
  cheesecakes: { ancora: 'cheesecakes', grupo: 'comer', cor: 'berry', icone: 'fatia' },
  cafes: { ancora: 'cafes', grupo: 'beber', cor: 'cacao', icone: 'cafe',
    fotoHome: ilustrativa('cardapio/cafes-diversos.webp', 'Café expresso e café com leite em copos de vidro') },
  // a âncora continua “gelados”: o atalho “ver bebidas no cardápio” do Café + Roll abre esta etiqueta
  cafes_gelados: { ancora: 'gelados', grupo: 'beber', cor: 'caramel', icone: 'gelado',
    fotoHome: ilustrativa('cardapio/cafes-gelados.webp', 'Café gelado e matcha em copos com gelo'),
    atalho: { href: '#cafe-roll', texto: 'café + roll' } },
  sucos: { ancora: 'sucos', grupo: 'beber', cor: 'berry', icone: 'suco' },
  outras_bebidas: { ancora: 'outras-bebidas', grupo: 'beber', cor: 'butter', icone: 'lata' },
};

/**
 * Imagem por produto (id estável do backend). `real`: fotos da Roll autorizadas em 2026-10-17. `ilustrativa`: não é foto do produto servido.
 * Origem de cada arte em docs/technical/CARDAPIO.md. Só as reais aparecem como miniatura na home.
 */
export const FOTOS_PRODUTO: Record<string, FotoCardapio> = {
  'cinnamon_rolls.mood_cheesecake': real('roll/roll-mood-cheesecake.webp', 'Cinnamon roll Mood Cheesecake com geleia de morango e crumble'),
  'cinnamon_rolls.kinder_bueno': real('roll/roll-kinder-bueno.webp', 'Cinnamon roll Kinder Bueno com fios de Nutella'),
  'cinnamon_rolls.biscoff': real('roll/roll-biscoff.webp', 'Cinnamon roll de Biscoff com creme e biscoito triturado'),
  'cinnamon_rolls.tradicional': ilustrativa('roll/roll-tradicional.webp', 'Cinnamon roll Tradicional em espiral, com glacê'),
  'sanduiches.brie_blueberry': ilustrativa('cardapio/sanduiche-brie.webp', 'Sanduíche de brie derretido com geleia de mirtilo e lascas de parmesão'),
  'cafes_gelados.matcha_latte': ilustrativa('cardapio/copo-matcha-latte.webp', 'Copo de Matcha Latte com gelo, com o verde do matcha sobre o leite'),
  'cafes_gelados.matcha_geleia_de_morango': ilustrativa('cardapio/copo-matcha-geleia-de-morango.webp', 'Copo de Matcha Geleia de Morango com gelo, com camadas de matcha, leite e geleia'),
  'cafes_gelados.honey_latte': ilustrativa('cardapio/copo-honey-latte.webp', 'Copo de Honey Latte com gelo'),
  'cafes_gelados.iced_latte': ilustrativa('cardapio/copo-iced-latte.webp', 'Copo de Iced Latte com gelo'),
  'cafes_gelados.biscoff_latte': ilustrativa('cardapio/copo-biscoff-latte.webp', 'Copo de Biscoff Latte com gelo e pedaços de biscoito'),
  'cafes_gelados.cinnamon_latte': ilustrativa('cardapio/copo-cinnamon-latte.webp', 'Copo de Cinnamon Latte com gelo e um mini cinnamon roll por cima'),
};

export interface ProdutoVista { id: string; nome: string; descricao: string | null; preco: string; precoCentavos: number; foto?: FotoCardapio }
export interface CategoriaVista extends ApresentacaoCategoria {
  id: string;
  nome: string;
  observacao: string | null;
  produtos: ProdutoVista[];
  /** sem foto e sem descrição em nenhum produto: lista corrida, como nas artes */
  compacta: boolean;
  adicionais: GrupoVista[];
}
export interface GrupoVista { id: string; nome: string; itens: { id: string; nome: string; preco: string; precoCentavos: number }[] }

const grupoVista = (g: GrupoAdicionais): GrupoVista => ({
  id: g.id, nome: g.nome,
  itens: g.itens.map((i) => ({ id: i.id, nome: i.nome, preco: `+ ${formatarPreco(i.preco_centavos)}`, precoCentavos: i.preco_centavos })),
});

function categoriaVista(c: CategoriaCatalogo, catalogo: Catalogo): CategoriaVista {
  const a = CATEGORIAS[c.id];
  if (!a) throw new Error(`Categoria sem apresentação no site: ${c.id}. Acrescente em src/data/cardapio.ts.`);
  const centavos = temCentavos(c.itens);
  const produtos = c.itens.map((i): ProdutoVista => ({
    id: i.id, nome: i.nome, descricao: i.descricao, preco: formatarPreco(i.preco_centavos, centavos), precoCentavos: i.preco_centavos, foto: FOTOS_PRODUTO[i.id],
  }));
  return {
    ...a, id: c.id, nome: c.nome, observacao: c.observacao, produtos,
    compacta: produtos.every((p) => !p.foto && !p.descricao),
    adicionais: catalogo.adicionais.filter((g) => g.aplicavel_a.includes(c.id)).map(grupoVista),
  };
}

/** O cardápio pronto para mostrar: mesma ordem e mesmos dados em todas as páginas. Foto ligada a um id que saiu do catálogo derruba o build. */
export function montarCardapio(catalogo: Catalogo) {
  const ids = new Set(catalogo.categorias.flatMap((c) => c.itens.map((i) => i.id)));
  const orfas = Object.keys(FOTOS_PRODUTO).filter((id) => !ids.has(id));
  if (orfas.length) throw new Error(`Foto de produto que não existe no catálogo: ${orfas.join(', ')}.`);
  const categorias = catalogo.categorias.map((c) => categoriaVista(c, catalogo));
  const comer = categorias.filter((c) => c.grupo === 'comer');
  const beber = categorias.filter((c) => c.grupo === 'beber');
  const nomes = comer.flatMap((c, n) => (beber[n] ? [c.nome, beber[n].nome] : [c.nome]));
  return {
    comer, beber,
    /** adicionais sem categoria definida: ficam na seção de bebidas, sem prometer por produto */
    adicionaisBebidas: catalogo.adicionais.filter((g) => !g.aplicavel_a.length).map(grupoVista),
    /** Faixa em movimento abaixo do hero. A lista vai duas vezes: uma volta só não cobre uma tela de desktop. */
    faixa: [...nomes, ...nomes],
    versao: catalogo.versao,
  };
}
export type Cardapio = ReturnType<typeof montarCardapio>;
