# Tipografia — Fornada Âmbar

> Fonte da verdade: [`src/styles/tokens.css`](../../src/styles/tokens.css) §3 e [`src/layouts/Base.astro`](../../src/layouts/Base.astro) (`@font-face`).
> Valores **calculados** medidos no site (Chromium) em 2026-10-16. Parte do [design system](DESIGN-SYSTEM.md).

## 1. Famílias

| Família | Arquivo servido | Pacote | Eixos disponíveis | Peso do arquivo | Papel |
| --- | --- | --- | --- | ---: | --- |
| **Bricolage Grotesque** | `bricolage-grotesque-latin-standard-normal.woff2` | `@fontsource-variable/bricolage-grotesque@5.3.0` | `wght` 200–800 · `wdth` 75–100 · `opsz` 12–96 | 128 KB | títulos, interface, texto corrido |
| **Fraunces** (só itálica) | `fraunces-latin-opsz-italic.woff2` | `@fontsource-variable/fraunces@5.3.0` | `wght` 100–900 · `opsz` 9–144 · itálico | 80 KB | “voz manuscrita”: scribbles, notas, legendas, carimbos |

- **Licença:** SIL Open Font License (as duas).
- **Entrega:** auto-hospedadas (`@font-face` em `Base.astro`), só o subconjunto **Latin** (`U+0000-00FF` e pontuação tipográfica — cobre todo o português), `font-display: swap`, **as duas com `preload`** (a Fraunces aparece na 1ª tela no “&” do título; sem preload ela causava CLS de 0,138).
- **Pilhas de reserva:** `--display: "Bricolage Grotesque", "Arial Narrow", system-ui, sans-serif` · `--serif: "Fraunces", Georgia, serif`.
- **Origem da escolha:** as duas vêm do protótipo aprovado. A apresentação da marca usa Playfair Display, Lato e Lemon Milk; se a marca definir outra família, os **papéis** deste documento continuam e só as famílias mudam.

### Pesos efetivamente usados

| Família | Pesos | Onde |
| --- | --- | --- |
| Bricolage | **400** | texto corrido, notas, avisos |
| | **700** | chips, legendas de passo, links-pílula, créditos, mensagens |
| | **800** | títulos, faixa, pílulas, botões, tagline, números |
| Fraunces itálica | **400** | nota de foto antiga |
| | **500** | scribble, notas, legendas, etiquetas, “&” do título |
| | **600** | carimbo |

### Eixo de largura (`wdth`) e tamanho óptico (`opsz`)

A largura vai em **`font-stretch`** (eixo padrão); `font-variation-settings` só leva o tamanho óptico dos títulos. Motivo: com `wdth` em `font-variation-settings`, o WebKit mudava o desenho das letras mas não o avanço (letras encavaladas).

| Token de largura | Valor | Usado em |
| --- | --- | --- |
| `--stretch-mega` | 75% | título do hero, mega títulos, itens da folha do menu |
| `--stretch-tag` | 78% | tagline, título da comanda, número do stepper, endereço da placa |
| `--stretch-ticker` | 80% | faixa |
| `--stretch-band` | 82% | pílulas do cardápio |
| `--stretch-button` | 85% | botões e CTA fixo |
| `--stretch-body` | 100% | corpo |
| `--wdth-mega` *(nome legado, ver I-03)* | `"opsz" 96` | títulos grandes (desenho de “display”) |

Demais textos: `opsz` automático (`font-optical-sizing: auto`, padrão do navegador).

## 2. Escala — papéis e valores

Tamanhos em px **calculados**. Onde a coluna é igual em todas as larguras, o tamanho é fixo.

### Títulos (Bricolage 800, caixa-alta)

| Papel | Token | Fórmula | 360 | 390 | 430 | 768 | 1440 | Entrelinha | Tracking | Largura |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Título do hero | `--t-hero` + `--hero-fs` | `clamp(70px, min(21.5vw, 11svh), 168px)`; desktop `clamp(90px, 9.5vw, 160px)` | 77,4 | 83,8 | 92,5 | 112,6 | 136,8 | .8 | −.015em | 75% · opsz 96 |
| Mega título de seção | `--t-mega` | `clamp(78px, 25vw, 200px)` | 90,0 | 97,5 | 107,5 | 192,0 ⚠ | 200,0 | .8 | −.02em | 75% · opsz 96 |
| Item da folha do menu | *(literal, I-04)* | 44px | 44 | 44 | 44 | 44 | 44 | .9 | −.02em | 75% · opsz 96 |
| Título da comanda | `--t-ticket-title` | 30px | 30 | 30 | 30 | 30 | 30 | .9 | 0 | 78% |
| Tagline (ambientes) | `--t-tagline` | 30px | 30 | 30 | 30 | 30 | 30 | 1 | 0 | 78% |
| Número do stepper | `--t-numeral` | 32px | 32 | 32 | 32 | 32 | 32 | 1 | 0 | 78% |
| Endereço da placa | *(literal, I-04)* | 26px | 26 | 26 | 26 | 26 | 26 | 1.02 | 0 | 78% |
| Faixa | `--t-ticker` | 25px | 25 | 25 | 25 | 25 | 25 | 1 | .02em | 80% |
| Pílula do cardápio | `--t-band` | 17px | 17 | 17 | 17 | 17 | 17 | 1 | .02em | 82% |

