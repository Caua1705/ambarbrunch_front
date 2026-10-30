// Reserva → agenda: o botão “Adicionar à agenda” abre o Google Agenda com o evento já preenchido (link de criação de
// evento do Google; sem login no site nem permissão — a pessoa só salva). Usado pela página de confirmação
// (/reserva-confirmada/) e pela confirmação dentro da comanda.
import { visita } from '../data/visita';

/** O mínimo da reserva confirmada que a agenda usa (dados do backend; nada de nome, telefone ou e-mail). */
export interface ReservaAgenda {
  codigo: string;
  status: 'confirmada' | 'pendente';
  ambienteNome: string;
  pessoas: number;
  data: string;          // AAAA-MM-DD, dia do café
  hora: string;          // HH:MM, hora do café
  duracaoMin?: number;   // duração da reserva, vinda do backend
}

/** Fuso do café, quando a configuração da API não o informa. */
export const FUSO_CAFE = 'America/Fortaleza';

const pad = (n: number) => String(n).padStart(2, '0');

/** Data e hora do café somadas de `min` minutos, no formato do Google Agenda (AAAAMMDDTHHMMSS, sem “Z”: o fuso vai em
 *  `ctz`). A conta é feita em UTC só para virar o dia certo (16:00 + 180 min = 19:00; 23:00 + 180 min = 02:00 do dia seguinte). */
function horaLocalGoogle(data: string, hora: string, min = 0): string {
  const [y, m, d] = data.split('-').map(Number); const [h, mi] = hora.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, mi + min));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

/** Google Agenda já preenchido: título, início e fim (duração da reserva vinda do backend; sem ela, só o início), fuso
 *  do café, endereço e, na descrição, ambiente e pessoas. O código da reserva não vai no evento. */
export function linkGoogleAgenda(r: ReservaAgenda, fuso = FUSO_CAFE): string {
  const inicio = horaLocalGoogle(r.data, r.hora);
  const fim = r.duracaoMin ? horaLocalGoogle(r.data, r.hora, r.duracaoMin) : inicio;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Reserva no Âmbar Café',
    dates: `${inicio}/${fim}`,
    ctz: fuso,
    details: `${r.ambienteNome} · ${r.pessoas} ${r.pessoas === 1 ? 'pessoa' : 'pessoas'}${r.status === 'pendente' ? ' · aguardando a aprovação da equipe' : ''}`,
    location: `Âmbar Café, ${visita.endereco}, ${visita.cidade}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
