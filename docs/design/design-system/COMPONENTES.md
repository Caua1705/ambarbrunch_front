# Componentes — Fornada Âmbar

> CSS em [`src/styles/components/`](../../../src/styles/components/) · comportamento em [`src/lib/`](../../../src/lib/) ·
> vitrine viva: `experiments/design-system/index.html` (`node experiments/serve.mjs` → `/experiments/design-system/`).
>
> **Regra de nomes:** as classes do v1 foram mantidas. Só cinco viraram genéricas, porque passam a ser reusadas fora da seção de origem:
>
> | v1 | Design system | Por quê |
> | --- | --- | --- |
> | `.hero__label h1` | `.label` | etiqueta recortada também no styleguide, no rodapé e na seção Visite |
> | `.roll__badge` | `.badge` (+ `.roll__badge` só para a margem) | selo da Roll em Novo capítulo e no rodapé |
> | `.climas__notice` | `.notice` | aviso de foto antiga em qualquer seção |
> | `.hero__note` | `.ref-note` | nota de foto antiga em qualquer colagem |
> | `.ticket__stamp` | `.stamp` | carimbo com estados (prévia, reservado, erro) |
>
> **Forma × posição:** o arquivo do componente define só a forma. A posição dentro de uma colagem fica no CSS da seção (`sections/*.css`).
>
> **No Astro:** cada linha abaixo vira um `.astro` em `src/components/` com o **mesmo markup** mostrado na vitrine. As props estão em `COMPONENTIZATION-PLAN.md` §3.

Legenda: **v1** = existe no protótipo, visual idêntico · **v1+** = existe, com estados novos · **novo** = desenhado nesta etapa.

## Tipografia editorial

| Componente | Classe | Arquivo | Status | Variações e regras |
| --- | --- | --- | --- | --- |
| Mega título | `.mega`, `.mega__r`, `--light`, `--wine` | `mega.css` | v1 | 2 linhas, a 2ª alinhada à direita. Uma por seção. `h2` com texto real. Em superfície escura, `--light`. Revelação: `data-reveal="lines"` |
| Scribble | `.scribble`, `--light` | `mega.css` | v1 | Fraunces itálica, −4°, abaixo do mega título. Máximo 6 palavras. Opcional |
| Título do hero | `.hero__headline` (`.l1` `.l2` `.l3`) | `sections/hero.css` | v1 | 3 linhas; `&` em Fraunces. **Sem `aria-label`**: o texto é lido como está |

## Ações

| Componente | Classe | Arquivo | Status | Regras |
| --- | --- | --- | --- | --- |
| Botão | `.btn`, `--butter`, `--wine`, `--block` | `button.css` | v1+ | Manteiga sobre escuro, vinho sobre claro. 54 px de altura, sombra deslocada. `:active` = `scale(.96)`. **Novo:** `:disabled` / `[data-disabled]` (opacidade .55, sombra 2 px). No hero o botão não quebra linha |
| Link de ambiente | `.panel a` | `panel.css` | v1 | Pílula glacê “reservar aqui →”; pré-seleciona o ambiente na comanda |
| Pausar animações | `.motion-toggle` + `[data-motion-toggle]` | `motion-toggle.css`, `lib/motion.js` | novo | Pílula com contorno; `aria-pressed`; troca ícone e texto. No rodapé e na folha do menu |
| Pular para a reserva | `.skip-link` | `base.css` | novo | Aparece só com foco de teclado |

## Comanda (reserva)

| Componente | Classe | Arquivo | Status | Estados |
| --- | --- | --- | --- | --- |
| Comanda | `.ticket`, `__title`, `__slots`, `__note` | `ticket.css` | v1+ | Papel creme picotado. Passos em `fieldset` + `legend` “0n · nome”. **Novo:** `legend[data-done]` ganha ✓; `.ticket__status` (sucesso / `data-tone="error"`), sempre com `role="status"` ou `role="alert"` |
| Carimbo | `.stamp` (+ `.ticket__stamp` para posição) | `ticket.css` | v1+ | `prévia` (tracejado) · `data-state="reservado"` (cheio, vinho) · `data-state="erro"` (“tente de novo”, frutas vermelhas) |
| Chip | `.chip`, `.chips`, `.chips--dates` | `chips.css` | v1+ | Normal · selecionado (`aria-pressed` no v1; **`role="radio"` + `aria-checked` no definitivo**) · `:disabled` (tracejado e riscado: horário esgotado, ambiente indisponível) · `.chip--skeleton` (carregando) |
| Stepper | `.stepper` | `chips.css` | v1+ | 1–20 (o limite real virá da API). **Novo:** botão `:disabled` no limite |
| Campo | `.field`, `__label`, `__input`, `__hint`, `__error` | `field.css` | novo | Normal · foco (sombra deslocada 3 px) · `data-invalid` (borda vinho + mensagem). `textarea` para observações. 16 px de texto |
| Consentimento | `.check` | `field.css` | novo | Caixa de 26 px, alvo de 44 px; marcado = vinho com ✓ manteiga. Texto LGPD **a definir** |

