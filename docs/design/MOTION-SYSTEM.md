# Motion design system — Fornada Âmbar

> Fonte da verdade: [`src/styles/motion.css`](../../src/styles/motion.css), tokens em `tokens.css` §9, gatilhos em
> [`src/lib/motion.js`](../../src/lib/motion.js), [`sticky-cta.js`](../../src/lib/sticky-cta.js), [`videos.js`](../../src/lib/videos.js),
> [`nav-sheet.js`](../../src/lib/nav-sheet.js). O plano original (com a coreografia pretendida) é [`MOTION-PLAN.md`](MOTION-PLAN.md);
> **este documento descreve o que está implementado**. Parte do [design system](DESIGN-SYSTEM.md).

## 1. Princípios

1. **Papel, não tela.** Peças assentam, fitas esticam, carimbos batem, traços se desenham. Sem brilho, desfoque, 3D ou cortinas.
2. **O scroll é do visitante.** Nenhum *scroll-jacking*, nenhum *smooth scroll* por JS, nenhuma seção presa. Efeitos de scroll são nativos (`animation-timeline: view()`) e decorativos.
3. **O conteúdo não espera.** Texto e botões são legíveis e clicáveis desde o primeiro quadro. O título do hero (maior elemento da 1ª tela) **não anima opacidade**.
4. **Uma vez só.** Cada entrada toca uma vez por visita.
5. **Animar pouco e com motivo** (§7): títulos, peças de colagem, setas, carimbos e elementos fixos. Texto corrido, listas e formulários não entram animando.
6. **Zero biblioteca.** CSS, Web Animations e `IntersectionObserver`.

## 2. Tokens

| Token | Valor | Usos | Papel |
| --- | --- | ---: | --- |
| `--ease` (= `--ease-out`) | `cubic-bezier(.2, .7, .2, 1)` | 10 | padrão: desacelera suave (herdado do v1) |
| `--ease-paper` | `cubic-bezier(.34, 1.4, .64, 1)` | 13 | assentar com leve *overshoot* (peças, linhas, carimbo, folha, doca) |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | 2 | saídas (CTA e doca) |
| `--dur-xs` | 120 ms | 5 | pressionar (chip, menu, campo) |
| `--dur-s` | 220 ms | 9 | saídas, troca de estado, ícone do vídeo |
| `--dur-m` | 420 ms | 6 | doca, folha, traço, carimbo, selo do menu |
| `--dur-l` | 640 ms | 9 | peças de colagem, linhas de título, etiqueta |
| `--dur-reveal` | 700 ms | 2 | revelação simples (v1) |
| `--dur-xl` | 900 ms | **0** | sem uso (I-02) — é o teto documentado da entrada do hero |
| `--stagger` | 70 ms | 6 | intervalo entre peças e linhas |
| `--lift` | 28 px | 2 | deslocamento de entrada das peças |
| `--tilt` | 5° | 2 | rotação extra antes de assentar |
| `--spin-period` | 24 s | 1 | texto do selo da Roll |
| `--ticker-period` | 32 s | 1 | faixa |

**Valores literais em uso (I-09):** `.3s` (botão), `.5s`/`.3s` (CTA fixo, do v1), `.2s` (chips), `1.6s` (esqueleto e carimbo enviando), `520/360/300 ms` e os atrasos da entrada do hero, `150 ms` (movimento reduzido), `80/120/200/260 ms` (atrasos de revelação).

## 3. Regra de propriedades (para efeitos não brigarem)

| Propriedade | Dona | Exemplos |
| --- | --- | --- |
| `rotate` | composição estática | inclinação de cada peça, scribble −4° |
| `translate` | revelação simples e parallax | `data-reveal`, `data-parallax` |
| `transform` | montagem, entradas, press | `data-reveal="piece"`, entrada do hero, `:active` |
| `scale` | microinterações | chip `:active` |
| `opacity` | revelações e saídas | todas |

Consequência: elemento com **parallax** usa revelação **só de opacidade** (`data-reveal="fade"`).

## 4. Primitivas (atributos no markup)

| Atributo | De → para | Duração · curva · atraso | Gatilho | Usado em |
| --- | --- | --- | --- | --- |
| `data-reveal` | opacidade 0, `translate 0 30px` → visível | 700 ms · `--ease` | entra na tela (margem −8% embaixo), uma vez | bandas do cardápio, lead, bandejas, painéis, corpo do Novo capítulo |
| `data-reveal="fade"` | só opacidade | 700 ms · `--ease` | idem | bolhas (têm parallax) |
| `data-reveal="piece"` | opacidade 0, `translateY(28px) rotate(5°) scale(.94)` → repouso | opacidade 640 ms `--ease` · transform 640 ms `--ease-paper` · atraso `--i × 70 ms` | idem | fotos do quadro, placa, horários, mural |
| `data-reveal="lines"` | cada `<span>`: opacidade 0, `translate 0 .32em` (2ª linha `6% .32em`) → repouso | 640 ms · `--ease-paper` · 0 / 70 / 140 ms | idem | todos os mega títulos |
| ↳ scribble | opacidade 0, `translate 0 .2em`, `rotate −10°` → `−4°` | 640 ms · `--ease-paper` · 140 + 120 = 260 ms | idem | scribbles |
| `data-draw` + `pathLength="1"` | `stroke-dashoffset 1 → 0` | 420 ms · `--ease` · `--i × 70 + 200 ms` | idem | setas do quadro, faíscas do hero |
| `data-reveal="stamp"` | `scale(1.6) rotate(18°)` → repouso; opacidade | transform 420 ms `--ease-paper` · opacidade 220 ms linear · atraso 260 ms | idem | carimbo do Novo capítulo |
| `data-parallax` | ver §5.3 | ligado ao scroll | `animation-timeline: view()` | ver §5.3 |

