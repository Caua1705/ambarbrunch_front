// DEMONSTRAÇÃO — Estoque fictício (insumos, compras, fichas, contagens, cancelamentos e análises inventados; o cadastro
// real vem do backend). Formatos IGUAIS aos do backend (app/modulos/estoque/api_*.py): insumos-sugestoes devolve UM objeto,
// 409 inventario_aberto traz dados.inventario_id, 409 nome_ja_existe traz dados.insumo_id, fechar a contagem devolve
// {inventario_id, ajustes, valor_total, nao_contados}, problemas da nota são {codigo, texto}. Regras imitadas: baixa
// automática DESLIGADA (saldos não confiáveis), etapas reais da leitura de nota, `versao` em item e compra (409
// conflito_versao), 422 conversao_ambigua, 409 despesa_ja_registrada com candidata forte. Os perfis seguem a matriz do
// backend: Estoque inteiro só para Gerente e Proprietário. Nada sai daqui.
import type { Rota } from './roteador';
import { TODOS, GERENCIA, ErroDemo, dia, instante, agoraMenos, uuid, resposta, exigirMotivo, hojeFortaleza } from './roteador';
import type {
  Insumo, InsumoCadastro, CompraDetalhe, ItemCompra, MovimentoEstoque, FichaLista, FichaDetalhe, FichaSalva, UnidadeBase, Inventario, InventarioResumo,
  CancelamentoEstoque, EtapaCompra, TipoMovimento, DecisaoCancelamento, FechamentoInventario, SugestaoInsumo,
} from '../../lib/tipos/estoque';

const d2 = (v: number) => v.toFixed(2);
const d4 = (v: number) => v.toFixed(4);
const d6 = (v: number) => v.toFixed(6);

// Insumos ---------------------------------------------------------------------------------------------------------------

interface InsumoDemo extends Insumo {
  prazo_reposicao_dias: number | null;
  movimentos: MovimentoEstoque[];
  precos: { ocorreu_em: string; custo_unitario: string | null; quantidade: string; compra_item_id: string | null }[];
}

let seqMov = 5000;
/** Movimento do livro no formato de _movimento_saida (vínculos nulos quando não se aplicam). */
function mov(p: Pick<MovimentoEstoque, 'tipo' | 'quantidade' | 'custo_unitario' | 'valor' | 'saldo_apos' | 'custo_medio_apos' | 'ocorreu_em' | 'motivo'> & Partial<MovimentoEstoque>): MovimentoEstoque {
  return {
    id: ++seqMov, custo_desconhecido: p.custo_unitario === null, dia: p.ocorreu_em.slice(0, 10), venda_id: null, eye_product_id: null, compra_item_id: null, producao_id: null,
    inventario_item_id: null, estorna_movimento_id: null, registrado_por: 'usuario:demo', ...p,
  };
}

const BASE: [string, string, UnidadeBase, number, number | null, number | null, string | null][] = [
  // nome, categoria, unidade, saldo, custo médio (por unidade-base), mínimo, motivo não confiável
  ['Café em grãos', 'Cafeteria', 'g', 6200, 0.118, 3000, 'baixa_desligada'],
  ['Leite integral', 'Laticínios', 'ml', 42000, 0.0059, 24000, 'baixa_desligada'],
  ['Manteiga sem sal', 'Laticínios', 'g', 3800, 0.0412, 2000, 'baixa_desligada'],
  ['Farinha de trigo', 'Secos', 'g', 18000, 0.0052, 10000, 'baixa_desligada'],
  ['Açúcar refinado', 'Secos', 'g', 9000, 0.0049, 5000, 'baixa_desligada'],
  ['Ovos', 'Hortifruti', 'un', 96, 0.78, 60, 'baixa_desligada'],
  ['Canela em pó', 'Secos', 'g', 420, 0.092, 300, 'nunca_contado'],
  ['Cream cheese', 'Laticínios', 'g', 1500, 0.0385, 2000, 'baixa_desligada'],
  ['Pistache sem casca', 'Secos', 'g', 650, 0.21, 500, 'nunca_contado'],
  ['Muçarela', 'Laticínios', 'g', 2400, 0.0418, 2000, 'baixa_desligada'],
  ['Tomate italiano', 'Hortifruti', 'g', -300, 0.0089, 2000, 'ficou_negativo'],
  ['Pão de fermentação natural', 'Padaria', 'un', 18, 6.5, 12, 'baixa_desligada'],
  ['Chocolate 70%', 'Confeitaria', 'g', 2100, 0.089, 1000, 'baixa_desligada'],
  ['Morango', 'Hortifruti', 'g', 1200, 0.026, 1500, 'baixa_desligada'],
  ['Cogumelo paris', 'Hortifruti', 'g', 0, null, 800, 'sem_movimento'],
  ['Creme de cream cheese (preparo)', 'Preparos', 'g', 0, null, null, 'sem_movimento'],
];

