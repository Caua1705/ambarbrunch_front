// Contrato de Equipe e Ponto (app/modulos/equipe no backend; docs/equipe-ponto/API.md). Minutos, status e sinalizações vêm
// prontos: o painel nunca recalcula jornada.
import type { TipoBatida } from '../../../lib/ponto/contrato';

export type { TipoBatida };
export type BiometriaEstado = 'nao_cadastrada' | 'pendente' | 'ativa' | 'revogada';
export type EstadoJornada = 'trabalhando' | 'em_intervalo' | 'encerrada' | 'pendente_revisao';
export type StatusDia = EstadoJornada | 'previsto' | 'aguardando' | 'atrasado' | 'ausente' | 'folga' | 'sem_escala';
export type OrigemMarcacao = 'facial' | 'assistida' | 'ajuste';

export interface Pagina<T> {
  itens: T[];
  total: number;
  limite: number;
  deslocamento: number;
}

export interface EscalaResumo {
  escala_id: string;
  nome: string;
  vigente_de: string;
  vigente_ate: string | null;
}

export interface Funcionario {
  id: string;
  nome_completo: string;
  nome_exibicao: string;
  matricula: string | null;
  cargo: string;
  data_admissao: string;
  data_desligamento: string | null;
  ativo: boolean;
  telefone: string | null;
  email: string | null;
  carga_semanal_min: number | null;
  horario_contratual: string | null;
  biometria_estado: BiometriaEstado;
  registro_supervisionado: boolean;
  escala: EscalaResumo | null;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

export type FuncionarioEntrada = Partial<Omit<Funcionario, 'id' | 'ativo' | 'biometria_estado' | 'escala' | 'versao' | 'criado_em' | 'atualizado_em' | 'data_desligamento'>>;

export interface RegistroAuditoria {
  id: number;
  ocorreu_em: string;
  ator_tipo: string;
  ator_id: string | null;
  ator_nome?: string | null;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  dados: Record<string, unknown>;
}

export interface IntervaloHora {
  inicio: string;
  fim: string;
}

export interface DiaPlano {
  tipo?: 'trabalho' | 'plantao';
  entrada: string;
  saida: string;
  intervalos?: IntervaloHora[];
}

export interface VersaoEscala {
  id: string;
  vigente_de: string;
  dias: Record<string, DiaPlano>;
  tolerancia_entrada_min: number;
  tolerancia_saida_min: number;
  tolerancia_intervalo_min: number;
  intervalos_adicionais: boolean;
  criado_em: string;
}

export interface Escala {
  id: string;
  nome: string;
  tipo: 'fixa' | 'variavel';
  descricao: string | null;
  valida_de: string;
  valida_ate: string | null;
  ativa: boolean;
  /** Dia em que foi desativada. Desativada antes de hoje não religa: para usar o plano de novo, nova escala. */
  inativa_desde?: string | null;
  funcionarios_ids: string[];
  /** Atribuições em aberto, com o id que o cancelamento pede (só as que ainda não começaram se desfazem). */
  atribuicoes?: AtribuicaoAberta[];
  versoes: VersaoEscala[];
}

export interface AtribuicaoAberta {
  id: string;
  funcionario_id: string;
  vigente_de: string;
}

/** Corrige a previsão de um dia já trabalhado. As batidas não mudam. */
export interface PrevisaoEntrada {
  tipo: 'folga' | 'plantao' | 'turno';
  entrada?: string;
  saida?: string;
  intervalos?: IntervaloHora[];
  motivo: string;
}

export interface VersaoEntrada {
  vigente_de: string;
  dias: Record<string, DiaPlano>;
  tolerancia_entrada_min: number;
  tolerancia_saida_min: number;
  tolerancia_intervalo_min: number;
  intervalos_adicionais: boolean;
}

export interface EscalaEntrada {
  nome: string;
  tipo: 'fixa' | 'variavel';
  descricao?: string | null;
  valida_de: string;
  versao: VersaoEntrada;
}

export interface LinhaProgramacao {
  data: string;
  funcionario_id: string;
  nome_exibicao: string;
  tipo: 'trabalho' | 'plantao' | 'folga' | 'sem_escala';
  entrada: string | null;
  saida: string | null;
  intervalos: IntervaloHora[];
  previsto_min: number;
  excecao_id: string | null;
}

export interface ExcecaoEntrada {
  data: string;
  tipo: 'folga' | 'plantao' | 'turno';
  entrada?: string;
  saida?: string;
  motivo?: string;
}

export interface Dispositivo {
  id: string;
  nome: string;
  ativo: boolean;
  ultimo_uso_em: string | null;
  criado_em: string;
  revogado_em: string | null;
  revogacao_motivo: string | null;
  /** Só na criação ou na troca de credencial. */
  token?: string;
}

export interface CadastroBiometria {
  id: string;
  estado: string;
  amostras: number;
  modelo: string;
  criado_em: string;
  teste_aprovado_em: string | null;
  confirmado_em: string | null;
  encerrado_em: string | null;
  encerramento_motivo: string | null;
}

export interface EstadoBiometria {
  funcionario_id: string;
  estado: BiometriaEstado;
  registro_supervisionado: boolean;
  cadastros: CadastroBiometria[];
}

export interface SessaoFacial {
  sessao_id: string;
  nonce: string;
  desafio: string[];
  expira_em: string;
  quadros_min: number;
  quadros_max: number;
  /** Envio direto à API. Ausente em backend anterior: o envio vai pela ponte do painel. */
  captura_token?: string;
}

export interface ResultadoFacial {
  sessao_id: string;
  resultado: string;
  motivo?: string | null;
  mensagem: string;
  nova_tentativa: boolean;
  biometria_id?: string;
  amostras?: number;
  proximo_passo?: 'testar' | 'confirmar';
}

export interface Marcacao {
  id: string;
  funcionario_id: string;
  jornada_id: string;
  tipo: TipoBatida;
  origem: OrigemMarcacao;
  instante_utc: string;
  instante_local: string;
  fuso: string;
  registrado_em: string;
  dispositivo_id: string | null;
  registrado_por: string | null;
  registrado_por_nome?: string | null;
  justificativa: string | null;
  autenticacao: string | null;
  sinalizacoes: string[];
  efetiva?: boolean;
  nome_exibicao?: string;
  repetida?: boolean;
}

export interface ValorMarcacao {
  marcacao_id?: string;
  tipo?: TipoBatida;
  instante_utc?: string;
  origem?: OrigemMarcacao;
}

export interface Ajuste {
  id: string;
  tipo: 'inclusao' | 'correcao' | 'anulacao';
  funcionario_id: string;
  jornada_id: string;
  marcacao_alvo_id: string | null;
  marcacao_nova_id: string | null;
  valor_anterior: ValorMarcacao | null;
  valor_ajustado: ValorMarcacao | null;
  justificativa: string;
  responsavel_id: string;
  responsavel_nome?: string | null;
  ocorreu_em: string;
}

export interface Jornada {
  id: string;
  funcionario_id: string;
  data_referencia: string;
  numero: number;
  estado: EstadoJornada;
  entrada_em: string | null;
  saida_em: string | null;
  trabalhado_min: number;
  intervalo_min: number;
  sinalizacoes: string[];
  previsto_min?: number;
  diferenca_min?: number | null;
  atraso_min?: number;
  saida_antecipada_min?: number;
  excedente_min?: number;
  completa?: boolean;
  intervalos?: IntervaloHora[];
  /** Previsão guardada na jornada (instantes ISO). */
  previsto?: { tipo: string; entrada: string | null; saida: string | null; intervalos?: [string, string][] } | null;
}

export interface JornadaDetalhe extends Jornada {
  marcacoes: Marcacao[];
  ajustes: Ajuste[];
}

export interface AjusteEntrada {
  tipo: 'inclusao' | 'correcao' | 'anulacao';
  justificativa: string;
  marcacao_id?: string;
  funcionario_id?: string;
  jornada_id?: string;
  tipo_batida?: TipoBatida;
  instante?: string;
}

export interface LinhaEspelho {
  data: string;
  funcionario_id: string;
  nome_exibicao: string;
  cargo: string;
  status: StatusDia;
  previsto: { tipo: string; entrada: string | null; saida: string | null; previsto_min: number };
  entrada: string | null;
  saida: string | null;
  intervalos: IntervaloHora[];
  trabalhado_min: number;
  intervalo_min: number;
  diferenca_min: number | null;
  atraso_min: number;
  saida_antecipada_min: number;
  excedente_min: number;
  sinalizacoes: string[];
  jornadas_ids: string[];
}

export interface PainelEquipe {
  data: string;
  horario_servidor: string;
  indicadores: {
    funcionarios_ativos: number;
    presentes: number;
    em_intervalo: number;
    ainda_nao_chegaram: number;
    jornada_encerrada: number;
    ausentes: number;
    atrasados: number;
    pendencias: number;
    a_conferir: number;
  };
  presentes: LinhaEspelho[];
  em_intervalo: LinhaEspelho[];
  ainda_nao_chegaram: LinhaEspelho[];
  jornada_encerrada: LinhaEspelho[];
  ausentes: LinhaEspelho[];
  atrasados: LinhaEspelho[];
  pendencias: LinhaEspelho[];
  a_conferir: LinhaEspelho[];
}
