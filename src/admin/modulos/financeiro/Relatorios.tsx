// Relatórios: resultado do mês (DRE gerencial, com qualidade), despesas por categoria, evolução e fechamento do mês
// (checklist assistido + conciliação por conta + apuração). Detalhe só sob demanda.
// Rotas: /relatorios/resultado, /despesas-por-categoria, /evolucao; /fechamento/{mes}; /conciliacao/meses/*; /apuracoes/*.
import { useEffect, useState } from 'preact/hooks';
import { ChevronRight, CircleCheck, AlertTriangle, Info, Lock, Unlock, ClipboardCheck } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, num, pct, mesAno, mesCurto, hojeISO, somarMeses, fimMes, dataCurta, plural } from '../../lib/formato';
import { lerParam, gravarParams, rotaPainel } from '../../lib/rotas';
import { useConfirmacao } from '../../ui/camadas';
import { Botao, Cabecalho, Cartao, Segmentado, Situacao, Aviso, Variacao } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { GraficoLinhas, Legenda, BarraParte } from '../../ui/graficos';
import type { ResultadoMes, DespesasPorCategoria, MesEvolucao, Fechamento } from '../../lib/tipos/financeiro';
import { SeloQualidade, MotivosQualidade, QUALIDADE, GRUPO, ESTADO_CONCILIACAO, atualizarFinanceiro, avisar, avisarFalha } from './comum';

type Vista = 'resultado' | 'categorias' | 'evolucao' | 'fechamento';
const VISTAS: Vista[] = ['resultado', 'categorias', 'evolucao', 'fechamento'];

/** Pendência do fechamento → a tela que resolve (dentro do Financeiro, abre direto a fila ou o Banco). */
function destinoPendencia(rota: string | null) {
  if (!rota) return null;
  if (rota.startsWith('/admin/financeiro/revisao')) return '/admin/financeiro?aba=lancamentos&revisar=1';
  if (rota.startsWith('/admin/financeiro/conciliacao') || rota.startsWith('/admin/financeiro/extratos')) return '/admin/financeiro?aba=lancamentos&vista=banco';
  return rotaPainel(rota);
}

/** Mês anterior ao atual: o padrão (o mês corrente ainda está em andamento). */
const mesPadrao = () => somarMeses(hojeISO(), -1).slice(0, 7);

export function Relatorios({ contexto }: { contexto: ContextoPainel }) {
  const inicial = lerParam('vista') as Vista | null;
  const [vista, setVista] = useState<Vista>(inicial && VISTAS.includes(inicial) ? inicial : 'resultado');
  const [mes, setMes] = useState(lerParam('mes') ?? mesPadrao());
  useEffect(() => gravarParams({ vista: vista === 'resultado' ? null : vista, mes: mes === mesPadrao() ? null : mes }), [vista, mes]);
  return (
    <>
      <Cabecalho
        titulo="Relatórios"
        descricao="Resultado gerencial, despesas e fechamento do mês"
        acoes={vista !== 'evolucao' && (
          <>
            <label class="sr" for="mes-relatorio">Mês</label>
            <input id="mes-relatorio" type="month" class="entrada" style={{ width: 'auto' }} value={mes} max={hojeISO().slice(0, 7)} onChange={(e) => e.currentTarget.value && setMes(e.currentTarget.value)} />
          </>
        )}
      />
      <Segmentado<Vista> rotulo="Relatório" valor={vista} aoMudar={setVista} opcoes={[{ valor: 'resultado', rotulo: 'Resultado do mês' }, { valor: 'categorias', rotulo: 'Por categoria' }, { valor: 'evolucao', rotulo: 'Evolução' }, { valor: 'fechamento', rotulo: 'Fechamento' }]} />
      {vista === 'resultado' && <Resultado mes={mes} />}
      {vista === 'categorias' && <Categorias mes={mes} />}
      {vista === 'evolucao' && <Evolucao />}
      {vista === 'fechamento' && <FechamentoMes mes={mes} contexto={contexto} />}
    </>
  );
}

