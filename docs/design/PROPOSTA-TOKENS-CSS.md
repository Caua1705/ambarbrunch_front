# Proposta — centralização dos tokens em CSS

> **Situação: implementada em 2026-10-16**, com 0 px de diferença (ver [auditoria §7](AUDITORIA-DESIGN-SYSTEM.md)). Diferenças em relação a esta proposta:
> a escala ganhou `--s-24` (usado 6×); entraram também `--t-call`, `--t-stamp-l`, `--t-stamp-s`, `--t-sim`, `--t-prose`, `--t-body-s`, `--t-hero-amp`,
> os papéis de revisão, `--track-code`, `--radius-track`, `--shadow-pin`, `--black`, `--footer-dock-space` e os atrasos de revelação;
> não foi preciso alias para `--wdth-*` (a troca foi feita de uma vez). Há uma camada extra, `docs`, para a página `/design-system/`.
> Base: [`AUDITORIA-DESIGN-SYSTEM.md`](AUDITORIA-DESIGN-SYSTEM.md). Parte do [design system](DESIGN-SYSTEM.md).

## 1. Objetivo e garantia

Tirar os valores soltos dos componentes e seções e concentrá-los em tokens, **sem mudar um pixel**.

Garantia: cada token novo recebe **exatamente** o valor literal que substitui. A refatoração só é aceita se:
1. o teste de fidelidade continuar verde (geometria ±1 px **e estilos calculados idênticos** nas 7 seções do v1);
2. uma comparação de screenshots **antes × depois** do próprio site (360, 375, 390, 430, 768, 1440 px; Chromium e WebKit) der **0 pixel** de diferença;
3. `astro check` e a suíte e2e continuarem verdes.

## 2. Arquitetura proposta (reaproveita a do Astro, sem duplicação)

Hoje: `Base.astro` importa `src/styles/index.css`, que importa `tokens.css`, `base.css`, 21 componentes, 10 seções e `motion.css` (nessa ordem). **Isso continua.** Muda só a organização interna dos tokens:

```text
src/styles/
├── tokens/                     ← antes: um único tokens.css (185 linhas)
│   ├── primitives.css          paleta crua, famílias, escala real de espaço, raios, durações, curvas
│   ├── semantic.css            papéis: texto, superfícies, bordas, CTA, foco, overlays
│   ├── typography.css          papéis tipográficos (--t-*), eixos (--fvs-*, --stretch-*), tracking
│   ├── layout.css              gutter, containers, ritmo de seção, camadas (z), palcos (--stage-*)
│   └── motion.css              durações e curvas nomeadas, coreografia do hero (--hero-t-*)
├── tokens.css                  ← vira só o índice: @import dos 5 arquivos acima
├── base.css · components/ · sections/ · motion.css · index.css   (sem mudança de estrutura)
```

- **Uma fonte só.** Nenhum valor é repetido em TypeScript, JSON ou Markdown. A página de documentação ([proposta](PROPOSTA-PAGINA-DOCUMENTACAO.md)) lê os tokens **do próprio CSS** (`getComputedStyle(document.documentElement)`).
- **Camadas de cascata** (`@layer tokens, base, components, sections, motion;`) declaradas em `index.css`, na mesma ordem dos imports de hoje: a ordem efetiva não muda, mas fica explícita e protegida contra regras fora de lugar.
- **Componentes Astro** continuam sem `<style>` próprio (sem `data-astro-cid`), para os nomes de classe do v1 seguirem comparáveis.
- **Dados** (`src/data/cardapio.ts`) continuam referenciando tokens por nome (`var(--wine)`), nunca HEX.

## 3. Tokens a criar (mesmo valor de hoje)

### Espaço — escala real (I-01)

```css
/* substitui --space-1…10 (sem uso) pela escala que o desenho usa de fato */
--s-6: 6px;  --s-8: 8px;  --s-10: 10px; --s-12: 12px; --s-14: 14px; --s-16: 16px; --s-18: 18px;
--s-22: 22px; --s-26: 26px; --s-30: 30px; --s-34: 34px; --s-40: 40px; --s-44: 44px;
```

Nomeados pelo valor, de propósito: a escala do conceito é irregular (passos de 2 até 18; depois 22, 26, 30, 34, 40, 44) e um nome abstrato (`--space-5`) esconderia isso. Valores únicos de composição (ex.: `132px` do Novo capítulo, `−16px −12px` da faixa) **ficam no CSS da seção**, comentados.

### Tipografia (I-03, I-04, I-05)

```css
--fvs-display: "opsz" 96;            /* era --wdth-mega (nome legado) */
--t-menu-item: 800 44px/.9 var(--display);
--t-address:   800 26px/1.02 var(--display);
--t-input:     700 16px/1.2 var(--display);
--t-status:    700 14px/1.35 var(--display);
--t-error:     700 13px/1.3 var(--display);
--t-review:    700 16px/1.3 var(--display);
--t-credit:    700 12.5px/1.25 var(--display);
--t-link:      700 14px/1 var(--display);
--t-step-key:  700 22px/1 var(--display);
--track-tight-caps: .02em;
```

