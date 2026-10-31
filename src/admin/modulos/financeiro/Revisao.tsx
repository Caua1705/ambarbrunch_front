// Revisão: o que precisa de uma pessoa — despesas em revisão (categoria, valor alto, data suspeita) e documentos do grupo
// que a Júlia não resolveu sozinha (ela só marca uma conta como paga quando todas as evidências batem).
// Despesa: POST /admin/financeiro/despesas/{id}/confirmar (com a categoria certa — a MESMA despesa, nada é lançado de
// novo) ou /cancelar. Documento (CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md §5.1–5.4, 0018):
//  - GET/PATCH /admin/financeiro/revisao/documentos/{id}: ler e corrigir a leitura (versão + motivo; 409 = recarregar);
//  - POST …/resolver: pagar_parcela (só comprovante/recibo), registrar_despesa (paga × a pagar; ambíguo exige dizer),
//    vincular_despesa (boleto/nota a uma conta ou despesa já lançada), vincular_pagamento (comprovante de um pagamento
//    lançado à mão) ou descartar — de novo = 409 ja_resolvido;
//  - /comprovantes/{id}/enviar-para-compras (nota de insumos).
// Boleto e nota NUNCA viram pagamento sozinhos: só com "Já está pago" escolhido por uma pessoa, com data e forma.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Check, X, ChevronRight, FileText, Receipt, CircleCheck, CircleDashed, PackagePlus, Info, Eye, Pencil, Link2, History, Sparkles } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, dataHora, relativo, plural, paraDecimal } from '../../lib/formato';
import { Gaveta, useConfirmacao, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Aviso, Etiqueta, Cabecalho, Cartao, Segmentado } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { DespesaRevisao, DocumentoRevisao, FilaRevisao, FormaPagamento, LeituraDocumento, TipoDocumento, CorrecaoDocumento } from '../../lib/tipos/financeiro';
import {
  MOTIVO_REVISAO, EVIDENCIA, ORIGEM, TIPO_DOC, ORIGEM_CLASSIFICACAO, FORMAS, useCategorias, useNomeCategoria, OpcoesCategoria,
  categoriaValida, atualizarFinanceiro, avisar, avisarFalha, temPermissao, usePermissao, useUnidades,
} from './comum';
import { Documento } from './Documento';
import { DetalheDespesa } from './DetalheDespesa';

