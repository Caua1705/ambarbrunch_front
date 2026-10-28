// DEMONSTRAÇÃO — Estoque fictício (insumos, compras, fichas e análises inventados; o cadastro real vem do backend).
// Regras imitadas do backend (CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md §3, §4, §10): baixa automática DESLIGADA (saldos
// não confiáveis), etapas reais da leitura de nota, `versao` em item e compra (409 conflito_versao), 422
// conversao_ambigua, 409 despesa_ja_registrada com candidata forte, papéis (catálogo, fichas, custos e cancelar compra
// só gerência). Nada sai daqui.
import type { Rota } from './roteador';
import { TODOS, GERENCIA, ErroDemo, dia, instante, agoraMenos, uuid, resposta, exigirMotivo, hojeFortaleza } from './roteador';
import type {
  Insumo, CompraDetalhe, ItemCompra, MovimentoEstoque, FichaLista, FichaDetalhe, UnidadeBase, Inventario, CancelamentoEstoque, EtapaCompra,
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
      const em = agoraMenos(60 * 24 * (30 - k * 7));
      movimentos.unshift({ id: ++seqMov, tipo: 'entrada_compra', quantidade: d4(q), custo_unitario: d6(custo), valor: d2(q * custo), custo_desconhecido: false, saldo_apos: d4(s), custo_medio_apos: d6(custo), ocorreu_em: em, dia: em.slice(0, 10), motivo: null, registrado_por: 'Equipe (demo)' });
    }
    if (i % 4 === 1) movimentos.unshift({ id: ++seqMov, tipo: 'perda', quantidade: d4(-(unidade_base === 'un' ? 6 : 300)), custo_unitario: d6(custo), valor: d2(-(unidade_base === 'un' ? 6 : 300) * custo), custo_desconhecido: false, saldo_apos: d4(s - 300), custo_medio_apos: d6(custo), ocorreu_em: agoraMenos(60 * 30), dia: agoraMenos(60 * 30).slice(0, 10), motivo: 'vencido', registrado_por: 'Equipe (demo)' });
  }
  return {
    id, codigo: `INS-${String(i + 1).padStart(3, '0')}`, nome, categoria, unidade_base, tipo: 'comprado', controle_preparo: null,
    estoque_minimo: minimo === null ? null : d4(minimo), ativo: true, versao: 1, saldo: d4(saldo), custo_medio: custo === null ? null : d6(custo),
    ultimo_custo_compra: custo === null ? null : d6(custo * 1.03), ultima_compra_em: compra, ultima_contagem_em: motivo === 'nunca_contado' || motivo === 'sem_movimento' ? null : agoraMenos(60 * 24 * 12),
    cobertura_dias: null, saldo_confiavel: motivo === null, motivo_nao_confiavel: motivo as Insumo['motivo_nao_confiavel'],
    abaixo_minimo: minimo !== null && saldo < minimo, prazo_reposicao_dias: i % 3 === 0 ? 3 : null, movimentos, precos,
  };
});

const insumoPorNome = (n: string) => insumos.find((x) => x.nome === n)!;
const semExtras = ({ movimentos: _m, precos: _p, prazo_reposicao_dias: _r, ...i }: InsumoDemo): Insumo => {
  void _m; void _p; void _r;
  return { ...i, abaixo_minimo: i.estoque_minimo !== null && Number(i.saldo) < Number(i.estoque_minimo) };
};
function acharInsumo(id: string) {
  const i = insumos.find((x) => x.id === id);
  if (!i) throw new ErroDemo(404, 'nao_encontrado', 'Insumo não encontrado.');
  return i;
}
function movimentar(i: InsumoDemo, tipo: MovimentoEstoque['tipo'], qtd: number, custo: number | null, motivo: string | null) {
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
  i.movimentos.unshift({ id: ++seqMov, tipo, quantidade: d4(qtd), custo_unitario: unit === null ? null : d6(unit), valor: unit === null ? null : d2(qtd * unit), custo_desconhecido: unit === null, saldo_apos: d4(saldo), custo_medio_apos: medio === null ? null : d6(medio), ocorreu_em: new Date().toISOString(), dia: hojeFortaleza(), motivo, registrado_por: 'Equipe (demo)' });
  i.saldo = d4(saldo);
  i.custo_medio = medio === null ? null : d6(medio);
  if (saldo < 0) {
    i.saldo_confiavel = false;
    i.motivo_nao_confiavel = 'ficou_negativo';
  }
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
    sugestao: ins ? { insumo_id: ins.id, insumo: ins.nome, unidade_base: ins.unidade_base, confianca, motivo: sug.motivo ?? (confianca === 'alta' ? 'mesmo_produto_da_ultima_compra' : 'nome_parecido (0.71)'), fator: fator === null ? null : d4(fator), quantidade_base: qb === null ? null : d4(qb), custo_unitario_base: qb ? d6(valor / qb) : null } : null,
    alertas,
  };
}

const DESPESA_JULIA_LATICINIOS = 'f1000000-0000-4000-8000-000000000101';
const DESPESA_JULIA_HORTI = 'f1000000-0000-4000-8000-000000000102';

