// Dados oficiais de visita (confirmados pelo responsável do projeto em 2026-10-17).
// Estacionamento/acessibilidade: ainda sem informação — o site simplesmente não fala disso.
// 2026-10-23: número corrigido pelo responsável — 1580 (não 180), bairro Meireles.
const enderecoBusca = 'Rua Tavares Coutinho, 1580, Meireles, Fortaleza, CE';

export const visita = {
  dominio: 'ambarbrunch.com',
  endereco: 'Rua Tavares Coutinho, 1580',
  cidade: 'Meireles, Fortaleza - CE',
  mapaUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoBusca)}`,
  horarios: [{ dias: 'Todos os dias', horas: '07h às 19h' }],
  horarioCurto: 'todos os dias · 07h–19h',
  whatsapp: { numero: '(85) 99445-2724', url: 'https://wa.me/5585994452724' },
  instagram: { handle: '@ambarbrunch', url: 'https://www.instagram.com/ambarbrunch/' },
};
