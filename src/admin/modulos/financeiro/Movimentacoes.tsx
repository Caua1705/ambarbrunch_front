// Movimentações: a área principal do Financeiro. Uma barra com a busca, o período, os filtros recolhidos e as ações
// (Nova despesa em destaque, Outra receita) e, logo abaixo, os filtros simples Todas · Despesas · Outras receitas ·
// A pagar. "A pagar" mostra as contas a pagar (Contas.tsx, com as recorrentes): obrigação de pagamento, nunca misturada
// com o pagamento feito; nas outras vistas, contas vencidas ou que vencem hoje aparecem em destaque no topo. Cada
// registro aparece uma vez: a despesa paga não se repete como pagamento (os pagamentos só em Filtros → Mostrar).
// Vendas do PDV vêm da Eyemobile e ficam identificadas à parte; sem a integração, o painel diz "indisponível", nunca zero.
// O painel executivo é a Visão Geral: aqui só uma linha de totais do período.
// Rotas: GET /admin/financeiro/lancamentos e /contas-a-pagar; POST despesas, outras-receitas; despesas/{id}/cancelar,
// outras-receitas/{id}/cancelar, pagamentos/{id}/estornar (motivo obrigatório).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Plus, Search, MoreHorizontal, HandCoins, SlidersHorizontal, CalendarClock } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, inicioMes, fimMes, somarMeses, somarDias, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao, Suspenso, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Segmentado, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Lancamento, ListaLancamentos, ResumoFinanceiro, TipoLancamento } from '../../lib/tipos/financeiro';
import { ORIGEM, TIPO_LANCAMENTO, SituacaoLancamento, useCadastroCategorias, nomeCategoria, temPermissao, atualizarFinanceiro } from './comum';
import { NovaDespesa } from './NovaDespesa';
import { NovaReceita } from './NovaReceita';
import { DetalheDespesa } from './DetalheDespesa';
import { Contas } from './Contas';

type Periodo = 'mes' | 'anterior' | '30d' | 'personalizado';
/** Filtros simples da área (?tipo=). */
export type FiltroMovimentacoes = 'todas' | 'despesas' | 'receitas' | 'a-pagar';
/** Em "Todas": `principal` são receitas e despesas (a despesa paga aparece no backend também como pagamento). */
type Mostrar = 'principal' | 'venda_dia' | 'pagamento' | 'tudo';

const lerFiltro = (v: string | null): FiltroMovimentacoes => (v === 'despesas' || v === 'receitas' || v === 'a-pagar' ? v : 'todas');

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

/** Ações de correção por tipo (como no painel antigo): sempre com motivo, registrado no histórico. */
function pedidoCorrecao(l: Lancamento): PedidoConfirmacao | null {
  if (l.tipo === 'despesa' && l.status !== 'cancelada') {
    return { titulo: 'Cancelar esta despesa?', texto: 'A despesa sai das contas a pagar e do resultado. Se já tiver pagamento, estorne o pagamento antes.', confirmar: 'Cancelar despesa', perigo: true, motivo: { rotulo: 'Motivo do cancelamento' }, acao: async (m) => { await financeiro.cancelarDespesa(l.id, m); atualizarFinanceiro(); }, sucesso: 'Despesa cancelada.' };
  }
  if (l.tipo === 'pagamento' && l.status === 'confirmado') {
    return { titulo: `Estornar o pagamento de ${moeda(l.valor)}?`, texto: 'A conta volta a ficar em aberto. Pagamento conciliado com o extrato precisa ser desfeito na conciliação (Pendências → Banco) antes.', confirmar: 'Estornar', perigo: true, motivo: { rotulo: 'Motivo do estorno' }, acao: async (m) => { await financeiro.estornarPagamento(l.id, m); atualizarFinanceiro(); }, sucesso: 'Pagamento estornado.' };
  }
  if (l.tipo === 'outra_receita' && l.status === 'confirmada') {
    return { titulo: 'Cancelar esta receita?', texto: 'A receita sai do resultado do mês. Receita conciliada com o extrato precisa ser desfeita na conciliação (Pendências → Banco) antes.', confirmar: 'Cancelar receita', perigo: true, motivo: { rotulo: 'Motivo do cancelamento' }, acao: async (m) => { await financeiro.cancelarOutraReceita(l.id, m); atualizarFinanceiro(); }, sucesso: 'Receita cancelada.' };
  }
  return null;
}