## Colagem e papel

| Componente | Classe | Arquivo | Status | Regras |
| --- | --- | --- | --- | --- |
| Etiqueta recortada | `.label` | `label.css` | v1 | Creme, borda de ondas na base. Só segura o **logo oficial** (sem recolorir) |
| Recorte | `.cut--circle`, `--polaroid`, `--tile` | `cut.css` | v1 | Círculo (borda manteiga 6, −10°), polaroide (glacê, legenda Fraunces, +6°), ladrilho (raio 18, borda creme 5, −4°). Medidas em `--u` |
| Foto emoldurada + fita | `.board__item`, `.tape`, `.tape--r` | `framed.css` | v1 | Moldura glacê de 7 px, fita manteiga translúcida ±5–8° |
| Nota + seta | `.note`, `.arrow` | `note.css` | v1 | Fraunces 19 px; seta vinho de traço 3,2 desenhado à mão. `data-draw` desenha o traço |
| Selo com texto em círculo | `.sticker--roll` | `sticker.css` | v1 | Texto gira em 24 s (para com a pausa e com movimento reduzido) |
| Selo simples | `.badge` | `sticker.css` | v1 | Logo da Roll em círculo creme, −8°. A Roll aparece **sempre sobre creme** |
| Faíscas, espiral | `.sparks`, `.spiral`, `.roll__spiral` | `ornament.css` | v1 | Sempre `aria-hidden`. Redesenhos inline de CR-15…18 |
| Faixa | `.ticker` | `ticker.css` | v1 | Cacau, −2,5°, loop de 32 s, costura o hero à seção seguinte |
| Pílulas do cardápio | `.bands` | `bands.css` | v1 | Pares de cor fixos (TOKENS §1); rotação ±1,5° alternada |
| Painel diagonal | `.panel--day`, `--amber`, `.tagline` | `panel.css` | v1 | Dois painéis encaixados pela diagonal de 16% |
| Bolha | `.bubble` | `bubble.css` | v1 | Foto circular com borda manteiga e legenda em pílula cacau |
| Avisos de procedência | `.notice`, `.ref-note`, `--on-light` | `notice.css` | v1 | **Obrigatórios** enquanto houver foto do espaço anterior |

## Mídia

| Componente | Classe | Arquivo | Status | Regras |
| --- | --- | --- | --- | --- |
| Story (vídeo vertical) | `.stories`, `.story`, `.story__tag` | `story.css`, `lib/videos.js` | v1+ | 9:16, raio 26, contorno caramelo (o 2º em manteiga, 44 px mais baixo). **Novos:** `.story__by` (crédito: quem gravou + “vídeo da própria Roll” ou “@criadora sobre a Roll”), `.story__progress`, `.story__toggle` (tocar/pausar). Um vídeo por vez. Só renderiza com `autorizado: true` |

## Navegação

| Componente | Classe | Arquivo | Status | Regras |
| --- | --- | --- | --- | --- |
| CTA fixo | `.sticky-cta` | `sticky-cta.css`, `lib/sticky-cta.js` | v1+ | Visual idêntico ao v1. Regra de visibilidade nova (ver [`NAVEGACAO-E-CTA.md`](NAVEGACAO-E-CTA.md)). Oculto = sem clique |
| Menu no hero | `.menu-btn--hero` | `menu.css` | novo | Selo manteiga de 44 px colado na ponta da etiqueta, +8° |
| Menu na doca | `.menu-btn--dock` | `menu.css` | novo | Quadrado creme de 58 px à esquerda do CTA; aparece quando o selo do hero sai da tela |
| Folha do menu | `.sheet` (`<dialog>`) | `menu.css`, `lib/nav-sheet.js` | novo | Sobe da base, borda recortada no topo, itens numerados “01…04” como os passos da comanda, alinhamento alternado como os mega títulos. Botão vinho “Reservar mesa” é o único botão cheio |

## Componentes previstos (desenhar na implementação, com estes mesmos tokens)

| Componente | Seção | Base |
| --- | --- | --- |
| Placa de endereço | 9 · Visite | `.label` + Fraunces |
| Comanda de horários | 9 · Visite | `.ticket` sem picote no rodapé |
| Mural de polaroides | 7 · Na mesa (condicional) | `.cut--polaroid` em grade solta |
| Carimbo “novo capítulo” | 3 · Novo capítulo | `.stamp` grande |

## Acessibilidade (todas as peças)

- Alvos de toque ≥ 44 px (botões 54, chips 46, datas 62, stepper 46, menu 44/58).
- Foco visível em todas as superfícies (`--focus-ring`); destinos de âncora usam `tabindex="-1"` sem anel.
- Ornamentos, fitas, setas e faixa: `aria-hidden="true"`.
- Toda mudança de estado da comanda é anunciada por texto (`aria-live`), não só por cor ou movimento.
