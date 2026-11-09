// Rótulos do Estoque em português de quem trabalha na cozinha, e utilidades comuns às abas.
import { invalidar, useConsulta } from '../../lib/consulta';
import { pode, podeVer } from '../../lib/permissoes';
import { estoque } from '../../lib/api/estoque';
import { pedir } from '../../lib/api/cliente';
import type { Usuario } from '../../lib/sessao';
import { Situacao, Etiqueta, type Tom } from '../../ui/base';
import type { CompraLista, DecisaoCancelamento, EtapaCompra, FonteLeitura, Insumo, MotivoNaoConfiavel, SituacaoCancelamento, SituacaoItem, TipoMovimento, UnidadeBase } from '../../lib/tipos/estoque';

export const atualizarEstoque = () => invalidar('estoque');

/** Permissões do Estoque como o backend decide (app/modulos/usuarios/permissoes.py): visualizar (ler, perda, contagem,
 *  cancelamentos, análises), conferir (compras) e editar (catálogo, fichas, cancelar compra, aceitar nota que não fecha). */
export interface PermissoesEstoque {
  visualizar: boolean;
  conferir: boolean;
  editar: boolean;
}

/** Usa a lista que o backend manda em /admin/auth/me; sem ela (backend antigo), o espelho do papel. */
export function permissoesEstoque(u: Usuario): PermissoesEstoque {
  const lista = Array.isArray(u.permissoes) ? u.permissoes : null;
  const tem = (p: string, reserva: boolean) => (lista ? lista.includes(p) : reserva);
  const modulo = podeVer(u.papel, 'estoque');
  return {
    visualizar: tem('estoque.visualizar', modulo),
    conferir: tem('estoque.conferir', modulo),
    editar: tem('estoque.editar', pode(u.papel, 'estoque.catalogo')),
  };
}

/** Catálogo de insumos ativos: nome e unidade para quem só recebe o id (ex.: itens de um cancelamento). */
export function useCatalogo() {
  const c = useConsulta('estoque/insumos?catalogo', () => estoque.insumos({ limite: 200 }));
  const mapa = new Map((c.dados?.itens ?? []).map((i) => [i.id, i]));
  return { consulta: c, nome: (id: string) => mapa.get(id)?.nome ?? 'Insumo', unidade: (id: string) => mapa.get(id)?.unidade_base ?? null };
}

export const UNIDADE: Record<UnidadeBase, string> = { g: 'gramas (g)', ml: 'mililitros (ml)', un: 'unidades (un)' };
export const UNIDADE_CURTA: Record<UnidadeBase, string> = { g: 'g', ml: 'ml', un: 'un' };

export const CONFIABILIDADE: Record<MotivoNaoConfiavel, { rotulo: string; explica: string }> = {
  baixa_desligada: { rotulo: 'Sem baixa pelas vendas', explica: 'O saldo não desconta o que foi vendido: use como referência e confira pela contagem.' },
  nunca_contado: { rotulo: 'Nunca contado', explica: 'Ninguém contou este insumo ainda. Faça uma contagem para ter um saldo de partida.' },
  ficou_negativo: { rotulo: 'Ficou negativo', explica: 'O saldo calculado ficou abaixo de zero: alguma entrada não foi registrada. Conte de novo.' },
  sem_movimento: { rotulo: 'Sem movimento', explica: 'Ainda não houve compra nem contagem deste insumo.' },
};

export function SituacaoSaldo({ i }: { i: Pick<Insumo, 'saldo_confiavel' | 'motivo_nao_confiavel'> }) {
  if (i.saldo_confiavel) return <Situacao tom="ok">Confiável</Situacao>;
  const m = i.motivo_nao_confiavel;
  return <Situacao tom={m === 'ficou_negativo' ? 'perigo' : m === 'baixa_desligada' ? 'apagado' : 'atencao'}>{m ? CONFIABILIDADE[m].rotulo : 'Não confiável'}</Situacao>;
}

