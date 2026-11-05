# Cardápio: de onde vem e como atualizar

Um só cadastro: o catálogo do backend (`GET https://api.ambarbrunch.com/cardapio`, ver [`CONTRATO-API-CARDAPIO.md`](CONTRATO-API-CARDAPIO.md)).

| Canal | Como recebe o catálogo |
|---|---|
| Atendimento no WhatsApp | direto do banco do backend; o cliente recebe o link `/cardapio`, nunca o PDF |
| `/cardapio/` e home | no build do site (`src/lib/cardapio/catalogo.ts`): HTML estático com os dados do momento do deploy |
| PDF `/cardapio/cardapio-ambar.pdf` | gerado da mesma API por `npm run cardapio:pdf`; o endereço não muda |

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
   npm run cardapio:conferir   # API × /cardapio/ × home × PDF; sai 0 só com tudo igual
   ```

**Entre os passos 1 e 3 o atendimento já está na versão nova e o site, na anterior.** Por isso o passo 2 vem logo depois do 1.

Requisitos da máquina: Node 24 (o gerador importa os `.ts` direto) e `uv` (lê o PDF com pymupdf).

## Travas

- API fora do ar ou fora do contrato: o build falha e a Vercel mantém a versão no ar. O público não é afetado.
- Catálogo diferente do que gerou o PDF: o build falha com a mensagem `Rode npm run cardapio:pdf`. Site e PDF nunca saem com preços diferentes.
  Isso vale para qualquer deploy: se o catálogo mudou, nenhum outro ajuste do site publica antes do PDF novo.
- Categoria nova, sem lugar em `src/data/cardapio.ts` ou em `PAGINAS` de `scripts/cardapio-pdf.mjs`: build e PDF falham dizendo qual falta.
- Produto removido do catálogo que ainda tem foto ou está numa dupla do Café + Roll: o build falha dizendo qual.

## PDF

HTML → PDF pelo Chromium do Playwright: A4, 3 páginas, texto vetorial pesquisável, tipografia da marca, fundo branco para impressão. A
conferência (`scripts/cardapio_pdf_conferir.py`) reprova se faltar nome, descrição ou preço, se o preço exato não estiver na linha do
produto, se houver texto colado na borda ou se o conteúdo não couber. Reprovou, o PDF público não é tocado.

Item ou descrição muito maior pode não caber na página: a geração falha dizendo qual página estourou; ajustar `PAGINAS` ou o CSS do script.

## Fotos

Em `/cardapio/`, produto só usa foto real em que dá para reconhecer aquele produto. Sem uma, aparece o ícone neutro da categoria.
**Trocar por foto real:** colocar a imagem em `src/assets/media/` e acrescentar `id do produto → { src, alt }` em `FOTOS_PRODUTO`
(`src/data/cardapio.ts`). O layout não muda e o site gera os tamanhos no build.

Com foto real hoje: `cinnamon_rolls.mood_cheesecake`, `cinnamon_rolls.smores`, `cinnamon_rolls.kinder_bueno`. Todos os outros usam o ícone neutro.

Fotos de categoria, sem indicar um produto: Croissants (o croissant do prato azul tem recheio e não dá para dizer qual é) e Cinnamon Rolls (caixa
da Roll). No cartão da home, Sanduíches, Cafés e Cafés gelados seguem com as imagens ilustrativas aprovadas em 17/10/2026, sempre como foto da
categoria: `origem` registrada em `src/data/cardapio.ts`, para a troca quando houver fotos reais.

A seção “Direto da fornada” segue com a foto do roll de Nutella (`roll.fotos.anatomia`), sabor que não está no catálogo: é a história da Roll,
sem nome de produto à venda nem preço.

## Previews

`/cardapio` e `/reservar` mantêm URL, metadados e artes ([`PREVIEW-LINKS.md`](PREVIEW-LINKS.md)). Nada aqui mexe neles.
