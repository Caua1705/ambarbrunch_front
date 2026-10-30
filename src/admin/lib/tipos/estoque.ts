// Estoque — formatos conferidos campo a campo no código do backend (app/modulos/estoque/api_*.py e os módulos que elas
// chamam). Dinheiro e quantidades em string decimal; o painel só formata, nunca calcula regra.
import type { Data, Dec, Instante, Uuid } from './comum';

export type UnidadeBase = 'g' | 'ml' | 'un';
export type MotivoNaoConfiavel = 'sem_movimento' | 'baixa_desligada' | 'nunca_contado' | 'ficou_negativo';

/** GET /admin/estoque/resumo (analises.resumo + identificação da unidade). */
export interface ResumoEstoque {
  abaixo_minimo: { insumo_id: Uuid; insumo: string; unidade_base: UnidadeBase; saldo: Dec; estoque_minimo: Dec; saldo_confiavel: boolean }[];
  compras_em_conferencia: { qtd: number; mais_antiga_em: Instante | null };
  cancelamentos_pendentes: number;
  sem_ficha_mais_vendidos: { eye_product_id: string; produto: string; receita: Dec }[];
  /** Fração 0–1 (ex.: "0.6123"). */
  cobertura_fichas_30d: Dec | null;
  altas_de_custo_90d: { insumo_id: Uuid; insumo: string; unidade_base: UnidadeBase; custo_inicio: Dec; custo_fim: Dec; compras: number; menor: Dec; maior: Dec; variacao_pct: Dec | null }[];
  saldo_confiavel: { insumos: number; total: number };
  baixa_automatica: boolean;
  inicio_controle: Data | null;
  /** Unidade de negócio da consulta (`teste`: unidade de ensaio). Opcional: respostas antigas não traziam. */
  unidade?: { codigo: string; nome: string; teste: boolean };
}

/** Cadastro do insumo como o backend devolve ao criar/alterar (sem saldo). */
export interface InsumoCadastro {
  id: Uuid;
  codigo: string;
  nome: string;
  categoria: string | null;
  unidade_base: UnidadeBase;
  tipo: 'comprado' | 'preparo';
  controle_preparo: 'explodir' | 'lote' | null;
  estoque_minimo: Dec | null;
  prazo_reposicao_dias: number | null;
  ativo: boolean;
  versao: number;
}

/** Linha de GET /admin/estoque/insumos (insumos.listar). */
export interface Insumo extends Omit<InsumoCadastro, 'prazo_reposicao_dias'> {
  saldo: Dec;
  custo_medio: Dec | null;
  ultimo_custo_compra: Dec | null;
  ultima_compra_em: Instante | null;
  ultima_contagem_em: Instante | null;
  cobertura_dias: Dec | null;
  saldo_confiavel: boolean;
  motivo_nao_confiavel: MotivoNaoConfiavel | null;
  abaixo_minimo: boolean;
}

/** GET /admin/estoque/insumos/{id}. */
export interface InsumoDetalhe extends InsumoCadastro {
  saldo: Dec;
  custo_medio: Dec | null;
  saldo_confiavel: boolean;
  motivo_nao_confiavel: MotivoNaoConfiavel | null;
  precos: { ocorreu_em: Instante; custo_unitario: Dec | null; quantidade: Dec; compra_item_id: Uuid | null }[];
  usado_em: { alvo: 'produto' | 'preparo'; eye_product_id: string | null; preparo_id: Uuid | null; nome: string | null; quantidade: Dec }[];
}

export type TipoMovimento = 'saldo_inicial' | 'entrada_compra' | 'consumo_venda' | 'estorno_consumo' | 'producao_saida' | 'producao_entrada' | 'perda' | 'ajuste_inventario' | 'estorno';
/** Movimento do livro (GET …/insumos/{id}/movimentos e resposta de POST …/perdas). */
export interface MovimentoEstoque {
  id: number;
  tipo: TipoMovimento;
  quantidade: Dec;
  custo_unitario: Dec | null;
  valor: Dec | null;
  custo_desconhecido: boolean;
  saldo_apos: Dec | null;
  custo_medio_apos: Dec | null;
  ocorreu_em: Instante;
  dia: Data;
  venda_id: Uuid | null;
  eye_product_id: string | null;
  compra_item_id: Uuid | null;
  producao_id: Uuid | null;
  inventario_item_id: Uuid | null;
  estorna_movimento_id: number | null;
  motivo: string | null;
  registrado_por: string | null;
}

