# Menu e CTA fixo de reservas — Fornada Âmbar

> Decisão aprovada em 2026-10-16: **com menu**, discreto e elegante, sem comprometer a composição. **Reservar continua sendo a ação principal.**
> Código: [`components/menu.css`](../../../src/styles/components/menu.css), [`components/sticky-cta.css`](../../../src/styles/components/sticky-cta.css),
> [`lib/nav-sheet.js`](../../../src/lib/nav-sheet.js), [`lib/sticky-cta.js`](../../../src/lib/sticky-cta.js). Prévia: `experiments/design-system/preview.html`.

## 1. Por que este desenho

- **Sem cabeçalho fixo:** uma barra no topo competiria com a etiqueta do logo e cortaria o hero.
- **O menu é um objeto da colagem:** no hero, um selo manteiga de 44 px colado na ponta da etiqueta, como os selos da Roll. Não desloca nada do v1.
- **Depois do hero, tudo fica embaixo, ao alcance do polegar:** um quadrado creme de 58 px (menu) ao lado do CTA manteiga (reserva). O CTA continua com cerca de 80% da largura e é o único elemento cheio de cor.
- **Dentro do menu**, o único botão cheio é “Reservar mesa” (vinho).

## 2. Estados

| Momento | Selo do hero | Doca: menu | Doca: CTA |
| --- | --- | --- | --- |
| Topo da página (botão do hero na tela) | visível | oculto | oculto |
| Rolando pelas seções | fora da tela | **visível** | **visível** |
| Seção de reserva ≥ 25% na tela | — | **oculto** (cobriria campos do formulário) | **oculto** (já está na reserva) |
| Campo de texto com foco (teclado aberto) | — | oculto | oculto |
| Menu aberto | — | oculto | oculto |
| Tela baixa em que o botão do hero não cabe | visível | oculto | **visível desde o início** |

Regras (em `lib/sticky-cta.js`):

```
CTA  = botãoDoHero < 60% visível  E  reserva < 25% visível  E  !digitando  E  !menuAberto
Menu = seloDoHero fora da tela  E  reserva < 25% visível     E  !digitando  E  !menuAberto
```

- “Botão do hero visível” exige **60%** do botão na tela: um botão cortado na borda não conta.
- Observa o **botão** (não o hero inteiro), o que resolve as telas baixas medidas no v1.
- Oculto = `aria-hidden="true"`, `tabindex="-1"` e **sem clique** (`pointer-events: none`). No v1, com movimento reduzido, o CTA invisível ainda podia receber toque.

## 3. Folha do menu

- `<dialog>` modal nativo: o navegador prende o foco, fecha com Esc e coloca o resto da página como inerte.
- Abre de baixo para cima, com a borda recortada da etiqueta virada para cima. Fundo creme, *scrim* de tinta a 58%.
- Itens: **Cardápio · Fornadas · Ambientes · Visite**, numerados “01–04” no estilo das legendas da comanda, em mega tipografia vinho com alinhamento alternado.
- Depois: botão vinho “Reservar mesa”, linha de contatos (Instagram e WhatsApp do Âmbar **a confirmar**) e o botão “pausar animações”.
- Tocar num item fecha a folha, rola até a seção e põe o foco nela. Tocar no fundo ou no ✕ fecha e devolve o foco ao botão que abriu.
- Enquanto aberta, o `html` não rola (`:has(.sheet[open])`).
- Desktop (≥ 960 px): a doca de menu some e a folha vira um painel lateral de 420 px.

## 4. Acessibilidade

- Botões de menu com `aria-label="Abrir menu"`, `aria-haspopup="dialog"`, `aria-controls` e `aria-expanded`.
- “Pular para a reserva” é o primeiro elemento focável da página.
- Alvos: selo 44 px, doca 58 px, ✕ 44 px, itens da folha ≥ 60 px de altura.
- A folha não depende de JS para existir no HTML; sem `showModal`, o selo vira um link âncora para o rodapé (fallback a implementar no Astro).

## 5. Verificado na prévia (Edge, 390 × 844, 2026-10-16)

| Situação | CTA | Menu da doca | Folha |
| --- | --- | --- | --- |
| Topo | oculto ✓ | oculto ✓ | fechada |
| Rolado até a Mesa | visível ✓ | visível ✓ | fechada |
| Menu aberto | oculto ✓ | oculto ✓ | aberta, foco no ✕ ✓ |
| Toque em “Ambientes” | volta ✓ | volta ✓ | fecha e rola ✓ |
| Na reserva | oculto ✓ | oculto ✓ (mudança da implementação: o botão cobria o aceite de privacidade) | — |

Também nos topos de 375×667, 360×740 e 430×932: 0 px de overflow horizontal e console sem erros.
