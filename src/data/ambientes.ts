import { pendente } from '../lib/conteudo';

// Ambientes públicos do Âmbar: Jardim, Salão principal e Lounge (2026-10-17). As fotos atuais valem por enquanto.
// Quais ambientes aceitam reserva e a capacidade de cada um: PENDENTE (proprietários) — o site não exibe capacidade.
export const ambientes = {
  jardim: { id: 'jardim', nome: 'Jardim', tagline: 'jardim', foto: 'ambientes/sala-04-jardim.webp', alt: 'Jardim com mesas de madeira e plantas' },
  salao: { id: 'salao', nome: 'Salão principal', tagline: 'salão principal', foto: 'ambientes/sala-03-salao.webp', alt: 'Salão principal de parede laranja com luminária pendente acesa' },
  lounge: { id: 'lounge', nome: 'Lounge', tagline: 'lounge', foto: 'ambientes/sala-01-lounge.webp', alt: 'Lounge com sofá verde' },
};

/** Ambientes oferecidos na comanda. A lista real virá da API ou dos proprietários. */
export const reservaveis = {
  opcoes: [ambientes.jardim, ambientes.salao, ambientes.lounge].map(({ id, nome }) => ({ id, nome })),
  status: pendente('Quais ambientes aceitam reserva e a capacidade de cada um'),
};
