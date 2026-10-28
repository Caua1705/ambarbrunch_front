// Financeiro — rotas reais /admin/financeiro* e /admin/arquivos (código do backend; ainda não publicadas em produção).
import { pedir, novaChave } from './cliente';
import type { Pagina } from '../tipos/comum';
import type {
  Categoria, ContaBancaria, ConciliacaoMes, DespesaEntrada, DespesaSaida, DespesasPorCategoria, Fechamento, FilaRevisao,
  Importacao, ListaContas, ListaLancamentos, MapeamentoCsv, MesEvolucao, MovimentoBancario, PagamentoEntrada, ParcelaSaida,
  Recorrencia, ResultadoMes, ResumoFinanceiro, NivelConciliacao,
} from '../tipos/financeiro';

export const financeiro = {
  resumo: () => pedir<ResumoFinanceiro>('financeiro/resumo'),
  revisao: () => pedir<FilaRevisao>('financeiro/revisao', { query: { limite: 100 } }),
  lancamentos: (q: { de: string; ate: string; tipo?: string; categoria?: string; origem?: string; status?: string; busca?: string; limite?: number; deslocamento?: number }) =>
    pedir<ListaLancamentos>('financeiro/lancamentos', { query: { limite: 100, ...q } }),
  categorias: () => pedir<Categoria[]>('financeiro/categorias'),
  fornecedores: (busca?: string) => pedir<{ id: string; nome: string; documento: string | null }[]>('financeiro/fornecedores', { query: { busca, limite: 20 } }),
  despesa: (id: string) => pedir<DespesaSaida>(`financeiro/despesas/${id}`),
  criarDespesa: (d: DespesaEntrada, chave = novaChave()) => pedir<DespesaSaida>('financeiro/despesas', { metodo: 'POST', corpo: d, idempotencia: chave }),
  corrigirDespesa: (id: string, c: { versao: number; motivo: string; descricao?: string; valor?: string; competencia?: string; categoria?: string }) =>
    pedir<DespesaSaida>(`financeiro/despesas/${id}`, { metodo: 'PATCH', corpo: c }),
  confirmarDespesa: (id: string, categoria?: string) => pedir<DespesaSaida>(`financeiro/despesas/${id}/confirmar`, { metodo: 'POST', corpo: categoria ? { categoria } : null }),
  cancelarDespesa: (id: string, motivo: string) => pedir<DespesaSaida>(`financeiro/despesas/${id}/cancelar`, { metodo: 'POST', corpo: { motivo } }),
  resolverDocumento: (id: string, r: { acao: 'pagar_parcela' | 'registrar_despesa' | 'descartar'; categoria?: string; parcela_id?: string; motivo?: string }) =>
    pedir<unknown>(`financeiro/revisao/documentos/${id}/resolver`, { metodo: 'POST', corpo: r }),
  enviarParaCompras: (id: string) => pedir<{ compra_id: string; compra_nova: boolean }>(`financeiro/comprovantes/${id}/enviar-para-compras`, { metodo: 'POST' }),
  contas: (q: { situacao?: string; de?: string; ate?: string; limite?: number }) => pedir<ListaContas>('financeiro/contas-a-pagar', { query: { limite: 200, ...q } }),
  pagar: (parcelaId: string, p: PagamentoEntrada) => pedir<ParcelaSaida>(`financeiro/parcelas/${parcelaId}/pagamentos`, { metodo: 'POST', corpo: p }),
  estornarPagamento: (id: string, motivo: string) => pedir<ParcelaSaida>(`financeiro/pagamentos/${id}/estornar`, { metodo: 'POST', corpo: { motivo } }),
  recorrencias: () => pedir<Recorrencia[]>('financeiro/recorrencias', { query: { ativas: true } }),
  criarRecorrencia: (r: { descricao: string; categoria: string; valor_previsto: string; valor_variavel: boolean; dia_vencimento: number; inicio: string; fim?: string | null }) =>
    pedir<Recorrencia>('financeiro/recorrencias', { metodo: 'POST', corpo: r }),
  alterarRecorrencia: (id: string, r: { versao: number; aplicar_a_partir_de?: string; encerrar_em?: string; valor_previsto?: string; descricao?: string; dia_vencimento?: number; valor_variavel?: boolean }) =>
    pedir<Recorrencia>(`financeiro/recorrencias/${id}`, { metodo: 'PATCH', corpo: r }),
  // Relatórios
  evolucao: (meses = 12) => pedir<MesEvolucao[]>('financeiro/relatorios/evolucao', { query: { meses } }),
  resultado: (mes: string) => pedir<ResultadoMes>('financeiro/relatorios/resultado', { query: { mes } }),
  porCategoria: (de: string, ate: string) => pedir<DespesasPorCategoria>('financeiro/relatorios/despesas-por-categoria', { query: { de, ate } }),
  fechamento: (mes: string) => pedir<Fechamento>(`financeiro/fechamento/${mes}`),
  // Banco e conciliação
  contasBancarias: () => pedir<ContaBancaria[]>('financeiro/contas-bancarias'),
  criarContaBancaria: (c: { instituicao: string; apelido: string; codigo_banco?: string; agencia?: string; conta?: string; escopo?: ContaBancaria['escopo'] }) =>
    pedir<ContaBancaria>('financeiro/contas-bancarias', { metodo: 'POST', corpo: c }),
  importarExtrato: (arquivo: File, conta_id: string) => {
    const f = new FormData();
    f.set('arquivo', arquivo);
    f.set('conta_id', conta_id);
    return pedir<Importacao>('financeiro/extratos', { metodo: 'POST', formulario: f });
  },
  extratos: () => pedir<Pagina<Importacao>>('financeiro/extratos', { query: { limite: 20 } }),
  extrato: (id: string) => pedir<Importacao>(`financeiro/extratos/${id}`),
  mapear: (id: string, mapeamento: MapeamentoCsv, salvar_como?: string) => pedir<Importacao>(`financeiro/extratos/${id}/mapeamento`, { metodo: 'POST', corpo: { mapeamento, salvar_como: salvar_como || null } }),
  cobertura: (id: string, de: string, ate: string) => pedir<Importacao>(`financeiro/extratos/${id}/cobertura`, { metodo: 'POST', corpo: { de, ate } }),
  movimentos: (q: { de: string; ate: string; conta_id?: string; nivel?: NivelConciliacao; situacao?: string; importacao_id?: string; direcao?: string; limite?: number }) =>
    pedir<Pagina<MovimentoBancario>>('financeiro/conciliacao/movimentos', { query: { limite: 100, ...q } }),
  movimento: (id: string) => pedir<MovimentoBancario & { vinculos?: unknown[]; historico?: unknown[] }>(`financeiro/conciliacao/movimentos/${id}`),
  acaoMovimento: (id: string, a: Record<string, unknown> & { versao: number; acao: string }) =>
    pedir<MovimentoBancario & { conciliacao_id: string }>(`financeiro/conciliacao/movimentos/${id}/acoes`, { metodo: 'POST', corpo: a }),
  identidade: (id: string, versao: number, decisao: 'distinto' | 'duplicado') => pedir<MovimentoBancario>(`financeiro/conciliacao/movimentos/${id}/identidade`, { metodo: 'POST', corpo: { versao, decisao } }),
  conciliacaoMes: (mes: string) => pedir<ConciliacaoMes>(`financeiro/conciliacao/meses/${mes}`),
  conciliarMes: (mes: string, contaId: string) => pedir<unknown>(`financeiro/conciliacao/meses/${mes}/contas/${contaId}/conciliar`, { metodo: 'POST' }),
  // Documentos (URL assinada de 5 min)
  enviarArquivo: (arquivo: File, tipo: 'comprovante' | 'nota' | 'documento') => {
    const f = new FormData();
    f.set('arquivo', arquivo);
    f.set('tipo', tipo);
    return pedir<{ id: string; mime: string; ja_existia: boolean }>('arquivos', { metodo: 'POST', formulario: f });
  },
  urlArquivo: (id: string) => pedir<{ url: string; expira_em: string; mime: string }>(`arquivos/${id}/url`),
};
