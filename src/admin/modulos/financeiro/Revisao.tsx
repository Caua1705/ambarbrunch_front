// "Para revisar": comprovantes da Júlia que precisam de alguém e despesas em revisão.
// Documento: POST /admin/financeiro/revisao/documentos/{id}/resolver (pagar_parcela | registrar_despesa | descartar) ou
// POST /admin/financeiro/comprovantes/{id}/enviar-para-compras (nota de insumos). Despesa: abre o detalhe (confirmar a
// MESMA despesa com a categoria certa — nada é lançado de novo).
import { useEffect, useState } from 'preact/hooks';
import { ArrowLeft, Check, X, ChevronRight, FileText, Receipt, CircleCheck, CircleDashed, PackagePlus, Info } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, relativo, plural } from '../../lib/formato';
import { Gaveta, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Aviso, Etiqueta } from '../../ui/base';
import { Dados, Vazio } from '../../ui/estados';
import type { DocumentoRevisao, FilaRevisao } from '../../lib/tipos/financeiro';
import { MOTIVO_REVISAO, EVIDENCIA, ORIGEM, useCategorias, nomeCategoria, OpcoesCategoria, atualizarFinanceiro, avisar, avisarFalha } from './comum';
import { Documento } from './Documento';

const TIPO_DOC: Record<DocumentoRevisao['tipo_documento'], string> = {
  comprovante_pagamento: 'Comprovante de pagamento',
  boleto: 'Boleto',
  recibo: 'Recibo',
  nota_compra: 'Nota de compra',
  ambiguo: 'Documento não identificado',
};

