import { pendente } from '../lib/conteudo';

// Os quatro ambientes do Âmbar (2026-10-17): Jardim, Salão principal, Lounge e Sala privativa (a sala do andar de cima).
// Fotos: Jardim e Lounge do acervo aprovado; Salão principal e Sala privativa novas (kit v2, out/2026).
// Descrições: só o que se vê nas fotos. Capacidade e regras de reserva de cada ambiente: PENDENTE — o site não exibe.
export const ambientes = {
  jardim: { id: 'jardim', nome: 'Jardim', tagline: 'jardim', clima: 'mesas de madeira entre as plantas', foto: 'ambientes/sala-04-jardim.webp', alt: 'Jardim com mesas de madeira e plantas' },
  salao: { id: 'salao', nome: 'Salão principal', tagline: 'salão principal', clima: 'parede âmbar e luz baixa', foto: 'ambientes/salao-principal.webp', alt: 'Salão principal de paredes cor de âmbar, mesas redondas e luminárias pendentes acesas' },
  lounge: { id: 'lounge', nome: 'Lounge', tagline: 'lounge', clima: 'sofá e conversa sem pressa', foto: 'ambientes/sala-01-lounge.webp', alt: 'Lounge com banco estofado verde, mesas redondas e poltronas' },
  privativa: { id: 'privativa', nome: 'Sala privativa', tagline: 'sala privativa', clima: 'sofá, poltronas e tapete', foto: 'ambientes/sala-privativa.webp', alt: 'Sala privativa no andar de cima, com sofá, poltronas, mesa de centro e tapete' },
};

/** Ambientes da comanda (ilustrativa enquanto as reservas online não existem). A lista real virá da API ou dos proprietários. */
export const reservaveis = {
  opcoes: [ambientes.jardim, ambientes.salao, ambientes.lounge, ambientes.privativa].map(({ id, nome }) => ({ id, nome })),
  status: pendente('Quais ambientes aceitam reserva e a capacidade de cada um'),
};
