# Auditoria do design system implementado

> **Data:** 2026-10-16 · **Base:** commit `35feae3` (site Astro da Etapa 4).
> **Método:** leitura automática de todo o CSS (`src/styles/**`, 35 arquivos, 1.616 declarações) e do markup (`src/**`), mais medição dos
> valores **calculados pelo navegador** (Chromium) no site real em 360, 390, 430, 768 e 1440 px. Nenhum valor desta documentação
> foi estimado: tudo vem do código ou da medição. Os scripts de auditoria estão descritos no §6.
> **Escopo:** só documentação. Nada foi refatorado, e o visual não mudou.

## 1. Resumo

| Área | Situação | Números |
| --- | --- | --- |
| Cores | **padronizada** | 11 primitivos + 11 papéis em `tokens.css`; 6 cores literais fora dos tokens (todas em componentes novos) |
| Tipografia | **parcialmente padronizada** | 23 papéis tokenizados (`--t-*`) + 5 tamanhos (`--fs-*`); **31 declarações de fonte fora dos tokens** (papéis novos da Etapa 4) |
| Espaçamento | **não padronizado** | escala `--space-*` definida e **nunca usada**; **125 valores literais** em `padding`/`margin`/`gap` |
| Raios, bordas, sombras | **padronizados**, com lacunas | `50%` repetido 9× sem token; 4 sombras e 3 bordas literais |
| Movimento | **padronizado**, com lacunas | 15 tokens; **22 durações/atrasos literais** (sequência do hero e valores do v1) |
| Camadas (`z-index`) | **parcial** | 3 tokens globais; 25 valores locais (1–6) sem escala |
| Breakpoints | **mínimo** | 1 breakpoint de layout (960 px) + 2 ajustes (≤374 px, altura ≤700 px); **tablet não desenhado** |
| Componentes | **implementados** | 12 componentes Astro, 9 seções Astro, 1 ilha Preact; 21 arquivos de CSS de componente e 10 de seção |
| Tokens sem uso | 13 | `--space-1…10`, `--text-on-dark`, `--border-tile`, `--dur-xl` |

## 2. O que está implementado e consistente

- **Paleta** de 11 cores com os mesmos nomes do protótipo aprovado; todo uso de cor nas seções passa por token (exceto §3.6).
- **Papéis tipográficos** do protótipo (`--t-hero`, `--t-mega`, botões, chips, legendas, Fraunces) com valores idênticos ao v1, verificados pelo teste de fidelidade (estilos calculados iguais nas 7 seções do v1).
- **Eixos da fonte variável** via `font-stretch` (`--stretch-*`) e `opsz` via `font-variation-settings`.
- **Raios** nomeados (9 tokens), **sombras** (10 tokens, com a sombra deslocada como assinatura), **máscaras** (3) e **grão**.
- **Unidade do protótipo** `--u` para os palcos de colagem (hero e quadro da Mesa).
- **Movimento**: 4 curvas, 6 durações, `--stagger`, `--lift`, `--tilt`, períodos dos loops; regra de “uma propriedade por responsabilidade”; movimento reduzido e pausa global.
- **Acessibilidade**: anel de foco por superfície, alvos ≥ 44 px, `aria-*` nos componentes interativos (verificado pelo axe: 0 violações graves).

## 3. O que precisa ser padronizado (inconsistências encontradas)

Numeradas para referência na refatoração. **Nenhuma muda o visual se corrigida como proposto em [`PROPOSTA-TOKENS-CSS.md`](PROPOSTA-TOKENS-CSS.md).**

### Tokens

