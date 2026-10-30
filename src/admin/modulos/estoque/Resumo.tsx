// Resumo do Estoque: o que temos, o que precisa ser conferido, o que diverge e o que repor — repor só com saldo confiável.
// Tudo vem pronto de GET /admin/estoque/resumo; cada bloco leva à aba que resolve aquilo.
import { Package, PackageCheck, ShieldCheck, ShieldAlert, AlertTriangle, ChevronRight, TrendingUp, FileQuestion, Undo2, Info, FlaskConical } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { inteiro, pct, quantidade, relativo, custoBase, plural, moeda, dataCurta } from '../../lib/formato';
import { Indicador, Cartao, Aviso, Botao, Situacao } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { SituacaoCompra, type PermissoesEstoque } from './comum';
import type { AbaEstoque } from './index';

export function Resumo({ perm, aoAbrirCompra, aoIr }: { perm: PermissoesEstoque; aoAbrirCompra: (id: string) => void; aoIr: (aba: AbaEstoque) => void }) {
  const resumo = useConsulta('estoque/resumo', () => estoque.resumo());
  const conferir = useConsulta(perm.conferir ? 'estoque/compras?conferir' : null, () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));

  return (
    <Dados consulta={resumo} recurso="O Estoque" esqueleto={<Esqueleto linhas={6} altura={28} />}>
      {(r) => (
        <>
          {r.unidade?.teste && (
            <Aviso tom="atencao" icone={<FlaskConical aria-hidden="true" />}>
              <strong>Unidade de teste ({r.unidade.nome || r.unidade.codigo}).</strong> Estes números nunca entram nos da operação real.
            </Aviso>
          )}
          {!r.baixa_automatica && (
            <Aviso tom="info" icone={<Info aria-hidden="true" />}>
              <strong>A baixa automática pelas vendas ainda está desligada.</strong> Os saldos somam as compras e as contagens, mas não descontam o que foi vendido: use-os como referência e confirme pela contagem. Ela só é ligada depois do inventário inicial, das fichas cobrindo a receita e da autorização da gestão.
            </Aviso>
          )}
          <section class="indicadores" aria-label="Situação do estoque">
            <Indicador rotulo="Insumos cadastrados" icone={<Package aria-hidden="true" />} valor={inteiro(r.saldo_confiavel.total)} rodape={r.inicio_controle ? `Controle desde ${dataCurta(r.inicio_controle, { ano: true })}` : 'Início do controle não definido'} href="/admin/estoque?aba=insumos" />
            <Indicador
              rotulo="Compras para conferir"
              icone={<PackageCheck aria-hidden="true" />}
              valor={inteiro(r.compras_em_conferencia.qtd)}
              rodape={r.compras_em_conferencia.mais_antiga_em ? `A mais antiga chegou ${relativo(r.compras_em_conferencia.mais_antiga_em)}` : 'Nada esperando'}
              href="/admin/estoque?aba=compras"
            />
            <Indicador rotulo="Cancelamentos a responder" icone={<AlertTriangle aria-hidden="true" />} valor={inteiro(r.cancelamentos_pendentes)} rodape={r.cancelamentos_pendentes ? 'Vendas canceladas depois da baixa' : 'Nenhuma pendência'} href="/admin/estoque?aba=cancelamentos" />
            <Indicador
              rotulo="Saldos confiáveis"
              icone={r.saldo_confiavel.insumos === r.saldo_confiavel.total && r.saldo_confiavel.total ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
              valor={`${inteiro(r.saldo_confiavel.insumos)} de ${inteiro(r.saldo_confiavel.total)}`}
              medio
              rodape={r.baixa_automatica ? 'Contados e com baixa pelas vendas' : 'Dependem da baixa automática e da contagem'}
              href="/admin/estoque?aba=contagem"
            />
          </section>

          <div class="colunas-iguais">
            <div class="pilha">
              {perm.conferir && (
                <Cartao titulo="Para conferir" descricao="Notas e pagamentos de insumos que ainda não entraram no estoque" justo acoes={<button class="btn btn--p btn--fantasma" onClick={() => aoIr('compras')}>Todas as compras <ChevronRight size={14} aria-hidden="true" /></button>}>
                  <Dados consulta={conferir} compacto recurso="As compras" esqueleto={<div class="cartao__corpo"><Esqueleto linhas={3} /></div>}>
                    {({ itens }) =>
                      itens.length ? (
                        <ul class="lista">
                          {itens.slice(0, 6).map((c) => (
                            <li key={c.id}>
                              <button class="lista__item" onClick={() => aoAbrirCompra(c.id)}>
                                <span class="lista__icone lista__icone--atencao" aria-hidden="true"><PackageCheck /></span>
                                <span class="lista__texto">
                                  <strong>{c.fornecedor ?? 'Fornecedor não identificado'}</strong>
                                  <span>{moeda(c.valor_total)} · {c.origem === 'julia' ? 'pela Júlia' : 'pelo painel'}</span>
                                </span>
                                <span class="lista__fim"><SituacaoCompra c={c} /><ChevronRight aria-hidden="true" /></span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Vazio compacto icone={<PackageCheck aria-hidden="true" />} titulo="Nenhuma compra esperando">Notas enviadas pela Júlia ou pelo painel aparecem aqui para conferir.</Vazio>
                      )
                    }
                  </Dados>
                </Cartao>
              )}
              {r.cancelamentos_pendentes > 0 && (
                <Cartao titulo={<span class="linha"><Undo2 size={16} aria-hidden="true" /> Vendas canceladas depois da baixa</span>} descricao="O PDV não diz se o produto chegou a ser preparado: responda para o estoque ficar certo">
                  <div class="linha linha--entre">
                    <span>{plural(r.cancelamentos_pendentes, 'venda esperando resposta', 'vendas esperando resposta')}</span>
                    <Botao tamanho="p" variante="primario" onClick={() => aoIr('cancelamentos')}>Responder</Botao>
                  </div>
                </Cartao>
              )}
            </div>

            <div class="pilha">
              <Cartao titulo="Abaixo do mínimo" descricao={r.baixa_automatica ? 'Pelo saldo atual' : 'Pelo saldo registrado — confira antes de comprar'} justo acoes={<button class="btn btn--p btn--fantasma" onClick={() => aoIr('insumos')}>Insumos <ChevronRight size={14} aria-hidden="true" /></button>}>
                {r.abaixo_minimo.length ? (
                  <ul class="lista">
                    {r.abaixo_minimo.slice(0, 8).map((i) => (
                      <li key={i.insumo_id} class="lista__item">
                        <span class="lista__texto">
                          <strong>{i.insumo}</strong>
                          <span class="num">{quantidade(i.saldo, i.unidade_base)} de mínimo {quantidade(i.estoque_minimo, i.unidade_base)}</span>
                        </span>
                        <span class="lista__fim">{i.saldo_confiavel ? <Situacao tom="perigo">Repor</Situacao> : <Situacao tom="apagado">Saldo a conferir</Situacao>}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio compacto titulo="Nenhum insumo abaixo do mínimo">Só entram aqui os insumos com estoque mínimo cadastrado.</Vazio>
                )}
              </Cartao>

              {r.altas_de_custo_90d.length > 0 && (
                <Cartao titulo={<span class="linha"><TrendingUp size={16} aria-hidden="true" /> Altas de custo</span>} descricao="Últimos 90 dias, preço por unidade-base" justo>
                  <ul class="lista">
                    {r.altas_de_custo_90d.map((a) => (
                      <li key={a.insumo_id} class="lista__item">
                        <span class="lista__texto">
                          <strong>{a.insumo}</strong>
                          <span class="num">{custoBase(a.custo_inicio, a.unidade_base)} → {custoBase(a.custo_fim, a.unidade_base)} · {plural(a.compras, 'compra', 'compras')}</span>
                        </span>
                        <span class="lista__fim"><span class="variacao variacao--baixa num">{pct(a.variacao_pct, { sinal: true })}</span></span>
                      </li>
                    ))}
                  </ul>
                </Cartao>
              )}

              <Cartao
                titulo={<span class="linha"><FileQuestion size={16} aria-hidden="true" /> Vendidos sem ficha técnica</span>}
                descricao={r.cobertura_fichas_30d === null ? 'Sem vendas nos últimos 30 dias' : `Fichas cobrem ${pct(r.cobertura_fichas_30d, { fracao: true, casas: 0 })} da receita dos últimos 30 dias`}
                justo
                acoes={perm.editar ? <button class="btn btn--p btn--fantasma" onClick={() => aoIr('fichas')}>Fichas <ChevronRight size={14} aria-hidden="true" /></button> : undefined}
              >
                {r.sem_ficha_mais_vendidos.length ? (
                  <ul class="lista">
                    {r.sem_ficha_mais_vendidos.slice(0, 5).map((p) => (
                      <li key={p.eye_product_id} class="lista__item">
                        <span class="lista__texto"><strong>{p.produto}</strong><span>Sem custo calculado</span></span>
                        <span class="lista__fim num">{moeda(p.receita)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio compacto titulo="Todos os produtos vendidos têm ficha">Ou não houve vendas no período.</Vazio>
                )}
              </Cartao>
            </div>
          </div>
        </>
      )}
    </Dados>
  );
}
