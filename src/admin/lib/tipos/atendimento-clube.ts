// Atendimento (WhatsApp oficial da Meta) e Clube Âmbar — CONTRATO-PAINEL-ADMIN.md §6 e §7.
// Atendimento conferido com app/modulos/atendimento/api_admin.py (central única: estados, ficha do contato, nova conversa,
// campanhas, base de conhecimento e cadastros duplicados — backend com a migração 0022).
import type { Data, Dec, Instante, Uuid } from './comum';

export type ModoConversa = 'robo' | 'humano' | 'encerrada';
/** Os quatro estados da caixa: com o assistente, esperando a equipe (ninguém assumiu), com alguém da equipe, encerrada. */
export type EstadoConversa = 'automatico' | 'esperando' | 'em_atendimento' | 'encerrada';
/** Quem escreveu: o cliente, o assistente virtual (robô), alguém da equipe, uma campanha ou uma automação (follow-up). */
export type AutorMensagem = 'cliente' | 'robo' | 'equipe' | 'campanha' | 'automacao';
export type TipoMensagem = 'texto' | 'audio' | 'imagem' | 'documento' | 'video' | 'figurinha' | 'localizacao' | 'contato' | 'botao' | 'template' | 'outro';

export interface ConversaResumo {
  id: Uuid;
  telefone_e164: string;
  nome_contato: string | null;
  /** Cadastro ligado à conversa, só quando é seguro (telefone verificado ou cadastro único); senão null. */
  cliente_id: Uuid | null;
  modo: ModoConversa;
  estado: EstadoConversa;
  /** O assistente responde nesta conversa (modo robo). */
  assistente_ligado: boolean;
  atendente_id: Uuid | null;
  atendente_nome: string | null;
  motivo_humano: string | null;
  ultima_entrada_em: Instante | null;
  ultima_atividade_em: Instante;
  ultima_mensagem: string | null;
  ultima_origem: AutorMensagem | null;
  /** Mensagens do cliente depois da última resposta que saiu (do assistente ou da equipe). */
  nao_respondidas: number;
  /** Com a equipe e a última mensagem é do cliente. */
  aguardando_equipe: boolean;
  /** Com a equipe e sem movimento há 30 min (só sinaliza; o robô não volta sozinho). */
  inativa: boolean;
  /** Dentro da janela de 24 h da Meta: só assim a equipe pode responder com texto livre. */
  dentro_da_janela: boolean;
  followup_desligado: boolean;
}

/** Status de uma mensagem: recebida (do cliente), pendente (saindo), enviada, entregue, lida, falhou, descartada. */
export type StatusMensagem = 'recebida' | 'pendente' | 'enviada' | 'entregue' | 'lida' | 'falhou' | 'descartada';

export interface MensagemPainel {
  id: number;
  direcao: 'entrada' | 'saida';
  autor: AutorMensagem;
  usuario_nome: string | null;
  tipo: TipoMensagem;
  texto: string | null;
  transcricao: string | null;
  /** Há arquivo (imagem, áudio, documento, vídeo): GET atendimento/mensagens/{id}/midia. */
  tem_midia: boolean;
  midia_mime: string | null;
  midia_nome: string | null;
  template_nome: string | null;
  campanha_id: number | null;
  /** Mensagem automática de follow-up. */
  followup: boolean;
  responde_a: string | null;
  status: StatusMensagem;
  erro: string | null;
  intencao: string | null;
  criado_em: Instante;
  enviada_em: Instante | null;
  entregue_em: Instante | null;
  lida_em: Instante | null;
}

/** Saiu por outro caminho (template de reserva ou do Clube, resposta automática de botão): só leitura na linha do tempo. */
export interface MensagemExterna {
  chave: string;
  origem: 'reserva' | 'clube' | 'automacao';
  tipo: string;
  rotulo: string;
  texto: string | null;
  status: string;
  erro: string | null;
  criado_em: Instante;
}

export interface ConversaDetalhe extends ConversaResumo {
  mensagens: MensagemPainel[];
  externas: MensagemExterna[];
}

export interface ResumoAtendimento {
  por_modo: { robo: number; humano: number; encerrada: number };
  por_estado: Record<EstadoConversa, number>;
  aguardando_equipe: number;
  inativas: number;
  falhas_de_envio_24h: number;
  configuracao: {
    /** Assistente virtual ligado no servidor. Desligado: tudo vai direto para a equipe. */
    assistente_ativo: boolean;
    /** Token da Cloud API configurado: sem ele, nenhuma resposta sai. */
    envio_configurado: boolean;
    followup_ativo: boolean;
    /** Quantos templates aprovados estão configurados. */
    templates: number;
  };
}

export interface FalhaAtendimento extends MensagemPainel {
  conversa_id: Uuid;
  nome_contato: string | null;
  telefone_e164: string;
}

// Ficha contextual do contato (gaveta da conversa) ---------------------------------------------------------------------

