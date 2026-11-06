// Apresentação do cardápio no site: como cada categoria do catálogo oficial aparece (cor, grupo, ícone) e qual foto cada produto usa.
// NÃO guarda produto, descrição nem preço: tudo isso vem da API do backend (lib/cardapio/catalogo.ts). Foto e categoria se ligam pelo id
// estável do backend, nunca pelo nome. Regra das imagens de produto: só imagem em que dá para reconhecer aquele produto, com o que o catálogo
// descreve. Sem uma, o site mostra a apresentação neutra (sem inventar imagem). Produtos sem imagem: docs/technical/CARDAPIO-FOTOS-PENDENTES.md.
import type { Origem } from '../lib/conteudo';
import { formatarPreco, temCentavos, type Catalogo, type CategoriaCatalogo, type GrupoAdicionais } from '../lib/cardapio/contrato';

export interface FotoCardapio {
  src: string;
  alt: string;
  origem: Origem;
  /** versão maior para o modal, quando o recorte da miniatura não aguenta ser ampliado */
  ampliada?: string;
}
const real = (src: string, alt: string): FotoCardapio => ({ src, alt, origem: 'real' });
const ilustrativa = (src: string, alt: string, ampliada?: string): FotoCardapio => ({ src, alt, origem: 'ilustrativa', ampliada });

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
 * Imagem por produto (id estável do backend). `real`: fotos da Roll autorizadas em 2026-10-17. `ilustrativa`: não é foto do produto servido.
 * Origem de cada imagem em docs/technical/CARDAPIO.md; as recusadas e o motivo, em CARDAPIO-FOTOS-PENDENTES.md.
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
  'croissants.classico': ilustrativa('cardapio/produtos/croissants/classico.webp', 'Croissant dourado e folhado', 'cardapio/produtos/ampliadas/croissants/classico.webp'),
  'croissants.brie_e_geleia': ilustrativa('cardapio/produtos/croissants/brie-e-geleia.webp', 'Croissant recheado com queijo brie e geleia vermelha', 'cardapio/produtos/ampliadas/croissants/brie-e-geleia.webp'),
  'croissants.mortadela_pistache': ilustrativa('cardapio/produtos/croissants/mortadela-pistache.webp', 'Croissant recheado com mortadela e pistache moído', 'cardapio/produtos/ampliadas/croissants/mortadela-pistache.webp'),
  'croissants.caprese': ilustrativa('cardapio/produtos/croissants/caprese.webp', 'Croissant recheado com tomate, mussarela de búfala e pesto', 'cardapio/produtos/ampliadas/croissants/caprese.webp'),
  'croissants.maca_caramelizada': ilustrativa('cardapio/produtos/croissants/maca-caramelizada.webp', 'Croissant com maçã caramelizada e amêndoas tostadas', 'cardapio/produtos/ampliadas/croissants/maca-caramelizada.webp'),
  'brunches.green_morning': ilustrativa('cardapio/produtos/brunches/green-morning.webp', 'Ovos cremosos com fatias de avocado'),
  'sanduiches.ragu': ilustrativa('cardapio/produtos/sanduiches/ragu.webp', 'Sanduíche de ragu de carne com queijo derretido', 'cardapio/produtos/ampliadas/sanduiches/ragu.webp'),
  'bowls.ragu': ilustrativa('cardapio/produtos/bowls/ragu.webp', 'Bowl de ragu com quinoa e tomate'),
  'bowls.atum': ilustrativa('cardapio/produtos/bowls/atum.webp', 'Bowl de atum com tomate'),
  'bowls.citrico_chicken': ilustrativa('cardapio/produtos/bowls/citrico-chicken.webp', 'Bowl de frango com quinoa, tomate e folhas', 'cardapio/produtos/ampliadas/bowls/citrico-chicken.webp'),
  'bowls.camarao_fresh': ilustrativa('cardapio/produtos/bowls/camarao-fresh.webp', 'Bowl com camarões grelhados'),
  'cheesecakes.biscoff': ilustrativa('cardapio/produtos/cheesecakes/biscoff.webp', 'Fatia de cheesecake com calda e biscoito Biscoff', 'cardapio/produtos/ampliadas/cheesecakes/biscoff.webp'),
  'cheesecakes.pistache': ilustrativa('cardapio/produtos/cheesecakes/pistache.webp', 'Fatia de cheesecake com creme de pistache', 'cardapio/produtos/ampliadas/cheesecakes/pistache.webp'),
  'cheesecakes.mirtilo_ao_limmone': ilustrativa('cardapio/produtos/cheesecakes/mirtilo-ao-limmone.webp', 'Fatia de cheesecake com mirtilos e raspas de limão', 'cardapio/produtos/ampliadas/cheesecakes/mirtilo-ao-limmone.webp'),
  'cheesecakes.morango': ilustrativa('cardapio/produtos/cheesecakes/morango.webp', 'Fatia de cheesecake com morangos e calda', 'cardapio/produtos/ampliadas/cheesecakes/morango.webp'),
  'cheesecakes.goiaba': ilustrativa('cardapio/produtos/cheesecakes/goiaba.webp', 'Fatia de cheesecake com calda de goiaba', 'cardapio/produtos/ampliadas/cheesecakes/goiaba.webp'),
  'cheesecakes.frutas_vermelhas': ilustrativa('cardapio/produtos/cheesecakes/frutas-vermelhas.webp', 'Fatia de cheesecake com frutas vermelhas', 'cardapio/produtos/ampliadas/cheesecakes/frutas-vermelhas.webp'),
  'cheesecakes.maca_com_crumble_fatia': ilustrativa('cardapio/produtos/cheesecakes/maca-com-crumble-fatia.webp', 'Fatia de torta de maçã com crumble', 'cardapio/produtos/ampliadas/cheesecakes/maca-com-crumble-fatia.webp'),
  'cafes.cappuccino': ilustrativa('cardapio/produtos/cafes/cappuccino.webp', 'Xícara de cappuccino com desenho na espuma'),
  'cafes.cappuccino_gelado': ilustrativa('cardapio/produtos/cafes/cappuccino-gelado.webp', 'Copo de cappuccino gelado com creme e calda'),
  'cafes.cappuccino_italiano': ilustrativa('cardapio/produtos/cafes/cappuccino-italiano.webp', 'Xícara de cappuccino italiano com cacau sobre a espuma'),
  'cafes.cafe_expresso': ilustrativa('cardapio/produtos/cafes/cafe-expresso.webp', 'Xícara de café expresso'),
  'cafes.macchiato': ilustrativa('cardapio/produtos/cafes/macchiato.webp', 'Macchiato com espuma de leite'),
  'cafes.cafe_coado': ilustrativa('cardapio/produtos/cafes/cafe-coado.webp', 'Xícara de café coado'),
  'cafes.coado_na_mesa': ilustrativa('cardapio/produtos/cafes/coado-na-mesa.webp', 'Coador de vidro com café moído'),
  'cafes.cafe_na_prensa_francesa': ilustrativa('cardapio/produtos/cafes/cafe-na-prensa-francesa.webp', 'Café em prensa francesa de vidro'),
  'cafes.matcha_latte': ilustrativa('cardapio/produtos/cafes/matcha-latte.webp', 'Xícara de matcha latte com desenho na espuma'),
  'cafes.matcha_honey': ilustrativa('cardapio/produtos/cafes/matcha-honey.webp', 'Copo de matcha honey'),
  'sucos.laranja': ilustrativa('cardapio/produtos/sucos/laranja.webp', 'Copo de suco de laranja'),
  'sucos.morango': ilustrativa('cardapio/produtos/sucos/morango.webp', 'Copo de suco de morango'),
  'sucos.laranja_e_morango': ilustrativa('cardapio/produtos/sucos/laranja-e-morango.webp', 'Copo de suco de laranja e morango'),
  'sucos.green': ilustrativa('cardapio/produtos/sucos/green.webp', 'Copo de suco verde'),
  'sucos.antioxidant': ilustrativa('cardapio/produtos/sucos/antioxidant.webp', 'Copo de suco de frutas vermelhas'),
  'outras_bebidas.agua': ilustrativa('cardapio/produtos/outras-bebidas/agua.webp', 'Garrafa de água'),
  'outras_bebidas.agua_com_gas': ilustrativa('cardapio/produtos/outras-bebidas/agua-com-gas.webp', 'Garrafa de água com gás'),
  'brunches.american_brunch': ilustrativa('cardapio/produtos/brunches/american-brunch.webp', 'Ovos mexidos, bacon crocante, pão de fermentação natural e maple syrup'),
  'brunches.italian_morning': ilustrativa('cardapio/produtos/brunches/italian-morning.webp', 'Ovos cremosos, mussarela de búfala, tomate confitado, rúcula, pesto e pão de fermentação natural'),
  'brunches.blueberry_morning': ilustrativa('cardapio/produtos/brunches/blueberry-morning.webp', 'Ovos mexidos, pão de fermentação natural tostado, ricota e geleia de mirtilo'),
  'sanduiches.steak_herbs': ilustrativa('cardapio/produtos/sanduiches/steak-herbs.webp', 'Sanduíche com tiras de carne, molho de ervas, provolone derretido e crosta de parmesão'),
  'sanduiches.tuna': ilustrativa('cardapio/produtos/sanduiches/tuna.webp', 'Sanduíche de atum fresco com pepino, cebola roxa, cebolinha e gergelim'),
  'cafes.expresso_duplo': ilustrativa('cardapio/produtos/cafes/expresso-duplo.webp', 'Expresso duplo em copo de vidro'),
  'sucos.retinol': ilustrativa('cardapio/produtos/sucos/retinol.webp', 'Copo de suco Retinol, de cenoura, limão e cúrcuma'),
};

export interface ProdutoVista { id: string; nome: string; descricao: string | null; preco: string; precoCentavos: number; foto?: FotoCardapio }
export interface CategoriaVista extends ApresentacaoCategoria {
  id: string;
  nome: string;
  observacao: string | null;
  produtos: ProdutoVista[];
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
