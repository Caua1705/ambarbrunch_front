# Tokens — Fornada Âmbar

> Fonte: [`src/styles/tokens.css`](../../../src/styles/tokens.css). Os valores são os do protótipo aprovado
> (`experiments/concept-b-aprovado-v1/styles.css`) e mantêm os **mesmos nomes** de cor do v1, para comparar
> lado a lado. Mudar um token = registrar aqui (§9) e rodar o teste de paridade.

## 1. Cor

### Primitivos

| Token | Valor | Origem | Uso |
| --- | --- | --- | --- |
| `--wine` | `#670D27` | tinta do logo (pág. 1 do PDF) | fundo do hero e da reserva, títulos sobre claro, botão principal sobre claro |
| `--cacao` | `#3A2218` | protótipo | fundo da Roll, faixa, **sombra deslocada** |
| `--butter` | `#F3DDAE` | protótipo | CTA, texto sobre vinho, fundo de ambientes |
| `--cream` | `#F4EEE3` | fundo do logo (pág. 1) | fundo claro, etiqueta, comanda, folha do menu |
| `--glaze` | `#FFFBF4` | protótipo | molduras de foto, chips, campos |
| `--ink` | `#24150F` | protótipo | texto corrido |
| `--caramel` | `#C98A45` | protótipo | faixas, borda de vídeo. **Nunca texto, nunca foco** |
| `--caramel-lt` | `#E7B676` | protótipo | “BRUNCH”, “&”, scribble sobre escuro |
| `--caramel-dk` | `#9A5F25` | protótipo | legendas e rótulos sobre creme |
| `--berry` | `#A8203A` | protótipo | faixa (red velvet), estado de erro |
| `--leaf` | `#3D5A3E` | protótipo | faixa (salada, chá) |

`--wine-deep` (`#4C0A1D`) existia no v1 sem uso e **foi removido**.

### Papéis

| Token | Valor | Para |
| --- | --- | --- |
| `--text` | `--ink` | texto padrão |
| `--text-muted` | tinta 65% | notas, rodapé, dicas (5,19:1 sobre creme) |
| `--text-soft` | tinta 70% | texto auxiliar da comanda (6,14:1) |
| `--text-on-dark-muted` | creme 86% | texto corrido sobre cacau (9,79:1) |
| `--text-on-dark-faint` | creme 62% | créditos sobre cacau (5,80:1) |
| `--rule` | tinta 18% | pontilhados (decorativo) |
| `--notice-line` | vinho 45% | borda do aviso de foto antiga |
| `--tape` | manteiga 82% | fita adesiva |
| `--focus-ring` | vinho no claro, manteiga no escuro | anel de foco (troca por superfície) |
| `--scrim` | tinta 58% | fundo atrás da folha do menu |

### Contraste (WCAG 2.2, calculado)

| Texto / fundo | Razão | Regra |
| --- | ---: | --- |
| manteiga / vinho | 9,48 | livre |
| caramelo claro / vinho | 6,82 | livre |
| vinho / creme | 10,93 | livre |
| tinta / creme | 15,29 | livre |
| manteiga / cacau | 11,09 | livre |
| creme / folha | 6,66 | livre |
| creme / frutas vermelhas | 6,20 | livre |
| **caramelo escuro / creme** | **4,504** | só texto ≥ 12,5 px em negrito ou ≥ 18 px; nunca sobre manteiga (3,90) |
| caramelo / cacau | 5,07 | só decoração e textos grandes |
| vinho / caramelo | 4,33 | não usar; sobre caramelo, o texto é tinta (6,06) |
| **caramelo / manteiga** | **2,19** | **proibido** (era o anel de foco do v1) |

**Pares das faixas do cardápio** (`--b` / `--t`): vinho/manteiga, caramelo/tinta, cacau/manteiga, folha/creme, manteiga/tinta, frutas vermelhas/creme, cacau/caramelo claro. Fora dessa lista, não usar.

## 2. Tipografia

