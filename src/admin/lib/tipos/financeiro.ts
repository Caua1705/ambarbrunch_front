// Financeiro — CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md (§2, §5, §8, §9, §11), formatos conferidos no código do backend.
// Ainda NÃO publicado em produção (banco na 0004; o Financeiro chega com a 0010+).
import type { Data, Dec, Instante, Uuid } from './comum';

export type NivelQualidade = 'completo' | 'parcial' | 'estimado' | 'indisponivel';
export interface Qualidade {
  nivel: NivelQualidade;
  motivos: { nivel: string; codigo: string; texto: string }[];
}

export type ContasResumo = Record<'vencidas' | 'hoje' | 'proximas', { qtd: number; valor: Dec }>;

export type EstadoConciliacao = 'sem_contas' | 'nao_conferido' | 'parcial' | 'aguardando_revisao' | 'integral_informado' | 'conciliado' | 'reaberto';

export interface AvisoConciliacao {
  mes: Data;
  estado: EstadoConciliacao;
  contas_pendentes: string[];
  texto: string;
  rota: string;
}

export interface Sincronizacao {
  ultimo_sucesso_em: Instante | null;
  falhas_seguidas: number;
  atrasada: boolean;
}

export interface ResumoFinanceiro {
  hoje: { dia: Data; receita: Dec | null; vendas: number; ticket_medio: Dec | null };
  mes: {
    inicio: Data;
    receita: Dec | null;
    receita_mes_anterior_ate_o_mesmo_dia: Dec | null;
    despesas_confirmadas: Dec;
    pago: Dec;
    a_pagar: Dec;
    resultado_parcial: Dec | null;
    cmv_fonte?: 'por_inventario' | 'teorico' | 'indisponivel';
    qualidade: Qualidade;
  };
  contas: ContasResumo;
  revisao: { despesas: number; documentos: number };
  sincronizacao: Sincronizacao | { configurada: false };
  conciliacao_mes_anterior: AvisoConciliacao | null;
  /** Unidade em uso (`identificacao` do backend). `teste`: unidade de ensaio. */
  unidade?: { codigo: string; nome: string; teste: boolean };
}

export type TipoLancamento = 'venda_dia' | 'despesa' | 'pagamento' | 'outra_receita';
export interface Lancamento {
  tipo: TipoLancamento;
  id: string;
  data: Data;
  descricao: string;
  /** Sempre positivo; o sentido está em `sinal`. */
  valor: Dec;
  sinal: 1 | -1;
  categoria: string | null;
  /** painel · julia · compra · recorrencia · extrato · eyemobile */
  origem: string;
  fornecedor_id: Uuid | null;
  fornecedor: string | null;
  /** em_revisao · confirmada · cancelada · confirmado · estornado */
  status: string;
  tem_comprovante: boolean;
  compra_id: Uuid | null;
  despesa_id: Uuid | null;
  /**
   * Varia com o tipo (consultas.py): venda_dia {vendas, taxa_servico, total_vendido, descontos, recebido_pdv};
   * despesa {motivos_revisao, valor_a_confirmar, versao}; pagamento {forma, parcela_id, parcela, conciliacao};
   * outra_receita {recebido_em}.
   */
  detalhes: Record<string, unknown> & {
    vendas?: number;
    taxa_servico?: Dec | null;
    forma?: string;
    parcela_id?: Uuid;
    parcela?: number;
    conciliacao?: string;
    recebido_em?: Data | null;
  };
}

export interface ListaLancamentos {
  total: number;
  itens: Lancamento[];
  totais: { receita_pdv: Dec; outras_receitas: Dec; despesas_confirmadas: Dec; despesas_em_revisao: Dec; pagamentos: Dec };
}

