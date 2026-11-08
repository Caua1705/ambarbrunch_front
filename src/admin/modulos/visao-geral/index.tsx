// Visão Geral: o painel executivo. Responde "quanto vendemos, quanto gastamos, estamos positivos e o que mais pesou?"
// com UM filtro de período para tudo. Pendências não moram aqui: ficam no sino do topo (layout/avisos.ts).
//
// Fontes (todas oficiais do backend; nada é recalculado aqui):
//  - Receita e ticket médio: GET /financeiro/relatorios/vendas (view v_vendas_dia — a venda da Eyemobile, uma vez só; o
//    repasse da Stone é recebimento, não receita).
//  - Despesas: GET /financeiro/relatorios/despesas-por-categoria (confirmadas, por competência). O gráfico distribui as
//    MESMAS despesas por data com GET /financeiro/lancamentos (tipo=despesa, status=confirmada; data = competência): só
//    soma para desenhar, o total do indicador é o do backend.
//  - Resultado gerencial: GET /financeiro/relatorios/resultado?mes= — o backend apura por mês civil; em outro período o
//    indicador diz isso em vez de inventar um resultado.
//  - Produtos mais vendidos: GET /estoque/analises/produtos (vendas da Eyemobile por produto). Sem eles, as vendas por
//    forma de pagamento do próprio relatório de vendas.
//
// Estados: sem a loja do PDV ligada, o backend responde `disponivel: false` e a tela mostra "—", nunca zero, sem faixa de
// aviso. Falha de API é outra coisa: fica no próprio indicador ou cartão, com "Tentar de novo", e nunca vira "sem vendas".
import { useState } from 'preact/hooks';
import { AlertTriangle, CalendarCheck, Users } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { pode, type Modulo } from '../../lib/permissoes';
import { useConsulta, type Consulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { financeiro } from '../../lib/api/financeiro';
import { estoque } from '../../lib/api/estoque';
import { moeda, num, hojeISO, dataLonga, dataCurta, inteiro, plural, relativo, mesAno, mesCurto, decimal } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Indicador, Cartao, Segmentado, Variacao, Situacao, Aviso } from '../../ui/base';
import { Dados, Esqueleto, Falha, Vazio } from '../../ui/estados';
import { GraficoBarras, Legenda, Ranking } from '../../ui/graficos';
import type { Lancamento, NivelQualidade, RelatorioVendas } from '../../lib/tipos/financeiro';
import { statusBase } from '../reservas/comum';
import { OPCOES, MAX_DIAS, periodoDe, anterior, mesDoPeriodo, agrupamento, baldes, inicioBalde, janelaGrafico, dias, type TipoPeriodo, type Periodo } from './periodo';

const QUALIDADE: Record<NivelQualidade, { rotulo: string; tom: 'ok' | 'atencao' | 'perigo' | 'apagado' }> = {
  completo: { rotulo: 'Completo', tom: 'ok' },
  parcial: { rotulo: 'Parcial', tom: 'atencao' },
  estimado: { rotulo: 'Estimado', tom: 'atencao' },
  indisponivel: { rotulo: 'Indisponível', tom: 'apagado' },
};

const COR_RECEITA = 'var(--grafico-1)';
const COR_DESPESA = 'var(--grafico-2)';

const SEM_VENDAS = 'Sem vendas sincronizadas';

const lerTipo = (v: string | null): TipoPeriodo => (OPCOES.some((o) => o.valor === v) ? (v as TipoPeriodo) : 'mes');

export default function VisaoGeral({ contexto }: { contexto: ContextoPainel }) {
  const papel = contexto.usuario.papel;
  const liberado = (m: Modulo) => contexto.modulos.includes(m);
  const gerencia = pode(papel, 'visao.financeiro') && liberado('financeiro');

  return (
    <Raiz>
      <header class="cabecalho cabecalho--saudacao">
        <div>
          <h2>{saudacao()}, {contexto.usuario.nome.split(' ')[0]}</h2>
          <p>{dataLonga(hojeISO())}</p>
        </div>
      </header>
      {gerencia ? <Executiva produtos={liberado('estoque') && pode(papel, 'estoque.analises_custo')} /> : liberado('reservas') ? <SoReservas /> : null}
    </Raiz>
  );
}

