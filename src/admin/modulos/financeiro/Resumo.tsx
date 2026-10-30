// Resumo: receitas, despesas, resultado gerencial (com a qualidade do número), contas e o que precisa de alguém.
// Rotas: GET /admin/financeiro/resumo e /admin/financeiro/relatorios/evolucao. Cada alerta leva à aba que resolve.
import { Wallet, Receipt, Scale, CalendarClock, ChevronRight, FileWarning, Landmark, RefreshCw, Sparkles, Info } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, num, mesAno, mesCurto, plural, hojeISO, relativo, inteiro } from '../../lib/formato';
import { rotaPainel } from '../../lib/rotas';
import { Indicador, Cartao, Cabecalho, Variacao, Aviso } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { GraficoBarras, Legenda } from '../../ui/graficos';
import type { ResumoFinanceiro } from '../../lib/tipos/financeiro';
import { SeloQualidade, MotivosQualidade, QUALIDADE, ESTADO_CONCILIACAO } from './comum';
import type { IrPara } from './index';

export function Resumo({ ir }: { contexto: ContextoPainel; ir: IrPara }) {
  const consulta = useConsulta('financeiro/resumo', () => financeiro.resumo());
  const evolucao = useConsulta('financeiro/evolucao:6', () => financeiro.evolucao(6));

  return (
    <Dados consulta={consulta} recurso="O Financeiro" esqueleto={<Esqueleto linhas={8} altura={28} />}>
      {(r: ResumoFinanceiro) => {
        const pendRevisao = r.revisao.despesas + r.revisao.documentos;
        const atencao = [
          pendRevisao > 0 && { id: 'revisar', icone: <FileWarning />, tom: 'atencao', titulo: plural(pendRevisao, 'lançamento para revisar', 'lançamentos para revisar'), detalhe: `${plural(r.revisao.documentos, 'comprovante da Júlia', 'comprovantes da Júlia')} · ${plural(r.revisao.despesas, 'despesa', 'despesas')}`, acao: () => ir('revisao') },
          r.contas.vencidas.qtd > 0 && { id: 'vencidas', icone: <Receipt />, tom: 'perigo', titulo: plural(r.contas.vencidas.qtd, 'conta vencida', 'contas vencidas'), detalhe: `${moeda(r.contas.vencidas.valor)} em aberto`, acao: () => ir('contas', { situacao: 'vencidas' }) },
          r.contas.hoje.qtd > 0 && { id: 'hoje', icone: <CalendarClock />, tom: 'atencao', titulo: plural(r.contas.hoje.qtd, 'conta vence hoje', 'contas vencem hoje'), detalhe: moeda(r.contas.hoje.valor), acao: () => ir('contas', { situacao: 'hoje' }) },
          r.conciliacao_mes_anterior && { id: 'conciliacao', icone: <Landmark />, tom: 'info', titulo: `Conciliação de ${mesAno(r.conciliacao_mes_anterior.mes).toLowerCase()}`, detalhe: r.conciliacao_mes_anterior.texto, href: rotaPainel(r.conciliacao_mes_anterior.rota) ?? undefined, acao: () => ir('resultado', { vista: 'fechamento' }) },
          'atrasada' in r.sincronizacao && r.sincronizacao.atrasada && { id: 'sync', icone: <RefreshCw />, tom: 'atencao', titulo: 'Vendas do PDV atrasadas', detalhe: `Última sincronização ${relativo(r.sincronizacao.ultimo_sucesso_em)}`, acao: undefined },
        ].filter(Boolean) as { id: string; icone: preact.ComponentChildren; tom: string; titulo: string; detalhe: string; acao?: () => void }[];
        const q = r.mes.qualidade;
        return (
          <>
            <Cabecalho titulo={`Resumo de ${mesAno(r.mes.inicio).split(" ")[0].toLowerCase()}`} descricao="Do primeiro dia do mês até hoje" />

            {r.conciliacao_mes_anterior && (
              <Aviso tom="atencao" icone={<Landmark aria-hidden="true" />}>
                <strong>{ESTADO_CONCILIACAO[r.conciliacao_mes_anterior.estado]?.rotulo ?? 'Conciliação pendente'}</strong> — {r.conciliacao_mes_anterior.texto}{' '}
                <button class="btn btn--p btn--fantasma" onClick={() => ir('resultado', { vista: 'fechamento' })}>Ver fechamento</button>
              </Aviso>
            )}

            <section class="indicadores" aria-label="Indicadores do mês">
              <Indicador
                rotulo="Receitas do mês"
                medio
                icone={<Wallet aria-hidden="true" />}
                valor={moeda(r.mes.receita)}
                rodape={<><Variacao atual={num(r.mes.receita)} anterior={num(r.mes.receita_mes_anterior_ate_o_mesmo_dia)} /> vs. mesmo período do mês anterior</>}
              />
              <Indicador
                rotulo="Despesas do mês"
                medio
                icone={<Receipt aria-hidden="true" />}
                valor={moeda(r.mes.despesas_confirmadas)}
                rodape={`${moeda(r.mes.pago)} pagos · ${moeda(r.mes.a_pagar)} a pagar`}
              />
              <Indicador
                rotulo="Resultado gerencial parcial"
                medio
                icone={<Scale aria-hidden="true" />}
                valor={moeda(r.mes.resultado_parcial)}
                rodape={<><SeloQualidade q={q.nivel} /> não é lucro contábil</>}
              />
              <Indicador
                rotulo="Contas a pagar"
                icone={<CalendarClock aria-hidden="true" />}
                valor={inteiro(r.contas.vencidas.qtd + r.contas.hoje.qtd + r.contas.proximas.qtd)}
                rodape={r.contas.vencidas.qtd ? <span style={{ color: 'var(--perigo)', fontWeight: 600 }}>{plural(r.contas.vencidas.qtd, 'vencida', 'vencidas')} · {moeda(r.contas.vencidas.valor)}</span> : `${moeda(r.contas.proximas.valor)} nos próximos dias`}
              />
            </section>

            <div class="duas-colunas">
              <div class="pilha">
                <Cartao titulo="Receitas e despesas" descricao="Por mês, últimos 6 meses" acoes={<button class="btn btn--p btn--fantasma" onClick={() => ir('resultado', { vista: 'evolucao' })}>Evolução <ChevronRight size={14} aria-hidden="true" /></button>}>
                  <Dados consulta={evolucao} recurso="O relatório de evolução" compacto esqueleto={<Esqueleto linhas={6} altura={28} />}>
                    {(meses) =>
                      meses.every((m) => m.receita_liquida === null && !num(m.despesas_operacionais)) ? (
                        <Vazio compacto titulo="Ainda sem meses para comparar">O gráfico aparece quando houver vendas sincronizadas e despesas lançadas.</Vazio>
                      ) : (
                        <div class="pilha">
                          <GraficoBarras
                            rotulo="Receita líquida e despesas operacionais por mês"
                            rotulos={meses.map((m) => mesCurto(m.mes))}
                            formatar={(v) => moeda(v)}
                            series={[
                              { nome: 'Receita líquida', cor: 'var(--grafico-1)', valores: meses.map((m) => num(m.receita_liquida)) },
                              { nome: 'Despesas operacionais', cor: 'var(--grafico-2)', valores: meses.map((m) => num(m.despesas_operacionais ?? null)) },
                            ]}
                          />
                          <Legenda series={[{ nome: 'Receita líquida', cor: 'var(--grafico-1)' }, { nome: 'Despesas operacionais', cor: 'var(--grafico-2)' }]} />
                          <p class="fraco">Compras de estoque não entram como despesa operacional: viram custo (CMV) no resultado do mês.</p>
                        </div>
                      )
                    }
                  </Dados>
                </Cartao>

                <Cartao titulo="Qualidade do resultado do mês" descricao={QUALIDADE[q.nivel].explicacao} acoes={<SeloQualidade q={q.nivel} />}>
                  {q.motivos.length ? <MotivosQualidade q={q} /> : <p class="suave">Nenhuma ressalva para o período até agora.</p>}
                  <p class="fraco" style={{ marginTop: '10px' }}>
                    Resultado gerencial = receitas − custo das mercadorias − despesas do mês. Os valores mudam conforme lançamentos e conferências.
                    {r.mes.cmv_fonte === 'indisponivel' && ' O custo das mercadorias (CMV) ainda não pode ser calculado.'}
                    {r.mes.cmv_fonte === 'teorico' && ' O custo das mercadorias usa as fichas técnicas (teórico).'}
                  </p>
                </Cartao>
              </div>

              <div class="pilha fin-primeiro-no-celular">
                <Cartao titulo="Precisa de atenção" justo>
                  {atencao.length ? (
                    <ul class="lista">
                      {atencao.map((i) => (
                        <li key={i.id}>
                          {i.acao ? (
                            <button class="lista__item" onClick={i.acao}>
                              <span class={`lista__icone lista__icone--${i.tom}`} aria-hidden="true">{i.icone}</span>
                              <span class="lista__texto"><strong>{i.titulo}</strong><span>{i.detalhe}</span></span>
                              <span class="lista__fim"><ChevronRight aria-hidden="true" /></span>
                            </button>
                          ) : (
                            <div class="lista__item">
                              <span class={`lista__icone lista__icone--${i.tom}`} aria-hidden="true">{i.icone}</span>
                              <span class="lista__texto"><strong>{i.titulo}</strong><span>{i.detalhe}</span></span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Vazio compacto icone={<Sparkles aria-hidden="true" />} titulo="Tudo em dia">Nenhuma revisão, conta vencida ou conciliação pendente.</Vazio>
                  )}
                </Cartao>

                <Cartao titulo="Hoje" descricao={hojeISO().split('-').reverse().join('/')} acoes={<button class="btn btn--p btn--fantasma" onClick={() => ir('vendas')}>Vendas <ChevronRight size={14} aria-hidden="true" /></button>}>
                  <dl class="definicoes">
                    <dt>Vendas no PDV</dt>
                    <dd class="num forte">{moeda(r.hoje.receita)}</dd>
                    <dt>Atendimentos</dt>
                    <dd class="num">{inteiro(r.hoje.vendas)}</dd>
                    <dt>Ticket médio</dt>
                    <dd class="num">{moeda(r.hoje.ticket_medio)}</dd>
                  </dl>
                  {'configurada' in r.sincronizacao ? (
                    <p class="fraco" style={{ marginTop: '10px' }}><Info size={13} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /> A integração com o PDV (Eyemobile) ainda não foi configurada.</p>
                  ) : (
                    <p class="fraco" style={{ marginTop: '10px' }}>Vendas sincronizadas {relativo(r.sincronizacao.ultimo_sucesso_em)}.</p>
                  )}
                </Cartao>
              </div>
            </div>
          </>
        );
      }}
    </Dados>
  );
}
