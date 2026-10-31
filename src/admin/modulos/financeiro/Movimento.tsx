// Gaveta de uma movimentação do extrato: a proposta do sistema (candidatos, evidências, alertas) e a decisão humana
// (vincular, registrar despesa ou receita, liquidar vendas, classificar). Rotas /conciliacao/movimentos/{id}*.
import { useEffect, useState } from 'preact/hooks';
import { ChevronRight, CircleCheck, AlertTriangle, Undo2, Check, Copy, Split, Info } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, dataHora } from '../../lib/formato';
import { Gaveta, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Aviso, Situacao, Etiqueta, Segmentado } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { MovimentoDetalhe, CandidatoConciliacao } from '../../lib/tipos/financeiro';
import { NIVEL, CLASSIFICACOES, useCategorias, OpcoesCategoria, categoriaValida, atualizarFinanceiro, avisar, avisarFalha } from './comum';

/** Tipo do vínculo (tabela conciliacoes do backend). */
const TIPO_VINCULO: Record<string, string> = {
  pagamento: 'Pagamento',
  outra_receita: 'Outra receita',
  vendas: 'Repasse de vendas',
  transferencia_propria: 'Transferência entre contas próprias',
  aporte_socio: 'Aporte de sócio',
  emprestimo: 'Empréstimo',
  reembolso: 'Reembolso',
  estorno: 'Estorno',
  nao_operacional: 'Não operacional',
};


export const TIPO_CANDIDATO: Record<CandidatoConciliacao['tipo'], string> = {
  pagamento: 'Pagamento já registrado',
  parcela: 'Conta a pagar em aberto',
  outra_receita: 'Receita já registrada',
  vendas: 'Vendas do PDV (Pix, cartão, dinheiro)',
  par: 'Movimento em outra conta (transferência ou estorno)',
};
const ACAO: Record<string, string> = {
  vincular_pagamento: 'Vincular a este pagamento',
  pagar_parcela: 'Marcar esta conta como paga',
  vincular_receita: 'Vincular a esta receita',
  liquidar_vendas: 'É o repasse destas vendas',
  classificar: 'Confirmar a classificação',
  registrar_despesa: 'Registrar despesa',
  registrar_receita: 'Registrar receita',
};
const ALERTA: Record<string, string> = {
  pagamento_parcial: 'Pagamento parcial',
  cobre_so_parte: 'Cobre só parte do valor',
  despesa_em_revisao: 'A despesa ainda está em revisão',
  valor_a_confirmar: 'Conta de valor a confirmar',
  periodo_e_taxa_a_conferir: 'Confira período e taxa da maquininha',
  maior_que_o_pix_vendido: 'Maior que o Pix vendido no período',
};

type Decisao = 'candidato' | 'despesa' | 'receita' | 'vendas' | 'classificar';

