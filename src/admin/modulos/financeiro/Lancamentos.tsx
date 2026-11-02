// Lançamentos: consultar e registrar movimentações. Uma barra com a busca, o período e as ações (Nova despesa em
// destaque, Outra receita); os filtros menos usados (o que mostrar, categoria, origem, situação) ficam recolhidos. A
// lista mostra o necessário para reconhecer o lançamento; o resto abre no detalhe. Sem indicadores: os totais do período
// ficam numa linha no rodapé. Conciliação com o extrato: aba Conciliação. Pendências: aba Revisão e o sino.
// Rotas: GET /admin/financeiro/lancamentos; POST despesas, outras-receitas; despesas/{id}/cancelar,
// outras-receitas/{id}/cancelar, pagamentos/{id}/estornar (motivo obrigatório).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Plus, Search, MoreHorizontal, HandCoins, SlidersHorizontal } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, inicioMes, fimMes, somarMeses, somarDias, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao, Suspenso, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Cartao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Lancamento, ListaLancamentos, TipoLancamento } from '../../lib/tipos/financeiro';
import { ORIGEM, TIPO_LANCAMENTO, SituacaoLancamento, useCadastroCategorias, nomeCategoria, temPermissao, atualizarFinanceiro } from './comum';
import { NovaDespesa } from './NovaDespesa';
import { NovaReceita } from './NovaReceita';
import { DetalheDespesa } from './DetalheDespesa';
import type { IrPara } from './index';

type Periodo = 'mes' | 'anterior' | '30d' | 'personalizado';
/** `principal`: receitas e despesas (despesa paga aparece duas vezes no backend: a despesa e o pagamento). */
type Mostrar = 'principal' | TipoLancamento | 'tudo';

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
    return { titulo: `Estornar o pagamento de ${moeda(l.valor)}?`, texto: 'A conta volta a ficar em aberto. Pagamento conciliado com o extrato precisa ser desfeito na conciliação (Banco) antes.', confirmar: 'Estornar', perigo: true, motivo: { rotulo: 'Motivo do estorno' }, acao: async (m) => { await financeiro.estornarPagamento(l.id, m); atualizarFinanceiro(); }, sucesso: 'Pagamento estornado.' };
  }
  if (l.tipo === 'outra_receita' && l.status === 'confirmada') {
    return { titulo: 'Cancelar esta receita?', texto: 'A receita sai do resultado do mês. Receita conciliada com o extrato precisa ser desfeita na conciliação (Banco) antes.', confirmar: 'Cancelar receita', perigo: true, motivo: { rotulo: 'Motivo do cancelamento' }, acao: async (m) => { await financeiro.cancelarOutraReceita(l.id, m); atualizarFinanceiro(); }, sucesso: 'Receita cancelada.' };
  }
  return null;
}

const ROTULO_CORRECAO: Partial<Record<TipoLancamento, string>> = { despesa: 'Cancelar despesa', pagamento: 'Estornar pagamento', outra_receita: 'Cancelar receita' };