⚠ 768 px (tablet) não foi desenhado — ver auditoria I-16.

### Interface (Bricolage)

| Papel | Token | Peso · tamanho/entrelinha | Tracking | Caixa | Largura |
| --- | --- | --- | --- | --- | --- |
| Botão | `--t-button` | 800 · 16/1 | .04em | alta | 85% |
| CTA fixo | `--t-button-l` | 800 · 17/1 | .04em | alta | 85% |
| Chip | `--t-chip` | 700 · 15/1 | 0 | normal | 100% |
| Link-pílula, links do rodapé, pausar animações | `--t-pill` | 700 · 13/1 | .04em | alta | 100% |
| Link de texto (Novo capítulo, comanda) | `--t-pill` + `font-size: 14px` *(I-04)* | 700 · 14/1 | .04em | alta | 100% |
| Legenda de passo, rótulo de campo, “Endereço” | `--t-legend` | 700 · 12,5/1 | **.14em** | alta | 100% |
| Campo de formulário | *(literal, I-04)* | 700 · **16**/1.2 (400 no `textarea` e no placeholder) | 0 | normal | 100% |
| Mensagem de status / erro de campo | *(literal, I-04)* | 700 · 14/1.35 · 13/1.3 | 0 | normal | 100% |
| Crédito de vídeo | *(literal, I-04)* | 700 · 12,5/1.25 | .02em | normal | 100% |

### Texto (Bricolage 400)

| Papel | Token | Tamanho/entrelinha | Largura máx. |
| --- | --- | --- | --- |
| Corpo | `--t-body` | 16/1.5 | — |
| Lead (Roll, Novo capítulo) | `--fs-lead` | 17/1.5 | 32ch (Roll) · 30ch (Novo capítulo) |
| Texto da comanda | `--fs-slots` | 14/1.5 | — |
| Aviso de foto antiga, rodapé | `--fs-small` | 13/1.35 · 13/1.5 | — |
| Nota do cardápio, nota da comanda | `--fs-fine` | 12,5/1.5 | — |
| Crédito da Roll | `--fs-micro` | 12/1.5 | — |

### Voz manuscrita (Fraunces itálica)

| Papel | Token | Peso · tamanho/entrelinha | Observação |
| --- | --- | --- | --- |
| Scribble | `--t-scribble` | 500 · 24/1.1 | girado −4° |
| Kicker (“pra comer”) | `--t-kicker` | 500 · 22/1 | — |
| Nota da colagem | `--t-note` | 500 · 19/1.05 | **escala com o palco**: `clamp(16px, 19 × --u, 22px)` → 17,4 / 19 / 21,1 px em 360 / 390 / 430 |
| Legenda de bandeja | `--t-caption-l` | 500 · 17/1 | — |
| Legenda da polaroide | `--t-caption` | 500 · 16/1 | **escala com o palco**: `max(11px, 16 × --u)` → 12,4 / 16 / 17,8 px |
| Etiqueta de vídeo, bolha | `--t-tag` | 500 · 15/1 | — |
| Carimbo | `--t-stamp` | **600** · 15/1 | 16 px no Novo capítulo; 12,5 px no estado “erro” |
| Assinatura do rodapé | `--t-sig` | 500 · 14/1 | — |
| Nota de foto antiga | `--t-fine-serif` | **400** · 12,5/1.25 | 11,5 px abaixo de 375 px (I-17) |
| Dia da semana no chip | `--t-chip-small` | 500 · 12/1 | opacidade .75 |
| “&” do título | *(no componente)* | 500 · .78em/1 | 65,4 px em 390 |

## 3. Hierarquia (HTML × papel visual)

