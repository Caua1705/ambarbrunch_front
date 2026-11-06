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

| Produto | id no catálogo |
|---|---|
| Coca-Cola | `outras_bebidas.coca_cola` |
| Coca-Cola Zero | `outras_bebidas.coca_cola_zero` |
| Guaraná | `outras_bebidas.guarana` |
| Guaraná Zero | `outras_bebidas.guarana_zero` |

O catálogo só traz o nome: não informa marca do Guaraná, volume nem embalagem. As imagens geradas por IA têm rótulos deformados ou não confiáveis e **não devem ser publicadas**. Em 6/11/2026 não foi
encontrado banco oficial da Coca-Cola Brasil nem da Ambev com autorização de uso comercial, e imagens de bancos de terceiros têm licenças próprias. O caminho é uma destas opções:

- foto real das latas vendidas no Âmbar, tirada pela casa;
- arte oficial com autorização por escrito do fabricante ou do distribuidor.

## Como trocar ou acrescentar uma imagem

Cada produto usa um par com o mesmo nome, saído da mesma imagem-base:

- `src/assets/media/cardapio/modal/<categoria>/<produto>.webp`: imagem ampliada, de preferência 1200 × 900 px (4:3), com o produto inteiro e centralizado;
- `src/assets/media/cardapio/miniaturas/<categoria>/<produto>.webp`: recorte quadrado de 320 × 320 px.

Depois, acrescentar o id em `FOTOS_PRODUTO` (`src/data/cardapio.ts`), com `real` ou `ilustrativa`. O build gera AVIF e WebP nos tamanhos da página. Nunca ampliar um arquivo pequeno: use uma imagem maior.

## Imagens de origem

| Origem | Quantidade | Onde |
|---|---:|---|
| Fotos da Roll autorizadas | 3 | `cinnamon-rolls/` |
| Arte da Roll, autorizada em 6/11/2026 | 1 | `cinnamon-rolls/tradicional.webp` |
| `Ambar_Fotos_Finais_Home_e_11_Pendentes_2026-11-06.zip` (IA), revisado item a item | 7 | brunchs, sanduíches, Expresso duplo e Retinol |
| Recriada por IA em 6/11/2026, a partir da descrição oficial, revisada item a item | 42 | demais produtos |

Imagem gerada por IA fica sempre como `ilustrativa`: não é foto do produto servido. Mood Cheesecake e Biscoff têm um recorte mínimo que tira as pontas das setas da arte da Roll; as fotos originais seguem em `roll/`.

As 42 recriadas substituíram arquivos sem resolução para o modal: faixas de 768 × 260 px, recortes de 320 px e arquivos de 200 a 440 px. Os copos de Cafés gelados foram recriados a partir da arte do PDF do dono,
que tem cerca de 200 px por copo.

## A confirmar com a casa

- **Cheesecakes:** seis deles aparecem em fatia, como o ícone da categoria no PDF oficial. O catálogo só diz “(fatia)” na Maçã com Crumble: se os outros forem vendidos de outro jeito, as imagens precisam mudar.
- **Maçã com Crumble (fatia):** a imagem mostra uma fatia de maçã com crumble, sem camada de cheesecake.
- **Água e Água com gás:** garrafas genéricas, sem rótulo: não mostram a marca vendida.
- **Copos de Cafés gelados:** a marca impressa foi reproduzida pelo gerador de imagem. Comparar com o logo oficial.
- **Cinnamon Rolls:** originais preservados, sem ampliação. A arte do Tradicional tem 488 px; as fotos de Biscoff e Mood Cheesecake têm 696 e 741 px depois do recorte. Em celulares grandes de alta densidade, elas ficam
  um pouco menos nítidas que as demais. Fotos maiores resolvem.