export function Lancamentos({ contexto }: { contexto: ContextoPainel; ir?: IrPara }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
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
  // Cadastro inteiro: lançamento antigo continua com categoria que não vale mais (aluguel, energia…) e precisa de nome e filtro.
  const cats = useCadastroCategorias();

  useEffect(() => gravarParams({ despesa }), [despesa]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtiva(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const [d1, d2] = intervalo(periodo, de, ate);
  const tipo = mostrar === 'principal' || mostrar === 'tudo' ? undefined : mostrar;
  const q = { de: d1, ate: d2, tipo, categoria: categoria || undefined, origem: origem || undefined, status: situacao || undefined, busca: buscaAtiva || undefined };
  const lista = useConsulta(`financeiro/lancamentos?${JSON.stringify(q)}`, () => financeiro.lancamentos({ ...q, limite: 200 }));
  const filtrosAtivos = [mostrar !== 'principal', !!categoria, !!origem, !!situacao].filter(Boolean).length;

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
            <span class="sub"><span class="fin-so-celular">{dataCurta(l.data)} · </span>{[TIPO_LANCAMENTO[l.tipo], l.fornecedor, extra].filter(Boolean).join(' · ')}{l.status === 'em_revisao' && <span class="fin-so-celular"> · <strong style={{ color: 'var(--atencao)' }}>para revisar</strong></span>}</span>
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
        if (l.status === 'em_revisao' && alvo) return <Botao tamanho="p" variante="primario" onClick={() => setDespesa(alvo)}>Revisar</Botao>;
        const correcao = lancar ? pedidoCorrecao(l) : null;
        if (!alvo && !correcao) return null;
        return (
          <Suspenso rotulo={`Ações para ${l.descricao}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone {...p} icone={<MoreHorizontal aria-hidden="true" />} />}>
            {(fechar) => (
              <>
                {alvo && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setDespesa(alvo); }}>{l.tipo === 'pagamento' ? 'Ver a despesa paga' : 'Ver detalhes'}</button>}
                {correcao && <button class="suspenso__item" role="menuitem" style={{ color: 'var(--perigo)' }} onClick={() => { fechar(); confirmar(correcao); }}>{ROTULO_CORRECAO[l.tipo]}</button>}
              </>
            )}
          </Suspenso>
        );
      },
    },
  ], [cats.dados, lancar]);

  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar descrição ou fornecedor" aria-label="Buscar lançamento" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        <select class="selecao selecao--auto" aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.currentTarget.value as Periodo)}>
          <option value="mes">Este mês</option>
          <option value="anterior">Mês anterior</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="personalizado">Escolher datas…</option>
        </select>
        {periodo === 'personalizado' && (
          <>
            <input type="date" class="entrada entrada--data" aria-label="De" value={de || d1} onChange={(e) => setDe(e.currentTarget.value)} />
            <input type="date" class="entrada entrada--data" aria-label="Até" value={ate || d2} onChange={(e) => setAte(e.currentTarget.value)} />
          </>
        )}
        <Botao variante="fantasma" icone={<SlidersHorizontal aria-hidden="true" />} aria-expanded={maisFiltros} aria-controls="lanc-filtros" onClick={() => setMaisFiltros(!maisFiltros)}>
          Filtros{filtrosAtivos ? <span class="contador">{filtrosAtivos}</span> : null}
        </Botao>
        <div class="barra-ferramentas__acoes">
          {lancar && <Botao icone={<HandCoins aria-hidden="true" />} onClick={() => setReceita(true)}>Outra receita</Botao>}
          {lancar && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Nova despesa</Botao>}
        </div>
      </div>

      {(maisFiltros || filtrosAtivos > 0) && (
        <div class="filtros filtros--recolhiveis" id="lanc-filtros">
          <select class="selecao" aria-label="Mostrar" value={mostrar} onChange={(e) => setMostrar(e.currentTarget.value as Mostrar)}>
            <option value="principal">Receitas e despesas</option>
            <option value="venda_dia">Só vendas do PDV</option>
            <option value="despesa">Só despesas</option>
            <option value="pagamento">Só pagamentos</option>
            <option value="outra_receita">Só outras receitas</option>
            <option value="tudo">Tudo</option>
          </select>
          <select class="selecao" aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
            <option value="">Todas as categorias</option>
            {[...(cats.dados ?? [])].sort((a, b) => Number(b.ativa_na_unidade !== false) - Number(a.ativa_na_unidade !== false) || (a.ordem ?? 100) - (b.ordem ?? 100)).map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}{c.ativa_na_unidade === false ? ' (fora de uso)' : ''}</option>)}
          </select>
          <select class="selecao" aria-label="Origem" value={origem} onChange={(e) => setOrigem(e.currentTarget.value)}>
            <option value="">Todas as origens</option>
            {Object.entries(ORIGEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select class="selecao" aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.currentTarget.value)}>
            <option value="">Todas as situações</option>
            <option value="em_revisao">Para revisar</option>
            <option value="confirmada">Confirmadas</option>
            <option value="cancelada">Canceladas</option>
            <option value="confirmado">Pagamentos feitos</option>
            <option value="estornado">Pagamentos estornados</option>
          </select>
          {filtrosAtivos > 0 && <Botao tamanho="p" variante="fantasma" onClick={() => { setMostrar('principal'); setCategoria(''); setOrigem(''); setSituacao(''); }}>Limpar filtros</Botao>}
        </div>
      )}

      <Cartao justo>
          <Dados consulta={lista} recurso="Os lançamentos" esqueleto={<EsqueletoTabela />}>
            {(r: ListaLancamentos) => (
              <>
                <Tabela
                  rotulo="Lançamentos do período"
                  colunas={colunas}
                  linhas={mostrar === 'principal' ? r.itens.filter((l) => l.tipo !== 'pagamento') : r.itens}
                  chave={(l) => `${l.tipo}:${l.id}`}
                  aoAbrir={(l) => { const alvo = l.tipo === 'despesa' ? l.id : l.despesa_id; if (alvo) setDespesa(alvo); }}
                  destaque={(l) => l.status === 'em_revisao'}
                  apagada={(l) => l.status === 'cancelada' || l.status === 'estornado'}
                  ordemInicial={{ coluna: 'data', desc: true }}
                  vazio={<Vazio titulo="Nenhum lançamento no período">Mude o período ou os filtros. Despesas novas entram pelo botão “Nova despesa” ou pela Júlia.</Vazio>}
                />
                <p class="totais-linha" aria-label="Totais do período">
                  <span>Vendas do PDV <strong class="num">{moeda(r.totais.receita_pdv)}</strong></span>
                  <span>Outras receitas <strong class="num">{moeda(r.totais.outras_receitas)}</strong></span>
                  <span>Despesas confirmadas <strong class="num">{moeda(r.totais.despesas_confirmadas)}</strong></span>
                  {Number(r.totais.despesas_em_revisao) > 0 && <span>Em revisão <strong class="num">{moeda(r.totais.despesas_em_revisao)}</strong></span>}
                  <span>Pagamentos <strong class="num">{moeda(r.totais.pagamentos)}</strong></span>
                  {r.total > r.itens.length && <span class="fraco">Mostrando {r.itens.length} de {r.total}: use a busca ou os filtros.</span>}
                </p>
              </>
            )}
          </Dados>
        </Cartao>

      <NovaDespesa aberta={nova} aoFechar={() => setNova(false)} aoCriar={(id) => setDespesa(id)} />
      <NovaReceita aberta={receita} aoFechar={() => setReceita(false)} />
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
      {dialogo}
    </>
  );
}
