# Biblioteca de componentes — Fornada Âmbar

> Inventário do que **está implementado** (commit `35feae3`). CSS em `src/styles/components/` e `src/styles/sections/`;
> markup em `src/components/`, `src/sections/`, `src/islands/`; comportamento em `src/lib/`. Parte do [design system](DESIGN-SYSTEM.md).

## 0. Duas famílias

| Família | O que é | Regra |
| --- | --- | --- |
| **Componentes reutilizáveis** (§1–8) | peças com forma, estados e comportamento próprios, usadas em mais de um lugar ou prontas para isso | mudam pelo design system; posição vem de fora |
| **Composições artísticas** (§9) | arranjos únicos de uma seção (colagem do hero, quadro da Mesa, leque de bandejas, painéis em diagonal, placa + horários) | posições em `--u` no CSS da seção; não se reaproveitam como estão, só como **receita** |

Convenção: **forma no componente, posição na seção**. Ex.: `.cut--circle` (forma, `cut.css`) × `.hero__collage .cut--circle` (posição, `hero.css`).

---

## 1. Navegação

### 1.1 Menu — selo do hero · `MenuButton.astro variante="hero"`

| | |
| --- | --- |
| Finalidade | abrir o menu sem cabeçalho fixo; é um objeto da colagem |
| Estrutura | `<button class="menu-btn menu-btn--hero" data-menu-open="menu" aria-label="Abrir menu" aria-expanded>` + SVG de 3 traços à mão |
| Forma | círculo 44 px, `--butter`, ícone `--wine` 24 px traço 2,6; `--shadow-offset-s`; girado +8°; `top: 12px; right: 10px` no hero |
| Estados | normal · `:active` `scale(.94)` · foco (anel manteiga) · `aria-expanded="true"` com a folha aberta |
| Responsivo | igual em todas as larguras; no desktop fica no canto do hero |
| Comportamento | rola com a página; quando sai da tela, o menu passa para a doca |

### 1.2 Menu — doca · `MenuButton.astro variante="dock"` (dentro de `Dock.astro`)

| | |
| --- | --- |
| Estrutura | mesmo botão, `menu-btn--dock`, começa `aria-hidden="true" tabindex="-1"` |
| Forma | quadrado 58 px, `--cream`, raio 18, `--shadow-offset` + `--shadow-float`; `left: 12px; bottom: max(12px, safe-area)` |
| Estados | oculto (`translateY(150%) rotate(2deg)`, sem toque) · visível (`.is-visible`) · pressionado (sombra 2 px) |
| Regra de visibilidade | selo do hero fora da tela **e** reserva fora da tela **e** nenhum campo de texto em foco **e** menu fechado (`lib/sticky-cta.js`) |
| Desktop | não aparece (`display: none` ≥ 960 px) |

### 1.3 Folha do menu · `NavSheet.astro` + `lib/nav-sheet.js`

| | |
| --- | --- |
| Finalidade | navegação entre seções; caminho secundário para reservar |
| Estrutura | `<dialog class="sheet" id="menu">` → cabeçalho (logo 132 px + botão fechar) → `<nav><ol class="sheet__nav">` 4 itens → botão `btn--wine btn--block` “Reservar mesa” → rodapé (contatos + pausar animações) |
| Forma | creme, borda recortada no topo (`--mask-scallop-top`), `max-height: 88svh`, fundo `--scrim`; itens em mega tipografia 44 px vinho, numerados “01–04” (contador CSS, estilo legenda de passo), alinhamento alternado esquerda/direita, separados por pontilhado |
| Estados | fechada · aberta (entra de baixo, itens em sequência) · foco preso (nativo do `<dialog>`) |
| Comportamento | abre por qualquer `[data-menu-open="menu"]`; fecha por ✕, Esc, toque no fundo ou item (rola até a seção e põe o foco nela); trava a rolagem da página (`html:has(.sheet[open])`) |
| Desktop | painel lateral de 420 px |
| Acessibilidade | `aria-haspopup="dialog"`, `aria-controls`, `aria-expanded`; foco volta ao botão que abriu |

