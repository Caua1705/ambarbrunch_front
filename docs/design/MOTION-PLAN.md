# Motion plan — Conceito B · Fornada Âmbar

> **Situação:** aprovado (2026-10-16). Tokens e primitivas implementados no design system ([`design-system/MOTION.md`](design-system/MOTION.md)); a coreografia por seção entra na implementação.
> Relacionados: [`HOMEPAGE-STORYBOARD.md`](HOMEPAGE-STORYBOARD.md) · [`CONCEITO-B-APROVADO.md`](CONCEITO-B-APROVADO.md) §7 (efeitos atuais).

## 0. Princípios

1. **Papel, não tela.** O movimento imita objetos físicos: etiqueta que cai e assenta, foto colada que gira um pouco e para, fita que estica, carimbo que bate. Nada de brilho, desfoque cinematográfico ou 3D.
2. **O scroll é do visitante.** Sem scroll-jacking, sem “smooth scroll” por JS, sem seções presas (`pin`) que seguram a rolagem. Toda animação ligada ao scroll é **decorativa** e reversível.
3. **Só `transform` e `opacity`** (e `clip-path` pontual). Nunca animar `top`, `left`, `width`, `height`, `margin` ou sombras grandes.
4. **O conteúdo nunca espera a animação.** Texto e CTA ficam legíveis e clicáveis desde o primeiro frame visível. O LCP não pode depender de uma animação de opacidade.
5. **Uma vez só.** Entradas tocam uma vez por elemento e por visita; voltar a rolar não repete a coreografia.
6. **Movimento reduzido é cidadão de primeira classe** (§9), e existe um botão “pausar animações” (WCAG 2.2.2).
7. **Orçamento:** 60 fps num Android intermediário; nenhum *long task* > 50 ms causado por animação; INP < 200 ms nos chips da comanda.

## 1. Tokens de movimento

| Token | Valor | Uso |
| --- | --- | --- |
| `--dur-xs` | 120 ms | press de botão e chip |
| `--dur-s` | 220 ms | saída do CTA fixo, troca de estado |
| `--dur-m` | 420 ms | entrada do CTA fixo, carimbo, setas |
| `--dur-l` | 640 ms | peças de colagem, linhas de título |
| `--dur-xl` | 900 ms | sequência total do hero (teto) |
| `--ease-out` | `cubic-bezier(.2, .7, .2, 1)` | padrão (já no protótipo) |
| `--ease-paper` | `cubic-bezier(.34, 1.4, .64, 1)` | assentamento com pequeno *overshoot* (etiqueta, polaroides, carimbo) |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | saídas |
| `--stagger` | 70 ms | entre peças de uma colagem e linhas de título |
| `--lift` | 28 px | deslocamento máximo de entrada |
| `--tilt` | +5° | rotação extra antes de assentar (soma à rotação final da peça) |
| `--parallax` | 6–24 px | deslocamento máximo ligado ao scroll |

## 2. Entrada do hero (só no primeiro carregamento)

A sequência dura no máximo ~900 ms. Não toca se a página abrir já rolada (`#reservar`, restauração de scroll ou *back/forward cache*).

| t (ms) | Elemento | Movimento | Observação |
| ---: | --- | --- | --- |
| 0 | Fundo vinho, etiqueta com logo | **Já visível.** A etiqueta faz só `translateY(-14px) rotate(-6°) → rotate(-2.5°)` em 640 ms com `--ease-paper` | Sem fade: protege o LCP |
| 60 | “CAFÉ,” | Linha sobe de dentro de uma máscara (`translateY(105%) → 0`), 520 ms | Texto existe no DOM e é lido desde o início |
| 130 | “BRUNCH” | Idem, vindo da direita (`translateX(8%)`), alinhado à direita | |
| 200 | “& FORNADAS” | Idem; o “&” itálico entra com rotação de −12° | |
| 260 | Círculo do croissant | Montagem (§3) | |
| 330 | Polaroide do salão | Montagem (§3) | |
| 400 | Ladrilho da bruschetta | Montagem (§3) | |
| 480 | Selo Roll | Escala `.6 → 1` com `--ease-paper`; depois começa a girar devagar | O giro respeita a pausa |
| 520 | Faíscas | Traço desenhado (`stroke-dashoffset`), 300 ms | |
| 560 | CTA “Reservar mesa” | **Visível e clicável desde 0.** A 560 ms recebe um “pulo” único de 4 px na sombra deslocada | Não esconder o CTA |
| 600 | Nota “*foto de referência” | Fade 300 ms | |

**Saída do hero ao rolar** (scroll-driven, decorativo): a colagem afasta-se no máximo 24 px (círculo sobe, polaroide desce), e a etiqueta gira +1°. Implementação: `animation-timeline: view()` com `animation-range: exit`.

## 3. Montagem de colagens

Usada no hero, no quadro da Mesa cheia, nas bandejas da Roll, no mural da seção 7 e na placa da seção 9.