function Linha({ rotulo, valor, sub, forte, recuo, negativo, nota }: { rotulo: string; valor: string | null | undefined; sub?: string; forte?: boolean; recuo?: boolean; negativo?: boolean; nota?: string }) {
  return (
    <div class={`fin-dre__linha${forte ? ' fin-dre__linha--forte' : ''}${recuo ? ' fin-dre__linha--recuo' : ''}`}>
      <span>
        {rotulo}
        {nota && <span class="fraco"> · {nota}</span>}
      </span>
      <span class="num">
        {valor === null || valor === undefined ? '—' : `${negativo && num(valor) ? '− ' : ''}${moeda(valor)}`}
        {sub && <span class="fraco"> {sub}</span>}
      </span>
    </div>
  );
}

function Resultado({ mes }: { mes: string }) {
  const r = useConsulta(`financeiro/resultado:${mes}`, () => financeiro.resultado(mes));
  return (
    <Dados consulta={r} recurso="O resultado do mês" esqueleto={<Esqueleto linhas={10} />}>
      {(x: ResultadoMes) => {
        if (!x.disponivel) {
          return (
            <Cartao titulo={`Resultado de ${mesAno(x.mes).toLowerCase()}`} acoes={<SeloQualidade q={x.qualidade.nivel} />}>
              <Vazio compacto titulo="Ainda não dá para calcular este mês">Faltam dados para um resultado confiável.</Vazio>
              <MotivosQualidade q={x.qualidade} />
            </Cartao>
          );
        }
        const pctR = (v: string | null) => (v === null ? undefined : `(${pct(v)})`);
        return (
          <div class="duas-colunas">
            <Cartao titulo={`Resultado gerencial · ${mesAno(x.mes)}`} descricao="Gerencial: não substitui a contabilidade" acoes={<SeloQualidade q={x.qualidade.nivel} />}>
              <div class="fin-dre">
                <Linha rotulo="Faturamento bruto" valor={x.receita.faturamento_bruto} nota={plural(x.receita.vendas, 'venda', 'vendas')} />
                <Linha rotulo="Descontos e devoluções" valor={String((num(x.receita.descontos) ?? 0) + (num(x.receita.devolucoes) ?? 0))} recuo negativo />
                <Linha rotulo="Outras receitas" valor={x.receita.outras_receitas} recuo />
                <Linha rotulo="Receita líquida" valor={x.receita.receita_liquida} forte />
                <Linha rotulo="Custo das mercadorias (CMV)" valor={x.cmv.valor} negativo nota={x.cmv.fonte === 'por_inventario' ? 'por inventário' : x.cmv.fonte === 'teorico' ? 'teórico, pelas fichas' : 'indisponível'} />
                <Linha rotulo="Margem bruta" valor={x.margem_bruta} sub={pctR(x.margem_bruta_pct)} forte />
                <Linha rotulo="Pessoal" valor={x.despesas_operacionais.pessoal} recuo negativo />
                <Linha rotulo="Ocupação" valor={x.despesas_operacionais.ocupacao} recuo negativo />
                <Linha rotulo="Operacional" valor={x.despesas_operacionais.operacional} recuo negativo />
                <Linha rotulo="Marketing" valor={x.despesas_operacionais.marketing} recuo negativo />
                <Linha rotulo="Taxas de cartão (estimadas)" valor={x.taxas_cartao_estimadas.valor} recuo negativo />
                <Linha rotulo="Resultado operacional" valor={x.resultado_operacional} sub={pctR(x.resultado_operacional_pct)} forte />
                <Linha rotulo="Impostos" valor={x.impostos} recuo negativo />
                <Linha rotulo="Despesas financeiras" valor={x.financeiro} recuo negativo />
                <div class="fin-dre__total">
                  <span>Resultado gerencial</span>
                  <span class="num">{moeda(x.resultado_gerencial)} {x.resultado_gerencial_pct !== null && <span class="fraco">({pct(x.resultado_gerencial_pct)})</span>}</span>
                </div>
              </div>
              <details class="fin-detalhes">
                <summary>Fora do resultado</summary>
                <div class="fin-dre">
                  <Linha rotulo="Investimentos (obras, equipamentos)" valor={x.fora_do_resultado.investimento} />
                  <Linha rotulo="Retiradas de sócios" valor={x.fora_do_resultado.retirada} />
                  <Linha rotulo="Repasse da taxa de serviço" valor={x.fora_do_resultado.repasse} />
                  <Linha rotulo="Compras de estoque no mês" valor={x.compras_estoque_no_mes} nota="informativo" />
                  <Linha rotulo="Taxa de serviço (fora da receita)" valor={x.receita.taxa_servico_fora_da_receita} />
                </div>
              </details>
              {x.observacao && <p class="fraco" style={{ marginTop: '12px' }}>{x.observacao}</p>}
            </Cartao>

            <div class="pilha">
              <Cartao titulo="Comparação com o mês anterior">
                <dl class="definicoes">
                  <dt>Receita líquida</dt>
                  <dd class="num">{moeda(x.receita.receita_liquida)} <Variacao atual={num(x.receita.receita_liquida)} anterior={num(x.mes_anterior.receita_liquida)} /><span class="sub fraco" style={{ display: 'block' }}>{mesAno(x.mes_anterior.mes).split(' ')[0]}: {moeda(x.mes_anterior.receita_liquida)}</span></dd>
                  <dt>Resultado gerencial</dt>
                  <dd class="num">{moeda(x.resultado_gerencial)} <Variacao atual={num(x.resultado_gerencial)} anterior={num(x.mes_anterior.resultado_gerencial)} /><span class="sub fraco" style={{ display: 'block' }}>{mesAno(x.mes_anterior.mes).split(' ')[0]}: {moeda(x.mes_anterior.resultado_gerencial)} ({QUALIDADE[x.mes_anterior.qualidade].rotulo.toLowerCase()})</span></dd>
                </dl>
              </Cartao>
              <Cartao titulo="Qualidade do número" acoes={<SeloQualidade q={x.qualidade.nivel} />}>
                <p class="suave">{QUALIDADE[x.qualidade.nivel].explicacao}</p>
                <MotivosQualidade q={x.qualidade} />
              </Cartao>
              <Cartao titulo="Custo das mercadorias (CMV)">
                {x.cmv.fonte === 'indisponivel' ? (
                  <>
                    <Aviso tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>O CMV deste mês não pode ser calculado ainda.</Aviso>
                    <ul class="fraco" style={{ margin: '8px 0 0', paddingLeft: '18px' }}>{x.cmv.motivos_indisponivel.map((m) => <li key={m.codigo}>{m.texto}</li>)}</ul>
                  </>
                ) : (
                  <dl class="definicoes">
                    <dt>Usado no resultado</dt>
                    <dd class="num forte">{moeda(x.cmv.valor)} <span class="fraco">({x.cmv.fonte === 'por_inventario' ? 'inventário' : 'teórico'})</span></dd>
                    <dt>Pelo inventário</dt>
                    <dd class="num">{moeda(x.cmv.alternativas.por_inventario)}</dd>
                    <dt>Teórico (fichas)</dt>
                    <dd class="num">{moeda(x.cmv.alternativas.teorico)}{x.cmv.teorico_incompleto ? <span class="fraco"> · fichas incompletas</span> : null}</dd>
                  </dl>
                )}
                <div class="fin-destaque" style={{ marginTop: '12px' }}>
                  <span class="fraco">Compras de estoque no mês: <strong class="num">{moeda(x.cmv.indicadores.compras_estoque_mes)}</strong>{x.cmv.indicadores.compras_estoque_sobre_receita_pct !== null ? ` (${pct(x.cmv.indicadores.compras_estoque_sobre_receita_pct)} da receita)` : ''}.</span>
                  <span class="fraco" style={{ display: 'block', marginTop: '4px' }}><Info size={12} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-1px' }} /> {x.cmv.indicadores.aviso || 'Compras do mês divididas pela receita NÃO são CMV: o estoque pode ter sobrado ou faltado.'}</span>
                </div>
              </Cartao>
            </div>
          </div>
        );
      }}
    </Dados>
  );
}