export type EtapaCompra = 'recebida' | 'processando' | 'itens_extraidos' | 'associacoes_sugeridas' | 'aguardando_conferencia' | 'confirmada' | 'cancelada' | 'falhou';
export type FonteLeitura = 'xml' | 'sefaz_qr' | 'pdf_texto' | 'foto_ia' | 'manual' | 'comprovante';

export interface CompraLista {
  id: Uuid;
  etapa: EtapaCompra;
  etapa_painel: EtapaCompra | 'pronta';
  fornecedor: string | null;
  numero: string | null;
  emitida_em: Instante | null;
  valor_total: Dec | null;
  itens: number;
  pendentes: number;
  fonte_leitura: FonteLeitura | null;
  origem: 'painel' | 'julia';
  criado_em: Instante;
  /** Veio só do comprovante do pagamento: faltam produtos e quantidades. */
  sem_itens: boolean;
  despesa_origem_id: Uuid | null;
}

export type SituacaoItem = 'pendente' | 'sugerido' | 'confirmado' | 'nao_estoque' | 'ignorado';
export type Confianca = 'alta' | 'media' | 'baixa' | 'nenhuma';

export interface ItemCompra {
  id: Uuid;
  ordem: number;
  versao: number;
  descricao: string;
  codigo_produto: string | null;
  gtin: string | null;
  quantidade: Dec;
  unidade: string;
  valor_unitario: Dec | null;
  valor_bruto: Dec | null;
  desconto: Dec | null;
  encargos: Dec | null;
  valor_liquido: Dec;
  situacao: SituacaoItem;
  categoria_despesa: string | null;
  /** Sempre presente; `insumo_id` null quando não há sugestão. */
  sugestao: {
    insumo_id: Uuid | null;
    insumo: string | null;
    unidade_base: UnidadeBase | null;
    confianca: Confianca | null;
    motivo: string | null;
    fator: Dec | null;
    quantidade_base: Dec | null;
    custo_unitario_base: Dec | null;
  } | null;
  alertas: string[];
}

export interface CandidataDespesa {
  despesa_id: Uuid;
  descricao: string;
  valor: Dec;
  competencia: Data;
  origem: string;
  paga: boolean;
  forca: 'forte' | 'fraca';
}

/** Problema da conferência aritmética da nota (extracao/nota.py: {codigo, texto, ordem?}). */
export interface ProblemaConferencia {
  codigo: string;
  texto?: string;
  ordem?: number;
}

/** GET /admin/estoque/compras/{id} (api_compras.detalhe) — também a resposta de PATCH item, PUT manual, cancelar e POST manual. */
export interface CompraDetalhe {
  id: Uuid;
  etapa: EtapaCompra;
  etapa_painel: EtapaCompra | 'pronta';
  etapa_detalhe: string | null;
  erro_codigo: string | null;
  etapas: { etapa: string; em: Instante; detalhe?: string }[];
  fonte_leitura: FonteLeitura | null;
  origem: 'painel' | 'julia';
  arquivo_id: Uuid | null;
  fornecedor: { id: Uuid; nome: string; documento: string | null } | null;
  fornecedor_lido: { documento: string | null; nome: string | null };
  modelo: string | null;
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  emitida_em: Instante | null;
  totais: { produtos: Dec | null; desconto: Dec | null; frete: Dec | null; outros: Dec | null; total: Dec | null };
  /** `{ok, problemas}` da leitura; compra só do comprovante: `{ok: false, motivo: "sem_itens"}`. */
  conferencia: { ok: boolean; problemas?: ProblemaConferencia[]; motivo?: string } | null;
  duplicatas: { numero: string | null; vencimento: Data; valor: Dec }[] | null;
  observacoes: string[];
  divergencia_aceita: string | null;
  itens: ItemCompra[];
  despesa: { despesa_id: Uuid | null; candidatas: CandidataDespesa[] };
  despesa_origem_id: Uuid | null;
  aviso: string | null;
  pendencias: string[];
  pode_confirmar: boolean;
  versao: number;
  confirmada_em: Instante | null;
  cancelada_em: Instante | null;
  cancelada_motivo: string | null;
  criado_em: Instante;
}

