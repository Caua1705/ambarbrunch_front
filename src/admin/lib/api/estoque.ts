// Estoque e Visão Geral — rotas reais /admin/estoque* e /admin/visao-geral*. Formatos conferidos no código do backend
// (app/modulos/estoque/api_admin.py, api_compras.py, api_fichas.py, api_analises.py). A ponte do painel acrescenta
// `?unidade=` em toda consulta; no envio de arquivo (multipart) o backend lê a unidade do FORMULÁRIO, então ela vai lá.
import { pedir, novaChave } from './cliente';
import type { Pagina, Cursor } from '../tipos/comum';
import type {
  CompraDetalhe, CompraLista, CompraManualEntrada, ConfirmacaoCompra, DespesaDaCompra, FichaDetalhe, FichaLista, FichaSalva, Insumo, InsumoCadastro,
  InsumoDetalhe, MovimentoEstoque, ResolucaoItem, ResumoEstoque, SugestaoInsumo, ProdutoAnalise, Ruptura, Reposicao, Cardapio,
  FornecedoresAnalise, CmvAnalise, SugestaoInventario, Inventario, InventarioResumo, ContagemItem, FechamentoInventario, UnidadeBase, EtapaCompra,
  CancelamentoEstoque, SituacaoCancelamento, DecisaoCancelamento, EscopoInventario, StatusInventario, AjusteSaldo, MotivoAjuste, MotivoDiferenca,
  InsumoCriado, OpcaoInsumo, InsumoSemelhante, Correspondencia, VinculosCardapio,
} from '../tipos/estoque';
import type { VisaoGeral, RadarInsight } from '../tipos/visao-geral';

export type FiltroInsumos = { busca?: string; situacao?: 'abaixo_minimo' | 'negativo' | 'inativo'; tipo?: 'comprado' | 'preparo'; categoria?: string; limite?: number; deslocamento?: number };