function saudacao() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza', hour: 'numeric', hour12: false }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function rotuloPeriodo(p: Periodo) {
  if (p.tipo === 'hoje') return 'hoje';
  if (p.tipo === '7d') return 'nos últimos 7 dias';
  if (p.tipo === '30d') return 'nos últimos 30 dias';
  if (p.tipo === 'mes') return `em ${mesAno(p.de).toLowerCase()} até hoje`;
  return p.de === p.ate ? `em ${dataCurta(p.de, { ano: true })}` : `de ${dataCurta(p.de)} a ${dataCurta(p.ate, { ano: true })}`;
}

/** Todas as despesas confirmadas do período, página a página (o backend devolve até 200 por vez). */
async function despesasDoPeriodo(de: string, ate: string): Promise<{ itens: Lancamento[]; completo: boolean }> {
  const itens: Lancamento[] = [];
  for (let pagina = 0; pagina < 10; pagina++) {
    const r = await financeiro.lancamentos({ de, ate, tipo: 'despesa', status: 'confirmada', limite: 200, deslocamento: pagina * 200 });
    itens.push(...r.itens);
    if (itens.length >= r.total || r.itens.length === 0) return { itens, completo: true };
  }
  return { itens, completo: false };
}

/** Erro discreto de um indicador. Enquanto ele aparece o cartão não é link: botão dentro de link não funciona. */
function FalhaIndicador({ consulta }: { consulta: Consulta<unknown> }) {
  return (
    <span class="indicador__falha" role="status">
      <AlertTriangle aria-hidden="true" /> {consulta.erro?.message}{' '}
      <button type="button" class="link" onClick={consulta.recarregar}>Tentar de novo</button>
    </span>
  );
}