| # | Inconsistência | Onde | Proposta |
| --- | --- | --- | --- |
| I-01 | Escala `--space-1…10` (4, 8, 12, 16, 20, 24, 32, 40, 48, 64) definida e **nunca usada**. O site usa outra escala, de fato: 6, 8, 10, 12, 14, 16, 18, 22, 26, 30, 34, 40, 44 (frequência em [`LAYOUT-AND-GRID.md`](LAYOUT-AND-GRID.md) §3) | `tokens.css` × 125 literais | substituir pela escala real (`--s-6` … `--s-44`) |
| I-02 | Tokens sem uso: `--text-on-dark`, `--border-tile` (o ladrilho calcula `5 * --u`), `--dur-xl` | `tokens.css` | remover ou passar a usar |
| I-03 | Os tokens `--wdth-*` não contêm mais `wdth` (desde a correção do WebKit): `--wdth-mega` = `"opsz" 96`, os demais = `normal` | `tokens.css` | renomear para `--fvs-*` |
| I-04 | **31 declarações de fonte** fora dos tokens `--t-*`: folha do menu (44 px), placa de endereço (26 px), campo (16 px/700), mensagens de status (14 px), revisão (16 px), aviso de simulação (12,5 px/800), crédito de vídeo (12,5 px/700), botões do stepper (22 px), links de texto (14 px, 3×), chamada da Roll (22 px), carimbo do Novo capítulo (16 px), marcador de pendência (12/10,5 px) e outros | componentes e seções novos | 9 novos papéis em [`TYPOGRAPHY.md`](TYPOGRAPHY.md) §8 |
| I-05 | `letter-spacing: .02em` repetido 5× sem token; `.06em`, `.08em`, `.12em` pontuais | faixa, pílulas, selo, crédito, pendência | `--track-tight-caps: .02em`; demais viram parte do papel |
| I-06 | 6 cores literais: `#000` (fundo do vídeo), tinta 72% e 62% (crédito e botão do vídeo), glacê 35% (trilho do progresso), frutas vermelhas 8% (listras da simulação), pretos 18%/50% (pino da placa) | `story.css`, `ticket.css`, `visite.css` | 4 papéis novos (`--overlay-ink`, `--overlay-ink-soft`, `--track-light`, `--sim-stripe`) |
| I-07 | `border-radius: 50%` em 9 componentes sem token; checkbox com `8px` literal (= `--radius-xs`); trilho do progresso `3px` | vários | `--radius-round: 50%`; usar `--radius-xs` |
| I-08 | Sombras literais: anel do story (`0 0 0 4px`), erro de campo (`inset 0 0 0 1px`) 2×, pulo do botão (`6px 6px 0`), pino da placa | `story.css`, `field.css`, `ticket.css`, `motion.css`, `visite.css` | `--ring-media`, `--ring-invalid`, `--shadow-offset-l` |
| I-09 | **22 durações e atrasos literais**: `.3s` (botão), `.5s`/`.3s` (CTA fixo, herdados do v1), `.2s` (chips), `1.6s` (brilho do esqueleto e carimbo girando), `520/360/300 ms` e 8 atrasos da entrada do hero, `150 ms` (movimento reduzido), `120/200/260 ms` (atrasos de revelação), `80 ms` (folha do menu) | `button`, `chips`, `sticky-cta`, `ticket`, `menu`, `motion.css` | tokens `--dur-press`, `--dur-cta`, `--dur-loop-busy` e uma **tabela de coreografia** do hero em variáveis (`--t-hero-*`) |
| I-10 | `z-index` local sem escala: 1–6 em colagens, 5 no rodapé do hero, 6 no selo do menu | colagens, hero, menu | escala local `--z-1…6` documentada (camadas de papel) |

### Arquitetura do CSS

