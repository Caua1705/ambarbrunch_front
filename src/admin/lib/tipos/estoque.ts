// Estoque — CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md (§3, §4, §10, §11), formatos conferidos no código do backend.
// Ainda NÃO publicado em produção (chega com as migrações 0011–0012+).
import type { Data, Dec, Instante, Uuid } from './comum';

export type UnidadeBase = 'g' | 'ml' | 'un';
export type MotivoNaoConfiavel = 'sem_movimento' | 'baixa_desligada' | 'nunca_contado' | 'ficou_negativo';

export interface ResumoEstoque {
  abaixo_minimo: { insumo_id: Uuid; insumo: string; unidade_base: UnidadeBase; saldo: Dec; estoque_minimo: Dec; saldo_confiavel: boolean }[];
  compras_em_conferencia: { qtd: number; mais_antiga_em: Instante | null };
  cancelamentos_pendentes: number;
  sem_ficha_mais_vendidos: { eye_product_id: string; produto: string; receita: Dec }[];
  cobertura_fichas_30d: Dec | null;
  altas_de_custo_90d: { insumo_id: Uuid; insumo: string; unidade_base: UnidadeBase; custo_inicio: Dec; custo_fim: Dec; compras: number; menor: Dec; maior: Dec; variacao_pct: Dec | null }[];
  saldo_confiavel: { insumos: number; total: number };
  baixa_automatica: boolean;
  inicio_controle: Data | null;
}

export interface Insumo {
  id: Uuid;
  codigo: string;
  nome: string;
  categoria: string | null;
  unidade_base: UnidadeBase;
  tipo: 'comprado' | 'preparo';
  controle_preparo: 'explodir' | 'lote' | null;
  estoque_minimo: Dec | null;
  ativo: boolean;
  versao: number;
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

export interface InsumoDetalhe extends Omit<Insumo, 'ultimo_custo_compra' | 'ultima_compra_em' | 'ultima_contagem_em' | 'cobertura_dias' | 'abaixo_minimo'> {
  prazo_reposicao_dias: number | null;
  precos: { ocorreu_em: Instante; custo_unitario: Dec | null; quantidade: Dec; compra_item_id: Uuid | null }[];
  usado_em: { alvo: 'produto' | 'preparo'; eye_product_id: string | null; preparo_id: Uuid | null; nome: string; quantidade: Dec }[];
}

export type TipoMovimento = 'saldo_inicial' | 'entrada_compra' | 'consumo_venda' | 'estorno_consumo' | 'producao_saida' | 'producao_entrada' | 'perda' | 'ajuste_inventario' | 'estorno';
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
  sugestao: null | {
    insumo_id: Uuid | null;
    insumo: string | null;
    unidade_base: UnidadeBase | null;
    confianca: Confianca;
    motivo: string | null;
    fator: Dec | null;
    quantidade_base: Dec | null;
    custo_unitario_base: Dec | null;
  };
  alertas: string[];
}

export interface CandidataDespesa {
  despesa_id: Uuid;
  descricao: string;
  valor: Dec;
  origem: string;
  paga: boolean;
  forca: 'forte' | 'fraca' | string;
}

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
  fornecedor_lido: { documento: string | null; nome: string | null } | null;
  numero: string | null;
  serie: string | null;
  emitida_em: Instante | null;
  totais: { produtos: Dec | null; desconto: Dec | null; frete: Dec | null; outros: Dec | null; total: Dec | null };
  conferencia: { ok: boolean; problemas: string[] } | null;
  duplicatas: { numero: string; vencimento: Data; valor: Dec }[];
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

export interface ItemManual {
  descricao: string;
  quantidade: Dec;
  unidade: string;
  valor_total: Dec;
  codigo?: string | null;
}

export interface ResolucaoItem {
  versao: number;
  insumo_id?: Uuid | null;
  novo_insumo?: { nome: string; unidade_base: UnidadeBase } | null;
  fator?: Dec | null;
  quantidade_base?: Dec | null;
  nao_estoque?: string | null;
  ignorar?: boolean;
}

export interface DespesaDaCompra {
  vincular_despesa_id?: Uuid | null;
  paga_em?: Data | null;
  forma?: string | null;
  parcelas?: { vencimento: Data; valor: Dec }[] | null;
  criar_nova?: boolean;
  motivo_nova?: string | null;
}

