// Atendimento (WhatsApp oficial) e Clube — rotas reais do backend. Atendimento conferido com
// app/modulos/atendimento/api_admin.py: conversas com atendimento.visualizar (o servidor decide dono e janela); campanhas com
// atendimento.campanhas; editar a base de conhecimento com atendimento.conhecimento; duplicidades com clientes.visualizar/editar.
import { pedir } from './cliente';
import type { Pagina } from '../tipos/comum';
import type {
  ConversaDetalhe, ConversaResumo, FalhaAtendimento, MensagemPainel, EstadoConversa, ResumoAtendimento, FichaContato, TemplateWhatsapp,
  ContatoBusca, NovaConversaEntrada, Campanha, CampanhaDetalhe, NovaCampanhaEntrada, BaseConhecimento, ItemConhecimento, Duplicidades,
  ResumoClube, MembroLista, MembroFicha, HistoricoMembro, VendaClube, ConviteClube, MensagemClube, EstadoMembro,
} from '../tipos/atendimento-clube';

/** Endereço da mídia de uma mensagem (imagem, áudio, documento) pela ponte do painel: vai com o login, nunca com a URL da Meta. */
export const urlMidia = (mensagemId: number) => `/admin/api/atendimento/mensagens/${mensagemId}/midia`;

export const atendimento = {
  resumo: () => pedir<ResumoAtendimento>('atendimento/resumo'),
  falhas: (limite = 20) => pedir<FalhaAtendimento[]>('atendimento/falhas', { query: { limite } }),
  /** `busca`: nome ou 4+ dígitos do telefone; o backend exige 2 a 80 caracteres (menos que 2 não vai). Esperando vem primeiro. */
  conversas: (q: { estado?: EstadoConversa; atendente_id?: string; busca?: string; limite?: number; deslocamento?: number }) =>
    pedir<ConversaResumo[]>('atendimento/conversas', { query: { limite: 100, ...q, busca: q.busca && q.busca.trim().length >= 2 ? q.busca.trim().slice(0, 80) : undefined } }),
  conversa: (id: string) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}`),
  anteriores: (id: string, antes_de: number) => pedir<MensagemPainel[]>(`atendimento/conversas/${id}/mensagens`, { query: { antes_de, limite: 50 } }),
  /** Ficha contextual: cadastros deste telefone, reservas, consentimentos e movimento da conversa (sem fundir cadastros). */
  contato: (id: string) => pedir<FichaContato>(`atendimento/conversas/${id}/contato`),
  /** Assumir = a equipe atende e o assistente pausa nesta conversa. Com outra pessoa atendendo, só com `transferir` (senão 409 conversa_ja_assumida). */
  assumir: (id: string, transferir = false) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/assumir`, { metodo: 'POST', corpo: { transferir } }),
  /** Texto livre só na janela de 24 h (409 fora_da_janela_24h). O backend desliga o assistente ANTES do envio. */
  responder: (id: string, texto: string) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/responder`, { metodo: 'POST', corpo: { texto } }),
  /** Ligar = devolver ao assistente (só o que o cliente escrever depois); desligar = vai para "Esperando".
   *  409 assistente_desligado quando o assistente está desligado na configuração do servidor. */
  assistente: (id: string, ligado: boolean) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/assistente`, { metodo: 'POST', corpo: { ligado } }),
  encerrar: (id: string) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/encerrar`, { metodo: 'POST' }),
  followup: (id: string, ligado: boolean) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/followup`, { metodo: 'POST', corpo: { ligado } }),
  templates: () => pedir<TemplateWhatsapp[]>('atendimento/templates'),
  /** Para "Nova conversa": cadastros (com ou sem conversa) por nome ou dígitos do telefone (2 a 80 caracteres). */
  contatos: (busca: string) => pedir<ContatoBusca[]>('atendimento/contatos', { query: { busca: busca.trim().slice(0, 80) } }),
  /** Template aprovado a qualquer hora; texto livre só na janela de 24 h (409 fora_da_janela_24h). Quem inicia assume a conversa. */
  novaConversa: (e: NovaConversaEntrada) => pedir<ConversaDetalhe>('atendimento/conversas', { metodo: 'POST', corpo: e }),
  campanhas: () => pedir<Campanha[]>('atendimento/campanhas'),
  campanha: (id: number) => pedir<CampanhaDetalhe>(`atendimento/campanhas/${id}`),
  /** Cria o rascunho (nada sai): cada destinatário já vem pendente ou bloqueado, com o motivo. */
  criarCampanha: (e: NovaCampanhaEntrada) => pedir<CampanhaDetalhe>('atendimento/campanhas', { metodo: 'POST', corpo: e }),
  /** Envia UM lote; chamar de novo enquanto `destinatarios.pendente` > 0. */
  enviarLote: (id: number) => pedir<Campanha>(`atendimento/campanhas/${id}/enviar`, { metodo: 'POST' }),
  cancelarCampanha: (id: number) => pedir<Campanha>(`atendimento/campanhas/${id}/cancelar`, { metodo: 'POST' }),
  conhecimento: () => pedir<BaseConhecimento>('atendimento/conhecimento'),
  salvarConhecimento: (chave: string, item: Pick<ItemConhecimento, 'tema' | 'conteudo' | 'fonte' | 'ativo'>) =>
    pedir<ItemConhecimento>(`atendimento/conhecimento/${encodeURIComponent(chave)}`, { metodo: 'PUT', corpo: item }),
  /** Desativa (não apaga): o assistente deixa de usar; o registro fica. */
  desativarConhecimento: (chave: string) => pedir<ItemConhecimento>(`atendimento/conhecimento/${encodeURIComponent(chave)}`, { metodo: 'DELETE' }),
  duplicidades: () => pedir<Duplicidades>('atendimento/duplicidades'),
  /** Liga um cadastro duplicado ao principal (mesmo telefone ou e-mail). Nada é apagado nem fundido. */
  vincular: (cliente_id: string, principal_id: string, motivo: string) =>
    pedir<{ id: number; cliente_id: string; principal_id: string; ativo: boolean }>('atendimento/vinculos', { metodo: 'POST', corpo: { cliente_id, principal_id, motivo } }),
};