| # | Inconsistência | Onde | Proposta |
| --- | --- | --- | --- |
| I-11 | A seção Visite **repete** a regra do grão e do anel de foco em vez de usar `.surface-grain`/`.surface-dark` | `sections/visite.css` | adicionar `.visite` às listas de `base.css` (ou classe utilitária no markup) |
| I-12 | **Quatro larguras de container** no desktop, declaradas por seção: 900 (bandejas), 980 (quadro, faixas, reserva, Novo capítulo, Visite), 1100 (ambientes), 1240 (Mesa e cabeçalho da Roll) | seções, `@media (min-width: 960px)` | tokens `--container-s/m/l/xl` |
| I-13 | Estilos inline na ilha da reserva (`margin-top:10px` 2×, `display:block`) | `ReservaFlow.tsx` | classes `.ticket__slots--after`, `.field__error--block` |
| I-14 | Comentário do carimbo diz “gira 30°”; o código gira **18°** | `motion.css` l. 36–37 | corrigir o comentário (o valor 18° é o aprovado em tela) |
| I-15 | Ritmo vertical: a seção Novo capítulo usa **132 px** no topo (para o carimbo) e 94 px na base — fora da regra “base = topo + 8” das outras seções | `novo-capitulo.css` | documentar como exceção (ou `--rhythm-e`) |

### Responsividade e acessibilidade

| # | Inconsistência | Proposta |
| --- | --- | --- |
| I-16 | **Tablet (600–959 px) não desenhado**: margem continua 16 px; o mega título chega a **192 px** em 768 px; o hero vira o mobile ampliado | etapa própria (P2 do plano), com breakpoint 600 px |
| I-17 | Nota de foto antiga cai para **11,5 px** abaixo de 375 px; legenda da polaroide cai até **12,4 px** em 360 px — abaixo do mínimo de 12 px documentado para a nota | aceitar como texto decorativo ou fixar `max(12px, …)` |
| I-18 | Botão desabilitado (“Reservas online em breve”): **3,15:1**. Controles inativos são isentos pela WCAG, mas a mensagem é informativa (a nota abaixo repete a informação, 5,19:1) | manter a nota; avaliar contraste maior no estado “em breve” |
| I-19 | Crédito do vídeo em Fraunces caramelo claro sobre a faixa translúcida: **3,81:1 no pior caso** (vídeo muito claro, 12 px) | faixa mais opaca (tinta 80%) ou texto creme |
| I-20 | Fonte de reserva da Bricolage (`"Arial Narrow"`) não existe no Android; antes da fonte carregar, o texto usa `system-ui` sem ajuste de métricas | `@font-face` de fallback com `size-adjust` (opcional; as fontes têm preload e CLS medido = 0) |

### Documentação

| # | Inconsistência | Proposta |
| --- | --- | --- |
| I-21 | Os documentos v1.0 em `docs/design/design-system/` têm trechos desatualizados (ex.: tokens `--wdth-*` com `wdth`; escala `--space-*` como “escala base”) | **esta documentação passa a ser a referência**; os v1.0 ficam como histórico |
| I-22 | Componentes de **revisão** (marcador “a confirmar”, faixa “Revisão”) vivem junto do design system | documentados à parte: não são parte da identidade e não vão para produção |

## 4. Componentes de revisão × componentes do produto

| Só no build de revisão (não fazem parte do design system) | Motivo |
| --- | --- |
| `.pending`, `.pending--block` (`Pendente.astro`) | marcar conteúdo que falta |
| `.review-flag` | indicar que a página é de revisão |
| `.ticket__sim` | só aparece no modo simulado (testes) |

## 5. Prioridade sugerida para a refatoração

1. **Sem risco visual, alto ganho:** I-01, I-03, I-04, I-05, I-06, I-07, I-08, I-09, I-12 (centralizar valores em tokens com os **mesmos valores**). Verificação: teste de fidelidade (estilos calculados idênticos) + regressão visual.
2. **Limpeza:** I-02, I-10, I-11, I-13, I-14, I-21.
3. **Decisões de design (precisam de aprovação):** I-15, I-16, I-17, I-18, I-19, I-20.

## 6. Como esta auditoria foi feita (reprodutível)

