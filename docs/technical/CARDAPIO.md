# Cardápio: de onde vem e como atualizar

Um só cadastro: o catálogo do backend (`GET https://api.ambarbrunch.com/cardapio`, ver [`CONTRATO-API-CARDAPIO.md`](CONTRATO-API-CARDAPIO.md)).

| Canal | Como recebe o catálogo |
|---|---|
| Atendimento no WhatsApp | direto do banco do backend; o cliente recebe o link `/cardapio`, nunca o PDF |
| `/cardapio/` e home | no build do site (`src/lib/cardapio/catalogo.ts`): HTML estático com os dados do momento do deploy |
| PDF `/cardapio/cardapio-ambar.pdf` | **hoje, o PDF entregue pelo dono** (6/11/2026), byte a byte, preso ao catálogo por `npm run cardapio:assinar`; o endereço não muda |

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

## PDF do dono (vigente desde 6/11/2026)

O PDF público é a arte corrigida entregue pelo dono: 3 páginas, só imagem, sem texto. Por isso `cardapio:pdf` recusa gerar por cima dele, e
`cardapio:conferir` compara o arquivo pelo sha256, sem ler o conteúdo: **o conteúdo precisa ser conferido a olho, item a item, contra a API**.
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

Em `/cardapio/`, produto só usa imagem em que dá para reconhecer aquele produto e que mostre o que o catálogo descreve. Sem uma, aparece o ícone neutro
da categoria. **Lista do que falta, com os nomes de arquivo do ZIP:** [`CARDAPIO-FOTOS-PENDENTES.md`](CARDAPIO-FOTOS-PENDENTES.md).

**Trocar ou acrescentar:** colocar a imagem em `src/assets/media/` e acrescentar `id do produto → { src, alt }` em `FOTOS_PRODUTO` (`src/data/cardapio.ts`). O
layout não muda e o site gera os tamanhos no build. Na home, só as de origem `real` aparecem como miniatura.

| Produto | Arquivo em `src/assets/media/` | Origem | De onde veio |
|---|---|---|---|
| Rolls Mood Cheesecake, Kinder Bueno e Biscoff | `roll/roll-*.webp` | `real` | fotos da Roll autorizadas em 17/10/2026 |
| Roll Tradicional | `roll/roll-tradicional.webp` | `ilustrativa` | arte da Roll que nomeia o sabor (Instagram, IG-16, `2026-09-14_DdRe2BOgPRt_image.jpg`), recorte quadrado. Pode ser render; fora da lista autorizada em 17/10 |
| Os seis Cafés gelados | `cardapio/copo-*.webp` | `ilustrativa` | recorte dos copos nomeados na página 3 do PDF oficial do dono (6/11/2026). O PDF não muda |
| Sanduíche Brie & Blueberry | `cardapio/sanduiche-brie.webp` | `ilustrativa` | imagem gerada por IA, aprovada para a home em 17/10/2026; bate com a descrição do catálogo |

Não reaproveitar sem confirmação:

- **Pistache e Mirtilo** das artes da Roll são sabores de cinnamon roll, não cheesecakes.
- **Nutella, Oreo, Red Velvet e S’mores** não estão no catálogo.
- **Croissant do prato azul:** tem recheio, e não dá para dizer qual sabor é. Segue só como foto da categoria.
- **Torrada do prato branco e shake de chocolate:** não correspondem a produto atual.
- **Sanduíches Ragu e Tuna e os bowls da proposta Âmbar × Roll:** mostram ingredientes fora do catálogo (rúcula, abacate).
- **Cheesecake gerado por IA:** cheesecake não tem descrição no catálogo e “Maçã com Crumble (fatia)” indica que os outros talvez não sejam vendidos em
  fatia. A imagem de fatia poderia prometer uma apresentação que não existe.

Fotos de categoria, sem indicar um produto: Croissants (o croissant do prato azul tem recheio e não dá para dizer qual é) e Cinnamon Rolls (caixa
da Roll). No cartão da home, Sanduíches, Cafés e Cafés gelados seguem com as imagens ilustrativas aprovadas em 17/10/2026, sempre como foto da
categoria: `origem` registrada em `src/data/cardapio.ts`, para a troca quando houver fotos reais.

A seção “Direto da fornada” segue com a foto do roll de Nutella (`roll.fotos.anatomia`), sabor que não está no catálogo: é a história da Roll,
sem nome de produto à venda nem preço.

## Previews

`/cardapio` e `/reservar` mantêm URL, metadados e artes ([`PREVIEW-LINKS.md`](PREVIEW-LINKS.md)). Nada aqui mexe neles.