export interface SugestaoInsumo {
  insumo_id: Uuid;
  insumo: string;
  unidade_base: UnidadeBase;
  confianca?: Confianca;
  motivo?: string | null;
  fator?: Dec | null;
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

export interface FichaDetalhe {
  id: Uuid;
  alvo: 'produto' | 'preparo';
  eye_product_id: string | null;
  preparo_id: Uuid | null;
  versao: number;
  rendimento: Dec;
  vigente_de: Instante;
  vigente_ate: Instante | null;
  origem: 'painel' | 'importacao';
  observacao: string | null;
  custo_receita: Dec | null;
  custo_porcao: Dec | null;
  insumos_sem_custo: string[];
  itens: { insumo_id: Uuid; insumo: string; unidade_base: UnidadeBase; quantidade: Dec; perda_percentual: Dec; opcional: boolean; custo_unitario: Dec | null; custo: Dec | null }[];
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

export interface Ruptura {
  disponivel: boolean;
  tipo: 'previsao';
  base?: string;
  motivos?: { codigo: string; texto: string }[];
  itens: {
    insumo: string;
    unidade_base: UnidadeBase;
    saldo: Dec;
    estoque_minimo: Dec | null;
    prazo_reposicao_dias: number | null;
    estado: 'ruptura_prevista' | 'atencao' | 'ok' | 'sem_consumo' | 'indisponivel';
    consumo_diario_medio: Dec | null;
    janela_dias: number;
    cobertura_dias: Dec | null;
    ruptura_estimada_em: Data | null;
    motivo?: string;
  }[];
}

export interface ItemCardapio {
  eye_product_id: string;
  produto: string;
  grupo: string | null;
  quantidade: Dec;
  receita: Dec;
  preco_medio_efetivo: Dec | null;
  custo_estimado_unitario: Dec | null;
  margem_estimada_unitaria: Dec | null;
  margem_estimada_pct: Dec | null;
  contribuicao_estimada_total: Dec | null;
  custo_completo: boolean;
  tem_ficha: boolean;
  motivo_sem_classificacao: string | null;
  classificacao: 'alta_venda_alta_margem' | 'alta_venda_margem_baixa' | 'baixa_venda_margem_alta' | 'baixa_venda_margem_baixa' | null;
  sugestao: string | null;
}

export interface Cardapio {
  periodo: { de: Data; ate: Data };
  criterio: { aviso: string; minimo_vendas: number };
  resumo: Record<string, number>;
  itens: ItemCardapio[];
}

export interface FornecedoresAnalise {
  itens: {
    insumo_id: Uuid;
    insumo: string;
    unidade_base: UnidadeBase;
    compras: number;
    comparavel: boolean;
    motivo: string | null;
    ultimo_preco: Dec | null;
    menor_preco_recente: Dec | null;
    variacao_ultima_compra_pct: Dec | null;
    menor_preco_medio: { fornecedor: string; preco_medio: Dec } | null;
    evolucao: { dia: Data; fornecedor: string; preco: Dec }[];
    fornecedores: { fornecedor: string; compras: number; preco_medio: Dec; menor_preco: Dec; ultimo_preco: Dec; ultima_compra: Data }[];
  }[];
  aviso: string;
}

export interface CmvAnalise extends Record<string, unknown> {
  fonte: 'por_inventario' | 'teorico' | 'indisponivel';
  valor: Dec | null;
  cmv_pct: Dec | null;
  receita_produtos: Dec | null;
  motivos_indisponivel: { fonte: string; codigo: string; texto: string }[];
  alternativas: { por_inventario: Dec | null; teorico: Dec | null };
  indicadores: { compras_estoque_mes: Dec; compras_estoque_sobre_receita_pct: Dec | null; aviso: string };
}

export interface SugestaoInventario {
  insumo_id: Uuid;
  insumo: string;
  unidade_base: UnidadeBase;
  motivo: 'negativo' | 'nunca_contado' | 'curva_a';
  ultima_contagem_em: Instante | null;
  saldo_sistema: Dec | null;
}

export interface Inventario {
  id: Uuid;
  escopo: 'sugerido' | 'lista' | 'total';
  status: 'aberto' | 'fechado' | 'cancelado';
  aberto_em: Instante;
  fechado_em: Instante | null;
  versao: number;
  itens: { insumo_id: Uuid; insumo: string; unidade_base: UnidadeBase; quantidade_contada: Dec | null; quantidade_sistema: Dec | null; diferenca: Dec | null; valor_diferenca: Dec | null; contado_em: Instante | null }[];
}