/** POST /admin/estoque/compras/{id}/confirmar. */
export interface ConfirmacaoCompra {
  compra_id: Uuid;
  etapa: EtapaCompra;
  despesa_id: Uuid | null;
  movimentos: number;
  ja_estava_confirmada: boolean;
}

export interface ItemManual {
  descricao: string;
  quantidade: Dec;
  unidade: string;
  valor_total: Dec;
  codigo?: string | null;
}

export interface CompraManualEntrada {
  fornecedor_nome?: string | null;
  fornecedor_documento?: string | null;
  emitida_em: Data;
  valor_total: Dec;
  desconto?: Dec;
  itens: ItemManual[];
}

export interface ResolucaoItem {
  versao: number;
  insumo_id?: Uuid | null;
  novo_insumo?: { nome: string; unidade_base: UnidadeBase; categoria?: string | null } | null;
  fator?: Dec | null;
  quantidade_base?: Dec | null;
  nao_estoque?: string | null;
  ignorar?: boolean;
}

export interface DespesaDaCompra {
  vincular_despesa_id?: Uuid | null;
  paga_em?: Data | null;
  forma?: 'pix' | 'boleto' | 'cartao' | 'dinheiro' | 'transferencia' | 'debito_automatico' | 'outro' | null;
  parcelas?: { vencimento: Data; valor: Dec }[] | null;
  criar_nova?: boolean;
  motivo_nova?: string | null;
}

/** GET /admin/estoque/insumos-sugestoes: UM objeto (o que o sistema sugeriria para a descrição), não uma lista. */
export interface SugestaoInsumo {
  insumo_id: Uuid | null;
  insumo: string | null;
  unidade_base: UnidadeBase | null;
  confianca: Confianca;
  motivo: string | null;
  fator: Dec | null;
  alertas: string[];
}

export interface FichaLista {
  eye_product_id: string;
  produto: string;
  grupo: string | null;
  preco_pdv: Dec | null;
  receita_periodo: Dec;
  quantidade_periodo: Dec;
  ficha: null | { versao: number; custo_porcao_hoje: Dec | null; margem_hoje_pct: Dec | null; custo_incompleto: boolean };
}

export interface ItemFichaDetalhe {
  insumo_id: Uuid;
  insumo: string;
  unidade_base: UnidadeBase;
  quantidade: Dec;
  perda_percentual: Dec;
  opcional: boolean;
  custo_unitario: Dec | null;
  custo: Dec | null;
}

/** PUT /admin/estoque/fichas/{alvo}/{id} (sem `versoes`). */
export interface FichaSalva {
  id: Uuid;
  alvo: 'produto' | 'preparo';
  eye_product_id: string | null;
  preparo_id: Uuid | null;
  versao: number;
  rendimento: Dec;
  vigente_de: Instante;
  vigente_ate: Instante | null;
  origem: string;
  observacao: string | null;
  custo_receita: Dec | null;
  custo_porcao: Dec | null;
  /** IDs dos insumos (não nomes) sem custo conhecido. */
  insumos_sem_custo: Uuid[];
  itens: ItemFichaDetalhe[];
}

/** GET /admin/estoque/fichas/{alvo}/{id}; 404 `sem_ficha` quando ainda não existe. */
export interface FichaDetalhe extends FichaSalva {
  versoes: { versao: number; vigente_de: Instante; vigente_ate: Instante | null; rendimento: Dec; criada_por: string | null }[];
}

export interface ProdutoAnalise {
  eye_product_id: string;
  produto: string;
  grupo: string | null;
  quantidade: Dec;
  receita_liquida: Dec;
  custo_realizado: Dec | null;
  margem_realizada_pct: Dec | null;
  contribuicao: Dec | null;
  tem_ficha: boolean;
  preco_pdv: Dec | null;
  custo_porcao_hoje: Dec | null;
  margem_hoje_pct: Dec | null;
}