function compraBase(p: Partial<CompraDemo> & Pick<CompraDemo, 'id' | 'etapa' | 'origem' | 'fonte_leitura'>): CompraDemo {
  return {
    etapa_painel: p.etapa, etapa_detalhe: null, erro_codigo: null, etapas: [{ etapa: 'recebida', em: agoraMenos(180) }], arquivo_id: null, arquivo_mime: null,
    fornecedor: null, fornecedor_lido: null, numero: null, serie: null, emitida_em: null, totais: { produtos: null, desconto: '0.00', frete: '0.00', outros: '0.00', total: null },
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
    id: 'e2000000-0000-4000-8000-000000000001', etapa: 'aguardando_conferencia', etapa_painel: 'pronta', origem: 'painel', fonte_leitura: 'xml', arquivo_id: 'demo-doc-1', arquivo_mime: 'application/xml',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000001', nome: 'Laticínios Serra Azul Ltda', documento: '12.345.678/0001-90' }, fornecedor_lido: { documento: '12345678000190', nome: 'LATICINIOS SERRA AZUL LTDA' },
    numero: '18452', serie: '1', emitida_em: instante(dia(-1, hoje), '09:12'), totais: { produtos: '338.20', desconto: '0.00', frete: '0.00', outros: '0.00', total: '338.20' },
    duplicatas: [{ numero: '001', vencimento: dia(14, hoje), valor: '338.20' }], itens: xmlItens,
    despesa: { despesa_id: null, candidatas: [{ despesa_id: DESPESA_JULIA_LATICINIOS, descricao: 'Pix Laticínios Serra Azul', valor: '338.20', origem: 'julia', paga: true, forca: 'forte' }] },
    pode_confirmar: true, versao: 4, criado_em: agoraMenos(60 * 20),
    etapas: ['recebida', 'processando', 'itens_extraidos', 'associacoes_sugeridas', 'aguardando_conferencia'].map((e, k) => ({ etapa: e, em: agoraMenos(60 * 20 - k) })),
  }));
  // 2. Foto de NFC-e lida por IA: um item de confiança média com preço fora do padrão e um sem insumo
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000002', etapa: 'aguardando_conferencia', origem: 'julia', fonte_leitura: 'foto_ia', arquivo_id: 'demo-doc-2', arquivo_mime: 'image/svg+xml',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000002', nome: 'Mercadinho São Luiz', documento: '98.765.432/0001-10' }, numero: '7731', emitida_em: instante(hoje, '07:40'),
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
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000003', nome: 'Hortifruti Bom Preço', documento: null }, emitida_em: instante(hoje, '06:55'),
    totais: { produtos: null, desconto: '0.00', frete: '0.00', outros: '0.00', total: '186.40' }, despesa_origem_id: DESPESA_JULIA_HORTI,
    aviso: 'Só há o comprovante do pagamento: informe os produtos e as quantidades (ou envie a nota) para o estoque receber a compra.', pendencias: ['sem_itens'], versao: 1, criado_em: agoraMenos(140),
  }));
  // 4. Nota sendo lida agora (avança a cada consulta)
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000004', etapa: 'processando', origem: 'painel', fonte_leitura: null, etapa_detalhe: 'lendo o documento', arquivo_id: 'demo-doc-4', arquivo_mime: 'image/svg+xml', criado_em: agoraMenos(2),
    etapas: [{ etapa: 'recebida', em: agoraMenos(2) }, { etapa: 'processando', em: agoraMenos(1), detalhe: 'lendo o documento' }],
    leitura: { fonte: 'sefaz_qr', fornecedor: 'Empório Grão Fino', proximos: [item(1, 'CAFE GRAOS ESPECIAL 1KG', 3, 'PCT', 354.0, { nome: 'Café em grãos', fator: 1000 }), item(2, 'CANELA EM PO 500G', 1, 'PCT', 46.0, { nome: 'Canela em pó', fator: 500 }), item(3, 'PISTACHE SEM CASCA 1KG', 1, 'PCT', 219.0, { nome: 'Pistache sem casca', confianca: 'media' })] },
  }));
  // 5. Falhou: a nota já estava registrada
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000005', etapa: 'falhou', origem: 'julia', fonte_leitura: 'xml', erro_codigo: 'nota_ja_registrada', etapa_detalhe: 'Esta nota (Laticínios Serra Azul nº 18452) já foi registrada.', compra_original_id: 'e2000000-0000-4000-8000-000000000001',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000001', nome: 'Laticínios Serra Azul Ltda', documento: '12.345.678/0001-90' }, numero: '18452', totais: { produtos: '338.20', desconto: '0.00', frete: '0.00', outros: '0.00', total: '338.20' }, criado_em: agoraMenos(60 * 8),
  }));
  // 6. Já confirmada
  compras.push(compraBase({
    id: 'e2000000-0000-4000-8000-000000000006', etapa: 'confirmada', origem: 'painel', fonte_leitura: 'xml', arquivo_id: 'demo-doc-6', arquivo_mime: 'application/xml',
    fornecedor: { id: 'e4000000-0000-4000-8000-000000000004', nome: 'Distribuidora Fortaleza de Alimentos', documento: '45.678.901/0001-22' }, numero: '99310', emitida_em: instante(dia(-3, hoje), '10:00'),
    totais: { produtos: '412.00', desconto: '12.00', frete: '0.00', outros: '0.00', total: '400.00' },
    itens: [item(1, 'FARINHA TRIGO T1 25KG', 1, 'SC', 128.0, { nome: 'Farinha de trigo', fator: 25000 }), item(2, 'ACUCAR REFINADO 5KG', 4, 'PCT', 120.0, { nome: 'Açúcar refinado', fator: 5000 }), item(3, 'MUCARELA PECA KG', 4, 'KG', 152.0, { nome: 'Muçarela', fator: 1000 })].map((x) => ({ ...x, situacao: 'confirmado' as const })),
    despesa: { despesa_id: 'f1000000-0000-4000-8000-000000000103', candidatas: [] }, confirmada_em: agoraMenos(60 * 24 * 3), criado_em: agoraMenos(60 * 24 * 3 + 30), versao: 9,
  }));
}