const motivo = (m: string) => MOTIVO_REVISAO[m] ?? m.replace(/_/g, ' ');
/** Provam pagamento. Boleto e nota são cobrança: nunca viram pagamento sem uma pessoa dizer. */
const PAGAM: TipoDocumento[] = ['comprovante_pagamento', 'recibo'];
const NAO_PAGAM: TipoDocumento[] = ['boleto', 'nota_compra'];
const brl = (v: string | undefined) => (v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

export function Revisao({ contexto }: { contexto: ContextoPainel }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const consulta = useConsulta('financeiro/revisao', () => financeiro.revisao());
  const nome = useNomeCategoria();
  const [docId, setDocId] = useState<string | null>(null);
  const [despesa, setDespesa] = useState<string | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const item = consulta.dados?.documentos.itens.find((d) => d.id === docId) ?? null;
  // Documento resolvido ou levado para outra unidade (saiu da fila): fecha a gaveta.
  useEffect(() => {
    if (docId && consulta.dados && !item) setDocId(null);
  }, [consulta.dados, docId]);

  return (
    <>
      <Cabecalho titulo="Revisão" descricao="Despesas e documentos da Júlia que precisam de uma pessoa" />
      <Dados consulta={consulta} recurso="A fila de revisão" esqueleto={<Esqueleto linhas={8} altura={28} />}>
        {(f: FilaRevisao) =>
          !f.documentos.itens.length && !f.despesas.itens.length ? (
            <Cartao>
              <Vazio icone={<CircleCheck aria-hidden="true" />} titulo="Nada para revisar">Documentos do grupo e despesas que precisarem de conferência aparecem aqui.</Vazio>
            </Cartao>
          ) : (
            <div class="colunas-iguais">
              <Cartao titulo={`Despesas para revisar (${f.despesas.total})`} descricao="Confirme com a categoria certa ou cancele" justo>
                {f.despesas.itens.length ? (
                  <ul class="lista">
                    {f.despesas.itens.map((d) => <ItemDespesa key={d.id} d={d} lancar={lancar} aoAbrir={() => setDespesa(d.id)} confirmar={confirmar} />)}
                  </ul>
                ) : (
                  <Vazio compacto titulo="Nenhuma despesa esperando revisão" />
                )}
                {f.despesas.total > f.despesas.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {f.despesas.itens.length} de {f.despesas.total}.</p>}
              </Cartao>
              <Cartao titulo={`Documentos do grupo (${f.documentos.total})`} descricao="A Júlia só marca uma conta como paga sozinha quando todas as evidências batem. O resto vem para cá." justo>
                {f.documentos.itens.length ? (
                  <ul class="lista">
                    {f.documentos.itens.map((d) => {
                      const sugestoes = d.candidatas.length + d.contas_candidatas.length + d.pagamentos_candidatos.length + d.despesas_candidatas.length;
                      const x = d.extraido;
                      return (
                        <li key={d.id}>
                          <button class="lista__item" onClick={() => setDocId(d.id)}>
                            <span class="lista__icone lista__icone--atencao" aria-hidden="true"><FileText /></span>
                            <span class="lista__texto">
                              <strong>{x.descricao ?? x.recebedor_nome ?? d.legenda ?? TIPO_DOC[d.tipo_documento] ?? 'Documento'}</strong>
                              <span>{[TIPO_DOC[d.tipo_documento] ?? d.tipo_documento, d.motivos.map(motivo).join(', '), d.autor_nome ? `enviado por ${d.autor_nome}` : null, relativo(d.criado_em)].filter(Boolean).join(' · ')}</span>
                              <span class="fraco">
                                {[d.categoria_codigo ? `Categoria: ${nome(d.categoria_codigo)}` : 'Categoria a escolher', sugestoes ? plural(sugestoes, 'lançamento parecido', 'lançamentos parecidos') : null].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                            <span class="lista__fim"><span class="num forte" style={{ color: 'var(--texto)' }}>{moeda(x.valor ?? null)}</span><ChevronRight aria-hidden="true" /></span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Vazio compacto titulo="Nenhum documento pendente" />
                )}
                {f.documentos.total > f.documentos.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {f.documentos.itens.length} de {f.documentos.total}.</p>}
              </Cartao>
            </div>
          )
        }
      </Dados>

      <Gaveta
        aberta={!!item}
        aoFechar={() => setDocId(null)}
        largura="larga"
        titulo={item ? TIPO_DOC[item.tipo_documento] ?? 'Documento' : ''}
        subtitulo={item ? `Enviado ${item.autor_nome ? `por ${item.autor_nome} ` : ''}à Júlia ${relativo(item.criado_em)}` : undefined}
      >
        {item && <DocumentoGaveta key={item.id} item={item} aoResolver={() => setDocId(null)} confirmar={confirmar} />}
      </Gaveta>
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
      {dialogo}
    </>
  );
}

/** Despesa em revisão com as ações do painel antigo à mão: categoria, confirmar, cancelar e o detalhe (com o documento). */
function ItemDespesa({ d, lancar, aoAbrir, confirmar }: { d: DespesaRevisao; lancar: boolean; aoAbrir: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const cats = useCategorias();
  const nome = useNomeCategoria();
  const [categoria, setCategoria] = useState(d.categoria === 'a_classificar' ? '' : d.categoria);
  const [ocupado, setOcupado] = useState(false);
  async function confirmarDespesa() {
    setOcupado(true);
    try {
      await financeiro.confirmarDespesa(d.id, categoria !== d.categoria ? categoria : undefined);
      atualizarFinanceiro();
      avisar('Despesa confirmada.', 'ok');
    } catch (e) {
      avisarFalha(e);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <li class="fin-revisao-item">
      <button class="lista__item" onClick={aoAbrir}>
        <span class="lista__icone" aria-hidden="true"><Receipt /></span>
        <span class="lista__texto">
          <strong>{d.descricao}</strong>
          <span>{[d.fornecedor, dataCurta(d.competencia), ORIGEM[d.origem] ?? d.origem].filter(Boolean).join(' · ')}</span>
        </span>
        <span class="lista__fim"><span class="num forte" style={{ color: 'var(--texto)' }}>{moeda(d.valor)}</span><ChevronRight aria-hidden="true" /></span>
      </button>
      <div class="fin-revisao-item__acoes">
        {d.motivos_revisao.length > 0 && <span class="linha">{d.motivos_revisao.map((m) => <Etiqueta key={m} tom="atencao">{motivo(m)}</Etiqueta>)}</span>}
        {lancar && (
          <div class="linha">
            <select class="selecao" aria-label={`Categoria de ${d.descricao}`} value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
              <option value="">Escolha a categoria…</option>
              <OpcoesCategoria cats={cats.dados ?? []} atual={categoria ? { codigo: categoria, nome: nome(categoria) } : null} />
            </select>
            {d.arquivo_id && <Botao tamanho="p" variante="fantasma" icone={<Eye aria-hidden="true" />} onClick={aoAbrir}>Documento</Botao>}
            <Botao tamanho="p" variante="fantasma" icone={<X aria-hidden="true" />} disabled={ocupado} onClick={() => confirmar({ titulo: 'Cancelar esta despesa?', texto: 'A despesa sai das contas a pagar e do resultado. Se já tiver pagamento, estorne o pagamento antes.', confirmar: 'Cancelar despesa', perigo: true, motivo: { rotulo: 'Motivo do cancelamento' }, acao: async (m) => { await financeiro.cancelarDespesa(d.id, m); atualizarFinanceiro(); }, sucesso: 'Despesa cancelada.' })}>
              Cancelar
            </Botao>
            <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} carregando={ocupado} disabled={!categoria} onClick={confirmarDespesa}>Confirmar</Botao>
          </div>
        )}
      </div>
    </li>
  );
}

/** O documento mais atual: o detalhe (GET …/documentos/{id}) quando o backend o tem; senão, o item da fila. */
function DocumentoGaveta({ item, aoResolver, confirmar }: { item: DocumentoRevisao; aoResolver: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const detalhe = useConsulta(`financeiro/revisao/documento:${item.id}`, () => financeiro.documentoRevisao(item.id));
  const doc = detalhe.dados && (detalhe.dados.versao ?? 0) >= (item.versao ?? 0) ? detalhe.dados : item;
  const [corrigindo, setCorrigindo] = useState(false);
  return corrigindo ? (
    <CorrigirLeitura doc={doc} aoTerminar={(movido) => (movido ? aoResolver() : setCorrigindo(false))} />
  ) : (
    <DocumentoDetalhe doc={doc} aoResolver={aoResolver} aoCorrigir={() => setCorrigindo(true)} confirmar={confirmar} />
  );
}

/** Erro de uma ação sobre o documento: conflito recarrega; já resolvido fecha. Devolve a mensagem para a tela. */
function tratarErroDocumento(e: unknown, aoResolver: () => void): ErroApi {
  const x = e instanceof ErroApi ? e : new ErroApi('servidor', 'Não foi possível concluir. Nada foi alterado; tente de novo.');
  if (x.codigo === 'ja_resolvido') {
    atualizarFinanceiro();
    aoResolver();
    avisarFalha(x);
  } else if (x.tipo === 'conflito') atualizarFinanceiro();
  if (x.codigo === 'boleto_ja_lancado') x.message = `${x.message} Use "Vincular a esta conta" na lista de contas já lançadas.`;
  return x;
}

function Leitura({ x, cats }: { x: LeituraDocumento; cats: (c: string | null | undefined) => string }) {
  const linha = (rotulo: string, valor: ComponentChildren, cls?: string) => (
    <>
      <dt>{rotulo}</dt>
      <dd class={cls}>{valor}</dd>
    </>
  );
  return (
    <dl class="definicoes">
      {linha('Valor', moeda(x.valor ?? null), 'num forte')}
      {linha('Data', x.data ? dataCurta(x.data, { ano: true }) : <span class="fraco">Sem data</span>)}
      {x.vencimento && linha('Vencimento', dataCurta(x.vencimento, { ano: true }))}
      {linha('Beneficiário', <>{x.recebedor_nome ?? '—'}{x.recebedor_documento ? <span class="fraco"> · {x.recebedor_documento}</span> : null}</>)}
      {x.forma && linha('Forma', FORMAS.find((f) => f.valor === x.forma)?.rotulo ?? x.forma)}
      {x.descricao && linha('Descrição lida', x.descricao)}
      {x.identificador_transacao && linha('Identificador', x.identificador_transacao, 'num pequeno')}
      {x.linha_digitavel && linha('Linha digitável', x.linha_digitavel, 'num pequeno')}
      {x.categoria_sugerida && linha('Categoria lida pela IA', cats(x.categoria_sugerida))}
    </dl>
  );
}

function DocumentoDetalhe({ doc, aoResolver, aoCorrigir, confirmar }: { doc: DocumentoRevisao; aoResolver: () => void; aoCorrigir: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const nome = useNomeCategoria();
  const lancar = usePermissao('financeiro.lancar');
  const tipo = doc.tipo_documento;
  const podePagar = !NAO_PAGAM.includes(tipo);
  const unica = doc.candidatas.length === 1 && doc.candidatas[0].forca === 'forte';
  const [parcela, setParcela] = useState<string | null>(unica ? doc.candidatas[0].parcela_id : null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const x = doc.extraido;
  const cls = doc.classificacao;
  const versao = doc.versao != null ? { versao: doc.versao } : {};

  async function resolver(rotulo: string, fn: () => Promise<unknown>, ok: string) {
    setOcupado(rotulo);
    setErro(null);
    try {
      await fn();
      atualizarFinanceiro();
      avisar(ok, 'ok');
      aoResolver();
    } catch (e) {
      setErro(tratarErroDocumento(e, aoResolver));
    } finally {
      setOcupado(null);
    }
  }

  /** Vincular é definitivo: confirma antes, com o que vai ser ligado a quê. */
  const vincular = (titulo: string, texto: string, corpo: Parameters<typeof financeiro.resolverDocumento>[1], ok: string) =>
    confirmar({
      titulo,
      texto,
      confirmar: 'Vincular',
      acao: async () => {
        try {
          await financeiro.resolverDocumento(doc.id, corpo);
        } catch (e) {
          throw tratarErroDocumento(e, aoResolver);
        }
        atualizarFinanceiro();
        aoResolver();
      },
      sucesso: ok,
    });

  return (
    <div class="fin-revisao">
      <div class="fin-revisao__doc">
        <Documento arquivoId={doc.arquivo_id} altura={560} />
      </div>
      <div class="pilha">
        {doc.motivos.length > 0 && <div class="linha">{doc.motivos.map((m) => <Etiqueta key={m} tom={m === 'corrigido' ? 'info' : 'atencao'}>{motivo(m)}</Etiqueta>)}</div>}
        {doc.legenda && <p class="suave">“{doc.legenda}”</p>}
        {doc.motivos.includes('movimentacao_nao_despesa') && (
          <Aviso tom="info" icone={<Info aria-hidden="true" />}>A Júlia entendeu que isto é troco, aporte, retirada ou transferência: nada foi lançado. Se for uma despesa, registre abaixo; se não, descarte.</Aviso>
        )}

        <div class="pilha pilha--p fin-destaque" data-categoria-julia>
          <span class="linha"><Sparkles size={16} aria-hidden="true" /><strong>Categoria da Júlia</strong></span>
          {doc.categoria_codigo ? (
            <span>
              <strong>{nome(doc.categoria_codigo)}</strong>
              <span class="fraco"> · {ORIGEM_CLASSIFICACAO[cls.origem ?? ''] ?? (cls.origem ? cls.origem.replace(/_/g, ' ') : 'sugerida')}</span>
            </span>
          ) : (
            <span class="suave">Nenhuma decidida: escolha abaixo.{cls.origem ? ` (${ORIGEM_CLASSIFICACAO[cls.origem] ?? cls.origem})` : ''}</span>
          )}
          {(cls.opcoes ?? []).length > 0 && <span class="fraco">A Júlia ficou entre: {(cls.opcoes ?? []).map((o) => nome(o)).join(', ')}.</span>}
          {cls.origem === 'painel' && cls.anterior && <span class="fraco">Antes: {nome(cls.anterior)}.</span>}
        </div>

        <section class="pilha pilha--p">
          <div class="linha linha--entre">
            <h3 class="secao-titulo">O que a Júlia leu</h3>
            {lancar && <Botao tamanho="p" variante="fantasma" icone={<Pencil aria-hidden="true" />} onClick={aoCorrigir}>Corrigir leitura</Botao>}
          </div>
          <Leitura x={x} cats={nome} />
          {doc.extraido_original && (
            <details class="fin-detalhes">
              <summary><History size={14} aria-hidden="true" /> Leitura original da IA</summary>
              <Leitura x={doc.extraido_original} cats={nome} />
              {doc.corrigido_em && <p class="fraco">Corrigido{doc.corrigido_por ? ` por ${doc.corrigido_por}` : ''} em {dataHora(doc.corrigido_em)}.</p>}
            </details>
          )}
          {doc.autor_nome && <p class="fraco">Enviado por {doc.autor_nome}.</p>}
        </section>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}

        {podePagar && doc.candidatas.length > 0 && (
          <section class="pilha pilha--p" aria-label="Contas que este comprovante pode pagar">
            <h3 class="secao-titulo">Contas que este comprovante pode estar pagando</h3>
            <p class="fraco">{doc.candidatas.length > 1 ? 'Há mais de uma conta parecida: escolha a certa.' : 'Confira as evidências antes de marcar como paga.'}</p>
            <div role="radiogroup" aria-label="Conta que este comprovante paga" class="pilha pilha--p">
              {doc.candidatas.map((c) => (
                <label key={c.parcela_id} class={`fin-candidata${parcela === c.parcela_id ? ' fin-candidata--sel' : ''}`}>
                  <input type="radio" name={`cand-${doc.id}`} checked={parcela === c.parcela_id} disabled={!lancar} onChange={() => setParcela(c.parcela_id)} />
                  <span class="pilha pilha--p" style={{ flex: 1, minWidth: 0 }}>
                    <span class="linha linha--entre">
                      <strong>{c.descricao}</strong>
                      <span class="num forte">{moeda(c.saldo)}</span>
                    </span>
                    <span class="fraco">{c.fornecedor ?? 'Fornecedor não informado'} · vence {dataCurta(c.vencimento)} · {c.forca === 'forte' ? 'evidência forte' : 'evidência fraca'}</span>
                    <span class="fin-evidencias">
                      {c.evidencias.map((e) => <span key={e} class="fin-ev fin-ev--ok"><CircleCheck aria-hidden="true" /> {EVIDENCIA[e] ?? e}</span>)}
                      {c.faltando.map((e) => <span key={e} class="fin-ev"><CircleDashed aria-hidden="true" /> Falta: {EVIDENCIA[e] ?? e}</span>)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {!x.data && <p class="fraco">Sem a data do pagamento: corrija a leitura antes de marcar como paga.</p>}
            {parcela && x.valor && doc.candidatas.find((c) => c.parcela_id === parcela)?.saldo !== x.valor && (
              <p class="fraco">O pagamento registrado será de <strong>{moeda(x.valor)}</strong>, o valor do comprovante. Se a conta tinha valor a confirmar, este passa a ser o valor dela.</p>
            )}
            {lancar && (
              <Botao variante="primario" icone={<Check aria-hidden="true" />} disabled={!parcela || !x.data || !!ocupado} carregando={ocupado === 'pagar'} onClick={() => parcela && resolver('pagar', () => financeiro.resolverDocumento(doc.id, { acao: 'pagar_parcela', parcela_id: parcela, ...versao }), 'Conta marcada como paga com este documento.')}>
                Marcar a conta escolhida como paga
              </Botao>
            )}
          </section>
        )}

        {doc.contas_candidatas.length > 0 && (
          <section class="pilha pilha--p" aria-label="Contas já lançadas">
            <h3 class="secao-titulo">Pode ser uma conta já lançada</h3>
            <p class="fraco">Vincular anexa este {tipo === 'boleto' ? 'boleto' : 'documento'} à conta, sem lançar nada de novo. A conta continua a pagar: o comprovante, quando chegar, quita.</p>
            <ul class="pilha pilha--p" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {doc.contas_candidatas.map((c) => (
                <li key={`${c.despesa_id}:${c.parcela_id ?? ''}`} class="fin-candidata">
                  <span class="pilha pilha--p" style={{ flex: 1, minWidth: 0 }}>
                    <span class="linha linha--entre"><strong>{c.descricao}</strong><span class="num forte">{moeda(c.saldo)}</span></span>
                    <span class="fraco">{[c.fornecedor ?? 'Fornecedor não informado', c.vencimento ? `vence ${dataCurta(c.vencimento)}` : null, c.valor_a_confirmar ? 'valor a confirmar' : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  {lancar && (
                    <Botao tamanho="p" icone={<Link2 aria-hidden="true" />} disabled={!!ocupado} onClick={() => vincular('Vincular a esta conta?', `O documento fica anexado a “${c.descricao}”. Nada é pago nem lançado de novo.`, { acao: 'vincular_despesa', despesa_id: c.despesa_id, ...versao }, 'Documento vinculado à conta.')}>
                      Vincular a esta conta
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {podePagar && doc.pagamentos_candidatos.length > 0 && (
          <section class="pilha pilha--p" aria-label="Pagamentos já lançados">
            <h3 class="secao-titulo">Pode ser de um pagamento já lançado</h3>
            <p class="fraco">Vincular faz deste comprovante a prova do pagamento lançado à mão. O pagamento não muda.</p>
            <ul class="pilha pilha--p" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {doc.pagamentos_candidatos.map((p) => (
                <li key={p.pagamento_id} class="fin-candidata">
                  <span class="pilha pilha--p" style={{ flex: 1, minWidth: 0 }}>
                    <span class="linha linha--entre"><strong>{p.descricao}</strong><span class="num forte">{moeda(p.valor)}</span></span>
                    <span class="fraco">{[p.fornecedor ?? 'Fornecedor não informado', p.pago_em ? `pago em ${dataCurta(p.pago_em)}` : null, p.forma ? FORMAS.find((f) => f.valor === p.forma)?.rotulo ?? p.forma : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  {lancar && (
                    <Botao tamanho="p" icone={<Link2 aria-hidden="true" />} disabled={!!ocupado} onClick={() => vincular('Vincular a este pagamento?', `Este comprovante passa a ser a prova do pagamento de ${moeda(p.valor)} em “${p.descricao}”.`, { acao: 'vincular_pagamento', pagamento_id: p.pagamento_id, ...versao }, 'Comprovante vinculado ao pagamento.')}>
                      Vincular a este pagamento
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {doc.despesas_candidatas.length > 0 && (
          <section class="pilha pilha--p" aria-label="Despesas já lançadas">
            <h3 class="secao-titulo">Pode cobrir uma despesa já lançada</h3>
            <p class="fraco">Vincular anexa {tipo === 'nota_compra' ? 'a nota' : 'o documento'} à despesa existente, sem lançar de novo.</p>
            <ul class="pilha pilha--p" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {doc.despesas_candidatas.map((c) => (
                <li key={c.despesa_id} class="fin-candidata">
                  <span class="pilha pilha--p" style={{ flex: 1, minWidth: 0 }}>
                    <span class="linha linha--entre"><strong>{c.descricao}</strong><span class="num forte">{moeda(c.valor)}</span></span>
                    <span class="fraco">{[c.competencia ? dataCurta(c.competencia, { ano: true }) : null, c.forca ? (c.forca === 'forte' ? 'evidência forte' : 'evidência fraca') : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  {lancar && (
                    <Botao tamanho="p" icone={<Link2 aria-hidden="true" />} disabled={!!ocupado} onClick={() => vincular('Vincular a esta despesa?', `O documento fica anexado a “${c.descricao}”. Nada é lançado de novo.`, { acao: 'vincular_despesa', despesa_id: c.despesa_id, ...versao }, 'Documento vinculado à despesa.')}>
                      Vincular a esta despesa
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {lancar && (
          <>
            <RegistrarDespesa doc={doc} ocupado={ocupado} setOcupado={setOcupado} aoResolver={aoResolver} titulo={doc.candidatas.length + doc.contas_candidatas.length + doc.pagamentos_candidatos.length + doc.despesas_candidatas.length ? 'Ou é uma despesa nova' : 'Registrar como despesa'} />

            <div class="linha" style={{ borderTop: '1px solid var(--borda)', paddingTop: '14px' }}>
              {tipo === 'nota_compra' && (
                <Botao icone={<PackagePlus aria-hidden="true" />} disabled={!!ocupado} carregando={ocupado === 'compras'} onClick={() => resolver('compras', () => financeiro.enviarParaCompras(doc.id), 'Enviada para Compras. Confira os itens no Estoque.')}>
                  Enviar para Compras
                </Botao>
              )}
              <Botao variante="fantasma" icone={<X aria-hidden="true" />} disabled={!!ocupado} onClick={() => confirmar({ titulo: 'Descartar este documento?', texto: 'Use para foto repetida, documento que não é do Âmbar ou que não gera lançamento.', confirmar: 'Descartar', perigo: true, motivo: { rotulo: 'Motivo' }, acao: async (m) => { try { await financeiro.resolverDocumento(doc.id, { acao: 'descartar', motivo: m, ...versao }); } catch (e) { throw tratarErroDocumento(e, aoResolver); } atualizarFinanceiro(); aoResolver(); }, sucesso: 'Documento descartado.' })}>
                Descartar
              </Botao>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Registrar como despesa: categoria (a da Júlia já escolhida), pago × a pagar e a data que cada caso exige. */
function RegistrarDespesa({ doc, titulo, ocupado, setOcupado, aoResolver }: { doc: DocumentoRevisao; titulo: string; ocupado: string | null; setOcupado: (s: string | null) => void; aoResolver: () => void }) {
  const cats = useCategorias();
  const nome = useNomeCategoria();
  const x = doc.extraido;
  const tipo = doc.tipo_documento;
  const validas = (cats.dados ?? []).filter(categoriaValida);
  const inicial = [doc.categoria_codigo, x.categoria_sugerida].find((c) => c && (!cats.dados || validas.some((v) => v.codigo === c))) ?? '';
  const [categoria, setCategoria] = useState(inicial ?? '');
  const [escolhida, setEscolhida] = useState(false);
  // A categoria da Júlia chega antes ou depois das categorias da unidade: pré-seleciona enquanto ninguém escolheu.
  useEffect(() => {
    if (!escolhida) setCategoria(inicial ?? '');
  }, [inicial, escolhida]);
  const [situacao, setSituacao] = useState<'paga' | 'a_pagar' | ''>(PAGAM.includes(tipo) ? 'paga' : NAO_PAGAM.includes(tipo) ? 'a_pagar' : '');
  const [data, setData] = useState(x.data ?? '');
  const [forma, setForma] = useState<FormaPagamento>((FORMAS.some((f) => f.valor === x.forma) ? x.forma : 'pix') as FormaPagamento);
  const [vencimento, setVencimento] = useState(x.vencimento ?? x.data ?? '');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function registrar() {
    const e: Record<string, string> = {};
    if (!categoria) e.categoria = 'Escolha a categoria.';
    if (!situacao) e.paga = 'Diga se já está pago ou se é uma conta a pagar.';
    if (situacao === 'paga' && !data) e.data = 'Informe a data do pagamento.';
    if (situacao === 'a_pagar' && !vencimento) e.vencimento = 'Informe o vencimento.';
    setErros(e);
    if (Object.keys(e).length) return;
    const paga = situacao === 'paga';
    const corpo: Parameters<typeof financeiro.resolverDocumento>[1] = { acao: 'registrar_despesa', categoria, paga, ...(doc.versao != null ? { versao: doc.versao } : {}) };
    // Só o que mudou vai junto: cada campo enviado vira uma correção registrada do documento.
    if (paga && data !== (x.data ?? '')) corpo.data = data;
    if (paga && forma !== x.forma) corpo.forma = forma;
    if (!paga && vencimento !== (x.vencimento ?? x.data ?? '')) corpo.vencimento = vencimento;
    setOcupado('despesa');
    setErro(null);
    try {
      await financeiro.resolverDocumento(doc.id, corpo);
      atualizarFinanceiro();
      avisar(paga ? 'Despesa paga registrada a partir do documento.' : 'Conta a pagar registrada a partir do documento.', 'ok');
      aoResolver();
    } catch (err) {
      const z = tratarErroDocumento(err, aoResolver);
      const campo = z.codigo === 'informe_se_paga' ? 'paga' : z.codigo === 'data_obrigatoria' ? (paga ? 'data' : 'vencimento') : z.codigo === 'categoria_inativa_na_unidade' ? 'categoria' : null;
      if (campo) setErros({ [campo]: z.message });
      else setErros(z.campos);
      setErro(z);
    } finally {
      setOcupado(null);
    }
  }

  const ajuda = PAGAM.includes(tipo)
    ? 'Comprovante e recibo viram uma despesa já paga, com a data do pagamento.'
    : NAO_PAGAM.includes(tipo)
      ? `${tipo === 'boleto' ? 'Boleto' : 'Nota fiscal'} é cobrança: vira uma conta a pagar. Só marque "Já está pago" se você conferiu o pagamento.`
      : 'A Júlia não soube dizer o que é este documento: diga se já está pago ou se é uma conta a pagar.';

  return (
    <section class="pilha pilha--p" aria-label="Registrar como despesa">
      <h3 class="secao-titulo">{titulo}</h3>
      <p class="fraco">{ajuda}</p>
      {!x.valor && <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>Sem valor legível: corrija a leitura antes de registrar.</Aviso>}
      {erro && !Object.keys(erros).length && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
      <Campo rotulo="Categoria" erro={erros.categoria}>
        {(id, d) => (
          <select id={id} class="selecao" aria-describedby={d} value={categoria} onChange={(e) => { setEscolhida(true); setCategoria(e.currentTarget.value); }}>
            <option value="">Escolha…</option>
            <OpcoesCategoria cats={cats.dados ?? []} atual={doc.categoria_codigo ? { codigo: doc.categoria_codigo, nome: nome(doc.categoria_codigo) } : null} />
          </select>
        )}
      </Campo>
      <div class="pilha pilha--p">
        <span class="campo__rotulo">Situação</span>
        <Segmentado<'paga' | 'a_pagar'>
          rotulo="Situação do documento"
          valor={situacao as 'paga' | 'a_pagar'}
          aoMudar={setSituacao}
          opcoes={[{ valor: 'paga', rotulo: 'Já está pago' }, { valor: 'a_pagar', rotulo: 'É uma conta a pagar' }]}
        />
        {erros.paga && <span class="campo__erro" role="alert">{erros.paga}</span>}
      </div>
      {situacao === 'paga' && NAO_PAGAM.includes(tipo) && (
        <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>{tipo === 'boleto' ? 'Boleto' : 'Nota fiscal'} não comprova pagamento. Confirme a data e a forma: o pagamento fica registrado em seu nome.</Aviso>
      )}
      {situacao === 'paga' && (
        <div class="grade-campos">
          <Campo rotulo="Data do pagamento" erro={erros.data} ajuda={!x.data ? 'A Júlia não leu a data: confira no documento.' : undefined}>
            {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={data} onChange={(e) => setData(e.currentTarget.value)} />}
          </Campo>
          <Campo rotulo="Forma">
            {(id) => (
              <select id={id} class="selecao" value={forma} onChange={(e) => setForma(e.currentTarget.value as FormaPagamento)}>
                {FORMAS.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
              </select>
            )}
          </Campo>
        </div>
      )}
      {situacao === 'a_pagar' && (
        <Campo rotulo="Vencimento" erro={erros.vencimento}>
          {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={vencimento} onChange={(e) => setVencimento(e.currentTarget.value)} />}
        </Campo>
      )}
      <Botao variante="primario" disabled={!x.valor || !!ocupado} carregando={ocupado === 'despesa'} icone={<Receipt aria-hidden="true" />} onClick={registrar}>
        {situacao === 'a_pagar' ? 'Registrar conta a pagar' : 'Registrar como despesa'}
      </Botao>
    </section>
  );
}

const TIPOS: TipoDocumento[] = ['comprovante_pagamento', 'recibo', 'boleto', 'nota_compra', 'ambiguo'];

/** Correção da leitura (PATCH com versão e motivo). Só o que mudou vai; campo apagado vai como null (apaga a leitura
 *  errada). Nada financeiro é criado: depois de corrigir, resolve-se. Mudar a unidade tira o documento desta fila. */
function CorrigirLeitura({ doc, aoTerminar }: { doc: DocumentoRevisao; aoTerminar: (movido: boolean) => void }) {
  const cats = useCategorias();
  const nome = useNomeCategoria();
  const { unidade: atual, unidades } = useUnidades();
  const x = doc.extraido;
  const [f, setF] = useState({
    tipo_documento: doc.tipo_documento,
    valor: brl(x.valor),
    data: x.data ?? '',
    vencimento: x.vencimento ?? '',
    recebedor_nome: x.recebedor_nome ?? '',
    recebedor_documento: x.recebedor_documento ?? '',
    forma: x.forma ?? '',
    descricao: x.descricao ?? '',
    unidade: atual?.codigo ?? '',
    categoria: doc.categoria_codigo ?? '',
  });
  const [motivoTxt, setMotivo] = useState('');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (campo: keyof typeof f) => (e: Event) => setF({ ...f, [campo]: (e.currentTarget as HTMLInputElement).value });

  async function salvar(e: Event) {
    e.preventDefault();
    const c: CorrecaoDocumento = { versao: doc.versao ?? 1, motivo: motivoTxt.trim() };
    const campos: Record<string, string> = {};
    if (f.tipo_documento !== doc.tipo_documento) c.tipo_documento = f.tipo_documento;
    const v = f.valor.trim() ? paraDecimal(f.valor) : null;
    if (f.valor.trim() && (!v || Number(v) <= 0)) campos.valor = 'Informe um valor maior que zero.';
    if ((v ? Number(v) : null) !== (x.valor ? Number(x.valor) : null)) c.valor = v;
    const texto = (campo: 'data' | 'vencimento' | 'recebedor_nome' | 'recebedor_documento' | 'descricao') => {
      const novo = f[campo].trim();
      if (novo !== (x[campo] ?? '')) c[campo] = novo || null;
    };
    texto('data');
    texto('vencimento');
    texto('recebedor_nome');
    texto('recebedor_documento');
    texto('descricao');
    if (f.forma !== (x.forma ?? '')) c.forma = (f.forma || null) as FormaPagamento | null;
    if (f.categoria && f.categoria !== (doc.categoria_codigo ?? '')) c.categoria = f.categoria;
    const movido = !!f.unidade && f.unidade !== atual?.codigo;
    if (movido) c.unidade = f.unidade;
    if (c.motivo.length < 5) campos.motivo = 'Explique a correção (pelo menos 5 caracteres).';
    if (Object.keys(campos).length) return setErro(new ErroApi('validacao', 'Confira os campos destacados.', 0, null, campos));
    if (Object.keys(c).length === 2) return aoTerminar(false);
    setEnviando(true);
    setErro(null);
    try {
      await financeiro.corrigirDocumento(doc.id, c);
      atualizarFinanceiro();
      avisar(movido ? `Documento levado para ${unidades.find((u) => u.codigo === f.unidade)?.nome ?? f.unidade}.` : 'Leitura corrigida. Confira as sugestões e resolva.', 'ok');
      aoTerminar(movido);
    } catch (err) {
      const z = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível corrigir.');
      if (z.codigo === 'ja_resolvido') {
        atualizarFinanceiro();
        avisarFalha(z);
        return aoTerminar(true);
      }
      if (z.tipo === 'conflito') atualizarFinanceiro();
      if (z.codigo === 'categoria_inativa_na_unidade') z.campos = { ...z.campos, categoria: z.message };
      setErro(z);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form class="pilha" onSubmit={salvar} noValidate aria-label="Corrigir leitura">
      <div class="fin-revisao">
        <div class="fin-revisao__doc">
          <Documento arquivoId={doc.arquivo_id} altura={520} />
        </div>
        <div class="pilha">
          <h3 class="secao-titulo">Corrigir a leitura</h3>
          <p class="fraco">Confira no documento ao lado. A correção fica registrada com o seu motivo, e a leitura original da IA é guardada. Nada é lançado: depois de corrigir, você resolve.</p>
          {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
          <div class="grade-campos">
            <Campo rotulo="Tipo de documento" class="inteiro">
              {(id) => (
                <select id={id} class="selecao" value={f.tipo_documento} onChange={mudar('tipo_documento')}>
                  {TIPOS.map((t) => <option key={t} value={t}>{TIPO_DOC[t]}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Valor" erro={erro?.campos.valor}>
              {(id, d) => <EntradaMoeda id={id} descr={d} valor={f.valor} aoMudar={(v) => setF({ ...f, valor: v })} invalido={!!erro?.campos.valor} />}
            </Campo>
            <Campo rotulo="Data do pagamento" opcional erro={erro?.campos.data}>
              {(id) => <input id={id} type="date" class="entrada" value={f.data} onChange={mudar('data')} />}
            </Campo>
            <Campo rotulo="Vencimento" opcional erro={erro?.campos.vencimento}>
              {(id) => <input id={id} type="date" class="entrada" value={f.vencimento} onChange={mudar('vencimento')} />}
            </Campo>
            <Campo rotulo="Forma" opcional>
              {(id) => (
                <select id={id} class="selecao" value={f.forma} onChange={mudar('forma')}>
                  <option value="">Não informada</option>
                  {FORMAS.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Beneficiário" opcional class="inteiro" erro={erro?.campos.recebedor_nome}>
              {(id) => <input id={id} class="entrada" maxLength={160} value={f.recebedor_nome} onInput={mudar('recebedor_nome')} />}
            </Campo>
            <Campo rotulo="CNPJ/CPF do beneficiário" opcional erro={erro?.campos.recebedor_documento}>
              {(id) => <input id={id} class="entrada" maxLength={20} inputMode="numeric" value={f.recebedor_documento} onInput={mudar('recebedor_documento')} />}
            </Campo>
            <Campo rotulo="Categoria" erro={erro?.campos.categoria}>
              {(id) => (
                <select id={id} class="selecao" value={f.categoria} onChange={mudar('categoria')}>
                  <option value="">{doc.categoria_codigo ? 'Manter' : 'A escolher depois'}</option>
                  <OpcoesCategoria cats={cats.dados ?? []} atual={doc.categoria_codigo ? { codigo: doc.categoria_codigo, nome: nome(doc.categoria_codigo) } : null} />
                </select>
              )}
            </Campo>
            <Campo rotulo="Descrição" opcional class="inteiro">
              {(id) => <input id={id} class="entrada" maxLength={300} value={f.descricao} onInput={mudar('descricao')} />}
            </Campo>
            {unidades.length > 1 && (
              <Campo rotulo="Unidade" class="inteiro" ajuda="Documento da unidade errada (ex.: teste enviado sem #teste) vai para a fila da unidade certa." erro={erro?.campos.unidade}>
                {(id, d) => (
                  <select id={id} class="selecao" aria-describedby={d} value={f.unidade} onChange={mudar('unidade')}>
                    {unidades.map((u) => <option key={u.codigo} value={u.codigo}>{u.nome}</option>)}
                  </select>
                )}
              </Campo>
            )}
            <Campo rotulo="Motivo da correção" class="inteiro" erro={erro?.campos.motivo}>
              {(id) => <textarea id={id} class="area" maxLength={300} value={motivoTxt} onInput={(e) => setMotivo(e.currentTarget.value)} placeholder="Ex.: data lida no papel; a IA leu o vencimento como pagamento" />}
            </Campo>
          </div>
          <div class="linha" style={{ justifyContent: 'flex-end' }}>
            <Botao onClick={() => aoTerminar(false)} disabled={enviando}>Voltar</Botao>
            <Botao variante="primario" type="submit" carregando={enviando}>Salvar correção</Botao>
          </div>
        </div>
      </div>
    </form>
  );
}
