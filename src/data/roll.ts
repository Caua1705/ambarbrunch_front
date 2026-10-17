// A Roll é a assinatura gastronômica integrada ao Âmbar Brunch — não é uma loja (sem preço, sem compra, sem delivery).
export const roll = {
  instagram: { handle: '@roll.ofc', url: 'https://www.instagram.com/roll.ofc/' },
  lead: 'Os cinnamon rolls do Âmbar Brunch levam a assinatura da Roll: massa enrolada, glacê e sabores que mudam com o mês.',
  /** Sabores fixos citados nas legendas dos posts da Roll (ago/2026). Fotos: Instagram da Roll, autorizadas em 2026-10-17. */
  bandejas: [
    { sabor: 'Biscoff', foto: 'roll/bandeja-biscoff.webp', alt: 'Bandeja de cinnamon rolls de Biscoff', id: 'IG-OPT-06' },
    { sabor: 'Red velvet', foto: 'roll/bandeja-red-velvet.webp', alt: 'Bandeja de cinnamon rolls red velvet', id: 'IG-09' },
    { sabor: 'Oreo', foto: 'roll/bandeja-oreo.webp', alt: 'Bandeja de cinnamon rolls de Oreo', id: 'IG-OPT-07' },
  ],
  bandejasAutorizadas: true,
  /** Sabores que já passaram pela fornada — legendas e cardápios da própria Roll (ago–out/2026). Apresentados como
   *  histórico, nunca como disponibilidade do dia: os sabores mudam todo mês. */
  sabores: ['Tradicional', 'Oreo', 'Biscoff', 'Red velvet', 'Pistache', 'Mirtilo', 'Nutella', 'Mood cheesecake', 'S’mores', 'Kinder Bueno'],
  /** Bastidores da própria Roll: vídeos reexportados sem áudio (npm run media:video), autorizados em 2026-10-17.
   *  Vídeos de criadores ficam em data/criadores.ts (seção “Quem provou, conta”). */
  videos: [
    { id: 'IV-06', arquivo: 'roll-do-forno', poster: 'roll/poster-do-forno.webp', tag: 'do forno', descricao: 'carrinho de forno com fornadas de cinnamon rolls', autor: '@roll.ofc', tipo: 'roll', autorizado: true },
    // 2º trecho do IV-06 (sem texto na imagem): o IV-09 tinha “Outubro” gravado e ficaria datado
    { id: 'IV-06b', arquivo: 'roll-sabores-do-mes', poster: 'roll/poster-sabores-do-mes.webp', tag: 'sabores do mês', descricao: 'fornada de cinnamon rolls de Nutella saindo do rack', autor: '@roll.ofc', tipo: 'roll', autorizado: true },
    { id: 'IV-08', arquivo: 'roll-bandeja', poster: 'roll/poster-bandeja.webp', tag: 'bandeja', descricao: 'bandeja de cinnamon rolls com cobertura de chocolate', autor: '@roll.ofc', tipo: 'roll', autorizado: true },
  ] as { id: string; arquivo: string; poster: string; tag: string; descricao: string; autor: string; tipo: 'roll'; autorizado: boolean }[],
  /** Fotos de um roll só (recortes da IG-02, bandeja de estreia da Roll). A autorização de 2026-10-17 cobriu IG-06/08/09,
   *  NÃO a IG-02: até confirmar, os arquivos ficam em src/assets/media/revisao/ (fora do Git) e só aparecem na revisão.
   *  Sem eles, o hero volta ao croissant e a “anatomia” não aparece. Ao autorizar: mover para roll/ e marcar true. */
  /** Abertura de “Direto da fornada”: espiral de creme, caramelo e canela — vídeo ABSTRATO criado por IA (Veo 3, enviado
   *  pelo responsável do projeto em 2026-10-17). Ilustração, nunca apresentada como produto servido nem como bastidor real.
   *  Reprodução única (o 1º e o último quadro não se emendam), sem áudio, sob demanda; movimento reduzido = só a capa. */
  espiral: {
    arquivo: 'roll-espiral-caramelo',                 // public/media/video/<arquivo>.web.mp4 — 450×800, 8 s, ~950 KB
    capa: 'roll/espiral-caramelo-poster.webp',        // capa estática (fallback e estado antes de tocar)
    inicio: 'roll/espiral-caramelo-inicio.webp',      // 1º quadro: o vídeo entra por baixo da capa sem salto
    alt: 'Ilustração em movimento: uma espiral de creme e caramelo polvilhada de canela',
    legenda: 'ilustração animada',
  },
  fotos: {
    hero: { foto: 'revisao/hero-roll-espiral.webp', alt: 'Cinnamon roll em espiral, recém-saído da fornada, entre rolls red velvet', id: 'IG-02', autorizado: false },
    /** caixas abertas da Roll (pág. 10 da proposta; a caixa existe — ver IG-25). Confirmar o uso da imagem. */
    caixas: { foto: 'revisao/cardapio/roll-caixas.webp', alt: 'Caixas abertas da Roll com cinnamon rolls de vários sabores', id: 'MK-06', autorizado: false },
    anatomia: { foto: 'revisao/roll-anatomia.webp', alt: 'Cinnamon roll visto de cima, com a espiral de canela à mostra', id: 'IG-02', autorizado: false },
  },
};
