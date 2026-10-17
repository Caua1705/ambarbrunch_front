// Café e bebidas — gelados do cardápio “Cafés gelados” do Âmbar Café (arte do cliente, recebida em 2026-10-16). Sem preços.
// Camadas visuais: copos e combo são artes da PROPOSTA Âmbar × Roll (págs. 3 e 9) → `confirmado: false`, só na revisão
// até o cliente confirmar que representam as embalagens reais. As caixas da Roll (pág. 10) aparecem em “Direto da fornada”.
export const bebidas = {
  destaques: ['gelados autorais', 'matcha', 'lattes', 'clássicos'],
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
  /** Também no balcão (categorias da proposta). */
  classicos: ['Cappuccino', 'Frappé', 'Cafés diversos', 'Chá', 'Smoothies proteicos'],
  camadas: [
    { src: 'revisao/cardapio/bebidas-copos.webp', alt: 'Dois cafés gelados nos copos Âmbar × Roll: matcha latte e latte', confirmado: false },
    { src: 'revisao/cardapio/bebidas-combo.webp', alt: 'Café gelado no copo Âmbar × Roll ao lado de um cinnamon roll na caixa da Roll', confirmado: false },
  ],
} as const;
