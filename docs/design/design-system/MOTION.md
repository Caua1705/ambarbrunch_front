# Movimento — Fornada Âmbar

> Implementado em [`src/styles/motion.css`](../../../src/styles/motion.css) e [`src/lib/motion.js`](../../../src/lib/motion.js).
> A coreografia completa, seção por seção, continua em [`../MOTION-PLAN.md`](../MOTION-PLAN.md). Este documento é o **sistema**:
> tokens, primitivas e regras que qualquer seção usa.

## 0. Princípios

1. **Papel, não tela:** peças assentam, fitas esticam, carimbos batem. Sem brilho, desfoque ou 3D.
2. **O scroll é do visitante:** sem scroll-jacking, sem *smooth scroll* por JS, sem seções presas.
3. **Conteúdo não espera:** texto e botões são legíveis e clicáveis desde o primeiro quadro. O título do hero (LCP) **não** anima opacidade.
4. **Uma vez só:** cada entrada toca uma vez por visita.
5. **Sem biblioteca:** CSS, Web Animations e `IntersectionObserver`. Zero KB de dependências de animação.

## 1. Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| `--dur-xs` | 120 ms | press de botão e chip |
| `--dur-s` | 220 ms | saídas, troca de estado |
| `--dur-m` | 420 ms | entrada da doca e da folha, traço desenhado |
| `--dur-l` | 640 ms | peças de colagem, linhas de título |
| `--dur-reveal` | 700 ms | revelação simples (v1) |
| `--dur-xl` | 900 ms | teto da sequência do hero |
| `--ease` / `--ease-out` | `cubic-bezier(.2, .7, .2, 1)` | padrão (v1) |
| `--ease-paper` | `cubic-bezier(.34, 1.4, .64, 1)` | assentar com leve *overshoot* |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | saídas |
| `--stagger` | 70 ms | entre peças e linhas |
| `--lift` / `--tilt` | 28 px / 5° | deslocamento e rotação extra de entrada |
| `--spin-period` / `--ticker-period` | 24 s / 32 s | selo da Roll / faixa |

## 2. Uma propriedade por responsabilidade

Para os efeitos nunca brigarem entre si:

| Propriedade CSS | Quem usa |
| --- | --- |
| `rotate` | composição estática (a inclinação de cada peça) |
| `translate` | revelação simples e parallax |
| `transform` | montagem de peças, press, entradas do hero, folha |
| `scale` | microinterações (chip) |
| `opacity` | revelações e saídas |

Um elemento com parallax usa `data-reveal="fade"` (só opacidade), porque o parallax é dono do `translate`.

## 3. Primitivas (atributos)

| Atributo | Efeito | Onde |
| --- | --- | --- |
| `data-reveal` | opacidade + 30 px, 700 ms (v1) | qualquer bloco |
| `data-reveal="fade"` | só opacidade | peças com parallax |
| `data-reveal="piece"` (+ `style="--i:n"`) | peça sobe 28 px, gira +5° e assenta com *overshoot*; atraso `n × 70 ms` | fotos de colagem |
| `data-reveal="lines"` | cada linha do mega título sobe em sequência; scribble gira −10° → −4° | mega títulos |
| `data-draw` (+ `pathLength="1"` nos `<path>`) | o traço se desenha | setas, faíscas |
| `data-parallax="up" \| "down" \| "soft"` | ±16 px / −6 px ligados ao scroll | bolhas, quadro, bandejas |
| `data-parallax="hero-exit"` | a colagem do hero se afasta 24 px enquanto o hero sai | colagem do hero |
| `.enter` no `<html>` | sequência de entrada do hero (≤ 900 ms) | só no 1º carregamento, no topo, sem âncora |

Gatilho: um `IntersectionObserver` compartilhado (`rootMargin` −8% embaixo). Parallax só com `animation-timeline: view()` dentro de `@supports`; sem suporte, fica parado (sem JS de scroll).

## 4. Entrada do hero

