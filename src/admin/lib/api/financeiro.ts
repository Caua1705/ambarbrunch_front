// Financeiro — rotas reais /admin/financeiro* e /admin/arquivos (código do backend; ainda não publicadas em produção).
// Contratos conferidos no backend (app/modulos/financeiro/api_*.py, julia/api.py) e no painel antigo (app/painel, fcdd8a1).
import { pedir, novaChave, ErroApi } from './cliente';
import type { Pagina } from '../tipos/comum';
import type {
  Categoria, ContaBancaria, ConciliacaoMes, DespesaEntrada, DespesaSaida, DespesasPorCategoria, Fechamento, FilaRevisao,
  Importacao, ListaContas, ListaLancamentos, MapeamentoCsv, MesEvolucao, MovimentoBancario, PagamentoEntrada, ParcelaSaida,
  Recorrencia, ResultadoMes, ResumoFinanceiro, NivelConciliacao, Repasses, Apuracao, MovimentoDetalhe, AgrupamentoVendas,
  RelatorioVendas, OutraReceitaEntrada, OutraReceitaSaida, TaxaPagamento, TaxaEntrada, RecorrenciaEntrada, Participacao,
  SimulacaoParticipacao, EstadoContaMes, DocumentoRevisao, CorrecaoDocumento, ResolucaoDocumento, AnexoDespesa,
  CategoriaEntrada, CategoriaAlteracao, CandidataRevisao, DespesaCandidata,
} from '../tipos/financeiro';

const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Documento da revisão sempre com as listas e objetos que a tela percorre. Resposta incompleta (backend antigo, campo
 *  faltando) não pode derrubar a tela: lista ausente vira vazia. Antes da 0018 a despesa que uma nota podia cobrir vinha
 *  misturada em `candidatas` (sem parcela nem evidências) e quebrava a lista: ela vai para `despesas_candidatas`. */
export function normalizarDocumento(d: DocumentoRevisao): DocumentoRevisao {
  const brutas = lista<Partial<CandidataRevisao> & { valor?: string; competencia?: string; tipo?: string }>(d.candidatas);
  const candidatas: CandidataRevisao[] = [];
  const despesasAntigas: DespesaCandidata[] = [];
  for (const c of brutas) {
    if (!c || typeof c !== 'object') continue;
    if (c.parcela_id && (!c.tipo || c.tipo === 'parcela')) candidatas.push({ ...c, evidencias: lista<string>(c.evidencias), faltando: lista<string>(c.faltando) } as CandidataRevisao);
    else if (c.despesa_id && (!c.tipo || c.tipo === 'despesa')) despesasAntigas.push({ despesa_id: c.despesa_id, descricao: c.descricao ?? 'Despesa', valor: c.valor ?? c.saldo ?? null, competencia: c.competencia ?? c.vencimento ?? null, forca: c.forca });
  }
  const objeto = <T extends object>(v: unknown): T | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : null);
  const original = objeto<DocumentoRevisao['extraido']>(d.extraido_original);
  const classificacao = objeto<DocumentoRevisao['classificacao']>(d.classificacao) ?? {};
  return {
    ...d,
    extraido: objeto<DocumentoRevisao['extraido']>(d.extraido) ?? {},
    extraido_original: original && Object.keys(original).length ? original : null,
    motivos: lista<string>(d.motivos),
    candidatas,
    contas_candidatas: lista(d.contas_candidatas),
    pagamentos_candidatos: lista(d.pagamentos_candidatos),
    despesas_candidatas: [...lista<DespesaCandidata>(d.despesas_candidatas), ...despesasAntigas],
    classificacao: { ...classificacao, opcoes: lista<string>(classificacao.opcoes) },
  };
}