| Família | Papel | Licença | Entrega |
| --- | --- | --- | --- |
| **Bricolage Grotesque** (variável: `wght` 300–800, `wdth` 75–100, `opsz` 12–96) | títulos, interface, texto | OFL | Fontsource, auto-hospedada, subset latino |
| **Fraunces** itálica (`wght` 400–600) | voz manuscrita: scribbles, notas, legendas, carimbos | OFL | idem |

> As duas são escolhas do conceito aprovado. A apresentação da marca usa Playfair Display, Lato e Lemon Milk; se a marca definir outra fonte, os papéis abaixo continuam e só as famílias mudam.

| Token | Valor | Onde |
| --- | --- | --- |
| `--t-hero` | 800 `clamp(70px, 21.5vw, 168px)`/.8 · `wdth 75` · −.015em | título do hero (3 linhas) |
| `--t-mega` | 800 `clamp(78px, 25vw, 200px)`/.8 · `wdth 75` · −.02em | títulos de seção em 2 linhas alternadas |
| `--t-numeral` | 800 32px/1 · `wdth 78` | número do stepper |
| `--t-tagline` | 800 30px/1 · `wdth 78` | tarja dos ambientes |
| `--t-ticket-title` | 800 30px/.9 · `wdth 78` | título da comanda |
| `--t-ticker` | 800 25px/1 · `wdth 80` | faixa |
| `--t-band` | 800 17px/1 · `wdth 82` | pílulas do cardápio |
| `--t-button-l` / `--t-button` | 800 17/16px · `wdth 85` · +.04em, caixa-alta | CTA fixo / botões |
| `--t-chip` | 700 15px | chips |
| `--t-pill` | 700 13px · +.04em, caixa-alta | links-pílula, menu, pausa |
| `--t-legend` | 700 12.5px · +.14em, caixa-alta | “01 · ambiente”, rótulos de campo |
| `--t-body` | 400 16px/1.5 · `wdth 100` | texto corrido (`--fs-lead` 17 px) |
| `--t-scribble` | Fraunces 500 24px/1.1, −4° | frase manuscrita sob o título |
| `--t-kicker` | Fraunces 500 22px | “pra comer”, “pra beber” |
| `--t-note` | Fraunces 500 19px/1.05 (escala com o palco, 16–22 px) | anotações das colagens |
| `--t-caption` | Fraunces 500 16px | legenda da polaroide |
| `--t-tag` | Fraunces 500 15px | etiqueta de vídeo, bolha |
| `--t-stamp` | Fraunces 600 15px | carimbo |
| `--t-sig` | Fraunces 500 14px | assinatura do rodapé |
| `--t-fine-serif` | Fraunces 400 12.5px/1.25 | nota de foto antiga |
| `--t-chip-small` | Fraunces 500 12px | dia da semana nos chips |

**Regras:** mega títulos e o título do hero **nunca quebram palavra** (validado de 360 a 430 px). Caixa-alta só na Bricolage; Fraunces sempre em minúsculas e itálica. Campos de formulário usam 16 px (evita zoom no iOS).

## 3. Espaço

- `--gutter`: **16 px** no mobile, 56 px a partir de 960 px.
- **Escala base** (componentes novos): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
- **Ritmo das seções** (do v1): o padding inferior é sempre o superior **+ 8 px**.

| Token | Topo | Seção |
| --- | ---: | --- |
| `--rhythm-a` | 76 | Mesa cheia |
| `--rhythm-b` | 84 | Escolha o clima |
| `--rhythm-c` | 88 | Fornadas |
| `--rhythm-d` | 92 | Reserva |

As seções novas usam um desses quatro: Novo capítulo `a`, Na mesa `b`, Visite `c`.

- **Valores de composição** (posições de peças nas colagens, margens negativas, deslocamentos de 44 px do segundo story etc.) **não viram tokens**: ficam no CSS da seção, em unidades do protótipo (`--u`), porque são desenho, não sistema.

## 4. Raios

`--radius-2xs` 6 (foco) · `-xs` 8 (comanda) · `-s` 10 (bandejas) · `-m` 12 (seta do CTA) · `-control` 14 (chips, stepper, campos, aviso) · `-button` 16 · `-l` 18 (ladrilho, CTA fixo, menu da doca) · `-xl` 26 (vídeos, painéis) · `-pill` 999.

## 5. Bordas

