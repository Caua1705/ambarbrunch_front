# Cardápio: imagens que faltam

Catálogo 2026-11-06.1: 57 produtos, 53 com imagem e 4 sem. Sem imagem, a linha mantém o ícone da categoria e o modal mostra só nome, descrição e preço.

| Categoria | Produtos | Com imagem | Faltam |
|---|---|---:|---:|
| Croissants | 5 | 5 | 0 |
| Brunchs | 4 | 4 | 0 |
| Sanduíches | 4 | 4 | 0 |
| Bowls | 4 | 4 | 0 |
| Cheesecakes | 7 | 7 | 0 |
| Cinnamon Rolls | 4 | 4 | 0 |
| Cafés | 11 | 11 | 0 |
| Sucos | 6 | 6 | 0 |
| Cafés gelados | 6 | 6 | 0 |
| Outras bebidas | 6 | 2 | 4 |

## Pendentes: refrigerantes

| Arquivo | Produto | id no catálogo |
|---|---|---|
| `outras-bebidas/coca-cola.webp` | Coca-Cola | `outras_bebidas.coca_cola` |
| `outras-bebidas/coca-cola-zero.webp` | Coca-Cola Zero | `outras_bebidas.coca_cola_zero` |
| `outras-bebidas/guarana.webp` | Guaraná | `outras_bebidas.guarana` |
| `outras-bebidas/guarana-zero.webp` | Guaraná Zero | `outras_bebidas.guarana_zero` |

As imagens geradas por IA têm rótulos deformados ou não confiáveis e **não devem ser publicadas**. Em 6/11/2026 não foi encontrado banco oficial da Coca-Cola Brasil nem da
Ambev com autorização de uso comercial, e imagens de bancos de terceiros têm licenças próprias. O caminho é uma destas opções:

- foto real das latas vendidas no Âmbar, tirada pela casa;
- arte oficial com autorização por escrito do fabricante ou do distribuidor.

Ao receber: quadrada, com 800 × 800 px ou mais. Copiar para `src/assets/media/cardapio/produtos/outras-bebidas/` e acrescentar cada id em `FOTOS_PRODUTO`, com `real`.

## Imagens de origem

| Origem | Quantidade | Onde |
|---|---:|---|
| Fotos da Roll autorizadas | 3 | `roll/` |
| Arte oficial do PDF do dono (copos) | 6 | `cardapio/copo-*.webp` |
| Arte da Roll, autorizada em 6/11/2026 | 1 | `roll/roll-tradicional.webp` |
| Gerada por IA, aprovada em 17/10/2026 | 1 | `cardapio/sanduiche-brie.webp` |
| `Ambar_Miniaturas_46_Ilustrativas.zip` (IA), revisado item a item | 35 | `cardapio/produtos/` |
| `Ambar_Fotos_Finais_Home_e_11_Pendentes_2026-11-06.zip` (IA), revisado item a item | 7 | `cardapio/produtos/` |

Imagem gerada por IA fica sempre como `ilustrativa`: não é foto do produto servido.

## Recortes

O primeiro ZIP trazia uma faixa nítida sobre fundo borrado. A miniatura é um recorte quadrado dessa faixa. Em Green Morning e nos bowls Ragù, Atum e Camarão Fresh o recorte também
deixa de fora o que não faz parte do prato (tomates-cereja, queijo ralado, pedaços não identificáveis e abacate). **Por isso esses quatro não podem usar a imagem inteira do ZIP.**

Nos itens em que a faixa inteira é fiel ao produto, o modal usa a versão larga, em `cardapio/produtos/ampliadas/`, ligada pelo terceiro argumento de `ilustrativa()`. O modal nunca
estica uma imagem além do tamanho do arquivo: as de menor resolução (copos, Brie & Blueberry e os quatro recortes acima) aparecem menores ou menos nítidas. Fotos maiores resolvem.

## A confirmar com a casa

- **Cheesecakes:** seis deles aparecem em fatia, como o ícone da categoria no PDF oficial. O catálogo só diz “(fatia)” na Maçã com Crumble: se os outros forem vendidos de outro jeito, as imagens precisam mudar.
- **Maçã com Crumble (fatia):** a imagem mostra uma fatia de torta, sem camada de cheesecake.
- **Água e Água com gás:** garrafas genéricas, sem rótulo: não mostram a marca vendida.
