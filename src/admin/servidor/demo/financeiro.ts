// DEMONSTRAÇÃO — Financeiro fictício (vendas, despesas, outras receitas, contas fixas, taxas, comprovantes da Júlia,
// banco e conciliação, participação simulada). Formatos das rotas /admin/financeiro* e /admin/arquivos* do backend;
// papéis como lá (gerência; categorias e fornecedores também para a operação; retiradas de sócios e participação só
// para o Proprietário — sigilo.py). Nada daqui é real nem sai do servidor de desenvolvimento.
//
// Atenção: este arquivo e roteador.ts se importam mutuamente. Tudo que vem do roteador é usado só DENTRO de funções
// (o estado é montado na primeira requisição) e os papéis são constantes locais — no import circular, as constantes
// do roteador ainda não existem quando este módulo é avaliado.
import type { Rota, Contexto } from './roteador';
import { ErroDemo, hojeFortaleza, dia, instante, sorteio, resposta, exigirMotivo, paginar } from './roteador';
import type { Papel } from '../../lib/sessao';
import type {
  Categoria, DespesaSaida, ParcelaSaida, PagamentoSaida, Recorrencia, DocumentoRevisao, ContaBancaria, Importacao,
  MovimentoBancario, NivelConciliacao, ContaPagar, Lancamento, MesEvolucao, ResultadoMes, Qualidade,
  NivelQualidade, ItemFechamento, EstadoConciliacao, EstadoContaMes, FormaPagamento, TaxaPagamento, MeioPdv,
  AgrupamentoVendas, PeriodoVendas, SimulacaoParticipacao, MovimentoBancario as Mov,
} from '../../lib/tipos/financeiro';
import type { RadarInsight, VisaoGeral } from '../../lib/tipos/visao-geral';

const TODOS: Papel[] = ['admin', 'gerente', 'operador'];
const GERENCIA: Papel[] = ['admin', 'gerente'];
const ADMIN: Papel[] = ['admin'];

const C = (codigo: string, nome: string, grupo: Categoria['grupo']): Categoria => ({ codigo, nome, grupo, aliases: [], ativo: true });
const CATEGORIAS: Categoria[] = [
  C('compras_insumos', 'Insumos e mercadorias', 'compras_estoque'), C('embalagens', 'Embalagens e descartáveis', 'compras_estoque'), C('bebidas_revenda', 'Bebidas para revenda', 'compras_estoque'),
  C('folha', 'Salários', 'pessoal'), C('encargos', 'Encargos (INSS, FGTS)', 'pessoal'), C('diarias_extras', 'Diárias e extras', 'pessoal'), C('beneficios', 'Benefícios (VT, alimentação)', 'pessoal'), C('pro_labore', 'Pró-labore', 'pessoal'),
  C('aluguel', 'Aluguel', 'ocupacao'), C('condominio_iptu', 'Condomínio e IPTU', 'ocupacao'), C('energia', 'Energia', 'ocupacao'), C('agua', 'Água', 'ocupacao'), C('gas', 'Gás', 'ocupacao'),
  C('limpeza_higiene', 'Limpeza e higiene', 'operacional'), C('manutencao', 'Manutenção', 'operacional'), C('transporte', 'Transporte', 'operacional'), C('sistemas_assinaturas', 'Sistemas e assinaturas', 'operacional'), C('servicos_terceiros', 'Serviços de terceiros', 'operacional'), C('utensilios', 'Utensílios', 'operacional'), C('outras_operacionais', 'Outras despesas operacionais', 'operacional'),
  C('marketing', 'Marketing', 'marketing'), C('impostos', 'Impostos', 'impostos'), C('tarifas_bancarias', 'Tarifas bancárias', 'financeiro'), C('taxas_cartao', 'Taxas de cartão', 'financeiro'), C('juros', 'Juros e multas', 'financeiro'),
  C('obras_reformas', 'Obras e reformas', 'investimento'), C('equipamentos', 'Equipamentos', 'investimento'), C('distribuicao_socios', 'Distribuição aos sócios', 'retirada'), C('repasse_taxa_servico', 'Repasse da taxa de serviço', 'repasse'),
  C('a_classificar', 'A classificar', 'pendente'),
];
const grupoDe = (cat: string) => CATEGORIAS.find((c) => c.codigo === cat)?.grupo ?? 'operacional';

interface Fornecedor { id: string; nome: string; documento: string | null }
interface Despesa extends DespesaSaida { historico: NonNullable<DespesaSaida['historico']> }
interface Venda { dia: string; total: number; vendas: number }
interface Vinculo { id: string; movimento_id: string; acao: string; tipo: string; valor: string; descricao: string; situacao: 'ativa' | 'desfeita'; criado_em: string; desfeito_em: string | null; motivo: string | null; pagamento_criado?: string; despesa_criada?: string }
interface Arquivo { id: string; mime: string; titulo: string; linhas: string[] }

const E: {
  pronto: boolean;
  seq: number;
  fornecedores: Fornecedor[];
  despesas: Despesa[];
  vendas: Venda[];
  receitas: { id: string; descricao: string; valor: string; competencia: string; recebido_em: string | null; status: 'confirmada' | 'cancelada'; chave?: string | null }[];
  taxas: TaxaPagamento[];
  recorrencias: Recorrencia[];
  documentos: (DocumentoRevisao & { resolvido?: string })[];
  contas: ContaBancaria[];
  importacoes: Importacao[];
  movimentos: MovimentoBancario[];
  vinculos: Vinculo[];
  arquivos: Map<string, Arquivo>;
  apuracoes: Map<string, { status: 'rascunho' | 'conferida' | 'fechada'; excecao: { motivo: string; por: string } | null }>;
  mesesConciliados: Set<string>;
} = { pronto: false, seq: 0, fornecedores: [], despesas: [], vendas: [], receitas: [], taxas: [], recorrencias: [], documentos: [], contas: [], importacoes: [], movimentos: [], vinculos: [], arquivos: new Map(), apuracoes: new Map(), mesesConciliados: new Set() };

const id = () => `f${String(++E.seq).padStart(7, '0')}-0000-4000-8000-00000000demo`;
const d2 = (n: number) => n.toFixed(2);
const mesDe = (iso: string) => iso.slice(0, 7);
const ultimoDia = (mes: string) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0, 12)).toISOString().slice(0, 10); };
const mesMais = (mes: string, n: number) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m - 1 + n, 1, 12)).toISOString().slice(0, 7); };
const diaNoMes = (mes: string, d: number) => `${mes}-${String(Math.min(d, Number(ultimoDia(mes).slice(8)))).padStart(2, '0')}`;
const agora = () => new Date().toISOString();

function arquivoFalso(titulo: string, linhas: string[]): string {
  const a: Arquivo = { id: id(), mime: 'image/svg+xml', titulo, linhas };
  E.arquivos.set(a.id, a);
  return a.id;
}

function fornecedor(nome: string, documento: string | null = null): Fornecedor {
  let f = E.fornecedores.find((x) => x.nome === nome);
  if (!f) E.fornecedores.push((f = { id: id(), nome, documento }));
  return f;
}

function novaDespesa(o: { descricao: string; valor: number; competencia: string; categoria: string; fornecedor?: Fornecedor | null; origem: string; status?: Despesa['status']; motivos?: string[]; recorrencia_id?: string | null; valor_a_confirmar?: boolean; parcelas: { vencimento: string; valor: number; paga_em?: string | null; forma?: FormaPagamento; parcial?: number }[]; arquivo_id?: string | null; compra_id?: string | null }): Despesa {
  const parcelas: ParcelaSaida[] = o.parcelas.map((p, i) => {
    const pagamentos: PagamentoSaida[] = [];
    const pago = p.paga_em ? (p.parcial ?? p.valor) : 0;
    if (p.paga_em) pagamentos.push({ id: id(), valor: d2(pago), pago_em: p.paga_em, forma: p.forma ?? 'pix', identificador_transacao: null, arquivo_id: null, origem: o.origem === 'recorrencia' ? 'painel' : o.origem, conciliacao: 'manual', registrado_por: 'Gabriela (demo)', criado_em: instante(p.paga_em, '10:00'), estornado_em: null, estorno_motivo: null });
    return { id: id(), numero: i + 1, vencimento: p.vencimento, valor: d2(p.valor), valor_pago: d2(pago), saldo: d2(p.valor - pago), situacao: p.valor - pago < 0.005 ? 'paga' : 'aberta', pagamentos };
  });
  const d: Despesa = {
    id: id(), unidade_negocio_id: 1, descricao: o.descricao, valor: d2(o.valor), competencia: o.competencia, categoria_codigo: o.categoria, grupo: grupoDe(o.categoria),
    fornecedor: o.fornecedor ? { id: o.fornecedor.id, nome: o.fornecedor.nome, documento: o.fornecedor.documento ? `${o.fornecedor.documento.slice(0, 2)}.***.***/****-${o.fornecedor.documento.slice(-2)}` : null } : null,
    origem: o.origem, status: o.status ?? 'confirmada', motivos_revisao: o.motivos ?? [], valor_a_confirmar: o.valor_a_confirmar ?? false, compra_id: o.compra_id ?? null, recorrencia_id: o.recorrencia_id ?? null,
    arquivo_id: o.arquivo_id ?? null, versao: 1, criado_por: o.origem === 'julia' ? 'Júlia (grupo da equipe)' : 'Gabriela (demo)', criado_em: instante(o.competencia, '09:30'), confirmado_em: o.status === 'em_revisao' ? null : instante(o.competencia, '09:31'),
    cancelado_em: null, cancelado_motivo: null, parcelas, rateio: [], historico: [{ em: instante(o.competencia, '09:30'), acao: 'criar', ator: o.origem === 'julia' ? 'Júlia' : 'Gabriela (demo)', ator_tipo: o.origem === 'julia' ? 'integracao' : 'usuario', dados: null }],
  };
  E.despesas.push(d);
  return d;
}

