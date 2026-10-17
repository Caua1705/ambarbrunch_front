# Layout e grid — Fornada Âmbar

> Fonte da verdade: `src/styles/tokens.css` (§4–7, 10–11) e `src/styles/sections/*.css`. Medidas calculadas no site (Chromium).
> Parte do [design system](DESIGN-SYSTEM.md).

> **Atualização 2026-10-16 (implementação):** tokens agora em `src/styles/tokens/layout.css` (`--container-*`, `--z-*`, `--rhythm-novo-*`) e escala `--s-*`. **Tablet 600–959 desenhado** (D16): `--gutter` 32 px, mega título até 150 px, quadro da Mesa e bandejas em até 560 px, vídeos em 38%, Escolha o clima e Visite em duas colunas, CTA fixo de 340 px à direita. Nota de foto antiga com 12 px abaixo de 375 px (I-17).

## 1. Princípio: mobile é o produto

O desenho nasce em **390 × 844** e é validado em 360, 375, 430 (e telas baixas de 640–700 px). Desktop (≥ 960 px) reaproveita o layout de desktop do protótipo. **Tablet (600–959 px) ainda não foi desenhado** — hoje é o mobile ampliado (auditoria I-16).

## 2. Grid e containers

### Mobile (até 959 px)

| Elemento | Regra | Em 390 px |
| --- | --- | --- |
| Coluna | uma só, cheia | 390 |
| Margem lateral | `--gutter` = **16 px** | conteúdo de **358 px** |
| Seções sem margem lateral | Fornadas (`.roll`): o carrossel de vídeos vai de borda a borda; o cabeçalho e o crédito recolocam os 16 px | — |
| Elementos que **sangram** | faixa (`margin: -16px -12px 0`, girada −2,5°), bolha do lounge (`right: -4%`), círculo do hero (`left: -21,48 × --u`) | — |
| Palco do hero | 358 × 330 px do protótipo, em `--u` | 358 × 330 |
| Palco do quadro da Mesa | 358 px de largura, altura `660 × --u` | 358 × 660 |
| Comanda | `max-width: 480px`, centralizada | 358 |

### Desktop (≥ 960 px)

| Elemento | Regra |
| --- | --- |
| Margem lateral | `--gutter` = **56 px** |
| Hero | grid `1fr 1.05fr`, linhas `auto 1fr auto`, `column-gap: 40px`; colagem na coluna 2 ocupando as 3 linhas (`min-height: 620px`) |
| Containers | **900** (bandejas) · **980** (quadro e faixas da Mesa, mega da reserva, Novo capítulo, Visite) · **1100** (Escolha o clima) · **1240** (Mesa, cabeçalho da Roll) — declarados por seção (I-12) |
| Ambientes | grid `1fr 1fr`, `gap: 0 24px`; o 2º painel desce 80 px |
| Visite | grid `1fr 1fr`, `gap: 40px` |
| Vídeos | colunas fixas de 280 px, centralizadas |
| CTA fixo | 320 px, canto inferior direito (`right: 32px; bottom: 28px`); botão de menu da doca some |
| Folha do menu | painel lateral de 420 px à direita |

## 3. Espaçamento

### Escala usada de fato (125 valores literais, contados no CSS)

| Valor | Usos | Onde aparece mais |
| ---: | ---: | --- |
| 6 px | 9 | gaps pequenos (stepper, pílula de pendência, etiqueta) |
| 8 px | 13 | gaps de chips e pílulas, campo (rótulo → input) |
| 10 px | 13 | padding de aviso, gaps da legenda de painel |
| **12 px** | **23** | gaps de doca, campos, ações; padding de chips e status |
| 14 px | 15 | padding lateral de campos e avisos; gaps de ritmo |
| 16 px | 12 | = `--gutter`; separadores |
| 18 px | 11 | gap da comanda, padding de chip |
| 22 px | 11 | respiros entre título e conteúdo |
| 24 px | 6 | padding da etiqueta, gaps no desktop |
| 26 px | 8 | padding da comanda e da placa |
| 30 px | 6 | margem do quadro, padding da comanda |
| 34 px | 4 | antes dos vídeos e da placa |
| 40 px | 5 | antes da comanda e dos sabores |
| 44 px | 2 | antes das bandejas; desnível do 2º vídeo |

Padrão: **passos de 2 px até 18**, depois **22, 26, 30, 34, 40, 44**. A escala `--space-*` declarada (4, 8, 12, 16, 20, 24, 32, 40, 48, 64) **não corresponde** ao desenho e não é usada (I-01) — a proposta de tokens adota a escala real.

### Ritmo vertical das seções (padding calculado)

| Seção | Topo | Base | Regra |
| --- | ---: | ---: | --- |
| Hero | 22 (16 em telas baixas; 40 no desktop) | 22 | ocupa a 1ª tela |
| Novo capítulo | **132** | 94 | exceção: espaço para o carimbo (I-15) |
| Mesa cheia | 76 | 84 | `--rhythm-a` (+8) |
| Fornadas | 88 | 96 | `--rhythm-c` (+8) |
| Escolha o clima | 84 | 92 | `--rhythm-b` (+8) |
| Reserva | 92 | 100 | `--rhythm-d` (+8) |
| Visite | 88 | 96 | `--rhythm-c` (+8) |
| Rodapé | 64 | **130** | a base reserva espaço para a doca fixa |

**Regra:** a base de cada seção é o topo + 8 px (`--rhythm-tail`). Os mesmos valores valem no desktop.

### Respiros recorrentes dentro das seções

