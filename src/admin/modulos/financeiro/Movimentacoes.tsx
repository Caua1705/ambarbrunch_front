// Movimentações (fase final, 0031): a primeira aba do Financeiro, com duas visões simples — Receitas | Despesas.
// Uma barra só: busca, período e, no canto, os botões pequenos + Receita e + Despesa. Sem indicadores no topo e sem
// painel de filtros (nenhum filtro escondido fica aplicado: a consulta é só período + busca + visão).
//  - Receitas: vendas do PDV (Eyemobile) agrupadas por dia + outras receitas. A linha do dia abre o detalhe com o que
//    a integração informa (venda não é dinheiro recebido no banco); a receita manual abre a correção.
//  - Despesas: os PAGAMENTOS, na data real do pagamento (parcela paga entra no dia em que foi paga; o valor cheio de
//    uma compra parcelada nunca), cada um uma vez. Conta pessoal de sócio fica marcada "pessoal". Colunas:
//    Data, Descrição, Categoria, Valor, Pagador, Responsável e Situação; a linha abre o detalhe (edição autorizada,
//    inclusive o responsável). Conta a pagar em aberto é a MESMA despesa que aparece em Contas a pagar.
//  - Agrupamentos (0039; sem aba própria desde 17/11): os pagamentos de despesas agrupadas viram UMA linha consolidada
//    (nome, total, quantidade, situação) que expande nas linhas de sempre (abrir e editar cada despesa). Só organização:
//    o total da linha é a soma dos pagamentos dela que estão na lista, e os totais do topo continuam os do backend —
//    nada é contado duas vezes. Datas, pagadores, categorias e responsáveis diferentes não viram um valor único.
// Rotas: GET /admin/financeiro/lancamentos?grupo=receitas|despesas e /relatorios/vendas (detalhe do dia).
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Plus, Search, MoreHorizontal, Pencil, Layers, ChevronRight } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta, type Consulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, inicioMes, fimMes, somarMeses, somarDias, plural, num } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao, Suspenso, Gaveta, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Segmentado, Situacao, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Agrupamento, Lancamento, ListaLancamentos, OutraReceitaSaida } from '../../lib/tipos/financeiro';
import { SituacaoLancamento, useCadastroCategorias, nomeCategoria, temPermissao, atualizarFinanceiro, avisar, RESPONSAVEL, MEIO, PARTE } from './comum';
import { NovaDespesa, EditarDespesa } from './NovaDespesa';
import { NovaReceita } from './NovaReceita';
import { DetalheDespesa } from './DetalheDespesa';
import { NovoAgrupamento, GerenciarAgrupamento, useAgrupamentosDespesas, pedidoDesfazerAgrupamento } from './Agrupamentos';

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
  // ?vista=agrupamentos (a antiga terceira visão) cai em Despesas, onde os agrupamentos aparecem agora.
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
  const [agrupar, setAgrupar] = useState(false);
  const [gerenciar, setGerenciar] = useState<string | null>(null);
  /** Agrupamentos expandidos na tabela de Despesas. */
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const agrupamentos = useAgrupamentosDespesas(vista === 'despesas');
  // Despesa → título do agrupamento em que já está (a busca de "Agrupar despesas" não deixa escolher de novo).
  const ocupadas = useMemo(() => new Map((agrupamentos.dados ?? []).flatMap((g) => g.itens.map((i) => [i.despesa_id, g.titulo] as const))), [agrupamentos.dados]);
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
            {vista === 'despesas' && <Botao tamanho="p" variante="fantasma" icone={<Layers aria-hidden="true" />} onClick={() => setAgrupar(true)}>Agrupar despesas</Botao>}
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
        agrupamentos={agrupamentos} abertos={abertos} alternarGrupo={(id) => setAbertos((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
        gerenciarGrupo={setGerenciar}
      />

      {agrupar && <NovoAgrupamento ocupadas={ocupadas} aoFechar={() => setAgrupar(false)} aoCriar={(id) => { setAgrupar(false); setAbertos((x) => new Set(x).add(id)); }} />}
      {gerenciar && lancar && <GerenciarAgrupamento id={gerenciar} ocupadas={ocupadas} aoFechar={() => setGerenciar(null)} abrirDespesa={setDespesa} confirmar={confirmar} />}
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
    // 0042: pagamento com juros/multa — o valor da linha é o que saiu; a etiqueta mostra a parte dos encargos.
    const encargos = Number(l.detalhes.encargos ?? 0);
    const juros = encargos > 0 ? <Etiqueta tom="info">{`inclui ${moeda(encargos)} de juros/encargos`}</Etiqueta> : null;
    const pendencia = l.detalhes.status_despesa === 'em_revisao' ? <Etiqueta tom="atencao">pendência</Etiqueta> : null;
    return juros || pendencia ? <span class="linha" style={{ gap: '6px', flexWrap: 'wrap' }}>{paga}{juros}{pendencia}</span> : paga;
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

/** Quem pagou: ÂMBAR ou ROLL (o lado da conta de onde o dinheiro saiu); a conta (ex.: Marcelo, pessoal) fica embaixo.
 *  A conta conjunta (Stone) aparece como ÂMBARXROLL com "conta conjunta" embaixo: o dinheiro saiu da própria operação
 *  conjunta, por isso não gera repasse. Responsabilidade (quem deve arcar) é a coluna ao lado, não esta. */
function PagadorCelula({ l }: { l: Lancamento }) {
  // 17/11: conta PESSOAL de sócio (cartão/Pix pessoal) não é saída da conta da empresa: fica marcada.
  const pessoal = l.detalhes.pagador_natureza === 'pessoal' ? <Etiqueta tom="info">pessoal</Etiqueta> : null;
  const lado = l.pagador_lado ? PARTE[l.pagador_lado] : null;
  const conta = l.pagador_lado === 'conjunta' ? `conta conjunta${l.pagador && l.pagador.toLowerCase() !== 'âmbarxroll' ? ` · ${l.pagador}` : ''}` : l.pagador;
  // Histórico importado sem conta: o backend manda o nome da empresa ("Âmbar"), que não se repete embaixo.
  if (lado) return <><span>{lado}</span>{conta && conta.toLowerCase() !== lado.toLowerCase() && <span class="sub">{conta} {pessoal}</span>}</>;
  if (l.pagador) return <span>{l.pagador} {pessoal}</span>;
  if (l.detalhes.tem_pagamento === false || l.status === 'cancelada') return <span class="fraco">—</span>;
  return <span class="fin-falta">Não identificado</span>;
}

/** Linha da tabela de Despesas: um pagamento, ou um agrupamento consolidado com os pagamentos dele que estão na lista. */
type LinhaDespesa = { tipo: 'pag'; l: Lancamento } | { tipo: 'grupo'; g: Agrupamento; itens: Lancamento[] };

const centavos = (v: string) => Math.round(Number(v) * 100);
/** O valor, se for o mesmo em todas as linhas; senão null (nunca inventar um valor único para o grupo). */
function unico<V>(vals: V[]): V | null {
  return vals.length && vals.every((v) => v === vals[0]) ? vals[0] : null;
}
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

/** Situação do AGRUPAMENTO inteiro (o que o backend calcula: pago × total das despesas), mais a pendência de alguma. */
function SituacaoGrupo({ g, itens }: { g: Agrupamento; itens: Lancamento[] }) {
  const pago = centavos(g.pago);
  const total = centavos(g.total);
  const s = pago >= total ? <Situacao tom="ok">Paga</Situacao> : pago > 0 ? <Situacao tom="info">Parcialmente paga</Situacao> : <Situacao tom="neutro">A pagar</Situacao>;
  return itens.some((l) => l.detalhes.status_despesa === 'em_revisao') ? <span class="linha" style={{ gap: '6px', flexWrap: 'wrap' }}>{s}<Etiqueta tom="atencao">pendência</Etiqueta></span> : s;
}

function Lista(p: {
  vista: VistaMovimentacoes; periodo: Periodo; de: string; ate: string; busca: string; lancar: boolean;
  confirmar: (p: PedidoConfirmacao) => void; abrirDespesa: (id: string) => void; abrirReceita: (id: string) => void;
  abrirDia: (l: Lancamento) => void; irPara: (de: string, ate: string) => void; editarDespesa: (id: string) => void;
  agrupamentos: Consulta<Agrupamento[]>; abertos: Set<string>; alternarGrupo: (id: string) => void; gerenciarGrupo: (id: string) => void;
}) {
  const { vista, lancar, confirmar, abrirDespesa, abrirReceita, abrirDia, editarDespesa, abertos, alternarGrupo, gerenciarGrupo } = p;
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

  // Agrupamentos (só Despesas): despesa → agrupamento. Sem eles (carregando ou falha), a lista segue pagamento a pagamento.
  const grupos = vista === 'despesas' ? p.agrupamentos.dados ?? null : null;
  const grupoDa = useMemo(() => new Map((grupos ?? []).flatMap((g) => g.itens.map((i) => [i.despesa_id, g] as const))), [grupos]);
  // Busca pelo NOME do agrupamento: a busca do backend só olha descrição e fornecedor dos pagamentos, então os pagamentos
  // de um agrupamento achado pelo nome vêm de uma consulta do mesmo período sem a busca.
  const achados = useMemo(() => (p.busca && grupos ? grupos.filter((g) => semAcento(g.titulo).includes(semAcento(p.busca))).map((g) => g.id) : []), [grupos, p.busca]);
  const qSemBusca = { ...q, busca: undefined };
  const doPeriodo = useConsulta(achados.length ? `financeiro/lancamentos?${JSON.stringify(qSemBusca)}` : null, () => financeiro.lancamentos({ ...qSemBusca, limite: 200 }));
  /** Pagamentos dos agrupamentos achados pelo nome que a busca não trouxe (somam no topo, para o total bater com a tabela). */
  const extras = useMemo(() => {
    if (!achados.length || !doPeriodo.dados || !lista.dados) return [];
    const ja = new Set(lista.dados.itens.map((l) => `${l.tipo}:${l.id}`));
    return doPeriodo.dados.itens.filter((l) => l.tipo === 'pagamento' && !ja.has(`${l.tipo}:${l.id}`) && achados.includes(grupoDa.get(l.despesa_id ?? '')?.id ?? ''));
  }, [achados, doPeriodo.dados, lista.dados, grupoDa]);

  const linhasDespesas = (r: ListaLancamentos): LinhaDespesa[] => {
    const soltas: LinhaDespesa[] = [];
    const porGrupo = new Map<string, Lancamento[]>();
    for (const l of [...r.itens, ...extras].filter((x) => TIPOS_DA_VISTA.despesas.includes(x.tipo))) {
      const g = grupoDa.get(l.despesa_id ?? '');
      if (g) porGrupo.set(g.id, [...(porGrupo.get(g.id) ?? []), l]);
      else soltas.push({ tipo: 'pag', l });
    }
    return [...soltas, ...[...porGrupo].map(([id, itens]) => ({ tipo: 'grupo' as const, g: grupos!.find((x) => x.id === id)!, itens }))];
  };
  // Busca ativa: os agrupamentos já abrem mostrando o que foi achado (o clique recolhe).
  const aberto = (id: string) => abertos.has(id) !== !!p.busca;

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

  // Despesas: cada coluna sabe desenhar o pagamento (como antes) e o agrupamento consolidado. No agrupamento, o que
  // difere entre as despesas (datas, categoria, pagador, responsável) aparece como intervalo ou "Vários", nunca um
  // valor inventado; o valor é a soma dos pagamentos da linha, contados uma vez só.
  const colunasDespesas: Coluna<LinhaDespesa>[] = useMemo(() => {
    const datas = (itens: Lancamento[]) => itens.map((l) => l.data).filter(Boolean).sort();
    const periodoGrupo = (itens: Lancamento[]) => {
      const d = datas(itens);
      return !d.length ? '—' : d[0] === d[d.length - 1] ? dataCurta(d[0]) : `${dataCurta(d[0])} a ${dataCurta(d[d.length - 1])}`;
    };
    // Datas diferentes: o intervalo em duas linhas (de / a), para não alargar a coluna.
    const dataGrupo = (itens: Lancamento[]) => {
      const d = datas(itens);
      if (!d.length || d[0] === d[d.length - 1]) return periodoGrupo(itens);
      return <>{dataCurta(d[0])}<span class="sub">a {dataCurta(d[d.length - 1])}</span></>;
    };
    const soma = (itens: Lancamento[]) => (itens.reduce((t, l) => t + centavos(l.valor), 0) / 100).toFixed(2);
    const despesasDe = (itens: Lancamento[]) => new Set(itens.map((l) => l.despesa_id)).size;
    const pagadorDe = (l: Lancamento) => `${l.pagador_lado ?? ''}|${l.pagador ?? ''}|${l.detalhes.pagador_natureza ?? ''}`;
    const varios = <span class="fraco">Vários</span>;
    return [
      { id: 'data', titulo: 'Data', prioridade: 'media', largura: '84px', ordenar: (x) => (x.tipo === 'pag' ? x.l.data : datas(x.itens).at(-1) ?? null),
        celula: (x) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{x.tipo === 'pag' ? dataCurta(x.l.data) : dataGrupo(x.itens)}</span> },
      {
        id: 'descricao', titulo: 'Descrição', ordenar: (x) => (x.tipo === 'pag' ? x.l.descricao : x.g.titulo),
        celula: (x) => {
          if (x.tipo === 'pag') {
            const l = x.l;
            return (
              <>
                <span class="principal-celula">{l.descricao}</span>
                <span class="sub"><span class="fin-so-celular">{dataCurta(l.data)} · {l.pagador_lado ? PARTE[l.pagador_lado] : l.pagador ?? 'pagador não identificado'} · </span>{l.fornecedor ?? ''}</span>
              </>
            );
          }
          const n = despesasDe(x.itens);
          const exp = aberto(x.g.id);
          return (
            <span class="fin-grupo">
              <button type="button" class="fin-grupo__alternar" aria-expanded={exp} aria-label={`${exp ? 'Recolher' : 'Expandir'} ${x.g.titulo}`} onClick={() => alternarGrupo(x.g.id)}>
                <ChevronRight aria-hidden="true" />
              </button>
              <span>
                <span class="principal-celula">{x.g.titulo}</span>
                <span class="sub"><span class="fin-so-celular">{periodoGrupo(x.itens)} · </span>{n === x.g.quantidade ? plural(n, 'despesa', 'despesas') : `${n} de ${plural(x.g.quantidade, 'despesa', 'despesas')}`}</span>
              </span>
            </span>
          );
        },
      },
      { id: 'categoria', titulo: 'Categoria', prioridade: 'media', ordenar: (x) => (x.tipo === 'pag' ? x.l.categoria ?? '' : unico(x.itens.map((l) => l.categoria)) ?? ''),
        celula: (x) => {
          const c = x.tipo === 'pag' ? x.l.categoria : unico(x.itens.map((l) => l.categoria));
          if (x.tipo === 'grupo' && c === null) return varios;
          return c === 'a_classificar' ? <span class="fin-falta">Sem categoria</span> : nomeCategoria(cats.dados, c);
        } },
      { id: 'valor', titulo: 'Valor', numero: true, ordenar: (x) => Number(x.tipo === 'pag' ? x.l.valor : soma(x.itens)),
        celula: (x) => <span class="num forte" style={{ whiteSpace: 'nowrap' }}>{moeda(x.tipo === 'pag' ? x.l.valor : soma(x.itens))}</span> },
      { id: 'pagador', titulo: 'Pagador', prioridade: 'media', ordenar: (x) => (x.tipo === 'pag' ? x.l.pagador_lado ?? x.l.pagador ?? '' : unico(x.itens.map((l) => l.pagador_lado ?? l.pagador ?? '')) ?? ''),
        celula: (x) => (x.tipo === 'pag' ? <PagadorCelula l={x.l} /> : unico(x.itens.map(pagadorDe)) !== null ? <PagadorCelula l={x.itens[0]} /> : varios) },
      { id: 'responsavel', titulo: 'Responsável', prioridade: 'media', ordenar: (x) => (x.tipo === 'pag' ? String(x.l.detalhes.responsavel ?? '') : unico(x.itens.map((l) => String(l.detalhes.responsavel ?? ''))) ?? ''),
        celula: (x) => {
          const r = x.tipo === 'pag' ? String(x.l.detalhes.responsavel ?? '') : unico(x.itens.map((l) => String(l.detalhes.responsavel ?? '')));
          return r === null ? varios : RESPONSAVEL[r] ?? '—';
        } },
      { id: 'situacao', titulo: 'Situação', prioridade: 'media', celula: (x) => (x.tipo === 'pag' ? <SituacaoDespesa l={x.l} /> : <SituacaoGrupo g={x.g} itens={x.itens} />) },
      {
        id: 'acoes', titulo: '', prioridade: 'media',
        celula: (x) => {
          if (x.tipo === 'pag') return acoes.celula(x.l);
          if (!lancar) return null;
          return (
            <span class="linha" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
              <Suspenso rotulo={`Ações para ${x.g.titulo}`} gatilho={(g) => <Botao tamanho="p" variante="fantasma" so_icone {...g} icone={<MoreHorizontal aria-hidden="true" />} />}>
                {(fechar) => (
                  <>
                    <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); gerenciarGrupo(x.g.id); }}>Gerenciar agrupamento</button>
                    <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); confirmar(pedidoDesfazerAgrupamento(x.g)); }}>Desfazer agrupamento</button>
                  </>
                )}
              </Suspenso>
            </span>
          );
        },
      },
    ];
  }, [cats.dados, lancar, abertos, p.busca]);

  // Totais do topo: os do backend (cada pagamento uma vez; o agrupamento nunca soma). Só quando a busca pelo nome de um
  // agrupamento trouxe pagamentos que a busca do backend não pegou, eles entram aqui, para o topo bater com a tabela.
  const extraValor = extras.reduce((t, l) => t + centavos(l.valor), 0);
  const extraPessoal = extras.filter((l) => l.detalhes.pagador_natureza === 'pessoal').reduce((t, l) => t + centavos(l.valor), 0);
  const mais = (v: string | undefined, c: number) => ((centavos(v ?? '0') + c) / 100).toFixed(2);

  const vazio = ultimo && desde ? (
    <Vazio titulo="Nenhuma movimentação no período" acao={<Botao onClick={() => p.irPara(desde, d2)}>Ver desde {dataCurta(desde, { ano: true })}</Botao>}>
      {`A mais recente antes deste período é de ${dataCurta(ultimo, { ano: true })}.`}{vista === 'despesas' && ' Comprovantes da Júlia entram na data do pagamento, não na do envio.'}
    </Vazio>
  ) : (
    <Vazio titulo="Nenhuma movimentação no período">{vista === 'receitas' ? 'Vendas do PDV entram sozinhas; outras receitas pelo botão “+ Receita”.' : 'Despesas novas entram pelo botão “+ Despesa” ou pela Júlia.'}</Vazio>
  );

  return (
    <Cartao justo>
      {lista.dados && (
        <div class="fin-totais">
          <div><span>{vista === 'despesas' ? 'Pagamentos realizados' : 'Recebimentos'}</span><strong class="num">{(lista.dados.totais.quantidade ?? lista.dados.total) + extras.length}</strong></div>
          <div><span>{vista === 'despesas' ? 'Total pago' : 'Total recebido'}</span><strong class="num">{moeda(mais(lista.dados.totais.valor, extraValor))}</strong></div>
          {vista === 'despesas' && (num(lista.dados.totais.pagamentos_conta_pessoal ?? null) || extraPessoal) ? (
            <div><span>Pago com conta pessoal</span><strong class="num">{moeda(mais(lista.dados.totais.pagamentos_conta_pessoal, extraPessoal))}</strong></div>
          ) : null}
        </div>
      )}
      <Dados consulta={lista} recurso="As movimentações" esqueleto={<EsqueletoTabela />}>
        {(r: ListaLancamentos) => (
          <>
            {vista === 'despesas' && p.agrupamentos.erro && (
              <p class="fraco" role="status" style={{ margin: '8px 20px 0' }}>
                Não foi possível carregar os agrupamentos; as despesas aparecem uma a uma. <button type="button" class="link" onClick={p.agrupamentos.recarregar}>Tentar de novo</button>
              </p>
            )}
            {vista === 'despesas' && !p.agrupamentos.dados && !p.agrupamentos.erro ? (
              // Espera os agrupamentos: sem isso as despesas agrupadas piscariam soltas antes de virar uma linha.
              <EsqueletoTabela />
            ) : vista === 'receitas' ? (
              <Tabela
                rotulo="Receitas do período"
                colunas={colunasReceitas}
                linhas={r.itens.filter((l) => TIPOS_DA_VISTA.receitas.includes(l.tipo))}
                chave={(l) => `${l.tipo}:${l.id}`}
                aoAbrir={(l) => {
                  if (l.tipo === 'venda_dia') abrirDia(l);
                  else if (l.tipo === 'outra_receita') void abrirReceita(l.id);
                }}
                destaque={(l) => l.status === 'em_revisao'}
                apagada={(l) => l.status === 'cancelada'}
                ordemInicial={{ coluna: 'data', desc: true }}
                vazio={vazio}
              />
            ) : (
              <Tabela
                rotulo="Despesas do período"
                colunas={colunasDespesas}
                linhas={linhasDespesas(r)}
                chave={(x) => (x.tipo === 'pag' ? `${x.l.tipo}:${x.l.id}` : `grupo:${x.g.id}`)}
                filhos={(x) => (x.tipo === 'grupo' && aberto(x.g.id) ? x.itens.map((l) => ({ tipo: 'pag' as const, l })) : null)}
                aoAbrir={(x) => {
                  if (x.tipo === 'grupo') alternarGrupo(x.g.id);
                  else if (x.l.tipo === 'despesa') abrirDespesa(x.l.id);
                  else if (x.l.tipo === 'pagamento' && x.l.despesa_id) abrirDespesa(x.l.despesa_id);
                }}
                destaque={(x) => x.tipo === 'pag' && x.l.status === 'em_revisao'}
                apagada={(x) => x.tipo === 'pag' && x.l.status === 'cancelada'}
                ordemInicial={{ coluna: 'data', desc: true }}
                vazio={vazio}
              />
            )}
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