### 1.4 Cabeçalho

**Não há cabeçalho fixo** (decisão de design: competiria com a etiqueta do logo). O topo é o próprio hero. Páginas internas (`/reservar`, `/privacidade`) usam a barra `.page-bar`: etiqueta do logo 150 px (link para a home) + “← início”.

### 1.5 Pular para a reserva · `.skip-link` (em `Base.astro`)

Primeiro elemento focável; recortado (invisível) até receber foco; aparece como pílula manteiga com sombra deslocada.

---

## 2. Ações

### 2.1 Botão · `.btn`

| Variante | Classe | Uso |
| --- | --- | --- |
| Primário sobre escuro | `.btn .btn--butter` | hero, Visite |
| Primário sobre claro | `.btn .btn--wine` | comanda, folha do menu |
| Largura total | `+ .btn--block` | comanda, folha |

| | |
| --- | --- |
| Forma | altura mín. 54 px, padding 0 26 px, raio 16, `--t-button` (800 · 16 px · 85% · +.04em · caixa-alta), `--shadow-offset`, ícone “→” com `gap: .55em` |
| Estados | normal · `:active` `scale(.96)` (.3 s) · foco · `:disabled`/`[data-disabled]` (opacidade .55, sombra 2 px, `cursor: not-allowed`) |
| Responsivo | no hero nunca quebra linha; padding 18 px abaixo de 375 px |

**Não existe botão “secundário” cheio.** As ações secundárias são, por ordem de peso:

| Ação secundária | Classe | Forma |
| --- | --- | --- |
| Link-pílula sobre foto | `.panel a` | pílula glacê, texto vinho 13 px caixa-alta (“reservar aqui →”) |
| Link-pílula contorno | `.pill-link` | pílula com borda 2 px `currentColor` sobre escuro; `aria-disabled` = tracejada a 60% |
| Link de texto | `.novo__link`, `.ticket__link`, `.roll__cta a` | caixa-alta 14 px sublinhada 2 px (ou Fraunces 22 px na chamada da Roll) |
| Pausar animações | `.motion-toggle` (`MotionToggle.astro`) | pílula contorno 44 px, ícone ⏸/▶, `aria-pressed` |

### 2.2 CTA fixo de reserva · `.sticky-cta` (dentro de `Dock.astro`) + `lib/sticky-cta.js`

| | |
| --- | --- |
| Finalidade | manter “Reservar mesa” a um toque, com uma mão |
| Estrutura | `<a class="sticky-cta" data-sticky-cta>` → espiral (SVG) + “Reservar mesa” + caixa da seta “→” |
| Forma | altura 58 px, manteiga, raio 18, `--t-button-l`, `--shadow-offset` + `--shadow-float`; seta em caixa vinho 36 px raio 12; `left: 80px` com o menu na doca (`.has-dock`) |
| Estados | oculto (`translateY(150%) rotate(-2deg)`, opacidade 0, sem toque, `aria-hidden`, `tabindex=-1`) · visível · pressionado (sombra 2 px) |
| Regra | visível quando **o botão de reserva do hero tem menos de 60% na tela** e a reserva ocupa menos de 30% da altura (ou 240 px) e nenhum campo de texto tem foco e o menu está fechado |
| Desktop | 320 px no canto inferior direito |
| Movimento reduzido | só opacidade (150 ms) |

---

## 3. Seleção e formulário (comanda)

### 3.1 Chip · `.chip` (+ `.chips`, `.chips--dates`)