- **Peça (foto com moldura):** de `translate(0, var(--lift)) rotate(calc(var(--r) + var(--tilt))) scale(.94)` e `opacity: 0` para `translate(0) rotate(var(--r)) scale(1)` e `opacity: 1`, em `--dur-l` com `--ease-paper`. `--r` é a rotação final que já existe no CSS do protótipo; cada peça declara a sua.
- **Ordem:** de trás para frente (`z-index` crescente), com `--stagger`. A peça que fica por cima chega por último, como alguém montando a mesa.
- **Fita:** depois que a foto assenta, `scaleX(0 → 1)` a partir da ponta esquerda, 220 ms.
- **Nota + seta:** a seta se desenha (`stroke-dashoffset` do comprimento até 0, 420 ms) e a nota aparece em fade com 2 px de subida, em sequência com a foto correspondente.
- **Gatilho:** `IntersectionObserver` com o quadro 25% visível. Peças fora do quadro não esperam as demais.

## 4. Revelação tipográfica

- **Mega títulos** (“MESA / CHEIA”, “FORNA / DAS”, “ESCOLHA / O CLIMA”, “RESERVE / SUA MESA”, “VISITE / O ÂMBAR”): cada linha sobe de dentro de uma máscara (`overflow: clip` na linha, `translateY(105%) → 0`) com `--dur-l` e `--stagger`. A linha alinhada à direita entra com um leve `translateX(6%)`.
- **Variação de largura (opcional, testar):** a Bricolage é variável em largura. A linha pode entrar com `wdth 90` e assentar em `wdth 75`. Isso relayouta o texto; usar só nos mega títulos, uma vez, e medir em aparelho real. Se custar frames, cair para o padrão acima.
- **Scribble:** aparece 120 ms depois do título, com `rotate(-10° → -4°)` e fade.
- **Texto corrido:** só fade com 8 px de subida. Nunca palavra por palavra.

## 5. Parallax discreto e transições entre seções

**Parallax**, só com `animation-timeline: view()` dentro de `@supports`. Sem *listener* de scroll em JS. Em navegadores sem suporte, fica estático.

| Elemento | Deslocamento |
| --- | --- |
| Espiral da Roll (já existe) | rotação −40° → 80° |
| Bolhas lounge e leitura | `translateY` ±16 px |
| Bandejas em leque | a do meio sobe 10 px; as laterais abrem ±2° |
| Fotos do quadro Mesa | ±6 px, em direções alternadas |
| Placa da Visite | rotação −3° → −1° |

**Transições entre seções:** o protótipo já resolve com forma e cor, e isso continua:

- **Borda recortada** (a da etiqueta) na base da seção 3 sobre a 4.
- **Faixa inclinada** (ticker) entre hero e seção 3.
- **Diagonal** entre os painéis de ambiente; pode ser repetida na saída da seção 6 para a 8.
- **Sobreposição de 16–24 px** de elementos sobre a seção seguinte (selos, polaroides), criando costura.
- **Sem** fade de página inteira, cortina ou troca de cor do `body` por scroll: são caros e lembram template.

## 6. Carrossel de vídeos (Fornadas)

- **Base nativa:** `scroll-snap` horizontal (já existe). Sem biblioteca de carrossel.
- **Um vídeo por vez:** toca só o card com maior área visível (≥ 60%); os outros pausam e voltam ao poster. Hoje, no v1, mais de um pode tocar.
- **Progresso tipo story:** barrinhas no topo do card, preenchidas com `scaleX` sincronizado a `currentTime` via `requestAnimationFrame`, só enquanto o card toca.
- **Toque no card:** pausa ou retoma. Indicador ⏸/▶ com fade de 220 ms.
- **Som:** os vídeos vêm sem faixa de áudio. Para o IV-05 (depoimento), se autorizado, aparece um botão “ativar som” que só liga após gesto do usuário, com legendas (`<track>` WebVTT).
- **Entrada da seção:** os cards entram com a montagem do §3 (rotação final 0°; o segundo card mantém o deslocamento vertical do v1).
- **Carregamento:** `preload="none"` + poster; o `src` só é atribuído quando o card fica a menos de um card de distância da tela.
- **Movimento reduzido ou pausa global:** nada toca sozinho; cada card mostra o poster com o botão ▶.

## 7. CTA fixo (aparecer e desaparecer)

**Regra de visibilidade:**

```
visível = !botãoDoHeroNaTela && !seçãoReservaNaTela(≥25%) && !campoDeTextoComFoco
```

- Observar o **botão do hero**, não o hero inteiro. Isso corrige o problema medido em 360×740 e 375×667, onde o botão fica fora da primeira tela e não havia CTA visível.
- `campoDeTextoComFoco` evita que a barra cubra o teclado virtual na comanda.

**Entrada:** `translateY(150%) rotate(-2°)` → `0 rotate(0)`, `--dur-m`, `--ease-paper`. Na primeira aparição da visita, a seta dá um “empurrão” de 4 px uma vez.

