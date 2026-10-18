# Menu e CTA fixo de reservas — Fornada Âmbar

> Decisão aprovada em 2026-10-16: **com menu**, discreto e elegante, sem comprometer a composição. **Reservar continua sendo a ação principal.**
> Revisada na rodada final (2026-10-17): **um único botão fixo** na base da tela, menu no alto, folha sem contatos e com saída animada.
> Código: [`components/menu.css`](../../../src/styles/components/menu.css), [`components/sticky-cta.css`](../../../src/styles/components/sticky-cta.css),
> [`lib/nav-sheet.js`](../../../src/lib/nav-sheet.js), [`lib/sticky-cta.js`](../../../src/lib/sticky-cta.js).
> Testes: `tests/e2e/navegacao.spec.ts`.

## 1. Por que este desenho

- **Sem cabeçalho fixo:** uma barra no topo competiria com a etiqueta do logo e cortaria o hero.
- **O menu é um objeto da colagem:** no hero, um selo manteiga de 44 px colado na ponta da etiqueta, como os selos da Roll.
  Quando ele sai da tela, o mesmo selo (48 px) fica fixo no canto superior direito.
- **A base da tela é só da reserva:** UM botão grande “Reservar mesa” — creme, texto vinho, borda vinho, sombra cacau,
  espiral e seta dentro do mesmo botão. Antes havia um quadrado de menu ao lado; ele saiu (rodada final).
- **Dentro do menu**, o único botão cheio é “Reservar mesa” (vinho).

## 2. Estados do CTA fixo — pela posição das seções, nunca por um valor fixo de rolagem

| Onde a pessoa está | CTA fixo | Selo fixo do menu |
| --- | --- | --- |
| Hero | oculto (o hero tem o próprio botão) | oculto (o selo do hero está na tela) |
| Novo capítulo · Para sua mesa | oculto | visível |
| Direto da fornada (o topo da seção passa de 60% da altura da tela) | **aparece** | visível |
| Café + Roll · Saladas & bowls · Provou, conta · Escolha seu lugar · Visite | visível | visível |
| Reserva (≥ 30% da tela ou 240 px) | **oculto** (cobriria campos e o aceite) | visível |
| Rodapé começando a aparecer | **oculto** (não cobre o rodapé) | visível |
| Campo de texto com foco (teclado aberto) | oculto | visível |
| Menu aberto (inclusive durante a saída animada) | oculto | oculto |
| Rolagem disparada por um item do menu | oculto até a rolagem assentar (não pisca no caminho) | visível |

- “Chegou em Direto da fornada” é lido na rolagem (uma leitura por quadro): num salto do rodapé ao topo a seção não cruza
  a tela, e um IntersectionObserver não avisaria.
- Oculto = `aria-hidden="true"`, `tabindex="-1"` e **sem clique** (`pointer-events: none`).
- Páginas sem “Direto da fornada” (ex.: `/reservar`) usam a regra antiga: o CTA aparece quando o botão do hero sai.

## 3. Folha do menu

- `<dialog>` modal nativo: o navegador prende o foco e coloca o resto da página como inerte; o `html` não rola enquanto
  ela está aberta (`:has(.sheet[open])`).
- Conteúdo: **logo · Cardápio · Fornada · Café + Roll · Saladas & bowls · Provou, conta · Ambientes · Visite · “Reservar
  mesa” · ✕**. Sem endereço, horário, WhatsApp ou Instagrams (ficam completos na seção Visite).
- **Entrada:** a folha sobe e assenta; itens e botão chegam em sequência.
- **Saída (rodada final):** espelho da entrada, 340 ms (`--dur-sheet-out`) — itens descem e somem, a folha desce, o fundo
  clareia. O `dialog` só fecha de verdade quando a animação termina (`data-fechando` → `close()`), então nada some de uma vez.
  Vale para ✕, **Esc** (o `cancel` é segurado), toque fora e escolha de um item. Movimento reduzido: fecha direto.
- Tocar num item fecha a folha, rola até a seção e põe o foco nela; senão o foco volta ao botão que abriu.
- Desktop (≥ 960 px): a folha vira um painel lateral de 420 px (entra e sai pela direita).

## 4. Acessibilidade

- Botões de menu com `aria-label="Abrir menu"`, `aria-haspopup="dialog"`, `aria-controls` e `aria-expanded`.
- “Pular para a reserva” é o primeiro elemento focável da página.
- Alvos: selo do hero 44 px, selo fixo 48 px, ✕ 44 px, CTA fixo 62 px de altura, itens da folha ≥ 54 px.

## 5. Ambientes → comanda

Cada ambiente de “Escolha seu lugar” é um link que cobre o card inteiro (foto e nome). O toque escolhe o ambiente na
comanda (`ambar:ambiente`, mesmo antes de a ilha carregar), rola suave até a reserva sem deixar `#reservar` na URL e o
chip do ambiente pulsa uma vez. É só pré-seleção: nada é reservado.
