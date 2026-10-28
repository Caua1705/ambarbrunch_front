// Resumo do Estoque: o que temos, o que precisa ser conferido, o que diverge e o que repor — repor só com saldo confiável.
import { Package, PackageCheck, ShieldCheck, ShieldAlert, AlertTriangle, ChevronRight, TrendingUp, FileQuestion, Undo2, Info } from 'lucide-preact';
import type { Papel } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { inteiro, pct, quantidade, relativo, custoBase, plural, moeda, dataCurta } from '../../lib/formato';
import { useConfirmacao } from '../../ui/camadas';
import { Indicador, Cartao, Aviso, Botao, Situacao } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { CancelamentoEstoque } from '../../lib/tipos/estoque';
import { SituacaoCompra, atualizarEstoque } from './comum';

export function Resumo({ papel, aoAbrirCompra, aoIr }: { papel: Papel; aoAbrirCompra: (id: string) => void; aoIr: (aba: 'insumos' | 'compras' | 'fichas' | 'analises') => void }) {
  const resumo = useConsulta('estoque/resumo', () => estoque.resumo());
  const conferir = useConsulta('estoque/compras?conferir', () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));
  const cancel = useConsulta('estoque/cancelamentos?pendente', () => estoque.cancelamentos('pendente'));
  const gerencia = pode(papel, 'estoque.analises_custo');

  return (
    <Dados consulta={resumo} recurso="O Estoque" esqueleto={<Esqueleto linhas={6} altura={28} />}>
      {(r) => (
        <>
          {!r.baixa_automatica && (
            <Aviso tom="info" icone={<Info aria-hidden="true" />}>
              <strong>A baixa automática pelas vendas ainda está desligada.</strong> Os saldos somam as compras e as contagens, mas não descontam o que foi vendido: use-os como referência e confirme pela contagem. Previsões de quando cada item acaba ficam desligadas até lá.
            </Aviso>
          )}
          <section class="indicadores" aria-label="Situação do estoque">
            <Indicador rotulo="Insumos cadastrados" icone={<Package aria-hidden="true" />} valor={inteiro(r.saldo_confiavel.total)} rodape={r.inicio_controle ? `Controle desde ${dataCurta(r.inicio_controle)}` : 'Controle ainda não iniciado'} />
            <Indicador
              rotulo="Compras para conferir"
              icone={<PackageCheck aria-hidden="true" />}
              valor={inteiro(r.compras_em_conferencia.qtd)}
              rodape={r.compras_em_conferencia.mais_antiga_em ? `A mais antiga chegou ${relativo(r.compras_em_conferencia.mais_antiga_em)}` : 'Nada esperando'}
            />
            <Indicador rotulo="Divergências a responder" icone={<AlertTriangle aria-hidden="true" />} valor={inteiro(r.cancelamentos_pendentes)} rodape={r.cancelamentos_pendentes ? 'Vendas canceladas depois da baixa' : 'Nenhuma pendência'} />
            <Indicador
              rotulo="Saldos confiáveis"
              icone={r.saldo_confiavel.insumos === r.saldo_confiavel.total && r.saldo_confiavel.total ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
              valor={`${inteiro(r.saldo_confiavel.insumos)} de ${inteiro(r.saldo_confiavel.total)}`}
              medio
              rodape={r.baixa_automatica ? 'Contados e com baixa pelas vendas' : 'Dependem da baixa automática e da contagem'}
            />
          </section>

          <div class="colunas-iguais">
            <div class="pilha">
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
              <Cancelamentos consulta={cancel} />
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

              {gerencia && r.altas_de_custo_90d.length > 0 && (
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

              {gerencia && (
                <Cartao titulo={<span class="linha"><FileQuestion size={16} aria-hidden="true" /> Vendidos sem ficha técnica</span>} descricao={`Fichas cobrem ${pct(r.cobertura_fichas_30d, { fracao: true, casas: 0 })} da receita dos últimos 30 dias`} justo acoes={<button class="btn btn--p btn--fantasma" onClick={() => aoIr('fichas')}>Fichas <ChevronRight size={14} aria-hidden="true" /></button>}>
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
                    <Vazio compacto titulo="Todos os produtos vendidos têm ficha" />
                  )}
                </Cartao>
              )}
            </div>
          </div>
        </>
      )}
    </Dados>
  );
}

const DECISAO = { nao_produzido: 'Não chegou a ser preparado', produzido_descartado: 'Foi preparado e descartado' };

function Cancelamentos({ consulta }: { consulta: ReturnType<typeof useConsulta<{ total: number; itens: CancelamentoEstoque[] }>> }) {
  const { confirmar, elemento } = useConfirmacao();
  if (consulta.erro || !consulta.dados?.itens.length) return null;
  const responder = (c: CancelamentoEstoque, decisao: 'nao_produzido' | 'produzido_descartado') =>
    confirmar({
      titulo: DECISAO[decisao] + '?',
      texto: decisao === 'nao_produzido' ? 'Os ingredientes voltam ao saldo do estoque.' : 'Os ingredientes saem como perda: não voltam para a prateleira.',
      confirmar: 'Confirmar',
      acao: async () => {
        try {
          await estoque.resolverCancelamento(c.id, c.versao, decisao);
        } finally {
          atualizarEstoque();
        }
      },
      sucesso: 'Pendência resolvida.',
    });
  return (
    <Cartao titulo={<span class="linha"><Undo2 size={16} aria-hidden="true" /> Vendas canceladas depois da baixa</span>} descricao="O PDV não diz se o produto foi preparado: responda para o estoque ficar certo" justo>
      <ul class="lista">
        {consulta.dados.itens.map((c) => (
          <li key={c.id} style={{ padding: '12px 20px' }} class="pilha pilha--p">
            <div class="linha linha--entre">
              <strong style={{ fontWeight: 600 }}>{c.motivo === 'venda_corrigida' ? 'Venda corrigida para menos' : 'Venda cancelada'} em {dataCurta(c.dia)}</strong>
              {!c.baixa_lancada && <span class="fraco">Nada tinha saído do estoque</span>}
            </div>
            <span class="fraco">{c.itens.map((i) => `${i.insumo ?? 'Insumo'} ${quantidade(i.quantidade, i.unidade_base)}`).join(' · ')}</span>
            <div class="linha">
              <Botao tamanho="p" onClick={() => responder(c, 'nao_produzido')}>Não foi preparado</Botao>
              <Botao tamanho="p" onClick={() => responder(c, 'produzido_descartado')}>Preparado e descartado</Botao>
            </div>
          </li>
        ))}
      </ul>
      {elemento}
    </Cartao>
  );
}