function Categorias({ mes }: { mes: string }) {
  const de = `${mes}-01`;
  const ate = fimMes(de);
  const r = useConsulta(`financeiro/por-categoria:${mes}`, () => financeiro.porCategoria(de, ate));
  return (
    <Cartao titulo={`Despesas por categoria · ${mesAno(de)}`} descricao="Despesas confirmadas da competência, com o rateio das compras">
      <Dados consulta={r} recurso="O relatório por categoria" esqueleto={<Esqueleto linhas={8} />}>
        {(x: DespesasPorCategoria) => {
          if (!x.itens.length) return <Vazio compacto titulo="Nenhuma despesa confirmada no mês" />;
          const total = num(x.total) ?? 0;
          const grupos = [...new Set(x.itens.map((i) => i.grupo))];
          return (
            <div class="pilha">
              <div class="linha linha--entre"><span class="suave">Total</span><strong class="num" style={{ fontSize: '18px' }}>{moeda(x.total)}</strong></div>
              {grupos.map((g) => {
                const itens = x.itens.filter((i) => i.grupo === g).sort((a, b) => Number(b.valor) - Number(a.valor));
                const soma = itens.reduce((s, i) => s + Number(i.valor), 0);
                return (
                  <section key={g} class="pilha pilha--p">
                    <div class="linha linha--entre"><h3 class="secao-titulo">{GRUPO[g] ?? g}</h3><span class="num fraco">{moeda(soma)}</span></div>
                    {itens.map((i) => (
                      <div key={i.categoria} class="fin-categoria">
                        <div class="linha linha--entre">
                          <span>{i.nome} <span class="fraco">· {plural(i.despesas, 'lançamento', 'lançamentos')}</span></span>
                          <span class="num">{moeda(i.valor)} <span class="fraco">{pct(i.pct)}</span></span>
                        </div>
                        <BarraParte valor={Number(i.valor)} total={total} cor={g === 'compras_estoque' ? 'var(--grafico-2)' : 'var(--grafico-1)'} />
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          );
        }}
      </Dados>
    </Cartao>
  );
}

function Evolucao() {
  const r = useConsulta('financeiro/evolucao:12', () => financeiro.evolucao(12));
  return (
    <Cartao titulo="Evolução mensal" descricao="Últimos 12 meses">
      <Dados consulta={r} recurso="A evolução" esqueleto={<Esqueleto linhas={8} altura={24} />}>
        {(ms: MesEvolucao[]) => (
          <div class="pilha">
            <GraficoLinhas
              rotulo="Receita líquida, despesas operacionais e resultado gerencial por mês"
              rotulos={ms.map((m) => mesCurto(m.mes))}
              formatar={(v) => moeda(v)}
              series={[
                { nome: 'Receita líquida', cor: 'var(--grafico-1)', valores: ms.map((m) => num(m.receita_liquida)) },
                { nome: 'Despesas operacionais', cor: 'var(--grafico-3)', valores: ms.map((m) => num(m.despesas_operacionais ?? null)) },
                { nome: 'Resultado gerencial', cor: 'var(--grafico-2)', valores: ms.map((m) => num(m.resultado_gerencial ?? null)), tracejada: true },
              ]}
            />
            <Legenda series={[{ nome: 'Receita líquida', cor: 'var(--grafico-1)' }, { nome: 'Despesas operacionais', cor: 'var(--grafico-3)' }, { nome: 'Resultado gerencial', cor: 'var(--grafico-2)', tracejada: true }]} />
            <details class="fin-detalhes">
              <summary>Ver os números</summary>
              <div class="tabela-rolagem">
                <table class="tabela" aria-label="Evolução mensal">
                  <thead><tr><th>Mês</th><th class="num">Receita</th><th class="num" data-prioridade="media">CMV</th><th class="num" data-prioridade="baixa">Despesas</th><th class="num">Resultado</th><th>Qualidade</th></tr></thead>
                  <tbody>
                    {[...ms].reverse().map((m) => (
                      <tr key={m.mes}>
                        <td>{mesAno(m.mes)}</td>
                        <td class="num">{moeda(m.receita_liquida)}</td>
                        <td class="num" data-prioridade="media">{moeda(m.cmv)}</td>
                        <td class="num" data-prioridade="baixa">{moeda(m.despesas_operacionais ?? null)}</td>
                        <td class="num forte">{moeda(m.resultado_gerencial ?? null)}</td>
                        <td><SeloQualidade q={m.qualidade} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}
      </Dados>
    </Cartao>
  );
}

function FechamentoMes({ mes, contexto }: { mes: string; contexto: ContextoPainel }) {
  const papel = contexto.usuario.papel;
  const f = useConsulta(`financeiro/fechamento:${mes}`, () => financeiro.fechamento(mes));
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const emAndamento = mes >= hojeISO().slice(0, 7);

  async function executar(rotulo: string, fn: () => Promise<unknown>, ok: string) {
    setOcupado(rotulo);
    try {
      await fn();
      atualizarFinanceiro();
      avisar(ok, 'ok');
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'pendencias') {
        const p = (e.dados?.pendencias as { codigo: string }[] | undefined)?.map((x) => x.codigo.replace(/_/g, ' ')).join(', ');
        avisar(`Ainda há pendências na conta: ${p ?? 'confira a lista'}.`, 'erro');
      } else avisarFalha(e);
    } finally {
      setOcupado(null);
    }
  }

  const fechar = () =>
    confirmar({
      titulo: `Fechar a apuração de ${mesAno(`${mes}-01`).toLowerCase()}?`,
      texto: 'Os números ficam congelados. Só um administrador reabre.',
      confirmar: 'Fechar apuração',
      acao: async () => {
        try {
          await financeiro.fecharApuracao(mes);
        } catch (e) {
          if (e instanceof ErroApi && e.codigo === 'conciliacao_pendente') {
            setTimeout(() => confirmar({ titulo: 'O extrato do mês não está conciliado', texto: 'Para fechar mesmo assim, registre o motivo. A incompletude continua visível na apuração.', confirmar: 'Fechar com exceção', perigo: true, motivo: { rotulo: 'Motivo da exceção', minimo: 10 }, acao: async (m) => { await financeiro.fecharApuracao(mes, m); atualizarFinanceiro(); }, sucesso: 'Apuração fechada com exceção registrada.' }), 50);
            return;
          }
          throw e;
        }
        atualizarFinanceiro();
        avisar('Apuração fechada.', 'ok');
      },
    });

  return (
    <>
      <Dados consulta={f} recurso="O fechamento do mês" esqueleto={<Esqueleto linhas={8} />}>
        {(x: Fechamento) => (
          <div class="duas-colunas">
            <Cartao titulo={`Fechamento de ${mesAno(x.mes).toLowerCase()}`} descricao={x.concluido ? 'Tudo conferido' : `${plural(x.pendencias.length, 'item pede atenção', 'itens pedem atenção')}`} justo acoes={x.concluido ? <Situacao tom="ok">Pronto</Situacao> : undefined}>
              {emAndamento && <div style={{ padding: '14px 20px 0' }}><Aviso tom="info" icone={<Info aria-hidden="true" />}>Este mês ainda está em andamento: o fechamento é feito depois do último dia.</Aviso></div>}
              {x.pendencias.length ? (
                <ul class="lista">
                  {x.pendencias.map((p) => {
                    const destino = destinoPendencia(p.rota);
                    const corpo = (
                      <>
                        <span class={`lista__icone lista__icone--${p.situacao === 'pendente' ? 'perigo' : p.situacao === 'atencao' ? 'atencao' : 'info'}`} aria-hidden="true">{p.situacao === 'indisponivel' ? <Info /> : <AlertTriangle />}</span>
                        <span class="lista__texto">
                          <strong>{p.titulo}</strong>
                          <span>{[p.quantidade ? plural(p.quantidade, 'item', 'itens') : null, p.valor ? moeda(p.valor) : null, p.detalhe].filter(Boolean).join(' · ') || (p.situacao === 'indisponivel' ? 'Indisponível por enquanto' : 'Conferir')}</span>
                        </span>
                        {destino && <span class="lista__fim"><ChevronRight aria-hidden="true" /></span>}
                      </>
                    );
                    return <li key={p.codigo}>{destino ? <a class="lista__item" href={destino}>{corpo}</a> : <div class="lista__item">{corpo}</div>}</li>;
                  })}
                </ul>
              ) : (
                <Vazio compacto icone={<CircleCheck aria-hidden="true" />} titulo="Nenhuma pendência">Vendas, contas, revisões, extrato e compras do mês estão em dia.</Vazio>
              )}
            </Cartao>

            <div class="pilha">
              <Cartao titulo="Extrato bancário" descricao={ESTADO_CONCILIACAO[x.conciliacao.estado].rotulo} justo>
                {x.conciliacao.contas.length ? (
                  <ul class="lista">
                    {x.conciliacao.contas.map((c) => (
                      <li key={c.conta.id} class="lista__item" style={{ flexWrap: 'wrap' }}>
                        <span class="lista__texto" style={{ minWidth: '160px' }}>
                          <strong>{c.conta.apelido}</strong>
                          <span>
                            {c.lacunas.length ? `Faltam ${c.lacunas.map((l) => `${dataCurta(l.de)}–${dataCurta(l.ate)}`).join(', ')}` : c.cobertura_integral ? 'Mês inteiro importado' : 'Sem extrato'}
                            {c.pendentes ? ` · ${plural(c.pendentes, 'movimento para conferir', 'movimentos para conferir')}` : ''}
                          </span>
                        </span>
                        <span class="lista__fim">
                          <Situacao tom={ESTADO_CONCILIACAO[c.estado].tom}>{ESTADO_CONCILIACAO[c.estado].rotulo}</Situacao>
                          {c.estado === 'integral_informado' && pode(papel, 'financeiro.conciliar_mes') && (
                            <Botao tamanho="p" variante="primario" carregando={ocupado === `c-${c.conta.id}`} onClick={() => executar(`c-${c.conta.id}`, () => financeiro.conciliarMes(mes, c.conta.id), 'Mês conciliado nesta conta.')}>Conciliar mês</Botao>
                          )}
                          {c.estado === 'conciliado' && pode(papel, 'financeiro.reabrir_mes') && (
                            <Botao tamanho="p" variante="fantasma" onClick={() => confirmar({ titulo: 'Reabrir a conciliação desta conta?', confirmar: 'Reabrir', motivo: { rotulo: 'Motivo' }, acao: async (m) => { await financeiro.reabrirMes(mes, c.conta.id, m); atualizarFinanceiro(); }, sucesso: 'Conciliação reaberta.' })}>Reabrir</Botao>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio compacto titulo="Nenhuma conta bancária">Cadastre a conta ao importar o primeiro extrato (Lançamentos → Importar extrato).</Vazio>
                )}
              </Cartao>

              <Cartao titulo="Apuração do mês" descricao="Os números oficiais do mês para a gestão" acoes={<Situacao tom={x.apuracao.status === 'fechada' ? 'ok' : x.apuracao.status === 'conferida' ? 'info' : 'neutro'}>{x.apuracao.status === 'fechada' ? 'Fechada' : x.apuracao.status === 'conferida' ? 'Conferida' : 'Rascunho'}</Situacao>}>
                <dl class="definicoes">
                  <dt>Qualidade</dt>
                  <dd><SeloQualidade q={x.apuracao.qualidade} /></dd>
                  {x.apuracao.excecao_conciliacao && (
                    <>
                      <dt>Fechada com exceção</dt>
                      <dd>“{x.apuracao.excecao_conciliacao.motivo}” · {x.apuracao.excecao_conciliacao.por}</dd>
                    </>
                  )}
                </dl>
                <div class="linha" style={{ marginTop: '14px' }}>
                  {x.apuracao.status === 'rascunho' && !emAndamento && (
                    <Botao icone={<ClipboardCheck aria-hidden="true" />} carregando={ocupado === 'conferir'} onClick={() => executar('conferir', () => financeiro.conferirApuracao(mes), 'Apuração conferida.')}>Marcar como conferida</Botao>
                  )}
                  {x.apuracao.status === 'conferida' && pode(papel, 'financeiro.fechar_apuracao') && (
                    <Botao variante="primario" icone={<Lock aria-hidden="true" />} onClick={fechar}>Fechar apuração</Botao>
                  )}
                  {x.apuracao.status === 'fechada' && pode(papel, 'financeiro.fechar_apuracao') && (
                    <Botao variante="fantasma" icone={<Unlock aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Reabrir a apuração?', texto: 'Os números voltam a ser recalculados.', confirmar: 'Reabrir', perigo: true, motivo: { rotulo: 'Motivo' }, acao: async (m) => { await financeiro.reabrirApuracao(mes, m); atualizarFinanceiro(); }, sucesso: 'Apuração reaberta.' })}>Reabrir apuração</Botao>
                  )}
                  {x.apuracao.status === 'conferida' && !pode(papel, 'financeiro.fechar_apuracao') && <span class="fraco">Fechar a apuração é do administrador.</span>}
                </div>
              </Cartao>
            </div>
          </div>
        )}
      </Dados>
      {dialogo}
    </>
  );
}