export type SituacaoConta = 'paga' | 'vencida' | 'vence_hoje' | 'parcial' | 'a_vencer';
export interface ContaPagar {
  parcela_id: Uuid;
  despesa_id: Uuid;
  unidade_negocio_id: number;
  descricao: string;
  categoria: string;
  grupo: string;
  fornecedor_id: Uuid | null;
  fornecedor: string | null;
  numero: number;
  vencimento: Data;
  valor: Dec;
  valor_pago: Dec;
  saldo: Dec;
  situacao: 'aberta' | 'paga';
  status_despesa: 'em_revisao' | 'confirmada';
  /** Conta fixa de valor variável (energia, vale-transporte): o valor do mês ainda não foi confirmado. */
  valor_a_confirmar: boolean;
  recorrencia_id: Uuid | null;
  compra_id: Uuid | null;
  situacao_painel: SituacaoConta;
}
export interface ListaContas {
  total: number;
  itens: ContaPagar[];
  totais: { saldo: Dec; valor: Dec };
}

export type FormaPagamento = 'pix' | 'boleto' | 'cartao' | 'dinheiro' | 'transferencia' | 'debito_automatico' | 'outro';

export interface PagamentoSaida {
  id: Uuid;
  valor: Dec;
  pago_em: Data;
  forma: FormaPagamento;
  identificador_transacao: string | null;
  arquivo_id: Uuid | null;
  origem: string;
  conciliacao: 'manual' | 'automatica';
  registrado_por: string | null;
  criado_em: Instante;
  estornado_em: Instante | null;
  estorno_motivo: string | null;
}

export interface ParcelaSaida {
  id: Uuid;
  numero: number;
  vencimento: Data;
  valor: Dec;
  valor_pago: Dec;
  saldo: Dec;
  situacao: 'aberta' | 'paga' | 'cancelada';
  pagamentos: PagamentoSaida[];
}

export interface DespesaSaida {
  id: Uuid;
  unidade_negocio_id: number;
  descricao: string;
  valor: Dec;
  competencia: Data;
  categoria_codigo: string;
  grupo: string;
  fornecedor: { id: Uuid; nome: string; documento: string | null } | null;
  origem: string;
  status: 'em_revisao' | 'confirmada' | 'cancelada';
  motivos_revisao: string[];
  valor_a_confirmar: boolean;
  compra_id: Uuid | null;
  recorrencia_id: Uuid | null;
  arquivo_id: Uuid | null;
  versao: number;
  criado_por: string | null;
  criado_em: Instante;
  confirmado_em: Instante | null;
  cancelado_em: Instante | null;
  cancelado_motivo: string | null;
  parcelas: ParcelaSaida[];
  rateio: { categoria: string; valor: Dec }[];
  historico?: { em: Instante; acao: string; ator: string | null; ator_tipo: string; dados: unknown }[];
}

export interface DespesaEntrada {
  descricao: string;
  valor: Dec;
  competencia: Data;
  categoria: string;
  fornecedor?: { documento?: string | null; nome?: string | null } | null;
  arquivo_id?: Uuid | null;
  parcelas?: { vencimento: Data; valor: Dec }[] | null;
  pagamento?: { pago_em: Data; forma: FormaPagamento; identificador_transacao?: string | null; arquivo_id?: Uuid | null } | null;
}

export interface PagamentoEntrada {
  pago_em: Data;
  forma: FormaPagamento;
  valor: Dec;
  identificador_transacao?: string | null;
  arquivo_id?: Uuid | null;
}

export type GrupoCategoria = 'compras_estoque' | 'pessoal' | 'ocupacao' | 'operacional' | 'marketing' | 'impostos' | 'financeiro' | 'investimento' | 'retirada' | 'repasse' | 'pendente';
export interface Categoria {
  codigo: string;
  nome: string;
  grupo: GrupoCategoria;
  aliases: string[];
  ativo: boolean;
}

export interface Recorrencia {
  id: Uuid;
  descricao: string;
  categoria_codigo: string;
  fornecedor: { id: Uuid; nome: string; documento?: string | null } | null;
  valor_previsto: Dec;
  valor_variavel: boolean;
  dia_vencimento: number;
  intervalo_meses: number;
  inicio: Data;
  fim: Data | null;
  antecedencia_dias: number;
  ativo: boolean;
  versao: number;
  proximas: { competencia: Data; vencimento: Data }[];
}

