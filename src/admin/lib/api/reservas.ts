// Reservas — rotas reais /admin/reservas* (publicadas em produção; conferidas com app/modulos/reservas/api_admin.py e
// api_comparecimento.py do backend). Clientes ficam em ./clientes.
import { pedir, novaChave } from './cliente';
import type {
  AmbienteOperacao, ComparecimentoReserva, Comparecimento, ConfiguracaoUnidade, ListaReservas, Lotacao, OperacaoReserva,
  PendenciaComparecimento, ReservaAlteracao, ReservaEquipeEntrada, ReservaPainel, StatusReserva, MensagemReservaFila,
  PoliticaReserva, AmbienteConfig, RegraReserva,
} from '../tipos/reservas';
import type { Pagina } from '../tipos/comum';

export interface FiltroReservas {
  data_de?: string;
  data_ate?: string;
  /** Situação do painel: `confirmada` = confirmada sem registro; `compareceu` = com esse registro. */
  status?: StatusReserva[];
  comparecimento?: Comparecimento[];
  ambiente_id?: string;
  /** Código, nome ou telefone (trecho do +55…), até 80 caracteres. */
  busca?: string;
  limite?: number;
  deslocamento?: number;
}

/** Teto da leitura completa (Lista, Mês, Ambientes): 10 páginas de 200, como o painel anterior lia "tudo". */
const PAGINAS_MAX = 10;

export const reservas = {
  listar: (f: FiltroReservas) => pedir<ListaReservas>('reservas', { query: { ...f, limite: f.limite ?? 200 } }),
  /**
   * Todas as páginas de um filtro (o backend pagina em 200). A paginação por deslocamento pode repetir uma reserva se a
   * lista mudar no meio da leitura: as repetidas saem pelo id. `total` é o do backend (pode passar do que veio).
   */
  listarTodas: async (f: Omit<FiltroReservas, 'limite' | 'deslocamento'>): Promise<ListaReservas> => {
    const vistos = new Map<string, ReservaPainel>();
    let total = 0;
    for (let p = 0; p < PAGINAS_MAX; p++) {
      const pagina = await pedir<ListaReservas>('reservas', { query: { ...f, limite: 200, deslocamento: p * 200 } });
      total = pagina.total;
      for (const r of pagina.itens) vistos.set(r.id, r);
      if (pagina.itens.length < 200 || (p + 1) * 200 >= total) break;
    }
    return { total, itens: [...vistos.values()] };
  },
  // `unidade` explícita (Modo Operação); sem ela, a ponte usa a unidade escolhida no topo do painel.
  operacao: (data: string, unidade?: string) => pedir<OperacaoReserva[]>('reservas/operacao', { query: { data, unidade } }),
  ambientes: (unidade?: string) => pedir<AmbienteOperacao[]>('reservas/ambientes', { query: { unidade } }),
  lotacao: (ambiente_id: string, data: string, pessoas?: number) => pedir<Lotacao>('reservas/lotacao', { query: { ambiente_id, data, pessoas } }),
  /** Exige reservas.ver_contato (Gerente e Proprietário). */
  mensagens: (q: { status?: string[]; tipo?: string; data_de?: string; data_ate?: string; limite?: number; deslocamento?: number }) => pedir<Pagina<MensagemReservaFila>>('reservas/mensagens', { query: q }),
  obter: (id: string) => pedir<ReservaPainel>(`reservas/${id}`),
  /** Desligado por padrão no backend (403 `criacao_manual_desativada`): na 1ª versão, reserva nova só pelo site. */
  criar: (r: ReservaEquipeEntrada, chave = novaChave()) => pedir<ReservaPainel>('reservas', { metodo: 'POST', corpo: r, idempotencia: chave }),
  /** Na 1ª versão só contato e observações: data, horário, ambiente e pessoas diferentes dão 403 `alteracao_desativada`. */
  alterar: (id: string, r: ReservaAlteracao) => pedir<ReservaPainel>(`reservas/${id}`, { metodo: 'PATCH', corpo: r }),
  /** Aprovar (pendente → confirmada) e cancelar/recusar; `motivo` opcional, até 300 caracteres. */
  mudarStatus: (id: string, status: StatusReserva, motivo?: string) => pedir<ReservaPainel>(`reservas/${id}/status`, { metodo: 'PATCH', corpo: { status, motivo: motivo ?? null } }),
  avisoComunicado: (id: string) => pedir<ReservaPainel>(`reservas/${id}/aviso-comunicado`, { metodo: 'POST' }),
  comparecimento: (id: string) => pedir<ComparecimentoReserva>(`reservas/${id}/comparecimento`),
  registrarComparecimento: (id: string, comparecimento: Comparecimento, motivo?: string) =>
    pedir<ComparecimentoReserva>(`reservas/${id}/comparecimento`, { metodo: 'PUT', corpo: { comparecimento, motivo: motivo ?? null } }),
  pendentesComparecimento: (q: { data_de?: string; data_ate?: string; limite?: number } = {}) => pedir<PendenciaComparecimento[]>('reservas/comparecimento/pendentes', { query: q }),
  configuracao: (unidade: string) => pedir<ConfiguracaoUnidade>(`reservas/configuracao/${unidade}`),
  salvarPolitica: (unidade: string, p: Omit<PoliticaReserva, 'privacidade_aprovada_em'>) => pedir<PoliticaReserva>(`reservas/configuracao/${unidade}/politica`, { metodo: 'PUT', corpo: p }),
  alterarAmbiente: (id: string, a: Partial<AmbienteConfig>) => pedir<AmbienteConfig>(`reservas/ambientes/${id}`, { metodo: 'PATCH', corpo: a }),
  alterarRegra: (id: string, ativo: boolean) => pedir<RegraReserva>(`reservas/regras/${id}`, { metodo: 'PATCH', corpo: { ativo } }),
};
