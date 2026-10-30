// Períodos da Lista e da visão por Ambientes (os mesmos do painel anterior: Hoje, Amanhã, Próximos 7 dias e Todas).
// "Todas" começa 30 dias atrás, como o painel anterior lia: a operação olha para frente; o histórico fica na ficha do
// cliente. Para o Atendente o backend corta a janela em hoje…+14 dias sozinho.
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { hojeISO, somarDias } from '../../lib/formato';

export type Periodo = 'hoje' | 'amanha' | 'semana' | 'todas';

export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'amanha', rotulo: 'Amanhã' },
  { valor: 'semana', rotulo: 'Próximos 7 dias' },
  { valor: 'todas', rotulo: 'Todas' },
];

export const NO_PERIODO: Record<Periodo, string> = { hoje: 'hoje', amanha: 'amanhã', semana: 'nos próximos 7 dias', todas: 'no total' };

export function intervalo(p: Periodo): { data_de: string; data_ate?: string } {
  const hoje = hojeISO();
  if (p === 'hoje') return { data_de: hoje, data_ate: hoje };
  if (p === 'amanha') return { data_de: somarDias(hoje, 1), data_ate: somarDias(hoje, 1) };
  if (p === 'semana') return { data_de: hoje, data_ate: somarDias(hoje, 7) };
  return { data_de: somarDias(hoje, -30) };
}

export const lerPeriodo = (v: string | null): Periodo => (v === 'hoje' || v === 'amanha' || v === 'semana' || v === 'todas' ? v : 'todas');

/** Todas as reservas do período (todas as páginas), em cache compartilhado entre a Lista e os Ambientes. */
export function useReservasDoPeriodo(p: Periodo) {
  const f = intervalo(p);
  return useConsulta(`reservas?periodo:${p}:${f.data_de}`, () => reservas.listarTodas(f), { intervalo: 60_000 });
}

/** Ordem do painel anterior: canceladas no fim; o resto por data e hora. */
export function ordenar<T extends { data: string; hora: string; status_reserva?: string; status: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => Number((a.status_reserva ?? a.status) === 'cancelada') - Number((b.status_reserva ?? b.status) === 'cancelada') || (a.data + a.hora).localeCompare(b.data + b.hora));
}