function montar() {
  if (E.pronto) return;
  E.pronto = true;
  const rnd = sorteio(7);
  const hoje = hojeFortaleza();
  const mesAtual = mesDe(hoje);
  // Vendas do PDV: os últimos ~6 meses (o Âmbar fictício abriu há meio ano). Segunda fechado.
  for (let i = 185; i >= 0; i--) {
    const d = dia(-i, hoje);
    const sem = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (sem === 1) continue;
    const base = sem === 0 || sem === 6 ? 6200 : 3400;
    const crescimento = 0.75 + (185 - i) / 185 * 0.35;
    const total = Math.round(base * crescimento * (0.82 + rnd() * 0.36) * 100) / 100;
    E.vendas.push({ dia: d, total, vendas: Math.round(total / (44 + rnd() * 10)) });
  }
  // Contas fixas
  const rec = (descricao: string, categoria: string, valor: number, diaV: number, variavel: boolean, forn: Fornecedor): Recorrencia => {
    const r: Recorrencia = { id: id(), descricao, categoria_codigo: categoria, fornecedor: { id: forn.id, nome: forn.nome }, valor_previsto: d2(valor), valor_variavel: variavel, dia_vencimento: diaV, intervalo_meses: 1, inicio: `${mesMais(mesAtual, -6)}-01`, fim: null, antecedencia_dias: 10, ativo: true, versao: 1, proximas: [] };
    E.recorrencias.push(r);
    return r;
  };
  const enel = fornecedor('Enel Distribuição Ceará', '07047251000170');
  const fixas = [
    rec('Aluguel da loja', 'aluguel', 14500, 5, false, fornecedor('Imobiliária Aldeota', '12345678000190')),
    rec('Energia elétrica', 'energia', 2600, 18, true, enel),
    rec('Internet e telefone', 'sistemas_assinaturas', 289.9, 10, false, fornecedor('Brisanet', '04601397000128')),
    rec('Sistema do PDV', 'sistemas_assinaturas', 349, 12, false, fornecedor('Eyemobile', '11222333000144')),
    rec('Contabilidade', 'servicos_terceiros', 1350, 20, false, fornecedor('Contábil Fortaleza', '22333444000155')),
    rec('Folha de pagamento', 'folha', 31800, 5, true, fornecedor('Equipe Âmbar', null)),
    rec('Vale-transporte', 'beneficios', 1900, 1, true, fornecedor('Sindiônibus', '05666777000188')),
  ];
  for (let m = -5; m <= 0; m++) {
    const mes = mesMais(mesAtual, m);
    for (const r of fixas) {
      const venc = diaNoMes(mes, r.dia_vencimento);
      const variacao = r.valor_variavel ? 0.88 + rnd() * 0.24 : 1;
      const valor = Number(r.valor_previsto) * variacao;
      const futuro = venc > hoje;
      const paga = !futuro && !(m === 0 && r.categoria_codigo === 'energia') && !(m === 0 && r.categoria_codigo === 'servicos_terceiros' && venc < hoje);
      novaDespesa({ descricao: `${r.descricao} — ${mes.split('-').reverse().join('/')}`, valor: paga || !r.valor_variavel ? valor : Number(r.valor_previsto), competencia: venc, categoria: r.categoria_codigo, fornecedor: E.fornecedores.find((f) => f.id === r.fornecedor!.id), origem: 'recorrencia', recorrencia_id: r.id, valor_a_confirmar: r.valor_variavel && !paga, parcelas: [{ vencimento: venc, valor: paga || !r.valor_variavel ? valor : Number(r.valor_previsto), paga_em: paga ? venc : null, forma: r.categoria_codigo === 'folha' ? 'transferencia' : r.categoria_codigo === 'aluguel' ? 'boleto' : 'pix' }] });
    }
    // Compras de insumos e despesas avulsas do mês
    const sups = [fornecedor('Atacadão Fortaleza', '75315333000109'), fornecedor('Laticínios Serra Azul', '33444555000166'), fornecedor('Hortifruti Mucuripe', '44555666000177'), fornecedor('Café Pilão Distribuidora', '55666777000188')];
    for (let k = 0; k < 9; k++) {
      const dd = diaNoMes(mes, 2 + Math.floor(rnd() * 26));
      if (dd > hoje) continue;
      const f = sups[Math.floor(rnd() * sups.length)];
      const v = 380 + rnd() * 2600;
      novaDespesa({ descricao: `Compra ${f.nome.split(' ')[0]}`, valor: v, competencia: dd, categoria: 'compras_insumos', fornecedor: f, origem: rnd() < 0.6 ? 'compra' : 'julia', parcelas: [{ vencimento: dd, valor: v, paga_em: dd, forma: 'pix' }], compra_id: id() });
    }
    const avulsas: [string, string, number][] = [['Material de limpeza', 'limpeza_higiene', 410], ['Gás de cozinha', 'gas', 640], ['Impulsionamento Instagram', 'marketing', 800], ['Conserto da máquina de café', 'manutencao', 520], ['DAS — Simples Nacional', 'impostos', 0.06], ['Tarifas bancárias', 'tarifas_bancarias', 89.9]];
    for (const [desc, cat, v] of avulsas) {
      const dd = diaNoMes(mes, cat === 'impostos' ? 20 : 3 + Math.floor(rnd() * 24));
      if (dd > hoje) continue;
      const receitaAnterior = E.vendas.filter((x) => mesDe(x.dia) === mesMais(mes, -1)).reduce((s, x) => s + x.total, 0);
      const valor = cat === 'impostos' ? Math.max(1200, receitaAnterior * v) : v * (0.8 + rnd() * 0.4);
      novaDespesa({ descricao: desc, valor, competencia: dd, categoria: cat, origem: rnd() < 0.5 ? 'julia' : 'painel', parcelas: [{ vencimento: dd, valor, paga_em: dd, forma: 'pix' }] });
    }
  }
  // Mês atual: uma compra parcelada (freezer) e duas despesas para revisar
  const freezer = novaDespesa({ descricao: 'Freezer horizontal 2 portas', valor: 5400, competencia: dia(-20, hoje), categoria: 'equipamentos', fornecedor: fornecedor('Refrigeração Nordeste', '66777888000199'), origem: 'painel', parcelas: [0, 1, 2].map((i) => ({ vencimento: dia(-20 + i * 30, hoje), valor: 1800, paga_em: i === 0 ? dia(-20, hoje) : null, forma: 'boleto' as FormaPagamento })) });
  void freezer;
  novaDespesa({ descricao: 'Pix — Distribuidora Bom Preço', valor: 236.4, competencia: dia(-2, hoje), categoria: 'a_classificar', origem: 'julia', status: 'em_revisao', motivos: ['categoria_a_classificar'], parcelas: [{ vencimento: dia(-2, hoje), valor: 236.4, paga_em: dia(-2, hoje) }], arquivo_id: arquivoFalso('Comprovante Pix', ['Pix enviado', 'R$ 236,40', 'Distribuidora Bom Preço', `${dia(-2, hoje)} 10:42`]) });
  novaDespesa({ descricao: 'Reforma do toldo do jardim', valor: 7900, competencia: dia(-1, hoje), categoria: 'manutencao', origem: 'julia', status: 'em_revisao', motivos: ['acima_do_limite'], fornecedor: fornecedor('Toldos Ceará', '77888999000100'), parcelas: [{ vencimento: dia(9, hoje), valor: 7900 }], arquivo_id: arquivoFalso('Orçamento aprovado', ['Toldos Ceará', 'Reforma toldo', 'R$ 7.900,00']) });
  E.receitas.push({ id: id(), descricao: 'Evento corporativo — café da manhã (faturado)', valor: '4800.00', competencia: dia(-9, hoje), recebido_em: dia(-2, hoje), status: 'confirmada' });
  // Taxas do contrato da adquirente: uma vigência antiga do crédito e as atuais.
  const taxa = (meio: MeioPdv, t: string, prazo: number, desde: string) => E.taxas.push({ id: E.taxas.length + 1, meio, taxa_percentual: t, prazo_dias: prazo, vigente_de: desde });
  taxa('credito', '3.490', 30, `${mesMais(mesAtual, -6)}-01`);
  taxa('credito', '3.150', 30, `${mesMais(mesAtual, -2)}-01`);
  taxa('debito', '1.390', 1, `${mesMais(mesAtual, -6)}-01`);
  taxa('pix', '0.990', 0, `${mesMais(mesAtual, -6)}-01`);

  // Comprovantes da Júlia pendentes
  const energiaAberta = E.despesas.find((d) => d.categoria_codigo === 'energia' && d.parcelas[0].situacao === 'aberta')!;
  const contab = E.despesas.find((d) => d.categoria_codigo === 'servicos_terceiros' && d.parcelas[0].situacao === 'aberta');
  E.documentos.push({
    id: id(), tipo_documento: 'comprovante_pagamento', legenda: 'paguei a luz', autor_nome: 'Otávio (equipe)', motivos: ['conta_compativel', 'valor_a_confirmar'],
    extraido: { valor: '2481.37', data: dia(0, hoje), recebedor_nome: 'ENEL DISTRIBUICAO CEARA', recebedor_documento: '07.047.251/0001-70', identificador_transacao: 'E00416968202610281342abcdEF12', forma: 'pix', categoria_sugerida: 'energia' },
    candidatas: [{ parcela_id: energiaAberta.parcelas[0].id, despesa_id: energiaAberta.id, vencimento: energiaAberta.parcelas[0].vencimento, saldo: energiaAberta.parcelas[0].saldo, descricao: energiaAberta.descricao, fornecedor: 'Enel Distribuição Ceará', forca: 'forte', evidencias: ['mesmo_beneficiario', 'identificador_da_transacao'], faltando: ['valor_exato', 'obrigacao_definida'] }],
    arquivo_id: arquivoFalso('Comprovante Pix', ['Pix enviado', 'R$ 2.481,37', 'ENEL DISTRIBUICAO CEARA', 'CNPJ 07.047.251/0001-70']), criado_em: new Date(Date.now() - 50 * 60_000).toISOString(),
  });
  E.documentos.push({
    id: id(), tipo_documento: 'boleto', legenda: null, autor_nome: 'Gabriela (demo)', motivos: ['documento_ambiguo'],
    extraido: { valor: '1350.00', vencimento: dia(3, hoje), recebedor_nome: 'CONTABIL FORTALEZA LTDA', linha_digitavel: '23793.38128 60000.000003 00000.000400 1 98760000135000', categoria_sugerida: 'servicos_terceiros' },
    candidatas: contab ? [
      { parcela_id: contab.parcelas[0].id, despesa_id: contab.id, vencimento: contab.parcelas[0].vencimento, saldo: contab.parcelas[0].saldo, descricao: contab.descricao, fornecedor: 'Contábil Fortaleza', forca: 'fraca', evidencias: ['valor_exato', 'obrigacao_definida'], faltando: ['mesmo_beneficiario', 'mesma_linha_digitavel'] },
    ] : [],
    arquivo_id: arquivoFalso('Boleto', ['Boleto bancário', 'Contábil Fortaleza', 'R$ 1.350,00']), criado_em: new Date(Date.now() - 26 * 3600_000).toISOString(),
  });
  E.documentos.push({
    id: id(), tipo_documento: 'nota_compra', legenda: 'nota do hortifruti', autor_nome: 'Otávio (equipe)', motivos: ['nota_sem_sinal_objetivo'],
    extraido: { valor: '418.90', data: dia(-1, hoje), recebedor_nome: 'HORTIFRUTI MUCURIPE', descricao: 'NFC-e 004512', categoria_sugerida: 'compras_insumos' },
    candidatas: [], arquivo_id: arquivoFalso('NFC-e', ['Hortifruti Mucuripe', 'NFC-e 004512', 'Banana, morango, hortelã…', 'Total R$ 418,90']), criado_em: new Date(Date.now() - 4 * 3600_000).toISOString(),
  });

  // Banco
  const conta: ContaBancaria = { id: id(), unidade_negocio_id: 1, instituicao: 'Itaú', codigo_banco: '341', apelido: 'Itaú principal', agencia: '…0421', conta: '…5520', reconhece_ofx: true, escopo: 'operacional', status: 'ativa', versao: 1, criado_em: instante(dia(-90, hoje)) };
  E.contas.push(conta);
  const reserva: ContaBancaria = { ...conta, id: id(), apelido: 'Itaú reserva', conta: '…9031', escopo: 'reserva', reconhece_ofx: false };
  E.contas.push(reserva);
  const mesAnterior = mesMais(mesAtual, -1);
  const imp = novaImportacao(conta, 'ofx', `${mesAnterior}-01`, ultimoDia(mesAnterior), 'arquivo');
  const impAtual = novaImportacao(conta, 'ofx', `${mesAtual}-01`, dia(-3, hoje) < `${mesAtual}-01` ? `${mesAtual}-01` : dia(-3, hoje), 'arquivo');
  // Mês anterior: tudo conciliado exceto 3 itens
  const pagos = E.despesas.filter((d) => mesDe(d.competencia) === mesAnterior && d.parcelas[0].pagamentos.length).slice(0, 12);
  for (const d of pagos) {
    const pg = d.parcelas[0].pagamentos[0];
    const m = mov(conta, imp.id, pg.pago_em, 'debito', Number(pg.valor), `PIX ENVIADO ${(d.fornecedor?.nome ?? d.descricao).toUpperCase()}`, 'vinculo_confirmado');
    m.situacao = 'conciliado';
    m.valor_conciliado = m.valor;
    m.saldo_a_conciliar = '0.00';
    E.vinculos.push({ id: id(), movimento_id: m.id, acao: 'vincular_pagamento', tipo: 'pagamento', valor: m.valor, descricao: d.descricao, situacao: 'ativa', criado_em: instante(pg.pago_em, '18:00'), desfeito_em: null, motivo: null });
  }
  mov(conta, imp.id, diaNoMes(mesAnterior, 14), 'debito', 45.9, 'TAR PACOTE SERVICOS', 'classificacao_pendente').classificacao_sugerida = null;
  const rep = mov(conta, imp.id, diaNoMes(mesAnterior, 16), 'credito', 18342.55, 'GETNET CREDITO VENDAS', 'possivel');
  rep.candidatos = [{ tipo: 'vendas', acao: 'liquidar_vendas', referencia: 'vendas-cartao', valor: '18712.40', data: diaNoMes(mesAnterior, 15), descricao: 'Vendas no cartão (dias 8 a 14)', pontuacao: 60, valor_exato: false, evidencias: [{ codigo: 'descricao_adquirente', texto: 'Descrição indica repasse da maquininha (Getnet).' }], alertas: ['periodo_e_taxa_a_conferir'], parametros: { meio: 'cartao', de: diaNoMes(mesAnterior, 8), ate: diaNoMes(mesAnterior, 14) } }];
  mov(conta, imp.id, diaNoMes(mesAnterior, 22), 'credito', 15000, 'TED RECEBIDA MARIANA SOCIA', 'sem_correspondencia');
  // Mês atual: propostas variadas
  const pagAtual = E.despesas.filter((d) => mesDe(d.competencia) === mesAtual && d.parcelas[0].pagamentos.length && d.origem !== 'julia').slice(0, 2);
  for (const d of pagAtual) {
    const pg = d.parcelas[0].pagamentos[0];
    const m = mov(conta, impAtual.id, pg.pago_em, 'debito', Number(pg.valor), `PIX ENVIADO ${(d.fornecedor?.nome ?? d.descricao).toUpperCase()}`, 'forte');
    m.candidatos = [{ tipo: 'pagamento', acao: 'vincular_pagamento', referencia: pg.id, valor: pg.valor, data: pg.pago_em, descricao: d.descricao, pontuacao: 95, valor_exato: true, evidencias: [{ codigo: 'data', texto: 'Pagamento registrado: mesmo dia.' }, { codigo: 'valor_exato', texto: `Mesmo valor (R$ ${pg.valor}).` }, { codigo: 'beneficiario', texto: 'Nome do fornecedor na descrição do banco.' }], alertas: [], parametros: { pagamento_id: pg.id } }];
  }
  const aluguelAberto = E.despesas.find((d) => d.categoria_codigo === 'aluguel' && mesDe(d.competencia) === mesAtual);
  if (aluguelAberto) {
    const p = aluguelAberto.parcelas[0];
    const m = mov(conta, impAtual.id, p.vencimento, 'debito', Number(p.valor), 'PAG BOLETO IMOBILIARIA ALDEOTA', p.situacao === 'paga' ? 'forte' : 'possivel');
    if (p.situacao === 'paga') m.candidatos = [{ tipo: 'pagamento', acao: 'vincular_pagamento', referencia: p.pagamentos[0].id, valor: p.valor, data: p.vencimento, descricao: aluguelAberto.descricao, pontuacao: 92, valor_exato: true, evidencias: [{ codigo: 'valor_exato', texto: 'Mesmo valor.' }, { codigo: 'beneficiario', texto: 'Imobiliária na descrição.' }], alertas: [], parametros: { pagamento_id: p.pagamentos[0].id } }];
  }
  const amb = mov(conta, impAtual.id, dia(-5, hoje) < `${mesAtual}-01` ? `${mesAtual}-01` : dia(-5, hoje), 'debito', 350, 'PIX ENVIADO 350,00', 'ambigua');
  amb.candidatos = [
    { tipo: 'parcela', acao: 'pagar_parcela', referencia: 'a', valor: '350.00', data: amb.data, descricao: 'Diária de garçom — sábado', pontuacao: 55, valor_exato: true, evidencias: [{ codigo: 'valor_exato', texto: 'Mesmo valor (R$ 350.00).' }], alertas: [], parametros: { parcela_id: id() } },
    { tipo: 'parcela', acao: 'pagar_parcela', referencia: 'b', valor: '350.00', data: amb.data, descricao: 'Diária de cozinha — domingo', pontuacao: 55, valor_exato: true, evidencias: [{ codigo: 'valor_exato', texto: 'Mesmo valor (R$ 350.00).' }], alertas: [], parametros: { parcela_id: id() } },
  ];
  mov(conta, impAtual.id, dia(-4, hoje) < `${mesAtual}-01` ? `${mesAtual}-01` : dia(-4, hoje), 'debito', 127.5, 'PIX ENVIADO PAPELARIA CENTRAL', 'sem_correspondencia');
  const tarifa = mov(conta, impAtual.id, `${mesAtual}-01`, 'debito', 45.9, 'TAR PACOTE SERVICOS', 'classificacao_pendente');
  tarifa.classificacao_sugerida = { acao: 'registrar_despesa', categoria: 'tarifas_bancarias', texto: 'Parece tarifa bancária: registrar como despesa (categoria tarifas).' };
  const transf = mov(conta, impAtual.id, `${mesAtual}-02` > hoje ? `${mesAtual}-01` : `${mesAtual}-02`, 'debito', 10000, 'TED MESMA TITULARIDADE ITAU RESERVA', 'classificacao_pendente');
  transf.classificacao_sugerida = { acao: 'classificar', classificacao: 'transferencia_propria', texto: 'A descrição indica aplicação/resgate (dinheiro da própria empresa).' };
  const dup = mov(conta, impAtual.id, dia(-6, hoje) < `${mesAtual}-01` ? `${mesAtual}-01` : dia(-6, hoje), 'debito', 89.9, 'DEB AUTOMATICO BRISANET', 'conflito');
  dup.conflito = { tipo: 'possivel_duplicidade', com: null, decisao: null };
  E.mesesConciliados.clear();
}

