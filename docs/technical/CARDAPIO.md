# Cardápio: de onde vem e como atualizar

Um só cadastro: o catálogo do backend (`GET https://api.ambarbrunch.com/cardapio`, ver [`CONTRATO-API-CARDAPIO.md`](CONTRATO-API-CARDAPIO.md)).

| Canal | Como recebe o catálogo |
|---|---|
| Atendimento no WhatsApp | direto do banco do backend; o cliente recebe o link `/cardapio`, nunca o PDF |
| `/cardapio/` | no build do site (`src/lib/cardapio/catalogo.ts`): HTML estático com os dados do momento do deploy |
| home | só nomes de categoria na faixa e as duplas do Café + Roll, no build. Nenhum preço |
| PDF `/cardapio/cardapio-ambar.pdf` | **hoje, a arte do dono** (6/11/2026), com 53 produtos e os 13 adicionais, presa ao catálogo por `npm run cardapio:assinar`; o endereço não muda. **Os 4 Cinnamon Rolls ficam fora dele de propósito** |

O front **não guarda** produto, descrição nem preço. `src/data/cardapio.ts` guarda só apresentação: categoria → cor, âncora e ícone; id do
produto → foto. As duplas do Café + Roll (`src/data/cafe-roll.ts`) apontam para ids do catálogo.

## Atualizar preço, produto ou descrição

1. **Backend:** atualizar o catálogo (nova `versao`). A partir daí, o atendimento já responde com os dados novos.
2. **Front, na `main`:**
   ```bash
   npm run cardapio:pdf        # gera, confere item a item e renderiza as páginas em reports/cardapio-pdf/
   ```
   Olhar as 3 páginas em `reports/cardapio-pdf/`. O comando troca `public/cardapio/cardapio-ambar.pdf` e grava a versão e a assinatura do
   catálogo em `src/data/cardapio-pdf.json`.
3. **Publicar:** testes, commit do PDF e do JSON, `git push origin main` (o push publica). O build lê a API de novo.
4. **Conferir o site real:**
   ```bash
   npm run cardapio:conferir   # API × /cardapio/ × PDF, e nenhum preço na home; sai 0 só com tudo igual
   ```

**Entre os passos 1 e 3 o atendimento já está na versão nova e o site, na anterior.** Por isso o passo 2 vem logo depois do 1.

Requisitos da máquina: Node 24 (o gerador importa os `.ts` direto) e `uv` (lê o PDF com pymupdf).

## Travas

- API fora do ar ou fora do contrato: o build falha e a Vercel mantém a versão no ar. O público não é afetado.
- Catálogo diferente do que gerou o PDF: o build falha com a mensagem `Rode npm run cardapio:pdf`. Site e PDF nunca saem com preços diferentes.
  Isso vale para qualquer deploy: se o catálogo mudou, nenhum outro ajuste do site publica antes do PDF novo.
- Categoria nova, sem lugar em `src/data/cardapio.ts` ou em `PAGINAS` de `scripts/cardapio-pdf.mjs`: build e PDF falham dizendo qual falta.
- Produto removido do catálogo que ainda tem foto ou está numa dupla do Café + Roll: o build falha dizendo qual.

## PDF do dono (vigente desde 6/11/2026)

O PDF público é a arte entregue pelo dono, com nomes, preços e adicionais alinhados à API: 2 páginas A4 em paisagem, com texto. Por isso `cardapio:pdf` recusa gerar por cima dele, e
`cardapio:conferir` compara o arquivo pelo sha256, sem ler o conteúdo: **o conteúdo precisa ser conferido item a item contra a API, por seção, antes de assinar**. Comparar só o texto engana: Matcha Latte existe nos
Cafés e nos Cafés gelados.

**Diferença intencional, não é erro de sincronização:** o PDF tem 53 dos 57 produtos. Decisão do responsável em 6/11/2026: Tradicional, Mood Cheesecake, Kinder Bueno e Biscoff seguem ativos no catálogo, no site e no atendimento
do WhatsApp, mas ficam fora deste PDF porque terão um cardápio próprio. Não acrescentá-los ao PDF nem removê-los do catálogo por causa dessa diferença.