export type EstadoRuptura = 'ruptura_prevista' | 'atencao' | 'ok' | 'sem_consumo' | 'indisponivel';
export interface ItemRuptura {
  insumo_id: Uuid;
  insumo: string;
  unidade_base: UnidadeBase;
  saldo: Dec;
  estoque_minimo: Dec | null;
  prazo_reposicao_dias: number | null;
  estado: EstadoRuptura;
  /** Motivo de `indisponivel` (motivo do saldo não confiável ou `cancelamento_pendente`). */
  motivo: string | null;
  consumo_diario_medio?: Dec | null;
  janela_dias?: number;
  cobertura_dias?: Dec | null;
  ruptura_estimada_em?: Data | null;
}

/** GET /admin/estoque/analises/ruptura (inteligencia.previsao). */
export interface Ruptura {
  disponivel: boolean;
  tipo: 'previsao';
  dia: Data;
  base?: string;
  motivos: { codigo: string; texto: string }[];
  itens: ItemRuptura[];
}

export interface ItemReposicao extends ItemRuptura {
  quantidade_sugerida: Dec;
  prazo_conhecido: boolean;
  ultimo_fornecedor: string | null;
  ultimo_preco_base: Dec | null;
  custo_estimado: Dec | null;
}

/** GET /admin/estoque/analises/reposicao: indisponível devolve a previsão (com motivos) + dias_cobertura. */
export interface Reposicao {
  disponivel: boolean;
  dia: Data;
  dias_cobertura: number;
  dias_seguranca?: number;
  motivos?: { codigo: string; texto: string }[];
  itens: ItemReposicao[];
  aviso?: string;
}

export type ClasseCardapio = 'alta_venda_alta_margem' | 'alta_venda_margem_baixa' | 'baixa_venda_margem_alta' | 'baixa_venda_margem_baixa';
export interface ItemCardapio {
  eye_product_id: string;
  produto: string;
  /** "sem grupo" quando o PDV não informa. */
  grupo: string;
  quantidade: Dec;
  receita: Dec;
  preco_medio_efetivo: Dec | null;
  custo_estimado_unitario: Dec | null;
  margem_estimada_unitaria: Dec | null;
  margem_estimada_pct: Dec | null;
  contribuicao_estimada_total: Dec | null;
  custo_completo: boolean;
  dias_com_venda: number;
  tem_ficha: boolean;
  motivo_sem_classificacao: 'sem_ficha' | 'custo_incompleto' | 'poucas_vendas' | 'sem_comparacao_no_grupo' | null;
  evolucao: {
    quantidade_anterior: Dec | null;
    quantidade_variacao_pct: Dec | null;
    custo_unitario_anterior: Dec | null;
    custo_variacao_pct: Dec | null;
    margem_pct_anterior: Dec | null;
    preco_variacao_pct: Dec | null;
  };
  classificacao: ClasseCardapio | null;
  sugestao: string | null;
}

export interface Cardapio {
  periodo: { de: Data; ate: Data };
  periodo_comparado: { de: Data; ate: Data };
  criterio: { popularidade: string; margem: string; minimo_vendas: number; grupos: Record<string, { produtos: number; limiar_quantidade: Dec; limiar_margem_unitaria: Dec }>; aviso: string };
  /** Contagem por classificação (ou `sem_classificacao:<motivo>`). */
  resumo: Record<string, number>;
  itens: ItemCardapio[];
}

export interface FornecedorPreco {
  fornecedor_id: Uuid | null;
  fornecedor: string;
  compras: number;
  quantidade_base: Dec;
  preco_medio: Dec;
  menor_preco: Dec;
  ultimo_preco: Dec;
  ultima_compra: Data;
  embalagens: string[];
  com_desconto: boolean;
  frete_na_nota_sem_rateio: boolean;
}

export interface FornecedoresAnalise {
  periodo: { de: Data; ate: Data };
  itens: {
    insumo_id: Uuid;
    insumo: string;
    unidade_base: UnidadeBase;
    compras: number;
    compras_sem_preco_normalizado: number;
    comparavel: boolean;
    motivo: 'sem_preco_normalizado' | 'um_fornecedor_so' | null;
    // Ausentes quando `motivo` = sem_preco_normalizado.
    ultimo_preco?: Dec | null;
    menor_preco_recente?: Dec | null;
    variacao_ultima_compra_pct?: Dec | null;
    menor_preco_medio?: { fornecedor: string; preco_medio: Dec } | null;
    economia_ilustrativa?: Dec | null;
    evolucao?: { dia: Data; fornecedor: string; preco: Dec }[];
    fornecedores: FornecedorPreco[];
  }[];
  aviso: string;
}