function novaImportacao(conta: ContaBancaria, formato: 'ofx' | 'csv', de: string, ate: string, origem: 'arquivo' | 'confirmada' | null): Importacao {
  const i: Importacao = { id: id(), conta: { id: conta.id, apelido: conta.apelido, instituicao: conta.instituicao }, formato, status: 'processada', periodo: { de, ate }, cobertura: { de: origem ? de : null, ate: origem ? ate : null, origem, confirmada_por: origem === 'confirmada' ? 'Gabriela (demo)' : null }, saldo_final: null, saldo_final_em: null, contagem: { linhas: 0, movimentos: 0, novos: 0, ja_existentes: 0, conflitos: 0, ignoradas: 0, erros: 0 }, erros: [], ignoradas_por_motivo: {}, criado_em: agora() };
  E.importacoes.unshift(i);
  return i;
}

function mov(conta: ContaBancaria, importacao: string, data: string, direcao: 'credito' | 'debito', valor: number, descricao: string, nivel: NivelConciliacao): MovimentoBancario {
  const m: MovimentoBancario = { id: id(), conta: { id: conta.id, apelido: conta.apelido }, data, direcao, valor: d2(valor), descricao, tipo_banco: direcao === 'credito' ? 'CREDIT' : 'DEBIT', fitid: `F${E.seq}`, identificador_pix: null, situacao: 'pendente', valor_conciliado: '0.00', saldo_a_conciliar: d2(valor), conflito: null, nivel, candidatos: [], classificacao_sugerida: null, acoes_possiveis: direcao === 'debito' ? ['vincular_pagamento', 'pagar_parcela', 'registrar_despesa', 'classificar:transferencia_propria', 'classificar:emprestimo', 'classificar:reembolso', 'classificar:estorno', 'classificar:nao_operacional'] : ['vincular_receita', 'registrar_receita', 'liquidar_vendas', 'classificar:transferencia_propria', 'classificar:aporte_socio', 'classificar:emprestimo', 'classificar:estorno', 'classificar:nao_operacional'], versao: 1, importacao_id: importacao };
  E.movimentos.push(m);
  const imp = E.importacoes.find((x) => x.id === importacao);
  if (imp) {
    imp.contagem.movimentos++;
    imp.contagem.novos++;
    imp.contagem.linhas++;
  }
  return m;
}

// Cálculos -------------------------------------------------------------------------------------------------------------

const vivas = () => E.despesas.filter((d) => d.status !== 'cancelada');
const receitaPdv = (de: string, ate: string) => E.vendas.filter((v) => v.dia >= de && v.dia <= ate).reduce((s, v) => s + v.total, 0);
const temVendas = (de: string, ate: string) => E.vendas.some((v) => v.dia >= de && v.dia <= ate);

function situacaoPainel(p: ParcelaSaida): ContaPagar['situacao_painel'] {
  const hoje = hojeFortaleza();
  if (p.situacao === 'paga') return 'paga';
  if (p.vencimento < hoje) return 'vencida';
  if (p.vencimento === hoje) return 'vence_hoje';
  if (Number(p.valor_pago) > 0) return 'parcial';
  return 'a_vencer';
}

function contasAPagar(): ContaPagar[] {
  return vivas().flatMap((d) =>
    d.parcelas.filter((p) => p.situacao !== 'cancelada').map((p) => ({
      parcela_id: p.id, despesa_id: d.id, unidade_negocio_id: 1, descricao: d.descricao, categoria: d.categoria_codigo, grupo: d.grupo, fornecedor_id: d.fornecedor?.id ?? null, fornecedor: d.fornecedor?.nome ?? null,
      numero: p.numero, vencimento: p.vencimento, valor: p.valor, valor_pago: p.valor_pago, saldo: p.saldo, situacao: p.situacao === 'paga' ? 'paga' : 'aberta', status_despesa: d.status === 'em_revisao' ? 'em_revisao' : 'confirmada',
      valor_a_confirmar: d.valor_a_confirmar, recorrencia_id: d.recorrencia_id, compra_id: d.compra_id, situacao_painel: situacaoPainel(p),
    } as ContaPagar)),
  );
}

function resumoContas() {
  const hoje = hojeFortaleza();
  const abertas = contasAPagar().filter((c) => c.situacao === 'aberta');
  const g = (f: (c: ContaPagar) => boolean) => { const l = abertas.filter(f); return { qtd: l.length, valor: d2(l.reduce((s, c) => s + Number(c.saldo), 0)) }; };
  return { vencidas: g((c) => c.vencimento < hoje), hoje: g((c) => c.vencimento === hoje), proximas: g((c) => c.vencimento > hoje && c.vencimento <= dia(7, hoje)) };
}

const pendentesRevisao = () => ({ despesas: vivas().filter((d) => d.status === 'em_revisao').length, documentos: E.documentos.filter((d) => !d.resolvido).length });

function calcularMes(mes: string): ResultadoMes {
  const hoje = hojeFortaleza();
  const de = `${mes}-01`;
  const ate = ultimoDia(mes) > hoje ? hoje : ultimoDia(mes);
  const mesAnteriorInfo = mes === mesMais(mesDe(hoje), -7) ? null : evolucaoMes(mesMais(mes, -1));
  const anterior = { mes: `${mesMais(mes, -1)}-01`, receita_liquida: mesAnteriorInfo?.receita_liquida ?? null, resultado_gerencial: mesAnteriorInfo?.resultado_gerencial ?? null, qualidade: mesAnteriorInfo?.qualidade ?? 'indisponivel' };
  if (!temVendas(de, ate)) return { mes: de, unidade_negocio_id: 1, disponivel: false, qualidade: { nivel: 'indisponivel', motivos: [{ nivel: 'indisponivel', codigo: 'vendas_nao_sincronizadas', texto: 'Não há vendas do PDV sincronizadas neste mês.' }] }, mes_anterior: anterior };
  const vendas = E.vendas.filter((v) => v.dia >= de && v.dia <= ate);
  const liquida = vendas.reduce((s, v) => s + v.total, 0);
  const outras = E.receitas.filter((r) => r.status === 'confirmada' && mesDe(r.competencia) === mes).reduce((s, r) => s + Number(r.valor), 0);
  const desp = vivas().filter((d) => d.status === 'confirmada' && mesDe(d.competencia) === mes);
  const soma = (g: string) => desp.filter((d) => d.grupo === g).reduce((s, d) => s + Number(d.valor), 0);
  const idade = (Number(mesDe(hoje).slice(0, 4)) * 12 + Number(mesDe(hoje).slice(5))) - (Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5)));
  // O controle de estoque (fichas) começou há 3 meses: antes disso o CMV é indisponível.
  const cmvDisponivel = idade <= 3;
  const cmv = cmvDisponivel ? liquida * (0.29 + (idade % 2) * 0.02) : null;
  const receitaLiq = liquida + outras;
  const ops = { pessoal: soma('pessoal'), ocupacao: soma('ocupacao'), operacional: soma('operacional'), marketing: soma('marketing') };
  const totalOps = ops.pessoal + ops.ocupacao + ops.operacional + ops.marketing;
  const taxas = liquida * 0.021;
  const margem = cmv === null ? null : receitaLiq - cmv;
  const operacional = margem === null ? null : margem - totalOps - taxas;
  const gerencial = operacional === null ? null : operacional - soma('impostos') - soma('financeiro');
  const motivos: Qualidade['motivos'] = [];
  if (idade === 0) motivos.push({ nivel: 'parcial', codigo: 'mes_em_andamento', texto: 'O mês ainda está em andamento.' });
  if (!cmvDisponivel) motivos.push({ nivel: 'indisponivel', codigo: 'cmv_indisponivel', texto: 'Sem inventário nem fichas técnicas suficientes: o custo das mercadorias não pode ser calculado.' });
  else motivos.push({ nivel: 'estimado', codigo: 'cmv_teorico', texto: 'O custo das mercadorias é teórico (fichas técnicas × vendas), sem inventário de fechamento.' });
  if (idade === 0 && pendentesRevisao().despesas) motivos.push({ nivel: 'parcial', codigo: 'despesas_em_revisao', texto: `${pendentesRevisao().despesas} despesas em revisão não entram no resultado.` });
  if (idade === 0 && E.despesas.some((d) => d.valor_a_confirmar && mesDe(d.competencia) === mes)) motivos.push({ nivel: 'parcial', codigo: 'valor_a_confirmar', texto: 'Há contas de valor variável ainda não confirmadas (usado o previsto).' });
  const nivel: NivelQualidade = !cmvDisponivel ? 'indisponivel' : idade === 0 ? 'parcial' : 'estimado';
  const compras = soma('compras_estoque');
  return {
    mes: de, unidade_negocio_id: 1, disponivel: true,
    receita: { vendas: vendas.reduce((s, v) => s + v.vendas, 0), faturamento_bruto: d2(liquida * 1.035), descontos: d2(liquida * 0.03), devolucoes: d2(liquida * 0.005), receita_liquida_vendas: d2(liquida), outras_receitas: d2(outras), receita_liquida: d2(receitaLiq), taxa_servico_fora_da_receita: d2(liquida * 0.08) },
    cmv: { fonte: cmvDisponivel ? 'teorico' : 'indisponivel', valor: cmv === null ? null : d2(cmv), motivos_indisponivel: cmvDisponivel ? [] : [{ fonte: 'teorico', codigo: 'controle_nao_iniciado', texto: 'O controle de estoque ainda não tinha começado neste mês.' }, { fonte: 'por_inventario', codigo: 'sem_inventario', texto: 'Não houve inventário de abertura e fechamento.' }], alternativas: { por_inventario: null, teorico: cmv === null ? null : d2(cmv) }, cobertura_fichas: cmvDisponivel ? '0.86' : null, vendas_validas: vendas.length, vendas_processadas: vendas.length, teorico_incompleto: cmvDisponivel && idade === 0, indicadores: { compras_estoque_mes: d2(compras), compras_estoque_sobre_receita_pct: receitaLiq ? d2((compras / receitaLiq) * 100) : null, aviso: 'Compras do mês ÷ receita não é CMV: o estoque pode ter sobrado ou faltado no período.' } },
    margem_bruta: margem === null ? null : d2(margem), margem_bruta_pct: margem === null ? null : d2((margem / receitaLiq) * 100),
    despesas_operacionais: { pessoal: d2(ops.pessoal), ocupacao: d2(ops.ocupacao), operacional: d2(ops.operacional), marketing: d2(ops.marketing), total: d2(totalOps) },
    taxas_cartao_estimadas: { valor: d2(taxas), por_meio: {}, meios_sem_taxa: [] },
    resultado_operacional: operacional === null ? null : d2(operacional), resultado_operacional_pct: operacional === null ? null : d2((operacional / receitaLiq) * 100),
    impostos: d2(soma('impostos')), financeiro: d2(soma('financeiro')),
    resultado_gerencial: gerencial === null ? null : d2(gerencial), resultado_gerencial_pct: gerencial === null ? null : d2((gerencial / receitaLiq) * 100),
    fora_do_resultado: { investimento: d2(soma('investimento')), retirada: d2(soma('retirada')), repasse: d2(soma('repasse')) },
    compras_estoque_no_mes: d2(compras), qualidade: { nivel, motivos },
    observacao: 'DEMONSTRAÇÃO: números fictícios para validar a tela.', mes_anterior: anterior,
  };
}

function evolucaoMes(mes: string): MesEvolucao {
  const r = calcularMes(mes);
  if (!r.disponivel) return { mes: r.mes, receita_liquida: null, cmv: null, cmv_fonte: null, despesas_operacionais: null, resultado_gerencial: null, qualidade: 'indisponivel' };
  return { mes: r.mes, receita_liquida: r.receita.receita_liquida, cmv: r.cmv.valor, cmv_fonte: r.cmv.fonte, despesas_operacionais: r.despesas_operacionais.total, resultado_gerencial: r.resultado_gerencial, qualidade: r.qualidade.nivel };
}

