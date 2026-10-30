// Atendimento (WhatsApp oficial) e Clube — rotas reais do backend. Atendimento conferido com
// app/modulos/atendimento/api_admin.py (todas as ações exigem só atendimento.visualizar; o servidor decide dono e janela).
import { pedir } from './cliente';
import type { Pagina } from '../tipos/comum';
import type {
  ConversaDetalhe, ConversaResumo, FalhaAtendimento, MensagemPainel, ModoConversa, ResumoAtendimento,
  ResumoClube, MembroLista, MembroFicha, HistoricoMembro, VendaClube, ConviteClube, MensagemClube, EstadoMembro,
} from '../tipos/atendimento-clube';

export const atendimento = {
  resumo: () => pedir<ResumoAtendimento>('atendimento/resumo'),
  falhas: (limite = 20) => pedir<FalhaAtendimento[]>('atendimento/falhas', { query: { limite } }),
  /** `busca`: nome ou 4+ dígitos do telefone; o backend exige 2 a 80 caracteres (menos que 2 não vai). */
  conversas: (q: { modo?: ModoConversa; aguardando_equipe?: boolean; atendente_id?: string; busca?: string; limite?: number; deslocamento?: number }) =>
    pedir<ConversaResumo[]>('atendimento/conversas', { query: { limite: 100, ...q, busca: q.busca && q.busca.trim().length >= 2 ? q.busca.trim().slice(0, 80) : undefined } }),
  conversa: (id: string) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}`),
  anteriores: (id: string, antes_de: number) => pedir<MensagemPainel[]>(`atendimento/conversas/${id}/mensagens`, { query: { antes_de, limite: 50 } }),
  /** Assumir = a equipe atende e a IA pausa nesta conversa. Com outra pessoa atendendo, só com `transferir` (senão 409 conversa_ja_assumida). */
  assumir: (id: string, transferir = false) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/assumir`, { metodo: 'POST', corpo: { transferir } }),
  /** Texto livre só na janela de 24 h (409 fora_da_janela_24h). Responder conversa sem dono também a assume e pausa o robô. */
  responder: (id: string, texto: string) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/responder`, { metodo: 'POST', corpo: { texto } }),
  devolver: (id: string) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/devolver`, { metodo: 'POST' }),
  encerrar: (id: string) => pedir<ConversaDetalhe>(`atendimento/conversas/${id}/encerrar`, { metodo: 'POST' }),
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