| t (ms) | Peça | Movimento |
| ---: | --- | --- |
| 0 | etiqueta | visível; assenta de −14 px e −3,5° (640 ms, papel) |
| 60 / 130 / 200 | linhas do título | assentam de 0,18 em (a 2ª vem da direita); **sem opacidade** |
| 260 / 330 / 400 | círculo, polaroide, ladrilho | montagem de peça |
| 480 | selo da Roll e selo do menu | escala .6 → 1 |
| 520 | faíscas | traço desenhado |
| 560 | botão “Reservar mesa” | visível desde 0; um “pulo” na sombra |
| 600 | nota de foto antiga | fade |

O `<head>` decide antes da primeira pintura: `if (!location.hash && !scrollY) html.classList.add('enter')`. O JS remove a classe após 1,4 s.

## 5. Elementos fixos

| Elemento | Entrada | Saída |
| --- | --- | --- |
| CTA fixo | `translateY(150%) rotate(-2°)` → repouso, 500 ms, `--ease` (v1) | 220 ms, `--ease-in` |
| Menu da doca | idem, 420 ms, `--ease-paper` | 220 ms, `--ease-in` |
| Folha do menu | sobe da base, 420 ms, papel; itens em sequência de 70 ms; fundo em fade | instantânea (o `<dialog>` fecha) |

## 6. Microinterações

Press de botão (`scale .96`, sombra recolhe para 2 px) · chip (`scale .96`; selecionado ganha sombra de 3 px e sobe 1 px) · campo em foco (sombra de 3 px) · passo concluído (✓ na legenda) · carimbo (prévia → reservado / tente de novo) · esqueleto de horários (brilho de 1,6 s). Detalhamento e durações: `MOTION-PLAN.md` §8.

## 7. Movimento reduzido e pausa

| | Padrão | `prefers-reduced-motion: reduce` | Botão “pausar animações” |
| --- | --- | --- | --- |
| Revelações e entrada do hero | tocam | estado final, sem transição | — |
| Faixa e selo | loop | parados | parados |
| Vídeos | toca o card visível, mudo | poster; toca só com toque | poster; toca só com toque |
| Parallax e espiral | ligados ao scroll | desligados | desligados |
| CTA, doca e folha | deslizam | só opacidade (150 ms) | normal |

O botão grava `localStorage['ambar:motion'] = 'paused'` (com `try/catch`) e aplica `data-motion="paused"` no `<html>`. Atende ao WCAG 2.2.2.

## 8. Orçamento e medição

- 60 fps num Android intermediário; nenhuma *long task* acima de 50 ms causada por animação; INP < 200 ms nos chips.
- Chrome DevTools com CPU 4× mais lenta durante a entrada do hero e a montagem do quadro.
- Os testes de paridade e de regressão rodam com movimento reduzido, para capturas estáveis.

## 9. Acabamento (2026-10-18)

Texturas e costuras em [`src/styles/acabamento.css`](../../../src/styles/acabamento.css) (camada `acabamento`, entre seções e movimento); movimento em `motion.css`.

| Detalhe | Como | Movimento reduzido |
| --- | --- | --- |
| Papel nas superfícies claras | `--paper-fibers` (creme e manteiga) + `--paper-doodles` (folhas de creme: corpo, Saladas & bowls, rodapé) como `background-image` | estático |
| Costura rasgada | `::after` de 14 px no topo de cada seção, na cor da anterior (`--costura`); só na home | estática |
| Fio de leitura | `.progresso` fixo no topo, `scaleX` ligado a `scroll(root)` | oculto |
| Polvilho | 12 grãos de açúcar caindo atrás do título da Fornada (`components/Polvilho.astro`), `data-vivo` | oculto |
| Scribble se escrevendo | `clip-path` da esquerda para a direita junto com a revelação das linhas | estado final |
| Faíscas do hero | se apagam e se redesenham a cada `--faisca-period`, depois da entrada | paradas |
| Espiral do Novo capítulo | gira com a rolagem (`twist`, como a da Roll) | parada |
| Ponteiro (desktop) | fotos do quadro sobem (`scale` + `--shadow-lift`); setas dos links andam | — |
| Troca de página | `@view-transition` entre documentos (`src/styles/transicao.css`) | troca direta |
