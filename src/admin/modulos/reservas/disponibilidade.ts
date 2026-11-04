// Disponibilidade da Nova reserva: o painel pergunta ao MESMO serviço do site e não recalcula nenhuma regra.
//  - GET /reservas/config e /reservas/disponibilidade (site): ambientes online, grade do dia, bloqueios, antecedência,
//    mínimo e máximo de pessoas, primeira data de visita e lotação.
//  - GET /admin/reservas/lotacao (equipe): lugares ocupados em cada horário e, se o site recusa, se foi por falta de lugar.
// Sem resposta do serviço, não há horário: a tela mostra o erro e não deixa gravar.
//
// Diferença da equipe que vem do próprio backend: grupo acima do limite de UMA reserva online (`grupo_acima_do_limite`) é
// atendido pela equipe, limitado só pela lotação. Nesse caso valem os horários da lotação.
import { ErroApi } from '../../lib/api/cliente';
import { reservas } from '../../lib/api/reservas';
import { somarDias } from '../../lib/formato';
import type { AmbienteOperacao, ConfigReservasSite } from '../../lib/tipos/reservas';

export type Indisponivel = 'lotado' | 'fora_do_prazo';

export interface OpcaoHorario {
  /** "HH:MM" */
  hora: string;
  /** Lugares já ocupados nesse horário, segundo o backend. */
  ocupadas: number | null;
  indisponivel: Indisponivel | null;
}

export interface OpcaoAmbiente {
  id: string;
  nome: string;
  capacidade: number;
  duracaoMin: number;
  horarios: OpcaoHorario[];
  /** Por que o ambiente não recebe este pedido (texto do backend). */
  aviso: string | null;
}

export interface DisponibilidadeManual {
  ambientes: OpcaoAmbiente[];
  /** Sem nenhum horário na data pedida: a próxima data aberta, conforme `datasFechadas` do backend. */
  proximaData: string | null;
}

const NAO_ONLINE = 'Este ambiente não recebe reservas pelo site.';

const jaPassou = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`).getTime() <= Date.now();

async function consultarAmbiente(a: AmbienteOperacao, online: boolean, data: string, pessoas: number): Promise<OpcaoAmbiente> {
  const base = { id: a.id, nome: a.nome, capacidade: a.capacidade_max, duracaoMin: a.duracao_min };
  if (!online) return { ...base, horarios: [], aviso: NAO_ONLINE };
  const [lotacao, site] = await Promise.all([
    reservas.lotacao(a.id, data, pessoas),
    // As duas recusas por número de pessoas são resposta do serviço, não falha: cada uma é tratada abaixo.
    reservas.disponibilidadeSite(a.codigo, data, pessoas).catch((e: unknown) => {
      if (e instanceof ErroApi && (e.codigo === 'abaixo_do_minimo' || e.codigo === 'grupo_acima_do_limite')) return e;
      throw e;
    }),
  ]);
  if (site instanceof ErroApi && site.codigo === 'abaixo_do_minimo') return { ...base, horarios: [], aviso: site.campos.pessoas ?? site.message };
  if (site instanceof ErroApi) {
    const horarios = lotacao.horarios
      .map((h) => ({ hora: h.hora.slice(0, 5), ocupadas: h.ocupadas, indisponivel: h.cabe ? null : ('lotado' as const) }))
      .filter((h) => !jaPassou(data, h.hora));
    return { ...base, horarios, aviso: null };
  }
  const porHora = new Map(lotacao.horarios.map((h) => [h.hora.slice(0, 5), h]));
  return {
    ...base,
    aviso: null,
    horarios: site.horarios.map(({ hora, disponivel }) => {
      const l = porHora.get(hora);
      const indisponivel: Indisponivel | null = l && !l.cabe ? 'lotado' : disponivel ? null : 'fora_do_prazo';
      return { hora, ocupadas: l?.ocupadas ?? null, indisponivel };
    }),
  };
}

function proximaDataAberta(config: ConfigReservasSite, data: string) {
  const fechadas = config.ambientes.map((a) => new Set(a.datasFechadas ?? []));
  for (let i = 1; i <= config.antecedencia.diasMax; i++) {
    const d = somarDias(data, i);
    if (fechadas.some((f) => !f.has(d))) return d;
  }
  return null;
}

export async function consultarDisponibilidade(ambientes: AmbienteOperacao[], data: string, pessoas: number): Promise<DisponibilidadeManual> {
  const config = await reservas.configSite();
  const online = new Set(config.ambientes.map((a) => a.id));
  const lista = await Promise.all(ambientes.filter((a) => a.ativo).map((a) => consultarAmbiente(a, online.has(a.codigo), data, pessoas)));
  return { ambientes: lista, proximaData: lista.some((a) => a.horarios.length) ? null : proximaDataAberta(config, data) };
}

/** Conferência na hora de gravar, sem cache. A lotação é conferida de novo pelo backend, sob trava, no POST. */
export async function horarioContinuaLivre(a: AmbienteOperacao, data: string, pessoas: number, hora: string): Promise<boolean> {
  const config = await reservas.configSite();
  const atual = await consultarAmbiente(a, config.ambientes.some((x) => x.id === a.codigo), data, pessoas);
  return atual.horarios.some((h) => h.hora === hora && !h.indisponivel);
}
