// Lançamentos: o dia a dia do Financeiro. Duas ações no topo (Nova despesa, Importar extrato), a fila "Para revisar" em
// destaque e, ao lado, o Banco (conciliação com o extrato) — tudo dentro desta aba.
// Rotas: GET /admin/financeiro/lancamentos, /revisao, /categorias; despesas e conciliação nas gavetas.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Plus, Upload, Search, FileWarning, ChevronRight, List, Landmark, MoreHorizontal } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, inicioMes, fimMes, somarMeses, somarDias, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao, Suspenso } from '../../ui/camadas';
import { Botao, Cabecalho, Cartao, Segmentado } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Lancamento, ListaLancamentos } from '../../lib/tipos/financeiro';
import { ORIGEM, TIPO_LANCAMENTO, SituacaoLancamento, useCategorias, nomeCategoria } from './comum';
import { NovaDespesa } from './NovaDespesa';
import { DetalheDespesa } from './DetalheDespesa';
import { Revisao } from './Revisao';
import { Banco } from './Banco';
import { ImportarExtrato } from './ImportarExtrato';

type Periodo = 'mes' | 'anterior' | '30d' | 'personalizado';

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

export function Lancamentos(_: { contexto: ContextoPainel }) {
  const [vista, setVista] = useState<'lancamentos' | 'banco'>(lerParam('vista') === 'banco' ? 'banco' : 'lancamentos');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [categoria, setCategoria] = useState('');
  const [origem, setOrigem] = useState('');
  const [situacao, setSituacao] = useState('');
  // Despesa paga aparece duas vezes no backend (a despesa e o pagamento). Por padrão, só receitas e despesas.
  const [mostrar, setMostrar] = useState<'principal' | 'pagamentos' | 'tudo'>('principal');
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [nova, setNova] = useState(false);
  const [importar, setImportar] = useState(false);
  const [revisar, setRevisar] = useState(lerParam('revisar') === '1');
  const [despesa, setDespesa] = useState<string | null>(lerParam('despesa'));
  const [importacao, setImportacao] = useState<string | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const cats = useCategorias();

  useEffect(() => gravarParams({ vista: vista === 'banco' ? 'banco' : null, revisar: revisar ? '1' : null, despesa }), [vista, revisar, despesa]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtiva(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const [d1, d2] = intervalo(periodo, de, ate);
  const q = { de: d1, ate: d2, tipo: mostrar === 'pagamentos' ? 'pagamento' : undefined, categoria: categoria || undefined, origem: origem || undefined, status: situacao || undefined, busca: buscaAtiva || undefined };
  const lista = useConsulta(vista === 'lancamentos' ? `financeiro/lancamentos?${JSON.stringify(q)}` : null, () => financeiro.lancamentos({ ...q, limite: 200 }));
  const fila = useConsulta('financeiro/revisao', () => financeiro.revisao());
  const nRevisar = fila.dados ? fila.dados.despesas.total + fila.dados.documentos.total : 0;

  const colunas: Coluna<Lancamento>[] = useMemo(() => [
    { id: 'data', titulo: 'Data', prioridade: 'media', ordenar: (l) => l.data, largura: '92px', celula: (l) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(l.data)}</span> },
    {
      id: 'descricao', titulo: 'Descrição', ordenar: (l) => l.descricao,
      celula: (l) => (
        <>
          <span class="principal-celula">{l.descricao}</span>
          <span class="sub"><span class="fin-so-celular">{dataCurta(l.data)} · </span>{[TIPO_LANCAMENTO[l.tipo], l.fornecedor].filter(Boolean).join(' · ')}{l.status === 'em_revisao' && <span class="fin-so-celular"> · <strong style={{ color: 'var(--atencao)' }}>para revisar</strong></span>}</span>
        </>
      ),
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
        if (!alvo) return null;
        return (
          <Suspenso rotulo={`Ações para ${l.descricao}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone {...p} icone={<MoreHorizontal aria-hidden="true" />} />}>
            {(fechar) => <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setDespesa(alvo); }}>{l.tipo === 'pagamento' ? 'Ver a despesa paga' : 'Ver detalhes'}</button>}
          </Suspenso>
        );
      },
    },
  ], [cats.dados]);

  return (
    <>
      <Cabecalho
        titulo="Lançamentos"
        descricao="Vendas do PDV, despesas, pagamentos e outras receitas"
        acoes={
          <>
            <Botao icone={<Upload aria-hidden="true" />} onClick={() => setImportar(true)}>Importar extrato</Botao>
            <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Nova despesa</Botao>
          </>
        }
      />

      {nRevisar > 0 && (
        <button class="aviso aviso--atencao fin-faixa" onClick={() => setRevisar(true)}>
          <FileWarning aria-hidden="true" />
          <span style={{ flex: 1, textAlign: 'left' }}>
            <strong>Para revisar ({nRevisar})</strong> <span class="suave">— {plural(fila.dados!.documentos.total, 'comprovante da Júlia', 'comprovantes da Júlia')}, {plural(fila.dados!.despesas.total, 'despesa', 'despesas')}</span>
          </span>
          <span class="btn btn--p btn--primario">Revisar <ChevronRight aria-hidden="true" /></span>
        </button>
      )}

      <Segmentado
        rotulo="Ver"
        valor={vista}
        aoMudar={setVista}
        opcoes={[
          { valor: 'lancamentos', rotulo: <><List size={14} aria-hidden="true" /> Lançamentos</> },
          { valor: 'banco', rotulo: <><Landmark size={14} aria-hidden="true" /> Banco</> },
        ]}
      />

      {vista === 'banco' ? (
        <Banco importacao={importacao} aoLimparImportacao={() => setImportacao(null)} aoImportar={() => setImportar(true)} confirmar={confirmar} />
      ) : (
        <Cartao justo>
          <div class="filtros" style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }}>
            <div class="entrada-grupo">
              <Search aria-hidden="true" />
              <input class="entrada" type="search" placeholder="Buscar descrição ou fornecedor" aria-label="Buscar lançamento" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
            </div>
            <select class="selecao" aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.currentTarget.value as Periodo)}>
              <option value="mes">Este mês</option>
              <option value="anterior">Mês anterior</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="personalizado">Escolher datas…</option>
            </select>
            {periodo === 'personalizado' && (
              <>
                <input type="date" class="entrada" style={{ width: 'auto' }} aria-label="De" value={de || d1} onChange={(e) => setDe(e.currentTarget.value)} />
                <input type="date" class="entrada" style={{ width: 'auto' }} aria-label="Até" value={ate || d2} onChange={(e) => setAte(e.currentTarget.value)} />
              </>
            )}
            <select class="selecao" aria-label="Mostrar" value={mostrar} onChange={(e) => setMostrar(e.currentTarget.value as typeof mostrar)}>
              <option value="principal">Receitas e despesas</option>
              <option value="pagamentos">Só pagamentos</option>
              <option value="tudo">Tudo</option>
            </select>
            <select class="selecao" aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
              <option value="">Todas as categorias</option>
              {(cats.dados ?? []).filter((c) => c.ativo).map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
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
            </select>
          </div>
          <Dados consulta={lista} recurso="Os lançamentos" esqueleto={<EsqueletoTabela />}>
            {(r: ListaLancamentos) => (
              <>
                <div class="fin-totais" aria-label="Totais do período">
                  <div><span>Vendas do PDV</span><strong class="num">{moeda(r.totais.receita_pdv)}</strong></div>
                  <div><span>Outras receitas</span><strong class="num">{moeda(r.totais.outras_receitas)}</strong></div>
                  <div><span>Despesas confirmadas</span><strong class="num">{moeda(r.totais.despesas_confirmadas)}</strong></div>
                  <div><span>Em revisão</span><strong class="num">{moeda(r.totais.despesas_em_revisao)}</strong></div>
                  <div><span>Pagamentos</span><strong class="num">{moeda(r.totais.pagamentos)}</strong></div>
                </div>
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
                {r.total > r.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {r.itens.length} de {r.total}. Use os filtros para achar o restante.</p>}
              </>
            )}
          </Dados>
        </Cartao>
      )}

      <NovaDespesa aberta={nova} aoFechar={() => setNova(false)} aoCriar={(id) => setDespesa(id)} />
      <Revisao aberta={revisar && !despesa} aoFechar={() => setRevisar(false)} aoAbrirDespesa={(id) => setDespesa(id)} confirmar={confirmar} />
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
      <ImportarExtrato aberta={importar} aoFechar={() => setImportar(false)} aoVerDiferencas={(id) => { setImportar(false); setImportacao(id); setVista('banco'); }} />
      {dialogo}
    </>
  );
}