export const estoque = {
  resumo: () => pedir<ResumoEstoque>('estoque/resumo'),
  // Insumos (catálogo e edição: estoque.editar; leitura e perda: estoque.visualizar)
  insumos: (q: FiltroInsumos = {}) => pedir<Pagina<Insumo>>('estoque/insumos', { query: { limite: 200, ...q } }),
  insumo: (id: string) => pedir<InsumoDetalhe>(`estoque/insumos/${id}`),
  /** 0028: `quantidade_inicial` e `custo_unitario_inicial` gravam a abertura na MESMA transação (`abertura` na resposta);
   *  custo sem quantidade > 0 → 422 `custo_sem_entrada`. O backend anterior ignora os dois (a resposta vem sem
   *  `abertura`): quem chama confere a chave antes de achar que gravou. */
  criarInsumo: (
    i: { nome: string; unidade_base: UnidadeBase; tipo?: 'comprado' | 'preparo'; controle_preparo?: 'explodir' | 'lote' | null; categoria?: string | null; estoque_minimo?: string | null; estoque_ideal?: string | null; quantidade_inicial?: string; custo_unitario_inicial?: string },
    chave = novaChave(),
  ) => pedir<InsumoCriado>('estoque/insumos', { metodo: 'POST', corpo: i, idempotencia: chave }),
  /** Campos omitidos não mudam; `estoque_ideal: null` LIMPA o ideal (0028). */
  alterarInsumo: (id: string, i: { versao: number; nome?: string; categoria?: string; estoque_minimo?: string; estoque_ideal?: string | null; controle_preparo?: 'explodir' | 'lote'; prazo_reposicao_dias?: number; ativo?: boolean }) =>
    pedir<InsumoCadastro>(`estoque/insumos/${id}`, { metodo: 'PATCH', corpo: i }),
  /** Combobox (0028): acha pelo nome e pelos textos de nota já confirmados. Backend anterior: 404 de rota. */
  opcoesInsumo: (busca: string, limite = 50) => pedir<OpcaoInsumo[]>('estoque/insumos/opcoes', { query: { busca: busca || undefined, limite } }),
  /** Antes de cadastrar: ativos que parecem o mesmo (só aviso, 0028). */
  semelhantes: (nome: string, unidade_base: UnidadeBase) => pedir<InsumoSemelhante[]>('estoque/insumos/semelhantes', { query: { nome, unidade_base } }),
  /** Motor de correspondência para um item lido (0028): candidatos ordenados; nada é confirmado sozinho. */
  candidatosItem: (compraId: string, itemId: string) => pedir<Correspondencia>(`estoque/compras/${compraId}/itens/${itemId}/candidatos`),
  /** Produto do PDV × catálogo oficial (0028). */
  vinculosCardapio: () => pedir<VinculosCardapio>('estoque/vinculos-cardapio'),
  /** Vínculo explícito (null desfaz). 422 catalogo_item_inexistente · 409 catalogo_ja_vinculado · 422 taxa_de_servico. */
  vincularCatalogo: (eyeProductId: string, catalogo_item_id: string | null) =>
    pedir<{ eye_product_id: string; catalogo_item_id: string | null; vinculado_em: string | null }>(`estoque/fichas/produto/${encodeURIComponent(eyeProductId)}/catalogo`, { metodo: 'PUT', corpo: { catalogo_item_id } }),
  movimentos: (id: string, antes_de?: number) => pedir<Cursor<MovimentoEstoque>>(`estoque/insumos/${id}/movimentos`, { query: { antes_de, limite: 30 } }),
  /** O que o sistema sugeriria para uma descrição da nota: UM objeto (insumo_id null = sem sugestão). */
  sugestaoInsumo: (texto: string, unidade_fiscal?: string, fornecedor_id?: string | null) =>
    pedir<SugestaoInsumo>('estoque/insumos-sugestoes', { query: { texto, unidade_fiscal, fornecedor_id } }),
  /** Saída manual. `uso_interno` (backend 02/11) sai do estoque sem contar como perda; o backend anterior recusa (422).
   *  `ocorreu_em` opcional (padrão: agora). */
  registrarPerda: (p: { insumo_id: string; quantidade: string; motivo: 'vencido' | 'quebra' | 'preparo' | 'uso_interno' | 'outro'; observacao?: string; ocorreu_em?: string }, chave = novaChave()) =>
    pedir<MovimentoEstoque>('estoque/perdas', { metodo: 'POST', corpo: p, idempotencia: chave }),
  /** Ajuste avulso com motivo (backend 02/11): saldo anterior, novo, diferença e responsável. Backend anterior: 404. */
  ajustar: (a: { insumo_id: string; quantidade: string; motivo: MotivoAjuste; observacao?: string; custo_unitario?: string }, chave = novaChave()) =>
    pedir<AjusteSaldo>('estoque/ajustes', { metodo: 'POST', corpo: a, idempotencia: chave }),
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
  /** Compra em conferência sem itens da nota (ex.: veio do comprovante do Pix) ou rascunho digitado: refazer devolve a
   *  compra que substituiu o rascunho (`id` novo). Itens lidos da nota: 409 compra_ja_lida. */
  preencherManual: (id: string, c: CompraManualEntrada & { versao: number }) => pedir<CompraDetalhe>(`estoque/compras/${id}/manual`, { metodo: 'PUT', corpo: c }),
  /** Nota fiscal da compra pendente de um pagamento, enviada no painel: nasce a compra da nota (`id`), que confere o MESMO
   *  pagamento (nenhuma despesa nova); a pendência anterior é cancelada. */
  anexarNota: (id: string, arquivo: File) => {
    const f = new FormData();
    f.set('arquivo', arquivo);
    return pedir<{ id: string; etapa: EtapaCompra; substitui: string; ja_existia: boolean }>(`estoque/compras/${id}/nota`, { metodo: 'POST', formulario: f });
  },
  resolverItem: (compraId: string, itemId: string, r: ResolucaoItem) => pedir<CompraDetalhe>(`estoque/compras/${compraId}/itens/${itemId}`, { metodo: 'PATCH', corpo: r }),
  confirmarCompra: (id: string, c: { versao: number; despesa?: DespesaDaCompra; motivo_divergencia?: string; diferenca_financeira?: { motivo: MotivoDiferenca; observacao: string } }) => pedir<ConfirmacaoCompra>(`estoque/compras/${id}/confirmar`, { metodo: 'POST', corpo: c }),
  cancelarCompra: (id: string, motivo: string) => pedir<CompraDetalhe>(`estoque/compras/${id}/cancelar`, { metodo: 'POST', corpo: { motivo } }),
  /** Lê de novo (falhou ou ficou sem itens): nasce uma compra NOVA (`id`), a antiga é cancelada. */
  reprocessar: (id: string) => pedir<{ id: string; etapa: EtapaCompra; substitui: string }>(`estoque/compras/${id}/reprocessar`, { metodo: 'POST' }),
  // Fichas técnicas (estoque.editar)
  /** `incluir_sem_venda` (0028): também os produtos do cardápio da loja e os que já têm ficha. O backend anterior ignora. */
  fichas: (situacao: 'sem_ficha' | 'com_ficha' | 'todas' = 'todas', dias = 30, incluir_sem_venda = false) =>
    pedir<FichaLista[]>('estoque/fichas', { query: { situacao, dias, ...(incluir_sem_venda ? { incluir_sem_venda: true } : {}) } }),
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
