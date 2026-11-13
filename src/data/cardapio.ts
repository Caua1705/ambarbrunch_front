// Apresentação do cardápio no site: como cada categoria do catálogo oficial aparece (cor, grupo, ícone) e qual foto cada produto usa.
// NÃO guarda produto, descrição nem preço: tudo isso vem da API do backend (lib/cardapio/catalogo.ts). Foto e categoria se ligam pelo id
// estável do backend, nunca pelo nome. Regra das imagens de produto: só imagem em que dá para reconhecer aquele produto, com o que o catálogo
// descreve. Sem uma, o site mostra a apresentação neutra (sem inventar imagem). Produtos sem imagem: docs/technical/CARDAPIO-FOTOS-PENDENTES.md.
import type { Origem } from '../lib/conteudo';
import { formatarPreco, temCentavos, type Catalogo, type CategoriaCatalogo, type GrupoAdicionais } from '../lib/cardapio/contrato';

/** Par de arquivos de um produto, sempre da mesma imagem-base: `src` é a miniatura 320 × 320 da lista e `ampliada` é a imagem do modal. */
export interface FotoCardapio {
  src: string;
  ampliada: string;
  alt: string;
  origem: Origem;
}
const par = (base: string, alt: string, origem: Origem): FotoCardapio => ({ src: `cardapio/miniaturas/${base}.webp`, ampliada: `cardapio/modal/${base}.webp`, alt, origem });
const real = (base: string, alt: string) => par(base, alt, 'real');
const ilustrativa = (base: string, alt: string) => par(base, alt, 'ilustrativa');

export type Icone = 'croissant' | 'prato' | 'sanduiche' | 'bowl' | 'roll' | 'fatia' | 'cafe' | 'gelado' | 'suco' | 'lata';

interface ApresentacaoCategoria {
  /** âncora em /cardapio/ */
  ancora: string;
  grupo: 'comer' | 'beber';
  icone: Icone;
}

/** Chave: id da categoria no backend (o id de “Brunchs” segue `brunches`). */
const CATEGORIAS: Record<string, ApresentacaoCategoria> = {
  croissants: { ancora: 'croissants', grupo: 'comer', icone: 'croissant' },
  brunches: { ancora: 'brunchs', grupo: 'comer', icone: 'prato' },
  sanduiches: { ancora: 'sanduiches', grupo: 'comer', icone: 'sanduiche' },
  bowls: { ancora: 'bowls', grupo: 'comer', icone: 'bowl' },
  cinnamon_rolls: { ancora: 'rolls', grupo: 'comer', icone: 'roll' },
  cheesecakes: { ancora: 'cheesecakes', grupo: 'comer', icone: 'fatia' },
  cafes: { ancora: 'cafes', grupo: 'beber', icone: 'cafe' },
  cafes_gelados: { ancora: 'gelados', grupo: 'beber', icone: 'gelado' },
  sucos: { ancora: 'sucos', grupo: 'beber', icone: 'suco' },
  outras_bebidas: { ancora: 'outras-bebidas', grupo: 'beber', icone: 'lata' },
};

/**
 * Imagem por produto (id estável do backend). `real`: fotos da Roll autorizadas em 2026-10-17 e foto do Sanduíche Ragù tirada no Âmbar (2026-11-07). `ilustrativa`: não é foto do produto servido.
 * Origem de cada imagem e o que falta: docs/technical/CARDAPIO-FOTOS-PENDENTES.md.
 */