Implementação do gatilho: `initReveal()` — um `IntersectionObserver` com `rootMargin: 0px 0px -8% 0px`, adiciona `.is-in` e para de observar. Sem `IntersectionObserver` ou com movimento reduzido, tudo recebe `.is-in` na hora.

## 5. Coreografias

### 5.1 Entrada do hero

Condição (decidida no `<head>`, antes da 1ª pintura): sem âncora na URL, no topo (`scrollY = 0`) e **sem** movimento reduzido → classe `.enter` no `<html>`. O JS a remove 1.400 ms depois (nada repete).

| t (ms) | Peça | Animação | Duração · curva |
| ---: | --- | --- | --- |
| 0 | etiqueta do logo | `translateY(-14px) rotate(-3.5deg)` → repouso (**sem opacidade**) | 640 · `--ease-paper` |
| 60 | “CAFÉ,” | `translateY(.18em)` → 0 (**sem opacidade**) | 520 · `--ease-paper` |
| 130 | “BRUNCH” | `translateX(6%)` → 0 | 520 · `--ease-paper` |
| 200 | “& FORNADAS” | `translateY(.18em)` → 0 | 520 · `--ease-paper` |
| 260 · 330 · 400 | círculo · polaroide · ladrilho | opacidade 0 + `translateY(28px) rotate(5°) scale(.94)` → repouso | 640 · `--ease-paper` |
| 480 | selo da Roll · selo do menu | opacidade 0 + `scale(.6)` → 1 | 640 · 420 · `--ease-paper` |
| 520 | faíscas | fade | 640 |
| 560 | botão “Reservar mesa” | pulo da sombra: `translate(-2px,-2px)` + sombra `6px 6px` no meio | 360 · `--ease-paper` (visível e clicável desde 0) |
| 600 | nota de foto antiga | fade | 300 · linear |

Fim da sequência: ~1.160 ms (o selo termina em 480 + 640).

### 5.2 Revelação de títulos

Ver `data-reveal="lines"` (§4): linhas a cada 70 ms, a da direita entra também na horizontal (6%), scribble por último girando de −10° para −4°.

### 5.3 Parallax (só com suporte a `animation-timeline: view()`; sem suporte, parado)

| Alvo | Atributo | Movimento ao atravessar a tela |
| --- | --- | --- |
| Bolhas lounge / leitura | `up` / `down` | `translate` de +16 → −16 px / −16 → +16 px |
| Fotos do quadro (a, c) | `soft` | +6 → −6 px |
| Foto do quadro (b), bandeja do meio | `up` | +16 → −16 px |
| Colagem do hero | `hero-exit` | 0 → −24 px enquanto o hero sai (`animation-range: exit 0% exit 100%`, linha do tempo nomeada `--hero`) |
| Espiral da Roll | *(classe)* | `rotate` −40° → 80° |

Sem atributo, o deslocamento padrão é ±12 px.

### 5.4 Montagem das colagens

Peças (`data-reveal="piece"`) chegam **de trás para a frente** usando `--i` (0, 1, 2…) × 70 ms; setas desenham depois (`+200 ms`). Na entrada do hero, a ordem é fixa (§5.1).

### 5.5 Animações no scroll — resumo

| Tipo | Implementação | Repete? |
| --- | --- | --- |
| Revelação | `IntersectionObserver` + transição CSS | não |
| Parallax e espiral | `animation-timeline: view()` | sim, reversível (segue o scroll) |
| Vídeo | toca o card ≥ 60% visível; pausa fora | segue o scroll |
| Doca (CTA + menu) | `IntersectionObserver` em 3 alvos | segue o scroll |

### 5.6 Transições entre estados

| Componente | Entrada | Saída |
| --- | --- | --- |
| CTA fixo | `translateY(150%) rotate(-2deg)` → repouso · 500 ms `--ease` (v1) · opacidade 300 ms | 220 ms `--ease-in` |
| Menu da doca | `translateY(150%) rotate(2deg)` → repouso · 420 ms `--ease-paper` · opacidade 220 ms | 220 ms `--ease-in` |
| Folha do menu | `translateY(100%)` → 0 · 420 ms `--ease-paper`; fundo em fade 220 ms; itens: opacidade + 14 px, 420 ms `--ease-out`, atraso 80 + `i × 70` ms | instantânea (o `<dialog>` fecha) |
| Folha (desktop) | `translateX(100%)` → 0 | instantânea |
| Ícone tocar/pausar do vídeo | opacidade + `scale(.9 → 1)` · 220 ms (`--ease-paper` na escala) | idem |
| Carimbo da comanda | troca de texto/estado (em breve · simulação · reservado · tente de novo) | — |
| Carimbo enviando | gira 1,6 s em loop enquanto `aria-busy` | — |