function normalizarFila(f: Partial<FilaRevisao> | null | undefined): FilaRevisao {
  const bloco = <T,>(b: { total?: number; itens?: T[] } | undefined) => {
    const itens = lista<T>(b?.itens);
    return { total: typeof b?.total === 'number' ? b.total : itens.length, itens };
  };
  const documentos = bloco<DocumentoRevisao>(f?.documentos);
  const despesas = bloco<FilaRevisao['despesas']['itens'][number]>(f?.despesas);
  return {
    despesas: { ...despesas, itens: despesas.itens.filter((d) => d && d.id).map((d) => ({ ...d, motivos_revisao: lista<string>(d.motivos_revisao) })) },
    documentos: { ...documentos, itens: documentos.itens.filter((d) => d && d.id).map(normalizarDocumento) },
  };
}

export const financeiro = {
  resumo: () => pedir<ResumoFinanceiro>('financeiro/resumo'),
  revisao: async () => normalizarFila(await pedir<Partial<FilaRevisao>>('financeiro/revisao', { query: { limite: 100 } })),
  lancamentos: (q: { de: string; ate: string; tipo?: string; categoria?: string; origem?: string; status?: string; busca?: string; limite?: number; deslocamento?: number }) =>
    pedir<ListaLancamentos>('financeiro/lancamentos', { query: { limite: 100, ...q } }),
  /** Só as categorias VÁLIDAS na unidade do topo (a ponte manda ?unidade=): o que os seletores oferecem. */
  categorias: async () => lista<Categoria>(await pedir<Categoria[]>('financeiro/categorias')),
  /** Cadastro inteiro, com `ativa_na_unidade`, `unidades` e `em_uso` (tela Categorias e nome de lançamento antigo). */
  cadastroCategorias: async () => lista<Categoria>(await pedir<Categoria[]>('financeiro/categorias', { query: { todas: true, incluir_inativas: true } })),
  criarCategoria: (c: CategoriaEntrada) => pedir<Categoria>('financeiro/categorias', { metodo: 'POST', corpo: c }),
  alterarCategoria: (codigo: string, c: CategoriaAlteracao) => pedir<Categoria>(`financeiro/categorias/${encodeURIComponent(codigo)}`, { metodo: 'PATCH', corpo: c }),
  categoriaNaUnidade: (codigo: string, unidade: string, ativo: boolean) =>
    pedir<Categoria>(`financeiro/categorias/${encodeURIComponent(codigo)}/unidades/${encodeURIComponent(unidade)}`, { metodo: 'PUT', corpo: { ativo } }),
  fornecedores: (busca?: string) => pedir<{ id: string; nome: string; documento: string | null }[]>('financeiro/fornecedores', { query: { busca, limite: 20 } }),
  despesa: (id: string) => pedir<DespesaSaida>(`financeiro/despesas/${id}`),
  criarDespesa: (d: DespesaEntrada, chave = novaChave()) => pedir<DespesaSaida>('financeiro/despesas', { metodo: 'POST', corpo: d, idempotencia: chave }),
  corrigirDespesa: (id: string, c: { versao: number; motivo: string; descricao?: string; valor?: string; competencia?: string; categoria?: string }) =>
    pedir<DespesaSaida>(`financeiro/despesas/${id}`, { metodo: 'PATCH', corpo: c }),
  confirmarDespesa: (id: string, categoria?: string) => pedir<DespesaSaida>(`financeiro/despesas/${id}/confirmar`, { metodo: 'POST', corpo: categoria ? { categoria } : null }),
  cancelarDespesa: (id: string, motivo: string) => pedir<DespesaSaida>(`financeiro/despesas/${id}/cancelar`, { metodo: 'POST', corpo: { motivo } }),
  // Documentos da Júlia (§5.2–5.4): ler, corrigir a leitura (PATCH com versão e motivo) e resolver.
  documentoRevisao: async (id: string) => normalizarDocumento(await pedir<DocumentoRevisao>(`financeiro/revisao/documentos/${id}`)),
  corrigirDocumento: async (id: string, c: CorrecaoDocumento) => normalizarDocumento(await pedir<DocumentoRevisao>(`financeiro/revisao/documentos/${id}`, { metodo: 'PATCH', corpo: c })),
  resolverDocumento: (id: string, r: ResolucaoDocumento) =>
    pedir<{ id: string; situacao: string; despesa_id: string | null; pagamento_id: string | null; versao?: number }>(`financeiro/revisao/documentos/${id}/resolver`, { metodo: 'POST', corpo: r }),
  /** Anexos da despesa (§5.5): o dela, os dos pagamentos, o da compra e os documentos vinculados, um por arquivo. */
  anexosDespesa: async (id: string) => lista<AnexoDespesa>(await pedir<AnexoDespesa[]>(`financeiro/despesas/${id}/documentos`)),
  /** Despesa lançada na unidade errada (§5.6). 409: despesa_de_compra, despesa_conciliada, apuracao_fechada. */
  mudarUnidadeDespesa: (id: string, m: { unidade: string; versao: number; motivo: string }) => pedir<DespesaSaida>(`financeiro/despesas/${id}/unidade`, { metodo: 'POST', corpo: m }),
  enviarParaCompras: (id: string) => pedir<{ compra_id: string; compra_nova: boolean }>(`financeiro/comprovantes/${id}/enviar-para-compras`, { metodo: 'POST' }),
  contas: (q: { situacao?: string; de?: string; ate?: string; limite?: number }) => pedir<ListaContas>('financeiro/contas-a-pagar', { query: { limite: 200, ...q } }),
  pagar: (parcelaId: string, p: PagamentoEntrada) => pedir<ParcelaSaida>(`financeiro/parcelas/${parcelaId}/pagamentos`, { metodo: 'POST', corpo: p }),
  estornarPagamento: (id: string, motivo: string) => pedir<ParcelaSaida>(`financeiro/pagamentos/${id}/estornar`, { metodo: 'POST', corpo: { motivo } }),
  // Outras receitas (fora do PDV): POST 201 com Idempotency-Key; cancelar exige motivo (409 receita_conciliada).
  criarOutraReceita: (r: OutraReceitaEntrada, chave = novaChave()) => pedir<OutraReceitaSaida>('financeiro/outras-receitas', { metodo: 'POST', corpo: r, idempotencia: chave }),
  cancelarOutraReceita: (id: string, motivo: string) => pedir<{ id: string; status: OutraReceitaSaida['status'] }>(`financeiro/outras-receitas/${id}/cancelar`, { metodo: 'POST', corpo: { motivo } }),
  // Contas fixas (recorrências) e taxas do cartão/PIX: financeiro.lancar no backend (gerente e proprietário).
  recorrencias: (ativas = true) => pedir<Recorrencia[]>('financeiro/recorrencias', { query: { ativas } }),
  criarRecorrencia: (r: RecorrenciaEntrada) => pedir<Recorrencia>('financeiro/recorrencias', { metodo: 'POST', corpo: r }),
  alterarRecorrencia: (id: string, r: { versao: number; aplicar_a_partir_de?: string; encerrar_em?: string; valor_previsto?: string; descricao?: string; dia_vencimento?: number; valor_variavel?: boolean }) =>
    pedir<Recorrencia>(`financeiro/recorrencias/${id}`, { metodo: 'PATCH', corpo: r }),
  taxas: () => pedir<TaxaPagamento[]>('financeiro/taxas-pagamento'),
  registrarTaxa: (t: TaxaEntrada) => pedir<TaxaEntrada>('financeiro/taxas-pagamento', { metodo: 'POST', corpo: t }),
  // Relatórios
  vendas: (de: string, ate: string, agrupar: AgrupamentoVendas) => pedir<RelatorioVendas>('financeiro/relatorios/vendas', { query: { de, ate, agrupar } }),
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
  // Banco: tudo com financeiro.conciliar; reabrir o mês conciliado exige financeiro.configurar (só Proprietário).
  movimentos: (q: { de: string; ate: string; conta_id?: string; nivel?: NivelConciliacao; situacao?: string; importacao_id?: string; direcao?: string; limite?: number; deslocamento?: number }) =>
    pedir<Pagina<MovimentoBancario>>('financeiro/conciliacao/movimentos', { query: { limite: 100, ...q } }),
  movimento: (id: string) => pedir<MovimentoDetalhe>(`financeiro/conciliacao/movimentos/${id}`),
  acaoMovimento: (id: string, a: Record<string, unknown> & { versao: number; acao: string }) =>
    pedir<MovimentoDetalhe & { conciliacao_id: string }>(`financeiro/conciliacao/movimentos/${id}/acoes`, { metodo: 'POST', corpo: a }),
  identidade: (id: string, versao: number, decisao: 'distinto' | 'duplicado') => pedir<MovimentoDetalhe>(`financeiro/conciliacao/movimentos/${id}/identidade`, { metodo: 'POST', corpo: { versao, decisao } }),
  conciliacaoMes: (mes: string) => pedir<ConciliacaoMes>(`financeiro/conciliacao/meses/${mes}`),
  conciliarMes: (mes: string, contaId: string) => pedir<EstadoContaMes & { estado_calculado?: string; marcado?: unknown }>(`financeiro/conciliacao/meses/${mes}/contas/${contaId}/conciliar`, { metodo: 'POST' }),
  reabrirMes: (mes: string, contaId: string, motivo: string) => pedir<EstadoContaMes & { estado_calculado?: string; marcado?: unknown }>(`financeiro/conciliacao/meses/${mes}/contas/${contaId}/reabrir`, { metodo: 'POST', corpo: { motivo } }),
  desfazerVinculo: (conciliacaoId: string, motivo: string) => pedir<MovimentoDetalhe>(`financeiro/conciliacao/vinculos/${conciliacaoId}/desfazer`, { metodo: 'POST', corpo: { motivo } }),
  repasses: (de: string, ate: string) => pedir<Repasses>('financeiro/conciliacao/repasses', { query: { de, ate } }),
  // Apuração mensal (ver e conferir: financeiro.visualizar; fechar e reabrir: financeiro.configurar = Proprietário)
  apuracao: (mes: string) => pedir<Apuracao>(`financeiro/apuracoes/${mes}`),
  conferirApuracao: (mes: string) => pedir<Apuracao>(`financeiro/apuracoes/${mes}/conferir`, { metodo: 'POST' }),
  fecharApuracao: (mes: string, excecao_conciliacao?: string) => pedir<Apuracao>(`financeiro/apuracoes/${mes}/fechar`, { metodo: 'POST', corpo: excecao_conciliacao ? { excecao_conciliacao } : null }),
  reabrirApuracao: (mes: string, motivo: string) => pedir<Apuracao>(`financeiro/apuracoes/${mes}/reabrir`, { metodo: 'POST', corpo: { motivo } }),
  /** Participação (ex.: Roll), só com financeiro.ver_societario. Sem regra aprovada o backend responde 409
   *  `regra_nao_aprovada` com a simulação em `dados`: aqui isso vira `{ tipo: 'simulacao' }` (não é erro da tela). */
  participacao: async (mes: string): Promise<Participacao> => {
    try {
      const r = await pedir<Omit<Extract<Participacao, { tipo: 'oficial' }>, 'tipo'>>(`financeiro/apuracoes/${mes}/participacao`);
      return { ...r, tipo: 'oficial' };
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'regra_nao_aprovada') {
        return { tipo: 'simulacao', mes, simulacao: (e.dados?.simulacao ?? {}) as SimulacaoParticipacao, aviso: e.message };
      }
      throw e;
    }
  },
  // Documentos (URL assinada de 5 min)
  enviarArquivo: (arquivo: File, tipo: 'comprovante' | 'nota' | 'documento') => {
    const f = new FormData();
    f.set('arquivo', arquivo);
    f.set('tipo', tipo);
    return pedir<{ id: string; mime: string; ja_existia: boolean }>('arquivos', { metodo: 'POST', formulario: f });
  },
  urlArquivo: (id: string) => pedir<{ url: string; expira_em: string; mime: string }>(`arquivos/${id}/url`),
};