export function Movimento({ id, aoFechar, confirmar }: { id: string | null; aoFechar: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const consulta = useConsulta(id ? `financeiro/movimento:${id}` : null, () => financeiro.movimento(id!));
  const cats = useCategorias();
  const [cand, setCand] = useState<number | null>(null);
  const [decisao, setDecisao] = useState<Decisao>('candidato');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [meio, setMeio] = useState('cartao');
  const [vDe, setVDe] = useState('');
  const [vAte, setVAte] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const m = consulta.dados;

  useEffect(() => {
    if (!m) return;
  // Só pré-seleciona com sugestão FORTE (um candidato de valor exato com prova). Ambígua: nada marcado.
    setCand(m.nivel === 'forte' && m.candidatos.length ? 0 : null);
    // A sugestão do backend é um objeto: classificar (com `classificacao`) ou registrar despesa (com `categoria`).
    const sug = m.classificacao_sugerida;
    setDecisao(m.candidatos.length ? 'candidato' : sug?.acao === 'classificar' ? 'classificar' : m.direcao === 'debito' ? 'despesa' : 'receita');
    setClassificacao(sug?.classificacao ?? '');
    setDescricao(m.descricao);
    // A sugestão pelo texto do banco só vale se a categoria ainda for válida na unidade.
    const sugerida = sug?.acao === 'registrar_despesa' ? sug.categoria ?? '' : '';
    setCategoria(sugerida && (cats.dados ?? []).some((c) => c.codigo === sugerida && categoriaValida(c)) ? sugerida : '');
    setVDe(m.data);
    setVAte(m.data);
    setObservacao('');
    setErro(null);
  }, [m?.id, m?.versao]);

  async function agir(corpo: Record<string, unknown>, ok: string) {
    if (!m) return;
    setOcupado(true);
    setErro(null);
    try {
      await financeiro.acaoMovimento(m.id, { versao: m.versao, ...corpo } as { versao: number; acao: string });
      atualizarFinanceiro();
      avisar(ok, 'ok');
      aoFechar();
    } catch (e) {
      avisarFalha(e);
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  }
  async function identidade(decisao: 'distinto' | 'duplicado') {
    if (!m) return;
    setOcupado(true);
    try {
      await financeiro.identidade(m.id, m.versao, decisao);
      atualizarFinanceiro();
      avisar(decisao === 'duplicado' ? 'Marcada como duplicada: sai das somas.' : 'Marcadas como operações diferentes.', 'ok');
    } catch (e) {
      avisarFalha(e);
    } finally {
      setOcupado(false);
    }
  }

  const executar = () => {
    if (!m) return;
    if (decisao === 'candidato') {
      const c = cand !== null ? m.candidatos[cand] : null;
      if (!c) return setErro('Escolha uma das opções.');
      return agir({ acao: c.acao, ...c.parametros }, 'Movimentação conciliada.');
    }
    if (decisao === 'despesa') {
      if (!descricao.trim() || !categoria) return setErro('Informe descrição e categoria.');
      return agir({ acao: 'registrar_despesa', descricao: descricao.trim(), categoria, competencia: m.data }, 'Despesa registrada e conciliada.');
    }
    if (decisao === 'receita') {
      if (!descricao.trim()) return setErro('Descreva de onde veio a receita.');
      return agir({ acao: 'registrar_receita', descricao: descricao.trim(), competencia: m.data }, 'Receita registrada e conciliada.');
    }
    if (decisao === 'vendas') return agir({ acao: 'liquidar_vendas', meio, de: vDe, ate: vAte }, 'Repasse de vendas vinculado (nenhuma receita nova).');
    if (!classificacao) return setErro('Escolha a classificação.');
    if (classificacao === 'nao_operacional' && observacao.trim().length < 5) return setErro('Explique em observação.');
    const par = m.candidatos.find((c) => c.tipo === 'par')?.parametros.movimento_par_id;
    return agir({ acao: 'classificar', classificacao, observacao: observacao.trim() || null, movimento_par_id: classificacao === 'transferencia_propria' || classificacao === 'estorno' ? par ?? null : null }, 'Movimentação classificada.');
  };

  const pode = (a: string) => !m || m.acoes_possiveis.length === 0 || m.acoes_possiveis.some((x) => x === a || x.startsWith(`${a}:`));
  const opcoes: { valor: Decisao; rotulo: string }[] = [];
  if (m) {
    if (m.candidatos.length) opcoes.push({ valor: 'candidato', rotulo: 'Sugestões' });
    if (m.direcao === 'debito' && pode('registrar_despesa')) opcoes.push({ valor: 'despesa', rotulo: 'Despesa nova' });
    if (m.direcao === 'credito' && pode('registrar_receita')) opcoes.push({ valor: 'receita', rotulo: 'Receita nova' });
    if (m.direcao === 'credito' && pode('liquidar_vendas')) opcoes.push({ valor: 'vendas', rotulo: 'Repasse de vendas' });
    if (pode('classificar')) opcoes.push({ valor: 'classificar', rotulo: 'Classificar' });
  }
  const bloqueada = m?.nivel === 'conflito';
  const resolvida = m?.situacao === 'conciliado' || m?.situacao === 'duplicado';

  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      largura="media"
      titulo={m ? `${m.direcao === 'credito' ? 'Entrada' : 'Saída'} de ${moeda(m.valor)}` : 'Movimentação'}
      subtitulo={m ? `${dataCurta(m.data, { ano: true })} · ${m.conta.apelido}` : undefined}
      rodape={m && !bloqueada && !resolvida && (
        <>
          <Botao onClick={aoFechar}>Deixar pendente</Botao>
          <Botao variante="primario" icone={<Check aria-hidden="true" />} carregando={ocupado} disabled={decisao === 'candidato' && cand === null} onClick={executar}>
            {decisao === 'candidato' && cand !== null ? ACAO[m.candidatos[cand].acao] ?? 'Confirmar' : 'Confirmar decisão'}
          </Botao>
        </>
      )}
    >
      <Dados consulta={consulta} recurso="A movimentação" esqueleto={<Esqueleto linhas={8} />}>
        {(m: MovimentoDetalhe) => (
          <>
            <div class="fin-destaque pilha pilha--p">
              <span class="num pequeno">{m.descricao}</span>
              <span class="linha">
                <Situacao tom={NIVEL[m.nivel].tom}>{NIVEL[m.nivel].rotulo}</Situacao>
                {m.situacao === 'parcial' && <Etiqueta tom="info">Falta conciliar {moeda(m.saldo_a_conciliar)}</Etiqueta>}
                {m.fitid && <span class="fraco">ID do banco: {m.fitid}</span>}
              </span>
            </div>

            {bloqueada && (
              <Aviso tom="atencao" icone={<Copy aria-hidden="true" />}>
                <strong>Pode ser a mesma operação importada duas vezes{m.conflito?.tipo ? ` (${m.conflito.tipo.replace(/_/g, ' ')})` : ''}.</strong> Decida antes de conciliar.
                <div class="linha" style={{ marginTop: '8px' }}>
                  <Botao tamanho="p" icone={<Split aria-hidden="true" />} disabled={ocupado} onClick={() => identidade('distinto')}>São operações diferentes</Botao>
                  <Botao tamanho="p" icone={<Copy aria-hidden="true" />} disabled={ocupado} onClick={() => identidade('duplicado')}>É a mesma (duplicada)</Botao>
                </div>
              </Aviso>
            )}

            {!bloqueada && !resolvida && (
              <>
                {opcoes.length > 1 && <Segmentado<Decisao> rotulo="Decisão" valor={decisao} aoMudar={(v) => { setDecisao(v); setErro(null); }} opcoes={opcoes} />}
                {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}

                {decisao === 'candidato' && (
                  <div role="radiogroup" aria-label="O que é esta movimentação" class="pilha pilha--p">
                    {m.nivel === 'ambigua' && <p class="fraco">Há mais de uma opção de mesmo valor: escolha a certa com base nas evidências.</p>}
                    {m.candidatos.map((c, i) => (
                      <label key={c.referencia ?? `${c.tipo}-${i}`} class={`fin-candidata${cand === i ? ' fin-candidata--sel' : ''}`}>
                        <input type="radio" name={`mov-${m.id}`} checked={cand === i} onChange={() => setCand(i)} />
                        <span class="pilha pilha--p" style={{ flex: 1, minWidth: 0 }}>
                          <span class="linha linha--entre">
                            <strong>{c.descricao}</strong>
                            <span class="num forte">{moeda(c.valor)}</span>
                          </span>
                          <span class="fraco">{TIPO_CANDIDATO[c.tipo]} · {dataCurta(c.data)}</span>
                          <span class="fin-evidencias">
                            {c.evidencias.map((e) => <span key={e.codigo} class="fin-ev fin-ev--ok"><CircleCheck aria-hidden="true" /> {e.texto}</span>)}
                            {c.alertas.map((a) => <span key={a} class="fin-ev fin-ev--alerta"><AlertTriangle aria-hidden="true" /> {ALERTA[a] ?? a}</span>)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {decisao === 'despesa' && (
                  <div class="pilha">
                    <p class="fraco">Cria uma despesa já paga, com a data do banco. Use só se ela ainda não foi lançada.</p>
                    {m.classificacao_sugerida?.acao === 'registrar_despesa' && <p class="fraco">Sugestão pela descrição do banco: <strong>{m.classificacao_sugerida.texto}</strong> Confira.</p>}
                    <Campo rotulo="Descrição">{(cid) => <input id={cid} class="entrada" value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />}</Campo>
                    <Campo rotulo="Categoria">
                      {(cid) => (
                        <select id={cid} class="selecao" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                          <option value="">Escolha…</option>
                          <OpcoesCategoria cats={cats.dados ?? []} />
                        </select>
                      )}
                    </Campo>
                  </div>
                )}
                {decisao === 'receita' && (
                  <div class="pilha">
                    <p class="fraco">Receita fora do PDV (evento faturado, por exemplo). Venda de balcão já entra pelo PDV: não registre aqui.</p>
                    <Campo rotulo="De onde veio">{(cid) => <input id={cid} class="entrada" value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />}</Campo>
                  </div>
                )}
                {decisao === 'vendas' && (
                  <div class="pilha">
                    <p class="fraco">Marca esta entrada como o repasse de vendas que o PDV já registrou. <strong>Não cria receita nova.</strong></p>
                    <div class="grade-campos">
                      <Campo rotulo="Meio" class="inteiro">
                        {(cid) => (
                          <select id={cid} class="selecao" value={meio} onChange={(e) => setMeio(e.currentTarget.value)}>
                            <option value="cartao">Cartão (crédito e débito)</option>
                            <option value="credito">Cartão de crédito</option>
                            <option value="debito">Cartão de débito</option>
                            <option value="pix">Pix</option>
                            <option value="dinheiro">Dinheiro (depósito do caixa)</option>
                            <option value="outro">Outro</option>
                          </select>
                        )}
                      </Campo>
                      <Campo rotulo="Vendas de">{(cid) => <input id={cid} type="date" class="entrada" value={vDe} onChange={(e) => setVDe(e.currentTarget.value)} />}</Campo>
                      <Campo rotulo="até">{(cid) => <input id={cid} type="date" class="entrada" value={vAte} onChange={(e) => setVAte(e.currentTarget.value)} />}</Campo>
                    </div>
                  </div>
                )}
                {decisao === 'classificar' && (
                  <div class="pilha">
                    {m.classificacao_sugerida?.acao === 'classificar' && <p class="fraco">Sugestão pela descrição do banco: <strong>{CLASSIFICACOES.find((c) => c.valor === m.classificacao_sugerida?.classificacao)?.rotulo ?? m.classificacao_sugerida.classificacao}</strong> — {m.classificacao_sugerida.texto} Confira.</p>}
                    <div role="radiogroup" aria-label="Classificação" class="pilha pilha--p">
                      {CLASSIFICACOES.filter((c) => !c.direcao || c.direcao === m.direcao).map((c) => (
                        <label key={c.valor} class={`fin-candidata${classificacao === c.valor ? ' fin-candidata--sel' : ''}`}>
                          <input type="radio" name={`cls-${m.id}`} checked={classificacao === c.valor} onChange={() => setClassificacao(c.valor)} />
                          <span class="pilha pilha--p"><strong>{c.rotulo}</strong><span class="fraco">{c.ajuda}</span></span>
                        </label>
                      ))}
                    </div>
                    <Campo rotulo="Observação" opcional={classificacao !== 'nao_operacional'}>{(cid) => <textarea id={cid} class="area" maxLength={300} value={observacao} onInput={(e) => setObservacao(e.currentTarget.value)} />}</Campo>
                  </div>
                )}
              </>
            )}

            {(m.vinculos?.length ?? 0) > 0 && (
              <section class="pilha pilha--p">
                <h3 class="secao-titulo">Vínculos</h3>
                <ul class="lista fin-borda">
                  {m.vinculos!.map((v) => (
                    <li key={v.id} class="lista__item">
                      <span class="lista__texto">
                        <strong>{TIPO_VINCULO[v.tipo] ?? v.tipo.replace(/_/g, ' ')}{v.observacao ? <span class="fraco"> · {v.observacao}</span> : null}</strong>
                        <span>{moeda(v.valor)} · {dataHora(v.criado_em)}{v.criado_por ? ` · ${v.criado_por}` : ''}{v.status === 'desfeita' ? ` · desfeito${v.desfeita_em ? ` em ${dataHora(v.desfeita_em)}` : ''}${v.desfeita_motivo ? `: ${v.desfeita_motivo}` : ''}` : ''}</span>
                      </span>
                      {v.status === 'ativa' && (
                        <Botao tamanho="p" variante="fantasma" icone={<Undo2 aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Desfazer esta conciliação?', texto: 'O que a conciliação criou (pagamento, despesa ou receita) é estornado; a movimentação volta para conferir.', confirmar: 'Desfazer', perigo: true, motivo: { rotulo: 'Motivo' }, acao: async (mot) => { await financeiro.desfazerVinculo(v.id, mot); atualizarFinanceiro(); }, sucesso: 'Conciliação desfeita.' })}>
                          Desfazer
                        </Botao>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {resolvida && !(m.vinculos?.length) && <Aviso tom="ok" icone={<CircleCheck aria-hidden="true" />}>Movimentação já resolvida.</Aviso>}
            <p class="fraco"><ChevronRight size={12} aria-hidden="true" style={{ display: 'inline' }} /> Sugestões do sistema são só sugestões: toda conciliação é confirmada por uma pessoa.</p>
          </>
        )}
      </Dados>
    </Gaveta>
  );
}