export const ETAPA: Record<EtapaCompra | 'pronta', { rotulo: string; tom: Tom; destaque?: boolean }> = {
  recebida: { rotulo: 'Recebida', tom: 'info' },
  processando: { rotulo: 'Lendo o documento', tom: 'info' },
  itens_extraidos: { rotulo: 'Itens lidos', tom: 'info' },
  associacoes_sugeridas: { rotulo: 'Associando insumos', tom: 'info' },
  aguardando_conferencia: { rotulo: 'Para conferir', tom: 'atencao', destaque: true },
  pronta: { rotulo: 'Pronta para confirmar', tom: 'marca', destaque: true },
  confirmada: { rotulo: 'Confirmada', tom: 'ok' },
  cancelada: { rotulo: 'Cancelada', tom: 'apagado' },
  falhou: { rotulo: 'Não foi possível ler', tom: 'perigo' },
};
export const LENDO: EtapaCompra[] = ['recebida', 'processando', 'itens_extraidos', 'associacoes_sugeridas'];

export function SituacaoCompra({ c }: { c: Pick<CompraLista, 'etapa' | 'etapa_painel' | 'sem_itens' | 'pendentes'> }) {
  if (c.etapa === 'aguardando_conferencia' && c.sem_itens) return <Situacao tom="atencao" destaque>Faltam os produtos</Situacao>;
  const e = ETAPA[c.etapa_painel] ?? ETAPA[c.etapa];
  return <Situacao tom={e.tom} destaque={e.destaque}>{e.rotulo}</Situacao>;
}

export const FONTE: Record<FonteLeitura, string> = {
  xml: 'Nota eletrônica (XML)',
  sefaz_qr: 'Consulta pelo QR Code',
  pdf_texto: 'PDF da nota',
  foto_ia: 'Foto lida por IA',
  manual: 'Digitada',
  comprovante: 'Comprovante de pagamento',
};

export function OrigemCompra({ c }: { c: Pick<CompraLista, 'origem' | 'fonte_leitura'> }) {
  return (
    <span class="linha" style={{ gap: '6px', flexWrap: 'nowrap' }}>
      <Etiqueta tom={c.origem === 'julia' ? 'marca' : 'neutro'}>{c.origem === 'julia' ? 'Júlia' : 'Painel'}</Etiqueta>
      {c.fonte_leitura && <span class="fraco">{FONTE[c.fonte_leitura]}</span>}
    </span>
  );
}

export const SITUACAO_ITEM: Record<SituacaoItem, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: 'Precisa de você', tom: 'atencao' },
  sugerido: { rotulo: 'Sugestão confiável', tom: 'info' },
  confirmado: { rotulo: 'Conferido', tom: 'ok' },
  nao_estoque: { rotulo: 'Não é estoque', tom: 'neutro' },
  ignorado: { rotulo: 'Ignorado', tom: 'apagado' },
};

export const ALERTA: Record<string, string> = {
  unidade_diferente_da_ultima_compra: 'O fornecedor mudou a unidade desde a última compra',
  unidade_incompativel: 'A unidade da nota não combina com a do insumo',
  embalagem_ambigua: 'Embalagem sem conteúdo legível (ex.: “1 CX”)',
  preco_fora_do_padrao: 'Preço muito diferente do custo médio — confira a conversão',
};

export const ERRO_LEITURA: Record<string, string> = {
  nota_ja_registrada: 'Esta nota já foi registrada em outra compra.',
  leitura_falhou: 'Nenhum leitor conseguiu ler o documento.',
  arquivo_ilegivel: 'O arquivo está ilegível.',
};

export const TIPO_MOVIMENTO: Record<TipoMovimento, string> = {
  saldo_inicial: 'Saldo inicial',
  entrada_compra: 'Entrada (recebimento)',
  consumo_venda: 'Venda',
  estorno_consumo: 'Venda cancelada (volta)',
  producao_saida: 'Usado em preparo',
  producao_entrada: 'Preparo produzido',
  perda: 'Perda',
  ajuste_inventario: 'Ajuste por contagem',
  estorno: 'Estorno',
};

/** O que a operação responde sobre uma venda cancelada depois da baixa (consumo.resolver_cancelamento). */
export const DECISAO: Record<DecisaoCancelamento, { rotulo: string; explica: string }> = {
  nao_produzido: { rotulo: 'Não foi preparado', explica: 'Os ingredientes voltam ao estoque (se tinham saído).' },
  produzido_descartado: { rotulo: 'Preparado e descartado', explica: 'O que saiu vira perda: não volta para a prateleira.' },
  produzido_aproveitado: { rotulo: 'Preparado e aproveitado', explica: 'Foi aproveitado em outra coisa: os ingredientes voltam (se tinham saído).' },
  nao_apurado: { rotulo: 'Não deu para apurar', explica: 'Ninguém sabe o que aconteceu: nada é lançado.' },
};
export const SITUACAO_CANCELAMENTO: Record<SituacaoCancelamento, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: 'Esperando resposta', tom: 'atencao' },
  sem_efeito: { rotulo: 'Sem efeito', tom: 'apagado' },
  nao_produzido: { rotulo: DECISAO.nao_produzido.rotulo, tom: 'ok' },
  produzido_descartado: { rotulo: DECISAO.produzido_descartado.rotulo, tom: 'neutro' },
  produzido_aproveitado: { rotulo: DECISAO.produzido_aproveitado.rotulo, tom: 'ok' },
  nao_apurado: { rotulo: DECISAO.nao_apurado.rotulo, tom: 'apagado' },
};

