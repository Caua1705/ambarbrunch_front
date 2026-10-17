# Design System — Âmbar Brunch · Fornada Âmbar

> **Referência principal** do design system do Âmbar Brunch (Conceito B · Fornada Âmbar, aprovado em 2026-10-16).
> **Versão:** 1.1 — formalizada a partir do **código real** do site (commit `35feae3`) e de medições no navegador, em 2026-10-16.
> **Situação:** documentação completa + auditoria. Os tokens ainda **não** foram refatorados: a proposta aguarda autorização.
> O visual aprovado não muda com esta documentação.

## 1. O que é

O design system descreve, com valores reais, a identidade que já está no ar no site local: **papel recortado sobre uma mesa de brunch** — etiqueta, polaroide, comanda, fita, selo e carimbo —, tipografia condensada usada como imagem, a paleta do logo (vinho e creme) aquecida por manteiga, cacau e caramelo, e um movimento discreto de objetos que assentam.

**Fontes da verdade (nesta ordem):**
1. código: `src/styles/tokens.css` → `base.css` → `components/` → `sections/` → `motion.css`; `src/components/`, `src/sections/`, `src/islands/`, `src/lib/`;
2. este conjunto de documentos;
3. o protótipo congelado `experiments/concept-b-aprovado-v1/` (referência de fidelidade, verificada por teste automático).

## 2. Princípios

1. **Mobile é o produto.** Desenho em 390 × 844; 360–430 e telas baixas validados; o desktop reaproveita, nunca dita.
2. **Papel sobre mesa.** Tudo é objeto físico; sombras deslocadas e sólidas, não difusas; sem vidro, gradiente ou 3D.
3. **Tipografia como imagem.** O mega título ocupa a largura e faz parte da composição.
4. **Âmbar é o destino; a Roll, a assinatura.** A Roll aparece em selos e na seção Fornadas; nunca como marca principal; nada de loja.
5. **Reservar a um toque, com uma mão.** O botão do hero está sempre na 1ª tela; depois, a doca (menu + “Reservar mesa”).
6. **Verdade antes de efeito.** Foto antiga com aviso; vídeo com crédito; conteúdo pendente nunca simulado; reserva não ativa não finge funcionar.
7. **Movimento com motivo.** Títulos, peças e elementos fixos; nunca o texto; nunca segurando o scroll; movimento reduzido e pausa respeitados.

## 3. Documentos

| Documento | Conteúdo |
| --- | --- |
| [`TYPOGRAPHY.md`](TYPOGRAPHY.md) | famílias e arquivos, pesos, escala medida (360–1440), entrelinha, tracking, hierarquia, quebra de linha |
| [`COLORS-AND-TOKENS.md`](COLORS-AND-TOKENS.md) | paleta HEX/RGB, tokens semânticos, superfícies, CTAs, contrastes, **inventário completo dos 133 tokens** |
| [`LAYOUT-AND-GRID.md`](LAYOUT-AND-GRID.md) | grid, containers, escala de espaço real, ritmo de seção, breakpoints, raios/bordas/sombras, camadas |
| [`COMPONENT-LIBRARY.md`](COMPONENT-LIBRARY.md) | inventário dos componentes reutilizáveis e das composições artísticas, com estrutura, variantes, estados e comportamento |
| [`MOTION-SYSTEM.md`](MOTION-SYSTEM.md) | tokens, primitivas, coreografias com tempos exatos, estados, microinterações, performance, movimento reduzido |
| [`VISUAL-GUIDELINES.md`](VISUAL-GUIDELINES.md) | logos, fotografia, proporções, sobreposição, ornamentos, texturas, materiais oficiais × reais × conceitos |
| [`AUDITORIA-DESIGN-SYSTEM.md`](AUDITORIA-DESIGN-SYSTEM.md) | o que está implementado e o que falta padronizar (I-01 a I-22) |
| [`PROPOSTA-TOKENS-CSS.md`](PROPOSTA-TOKENS-CSS.md) | centralização dos tokens, sem mudança visual (aguarda autorização) |
| [`PROPOSTA-PAGINA-DOCUMENTACAO.md`](PROPOSTA-PAGINA-DOCUMENTACAO.md) | página interna para inspecionar componentes e estados (não implementada) |

Contexto e histórico (preservados): [`CONCEITO-B-APROVADO.md`](CONCEITO-B-APROVADO.md) · [`HOMEPAGE-STORYBOARD.md`](HOMEPAGE-STORYBOARD.md) · [`MOTION-PLAN.md`](MOTION-PLAN.md) (coreografia pretendida) · [`COMPONENTIZATION-PLAN.md`](COMPONENTIZATION-PLAN.md) · [`design-system/`](design-system/README.md) (v1.0 da Etapa 3). **Em caso de divergência, valem os documentos desta lista** (auditoria I-21).

## 4. Referência rápida

### Cores

| | | | | | |
| --- | --- | --- | --- | --- | --- |
| `--wine` `#670D27` | `--cream` `#F4EEE3` | `--butter` `#F3DDAE` | `--cacao` `#3A2218` | `--ink` `#24150F` | `--glaze` `#FFFBF4` |
| `--caramel` `#C98A45` | `--caramel-lt` `#E7B676` | `--caramel-dk` `#9A5F25` | `--berry` `#A8203A` | `--leaf` `#3D5A3E` | |