O catálogo oficial é a fonte da verdade: se a arte divergir, corrige-se a arte. Os títulos “Drinks” (Cafés gelados) e “Cheesecake” e as descrições dos cheesecakes, que a API não tem, são da arte e foram mantidos.
A cada mudança de catálogo o build trava até haver PDF novo. Com a arte nova do dono:

```bash
npm run cardapio:assinar -- caminho/do/novo.pdf   # copia para public/cardapio/ e grava versão, assinatura e sha256 em src/data/cardapio-pdf.json
```

Depois, os passos 3 e 4 acima. Voltar ao PDF gerado: `npm run cardapio:pdf -- --trocar-pdf-do-dono`.

## PDF gerado

HTML → PDF pelo Chromium do Playwright: A4, 3 páginas, texto vetorial pesquisável, tipografia da marca, fundo branco para impressão. A
conferência (`scripts/cardapio_pdf_conferir.py`) reprova se faltar nome, descrição ou preço, se o preço exato não estiver na linha do
produto, se houver texto colado na borda ou se o conteúdo não couber. Reprovou, o PDF público não é tocado.

Item ou descrição muito maior pode não caber na página: a geração falha dizendo qual página estourou; ajustar `PAGINAS` ou o CSS do script.

## Fotos

Em `/cardapio/`, produto só usa imagem em que dá para reconhecer aquele produto e que mostre o que o catálogo descreve. Sem uma, aparece o ícone neutro da categoria.
**Origem de cada imagem e o que falta:** [`CARDAPIO-FOTOS-PENDENTES.md`](CARDAPIO-FOTOS-PENDENTES.md).

**Trocar ou acrescentar:** cada produto tem um par com o mesmo nome em `src/assets/media/cardapio/modal/` e `miniaturas/`, ligado por id em `FOTOS_PRODUTO` (`src/data/cardapio.ts`), com `real` ou
`ilustrativa`. O layout não muda e o site gera os tamanhos no build.

Não reaproveitar sem confirmação:

- **Pistache e Mirtilo** das artes da Roll são sabores de cinnamon roll, não cheesecakes.
- **Nutella, Oreo, Red Velvet e S’mores** não estão no catálogo.
- **Croissant do prato azul e torrada do prato branco:** não dá para dizer qual produto são. O croissant do prato azul segue na polaroid da home, sem ligação com um produto do catálogo.
- **Sanduíches Ragu e Tuna e os bowls da proposta Âmbar × Roll:** mostram ingredientes fora do catálogo (rúcula, abacate).

A caixa real da Roll mostrava o S’mores, fora do cardápio desde 6/11/2026: na cena do Café + Roll, foi recortada acima dele (`roll/caixa-roll-aberta.webp`). `roll/caixa-roll.webp` e
`roll/roll-smores.webp` ficam no acervo, sem uso: o build não os publica.

A seção “Direto da fornada” segue com a foto do roll de Nutella (`roll.fotos.anatomia`), sabor que não está no catálogo: é a história da Roll, sem nome de produto à venda nem preço.

## Modal do produto

Cada linha de `/cardapio/` abre um `<dialog>` com a imagem ampliada, o nome, a descrição e o preço (`scripts/cardapio-modal.js`). O texto vem da própria linha, ou seja, do catálogo
oficial, e a imagem grande fica num `<template>`. **O modal só abre com a imagem definitiva baixada e decodificada: nunca mostra prévia borrada nem carregamento.** Depois da carga da página, as imagens perto da tela são adiantadas aos poucos; se o toque vier antes, a espera aparece na própria linha. Sem imagem depois de 12 s, ou com erro de rede, abre só o texto. Com o modal aberto a página não rola, e fechar devolve o foco à linha, no mesmo ponto da lista.

## Previews

`/cardapio` e `/reservar` mantêm URL, metadados e artes ([`PREVIEW-LINKS.md`](PREVIEW-LINKS.md)). Nada aqui mexe neles.