/** Quantidade digitada → string decimal para o backend ("1,5" → "1.5", "1.250,5" → "1250.5"), sem arredondar.
 *  Vazio, negativo ou inválido → null. Só converte o texto: nenhuma regra de estoque é calculada aqui. */
export function quantidadeDigitada(texto: string): string | null {
  const t = texto.trim().replace(/\s/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return /^\d+(\.\d+)?$/.test(normal) ? normal.replace(/^0+(?=\d)/, '') : null;
}

/** Problemas da conferência aritmética: o backend manda {codigo, texto}. */
export const textoProblemas = (ps: { codigo: string; texto?: string }[] | undefined) => (ps ?? []).map((p) => p.texto ?? p.codigo).join(' ');

export const PENDENCIA: (p: string) => string = (p) => {
  const m = /^item_(\d+)_sem_insumo$/.exec(p);
  if (m) return `Item ${m[1]} sem insumo associado`;
  // Backend e78d36a (0028): sugestão automática não é confirmação — cada item precisa de uma pessoa.
  const s = /^item_(\d+)_sugestao_nao_confirmada$/.exec(p);
  if (s) return `Item ${s[1]}: confirme a sugestão`;
  const h = /^item_(\d+)_sem_confirmacao_humana$/.exec(p);
  if (h) return `Item ${h[1]}: confirme o insumo de novo`;
  if (p === 'conferencia_aritmetica') return 'A soma da nota não fecha com o total';
  if (p === 'sem_itens') return 'Faltam os produtos e as quantidades';
  if (p === 'total_diverge_do_financeiro') return 'Os produtos não somam o valor do pagamento';
  if (p.startsWith('etapa_')) return 'A leitura ainda não terminou';
  return p;
};

// --- Estoque atual: situação, unidade de exibição e responsável -------------------------------------------------------

export type CodigoSituacao = 'normal' | 'baixo' | 'sem' | 'nao_conferido';
export const SITUACAO_ESTOQUE: Record<CodigoSituacao, { rotulo: string; tom: Tom }> = {
  normal: { rotulo: 'Normal', tom: 'ok' },
  baixo: { rotulo: 'Baixo', tom: 'atencao' },
  sem: { rotulo: 'Esgotado', tom: 'perigo' },
  nao_conferido: { rotulo: 'Não conferido', tom: 'neutro' },
};

/** O saldo só tem ponto de partida depois de uma contagem: sem ela (ou com a última antes do início do controle), o
 *  sistema não sabe quanto havia antes das entradas registradas. É a mesma regra do backend (insumos.situacao), lida
 *  pelos campos que ele manda — o motivo "baixa_desligada" esconde o "nunca_contado", por isso a data é conferida aqui. */
export function conferido(i: Pick<Insumo, 'ultima_contagem_em' | 'motivo_nao_confiavel'>, inicioControle?: string | null): boolean {
  if (i.motivo_nao_confiavel === 'nunca_contado' || i.motivo_nao_confiavel === 'sem_movimento') return false;
  if (!i.ultima_contagem_em) return false;
  return !inicioControle || i.ultima_contagem_em.slice(0, 10) >= inicioControle;
}

/** Situação na tela principal. Só classifica o que o backend já mandou (saldo, mínimo, abaixo_minimo): nenhum saldo é
 *  calculado aqui. Item nunca conferido não vira "Sem estoque" nem "Estoque baixo" — o zero dele não é um zero. */
export function situacaoEstoque(i: Pick<Insumo, 'saldo' | 'abaixo_minimo' | 'ultima_contagem_em' | 'motivo_nao_confiavel'>, inicioControle?: string | null): CodigoSituacao {
  if (!conferido(i, inicioControle)) return 'nao_conferido';
  if (Number(i.saldo) <= 0) return 'sem';
  if (i.abaixo_minimo) return 'baixo';
  return 'normal';
}

export function SituacaoEstoque({ codigo }: { codigo: CodigoSituacao }) {
  const s = SITUACAO_ESTOQUE[codigo];
  return <Situacao tom={s.tom} destaque={codigo === 'sem' || codigo === 'baixo'}>{s.rotulo}</Situacao>;
}

/** Unidade em que a linha é mostrada: kg/L quando os números passam de mil (12000 g → 12 kg), senão a própria base.
 *  Só muda a vírgula de lugar (÷ 1000); o backend continua recebendo e mandando a unidade-base. */
export function unidadeExibicao(base: UnidadeBase, ...valores: (string | number | null | undefined)[]): { rotulo: string; fator: 1 | 1000 } {
  if (base === 'un') return { rotulo: 'un', fator: 1 };
  const grande = valores.some((v) => v !== null && v !== undefined && v !== '' && Math.abs(Number(v)) >= 1000);
  return grande ? { rotulo: base === 'g' ? 'kg' : 'L', fator: 1000 } : { rotulo: base, fator: 1 };
}

/** Unidades que a pessoa escolhe no cadastro. O backend guarda só g, ml ou un: kg e L viram g e ml (× 1000) aqui, por
 *  deslocamento da vírgula (paraBase), e a tela volta a mostrar kg/L quando os números passam de mil. */
export type UnidadeCadastro = 'g' | 'kg' | 'ml' | 'L' | 'un';
export const UNIDADES_CADASTRO: { valor: UnidadeCadastro; rotulo: string; base: UnidadeBase; fator: 1 | 1000 }[] = [
  { valor: 'kg', rotulo: 'Quilos (kg)', base: 'g', fator: 1000 },
  { valor: 'g', rotulo: 'Gramas (g)', base: 'g', fator: 1 },
  { valor: 'L', rotulo: 'Litros (L)', base: 'ml', fator: 1000 },
  { valor: 'ml', rotulo: 'Mililitros (ml)', base: 'ml', fator: 1 },
  { valor: 'un', rotulo: 'Unidades (un)', base: 'un', fator: 1 },
];
export const unidadeCadastro = (u: UnidadeCadastro) => UNIDADES_CADASTRO.find((x) => x.valor === u)!;
/** Unidades em que uma quantidade desta base pode ser digitada (kg ou g; L ou ml; un). */
export const unidadesDaBase = (b: UnidadeBase) => UNIDADES_CADASTRO.filter((x) => x.base === b);

/** O backend já grava o estoque ideal? Ele manda a chave `estoque_ideal` (mesmo null) quando sabe guardar; sem a chave,
 *  o campo fica desligado — mandar um campo que o backend descarta seria fingir que salvou. */
export const aceitaEstoqueIdeal = (i: object | null | undefined) => !!i && 'estoque_ideal' in i;

/** O backend publicado já tem o Estoque sincronizado (0028: ideal, quantidade e custo inicial no cadastro, custo na
 *  abertura)? Com insumos cadastrados, a chave `estoque_ideal` da listagem responde; com a base vazia, uma sonda leve em
 *  GET /insumos/opcoes (404 de rota = backend anterior). null = ainda não se sabe (campos desligados até saber). */
export function useEstoque0028(ativo = true): boolean | null {
  const lista = useConsulta(ativo ? 'estoque/insumos?catalogo' : null, () => estoque.insumos({ limite: 200 }));
  const primeiro = lista.dados?.itens[0];
  const sonda = useConsulta(ativo && lista.dados && !primeiro ? 'estoque/insumos/opcoes?sonda' : null, () => estoque.opcoesInsumo('', 1));
  if (primeiro) return aceitaEstoqueIdeal(primeiro);
  if (sonda.dados) return true;
  if (sonda.erro) return sonda.erro.tipo === 'nao_implantado' ? false : null;
  return null;
}

/** Custo digitado por kg/L (ou g/ml/un) → custo por unidade-base, como o backend guarda (R$ 30,00/kg → 0.030000/g). */
export function custoPorBase(texto: string, fator: 1 | 1000): string | null {
  const t = texto.trim().replace(/[^\d,.]/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  if (!Number.isFinite(n) || n < 0) return null;
  return (n / fator).toFixed(6);
}

/** Número na unidade de exibição, sem a unidade (ela tem coluna própria). */
export function numeroEm(v: string | number | null | undefined, fator: 1 | 1000): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return (n / fator).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: fator === 1000 ? 3 : 2 });
}

