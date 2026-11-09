// Dados oficiais de visita (confirmados pelo responsável do projeto em 2026-10-17).
// Estacionamento/acessibilidade: ainda sem informação — o site simplesmente não fala disso.
// 2026-10-23: número corrigido pelo responsável — 1580 (não 180), bairro Meireles.
const enderecoBusca = 'Rua Tavares Coutinho, 1580, Meireles, Fortaleza, CE';

export const visita = {
  dominio: 'ambarbrunch.com',
  endereco: 'Rua Tavares Coutinho, 1580',
  cidade: 'Meireles, Fortaleza - CE',
  mapaUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoBusca)}`,
  // 2026-11-08: o café funciona de terça a domingo; segunda é fechado (responsável). O horário dos dias abertos não mudou.
  horarios: [{ dias: 'Terça a domingo', horas: '07h às 19h' }, { dias: 'Segunda-feira', horas: 'Fechado' }],
  horarioCurto: 'terça a domingo · 07h–19h · segunda fechado',
  // 2026-10-29: sem WhatsApp de atendimento no site (pedido do responsável). O número oficial fica só na política de
  // privacidade, como canal dos pedidos sobre dados pessoais (src/data/privacidade.ts).
  instagram: { handle: '@ambarbrunch', url: 'https://www.instagram.com/ambarbrunch/' },
  /** Primeira data de VISITA reservável pelo site (decisão do responsável, 29/10/2026), inclusive. O backend aplica a
   *  mesma regra (AMBAR_RESERVAS_ABERTURA); a comanda também a impõe, para nada antes dela ser oferecido nem enviado. */
  reservasDesde: '2026-11-09',
};
