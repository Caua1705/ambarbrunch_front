# Cores e tokens — Fornada Âmbar

> Fonte da verdade: [`src/styles/tokens.css`](../../src/styles/tokens.css). Contrastes calculados pela fórmula WCAG 2.2.
> Parte do [design system](DESIGN-SYSTEM.md). Proposta de centralização: [`PROPOSTA-TOKENS-CSS.md`](PROPOSTA-TOKENS-CSS.md).

## 1. Paleta

### Principal (marca e superfícies)

| Token | HEX | RGB | Origem | Papel |
| --- | --- | --- | --- | --- |
| `--wine` | `#670D27` | 103 13 39 | **tinta do logo oficial** (pág. 1 do PDF) | cor da marca; fundo do hero e da reserva; títulos e botão principal sobre claro |
| `--cream` | `#F4EEE3` | 244 238 227 | **fundo do logo oficial** (pág. 1) | superfície clara; etiqueta do logo; comanda; folha do menu |
| `--butter` | `#F3DDAE` | 243 221 174 | protótipo | CTA; texto sobre vinho; fundo de Escolha o clima e Novo capítulo |
| `--cacao` | `#3A2218` | 58 34 24 | protótipo | fundo de Fornadas e Visite; faixa; **sombra deslocada** |
| `--ink` | `#24150F` | 36 21 15 | protótipo | texto corrido |
| `--glaze` | `#FFFBF4` | 255 251 244 | protótipo | molduras de foto, chips, campos |

### Secundária (acentos)

| Token | HEX | RGB | Papel |
| --- | --- | --- | --- |
| `--caramel` | `#C98A45` | 201 138 69 | pílulas, contorno do 1º vídeo, espiral. **Nunca texto, nunca foco** |
| `--caramel-lt` | `#E7B676` | 231 182 118 | “BRUNCH” e “&” do hero; scribble sobre escuro |
| `--caramel-dk` | `#9A5F25` | 154 95 37 | legendas e rótulos sobre creme |
| `--berry` | `#A8203A` | 168 32 58 | pílula (red velvet/bowls); estado de erro; pino da placa |
| `--leaf` | `#3D5A3E` | 61 90 62 | pílula (saladas, chá) |

## 2. Tokens semânticos (implementados)

| Token | Valor | Categoria | Uso real |
| --- | --- | --- | --- |
| `--text` | `var(--ink)` | texto | corpo |
| `--text-muted` | tinta 65% | texto | notas, rodapé, dicas, chip indisponível (10 usos) |
| `--text-soft` | tinta 70% | texto | texto da comanda, consentimento |
| `--text-on-dark-muted` | creme 86% | texto | lead da Roll |
| `--text-on-dark-faint` | creme 62% | texto | crédito da Roll |
| `--text-on-dark` | `var(--cream)` | texto | **sem uso** (I-02) |
| `--rule` | tinta 18% | borda | pontilhados (passos, menu, revisão, horários) |
| `--notice-line` | vinho 45% | borda | aviso de foto antiga |
| `--tape` | manteiga 82% | superfície | fita adesiva |
| `--scrim` | tinta 58% | superfície | fundo atrás da folha do menu |
| `--focus-ring` | vinho (claro) · manteiga (escuro) | foco | trocado por superfície em `base.css` |

### Mapa de superfícies (como as cores se combinam por seção)

| Superfície | Fundo | Texto | Título | Acento | Anel de foco | Grão |
| --- | --- | --- | --- | --- | --- | --- |
| Hero | `--wine` | `--butter` | `--butter` + `--caramel-lt` | `--butter` (botão) | `--butter` | sim |
| Faixa | `--cacao` | `--butter` | — | — | `--butter` | não |
| Novo capítulo | `--butter` | `--ink` | `--wine` | `--caramel-dk` (scribble) | `--wine` | não |
| Mesa cheia | `--cream` | `--ink` | `--wine` | `--caramel-dk` | `--wine` | não |
| Fornadas | `--cacao` | `--text-on-dark-muted` | `--butter` | `--caramel` (espiral, vídeo) | `--butter` | sim |
| Escolha o clima | `--butter` | `--wine` (aviso) | `--wine` | `--wine` (tagline) | `--wine` | não |
| Reserva | `--wine` | `--butter` | `--butter` | comanda `--cream` | `--butter` / `--wine` na comanda | sim |
| Visite | `--cacao` | `--cream` | `--butter` | placa `--cream`, pino `--berry` | `--butter` | sim |
| Rodapé, páginas | `--cream` | `--text-muted` | — | `--wine` (links) | `--wine` | não |
| Folha do menu | `--cream` | `--ink` | `--wine` | `--caramel-dk` (números) | `--wine` | não |