| | |
| --- | --- |
| Finalidade | escolha única (ambiente, data, horário) |
| Estrutura | `<div class="chips" role="radiogroup" aria-labelledby>` → `<button class="chip" role="radio" aria-checked>`; data: `<small>dia</small>número` |
| Forma | altura 46 px (datas: 60 × 62), borda 2 px tinta, raio 14, glacê, `--t-chip` |
| Estados | normal · selecionado (vinho, texto manteiga, `--shadow-offset-s`, sobe 1 px) · `:active` `scale(.96)` · indisponível (`:disabled`: tracejado, texto 65%, riscado) · carregando (`.chip--skeleton`: brilho 1,6 s) · foco |
| Teclado | setas movem e selecionam; só o selecionado é tabulável (`tabindex` itinerante) |
| Carrossel | datas em linha única com rolagem horizontal e `scroll-snap: x proximity` |

### 3.2 Stepper · `.stepper`

Botões 46 × 46 (borda 2 px, raio 14, “−/+” 22 px vinho) e número `--t-numeral` (32 px, 78%). Limites da API (simulação: 1–12; padrão: 1–20); no limite o botão fica `:disabled` (tracejado). `<output aria-live="polite">`.

### 3.3 Campo · `.field` (+ `__label`, `__input`, `__hint`, `__error`)

| | |
| --- | --- |
| Estrutura | `<label class="field">` → rótulo (estilo legenda, opcional em Fraunces “(opcional)”) → `input`/`textarea` → erro |
| Forma | altura 52 px, borda 2 px tinta, raio 14, glacê, texto 700 · **16 px** (iOS); `textarea` 96 px, 400 |
| Estados | normal · foco (`--shadow-offset-s`, sobe 1 px) · inválido (`data-invalid`: borda vinho + anel interno 1 px + mensagem 13 px vinho; `aria-invalid`, `aria-describedby`) |
| Máscara | telefone formatado ao digitar: `(00) 00000-0000` |

### 3.4 Consentimento · `.check`

Caixa 26 × 26 (raio 8), alvo de 44 px; marcada = vinho com ✓ manteiga e sombra 2 px; inválida = borda vinho. Texto 14 px com link para `/privacidade/`.

### 3.5 Comanda · `.ticket` (+ `ReservaFlow.tsx`)

| | |
| --- | --- |
| Finalidade | o formulário de reserva como um papel de comanda |
| Forma | creme, picote lateral (`--mask-perforated`), raio 8, padding 30/26/26, `gap: 18px`, máx. 480 px; título `--t-ticket-title` em 2 linhas (10ch); passos em `fieldset` com pontilhado |
| Carimbo | `.stamp` 72 px tracejado vinho, +14°, no canto superior direito |

**Etapas e estados da reserva:**

| Etapa | Conteúdo | Estados |
| --- | --- | --- |
| 01 · ambiente | chips de ambiente | selecionado ✓ na legenda |
| 02 · pessoas | stepper | limite; aviso “grupos maiores” no máximo |
| 03 · data | 10 datas (ou a antecedência da API) | esqueleto até montar no navegador |
| 04 · horário | chips vindos da API | carregando (4 esqueletos + texto) · sem horários · erro + “tentar de novo” · lista (esgotados riscados) |
| 05 · seus dados | nome, telefone, e-mail (opcional ou exigido pela API), observações, consentimento | validação com foco no 1º erro |
| Revisão | resumo (`dl`) | “Confirmar reserva” · “Editar” |
| Enviando | botão “Enviando…” bloqueado, `aria-busy`, carimbo girando | — |
| Confirmação | status + código; “Adicionar à agenda” (.ics) · “Fazer outra reserva” | carimbo `reservado` (cheio vinho) |
| Falha | mensagem + “Tentar de novo” | carimbo `erro` (“tente de novo”) |
| Conflito | volta ao passo 04 com aviso | horário limpo, lista recarregada |

| Modo | O que mostra |
| --- | --- |
| `indisponivel` (padrão) | passos 01–03 interativos; 04 explica que os horários virão quando as reservas forem ativadas; botão desabilitado “Reservas online em breve”; carimbo “em breve” |
| `simulado` (só testes) | faixa listrada “Simulação para testes — nenhuma reserva é feita”; carimbo “simulação”/“simulado” |
| `api` | fluxo completo, sem aviso (só após validar o contrato) |