**Saída:** `translateY(150%)`, `--dur-s`, `--ease-in` (mais rápida que a entrada, para não atrapalhar).

**Toque:** `scale(.97)` e a sombra deslocada recolhe para `2px 2px` (sensação de botão pressionado), `--dur-xs`.

**Acessibilidade:**
- quando oculto: `aria-hidden="true"` e `tabindex="-1"` (já é assim);
- com movimento reduzido: só opacidade, 150 ms;
- reservar `padding-bottom` no rodapé para a barra não cobrir o conteúdo final.

## 8. Microinterações da comanda (formulário)

| Interação | Movimento | Duração |
| --- | --- | --- |
| Chip pressionado | `translate(-1px,-1px)` + sombra deslocada cresce de 0 para `3px 3px` (já no v1) | 120 ms |
| Chip ao toque | `scale(.96)` no `:active` | 120 ms |
| Stepper (pessoas) | o número antigo sai para cima e o novo entra por baixo (`translateY ±60%`) | 160 ms |
| Limite do stepper | o botão desabilita; tremida de ±3 px, 2 ciclos, ao tentar passar | 200 ms |
| Datas | `scroll-snap` horizontal; a data escolhida centraliza (`scrollIntoView({inline:'center'})`) | nativo |
| Horários carregando | chips-esqueleto com brilho lento; a espiral do CTA gira | — |
| Passo concluído | o número do passo (“01 · ambiente”) ganha um ✓ carimbado (`scale 1.4 → 1`, `--ease-paper`) | 260 ms |
| Passo 05 (dados) | a comanda “estica” para baixo (`grid-template-rows: 0fr → 1fr`); o foco vai para o 1º campo | 320 ms |
| Erro de campo | borda vinho + mensagem abaixo; tremida de ±4 px uma vez (sem tremida com movimento reduzido) | 240 ms |
| Envio | o botão vira a espiral girando + “enviando…”; a comanda fica `aria-busy` | — |
| Confirmação | o carimbo “prévia” sai e o “reservado” bate (`scale 1.6 → 1`, `rotate 30° → 14°`); a comanda inteira dá um “solavanco” de 3 px | 420 ms |
| Falha de envio | o carimbo vira “tente de novo”; a mensagem traz o WhatsApp | 260 ms |

Toda mudança de estado também é anunciada por texto (`aria-live="polite"`), nunca só por movimento.

## 9. Movimento reduzido e pausa global

| Recurso | Padrão | `prefers-reduced-motion: reduce` | “Pausar animações” (botão) |
| --- | --- | --- | --- |
| Entrada do hero | sequência §2 | tudo no estado final; fade de 150 ms no máximo | sem efeito (já tocou) |
| Montagem das colagens | §3 | estado final, sem deslocamento | — |
| Revelação tipográfica | §4 | estado final | — |
| Parallax e espiral | §5 | desligado | desligado |
| Faixa (ticker) | loop | texto estático em 2 linhas | parado |
| Selo Roll girando | loop | parado | parado |
| Vídeos | autoplay mudo do card visível | poster + ▶ | poster + ▶ |
| CTA fixo | slide + rotação | só opacidade | normal (não é loop) |
| Microinterações | §8 | sem tremidas nem saltos; só cor e opacidade | normal |

O botão de pausa grava `localStorage['ambar:motion']='paused'` e aplica `data-motion="paused"` no `<html>`; o CSS desliga os loops por esse atributo.

## 10. Implementação técnica

**Sem biblioteca de animação.** Tudo é coberto por recursos nativos:

| Necessidade | Ferramenta nativa |
| --- | --- |
| Entradas e coreografia do hero | CSS `@keyframes` + `animation-delay` (stagger por `--i`), ou Web Animations API para sequências |
| Gatilho ao entrar na tela | `IntersectionObserver` (um observer compartilhado) |
| Parallax e efeitos ligados ao scroll | CSS scroll-driven animations (`animation-timeline: view()`), com `@supports` |
| Desenho de traço | `stroke-dasharray` / `stroke-dashoffset` |
| Expansão de passo | `grid-template-rows` 0fr → 1fr |
| Estados da comanda | atributos `data-state` + transições CSS |

**Por que não GSAP ou Motion:** acrescentariam ~25–70 KB de JS para efeitos que o CSS resolve, e incentivam *pin* e *scrub*, que conflitam com o princípio 2. Só reavaliar se surgir uma coreografia que o nativo não resolva.

**Por que não Lenis ou outro smooth scroll:** contraria “não bloquear o scroll” e piora a acessibilidade.

**Como medir:**
- Chrome DevTools Performance com CPU 4× mais lenta (sem frames > 16 ms durante as entradas);
- teste em Android intermediário real;
- Playwright com `reducedMotion: 'reduce'` nas comparações visuais, para gerar screenshots estáveis (ver `COMPONENTIZATION-PLAN.md` §6);
- checagem manual com o leitor de tela (TalkBack, VoiceOver) na comanda.
