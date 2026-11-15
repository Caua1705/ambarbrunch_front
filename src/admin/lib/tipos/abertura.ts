// Checklist de abertura e terminal de ponto do Modo Operação: contrato do backend (app/modulos/equipe/api_abertura.py e
// api_terminal.py). Campos exatamente como a API devolve.
import type { ConfiguracaoQuiosque, ResultadoCaptura, SessaoAberta } from '../../../lib/ponto/contrato';

export type SituacaoItem = 'feito' | 'nao_feito';

export interface ItemChecklist {
  id: string;
  ordem: number;
  titulo: string;
  situacao: SituacaoItem | null;
  observacao: string | null;
  marcado_em: string | null;
}

export interface Responsavel {
  funcionario_id: string;
  nome_exibicao: string | null;
  /** `declarada`: a pessoa tocou no próprio nome no tablet (não é biometria). `facial`: registros antigos, pelo rosto. */
  metodo: 'facial' | 'declarada';
  verificada: boolean;
  confirmado_por: string | null;
  confirmado_em: string | null;
}

export interface VideoAbertura {
  mime: string;
  tamanho_bytes: number;
  duracao_s: number | null;
  enviado_em: string;
}

/** O vídeo da abertura no WhatsApp (fila da Júlia). "aceita" = a Z-API recebeu; só "entregue"/"lida" confirmam a chegada. */
export interface WhatsappAbertura {
  status: 'aguardando_midia' | 'pendente' | 'enviando' | 'aceita' | 'entregue' | 'lida' | 'falhou' | 'bloqueada' | 'cancelada' | null;
  modo: 'desligado' | 'teste' | 'adm';
  envios: number;
  pode_reenviar: boolean;
  motivo?: string | null;
  grupo?: 'teste' | 'adm';
  envio_id?: number;
  tentativas?: number;
  zapi_message_id?: string | null;
  ultimo_erro?: string | null;
  criado_em?: string;
  aceito_em?: string | null;
  entregue_em?: string | null;
  lido_em?: string | null;
}

export interface ChecklistAbertura {
  id: string;
  data: string;
  estado: 'em_andamento' | 'concluido';
  responsavel: Responsavel;
  assumido_em: string;
  concluido_em: string | null;
  observacao: string | null;
  sem_video_motivo: string | null;
  resumo: { total: number; feitos: number; nao_feitos: number; pendentes: number };
  nao_feitos: { titulo: string; observacao: string | null }[];
  video: VideoAbertura | null;
  /** Só nas telas da gerência. */
  whatsapp?: WhatsappAbertura;
  /** Só no detalhe (a lista não traz as tarefas). */
  itens?: ItemChecklist[];
}

export interface AberturaHoje {
  data: string;
  horario_servidor: string;
  biometria_disponivel: boolean;
  video: { max_mb: number; max_segundos: number };
  checklist: ChecklistAbertura | null;
  /** Só antes de alguém assumir. */
  tarefas?: string[];
  funcionarios?: { id: string; nome_exibicao: string; ponto_hoje: boolean }[];
}

export interface TarefaModelo {
  id: string;
  ordem: number;
  titulo: string;
  ativo: boolean;
}

export interface EnvioVideo {
  caminho: string;
  metodo: 'PUT';
  token: string;
  expira_em: string;
  max_mb: number;
  max_segundos: number;
}

export interface PaginaAberturas {
  itens: ChecklistAbertura[];
  total: number;
  limite: number;
  deslocamento: number;
}

/** Sessão de identificação do terminal: a do quiosque + o token curto para mandar os quadros direto à API. */
export interface SessaoTerminal extends SessaoAberta {
  captura_token?: string | null;
}

export type { ConfiguracaoQuiosque, ResultadoCaptura };
