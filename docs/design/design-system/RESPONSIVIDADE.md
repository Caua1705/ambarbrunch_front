# Responsividade mobile-first — Fornada Âmbar

## 1. Viewports de referência

| Viewport | Papel |
| --- | --- |
| **390 × 844** | **referência de desenho e de fidelidade** (iPhone 12–15) |
| 360 × 740 / 360 × 640 | Android comum / tela baixa |
| 375 × 667 | iPhone SE / 8 (a tela baixa mais comum no iOS) |
| 430 × 932 | iPhone Pro Max / Plus |
| ≥ 960 | desktop (mantido do v1; refinamento depois do lançamento) |

Não há breakpoint entre 431 e 959 px: o layout mobile escala até lá. Tablet fica para depois do lançamento.

## 2. A unidade do protótipo (`--u`)

As colagens do v1 foram desenhadas em pixels, para 390 px. Para escalar **sem redesenhar**, cada palco de colagem declara `--u`, que vale **1 px do protótipo**:

```css
/* quadro da Mesa: o contêiner é a seção; em 390 px o palco mede 358 px */
.mesa  { container-type: inline-size; }
.board { --u: calc(100cqi / 358); height: calc(660 * var(--u)); }
.board__item--b { top: calc(262 * var(--u)); }
```

- Em **390 px, `--u` = 1px** e o resultado é idêntico ao v1 (provado pelo teste de paridade).
- Em 360 px, `--u` ≈ 0,92px; em 430 px, ≈ 1,11px. A composição inteira escala junto.
- `--u` é uma propriedade **não registrada**: é substituída onde é usada, então `cqi`/`cqw` resolvem contra o contêiner certo.
- Textos dentro de colagens escalam com limite (`clamp(16px, 19 * var(--u), 22px)`), para nunca ficarem ilegíveis.
- No desktop, `--u: 1px` e valem as posições em % e px do v1.

Palcos convertidos: **hero** (358 × 330) e **quadro da Mesa** (358 de largura). Bandejas, painéis e bolhas já eram fluidos no v1 (em %).

## 3. Hero: o botão sempre na primeira tela

Medido no v1 (Edge, 2026-10-16): em 360×740 e 375×667 o hero tinha 802 e 816 px. O botão “Reservar mesa” ficava fora da primeira tela, e o CTA fixo também não aparecia. Correção aprovada, **sem redesenhar**:

```css
.hero { --hero-rest: calc(83.4vw + 173px); }  /* altura do hero sem a colagem, medida no v1 (±1 px) */
.hero__collage {
  height: clamp(160px, calc(100svh - 12px - var(--hero-rest)), 330px);
  container-type: size;
  --u: min(calc(100cqw / 358), calc(100cqh / 330));       /* limita pela largura E pela altura */
  --ox: calc((100cqw - 358 * var(--u)) / 2);               /* centraliza quando a altura manda */
}
```

| Viewport | v1: altura do hero | DS: altura do hero | Botão na 1ª tela |
| --- | ---: | ---: | --- |
| 390 × 844 | 827 | **827 (idêntico)** | sim |
| 360 × 740 | 802 | 727 | **sim** (antes: não) |
| 375 × 667 | 815 | 654 | **sim** (antes: não) |
| 430 × 932 | 857 | 857 | sim |

- `svh` (altura da tela com a barra do navegador visível) evita que o hero “pule” quando a barra some.
- Mínimo de 160 px para a colagem: abaixo disso (paisagem, telas minúsculas), o hero cresce e o **CTA fixo** cobre o caso, porque observa o próprio botão do hero.
- **Também corrigido:** no v1 o botão quebrava em duas linhas abaixo de ~375 px. Agora ele não quebra (`white-space: nowrap`) e, abaixo de 375 px, o padding cai para 18 px.

## 4. Outras regras

- **Sem overflow horizontal** em nenhum viewport (`overflow-x: clip` no `html`; verificado: 0 px de 360 a 430).
- **Área segura:** elementos fixos usam `max(12px, env(safe-area-inset-bottom))`; `viewport-fit=cover`.
- **Teclado virtual:** a doca some enquanto um campo de texto tem foco.
- **Rodapé** com 130 px de padding inferior, para a doca não cobrir o fim da página.
- **Carrosséis** (stories, datas) com `scroll-snap` nativo e `scroll-padding` igual ao gutter.
- **Texto:** mínimo de 12 px; campos de formulário com 16 px.
- **Paisagem no celular:** funciona (hero cresce, CTA fixo aparece), mas não é desenhada.