const insumos: InsumoDemo[] = BASE.map(([nome, categoria, unidade_base, saldo, custo, minimo, motivo], i) => {
  const id = `e1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
  const compra = custo !== null ? agoraMenos(60 * 24 * (2 + (i % 9))) : null;
  const precos = custo === null ? [] : [0.92, 0.97, 1, 1.03].map((f, k) => ({ ocorreu_em: agoraMenos(60 * 24 * (40 - k * 11 + (i % 5))), custo_unitario: d6(custo * f), quantidade: d4(unidade_base === 'un' ? 30 : 5000), compra_item_id: null }));
  const movimentos: MovimentoEstoque[] = [];
  if (custo !== null) {
    let s = 0;
    const entradas = 3 + (i % 3);
    for (let k = 0; k < entradas; k++) {
      const q = unidade_base === 'un' ? 30 : unidade_base === 'ml' ? 12000 : 2000;
      s += q;
      movimentos.unshift(mov({ tipo: 'entrada_compra', quantidade: d4(q), custo_unitario: d6(custo), valor: d2(q * custo), saldo_apos: d4(s), custo_medio_apos: d6(custo), ocorreu_em: agoraMenos(60 * 24 * (30 - k * 7)), motivo: null, compra_item_id: uuid() }));
    }
    if (i % 4 === 1) movimentos.unshift(mov({ tipo: 'perda', quantidade: d4(-(unidade_base === 'un' ? 6 : 300)), custo_unitario: d6(custo), valor: d2(-(unidade_base === 'un' ? 6 : 300) * custo), saldo_apos: d4(s - 300), custo_medio_apos: d6(custo), ocorreu_em: agoraMenos(60 * 30), motivo: 'vencido' }));
  }
  const preparo = nome.endsWith('(preparo)');
  return {
    id, codigo: `INS-${String(i + 1).padStart(3, '0')}`, nome, categoria, unidade_base, tipo: preparo ? 'preparo' : 'comprado', controle_preparo: preparo ? 'explodir' : null,
    estoque_minimo: minimo === null ? null : d4(minimo), ativo: true, versao: 1, saldo: d4(saldo), custo_medio: custo === null ? null : d6(custo),
    ultimo_custo_compra: custo === null ? null : d6(custo * 1.03), ultima_compra_em: compra, ultima_contagem_em: motivo === 'nunca_contado' || motivo === 'sem_movimento' ? null : agoraMenos(60 * 24 * 12),
    cobertura_dias: null, saldo_confiavel: motivo === null, motivo_nao_confiavel: motivo as Insumo['motivo_nao_confiavel'],
    abaixo_minimo: minimo !== null && saldo < minimo, prazo_reposicao_dias: i % 3 === 0 ? 3 : null, movimentos, precos,
  };
});

const insumoPorNome = (n: string) => insumos.find((x) => x.nome === n)!;
/** Linha da lista (insumos.listar). */
const linhaInsumo = ({ movimentos: _m, precos: _p, prazo_reposicao_dias: _r, ...i }: InsumoDemo): Insumo => {
  void _m; void _p; void _r;
  return { ...i, abaixo_minimo: i.estoque_minimo !== null && Number(i.saldo) < Number(i.estoque_minimo) };
};
/** Cadastro (_insumo_saida): o que POST e PATCH devolvem. */
const cadastroInsumo = (i: InsumoDemo): InsumoCadastro => ({ id: i.id, codigo: i.codigo, nome: i.nome, categoria: i.categoria, unidade_base: i.unidade_base, tipo: i.tipo, controle_preparo: i.controle_preparo, estoque_minimo: i.estoque_minimo, prazo_reposicao_dias: i.prazo_reposicao_dias, ativo: i.ativo, versao: i.versao });
function acharInsumo(id: string) {
  const i = insumos.find((x) => x.id === id);
  if (!i) throw new ErroDemo(404, 'nao_encontrado', 'Insumo não encontrado.');
  return i;
}
function criarInsumoDemo(e: { nome: string; unidade_base: UnidadeBase; categoria?: string | null; tipo?: 'comprado' | 'preparo'; controle_preparo?: 'explodir' | 'lote' | null; estoque_minimo?: string | null }): InsumoDemo {
  const tipo = e.tipo ?? 'comprado';
  const novo: InsumoDemo = {
    id: uuid(), codigo: `INS-${String(insumos.length + 1).padStart(3, '0')}`, nome: e.nome.trim(), categoria: e.categoria?.trim() || null, unidade_base: e.unidade_base, tipo,
    controle_preparo: tipo === 'preparo' ? e.controle_preparo ?? 'explodir' : null, estoque_minimo: e.estoque_minimo ? d4(Number(e.estoque_minimo)) : null, ativo: true, versao: 1,
    saldo: '0.0000', custo_medio: null, ultimo_custo_compra: null, ultima_compra_em: null, ultima_contagem_em: null, cobertura_dias: null, saldo_confiavel: false,
    motivo_nao_confiavel: 'sem_movimento', abaixo_minimo: false, prazo_reposicao_dias: null, movimentos: [], precos: [],
  };
  insumos.push(novo);
  return novo;
}
function movimentar(i: InsumoDemo, tipo: TipoMovimento, qtd: number, custo: number | null, motivo: string | null): MovimentoEstoque {
  const saldo = Number(i.saldo) + qtd;
  let medio = i.custo_medio === null ? null : Number(i.custo_medio);
  if (qtd > 0 && custo !== null && tipo === 'entrada_compra') {
    const anterior = Math.max(0, Number(i.saldo));
    medio = medio === null || anterior <= 0 ? custo : (anterior * medio + qtd * custo) / (anterior + qtd);
    i.precos.push({ ocorreu_em: new Date().toISOString(), custo_unitario: d6(custo), quantidade: d4(qtd), compra_item_id: null });
    i.ultima_compra_em = new Date().toISOString();
    i.ultimo_custo_compra = d6(custo);
  }
  const unit = custo ?? medio;
  const m = mov({ tipo, quantidade: d4(qtd), custo_unitario: unit === null ? null : d6(unit), valor: unit === null ? null : d2(qtd * unit), saldo_apos: d4(saldo), custo_medio_apos: medio === null ? null : d6(medio), ocorreu_em: new Date().toISOString(), dia: hojeFortaleza(), motivo });
  i.movimentos.unshift(m);
  i.saldo = d4(saldo);
  i.custo_medio = medio === null ? null : d6(medio);
  if (i.motivo_nao_confiavel === 'sem_movimento') i.motivo_nao_confiavel = 'nunca_contado';
  if (saldo < 0) {
    i.saldo_confiavel = false;
    i.motivo_nao_confiavel = 'ficou_negativo';
  }
  return m;
}

// Compras ---------------------------------------------------------------------------------------------------------------

const ETAPAS: EtapaCompra[] = ['recebida', 'processando', 'itens_extraidos', 'associacoes_sugeridas', 'aguardando_conferencia'];
const DETALHE: Partial<Record<EtapaCompra, string>> = { recebida: 'Documento recebido', processando: 'lendo o documento', itens_extraidos: '3 itens lidos', associacoes_sugeridas: 'associando aos insumos' };

interface CompraDemo extends CompraDetalhe {
  arquivo_mime: string | null;
  /** Avança uma etapa a cada consulta enquanto lê (o backend lê em segundo plano). */
  leitura?: { proximos: ItemCompra[]; fonte: CompraDetalhe['fonte_leitura']; fornecedor: string };
}

function item(ordem: number, descricao: string, quantidade: number, unidade: string, valor: number, sug: { nome?: string; confianca?: 'alta' | 'media' | 'baixa' | 'nenhuma'; fator?: number; motivo?: string } = {}, alertas: string[] = []): ItemCompra {
  const ins = sug.nome ? insumoPorNome(sug.nome) : null;
  const fator = sug.fator ?? null;
  const qb = fator !== null ? quantidade * fator : null;
  const confianca = sug.confianca ?? (ins ? 'alta' : 'nenhuma');
  const situacao: ItemCompra['situacao'] = ins && confianca === 'alta' && !alertas.length && fator !== null ? 'sugerido' : 'pendente';
  return {
    id: uuid(), ordem, versao: 1, descricao, codigo_produto: null, gtin: null, quantidade: d4(quantidade), unidade, valor_unitario: d2(valor / quantidade), valor_bruto: d2(valor), desconto: '0.00', encargos: '0.00', valor_liquido: d2(valor), situacao, categoria_despesa: null,
    // O backend sempre manda a `sugestao`; sem insumo, os campos vêm nulos.
    sugestao: { insumo_id: ins?.id ?? null, insumo: ins?.nome ?? null, unidade_base: ins?.unidade_base ?? null, confianca, motivo: ins ? sug.motivo ?? (confianca === 'alta' ? 'mesmo_produto_da_ultima_compra' : 'nome_parecido (0.71)') : null, fator: fator === null ? null : d4(fator), quantidade_base: qb === null ? null : d4(qb), custo_unitario_base: qb ? d6(valor / qb) : null },
    alertas,
  };
}

const DESPESA_JULIA_LATICINIOS = 'f1000000-0000-4000-8000-000000000101';
const DESPESA_JULIA_HORTI = 'f1000000-0000-4000-8000-000000000102';

function compraBase(p: Partial<CompraDemo> & Pick<CompraDemo, 'id' | 'etapa' | 'origem' | 'fonte_leitura'>): CompraDemo {
  return {
    etapa_painel: p.etapa, etapa_detalhe: null, erro_codigo: null, etapas: [{ etapa: 'recebida', em: agoraMenos(180) }], arquivo_id: null, arquivo_mime: null,
    fornecedor: null, fornecedor_lido: { documento: null, nome: null }, modelo: null, chave_acesso: null, numero: null, serie: null, emitida_em: null, totais: { produtos: null, desconto: '0.00', frete: '0.00', outros: '0.00', total: null },
    conferencia: { ok: true, problemas: [] }, duplicatas: [], observacoes: [], divergencia_aceita: null, itens: [], despesa: { despesa_id: null, candidatas: [] },
    despesa_origem_id: null, aviso: null, pendencias: [], pode_confirmar: false, versao: 1, confirmada_em: null, cancelada_em: null, cancelada_motivo: null, criado_em: agoraMenos(180),
    ...p,
  } as CompraDemo;
}

const compras: CompraDemo[] = [];
function montarCompras() {
  if (compras.length) return;
  const hoje = hojeFortaleza();
  // 1. XML pronto para confirmar, com o Pix da Júlia como candidata forte
  const xmlItens = [
    item(1, 'LEITE UHT INTEGRAL CX 12X1L', 3, 'CX', 239.0, { nome: 'Leite integral', fator: 12000 }),
    item(2, 'MANTEIGA S/SAL TABLETE 500G', 4, 'UN', 82.4, { nome: 'Manteiga sem sal', fator: 500 }),
    item(3, 'CREAM CHEESE BISNAGA 1,2KG', 1, 'UN', 16.8, { nome: 'Cream cheese', fator: 1200 }),
  ];
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000001', etapa: 'aguardando_conferencia', etapa_painel: 'pronta', origem: 'painel', fonte_leitura: 'xml', arquivo_id: 'demo-doc-1', arquivo_mime: 'application/xml', modelo: '55',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000001', nome: 'Laticínios Serra Azul Ltda', documento: '12.345.678/0001-90' }, fornecedor_lido: { documento: '12345678000190', nome: 'LATICINIOS SERRA AZUL LTDA' },
    numero: '18452', serie: '1', emitida_em: instante(dia(-1, hoje), '09:12'), totais: { produtos: '338.20', desconto: '0.00', frete: '0.00', outros: '0.00', total: '338.20' },
    duplicatas: [{ numero: '001', vencimento: dia(14, hoje), valor: '338.20' }], itens: xmlItens,
    despesa: { despesa_id: null, candidatas: [{ despesa_id: DESPESA_JULIA_LATICINIOS, descricao: 'Pix Laticínios Serra Azul', valor: '338.20', competencia: dia(-1, hoje), origem: 'julia', paga: true, forca: 'forte' }] },
    pode_confirmar: true, versao: 4, criado_em: agoraMenos(60 * 20),
    etapas: ['recebida', 'processando', 'itens_extraidos', 'associacoes_sugeridas', 'aguardando_conferencia'].map((e, k) => ({ etapa: e, em: agoraMenos(60 * 20 - k) })),
  }));
  // 2. Foto de NFC-e lida por IA: um item de confiança média com preço fora do padrão e um sem insumo
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000002', etapa: 'aguardando_conferencia', origem: 'julia', fonte_leitura: 'foto_ia', arquivo_id: 'demo-doc-2', arquivo_mime: 'image/svg+xml',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000002', nome: 'Mercadinho São Luiz', documento: '98.765.432/0001-10' }, fornecedor_lido: { documento: '98765432000110', nome: 'MERCADINHO SAO LUIZ' }, numero: '7731', emitida_em: instante(hoje, '07:40'),
    totais: { produtos: '214.70', desconto: '0.00', frete: '0.00', outros: '0.00', total: '214.70' },
    itens: [
      item(1, 'OVOS BRANCOS GRANDES BDJ 30', 2, 'BDJ', 46.0, { nome: 'Ovos', fator: 30 }),
      item(2, 'MORANGO BANDEJA', 4, 'UN', 39.6, { nome: 'Morango', confianca: 'media', fator: 250 }, ['preco_fora_do_padrao']),
      item(3, 'CHOC 70% CACAU 1KG', 1, 'UN', 89.9, { nome: 'Chocolate 70%', fator: 1000 }),
      item(4, 'DETERGENTE NEUTRO 500ML', 3, 'UN', 39.2, {}),
    ],
    observacoes: ['sem_qr'], pendencias: ['item_2_sem_insumo', 'item_4_sem_insumo'], versao: 2, criado_em: agoraMenos(95),
    etapas: ['recebida', 'processando', 'itens_extraidos', 'associacoes_sugeridas', 'aguardando_conferencia'].map((e, k) => ({ etapa: e, em: agoraMenos(95 - k) })),
  }));
  // 3. Só o comprovante do Pix (Júlia): sem produtos
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000003', etapa: 'aguardando_conferencia', origem: 'julia', fonte_leitura: 'comprovante', arquivo_id: 'demo-doc-3', arquivo_mime: 'image/svg+xml',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000003', nome: 'Hortifruti Bom Preço', documento: null }, fornecedor_lido: { documento: null, nome: 'Hortifruti Bom Preço' }, emitida_em: instante(hoje, '06:55'),
    totais: { produtos: null, desconto: '0.00', frete: '0.00', outros: '0.00', total: '186.40' }, despesa_origem_id: DESPESA_JULIA_HORTI, conferencia: { ok: false, motivo: 'sem_itens' },
    aviso: 'Só há o comprovante do pagamento: informe os produtos e as quantidades (ou envie a nota). O documento já está aqui; não precisa mandar de novo.', pendencias: ['sem_itens'], versao: 1, criado_em: agoraMenos(140),
  }));
  // 4. Nota sendo lida agora (avança a cada consulta)
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000004', etapa: 'processando', origem: 'painel', fonte_leitura: null, etapa_detalhe: 'lendo o documento', arquivo_id: 'demo-doc-4', arquivo_mime: 'image/svg+xml', criado_em: agoraMenos(2),
    etapas: [{ etapa: 'recebida', em: agoraMenos(2) }, { etapa: 'processando', em: agoraMenos(1), detalhe: 'lendo o documento' }],
    leitura: { fonte: 'sefaz_qr', fornecedor: 'Empório Grão Fino', proximos: [item(1, 'CAFE GRAOS ESPECIAL 1KG', 3, 'PCT', 354.0, { nome: 'Café em grãos', fator: 1000 }), item(2, 'CANELA EM PO 500G', 1, 'PCT', 46.0, { nome: 'Canela em pó', fator: 500 }), item(3, 'PISTACHE SEM CASCA 1KG', 1, 'PCT', 219.0, { nome: 'Pistache sem casca', confianca: 'media' })] },
  }));
  // 5. Falhou: a nota já estava registrada
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000005', etapa: 'falhou', origem: 'julia', fonte_leitura: 'xml', erro_codigo: 'nota_ja_registrada', etapa_detalhe: 'Esta nota (Laticínios Serra Azul nº 18452) já foi registrada.', arquivo_id: 'demo-doc-5', arquivo_mime: 'application/xml',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000001', nome: 'Laticínios Serra Azul Ltda', documento: '12.345.678/0001-90' }, numero: '18452', totais: { produtos: '338.20', desconto: '0.00', frete: '0.00', outros: '0.00', total: '338.20' }, criado_em: agoraMenos(60 * 8),
  }));
  // 6. Já confirmada
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000006', etapa: 'confirmada', origem: 'painel', fonte_leitura: 'xml', arquivo_id: 'demo-doc-6', arquivo_mime: 'application/xml',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000004', nome: 'Distribuidora Fortaleza de Alimentos', documento: '45.678.901/0001-22' }, fornecedor_lido: { documento: '45678901000122', nome: 'DISTRIBUIDORA FORTALEZA DE ALIMENTOS' }, numero: '99310', emitida_em: instante(dia(-3, hoje), '10:00'),
    totais: { produtos: '412.00', desconto: '12.00', frete: '0.00', outros: '0.00', total: '400.00' },
    itens: [item(1, 'FARINHA TRIGO T1 25KG', 1, 'SC', 128.0, { nome: 'Farinha de trigo', fator: 25000 }), item(2, 'ACUCAR REFINADO 5KG', 4, 'PCT', 120.0, { nome: 'Açúcar refinado', fator: 5000 }), item(3, 'MUCARELA PECA KG', 4, 'KG', 152.0, { nome: 'Muçarela', fator: 1000 })].map((x) => ({ ...x, situacao: 'confirmado' as const })),
    despesa: { despesa_id: 'f1000000-0000-4000-8000-000000000103', candidatas: [] }, confirmada_em: agoraMenos(60 * 24 * 3), criado_em: agoraMenos(60 * 24 * 3 + 30), versao: 9,
  }));
}

function recalcular(c: CompraDemo) {
  const pend: string[] = [];
  if (c.etapa !== 'aguardando_conferencia') pend.push(`etapa_${c.etapa}`);
  c.itens.forEach((i) => {
    if (i.situacao === 'pendente') pend.push(`item_${i.ordem}_sem_insumo`);
  });
  if (!c.itens.length) pend.push('sem_itens');
  if (c.itens.length && c.conferencia && !c.conferencia.ok && !c.divergencia_aceita) pend.push('conferencia_aritmetica');
  c.pendencias = pend;
  c.pode_confirmar = !pend.length;
  c.etapa_painel = c.etapa === 'aguardando_conferencia' && !pend.length ? 'pronta' : c.etapa;
  const soma = c.itens.reduce((s, i) => s + Number(i.valor_liquido), 0);
  if (c.itens.length) c.totais.produtos = d2(soma);
}

function avancar(c: CompraDemo) {
  if (!c.leitura) return;
  const i = ETAPAS.indexOf(c.etapa);
  const prox = ETAPAS[Math.min(i + 1, ETAPAS.length - 1)];
  c.etapa = prox;
  c.etapa_painel = prox;
  c.etapa_detalhe = DETALHE[prox] ?? null;
  c.etapas.push({ etapa: prox, em: new Date().toISOString(), ...(DETALHE[prox] ? { detalhe: DETALHE[prox] } : {}) });
  if (prox === 'itens_extraidos') c.etapa_detalhe = `${c.leitura.proximos.length} itens lidos`;
  if (prox === 'aguardando_conferencia') {
    c.itens = c.leitura.proximos;
    c.fonte_leitura = c.leitura.fonte;
    c.fornecedor = { id: uuid(), nome: c.leitura.fornecedor, documento: null };
    c.fornecedor_lido = { documento: null, nome: c.leitura.fornecedor.toUpperCase() };
    c.numero = String(30000 + Math.floor(Math.random() * 9999));
    c.emitida_em = new Date().toISOString();
    c.totais.total = d2(c.itens.reduce((s, x) => s + Number(x.valor_liquido), 0));
    c.leitura = undefined;
    c.versao++;
    recalcular(c);
  }
}

function acharCompra(id: string) {
  montarCompras();
  const c = compras.find((x) => x.id === id);
  if (!c) throw new ErroDemo(404, 'nao_encontrado', 'Compra não encontrada.');
  return c;
}
/** Detalhe (api_compras.detalhe): candidatas de despesa só aparecem em conferência. */
const saidaCompra = ({ leitura: _l, arquivo_mime: _m, ...c }: CompraDemo): CompraDetalhe => {
  void _l; void _m;
  return { ...c, despesa: { ...c.despesa, candidatas: c.etapa === 'aguardando_conferencia' ? c.despesa.candidatas : [] } };
};
function listaCompra(c: CompraDemo) {
  return {
    id: c.id, etapa: c.etapa, etapa_painel: c.etapa_painel, fornecedor: c.fornecedor_lido.nome ?? c.fornecedor?.nome ?? null, numero: c.numero, emitida_em: c.emitida_em,
    valor_total: c.totais.total, itens: c.itens.length, pendentes: c.itens.filter((i) => i.situacao === 'pendente').length, fonte_leitura: c.fonte_leitura, origem: c.origem,
    criado_em: c.criado_em, sem_itens: !c.itens.length, despesa_origem_id: c.despesa_origem_id,
  };
}
function novaLeitura(origem: 'painel' | 'julia', arquivo?: { id: string | null; mime: string | null }): CompraDemo {
  const c = compraBase({
    id: uuid(), etapa: 'recebida', origem, fonte_leitura: null, etapa_detalhe: 'Documento recebido', arquivo_id: arquivo?.id ?? `demo-doc-${uuid()}`, arquivo_mime: arquivo?.mime ?? 'image/svg+xml', criado_em: new Date().toISOString(),
    etapas: [{ etapa: 'recebida', em: new Date().toISOString() }],
    leitura: { fonte: 'foto_ia', fornecedor: 'Padaria e Confeitaria Aurora', proximos: [item(1, 'PAO FERMENTACAO NATURAL', 10, 'UN', 65.0, { nome: 'Pão de fermentação natural', fator: 1 }), item(2, 'TOMATE ITALIANO KG', 3, 'KG', 26.7, { nome: 'Tomate italiano', confianca: 'media', fator: 1000 })] },
  });
  compras.unshift(c);
  return c;
}

/** Itens digitados (preenchimento manual / compra sem nota) com a sugestão de insumo pelo nome. */
function itensManuais(lista: { descricao: string; quantidade: string | number; unidade: string; valor_total: string | number }[]): ItemCompra[] {
  if (!Array.isArray(lista) || !lista.length) throw new ErroDemo(422, 'regra_violada', 'Informe pelo menos um item.');
  return lista.map((x, k) => {
    const nome = String(x.descricao ?? '').trim();
    if (!nome) throw new ErroDemo(422, 'regra_violada', `Informe a descrição do item ${k + 1}.`);
    const ins = insumos.find((i) => i.tipo === 'comprado' && i.nome.toLowerCase().split(' ')[0] && nome.toLowerCase().includes(i.nome.toLowerCase().split(' ')[0]));
    const un = String(x.unidade ?? 'UN').toUpperCase();
    const fator = ins ? (un === 'KG' && ins.unidade_base === 'g' ? 1000 : un === 'L' && ins.unidade_base === 'ml' ? 1000 : un === 'G' || un === 'ML' ? 1 : un === 'UN' && ins.unidade_base === 'un' ? 1 : undefined) : undefined;
    return item(k + 1, nome.toUpperCase(), Number(x.quantidade), un, Number(x.valor_total), ins ? { nome: ins.nome, confianca: fator ? 'alta' : 'media', fator, motivo: 'nome_parecido' } : {});
  });
}
/** Conferência aritmética da nota digitada: {ok, problemas: [{codigo, texto}]}. */
function conferirTotais(c: CompraDemo, total: number, desconto: number) {
  const soma = c.itens.reduce((s, i) => s + Number(i.valor_liquido), 0) - desconto;
  c.totais.desconto = d2(desconto);
  c.totais.total = d2(total);
  c.conferencia = Math.abs(soma - total) > 0.05 ? { ok: false, problemas: [{ codigo: 'soma_nao_fecha', texto: `A soma dos itens (R$ ${d2(soma)}) não fecha com o total (R$ ${d2(total)}).` }] } : { ok: true, problemas: [] };
}

// Cancelamentos (venda cancelada depois da baixa) ----------------------------------------------------------------------

const cancelamentos: CancelamentoEstoque[] = [
  { id: 'e5000000-0000-4000-8000-000000000001', venda_id: uuid(), dia: dia(-1), motivo: 'venda_cancelada', baixa_lancada: true, situacao: 'pendente', observacao: null, resolvido_por: null, resolvido_em: null, versao: 1, criado_em: agoraMenos(60 * 20), itens: [{ insumo_id: insumos[1].id, quantidade: '150.0000', custo_unitario: '0.005900' }, { insumo_id: insumos[0].id, quantidade: '18.0000', custo_unitario: '0.118000' }] },
  { id: 'e5000000-0000-4000-8000-000000000002', venda_id: uuid(), dia: dia(0), motivo: 'venda_corrigida', baixa_lancada: true, situacao: 'pendente', observacao: null, resolvido_por: null, resolvido_em: null, versao: 1, criado_em: agoraMenos(90), itens: [{ insumo_id: insumos[3].id, quantidade: '83.3333', custo_unitario: '0.005200' }, { insumo_id: insumos[2].id, quantidade: '20.8333', custo_unitario: '0.041200' }] },
  { id: 'e5000000-0000-4000-8000-000000000003', venda_id: uuid(), dia: dia(-4), motivo: 'venda_cancelada', baixa_lancada: false, situacao: 'nao_produzido', observacao: 'Cliente desistiu antes do preparo.', resolvido_por: 'usuario:gerente', resolvido_em: agoraMenos(60 * 24 * 4 - 30), versao: 2, criado_em: agoraMenos(60 * 24 * 4), itens: [{ insumo_id: insumos[12].id, quantidade: '25.0000', custo_unitario: null }] },
];

// Fichas técnicas -----------------------------------------------------------------------------------------------------

interface FichaDemo {
  versao: number;
  rendimento: number;
  itens: { insumo: string; quantidade: number; perda: number; opcional: boolean }[];
  versoes: FichaDetalhe['versoes'];
  observacao: string | null;
  vigente_de: string;
}
interface ProdutoDemo {
  eye_product_id: string;
  produto: string;
  grupo: string;
  preco: number;
  qtd: number;
  ficha: FichaDemo | null;
}
const fd = (versao: number, rendimento: number, itens: [string, number, number?, boolean?][], observacao: string | null = null): FichaDemo => ({ versao, rendimento, itens: itens.map(([insumo, quantidade, perda = 0, opcional = false]) => ({ insumo, quantidade, perda, opcional })), versoes: [], observacao, vigente_de: '' });
const produtos: ProdutoDemo[] = [
  { eye_product_id: '4001', produto: 'Cappuccino', grupo: 'CAFÉS', preco: 14, qtd: 312, ficha: fd(2, 1, [['Café em grãos', 18], ['Leite integral', 150, 5], ['Canela em pó', 1, 0, true]]) },
  { eye_product_id: '4002', produto: 'Espresso', grupo: 'CAFÉS', preco: 8, qtd: 268, ficha: fd(1, 1, [['Café em grãos', 9]]) },
  { eye_product_id: '4003', produto: 'Latte de pistache', grupo: 'CAFÉS', preco: 19, qtd: 141, ficha: fd(1, 1, [['Café em grãos', 18], ['Leite integral', 200, 5], ['Pistache sem casca', 15]]) },
  { eye_product_id: '5001', produto: 'Cinnamon roll tradicional', grupo: 'ROLLS', preco: 18, qtd: 420, ficha: fd(3, 12, [['Farinha de trigo', 1000, 2], ['Manteiga sem sal', 250], ['Açúcar refinado', 200], ['Ovos', 3], ['Canela em pó', 25], ['Cream cheese', 300]], 'Massa da noite anterior') },
  { eye_product_id: '5002', produto: 'Roll de pistache', grupo: 'ROLLS', preco: 24, qtd: 198, ficha: fd(1, 12, [['Farinha de trigo', 1000, 2], ['Manteiga sem sal', 250], ['Pistache sem casca', 240], ['Cogumelo paris', 0.001]]) },
  { eye_product_id: '5003', produto: 'Roll de chocolate', grupo: 'ROLLS', preco: 22, qtd: 156, ficha: null },
  { eye_product_id: '6001', produto: 'Bruschetta caprese', grupo: 'SALGADOS', preco: 36, qtd: 74, ficha: fd(1, 1, [['Pão de fermentação natural', 0.25], ['Tomate italiano', 120, 10], ['Muçarela', 80]]) },
  { eye_product_id: '6002', produto: 'Sanduíche de brie', grupo: 'SALGADOS', preco: 42, qtd: 61, ficha: null },
  { eye_product_id: '7001', produto: 'Cheesecake de morango', grupo: 'DOCES', preco: 26, qtd: 88, ficha: null },
  { eye_product_id: '7002', produto: 'Brownie', grupo: 'DOCES', preco: 16, qtd: 133, ficha: fd(1, 16, [['Chocolate 70%', 400], ['Manteiga sem sal', 250], ['Açúcar refinado', 300], ['Ovos', 5], ['Farinha de trigo', 120]]) },
];
/** Fichas de preparo (alvo "preparo"), pelo id do insumo de tipo preparo. */
const fichasPreparo = new Map<string, FichaDemo>([[insumoPorNome('Creme de cream cheese (preparo)').id, fd(1, 1100, [['Cream cheese', 1000], ['Açúcar refinado', 120], ['Manteiga sem sal', 50]])]]);
function datarVersoes(f: FichaDemo) {
  f.versoes = Array.from({ length: f.versao }, (_, k) => ({ versao: f.versao - k, vigente_de: agoraMenos(60 * 24 * (20 + k * 25)), vigente_ate: k === 0 ? null : agoraMenos(60 * 24 * (20 + (k - 1) * 25)), rendimento: d4(f.rendimento), criada_por: 'usuario:gerente' }));
  f.vigente_de = f.versoes[0].vigente_de;
}
produtos.forEach((p) => p.ficha && datarVersoes(p.ficha));
fichasPreparo.forEach(datarVersoes);

/** Custo da ficha a preço de hoje (fichas.custo_da_ficha): opcional não entra; sem custo → ids em `sem_custo`. */
function custoFicha(f: FichaDemo) {
  let total = 0;
  const sem: string[] = [];
  const itens = f.itens.map((x) => {
    const ins = insumoPorNome(x.insumo);
    const cu = ins.custo_medio === null ? null : Number(ins.custo_medio);
    const custo = cu === null ? null : (x.quantidade / (1 - x.perda / 100)) * cu;
    if (!x.opcional) {
      if (custo === null) sem.push(ins.id);
      else total += custo;
    }
    return { insumo_id: ins.id, insumo: ins.nome, unidade_base: ins.unidade_base, quantidade: d4(x.quantidade), perda_percentual: d2(x.perda), opcional: x.opcional, custo_unitario: cu === null ? null : d6(cu), custo: custo === null ? null : d2(custo) };
  });
  return { itens, sem, total, porcao: sem.length ? null : total / f.rendimento };
}
function fichaSaida(alvo: 'produto' | 'preparo', id: string, f: FichaDemo): FichaSalva {
  const c = custoFicha(f);
  return { id: `f9000000-0000-4000-8000-${String(Number(id.replace(/\D/g, '').slice(-6)) * 10 + f.versao).padStart(12, '0')}`, alvo, eye_product_id: alvo === 'produto' ? id : null, preparo_id: alvo === 'preparo' ? id : null, versao: f.versao, rendimento: d4(f.rendimento), vigente_de: f.vigente_de, vigente_ate: null, origem: 'painel', observacao: f.observacao, custo_receita: d2(c.total), custo_porcao: c.porcao === null ? null : d6(c.porcao), insumos_sem_custo: c.sem, itens: c.itens };
}

function fichaLista(p: ProdutoDemo, dias = 30): FichaLista {
  const c = p.ficha ? custoFicha(p.ficha) : null;
  const qtd = Math.round((p.qtd * dias) / 30);
  return {
    eye_product_id: p.eye_product_id, produto: p.produto, grupo: p.grupo, preco_pdv: d2(p.preco), receita_periodo: d2(p.preco * qtd), quantidade_periodo: d4(qtd),
    ficha: p.ficha && c ? { versao: p.ficha.versao, custo_porcao_hoje: c.porcao === null ? null : d6(c.porcao), margem_hoje_pct: c.porcao === null ? null : ((1 - c.porcao / p.preco) * 100).toFixed(1), custo_incompleto: c.sem.length > 0 } : null,
  };
}
function acharFicha(alvo: string, id: string): { f: FichaDemo | null; definir: (f: FichaDemo) => void } {
  if (alvo === 'preparo') {
    const ins = acharInsumo(id);
    if (ins.tipo !== 'preparo') throw new ErroDemo(422, 'insumo_nao_e_preparo', 'Este insumo não é um preparo.');
    return { f: fichasPreparo.get(id) ?? null, definir: (f) => fichasPreparo.set(id, f) };
  }
  const p = produtos.find((x) => x.eye_product_id === id);
  if (!p) throw new ErroDemo(404, 'nao_encontrado', 'Produto não encontrado.');
  return { f: p.ficha, definir: (f) => (p.ficha = f) };
}

// Contagem --------------------------------------------------------------------------------------------------------------

interface InventarioDemo extends Inventario {
  aberto_por: string;
}
const inventarios: InventarioDemo[] = [];
// Uma contagem antiga já fechada, para o histórico.
(() => {
  const alvo = insumos.slice(0, 5);
  inventarios.push({
    id: 'e6000000-0000-4000-8000-000000000001', escopo: 'sugerido', status: 'fechado', aberto_por: 'usuario:gerente', aberto_em: agoraMenos(60 * 24 * 12 + 40), fechado_em: agoraMenos(60 * 24 * 12), versao: 2,
    itens: alvo.map((i, k) => {
      const sistema = Number(i.saldo) + (k % 2 ? 120 : -60);
      return { insumo_id: i.id, insumo: i.nome, unidade_base: i.unidade_base, quantidade_contada: i.saldo, quantidade_sistema: d4(sistema), diferenca: d4(Number(i.saldo) - sistema), valor_diferenca: i.custo_medio ? d2((Number(i.saldo) - sistema) * Number(i.custo_medio)) : null, contado_em: agoraMenos(60 * 24 * 12 + 10) };
    }),
  });
})();
function acharInventario(id: string) {
  const i = inventarios.find((x) => x.id === id);
  if (!i) throw new ErroDemo(404, 'nao_encontrado', 'Contagem não encontrada.');
  return i;
}
const saidaInventario = ({ aberto_por: _a, ...i }: InventarioDemo): Inventario => {
  void _a;
  return i;
};
/** operacoes.sugestao: negativos, nunca contados e os mais usados (só comprados ativos). */
function sugestaoContagem() {
  const curvaA = ['Café em grãos', 'Leite integral', 'Manteiga sem sal', 'Pistache sem casca', 'Chocolate 70%'];
  const peso = (i: InsumoDemo) => [Number(i.saldo) < 0 ? 0 : 1, i.ultima_contagem_em ? 1 : 0, curvaA.includes(i.nome) ? 0 : 1];
  return insumos
    .filter((i) => i.ativo && i.tipo === 'comprado')
    .sort((a, b) => String(peso(a)).localeCompare(String(peso(b))))
    .slice(0, 12)
    .map((i) => ({ insumo_id: i.id, insumo: i.nome, unidade_base: i.unidade_base, motivo: Number(i.saldo) < 0 ? ('negativo' as const) : !i.ultima_contagem_em ? ('nunca_contado' as const) : ('curva_a' as const), ultima_contagem_em: i.ultima_contagem_em, saldo_sistema: i.saldo }));
}

// Visão Geral -----------------------------------------------------------------------------------------------------------

export function blocoEstoqueVisaoDemo() {
  montarCompras();
  const fichas = produtos.map((p) => fichaLista(p));
  const receita = fichas.reduce((s, f) => s + Number(f.receita_periodo), 0);
  const coberta = fichas.filter((f) => f.ficha).reduce((s, f) => s + Number(f.receita_periodo), 0);
  return {
    abaixo_minimo: insumos.filter((i) => i.estoque_minimo !== null && Number(i.saldo) < Number(i.estoque_minimo)).length,
    compras_em_conferencia: compras.filter((c) => c.etapa === 'aguardando_conferencia').length,
    produtos_sem_ficha: fichas.filter((f) => !f.ficha).length,
    cobertura_fichas_30d: (coberta / receita).toFixed(4),
  };
}

// Rotas -----------------------------------------------------------------------------------------------------------------

const U = '([0-9a-f-]{36})';
const pagina = <T,>(l: T[], query: URLSearchParams, padrao = 50) => {
  const lim = Number(query.get('limite') ?? padrao);
  const desl = Number(query.get('deslocamento') ?? 0);
  return { total: l.length, itens: l.slice(desl, desl + lim) };
};

// Estoque inteiro: Gerente e Proprietário (estoque.visualizar/conferir/editar na matriz do backend).
export const ROTAS_ESTOQUE: Rota[] = [
  ['GET', /^estoque\/resumo$/, GERENCIA, () => {
    montarCompras();
    const conferir = compras.filter((c) => c.etapa === 'aguardando_conferencia');
    const fichas = produtos.map((p) => fichaLista(p));
    const receita = fichas.reduce((s, f) => s + Number(f.receita_periodo), 0);
    const coberta = fichas.filter((f) => f.ficha).reduce((s, f) => s + Number(f.receita_periodo), 0);
    const ativos = insumos.filter((i) => i.ativo);
    return {
      abaixo_minimo: ativos.filter((i) => i.estoque_minimo !== null && Number(i.saldo) < Number(i.estoque_minimo)).map((i) => ({ insumo_id: i.id, insumo: i.nome, unidade_base: i.unidade_base, saldo: i.saldo, estoque_minimo: i.estoque_minimo, saldo_confiavel: i.saldo_confiavel })),
      compras_em_conferencia: { qtd: conferir.length, mais_antiga_em: conferir.map((c) => c.criado_em).sort()[0] ?? null },
      cancelamentos_pendentes: cancelamentos.filter((c) => c.situacao === 'pendente').length,
      sem_ficha_mais_vendidos: fichas.filter((f) => !f.ficha).sort((a, b) => Number(b.receita_periodo) - Number(a.receita_periodo)).slice(0, 10).map((f) => ({ eye_product_id: f.eye_product_id, produto: f.produto, receita: f.receita_periodo })),
      cobertura_fichas_30d: (coberta / receita).toFixed(4),
      altas_de_custo_90d: [
        { insumo_id: insumos[8].id, insumo: 'Pistache sem casca', unidade_base: 'g', custo_inicio: '0.172000', custo_fim: '0.214000', compras: 3, menor: '0.172000', maior: '0.214000', variacao_pct: '24.4' },
        { insumo_id: insumos[0].id, insumo: 'Café em grãos', unidade_base: 'g', custo_inicio: '0.104000', custo_fim: '0.121000', compras: 4, menor: '0.104000', maior: '0.121000', variacao_pct: '16.3' },
      ],
      saldo_confiavel: { insumos: ativos.filter((i) => i.saldo_confiavel).length, total: ativos.length },
      baixa_automatica: false,
      inicio_controle: dia(-21),
      unidade: { codigo: 'ambar', nome: 'Âmbar Brunch', teste: false },
    };
  }],
  // Insumos
  ['GET', /^estoque\/insumos$/, GERENCIA, ({ query }) => {
    const b = query.get('busca')?.toLowerCase();
    const s = query.get('situacao');
    const t = query.get('tipo');
    const c = query.get('categoria');
    const l = insumos
      .map(linhaInsumo)
      .filter((i) => (!b || i.nome.toLowerCase().includes(b) || i.codigo.toLowerCase().includes(b)) && (s === 'inativo' ? !i.ativo : i.ativo) && (s !== 'abaixo_minimo' || i.abaixo_minimo) && (s !== 'negativo' || Number(i.saldo) < 0) && (!t || i.tipo === t) && (!c || i.categoria === c))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return pagina(l, query);
  }],
  ['POST', /^estoque\/insumos$/, GERENCIA, async ({ corpo }) => {
    const e = await corpo<{ nome: string; unidade_base: UnidadeBase; categoria?: string | null; tipo?: 'comprado' | 'preparo'; controle_preparo?: 'explodir' | 'lote' | null; estoque_minimo?: string | null }>();
    if (!e.nome?.trim()) throw new ErroDemo(422, 'regra_violada', 'Informe o nome.');
    const igual = insumos.find((i) => i.nome.toLowerCase() === e.nome.trim().toLowerCase());
    if (igual) throw new ErroDemo(409, 'nome_ja_existe', `Já existe o insumo "${igual.nome}".`, { insumo_id: igual.id });
    return resposta(201, cadastroInsumo(criarInsumoDemo(e)));
  }],
  // UM objeto: o que o sistema sugeriria para a descrição (associacao.sugerir). Sem candidato: insumo_id null.
  ['GET', /^estoque\/insumos-sugestoes$/, GERENCIA, ({ query }): SugestaoInsumo => {
    const t = (query.get('texto') ?? '').toLowerCase().trim();
    if (t.length < 2) throw new ErroDemo(422, 'regra_violada', 'O texto precisa de pelo menos 2 caracteres.');
    const palavras = t.split(/\s+/).filter((p) => p.length > 2);
    const melhor = insumos
      .filter((i) => i.ativo)
      .map((i) => ({ i, n: palavras.filter((p) => i.nome.toLowerCase().includes(p)).length }))
      .filter((x) => x.n > 0 || x.i.nome.toLowerCase().includes(t))
      .sort((a, b) => b.n - a.n)[0];
    if (!melhor) return { insumo_id: null, insumo: null, unidade_base: null, confianca: 'nenhuma', motivo: null, fator: null, alertas: [] };
    return { insumo_id: melhor.i.id, insumo: melhor.i.nome, unidade_base: melhor.i.unidade_base, confianca: melhor.n >= 2 ? 'alta' : 'media', motivo: `nome_parecido (${(0.6 + melhor.n * 0.15).toFixed(2)})`, fator: null, alertas: [] };
  }],
  ['GET', new RegExp(`^estoque/insumos/${U}$`), GERENCIA, ({ params }) => {
    const i = acharInsumo(params[0]);
    const usado_em = [
      ...produtos.filter((p) => p.ficha?.itens.some((x) => x.insumo === i.nome)).map((p) => ({ alvo: 'produto' as const, eye_product_id: p.eye_product_id, preparo_id: null, nome: p.produto, quantidade: d4(p.ficha!.itens.find((x) => x.insumo === i.nome)!.quantidade) })),
      ...[...fichasPreparo].filter(([, f]) => f.itens.some((x) => x.insumo === i.nome)).map(([id, f]) => ({ alvo: 'preparo' as const, eye_product_id: null, preparo_id: id, nome: acharInsumo(id).nome, quantidade: d4(f.itens.find((x) => x.insumo === i.nome)!.quantidade) })),
    ];
    return { ...cadastroInsumo(i), saldo: i.saldo, custo_medio: i.custo_medio, saldo_confiavel: i.saldo_confiavel, motivo_nao_confiavel: i.motivo_nao_confiavel, precos: [...i.precos].reverse().slice(0, 12), usado_em };
  }],
  ['PATCH', new RegExp(`^estoque/insumos/${U}$`), GERENCIA, async (c) => {
    const i = acharInsumo(c.params[0]);
    const e = await c.corpo<Record<string, unknown> & { versao: number }>();
    if (Number(e.versao) !== i.versao) throw new ErroDemo(409, 'conflito_versao', 'Outra pessoa alterou este insumo.', { versao: i.versao });
    if (typeof e.nome === 'string') {
      const outro = insumos.find((x) => x.id !== i.id && x.nome.toLowerCase() === String(e.nome).trim().toLowerCase());
      if (outro) throw new ErroDemo(409, 'nome_ja_existe', `Já existe o insumo "${outro.nome}".`, { insumo_id: outro.id });
    }
    // Como o backend: campos nulos são descartados (não apagam o valor).
    for (const k of ['nome', 'categoria', 'estoque_minimo', 'prazo_reposicao_dias', 'ativo', 'controle_preparo'] as const) if (e[k] !== undefined && e[k] !== null) (i as unknown as Record<string, unknown>)[k] = k === 'estoque_minimo' ? d4(Number(e[k])) : e[k];
    i.versao++;
    return cadastroInsumo(i);
  }],
  ['GET', new RegExp(`^estoque/insumos/${U}/movimentos$`), GERENCIA, ({ params, query }) => {
    const i = acharInsumo(params[0]);
    const antes = query.get('antes_de') ? Number(query.get('antes_de')) : Infinity;
    const lim = Number(query.get('limite') ?? 50);
    const l = i.movimentos.filter((m) => m.id < antes);
    return { itens: l.slice(0, lim), proximo: l.length > lim ? l[lim - 1].id : null };
  }],
  ['POST', /^estoque\/perdas$/, GERENCIA, async ({ corpo }) => {
    const e = await corpo<{ insumo_id: string; quantidade: string; motivo: string; observacao?: string }>();
    const i = acharInsumo(e.insumo_id);
    const q = Number(e.quantidade);
    if (!(q > 0)) throw new ErroDemo(422, 'regra_violada', 'Informe uma quantidade maior que zero.');
    return resposta(201, movimentar(i, 'perda', -q, null, e.motivo));
  }],
  // Contagem
  ['GET', /^estoque\/inventarios\/sugestao$/, GERENCIA, () => sugestaoContagem()],
  ['GET', /^estoque\/inventarios$/, GERENCIA, ({ query }): InventarioResumo[] => {
    const s = query.get('status');
    return inventarios
      .filter((i) => !s || i.status === s)
      .sort((a, b) => b.aberto_em.localeCompare(a.aberto_em))
      .slice(0, Number(query.get('limite') ?? 20))
      .map((i) => ({ id: i.id, escopo: i.escopo, status: i.status, aberto_por: i.aberto_por, aberto_em: i.aberto_em, fechado_em: i.fechado_em, itens: i.itens.length }));
  }],
  ['POST', /^estoque\/inventarios$/, GERENCIA, async ({ corpo }) => {
    const e = await corpo<{ escopo?: 'sugerido' | 'lista' | 'total'; insumos?: string[] | null }>();
    const aberto = inventarios.find((x) => x.status === 'aberto');
    if (aberto) throw new ErroDemo(409, 'inventario_aberto', 'Já existe uma contagem aberta: termine ou cancele antes.', { inventario_id: aberto.id });
    const escopo = e.escopo ?? 'sugerido';
    if (escopo === 'lista' && !e.insumos?.length) throw new ErroDemo(422, 'regra_violada', 'Escolha os insumos a contar.');
    const ids = escopo === 'total' ? insumos.filter((i) => i.ativo).map((i) => i.id) : escopo === 'lista' ? [...new Set(e.insumos!)] : sugestaoContagem().map((s) => s.insumo_id);
    const inv: InventarioDemo = {
      id: uuid(), escopo, status: 'aberto', aberto_por: 'usuario:demo', aberto_em: new Date().toISOString(), fechado_em: null, versao: 1,
      itens: ids.map((id) => acharInsumo(id)).map((i) => ({ insumo_id: i.id, insumo: i.nome, unidade_base: i.unidade_base, quantidade_contada: null, quantidade_sistema: null, diferenca: null, valor_diferenca: null, contado_em: null })),
    };
    inventarios.push(inv);
    return resposta(201, saidaInventario(inv));
  }],
  ['GET', new RegExp(`^estoque/inventarios/${U}$`), GERENCIA, ({ params }) => saidaInventario(acharInventario(params[0]))],
  ['PUT', new RegExp(`^estoque/inventarios/${U}/itens/${U}$`), GERENCIA, async ({ params, corpo }) => {
    const inv = acharInventario(params[0]);
    if (inv.status !== 'aberto') throw new ErroDemo(409, 'inventario_fechado', 'Contagem já fechada.');
    const q = Number((await corpo<{ quantidade: string }>()).quantidade);
    if (!(q >= 0)) throw new ErroDemo(422, 'regra_violada', 'Quantidade contada não pode ser negativa.');
    let it = inv.itens.find((x) => x.insumo_id === params[1]);
    // Como o backend: insumo fora da lista entra na contagem ao ser contado.
    if (!it) {
      const ins = acharInsumo(params[1]);
      it = { insumo_id: ins.id, insumo: ins.nome, unidade_base: ins.unidade_base, quantidade_contada: null, quantidade_sistema: null, diferenca: null, valor_diferenca: null, contado_em: null };
      inv.itens.push(it);
    }
    it.quantidade_contada = d4(q);
    it.contado_em = new Date().toISOString();
    return { insumo_id: it.insumo_id, quantidade_contada: it.quantidade_contada, contado_em: it.contado_em };
  }],
  ['POST', new RegExp(`^estoque/inventarios/${U}/fechar$`), GERENCIA, ({ params }): FechamentoInventario => {
    const inv = acharInventario(params[0]);
    if (inv.status === 'fechado') throw new ErroDemo(409, 'inventario_fechado', 'Contagem já fechada.');
    if (inv.status !== 'aberto') throw new ErroDemo(409, 'inventario_cancelado', 'Contagem cancelada.');
    const contados = inv.itens.filter((i) => i.quantidade_contada !== null);
    if (!contados.length) throw new ErroDemo(422, 'nada_contado', 'Nenhum item foi contado.');
    let total = 0;
    const ajustes = contados.map((it) => {
      const ins = acharInsumo(it.insumo_id);
      const sistema = Number(ins.saldo);
      const dif = Number(it.quantidade_contada) - sistema;
      const medio = ins.custo_medio === null ? null : Number(ins.custo_medio);
      if (dif) movimentar(ins, 'ajuste_inventario', dif, null, 'contagem');
      ins.ultima_contagem_em = new Date().toISOString();
      if (ins.motivo_nao_confiavel === 'nunca_contado' || ins.motivo_nao_confiavel === 'ficou_negativo' || ins.motivo_nao_confiavel === 'sem_movimento') ins.motivo_nao_confiavel = 'baixa_desligada';
      const valor = medio === null ? null : d2(dif * medio);
      if (valor !== null) total += Number(valor);
      Object.assign(it, { quantidade_sistema: d4(sistema), diferenca: d4(dif), valor_diferenca: valor });
      return { insumo_id: it.insumo_id, insumo: it.insumo, unidade_base: it.unidade_base, sistema: d4(sistema), contado: it.quantidade_contada!, diferenca: d4(dif), valor };
    });
    inv.status = 'fechado';
    inv.fechado_em = new Date().toISOString();
    inv.versao++;
    return { inventario_id: inv.id, ajustes, valor_total: d2(total), nao_contados: inv.itens.length - contados.length };
  }],
  ['POST', new RegExp(`^estoque/inventarios/${U}/cancelar$`), GERENCIA, ({ params }) => {
    const inv = acharInventario(params[0]);
    if (inv.status !== 'aberto') throw new ErroDemo(409, 'inventario_fechado', 'Só uma contagem aberta pode ser cancelada.');
    inv.status = 'cancelado';
    inv.versao++;
    return { id: inv.id, status: inv.status };
  }],
  // Compras
  ['GET', /^estoque\/compras$/, GERENCIA, ({ query }) => {
    montarCompras();
    const etapa = query.get('etapa');
    const l = compras.filter((c) => !etapa || c.etapa === etapa).sort((a, b) => b.criado_em.localeCompare(a.criado_em)).map(listaCompra);
    return pagina(l, query);
  }],
  ['POST', /^estoque\/compras$/, GERENCIA, () => {
    montarCompras();
    const c = novaLeitura('painel');
    return resposta(202, { id: c.id, etapa: c.etapa, ja_existia: false });
  }],
  ['POST', /^estoque\/compras\/manual$/, GERENCIA, async ({ corpo }) => {
    montarCompras();
    const e = await corpo<{ fornecedor_nome?: string | null; fornecedor_documento?: string | null; emitida_em: string; valor_total: string; desconto?: string; itens: { descricao: string; quantidade: string; unidade: string; valor_total: string }[] }>();
    if (!(Number(e.valor_total) > 0)) throw new ErroDemo(422, 'regra_violada', 'Informe o valor total.');
    const c = compraBase({
      id: uuid(), etapa: 'aguardando_conferencia', origem: 'painel', fonte_leitura: 'manual', fornecedor: e.fornecedor_nome ? { id: uuid(), nome: e.fornecedor_nome, documento: e.fornecedor_documento ?? null } : null,
      fornecedor_lido: { documento: e.fornecedor_documento ?? null, nome: e.fornecedor_nome ?? null }, emitida_em: instante(e.emitida_em || hojeFortaleza()), itens: itensManuais(e.itens), criado_em: new Date().toISOString(), etapas: [{ etapa: 'aguardando_conferencia', em: new Date().toISOString() }],
    });
    conferirTotais(c, Number(e.valor_total), Number(e.desconto ?? 0));
    recalcular(c);
    compras.unshift(c);
    return resposta(201, saidaCompra(c));
  }],
  ['GET', new RegExp(`^estoque/compras/${U}$`), GERENCIA, ({ params }) => {
    const c = acharCompra(params[0]);
    avancar(c);
    return saidaCompra(c);
  }],
  ['PATCH', new RegExp(`^estoque/compras/${U}/itens/${U}$`), GERENCIA, async ({ params, corpo }) => {
    const c = acharCompra(params[0]);
    if (c.etapa !== 'aguardando_conferencia') throw new ErroDemo(409, 'compra_fora_de_conferencia', 'A compra não está em conferência.');
    const it = c.itens.find((x) => x.id === params[1]);
    if (!it) throw new ErroDemo(404, 'nao_encontrado', 'Item não encontrado.');
    const e = await corpo<{ versao: number; insumo_id?: string; novo_insumo?: { nome: string; unidade_base: UnidadeBase; categoria?: string | null }; fator?: string; quantidade_base?: string; nao_estoque?: string; ignorar?: boolean }>();
    if (Number(e.versao) !== it.versao) throw new ErroDemo(409, 'conflito_versao', 'O item mudou. Recarregue.', { versao: it.versao });
    if (e.ignorar) it.situacao = 'ignorado';
    else if (e.nao_estoque) {
      it.situacao = 'nao_estoque';
      it.categoria_despesa = e.nao_estoque;
    } else {
      let ins: InsumoDemo | undefined;
      if (e.novo_insumo) ins = insumos.find((i) => i.nome.toLowerCase() === e.novo_insumo!.nome.trim().toLowerCase()) ?? criarInsumoDemo(e.novo_insumo);
      else ins = acharInsumo(String(e.insumo_id ?? it.sugestao?.insumo_id));
      const mesmo = it.sugestao?.insumo_id === ins.id;
      const q = Number(it.quantidade);
      let fator = e.fator !== undefined && e.fator !== null ? Number(e.fator) : e.quantidade_base ? Number(e.quantidade_base) / q : mesmo && it.sugestao?.fator ? Number(it.sugestao.fator) : null;
      if (fator === null) {
        const un = it.unidade.toUpperCase();
        if (un === 'KG' && ins.unidade_base === 'g') fator = 1000;
        else if (un === 'L' && ins.unidade_base === 'ml') fator = 1000;
        else if (un === 'UN' && ins.unidade_base === 'un') fator = 1;
        else throw new ErroDemo(422, 'conversao_ambigua', `Informe quanto vem em 1 ${it.unidade} (em ${ins.unidade_base}).`, { unidade: it.unidade, unidade_base: ins.unidade_base });
      }
      if (!(fator > 0)) throw new ErroDemo(422, 'regra_violada', 'A conversão precisa ser maior que zero.');
      const qb = q * fator;
      it.sugestao = { insumo_id: ins.id, insumo: ins.nome, unidade_base: ins.unidade_base, confianca: 'alta', motivo: 'confirmado_pela_equipe', fator: d4(fator), quantidade_base: d4(qb), custo_unitario_base: d6(Number(it.valor_liquido) / qb) };
      it.situacao = 'confirmado';
      it.alertas = it.alertas.filter((a) => a !== 'preco_fora_do_padrao' || !e.fator);
    }
    it.versao++;
    c.versao++;
    recalcular(c);
    return saidaCompra(c);
  }],
  ['PUT', new RegExp(`^estoque/compras/${U}/manual$`), GERENCIA, async ({ params, corpo }) => {
    const c = acharCompra(params[0]);
    const e = await corpo<{ versao: number; fornecedor_nome?: string | null; fornecedor_documento?: string | null; emitida_em: string; valor_total: string; desconto?: string; itens: { descricao: string; quantidade: string; unidade: string; valor_total: string }[] }>();
    if (Number(e.versao) !== c.versao) throw new ErroDemo(409, 'conflito_versao', 'A compra mudou. Recarregue.', { versao: c.versao });
    if (c.etapa !== 'aguardando_conferencia' || c.itens.length) throw new ErroDemo(409, 'compra_ja_lida', 'Só uma compra sem itens lidos aceita preenchimento manual.');
    c.itens = itensManuais(e.itens);
    if (e.fornecedor_nome && !c.fornecedor) c.fornecedor = { id: uuid(), nome: e.fornecedor_nome, documento: null };
    if (e.emitida_em) c.emitida_em = instante(e.emitida_em);
    conferirTotais(c, Number(e.valor_total || c.totais.total), Number(e.desconto ?? 0));
    c.aviso = null;
    c.versao++;
    recalcular(c);
    return saidaCompra(c);
  }],
  ['POST', new RegExp(`^estoque/compras/${U}/confirmar$`), GERENCIA, async ({ params, corpo }) => {
    const c = acharCompra(params[0]);
    const resultado = (ja: boolean) => ({ compra_id: c.id, etapa: c.etapa, despesa_id: c.despesa.despesa_id, movimentos: c.itens.filter((i) => i.situacao === 'confirmado').length, ja_estava_confirmada: ja });
    if (c.etapa === 'confirmada') return resultado(true);
    const e = await corpo<{ versao: number; despesa?: { vincular_despesa_id?: string | null; paga_em?: string | null; forma?: string | null; parcelas?: unknown[] | null; criar_nova?: boolean; motivo_nova?: string | null }; motivo_divergencia?: string | null }>();
    if (c.etapa !== 'aguardando_conferencia') throw new ErroDemo(409, 'compra_fora_de_conferencia', 'A compra não está em conferência.', { etapa: c.etapa });
    if (Number(e.versao) !== c.versao) throw new ErroDemo(409, 'conflito_versao', 'A compra mudou. Recarregue.', { versao: c.versao });
    // Demo só com Gerente/Proprietário (estoque.editar): podem aceitar a nota que não fecha, com motivo.
    if (e.motivo_divergencia && c.conferencia && !c.conferencia.ok) {
      exigirMotivo(e.motivo_divergencia);
      c.divergencia_aceita = String(e.motivo_divergencia);
      recalcular(c);
    }
    if (c.pendencias.length) throw new ErroDemo(409, 'pendencias', 'Ainda há pendências na conferência.', { pendencias: c.pendencias });
    const d = e.despesa ?? {};
    const forte = c.despesa.candidatas.find((x) => x.forca === 'forte');
    if (!c.despesa_origem_id && forte && !d.vincular_despesa_id && !d.criar_nova) throw new ErroDemo(409, 'despesa_ja_registrada', 'Já existe uma despesa registrada que parece ser esta compra.', { candidata: forte });
    if (d.criar_nova) exigirMotivo(d.motivo_nova);
    for (const it of c.itens) {
      if ((it.situacao === 'confirmado' || it.situacao === 'sugerido') && it.sugestao?.insumo_id && it.sugestao.quantidade_base) {
        movimentar(acharInsumo(it.sugestao.insumo_id), 'entrada_compra', Number(it.sugestao.quantidade_base), Number(it.sugestao.custo_unitario_base), null);
        it.situacao = 'confirmado';
      }
    }
    c.despesa.despesa_id = d.vincular_despesa_id ?? c.despesa_origem_id ?? uuid();
    c.etapa = 'confirmada';
    c.etapa_painel = 'confirmada';
    c.confirmada_em = new Date().toISOString();
    c.etapas.push({ etapa: 'confirmada', em: c.confirmada_em });
    c.versao++;
    recalcular(c);
    return resultado(false);
  }],
  ['POST', new RegExp(`^estoque/compras/${U}/cancelar$`), GERENCIA, async ({ params, corpo }) => {
    const c = acharCompra(params[0]);
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    if (c.etapa === 'cancelada') throw new ErroDemo(409, 'compra_cancelada', 'A compra já está cancelada.');
    if (c.etapa === 'confirmada' && c.despesa.despesa_id === DESPESA_JULIA_LATICINIOS) throw new ErroDemo(409, 'despesa_paga', 'A despesa desta compra já foi paga: estorne o pagamento no Financeiro antes de cancelar.');
    if (c.etapa === 'confirmada') for (const it of c.itens) if (it.situacao === 'confirmado' && it.sugestao?.insumo_id && it.sugestao.quantidade_base) movimentar(acharInsumo(it.sugestao.insumo_id), 'estorno', -Number(it.sugestao.quantidade_base), Number(it.sugestao.custo_unitario_base), 'compra cancelada');
    c.etapa = 'cancelada';
    c.etapa_painel = 'cancelada';
    c.etapa_detalhe = motivo;
    c.cancelada_em = new Date().toISOString();
    c.cancelada_motivo = motivo;
    c.etapas.push({ etapa: 'cancelada', em: c.cancelada_em, detalhe: motivo });
    c.versao++;
    recalcular(c);
    return saidaCompra(c);
  }],
  // Ler de novo: só falhou ou em conferência sem itens; nasce uma compra nova do mesmo arquivo (a antiga é cancelada).
  ['POST', new RegExp(`^estoque/compras/${U}/reprocessar$`), GERENCIA, ({ params }) => {
    const c = acharCompra(params[0]);
    if (!(c.etapa === 'falhou' || c.etapa === 'aguardando_conferencia') || c.itens.length) throw new ErroDemo(409, 'nao_reprocessavel', 'Só compra que falhou ou ficou sem itens pode ser lida de novo.');
    if (c.etapa !== 'falhou') {
      c.etapa = 'cancelada';
      c.etapa_painel = 'cancelada';
      c.cancelada_em = new Date().toISOString();
      c.cancelada_motivo = 'reprocessada';
      c.etapas.push({ etapa: 'cancelada', em: c.cancelada_em, detalhe: 'reprocessada' });
      c.versao++;
    }
    const nova = novaLeitura(c.origem, { id: c.arquivo_id, mime: c.arquivo_mime });
    return resposta(202, { id: nova.id, etapa: nova.etapa, substitui: c.id });
  }],
  // Cancelamentos de venda depois da baixa (sem `situacao`, o backend usa "pendente")
  ['GET', /^estoque\/cancelamentos$/, GERENCIA, ({ query }) => {
    const s = query.get('situacao') ?? 'pendente';
    return pagina(cancelamentos.filter((c) => c.situacao === s).sort((a, b) => a.criado_em.localeCompare(b.criado_em)), query);
  }],
  ['POST', new RegExp(`^estoque/cancelamentos/${U}/resolver$`), GERENCIA, async ({ params, corpo }) => {
    const c = cancelamentos.find((x) => x.id === params[0]);
    if (!c) throw new ErroDemo(404, 'nao_encontrado', 'Pendência de cancelamento não encontrada.');
    const e = await corpo<{ versao: number; decisao: DecisaoCancelamento; observacao?: string }>();
    if (!['nao_produzido', 'produzido_descartado', 'produzido_aproveitado', 'nao_apurado'].includes(e.decisao)) throw new ErroDemo(422, 'regra_violada', 'Decisão inválida.');
    if (c.situacao === e.decisao) return c;
    if (c.situacao !== 'pendente') throw new ErroDemo(409, 'ja_resolvido', 'Esta pendência já foi resolvida.', { situacao: c.situacao });
    if (Number(e.versao) !== c.versao) throw new ErroDemo(409, 'conflito_versao', 'A pendência mudou (a venda foi alterada no PDV). Recarregue.', { versao: c.versao });
    // Mesma tabela do backend: com baixa, não produzido/aproveitado = estorno; descartado = estorno + perda; não apurado = nada.
    if (e.decisao !== 'nao_apurado') {
      for (const it of c.itens) {
        const ins = acharInsumo(it.insumo_id);
        const custo = it.custo_unitario === null ? null : Number(it.custo_unitario);
        if (c.baixa_lancada) movimentar(ins, 'estorno_consumo', Number(it.quantidade), custo, 'venda cancelada');
        if (e.decisao === 'produzido_descartado') movimentar(ins, 'perda', -Number(it.quantidade), custo, 'produzido e descartado');
      }
    }
    c.situacao = e.decisao;
    c.observacao = e.observacao ?? null;
    c.resolvido_por = 'usuario:demo';
    c.resolvido_em = new Date().toISOString();
    c.versao++;
    return c;
  }],
  // Arquivos da demonstração (notas e comprovantes desenhados em SVG): só os ids das compras fictícias acima.
  // Ids fora do formato UUID de propósito: não colidem com a rota de arquivos da demo do Financeiro.
  ['GET', /^arquivos\/(demo-doc-[\w-]+)\/url$/, TODOS, ({ params }) => {
    montarCompras();
    const c = compras.find((x) => x.arquivo_id === params[0]);
    const mime = c?.arquivo_mime ?? 'image/svg+xml';
    return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(desenharDocumento(c))}`, expira_em: new Date(Date.now() + 300_000).toISOString(), mime: mime === 'application/xml' ? 'application/xml' : 'image/svg+xml' };
  }],
  // Fichas técnicas
  ['GET', /^estoque\/fichas$/, GERENCIA, ({ query }) => {
    const s = query.get('situacao') ?? 'todas';
    const dias = Number(query.get('dias') ?? 30);
    return produtos.map((p) => fichaLista(p, dias)).filter((f) => s === 'todas' || (s === 'sem_ficha' ? !f.ficha : !!f.ficha)).sort((a, b) => Number(b.receita_periodo) - Number(a.receita_periodo));
  }],
  ['GET', /^estoque\/fichas\/(produto|preparo)\/([\w-]+)$/, GERENCIA, ({ params }): FichaDetalhe => {
    const { f } = acharFicha(params[0], params[1]);
    if (!f) throw new ErroDemo(404, 'sem_ficha', 'Sem ficha técnica.');
    return { ...fichaSaida(params[0] as 'produto' | 'preparo', params[1], f), versoes: f.versoes };
  }],
  ['PUT', /^estoque\/fichas\/(produto|preparo)\/([\w-]+)$/, GERENCIA, async ({ params, corpo }): Promise<FichaSalva> => {
    const alvo = params[0] as 'produto' | 'preparo';
    const { f: atual, definir } = acharFicha(alvo, params[1]);
    const e = await corpo<{ rendimento: string; itens: { insumo_id: string; quantidade: string; perda_percentual?: string; opcional?: boolean }[]; observacao?: string }>();
    if (!(Number(e.rendimento) > 0)) throw new ErroDemo(422, 'regra_violada', 'O rendimento precisa ser maior que zero.');
    if (!e.itens?.length) throw new ErroDemo(422, 'regra_violada', 'Informe pelo menos um ingrediente.');
    if (new Set(e.itens.map((i) => i.insumo_id)).size !== e.itens.length) throw new ErroDemo(422, 'ingrediente_repetido', 'Ingrediente repetido na ficha.');
    if (alvo === 'preparo' && e.itens.some((i) => i.insumo_id === params[1])) throw new ErroDemo(422, 'ciclo_na_ficha', 'O preparo não pode entrar na própria ficha.');
    const versao = (atual?.versao ?? 0) + 1;
    const agora = new Date().toISOString();
    const versoes = [{ versao, vigente_de: agora, vigente_ate: null, rendimento: d4(Number(e.rendimento)), criada_por: 'usuario:demo' }, ...(atual?.versoes ?? []).map((v, k) => (k === 0 ? { ...v, vigente_ate: agora } : v))];
    const nova: FichaDemo = { versao, rendimento: Number(e.rendimento), itens: e.itens.map((x) => ({ insumo: acharInsumo(x.insumo_id).nome, quantidade: Number(x.quantidade), perda: Number(x.perda_percentual ?? 0), opcional: !!x.opcional })), versoes, observacao: e.observacao ?? null, vigente_de: agora };
    definir(nova);
    return fichaSaida(alvo, params[1], nova);
  }],
  // Análises
  ['GET', /^estoque\/analises\/produtos$/, GERENCIA, ({ query }) => {
    const ord = query.get('ordenar') ?? 'receita';
    const l = produtos.map((p) => {
      const f = fichaLista(p);
      const custo = f.ficha?.custo_porcao_hoje ? Number(f.ficha.custo_porcao_hoje) : null;
      const receita = p.preco * p.qtd * 0.97;
      return { eye_product_id: p.eye_product_id, produto: p.produto, grupo: p.grupo, quantidade: d4(p.qtd), receita_liquida: d2(receita), custo_realizado: custo === null ? null : d2(custo * p.qtd), margem_realizada_pct: custo === null ? null : ((1 - (custo * p.qtd) / receita) * 100).toFixed(1), contribuicao: custo === null ? null : d2(receita - custo * p.qtd), tem_ficha: !!p.ficha, preco_pdv: d2(p.preco), custo_porcao_hoje: f.ficha?.custo_porcao_hoje ?? null, margem_hoje_pct: f.ficha?.margem_hoje_pct ?? null };
    });
    const chave = (x: (typeof l)[number]) => Number(ord === 'quantidade' ? x.quantidade : ord === 'contribuicao' ? x.contribuicao ?? -1e12 : ord === 'margem' ? x.margem_realizada_pct ?? -1e12 : x.receita_liquida);
    return l.sort((a, b) => chave(b) - chave(a));
  }],
  ['GET', /^estoque\/analises\/cmv$/, GERENCIA, () => ({
    fonte: 'indisponivel', valor: null,
    motivos_indisponivel: [
      { fonte: 'por_inventario', codigo: 'sem_inventario', texto: 'Sem contagem total fechada (com custo conhecido) perto do início e do fim do mês.' },
      { fonte: 'teorico', codigo: 'cobertura_insuficiente', texto: 'Fichas técnicas cobrem 61% da receita (mínimo 90%).' },
    ],
    alternativas: { por_inventario: null, teorico: null },
    cobertura_fichas: blocoEstoqueVisaoDemo().cobertura_fichas_30d, vendas_validas: 1834, vendas_processadas: 0, teorico_incompleto: true,
    indicadores: { compras_estoque_mes: '9284.30', compras_estoque_sobre_receita_pct: '19.3', aviso: 'Compras do mês não são CMV: compra não é consumo.' },
    receita_produtos: '48210.00', divergencia_inventario_teorico: null, cmv_pct: null,
  })],
  ['GET', /^estoque\/analises\/cardapio$/, GERENCIA, ({ query }) => {
    const de = query.get('de') ?? dia(-29);
    const ate = query.get('ate') ?? hojeFortaleza();
    const n = Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000) + 1;
    const itens = produtos.map((p) => {
      const f = fichaLista(p);
      const custo = f.ficha?.custo_porcao_hoje ? Number(f.ficha.custo_porcao_hoje) : null;
      const completo = !!f.ficha && !f.ficha.custo_incompleto;
      const margemU = custo === null ? null : p.preco - custo;
      return {
        eye_product_id: p.eye_product_id, produto: p.produto, grupo: p.grupo, quantidade: d4(p.qtd), receita: d2(p.preco * p.qtd), preco_medio_efetivo: d2(p.preco), custo_estimado_unitario: custo === null ? null : d6(custo),
        margem_estimada_unitaria: margemU === null ? null : d2(margemU), margem_estimada_pct: margemU === null ? null : ((margemU / p.preco) * 100).toFixed(1), contribuicao_estimada_total: margemU === null ? null : d2(margemU * p.qtd),
        custo_completo: completo, dias_com_venda: Math.min(n, 26), tem_ficha: !!p.ficha, motivo_sem_classificacao: (!p.ficha ? 'sem_ficha' : !completo ? 'custo_incompleto' : null) as string | null,
        evolucao: { quantidade_anterior: d4(Math.round(p.qtd * 0.9)), quantidade_variacao_pct: '11.1', custo_unitario_anterior: custo === null ? null : d6(custo * 0.96), custo_variacao_pct: custo === null ? null : '4.2', margem_pct_anterior: margemU === null ? null : (((margemU + custo! * 0.04) / p.preco) * 100).toFixed(1), preco_variacao_pct: '0.0' },
        classificacao: null as string | null, sugestao: null as string | null,
      };
    });
    const grupos: Record<string, { produtos: number; limiar_quantidade: string; limiar_margem_unitaria: string }> = {};
    for (const g of new Set(itens.map((i) => i.grupo))) {
      const doGrupo = itens.filter((i) => i.grupo === g && !i.motivo_sem_classificacao);
      if (doGrupo.length < 2) {
        doGrupo.forEach((i) => (i.motivo_sem_classificacao = 'sem_comparacao_no_grupo'));
        continue;
      }
      const tq = doGrupo.reduce((s, i) => s + Number(i.quantidade), 0);
      const lq = (tq / doGrupo.length) * 0.7;
      const lm = doGrupo.reduce((s, i) => s + Number(i.contribuicao_estimada_total), 0) / tq;
      grupos[g] = { produtos: doGrupo.length, limiar_quantidade: d4(lq), limiar_margem_unitaria: d2(lm) };
      for (const i of doGrupo) {
        const pop = Number(i.quantidade) >= lq;
        const mar = Number(i.margem_estimada_unitaria) >= lm;
        i.classificacao = pop ? (mar ? 'alta_venda_alta_margem' : 'alta_venda_margem_baixa') : mar ? 'baixa_venda_margem_alta' : 'baixa_venda_margem_baixa';
        i.sugestao = pop && mar ? 'Manter: proteger a ficha e a disponibilidade dos insumos.' : pop ? 'Investigar custo e porcionamento; avaliar o preço (simulação).' : mar ? 'Investigar exposição e posição no cardápio; a margem é boa.' : 'Investigar se vale manter no cardápio (vende pouco e margem baixa).';
      }
    }
    itens.sort((a, b) => Number(b.receita) - Number(a.receita));
    const resumo: Record<string, number> = {};
    for (const i of itens) {
      const k = i.classificacao ?? `sem_classificacao:${i.motivo_sem_classificacao}`;
      resumo[k] = (resumo[k] ?? 0) + 1;
    }
    return {
      periodo: { de, ate }, periodo_comparado: { de: dia(-n, de), ate: dia(-1, de) },
      criterio: { popularidade: 'quantidade ≥ 70% da média do grupo', margem: 'contribuição unitária ≥ média ponderada do grupo', minimo_vendas: Number(query.get('minimo_vendas') ?? 10), grupos, aviso: 'Margem de contribuição ESTIMADA (preço − ingredientes da ficha de hoje), não lucro. Nenhum preço é alterado.' },
      resumo, itens,
    };
  }],
  ['GET', /^estoque\/analises\/fornecedores$/, GERENCIA, ({ query }) => {
    const forn = (fornecedor: string, compras: number, medio: string, menor: string, ultimo: string, ultima: string, qb: string) => ({ fornecedor_id: uuid(), fornecedor, compras, quantidade_base: qb, preco_medio: medio, menor_preco: menor, ultimo_preco: ultimo, ultima_compra: ultima, embalagens: ['UN × 500.0000'], com_desconto: false, frete_na_nota_sem_rateio: false });
    return {
      periodo: { de: query.get('de'), ate: query.get('ate') },
      itens: [
        { insumo_id: insumos[2].id, insumo: 'Manteiga sem sal', unidade_base: 'g', compras: 3, compras_sem_preco_normalizado: 0, comparavel: true, motivo: null, ultimo_preco: '0.041200', menor_preco_recente: '0.038000', variacao_ultima_compra_pct: '8.4', menor_preco_medio: { fornecedor: 'Laticínios Serra Azul', preco_medio: '0.039600' }, economia_ilustrativa: '10.60', evolucao: [{ dia: dia(-12), fornecedor: 'Mercadinho São Luiz', preco: '0.044900' }, { dia: dia(-6), fornecedor: 'Laticínios Serra Azul', preco: '0.038000' }, { dia: dia(-1), fornecedor: 'Laticínios Serra Azul', preco: '0.041200' }], fornecedores: [forn('Laticínios Serra Azul', 2, '0.039600', '0.038000', '0.041200', dia(-1), '4000.0000'), forn('Mercadinho São Luiz', 1, '0.044900', '0.044900', '0.044900', dia(-12), '2000.0000')] },
        { insumo_id: insumos[0].id, insumo: 'Café em grãos', unidade_base: 'g', compras: 4, compras_sem_preco_normalizado: 0, comparavel: true, motivo: null, ultimo_preco: '0.121000', menor_preco_recente: '0.112000', variacao_ultima_compra_pct: '3.4', menor_preco_medio: { fornecedor: 'Empório Grão Fino', preco_medio: '0.116500' }, economia_ilustrativa: '11.50', evolucao: [], fornecedores: [forn('Empório Grão Fino', 3, '0.116500', '0.112000', '0.121000', dia(-4), '9000.0000'), forn('Torrefação Sertão', 1, '0.128000', '0.128000', '0.128000', dia(-25), '1000.0000')] },
        { insumo_id: insumos[8].id, insumo: 'Pistache sem casca', unidade_base: 'g', compras: 2, compras_sem_preco_normalizado: 0, comparavel: false, motivo: 'um_fornecedor_so', ultimo_preco: '0.219000', menor_preco_recente: '0.214000', variacao_ultima_compra_pct: '2.3', menor_preco_medio: null, economia_ilustrativa: null, evolucao: [], fornecedores: [forn('Empório Grão Fino', 2, '0.216500', '0.214000', '0.219000', dia(-4), '2000.0000')] },
        { insumo_id: insumos[13].id, insumo: 'Morango', unidade_base: 'g', compras: 1, compras_sem_preco_normalizado: 1, comparavel: false, motivo: 'sem_preco_normalizado', fornecedores: [] },
      ],
      aviso: 'Preço por unidade-base do MESMO insumo confirmado (embalagens convertidas). Menor preço não é melhor fornecedor: qualidade, prazo e frete não entram na conta.',
    };
  }],
  ['GET', /^estoque\/analises\/ruptura$/, GERENCIA, () => ({
    disponivel: false, tipo: 'previsao', dia: hojeFortaleza(), itens: [],
    motivos: [
      { codigo: 'baixa_real_desligada', texto: 'A baixa automática pelas vendas está desligada: o saldo não desconta o que foi vendido.' },
      { codigo: 'historico_curto', texto: 'Menos de 14 dias de consumo controlado.' },
    ],
  })],
  ['GET', /^estoque\/analises\/reposicao$/, GERENCIA, ({ query }) => ({
    disponivel: false, tipo: 'previsao', dia: hojeFortaleza(), itens: [], dias_cobertura: Number(query.get('dias_cobertura') ?? 7),
    motivos: [{ codigo: 'baixa_real_desligada', texto: 'A baixa automática pelas vendas está desligada: o saldo não desconta o que foi vendido.' }],
  })],
];

