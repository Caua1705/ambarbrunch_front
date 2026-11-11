// Movimentações (fase final, 0031): a primeira aba do Financeiro, com duas visões simples — Receitas | Despesas.
// Uma barra só: busca, período e, no canto, os botões pequenos + Receita e + Despesa. Sem indicadores no topo e sem
// painel de filtros (nenhum filtro escondido fica aplicado: a consulta é só período + busca + visão).
//  - Receitas: vendas do PDV (Eyemobile) agrupadas por dia + outras receitas. A linha do dia abre o detalhe com o que
//    a integração informa (venda não é dinheiro recebido no banco); a receita manual abre a correção.
//  - Despesas: só despesas (o pagamento é a mesma despesa: não aparece de novo, nada é contado duas vezes). Colunas:
//    Data, Descrição, Categoria, Valor, Pagador, Responsável e Situação; a linha abre o detalhe (edição autorizada,
//    inclusive o responsável). Conta a pagar em aberto é a MESMA despesa que aparece em Contas a pagar.
// Rotas: GET /admin/financeiro/lancamentos?grupo=receitas|despesas e /relatorios/vendas (detalhe do dia).
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Plus, Search, MoreHorizontal, Pencil } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, inicioMes, fimMes, somarMeses, somarDias, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao, Suspenso, Gaveta, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Segmentado, Situacao, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Lancamento, ListaLancamentos, OutraReceitaSaida } from '../../lib/tipos/financeiro';
import { SituacaoLancamento, useCadastroCategorias, nomeCategoria, temPermissao, atualizarFinanceiro, avisar, RESPONSAVEL, MEIO, PARTE } from './comum';
import { NovaDespesa, EditarDespesa } from './NovaDespesa';
import { NovaReceita } from './NovaReceita';
import { DetalheDespesa } from './DetalheDespesa';

type Periodo = 'mes' | 'anterior' | '30d' | 'personalizado' | 'todo' | 'sem_data';
export type VistaMovimentacoes = 'receitas' | 'despesas';

/** Tipos de cada visão. Vendas do PDV (venda_dia) são RECEITA: nunca entram em Despesas, mesmo que um backend anterior
 * à 0031 (que ignora `grupo`) devolva tudo — foi assim que "Vendas PDV" apareceu em Despesas como "A pagar". */
// Despesas = PAGAMENTOS realizados (cada um uma vez, pelo valor pago, na data do pagamento); a conta em aberto fica em
// Contas a pagar. Receitas = o que já entrou.
const TIPOS_DA_VISTA: Record<VistaMovimentacoes, string[]> = { receitas: ['venda_dia', 'outra_receita'], despesas: ['pagamento'] };

