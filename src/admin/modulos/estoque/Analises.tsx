// Análises do Estoque: só o que o backend calcula, com o nome certo. CMV com a fonte (inventário, teórico ou
// indisponível, com os motivos); compras ÷ receita aparece como indicador próprio, nunca como CMV. Previsões rotuladas
// como previsão. Nenhum preço é alterado e nenhum pedido é feito.
import { useState } from 'preact/hooks';
import { Lock, Info, AlertTriangle, TrendingUp, Gauge, LayoutGrid, Scale, Truck, Hourglass, ShoppingCart } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { moeda, pct, decimal, custoBase, hojeISO, somarDias, mesAno, inicioMes, somarMeses, num, dataCurta, quantidade } from '../../lib/formato';
import { Cartao, Segmentado, Aviso, Situacao, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { BarraParte } from '../../ui/graficos';
import type { EstadoRuptura, ItemCardapio, ItemReposicao, ProdutoAnalise } from '../../lib/tipos/estoque';
import type { PermissoesEstoque } from './comum';

// Todas as análises exigem estoque.visualizar no backend (api_analises.py).
export function Analises({ perm }: { perm: PermissoesEstoque }) {
  return (
    <>
      {perm.visualizar ? (
        <>
          <Cmv />
          <div class="colunas-iguais">
            <Produtos />
            <Fornecedores />
          </div>
          <Cardapio />
        </>
      ) : (
        <Aviso icone={<Lock aria-hidden="true" />}>Custos, margens e CMV ficam com a gerência.</Aviso>
      )}
      {perm.visualizar && (
        <div class="colunas-iguais">
          <Ruptura />
          <Reposicao />
        </div>
      )}
    </>
  );
}

const FONTE_CMV = { por_inventario: 'Pela contagem (inventário)', teorico: 'Teórico (fichas × vendas)', indisponivel: 'Indisponível' } as const;

function Cmv() {
  const [mes, setMes] = useState(inicioMes(hojeISO()).slice(0, 7));
  const meses = [0, -1, -2].map((d) => somarMeses(`${inicioMes(hojeISO())}`, d).slice(0, 7));
  const c = useConsulta(`estoque/analises/cmv:${mes}`, () => estoque.cmv(mes));
  return (
    <Cartao
      titulo={<span class="linha"><Gauge size={16} aria-hidden="true" /> Custo da mercadoria vendida (CMV)</span>}
      descricao="Quanto custou o que foi vendido no mês"
      acoes={<select class="selecao" aria-label="Mês" style={{ width: 'auto', minHeight: '32px' }} value={mes} onChange={(e) => setMes(e.currentTarget.value)}>{meses.map((m) => <option key={m} value={m}>{mesAno(`${m}-01`)}</option>)}</select>}
    >
      <Dados consulta={c} recurso="O CMV" compacto esqueleto={<Esqueleto linhas={4} />}>
        {(d) => (
          <div class="pilha">
            <div class="indicadores indicadores--3" style={{ gap: '10px' }}>
              <div class="cartao indicador">
                <span class="indicador__rotulo">CMV do mês</span>
                <span class="indicador__valor indicador__valor--m num">{moeda(d.valor)}</span>
                <span class="indicador__rodape"><Situacao tom={d.fonte === 'indisponivel' ? 'apagado' : d.fonte === 'teorico' ? 'atencao' : 'ok'}>{FONTE_CMV[d.fonte]}</Situacao></span>
              </div>
              <div class="cartao indicador">
                <span class="indicador__rotulo">CMV sobre a receita</span>
                <span class="indicador__valor indicador__valor--m num">{pct(d.cmv_pct)}</span>
                <span class="indicador__rodape">Receita de produtos: {moeda(d.receita_produtos)}</span>
              </div>
              <div class="cartao indicador">
                <span class="indicador__rotulo">Compras de estoque no mês</span>
                <span class="indicador__valor indicador__valor--m num">{moeda(d.indicadores.compras_estoque_mes)}</span>
                <span class="indicador__rodape">{pct(d.indicadores.compras_estoque_sobre_receita_pct)} da receita — <strong>não é CMV</strong></span>
              </div>
            </div>
            {d.fonte === 'indisponivel' && d.motivos_indisponivel.length > 0 && (
              <Aviso tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>
                <strong>Por que o CMV ainda não sai:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>{d.motivos_indisponivel.map((m) => <li key={m.codigo}>{m.texto}</li>)}</ul>
              </Aviso>
            )}
            {d.fonte === 'teorico' && <Aviso tom="info" icone={<Info aria-hidden="true" />}>CMV teórico: vem das fichas técnicas multiplicadas pelas vendas. Perdas e desperdício não entram; a contagem mostra a diferença.</Aviso>}
            <dl class="definicoes">
              <dt>Pela contagem</dt>
              <dd class="num">{moeda(d.alternativas.por_inventario)} <span class="fraco">· contagem total no início e no fim do mês</span></dd>
              <dt>Teórico (fichas)</dt>
              <dd class="num">{moeda(d.alternativas.teorico)} <span class="fraco">· fichas cobrem {pct(d.cobertura_fichas, { fracao: true, casas: 0 })} da receita</span></dd>
              <dt>Vendas com consumo calculado</dt>
              <dd class="num">{d.vendas_processadas} de {d.vendas_validas}</dd>
            </dl>
            {d.divergencia_inventario_teorico && (
              <p class="fraco">Contagem − teórico: <strong class="num">{moeda(d.divergencia_inventario_teorico.valor)}</strong> ({pct(d.divergencia_inventario_teorico.pct)}). Diferença grande costuma ser perda não registrada ou ficha desatualizada.</p>
            )}
            <p class="fraco">{d.indicadores.aviso}</p>
          </div>
        )}
      </Dados>
    </Cartao>
  );
}

function Produtos() {
  const [ord, setOrd] = useState<'receita' | 'quantidade' | 'contribuicao' | 'margem'>('receita');
  const ate = hojeISO();
  const de = somarDias(ate, -29);
  const c = useConsulta(`estoque/analises/produtos:${de}:${ord}`, () => estoque.produtos(de, ate, ord));
  const colunas: Coluna<ProdutoAnalise>[] = [
    { id: 'produto', titulo: 'Produto', celula: (p) => <><span class="principal-celula">{p.produto}</span>{!p.tem_ficha && <span class="sub">sem ficha: custo desconhecido</span>}</> },
    { id: 'qtd', titulo: 'Vendidos', numero: true, prioridade: 'media', celula: (p) => <span class="num">{decimal(p.quantidade, 0)}</span> },
    { id: 'receita', titulo: 'Receita', numero: true, celula: (p) => <span class="num">{moeda(p.receita_liquida, { compacta: true })}</span> },
    { id: 'contrib', titulo: 'Contribuição', numero: true, prioridade: 'baixa', celula: (p) => <span class="num">{moeda(p.contribuicao, { compacta: true })}</span> },
    { id: 'margem', titulo: 'Margem', numero: true, celula: (p) => <span class="num">{pct(p.margem_realizada_pct)}<span class="sub">hoje {pct(p.margem_hoje_pct)}</span></span> },
  ];
  return (
    <Cartao titulo={<span class="linha"><TrendingUp size={16} aria-hidden="true" /> Mais vendidos</span>} descricao="Últimos 30 dias · margem realizada (custo do dia de cada venda) e a preço de hoje. Contribuição = receita − ingredientes: não é lucro." justo acoes={<Segmentado rotulo="Ordenar por" valor={ord} aoMudar={setOrd} opcoes={[{ valor: 'receita', rotulo: 'Receita' }, { valor: 'quantidade', rotulo: 'Qtd.' }, { valor: 'contribuicao', rotulo: 'Contribuição' }, { valor: 'margem', rotulo: 'Margem' }]} />}>
      <Dados consulta={c} recurso="A análise de produtos" esqueleto={<EsqueletoTabela linhas={5} />}>
        {(l) => <Tabela rotulo="Produtos mais vendidos" colunas={colunas} linhas={l.slice(0, 10)} chave={(p) => p.eye_product_id} vazio={<Vazio compacto titulo="Sem vendas no período">As vendas chegam do PDV (Eyemobile).</Vazio>} />}
      </Dados>
    </Cartao>
  );
}

function Fornecedores() {
  const ate = hojeISO();
  const de = somarDias(ate, -89);
  const c = useConsulta(`estoque/analises/fornecedores:${de}`, () => estoque.fornecedores(de, ate));
  return (
    <Cartao titulo={<span class="linha"><Truck size={16} aria-hidden="true" /> Preços por fornecedor</span>} descricao="Últimos 90 dias, preço por unidade-base do mesmo insumo" justo>
      <Dados consulta={c} recurso="A comparação de fornecedores" compacto esqueleto={<div class="cartao__corpo"><Esqueleto linhas={5} /></div>}>
        {(d) =>
          d.itens.length ? (
            <>
              <ul class="lista">
                {d.itens.map((i) => (
                  <li key={i.insumo_id} style={{ padding: '12px 20px' }} class="pilha pilha--p">
                    <div class="linha linha--entre">
                      <strong style={{ fontWeight: 600 }}>{i.insumo}</strong>
                      <span class="num">{i.ultimo_preco !== undefined && <>último {custoBase(i.ultimo_preco, i.unidade_base)} </>}{num(i.variacao_ultima_compra_pct) !== null && <span class={`variacao ${Number(i.variacao_ultima_compra_pct) > 0 ? 'variacao--baixa' : 'variacao--alta'}`}>{pct(i.variacao_ultima_compra_pct, { sinal: true })}</span>}</span>
                    </div>
                    {i.comparavel ? (
                      <>
                        {i.fornecedores.map((f) => (
                          <div key={f.fornecedor_id ?? f.fornecedor} class="linha linha--entre fraco" style={{ flexWrap: 'nowrap' }}>
                            <span>{f.fornecedor}{i.menor_preco_medio?.fornecedor === f.fornecedor && <> · <Etiqueta tom="info">menor preço médio</Etiqueta></>}{f.frete_na_nota_sem_rateio && <> · frete fora do preço</>}</span>
                            <span class="num">{custoBase(f.preco_medio, i.unidade_base)} · {f.compras}×</span>
                          </div>
                        ))}
                        {num(i.economia_ilustrativa) ? <span class="fraco">Economia ilustrativa comprando do menor preço médio: <strong class="num">{moeda(i.economia_ilustrativa)}</strong></span> : null}
                      </>
                    ) : (
                      <span class="fraco">{i.motivo === 'um_fornecedor_so' ? `Só um fornecedor no período (${i.fornecedores[0]?.fornecedor ?? '—'}): sem comparação.` : 'Compras sem preço convertido para a unidade-base.'}</span>
                    )}
                  </li>
                ))}
              </ul>
              <div class="cartao__rodape">{d.aviso}</div>
            </>
          ) : (
            <Vazio compacto titulo="Sem compras conferidas no período" />
          )
        }
      </Dados>
    </Cartao>
  );
}

const CLASSE: Record<NonNullable<ItemCardapio['classificacao']>, { rotulo: string; dica: string; tom: 'ok' | 'atencao' | 'info' | 'neutro' }> = {
  alta_venda_alta_margem: { rotulo: 'Vende bem, boa margem', dica: 'Manter', tom: 'ok' },
  alta_venda_margem_baixa: { rotulo: 'Vende bem, margem baixa', dica: 'Conferir custo e preço', tom: 'atencao' },
  baixa_venda_margem_alta: { rotulo: 'Vende pouco, boa margem', dica: 'Dar destaque', tom: 'info' },
  baixa_venda_margem_baixa: { rotulo: 'Vende pouco, margem baixa', dica: 'Repensar', tom: 'neutro' },
};
const SEM_CLASSE: Record<string, string> = { sem_ficha: 'Sem ficha técnica', custo_incompleto: 'Custo incompleto', poucas_vendas: 'Poucas vendas', sem_comparacao_no_grupo: 'Sem outro produto no grupo para comparar' };

function Cardapio() {
  const ate = hojeISO();
  const de = somarDias(ate, -29);
  const c = useConsulta(`estoque/analises/cardapio:${de}`, () => estoque.cardapio(de, ate));
  return (
    <Cartao titulo={<span class="linha"><LayoutGrid size={16} aria-hidden="true" /> Cardápio Inteligente</span>} descricao="Popularidade × margem estimada, comparando cada produto com o próprio grupo do PDV · últimos 30 dias">
      <Dados consulta={c} recurso="O Cardápio Inteligente" compacto esqueleto={<Esqueleto linhas={6} />}>
        {(d) => {
          const total = d.itens.length || 1;
          const colunas: Coluna<ItemCardapio>[] = [
            { id: 'produto', titulo: 'Produto', celula: (i) => <><span class="principal-celula">{i.produto}</span><span class="sub">{i.grupo ?? 'Sem grupo'}</span></> },
            { id: 'qtd', titulo: 'Vendidos', numero: true, prioridade: 'baixa', celula: (i) => <span class="num">{decimal(i.quantidade, 0)}</span> },
            { id: 'margem', titulo: 'Margem est.', numero: true, prioridade: 'media', celula: (i) => <span class="num">{moeda(i.margem_estimada_unitaria)} <span class="sub">{pct(i.margem_estimada_pct)}</span></span> },
            { id: 'classe', titulo: 'Leitura', celula: (i) => (i.classificacao ? <><Situacao tom={CLASSE[i.classificacao].tom}>{CLASSE[i.classificacao].rotulo}</Situacao>{i.sugestao && <span class="sub">{i.sugestao}</span>}</> : <span class="fraco">{SEM_CLASSE[i.motivo_sem_classificacao ?? ''] ?? 'Sem classificação'}</span>) },
          ];
          return (
            <div class="pilha">
              <div class="quadrantes">
                {(Object.keys(CLASSE) as (keyof typeof CLASSE)[]).map((k) => (
                  <div class="quadrante" key={k}>
                    <strong>{d.resumo[k] ?? 0}</strong>
                    <span>{CLASSE[k].rotulo}</span>
                    <BarraParte valor={d.resumo[k] ?? 0} total={total} cor={k === 'alta_venda_alta_margem' ? 'var(--ok)' : k === 'alta_venda_margem_baixa' ? 'var(--caramelo)' : 'var(--grafico-3)'} />
                  </div>
                ))}
              </div>
              <div style={{ margin: '0 -20px' }}>
                <Tabela rotulo="Cardápio Inteligente" colunas={colunas} linhas={d.itens} chave={(i) => i.eye_product_id} porPagina={15} />
              </div>
              <p class="fraco">{d.criterio.aviso}</p>
            </div>
          );
        }}
      </Dados>
    </Cartao>
  );
}

const ESTADO_RUPTURA: Record<EstadoRuptura, readonly [string, 'perigo' | 'atencao' | 'ok' | 'apagado']> = { ruptura_prevista: ['Pode faltar antes da entrega', 'perigo'], atencao: ['Atenção', 'atencao'], ok: ['Cobre o prazo', 'ok'], sem_consumo: ['Sem consumo', 'apagado'], indisponivel: ['Sem previsão', 'apagado'] };

function Ruptura() {
  const c = useConsulta('estoque/analises/ruptura', () => estoque.ruptura());
  return (
    <Cartao titulo={<span class="linha"><Hourglass size={16} aria-hidden="true" /> Previsão de ruptura</span>} descricao="PREVISÃO pelo consumo médio: quantos dias cada insumo cobre" justo>
      <Dados consulta={c} recurso="A previsão de ruptura" compacto esqueleto={<div class="cartao__corpo"><Esqueleto linhas={3} /></div>}>
        {(d) =>
          !d.disponivel ? (
            <Vazio compacto icone={<Scale aria-hidden="true" />} titulo="Previsão ainda indisponível">
              {(d.motivos ?? []).map((m) => m.texto).join(' ') || 'Faltam dados de consumo.'}
            </Vazio>
          ) : d.itens.length ? (
            <>
              <ul class="lista">
                {d.itens.map((i) => (
                  <li key={i.insumo_id} class="lista__item">
                    <span class="lista__texto">
                      <strong>{i.insumo}</strong>
                      <span class="num">{quantidade(i.saldo, i.unidade_base)}{i.consumo_diario_medio ? ` · consumo ${quantidade(i.consumo_diario_medio, i.unidade_base)}/dia` : ''}{i.cobertura_dias ? ` · cobre ~${decimal(i.cobertura_dias, 1)} dias` : ''}{i.ruptura_estimada_em ? ` · previsão ${dataCurta(i.ruptura_estimada_em)}` : ''}</span>
                    </span>
                    <span class="lista__fim"><Situacao tom={ESTADO_RUPTURA[i.estado][1]}>{ESTADO_RUPTURA[i.estado][0]}</Situacao></span>
                  </li>
                ))}
              </ul>
              {d.base && <div class="cartao__rodape">{d.base}</div>}
            </>
          ) : (
            <Vazio compacto titulo="Nenhum insumo com previsão" />
          )
        }
      </Dados>
    </Cartao>
  );
}

/** Lista SUGERIDA de reposição (prazo + segurança + dias de cobertura + mínimo), calculada no backend. Nenhum pedido é
 *  feito e nenhuma mensagem é enviada. */
function Reposicao() {
  const [dias, setDias] = useState(7);
  const c = useConsulta(`estoque/analises/reposicao:${dias}`, () => estoque.reposicao(dias));
  const colunas: Coluna<ItemReposicao>[] = [
    { id: 'insumo', titulo: 'Insumo', celula: (i) => <><span class="principal-celula">{i.insumo}</span><span class="sub">{i.ultimo_fornecedor ?? 'sem compra conferida'}{i.prazo_conhecido ? '' : ' · prazo não informado'}</span></> },
    { id: 'qtd', titulo: 'Comprar', numero: true, celula: (i) => <span class="num">{quantidade(i.quantidade_sugerida, i.unidade_base)}</span> },
    { id: 'custo', titulo: 'Custo estimado', numero: true, prioridade: 'media', celula: (i) => <span class="num">{moeda(i.custo_estimado)}</span> },
    { id: 'estado', titulo: 'Situação', prioridade: 'baixa', celula: (i) => <Situacao tom={ESTADO_RUPTURA[i.estado][1]}>{ESTADO_RUPTURA[i.estado][0]}</Situacao> },
  ];
  return (
    <Cartao
      titulo={<span class="linha"><ShoppingCart size={16} aria-hidden="true" /> Reposição sugerida</span>}
      descricao="SUGESTÃO para revisar: nenhum pedido é feito e nada é enviado a fornecedores"
      acoes={<select class="selecao" aria-label="Dias de cobertura" style={{ width: 'auto', minHeight: '32px' }} value={dias} onChange={(e) => setDias(Number(e.currentTarget.value))}>{[3, 7, 14, 30].map((n) => <option key={n} value={n}>Cobrir {n} dias</option>)}</select>}
      justo
    >
      <Dados consulta={c} recurso="A reposição sugerida" compacto esqueleto={<div class="cartao__corpo"><Esqueleto linhas={3} /></div>}>
        {(d) =>
          !d.disponivel ? (
            <Vazio compacto icone={<Scale aria-hidden="true" />} titulo="Reposição ainda indisponível">
              {(d.motivos ?? []).map((m) => m.texto).join(' ') || 'Faltam dados de consumo.'}
            </Vazio>
          ) : (
            <>
              <Tabela rotulo="Reposição sugerida" colunas={colunas} linhas={d.itens} chave={(i) => i.insumo_id} vazio={<Vazio compacto titulo="Nada para repor agora">Os saldos cobrem o prazo, a segurança e os dias escolhidos.</Vazio>} />
              <div class="cartao__rodape">{d.aviso}{d.dias_seguranca !== undefined ? ` Inclui ${d.dias_seguranca} dia(s) de segurança.` : ''}</div>
            </>
          )
        }
      </Dados>
    </Cartao>
  );
}