function Executiva({ produtos }: { produtos: boolean }) {
  const hoje = hojeISO();
  const [tipo, setTipoEstado] = useState<TipoPeriodo>(() => lerTipo(lerParam('periodo')));
  const [pers, setPers] = useState(() => ({ de: lerParam('de') ?? periodoDe('30d').de, ate: lerParam('ate') ?? hoje }));
  const setTipo = (t: TipoPeriodo) => {
    setTipoEstado(t);
    gravarParams({ periodo: t === 'mes' ? null : t, de: t === 'personalizado' ? pers.de : null, ate: t === 'personalizado' ? pers.ate : null });
  };
  const persValido = pers.de <= pers.ate && pers.ate <= hoje && dias(pers.de, pers.ate) <= MAX_DIAS;
  const p = periodoDe(tipo === 'personalizado' && !persValido ? '30d' : tipo, pers);
  const ant = anterior(p);
  const mes = mesDoPeriodo(p);
  const janela = janelaGrafico(p);
  const agrupar = agrupamento(janela.de, janela.ate);

  const vendas = useConsulta(`financeiro/relatorios/vendas:${p.de}:${p.ate}`, () => financeiro.vendas(p.de, p.ate, 'dia'));
  const vendasAnt = useConsulta(`financeiro/relatorios/vendas:${ant.de}:${ant.ate}`, () => financeiro.vendas(ant.de, ant.ate, 'dia'));
  const categorias = useConsulta(`financeiro/relatorios/despesas-por-categoria:${p.de}:${p.ate}`, () => financeiro.porCategoria(p.de, p.ate));
  const categoriasAnt = useConsulta(`financeiro/relatorios/despesas-por-categoria:${ant.de}:${ant.ate}`, () => financeiro.porCategoria(ant.de, ant.ate));
  const resultado = useConsulta(mes ? `financeiro/relatorios/resultado:${mes}` : null, () => financeiro.resultado(mes!));
  const vendasGrafico = useConsulta(`financeiro/relatorios/vendas:${janela.de}:${janela.ate}:${agrupar}`, () => financeiro.vendas(janela.de, janela.ate, agrupar));
  const despesasGrafico = useConsulta(`financeiro/lancamentos?grafico:${janela.de}:${janela.ate}`, () => despesasDoPeriodo(janela.de, janela.ate));
  const maisVendidos = useConsulta(produtos ? `estoque/analises/produtos:${p.de}:${p.ate}` : null, () => estoque.produtos(p.de, p.ate, 'quantidade'));

  const v = vendas.dados?.disponivel ? vendas.dados : null;
  const va = vendasAnt.dados?.disponivel ? vendasAnt.dados : null;
  const res = resultado.dados;
  const naPeriodo = rotuloPeriodo(p);
  // Só cai para "formas de pagamento" quando não há análise por produto. Erro de API aparece no cartão, com nova tentativa.
  const semProdutos = !produtos || maisVendidos.erro?.tipo === 'nao_implantado' || (maisVendidos.dados?.length === 0 && !!v?.por_meio.length);

  return (
    <>
      <div class="filtro-periodo">
        <Segmentado rotulo="Período" valor={tipo} aoMudar={setTipo} opcoes={OPCOES} />
        {tipo === 'personalizado' && (
          <div class="filtro-periodo__datas">
            <label class="sr" for="vg-de">De</label>
            <input id="vg-de" class="entrada entrada--data" type="date" value={pers.de} max={hoje} onChange={(e) => { const de = e.currentTarget.value; setPers((x) => ({ ...x, de })); gravarParams({ de }); }} />
            <span aria-hidden="true">até</span>
            <label class="sr" for="vg-ate">Até</label>
            <input id="vg-ate" class="entrada entrada--data" type="date" value={pers.ate} max={hoje} onChange={(e) => { const ate = e.currentTarget.value; setPers((x) => ({ ...x, ate })); gravarParams({ ate }); }} />
            {!persValido && <span class="campo__erro" role="alert">Escolha até {MAX_DIAS} dias, sem datas futuras. Mostrando os últimos 30 dias.</span>}
          </div>
        )}
      </div>

      {v?.sincronizacao.atrasada && p.ate === hoje && (
        <Aviso tom="atencao">
          <strong>Vendas desatualizadas.</strong> {v.sincronizacao.ultimo_sucesso_em ? `Última sincronização com a Eyemobile ${relativo(v.sincronizacao.ultimo_sucesso_em)}.` : 'A sincronização com a Eyemobile ainda não concluiu.'} Os números de hoje podem estar incompletos.
        </Aviso>
      )}

      <section class="indicadores" aria-label="Indicadores do período">
        <Indicador
          rotulo="Receita"
          carregando={vendas.carregando}
          valor={v ? moeda(v.totais.receita_liquida) : '—'}
          rodape={
            vendas.erro ? <FalhaIndicador consulta={vendas} />
            : !v ? SEM_VENDAS
            : <><Variacao atual={num(v.totais.receita_liquida)} anterior={va ? num(va.totais.receita_liquida) : null} /> <span>Vendas líquidas {naPeriodo}</span></>
          }
          href={vendas.erro ? undefined : '/admin/financeiro?aba=relatorios&relatorio=vendas'}
        />
        <Indicador
          rotulo="Despesas"
          carregando={categorias.carregando}
          valor={categorias.dados ? moeda(categorias.dados.total) : '—'}
          rodape={
            categorias.erro ? <FalhaIndicador consulta={categorias} />
            : categorias.dados ? <><Variacao inverter atual={num(categorias.dados.total)} anterior={categoriasAnt.dados ? num(categoriasAnt.dados.total) : null} /> <span>Confirmadas por competência</span></>
            : null
          }
          href={categorias.erro ? undefined : '/admin/financeiro?tipo=despesas'}
        />
        <Indicador
          rotulo="Resultado gerencial"
          carregando={!!mes && resultado.carregando}
          valor={
            !mes ? '—'
            : res?.disponivel && res.resultado_gerencial !== null ? <span class={num(res.resultado_gerencial)! < 0 ? 'negativo' : 'positivo'}>{moeda(res.resultado_gerencial)}</span>
            : '—'
          }
          rodape={
            !mes ? <span>Apurado por mês. <button type="button" class="link" onClick={() => setTipo('mes')}>Ver este mês</button></span>
            : resultado.erro ? <FalhaIndicador consulta={resultado} />
            : res ? <><Situacao tom={QUALIDADE[res.qualidade.nivel].tom}>{QUALIDADE[res.qualidade.nivel].rotulo}</Situacao> <span>{res.disponivel ? 'Não é lucro contábil' : res.qualidade.motivos[0]?.texto ?? 'Indisponível'}</span></>
            : null
          }
          href={mes && !resultado.erro ? `/admin/financeiro?aba=relatorios&relatorio=resultado&mes=${mes}` : undefined}
        />
        <Indicador
          rotulo="Ticket médio"
          carregando={vendas.carregando}
          valor={v && v.totais.ticket_medio !== null ? moeda(v.totais.ticket_medio) : '—'}
          rodape={vendas.erro ? <FalhaIndicador consulta={vendas} /> : !v ? SEM_VENDAS : v.totais.vendas ? <><Variacao atual={num(v.totais.ticket_medio)} anterior={va ? num(va.totais.ticket_medio) : null} /> <span>{plural(v.totais.vendas, 'venda', 'vendas')}</span></> : 'Nenhuma venda no período'}
        />
      </section>

      <Cartao titulo="Receitas × despesas" descricao={`${agrupar === 'dia' ? 'Por dia' : agrupar === 'semana' ? 'Por semana' : 'Por mês'}${janela.ampliada ? ' · últimos 7 dias' : ''}`} acoes={<Legenda series={[{ nome: 'Receita', cor: COR_RECEITA }, { nome: 'Despesas', cor: COR_DESPESA }]} />}>
        <Dados consulta={despesasGrafico} recurso="O gráfico" esqueleto={<Esqueleto linhas={6} altura={28} />} compacto>
          {(desp) =>
            vendasGrafico.erro && !vendasGrafico.dados ? <Falha erro={vendasGrafico.erro} aoTentar={vendasGrafico.recarregar} compacto recurso="O relatório de vendas" />
            : vendasGrafico.carregando ? <Esqueleto linhas={6} altura={28} />
            : <GraficoEvolucao de={janela.de} ate={janela.ate} agrupar={agrupar} vendas={vendasGrafico.dados ?? null} despesas={desp.itens} completo={desp.completo} />
          }
        </Dados>
      </Cartao>

      <div class="colunas-iguais">
        {!semProdutos ? (
          <Cartao titulo="Produtos mais vendidos" descricao={`Top 5 por quantidade, ${naPeriodo}`}>
            <Dados consulta={maisVendidos} recurso="A análise de produtos" esqueleto={<Esqueleto linhas={5} />} compacto>
              {(lista) =>
                lista.length ? (
                  <Ranking
                    rotulo="Produtos mais vendidos"
                    itens={lista
                      .slice()
                      .sort((a, b) => (num(b.quantidade) ?? 0) - (num(a.quantidade) ?? 0))
                      .slice(0, 5)
                      .map((x) => ({ nome: x.produto, valor: num(x.quantidade) ?? 0, texto: `${decimal(x.quantidade, 0)} un.`, detalhe: moeda(x.receita_liquida) }))}
                  />
                ) : (
                  <Vazio compacto titulo="Sem vendas por produto no período">Os produtos aparecem quando houver vendas sincronizadas da Eyemobile.</Vazio>
                )
              }
            </Dados>
          </Cartao>
        ) : (
          <Cartao titulo="Vendas por forma de pagamento" descricao={`Registrado no PDV, ${naPeriodo}`}>
            <Dados consulta={vendas} recurso="O relatório de vendas" esqueleto={<Esqueleto linhas={4} />} compacto>
              {(r) => <PorMeio relatorio={r} />}
            </Dados>
          </Cartao>
        )}

        <Cartao titulo="Despesas por categoria" descricao={`Confirmadas, ${naPeriodo}`} acoes={<a class="btn btn--p btn--fantasma" href="/admin/financeiro?tipo=despesas">Movimentações</a>}>
          <Dados consulta={categorias} recurso="O relatório de despesas" esqueleto={<Esqueleto linhas={5} />} compacto>
            {(c) =>
              c.itens.length ? (
                <Ranking
                  rotulo="Despesas por categoria"
                  cor={COR_DESPESA}
                  itens={c.itens
                    .slice()
                    .sort((a, b) => (num(b.valor) ?? 0) - (num(a.valor) ?? 0))
                    .slice(0, 6)
                    .map((x) => ({ nome: x.nome, valor: num(x.valor) ?? 0, texto: moeda(x.valor), detalhe: x.pct !== null ? `${decimal(x.pct, 1)}%` : undefined }))}
                />
              ) : (
                <Vazio compacto titulo="Nenhuma despesa confirmada no período" />
              )
            }
          </Dados>
        </Cartao>
      </div>
    </>
  );
}