function recalcular(c: CompraDemo) {
  const pend: string[] = [];
  c.itens.forEach((i) => {
    if (i.situacao === 'pendente') pend.push(`item_${i.ordem}_sem_insumo`);
  });
  if (!c.itens.length) pend.push('sem_itens');
  if (c.conferencia && !c.conferencia.ok) pend.push('conferencia_aritmetica');
  c.pendencias = pend;
  c.pode_confirmar = c.etapa === 'aguardando_conferencia' && !pend.some((p) => p !== 'conferencia_aritmetica');
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
const saidaCompra = ({ leitura: _l, arquivo_mime: _m, ...c }: CompraDemo): CompraDetalhe => {
  void _l; void _m;
  return c;
};
function listaCompra(c: CompraDemo) {
  return {
    id: c.id, etapa: c.etapa, etapa_painel: c.etapa_painel, fornecedor: c.fornecedor?.nome ?? c.fornecedor_lido?.nome ?? null, numero: c.numero, emitida_em: c.emitida_em,
    valor_total: c.totais.total, itens: c.itens.length, pendentes: c.itens.filter((i) => i.situacao === 'pendente').length, fonte_leitura: c.fonte_leitura, origem: c.origem,
    criado_em: c.criado_em, sem_itens: c.etapa === 'aguardando_conferencia' && !c.itens.length, despesa_origem_id: c.despesa_origem_id,
  };
}
function novaLeitura(origem: 'painel' | 'julia'): CompraDemo {
  const c = compraBase({
    id: uuid(), etapa: 'recebida', origem, fonte_leitura: null, etapa_detalhe: 'Documento recebido', arquivo_id: `demo-doc-${uuid()}`, arquivo_mime: 'image/svg+xml', criado_em: new Date().toISOString(),
    etapas: [{ etapa: 'recebida', em: new Date().toISOString() }],
    leitura: { fonte: 'foto_ia', fornecedor: 'Padaria e Confeitaria Aurora', proximos: [item(1, 'PAO FERMENTACAO NATURAL', 10, 'UN', 65.0, { nome: 'Pão de fermentação natural', fator: 1 }), item(2, 'TOMATE ITALIANO KG', 3, 'KG', 26.7, { nome: 'Tomate italiano', confianca: 'media', fator: 1000 })] },
  });
  compras.unshift(c);
  return c;
}

/** Itens digitados (preenchimento manual / compra sem nota) com a sugestão de insumo pelo nome. */
function itensManuais(lista: { descricao: string; quantidade: string | number; unidade: string; valor_total: string | number }[]): ItemCompra[] {
  if (!Array.isArray(lista) || !lista.length) throw new ErroDemo(422, 'regra_violada', 'Informe pelo menos um produto.');
  return lista.map((x, k) => {
    const nome = String(x.descricao ?? '').trim();
    if (!nome) throw new ErroDemo(422, 'regra_violada', `Informe a descrição do item ${k + 1}.`);
    const ins = insumos.find((i) => i.nome.toLowerCase().split(' ')[0] && nome.toLowerCase().includes(i.nome.toLowerCase().split(' ')[0]));
    const un = String(x.unidade ?? 'UN').toUpperCase();
    const fator = ins ? (un === 'KG' && ins.unidade_base === 'g' ? 1000 : un === 'L' && ins.unidade_base === 'ml' ? 1000 : un === 'G' || un === 'ML' ? 1 : un === 'UN' && ins.unidade_base === 'un' ? 1 : undefined) : undefined;
    return item(k + 1, nome.toUpperCase(), Number(x.quantidade), un, Number(x.valor_total), ins ? { nome: ins.nome, confianca: fator ? 'alta' : 'media', fator, motivo: 'nome_parecido' } : {});
  });
}

// Cancelamentos (venda cancelada depois da baixa) ----------------------------------------------------------------------

const cancelamentos: CancelamentoEstoque[] = [
  { id: 'e5000000-0000-4000-8000-000000000001', venda_id: uuid(), dia: dia(-1), motivo: 'venda_cancelada', baixa_lancada: true, situacao: 'pendente', versao: 1, itens: [{ insumo_id: insumos[1].id, insumo: 'Leite integral', unidade_base: 'ml', quantidade: '150.0000', custo_unitario: '0.005900' }, { insumo_id: insumos[0].id, insumo: 'Café em grãos', unidade_base: 'g', quantidade: '18.0000', custo_unitario: '0.118000' }] },
];

// Fichas técnicas -----------------------------------------------------------------------------------------------------

interface ProdutoDemo {
  eye_product_id: string;
  produto: string;
  grupo: string;
  preco: number;
  qtd: number;
  ficha: null | { versao: number; rendimento: number; itens: { insumo: string; quantidade: number; perda: number }[]; versoes: FichaDetalhe['versoes']; observacao: string | null };
}
const produtos: ProdutoDemo[] = [
  { eye_product_id: '4001', produto: 'Cappuccino', grupo: 'CAFÉS', preco: 14, qtd: 312, ficha: { versao: 2, rendimento: 1, itens: [{ insumo: 'Café em grãos', quantidade: 18, perda: 0 }, { insumo: 'Leite integral', quantidade: 150, perda: 5 }, { insumo: 'Canela em pó', quantidade: 1, perda: 0 }], versoes: [], observacao: null } },
  { eye_product_id: '4002', produto: 'Espresso', grupo: 'CAFÉS', preco: 8, qtd: 268, ficha: { versao: 1, rendimento: 1, itens: [{ insumo: 'Café em grãos', quantidade: 9, perda: 0 }], versoes: [], observacao: null } },
  { eye_product_id: '4003', produto: 'Latte de pistache', grupo: 'CAFÉS', preco: 19, qtd: 141, ficha: { versao: 1, rendimento: 1, itens: [{ insumo: 'Café em grãos', quantidade: 18, perda: 0 }, { insumo: 'Leite integral', quantidade: 200, perda: 5 }, { insumo: 'Pistache sem casca', quantidade: 15, perda: 0 }], versoes: [], observacao: null } },
  { eye_product_id: '5001', produto: 'Cinnamon roll tradicional', grupo: 'ROLLS', preco: 18, qtd: 420, ficha: { versao: 3, rendimento: 12, itens: [{ insumo: 'Farinha de trigo', quantidade: 1000, perda: 2 }, { insumo: 'Manteiga sem sal', quantidade: 250, perda: 0 }, { insumo: 'Açúcar refinado', quantidade: 200, perda: 0 }, { insumo: 'Ovos', quantidade: 3, perda: 0 }, { insumo: 'Canela em pó', quantidade: 25, perda: 0 }, { insumo: 'Cream cheese', quantidade: 300, perda: 0 }], versoes: [], observacao: 'Massa da noite anterior' } },
  { eye_product_id: '5002', produto: 'Roll de pistache', grupo: 'ROLLS', preco: 24, qtd: 198, ficha: { versao: 1, rendimento: 12, itens: [{ insumo: 'Farinha de trigo', quantidade: 1000, perda: 2 }, { insumo: 'Manteiga sem sal', quantidade: 250, perda: 0 }, { insumo: 'Pistache sem casca', quantidade: 240, perda: 0 }, { insumo: 'Cogumelo paris', quantidade: 0.001, perda: 0 }], versoes: [], observacao: null } },
  { eye_product_id: '5003', produto: 'Roll de chocolate', grupo: 'ROLLS', preco: 22, qtd: 156, ficha: null },
  { eye_product_id: '6001', produto: 'Bruschetta caprese', grupo: 'SALGADOS', preco: 36, qtd: 74, ficha: { versao: 1, rendimento: 1, itens: [{ insumo: 'Pão de fermentação natural', quantidade: 0.25, perda: 0 }, { insumo: 'Tomate italiano', quantidade: 120, perda: 10 }, { insumo: 'Muçarela', quantidade: 80, perda: 0 }], versoes: [], observacao: null } },
  { eye_product_id: '6002', produto: 'Sanduíche de brie', grupo: 'SALGADOS', preco: 42, qtd: 61, ficha: null },
  { eye_product_id: '7001', produto: 'Cheesecake de morango', grupo: 'DOCES', preco: 26, qtd: 88, ficha: null },
  { eye_product_id: '7002', produto: 'Brownie', grupo: 'DOCES', preco: 16, qtd: 133, ficha: { versao: 1, rendimento: 16, itens: [{ insumo: 'Chocolate 70%', quantidade: 400, perda: 0 }, { insumo: 'Manteiga sem sal', quantidade: 250, perda: 0 }, { insumo: 'Açúcar refinado', quantidade: 300, perda: 0 }, { insumo: 'Ovos', quantidade: 5, perda: 0 }, { insumo: 'Farinha de trigo', quantidade: 120, perda: 0 }], versoes: [], observacao: null } },
];
produtos.forEach((p) => {
  if (p.ficha) p.ficha.versoes = Array.from({ length: p.ficha.versao }, (_, k) => ({ versao: p.ficha!.versao - k, vigente_de: agoraMenos(60 * 24 * (20 + k * 25)), vigente_ate: k === 0 ? null : agoraMenos(60 * 24 * (20 + (k - 1) * 25)), rendimento: d4(p.ficha!.rendimento), criada_por: 'Gabriela Gerente (demo)' }));
});

function custoFicha(p: ProdutoDemo) {
  if (!p.ficha) return null;
  let total = 0;
  const sem: string[] = [];
  const itens = p.ficha.itens.map((x) => {
    const ins = insumoPorNome(x.insumo);
    const cu = ins.custo_medio === null ? null : Number(ins.custo_medio);
    const custo = cu === null ? null : x.quantidade * (1 + x.perda / 100) * cu;
    if (custo === null) sem.push(ins.nome);
    else total += custo;
    return { insumo_id: ins.id, insumo: ins.nome, unidade_base: ins.unidade_base, quantidade: d4(x.quantidade), perda_percentual: d2(x.perda), opcional: false, custo_unitario: cu === null ? null : d6(cu), custo: custo === null ? null : d2(custo) };
  });
  const porcao = sem.length ? null : total / p.ficha.rendimento;
  return { itens, sem, receita: sem.length ? null : total, porcao };
}

function fichaLista(p: ProdutoDemo): FichaLista {
  const c = custoFicha(p);
  return {
    eye_product_id: p.eye_product_id, produto: p.produto, grupo: p.grupo, preco_pdv: d2(p.preco), receita_periodo: d2(p.preco * p.qtd), quantidade_periodo: d4(p.qtd),
    ficha: p.ficha && c ? { versao: p.ficha.versao, custo_porcao_hoje: c.porcao === null ? null : d2(c.porcao), margem_hoje_pct: c.porcao === null ? null : ((1 - c.porcao / p.preco) * 100).toFixed(1), custo_incompleto: c.sem.length > 0 } : null,
  };
}

// Contagem --------------------------------------------------------------------------------------------------------------

const inventarios: Inventario[] = [];
function acharInventario(id: string) {
  const i = inventarios.find((x) => x.id === id);
  if (!i) throw new ErroDemo(404, 'nao_encontrado', 'Contagem não encontrada.');
  return i;
}

// Visão Geral -----------------------------------------------------------------------------------------------------------

export function blocoEstoqueVisaoDemo() {
  montarCompras();
  const fichas = produtos.map(fichaLista);
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

export const ROTAS_ESTOQUE: Rota[] = [
  ['GET', /^estoque\/resumo$/, TODOS, () => {
    montarCompras();
    const conferir = compras.filter((c) => c.etapa === 'aguardando_conferencia');
    const fichas = produtos.map(fichaLista);
    const receita = fichas.reduce((s, f) => s + Number(f.receita_periodo), 0);
    const coberta = fichas.filter((f) => f.ficha).reduce((s, f) => s + Number(f.receita_periodo), 0);
    return {
      abaixo_minimo: insumos.filter((i) => i.estoque_minimo !== null && Number(i.saldo) < Number(i.estoque_minimo)).map((i) => ({ insumo_id: i.id, insumo: i.nome, unidade_base: i.unidade_base, saldo: i.saldo, estoque_minimo: i.estoque_minimo, saldo_confiavel: i.saldo_confiavel })),
      compras_em_conferencia: { qtd: conferir.length, mais_antiga_em: conferir.map((c) => c.criado_em).sort()[0] ?? null },
      cancelamentos_pendentes: cancelamentos.filter((c) => c.situacao === 'pendente').length,
      sem_ficha_mais_vendidos: fichas.filter((f) => !f.ficha).sort((a, b) => Number(b.receita_periodo) - Number(a.receita_periodo)).map((f) => ({ eye_product_id: f.eye_product_id, produto: f.produto, receita: f.receita_periodo })),
      cobertura_fichas_30d: (coberta / receita).toFixed(4),
      altas_de_custo_90d: [
        { insumo_id: insumos[8].id, insumo: 'Pistache sem casca', unidade_base: 'g', custo_inicio: '0.172000', custo_fim: '0.214000', compras: 3, menor: '0.172000', maior: '0.214000', variacao_pct: '24.4' },
        { insumo_id: insumos[0].id, insumo: 'Café em grãos', unidade_base: 'g', custo_inicio: '0.104000', custo_fim: '0.121000', compras: 4, menor: '0.104000', maior: '0.121000', variacao_pct: '16.3' },
      ],
      saldo_confiavel: { insumos: insumos.filter((i) => i.saldo_confiavel).length, total: insumos.length },
      baixa_automatica: false,
      inicio_controle: dia(-21),
    };
  }],
  // Insumos
  ['GET', /^estoque\/insumos$/, TODOS, ({ query }) => {
    const b = query.get('busca')?.toLowerCase();
    const s = query.get('situacao');
    const l = insumos.map(semExtras).filter((i) => (!b || i.nome.toLowerCase().includes(b)) && (s === 'inativo' ? !i.ativo : i.ativo) && (s !== 'abaixo_minimo' || i.abaixo_minimo) && (s !== 'negativo' || Number(i.saldo) < 0));
    return { total: l.length, itens: l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) };
  }],
  ['POST', /^estoque\/insumos$/, GERENCIA, async ({ corpo }) => {
    const e = await corpo<{ nome: string; unidade_base: UnidadeBase; categoria?: string; estoque_minimo?: string | null }>();
    if (!e.nome?.trim()) throw new ErroDemo(422, 'regra_violada', 'Informe o nome.');
    const igual = insumos.find((i) => i.nome.toLowerCase() === e.nome.trim().toLowerCase());
    if (igual) throw new ErroDemo(409, 'nome_ja_existe', `Já existe o insumo “${igual.nome}”.`, { id: igual.id });
    const novo: InsumoDemo = { id: uuid(), codigo: `INS-${String(insumos.length + 1).padStart(3, '0')}`, nome: e.nome.trim(), categoria: e.categoria ?? null, unidade_base: e.unidade_base, tipo: 'comprado', controle_preparo: null, estoque_minimo: e.estoque_minimo ?? null, ativo: true, versao: 1, saldo: '0.0000', custo_medio: null, ultimo_custo_compra: null, ultima_compra_em: null, ultima_contagem_em: null, cobertura_dias: null, saldo_confiavel: false, motivo_nao_confiavel: 'sem_movimento', abaixo_minimo: false, prazo_reposicao_dias: null, movimentos: [], precos: [] };
    insumos.push(novo);
    return resposta(201, semExtras(novo));
  }],
  ['GET', /^estoque\/insumos-sugestoes$/, TODOS, ({ query }) => {
    const t = (query.get('texto') ?? '').toLowerCase().trim();
    const palavras = t.split(/\s+/).filter((p) => p.length > 2);
    return insumos
      .map((i) => ({ i, n: palavras.filter((p) => i.nome.toLowerCase().includes(p)).length }))
      .filter((x) => !t || x.n > 0 || x.i.nome.toLowerCase().includes(t))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
      .map(({ i, n }) => ({ insumo_id: i.id, insumo: i.nome, unidade_base: i.unidade_base, confianca: n >= 2 ? 'alta' : n === 1 ? 'media' : 'baixa', motivo: 'nome_parecido', fator: null }));
  }],
  ['GET', new RegExp(`^estoque/insumos/${U}$`), TODOS, ({ params }) => {
    const i = acharInsumo(params[0]);
    const usado_em = produtos.filter((p) => p.ficha?.itens.some((x) => x.insumo === i.nome)).map((p) => ({ alvo: 'produto' as const, eye_product_id: p.eye_product_id, preparo_id: null, nome: p.produto, quantidade: d4(p.ficha!.itens.find((x) => x.insumo === i.nome)!.quantidade) }));
    const { movimentos: _m, ultimo_custo_compra: _u, ultima_compra_em: _c, ultima_contagem_em: _g, cobertura_dias: _d, abaixo_minimo: _a, ...resto } = i;
    void _m; void _u; void _c; void _g; void _d; void _a;
    return { ...resto, precos: [...i.precos].reverse().slice(0, 12), usado_em };
  }],
  ['PATCH', new RegExp(`^estoque/insumos/${U}$`), GERENCIA, async (c) => {
    const i = acharInsumo(c.params[0]);
    const e = await c.corpo<Record<string, unknown> & { versao: number }>();
    if (Number(e.versao) !== i.versao) throw new ErroDemo(409, 'conflito_versao', 'Outra pessoa alterou este insumo.', { versao: i.versao });
    for (const k of ['nome', 'categoria', 'estoque_minimo', 'prazo_reposicao_dias', 'ativo'] as const) if (e[k] !== undefined) (i as unknown as Record<string, unknown>)[k] = e[k];
    i.versao++;
    return i;
  }],
  ['GET', new RegExp(`^estoque/insumos/${U}/movimentos$`), TODOS, ({ params, query }) => {
    const i = acharInsumo(params[0]);
    const antes = query.get('antes_de') ? Number(query.get('antes_de')) : Infinity;
    const lim = Number(query.get('limite') ?? 30);
    const l = i.movimentos.filter((m) => m.id < antes).slice(0, lim);
    return { itens: l, proximo: l.length === lim ? l[l.length - 1].id : null };
  }],
  ['POST', /^estoque\/perdas$/, TODOS, async ({ corpo }) => {
    const e = await corpo<{ insumo_id: string; quantidade: string; motivo: string; observacao?: string }>();
    const i = acharInsumo(e.insumo_id);
    const q = Number(e.quantidade);
    if (!(q > 0)) throw new ErroDemo(422, 'regra_violada', 'Informe uma quantidade maior que zero.');
    movimentar(i, 'perda', -q, null, e.motivo);
    return resposta(201, { id: seqMov, insumo_id: i.id, quantidade: d4(-q), saldo: i.saldo });
  }],
  // Contagem
  ['GET', /^estoque\/inventarios\/sugestao$/, TODOS, () =>
    insumos
      .filter((i) => Number(i.saldo) < 0 || !i.ultima_contagem_em || ['Café em grãos', 'Leite integral', 'Manteiga sem sal', 'Pistache sem casca', 'Chocolate 70%'].includes(i.nome))
      .slice(0, 12)
      .map((i) => ({ insumo_id: i.id, insumo: i.nome, unidade_base: i.unidade_base, motivo: Number(i.saldo) < 0 ? 'negativo' : !i.ultima_contagem_em ? 'nunca_contado' : 'curva_a', ultima_contagem_em: i.ultima_contagem_em, saldo_sistema: i.saldo }))],
  ['POST', /^estoque\/inventarios$/, TODOS, async ({ corpo }) => {
    const e = await corpo<{ escopo?: 'sugerido' | 'lista' | 'total'; insumos?: string[] | null }>();
    if (inventarios.some((x) => x.status === 'aberto')) throw new ErroDemo(409, 'inventario_aberto', 'Já existe uma contagem aberta.', { id: inventarios.find((x) => x.status === 'aberto')!.id });
    const alvo = e.escopo === 'total' ? insumos : e.escopo === 'lista' && e.insumos ? insumos.filter((i) => e.insumos!.includes(i.id)) : insumos.filter((i) => Number(i.saldo) < 0 || !i.ultima_contagem_em || ['Café em grãos', 'Leite integral', 'Manteiga sem sal', 'Pistache sem casca', 'Chocolate 70%'].includes(i.nome)).slice(0, 12);
    const inv: Inventario = { id: uuid(), escopo: e.escopo ?? 'sugerido', status: 'aberto', aberto_em: new Date().toISOString(), fechado_em: null, versao: 1, itens: alvo.map((i) => ({ insumo_id: i.id, insumo: i.nome, unidade_base: i.unidade_base, quantidade_contada: null, quantidade_sistema: i.saldo, diferenca: null, valor_diferenca: null, contado_em: null })) };
    inventarios.push(inv);
    return resposta(201, inv);
  }],
  ['GET', new RegExp(`^estoque/inventarios/${U}$`), TODOS, ({ params }) => acharInventario(params[0])],
  ['PUT', new RegExp(`^estoque/inventarios/${U}/itens/${U}$`), TODOS, async ({ params, corpo }) => {
    const inv = acharInventario(params[0]);
    if (inv.status !== 'aberto') throw new ErroDemo(409, 'inventario_fechado', 'Esta contagem já foi encerrada.');
    const it = inv.itens.find((x) => x.insumo_id === params[1]);
    if (!it) throw new ErroDemo(404, 'nao_encontrado', 'Item fora desta contagem.');
    const q = Number((await corpo<{ quantidade: string }>()).quantidade);
    if (!(q >= 0)) throw new ErroDemo(422, 'regra_violada', 'Quantidade inválida.');
    const ins = acharInsumo(it.insumo_id);
    it.quantidade_contada = d4(q);
    it.quantidade_sistema = ins.saldo;
    it.diferenca = d4(q - Number(ins.saldo));
    it.valor_diferenca = ins.custo_medio === null ? null : d2((q - Number(ins.saldo)) * Number(ins.custo_medio));
    it.contado_em = new Date().toISOString();
    return it;
  }],
  ['POST', new RegExp(`^estoque/inventarios/${U}/fechar$`), TODOS, ({ params }) => {
    const inv = acharInventario(params[0]);
    if (!inv.itens.some((i) => i.quantidade_contada !== null)) throw new ErroDemo(422, 'regra_violada', 'Conte pelo menos um item antes de fechar.');
    for (const it of inv.itens) {
      if (it.quantidade_contada === null) continue;
      const ins = acharInsumo(it.insumo_id);
      const dif = Number(it.quantidade_contada) - Number(ins.saldo);
      if (dif) movimentar(ins, 'ajuste_inventario', dif, null, 'contagem');
      ins.ultima_contagem_em = new Date().toISOString();
      if (ins.motivo_nao_confiavel === 'nunca_contado' || ins.motivo_nao_confiavel === 'ficou_negativo') ins.motivo_nao_confiavel = 'baixa_desligada';
    }
    inv.status = 'fechado';
    inv.fechado_em = new Date().toISOString();
    return inv;
  }],
  ['POST', new RegExp(`^estoque/inventarios/${U}/cancelar$`), TODOS, ({ params }) => {
    const inv = acharInventario(params[0]);
    inv.status = 'cancelado';
    return inv;
  }],
  // Compras
  ['GET', /^estoque\/compras$/, TODOS, ({ query }) => {
    montarCompras();
    const etapa = query.get('etapa');
    const l = compras.filter((c) => !etapa || c.etapa === etapa).sort((a, b) => b.criado_em.localeCompare(a.criado_em)).map(listaCompra);
    const lim = Number(query.get('limite') ?? 50);
    return { total: l.length, itens: l.slice(0, lim) };
  }],
  ['POST', /^estoque\/compras$/, TODOS, () => {
    montarCompras();
    const c = novaLeitura('painel');
    return resposta(202, { id: c.id, etapa: c.etapa, ja_existia: false });
  }],
  ['POST', /^estoque\/compras\/manual$/, TODOS, async ({ corpo }) => {
    montarCompras();
    const e = await corpo<{ fornecedor_nome?: string; emitida_em: string; valor_total: string; itens: { descricao: string; quantidade: string; unidade: string; valor_total: string }[] }>();
    const itens = itensManuais(e.itens);
    const c = compraBase({ id: uuid(), etapa: 'aguardando_conferencia', origem: 'painel', fonte_leitura: 'manual', fornecedor: e.fornecedor_nome ? { id: uuid(), nome: e.fornecedor_nome, documento: null } : null, emitida_em: instante(e.emitida_em || hojeFortaleza()), totais: { produtos: null, desconto: '0.00', frete: '0.00', outros: '0.00', total: d2(Number(e.valor_total)) }, itens, criado_em: new Date().toISOString(), etapas: [{ etapa: 'aguardando_conferencia', em: new Date().toISOString() }] });
    recalcular(c);
    compras.unshift(c);
    return resposta(201, { id: c.id, etapa: c.etapa });
  }],
  ['GET', new RegExp(`^estoque/compras/${U}$`), TODOS, ({ params }) => {
    const c = acharCompra(params[0]);
    avancar(c);
    return saidaCompra(c);
  }],
  ['PATCH', new RegExp(`^estoque/compras/${U}/itens/${U}$`), TODOS, async ({ params, corpo }) => {
    const c = acharCompra(params[0]);
    if (c.etapa !== 'aguardando_conferencia') throw new ErroDemo(409, 'etapa_invalida', 'Esta compra não está em conferência.');
    const it = c.itens.find((x) => x.id === params[1]);
    if (!it) throw new ErroDemo(404, 'nao_encontrado', 'Item não encontrado.');
    const e = await corpo<{ versao: number; insumo_id?: string; novo_insumo?: { nome: string; unidade_base: UnidadeBase }; fator?: string; quantidade_base?: string; nao_estoque?: string; ignorar?: boolean }>();
    if (Number(e.versao) !== it.versao) throw new ErroDemo(409, 'conflito_versao', 'Este item mudou desde que você abriu.', { versao: it.versao });
    if (e.ignorar) it.situacao = 'ignorado';
    else if (e.nao_estoque) {
      it.situacao = 'nao_estoque';
      it.categoria_despesa = e.nao_estoque;
    } else {
      let ins: InsumoDemo | undefined;
      if (e.novo_insumo) {
        ins = insumos.find((i) => i.nome.toLowerCase() === e.novo_insumo!.nome.trim().toLowerCase());
        if (!ins) {
          ins = { id: uuid(), codigo: `INS-${String(insumos.length + 1).padStart(3, '0')}`, nome: e.novo_insumo.nome.trim(), categoria: null, unidade_base: e.novo_insumo.unidade_base, tipo: 'comprado', controle_preparo: null, estoque_minimo: null, ativo: true, versao: 1, saldo: '0.0000', custo_medio: null, ultimo_custo_compra: null, ultima_compra_em: null, ultima_contagem_em: null, cobertura_dias: null, saldo_confiavel: false, motivo_nao_confiavel: 'sem_movimento', abaixo_minimo: false, prazo_reposicao_dias: null, movimentos: [], precos: [] };
          insumos.push(ins);
        }
      } else ins = acharInsumo(String(e.insumo_id ?? it.sugestao?.insumo_id));
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
  ['PUT', new RegExp(`^estoque/compras/${U}/manual$`), TODOS, async ({ params, corpo }) => {
    const c = acharCompra(params[0]);
    const e = await corpo<{ versao: number; fornecedor_nome?: string; emitida_em: string; valor_total: string; itens: { descricao: string; quantidade: string; unidade: string; valor_total: string }[] }>();
    if (Number(e.versao) !== c.versao) throw new ErroDemo(409, 'conflito_versao', 'A compra mudou desde que você abriu.', { versao: c.versao });
    c.itens = itensManuais(e.itens);
    if (e.fornecedor_nome && !c.fornecedor) c.fornecedor = { id: uuid(), nome: e.fornecedor_nome, documento: null };
    if (e.emitida_em) c.emitida_em = instante(e.emitida_em);
    const soma = c.itens.reduce((s, i) => s + Number(i.valor_liquido), 0);
    const total = Number(e.valor_total || c.totais.total);
    c.totais.total = d2(total);
    c.conferencia = Math.abs(soma - total) > 0.05 ? { ok: false, problemas: [`A soma dos itens (R$ ${d2(soma)}) não fecha com o total (R$ ${d2(total)}).`] } : { ok: true, problemas: [] };
    c.aviso = null;
    c.versao++;
    recalcular(c);
    return saidaCompra(c);
  }],
  ['POST', new RegExp(`^estoque/compras/${U}/confirmar$`), TODOS, async ({ params, corpo, papel }) => {
    const c = acharCompra(params[0]);
    if (c.etapa === 'confirmada') return { compra_id: c.id, etapa: 'confirmada', despesa_id: c.despesa.despesa_id, movimentos: c.itens.filter((i) => i.situacao === 'confirmado' || i.situacao === 'sugerido').length, ja_estava_confirmada: true };
    const e = await corpo<{ versao: number; despesa?: { vincular_despesa_id?: string | null; paga_em?: string | null; forma?: string | null; parcelas?: unknown[] | null; criar_nova?: boolean; motivo_nova?: string | null }; motivo_divergencia?: string | null }>();
    if (Number(e.versao) !== c.versao) throw new ErroDemo(409, 'conflito_versao', 'A compra mudou desde que você abriu.', { versao: c.versao });
    if (c.pendencias.some((p) => p !== 'conferencia_aritmetica')) throw new ErroDemo(409, 'pendencias', 'Ainda há itens para resolver.', { pendencias: c.pendencias });
    if (c.conferencia && !c.conferencia.ok) {
      if (papel === 'operador') throw new ErroDemo(409, 'pendencias', 'A nota não fecha: só a gerência confirma com a divergência.', { pendencias: ['conferencia_aritmetica'] });
      exigirMotivo(e.motivo_divergencia);
      c.divergencia_aceita = String(e.motivo_divergencia);
    }
    const d = e.despesa ?? {};
    const forte = c.despesa.candidatas.find((x) => x.forca === 'forte');
    if (!c.despesa_origem_id && forte && !d.vincular_despesa_id && !d.criar_nova) throw new ErroDemo(409, 'despesa_ja_registrada', 'Já existe um pagamento registrado que parece ser desta compra. Vincule a ele ou explique por que criar outra conta.', { candidata: forte });
    if (d.criar_nova) exigirMotivo(d.motivo_nova);
    let movimentos = 0;
    for (const it of c.itens) {
      if ((it.situacao === 'confirmado' || it.situacao === 'sugerido') && it.sugestao?.insumo_id && it.sugestao.quantidade_base) {
        movimentar(acharInsumo(it.sugestao.insumo_id), 'entrada_compra', Number(it.sugestao.quantidade_base), Number(it.sugestao.custo_unitario_base), null);
        it.situacao = 'confirmado';
        movimentos++;
      }
    }
    c.despesa.despesa_id = d.vincular_despesa_id ?? c.despesa_origem_id ?? uuid();
    c.etapa = 'confirmada';
    c.etapa_painel = 'confirmada';
    c.confirmada_em = new Date().toISOString();
    c.etapas.push({ etapa: 'confirmada', em: c.confirmada_em });
    c.versao++;
    return { compra_id: c.id, etapa: 'confirmada', despesa_id: c.despesa.despesa_id, movimentos, ja_estava_confirmada: false };
  }],
  ['POST', new RegExp(`^estoque/compras/${U}/cancelar$`), GERENCIA, async ({ params, corpo }) => {
    const c = acharCompra(params[0]);
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    if (c.etapa === 'confirmada' && c.despesa.despesa_id === DESPESA_JULIA_LATICINIOS) throw new ErroDemo(409, 'tem_pagamento', 'A conta desta compra já foi paga: estorne o pagamento no Financeiro antes de cancelar.');
    if (c.etapa === 'confirmada') for (const it of c.itens) if (it.sugestao?.insumo_id && it.sugestao.quantidade_base) movimentar(acharInsumo(it.sugestao.insumo_id), 'estorno', -Number(it.sugestao.quantidade_base), Number(it.sugestao.custo_unitario_base), 'compra cancelada');
    c.etapa = 'cancelada';
    c.etapa_painel = 'cancelada';
    c.cancelada_em = new Date().toISOString();
    c.cancelada_motivo = motivo;
    return { compra_id: c.id, etapa: 'cancelada' };
  }],
  ['POST', new RegExp(`^estoque/compras/${U}/reprocessar$`), TODOS, ({ params }) => {
    const c = acharCompra(params[0]);
    if (c.erro_codigo === 'nota_ja_registrada') throw new ErroDemo(409, 'nota_ja_registrada', 'Esta nota já foi registrada em outra compra: ler de novo não muda isso.');
    return resposta(202, { id: c.id, etapa: c.etapa });
  }],
  // Cancelamentos de venda depois da baixa
  ['GET', /^estoque\/cancelamentos$/, TODOS, ({ query }) => {
    const s = query.get('situacao');
    const l = cancelamentos.filter((c) => !s || c.situacao === s);
    return { total: l.length, itens: l };
  }],
  ['POST', new RegExp(`^estoque/cancelamentos/${U}/resolver$`), TODOS, async ({ params, corpo }) => {
    const c = cancelamentos.find((x) => x.id === params[0]);
    if (!c) throw new ErroDemo(404, 'nao_encontrado', 'Pendência não encontrada.');
    const e = await corpo<{ versao: number; decisao: CancelamentoEstoque['situacao'] }>();
    if (c.situacao !== 'pendente') {
      if (c.situacao === e.decisao) return c;
      throw new ErroDemo(409, 'ja_resolvido', 'Esta pendência já foi resolvida com outra decisão.');
    }
    if (Number(e.versao) !== c.versao) throw new ErroDemo(409, 'conflito_versao', 'A venda mudou desde a leitura.', { versao: c.versao });
    for (const it of c.itens) {
      const ins = acharInsumo(it.insumo_id);
      if (c.baixa_lancada) movimentar(ins, 'estorno_consumo', Number(it.quantidade), Number(it.custo_unitario), 'venda cancelada');
      if (e.decisao === 'produzido_descartado') movimentar(ins, 'perda', -Number(it.quantidade), Number(it.custo_unitario), 'produzido e descartado');
    }
    c.situacao = e.decisao;
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
    return produtos.map(fichaLista).filter((f) => s === 'todas' || (s === 'sem_ficha' ? !f.ficha : !!f.ficha)).sort((a, b) => Number(b.receita_periodo) - Number(a.receita_periodo));
  }],
  ['GET', /^estoque\/fichas\/(produto|preparo)\/([\w-]+)$/, GERENCIA, ({ params }) => {
    const p = produtos.find((x) => x.eye_product_id === params[1]);
    if (!p) throw new ErroDemo(404, 'nao_encontrado', 'Produto não encontrado.');
    if (!p.ficha) throw new ErroDemo(404, 'sem_ficha', 'Este produto ainda não tem ficha técnica.');
    const c = custoFicha(p)!;
    return { id: `ficha-${p.eye_product_id}-${p.ficha.versao}`, alvo: 'produto', eye_product_id: p.eye_product_id, preparo_id: null, versao: p.ficha.versao, rendimento: d4(p.ficha.rendimento), vigente_de: p.ficha.versoes[0]?.vigente_de ?? agoraMenos(60 * 24 * 20), vigente_ate: null, origem: 'painel', observacao: p.ficha.observacao, custo_receita: c.receita === null ? null : d2(c.receita), custo_porcao: c.porcao === null ? null : d2(c.porcao), insumos_sem_custo: c.sem, itens: c.itens, versoes: p.ficha.versoes };
  }],
  ['PUT', /^estoque\/fichas\/(produto|preparo)\/([\w-]+)$/, GERENCIA, async ({ params, corpo }) => {
    const p = produtos.find((x) => x.eye_product_id === params[1]);
    if (!p) throw new ErroDemo(404, 'nao_encontrado', 'Produto não encontrado.');
    const e = await corpo<{ rendimento: string; itens: { insumo_id: string; quantidade: string; perda_percentual?: string }[]; observacao?: string }>();
    if (!(Number(e.rendimento) > 0)) throw new ErroDemo(422, 'regra_violada', 'O rendimento precisa ser maior que zero.');
    if (!e.itens?.length) throw new ErroDemo(422, 'regra_violada', 'Adicione pelo menos um ingrediente.');
    const versao = (p.ficha?.versao ?? 0) + 1;
    const agora = new Date().toISOString();
    const versoes = [{ versao, vigente_de: agora, vigente_ate: null, rendimento: d4(Number(e.rendimento)), criada_por: 'Você (demo)' }, ...(p.ficha?.versoes ?? []).map((v, k) => (k === 0 ? { ...v, vigente_ate: agora } : v))];
    p.ficha = { versao, rendimento: Number(e.rendimento), itens: e.itens.map((x) => ({ insumo: acharInsumo(x.insumo_id).nome, quantidade: Number(x.quantidade), perda: Number(x.perda_percentual ?? 0) })), versoes, observacao: e.observacao ?? null };
    const c = custoFicha(p)!;
    return { id: `ficha-${p.eye_product_id}-${versao}`, alvo: 'produto', eye_product_id: p.eye_product_id, preparo_id: null, versao, rendimento: d4(p.ficha.rendimento), vigente_de: agora, vigente_ate: null, origem: 'painel', observacao: p.ficha.observacao, custo_receita: c.receita === null ? null : d2(c.receita), custo_porcao: c.porcao === null ? null : d2(c.porcao), insumos_sem_custo: c.sem, itens: c.itens, versoes };
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
    const chave = (x: (typeof l)[number]) => Number(ord === 'quantidade' ? x.quantidade : ord === 'contribuicao' ? x.contribuicao ?? -1 : ord === 'margem' ? x.margem_realizada_pct ?? -1 : x.receita_liquida);
    return l.sort((a, b) => chave(b) - chave(a));
  }],
  ['GET', /^estoque\/analises\/cmv$/, GERENCIA, ({ query }) => ({
    mes: `${query.get('mes') ?? hojeFortaleza().slice(0, 7)}-01`,
    fonte: 'indisponivel', valor: null, cmv_pct: null, receita_produtos: '48210.00',
    motivos_indisponivel: [
      { fonte: 'por_inventario', codigo: 'sem_inventario', texto: 'Não há contagem completa no início e no fim do mês.' },
      { fonte: 'teorico', codigo: 'cobertura_insuficiente', texto: 'As fichas técnicas cobrem só parte da receita do mês: o custo teórico ficaria incompleto.' },
    ],
    alternativas: { por_inventario: null, teorico: null },
    cobertura_fichas: blocoEstoqueVisaoDemo().cobertura_fichas_30d, vendas_validas: 1834, vendas_processadas: 0, teorico_incompleto: true,
    divergencia_inventario_teorico: null,
    indicadores: { compras_estoque_mes: '9284.30', compras_estoque_sobre_receita_pct: '19.3', aviso: 'Compras de estoque divididas pela receita NÃO são CMV: parte do que foi comprado continua na prateleira.' },
  })],
  ['GET', /^estoque\/analises\/cardapio$/, GERENCIA, ({ query }) => {
    const itens = produtos.map((p) => {
      const f = fichaLista(p);
      const custo = f.ficha?.custo_porcao_hoje ? Number(f.ficha.custo_porcao_hoje) : null;
      const completo = !!f.ficha && !f.ficha.custo_incompleto;
      const margemU = custo === null ? null : p.preco - custo;
      return { eye_product_id: p.eye_product_id, produto: p.produto, grupo: p.grupo, quantidade: d4(p.qtd), receita: d2(p.preco * p.qtd), preco_medio_efetivo: d2(p.preco), custo_estimado_unitario: custo === null ? null : d6(custo), margem_estimada_unitaria: margemU === null ? null : d2(margemU), margem_estimada_pct: margemU === null ? null : ((margemU / p.preco) * 100).toFixed(1), contribuicao_estimada_total: margemU === null ? null : d2(margemU * p.qtd), custo_completo: completo, tem_ficha: !!p.ficha, motivo_sem_classificacao: !p.ficha ? 'sem_ficha' : !completo ? 'custo_incompleto' : null, classificacao: null as string | null, sugestao: null as string | null };
    });
    for (const g of new Set(itens.map((i) => i.grupo))) {
      const doGrupo = itens.filter((i) => i.grupo === g && !i.motivo_sem_classificacao);
      if (doGrupo.length < 2) {
        doGrupo.forEach((i) => (i.motivo_sem_classificacao = 'sem_comparacao_no_grupo'));
        continue;
      }
      const mq = doGrupo.reduce((s, i) => s + Number(i.quantidade), 0) / doGrupo.length;
      const mm = doGrupo.reduce((s, i) => s + Number(i.margem_estimada_unitaria) * Number(i.quantidade), 0) / doGrupo.reduce((s, i) => s + Number(i.quantidade), 0);
      for (const i of doGrupo) {
        const pop = Number(i.quantidade) >= 0.7 * mq;
        const mar = Number(i.margem_estimada_unitaria) >= mm;
        i.classificacao = `${pop ? 'alta_venda' : 'baixa_venda'}_${mar ? 'alta_margem' : 'margem_baixa'}`.replace('baixa_venda_alta_margem', 'baixa_venda_margem_alta');
        i.sugestao = pop && mar ? 'Manter em destaque no cardápio.' : pop ? 'Vende bem com margem menor: conferir custo da ficha e o preço.' : mar ? 'Boa margem e pouca venda: avaliar destaque ou sugestão da equipe.' : 'Pouca venda e margem baixa: avaliar se continua no cardápio.';
      }
    }
    const resumo: Record<string, number> = {};
    for (const i of itens) {
      const k = i.classificacao ?? `sem_classificacao:${i.motivo_sem_classificacao}`;
      resumo[k] = (resumo[k] ?? 0) + 1;
    }
    return { periodo: { de: query.get('de'), ate: query.get('ate') }, criterio: { minimo_vendas: 10, aviso: 'Margem de contribuição ESTIMADA (custo da ficha de hoje), não lucro. Nenhum preço é alterado.' }, resumo, itens };
  }],
  ['GET', /^estoque\/analises\/fornecedores$/, GERENCIA, () => ({
    itens: [
      { insumo_id: insumos[2].id, insumo: 'Manteiga sem sal', unidade_base: 'g', compras: 3, comparavel: true, motivo: null, ultimo_preco: '0.041200', menor_preco_recente: '0.038000', variacao_ultima_compra_pct: '8.4', menor_preco_medio: { fornecedor: 'Laticínios Serra Azul', preco_medio: '0.039600' }, evolucao: [], fornecedores: [{ fornecedor: 'Laticínios Serra Azul', compras: 2, preco_medio: '0.039600', menor_preco: '0.038000', ultimo_preco: '0.041200', ultima_compra: dia(-1) }, { fornecedor: 'Mercadinho São Luiz', compras: 1, preco_medio: '0.044900', menor_preco: '0.044900', ultimo_preco: '0.044900', ultima_compra: dia(-12) }] },
      { insumo_id: insumos[0].id, insumo: 'Café em grãos', unidade_base: 'g', compras: 4, comparavel: true, motivo: null, ultimo_preco: '0.121000', menor_preco_recente: '0.112000', variacao_ultima_compra_pct: '3.4', menor_preco_medio: { fornecedor: 'Empório Grão Fino', preco_medio: '0.116500' }, evolucao: [], fornecedores: [{ fornecedor: 'Empório Grão Fino', compras: 3, preco_medio: '0.116500', menor_preco: '0.112000', ultimo_preco: '0.121000', ultima_compra: dia(-4) }, { fornecedor: 'Torrefação Sertão', compras: 1, preco_medio: '0.128000', menor_preco: '0.128000', ultimo_preco: '0.128000', ultima_compra: dia(-25) }] },
      { insumo_id: insumos[8].id, insumo: 'Pistache sem casca', unidade_base: 'g', compras: 2, comparavel: false, motivo: 'um_fornecedor_so', ultimo_preco: '0.219000', menor_preco_recente: '0.214000', variacao_ultima_compra_pct: '2.3', menor_preco_medio: null, evolucao: [], fornecedores: [{ fornecedor: 'Empório Grão Fino', compras: 2, preco_medio: '0.216500', menor_preco: '0.214000', ultimo_preco: '0.219000', ultima_compra: dia(-4) }] },
    ],
    aviso: 'Preço por unidade-base do MESMO insumo confirmado nas compras. Menor preço não é melhor fornecedor: qualidade, prazo e frete não entram na conta.',
  })],
  ['GET', /^estoque\/analises\/ruptura$/, TODOS, () => ({
    disponivel: false, tipo: 'previsao', itens: [],
    motivos: [
      { codigo: 'baixa_real_desligada', texto: 'A baixa automática pelas vendas está desligada: o saldo não desconta o que foi vendido, então não dá para prever quando cada insumo acaba.' },
      { codigo: 'historico_curto', texto: 'O controle de estoque começou há menos de 14 dias.' },
    ],
  })],
  ['GET', /^estoque\/analises\/reposicao$/, TODOS, () => ({ disponivel: false, itens: [], motivos: [{ codigo: 'baixa_real_desligada', texto: 'Sem baixa automática, a reposição sugerida não é calculada.' }] })],
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