export type Evidencia = 'mesmo_beneficiario' | 'valor_exato' | 'identificador_da_transacao' | 'mesma_linha_digitavel' | 'sem_boleto_a_conferir' | 'obrigacao_definida';

export interface CandidataRevisao {
  parcela_id: string;
  despesa_id: string;
  vencimento: string;
  saldo: string;
  descricao: string;
  fornecedor: string | null;
  forca: 'forte' | 'fraca';
  evidencias: string[];
  faltando: string[];
}

export interface DespesaRevisao {
  id: Uuid;
  descricao: string;
  valor: Dec;
  competencia: Data;
  categoria: string;
  motivos_revisao: string[];
  origem: string;
  arquivo_id: Uuid | null;
  criado_em: Instante;
  versao: number;
  fornecedor: string | null;
}

export interface DocumentoRevisao {
  id: Uuid;
  tipo_documento: 'comprovante_pagamento' | 'boleto' | 'recibo' | 'nota_compra' | 'ambiguo';
  legenda: string | null;
  autor_nome: string | null;
  extraido: Partial<{
    tipo_documento: string;
    valor: string;
    data: string;
    vencimento: string;
    recebedor_nome: string;
    recebedor_documento: string;
    identificador_transacao: string;
    linha_digitavel: string;
    descricao: string;
    categoria_sugerida: string;
    forma: string;
  }>;
  motivos: string[];
  candidatas: CandidataRevisao[];
  arquivo_id: Uuid | null;
  criado_em: Instante;
}

export interface FilaRevisao {
  despesas: { total: number; itens: DespesaRevisao[] };
  documentos: { total: number; itens: DocumentoRevisao[] };
}

// Relatórios -------------------------------------------------------------------------------------------------------------

export interface MesEvolucao {
  mes: Data;
  receita_liquida: Dec | null;
  cmv: Dec | null;
  cmv_fonte?: string | null;
  despesas_operacionais?: Dec | null;
  resultado_gerencial?: Dec | null;
  qualidade: NivelQualidade;
}

export interface MesAnterior {
  mes: Data;
  receita_liquida: Dec | null;
  resultado_gerencial: Dec | null;
  qualidade: NivelQualidade;
}

export interface CmvBloco {
  fonte: 'por_inventario' | 'teorico' | 'indisponivel';
  valor: Dec | null;
  motivos_indisponivel: { fonte: string; codigo: string; texto: string }[];
  alternativas: { por_inventario: Dec | null; teorico: Dec | null };
  cobertura_fichas: Dec | null;
  vendas_validas: number;
  vendas_processadas: number;
  teorico_incompleto: boolean;
  indicadores: { compras_estoque_mes: Dec; compras_estoque_sobre_receita_pct: Dec | null; aviso: string };
}

export type ResultadoMes =
  | { mes: Data; unidade_negocio_id: number; disponivel: false; qualidade: Qualidade; mes_anterior: MesAnterior }
  | {
      mes: Data;
      unidade_negocio_id: number;
      disponivel: true;
      receita: {
        vendas: number;
        faturamento_bruto: Dec | null;
        descontos: Dec | null;
        devolucoes: Dec | null;
        receita_liquida_vendas: Dec | null;
        outras_receitas: Dec;
        receita_liquida: Dec | null;
        taxa_servico_fora_da_receita: Dec | null;
      };
      cmv: CmvBloco;
      margem_bruta: Dec | null;
      margem_bruta_pct: Dec | null;
      despesas_operacionais: { pessoal: Dec; ocupacao: Dec; operacional: Dec; marketing: Dec; total: Dec };
      taxas_cartao_estimadas: { valor: Dec | null; por_meio: Record<string, { recebido: Dec; taxa_percentual: Dec | null; taxa_estimada: Dec }>; meios_sem_taxa: string[] };
      resultado_operacional: Dec | null;
      resultado_operacional_pct: Dec | null;
      impostos: Dec;
      financeiro: Dec;
      resultado_gerencial: Dec | null;
      resultado_gerencial_pct: Dec | null;
      /** `retirada` só vem para quem tem financeiro.ver_societario (sigilo.py): sem ela, a chave não existe. */
      fora_do_resultado: { investimento: Dec; retirada?: Dec; repasse: Dec };
      compras_estoque_no_mes: Dec;
      qualidade: Qualidade;
      observacao: string;
      mes_anterior: MesAnterior;
    };

