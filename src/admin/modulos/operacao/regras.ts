// Modo Operação — leitura da agenda do dia para o tablet. Só organiza o que o backend devolveu em /reservas/operacao:
// nenhuma regra de negócio nova (atraso e tolerância vêm do backend em `atrasada`; quem pode o quê, o backend confere).
import type { OperacaoReserva } from '../../lib/tipos/reservas';
import { statusDe, statusBase, confirmadaBase, emAberto } from '../reservas/comum';

/** Situação de uma reserva para quem está no salão, do mais urgente ao mais tranquilo. */
export type Momento =
  | 'atrasada' // passou da tolerância e ninguém registrou a chegada (o backend decide: `atrasada`)
  | 'agora' // horário já começou, ainda dentro da tolerância
  | 'em_breve' // começa nos próximos 30 min
  | 'mais_tarde'
  | 'sem_registro' // o horário inteiro já passou e a chegada não foi registrada
  | 'pendente' // aguardando aprovação da gerência
  | 'chegou'
  | 'nao_veio'
  | 'cancelada';

export const EM_BREVE_MIN = 30;
/** Chegada muito antes do horário pede um segundo toque (evita marcar a reserva errada; o Atendente não desfaz). */
export const ANTECIPADA_MIN = 60;

const inicioMs = (r: OperacaoReserva) => new Date(r.inicio ?? `${r.data}T${r.hora.slice(0, 5)}:00-03:00`).getTime();
const fimMs = (r: OperacaoReserva) => (r.fim ? new Date(r.fim).getTime() : inicioMs(r) + r.duracao_min * 60_000);

export function momento(r: OperacaoReserva, agora: number): Momento {
  const s = statusDe(r);
  if (statusBase(r) === 'cancelada') return 'cancelada';
  if (s === 'compareceu') return 'chegou';
  if (s === 'nao_compareceu') return 'nao_veio';
  if (s === 'pendente') return 'pendente';
  if (fimMs(r) <= agora) return 'sem_registro';
  if (r.atrasada) return 'atrasada';
  if (inicioMs(r) <= agora) return 'agora';
  if (inicioMs(r) - agora <= EM_BREVE_MIN * 60_000) return 'em_breve';
  return 'mais_tarde';
}

export const ehAtencao = (m: Momento) => m === 'atrasada' || m === 'sem_registro' || m === 'pendente';
const ehFinal = (m: Momento) => m === 'chegou' || m === 'nao_veio' || m === 'cancelada';

/** "Cliente chegou": reserva confirmada, sem registro, de hoje (o backend aceita a partir do dia da reserva). */
export const aceitaChegada = (r: OperacaoReserva, hoje: string) => r.data === hoje && confirmadaBase(r) && emAberto(r);
export const chegadaAntecipada = (r: OperacaoReserva, agora: number) => inicioMs(r) - agora > ANTECIPADA_MIN * 60_000;
/** "Não veio" só depois que o backend sinaliza o atraso (tolerância da política) ou o horário acabou. */
export const aceitaAusencia = (r: OperacaoReserva, agora: number) => confirmadaBase(r) && emAberto(r) && (r.atrasada || fimMs(r) <= agora);

export interface Resumo {
  reservas: number;
  pessoas: number;
  chegaram: number;
  pessoasChegaram: number;
  aChegar: number;
  atencao: number;
}

export function resumir(lista: OperacaoReserva[], agora: number): Resumo {
  const r: Resumo = { reservas: 0, pessoas: 0, chegaram: 0, pessoasChegaram: 0, aChegar: 0, atencao: 0 };
  for (const x of lista) {
    const m = momento(x, agora);
    if (m === 'cancelada') continue;
    r.reservas++;
    r.pessoas += x.pessoas;
    if (m === 'chegou') {
      r.chegaram++;
      r.pessoasChegaram += x.pessoas;
    }
    if (!ehFinal(m) && m !== 'pendente') r.aChegar++;
    if (ehAtencao(m)) r.atencao++;
  }
  return r;
}

const PRIORIDADE: Record<Momento, number> = { atrasada: 0, agora: 1, em_breve: 2, pendente: 3, mais_tarde: 3, sem_registro: 4, chegou: 5, nao_veio: 6, cancelada: 7 };
const porHora = (a: OperacaoReserva, b: OperacaoReserva) => a.hora.localeCompare(b.hora) || a.contato_nome.localeCompare(b.contato_nome, 'pt-BR');

/**
 * Próximas: o que ainda pede ação, do mais urgente (atrasadas, já no horário) para o mais tarde; dentro de cada faixa,
 * pela hora. As que já terminaram sem registro vêm por último (resolver depois do movimento).
 */
export function proximas(lista: OperacaoReserva[], agora: number): OperacaoReserva[] {
  return lista
    .map((r) => ({ r, m: momento(r, agora) }))
    .filter(({ m }) => !ehFinal(m))
    .sort((a, b) => PRIORIDADE[a.m] - PRIORIDADE[b.m] || porHora(a.r, b.r))
    .map(({ r }) => r);
}

/** Dia inteiro: tudo pela hora; canceladas no fim. */
export function diaInteiro(lista: OperacaoReserva[]): OperacaoReserva[] {
  return [...lista].sort((a, b) => Number(statusBase(a) === 'cancelada') - Number(statusBase(b) === 'cancelada') || porHora(a, b));
}

/** Depois que o servidor confirma a chegada, a linha muda na hora (antes da próxima leitura da agenda). */
export function comChegada(r: OperacaoReserva, em: string): OperacaoReserva {
  return { ...r, status: 'compareceu', comparecimento: 'compareceu', comparecimento_registrado_em: em, minutos_de_atraso: null, atrasada: false };
}