**Regra de ritmo:** duas seções vizinhas nunca têm o mesmo fundo; vinho abre (hero) e fecha a história (reserva).

### CTAs

| Contexto | Fundo | Texto | Sombra | Token(s) |
| --- | --- | --- | --- | --- |
| Botão principal sobre escuro | `--butter` | `--wine` | `--shadow-offset` (cacau) | `.btn--butter` |
| Botão principal sobre claro | `--wine` | `--butter` | `--shadow-offset` | `.btn--wine` |
| CTA fixo | `--butter` | `--wine` (+ caixa da seta `--wine`/`--butter`) | `--shadow-offset` + `--shadow-float` | `.sticky-cta` |
| Link-pílula sobre foto | `--glaze` | `--wine` | — | `.panel a` |
| Link-pílula contorno sobre escuro | transparente | `--butter` (borda `currentColor`) | — | `.pill-link` |
| Botão de menu | `--butter` (hero, fechar) · `--cream` (doca) | `--wine` | `--shadow-offset-s` / `--shadow-offset` | `.menu-btn--*` |

## 3. Combinações aprovadas e contraste

### Texto

| Texto / fundo | Razão | Regra |
| --- | ---: | --- |
| tinta / glacê | 17,12 | livre |
| tinta / creme | 15,29 | livre |
| tinta / manteiga | 13,26 | livre |
| creme / cacau | 12,79 | livre |
| vinho / glacê | 12,24 | livre |
| manteiga / cacau | 11,09 | livre |
| vinho / creme | 10,93 | livre |
| manteiga / vinho | 9,48 | livre |
| vinho / manteiga | 9,48 | livre |
| caramelo claro / cacau | 7,98 | livre |
| caramelo claro / vinho | 6,82 | livre |
| frutas vermelhas / glacê | 6,94 | livre |
| creme / folha | 6,66 | livre |
| creme / frutas vermelhas | 6,20 | livre |
| tinta / caramelo | 6,06 | livre (pílulas) |
| tinta 65% / creme | 5,19 | livre |
| caramelo / cacau | 5,07 | só texto grande ou decoração |
| **caramelo escuro / creme** | **4,50** | só ≥ 12,5 px em negrito ou ≥ 18 px |
| caramelo escuro / manteiga | 3,90 | **só texto grande** (scribble de 24 px no Novo capítulo — passa como texto grande, 3:1) |

### Não usar

| Combinação | Razão | Motivo |
| --- | ---: | --- |
| caramelo / manteiga | 2,19 | era o anel de foco do v1 (corrigido) |
| caramelo / creme | 2,52 | — |
| vinho / caramelo | 4,33 | sobre caramelo, o texto é tinta |
| manteiga / creme | 1,15 | — |

### Pares das pílulas do cardápio (`--b` / `--t`)

`wine`/`butter` · `caramel`/`ink` · `cacao`/`butter` · `cacao`/`caramel-lt` · `leaf`/`cream` · `butter`/`ink` · `berry`/`cream` — definidos em [`src/data/cardapio.ts`](../../src/data/cardapio.ts) (`PARES`). Fora dessa lista, não usar.

### Pontos de atenção (auditoria)

| Caso | Razão | Item |
| --- | ---: | --- |
| Botão desabilitado “Reservas online em breve” (vinho e manteiga a 55% sobre creme) | 3,15 | I-18 |
| Crédito do vídeo em caramelo claro sobre faixa de tinta 72% com vídeo claro atrás | 3,81 (pior caso) | I-19 |

### Elementos gráficos (WCAG 1.4.11, mínimo 3:1)

| Elemento | Razão |
| --- | ---: |
| Anel de foco manteiga / vinho | 9,48 |
| Anel de foco vinho / creme | 10,93 |
| Anel de foco manteiga / cacau | 11,09 |
| Contorno do chip (tinta) / glacê | 17,12 |