const diasEntre = (de: string, ate: string) => (Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000;

function intervalo(p: Periodo, de: string, ate: string): [string, string] {
  const hoje = hojeISO();
  if (p === 'mes') return [inicioMes(hoje), hoje];
  if (p === 'anterior') {
    const a = somarMeses(hoje, -1);
    return [a, fimMes(a)];
  }
  if (p === '30d') return [somarDias(hoje, -29), hoje];
  return [de || inicioMes(hoje), ate || hoje];
}

/** Correções (sempre com motivo, no histórico). */
function pedidoCorrecao(l: Lancamento): PedidoConfirmacao | null {
  if (l.tipo === 'despesa' && l.status !== 'cancelada') {
    return { titulo: 'Cancelar esta despesa?', texto: 'A despesa sai das contas a pagar e do resultado. Se já tiver pagamento, estorne o pagamento antes.', confirmar: 'Cancelar despesa', perigo: true, motivo: { rotulo: 'Motivo do cancelamento' }, acao: async (m) => { await financeiro.cancelarDespesa(l.id, m); atualizarFinanceiro(); }, sucesso: 'Despesa cancelada.' };
  }
  if (l.tipo === 'outra_receita' && l.status === 'confirmada') {
    return { titulo: 'Cancelar esta receita?', texto: 'A receita sai do resultado do mês. Receita conciliada com o extrato precisa ser desfeita na conciliação antes.', confirmar: 'Cancelar receita', perigo: true, motivo: { rotulo: 'Motivo do cancelamento' }, acao: async (m) => { await financeiro.cancelarOutraReceita(l.id, m); atualizarFinanceiro(); }, sucesso: 'Receita cancelada.' };
  }
  return null;
}

export function Movimentacoes({ contexto }: { contexto: ContextoPainel }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const [vista, setVista] = useState<VistaMovimentacoes>(() => (lerParam('vista') === 'receitas' || lerParam('tipo') === 'receitas' ? 'receitas' : 'despesas'));
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [nova, setNova] = useState(false);
  const [receita, setReceita] = useState(false);
  const [despesa, setDespesa] = useState<string | null>(lerParam('despesa'));
  const [receitaEditar, setReceitaEditar] = useState<OutraReceitaSaida | null>(null);
  const [dia, setDia] = useState<Lancamento | null>(null);
  const [editar, setEditar] = useState<string | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();

  // Endereços antigos com filtros (?tipo=, ?situacao=): nada fica aplicado escondido.
  useEffect(() => gravarParams({ vista: vista === 'despesas' ? null : vista, tipo: null, situacao: null }), [vista]);
  useEffect(() => gravarParams({ despesa }), [despesa]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtiva(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const abrirReceita = async (id: string) => {
    try {
      setReceitaEditar(await financeiro.outraReceita(id));
    } catch {
      avisar('Não foi possível abrir a receita. Tente de novo.', 'erro');
    }
  };

  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar descrição ou fornecedor" aria-label="Buscar movimentação" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        <select class="selecao selecao--auto" aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.currentTarget.value as Periodo)}>
          <option value="mes">Este mês</option>
          <option value="anterior">Mês anterior</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="todo">Todo o período</option>
          <option value="sem_data">Sem data</option>
          <option value="personalizado">Escolher datas…</option>
        </select>
        {periodo === 'personalizado' && <Datas periodo={periodo} de={de} ate={ate} setDe={setDe} setAte={setAte} />}
        {lancar && (
          <div class="barra-ferramentas__acoes">
            <Botao tamanho="p" aria-label="Outra receita" icone={<Plus aria-hidden="true" />} onClick={() => setReceita(true)}>Receita</Botao>
            <Botao tamanho="p" variante="primario" aria-label="Nova despesa" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Despesa</Botao>
          </div>
        )}
      </div>

      <Segmentado<VistaMovimentacoes>
        rotulo="Visão de Movimentações"
        valor={vista}
        aoMudar={setVista}
        opcoes={[{ valor: 'receitas', rotulo: 'Receitas' }, { valor: 'despesas', rotulo: 'Despesas' }]}
      />

      <Lista
        vista={vista} periodo={periodo} de={de} ate={ate} busca={buscaAtiva} lancar={lancar} confirmar={confirmar}
        abrirDespesa={setDespesa} abrirReceita={abrirReceita} abrirDia={setDia} editarDespesa={setEditar}
        irPara={(d, a) => { setDe(d); setAte(a); setPeriodo('personalizado'); }}
      />

      <NovaDespesa aberta={nova} aoFechar={() => setNova(false)} aoCriar={(id) => setDespesa(id)} />
      <NovaReceita aberta={receita || !!receitaEditar} editar={receitaEditar} aoFechar={() => { setReceita(false); setReceitaEditar(null); }} />
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
      <VendasDoDia dia={dia} aoFechar={() => setDia(null)} />
      <EditarDespesa id={editar} aoFechar={() => setEditar(null)} />
      {dialogo}
    </>
  );
}

function Datas({ periodo, de, ate, setDe, setAte }: { periodo: Periodo; de: string; ate: string; setDe: (v: string) => void; setAte: (v: string) => void }) {
  const [d1, d2] = intervalo(periodo, de, ate);
  return (
    <>
      <input type="date" class="entrada entrada--data" aria-label="De" value={de || d1} onChange={(e) => setDe(e.currentTarget.value)} />
      <input type="date" class="entrada entrada--data" aria-label="Até" value={ate || d2} onChange={(e) => setAte(e.currentTarget.value)} />
    </>
  );
}

/** Situação de PAGAMENTO da despesa (a conta a pagar é a mesma despesa). Comprovante registrado (pagamento vivo)
 * = Paga, mesmo com categoria/pagador ainda por conferir: isso é pendência à parte (etiqueta), não muda o pagamento. */
function SituacaoDespesa({ l }: { l: Lancamento }) {
  if (l.tipo === 'pagamento') {
    const paga = <Situacao tom="ok">Paga</Situacao>;
    return l.detalhes.status_despesa === 'em_revisao' ? <span class="linha" style={{ gap: '6px', flexWrap: 'wrap' }}>{paga}<Etiqueta tom="atencao">pendência</Etiqueta></span> : paga;
  }
  if (l.status === 'cancelada') return <Situacao tom="apagado">Cancelada</Situacao>;
  const pago = Number(l.detalhes.pago ?? 0);
  const valor = Number(l.valor);
  const proximo = l.detalhes.proximo_vencimento as string | null | undefined;
  const situacao = pago >= valor - 0.004 ? <Situacao tom="ok">Paga</Situacao>
    : proximo && proximo < hojeISO() ? <Situacao tom="perigo" destaque>Vencida</Situacao>
      : pago > 0 ? <Situacao tom="info">Parcialmente paga</Situacao>
        : <Situacao tom="neutro">A pagar</Situacao>;
  if (l.status !== 'em_revisao') return situacao;
  return <span class="linha" style={{ gap: '6px', flexWrap: 'wrap' }}>{situacao}<Etiqueta tom="atencao">pendência</Etiqueta></span>;
}

/** Pagador com os mesmos nomes do Responsável (Âmbar, Roll, Conjunto); a conta (ex.: pessoal do Cauã) fica embaixo. */
function PagadorCelula({ l }: { l: Lancamento }) {
  // Empresa pagadora: Âmbar, Roll ou Âmbarxroll (a operação conjunta). Conta individual, se houver, embaixo.
  const lado = l.pagador_lado ? (l.pagador_lado === 'conjunta' ? 'ÂmbarxRoll' : PARTE[l.pagador_lado]) : null;
  if (lado) return <><span>{lado}</span>{l.pagador && l.pagador !== lado && <span class="sub">{l.pagador}</span>}</>;
  if (l.pagador) return <span>{l.pagador}</span>;
  if (l.detalhes.tem_pagamento === false || l.status === 'cancelada') return <span class="fraco">—</span>;
  return <span class="fin-falta">Não identificado</span>;
}

function Lista(p: {
  vista: VistaMovimentacoes; periodo: Periodo; de: string; ate: string; busca: string; lancar: boolean;
  confirmar: (p: PedidoConfirmacao) => void; abrirDespesa: (id: string) => void; abrirReceita: (id: string) => void;
  abrirDia: (l: Lancamento) => void; irPara: (de: string, ate: string) => void; editarDespesa: (id: string) => void;
}) {
  const { vista, lancar, confirmar, abrirDespesa, abrirReceita, abrirDia, editarDespesa } = p;
  const cats = useCadastroCategorias();
  const opReceita = useConsulta('financeiro/outras-receitas/opcoes', () => financeiro.opcoesReceita());
  const [d1, d2] = intervalo(p.periodo, p.de, p.ate);
  const livre = p.periodo === 'todo' || p.periodo === 'sem_data';
  const q = { ...(livre ? {} : { de: d1, ate: d2 }), ...(p.periodo === 'sem_data' ? { sem_data: true } : {}), grupo: vista, busca: p.busca || undefined };
  const lista = useConsulta(`financeiro/lancamentos?${JSON.stringify(q)}`, () => financeiro.lancamentos({ ...q, limite: 200 }));
  // Período vazio: o lançamento mais recente ANTES dele (até um ano), para o vazio dizer onde estão os registros.
  const qAntes = { ...q, de: somarDias(d1, -366), ate: somarDias(d1, -1) };
  const anterior = useConsulta(lista.dados?.total === 0 && !livre ? `financeiro/lancamentos:anterior?${JSON.stringify(qAntes)}` : null,
    () => financeiro.lancamentos({ ...qAntes, limite: 1 }));
  const ultimo = lista.dados?.total === 0 ? anterior.dados?.itens[0]?.data ?? null : null;
  const desde = ultimo && diasEntre(inicioMes(ultimo), d2) <= 366 ? inicioMes(ultimo) : ultimo;

  const acoes: Coluna<Lancamento> = {
    id: 'acoes', titulo: '', prioridade: 'media',
    celula: (l) => {
      const correcao = lancar ? pedidoCorrecao(l) : null;
      const editavel = lancar && (l.tipo === 'despesa' || l.tipo === 'pagamento') && l.status !== 'cancelada' && !!l.despesa_id;
      if (!correcao && !editavel) return null;
      return (
        <span class="linha" style={{ gap: '2px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          {editavel && <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Editar ${l.descricao}`} icone={<Pencil aria-hidden="true" />} onClick={(e: Event) => { e.stopPropagation(); editarDespesa(l.despesa_id!); }} />}
          {correcao && (
            <Suspenso rotulo={`Ações para ${l.descricao}`} gatilho={(g) => <Botao tamanho="p" variante="fantasma" so_icone {...g} icone={<MoreHorizontal aria-hidden="true" />} />}>
              {(fechar) => <button class="suspenso__item" role="menuitem" style={{ color: 'var(--perigo)' }} onClick={() => { fechar(); confirmar(correcao); }}>{l.tipo === 'despesa' ? 'Cancelar despesa' : 'Cancelar receita'}</button>}
            </Suspenso>
          )}
        </span>
      );
    },
  };
  const data: Coluna<Lancamento> = { id: 'data', titulo: 'Data', prioridade: 'media', ordenar: (l) => l.data, largura: '84px', celula: (l) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(l.data)}</span> };

  const colunasReceitas: Coluna<Lancamento>[] = useMemo(() => [
    data,
    {
      id: 'descricao', titulo: 'Descrição', ordenar: (l) => l.descricao,
      celula: (l) => (
        <>
          <span class="principal-celula">{l.tipo === 'venda_dia' ? 'Vendas do PDV' : l.descricao}</span>
          <span class="sub">
            <span class="fin-so-celular">{dataCurta(l.data)} · </span>
            {l.tipo === 'venda_dia'
              ? `Eyemobile · ${plural(l.detalhes.vendas ?? 0, 'venda', 'vendas')}`
              : [l.detalhes.recebido_em ? `recebida em ${dataCurta(l.detalhes.recebido_em as string)}` : 'a receber', l.detalhes.operacional === false ? 'fora do faturamento' : null].filter(Boolean).join(' · ')}
          </span>
        </>
      ),
    },
    { id: 'categoria', titulo: 'Categoria', prioridade: 'media', celula: (l) => (l.tipo === 'venda_dia' ? <span class="fraco">Vendas</span> : (opReceita.dados?.categorias.find((c) => c.codigo === l.categoria)?.nome ?? l.categoria ?? '—')) },
    { id: 'valor', titulo: 'Valor', numero: true, ordenar: (l) => Number(l.valor), celula: (l) => <span class="num forte" style={{ whiteSpace: 'nowrap', color: 'var(--ok)' }}>+ {moeda(l.valor)}</span> },
    { id: 'situacao', titulo: 'Situação', prioridade: 'media', celula: (l) => <SituacaoLancamento status={l.status} tipo={l.tipo} /> },
    acoes,
  ], [opReceita.dados, lancar]);

  const colunasDespesas: Coluna<Lancamento>[] = useMemo(() => [
    data,
    {
      id: 'descricao', titulo: 'Descrição', ordenar: (l) => l.descricao,
      celula: (l) => (
        <>
          <span class="principal-celula">{l.descricao}</span>
          <span class="sub"><span class="fin-so-celular">{dataCurta(l.data)} · {l.pagador_lado ? PARTE[l.pagador_lado] : l.pagador ?? 'pagador não identificado'} · </span>{l.fornecedor ?? ''}</span>
        </>
      ),
    },
    { id: 'categoria', titulo: 'Categoria', prioridade: 'media', ordenar: (l) => l.categoria ?? '', celula: (l) => (l.categoria === 'a_classificar' ? <span class="fin-falta">Sem categoria</span> : nomeCategoria(cats.dados, l.categoria)) },
    { id: 'valor', titulo: 'Valor', numero: true, ordenar: (l) => Number(l.valor), celula: (l) => <span class="num forte" style={{ whiteSpace: 'nowrap' }}>{moeda(l.valor)}</span> },
    { id: 'pagador', titulo: 'Pagador', prioridade: 'media', ordenar: (l) => l.pagador_lado ?? l.pagador ?? '', celula: (l) => <PagadorCelula l={l} /> },
    { id: 'responsavel', titulo: 'Responsável', prioridade: 'media', ordenar: (l) => String(l.detalhes.responsavel ?? ''), celula: (l) => RESPONSAVEL[String(l.detalhes.responsavel ?? '')] ?? '—' },
    { id: 'situacao', titulo: 'Situação', prioridade: 'media', celula: (l) => <SituacaoDespesa l={l} /> },
    acoes,
  ], [cats.dados, lancar]);

  return (
    <Cartao justo>
      {lista.dados && (
        <div class="fin-totais">
          <div><span>{vista === 'despesas' ? 'Pagamentos realizados' : 'Recebimentos'}</span><strong class="num">{lista.dados.totais.quantidade ?? lista.dados.total}</strong></div>
          <div><span>{vista === 'despesas' ? 'Total pago' : 'Total recebido'}</span><strong class="num">{moeda(lista.dados.totais.valor ?? '0')}</strong></div>
        </div>
      )}
      <Dados consulta={lista} recurso="As movimentações" esqueleto={<EsqueletoTabela />}>
        {(r: ListaLancamentos) => (
          <>
            <Tabela
              rotulo={vista === 'receitas' ? 'Receitas do período' : 'Despesas do período'}
              colunas={vista === 'receitas' ? colunasReceitas : colunasDespesas}
              linhas={r.itens.filter((l) => TIPOS_DA_VISTA[vista].includes(l.tipo))}
              chave={(l) => `${l.tipo}:${l.id}`}
              aoAbrir={(l) => {
                if (l.tipo === 'venda_dia') abrirDia(l);
                else if (l.tipo === 'outra_receita') void abrirReceita(l.id);
                else if (l.tipo === 'despesa') abrirDespesa(l.id);
                else if (l.tipo === 'pagamento' && l.despesa_id) abrirDespesa(l.despesa_id);
              }}
              destaque={(l) => l.status === 'em_revisao'}
              apagada={(l) => l.status === 'cancelada'}
              ordemInicial={{ coluna: 'data', desc: true }}
              vazio={ultimo && desde ? (
                <Vazio titulo="Nenhuma movimentação no período" acao={<Botao onClick={() => p.irPara(desde, d2)}>Ver desde {dataCurta(desde, { ano: true })}</Botao>}>
                  {`A mais recente antes deste período é de ${dataCurta(ultimo, { ano: true })}.`}{vista === 'despesas' && ' Comprovantes da Júlia entram na data do pagamento, não na do envio.'}
                </Vazio>
              ) : (
                <Vazio titulo="Nenhuma movimentação no período">{vista === 'receitas' ? 'Vendas do PDV entram sozinhas; outras receitas pelo botão “+ Receita”.' : 'Despesas novas entram pelo botão “+ Despesa” ou pela Júlia.'}</Vazio>
              )}
            />
            {r.total > r.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {r.itens.length} de {r.total}: use a busca ou o período.</p>}
          </>
        )}
      </Dados>
    </Cartao>
  );
}

/** Detalhe de um dia de vendas: só o que a Eyemobile informa. Venda não é dinheiro já recebido no banco. */
function VendasDoDia({ dia, aoFechar }: { dia: Lancamento | null; aoFechar: () => void }) {
  const relatorio = useConsulta(dia ? `financeiro/vendas-dia:${dia.data}` : null, () => financeiro.vendas(dia!.data, dia!.data, 'dia'));
  if (!dia) return <Gaveta aberta={false} aoFechar={aoFechar} titulo="">{null}</Gaveta>;
  const d = dia.detalhes as Record<string, string | number | null | undefined>;
  const linha = (rotulo: string, valor: string | number | null | undefined, dinheiro = true) =>
    valor === undefined || valor === null ? null : <Fragment key={rotulo}><dt>{rotulo}</dt><dd class="num">{dinheiro ? moeda(valor) : String(valor)}</dd></Fragment>;
  return (
    <Gaveta aberta aoFechar={aoFechar} titulo={`Vendas de ${dataCurta(dia.data, { ano: true, semana: true })}`} subtitulo="Eyemobile (PDV)">
      <div class="pilha">
        <dl class="definicoes">
          {linha('Vendas', d.vendas, false)}
          {linha('Total vendido', d.total_vendido)}
          {linha('Descontos', d.descontos)}
          {linha('Devoluções', d.devolucoes)}
          {linha('Receita líquida', dia.valor)}
          {linha('Taxa de serviço (fora da receita)', d.taxa_servico)}
          {linha('Recebido no PDV', d.recebido_pdv)}
        </dl>
        <section class="pilha pilha--p">
          <h3 class="secao-titulo">Por forma de pagamento</h3>
          <Dados consulta={relatorio} recurso="As formas de pagamento do dia" compacto esqueleto={<Esqueleto linhas={3} />}>
            {(r) => (r.disponivel && r.por_meio.length ? (
              <dl class="definicoes">
                {r.por_meio.map((m) => <Fragment key={m.meio}><dt>{MEIO[m.meio as keyof typeof MEIO] ?? m.meio} <span class="fraco">({plural(m.pagamentos, 'pagamento', 'pagamentos')})</span></dt><dd class="num">{moeda(m.valor)}</dd></Fragment>)}
              </dl>
            ) : <p class="fraco">A Eyemobile não informou as formas de pagamento deste dia.</p>)}
          </Dados>
        </section>
        <p class="fraco">Valores registrados no PDV. Venda não é dinheiro já recebido no banco: o cartão cai depois, com a taxa da adquirente.</p>
      </div>
    </Gaveta>
  );
}
