// Rótulos do Estoque em português de quem trabalha na cozinha, e utilidades comuns às abas.
import { invalidar } from '../../lib/consulta';
import { Situacao, Etiqueta, type Tom } from '../../ui/base';
import type { CompraLista, EtapaCompra, FonteLeitura, Insumo, MotivoNaoConfiavel, SituacaoItem, UnidadeBase } from '../../lib/tipos/estoque';

export const atualizarEstoque = () => invalidar('estoque');

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

export const PENDENCIA: (p: string) => string = (p) => {
  const m = /^item_(\d+)_sem_insumo$/.exec(p);
  if (m) return `Item ${m[1]} sem insumo associado`;
  if (p === 'conferencia_aritmetica') return 'A soma da nota não fecha com o total';
  if (p === 'sem_itens') return 'Faltam os produtos e as quantidades';
  if (p.startsWith('etapa_')) return 'A leitura ainda não terminou';
  return p;
};
