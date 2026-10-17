// Títulos e subtítulos das seções da homepage — copies finais aprovadas (2026-10-17). Ordem = ordem da página.
// `linhas` = linhas do mega título (a 2ª vai para a direita, salvo `direita`); `sub` = subtítulo manuscrito (scribble).
export const secoes = {
  hero: { linhas: ['Café,', 'brunch', '& rolls'] },
  novo: { id: 'novo', linhas: ['O Âmbar,', 'agora', 'brunch.'], sub: 'com fornadas assinadas pela Roll' },
  mesa: { id: 'gastronomia', linhas: ['Para', 'sua mesa'], sub: 'do brunch ao café gelado' },
  fornada: { id: 'roll', linhas: ['Direto da', 'fornada'], sub: 'Da massa à primeira mordida.', sabores: 'Os sabores mudam. A vontade fica.' },
  cafeRoll: { id: 'cafe-roll', linhas: ['Café', '+ Roll'], sub: 'combinações que fazem sentido do primeiro gole à primeira mordida' },
  saladas: { id: 'saladas', linhas: ['Saladas', '& bowls'], sub: 'leve, fresco e cheio de cor' },
  provou: { id: 'quem-provou', linhas: ['Quem', 'provou,', 'conta'], direita: [2], sub: 'Reviews reais de quem provou a Roll.' },
  lugar: { id: 'ambientes', linhas: ['Escolha', 'seu lugar'], sub: 'jardim, salão, lounge ou sala privativa' },
  reserva: { id: 'reservar', linhas: ['Reserve', 'sua mesa'], sub: 'Seu próximo encontro começa aqui.' },
  visite: { id: 'visite', linhas: ['Visite', 'o Âmbar'], sub: 'a mesa tá posta' },
} as const;