export interface DespesasPorCategoria {
  total: Dec;
  itens: { grupo: string; categoria: string; nome: string; valor: Dec; despesas: number; pct: Dec | null }[];
}

// Vendas (GET /relatorios/vendas) ---------------------------------------------------------------------------------------

export type AgrupamentoVendas = 'dia' | 'semana' | 'mes';

export interface SomaVendas {
  vendas: number;
  faturamento_bruto: Dec;
  descontos: Dec;
  receita_liquida_produtos: Dec;
  devolucoes: Dec;
  receita_liquida: Dec;
  /** Fora da receita (H2). */
  taxa_servico: Dec;
  recebido_pdv: Dec;
  vendas_canceladas: number;
  ticket_medio: Dec | null;
}

export interface PeriodoVendas extends SomaVendas {
  /** Início do dia, da semana (segunda) ou do mês (date_trunc): pode ser antes de `de`. */
  inicio: Data;
  primeiro_dia: Data;
  ultimo_dia: Data;
}

export type MeioPdv = 'credito' | 'debito' | 'pix' | 'outro';

export type RelatorioVendas =
  | { disponivel: false; de: Data; ate: Data; agrupar: AgrupamentoVendas; motivo: string }
  | {
      disponivel: true;
      de: Data;
      ate: Data;
      agrupar: AgrupamentoVendas;
      periodos: PeriodoVendas[];
      totais: SomaVendas;
      por_meio: { meio: string; pagamentos: number; valor: Dec }[];
      sincronizacao: Sincronizacao;
      observacao: string;
    };

// Outras receitas, taxas e contas fixas (entradas) ----------------------------------------------------------------------

export interface OutraReceitaEntrada {
  descricao: string;
  valor: Dec;
  competencia: Data;
  recebido_em?: Data | null;
  arquivo_id?: Uuid | null;
}

export interface OutraReceitaSaida {
  id: Uuid;
  descricao: string;
  valor: Dec;
  competencia: Data;
  recebido_em: Data | null;
  status: 'confirmada' | 'cancelada';
}

export interface TaxaPagamento {
  /** BIGINT no banco (não é UUID). */
  id: number;
  meio: MeioPdv;
  /** Percentual ESTIMADO do contrato da adquirente (a Eyemobile não informa a taxa cobrada). */
  taxa_percentual: Dec;
  prazo_dias: number;
  vigente_de: Data;
}

export type TaxaEntrada = Omit<TaxaPagamento, 'id'>;

export interface RecorrenciaEntrada {
  descricao: string;
  categoria: string;
  fornecedor?: { documento?: string | null; nome?: string | null } | null;
  valor_previsto: Dec;
  valor_variavel: boolean;
  dia_vencimento: number;
  intervalo_meses?: number;
  inicio: Data;
  fim?: Data | null;
  antecedencia_dias?: number;
}

// Participação (GET /apuracoes/{mes}/participacao — só com financeiro.ver_societario) ------------------------------------

export type BaseParticipacao = 'receita_liquida' | 'margem_bruta' | 'resultado_operacional' | 'resultado_gerencial';

export interface ParticipacaoOficial {
  regra_id: string;
  beneficiario: string;
  base: BaseParticipacao;
  percentual: Dec;
  valor_base: Dec | null;
  valor: Dec | null;
  documento_referencia: string | null;
}

/** Beneficiário (ou `sem_regra_registrada`) → percentual ainda não aprovado e o valor em cada base possível. */
export type SimulacaoParticipacao = Record<string, { percentual: Dec | null; bases: Partial<Record<BaseParticipacao, { valor_base: Dec | null; valor: Dec | null }>> }>;

