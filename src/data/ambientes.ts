import { pendente } from '../lib/conteudo';

// Fotos FR-01…04: espaço ANTERIOR (antes da intervenção). Trocar pelas fotos novas quando existirem.
// Quais ambientes aceitam reserva e a capacidade de cada um: PENDENTE (proprietários).
export const ambientes = {
  jardim: { id: 'jardim', nome: 'Jardim', tagline: 'luz do jardim', foto: 'ambientes/sala-04-jardim.webp', alt: 'Jardim com mesas de madeira e plantas', fotoAntiga: true },
  salao: { id: 'salao', nome: 'Salão', tagline: 'luz âmbar', foto: 'ambientes/sala-03-salao.webp', alt: 'Salão de parede laranja com luminária pendente acesa', fotoAntiga: true },
  lounge: { id: 'lounge', nome: 'Lounge', tagline: 'lounge', foto: 'ambientes/sala-01-lounge.webp', alt: 'Lounge com sofá verde', fotoAntiga: true },
  leitura: { id: 'leitura', nome: 'Leitura', tagline: 'leitura', foto: 'ambientes/sala-02-leitura.webp', alt: 'Estante de livros', fotoAntiga: true },
};

/** Ambientes oferecidos na comanda (os do protótipo). A lista real virá da API ou dos proprietários. */
export const reservaveis = {
  opcoes: [ambientes.jardim, ambientes.salao, ambientes.lounge].map(({ id, nome }) => ({ id, nome })),
  status: pendente('Quais ambientes aceitam reserva e a capacidade de cada um'),
};