### Cor — overlays (I-06)

```css
--overlay-ink: rgba(36, 21, 15, .72);       /* faixa de crédito do vídeo */
--overlay-ink-soft: rgba(36, 21, 15, .62);  /* botão tocar/pausar */
--track-light: rgba(255, 251, 244, .35);    /* trilho do progresso */
--sim-stripe: rgba(168, 32, 58, .08);       /* listras do aviso de simulação */
--media-bg: #000;                            /* fundo do vídeo antes do poster */
```

### Forma (I-07, I-08)

```css
--radius-round: 50%;
--ring-media: 0 0 0 4px;            /* + cor: var(--caramel) | var(--butter) */
--ring-invalid: inset 0 0 0 1px var(--wine);
--shadow-offset-l: 6px 6px 0 var(--cacao);   /* pulo do botão na entrada do hero */
```

### Movimento (I-09)

```css
--dur-press: 300ms;      /* .btn :active (v1) */
--dur-chip: 200ms;       /* troca de estado do chip */
--dur-cta-in: 500ms;     /* entrada do CTA fixo (v1) */
--dur-cta-fade: 300ms;
--dur-reduced: 150ms;    /* opacidade com movimento reduzido */
--dur-loop-busy: 1.6s;   /* esqueleto e carimbo enviando */
/* coreografia do hero: uma tabela só, lida pelo motion.css */
--hero-t-line-1: 60ms; --hero-t-line-2: 130ms; --hero-t-line-3: 200ms; --hero-t-line-dur: 520ms;
--hero-t-piece-1: 260ms; --hero-t-piece-2: 330ms; --hero-t-piece-3: 400ms;
--hero-t-sticker: 480ms; --hero-t-sparks: 520ms; --hero-t-cta: 560ms; --hero-t-cta-dur: 360ms;
--hero-t-note: 600ms; --hero-t-note-dur: 300ms;
```

### Layout (I-10, I-12)

```css
--container-s: 900px;  --container-m: 980px;  --container-l: 1100px;  --container-xl: 1240px;
--z-1: 1; --z-2: 2; --z-3: 3; --z-4: 4; --z-5: 5; --z-6: 6;   /* camadas de papel (locais) */
--rhythm-novo-top: 132px;   /* exceção documentada (I-15) */
```

### Remoções e renomes

| Ação | Tokens |
| --- | --- |
| Remover (sem uso) | `--space-1…10`, `--text-on-dark`, `--dur-xl` (ou passar a usar como teto documentado) |
| Remover também | `--border-tile`: o ladrilho calcula a borda em unidade do protótipo (`5 * --u`), e o `calc()` não divide comprimento por comprimento para reaproveitar o token |
| Renomear (com alias temporário) | `--wdth-*` → `--fvs-*` (o alias `--wdth-mega: var(--fvs-display)` fica até o fim da migração) |

## 4. Limpezas de arquitetura (sem token novo)

| Item | Mudança |
| --- | --- |
| I-11 | `.visite` entra nas listas de `base.css` (`:is(.surface-grain, .hero, .roll, .reserva, .visite)::before` e anel manteiga); some a regra duplicada de `visite.css` |
| I-13 | estilos inline da ilha viram classes (`.ticket__slots--after`, `.field__error--block`) |
| I-14 | corrige o comentário do carimbo (18°) |

## 5. Exemplo antes × depois

```css
/* ANTES — components/story.css */
.story__by { background: rgba(36, 21, 15, .72); font: 700 12.5px/1.25 var(--display); letter-spacing: .02em; padding: 8px 12px; }

/* DEPOIS — mesmo resultado calculado */
.story__by { background: var(--overlay-ink); font: var(--t-credit); letter-spacing: var(--track-tight-caps); padding: var(--s-8) var(--s-12); }
```

## 6. Proteção contra regressão (contrato)

Transformar a auditoria em teste permanente (`tests/tokens.spec.ts`, sem dependência nova):

- falha se aparecer cor HEX/RGB fora de `tokens/`;
- falha se aparecer `font:`/`font-size:` em px fora de `tokens/` (exceto os casos em `--u`, que são fórmulas de palco);
- falha se um token declarado ficar sem uso;
- avisa (não falha) para `padding/margin/gap` com valor fora da escala `--s-*`.

## 7. Plano de execução (após autorização)

| Passo | Conteúdo | Verificação |
| --- | --- | --- |
| 0 | capturar a referência “antes” (6 larguras × 2 motores) | — |
| 1 | dividir `tokens.css` em `tokens/` sem mudar valores; `@layer` | fidelidade + 0 px |
| 2 | criar os tokens do §3 e trocar os literais, arquivo por arquivo | fidelidade + 0 px a cada arquivo |
| 3 | limpezas do §4, remoções e renomes (com alias) | idem |
| 4 | teste de contrato (§6) | verde |
| 5 | atualizar esta documentação (tabelas de tokens) | revisão |
