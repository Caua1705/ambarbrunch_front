// Gaveta da despesa: valores, parcelas e pagamentos (com estorno), rateio da compra, anexos e histórico.
// Ações: confirmar (com categoria), corrigir (PATCH com versão e motivo), mudar de unidade (POST …/unidade, §5.6) e
// cancelar — sempre a MESMA despesa. Anexos: GET …/despesas/{id}/documentos (§5.5), um por arquivo, com o papel de cada.
import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Check, Pencil, X, Undo2, Info, Banknote, Building2 } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, dataHora, paraDecimal, num } from '../../lib/formato';
import { Gaveta, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Aviso, Etiqueta, Situacao } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { Dados, Esqueleto } from '../../ui/estados';
import type { DespesaSaida } from '../../lib/tipos/financeiro';
import { ORIGEM, MOTIVO_REVISAO, FORMAS, useCategorias, useNomeCategoria, OpcoesCategoria, atualizarFinanceiro, avisar, avisarFalha, usePermissao, useUnidades } from './comum';
import { Anexos } from './Anexos';
import { Pagar, type ContaParaPagar } from './Pagar';

const brl = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DetalheDespesa({ id, aoFechar, confirmar }: { id: string | null; aoFechar: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const consulta = useConsulta(id ? `financeiro/despesa:${id}` : null, () => financeiro.despesa(id!));
  const cats = useCategorias();
  const nome = useNomeCategoria();
  const { unidades } = useUnidades();
  const lancar = usePermissao('financeiro.lancar');
  const [editando, setEditando] = useState<false | 'dados' | 'unidade'>(false);
  const [categoria, setCategoria] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [pagar, setPagar] = useState<ContaParaPagar | null>(null);
  useEffect(() => {
    setEditando(false);
    setCategoria('');
  }, [id]);

  const d = consulta.dados;
  const semCategoria = d && (d.categoria_codigo === 'a_classificar' || d.motivos_revisao.includes('categoria_a_classificar'));

  async function confirmarDespesa() {
    if (!d) return;
    setOcupado(true);
    try {
      await financeiro.confirmarDespesa(d.id, categoria || undefined);
      atualizarFinanceiro();
      avisar('Despesa confirmada.', 'ok');
    } catch (e) {
      avisarFalha(e);
    } finally {
      setOcupado(false);
    }
  }

  const rodape = d && lancar && !editando && d.status !== 'cancelada' && (
    <>
      <Botao variante="fantasma" icone={<X aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Cancelar esta despesa?', texto: 'A despesa e as contas em aberto dela deixam de valer. Se já houver pagamento, estorne-o antes.', confirmar: 'Cancelar despesa', perigo: true, motivo: { rotulo: 'Motivo do cancelamento' }, acao: async (m) => { await financeiro.cancelarDespesa(d.id, m); atualizarFinanceiro(); }, sucesso: 'Despesa cancelada.' })}>
        Cancelar despesa
      </Botao>
      {unidades.length > 1 && <Botao icone={<Building2 aria-hidden="true" />} onClick={() => setEditando('unidade')}>Mudar unidade</Botao>}
      <Botao icone={<Pencil aria-hidden="true" />} onClick={() => setEditando('dados')}>Corrigir</Botao>
      {d.status === 'em_revisao' && (
        <Botao variante="primario" icone={<Check aria-hidden="true" />} carregando={ocupado} disabled={!!semCategoria && !categoria} onClick={confirmarDespesa}>
          Confirmar despesa
        </Botao>
      )}
    </>
  );

  return (
    <>
      <Gaveta aberta={!!id && !pagar} aoFechar={aoFechar} titulo={d?.descricao ?? 'Despesa'} subtitulo={d ? `${moeda(d.valor)} · ${nome(d.categoria_codigo)}` : undefined} rodape={rodape} largura="media">
        <Dados consulta={consulta} recurso="A despesa" esqueleto={<Esqueleto linhas={8} />}>
          {(d: DespesaSaida) =>
            editando === 'unidade' ? (
              <MudarUnidade d={d} aoTerminar={(movida) => (movida ? aoFechar() : setEditando(false))} />
            ) : editando ? (
              <Correcao d={d} aoTerminar={() => setEditando(false)} />
            ) : (
              <>
                <div class="linha">
                  {d.status === 'em_revisao' ? <Situacao tom="atencao" destaque>Para revisar</Situacao> : d.status === 'cancelada' ? <Situacao tom="apagado">Cancelada</Situacao> : <Situacao tom="ok">Confirmada</Situacao>}
                  {d.valor_a_confirmar && <Etiqueta tom="info">Valor a confirmar</Etiqueta>}
                  {d.recorrencia_id && <Etiqueta>Conta fixa</Etiqueta>}
                  {d.compra_id && <Etiqueta>Compra de insumos</Etiqueta>}
                </div>

                {d.status === 'em_revisao' && (
                  <div class="pilha pilha--p fin-destaque">
                    <strong>Por que está em revisão</strong>
                    <span class="suave">{d.motivos_revisao.map((m) => MOTIVO_REVISAO[m] ?? m).join(' · ') || 'Conferência da gerência'}</span>
                    {semCategoria && (
                      <Campo rotulo="Categoria correta" ajuda="Confirmar muda a categoria desta mesma despesa — nada é lançado em dobro.">
                        {(cid, descr) => (
                          <select id={cid} class="selecao" aria-describedby={descr} value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                            <option value="">Escolha…</option>
                            <OpcoesCategoria cats={cats.dados ?? []} />
                          </select>
                        )}
                      </Campo>
                    )}
                  </div>
                )}
                {d.cancelado_em && <Aviso tom="info">Cancelada em {dataHora(d.cancelado_em)}{d.cancelado_motivo ? ` — ${d.cancelado_motivo}` : ''}.</Aviso>}

                <dl class="definicoes">
                  <dt>Valor</dt>
                  <dd class="num forte">{moeda(d.valor)}</dd>
                  <dt>Competência</dt>
                  <dd>{dataCurta(d.competencia, { ano: true })}</dd>
                  <dt>Categoria</dt>
                  <dd>{nome(d.categoria_codigo)}</dd>
                  <dt>Fornecedor</dt>
                  <dd>{d.fornecedor ? `${d.fornecedor.nome}${d.fornecedor.documento ? ` · ${d.fornecedor.documento}` : ''}` : <span class="fraco">Não informado</span>}</dd>
                  <dt>Origem</dt>
                  <dd>{ORIGEM[d.origem] ?? d.origem}{d.criado_por ? ` · ${d.criado_por}` : ''}</dd>
                  <dt>Lançada em</dt>
                  <dd>{dataHora(d.criado_em)}</dd>
                </dl>

                {d.rateio.length > 0 && (
                  <section class="pilha pilha--p">
                    <h3 class="secao-titulo">Dividida por categoria</h3>
                    <p class="fraco">Compra com insumos e outros itens: a mesma despesa é dividida. Para mudar, corrija os itens da compra no Estoque.</p>
                    <dl class="definicoes">
                      {d.rateio.map((x) => (
                        <Fragment key={x.categoria}>
                          <dt>{nome(x.categoria)}</dt>
                          <dd class="num">{moeda(x.valor)}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </section>
                )}

                <section class="pilha pilha--p">
                  <h3 class="secao-titulo">{d.parcelas.length > 1 ? `Parcelas (${d.parcelas.length})` : 'Pagamento'}</h3>
                  {d.parcelas.map((p) => (
                    <div key={p.id} class="fin-parcela">
                      <div class="linha linha--entre">
                        <span>
                          {d.parcelas.length > 1 && <span class="forte">{p.numero}ª · </span>}
                          vence {dataCurta(p.vencimento, { ano: true })}
                        </span>
                        <span class="num forte">{moeda(p.valor)}</span>
                      </div>
                      <div class="linha linha--entre fraco">
                        <span>{p.situacao === 'paga' ? 'Paga' : p.situacao === 'cancelada' ? 'Cancelada' : num(p.valor_pago) ? `Pago ${moeda(p.valor_pago)} · falta ${moeda(p.saldo)}` : 'Em aberto'}</span>
                        {lancar && p.situacao === 'aberta' && d.status !== 'cancelada' && (
                          <Botao tamanho="p" icone={<Banknote aria-hidden="true" />} onClick={() => setPagar({ parcela_id: p.id, descricao: d.descricao, fornecedor: d.fornecedor?.nome, vencimento: p.vencimento, valor: p.valor, valor_pago: p.valor_pago, saldo: p.saldo, valor_a_confirmar: d.valor_a_confirmar })}>
                            Pagar
                          </Botao>
                        )}
                      </div>
                      {p.pagamentos.map((pg) => (
                        <div key={pg.id} class="linha linha--entre fin-pagamento">
                          <span>
                            {pg.estornado_em ? <s>{moeda(pg.valor)}</s> : <span class="num">{moeda(pg.valor)}</span>} em {dataCurta(pg.pago_em)} · {FORMAS.find((f) => f.valor === pg.forma)?.rotulo ?? pg.forma}
                            <span class="fraco"> · {ORIGEM[pg.origem] ?? pg.origem}{pg.conciliacao === 'automatica' ? ' (conciliado automaticamente)' : ''}</span>
                            {pg.estornado_em && <span class="fraco"> · estornado: {pg.estorno_motivo}</span>}
                          </span>
                          {lancar && !pg.estornado_em && (
                            <Botao tamanho="p" variante="fantasma" icone={<Undo2 aria-hidden="true" />} onClick={() => confirmar({ titulo: `Estornar o pagamento de ${moeda(pg.valor)}?`, texto: 'A conta volta a ficar em aberto. Se o pagamento foi conciliado com o extrato, desfaça a conciliação antes.', confirmar: 'Estornar', perigo: true, motivo: { rotulo: 'Motivo do estorno' }, acao: async (m) => { await financeiro.estornarPagamento(pg.id, m); atualizarFinanceiro(); }, sucesso: 'Pagamento estornado.' })}>
                              Estornar
                            </Botao>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </section>

                <Anexos despesaId={d.id} arquivoId={d.arquivo_id} />

                {(d.historico?.length ?? 0) > 0 && (
                  <section class="pilha pilha--p">
                    <h3 class="secao-titulo">Histórico</h3>
                    <ul class="lista fraco">
                      {d.historico!.map((h, i) => (
                        <li key={i} style={{ padding: '6px 0' }}>{dataHora(h.em)} · {h.acao.replace(/_/g, ' ')}{h.ator ? ` · ${h.ator}` : ''}{motivoDo(h.dados) ? <span> — “{motivoDo(h.dados)}”</span> : null}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )
          }
        </Dados>
      </Gaveta>
      <Pagar conta={pagar} aoFechar={() => setPagar(null)} />
    </>
  );
}

/** Correção auditada: só os campos mudados vão ao backend, com a versão lida e o motivo. */
function Correcao({ d, aoTerminar }: { d: DespesaSaida; aoTerminar: () => void }) {
  const cats = useCategorias();
  const nome = useNomeCategoria();
  const [descricao, setDescricao] = useState(d.descricao);
  const [valor, setValor] = useState(brl(d.valor));
  const [competencia, setCompetencia] = useState(d.competencia);
  const [categoria, setCategoria] = useState(d.categoria_codigo);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: Event) {
    e.preventDefault();
    const v = paraDecimal(valor);
    if (!v || Number(v) <= 0) return setErro(new ErroApi('validacao', 'Informe um valor válido.', 0, null, { valor: 'Valor inválido.' }));
    if (motivo.trim().length < 5) return setErro(new ErroApi('validacao', 'Explique o motivo da correção.', 0, null, { motivo: 'Pelo menos 5 caracteres.' }));
    const c: { versao: number; motivo: string; descricao?: string; valor?: string; competencia?: string; categoria?: string } = { versao: d.versao, motivo: motivo.trim() };
    if (descricao.trim() !== d.descricao) c.descricao = descricao.trim();
    if (Number(v) !== Number(d.valor)) c.valor = v;
    if (competencia !== d.competencia) c.competencia = competencia;
    if (categoria !== d.categoria_codigo) c.categoria = categoria;
    if (Object.keys(c).length === 2) return aoTerminar();
    setEnviando(true);
    setErro(null);
    try {
      await financeiro.corrigirDespesa(d.id, c);
      atualizarFinanceiro();
      avisar('Despesa corrigida.', 'ok');
      aoTerminar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível corrigir.');
      if (x.codigo === 'despesa_com_rateio') x.message = 'Esta despesa é dividida pelos itens da compra: a categoria só muda corrigindo os itens no Estoque.';
      if (x.tipo === 'conflito') atualizarFinanceiro();
      setErro(x);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form class="pilha" onSubmit={salvar} noValidate>
      <h3 class="secao-titulo">Corrigir despesa</h3>
      <p class="fraco">A correção fica registrada com o antes, o depois e o seu motivo.</p>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
      <div class="grade-campos">
        <Campo rotulo="Descrição" class="inteiro" erro={erro?.campos.descricao}>
          {(id) => <input id={id} class="entrada" maxLength={300} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />}
        </Campo>
        <Campo rotulo="Valor" erro={erro?.campos.valor}>
          {(id, dsc) => <EntradaMoeda id={id} descr={dsc} valor={valor} aoMudar={setValor} invalido={!!erro?.campos.valor} />}
        </Campo>
        <Campo rotulo="Competência" ajuda="Mês a que a despesa pertence.">
          {(id, dsc) => <input id={id} type="date" class="entrada" aria-describedby={dsc} value={competencia} onChange={(e) => setCompetencia(e.currentTarget.value)} />}
        </Campo>
        <Campo rotulo="Categoria" class="inteiro">
          {(id) => (
            <select id={id} class="selecao" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
              {categoria === 'a_classificar' && <option value="a_classificar">Não classificado</option>}
              <OpcoesCategoria cats={cats.dados ?? []} atual={{ codigo: d.categoria_codigo, nome: nome(d.categoria_codigo) }} />
            </select>
          )}
        </Campo>
        <Campo rotulo="Motivo da correção" class="inteiro" erro={erro?.campos.motivo}>
          {(id) => <textarea id={id} class="area" maxLength={300} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} placeholder="Ex.: valor digitado errado; a nota diz R$ 120,00" />}
        </Campo>
      </div>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar} disabled={enviando}>Voltar</Botao>
        <Botao variante="primario" type="submit" carregando={enviando}>Salvar correção</Botao>
      </div>
    </form>
  );
}

/** Motivo registrado num evento do histórico (correção, cancelamento, mudança de unidade), quando houver. */
function motivoDo(dados: unknown): string | null {
  const m = dados && typeof dados === 'object' ? (dados as { motivo?: unknown }).motivo : null;
  return typeof m === 'string' && m.trim() ? m : null;
}

/** Despesa lançada na unidade errada (ex.: teste que entrou sem #teste) vai para a certa, com motivo e auditoria. */
function MudarUnidade({ d, aoTerminar }: { d: DespesaSaida; aoTerminar: (movida: boolean) => void }) {
  const { unidade: atual, unidades } = useUnidades();
  const outras = unidades.filter((u) => u.codigo !== atual?.codigo);
  const [unidade, setUnidade] = useState(outras[0]?.codigo ?? '');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const RECUSA: Record<string, string> = {
    despesa_de_compra: 'Despesa de compra não muda de unidade: o estoque é da unidade. Cancele a compra no Estoque e lance de novo na unidade certa.',
    despesa_conciliada: 'Um pagamento desta despesa está conciliado com o extrato: desfaça a conciliação antes.',
    apuracao_fechada: 'O mês desta despesa já foi conferido ou fechado numa das duas unidades: reabra a apuração antes.',
  };

  async function salvar(e: Event) {
    e.preventDefault();
    if (!unidade) return setErro(new ErroApi('validacao', 'Escolha a unidade certa.', 0, null, { unidade: 'Escolha a unidade.' }));
    if (motivo.trim().length < 5) return setErro(new ErroApi('validacao', 'Explique o motivo.', 0, null, { motivo: 'Pelo menos 5 caracteres.' }));
    setEnviando(true);
    setErro(null);
    try {
      await financeiro.mudarUnidadeDespesa(d.id, { unidade, versao: d.versao, motivo: motivo.trim() });
      atualizarFinanceiro();
      avisar(`Despesa levada para ${unidades.find((u) => u.codigo === unidade)?.nome ?? unidade}.`, 'ok');
      aoTerminar(true);
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível mudar a unidade.');
      if (x.codigo && RECUSA[x.codigo]) x.message = RECUSA[x.codigo];
      if (x.tipo === 'conflito') atualizarFinanceiro();
      setErro(x);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form class="pilha" onSubmit={salvar} noValidate aria-label="Mudar unidade">
      <h3 class="secao-titulo">Mudar a despesa de unidade</h3>
      <p class="fraco">Para lançamento feito na unidade errada. A despesa, as parcelas e os documentos ligados a ela vão juntos; a mudança fica no histórico com o seu motivo.</p>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
      <Campo rotulo="Unidade certa" erro={erro?.campos.unidade}>
        {(id) => (
          <select id={id} class="selecao" value={unidade} onChange={(e) => setUnidade(e.currentTarget.value)}>
            {outras.map((u) => <option key={u.codigo} value={u.codigo}>{u.nome}</option>)}
          </select>
        )}
      </Campo>
      <Campo rotulo="Motivo" erro={erro?.campos.motivo}>
        {(id) => <textarea id={id} class="area" maxLength={300} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} placeholder="Ex.: lançamento de teste enviado sem #teste" />}
      </Campo>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={() => aoTerminar(false)} disabled={enviando}>Voltar</Botao>
        <Botao variante="primario" type="submit" carregando={enviando}>Mudar unidade</Botao>
      </div>
    </form>
  );
}