/** 200 = regra aprovada (valores oficiais); 409 `regra_nao_aprovada` = só a simulação (`dados.simulacao`). */
export type Participacao =
  | { tipo: 'oficial'; mes: Data; status: string; situacao: 'aprovada'; oficiais: ParticipacaoOficial[]; aviso: string | null }
  | { tipo: 'simulacao'; mes: string; simulacao: SimulacaoParticipacao; aviso: string };

// Banco e conciliação ---------------------------------------------------------------------------------------------------

export interface ContaBancaria {
  id: Uuid;
  unidade_negocio_id: number;
  instituicao: string;
  codigo_banco: string | null;
  apelido: string;
  agencia: string | null;
  conta: string | null;
  reconhece_ofx: boolean;
  escopo: 'operacional' | 'reserva' | 'socio' | 'outra';
  status: 'ativa' | 'inativa';
  versao: number;
  criado_em: Instante;
}

/** Importação sem movimentações: o backend manda só `{analisadas: 0, por_nivel: {}, creditos: {}, debitos: {}}`
 *  (api_conciliacao.py) — por isso tudo além de `analisadas` é opcional. */
export interface ResultadoImportacao {
  analisadas: number;
  ja_conciliadas?: number;
  correspondencias_fortes?: number;
  possiveis?: number;
  sem_registro?: number;
  conflitos?: number;
  duplicadas?: number;
  por_nivel: Partial<Record<NivelConciliacao, number>>;
  creditos: Partial<{ quantidade: number; valor: Dec; conciliado: Dec }>;
  debitos: Partial<{ quantidade: number; valor: Dec; conciliado: Dec }>;
}

/** Valores aceitos pelo backend (api_conciliacao.py); qualquer outro é 422. */
export interface MapeamentoCsv {
  separador: ';' | ',' | '\t' | '|' | string;
  codificacao: 'utf-8-sig' | 'utf-8' | 'cp1252' | 'latin-1' | string;
  linha_cabecalho: number | null;
  colunas: Partial<Record<'data' | 'descricao' | 'valor' | 'entrada' | 'saida' | 'tipo' | 'identificador' | 'saldo', number>>;
  formato_data: 'dd/mm/aaaa' | 'dd/mm/aa' | 'aaaa-mm-dd' | 'dd-mm-aaaa' | 'dd.mm.aaaa' | 'mm/dd/aaaa' | 'aaaammdd' | string;
  decimal: ',' | '.';
  sinal?: 'valor' | 'invertido';
}

export interface Importacao {
  id: Uuid;
  conta: { id: Uuid; apelido: string; instituicao: string };
  formato: 'ofx' | 'csv';
  status: 'aguardando_mapeamento' | 'processada' | 'recusada';
  ja_existia?: boolean;
  periodo: { de: Data | null; ate: Data | null };
  cobertura: { de: Data | null; ate: Data | null; origem: 'arquivo' | 'confirmada' | null; confirmada_por: string | null };
  saldo_final: Dec | null;
  saldo_final_em: Data | null;
  contagem: { linhas: number; movimentos: number; novos: number; ja_existentes: number; conflitos: number; ignoradas: number; erros: number };
  erros: unknown[];
  ignoradas_por_motivo: Record<string, number>;
  resultado?: ResultadoImportacao;
  reconhecimento?: { cabecalho: string[]; colunas: MapeamentoCsv['colunas']; avisos: string[]; assinatura: string; amostra: string[][] } | null;
  mapeamento?: MapeamentoCsv | null;
  modelo_id?: Uuid | null;
  criado_em: Instante;
}

export type NivelConciliacao = 'vinculo_confirmado' | 'forte' | 'possivel' | 'ambigua' | 'sem_correspondencia' | 'classificacao_pendente' | 'conflito' | 'duplicado';

export interface CandidatoConciliacao {
  tipo: 'pagamento' | 'parcela' | 'outra_receita' | 'vendas' | 'par';
  acao: string;
  /** Nulos nos candidatos de vendas (conciliacao.py `Candidato`). */
  referencia: string | null;
  valor: Dec | null;
  data: Data | null;
  descricao: string;
  pontuacao: number;
  valor_exato: boolean;
  evidencias: { codigo: string; texto: string }[];
  alertas: string[];
  parametros: Record<string, string>;
}

