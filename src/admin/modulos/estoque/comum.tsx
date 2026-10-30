// Rótulos do Estoque em português de quem trabalha na cozinha, e utilidades comuns às abas.
import { invalidar, useConsulta } from '../../lib/consulta';
import { pode, podeVer } from '../../lib/permissoes';
import { estoque } from '../../lib/api/estoque';
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
  entrada_compra: 'Compra recebida',
  consumo_venda: 'Venda',
  estorno_consumo: 'Venda cancelada (volta)',
  producao_saida: 'Usado em preparo',
  producao_entrada: 'Preparo produzido',
  perda: 'Perda',
  ajuste_inventario: 'Ajuste da contagem',
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
  if (p === 'conferencia_aritmetica') return 'A soma da nota não fecha com o total';
  if (p === 'sem_itens') return 'Faltam os produtos e as quantidades';
  if (p.startsWith('etapa_')) return 'A leitura ainda não terminou';
  return p;
};
