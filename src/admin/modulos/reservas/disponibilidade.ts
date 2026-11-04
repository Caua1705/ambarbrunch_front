// Disponibilidade da Nova reserva: quem calcula é o backend, em GET /admin/reservas/disponibilidade, para a unidade de cada
// ambiente (grade, bloqueios, primeira data e lotação). A equipe não segue a antecedência do site: horários próximos valem,
// os que já passaram não. Nenhuma regra é repetida aqui; o POST reconfere tudo ao gravar.
// Sem resposta do backend não há horário: a tela mostra o erro e não deixa gravar.
import { reservas } from '../../lib/api/reservas';
import type { AmbienteOperacao, DisponibilidadeEquipe } from '../../lib/tipos/reservas';

export interface OpcaoHorario {
  /** "HH:MM" */
  hora: string;
  /** Lugares já ocupados nesse horário, segundo o backend. */
  ocupadas: number;
  lotado: boolean;
}

export interface OpcaoAmbiente {
  id: string;
  nome: string;
  capacidade: number;
  duracaoMin: number;
  /** Só os que ainda podem ser escolhidos ou que estão lotados: horário que já passou não aparece. */
  horarios: OpcaoHorario[];
  /** Por que o ambiente não recebe este pedido (texto do backend). */
  aviso: string | null;
}

export interface DisponibilidadeManual {
  ambientes: OpcaoAmbiente[];
  /** Sem nenhum horário na data pedida: a primeira data aberta, conforme o backend. */
  proximaData: string | null;
  /** AMBAR_PAINEL_CRIACAO_MANUAL no backend. */
  criacaoManual: boolean;
}

function paraOpcao(d: DisponibilidadeEquipe): OpcaoAmbiente {
  return {
    id: d.ambiente_id,
    nome: d.ambiente,
    capacidade: d.capacidade_max,
    duracaoMin: d.duracao_min,
    aviso: d.aviso,
    horarios: d.horarios.filter((h) => h.motivo !== 'passado').map((h) => ({ hora: h.hora.slice(0, 5), ocupadas: h.ocupadas, lotado: h.motivo === 'lotado' })),
  };
}

export async function consultarDisponibilidade(ambientes: AmbienteOperacao[], data: string, pessoas: number): Promise<DisponibilidadeManual> {
  const respostas = await Promise.all(ambientes.filter((a) => a.ativo).map((a) => reservas.disponibilidade(a.id, data, pessoas)));
  const lista = respostas.map(paraOpcao);
  const proximas = respostas.map((r) => r.proxima_data).filter((d): d is string => !!d).sort();
  return {
    ambientes: lista,
    proximaData: lista.some((a) => a.horarios.length) ? null : proximas[0] ?? null,
    criacaoManual: respostas.every((r) => r.criacao_manual),
  };
}

/** Conferência na hora de gravar, sem cache. O backend confere tudo de novo, sob trava, no POST. */
export async function horarioContinuaLivre(ambienteId: string, data: string, pessoas: number, hora: string): Promise<boolean> {
  const atual = paraOpcao(await reservas.disponibilidade(ambienteId, data, pessoas));
  return atual.horarios.some((h) => h.hora === hora && !h.lotado);
}