| Nível | Elemento | Papel visual | Regra |
| --- | --- | --- | --- |
| `h1` | **logo** dentro da etiqueta (`alt="Âmbar Brunch — logo âmbar café & brunch"`) | imagem | uma por página; em `/reservar` o `h1` é “Reserve sua mesa” |
| — | título do hero (`<p class="hero__headline">`) | `--t-hero` | é slogan, não título de seção; lido como texto corrido |
| `h2` | mega título de cada seção (`MegaTitle.astro`) | `--t-mega` | um por seção, sempre com `id` referenciado por `aria-labelledby` |
| — | título da comanda, tagline | `--t-ticket-title`, `--t-tagline` | parágrafos estilizados (não criam nível) |
| `legend` | passos da comanda | `--t-legend` | numerados “01 · ambiente” |
| `label` | campos | `--t-legend` (`.field__label`) | sempre visível (sem placeholder no lugar do rótulo) |

**Não existe `h3`** no site hoje. Se uma seção precisar de subtítulo, usar `h3` com `--t-ticket-title` (30 px, 78%, caixa-alta) — mesma voz da comanda.

## 4. Quebra de linha e largura de texto

| Regra | Onde | Implementação |
| --- | --- | --- |
| Mega títulos em **linhas fixas** (1–2 palavras por linha), alternando esquerda/direita | todas as seções | `<span>` por linha; `.mega__r` alinha à direita |
| Título do hero nunca quebra palavra; 3ª linha sem quebra | hero | `.l3 { white-space: nowrap }` — validado de 360 a 430 px |
| Botão do hero em uma linha | hero | `white-space: nowrap`; padding 18 px abaixo de 375 px |
| Lead com medida curta | Roll, Novo capítulo | `max-width: 32ch` / `30ch` |
| Título da comanda em 2 linhas | comanda | `max-width: 10ch` |
| Nota de foto antiga em 2–3 linhas | hero | `max-width: 15ch`, alinhada à direita |
| Scribble do tamanho do texto | títulos | `width: max-content; max-width: 100%` |
| Etiquetas e legendas de bolha nunca quebram | vídeos, bolhas | `white-space: nowrap` |

## 5. Caixa, itálico e acentos

- **Caixa-alta só na Bricolage** (títulos, botões, legendas, pílulas). **Fraunces sempre em minúsculas e itálica.**
- Acentos de caixa-alta (Â, É, Ç) cabem na entrelinha `.8` porque cada linha do mega título é um bloco próprio; nunca usar entrelinha menor que `.8`.
- O “&” do título é Fraunces itálica em `.78em`, na cor `--caramel-lt`.

## 6. Tamanhos mínimos e legibilidade

- Texto informativo: **≥ 12 px** (exceções decorativas em I-17).
- Campos de formulário: **16 px** (evita o zoom automático do iOS).
- Texto sobre foto ou vídeo sempre sobre uma faixa de cor (etiqueta, pílula, crédito), nunca direto na imagem.

## 7. Exemplos reais

```css
/* mega título (components/mega.css) */
.mega { font: var(--t-mega); font-variation-settings: var(--wdth-mega); font-stretch: var(--stretch-mega);
        letter-spacing: var(--track-mega); text-transform: uppercase; color: var(--wine); }

/* legenda de passo da comanda (components/ticket.css) */
.ticket legend { font: var(--t-legend); letter-spacing: var(--track-legend); text-transform: uppercase; color: var(--caramel-dk); }
```

```astro
<!-- MegaTitle.astro: uma linha por <span>, a 2ª à direita, scribble opcional -->
<MegaTitle linhas={['Mesa', 'cheia']} id="mesa-titulo" scribble="do brunch ao café gelado" />
```

## 8. Papéis a criar na padronização (I-04, mesmos valores de hoje)

| Novo token | Valor | Substitui |
| --- | --- | --- |
| `--t-menu-item` | `800 44px/.9 var(--display)` | `.sheet__nav a` |
| `--t-address` | `800 26px/1.02 var(--display)` | `.placa__addr` |
| `--t-input` | `700 16px/1.2 var(--display)` | `.field__input` |
| `--t-status` | `700 14px/1.35 var(--display)` | `.ticket__status` |
| `--t-error` | `700 13px/1.3 var(--display)` | `.field__error` |
| `--t-review` | `700 16px/1.3 var(--display)` | `.ticket__review dd`, `.horarios__row` (16/1.2) |
| `--t-credit` | `700 12.5px/1.25 var(--display)` | `.story__by` |
| `--t-link` | `700 14px/1 var(--display)` | `.novo__link`, `.ticket__link`, `.roll__cta strong` |
| `--t-step-key` | `700 22px/1 var(--display)` | botões do stepper |
| `--track-tight-caps` | `.02em` | faixa, pílulas, selo, crédito |