export interface MovimentoBancario {
  id: Uuid;
  conta: { id: Uuid; apelido: string };
  data: Data;
  direcao: 'credito' | 'debito';
  valor: Dec;
  descricao: string;
  tipo_banco: string | null;
  fitid: string | null;
  identificador_pix: string | null;
  situacao: 'pendente' | 'parcial' | 'conciliado' | 'duplicado';
  valor_conciliado: Dec;
  saldo_a_conciliar: Dec;
  /** Possível duplicidade: `tipo` (ex.: possivel_duplicidade), com quem e a decisão já tomada. */
  conflito: { tipo: string; com: Uuid | null; decisao: string | null } | null;
  nivel: NivelConciliacao;
  candidatos: CandidatoConciliacao[];
  /** Sugestão pela descrição do banco (Motor.classificacao_sugerida): despesa com categoria ou classificação. */
  classificacao_sugerida: { acao: 'registrar_despesa' | 'classificar' | string; texto: string; categoria?: string; classificacao?: string } | null;
  acoes_possiveis: string[];
  versao: number;
  importacao_id: Uuid;
}

export interface EstadoContaMes {
  conta: { id: Uuid; apelido: string; instituicao: string };
  estado: EstadoConciliacao;
  cobertura_integral: boolean;
  lacunas: { de: Data; ate: Data }[];
  importacoes: number;
  movimentos: number;
  pendentes: number;
  parciais: number;
  conflitos: number;
  duplicados: number;
  creditos: Dec;
  debitos: Dec;
  creditos_a_conciliar: Dec;
  debitos_a_conciliar: Dec;
}

export interface ConciliacaoMes {
  mes: Data;
  estado: EstadoConciliacao;
  conciliado: boolean;
  contas: EstadoContaMes[];
}

export interface ItemFechamento {
  codigo: string;
  titulo: string;
  situacao: 'ok' | 'pendente' | 'atencao' | 'indisponivel';
  quantidade: number | null;
  valor: Dec | null;
  detalhe: string | null;
  rota: string | null;
}

export interface MovimentoDetalhe extends MovimentoBancario {
  /** `saida_vinculo` do backend (conciliacao.py). */
  vinculos?: {
    id: Uuid;
    /** pagamento · outra_receita · vendas · transferencia_propria · aporte_socio · emprestimo · reembolso · estorno · nao_operacional */
    tipo: string;
    valor: Dec;
    pagamento_id: Uuid | null;
    outra_receita_id: Uuid | null;
    movimento_par_id: Uuid | null;
    vendas: { meio: string; de: Data; ate: Data } | null;
    criados: Record<string, unknown>;
    origem: string | null;
    evidencias: unknown;
    observacao: string | null;
    status: 'ativa' | 'desfeita';
    criado_por: string | null;
    criado_em: Instante;
    desfeita_por: string | null;
    desfeita_em: Instante | null;
    desfeita_motivo: string | null;
  }[];
  arquivos?: { importacao_id: Uuid; linha: number | null; novo: boolean }[];
  historico?: { em: Instante; acao: string; ator: string | null; dados?: unknown }[];
}

export interface Repasses {
  periodo: { de: Data; ate: Data };
  meios: { meio: string; vendido: Dec; liquidado_vinculado: Dec; diferenca_a_conferir: Dec; vendido_por_tipo?: Record<string, Dec> }[];
  aviso: string;
}

export interface Apuracao {
  mes: Data;
  status: 'rascunho' | 'conferida' | 'fechada' | string;
  congelada?: boolean;
  /** Sempre o objeto completo (apuracao.py), nunca só o nível. */
  qualidade?: Qualidade;
  excecao_conciliacao?: { motivo: string; por: string } | null;
  [k: string]: unknown;
}

export interface Fechamento {
  mes: Data;
  concluido: boolean;
  pendencias: ItemFechamento[];
  itens: ItemFechamento[];
  conciliacao: ConciliacaoMes;
  apuracao: { status: string; congelada: boolean; qualidade: NivelQualidade | null; excecao_conciliacao: { motivo: string; por: string } | null };
}
