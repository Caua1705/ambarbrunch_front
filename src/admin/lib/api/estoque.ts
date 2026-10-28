// Estoque e Visão Geral — rotas reais /admin/estoque* e /admin/visao-geral* (código do backend; não publicadas ainda).
import { pedir, novaChave } from './cliente';
import type { Pagina, Cursor } from '../tipos/comum';
import type {
  CompraDetalhe, CompraLista, DespesaDaCompra, FichaDetalhe, FichaLista, Insumo, InsumoDetalhe, ItemManual, MovimentoEstoque,
  ResolucaoItem, ResumoEstoque, SugestaoInsumo, ProdutoAnalise, Ruptura, Cardapio, FornecedoresAnalise, CmvAnalise,
  SugestaoInventario, Inventario, UnidadeBase, EtapaCompra, CancelamentoEstoque, ItemReposicao,
} from '../tipos/estoque';
import type { VisaoGeral, RadarInsight } from '../tipos/visao-geral';

export const estoque = {
  resumo: () => pedir<ResumoEstoque>('estoque/resumo'),
  insumos: (q: { busca?: string; situacao?: string; limite?: number; deslocamento?: number }) => pedir<Pagina<Insumo>>('estoque/insumos', { query: { limite: 200, ...q } }),
  insumo: (id: string) => pedir<InsumoDetalhe>(`estoque/insumos/${id}`),
  criarInsumo: (i: { nome: string; unidade_base: UnidadeBase; categoria?: string | null; estoque_minimo?: string | null }) => pedir<Insumo>('estoque/insumos', { metodo: 'POST', corpo: i }),
  alterarInsumo: (id: string, i: { versao: number; nome?: string; categoria?: string | null; estoque_minimo?: string | null; prazo_reposicao_dias?: number | null; ativo?: boolean }) =>
    pedir<InsumoDetalhe>(`estoque/insumos/${id}`, { metodo: 'PATCH', corpo: i }),
  movimentos: (id: string, antes_de?: number) => pedir<Cursor<MovimentoEstoque>>(`estoque/insumos/${id}/movimentos`, { query: { antes_de, limite: 30 } }),
  sugestoesInsumo: (texto: string, unidade_fiscal?: string) => pedir<SugestaoInsumo[]>('estoque/insumos-sugestoes', { query: { texto, unidade_fiscal } }),
  registrarPerda: (p: { insumo_id: string; quantidade: string; motivo: 'vencido' | 'quebra' | 'preparo' | 'outro'; observacao?: string }, chave = novaChave()) =>
    pedir<unknown>('estoque/perdas', { metodo: 'POST', corpo: p, idempotencia: chave }),
  // Contagem (inventário)
  sugestaoInventario: () => pedir<SugestaoInventario[]>('estoque/inventarios/sugestao'),
  abrirInventario: (escopo: 'sugerido' | 'lista' | 'total', insumos?: string[]) => pedir<Inventario>('estoque/inventarios', { metodo: 'POST', corpo: { escopo, insumos: insumos ?? null } }),
  inventario: (id: string) => pedir<Inventario>(`estoque/inventarios/${id}`),
  contar: (id: string, insumoId: string, quantidade: string) => pedir<unknown>(`estoque/inventarios/${id}/itens/${insumoId}`, { metodo: 'PUT', corpo: { quantidade } }),
  fecharInventario: (id: string) => pedir<Inventario>(`estoque/inventarios/${id}/fechar`, { metodo: 'POST' }),
  cancelarInventario: (id: string) => pedir<Inventario>(`estoque/inventarios/${id}/cancelar`, { metodo: 'POST' }),
  // Compras
  compras: (q: { etapa?: EtapaCompra; de?: string; ate?: string; limite?: number }) => pedir<Pagina<CompraLista>>('estoque/compras', { query: { limite: 100, ...q } }),
  compra: (id: string) => pedir<CompraDetalhe>(`estoque/compras/${id}`),
  enviarNota: (arquivo: File) => {
    const f = new FormData();
    f.set('arquivo', arquivo);
    return pedir<{ id: string; etapa: EtapaCompra; ja_existia: boolean }>('estoque/compras', { metodo: 'POST', formulario: f });
  },
  compraManual: (c: { fornecedor_nome?: string; fornecedor_documento?: string; emitida_em: string; valor_total: string; itens: ItemManual[] }, chave = novaChave()) =>
    pedir<{ id: string }>('estoque/compras/manual', { metodo: 'POST', corpo: c, idempotencia: chave }),
  preencherManual: (id: string, c: { versao: number; fornecedor_nome?: string; emitida_em: string; valor_total: string; itens: ItemManual[] }) =>
    pedir<CompraDetalhe>(`estoque/compras/${id}/manual`, { metodo: 'PUT', corpo: c }),
  resolverItem: (compraId: string, itemId: string, r: ResolucaoItem) => pedir<CompraDetalhe>(`estoque/compras/${compraId}/itens/${itemId}`, { metodo: 'PATCH', corpo: r }),
  confirmarCompra: (id: string, c: { versao: number; despesa?: DespesaDaCompra; motivo_divergencia?: string }) =>
    pedir<{ compra_id: string; etapa: string; despesa_id: string | null; movimentos: number; ja_estava_confirmada: boolean }>(`estoque/compras/${id}/confirmar`, { metodo: 'POST', corpo: c }),
  cancelarCompra: (id: string, motivo: string) => pedir<unknown>(`estoque/compras/${id}/cancelar`, { metodo: 'POST', corpo: { motivo } }),
  reprocessar: (id: string) => pedir<unknown>(`estoque/compras/${id}/reprocessar`, { metodo: 'POST' }),
  // Fichas técnicas
  fichas: (situacao: 'sem_ficha' | 'com_ficha' | 'todas' = 'todas') => pedir<FichaLista[]>('estoque/fichas', { query: { situacao, dias: 30 } }),
  ficha: (alvo: 'produto' | 'preparo', id: string) => pedir<FichaDetalhe>(`estoque/fichas/${alvo}/${id}`),
  salvarFicha: (alvo: 'produto' | 'preparo', id: string, f: { rendimento: string; itens: { insumo_id: string; quantidade: string; perda_percentual?: string }[]; observacao?: string }) =>
    pedir<FichaDetalhe>(`estoque/fichas/${alvo}/${id}`, { metodo: 'PUT', corpo: f }),
  // Vendas canceladas depois da baixa (§3.5)
  cancelamentos: (situacao = 'pendente') => pedir<Pagina<CancelamentoEstoque>>('estoque/cancelamentos', { query: { situacao, limite: 50 } }),
  resolverCancelamento: (id: string, versao: number, decisao: 'nao_produzido' | 'produzido_descartado') => pedir<CancelamentoEstoque>(`estoque/cancelamentos/${id}/resolver`, { metodo: 'POST', corpo: { versao, decisao } }),
  // Análises
  produtos: (de: string, ate: string, ordenar = 'receita') => pedir<ProdutoAnalise[]>('estoque/analises/produtos', { query: { de, ate, ordenar } }),
  cmv: (mes: string) => pedir<CmvAnalise>('estoque/analises/cmv', { query: { mes } }),
  cardapio: (de: string, ate: string) => pedir<Cardapio>('estoque/analises/cardapio', { query: { de, ate } }),
  fornecedores: (de: string, ate: string) => pedir<FornecedoresAnalise>('estoque/analises/fornecedores', { query: { de, ate } }),
  ruptura: () => pedir<Ruptura>('estoque/analises/ruptura'),
  reposicao: (dias_cobertura = 7) => pedir<{ disponivel?: boolean; motivos?: { codigo: string; texto: string }[]; itens: ItemReposicao[]; aviso?: string }>('estoque/analises/reposicao', { query: { dias_cobertura } }),
};

export const visaoGeral = {
  obter: () => pedir<VisaoGeral>('visao-geral'),
  radar: () => pedir<Pagina<RadarInsight>>('visao-geral/radar', { query: { status: 'abertos', limite: 20 } }),
  statusRadar: (id: number, status: RadarInsight['status']) => pedir<RadarInsight>(`visao-geral/radar/${id}/status`, { metodo: 'POST', corpo: { status } }),
};