const ROTULO_CORRECAO: Partial<Record<TipoLancamento, string>> = { despesa: 'Cancelar despesa', pagamento: 'Estornar pagamento', outra_receita: 'Cancelar receita' };

export function Movimentacoes({ contexto }: { contexto: ContextoPainel }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const [filtro, setFiltro] = useState<FiltroMovimentacoes>(() => lerFiltro(lerParam('tipo')));
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [categoria, setCategoria] = useState('');
  const [origem, setOrigem] = useState('');
  const [situacao, setSituacao] = useState('');
  const [mostrar, setMostrar] = useState<Mostrar>('principal');
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [nova, setNova] = useState(false);
  const [receita, setReceita] = useState(false);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [despesa, setDespesa] = useState<string | null>(lerParam('despesa'));
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const resumo = useConsulta('financeiro/resumo', () => financeiro.resumo());

  useEffect(() => gravarParams({ tipo: filtro === 'todas' ? null : filtro }), [filtro]);
  useEffect(() => gravarParams({ despesa }), [despesa]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtiva(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const aPagar = filtro === 'a-pagar';
  const filtrosAtivos = aPagar ? 0 : [mostrar !== 'principal', !!categoria, !!origem, !!situacao].filter(Boolean).length;
  const limparFiltros = () => { setMostrar('principal'); setCategoria(''); setOrigem(''); setSituacao(''); };
  const mudarFiltro = (f: FiltroMovimentacoes) => {
    // "Mostrar" e as situações são de cada tipo: trocar de filtro não carrega uma combinação que não existe.
    setMostrar('principal');
    setSituacao('');
    gravarParams({ situacao: null, vista: null });
    setFiltro(f);
  };
  const verContas = (situacaoConta: 'vencidas' | 'hoje') => {
    setMostrar('principal');
    setSituacao('');
    gravarParams({ situacao: situacaoConta, vista: null });
    setFiltro('a-pagar');
  };

  const contas = resumo.dados?.contas;
  const vencidas = contas?.vencidas.qtd ?? 0;
  const venceHoje = contas?.hoje.qtd ?? 0;

  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder={aPagar ? 'Buscar conta ou fornecedor' : 'Buscar descrição ou fornecedor'} aria-label="Buscar movimentação" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        {!aPagar && (
          <>
            <select class="selecao selecao--auto" aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.currentTarget.value as Periodo)}>
              <option value="mes">Este mês</option>
              <option value="anterior">Mês anterior</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="personalizado">Escolher datas…</option>
            </select>
            {periodo === 'personalizado' && <Datas periodo={periodo} de={de} ate={ate} setDe={setDe} setAte={setAte} />}
            <Botao variante="fantasma" icone={<SlidersHorizontal aria-hidden="true" />} aria-expanded={maisFiltros} aria-controls="mov-filtros" onClick={() => setMaisFiltros(!maisFiltros)}>
              Filtros{filtrosAtivos ? <span class="contador">{filtrosAtivos}</span> : null}
            </Botao>
          </>
        )}
        <div class="barra-ferramentas__acoes">
          {lancar && <Botao icone={<HandCoins aria-hidden="true" />} onClick={() => setReceita(true)}>Outra receita</Botao>}
          {lancar && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Nova despesa</Botao>}
        </div>
      </div>

      {!aPagar && (maisFiltros || filtrosAtivos > 0) && (
        <Filtros
          filtro={filtro} mostrar={mostrar} setMostrar={setMostrar} categoria={categoria} setCategoria={setCategoria}
          origem={origem} setOrigem={setOrigem} situacao={situacao} setSituacao={setSituacao} ativos={filtrosAtivos} limpar={limparFiltros}
        />
      )}

      <Segmentado<FiltroMovimentacoes>
        rotulo="Tipo de movimentação"
        valor={filtro}
        aoMudar={mudarFiltro}
        opcoes={[
          { valor: 'todas', rotulo: 'Todas' },
          { valor: 'despesas', rotulo: 'Despesas' },
          { valor: 'receitas', rotulo: 'Outras receitas' },
          { valor: 'a-pagar', rotulo: <>A pagar{vencidas ? <span class="contador contador--perigo" aria-label={plural(vencidas, 'conta vencida', 'contas vencidas')}>{vencidas}</span> : null}</> },
        ]}
      />

      {!aPagar && (vencidas > 0 || venceHoje > 0) && contas && (
        <Aviso tom="atencao" icone={<CalendarClock aria-hidden="true" />}>
          <strong>
            {[vencidas ? `${plural(vencidas, 'conta vencida', 'contas vencidas')} (${moeda(contas.vencidas.valor)})` : null, venceHoje ? `${plural(venceHoje, 'conta vence hoje', 'contas vencem hoje')} (${moeda(contas.hoje.valor)})` : null].filter(Boolean).join(' · ')}
          </strong>{' '}
          <button type="button" class="link" onClick={() => verContas(vencidas ? 'vencidas' : 'hoje')}>Ver contas a pagar</button>
        </Aviso>
      )}

      {aPagar ? (
        <Contas contexto={contexto} busca={buscaAtiva} abrirDespesa={setDespesa} />
      ) : (
        <ListaMovimentacoes
          filtro={filtro} mostrar={mostrar} periodo={periodo} de={de} ate={ate} categoria={categoria} origem={origem} situacao={situacao}
          busca={buscaAtiva} lancar={lancar} resumo={resumo.dados ?? null} abrirDespesa={setDespesa} confirmar={confirmar}
        />
      )}

      <NovaDespesa aberta={nova} aoFechar={() => setNova(false)} aoCriar={(id) => setDespesa(id)} />
      <NovaReceita aberta={receita} aoFechar={() => setReceita(false)} />
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
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

function Filtros(p: {
  filtro: FiltroMovimentacoes; mostrar: Mostrar; setMostrar: (v: Mostrar) => void; categoria: string; setCategoria: (v: string) => void;
  origem: string; setOrigem: (v: string) => void; situacao: string; setSituacao: (v: string) => void; ativos: number; limpar: () => void;
}) {
  // Cadastro inteiro: lançamento antigo continua com categoria que não vale mais (aluguel, energia…) e precisa de nome e filtro.
  const cats = useCadastroCategorias();
  return (
    <div class="filtros filtros--recolhiveis" id="mov-filtros">
      {p.filtro === 'todas' && (
        <select class="selecao" aria-label="Mostrar" value={p.mostrar} onChange={(e) => p.setMostrar(e.currentTarget.value as Mostrar)}>
          <option value="principal">Receitas e despesas</option>
          <option value="venda_dia">Só vendas do PDV</option>
          <option value="pagamento">Só pagamentos feitos</option>
          <option value="tudo">Tudo, com os pagamentos</option>
        </select>
      )}
      {p.filtro !== 'receitas' && (
        <select class="selecao" aria-label="Categoria" value={p.categoria} onChange={(e) => p.setCategoria(e.currentTarget.value)}>
          <option value="">Todas as categorias</option>
          {[...(cats.dados ?? [])].sort((a, b) => Number(b.ativa_na_unidade !== false) - Number(a.ativa_na_unidade !== false) || (a.ordem ?? 100) - (b.ordem ?? 100)).map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}{c.ativa_na_unidade === false ? ' (fora de uso)' : ''}</option>)}
        </select>
      )}
      <select class="selecao" aria-label="Origem" value={p.origem} onChange={(e) => p.setOrigem(e.currentTarget.value)}>
        <option value="">Todas as origens</option>
        {Object.entries(ORIGEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select class="selecao" aria-label="Situação" value={p.situacao} onChange={(e) => p.setSituacao(e.currentTarget.value)}>
        <option value="">Todas as situações</option>
        {p.filtro !== 'receitas' && <option value="em_revisao">Para revisar</option>}
        <option value="confirmada">Confirmadas</option>
        <option value="cancelada">Canceladas</option>
        {p.filtro === 'todas' && <option value="confirmado">Pagamentos feitos</option>}
        {p.filtro === 'todas' && <option value="estornado">Pagamentos estornados</option>}
      </select>
      {p.ativos > 0 && <Botao tamanho="p" variante="fantasma" onClick={p.limpar}>Limpar filtros</Botao>}
    </div>
  );
}

function ListaMovimentacoes(p: {
  filtro: Exclude<FiltroMovimentacoes, 'a-pagar'>; mostrar: Mostrar; periodo: Periodo; de: string; ate: string; categoria: string; origem: string; situacao: string;
  busca: string; lancar: boolean; resumo: ResumoFinanceiro | null; abrirDespesa: (id: string) => void; confirmar: (p: PedidoConfirmacao) => void;
}) {
  const { filtro, mostrar, lancar, resumo, abrirDespesa, confirmar } = p;
  const cats = useCadastroCategorias();
  const [d1, d2] = intervalo(p.periodo, p.de, p.ate);
  const tipo: TipoLancamento | undefined = filtro === 'despesas' ? 'despesa' : filtro === 'receitas' ? 'outra_receita' : mostrar === 'venda_dia' || mostrar === 'pagamento' ? mostrar : undefined;
  const q = { de: d1, ate: d2, tipo, categoria: p.categoria || undefined, origem: p.origem || undefined, status: p.situacao || undefined, busca: p.busca || undefined };
  const lista = useConsulta(`financeiro/lancamentos?${JSON.stringify(q)}`, () => financeiro.lancamentos({ ...q, limite: 200 }));
  // "A pagar em aberto" = o "Falta pagar" da vista A pagar → Em aberto: a MESMA consulta (mesma chave de cache de
  // Contas.tsx), para os dois números nunca divergirem.
  const verAPagar = filtro === 'despesas' || (filtro === 'todas' && (mostrar === 'principal' || mostrar === 'tudo'));
  const abertas = useConsulta(verAPagar ? `financeiro/contas:${JSON.stringify({ situacao: 'abertas' })}` : null, () => financeiro.contas({ situacao: 'abertas' }));
  // Sem a Eyemobile ligada (ou sem dados), as vendas do PDV são "indisponível", não R$ 0,00.
  const pdvIndisponivel = !!resumo && (resumo.mes.receita === null || ('configurada' in resumo.sincronizacao && resumo.sincronizacao.configurada === false));
  const soPrincipal = filtro === 'todas' && mostrar === 'principal';

  const colunas: Coluna<Lancamento>[] = useMemo(() => [
    { id: 'data', titulo: 'Data', prioridade: 'media', ordenar: (l) => l.data, largura: '92px', celula: (l) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(l.data)}</span> },
    {
      id: 'descricao', titulo: 'Descrição', ordenar: (l) => l.descricao,
      celula: (l) => {
        const extra = l.tipo === 'venda_dia' && l.detalhes.vendas !== undefined
          ? `${plural(l.detalhes.vendas, 'venda', 'vendas')} · taxa de serviço ${moeda(l.detalhes.taxa_servico ?? null)} (fora da receita)`
          : l.tipo === 'outra_receita' && l.detalhes.recebido_em ? `recebida em ${dataCurta(l.detalhes.recebido_em)}` : null;
        return (
          <>
            <span class="principal-celula">{l.descricao}</span>
            <span class="sub"><span class="fin-so-celular">{dataCurta(l.data)} · </span>{[l.tipo === 'venda_dia' ? 'Vendas do PDV (Eyemobile)' : TIPO_LANCAMENTO[l.tipo], l.fornecedor, extra].filter(Boolean).join(' · ')}{l.status === 'em_revisao' && <span class="fin-so-celular"> · <strong style={{ color: 'var(--atencao)' }}>para revisar</strong></span>}</span>
          </>
        );
      },
    },
    { id: 'categoria', titulo: 'Categoria', prioridade: 'media', ordenar: (l) => l.categoria ?? '', celula: (l) => (l.categoria ? nomeCategoria(cats.dados, l.categoria) : <span class="fraco">—</span>) },
    { id: 'origem', titulo: 'Origem', prioridade: 'baixa', celula: (l) => <span class="fraco">{ORIGEM[l.origem] ?? l.origem}</span> },
    {
      id: 'valor', titulo: 'Valor', numero: true, ordenar: (l) => Number(l.valor) * l.sinal,
      celula: (l) => <span class="num forte" style={{ whiteSpace: 'nowrap', color: l.sinal > 0 ? 'var(--ok)' : undefined }}>{l.sinal > 0 ? '+' : '−'} {moeda(l.valor)}</span>,
    },
    { id: 'situacao', titulo: 'Situação', prioridade: 'media', celula: (l) => <SituacaoLancamento status={l.status} tipo={l.tipo} /> },
    {
      id: 'acoes', titulo: '', prioridade: 'media',
      celula: (l) => {
        const alvo = l.tipo === 'despesa' ? l.id : l.despesa_id;
        if (l.status === 'em_revisao' && alvo) return <Botao tamanho="p" variante="primario" onClick={() => abrirDespesa(alvo)}>Revisar</Botao>;
        const correcao = lancar ? pedidoCorrecao(l) : null;
        if (!alvo && !correcao) return null;
        return (
          <Suspenso rotulo={`Ações para ${l.descricao}`} gatilho={(g) => <Botao tamanho="p" variante="fantasma" so_icone {...g} icone={<MoreHorizontal aria-hidden="true" />} />}>
            {(fechar) => (
              <>
                {alvo && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); abrirDespesa(alvo); }}>{l.tipo === 'pagamento' ? 'Ver a despesa paga' : 'Ver detalhes'}</button>}
                {correcao && <button class="suspenso__item" role="menuitem" style={{ color: 'var(--perigo)' }} onClick={() => { fechar(); confirmar(correcao); }}>{ROTULO_CORRECAO[l.tipo]}</button>}
              </>
            )}
          </Suspenso>
        );
      },
    },
  ], [cats.dados, lancar]);

  return (
    <Cartao justo>
      <Dados consulta={lista} recurso="As movimentações" esqueleto={<EsqueletoTabela />}>
        {(r: ListaLancamentos) => {
          // Só os totais que o filtro escolhido calcula de verdade (um total que o filtro zerou não aparece como R$ 0,00).
          const verReceitas = filtro === 'todas' && (mostrar === 'principal' || mostrar === 'tudo');
          const verDespesas = filtro === 'despesas' || verReceitas;
          return (
            <>
              <p class="totais-linha totais-linha--topo" aria-label="Totais do período">
                {(verReceitas || mostrar === 'venda_dia') && filtro === 'todas' && (
                  <span>Vendas do PDV (Eyemobile) {pdvIndisponivel ? <strong class="fraco">indisponível</strong> : <strong class="num">{moeda(r.totais.receita_pdv)}</strong>}</span>
                )}
                {(verReceitas || filtro === 'receitas') && <span>Outras receitas <strong class="num">{moeda(r.totais.outras_receitas)}</strong></span>}
                {verDespesas && <span>Despesas confirmadas <strong class="num">{moeda(r.totais.despesas_confirmadas)}</strong></span>}
                {verDespesas && Number(r.totais.despesas_em_revisao) > 0 && <span>Em revisão <strong class="num">{moeda(r.totais.despesas_em_revisao)}</strong></span>}
                {(verReceitas || mostrar === 'pagamento') && filtro === 'todas' && <span>Pagamentos realizados <strong class="num">{moeda(r.totais.pagamentos)}</strong></span>}
                {verDespesas && abertas.dados && <span>A pagar em aberto <strong class="num">{moeda(abertas.dados.totais.saldo)}</strong></span>}
              </p>
              <Tabela
                rotulo="Movimentações do período"
                colunas={colunas}
                linhas={soPrincipal ? r.itens.filter((l) => l.tipo !== 'pagamento') : r.itens}
                chave={(l) => `${l.tipo}:${l.id}`}
                aoAbrir={(l) => { const alvo = l.tipo === 'despesa' ? l.id : l.despesa_id; if (alvo) abrirDespesa(alvo); }}
                destaque={(l) => l.status === 'em_revisao'}
                apagada={(l) => l.status === 'cancelada' || l.status === 'estornado'}
                ordemInicial={{ coluna: 'data', desc: true }}
                vazio={<Vazio titulo="Nenhuma movimentação no período">{filtro === 'receitas' ? 'Receitas fora do PDV entram pelo botão “Outra receita”.' : 'Mude o período ou os filtros. Despesas novas entram pelo botão “Nova despesa” ou pela Júlia.'}</Vazio>}
              />
              {r.total > r.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {r.itens.length} de {r.total}: use a busca ou os filtros.</p>}
            </>
          );
        }}
      </Dados>
    </Cartao>
  );
}
