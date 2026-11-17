// Agrupamentos (0039, 17/11): juntar despesas JÁ cadastradas sob um nome ("Passagens — 3ª semana de novembro") sem criar
// outra despesa. Cada despesa continua com o seu pagamento, pagador, categoria e data; o agrupamento só mostra o TOTAL
// calculado (soma das despesas vinculadas) — Movimentações, Contas a pagar, Relatórios e Repasses continuam lendo as
// despesas e nunca somam o agrupamento de novo. Uma despesa fica em no máximo um agrupamento; desvincular ou excluir o
// agrupamento nunca apaga a despesa. A linha da despesa abre o detalhe original.
// Rotas: GET/POST /agrupamentos, GET/PATCH/DELETE /agrupamentos/{id}, POST /agrupamentos/{id}/despesas,
// DELETE /agrupamentos/{id}/despesas/{despesa_id}; busca de despesas: GET /lancamentos?tipo=despesa&busca=.
import { useEffect, useState } from 'preact/hooks';
import { Plus, Search, Trash2, ExternalLink } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, plural } from '../../lib/formato';
import { Gaveta, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Cartao, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Agrupamento, AgrupamentoResumo, Lancamento } from '../../lib/tipos/financeiro';
import { avisar, avisarFalha, atualizarFinanceiro, useNomeCategoria } from './comum';

const atualizar = () => { invalidar('financeiro/agrupamento'); atualizarFinanceiro(); };

export function Agrupamentos({ lancar, abrirDespesa, confirmar }: { lancar: boolean; abrirDespesa: (id: string) => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | 'novo' | null>(null);
  const lista = useConsulta(`financeiro/agrupamentos?${busca}`, () => financeiro.agrupamentos(busca.trim() || undefined));
  const colunas: Coluna<AgrupamentoResumo>[] = [
    { id: 'titulo', titulo: 'Agrupamento', ordenar: (g) => g.titulo, celula: (g) => (<><span class="principal-celula">{g.titulo}</span><span class="sub">{plural(g.quantidade, 'despesa', 'despesas')}{g.primeiro_pagamento ? ` · pagas de ${dataCurta(g.primeiro_pagamento)} a ${dataCurta(g.ultimo_pagamento)}` : ''}</span></>) },
    { id: 'total', titulo: 'Total', numero: true, ordenar: (g) => Number(g.total), celula: (g) => <span class="num forte">{moeda(g.total)}</span> },
    { id: 'pago', titulo: 'Pago', numero: true, prioridade: 'media', celula: (g) => <span class="num">{moeda(g.pago)}</span> },
  ];
  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar agrupamento" aria-label="Buscar agrupamento" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        {lancar && (
          <div class="barra-ferramentas__acoes">
            <Botao tamanho="p" variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setAberto('novo')}>Agrupamento</Botao>
          </div>
        )}
      </div>
      <Cartao justo>
        <p class="fraco" style={{ margin: '12px 20px 0' }}>Agrupar só organiza despesas que já existem: o total é a soma delas e não é contado de novo em nenhum relatório.</p>
        <Dados consulta={lista} recurso="Os agrupamentos" esqueleto={<EsqueletoTabela />}>
          {(r) => (
            <Tabela rotulo="Agrupamentos de despesas" colunas={colunas} linhas={r.itens} chave={(g) => g.id} aoAbrir={(g) => setAberto(g.id)}
              vazio={<Vazio compacto titulo="Nenhum agrupamento">{lancar ? 'Use “+ Agrupamento” para juntar despesas já lançadas (ex.: as passagens da semana).' : 'Nenhuma despesa foi agrupada ainda.'}</Vazio>} />
          )}
        </Dados>
      </Cartao>
      {aberto === 'novo' && <NovoAgrupamento aoFechar={() => setAberto(null)} aoCriar={(id) => setAberto(id)} />}
      {aberto && aberto !== 'novo' && <DetalheAgrupamento id={aberto} lancar={lancar} aoFechar={() => setAberto(null)} abrirDespesa={abrirDespesa} confirmar={confirmar} />}
    </>
  );
}