## 4. Inventário completo de tokens (`tokens.css`, 134 declarações = 133 tokens + `--gutter` redeclarado no desktop)

Contagem de usos = ocorrências de `var(--token)` no CSS e no markup.

### Cor (22)

Primitivos (11): ver §1 — usos: `--wine` 49 · `--butter` 35 · `--cream` 20 · `--ink` 16 · `--glaze` 13 · `--cacao` 12 · `--berry` 9 · `--caramel-dk` 7 · `--caramel-lt` 6 · `--caramel` 4 · `--leaf` 1.
Papéis (11): ver §2.

### Tipografia (46)

`--display`, `--serif` · 6 `--wdth-*` (nome legado: hoje guardam `opsz`/`normal`) · 6 `--stretch-*` · 13 `--t-*` Bricolage · 10 `--t-*` Fraunces · 5 `--fs-*` · 4 `--track-*`. Valores em [`TYPOGRAPHY.md`](TYPOGRAPHY.md).

### Espaço e ritmo (16)

| Token | Valor | Usos |
| --- | --- | ---: |
| `--gutter` | 16px · 56px (≥ 960) | 22 |
| `--rhythm-a` / `-b` / `-c` / `-d` | 76 / 84 / 88 / 92px | 3 / 4 / 4 / 2 |
| `--rhythm-tail` | 8px | 6 |
| `--space-1…10` | 4 … 64px | **0** (I-01) |

### Forma (23)

| Token | Valor | Usos |
| --- | --- | ---: |
| `--radius-2xs` · `-xs` · `-s` · `-m` | 6 · 8 · 10 · 12px | 1 · 1 · 1 · 1 |
| `--radius-control` | 14px | 9 |
| `--radius-button` | 16px | 1 |
| `--radius-l` | 18px | 3 |
| `--radius-xl` | 26px | 5 |
| `--radius-pill` | 999px | 7 |
| `--border-photo` · `-tile` · `-control` | 6 · 5 · 2px | 2 · **0** · 5 |
| `--shadow-offset` · `-s` · `-xs` | `4px 4px 0` · `3px 3px 0` · `2px 2px 0` cacau | 5 · 4 · 4 |
| `--shadow-photo` · `-photo-deep` | `0 16px 26px -14px` preto 55% · 70% | 1 · 1 |
| `--shadow-board` | `0 18px 30px -18px` tinta 55% | 1 |
| `--shadow-sticker` | `0 10px 18px -8px` preto 45% | 2 |
| `--shadow-strip` | `0 10px 20px -10px` preto 40% | 1 |
| `--shadow-float` | `0 18px 30px -16px` preto 50% | 4 |
| `--shadow-tape` | `0 1px 2px` preto 8% | 1 |
| `--drop-label` | `drop-shadow(0 14px 18px rgba(20,4,9,.35))` | 3 |

### Textura e máscara (5)

`--grain` (SVG `feTurbulence` 160×160, `baseFrequency .9`, 2 oitavas) · `--grain-opacity` .35 · `--mask-scallop` (ondas de 20 px na base) · `--mask-scallop-top` · `--mask-perforated` (furos de 9 px a cada 28 px nas laterais).

### Movimento (15)

Ver [`MOTION-SYSTEM.md`](MOTION-SYSTEM.md) §2.

### Camadas e palcos (6)

`--z-strip` 3 · `--z-dock` 50 · `--z-sheet` 60 · `--stage-hero-w` 358 · `--stage-hero-h` 330 · `--stage-board-w` 358.

## 5. Exemplos reais

```css
/* superfície escura troca o anel de foco (base.css) */
.surface-dark, .hero, .ticker, .roll, .reserva { --focus-ring: var(--butter); }
.surface-light, .ticket, .sheet { --focus-ring: var(--wine); }

/* botão principal sobre claro (button.css) */
.btn--wine { background: var(--wine); color: var(--butter); box-shadow: var(--shadow-offset); }
```

```ts
// pílula do cardápio: o par vem dos dados, nunca de cor solta (MesaCheia.astro)
const cor = (c) => `--b:${PARES[c].b}${'t' in PARES[c] ? `;--t:${PARES[c].t}` : ''}`;
```