export interface CadastroContato {
  id: Uuid;
  nome: string;
  /** Mascarado (ab•••@dominio) para quem não tem clientes.visualizar. */
  email: string | null;
  origem: string;
  origem_detalhe: string | null;
  legado: string | null;
  /** Cliente antigo importado do Giardini. */
  giardini: boolean;
  telefone_verificado: boolean;
  criado_em: Instante;
  reservas: number;
  /** Ligado a este cadastro principal (vínculo de duplicidade), se houver. */
  principal_id: Uuid | null;
}

export interface ReservaContato {
  id: Uuid;
  codigo: string;
  data: Data;
  /** "HH:MM". */
  hora: string;
  pessoas: number;
  ambiente: string;
  status: string;
  giardini: boolean;
}

export interface FichaContato {
  conversa_id: Uuid;
  telefone_e164: string;
  nome_whatsapp: string | null;
  cliente_id: Uuid | null;
  /** vinculado: a conversa aponta para um cadastro; sem_cadastro: nenhum; ambiguo: vários candidatos sem vínculo. */
  situacao_cadastro: 'vinculado' | 'sem_cadastro' | 'ambiguo';
  cadastros: CadastroContato[];
  cadastros_distintos: number;
  giardini: boolean;
  reservas_futuras: ReservaContato[];
  reservas_passadas: ReservaContato[];
  reservas_total: number;
  consentimentos: Record<string, { situacao: string; canal: string; em: Instante }>;
  primeira_mensagem_em: Instante | null;
  mensagens_recebidas: number;
  mensagens_enviadas: number;
  followup_desligado: boolean;
  followup_motivo: string | null;
}

// Nova conversa e templates --------------------------------------------------------------------------------------------

export interface TemplateWhatsapp {
  nome: string;
  idioma: string;
  categoria: 'marketing' | 'utilidade';
  /** Rótulos dos parâmetros, na ordem de {{1}}, {{2}}… */
  parametros: string[];
  /** Prévia do texto com {{1}}, {{2}}… (quem manda o texto de verdade é a Meta). */
  texto: string;
}

export interface ContatoBusca {
  cliente_id: Uuid;
  nome: string;
  telefone_e164: string;
  origem: string;
  giardini: boolean;
  /** Já existe conversa com este telefone. */
  conversa_id: Uuid | null;
}

export interface NovaConversaEntrada {
  telefone?: string;
  cliente_id?: Uuid;
  nome?: string;
  template?: string;
  parametros: string[];
  texto?: string;
}

// Campanhas ------------------------------------------------------------------------------------------------------------

export type SituacaoCampanha = 'rascunho' | 'enviando' | 'concluida' | 'cancelada';
export type SituacaoDestinatario = 'pendente' | 'enviada' | 'falhou' | 'bloqueada' | 'cancelada';

export interface Campanha {
  id: number;
  nome: string;
  template_nome: string;
  template_idioma: string;
  categoria: 'marketing' | 'utilidade';
  /** Campanha de teste: só sai para os números de teste configurados no servidor. */
  teste: boolean;
  situacao: SituacaoCampanha;
  criada_em: Instante;
  iniciada_em: Instante | null;
  concluida_em: Instante | null;
  destinatarios: Record<SituacaoDestinatario, number>;
  entrega: { pendente: number; enviada: number; entregue: number; lida: number; falhou: number };
  conversas_que_responderam: number;
}

export interface DestinatarioCampanha {
  id: number;
  telefone_e164: string;
  cliente_id: Uuid | null;
  situacao: SituacaoDestinatario;
  /** Bloqueio (nao_e_numero_de_teste, sem_consentimento_marketing, pediu_para_parar), erro da Meta ou campanha_cancelada. */
  motivo: string | null;
  conversa_id: Uuid | null;
  mensagem_id: number | null;
}

export interface CampanhaDetalhe extends Campanha {
  lista: DestinatarioCampanha[];
}

export interface NovaCampanhaEntrada {
  nome: string;
  template: string;
  teste: boolean;
  destinatarios: { telefone?: string; cliente_id?: Uuid; parametros: string[] }[];
}

// Base de conhecimento -------------------------------------------------------------------------------------------------

export interface ItemConhecimento {
  chave: string;
  tema: string;
  conteudo: string;
  /** Quem confirmou e onde (obrigatório). */
  fonte: string;
  ativo: boolean;
  atualizado_por: string | null;
  atualizado_em: Instante | null;
}

export interface BaseConhecimento {
  itens: ItemConhecimento[];
  /** Temas que costumam faltar (nada é preenchido sozinho). */
  sugestoes: { chave: string; tema: string }[];
}

// Cadastros duplicados -------------------------------------------------------------------------------------------------

export interface GrupoDuplicidade {
  por: 'telefone' | 'email';
  valor: string;
  classificacao: 'provavel_mesma_pessoa' | 'ambiguo' | 'resolvido';
  cadastros: CadastroContato[];
}

export interface Duplicidades {
  grupos: GrupoDuplicidade[];
  resumo: Record<GrupoDuplicidade['classificacao'], number>;
  total_cadastros: number;
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
