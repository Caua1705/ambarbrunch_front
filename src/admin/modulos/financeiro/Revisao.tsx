// Revisão: o que precisa de uma pessoa — despesas em revisão (categoria, valor alto, data suspeita) e documentos do grupo
// que a Júlia não resolveu sozinha (ela só marca uma conta como paga quando todas as evidências batem).
// Despesa: POST /admin/financeiro/despesas/{id}/confirmar (com a categoria certa — a MESMA despesa, nada é lançado de
// novo) ou /cancelar. Documento: POST /admin/financeiro/revisao/documentos/{id}/resolver (pagar_parcela |
// registrar_despesa | descartar; de novo = 409 ja_resolvido) ou /comprovantes/{id}/enviar-para-compras (nota de insumos).
import { useEffect, useState } from 'preact/hooks';
import { Check, X, ChevronRight, FileText, Receipt, CircleCheck, CircleDashed, PackagePlus, Info, Eye } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, relativo, plural } from '../../lib/formato';
import { Gaveta, useConfirmacao, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Aviso, Etiqueta, Cabecalho, Cartao } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { DespesaRevisao, DocumentoRevisao, FilaRevisao } from '../../lib/tipos/financeiro';
import { MOTIVO_REVISAO, EVIDENCIA, ORIGEM, useCategorias, nomeCategoria, OpcoesCategoria, atualizarFinanceiro, avisar, avisarFalha, temPermissao, usePermissao } from './comum';
import { Documento } from './Documento';
import { DetalheDespesa } from './DetalheDespesa';

const TIPO_DOC: Record<DocumentoRevisao['tipo_documento'], string> = {
  comprovante_pagamento: 'Comprovante de pagamento',
  boleto: 'Boleto',
  recibo: 'Recibo',
  nota_compra: 'Nota de compra',
  ambiguo: 'Documento não identificado',
};

const motivo = (m: string) => MOTIVO_REVISAO[m] ?? m.replace(/_/g, ' ');

export function Revisao({ contexto }: { contexto: ContextoPainel }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const consulta = useConsulta('financeiro/revisao', () => financeiro.revisao());
  const [docId, setDocId] = useState<string | null>(null);
  const [despesa, setDespesa] = useState<string | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const doc = consulta.dados?.documentos.itens.find((d) => d.id === docId) ?? null;
  // Documento resolvido (saiu da fila): fecha a gaveta.
  useEffect(() => {
    if (docId && consulta.dados && !doc) setDocId(null);
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
                    {f.documentos.itens.map((d) => (
                      <li key={d.id}>
                        <button class="lista__item" onClick={() => setDocId(d.id)}>
                          <span class="lista__icone lista__icone--atencao" aria-hidden="true"><FileText /></span>
                          <span class="lista__texto">
                            <strong>{d.extraido.descricao ?? d.extraido.recebedor_nome ?? d.legenda ?? TIPO_DOC[d.tipo_documento]}</strong>
                            <span>{[TIPO_DOC[d.tipo_documento], d.motivos.map(motivo).join(', '), d.autor_nome ? `enviado por ${d.autor_nome}` : null, relativo(d.criado_em)].filter(Boolean).join(' · ')}</span>
                            {d.candidatas.length > 0 && <span class="fraco">{plural(d.candidatas.length, 'conta que ele pode estar pagando', 'contas que ele pode estar pagando')}</span>}
                          </span>
                          <span class="lista__fim"><span class="num forte" style={{ color: 'var(--texto)' }}>{moeda(d.extraido.valor ?? null)}</span><ChevronRight aria-hidden="true" /></span>
                        </button>
                      </li>
                    ))}
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
        aberta={!!doc}
        aoFechar={() => setDocId(null)}
        largura="larga"
        titulo={doc ? TIPO_DOC[doc.tipo_documento] : ''}
        subtitulo={doc ? `Enviado ${doc.autor_nome ? `por ${doc.autor_nome} ` : ''}à Júlia ${relativo(doc.criado_em)}` : undefined}
      >
        {doc && <DocumentoDetalhe key={doc.id} doc={doc} aoResolver={() => setDocId(null)} confirmar={confirmar} />}
      </Gaveta>
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
      {dialogo}
    </>
  );
}

/** Despesa em revisão com as ações do painel antigo à mão: categoria, confirmar, cancelar e o detalhe (com o documento). */
function ItemDespesa({ d, lancar, aoAbrir, confirmar }: { d: DespesaRevisao; lancar: boolean; aoAbrir: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const cats = useCategorias();
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
              <OpcoesCategoria cats={cats.dados ?? []} />
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

function DocumentoDetalhe({ doc, aoResolver, confirmar }: { doc: DocumentoRevisao; aoResolver: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const cats = useCategorias();
  const lancar = usePermissao('financeiro.lancar');
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
        <div class="linha">{doc.motivos.map((m) => <Etiqueta key={m} tom="atencao">{motivo(m)}</Etiqueta>)}</div>
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
          {x.descricao && (
            <>
              <dt>Descrição lida</dt>
              <dd>{x.descricao}</dd>
            </>
          )}
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
            <h3 class="secao-titulo">Contas que este documento pode estar pagando</h3>
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
            {parcela && x.valor && doc.candidatas.find((c) => c.parcela_id === parcela)?.saldo !== x.valor && (
              <p class="fraco">O pagamento registrado será de <strong>{moeda(x.valor)}</strong>, o valor do comprovante. Se a conta tinha valor a confirmar, este passa a ser o valor dela.</p>
            )}
            {lancar && (
              <Botao variante="primario" icone={<Check aria-hidden="true" />} disabled={!parcela || !!ocupado} carregando={ocupado === 'pagar'} onClick={() => parcela && resolver('pagar', () => financeiro.resolverDocumento(doc.id, { acao: 'pagar_parcela', parcela_id: parcela }), 'Conta marcada como paga com este documento.')}>
                Marcar a conta escolhida como paga
              </Botao>
            )}
          </section>
        )}

        {lancar && (
          <>
            <section class="pilha pilha--p">
              <h3 class="secao-titulo">{doc.candidatas.length ? 'Ou é uma despesa nova' : 'Registrar como despesa'}</h3>
              <Campo rotulo="Categoria" ajuda={doc.tipo_documento === 'boleto' && x.vencimento ? 'Boleto com vencimento: vira uma conta a pagar.' : 'Vira uma despesa já paga, com a data do documento.'}>
                {(id, d) => (
                  <select id={id} class="selecao" aria-describedby={d} value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                    <option value="">Escolha…</option>
                    <OpcoesCategoria cats={cats.dados ?? []} />
                  </select>
                )}
              </Campo>
              <Botao disabled={!categoria || !!ocupado} carregando={ocupado === 'despesa'} icone={<Receipt aria-hidden="true" />} onClick={() => resolver('despesa', () => financeiro.resolverDocumento(doc.id, { acao: 'registrar_despesa', categoria }), 'Despesa registrada a partir do documento.')}>
                Registrar como despesa
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
          </>
        )}
      </div>
    </div>
  );
}