export function Revisao({ aberta, aoFechar, aoAbrirDespesa, confirmar }: { aberta: boolean; aoFechar: () => void; aoAbrirDespesa: (id: string) => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const consulta = useConsulta(aberta ? 'financeiro/revisao' : null, () => financeiro.revisao());
  const [docId, setDocId] = useState<string | null>(null);
  useEffect(() => {
    if (!aberta) setDocId(null);
  }, [aberta]);
  const doc = consulta.dados?.documentos.itens.find((d) => d.id === docId) ?? null;

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      largura={doc ? 'larga' : 'media'}
      titulo={doc ? TIPO_DOC[doc.tipo_documento] : 'Para revisar'}
      subtitulo={doc ? `Enviado ${doc.autor_nome ? `por ${doc.autor_nome} ` : ''}à Júlia ${relativo(doc.criado_em)}` : consulta.dados ? plural(consulta.dados.documentos.total + consulta.dados.despesas.total, 'item', 'itens') : undefined}
      acoesTopo={doc && <Botao tamanho="p" variante="fantasma" icone={<ArrowLeft aria-hidden="true" />} onClick={() => setDocId(null)}>Lista</Botao>}
    >
      <Dados consulta={consulta} recurso="A fila de revisão">
        {(f: FilaRevisao) =>
          doc ? (
            <DocumentoDetalhe key={doc.id} doc={doc} aoResolver={() => setDocId(null)} confirmar={confirmar} />
          ) : !f.documentos.itens.length && !f.despesas.itens.length ? (
            <Vazio icone={<CircleCheck aria-hidden="true" />} titulo="Nada para revisar">Comprovantes e despesas que precisarem de conferência aparecem aqui.</Vazio>
          ) : (
            <>
              {f.documentos.itens.length > 0 && (
                <section class="pilha pilha--p">
                  <h3 class="secao-titulo">Comprovantes da Júlia ({f.documentos.total})</h3>
                  <ul class="lista fin-borda">
                    {f.documentos.itens.map((d) => (
                      <li key={d.id}>
                        <button class="lista__item" onClick={() => setDocId(d.id)}>
                          <span class="lista__icone lista__icone--atencao" aria-hidden="true"><FileText /></span>
                          <span class="lista__texto">
                            <strong>{d.extraido.recebedor_nome ?? d.extraido.descricao ?? TIPO_DOC[d.tipo_documento]}</strong>
                            <span>{TIPO_DOC[d.tipo_documento]} · {d.motivos.map((m) => MOTIVO_REVISAO[m] ?? m).join(', ')}</span>
                          </span>
                          <span class="lista__fim"><span class="num forte" style={{ color: 'var(--texto)' }}>{moeda(d.extraido.valor ?? null)}</span><ChevronRight aria-hidden="true" /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {f.despesas.itens.length > 0 && (
                <section class="pilha pilha--p">
                  <h3 class="secao-titulo">Despesas em revisão ({f.despesas.total})</h3>
                  <ul class="lista fin-borda">
                    {f.despesas.itens.map((d) => (
                      <li key={d.id}>
                        <button class="lista__item" onClick={() => aoAbrirDespesa(d.id)}>
                          <span class="lista__icone" aria-hidden="true"><Receipt /></span>
                          <span class="lista__texto">
                            <strong>{d.descricao}</strong>
                            <span>{d.motivos_revisao.map((m) => MOTIVO_REVISAO[m] ?? m).join(', ')} · {ORIGEM[d.origem] ?? d.origem} · {dataCurta(d.competencia)}</span>
                          </span>
                          <span class="lista__fim"><span class="num forte" style={{ color: 'var(--texto)' }}>{moeda(d.valor)}</span><ChevronRight aria-hidden="true" /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )
        }
      </Dados>
    </Gaveta>
  );
}

function DocumentoDetalhe({ doc, aoResolver, confirmar }: { doc: DocumentoRevisao; aoResolver: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const cats = useCategorias();
  const unica = doc.candidatas.length === 1 && doc.candidatas[0].forca === 'forte';
  const [parcela, setParcela] = useState<string | null>(unica ? doc.candidatas[0].parcela_id : null);
  const [categoria, setCategoria] = useState(doc.extraido.categoria_sugerida ?? '');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const x = doc.extraido;

  async function resolver(rotulo: string, fn: () => Promise<unknown>, ok: string) {
    setOcupado(rotulo);
    setErro(null);
    try {
      await fn();
      atualizarFinanceiro();
      avisar(ok, 'ok');
      aoResolver();
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'ja_resolvido') {
        atualizarFinanceiro();
        aoResolver();
      }
      avisarFalha(e);
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div class="fin-revisao">
      <div class="fin-revisao__doc">
        <Documento arquivoId={doc.arquivo_id} altura={560} />
      </div>
      <div class="pilha">
        <div class="linha">{doc.motivos.map((m) => <Etiqueta key={m} tom="atencao">{MOTIVO_REVISAO[m] ?? m}</Etiqueta>)}</div>
        {doc.legenda && <p class="suave">“{doc.legenda}”</p>}
        <dl class="definicoes">
          <dt>Valor</dt>
          <dd class="num forte">{moeda(x.valor ?? null)}</dd>
          <dt>Data</dt>
          <dd>{x.data ? dataCurta(x.data, { ano: true }) : '—'}</dd>
          {x.vencimento && (
            <>
              <dt>Vencimento</dt>
              <dd>{dataCurta(x.vencimento, { ano: true })}</dd>
            </>
          )}
          <dt>Beneficiário</dt>
          <dd>{x.recebedor_nome ?? '—'}{x.recebedor_documento ? <span class="fraco"> · {x.recebedor_documento}</span> : null}</dd>
          {x.identificador_transacao && (
            <>
              <dt>Identificador</dt>
              <dd class="num pequeno">{x.identificador_transacao}</dd>
            </>
          )}
          {x.linha_digitavel && (
            <>
              <dt>Linha digitável</dt>
              <dd class="num pequeno">{x.linha_digitavel}</dd>
            </>
          )}
          {x.categoria_sugerida && (
            <>
              <dt>Categoria sugerida</dt>
              <dd>{nomeCategoria(cats.dados, x.categoria_sugerida)}</dd>
            </>
          )}
          {doc.autor_nome && (
            <>
              <dt>Enviado por</dt>
              <dd>{doc.autor_nome}</dd>
            </>
          )}
        </dl>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}

        {doc.candidatas.length > 0 && (
          <section class="pilha pilha--p">
            <h3 class="secao-titulo">Pode pagar uma conta</h3>
            <p class="fraco">{doc.candidatas.length > 1 ? 'Há mais de uma conta parecida: escolha a certa.' : 'Confira as evidências antes de marcar como paga.'}</p>
            <div role="radiogroup" aria-label="Conta que este comprovante paga" class="pilha pilha--p">
              {doc.candidatas.map((c) => (
                <label key={c.parcela_id} class={`fin-candidata${parcela === c.parcela_id ? ' fin-candidata--sel' : ''}`}>
                  <input type="radio" name={`cand-${doc.id}`} checked={parcela === c.parcela_id} onChange={() => setParcela(c.parcela_id)} />
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
            {parcela && x.valor && doc.candidatas.find((c) => c.parcela_id === parcela)?.saldo !== x.valor && (
              <p class="fraco">O pagamento registrado será de <strong>{moeda(x.valor)}</strong>, o valor do comprovante. Se a conta tinha valor a confirmar, este passa a ser o valor dela.</p>
            )}
            <Botao variante="primario" icone={<Check aria-hidden="true" />} disabled={!parcela || !!ocupado} carregando={ocupado === 'pagar'} onClick={() => parcela && resolver('pagar', () => financeiro.resolverDocumento(doc.id, { acao: 'pagar_parcela', parcela_id: parcela }), 'Conta marcada como paga com este comprovante.')}>
              Marcar a conta escolhida como paga
            </Botao>
          </section>
        )}

        <section class="pilha pilha--p">
          <h3 class="secao-titulo">{doc.candidatas.length ? 'Ou é uma despesa nova' : 'Registrar como despesa'}</h3>
          <Campo rotulo="Categoria">
            {(id) => (
              <select id={id} class="selecao" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                <option value="">Escolha…</option>
                <OpcoesCategoria cats={cats.dados ?? []} />
              </select>
            )}
          </Campo>
          <Botao disabled={!categoria || !!ocupado} carregando={ocupado === 'despesa'} icone={<Receipt aria-hidden="true" />} onClick={() => resolver('despesa', () => financeiro.resolverDocumento(doc.id, { acao: 'registrar_despesa', categoria }), 'Despesa registrada a partir do comprovante.')}>
            Registrar despesa paga
          </Botao>
        </section>

        <div class="linha" style={{ borderTop: '1px solid var(--borda)', paddingTop: '14px' }}>
          {doc.tipo_documento === 'nota_compra' && (
            <Botao icone={<PackagePlus aria-hidden="true" />} disabled={!!ocupado} carregando={ocupado === 'compras'} onClick={() => resolver('compras', () => financeiro.enviarParaCompras(doc.id), 'Enviada para Compras. Confira os itens no Estoque.')}>
              Enviar para Compras
            </Botao>
          )}
          <Botao variante="fantasma" icone={<X aria-hidden="true" />} disabled={!!ocupado} onClick={() => confirmar({ titulo: 'Descartar este documento?', texto: 'Use para foto repetida, documento que não é do Âmbar ou que não gera lançamento.', confirmar: 'Descartar', perigo: true, motivo: { rotulo: 'Motivo' }, acao: async (m) => { await financeiro.resolverDocumento(doc.id, { acao: 'descartar', motivo: m }); atualizarFinanceiro(); aoResolver(); }, sucesso: 'Documento descartado.' })}>
            Descartar
          </Botao>
        </div>
      </div>
    </div>
  );
}
