// Reservas e clientes — rotas reais /admin/reservas* e /admin/clientes* (publicadas em produção).
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
  status?: StatusReserva[];
  ambiente_id?: string;
  busca?: string;
  limite?: number;
  deslocamento?: number;
}

export const reservas = {
  listar: (f: FiltroReservas) => pedir<ListaReservas>('reservas', { query: { ...f, limite: f.limite ?? 200 } }),
  operacao: (data: string) => pedir<OperacaoReserva[]>('reservas/operacao', { query: { data } }),
  ambientes: () => pedir<AmbienteOperacao[]>('reservas/ambientes'),
  lotacao: (ambiente_id: string, data: string, pessoas?: number) => pedir<Lotacao>('reservas/lotacao', { query: { ambiente_id, data, pessoas } }),
  mensagens: (q: { status?: string[]; data_de?: string; data_ate?: string; limite?: number }) => pedir<Pagina<MensagemReservaFila>>('reservas/mensagens', { query: q }),
  obter: (id: string) => pedir<ReservaPainel>(`reservas/${id}`),
  criar: (r: ReservaEquipeEntrada, chave = novaChave()) => pedir<ReservaPainel>('reservas', { metodo: 'POST', corpo: r, idempotencia: chave }),
  alterar: (id: string, r: ReservaAlteracao) => pedir<ReservaPainel>(`reservas/${id}`, { metodo: 'PATCH', corpo: r }),
  mudarStatus: (id: string, status: StatusReserva, motivo?: string) => pedir<ReservaPainel>(`reservas/${id}/status`, { metodo: 'PATCH', corpo: { status, motivo: motivo ?? null } }),
  avisoComunicado: (id: string) => pedir<ReservaPainel>(`reservas/${id}/aviso-comunicado`, { metodo: 'POST' }),
  comparecimento: (id: string) => pedir<ComparecimentoReserva>(`reservas/${id}/comparecimento`),
  registrarComparecimento: (id: string, comparecimento: Comparecimento, motivo?: string) =>
    pedir<ComparecimentoReserva>(`reservas/${id}/comparecimento`, { metodo: 'PUT', corpo: { comparecimento, motivo: motivo ?? null } }),
  pendentesComparecimento: (q: { data_de?: string; data_ate?: string } = {}) => pedir<PendenciaComparecimento[]>('reservas/comparecimento/pendentes', { query: q }),
  configuracao: (unidade: string) => pedir<ConfiguracaoUnidade>(`reservas/configuracao/${unidade}`),
  salvarPolitica: (unidade: string, p: Omit<PoliticaReserva, 'privacidade_aprovada_em'>) => pedir<PoliticaReserva>(`reservas/configuracao/${unidade}/politica`, { metodo: 'PUT', corpo: p }),
  alterarAmbiente: (id: string, a: Partial<AmbienteConfig>) => pedir<AmbienteConfig>(`reservas/ambientes/${id}`, { metodo: 'PATCH', corpo: a }),
  alterarRegra: (id: string, ativo: boolean) => pedir<RegraReserva>(`reservas/regras/${id}`, { metodo: 'PATCH', corpo: { ativo } }),
};