export const FOTOS_PRODUTO: Record<string, FotoCardapio> = {
  'croissants.classico': ilustrativa('croissants/classico', 'Croissant dourado e folhado num prato de cerâmica'),
  'croissants.brie_e_geleia': ilustrativa('croissants/brie-e-geleia', 'Croissant recheado com queijo brie e geleia vermelha'),
  'croissants.mortadela_pistache': ilustrativa('croissants/mortadela-pistache', 'Croissant recheado com mortadela e mussarela de búfala, com pistache moído e melado de cana'),
  'croissants.caprese': ilustrativa('croissants/caprese', 'Croissant recheado com tomate confit, pesto e mussarela de búfala'),
  'croissants.maca_caramelizada': ilustrativa('croissants/maca-caramelizada', 'Croissant recheado com geleia de maçã caramelizada e amêndoas tostadas'),
  'brunches.american_brunch': ilustrativa('brunches/american-brunch', 'Ovos mexidos, bacon crocante, pão de fermentação natural e maple syrup'),
  'brunches.italian_morning': ilustrativa('brunches/italian-morning', 'Ovos cremosos, mussarela de búfala, tomate confitado, rúcula, pesto e pão de fermentação natural'),
  'brunches.green_morning': ilustrativa('brunches/green-morning', 'Ovos mexidos, avocado, espinafre, cottage, pão de fermentação natural e melaço de cana'),
  'brunches.blueberry_morning': ilustrativa('brunches/blueberry-morning', 'Ovos mexidos, pão de fermentação natural tostado, ricota e geleia de mirtilo'),
  'sanduiches.steak_herbs': ilustrativa('sanduiches/steak-herbs', 'Sanduíche com tiras de carne, molho de ervas, provolone derretido e crosta de parmesão'),
  'sanduiches.ragu': real('sanduiches/ragu', 'Sanduíche Ragù cortado ao meio, com ragu de carne e parmesão maçaricado sobre o pão, servido no Âmbar'),
  'sanduiches.tuna': ilustrativa('sanduiches/tuna', 'Sanduíche de atum fresco com pepino, cebola roxa, cebolinha e gergelim'),
  'sanduiches.brie_blueberry': ilustrativa('sanduiches/brie-blueberry', 'Sanduíche de brie derretido com geleia de mirtilo e lascas de parmesão'),
  'bowls.ragu': ilustrativa('bowls/ragu', 'Bowl de quinoa com ragu, tomate confitado, rúcula, milho crocante e cebola roxa'),
  'bowls.atum': ilustrativa('bowls/atum', 'Bowl de quinoa com atum fresco, folhas, avocado, tomate confitado e gergelim'),
  'bowls.citrico_chicken': ilustrativa('bowls/citrico-chicken', 'Bowl de quinoa com frango, tomate confitado, folhas, milho e gergelim'),
  'bowls.camarao_fresh': ilustrativa('bowls/camarao-fresh', 'Bowl de quinoa com camarões grelhados, manga, folhas, tomate confitado e pepino'),
  'cheesecakes.biscoff': ilustrativa('cheesecakes/biscoff', 'Fatia de cheesecake com creme e farofa de biscoito Biscoff'),
  'cheesecakes.pistache': ilustrativa('cheesecakes/pistache', 'Fatia de cheesecake com creme de pistache'),
  'cheesecakes.mirtilo_ao_limmone': ilustrativa('cheesecakes/mirtilo-ao-limmone', 'Fatia de cheesecake com mirtilos e raspas de limão'),
  'cheesecakes.morango': ilustrativa('cheesecakes/morango', 'Fatia de cheesecake com morangos e calda'),
  'cheesecakes.goiaba': ilustrativa('cheesecakes/goiaba', 'Fatia de cheesecake com calda de goiaba'),
  'cheesecakes.frutas_vermelhas': ilustrativa('cheesecakes/frutas-vermelhas', 'Fatia de cheesecake com frutas vermelhas'),
  'cheesecakes.maca_com_crumble_fatia': ilustrativa('cheesecakes/maca-com-crumble-fatia', 'Fatia de maçã com crumble dourado'),
  'cinnamon_rolls.tradicional': ilustrativa('cinnamon-rolls/tradicional', 'Cinnamon roll Tradicional em espiral, com glacê'),
  'cinnamon_rolls.mood_cheesecake': real('cinnamon-rolls/mood-cheesecake', 'Cinnamon roll Mood Cheesecake de massa vermelha, com glacê cremoso e farelo vermelho'),
  'cinnamon_rolls.kinder_bueno': real('cinnamon-rolls/kinder-bueno', 'Cinnamon roll Kinder Bueno com fios de Nutella'),
  'cinnamon_rolls.biscoff': real('cinnamon-rolls/biscoff', 'Cinnamon roll de Biscoff com creme e biscoito triturado'),
  'cafes.cappuccino': ilustrativa('cafes/cappuccino', 'Xícara de cappuccino com desenho na espuma'),
  'cafes.cappuccino_gelado': ilustrativa('cafes/cappuccino-gelado', 'Copo de cappuccino gelado com creme e calda'),
  'cafes.cappuccino_italiano': ilustrativa('cafes/cappuccino-italiano', 'Xícara de cappuccino italiano com cacau sobre a espuma'),
  'cafes.cafe_expresso': ilustrativa('cafes/cafe-expresso', 'Xícara de café expresso'),
  'cafes.macchiato': ilustrativa('cafes/macchiato', 'Macchiato com espuma de leite em copo de vidro'),
  'cafes.cafe_coado': ilustrativa('cafes/cafe-coado', 'Xícara de café coado'),
  'cafes.coado_na_mesa': ilustrativa('cafes/coado-na-mesa', 'Coador de vidro com café ao lado de uma xícara'),
  'cafes.cafe_na_prensa_francesa': ilustrativa('cafes/cafe-na-prensa-francesa', 'Café em prensa francesa de vidro ao lado de uma xícara'),
  'cafes.expresso_duplo': ilustrativa('cafes/expresso-duplo', 'Expresso duplo em copo de vidro'),
  'cafes.matcha_latte': ilustrativa('cafes/matcha-latte', 'Xícara de matcha latte com desenho na espuma'),
  'cafes.matcha_honey': ilustrativa('cafes/matcha-honey', 'Copo de matcha honey'),
  'sucos.laranja': ilustrativa('sucos/laranja', 'Copo de suco de laranja'),
  'sucos.morango': ilustrativa('sucos/morango', 'Copo de suco de morango'),
  'sucos.laranja_e_morango': ilustrativa('sucos/laranja-e-morango', 'Copo de suco de laranja e morango'),
  'sucos.retinol': ilustrativa('sucos/retinol', 'Copo de suco Retinol, de cenoura, limão e cúrcuma'),
  'sucos.green': ilustrativa('sucos/green', 'Copo de suco verde com couve, laranja, kiwi, hortelã e abacaxi'),
  'sucos.antioxidant': ilustrativa('sucos/vitalidade', 'Copo de suco de beterraba, cenoura e laranja'),
  'cafes_gelados.matcha_latte': ilustrativa('cafes-gelados/copo-matcha-latte', 'Copo de Matcha Latte com gelo, com o verde do matcha sobre o leite'),
  'cafes_gelados.matcha_geleia_de_morango': ilustrativa('cafes-gelados/copo-matcha-geleia-de-morango', 'Copo de Matcha Geleia de Morango com gelo, com camadas de matcha, leite e geleia'),
  'cafes_gelados.honey_latte': ilustrativa('cafes-gelados/copo-honey-latte', 'Copo de Honey Latte com gelo'),
  'cafes_gelados.iced_latte': ilustrativa('cafes-gelados/copo-iced-latte', 'Copo de Iced Latte com gelo'),
  'cafes_gelados.biscoff_latte': ilustrativa('cafes-gelados/copo-biscoff-latte', 'Copo de Biscoff Latte com gelo e pedaços de biscoito'),
  'cafes_gelados.cinnamon_latte': ilustrativa('cafes-gelados/copo-cinnamon-latte', 'Copo de Cinnamon Latte com gelo e um mini cinnamon roll por cima'),
  'outras_bebidas.agua': ilustrativa('outras-bebidas/agua', 'Garrafa de água sem rótulo'),
  'outras_bebidas.agua_com_gas': ilustrativa('outras-bebidas/agua-com-gas', 'Garrafa de água com gás sem rótulo'),
};

export interface ProdutoVista { id: string; nome: string; descricao: string | null; preco: string; precoCentavos: number; foto?: FotoCardapio }
export interface CategoriaVista extends ApresentacaoCategoria {
  id: string;
  nome: string;
  observacao: string | null;
  produtos: ProdutoVista[];
  adicionais: GrupoVista[];
}
export interface GrupoVista { id: string; nome: string; nota: string | null; itens: { id: string; nome: string; preco: string; precoCentavos: number }[] }

/** A observação só aparece em grupo de várias categorias (diz a quais vale); nos outros ela é nota interna do catálogo. */
const grupoVista = (g: GrupoAdicionais): GrupoVista => ({
  id: g.id, nome: g.nome, nota: g.aplicavel_a.length > 1 ? g.observacao : null,
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
    // grupo de várias categorias aparece uma vez só, depois da última delas na ordem do cardápio
    adicionais: catalogo.adicionais.filter((g) => catalogo.categorias.filter((k) => g.aplicavel_a.includes(k.id)).at(-1)?.id === c.id).map(grupoVista),
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
