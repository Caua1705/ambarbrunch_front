# Cardápio: imagens que faltam

Catálogo 2026-11-06.1: 57 produtos, 11 com imagem e 46 sem. Enquanto a imagem não chega, a página mantém o ícone da categoria, ou a
lista corrida nas categorias em que nenhum produto tem imagem nem descrição.

| Categoria | Produtos | Com imagem | Faltam |
|---|---|---:|---:|
| Croissants | 5 | 0 | 5 |
| Brunchs | 4 | 0 | 4 |
| Sanduíches | 4 | 1 | 3 |
| Bowls | 4 | 0 | 4 |
| Cheesecakes | 7 | 0 | 7 |
| Cinnamon Rolls | 4 | 4 | 0 |
| Cafés | 11 | 0 | 11 |
| Sucos | 6 | 0 | 6 |
| Cafés gelados | 6 | 6 | 0 |
| Outras bebidas | 6 | 0 | 6 |

## Como enviar

Um ZIP com as pastas e os nomes abaixo, uma imagem por produto:

- quadrada (1:1), de preferência com 800 × 800 px ou mais, em WebP, JPEG ou PNG;
- o produto centralizado, ocupando boa parte do quadro: ela aparece com 64 px no celular e 88 px no desktop;
- sem texto, preço ou logotipo de terceiros por cima;
- do próprio produto: foto de outro sabor não serve, nem entre produtos de nome parecido (Cheesecake Biscoff, Cinnamon Roll Biscoff e Biscoff Latte
  são três imagens diferentes).

Ao receber: copiar para `src/assets/media/cardapio/` e acrescentar cada id em `FOTOS_PRODUTO` (`src/data/cardapio.ts`), com `real` ou `ilustrativa`.

## Croissants

| Arquivo no ZIP | Produto | id no catálogo |
|---|---|---|
| `croissants/classico.webp` | Clássico | `croissants.classico` |
| `croissants/brie-e-geleia.webp` | Brie e Geleia | `croissants.brie_e_geleia` |
| `croissants/mortadela-pistache.webp` | Mortadela & Pistache | `croissants.mortadela_pistache` |
| `croissants/caprese.webp` | Caprese | `croissants.caprese` |
| `croissants/maca-caramelizada.webp` | Maçã Caramelizada | `croissants.maca_caramelizada` |

## Brunchs

| Arquivo no ZIP | Produto | id no catálogo |
|---|---|---|
| `brunches/american-brunch.webp` | American Brunch | `brunches.american_brunch` |
| `brunches/italian-morning.webp` | Italian Morning | `brunches.italian_morning` |
| `brunches/green-morning.webp` | Green Morning | `brunches.green_morning` |
| `brunches/blueberry-morning.webp` | Blueberry Morning | `brunches.blueberry_morning` |

## Sanduíches

| Arquivo no ZIP | Produto | id no catálogo |
|---|---|---|
| `sanduiches/steak-herbs.webp` | Steak & Herbs | `sanduiches.steak_herbs` |
| `sanduiches/ragu.webp` | Ragù | `sanduiches.ragu` |
| `sanduiches/tuna.webp` | Tuna | `sanduiches.tuna` |

## Bowls

| Arquivo no ZIP | Produto | id no catálogo |
|---|---|---|
| `bowls/ragu.webp` | Ragù | `bowls.ragu` |
| `bowls/atum.webp` | Atum | `bowls.atum` |
| `bowls/citrico-chicken.webp` | Cítrico Chicken | `bowls.citrico_chicken` |
| `bowls/camarao-fresh.webp` | Camarão Fresh | `bowls.camarao_fresh` |

## Cheesecakes

| Arquivo no ZIP | Produto | id no catálogo |
|---|---|---|
| `cheesecakes/biscoff.webp` | Biscoff | `cheesecakes.biscoff` |
| `cheesecakes/pistache.webp` | Pistache | `cheesecakes.pistache` |
| `cheesecakes/mirtilo-ao-limmone.webp` | Mirtilo ao Limmone | `cheesecakes.mirtilo_ao_limmone` |
| `cheesecakes/morango.webp` | Morango | `cheesecakes.morango` |
| `cheesecakes/goiaba.webp` | Goiaba | `cheesecakes.goiaba` |
| `cheesecakes/frutas-vermelhas.webp` | Frutas Vermelhas | `cheesecakes.frutas_vermelhas` |
| `cheesecakes/maca-com-crumble-fatia.webp` | Maçã com Crumble (fatia) | `cheesecakes.maca_com_crumble_fatia` |

## Cafés

| Arquivo no ZIP | Produto | id no catálogo |
|---|---|---|
| `cafes/cappuccino.webp` | Cappuccino | `cafes.cappuccino` |
| `cafes/cappuccino-gelado.webp` | Cappuccino gelado | `cafes.cappuccino_gelado` |
| `cafes/cappuccino-italiano.webp` | Cappuccino italiano | `cafes.cappuccino_italiano` |
| `cafes/cafe-expresso.webp` | Café expresso | `cafes.cafe_expresso` |
| `cafes/macchiato.webp` | Macchiato | `cafes.macchiato` |
| `cafes/cafe-coado.webp` | Café Coado | `cafes.cafe_coado` |
| `cafes/coado-na-mesa.webp` | Coado na mesa | `cafes.coado_na_mesa` |
| `cafes/cafe-na-prensa-francesa.webp` | Café na prensa francesa | `cafes.cafe_na_prensa_francesa` |
| `cafes/expresso-duplo.webp` | Expresso duplo | `cafes.expresso_duplo` |
| `cafes/matcha-latte.webp` | Matcha latte | `cafes.matcha_latte` |
| `cafes/matcha-honey.webp` | Matcha honey | `cafes.matcha_honey` |

## Sucos

| Arquivo no ZIP | Produto | id no catálogo |
|---|---|---|
| `sucos/laranja.webp` | Laranja | `sucos.laranja` |
| `sucos/morango.webp` | Morango | `sucos.morango` |
| `sucos/laranja-e-morango.webp` | Laranja e morango | `sucos.laranja_e_morango` |
| `sucos/retinol.webp` | Retinol | `sucos.retinol` |
| `sucos/green.webp` | Green | `sucos.green` |
| `sucos/antioxidant.webp` | Antioxidant | `sucos.antioxidant` |

## Outras bebidas

| Arquivo no ZIP | Produto | id no catálogo |
|---|---|---|
| `outras-bebidas/agua.webp` | Água | `outras_bebidas.agua` |
| `outras-bebidas/agua-com-gas.webp` | Água com gás | `outras_bebidas.agua_com_gas` |
| `outras-bebidas/coca-cola.webp` | Coca-Cola | `outras_bebidas.coca_cola` |
| `outras-bebidas/coca-cola-zero.webp` | Coca-Cola Zero | `outras_bebidas.coca_cola_zero` |
| `outras-bebidas/guarana.webp` | Guaraná | `outras_bebidas.guarana` |
| `outras-bebidas/guarana-zero.webp` | Guaraná Zero | `outras_bebidas.guarana_zero` |