/** "12,5" digitado em kg → "12500" (g), por deslocamento da vírgula: sem conta de ponto flutuante. Inválido → null. */
export function paraBase(texto: string, fator: 1 | 1000): string | null {
  const q = quantidadeDigitada(texto);
  if (q === null || fator === 1) return q;
  const [int, frac = ''] = q.split('.');
  const f = frac.padEnd(3, '0');
  const inteiro = `${int}${f.slice(0, 3)}`.replace(/^0+(?=\d)/, '');
  const resto = f.slice(3).replace(/0+$/, '');
  return resto ? `${inteiro}.${resto}` : inteiro;
}

/**
 * Quem registrou (movimento, contagem, ficha): o backend grava "usuario:<id>", "integracao:julia" ou "sistema:cli".
 * O id técnico nunca aparece: vira o nome de quem está usando, o nome da equipe (só o Proprietário tem a lista) ou
 * "Equipe".
 */
export function useResponsavel(eu: Usuario) {
  const equipe = useConsulta(pode(eu.papel, 'usuarios.gerenciar') ? 'usuarios' : null, () => pedir<{ id: string; nome: string }[]>('usuarios'));
  const nomes = new Map((equipe.dados ?? []).map((m) => [m.id, m.nome]));
  /** `nome`: o que o backend já mandou (registrado_por_nome, aberto_por_nome) — vale antes de qualquer dedução. */
  return (registro: string | null | undefined, nome?: string | null): string | null => {
    if (nome) return nome;
    if (!registro) return null;
    const [tipo, ...resto] = registro.split(':');
    const id = resto.join(':');
    if (tipo === 'usuario') return id === eu.id ? eu.nome : nomes.get(id) ?? 'Equipe';
    if (tipo === 'integracao') return id === 'julia' ? 'Júlia' : 'Integração';
    if (tipo === 'sistema') return 'Sistema';
    return 'Equipe';
  };
}

