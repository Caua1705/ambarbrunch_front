import { pendente } from '../lib/conteudo';

// A Roll é a assinatura gastronômica integrada ao Âmbar Brunch — não é uma loja (sem preço, sem compra, sem delivery).
export const roll = {
  instagram: { handle: '@roll.ofc', url: 'https://www.instagram.com/roll.ofc/' },
  lead: 'Os cinnamon rolls do Âmbar Brunch levam a assinatura da Roll: massa enrolada, glacê e sabores que mudam com o mês.',
  /** Sabores fixos citados nas legendas dos posts da Roll (ago/2026). Fotos: Instagram da Roll, autorização pendente. */
  bandejas: [
    { sabor: 'Biscoff', foto: 'roll/bandeja-biscoff.webp', alt: 'Bandeja de cinnamon rolls de Biscoff', id: 'IG-OPT-06' },
    { sabor: 'Red velvet', foto: 'roll/bandeja-red-velvet.webp', alt: 'Bandeja de cinnamon rolls red velvet', id: 'IG-09' },
    { sabor: 'Oreo', foto: 'roll/bandeja-oreo.webp', alt: 'Bandeja de cinnamon rolls de Oreo', id: 'IG-OPT-07' },
  ],
  bandejasAutorizadas: false,
  sabores: { fixos: ['Tradicional', 'Oreo', 'Biscoff', 'Red velvet'], doMes: pendente('Sabores do mês atuais (mudam todo mês)') },
  /** Vídeos reexportados sem áudio (npm run media:video). Crédito sempre visível; só com autorização. */
  videos: [
    { id: 'IV-06', arquivo: 'roll-do-forno', poster: 'roll/poster-do-forno.webp', tag: 'do forno', descricao: 'carrinho de forno com fornadas de cinnamon rolls', autor: '@roll.ofc', tipo: 'roll', autorizado: false },
    { id: 'IV-09', arquivo: 'roll-sabores-do-mes', poster: 'roll/poster-sabores-do-mes.webp', tag: 'sabores do mês', descricao: 'closes de cinnamon rolls com cobertura', autor: '@roll.ofc', tipo: 'roll', autorizado: false },
    { id: 'IV-08', arquivo: 'roll-bandeja', poster: 'roll/poster-bandeja.webp', tag: 'bandeja', descricao: 'bandeja de cinnamon rolls com cobertura de chocolate', autor: '@roll.ofc', tipo: 'roll', autorizado: false },
  ] as { id: string; arquivo: string; poster: string; tag: string; descricao: string; autor: string; tipo: 'roll' | 'criadora'; autorizado: boolean }[],
};
