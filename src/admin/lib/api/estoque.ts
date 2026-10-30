// Estoque e Visão Geral — rotas reais /admin/estoque* e /admin/visao-geral*. Formatos conferidos no código do backend
// (app/modulos/estoque/api_admin.py, api_compras.py, api_fichas.py, api_analises.py). A ponte do painel acrescenta
// `?unidade=` em toda consulta; no envio de arquivo (multipart) o backend lê a unidade do FORMULÁRIO, então ela vai lá.
import { pedir, novaChave } from './cliente';
import type { Pagina, Cursor } from '../tipos/comum';
import type {
  CompraDetalhe, CompraLista, CompraManualEntrada, ConfirmacaoCompra, DespesaDaCompra, FichaDetalhe, FichaLista, FichaSalva, Insumo, InsumoCadastro,
  InsumoDetalhe, MovimentoEstoque, ResolucaoItem, ResumoEstoque, SugestaoInsumo, ProdutoAnalise, Ruptura, Reposicao, Cardapio,
  FornecedoresAnalise, CmvAnalise, SugestaoInventario, Inventario, InventarioResumo, ContagemItem, FechamentoInventario, UnidadeBase, EtapaCompra,
  CancelamentoEstoque, SituacaoCancelamento, DecisaoCancelamento, EscopoInventario, StatusInventario,
} from '../tipos/estoque';
import type { VisaoGeral, RadarInsight } from '../tipos/visao-geral';

export type FiltroInsumos = { busca?: string; situacao?: 'abaixo_minimo' | 'negativo' | 'inativo'; tipo?: 'comprado' | 'preparo'; categoria?: string; limite?: number; deslocamento?: number };

