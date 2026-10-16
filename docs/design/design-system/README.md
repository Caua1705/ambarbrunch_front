# Design System — Fornada Âmbar (Conceito B)

> **Situação:** v1.0 extraída do protótipo aprovado (2026-10-16), **aguardando revisão** antes da construção final.
> Nada foi instalado, publicado ou conectado a backend. O protótipo aprovado (`experiments/concept-b-aprovado-v1/`) continua intacto (SHA-256 conferido).

O design system **não é uma releitura** do protótipo B: é o código do próprio protótipo, separado em tokens, componentes e seções, mais o que faltava para o site (menu, estados da reserva, campos, controles de vídeo, pausa de animações).

## Prova de fidelidade

A página `experiments/design-system/paridade-v1.html` usa o **markup do v1** com o **CSS e o JS do design system**. O teste compara cada seção com o v1 congelado, pixel a pixel (Edge, DPR 2, movimento reduzido):

| Seção | 390 × 844 |
| --- | --- |
| Hero | **0 px diferentes** |
| Faixa | **0** |
| Mesa cheia | **0** |
| Fornadas | **0** |
| Escolha o clima | **0** |
| Reserva | **0** |
| Rodapé | **0** |

Nas outras larguras, as diferenças são as **melhorias aprovadas**: o hero e o quadro escalam proporcionalmente, e o botão de reserva cabe na primeira tela. As diferenças pequenas nas seções seguintes são só o deslocamento vertical que isso causa.

```bash
node experiments/serve.mjs                          # terminal 1
node experiments/design-system/tools/parity.mjs     # terminal 2 → experiments/screenshots/paridade/
```

## Documentos

| Documento | Conteúdo |
| --- | --- |
| [`TOKENS.md`](TOKENS.md) | cores e contraste, tipografia, espaço e ritmo, raios, bordas, sombras, máscaras |
| [`COMPONENTES.md`](COMPONENTES.md) | catálogo: origem no v1, arquivo, estados, regras e acessibilidade |
| [`COMPOSICAO.md`](COMPOSICAO.md) | regras de colagem, ritmo de cor, transições, receitas de seção, fotografia |
| [`RESPONSIVIDADE.md`](RESPONSIVIDADE.md) | mobile-first, unidade do protótipo `--u`, hero que cabe na tela |
| [`MOTION.md`](MOTION.md) | tokens e primitivas de movimento, reduzido e pausa |
| [`NAVEGACAO-E-CTA.md`](NAVEGACAO-E-CTA.md) | menu discreto, doca e regras do CTA fixo |
| [`MIDIA.md`](MIDIA.md) | imagens, vídeos, fontes, procedência e orçamento |

Contexto: [`../CONCEITO-B-APROVADO.md`](../CONCEITO-B-APROVADO.md) · [`../HOMEPAGE-STORYBOARD.md`](../HOMEPAGE-STORYBOARD.md) · [`../MOTION-PLAN.md`](../MOTION-PLAN.md) · [`../COMPONENTIZATION-PLAN.md`](../COMPONENTIZATION-PLAN.md) · plano de implementação: [`../../technical/PLANO-IMPLEMENTACAO.md`](../../technical/PLANO-IMPLEMENTACAO.md).

## Arquivos

```text
src/styles/
  tokens.css   base.css   motion.css   index.css (ordem da cascata do v1)
  components/  mega · button · label · cut · sticker · ornament · ticker · framed · note · bands
               story · panel · bubble · notice · ticket · chips · field · sticky-cta · menu · motion-toggle
  sections/    hero · mesa · roll · climas · reserva · footer
src/lib/       motion.js · sticky-cta.js · nav-sheet.js · videos.js · comanda-preview.js · index.js
experiments/design-system/
  index.html           vitrine (tokens e todos os componentes, com estados)
  paridade-v1.html     markup do v1 + design system (teste de fidelidade)
  preview.html         homepage atual + menu, doca, folha, controles de vídeo e movimento
  tools/parity.mjs     teste de paridade (sem dependências)
```

O JS soma **4,8 KB com gzip** (6 módulos, sem dependências). Os arquivos são CSS e JS puros: o Astro importa como estão, sem conversão.

## Desvios aprovados em relação ao v1

Toda diferença visual ou de comportamento em relação ao protótipo está aqui.

| # | Desvio | Onde aparece | Motivo |
| --- | --- | --- | --- |
| D1 | Colagem do hero encolhe pela altura da tela | < 390 × 844 | botão de reserva na 1ª tela (storyboard aprovado) |
| D2 | Botão do hero nunca quebra linha | < 375 px | no v1 quebrava em 2 linhas em 360 px |
| D3 | Hero e quadro escalam com `--u` | ≠ 390 px | colagens em px fixos não escalavam |
| D4 | Anel de foco vinho/manteiga | foco de teclado | caramelo dava 2,19:1 |
| D5 | CTA fixo observa o botão do hero; some com teclado e menu; oculto não recebe toque | comportamento | telas baixas e acessibilidade |
| D6 | Menu: selo no hero, doca, folha | novo | decisão “com menu” |
| D7 | Vídeos: um por vez, crédito, progresso, tocar/pausar | Fornadas | WCAG 2.2.2 e identificação correta |
| D8 | Pausa global de animações | rodapé, folha | WCAG 2.2.2 |
| D9 | Título do hero sem `aria-label` | leitor de tela | `aria-label` em `<p>` não é lido de forma confiável |
| D10 | Saídas do CTA mais rápidas (220 ms) | comportamento | não atrapalhar quem rola |
| D11 | Estados novos: chip indisponível e carregando, stepper no limite, campos, carimbo, mensagens | comanda | fluxo real de reserva |

## Registro de decisões

| Data | Decisão | Aprovado por |
| --- | --- | --- |
| 2026-10-16 | Conceito B aprovado como identidade visual; protótipo congelado em `concept-b-aprovado-v1/` | cliente |
| 2026-10-16 | Ordem das seções; Roll + vídeos juntos; avaliações só reais e autorizadas | cliente |
| 2026-10-16 | Este é o site de reservas de 22/10; reserva só conta como pronta com integração e testes reais | cliente |
| 2026-10-16 | Com menu, discreto; Reservar é a ação principal | cliente |
| 2026-10-16 | Astro + CSS próprio + Preact só na reserva | cliente (planejamento) |
| 2026-10-16 | Design system v1.0 (este documento) | **aguardando revisão** |