- **Leitura do CSS:** um script percorre `src/styles/**/*.css`, separa cada declaração (arquivo, media query, seletor, propriedade, valor), lista os tokens de `tokens.css`, conta `var(--token)` no CSS e no markup, e agrupa valores literais por categoria (cores, fontes, tracking, raios, sombras, bordas, durações, `z-index`, rotações, espaçamentos).
- **Medição:** Playwright abre o site (build de revisão) em 360×740, 390×844, 430×932, 768×1024 e 1440×900 e lê `getComputedStyle` de 41 papéis tipográficos e das 9 seções.
- **Contraste:** fórmula WCAG 2.2 sobre os HEX dos tokens (e misturas, para cores com transparência).
- Os scripts ficaram fora do repositório (foram ferramentas desta auditoria); a proposta da página de documentação ([`PROPOSTA-PAGINA-DOCUMENTACAO.md`](PROPOSTA-PAGINA-DOCUMENTACAO.md)) inclui transformar essa leitura num teste permanente.

## 7. Situação após a implementação (2026-10-16)

| # | Situação | Como |
| --- | --- | --- |
| I-01 | resolvido | escala real `--s-6` … `--s-44` (inclui 24, que aparece 6×); 134 espaçamentos trocados; `--space-*` removidos |
| I-02 | resolvido | `--text-on-dark`, `--border-tile`, `--dur-xl` removidos; o teste de contrato falha se um token ficar sem uso |
| I-03 | resolvido | `--wdth-*` → `--fvs-display` / `--fvs-text` |
| I-04, I-05 | resolvido | 19 papéis tipográficos e 4 trackings novos, com os mesmos valores |
| I-06 a I-08 | resolvido | `--overlay-ink(-soft)`, `--track-light`, `--sim-stripe`, `--media-bg`, `--radius-round`, `--radius-track`, `--ring-media`, `--ring-invalid`, `--shadow-offset-l`, `--shadow-pin` |
| I-09 | resolvido | durações nomeadas e a coreografia do hero em `--hero-t-*` |
| I-10, I-12 | resolvido | `--z-1…6`; `--container-s/m/l/xl` |
| I-11 | resolvido | `.visite` usa o grão e o anel de foco de `base.css` |
| I-13 | resolvido | classes `.ticket__slots--after` e `.field__error--block` |
| I-14 | resolvido | comentário corrigido (18°) |
| I-15 | resolvido (documentado) | exceção do Novo capítulo em tokens: `--rhythm-novo-top` (132) e `--rhythm-novo-bottom` (94) |
| I-16 | resolvido | tablet 600–959 (desvio D16); mobile e desktop sem mudança |
| I-17 | resolvido | nota de foto antiga e legenda da polaroide com mínimo de 12 px (`--fs-micro`) |
| I-18 | resolvido | botão indisponível tracejado, texto vinho sobre creme 11:1 (antes 3,15:1) |
| I-19 | resolvido | faixa do crédito a 80%: pior caso 5,08:1 (antes 3,81:1) |
| I-20 | resolvido | `@font-face` de reserva com `size-adjust` e métricas medidas (Arial/Roboto e Georgia) |
| I-21 | resolvido | v1.0 marcada como histórico |
| I-22 | resolvido | componentes de revisão separados; a página `/design-system/` os rotula como “só revisão” |

**Verificação.** Referência capturada antes da refatoração (`scripts/regressao-visual.mjs`): página inteira de `/`, `/reservar/` e
`/privacidade/` em 360, 375, 390, 430, 768 e 1440 px, Chromium e WebKit, mais estilos calculados de todos os elementos e os estados da
interface (`scripts/shots-estados.mjs`). Duas capturas seguidas dão 0 px (determinístico).
- Refatoração (tokens, camadas, componentes `Seta`, `Faiscas`, `Ticker`, ilha): **0 px e 0 estilos diferentes** em todas as 36 capturas.
- Correções I-16 a I-20: mudam **só** a faixa do crédito, o botão indisponível, a nota de 12 px (360 px), a legenda da polaroide (375 × 667),
  o tablet (768) e o nome das famílias (fontes de reserva).
- Fidelidade ao protótipo v1: 7/7 (o teste ignora os nomes das fontes de reserva, que não mudam a fonte renderizada).
- Contrato dos tokens (`tests/tokens.spec.ts`): sem cor, tamanho de fonte ou duração literal fora de `tokens/`; todo token usado.