Mensagens de estado em `.ticket__status` (`role="status"` ou `role="alert"`) e um anúncio `aria-live` oculto.

---

## 4. Cards editoriais

| Componente | Classe | Estrutura | Variantes | Uso |
| --- | --- | --- | --- | --- |
| **Painel diagonal** | `.panel` | `figure` → foto 4:5 recortada em diagonal 16% → legenda com tagline + link-pílula | `--day` (diagonal na base, raio no topo) · `--amber` (diagonal no topo, raio na base, sobe 16% sobre o anterior) | ambientes |
| **Tagline** | `.tagline` | tarja 30 px, 78%, caixa-alta, −2° | vinho/manteiga · creme/vinho (no `--amber`) | ambientes |
| **Story (vídeo vertical)** | `.story` (`Story.astro`) | `li` 9:16, raio 26, contorno 4 px → progresso → vídeo → botão tocar/pausar (cobre o card) → etiqueta → crédito | contorno caramelo · manteiga no 2º (e 44 px mais baixo) | Fornadas |
| **Comanda** | `.ticket` | ver §3.5 | reserva · horários (Visite: padding 26/24/22, `gap: 12px`, linhas com pontilhado) | Reserva, Visite |
| **Placa** | `.placa` | pino frutas vermelhas → etiqueta creme com “Endereço” + endereço 26 px + cidade | — | Visite |
| **Aviso** | `.notice` | caixa tracejada vinho 45%, raio 14, 13 px vinho | — | ambientes |
| **Nota de procedência** | `.ref-note` | Fraunces 12,5 px, 15ch, à direita, com `*` | `--on-light` (tinta 65%) | hero |

---

## 5. Peças de colagem (reutilizáveis)

| Peça | Classe | Forma | Medidas |
| --- | --- | --- | --- |
| **Etiqueta** | `.label` | creme, borda recortada na base (ondas de 20 px), segura o logo | `min(76vw, 320px)` (hero: `--label-w`); padding 20/24/30 |
| **Recorte circular** | `.cut--circle` | foto 1:1, borda 6 × `--u` manteiga, −10° | posição pela seção |
| **Polaroide** | `.cut--polaroid` | glacê, padding 8/8/34 × `--u`, foto 3:3,6, legenda Fraunces, +6°, `--shadow-photo` | — |
| **Ladrilho** | `.cut--tile` | foto 3:3,9, raio 18, borda 5 × `--u` creme, −4° | — |
| **Foto com fita** | `.board__item` + `.tape` | moldura glacê 7 × `--u`, `--shadow-board`; fita 78 × 26 manteiga 82%, ±5–8° | `.tape--r` à direita |
| **Bolha** | `.bubble` | foto 1:1 circular, borda 6 px manteiga; legenda em pílula cacau | 38% da largura |
| **Selo com texto girando** | `.sticker--roll` (`StickerRoll.astro`) | círculo creme, texto em círculo (SVG), logo da Roll 58%, +8° | 104 × `--u` no hero; texto gira 24 s |
| **Selo simples** | `.badge` (`Badge.astro`) | círculo creme 118 px, logo 74%, −8° | 86 px no Novo capítulo |
| **Carimbo** | `.stamp` (`Stamp.astro`) | círculo 72 px tracejado, Fraunces 600, +14° | estados `reservado`, `erro`; 92 px no Novo capítulo |
| **Nota + seta** | `.note` + `.arrow` | Fraunces 19 × `--u` (16–22 px); seta vinho traço 3,2 desenhada | 3 direções no quadro |
| **Faíscas, espiral** | `.sparks`, `Spiral.astro` | SVG de traço, `aria-hidden` | — |
| **Foto** | `Foto.astro` | `<picture>` AVIF + WebP com `display: contents` | ver [`VISUAL-GUIDELINES.md`](VISUAL-GUIDELINES.md) §3 |