### Tipografia

Bricolage Grotesque (400 · 700 · 800; largura 75–100%) para títulos, interface e texto · Fraunces itálica (400 · 500 · 600) para a voz manuscrita.
Hero `clamp(70px, min(21.5vw, 11svh), 168px)/.8` · mega `clamp(78px, 25vw, 200px)/.8` · botão 16 · chip 15 · corpo 16/1.5 · legenda de passo 12,5 (+.14em) · scribble 24.

### Forma

Gutter 16 px (56 no desktop) · raios 14 (controles), 16 (botão), 18 (CTA/ladrilho), 26 (mídia), pílula · **sombra deslocada `4px 4px 0` cacau** (assinatura) · grão só no escuro · borda recortada e picote como máscaras.

### Movimento

`--ease` `cubic-bezier(.2,.7,.2,1)` · `--ease-paper` `cubic-bezier(.34,1.4,.64,1)` · 120 / 220 / 420 / 640 / 700 ms · intervalo 70 ms · entrada do hero em ~1,16 s · parallax nativo ±6–24 px.

## 5. Estado da padronização

| Área | Implementado | A padronizar |
| --- | --- | --- |
| Cores | 22 tokens; todo uso em seções via token | 6 literais em componentes novos (I-06) |
| Tipografia | 23 papéis (`--t-*`) + 5 tamanhos; eixos via `font-stretch` | 31 declarações fora dos papéis (I-04); nome legado `--wdth-*` (I-03) |
| Espaço | gutter e ritmo de seção | escala declarada nunca usada; 125 literais (I-01) |
| Forma | raios, sombras, máscaras | `50%` e 4 sombras literais (I-07, I-08) |
| Movimento | 15 tokens, primitivas, reduzido e pausa | 22 durações literais (I-09) |
| Layout | breakpoint 960, palcos `--u`, ajuste por altura | 4 containers soltos (I-12); tablet não desenhado (I-16) |

Detalhes e prioridades: [`AUDITORIA-DESIGN-SYSTEM.md`](AUDITORIA-DESIGN-SYSTEM.md).

## 6. Como estender sem sair da identidade

**Seção nova:** mega título (`MegaTitle`) + **uma** composição montada com as peças da biblioteca + uma saída para a reserva; fundo diferente das vizinhas; ritmo `--rhythm-*` (base = topo + 8).

**Componente novo — checklist:**
- só tokens (nenhum HEX, px de fonte ou duração solta);
- forma no componente, posição na seção;
- estados: normal, foco, pressionado, desabilitado/indisponível, carregando e erro, quando fizerem sentido;
- alvo de toque ≥ 44 px; anel de foco por superfície; `aria-*`;
- movimento: escolher uma primitiva existente; comportamento definido para movimento reduzido e pausa;
- testes: estilos calculados (fidelidade, quando vier do v1), e2e em Chromium e WebKit, axe sem violações graves;
- entrada nesta documentação e na página de documentação (quando existir).

## 7. Desvios aprovados em relação ao protótipo

| # | Desvio | Motivo |
| --- | --- | --- |
| D1 | Colagem do hero encolhe pela altura da tela | botão de reserva na 1ª tela |
| D2 | Botão do hero nunca quebra linha | no v1 quebrava em 360 px |
| D3 | Hero e quadro escalam com `--u` | colagens em px fixos não escalavam |
| D4 | Anel de foco vinho/manteiga | caramelo dava 2,19:1 |
| D5 | CTA fixo observa o botão do hero; some com teclado e menu; oculto sem toque | telas baixas e acessibilidade |
| D6 | Menu: selo no hero, doca, folha | decisão “com menu” |
| D7 | Vídeos: um por vez, crédito, progresso, tocar/pausar | WCAG 2.2.2 e identificação |
| D8 | Pausa global de animações | WCAG 2.2.2 |
| D9 | Título do hero sem `aria-label` | leitura confiável |
| D10 | Saída do CTA mais rápida (220 ms) | não atrapalhar quem rola |
| D11 | Estados novos da comanda; carimbo com `text-align: center` | fluxo real de reserva |
| D12 | Largura variável via `font-stretch` | WebKit encavalava as letras |
| D13 | Título e etiqueta do hero limitados pela altura; respiros menores abaixo de 700 px | colagem maior em telas baixas |
| D14 | Doca inteira some na seção de reserva | o menu fixo cobria o aceite de privacidade |

## 8. Registro de decisões

| Data | Decisão | Aprovado por |
| --- | --- | --- |
| 2026-10-16 | Conceito B como identidade; protótipo congelado | cliente |
| 2026-10-16 | Design system v1.0 e plano de implementação | cliente |
| 2026-10-16 | Implementação em Astro (Etapa 4), desvios D12–D14 | cliente (“resultado visual aprovado”) |
| 2026-10-16 | Formalização v1.1 (esta), refatoração de tokens, correções I-15 a I-20 e página visual `/design-system/` | cliente |
