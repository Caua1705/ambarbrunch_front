// Atendimento (WhatsApp oficial da Meta) e Clube Âmbar — CONTRATO-PAINEL-ADMIN.md §6 e §7.
// Ainda NÃO publicados em produção (as rotas respondem 404 lá até a migração 0006/0008).
import type { Data, Dec, Instante, Uuid } from './comum';

export type ModoConversa = 'robo' | 'humano' | 'encerrada';

export interface ConversaResumo {
  id: Uuid;
  telefone_e164: string;
  nome_contato: string | null;
  modo: ModoConversa;
  atendente_id: Uuid | null;
  atendente_nome: string | null;
  motivo_humano: string | null;
  ultima_entrada_em: Instante | null;
  ultima_atividade_em: Instante;
  ultima_mensagem: string | null;
  aguardando_equipe: boolean;
  inativa: boolean;
  /** Dentro da janela de 24 h da Meta: só assim a equipe pode responder com texto livre. */
  dentro_da_janela: boolean;
}

export interface MensagemPainel {
  id: number;
  /** "entrada" (cliente) ou "saida". */
  direcao: string;
  /** "cliente", "robo", "equipe"… */
  autor: string;
  usuario_nome: string | null;
  tipo: string;
  texto: string | null;
  transcricao: string | null;
  status: string;
  erro: string | null;
  intencao: string | null;
  criado_em: Instante;
  enviada_em: Instante | null;
}

export interface ConversaDetalhe extends ConversaResumo {
  mensagens: MensagemPainel[];
}

export interface ResumoAtendimento {
  por_modo: { robo: number; humano: number; encerrada: number };
  aguardando_equipe: number;
  inativas: number;
  falhas_de_envio_24h: number;
}

export interface FalhaAtendimento extends MensagemPainel {
  conversa_id: Uuid;
  nome_contato: string | null;
  telefone_e164: string;
}

// Clube ---------------------------------------------------------------------------------------------------------------

export type EstadoMembro = 'pendente' | 'ativo' | 'suspenso' | 'encerrado';

export interface ResumoClube {
  inscricoes_abertas: boolean;
  programa_ativo: boolean;
  credito_automatico: boolean;
  membros: Record<EstadoMembro, number>;
  convites_aguardando: number;
  mensagens_falhas_7_dias: number;
  pendencias: {
    vendas_com_telefone_sem_cliente_verificado: number;
    vendas_com_telefone_correcao_provavel: number;
    vendas_com_telefone_invalido: number;
    vendas_so_com_documento: number;
    eventos_de_venda_sem_processar: number;
    membros_pendentes_com_pontos: number;
  };
}

export interface MembroLista {
  cliente_id: Uuid;
  nome: string | null;
  /** Mascarado: (85) •••••-1111. */
  telefone: string;
  estado: EstadoMembro;
  origem: string;
  cadastro_iniciado_em: Instante | null;
  ativado_em: Instante | null;
  suspenso_em: Instante | null;
  marketing_autorizado: boolean;
  mensagens_autorizadas: boolean;
}

export interface MembroFicha {
  cliente: { id: Uuid; nome: string | null; telefone: string; telefone_verificado_em: Instante | null; email: string | null };
  membro: {
    estado: EstadoMembro;
    origem: string;
    aniversario: string | null;
    cadastro_iniciado_em: Instante | null;
    ativado_em: Instante | null;
    regulamento_versao: string | null;
    privacidade_versao: string | null;
    termos_aceitos_em: Instante | null;
    marketing_autorizado: boolean;
    marketing_texto_versao: string | null;
    marketing_atualizado_em: Instante | null;
    suspensao: null | { em: Instante; por: string | null; motivo: string; estado_anterior: string };
  };
  mensagens_de_servico: null | { autorizadas: boolean; origem: string; texto_versao: string; em: Instante; por: string | null; revogado_em: Instante | null; revogacao_origem: string | null };
  consentimentos: { finalidade: string; acao: string; canal: string; texto_versao: string; em: Instante }[];
  pontos: { programa_ativo: boolean; pendente: number | Dec; disponivel: number | Dec; reservado: number | Dec };
  sessoes_ativas: number;
  compras: { total: number; ultimas: VendaClube[] };
  convites: ConviteClube[];
  mensagens: MensagemClube[];
}

export interface HistoricoMembro {
  em: Instante;
  acao: string;
  ator_tipo: string;
  ator: string | null;
  dados: unknown;
}

export interface VendaClube {
  id: Uuid;
  eye_transaction_id: string;
  data_hora: Instante;
  total: Dec;
  comanda: string | null;
  loja: string | null;
  unidade_id: number | null;
  cancelada: boolean;
  telefone: string | null;
  telefone_situacao: 'normalizado' | 'correcao_provavel' | 'invalido' | null;
  telefone_motivo: string | null;
  aviso: string | null;
  cliente: { id: Uuid; nome: string | null; estado_membro: EstadoMembro | null } | null;
  vinculo: 'telefone' | 'telefone_conferido' | 'documento' | null;
  candidato_membro: boolean;
  convite: { pode: boolean; motivo: null | 'convite_aberto' | 'ja_membro' | 'conta_suspensa' | 'conferir_telefone' };
}

export interface ConviteClube {
  id: Uuid;
  telefone: string;
  origem: string;
  criado_em: Instante;
  criado_por: string | null;
  unidade_id: number | null;
  expira_em: Instante;
  aberto_em: Instante | null;
  usado_em: Instante | null;
  situacao: 'aguardando' | 'usado' | 'substituido' | 'expirado';
  mensagem: { status: string; tentativas: number; enviada_em: Instante | null; erro: string | null; motivo: string | null } | null;
}

export interface MensagemClube {
  id: Uuid;
  tipo: string;
  status: string;
  telefone: string;
  cliente_id: Uuid | null;
  criado_em: Instante;
  enviada_em: Instante | null;
  tentativas: number;
  erro: string | null;
  motivo: string | null;
}

export type DataClube = Data;