function resumoFinanceiro() {
  const hoje = hojeFortaleza();
  const mes = mesDe(hoje);
  const ini = `${mes}-01`;
  const vHoje = E.vendas.find((v) => v.dia === hoje);
  const anteriorAte = (() => { const a = mesMais(mes, -1); const d = `${a}-${hoje.slice(8)}`; return d > ultimoDia(a) ? ultimoDia(a) : d; })();
  const desp = vivas().filter((d) => d.status === 'confirmada' && mesDe(d.competencia) === mes);
  const pagamentosMes = E.despesas.flatMap((d) => d.parcelas.flatMap((p) => p.pagamentos)).filter((p) => !p.estornado_em && mesDe(p.pago_em) === mes);
  const r = calcularMes(mes);
  const conc = avisoConciliacao();
  return {
    hoje: { dia: hoje, receita: vHoje ? d2(vHoje.total) : null, vendas: vHoje?.vendas ?? 0, ticket_medio: vHoje ? d2(vHoje.total / Math.max(1, vHoje.vendas)) : null },
    mes: { inicio: ini, receita: d2(receitaPdv(ini, hoje)), receita_mes_anterior_ate_o_mesmo_dia: d2(receitaPdv(`${mesMais(mes, -1)}-01`, anteriorAte)), despesas_confirmadas: d2(desp.reduce((s, d) => s + Number(d.valor), 0)), pago: d2(pagamentosMes.reduce((s, p) => s + Number(p.valor), 0)), a_pagar: d2(contasAPagar().filter((c) => c.situacao === 'aberta' && mesDe(c.vencimento) === mes).reduce((s, c) => s + Number(c.saldo), 0)), resultado_parcial: r.disponivel ? r.resultado_gerencial : null, cmv_fonte: r.disponivel ? r.cmv.fonte : 'indisponivel', qualidade: r.qualidade },
    contas: resumoContas(),
    revisao: pendentesRevisao(),
    sincronizacao: { ultimo_sucesso_em: new Date(Date.now() - 18 * 60_000).toISOString(), falhas_seguidas: 0, atrasada: false },
    conciliacao_mes_anterior: conc,
    unidade: { codigo: 'ambar_cafe', nome: 'Âmbar Café (demo)', teste: false },
  };
}

function estadoConta(conta: ContaBancaria, mes: string): EstadoContaMes {
  const hoje = hojeFortaleza();
  const de = `${mes}-01`;
  const ate = ultimoDia(mes);
  const movs = E.movimentos.filter((m) => m.conta.id === conta.id && mesDe(m.data) === mes);
  const imps = E.importacoes.filter((i) => i.conta.id === conta.id && i.cobertura.de && i.cobertura.ate && i.cobertura.de <= ate && i.cobertura.ate! >= de);
  const coberto = imps.reduce((max, i) => (i.cobertura.ate! > max ? i.cobertura.ate! : max), '');
  const lacunas = !imps.length ? [{ de, ate: ate > hoje ? hoje : ate }] : coberto < ate ? [{ de: dia(1, coberto), ate: ate > hoje ? hoje : ate }] : [];
  const pend = movs.filter((m) => m.situacao === 'pendente').length;
  const conflitos = movs.filter((m) => m.nivel === 'conflito').length;
  const integral = !lacunas.length || (ate > hoje && false);
  let estado: EstadoConciliacao = !imps.length ? 'nao_conferido' : !integral ? 'parcial' : pend || conflitos ? 'aguardando_revisao' : 'integral_informado';
  if (E.mesesConciliados.has(`${mes}:${conta.id}`)) estado = 'conciliado';
  const sum = (dir: string, f: (m: MovimentoBancario) => number) => d2(movs.filter((m) => m.direcao === dir && m.situacao !== 'duplicado').reduce((s, m) => s + f(m), 0));
  return { conta: { id: conta.id, apelido: conta.apelido, instituicao: conta.instituicao }, estado, cobertura_integral: integral, lacunas, importacoes: imps.length, movimentos: movs.length, pendentes: pend, parciais: movs.filter((m) => m.situacao === 'parcial').length, conflitos, duplicados: movs.filter((m) => m.situacao === 'duplicado').length, creditos: sum('credito', (m) => Number(m.valor)), debitos: sum('debito', (m) => Number(m.valor)), creditos_a_conciliar: sum('credito', (m) => Number(m.saldo_a_conciliar)), debitos_a_conciliar: sum('debito', (m) => Number(m.saldo_a_conciliar)) };
}

const ORDEM_ESTADO: EstadoConciliacao[] = ['nao_conferido', 'parcial', 'reaberto', 'aguardando_revisao', 'integral_informado', 'conciliado'];
function conciliacaoMes(mes: string) {
  const contas = E.contas.filter((c) => c.status === 'ativa').map((c) => estadoConta(c, mes));
  const estado: EstadoConciliacao = !contas.length ? 'sem_contas' : contas.map((c) => c.estado).sort((a, b) => ORDEM_ESTADO.indexOf(a) - ORDEM_ESTADO.indexOf(b))[0];
  return { mes: `${mes}-01`, estado, conciliado: estado === 'conciliado', contas };
}

function avisoConciliacao() {
  const mes = mesMais(mesDe(hojeFortaleza()), -1);
  const c = conciliacaoMes(mes);
  if (c.estado === 'conciliado' || c.estado === 'sem_contas') return null;
  const pend = c.contas.filter((x) => x.estado !== 'conciliado').map((x) => x.conta.apelido);
  return { mes: `${mes}-01`, estado: c.estado, contas_pendentes: pend, texto: `O extrato de ${pend.join(' e ')} ainda não foi conciliado.`, rota: `/admin/financeiro/fechamento/${mes}` };
}

function fechamento(mes: string) {
  const conc = conciliacaoMes(mes);
  const ate = ultimoDia(mes);
  const vencidas = contasAPagar().filter((c) => c.situacao === 'aberta' && c.vencimento <= ate && c.vencimento < hojeFortaleza());
  const rev = pendentesRevisao();
  const it = (codigo: string, titulo: string, situacao: ItemFechamento['situacao'], quantidade: number | null, valor: string | null, detalhe: string | null, rota: string | null): ItemFechamento => ({ codigo, titulo, situacao, quantidade, valor, detalhe, rota });
  const pendMov = conc.contas.reduce((s, c) => s + c.pendentes, 0);
  const r = calcularMes(mes);
  const itens: ItemFechamento[] = [
    it('vendas_sincronizadas', 'Vendas do PDV sincronizadas', 'ok', null, null, null, null),
    it('contas_vencidas', 'Contas vencidas até o fim do mês', vencidas.length ? 'pendente' : 'ok', vencidas.length, d2(vencidas.reduce((s, c) => s + Number(c.saldo), 0)), null, '/admin/financeiro/contas-a-pagar?situacao=vencidas'),
    it('despesas_em_revisao', 'Despesas e comprovantes em revisão', rev.despesas + rev.documentos ? 'pendente' : 'ok', rev.despesas + rev.documentos, null, null, '/admin/financeiro/revisao'),
    it('cobertura_extrato', 'Extrato do mês inteiro importado', conc.contas.every((c) => c.cobertura_integral) ? 'ok' : 'pendente', conc.contas.filter((c) => !c.cobertura_integral).length, null, null, '/admin/financeiro/extratos'),
    it('debitos_nao_classificados', 'Movimentos do banco para conferir', pendMov ? 'pendente' : 'ok', pendMov, null, null, '/admin/financeiro/conciliacao/movimentos'),
    it('repasses_cartao', 'Repasses de cartão com diferença', 'atencao', null, null, 'Diferença de taxa e prazo da maquininha a conferir', '/admin/financeiro/conciliacao/repasses'),
    it('compras_nao_confirmadas', 'Compras de insumos não conferidas', 'ok', 0, null, null, '/admin/estoque/compras'),
    it('cmv', 'Custo das mercadorias (CMV)', r.disponivel && r.cmv.fonte !== 'indisponivel' ? 'ok' : 'indisponivel', null, null, r.disponivel && r.cmv.fonte !== 'indisponivel' ? null : 'Sem inventário nem fichas suficientes', null),
  ];
  const ap = E.apuracoes.get(mes) ?? { status: 'rascunho' as const, excecao: null };
  return { mes: `${mes}-01`, concluido: itens.every((i) => i.situacao === 'ok'), pendencias: itens.filter((i) => i.situacao !== 'ok'), itens, conciliacao: conc, apuracao: { status: ap.status, congelada: ap.status !== 'rascunho', qualidade: r.disponivel ? r.qualidade.nivel : 'indisponivel', excecao_conciliacao: ap.excecao } };
}

// Sigilo (sigilo.py): sem financeiro.ver_societario, nada de retiradas de sócios nem participação.
const veSocietario = (papel: Papel) => papel === 'admin';
const ehRetirada = (cat: string | null) => !!cat && grupoDe(cat) === 'retirada';
function semRetirada(r: ResultadoMes, papel: Papel): ResultadoMes {
  if (veSocietario(papel) || !r.disponivel) return r;
  const { retirada, ...fora } = r.fora_do_resultado;
  void retirada;
  return { ...r, fora_do_resultado: fora };
}