---

## 6. Carrosséis

| Carrossel | Classe | Mecânica | Regras |
| --- | --- | --- | --- |
| **Vídeos** | `.stories` | grid em coluna, cards de 60%, `scroll-snap-type: x mandatory`, `scroll-padding-inline: --gutter`, sem barra | toca 1 vídeo por vez (≥ 60% visível); poster carregado a 1,5 tela; toque toca/pausa; progresso em `scaleX`; desktop: colunas de 280 px sem rolagem |
| **Datas** | `.chips--dates` | linha única com rolagem horizontal, `scroll-snap: x proximity` | 10 datas; setas do teclado |
| **Faixa** (não interativa) | `.ticker` | duas cópias do texto, `translateX(-50%)` em 32 s | pausa global e movimento reduzido param |

Não há carrossel de fotos. Nenhum carrossel usa biblioteca.

---

## 7. Títulos

| Componente | Arquivo | Props | Notas |
| --- | --- | --- | --- |
| `MegaTitle` | `MegaTitle.astro` | `linhas[]`, `id`, `tom` (`light`/`wine`), `scribble`, `as` (`h1`/`h2`), `direita[]`, `reveal` | uma linha por `<span>`; 2ª à direita; scribble com `--light` sobre escuro |
| Título do hero | `Hero.astro` | — | 3 linhas fixas; “&” em Fraunces |

---

## 8. Rodapé · `Footer.astro`

| | |
| --- | --- |
| Estrutura | logo Âmbar 240 px → “com assinatura gastronômica” + logo Roll 56 px (Fraunces 14 px cacau) → informações (pendentes) → links (Privacidade · Roll @roll.ofc) → pausar animações |
| Forma | creme, centralizado, padding 64 / gutter / **130** (espaço da doca) |
| Responsivo | igual em todas as larguras |

---

## 9. Composições artísticas (específicas de seção)

| Seção | Composição | Peças | Onde está o desenho |
| --- | --- | --- | --- |
| Hero | etiqueta + título em 3 linhas + **colagem** (círculo, polaroide, ladrilho, selo, faíscas) + botão | §5 | `hero.css` (palco 358 × 330 em `--u`; desktop em %) |
| Faixa | categorias inclinadas em loop | `.ticker` | `ticker.css` |
| Novo capítulo | mega título 3 linhas + carimbo + texto + selo; borda recortada na base; espiral ao fundo | `.stamp`, `.badge` | `novo-capitulo.css` |
| Mesa cheia | **quadro de cortiça**: 3 fotos com fita, 3 notas com setas; cardápio em pílulas (±1,5°) | `.board__item`, `.tape`, `.note`, `.arrow`, `.bands` | `mesa.css` (palco 358 × 660 em `--u`) |
| Fornadas | selo + mega + lead; stories; **leque de 3 bandejas** (−7°, +3°, −2°, sobrepostas −5%); espiral gigante girando com o scroll | `.story`, `.badge` | `roll.css` |
| Escolha o clima | **dois painéis em diagonal** + 2 bolhas sobrepostas + aviso | `.panel`, `.bubble`, `.notice` | `climas.css` |
| Reserva | mega + comanda | `.ticket` | `reserva.css` |
| Visite | **placa** (−2°) + **comanda de horários** (+1,5°) + ações | `.label`, `.ticket`, `.pill-link` | `visite.css` |
| Na mesa *(condicional)* | mural de polaroides em 2 colunas alternando −4°/+5° | `.cut--polaroid` | `na-mesa.css` |

**Para uma seção nova:** mega título + **uma** composição + uma saída para a reserva; montar com as peças do §5, posições em `--u` se for colagem.

---

## 10. Componentes de revisão (fora do produto)

`Pendente.astro` (`.pending`), `.review-flag`, `.ticket__sim` — só no build de revisão ou no modo simulado. Não fazem parte da identidade.
