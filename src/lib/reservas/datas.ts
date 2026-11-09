// Datas da comanda de reserva: a janela reservável e o "hoje" no fuso do restaurante. Sem estado nem DOM — usado pela
// ilha (islands/ReservaFlow.tsx) e pelo calendário (components/reserva/Calendario.tsx).
import { visita } from '../../data/visita';

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Primeira data de visita aceita (inclusive), em qualquer modo: o calendário começa nela e nenhum caminho (teclado,
 *  troca de mês, estado antigo) leva a horários ou envio antes dela. A API recusa o mesmo (422 antes_da_abertura). */
export const PRIMEIRA_DATA = visita.reservasDesde;
/** O Âmbar funciona de terça a domingo; segunda é fechado (responsável, 08/11/2026). Vale em todo modo da comanda, mesmo
 *  que a API ofereça horários numa segunda: o site nunca deixa escolher nem enviar. */
export const MSG_SEGUNDA = 'Não funcionamos às segundas-feiras. Escolha uma data de terça a domingo.';
/** "AAAA-MM-DD" cai numa segunda-feira? Só pelo calendário (meio-dia UTC da própria data): não depende do fuso do
 *  navegador — a data já é a de Fortaleza (hojeNoFuso). */
export function ehSegunda(v: string): boolean {
  const [a, m, d] = v.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay() === 1;
}
/** A data pode ser reservada? Mesma janela do calendário: [max(hoje, PRIMEIRA_DATA), hoje + diasMax], sem segundas
 *  e sem dias fechados. */
export function dataPermitida(v: string, hoje: Date, diasMax: number, fechadas?: ReadonlySet<string>): boolean {
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + diasMax);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= PRIMEIRA_DATA && v >= iso(hoje) && v <= iso(fim) && !ehSegunda(v) && !fechadas?.has(v);
}
/** Primeira data em que se pode reservar: max(hoje, PRIMEIRA_DATA), pulando a segunda. */
export function primeiraDataAberta(hoje: Date): string {
  const base = iso(hoje) > PRIMEIRA_DATA ? iso(hoje) : PRIMEIRA_DATA;
  if (!ehSegunda(base)) return base;
  const [a, m, d] = base.split('-').map(Number);
  return iso(new Date(a, m - 1, d + 1));
}
/** “Hoje” no fuso do restaurante (config.fusoHorario), não no do navegador: quem abre o site à noite noutro fuso
 *  não pode ver liberado um dia que em Fortaleza já passou (nem perder o dia que lá ainda é hoje). */
export function hojeNoFuso(fuso?: string): Date {
  const agora = new Date();
  if (!fuso) return agora;
  try {
    const [a, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(agora).split('-').map(Number);
    return new Date(a, m - 1, d);
  } catch {
    return agora;
  }
}