function rotuloBalde(iso: string, agrupar: 'dia' | 'semana' | 'mes') {
  if (agrupar === 'mes') return mesCurto(iso);
  return iso.slice(8, 10) + '/' + iso.slice(5, 7);
}

function GraficoEvolucao({ de, ate, agrupar, vendas, despesas, completo }: { de: string; ate: string; agrupar: 'dia' | 'semana' | 'mes'; vendas: RelatorioVendas | null; despesas: Lancamento[]; completo: boolean }) {
  const eixo = baldes(de, ate, agrupar);
  const receita = new Map<string, number>();
  if (vendas?.disponivel) for (const pv of vendas.periodos) receita.set(pv.inicio, num(pv.receita_liquida) ?? 0);
  const gasto = new Map<string, number>();
  for (const d of despesas) {
    const b = inicioBalde(d.data, agrupar);
    gasto.set(b, (gasto.get(b) ?? 0) + (num(d.valor) ?? 0));
  }
  const semVendas = !vendas?.disponivel;
  if (semVendas && gasto.size === 0) return <Vazio compacto titulo="Sem dados no período">Vendas sincronizadas e despesas confirmadas aparecem aqui.</Vazio>;
  return (
    <div class="pilha pilha--p">
      <GraficoBarras
        rotulo="Receitas e despesas no período"
        rotulos={eixo.map((b) => rotuloBalde(b, agrupar))}
        formatar={(x) => moeda(x)}
        altura={260}
        series={[
          // Dia sem linha no relatório de vendas: sem venda registrada (0); sem a loja ligada, sem dado (null).
          { nome: 'Receita', cor: COR_RECEITA, valores: eixo.map((b) => (semVendas ? null : receita.get(b) ?? 0)) },
          { nome: 'Despesas', cor: COR_DESPESA, valores: eixo.map((b) => gasto.get(b) ?? 0) },
        ]}
      />
      {(semVendas || !completo) && (
        <span class="fraco">
          {semVendas ? 'Receita indisponível: as vendas da Eyemobile ainda não estão sincronizadas. ' : ''}
          {!completo ? 'Período com muitas despesas: o gráfico mostra as 2.000 mais recentes; o total do indicador é o oficial.' : ''}
        </span>
      )}
      <span class="fraco">Despesas pela data de competência; receita pela data da venda. Contas ainda não pagas entram pela competência, não pelo pagamento.</span>
    </div>
  );
}

