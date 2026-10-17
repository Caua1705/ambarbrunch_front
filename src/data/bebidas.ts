// Bebidas — gelados do cardápio “Cafés gelados” do Âmbar Café (arte do cliente, recebida em 2026-10-16). Sem preços.
// Aparecem no cartão “Cafés gelados” do cardápio e nas combinações de Café + Roll (data/cafe-roll.ts).
// Os copos e o combo da proposta Âmbar × Roll são mockups de embalagem: não entram no site como foto de produto.
export const bebidas = {
  gelados: [
    { nome: 'Matcha latte', desc: 'matcha, leite e gelo', tom: 'leaf' },
    { nome: 'Matcha frutas vermelhas', desc: 'matcha, frutas vermelhas, leite e gelo', tom: 'berry' },
    { nome: 'Honey latte', desc: 'café, leite, mel e gelo', tom: 'caramel' },
    { nome: 'Biscoff latte', desc: 'café, leite, pasta Biscoff e gelo', tom: 'caramel' },
    { nome: 'Iced latte', desc: 'espresso, leite e gelo', tom: 'butter' },
    { nome: 'Iced americano', desc: 'café, água e gelo', tom: 'cacao' },
  ],
  /** Leites do mesmo cardápio. */
  leites: ['integral', 'desnatado', 'aveia', 'amêndoas', 'coco', 'vegetal'],
} as const;