/** Motivo gravado no livro ("vencido", "uso_interno: café da equipe", "abertura: contagem_fisica", "erro_de_registro: …") em
 *  português. Dados antigos ("outro: Uso interno: …") continuam legíveis. */
export const MOTIVO_SAIDA: Record<string, string> = {
  vencido: 'Venceu', quebra: 'Quebrou ou estragou', preparo: 'Sobra de preparo', outro: 'Outro motivo', cancelamento_venda: 'Venda cancelada',
  uso_interno: 'Uso interno', 'contagem física': 'Contagem física', contagem: 'Contagem física', contagem_fisica: 'Contagem física',
  erro_de_registro: 'Erro de registro', abertura: 'Saldo inicial',
};
export function textoMotivo(m: string | null): string | null {
  if (!m) return null;
  // 0028: abertura valorada ("abertura · custo informado"): o custo de partida, não uma compra nem uma despesa.
  if (m.startsWith('abertura · custo informado')) return 'Custo inicial informado';
  const partes = m.split(': ');
  // "abertura: contagem_fisica: obs": o motivo da pessoa vem depois da marca de abertura.
  if (partes[0] === 'abertura' && partes.length > 1) partes.shift();
  const [codigo, ...resto] = partes;
  const obs = resto.join(': ');
  if (codigo === 'outro' && obs) return obs;
  const rotulo = MOTIVO_SAIDA[codigo] ?? m;
  return obs ? `${rotulo} · ${obs}` : rotulo;
}

/** Saída manual que não é perda (uso interno). Lê o motivo novo e o formato antigo ("outro: Uso interno…"). */
export const ehUsoInterno = (m: { tipo: TipoMovimento; motivo: string | null }) => m.tipo === 'perda' && !!m.motivo && (m.motivo.startsWith('uso_interno') || m.motivo.startsWith('outro: Uso interno'));
/** Primeira contagem do insumo (abertura do estoque), marcada pelo backend desde 02/11. */
export const ehAbertura = (m: { tipo: TipoMovimento; motivo: string | null }) => m.tipo === 'ajuste_inventario' && !!m.motivo && m.motivo.startsWith('abertura');
/** Nome do movimento no histórico. */
export const rotuloMovimento = (m: { tipo: TipoMovimento; motivo: string | null }) =>
  ehUsoInterno(m) ? 'Uso interno' : ehAbertura(m) ? 'Contagem inicial' : TIPO_MOVIMENTO[m.tipo] ?? m.tipo;