`--border-photo` 6 px (círculo, bolhas, bandejas, em manteiga ou creme) · `--border-tile` 5 px · `--border-control` 2 px em tinta. Pontilhado de 2 px (`--rule`) separa passos e itens de menu; tracejado vinho marca aviso e carimbo.

## 6. Sombras

| Token | Valor | Uso |
| --- | --- | --- |
| `--shadow-offset` | `4px 4px 0 cacau` | **assinatura**: botões, CTA, menu da doca |
| `--shadow-offset-s` | `3px 3px 0` | chip selecionado, selo do menu, campo em foco |
| `--shadow-offset-xs` | `2px 2px 0` | estado pressionado ou desabilitado |
| `--shadow-photo` / `-deep` | `0 16px 26px -14px` 55% / 70% | polaroide / bandejas |
| `--shadow-board` | `0 18px 30px -18px` tinta 55% | fotos do quadro |
| `--shadow-sticker` | `0 10px 18px -8px` | selos |
| `--shadow-strip` | `0 10px 20px -10px` | faixa |
| `--shadow-float` | `0 18px 30px -16px` | elementos fixos (doca) |
| `--drop-label` | `drop-shadow(0 14px 18px)` vinho escuro | etiqueta do logo (segue a máscara) |

Pressionar = a sombra deslocada **recolhe** (4 → 2 px): o botão “afunda” no papel.

## 7. Texturas e máscaras

| Token | O que é |
| --- | --- |
| `--grain` + `--grain-opacity` (.35, `soft-light`) | ruído SVG inline; só sobre vinho e cacau (`.hero`, `.roll`, `.reserva`, `.surface-grain`) |
| `--mask-scallop` | borda recortada em ondas de 20 px na base (etiqueta do logo) |
| `--mask-scallop-top` | a mesma, no topo (folha do menu) — novo |
| `--mask-perforated` | furos de 9 px a cada 28 px nas laterais (comanda) |

## 8. Movimento, camadas e unidade do protótipo

- Movimento: ver [`MOTION.md`](MOTION.md) §1.
- Camadas: `--z-strip` 3 (faixa) · `--z-dock` 50 (CTA e menu fixos) · `--z-sheet` 60 (folha). Dentro das colagens, `z-index` 1–6 local.
- `--stage-hero-w` 358 · `--stage-hero-h` 330 · `--stage-board-w` 358: medidas dos palcos em 390 px (ver [`RESPONSIVIDADE.md`](RESPONSIVIDADE.md)).

## 9. Registro de mudanças de token

| Data | Token | Antes → depois | Motivo |
| --- | --- | --- | --- |
| 2026-10-16 | anel de foco | caramelo → `--focus-ring` (vinho no claro, manteiga no escuro) | 2,19:1 sobre manteiga falhava no WCAG 1.4.11 |
| 2026-10-16 | `--wine-deep` | removido | sem uso no v1 |
| 2026-10-16 | `--mask-scallop-top`, `--scrim`, `--shadow-offset-xs`, escala `--space-*`, `--rhythm-*` | novos | menu, estados de toque, componentes novos |
| 2026-10-16 | `--wdth-*` → `--stretch-*` | largura variável saiu de `font-variation-settings` e foi para `font-stretch` (mesmo eixo `wdth`); `--wdth-mega` ficou só com `"opsz" 96` | o WebKit não recalcula o avanço dos glifos com `wdth` em `font-variation-settings` (letras encavaladas). Eixos efetivos idênticos ao v1 (teste de fidelidade) |
| 2026-10-18 | `--paper-fibers`, `--paper-doodles`, `--mask-torn`, `--mask-fade-bottom` | novos | acabamento: papel nas superfícies claras (fibras + rabiscos de padaria), costura rasgada entre seções, esmaecimento do polvilho (`src/styles/acabamento.css`) |
| 2026-10-18 | `--polvilho-period`, `--faisca-period`, `--faisca-delay`, `--dur-write`, `--dur-page`, `--sem-atraso`, `--z-progresso` | novos | açúcar caindo na Fornada, faíscas do hero redesenhando, scribble se escrevendo, troca de página, fio de leitura |