### 5.7 Microinterações

| Elemento | Efeito | Duração |
| --- | --- | --- |
| Botão | `:active` `scale(.96)` | .3 s `--ease` |
| Botão de menu | `:active` `scale(.94)` | 120 ms `--ease` |
| CTA fixo, menu da doca | `:active` sombra 4 → 2 px (afunda no papel) | instantâneo |
| Chip | selecionado: fundo, cor e `translate(-1px,-1px)` (.2 s) + sombra 3 px; `:active` `scale(.96)` (120 ms) | — |
| Campo | foco: sombra 3 px e sobe 1 px | 120 ms |
| Esqueleto de horário | brilho percorrendo | 1,6 s em loop |
| Legenda de passo | ✓ aparece ao concluir | instantâneo |

### 5.8 Loops

Faixa (32 s, linear) · texto do selo da Roll (24 s, linear) · esqueleto (1,6 s) · carimbo enviando (1,6 s). Todos param com a pausa global ou com movimento reduzido.

## 6. Movimento reduzido e pausa

| Recurso | `prefers-reduced-motion: reduce` | Botão “pausar animações” (`data-motion="paused"`) |
| --- | --- | --- |
| Entrada do hero | não acontece (`.enter` não é aplicada) | — |
| Revelações | estado final imediato | — |
| Parallax e espiral | desligados (`animation: none`) | desligados |
| Faixa, selo, esqueleto | parados | pausados (`animation-play-state`) |
| Vídeos | nada toca sozinho; toque toca | idem |
| CTA fixo e doca | só opacidade, 150 ms | normal |
| Rolagem suave por âncora | desligada | normal |

A regra global `*, *::before, *::after { animation: none !important; transition: none !important }` garante o estado final; o botão de pausa grava `localStorage['ambar:motion']` (com `try/catch`) e vale também para o WCAG 2.2.2.

## 7. O que anima e o que não anima

| Anima | Não anima |
| --- | --- |
| mega títulos (linhas), scribbles | texto corrido, legendas, notas |
| peças de colagem, placa, horários | pílulas do cardápio (só o bloco aparece) |
| setas e faíscas (traço) | chips, campos e passos da comanda (só microinterações) |
| carimbo do Novo capítulo | rodapé |
| elementos fixos (doca, folha) | imagens dentro de painéis (o painel inteiro aparece) |
| loops: faixa, selo | nada mais em loop |

## 8. Performance

- **Só** `transform`, `translate`, `rotate`, `scale`, `opacity` e `stroke-dashoffset`. Nunca `top/left/width/height/margin` ou sombras grandes em animação (o pulo do botão anima a sombra deslocada uma vez).
- Scroll: nenhum *listener* de scroll em JS; parallax via `animation-timeline`; visibilidade via `IntersectionObserver` (um por recurso).
- Vídeos: `preload="none"`, poster a 1,5 tela, um tocando por vez.
- **Medido** (Chromium, CPU 4× mais lenta, rolagem da página inteira com tudo ligado): **60 fps** médios, quadro mediano 16,6 ms, p95 18,7 ms, 1,7% dos quadros > 20 ms, **0 tarefas longas**.
- Orçamento: nenhuma tarefa longa causada por animação; INP < 200 ms nos chips.

## 9. Planejado no MOTION-PLAN e **não** implementado

| Item | Situação |
| --- | --- |
| Número do stepper trocando com deslize | não implementado (troca direta) |
| Tremida de campo inválido e no limite do stepper | não implementado |
| ✓ da legenda “carimbado” (escala 1,4 → 1) | o ✓ aparece sem animação |
| Passo 05 “esticando” a comanda (`grid-template-rows`) | o passo aparece direto |
| Carimbo “reservado” batendo (escala 1,6 → 1) na confirmação | troca de estado sem animação (o batido existe só no Novo capítulo) |
| Fita esticando depois da foto | não implementado |
| Barra de progresso dos vídeos por segmentos | uma barra por card |
| Variação de largura (`wdth`) na entrada dos títulos | não implementado (decisão de performance) |

## 10. Exemplos reais

```html
<!-- peça de colagem com atraso e parallax (MesaCheia.astro) -->
<figure class="board__item board__item--b" data-reveal="piece" data-parallax="up" style="--i:1">…</figure>

<!-- seta desenhada: cada path com pathLength="1" -->
<svg class="arrow arrow--a" data-draw><path pathLength="1" d="M8 10C40 4 78 18 96 58" /></svg>
```

```css
/* a curva de papel em uso (motion.css) */
.js [data-reveal="piece"] { transform: translateY(var(--lift)) rotate(var(--tilt)) scale(.94);
  transition: opacity var(--dur-l) var(--ease), transform var(--dur-l) var(--ease-paper);
  transition-delay: calc(var(--i, 0) * var(--stagger)); }
```