export const estoque = {
  resumo: () => pedir<ResumoEstoque>('estoque/resumo'),
  // Insumos (catálogo e edição: estoque.editar; leitura e perda: estoque.visualizar)
  insumos: (q: FiltroInsumos = {}) => pedir<Pagina<Insumo>>('estoque/insumos', { query: { limite: 200, ...q } }),
  insumo: (id: string) => pedir<InsumoDetalhe>(`estoque/insumos/${id}`),
  criarInsumo: (i: { nome: string; unidade_base: UnidadeBase; tipo?: 'comprado' | 'preparo'; controle_preparo?: 'explodir' | 'lote' | null; categoria?: string | null; estoque_minimo?: string | null }) =>
    pedir<InsumoCadastro>('estoque/insumos', { metodo: 'POST', corpo: i }),
  /** Campos omitidos (ou null) não mudam: o backend descarta os nulos. */
  alterarInsumo: (id: string, i: { versao: number; nome?: string; categoria?: string; estoque_minimo?: string; controle_preparo?: 'explodir' | 'lote'; prazo_reposicao_dias?: number; ativo?: boolean }) =>
    pedir<InsumoCadastro>(`estoque/insumos/${id}`, { metodo: 'PATCH', corpo: i }),
  movimentos: (id: string, antes_de?: number) => pedir<Cursor<MovimentoEstoque>>(`estoque/insumos/${id}/movimentos`, { query: { antes_de, limite: 30 } }),
  /** O que o sistema sugeriria para uma descrição da nota: UM objeto (insumo_id null = sem sugestão). */
  sugestaoInsumo: (texto: string, unidade_fiscal?: string, fornecedor_id?: string | null) =>
    pedir<SugestaoInsumo>('estoque/insumos-sugestoes', { query: { texto, unidade_fiscal, fornecedor_id } }),
  registrarPerda: (p: { insumo_id: string; quantidade: string; motivo: 'vencido' | 'quebra' | 'preparo' | 'outro'; observacao?: string }, chave = novaChave()) =>
    pedir<MovimentoEstoque>('estoque/perdas', { metodo: 'POST', corpo: p, idempotencia: chave }),
  // Contagem (inventário): no máximo uma aberta por unidade; 409 inventario_aberto traz dados.inventario_id
  sugestaoInventario: () => pedir<SugestaoInventario[]>('estoque/inventarios/sugestao'),
  inventarios: (q: { status?: StatusInventario; limite?: number } = {}) => pedir<InventarioResumo[]>('estoque/inventarios', { query: { limite: 20, ...q } }),
  abrirInventario: (escopo: EscopoInventario, insumos?: string[]) => pedir<Inventario>('estoque/inventarios', { metodo: 'POST', corpo: { escopo, insumos: insumos ?? null } }),
  inventario: (id: string) => pedir<Inventario>(`estoque/inventarios/${id}`),
  contar: (id: string, insumoId: string, quantidade: string) => pedir<ContagemItem>(`estoque/inventarios/${id}/itens/${insumoId}`, { metodo: 'PUT', corpo: { quantidade } }),
  fecharInventario: (id: string) => pedir<FechamentoInventario>(`estoque/inventarios/${id}/fechar`, { metodo: 'POST' }),
  cancelarInventario: (id: string) => pedir<{ id: string; status: StatusInventario }>(`estoque/inventarios/${id}/cancelar`, { metodo: 'POST' }),
  // Compras (conferir: estoque.conferir; cancelar: estoque.editar)
  compras: (q: { etapa?: EtapaCompra; fornecedor_id?: string; de?: string; ate?: string; limite?: number; deslocamento?: number }) => pedir<Pagina<CompraLista>>('estoque/compras', { query: { limite: 100, ...q } }),
  compra: (id: string) => pedir<CompraDetalhe>(`estoque/compras/${id}`),
  enviarNota: (arquivo: File, unidade?: string | null) => {
    const f = new FormData();
    f.set('arquivo', arquivo);
    if (unidade) f.set('unidade', unidade);
    return pedir<{ id: string; etapa: EtapaCompra; ja_existia: boolean }>('estoque/compras', { metodo: 'POST', formulario: f });
  },
  /** 201 com a compra inteira (mesmo formato do detalhe). */
  compraManual: (c: CompraManualEntrada, chave = novaChave()) => pedir<CompraDetalhe>('estoque/compras/manual', { metodo: 'POST', corpo: c, idempotencia: chave }),
  /** Só para compra em conferência ainda sem itens (ex.: veio do comprovante do Pix); senão 409 compra_ja_lida. */
  preencherManual: (id: string, c: CompraManualEntrada & { versao: number }) => pedir<CompraDetalhe>(`estoque/compras/${id}/manual`, { metodo: 'PUT', corpo: c }),
  resolverItem: (compraId: string, itemId: string, r: ResolucaoItem) => pedir<CompraDetalhe>(`estoque/compras/${compraId}/itens/${itemId}`, { metodo: 'PATCH', corpo: r }),
  confirmarCompra: (id: string, c: { versao: number; despesa?: DespesaDaCompra; motivo_divergencia?: string }) => pedir<ConfirmacaoCompra>(`estoque/compras/${id}/confirmar`, { metodo: 'POST', corpo: c }),
  cancelarCompra: (id: string, motivo: string) => pedir<CompraDetalhe>(`estoque/compras/${id}/cancelar`, { metodo: 'POST', corpo: { motivo } }),
  /** Lê de novo (falhou ou ficou sem itens): nasce uma compra NOVA (`id`), a antiga é cancelada. */
  reprocessar: (id: string) => pedir<{ id: string; etapa: EtapaCompra; substitui: string }>(`estoque/compras/${id}/reprocessar`, { metodo: 'POST' }),
  // Fichas técnicas (estoque.editar)
  fichas: (situacao: 'sem_ficha' | 'com_ficha' | 'todas' = 'todas', dias = 30) => pedir<FichaLista[]>('estoque/fichas', { query: { situacao, dias } }),
  ficha: (alvo: 'produto' | 'preparo', id: string) => pedir<FichaDetalhe>(`estoque/fichas/${alvo}/${id}`),
  salvarFicha: (alvo: 'produto' | 'preparo', id: string, f: { rendimento: string; itens: { insumo_id: string; quantidade: string; perda_percentual?: string; opcional?: boolean }[]; observacao?: string }) =>
    pedir<FichaSalva>(`estoque/fichas/${alvo}/${id}`, { metodo: 'PUT', corpo: f }),
  // Vendas canceladas depois da baixa (estoque.visualizar). Sem `situacao` o backend usa "pendente".
  cancelamentos: (situacao: SituacaoCancelamento = 'pendente', limite = 100, deslocamento = 0) =>
    pedir<Pagina<CancelamentoEstoque>>('estoque/cancelamentos', { query: { situacao, limite, deslocamento } }),
  resolverCancelamento: (id: string, versao: number, decisao: DecisaoCancelamento, observacao?: string) =>
    pedir<CancelamentoEstoque>(`estoque/cancelamentos/${id}/resolver`, { metodo: 'POST', corpo: { versao, decisao, ...(observacao ? { observacao } : {}) } }),
  // Análises (estoque.visualizar)
  produtos: (de: string, ate: string, ordenar: 'receita' | 'quantidade' | 'contribuicao' | 'margem' = 'receita') => pedir<ProdutoAnalise[]>('estoque/analises/produtos', { query: { de, ate, ordenar } }),
  cmv: (mes: string) => pedir<CmvAnalise>('estoque/analises/cmv', { query: { mes } }),
  cardapio: (de: string, ate: string, q: { grupo?: string; minimo_vendas?: number } = {}) => pedir<Cardapio>('estoque/analises/cardapio', { query: { de, ate, ...q } }),
  fornecedores: (de: string, ate: string, insumo_id?: string) => pedir<FornecedoresAnalise>('estoque/analises/fornecedores', { query: { de, ate, insumo_id } }),
  ruptura: () => pedir<Ruptura>('estoque/analises/ruptura'),
  reposicao: (dias_cobertura = 7) => pedir<Reposicao>('estoque/analises/reposicao', { query: { dias_cobertura } }),
};

export const visaoGeral = {
  obter: () => pedir<VisaoGeral>('visao-geral'),
  radar: () => pedir<Pagina<RadarInsight>>('visao-geral/radar', { query: { status: 'abertos', limite: 20 } }),
  statusRadar: (id: number, status: RadarInsight['status']) => pedir<RadarInsight>(`visao-geral/radar/${id}/status`, { metodo: 'POST', corpo: { status } }),
};
