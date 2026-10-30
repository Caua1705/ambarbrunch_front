// Reserva → agendas: o mesmo evento no Google Agenda (link de criação, sem login no site) e no arquivo .ics (Apple,
// Outlook e outros). Usado pela página de confirmação (/reserva-confirmada/) e pela confirmação dentro da comanda.
import { visita } from '../data/visita';

/** O mínimo da reserva confirmada que as agendas usam (dados do backend; nada de nome, telefone ou e-mail). */
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

interface EventoAgenda { titulo: string; local: string; descricao: string }
function evento(r: ReservaAgenda): EventoAgenda {
  return {
    titulo: 'Reserva no Âmbar Café',
    local: `Âmbar Café, ${visita.endereco}, ${visita.cidade}`,
    descricao: `${r.ambienteNome} · ${r.pessoas} ${r.pessoas === 1 ? 'pessoa' : 'pessoas'}${r.status === 'pendente' ? ' · aguardando a aprovação da equipe' : ''}`,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Data e hora do café somadas de `min` minutos, no formato do Google Agenda (AAAAMMDDTHHMMSS, sem “Z”: o fuso vai em
 *  `ctz`). A conta é feita em UTC só para virar o dia certo (16:00 + 180 min = 19:00; 23:00 + 180 min = 02:00 do dia seguinte). */
function horaLocalGoogle(data: string, hora: string, min = 0): string {
  const [y, m, d] = data.split('-').map(Number); const [h, mi] = hora.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, mi + min));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

/** Google Agenda já preenchido (modelo de evento público do Google, sem login nem permissão: a pessoa só salva).
 *  Fim = início + duração da reserva vinda do backend; sem duração, o evento fica só com o início. */
export function linkGoogleAgenda(r: ReservaAgenda, fuso = FUSO_CAFE): string {
  const ev = evento(r);
  const inicio = horaLocalGoogle(r.data, r.hora);
  const fim = r.duracaoMin ? horaLocalGoogle(r.data, r.hora, r.duracaoMin) : inicio;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.titulo, dates: `${inicio}/${fim}`, ctz: fuso, details: ev.descricao, location: ev.local });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/**
 * Início da reserva para o .ics em UTC (…Z): data e hora são do fuso do café, e a agenda de quem está em outro fuso
 * mostra o horário certo. Sem o fuso (ou sem suporte a longOffset), fica no horário local "flutuante", como antes.
 */
export function inicioIcs(data: string, hora: string, fuso?: string): string {
  const [y, m, d] = data.split('-'); const [h, min] = hora.split(':');
  const flutuante = `${y}${m}${d}T${h}${min}00`;
  if (!fuso) return flutuante;
  try {
    const meioDia = new Date(`${data}T12:00:00Z`);
    const nome = new Intl.DateTimeFormat('en-US', { timeZone: fuso, timeZoneName: 'longOffset' })
      .formatToParts(meioDia).find((p) => p.type === 'timeZoneName')?.value ?? '';
    const desvio = nome === 'GMT' ? '+00:00' : nome.replace('GMT', '');
    if (!/^[+-]\d{2}:\d{2}$/.test(desvio)) return flutuante;
    const inicio = new Date(`${data}T${h}:${min}:00${desvio}`);
    return Number.isNaN(inicio.getTime()) ? flutuante : inicio.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  } catch {
    return flutuante;
  }
}

/** Texto de propriedade do .ics (RFC 5545 §3.3.11): barra, ponto e vírgula, vírgula e quebra de linha escapados. */
const textoIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Linhas do .ics com no máximo 75 octetos (RFC 5545 §3.1), dobradas sem partir um caractere acentuado ao meio. */
function dobrarIcs(linha: string): string {
  const bytes = new TextEncoder();
  const partes: string[] = [];
  let atual = ''; let tam = 0;
  for (const c of linha) {
    const n = bytes.encode(c).length;
    if (tam + n > (partes.length ? 74 : 75)) { partes.push(atual); atual = ''; tam = 0; }
    atual += c; tam += n;
  }
  partes.push(atual);
  return partes.join('\r\n ');
}

/** Arquivo .ics com os mesmos dados do Google Agenda, como link de download (data:). O código só vai no UID, que
 *  identifica o evento para a agenda não o duplicar; não aparece no evento. */
export function linkIcs(r: ReservaAgenda, fuso = FUSO_CAFE): string {
  const ev = evento(r);
  const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ambar Cafe//Reserva//PT', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${r.codigo}@ambarbrunch`, `DTSTAMP:${utc(new Date())}`, `DTSTART:${inicioIcs(r.data, r.hora, fuso)}`,
    ...(r.duracaoMin ? [`DURATION:PT${r.duracaoMin}M`] : []),
    `SUMMARY:${textoIcs(ev.titulo)}`, `LOCATION:${textoIcs(ev.local)}`, `DESCRIPTION:${textoIcs(ev.descricao)}`,
    'END:VEVENT', 'END:VCALENDAR'];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(`${linhas.map(dobrarIcs).join('\r\n')}\r\n`)}`;
}

/** Nome do arquivo .ics baixado (sem o código: ele não aparece para o cliente). */
export const nomeIcs = (r: ReservaAgenda) => `reserva-ambar-${r.data}.ics`;