export const clube = {
  resumo: () => pedir<ResumoClube>('clube/resumo'),
  membros: (q: { estado?: EstadoMembro; busca?: string; limite?: number; deslocamento?: number }) => pedir<Pagina<MembroLista>>('clube/membros', { query: { limite: 50, ...q } }),
  membro: (id: string) => pedir<MembroFicha>(`clube/membros/${id}`),
  historico: (id: string) => pedir<HistoricoMembro[]>(`clube/membros/${id}/historico`),
  suspender: (id: string, motivo: string) => pedir<unknown>(`clube/membros/${id}/suspender`, { metodo: 'POST', corpo: { motivo } }),
  reativar: (id: string, motivo: string) => pedir<unknown>(`clube/membros/${id}/reativar`, { metodo: 'POST', corpo: { motivo } }),
  revogarSessoes: (id: string, motivo: string) => pedir<unknown>(`clube/membros/${id}/sessoes/revogar`, { metodo: 'POST', corpo: { motivo } }),
  vendas: (q: { situacao?: 'todas' | 'sem_cliente' | 'conferir_telefone' | 'ligadas'; data_de?: string; limite?: number }) => pedir<Pagina<VendaClube>>('clube/vendas', { query: { limite: 50, ...q } }),
  confirmarTelefone: (vendaId: string, motivo: string) => pedir<unknown>(`clube/vendas/${vendaId}/confirmar-telefone`, { metodo: 'POST', corpo: { motivo } }),
  /** Só com PAINEL_CLUBE_CONVITES ligado (lançamento do Clube): o backend envia o link pelo WhatsApp. */
  convidarPorVenda: (venda_id: string, texto_versao: string) => pedir<{ id: string; expira_em: string; mensagem_status: string }>('clube/convites/por-venda', { metodo: 'POST', corpo: { venda_id, autorizacao_confirmada: true, texto_versao } }),
  convites: (q: { situacao?: 'aguardando' | 'expirado' | 'usado'; limite?: number }) => pedir<Pagina<ConviteClube>>('clube/convites', { query: { limite: 50, ...q } }),
  mensagens: (q: { status?: string; limite?: number }) => pedir<Pagina<MensagemClube>>('clube/mensagens', { query: { limite: 50, ...q } }),
};