/** GET /admin/estoque/analises/cmv (resultado.cmv_mes + receita, divergência e % — financeiro/resultado.py). */
export interface CmvAnalise {
  fonte: 'por_inventario' | 'teorico' | 'indisponivel';
  valor: Dec | null;
  cmv_pct: Dec | null;
  receita_produtos: Dec | null;
  motivos_indisponivel: { fonte: string; codigo: string; texto: string }[];
  alternativas: { por_inventario: Dec | null; teorico: Dec | null };
  /** Fração 0–1. */
  cobertura_fichas: Dec | null;
  vendas_validas: number;
  vendas_processadas: number;
  teorico_incompleto: boolean;
  divergencia_inventario_teorico: { valor: Dec; pct: Dec | null } | null;
  indicadores: { compras_estoque_mes: Dec; compras_estoque_sobre_receita_pct: Dec | null; aviso: string };
}

/** GET /admin/estoque/inventarios/sugestao (lista de 10 a 15 itens). */
export interface SugestaoInventario {
  insumo_id: Uuid;
  insumo: string;
  unidade_base: UnidadeBase;
  motivo: 'negativo' | 'nunca_contado' | 'curva_a';
  ultima_contagem_em: Instante | null;
  saldo_sistema: Dec | null;
}

export type EscopoInventario = 'sugerido' | 'lista' | 'total';
export type StatusInventario = 'aberto' | 'fechado' | 'cancelado';

/** Linha de GET /admin/estoque/inventarios (sem os itens: `itens` é a quantidade). */
export interface InventarioResumo {
  id: Uuid;
  escopo: EscopoInventario;
  status: StatusInventario;
  aberto_por: string | null;
  aberto_em: Instante;
  fechado_em: Instante | null;
  itens: number;
}

/** GET/POST /admin/estoque/inventarios[/{id}]. `quantidade_sistema`, `diferenca` e `valor_diferenca` só depois de fechar. */
export interface Inventario {
  id: Uuid;
  escopo: EscopoInventario;
  status: StatusInventario;
  aberto_em: Instante;
  fechado_em: Instante | null;
  versao: number;
  itens: { insumo_id: Uuid; insumo: string; unidade_base: UnidadeBase; quantidade_contada: Dec | null; quantidade_sistema: Dec | null; diferenca: Dec | null; valor_diferenca: Dec | null; contado_em: Instante | null }[];
}

/** PUT /admin/estoque/inventarios/{id}/itens/{insumo}. */
export interface ContagemItem {
  insumo_id: Uuid;
  quantidade_contada: Dec;
  contado_em: Instante;
}

/** POST /admin/estoque/inventarios/{id}/fechar (operacoes.fechar_inventario). */
export interface FechamentoInventario {
  inventario_id: Uuid;
  ajustes: { insumo_id: Uuid; insumo: string; unidade_base: UnidadeBase; sistema: Dec; contado: Dec; diferenca: Dec; valor: Dec | null }[];
  valor_total: Dec;
  nao_contados: number;
}

export type SituacaoCancelamento = 'pendente' | 'nao_produzido' | 'produzido_descartado' | 'produzido_aproveitado' | 'nao_apurado' | 'sem_efeito';
export type DecisaoCancelamento = 'nao_produzido' | 'produzido_descartado' | 'produzido_aproveitado' | 'nao_apurado';

/** Venda cancelada (ou corrigida para menos) depois da baixa (consumo.saida_cancelamento). Os itens vêm sem nome do insumo. */
export interface CancelamentoEstoque {
  id: Uuid;
  venda_id: Uuid;
  dia: Data;
  motivo: 'venda_cancelada' | 'venda_corrigida';
  baixa_lancada: boolean;
  itens: { insumo_id: Uuid; quantidade: Dec; custo_unitario: Dec | null }[];
  situacao: SituacaoCancelamento;
  observacao: string | null;
  resolvido_por: string | null;
  resolvido_em: Instante | null;
  versao: number;
  criado_em: Instante;
}