/** Busca de despesas existentes (qualquer situação, menos cancelada) para vincular. */
function BuscarDespesas({ escolhidas, alternar, ignorar }: { escolhidas: Set<string>; alternar: (l: Lancamento) => void; ignorar?: Set<string> }) {
  const [termo, setTermo] = useState('');
  const [ativo, setAtivo] = useState('');
  useEffect(() => { const t = setTimeout(() => setAtivo(termo.trim()), 300); return () => clearTimeout(t); }, [termo]);
  const q = { tipo: 'despesa', busca: ativo || undefined, limite: 50 };
  const achadas = useConsulta(`financeiro/agrupamento-busca?${JSON.stringify(q)}`, () => financeiro.lancamentos(q));
  return (
    <section class="pilha pilha--p">
      <div class="entrada-grupo">
        <Search aria-hidden="true" />
        <input class="entrada" type="search" placeholder="Buscar despesa (ex.: passagem)" aria-label="Buscar despesa para agrupar" maxLength={80} value={termo} onInput={(e) => setTermo(e.currentTarget.value)} />
      </div>
      <Dados consulta={achadas} recurso="As despesas" compacto esqueleto={<Esqueleto linhas={3} />}>
        {(r) => {
          const linhas = r.itens.filter((l) => l.tipo === 'despesa' && l.status !== 'cancelada' && !ignorar?.has(l.id));
          return linhas.length === 0 ? <p class="fraco">Nenhuma despesa encontrada.</p> : (
            <ul class="fin-escolha" role="list">
              {linhas.map((l) => (
                <li key={l.id}>
                  <label class="linha" style={{ gap: '8px', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={escolhidas.has(l.id)} onChange={() => alternar(l)} aria-label={`Agrupar ${l.descricao}`} />
                    <span style={{ flex: 1 }}>{l.descricao}<span class="sub">{dataCurta(l.data)}{l.fornecedor ? ` · ${l.fornecedor}` : ''}</span></span>
                    <span class="num">{moeda(l.valor)}</span>
                  </label>
                </li>
              ))}
            </ul>
          );
        }}
      </Dados>
    </section>
  );
}

function NovoAgrupamento({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [titulo, setTitulo] = useState('');
  const [escolhidas, setEscolhidas] = useState<Map<string, Lancamento>>(new Map());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const total = [...escolhidas.values()].reduce((t, l) => t + Math.round(Number(l.valor) * 100), 0) / 100;
  const alternar = (l: Lancamento) => setEscolhidas((m) => { const n = new Map(m); if (n.has(l.id)) n.delete(l.id); else n.set(l.id, l); return n; });
  const salvar = async () => {
    if (titulo.trim().length < 2) return setErro('Dê um nome ao agrupamento.');
    setOcupado(true);
    try {
      const g = await financeiro.criarAgrupamento({ titulo: titulo.trim(), despesas: [...escolhidas.keys()] });
      atualizar();
      avisar('Agrupamento criado. Nenhuma despesa nova foi lançada.', 'ok');
      aoCriar(g.id);
    } catch (e) { avisarFalha(e); } finally { setOcupado(false); }
  };
  return (
    <Gaveta aberta aoFechar={aoFechar} titulo="Novo agrupamento" subtitulo="Junta despesas já lançadas; não cria outra despesa"
      rodape={<><span class="fraco num">{plural(escolhidas.size, 'despesa', 'despesas')} · {moeda(total)}</span><Botao variante="primario" disabled={ocupado} onClick={salvar}>Criar agrupamento</Botao></>}>
      <div class="pilha">
        <Campo rotulo="Nome" erro={erro}>{(id, d) => <input id={id} aria-describedby={d} class="entrada" maxLength={120} placeholder="Passagens — 3ª semana de novembro" value={titulo} onInput={(e) => { setTitulo(e.currentTarget.value); setErro(null); }} />}</Campo>
        <BuscarDespesas escolhidas={new Set(escolhidas.keys())} alternar={alternar} />
      </div>
    </Gaveta>
  );
}

function DetalheAgrupamento({ id, lancar, aoFechar, abrirDespesa, confirmar }: { id: string; lancar: boolean; aoFechar: () => void; abrirDespesa: (id: string) => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const consulta = useConsulta(`financeiro/agrupamento:${id}`, () => financeiro.agrupamento(id));
  const nome = useNomeCategoria();
  const [adicionar, setAdicionar] = useState<Map<string, Lancamento> | null>(null);
  const [titulo, setTitulo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const agir = async (f: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try { await f(); atualizar(); avisar(ok, 'ok'); } catch (e) { avisarFalha(e); } finally { setOcupado(false); }
  };
  const g = consulta.dados;
  return (
    <Gaveta aberta largura="media" aoFechar={aoFechar} titulo={g?.titulo ?? 'Agrupamento'} subtitulo="Só organização: as despesas continuam como estão"
      rodape={lancar && g ? (adicionar ? (
        <>
          <Botao variante="fantasma" onClick={() => setAdicionar(null)}>Voltar</Botao>
          <Botao variante="primario" disabled={ocupado || adicionar.size === 0} onClick={() => agir(async () => { await financeiro.vincularAgrupamento(g.id, [...adicionar.keys()]); setAdicionar(null); }, 'Despesas vinculadas.')}>Vincular {adicionar.size || ''}</Botao>
        </>
      ) : (
        <>
          <Botao variante="fantasma" icone={<Trash2 aria-hidden="true" />} disabled={ocupado} onClick={() => confirmar({ titulo: 'Excluir este agrupamento?', texto: 'Só o agrupamento sai. As despesas, pagamentos e valores continuam exatamente como estão.', confirmar: 'Excluir agrupamento', perigo: true, acao: async () => { await financeiro.excluirAgrupamento(g.id); atualizar(); aoFechar(); }, sucesso: 'Agrupamento excluído. Nenhuma despesa foi apagada.' })}>Excluir</Botao>
          <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setAdicionar(new Map())}>Adicionar despesas</Botao>
        </>
      )) : undefined}>
      <Dados consulta={consulta} recurso="O agrupamento" esqueleto={<Esqueleto linhas={4} />}>
        {(a: Agrupamento) => adicionar ? (
          <BuscarDespesas escolhidas={new Set(adicionar.keys())} ignorar={new Set(a.itens.map((i) => i.despesa_id))}
            alternar={(l) => setAdicionar((m) => { const n = new Map(m); if (n.has(l.id)) n.delete(l.id); else n.set(l.id, l); return n; })} />
        ) : (
          <div class="pilha">
            <div class="fin-totais">
              <div><span>Total (consolidado)</span><strong class="num">{moeda(a.total)}</strong></div>
              <div><span>Pago</span><strong class="num">{moeda(a.pago)}</strong></div>
              <div><span>Despesas</span><strong class="num">{a.quantidade}</strong></div>
            </div>
            {lancar && (titulo === null ? (
              <Botao tamanho="p" variante="fantasma" onClick={() => setTitulo(a.titulo)}>Renomear</Botao>
            ) : (
              <div class="linha" style={{ gap: '8px' }}>
                <input class="entrada" aria-label="Nome do agrupamento" maxLength={120} value={titulo} onInput={(e) => setTitulo(e.currentTarget.value)} />
                <Botao tamanho="p" variante="primario" disabled={ocupado || titulo.trim().length < 2} onClick={() => agir(async () => { await financeiro.alterarAgrupamento(a.id, { versao: a.versao, titulo: titulo.trim() }); setTitulo(null); }, 'Nome alterado.')}>Salvar</Botao>
              </div>
            ))}
            {a.itens.length === 0 ? <Vazio compacto titulo="Nenhuma despesa vinculada">{lancar ? 'Use “Adicionar despesas”.' : ''}</Vazio> : (
              <ul class="fin-escolha" role="list" aria-label="Despesas do agrupamento">
                {a.itens.map((i) => (
                  <li key={i.despesa_id} class="linha" style={{ gap: '8px', alignItems: 'flex-start', opacity: i.status === 'cancelada' ? 0.6 : 1 }}>
                    <span style={{ flex: 1 }}>
                      {i.descricao} {i.status === 'cancelada' && <Etiqueta tom="neutro">cancelada · fora do total</Etiqueta>}
                      <span class="sub">{i.pago_em ? `paga em ${dataCurta(i.pago_em)}` : 'em aberto'} · {nome(i.categoria)}</span>
                    </span>
                    <span class="num">{moeda(i.valor)}</span>
                    <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Abrir ${i.descricao}`} title="Abrir a despesa" icone={<ExternalLink aria-hidden="true" />} onClick={() => abrirDespesa(i.despesa_id)} />
                    {lancar && <Botao tamanho="p" variante="fantasma" so_icone disabled={ocupado} aria-label={`Tirar ${i.descricao} do agrupamento`} title="Tirar do agrupamento (a despesa continua)" icone={<Trash2 aria-hidden="true" />} onClick={() => agir(() => financeiro.desvincularAgrupamento(a.id, i.despesa_id), 'Despesa tirada do agrupamento (ela continua lançada).')} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Dados>
    </Gaveta>
  );
}