/** Desenho simples de um cupom/comprovante para a área "documento original" da conferência (só na demonstração). */
function desenharDocumento(c: CompraDemo | undefined): string {
  const linhas = c?.fonte_leitura === 'comprovante' || (!c?.itens.length && c?.despesa_origem_id)
    ? ['COMPROVANTE DE PIX', '', `Valor: R$ ${c?.totais.total ?? '—'}`, `Para: ${c?.fornecedor?.nome ?? '—'}`, 'Tipo: Pix', `Data: ${new Date(c?.emitida_em ?? Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`, '', 'ID: E1234567820261028DEMO']
    : [c?.fornecedor?.nome?.toUpperCase() ?? 'CUPOM FISCAL', 'NFC-e — DOCUMENTO AUXILIAR', '', ...(c?.leitura?.proximos ?? c?.itens ?? []).map((i) => `${i.descricao.slice(0, 26).padEnd(26, ' ')} ${Number(i.valor_liquido).toFixed(2).padStart(8, ' ')}`), '', `TOTAL R$ ${c?.totais.total ?? '—'}`];
  const corpo = linhas.map((l, k) => `<text x="24" y="${70 + k * 22}" font-family="monospace" font-size="14" fill="#333">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`).join('');
  const h = Math.max(360, 120 + linhas.length * 22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="${h}" viewBox="0 0 380 ${h}"><rect width="100%" height="100%" fill="#fffdf8"/><rect x="8" y="8" width="364" height="${h - 16}" fill="none" stroke="#ddd"/><text x="24" y="36" font-family="sans-serif" font-size="12" fill="#a05a14">DEMONSTRAÇÃO — documento fictício</text>${corpo}</svg>`;
}