const MEIOS: Record<string, string> = { credito: 'Crédito', debito: 'Débito', pix: 'Pix', dinheiro: 'Dinheiro', outro: 'Outros' };

function PorMeio({ relatorio }: { relatorio: RelatorioVendas }) {
  if (!relatorio.disponivel) return <Vazio compacto titulo={SEM_VENDAS}>{relatorio.motivo}</Vazio>;
  if (!relatorio.por_meio.length) return <Vazio compacto titulo="Nenhuma venda no período" />;
  return (
    <Ranking
      rotulo="Vendas por forma de pagamento"
      itens={relatorio.por_meio
        .slice()
        .sort((a, b) => (num(b.valor) ?? 0) - (num(a.valor) ?? 0))
        .map((m) => ({ nome: MEIOS[m.meio] ?? m.meio, valor: num(m.valor) ?? 0, texto: moeda(m.valor), detalhe: plural(m.pagamentos, 'pagamento', 'pagamentos') }))}
    />
  );
}

/** Sem o Financeiro liberado neste ambiente: só o que Reservas sabe dizer de hoje, sem cifras inventadas. */
function SoReservas() {
  const hoje = hojeISO();
  const operacao = useConsulta(`reservas/operacao:${hoje}`, () => reservas.operacao(hoje));
  const ativas = operacao.dados?.filter((r) => statusBase(r) !== 'cancelada') ?? [];
  const pessoas = ativas.reduce((s, r) => s + r.pessoas, 0);
  return (
    <section class="indicadores indicadores--2" aria-label="Indicadores de hoje">
      <Indicador rotulo="Reservas de hoje" icone={<CalendarCheck aria-hidden="true" />} href="/admin/reservas" carregando={operacao.carregando} valor={operacao.dados ? inteiro(ativas.length) : '—'} rodape={operacao.dados ? plural(ativas.filter((r) => statusBase(r) === 'pendente').length, 'aguardando aprovação', 'aguardando aprovação') : operacao.erro?.message} />
      <Indicador rotulo="Pessoas previstas" icone={<Users aria-hidden="true" />} href="/admin/reservas" carregando={operacao.carregando} valor={operacao.dados ? inteiro(pessoas) : '—'} rodape={operacao.dados ? 'Reservas ativas de hoje' : undefined} />
    </section>
  );
}