| Distância | Valor |
| --- | --- |
| mega título → scribble | 10 px (`margin-top` do scribble) |
| título → aviso (Escolha o clima) | 22 px |
| título → quadro (Mesa) | 30 px |
| título → comanda (Reserva) | 40 px |
| lead → vídeos (Fornadas) | 34 px |
| vídeos → bandejas | 44 px |
| entre passos da comanda | 18 px (`gap`) + 16 px de padding sob o pontilhado |

## 4. Breakpoints

| Condição | Tipo | O que muda |
| --- | --- | --- |
| *(base)* | mobile | tudo |
| `max-width: 374px` | ajuste | botão do hero com padding 18 px; nota de foto antiga 12 px (I-17) |
| `600px` – `959px` | tablet (D16) | margem 32; mega até 150; colagens contidas; clima e Visite em 2 colunas; CTA de 340 px |
| `max-height: 700px and max-width: 959px` | ajuste de altura | respiros do hero: 22 → 16 (topo), 22 → 14 (título), 14 → 10 (colagem e rodapé do hero) |
| `min-width: 960px` | **layout** | desktop: gutter 56 px, grids, containers, CTA no canto, folha lateral |
| Altura em `svh` | fluido | título do hero (`11svh`), etiqueta (`40svh`) e altura da colagem respondem à altura da tela |

Não há tokens de breakpoint (CSS ainda não tem `@custom-media` em produção); os valores são fixos e estão listados aqui.

## 5. Bordas, raios e sombras (uso por componente)

| Token | Valor | Componentes |
| --- | --- | --- |
| `--radius-2xs` | 6 | anel de foco |
| `--radius-xs` | 8 | comanda (e o checkbox, como literal — I-07) |
| `--radius-s` | 10 | fotos das bandejas |
| `--radius-m` | 12 | caixa da seta do CTA fixo |
| `--radius-control` | 14 | chips, stepper, campos, aviso, status |
| `--radius-button` | 16 | botões |
| `--radius-l` | 18 | ladrilho do hero, CTA fixo, menu da doca |
| `--radius-xl` | 26 | vídeos, painéis de ambiente |
| `--radius-pill` | 999 | pílulas, etiquetas, links-pílula, faixa de crédito |
| `50%` *(literal, I-07)* | círculo | recorte circular, bolhas, selos, carimbo, botão de menu, pino |
| `--border-control` | 2 px tinta | chips, stepper, campos, checkbox |
| `--border-photo` | 6 px | bolhas, bandejas (o círculo do hero usa `6 × --u`, mín. 3 px) |
| pontilhado | 2 px `--rule` | separadores da comanda, do menu e dos horários |
| tracejado | 2 px | aviso (`--notice-line`), carimbo (`--wine`), pendência (`--berry`) |
| `--shadow-offset` | 4 4 0 cacau | botões, CTA fixo, menu da doca — **a assinatura** |
| `--shadow-offset-s` | 3 3 0 | chip selecionado, selo do menu, campo em foco |
| `--shadow-offset-xs` | 2 2 0 | pressionado, desabilitado |
| sombras de papel | `--shadow-photo/-deep/-board/-sticker/-strip/-tape`, `--drop-label` | fotos, selos, faixa, fita, etiqueta |
| `--shadow-float` | flutuante | só elementos fixos (doca) |

## 6. Regras de composição mobile-first

1. **Unidade do protótipo (`--u`).** Cada palco de colagem declara `--u` = 1 px do protótipo, com unidades de contêiner. Em 390 px vale 1px; em 360, ≈ 0,92px; em 430, ≈ 1,11px. A composição inteira escala junto.
   ```css
   .mesa  { container-type: inline-size; }
   .board { --u: calc(100cqi / var(--stage-board-w)); height: calc(660 * var(--u)); }
   .board__item--b { top: calc(262 * var(--u)); }
   ```
2. **O botão Reservar sempre na 1ª tela.** A colagem do hero tem altura `clamp(160px, 100svh − 12px − --hero-rest, 330px)`, e `--u` é limitado também pela altura (`min(100cqw/358, 100cqh/330)`). Medido: o botão termina em 606/640, 706/740, 633/667, 805/844, 846/896 e 882/932 px.
3. **Sobreposição controlada.** Peças vizinhas se sobrepõem 15–35%; a ordem de camadas é foto grande → foto pequena → selo → texto (§7).
4. **Área segura.** Elementos fixos usam `bottom: max(12px, env(safe-area-inset-bottom))`; `viewport-fit=cover`.
5. **Nada vaza na horizontal:** `overflow-x: clip` no `html`; seções com peças sangrando têm `overflow: hidden` (verificado: 0 px de 360 a 1440).
6. **Alvos de toque ≥ 44 px** (botão 54, CTA 58, chip 46, data 62, stepper 46, menu 44/58, links 44).

## 7. Camadas (`z-index`)

| Nível | Valor | Elemento |
| --- | ---: | --- |
| fundo | −1 | grão, espiral da Roll |
| papel 1–4 | 1–4 | peças das colagens (polaroide 1 · círculo e faíscas 2 · ladrilho 3 · selo 4), fitas 2, notas e setas 4 |
| rodapé do hero | 5 | botão e nota acima da colagem |
| selo do menu | 6 | acima de tudo no hero |
| faixa | `--z-strip` 3 | costura hero → seção seguinte |
| marca de revisão | `--z-dock − 1` | só revisão |
| doca | `--z-dock` 50 | CTA fixo e menu |
| folha | `--z-sheet` 60 | menu aberto (o `<dialog>` modal já fica na camada superior) |
| pular para a reserva | `--z-sheet + 1` | foco de teclado |
