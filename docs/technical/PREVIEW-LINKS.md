# Preview dos links públicos no WhatsApp

| Link | Título no preview | Imagem |
|---|---|---|
| `https://ambarbrunch.com/reservar` | Reservar mesa — Âmbar Brunch | `https://ambarbrunch.com/og/reservar.jpg` |
| `https://ambarbrunch.com/cardapio` | Cardápio — Âmbar Brunch | `https://ambarbrunch.com/og/cardapio.jpg` |

As tags Open Graph saem no HTML estático de cada página, pela prop `social` de `src/layouts/Base.astro`. O `<title>` e a descrição do
Google continuam separados, com as palavras de busca. A imagem da home segue sendo o salão (`imagensSeo()` em `src/data/seo.ts`).

## Imagens

`public/og/` guarda as artes em 1200 × 630, JPEG, com endereço fixo. O WhatsApp pode recortar em quadrado no centro, então logo e título
ficam nos 630 px centrais. Para refazer: ajustar `scripts/gerar-previews.mjs` e rodar `node scripts/gerar-previews.mjs`.

Ao trocar uma arte, **troque também o nome do arquivo** (ex.: `reservar-2.jpg`) e a prop `social.imagem` da página. Quem já leu o link
guarda o preview antigo, e um nome novo evita misturar imagens em cache.

## PDF

`public/cardapio/cardapio-ambar.pdf` é gerado do catálogo oficial e mantém o endereço. Como atualizar: [`CARDAPIO.md`](CARDAPIO.md).

## Como testar

1. Publicar o front: enquanto o deploy não ocorre, `/cardapio` e as imagens não existem em `ambarbrunch.com`.
2. Conferir o que o robô recebe, sem JavaScript:
   `curl -A "WhatsApp/2.23.20.0 A" -s https://ambarbrunch.com/cardapio | grep 'og:'`
3. Abrir `https://ambarbrunch.com/og/cardapio.jpg` e conferir a imagem.
4. Colar o link numa conversa do WhatsApp e esperar o cartão aparecer antes de enviar.

## Cache

O WhatsApp guarda o preview por link: quem já recebeu `/reservar` pode continuar vendo o preview antigo por dias, e mensagens já enviadas
não mudam. Para conferir uma versão nova, teste com um parâmetro inédito, como `https://ambarbrunch.com/reservar?v=2`. O
[Sharing Debugger da Meta](https://developers.facebook.com/tools/debug/) também mostra o que o robô lê e permite pedir uma nova leitura,
mas ele atualiza o cache da Meta e não garante a troca imediata no aplicativo.
