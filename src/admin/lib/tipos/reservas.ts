// Reservas — CONTRATO-PAINEL-ADMIN.md §7 (rotas /admin/reservas*, /admin/clientes*). Publicado em produção.
import type { Data, Instante, Uuid, Pagina } from './comum';

export type StatusReserva = 'pendente' | 'confirmada' | 'lembrada' | 'reconfirmada' | 'cancelada' | 'compareceu' | 'nao_compareceu';
export type StatusReservaBase = 'pendente' | 'confirmada' | 'lembrada' | 'reconfirmada' | 'cancelada';
export type Comparecimento = 'nao_registrado' | 'compareceu' | 'nao_compareceu';
export type CanalEquipe = 'telefone' | 'whatsapp' | 'balcao' | 'instagram' | 'painel';

export interface ReservaPainel {
  id: Uuid;
  codigo: string;
  unidade: string;
  ambiente_id: Uuid;
  ambiente: string;
  data: Data;
  /** "HH:MM:SS" (hora de Fortaleza). */
  hora: string;
  duracao_min: number;
  pessoas: number;
  status: StatusReserva;
  status_reserva: StatusReservaBase;
  comparecimento: Comparecimento;
  comparecimento_registrado_em: Instante | null;
  comparecimento_registrado_por: Uuid | null;
  canal: string;
  contato_nome: string;
  contato_telefone_e164: string | null;
  contato_email: string | null;
  observacoes: string | null;
  importada_de: string | null;
  cancelada_em: Instante | null;
  motivo_cancelamento: string | null;
  fechada_em: Instante | null;
  criado_em: Instante;
  avisar_cliente?: string | null;
}

export interface MensagensReserva {
  [tipo: string]: { status: string; erro?: string | null; enviada_em?: Instante | null } | null | undefined;
}

export interface OperacaoReserva extends ReservaPainel {
  inicio: Instante;
  fim: Instante;
  minutos_de_atraso: number | null;
  atrasada: boolean;
  mensagens: MensagensReserva;
}

export type ListaReservas = Pagina<ReservaPainel>;

export interface AmbienteOperacao {
  id: Uuid;
  unidade: string;
  codigo: string;
  nome: string;
  capacidade_max: number;
  duracao_min: number;
  ativo: boolean;
}

export interface Lotacao {
  ambiente_id: Uuid;
  ambiente: string;
  data: Data;
  capacidade_max: number;
  duracao_min: number;
  ativo: boolean;
  pessoas: number;
  horarios: { hora: string; ocupadas: number; cabe: boolean }[];
}

export interface HistoricoComparecimento {
  ocorreu_em: Instante;
  antes: Comparecimento;
  depois: Comparecimento;
  motivo: string | null;
  ator_tipo: string;
  usuario_id: Uuid | null;
  usuario_nome: string | null;
}

export interface ComparecimentoReserva {
  reserva_id: Uuid;
  codigo: string;
  status_reserva: StatusReservaBase;
  comparecimento: Comparecimento;
  registrado_em: Instante | null;
  registrado_por: Uuid | null;
  registrado_por_nome: string | null;
  aceita_registro: boolean;
  ausencia_liberada_em: Instante;
  historico: HistoricoComparecimento[];
}

export interface FrequenciaCliente {
  perfil: 'novo' | 'visitante' | 'recorrente';
  visitas: number;
  faltas: number;
  historico_faltas: boolean;
  primeira_visita: Data | null;
  ultima_visita: Data | null;
  ultima_falta: Data | null;
}

export interface PendenciaComparecimento extends ReservaPainel {
  inicio: Instante;
  ausencia_liberada_em: Instante;
  pode_registrar_ausencia: boolean;
  cliente: FrequenciaCliente;
}

export interface ReservaEquipeEntrada {
  unidade: string;
  ambiente_id: Uuid;
  data: Data;
  hora: string;
  pessoas: number;
  nome: string;
  telefone: string;
  email?: string | null;
  observacoes?: string | null;
  canal?: CanalEquipe;
}

export interface ReservaAlteracao {
  ambiente_id?: Uuid | null;
  data?: Data | null;
  hora?: string | null;
  pessoas?: number | null;
  observacoes?: string | null;
  contato_nome?: string | null;
  contato_telefone?: string | null;
  contato_email?: string | null;
}

export interface MensagemReservaFila {
  id: Uuid;
  tipo: string;
  status: string;
  motivo: string | null;
  tentativas: number;
  agendada_para: Instante | null;
  enviada_em: Instante | null;
  entregue_em: Instante | null;
  lida_em: Instante | null;
  erro: string | null;
  reserva: { id: Uuid; codigo: string; data: Data; hora: string; status: StatusReserva; contato_nome: string };
}

export interface PoliticaReserva {
  aceita_reservas: boolean;
  exige_email: boolean;
  antecedencia_min_horas: number;
  antecedencia_max_dias: number;
  tolerancia_atraso_min: number;
  privacidade_texto_versao: string;
  lembrete_1h_ativo?: boolean;
  privacidade_aprovada_em?: Instante | null;
}

export interface AmbienteConfig {
  id: Uuid;
  codigo: string;
  nome: string;
  capacidade_max: number;
  pessoas_min: number;
  pessoas_max_por_reserva: number;
  duracao_min: number;
  exige_aprovacao: boolean;
  aceita_reserva_online: boolean;
  ordem: number;
  limites_confirmados_em: Instante | null;
  ativo: boolean;
  importado?: boolean;
}

export interface RegraReserva {
  id: Uuid;
  ambiente_id?: Uuid | null;
  dia_semana?: number | null;
  data_especifica?: Data | null;
  fechado?: boolean;
  primeiro_horario?: string | null;
  ultimo_horario?: string | null;
  intervalo_min?: number | null;
  motivo?: string | null;
  vigente_de?: Data | null;
  vigente_ate?: Data | null;
  ativo: boolean;
}

export interface ConfiguracaoUnidade {
  unidade: string;
  politica: PoliticaReserva | null;
  ambientes: AmbienteConfig[];
  regras: RegraReserva[];
}
