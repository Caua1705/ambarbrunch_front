// “Por dentro do prato” — um prato do menu saudável em destaque, com ficha nutricional.
// Prato e ingredientes: cardápio do cliente (“Salada de atum”). Foto: proposta Âmbar × Roll (pág. 12), ilustrativa.
//
// FICHA NUTRICIONAL: números FICTÍCIOS (kit criativo, nutricao-schema-demo.json) só para a revisão visual.
// `demo: true` → a seção inteira fica FORA do build de produção. Para publicar: trocar pelos valores da ficha técnica
// real (nutricionista/fornecedor), marcar `demo: false` e confirmar a foto.
export const prato = {
  demo: true,
  linha: 'menu saudável',
  nome: 'Salada de atum',
  texto: 'Atum, abacate e folhas frescas com um toque de shoyu e a doçura da manga. Leve o bastante para o meio da manhã, inteira o bastante para virar almoço.',
  ingredientes: ['atum', 'abacate', 'mix de folhas', 'pepino', 'shoyu', 'manga'],
  /** marcadores sobre a foto (só o que aparece nela) — posição em % da foto */
  marcadores: [
    { nome: 'atum', x: 66, y: 30 },
    { nome: 'abacate', x: 30, y: 26 },
    { nome: 'pepino', x: 84, y: 60 },
    { nome: 'folhas', x: 14, y: 62 },
  ],
  foto: { src: 'revisao/cardapio/salada-atum.webp', alt: 'Salada de atum com abacate, pepino, tomate e folhas numa tigela clara', confirmado: false },
  porcao: '300 g',
  /** valores por porção — FICTÍCIOS (demo) */
  nutricao: [
    { rotulo: 'Energia', valor: 320, unidade: 'kcal', max: 600 },
    { rotulo: 'Proteínas', valor: 14, unidade: 'g', max: 40 },
    { rotulo: 'Carboidratos', valor: 24, unidade: 'g', max: 80 },
    { rotulo: 'Gorduras totais', valor: 18, unidade: 'g', max: 40 },
    { rotulo: 'Fibra alimentar', valor: 5, unidade: 'g', max: 15 },
    { rotulo: 'Sódio', valor: 410, unidade: 'mg', max: 1200 },
  ],
};