/** relatorios/vendas: os mesmos campos de resultado.vendas_por_periodo (date_trunc: semana começa na segunda). */
function vendasPorPeriodo(de: string, ate: string, agrupar: AgrupamentoVendas) {
  const inicioDe = (d: string) => {
    if (agrupar === 'mes') return `${mesDe(d)}-01`;
    if (agrupar === 'semana') return dia(-((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7), d);
    return d;
  };
  const grupos = new Map<string, Venda[]>();
  for (const v of E.vendas.filter((x) => x.dia >= de && x.dia <= ate)) {
    const k = inicioDe(v.dia);
    grupos.set(k, [...(grupos.get(k) ?? []), v]);
  }
  const soma = (vs: Venda[]) => {
    const total = vs.reduce((s2, v) => s2 + v.total, 0);
    const vendas = vs.reduce((s2, v) => s2 + v.vendas, 0);
    return { vendas, faturamento_bruto: d2(total * 1.035), descontos: d2(total * 0.03), receita_liquida_produtos: d2(total), devolucoes: d2(total * 0.005), receita_liquida: d2(total), taxa_servico: d2(total * 0.08), recebido_pdv: d2(total * 1.08), vendas_canceladas: vs.filter((v) => v.vendas % 9 === 0).length, ticket_medio: vendas ? d2(total / vendas) : null };
  };
  const periodos: PeriodoVendas[] = [...grupos].sort(([a], [b]) => a.localeCompare(b)).map(([inicio, vs]) => ({ inicio, primeiro_dia: vs[0].dia, ultimo_dia: vs[vs.length - 1].dia, ...soma(vs) }));
  const todas = [...grupos.values()].flat();
  const t = todas.reduce((s2, v) => s2 + v.total, 0) * 1.08;
  const n = todas.reduce((s2, v) => s2 + v.vendas, 0);
  const meio = (m: string, f: number) => ({ meio: m, pagamentos: Math.round(n * f), valor: d2(t * f) });
  return {
    disponivel: true, de, ate, agrupar, periodos, totais: soma(todas),
    por_meio: todas.length ? [meio('credito', 0.45), meio('debito', 0.26), meio('pix', 0.24), meio('outro', 0.05)] : [],
    sincronizacao: { ultimo_sucesso_em: new Date(Date.now() - 18 * 60_000).toISOString(), falhas_seguidas: 0, atrasada: false },
    observacao: 'Receita líquida = produtos − descontos − devoluções. A taxa de serviço fica fora da receita (H2). Recebido por meio é o registrado no PDV, não o crédito no banco.',
  };
}

/** Sem regra aprovada: a simulação nas quatro bases (apuracao.participacoes), como o 409 do backend manda. */
function simulacaoParticipacao(mes: string): SimulacaoParticipacao {
  const r = calcularMes(mes);
  const base = (v: string | null | undefined) => ({ valor_base: v ?? null, valor: v === null || v === undefined ? null : d2(Number(v) * 0.4) });
  return {
    Roll: {
      percentual: '40.000',
      bases: r.disponivel
        ? { receita_liquida: base(r.receita.receita_liquida), margem_bruta: base(r.margem_bruta), resultado_operacional: base(r.resultado_operacional), resultado_gerencial: base(r.resultado_gerencial) }
        : { receita_liquida: base(null), margem_bruta: base(null), resultado_operacional: base(null), resultado_gerencial: base(null) },
    },
  };
}

/** Tipo do vínculo (tabela conciliacoes) a partir da ação usada. */
function tipoVinculo(acao: string, classificacao?: string) {
  if (acao === 'classificar') return classificacao ?? 'nao_operacional';
  if (acao === 'liquidar_vendas') return 'vendas';
  if (acao === 'vincular_receita' || acao === 'registrar_receita') return 'outra_receita';
  return 'pagamento';
}

/** GET movimento: `saida_movimento` + vínculos (`saida_vinculo`), arquivos e histórico, como api_conciliacao.py. */
function detalheMovimento(m: Mov) {
  return {
    ...m,
    vinculos: E.vinculos.filter((v) => v.movimento_id === m.id).map((v) => ({
      id: v.id, tipo: v.tipo, valor: v.valor, pagamento_id: v.pagamento_criado ?? null, outra_receita_id: null, movimento_par_id: null,
      vendas: null, criados: v.despesa_criada ? { despesa_id: v.despesa_criada } : {}, origem: 'painel', evidencias: [], observacao: v.descricao || null,
      status: v.situacao, criado_por: 'Usuário (demo)', criado_em: v.criado_em, desfeita_por: v.situacao === 'desfeita' ? 'Usuário (demo)' : null, desfeita_em: v.desfeito_em, desfeita_motivo: v.motivo,
    })),
    arquivos: [{ importacao_id: m.importacao_id, linha: 1, novo: true }],
    historico: [],
  };
}

// Exportados para a Visão Geral --------------------------------------------------------------------------------------

export function blocoFinanceiroVisaoDemo(): NonNullable<VisaoGeral['financeiro']> {
  montar();
  const r = resumoFinanceiro();
  return { receita_hoje: r.hoje.receita, receita_mes: r.mes.receita, receita_mes_anterior_ate_o_mesmo_dia: r.mes.receita_mes_anterior_ate_o_mesmo_dia, resultado_parcial: r.mes.resultado_parcial, qualidade: r.mes.qualidade.nivel, contas: r.contas, conciliacao_mes_anterior: r.conciliacao_mes_anterior };
}

export function radarDemo(): RadarInsight[] {
  const hoje = hojeFortaleza();
  const periodo = { de: dia(-29, hoje), ate: hoje, comparado_com: { de: dia(-59, hoje), ate: dia(-30, hoje) } };
  const base = { periodo, ocorrencias: 1, criado_em: new Date(Date.now() - 2 * 86400_000).toISOString(), atualizado_em: new Date(Date.now() - 3 * 3600_000).toISOString(), status: 'pendente' as const };
  return [
    { ...base, id: 7, tipo: 'custo_produto_alta', severidade: 'critico', titulo: 'O custo do Cappuccino subiu 38% com a alta do leite integral', problema: 'Custo estimado por unidade foi de R$ 2,10 para R$ 2,90, com o mesmo preço de venda.', acao_sugerida: 'Conferir o preço de compra do leite e a ficha do cappuccino; avaliar o preço de venda.', evidencias: { custo_unitario_antes: '2.100000', custo_unitario_depois: '2.900000', variacao_pct: '38.1', quantidade: '412.000', principal_insumo: { insumo: 'Leite integral', variacao_preco_compra_pct: '41.0' } }, fonte: 'consumo teórico (fichas × vendas da Eyemobile)', qualidade: 'confiavel', rota: `/admin/estoque/analises/cardapio?de=${periodo.de}&ate=${hoje}` },
    { ...base, id: 9, tipo: 'despesa_fora_padrao', severidade: 'atencao', titulo: 'Manutenção 3× acima da média dos últimos 3 meses', problema: 'R$ 1.640 em manutenção no último mês contra média de R$ 520.', acao_sugerida: 'Ver os lançamentos de manutenção e se algum é investimento (equipamento, reforma).', evidencias: { categoria: 'manutencao', mes: '1640.00', media_3_meses: '520.00' }, fonte: 'despesas confirmadas', qualidade: 'confiavel', rota: '/admin/financeiro/lancamentos?categoria=manutencao' },
    { ...base, id: 11, tipo: 'alto_volume_margem_baixa', severidade: 'atencao', titulo: 'Roll de Pistache vende muito com margem abaixo do grupo', problema: 'É o 2º mais vendido dos rolls, com margem estimada de 41% (média do grupo: 58%).', acao_sugerida: 'Revisar a porção de pistache na ficha ou o preço.', evidencias: { margem_estimada_pct: '41.0', media_grupo_pct: '58.0', quantidade: '286.000' }, fonte: 'Cardápio Inteligente (fichas × vendas)', qualidade: 'parcial', rota: '/admin/estoque/analises/cardapio' },
    { ...base, id: 12, tipo: 'compra_fora_historico', severidade: 'info', titulo: 'Compra no Atacadão 2,4× maior que a média', problema: 'Nota de R$ 3.180 contra média de R$ 1.320 nas últimas compras.', acao_sugerida: 'Confirmar se foi estoque para evento ou erro de quantidade.', evidencias: { valor: '3180.00', media: '1320.00' }, fonte: 'compras conferidas', qualidade: 'confiavel', rota: '/admin/estoque/compras' },
  ];
}

// Arquivo fictício (SVG) com o selo DEMONSTRAÇÃO --------------------------------------------------------------------

function svgArquivo(a: Arquivo) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const linhas = a.linhas.map((l, i) => `<text x="40" y="${150 + i * 44}" font-size="${i === 1 ? 34 : 24}" font-weight="${i === 1 ? 700 : 400}" fill="#24150f">${esc(l)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780" viewBox="0 0 600 780"><rect width="600" height="780" fill="#fffdf8"/><rect x="20" y="20" width="560" height="740" fill="none" stroke="#d5cdc4" stroke-dasharray="6 6"/><text x="40" y="90" font-size="28" font-weight="700" fill="#670d27">${esc(a.titulo)}</text>${linhas}<text x="300" y="640" text-anchor="middle" font-size="40" font-weight="800" fill="#c98a45" opacity=".55" transform="rotate(-18 300 640)">DEMONSTRAÇÃO</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Rotas -------------------------------------------------------------------------------------------------------------

const UUID = '([0-9a-zA-Z-]{36})';
const R = (s: string) => new RegExp(`^${s}$`);
const achaDespesa = (i: string) => {
  montar();
  const d = E.despesas.find((x) => x.id === i);
  if (!d) throw new ErroDemo(404, 'nao_encontrado', 'Despesa não encontrada.');
  return d;
};
const conferirVersao = (atual: number, enviada: unknown) => {
  if (typeof enviada === 'number' && enviada !== atual) throw new ErroDemo(409, 'conflito_versao', 'Alguém alterou isto antes de você.', { versao: atual });
};
function recalcularParcela(p: ParcelaSaida) {
  const pago = p.pagamentos.filter((x) => !x.estornado_em).reduce((s, x) => s + Number(x.valor), 0);
  p.valor_pago = d2(pago);
  p.saldo = d2(Math.max(0, Number(p.valor) - pago));
  p.situacao = Number(p.saldo) < 0.005 ? 'paga' : 'aberta';
}
function pagarParcela(parcelaId: string, valor: number, pago_em: string, forma: FormaPagamento, origem: string, ident: string | null = null) {
  const d = E.despesas.find((x) => x.parcelas.some((p) => p.id === parcelaId));
  if (!d) throw new ErroDemo(404, 'nao_encontrado', 'Conta não encontrada.');
  const p = d.parcelas.find((x) => x.id === parcelaId)!;
  if (p.situacao === 'paga') throw new ErroDemo(409, 'parcela_paga', 'Esta conta já está paga.');
  if (ident && E.despesas.some((x) => x.parcelas.some((pp) => pp.pagamentos.some((pg) => pg.identificador_transacao === ident && !pg.estornado_em)))) throw new ErroDemo(409, 'identificador_repetido', 'Identificador de transação já usado.');
  if (d.valor_a_confirmar) {
    // Conta variável: o valor real paga e fixa a conta do mês (a recorrência não muda).
    p.valor = d2(valor);
    d.valor = d2(valor);
    d.valor_a_confirmar = false;
  } else if (valor > Number(p.saldo) + 0.005) throw new ErroDemo(422, 'valor_fora_do_saldo', `O valor passa do saldo da conta (R$ ${p.saldo}).`);
  const pg: PagamentoSaida = { id: id(), valor: d2(valor), pago_em, forma, identificador_transacao: ident, arquivo_id: null, origem, conciliacao: 'manual', registrado_por: 'Usuário (demo)', criado_em: agora(), estornado_em: null, estorno_motivo: null };
  p.pagamentos.push(pg);
  recalcularParcela(p);
  d.historico.push({ em: agora(), acao: 'pagar', ator: 'Usuário (demo)', ator_tipo: 'usuario', dados: { valor: pg.valor } });
  return { d, p, pg };
}

async function lerMultipart(c: Contexto) {
  try {
    return await c.request.formData();
  } catch {
    throw new ErroDemo(422, 'regra_violada', 'Envie o arquivo.');
  }
}

export const ROTAS_FINANCEIRO: Rota[] = [
  ['GET', R('financeiro/categorias'), TODOS, () => CATEGORIAS],
  ['GET', R('financeiro/fornecedores'), TODOS, ({ query }) => { montar(); const b = (query.get('busca') ?? '').toLowerCase(); return E.fornecedores.filter((f) => f.nome.toLowerCase().includes(b)).slice(0, 20); }],
  ['GET', R('financeiro/resumo'), GERENCIA, () => { montar(); return resumoFinanceiro(); }],
  ['GET', R('financeiro/revisao'), GERENCIA, () => {
    montar();
    const desp = vivas().filter((d) => d.status === 'em_revisao').map((d) => ({ id: d.id, descricao: d.descricao, valor: d.valor, competencia: d.competencia, categoria: d.categoria_codigo, motivos_revisao: d.motivos_revisao, origem: d.origem, arquivo_id: d.arquivo_id, criado_em: d.criado_em, versao: d.versao, fornecedor: d.fornecedor?.nome ?? null }));
    const docs = E.documentos.filter((d) => !d.resolvido).map(({ resolvido, ...d }) => { void resolvido; return d; });
    return { despesas: { total: desp.length, itens: desp }, documentos: { total: docs.length, itens: docs } };
  }],
  ['GET', R('financeiro/lancamentos'), GERENCIA, ({ query, papel }) => {
    montar();
    const de = query.get('de') ?? '';
    const ate = query.get('ate') ?? '';
    const itens: Lancamento[] = [];
    for (const v of E.vendas.filter((x) => x.dia >= de && x.dia <= ate)) itens.push({ tipo: 'venda_dia', id: `1:${v.dia}`, data: v.dia, descricao: 'Vendas PDV', valor: d2(v.total), sinal: 1, categoria: null, origem: 'eyemobile', fornecedor_id: null, fornecedor: null, status: 'confirmada', tem_comprovante: false, compra_id: null, despesa_id: null, detalhes: { vendas: v.vendas, taxa_servico: d2(v.total * 0.08), total_vendido: d2(v.total * 1.035), descontos: d2(v.total * 0.03), recebido_pdv: d2(v.total * 1.08) } });
    for (const d of E.despesas.filter((x) => x.competencia >= de && x.competencia <= ate)) itens.push({ tipo: 'despesa', id: d.id, data: d.competencia, descricao: d.descricao, valor: d.valor, sinal: -1, categoria: d.categoria_codigo, origem: d.origem, fornecedor_id: d.fornecedor?.id ?? null, fornecedor: d.fornecedor?.nome ?? null, status: d.status, tem_comprovante: !!d.arquivo_id, compra_id: d.compra_id, despesa_id: d.id, detalhes: { motivos_revisao: d.motivos_revisao, valor_a_confirmar: d.valor_a_confirmar, versao: d.versao } });
    for (const d of E.despesas) for (const p of d.parcelas) for (const pg of p.pagamentos.filter((x) => x.pago_em >= de && x.pago_em <= ate)) itens.push({ tipo: 'pagamento', id: pg.id, data: pg.pago_em, descricao: d.descricao, valor: pg.valor, sinal: -1, categoria: d.categoria_codigo, origem: pg.origem, fornecedor_id: d.fornecedor?.id ?? null, fornecedor: d.fornecedor?.nome ?? null, status: pg.estornado_em ? 'estornado' : 'confirmado', tem_comprovante: !!pg.arquivo_id, compra_id: d.compra_id, despesa_id: d.id, detalhes: { forma: pg.forma, parcela_id: p.id, parcela: p.numero, conciliacao: pg.conciliacao } });
    for (const r of E.receitas.filter((x) => x.competencia >= de && x.competencia <= ate)) itens.push({ tipo: 'outra_receita', id: r.id, data: r.competencia, descricao: r.descricao, valor: r.valor, sinal: 1, categoria: null, origem: 'painel', fornecedor_id: null, fornecedor: null, status: r.status, tem_comprovante: false, compra_id: null, despesa_id: null, detalhes: { recebido_em: r.recebido_em } });
    const tipo = query.get('tipo');
    const cat = query.get('categoria');
    const org = query.get('origem');
    const st = query.get('status');
    const b = query.get('busca')?.toLowerCase();
    const f = itens.filter((l) => (!tipo || l.tipo === tipo) && (!cat || l.categoria === cat) && (!org || l.origem === org) && (!st || l.status === st) && (veSocietario(papel) || !ehRetirada(l.categoria)) && (!b || `${l.descricao} ${l.fornecedor ?? ''}`.toLowerCase().includes(b))).sort((a, b2) => b2.data.localeCompare(a.data));
    const soma = (fn: (l: Lancamento) => boolean) => d2(f.filter(fn).reduce((s, l) => s + Number(l.valor), 0));
    return { ...paginar(f, query), totais: { receita_pdv: soma((l) => l.tipo === 'venda_dia'), outras_receitas: soma((l) => l.tipo === 'outra_receita' && l.status === 'confirmada'), despesas_confirmadas: soma((l) => l.tipo === 'despesa' && l.status === 'confirmada'), despesas_em_revisao: soma((l) => l.tipo === 'despesa' && l.status === 'em_revisao'), pagamentos: soma((l) => l.tipo === 'pagamento' && l.status === 'confirmado') } };
  }],
  ['POST', R('financeiro/despesas'), GERENCIA, async ({ corpo }) => {
    montar();
    const e = await corpo<{ descricao?: string; valor?: string; competencia?: string; categoria?: string; fornecedor?: { nome?: string | null; documento?: string | null } | null; arquivo_id?: string | null; parcelas?: { vencimento: string; valor: string }[] | null; pagamento?: { pago_em: string; forma: FormaPagamento } | null }>();
    if (!e.descricao || !e.valor || Number(e.valor) <= 0 || !e.competencia || !e.categoria) throw new ErroDemo(422, 'regra_violada', 'Preencha descrição, valor, data e categoria.');
    if (e.parcelas && Math.abs(e.parcelas.reduce((s, p) => s + Number(p.valor), 0) - Number(e.valor)) > 0.009) throw new ErroDemo(422, 'regra_violada', 'A soma das parcelas difere do valor.');
    const forn = e.fornecedor?.nome ? fornecedor(e.fornecedor.nome, e.fornecedor.documento ?? null) : null;
    const acima = Number(e.valor) > 5000;
    const d = novaDespesa({ descricao: e.descricao, valor: Number(e.valor), competencia: e.competencia, categoria: e.categoria, fornecedor: forn, origem: 'painel', arquivo_id: e.arquivo_id ?? null, status: acima ? 'em_revisao' : 'confirmada', motivos: acima ? ['acima_do_limite'] : [], parcelas: e.pagamento ? [{ vencimento: e.competencia, valor: Number(e.valor), paga_em: e.pagamento.pago_em, forma: e.pagamento.forma }] : e.parcelas ? e.parcelas.map((p) => ({ vencimento: p.vencimento, valor: Number(p.valor) })) : [{ vencimento: e.competencia, valor: Number(e.valor) }] });
    d.criado_em = agora();
    return resposta(201, d);
  }],
  ['GET', R(`financeiro/despesas/${UUID}`), GERENCIA, ({ params }) => achaDespesa(params[0])],
  ['PATCH', R(`financeiro/despesas/${UUID}`), GERENCIA, async ({ params, corpo }) => {
    const d = achaDespesa(params[0]);
    const c = await corpo<{ versao: number; motivo: string; descricao?: string; valor?: string; competencia?: string; categoria?: string }>();
    conferirVersao(d.versao, c.versao);
    exigirMotivo(c.motivo);
    if (c.categoria && d.rateio.length) throw new ErroDemo(409, 'despesa_com_rateio', 'A categoria desta despesa vem dos itens da compra.');
    const antes = { descricao: d.descricao, valor: d.valor, competencia: d.competencia, categoria: d.categoria_codigo };
    if (c.descricao) d.descricao = c.descricao;
    if (c.valor) {
      if (d.parcelas.some((p) => p.pagamentos.some((x) => !x.estornado_em)) && Number(c.valor) < d.parcelas.reduce((s, p) => s + Number(p.valor_pago), 0)) throw new ErroDemo(409, 'tem_pagamento', 'O novo valor é menor que o já pago.');
      d.valor = d2(Number(c.valor));
      if (d.parcelas.length === 1) { d.parcelas[0].valor = d.valor; recalcularParcela(d.parcelas[0]); }
    }
    if (c.competencia) d.competencia = c.competencia;
    if (c.categoria) { d.categoria_codigo = c.categoria; d.grupo = grupoDe(c.categoria); d.motivos_revisao = d.motivos_revisao.filter((m) => m !== 'categoria_a_classificar'); }
    d.versao++;
    d.historico.push({ em: agora(), acao: 'corrigir', ator: 'Usuário (demo)', ator_tipo: 'usuario', dados: { antes, motivo: c.motivo } });
    return d;
  }],
  ['POST', R(`financeiro/despesas/${UUID}/confirmar`), GERENCIA, async ({ params, corpo }) => {
    const d = achaDespesa(params[0]);
    const { categoria } = await corpo<{ categoria?: string }>();
    if (d.status === 'cancelada') throw new ErroDemo(409, 'despesa_cancelada', 'Despesa cancelada.');
    if (categoria) { d.categoria_codigo = categoria; d.grupo = grupoDe(categoria); }
    if (d.categoria_codigo === 'a_classificar') throw new ErroDemo(422, 'categoria_obrigatoria', 'Escolha a categoria antes de confirmar.');
    d.status = 'confirmada';
    d.motivos_revisao = [];
    d.confirmado_em = agora();
    d.versao++;
    d.historico.push({ em: agora(), acao: 'confirmar', ator: 'Usuário (demo)', ator_tipo: 'usuario', dados: { categoria: d.categoria_codigo } });
    return d;
  }],
  ['POST', R(`financeiro/despesas/${UUID}/cancelar`), GERENCIA, async ({ params, corpo }) => {
    const d = achaDespesa(params[0]);
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    if (d.parcelas.some((p) => p.pagamentos.some((x) => !x.estornado_em))) throw new ErroDemo(409, 'tem_pagamento', 'A despesa tem pagamento: estorne o pagamento antes de cancelar.');
    d.status = 'cancelada';
    d.cancelado_em = agora();
    d.cancelado_motivo = motivo;
    d.parcelas.forEach((p) => (p.situacao = 'cancelada'));
    d.versao++;
    return d;
  }],
  ['POST', R(`financeiro/revisao/documentos/${UUID}/resolver`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const doc = E.documentos.find((x) => x.id === params[0]);
    if (!doc) throw new ErroDemo(404, 'nao_encontrado', 'Documento não encontrado.');
    const r = await corpo<{ acao: string; categoria?: string; parcela_id?: string; motivo?: string }>();
    if (doc.resolvido && doc.resolvido !== r.acao) throw new ErroDemo(409, 'ja_resolvido', 'Este documento já foi resolvido com outra decisão.');
    if (doc.resolvido) return { id: doc.id, situacao: doc.resolvido };
    const valor = Number(doc.extraido.valor ?? 0);
    if (r.acao === 'pagar_parcela') {
      if (!r.parcela_id) throw new ErroDemo(422, 'regra_violada', 'Escolha a conta.');
      const { pg } = pagarParcela(r.parcela_id, valor, doc.extraido.data ?? hojeFortaleza(), (doc.extraido.forma as FormaPagamento) ?? 'pix', 'julia', doc.extraido.identificador_transacao ?? null);
      pg.arquivo_id = doc.arquivo_id;
    } else if (r.acao === 'registrar_despesa') {
      if (!r.categoria) throw new ErroDemo(422, 'regra_violada', 'Escolha a categoria.');
      if (!valor) throw new ErroDemo(422, 'regra_violada', 'O documento não tem valor legível.');
      const dt = doc.extraido.data ?? hojeFortaleza();
      novaDespesa({ descricao: doc.extraido.recebedor_nome ?? doc.extraido.descricao ?? 'Comprovante da Júlia', valor, competencia: dt, categoria: r.categoria, origem: 'julia', arquivo_id: doc.arquivo_id, parcelas: [{ vencimento: dt, valor, paga_em: dt }] });
    } else if (r.acao === 'descartar') exigirMotivo(r.motivo);
    else throw new ErroDemo(422, 'regra_violada', 'Ação desconhecida.');
    doc.resolvido = r.acao;
    return { id: doc.id, situacao: r.acao };
  }],
  ['POST', R(`financeiro/comprovantes/${UUID}/enviar-para-compras`), GERENCIA, ({ params }) => {
    montar();
    const doc = E.documentos.find((x) => x.id === params[0]);
    if (!doc) throw new ErroDemo(404, 'nao_encontrado', 'Documento não encontrado.');
    if (doc.resolvido && doc.resolvido !== 'compras') throw new ErroDemo(409, 'ja_resolvido', 'Este documento já foi resolvido.');
    doc.resolvido = 'compras';
    return { id: doc.id, situacao: 'encaminhado_estoque', compra_id: id(), compra_nova: true };
  }],
  ['GET', R('financeiro/contas-a-pagar'), GERENCIA, ({ query }) => {
    montar();
    const hoje = hojeFortaleza();
    const s = query.get('situacao') ?? 'abertas';
    const de = query.get('de');
    let l = contasAPagar();
    if (s === 'vencidas') l = l.filter((c) => c.situacao === 'aberta' && c.vencimento < hoje);
    else if (s === 'hoje') l = l.filter((c) => c.situacao === 'aberta' && c.vencimento === hoje);
    else if (s === 'proximas') l = l.filter((c) => c.situacao === 'aberta' && c.vencimento > hoje && c.vencimento <= dia(7, hoje));
    else if (s === 'abertas') l = l.filter((c) => c.situacao === 'aberta');
    else if (s === 'pagas') l = l.filter((c) => c.situacao === 'paga');
    if (de) l = l.filter((c) => c.vencimento >= de);
    // Como consultas.contas_a_pagar: pagas da mais recente para a mais antiga; o resto por vencimento.
    l.sort((a, b) => (s === 'pagas' ? b.vencimento.localeCompare(a.vencimento) : a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao)));
    return { ...paginar(l, query), totais: { saldo: d2(l.reduce((x, c) => x + Number(c.saldo), 0)), valor: d2(l.reduce((x, c) => x + Number(c.valor), 0)) } };
  }],
  ['POST', R(`financeiro/parcelas/${UUID}/pagamentos`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const e = await corpo<{ pago_em: string; forma: FormaPagamento; valor: string; identificador_transacao?: string | null; arquivo_id?: string | null }>();
    if (!e.valor || Number(e.valor) <= 0) throw new ErroDemo(422, 'regra_violada', 'Informe o valor.');
    if (e.pago_em > hojeFortaleza()) throw new ErroDemo(422, 'data_futura', 'A data do pagamento não pode ser no futuro.');
    const { p, pg } = pagarParcela(params[0], Number(e.valor), e.pago_em, e.forma, 'painel', e.identificador_transacao ?? null);
    pg.arquivo_id = e.arquivo_id ?? null;
    return resposta(201, p);
  }],
  ['POST', R(`financeiro/pagamentos/${UUID}/estornar`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    for (const d of E.despesas) for (const p of d.parcelas) {
      const pg = p.pagamentos.find((x) => x.id === params[0]);
      if (!pg) continue;
      if (E.vinculos.some((v) => v.situacao === 'ativa' && v.pagamento_criado === pg.id)) throw new ErroDemo(409, 'pagamento_conciliado', 'Este pagamento está conciliado com o extrato: desfaça a conciliação antes.');
      if (!pg.estornado_em) {
        pg.estornado_em = agora();
        pg.estorno_motivo = motivo;
        recalcularParcela(p);
      }
      return p;
    }
    throw new ErroDemo(404, 'nao_encontrado', 'Pagamento não encontrado.');
  }],
  ['POST', R('financeiro/outras-receitas'), GERENCIA, async ({ corpo, request }) => {
    montar();
    const e = await corpo<{ descricao?: string; valor?: string; competencia?: string; recebido_em?: string | null }>();
    if (!e.descricao?.trim() || !e.valor || Number(e.valor) <= 0 || !e.competencia) throw new ErroDemo(422, 'regra_violada', 'Preencha descrição, valor e competência.');
    const chave = request.headers.get('Idempotency-Key');
    const ja = chave ? E.receitas.find((x) => x.chave === chave) : undefined;
    const item = ja ?? { id: id(), descricao: e.descricao.trim(), valor: d2(Number(e.valor)), competencia: e.competencia, recebido_em: e.recebido_em ?? null, status: 'confirmada' as const, chave };
    if (!ja) E.receitas.push(item);
    return resposta(201, { id: item.id, descricao: item.descricao, valor: item.valor, competencia: item.competencia, recebido_em: item.recebido_em, status: item.status });
  }],
  ['POST', R(`financeiro/outras-receitas/${UUID}/cancelar`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    const item = E.receitas.find((x) => x.id === params[0]);
    if (!item) throw new ErroDemo(404, 'nao_encontrado', 'Receita não encontrada.');
    item.status = 'cancelada';
    return { id: item.id, status: item.status };
  }],
  ['GET', R('financeiro/taxas-pagamento'), GERENCIA, () => { montar(); return [...E.taxas].sort((a, b) => a.meio.localeCompare(b.meio) || a.vigente_de.localeCompare(b.vigente_de)); }],
  ['POST', R('financeiro/taxas-pagamento'), GERENCIA, async ({ corpo }) => {
    montar();
    const e = await corpo<{ meio?: MeioPdv; taxa_percentual?: string; prazo_dias?: number; vigente_de?: string }>();
    if (!e.meio || !['credito', 'debito', 'pix', 'outro'].includes(e.meio) || e.taxa_percentual === undefined || !(Number(e.taxa_percentual) >= 0 && Number(e.taxa_percentual) < 30) || !e.vigente_de) throw new ErroDemo(422, 'regra_violada', 'Informe meio, taxa (0 a 30%) e vigência.');
    const prazo = e.prazo_dias ?? 0;
    // Mesmo meio e mesma data substituem (ON CONFLICT do backend).
    const ja = E.taxas.find((t) => t.meio === e.meio && t.vigente_de === e.vigente_de);
    if (ja) { ja.taxa_percentual = e.taxa_percentual; ja.prazo_dias = prazo; } else E.taxas.push({ id: E.taxas.length + 1, meio: e.meio, taxa_percentual: e.taxa_percentual, prazo_dias: prazo, vigente_de: e.vigente_de });
    return resposta(201, { meio: e.meio, taxa_percentual: e.taxa_percentual, prazo_dias: prazo, vigente_de: e.vigente_de });
  }],
  ['GET', R('financeiro/recorrencias'), GERENCIA, ({ query }) => {
    montar();
    const hoje = hojeFortaleza();
    const ativas = query.get('ativas') !== 'false';
    return E.recorrencias.filter((r) => !ativas || r.ativo).map((r) => {
      const prox = [0, 1, 2].map((i) => { const m = mesMais(mesDe(hoje), i); return { competencia: `${m}-01`, vencimento: diaNoMes(m, r.dia_vencimento) }; }).filter((x) => x.vencimento >= hoje).slice(0, 3);
      return { ...r, proximas: r.ativo ? prox : [] };
    });
  }],
  ['POST', R('financeiro/recorrencias'), GERENCIA, async ({ corpo }) => {
    montar();
    const e = await corpo<{ descricao: string; categoria: string; valor_previsto: string; valor_variavel?: boolean; dia_vencimento: number; intervalo_meses?: number; inicio: string; fim?: string | null; fornecedor?: { nome?: string | null } | null; antecedencia_dias?: number }>();
    if (!e.descricao || !e.categoria || !e.valor_previsto) throw new ErroDemo(422, 'regra_violada', 'Preencha os campos.');
    const forn = e.fornecedor?.nome ? fornecedor(e.fornecedor.nome) : null;
    const r: Recorrencia = { id: id(), descricao: e.descricao, categoria_codigo: e.categoria, fornecedor: forn ? { id: forn.id, nome: forn.nome } : null, valor_previsto: d2(Number(e.valor_previsto)), valor_variavel: !!e.valor_variavel, dia_vencimento: e.dia_vencimento, intervalo_meses: e.intervalo_meses ?? 1, inicio: e.inicio, fim: e.fim ?? null, antecedencia_dias: e.antecedencia_dias ?? 45, ativo: true, versao: 1, proximas: [] };
    E.recorrencias.push(r);
    return resposta(201, r);
  }],
  ['PATCH', R(`financeiro/recorrencias/${UUID}`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const r = E.recorrencias.find((x) => x.id === params[0]);
    if (!r) throw new ErroDemo(404, 'nao_encontrado', 'Conta fixa não encontrada.');
    const e = await corpo<{ versao: number; encerrar_em?: string; valor_previsto?: string; descricao?: string; dia_vencimento?: number; valor_variavel?: boolean }>();
    conferirVersao(r.versao, e.versao);
    // Encerrar: a conta fixa continua ativa até a data (o backend só deixa de gerar depois dela).
    if (e.encerrar_em) { r.fim = e.encerrar_em; if (e.encerrar_em <= hojeFortaleza()) r.ativo = false; }
    if (e.valor_previsto) r.valor_previsto = d2(Number(e.valor_previsto));
    if (e.descricao) r.descricao = e.descricao;
    if (e.dia_vencimento) r.dia_vencimento = e.dia_vencimento;
    if (e.valor_variavel !== undefined) r.valor_variavel = e.valor_variavel;
    r.versao++;
    return r;
  }],
  ['GET', R('financeiro/relatorios/evolucao'), GERENCIA, ({ query }) => {
    montar();
    const n = Math.min(24, Number(query.get('meses') ?? 12));
    const atual = mesDe(hojeFortaleza());
    return Array.from({ length: n }, (_, i) => evolucaoMes(mesMais(atual, i - n + 1)));
  }],
  ['GET', R('financeiro/relatorios/resultado'), GERENCIA, ({ query, papel }) => { montar(); return semRetirada(calcularMes(query.get('mes') ?? mesDe(hojeFortaleza())), papel); }],
  ['GET', R('financeiro/relatorios/vendas'), GERENCIA, ({ query }) => {
    montar();
    const de = query.get('de') ?? '';
    const ate = query.get('ate') ?? '';
    const agrupar = (query.get('agrupar') ?? 'dia') as AgrupamentoVendas;
    if (!['dia', 'semana', 'mes'].includes(agrupar)) throw new ErroDemo(422, 'regra_violada', 'Agrupe por dia, semana ou mes.');
    const dias = (new Date(`${ate}T12:00Z`).getTime() - new Date(`${de}T12:00Z`).getTime()) / 86400_000;
    if (!de || !ate || dias < 0 || dias > 400) throw new ErroDemo(422, 'periodo_invalido', 'Período de até 400 dias.');
    return vendasPorPeriodo(de, ate, agrupar);
  }],
  ['GET', R('financeiro/relatorios/despesas-por-categoria'), GERENCIA, ({ query, papel }) => {
    montar();
    const de = query.get('de') ?? '';
    const ate = query.get('ate') ?? '';
    const desp = vivas().filter((d) => d.status === 'confirmada' && d.competencia >= de && d.competencia <= ate && (veSocietario(papel) || d.grupo !== 'retirada'));
    const total = desp.reduce((s, d) => s + Number(d.valor), 0);
    const por = new Map<string, { valor: number; n: number }>();
    for (const d of desp) { const x = por.get(d.categoria_codigo) ?? { valor: 0, n: 0 }; x.valor += Number(d.valor); x.n++; por.set(d.categoria_codigo, x); }
    return { total: d2(total), itens: [...por].map(([cat, x]) => ({ grupo: grupoDe(cat), categoria: cat, nome: CATEGORIAS.find((c) => c.codigo === cat)?.nome ?? cat, valor: d2(x.valor), despesas: x.n, pct: total ? d2((x.valor / total) * 100) : null })) };
  }],
  ['GET', R('financeiro/fechamento/(\\d{4}-\\d{2})'), GERENCIA, ({ params }) => { montar(); return fechamento(params[0]); }],
  ['GET', R('financeiro/apuracoes/(\\d{4}-\\d{2})'), GERENCIA, ({ params }) => { montar(); const a = E.apuracoes.get(params[0]) ?? { status: 'rascunho', excecao: null }; return { mes: `${params[0]}-01`, status: a.status, excecao_conciliacao: a.excecao }; }],
  ['GET', R('financeiro/apuracoes/(\\d{4}-\\d{2})/participacao'), ADMIN, ({ params }) => {
    montar();
    throw new ErroDemo(409, 'regra_nao_aprovada', 'A regra de participação ainda não foi aprovada: só há simulação.', { simulacao: simulacaoParticipacao(params[0]) });
  }],
  ['POST', R('financeiro/apuracoes/(\\d{4}-\\d{2})/conferir'), GERENCIA, ({ params }) => {
    montar();
    if (params[0] >= mesDe(hojeFortaleza())) throw new ErroDemo(409, 'mes_em_andamento', 'O mês ainda não terminou.');
    E.apuracoes.set(params[0], { status: 'conferida', excecao: null });
    return { mes: `${params[0]}-01`, status: 'conferida' };
  }],
  ['POST', R('financeiro/apuracoes/(\\d{4}-\\d{2})/fechar'), ADMIN, async ({ params, corpo }) => {
    montar();
    const a = E.apuracoes.get(params[0]);
    if (!a || a.status !== 'conferida') throw new ErroDemo(409, 'nao_conferida', 'Confira a apuração antes de fechar.');
    const { excecao_conciliacao } = await corpo<{ excecao_conciliacao?: string }>();
    const conc = conciliacaoMes(params[0]);
    if (!conc.conciliado && !excecao_conciliacao) throw new ErroDemo(409, 'conciliacao_pendente', 'O extrato do mês não está conciliado.', { estado: conc.estado, contas: conc.contas.map((c) => c.conta.apelido) });
    if (excecao_conciliacao && excecao_conciliacao.trim().length < 10) throw new ErroDemo(422, 'motivo_obrigatorio', 'Explique a exceção (10+ caracteres).');
    E.apuracoes.set(params[0], { status: 'fechada', excecao: excecao_conciliacao ? { motivo: excecao_conciliacao, por: 'Ana (demo)' } : null });
    return { mes: `${params[0]}-01`, status: 'fechada' };
  }],
  ['POST', R('financeiro/apuracoes/(\\d{4}-\\d{2})/reabrir'), ADMIN, async ({ params, corpo }) => {
    montar();
    exigirMotivo((await corpo<{ motivo: string }>()).motivo);
    E.apuracoes.set(params[0], { status: 'rascunho', excecao: null });
    return { mes: `${params[0]}-01`, status: 'rascunho' };
  }],
  // Banco
  ['GET', R('financeiro/contas-bancarias'), GERENCIA, () => { montar(); return E.contas; }],
  ['POST', R('financeiro/contas-bancarias'), GERENCIA, async ({ corpo }) => {
    montar();
    const e = await corpo<{ instituicao: string; apelido: string; agencia?: string; conta?: string; escopo?: ContaBancaria['escopo'] }>();
    if (!e.instituicao || !e.apelido) throw new ErroDemo(422, 'regra_violada', 'Informe banco e apelido.');
    if (E.contas.some((c) => c.apelido.toLowerCase() === e.apelido.toLowerCase())) throw new ErroDemo(409, 'apelido_repetido', 'Já existe uma conta com esse apelido.');
    const c: ContaBancaria = { id: id(), unidade_negocio_id: 1, instituicao: e.instituicao, codigo_banco: null, apelido: e.apelido, agencia: e.agencia ? `…${e.agencia.slice(-4)}` : null, conta: e.conta ? `…${e.conta.slice(-4)}` : null, reconhece_ofx: false, escopo: e.escopo ?? 'operacional', status: 'ativa', versao: 1, criado_em: agora() };
    E.contas.push(c);
    return resposta(201, c);
  }],
  ['GET', R('financeiro/extratos'), GERENCIA, ({ query }) => { montar(); return paginar(E.importacoes, query); }],
  ['POST', R('financeiro/extratos'), GERENCIA, async (c) => {
    montar();
    const f = await lerMultipart(c);
    const arquivo = f.get('arquivo');
    const conta = E.contas.find((x) => x.id === f.get('conta_id'));
    if (!(arquivo instanceof File) || !conta) throw new ErroDemo(422, 'regra_violada', 'Envie o arquivo e a conta.');
    const nome = arquivo.name.toLowerCase();
    if (!/\.(ofx|csv|txt)$/.test(nome)) throw new ErroDemo(415, 'tipo_de_arquivo_recusado', 'Envie OFX ou CSV.');
    const hoje = hojeFortaleza();
    const ini = `${mesDe(hoje)}-01`;
    if (nome.endsWith('.ofx')) {
      const imp = novaImportacao(conta, 'ofx', ini, hoje, 'arquivo');
      const ja = mov(conta, imp.id, dia(-1, hoje) < ini ? ini : dia(-1, hoje), 'credito', 2380.4, 'PIX RECEBIDO VENDAS', 'possivel');
      ja.candidatos = [{ tipo: 'vendas', acao: 'liquidar_vendas', referencia: 'pix', valor: '2380.40', data: ja.data, descricao: 'Vendas em Pix do dia', pontuacao: 70, valor_exato: true, evidencias: [{ codigo: 'valor_de_uma_venda', texto: 'Mesmo valor do Pix vendido no dia (indício, não prova).' }], alertas: [], parametros: { meio: 'pix', de: ja.data, ate: ja.data } }];
      mov(conta, imp.id, hoje, 'debito', 64.0, 'PIX ENVIADO FARMACIA', 'sem_correspondencia');
      imp.resultado = { analisadas: 2, ja_conciliadas: 0, correspondencias_fortes: 0, possiveis: 1, sem_registro: 1, conflitos: 0, duplicadas: 0, por_nivel: { vinculo_confirmado: 0, forte: 0, possivel: 1, ambigua: 0, sem_correspondencia: 1, classificacao_pendente: 0, conflito: 0, duplicado: 0 }, creditos: { quantidade: 1, valor: '2380.40', conciliado: '0.00' }, debitos: { quantidade: 1, valor: '64.00', conciliado: '0.00' } };
      imp.ja_existia = false;
      conta.reconhece_ofx = true;
      return resposta(201, imp);
    }
    const imp = novaImportacao(conta, 'csv', ini, hoje, null);
    imp.status = 'aguardando_mapeamento';
    imp.reconhecimento = { cabecalho: ['Data', 'Histórico', 'Documento', 'Valor', 'Saldo'], colunas: { data: 0, descricao: 1, valor: 3, saldo: 4 }, avisos: ['formato_data_ambiguo'], assinatura: 'demo', amostra: [[`${hoje.slice(8)}/${hoje.slice(5, 7)}/${hoje.slice(0, 4)}`, 'PIX RECEBIDO MARIA', '000123', '1.234,56', '6.234,56'], ['02/10/2026', 'TAR MANUTENCAO CONTA', '', '-35,00', '5.000,00'], ['03/10/2026', 'PAG BOLETO BRISANET', '889', '-289,90', '4.710,10']] };
    imp.mapeamento = { separador: ';', codificacao: 'utf-8-sig', linha_cabecalho: 0, colunas: { data: 0, descricao: 1, valor: 3, saldo: 4 }, formato_data: 'dd/mm/aaaa', decimal: ',' };
    return resposta(201, imp);
  }],
  ['GET', R(`financeiro/extratos/${UUID}`), GERENCIA, ({ params }) => { montar(); const i = E.importacoes.find((x) => x.id === params[0]); if (!i) throw new ErroDemo(404, 'nao_encontrado', 'Importação não encontrada.'); return i; }],
  ['POST', R(`financeiro/extratos/${UUID}/mapeamento`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const imp = E.importacoes.find((x) => x.id === params[0]);
    if (!imp) throw new ErroDemo(404, 'nao_encontrado', 'Importação não encontrada.');
    if (imp.status === 'processada') throw new ErroDemo(409, 'importacao_ja_processada', 'Esta importação já foi processada.');
    const { mapeamento } = await corpo<{ mapeamento: { colunas: Record<string, number> } }>();
    if (mapeamento.colunas.data === undefined || (mapeamento.colunas.valor === undefined && mapeamento.colunas.entrada === undefined && mapeamento.colunas.saida === undefined)) throw new ErroDemo(422, 'csv_sem_colunas', 'Indique data e valor.');
    const conta = E.contas.find((c) => c.id === imp.conta.id)!;
    imp.status = 'processada';
    mov(conta, imp.id, hojeFortaleza(), 'credito', 1234.56, 'PIX RECEBIDO MARIA', 'sem_correspondencia');
    const t = mov(conta, imp.id, hojeFortaleza(), 'debito', 35, 'TAR MANUTENCAO CONTA', 'classificacao_pendente');
    t.classificacao_sugerida = null;
    imp.resultado = { analisadas: 2, ja_conciliadas: 0, correspondencias_fortes: 0, possiveis: 0, sem_registro: 2, conflitos: 0, duplicadas: 0, por_nivel: { vinculo_confirmado: 0, forte: 0, possivel: 0, ambigua: 0, sem_correspondencia: 1, classificacao_pendente: 1, conflito: 0, duplicado: 0 }, creditos: { quantidade: 1, valor: '1234.56', conciliado: '0.00' }, debitos: { quantidade: 1, valor: '35.00', conciliado: '0.00' } };
    imp.contagem.ignoradas = 1;
    return imp;
  }],
  ['POST', R(`financeiro/extratos/${UUID}/cobertura`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const imp = E.importacoes.find((x) => x.id === params[0]);
    if (!imp) throw new ErroDemo(404, 'nao_encontrado', 'Importação não encontrada.');
    const { de, ate } = await corpo<{ de: string; ate: string }>();
    if (imp.periodo.de && de > imp.periodo.de) throw new ErroDemo(422, 'cobertura_menor_que_o_arquivo', 'O arquivo tem movimentos antes dessa data.');
    imp.cobertura = { de, ate, origem: 'confirmada', confirmada_por: 'Usuário (demo)' };
    return imp;
  }],
  ['GET', R('financeiro/conciliacao/movimentos'), GERENCIA, ({ query }) => {
    montar();
    const de = query.get('de') ?? '';
    const ate = query.get('ate') ?? '';
    const dias = (new Date(`${ate}T12:00Z`).getTime() - new Date(`${de}T12:00Z`).getTime()) / 86400_000;
    if (dias > 100) throw new ErroDemo(422, 'periodo_invalido', 'Período de até 100 dias.');
    const conta = query.get('conta_id');
    const sit = query.get('situacao');
    const nivel = query.get('nivel');
    const imp = query.get('importacao_id');
    const l = E.movimentos.filter((m) => m.data >= de && m.data <= ate && (!conta || m.conta.id === conta) && (!sit || m.situacao === sit) && (!nivel || m.nivel === nivel) && (!imp || m.importacao_id === imp));
    return paginar(l, query);
  }],
  ['GET', R(`financeiro/conciliacao/movimentos/${UUID}`), GERENCIA, ({ params }) => {
    montar();
    const m = E.movimentos.find((x) => x.id === params[0]);
    if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Movimentação não encontrada.');
    return detalheMovimento(m);
  }],
  ['POST', R(`financeiro/conciliacao/movimentos/${UUID}/acoes`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const m = E.movimentos.find((x) => x.id === params[0]);
    if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Movimentação não encontrada.');
    const a = await corpo<Record<string, string> & { versao: number }>();
    conferirVersao(m.versao, a.versao);
    if (m.nivel === 'conflito') throw new ErroDemo(409, 'conflito_identidade_pendente', 'Decida antes se é duplicidade.');
    if (m.situacao === 'conciliado') throw new ErroDemo(409, 'ja_conciliado', 'Já conciliada.');
    if (E.mesesConciliados.has(`${mesDe(m.data)}:${m.conta.id}`)) throw new ErroDemo(409, 'mes_conciliado', 'O mês desta conta foi conciliado: reabra antes.');
    const v: Vinculo = { id: id(), movimento_id: m.id, acao: a.acao, tipo: tipoVinculo(a.acao, a.classificacao), valor: m.saldo_a_conciliar, descricao: '', situacao: 'ativa', criado_em: agora(), desfeito_em: null, motivo: null };
    if (a.acao === 'vincular_pagamento') {
      const pg = E.despesas.flatMap((d) => d.parcelas.flatMap((p) => p.pagamentos.map((x) => ({ x, d })))).find((y) => y.x.id === a.pagamento_id);
      if (!pg) throw new ErroDemo(404, 'nao_encontrado', 'Pagamento não encontrado.');
      if (E.vinculos.some((w) => w.situacao === 'ativa' && w.acao === 'vincular_pagamento' && w.descricao === pg.d.descricao && w.valor === pg.x.valor)) throw new ErroDemo(409, 'pagamento_ja_conciliado', 'Este pagamento já foi conciliado com outra movimentação.');
      v.descricao = pg.d.descricao;
    } else if (a.acao === 'pagar_parcela') {
      const d = E.despesas.find((x) => x.parcelas.some((p) => p.id === a.parcela_id));
      if (d) { const r = pagarParcela(a.parcela_id, Number(m.valor), m.data, (a.forma as FormaPagamento) ?? 'pix', 'extrato'); v.pagamento_criado = r.pg.id; v.descricao = d.descricao; }
      else v.descricao = m.candidatos.find((c) => c.parametros.parcela_id === a.parcela_id)?.descricao ?? 'Conta paga';
    } else if (a.acao === 'registrar_despesa') {
      if (!a.descricao || !a.categoria) throw new ErroDemo(422, 'regra_violada', 'Informe descrição e categoria.');
      const d = novaDespesa({ descricao: a.descricao, valor: Number(m.valor), competencia: a.competencia ?? m.data, categoria: a.categoria, origem: 'extrato', parcelas: [{ vencimento: m.data, valor: Number(m.valor), paga_em: m.data }] });
      v.despesa_criada = d.id;
      v.descricao = `Despesa nova: ${a.descricao}`;
    } else if (a.acao === 'registrar_receita') {
      if (!a.descricao) throw new ErroDemo(422, 'motivo_obrigatorio', 'Descreva a receita.');
      E.receitas.push({ id: id(), descricao: a.descricao, valor: m.valor, competencia: a.competencia ?? m.data, recebido_em: m.data, status: 'confirmada' });
      v.descricao = `Receita nova: ${a.descricao}`;
    } else if (a.acao === 'liquidar_vendas') {
      if (m.direcao !== 'credito') throw new ErroDemo(422, 'direcao_incompativel', 'Só entradas liquidam vendas.');
      if (!temVendas(a.de, a.ate)) throw new ErroDemo(409, 'sem_vendas_no_periodo', 'Não há vendas nesse período.');
      v.descricao = `Repasse de vendas (${a.meio}) de ${a.de} a ${a.ate}`;
    } else if (a.acao === 'classificar') {
      if (a.classificacao === 'nao_operacional' && (!a.observacao || a.observacao.length < 5)) throw new ErroDemo(422, 'motivo_obrigatorio', 'Explique na observação.');
      if (a.classificacao === 'aporte_socio' && m.direcao !== 'credito') throw new ErroDemo(422, 'direcao_incompativel', 'Aporte é entrada.');
      v.descricao = `Classificada: ${a.classificacao.replace(/_/g, ' ')}`;
    } else throw new ErroDemo(422, 'regra_violada', 'Ação desconhecida.');
    E.vinculos.push(v);
    m.situacao = 'conciliado';
    m.valor_conciliado = m.valor;
    m.saldo_a_conciliar = '0.00';
    m.nivel = 'vinculo_confirmado';
    m.versao++;
    return resposta(201, { ...detalheMovimento(m), conciliacao_id: v.id });
  }],
  ['POST', R(`financeiro/conciliacao/movimentos/${UUID}/identidade`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const m = E.movimentos.find((x) => x.id === params[0]);
    if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Movimentação não encontrada.');
    const e = await corpo<{ versao: number; decisao: 'distinto' | 'duplicado' }>();
    conferirVersao(m.versao, e.versao);
    m.conflito = null;
    if (e.decisao === 'duplicado') { m.situacao = 'duplicado'; m.nivel = 'duplicado'; } else { m.nivel = 'sem_correspondencia'; }
    m.versao++;
    return detalheMovimento(m);
  }],
  ['POST', R(`financeiro/conciliacao/vinculos/${UUID}/desfazer`), GERENCIA, async ({ params, corpo }) => {
    montar();
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    const v = E.vinculos.find((x) => x.id === params[0]);
    if (!v) throw new ErroDemo(404, 'nao_encontrado', 'Vínculo não encontrado.');
    const m = E.movimentos.find((x) => x.id === v.movimento_id)!;
    if (E.mesesConciliados.has(`${mesDe(m.data)}:${m.conta.id}`)) throw new ErroDemo(409, 'mes_conciliado', 'O mês foi conciliado: reabra antes.');
    v.situacao = 'desfeita';
    v.desfeito_em = agora();
    v.motivo = motivo;
    if (v.pagamento_criado) for (const d of E.despesas) for (const p of d.parcelas) { const pg = p.pagamentos.find((x) => x.id === v.pagamento_criado); if (pg) { pg.estornado_em = agora(); pg.estorno_motivo = 'Conciliação desfeita'; recalcularParcela(p); } }
    if (v.despesa_criada) { const d = E.despesas.find((x) => x.id === v.despesa_criada); if (d) { d.status = 'cancelada'; d.cancelado_em = agora(); d.cancelado_motivo = 'Conciliação desfeita'; } }
    m.situacao = 'pendente';
    m.valor_conciliado = '0.00';
    m.saldo_a_conciliar = m.valor;
    m.nivel = m.candidatos.length ? 'possivel' : 'sem_correspondencia';
    m.versao++;
    return detalheMovimento(m);
  }],
  ['GET', R('financeiro/conciliacao/meses/(\\d{4}-\\d{2})'), GERENCIA, ({ params }) => { montar(); return conciliacaoMes(params[0]); }],
  ['POST', R(`financeiro/conciliacao/meses/(\\d{4}-\\d{2})/contas/${UUID}/conciliar`), GERENCIA, ({ params }) => {
    montar();
    const [mes, contaId] = params;
    if (mes >= mesDe(hojeFortaleza())) throw new ErroDemo(409, 'mes_em_andamento', 'O mês ainda está em andamento.');
    const conta = E.contas.find((c) => c.id === contaId);
    if (!conta) throw new ErroDemo(404, 'nao_encontrado', 'Conta não encontrada.');
    const e = estadoConta(conta, mes);
    const pend = [...(e.cobertura_integral ? [] : [{ codigo: 'cobertura_incompleta', lacunas: e.lacunas }]), ...(e.pendentes ? [{ codigo: 'movimentos_pendentes', quantidade: e.pendentes }] : []), ...(e.conflitos ? [{ codigo: 'movimentos_conflitos', quantidade: e.conflitos }] : [])];
    if (pend.length) throw new ErroDemo(409, 'pendencias', 'Ainda há pendências nesta conta.', { pendencias: pend });
    E.mesesConciliados.add(`${mes}:${contaId}`);
    return { ...estadoConta(conta, mes), estado_calculado: e.estado, marcado: { por: 'Usuário (demo)', em: agora(), reaberto_por: null, reaberto_em: null, motivo_reabertura: null } };
  }],
  ['POST', R(`financeiro/conciliacao/meses/(\\d{4}-\\d{2})/contas/${UUID}/reabrir`), ADMIN, async ({ params, corpo }) => {
    montar();
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    const conta = E.contas.find((c) => c.id === params[1]);
    if (!conta) throw new ErroDemo(404, 'nao_encontrado', 'Conta não encontrada.');
    if (!E.mesesConciliados.has(`${params[0]}:${params[1]}`)) throw new ErroDemo(409, 'mes_nao_conciliado', 'Este mês não está conciliado nesta conta.');
    E.mesesConciliados.delete(`${params[0]}:${params[1]}`);
    const e = estadoConta(conta, params[0]);
    return { ...e, estado_calculado: e.estado, marcado: { por: 'Usuário (demo)', em: agora(), reaberto_por: 'Usuário (demo)', reaberto_em: agora(), motivo_reabertura: motivo } };
  }],
  ['GET', R('financeiro/conciliacao/repasses'), GERENCIA, ({ query }) => {
    montar();
    const de = query.get('de') ?? '';
    const ate = query.get('ate') ?? '';
    const total = receitaPdv(de, ate);
    const liquidado = E.vinculos.filter((v) => v.situacao === 'ativa' && v.acao === 'liquidar_vendas').reduce((s, v) => s + Number(v.valor), 0);
    const cartao = total * 0.71;
    return {
      periodo: { de, ate },
      meios: [
        { meio: 'cartao', vendido: d2(cartao), liquidado_vinculado: d2(Math.min(cartao, liquidado)), diferenca_a_conferir: d2(cartao - Math.min(cartao, liquidado)), vendido_por_tipo: { credito: d2(cartao * 0.62), debito: d2(cartao * 0.38) } },
        { meio: 'pix', vendido: d2(total * 0.24), liquidado_vinculado: '0.00', diferenca_a_conferir: d2(total * 0.24) },
        { meio: 'dinheiro', vendido: d2(total * 0.05), liquidado_vinculado: '0.00', diferenca_a_conferir: d2(total * 0.05) },
      ],
      aviso: 'Liquidação vinculada não é receita: a receita é a venda do PDV. A diferença é para conferir (taxa, prazo D+1/D+30, antecipação ou o que ainda não caiu).',
    };
  }],
  // Arquivos
  ['POST', R('arquivos'), TODOS, async (c) => {
    montar();
    const f = await lerMultipart(c);
    const a = f.get('arquivo');
    if (!(a instanceof File)) throw new ErroDemo(422, 'regra_violada', 'Envie o arquivo.');
    if (a.size > 15 * 1024 * 1024) throw new ErroDemo(413, 'arquivo_grande_demais', 'Arquivo grande demais.');
    const idA = arquivoFalso(a.name, ['Arquivo enviado na demonstração', a.name, `${Math.round(a.size / 1024)} KB`]);
    return resposta(201, { id: idA, sha256: 'demo', mime: a.type || 'application/octet-stream', tamanho_bytes: a.size, tipo: f.get('tipo') ?? 'documento', ja_existia: false });
  }],
  ['GET', R(`arquivos/${UUID}/url`), TODOS, ({ params }) => {
    montar();
    const a = E.arquivos.get(params[0]);
    if (!a) throw new ErroDemo(404, 'nao_encontrado', 'Documento não encontrado.');
    return { url: svgArquivo(a), expira_em: new Date(Date.now() + 5 * 60_000).toISOString(), mime: a.mime };
  }],
];
