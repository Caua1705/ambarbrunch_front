// Rótulos e ações de reserva compartilhados pela lista, pelo detalhe e pela Visão Geral.
import { ErroApi } from '../../lib/api/cliente';
import { reservas } from '../../lib/api/reservas';
import { invalidar } from '../../lib/consulta';
import { Situacao, type Tom } from '../../ui/base';
import type { ReservaPainel, StatusReserva, Comparecimento } from '../../lib/tipos/reservas';

export const STATUS: Record<StatusReserva, { rotulo: string; tom: Tom; destaque?: boolean }> = {
  pendente: { rotulo: 'Aguardando aprovação', tom: 'atencao', destaque: true },
  confirmada: { rotulo: 'Confirmada', tom: 'ok' },
  lembrada: { rotulo: 'Confirmada · lembrete enviado', tom: 'ok' },
  reconfirmada: { rotulo: 'Reconfirmada pelo cliente', tom: 'ok' },
  cancelada: { rotulo: 'Cancelada', tom: 'apagado' },
  compareceu: { rotulo: 'Chegou', tom: 'marca' },
  nao_compareceu: { rotulo: 'Não veio', tom: 'perigo' },
};

export const CANAL: Record<string, string> = { site: 'Site', whatsapp: 'WhatsApp', telefone: 'Telefone', balcao: 'Balcão', instagram: 'Instagram', painel: 'Painel', importacao: 'Importada' };

/** Status efetivo: o comparecimento registrado vence o status da reserva (igual ao backend). */
export function statusDe(r: Pick<ReservaPainel, 'status' | 'status_reserva' | 'comparecimento'>): StatusReserva {
  const comp = r.comparecimento;
  if (comp && comp !== 'nao_registrado') return comp;
  return (r.status_reserva ?? r.status) as StatusReserva;
}

export function SituacaoReserva({ r, atrasoMin, passou }: { r: Pick<ReservaPainel, 'status' | 'status_reserva' | 'comparecimento'>; atrasoMin?: number | null; passou?: boolean }) {
  const s = STATUS[statusDe(r)] ?? { rotulo: r.status, tom: 'neutro' as Tom };
  // Horário da reserva já terminou e ninguém registrou a chegada: é uma pendência de registro, não um atraso.
  if (passou && statusDe(r) !== 'pendente') return <Situacao tom="atencao">Chegada não registrada</Situacao>;
  if (atrasoMin && atrasoMin > 0 && statusDe(r) !== 'pendente') return <Situacao tom="perigo">Atrasada {atrasoMin} min</Situacao>;
  return <Situacao tom={s.tom} destaque={s.destaque}>{s.rotulo}</Situacao>;
}

// O backend publicado antes da 0007 não manda `status_reserva` nem `comparecimento`: o status da reserva vem só em `status`.
export const statusBase = (r: Pick<ReservaPainel, 'status' | 'status_reserva'>) => r.status_reserva ?? r.status;
export const emAberto = (r: ReservaPainel) => (r.comparecimento ?? 'nao_registrado') === 'nao_registrado' && statusBase(r) !== 'cancelada';
export const confirmadaBase = (r: ReservaPainel) => ['confirmada', 'lembrada', 'reconfirmada'].includes(statusBase(r));
export const comecou = (r: ReservaPainel) => new Date(`${r.data}T${r.hora.slice(0, 5)}:00-03:00`).getTime() <= Date.now();

export function atualizarReservas() {
  invalidar('reservas');
}

/**
 * Registra o comparecimento. Usa a rota nova (PUT …/comparecimento); se o backend publicado ainda não a tiver (404 de
 * rota, produção antes da 0007), usa a rota antiga que o painel anterior já usava (PATCH …/status).
 */
export async function registrarComparecimento(id: string, valor: Comparecimento, motivo?: string) {
  try {
    await reservas.registrarComparecimento(id, valor, motivo);
  } catch (e) {
    if (e instanceof ErroApi && e.tipo === 'nao_implantado' && valor !== 'nao_registrado') await reservas.mudarStatus(id, valor, motivo);
    else throw e;
  } finally {
    atualizarReservas();
  }
}
