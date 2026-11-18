// Agrupamentos (0039, 17/11): juntar despesas JÁ cadastradas sob um nome ("Passagens — 3ª semana de novembro") sem criar
// outra despesa. Cada despesa continua com o seu pagamento, pagador, categoria e data; o agrupamento só mostra o TOTAL
// calculado (soma das despesas vinculadas) — Movimentações, Contas a pagar, Relatórios e Repasses continuam lendo as
// despesas e nunca somam o agrupamento de novo. Uma despesa fica em no máximo um agrupamento; desvincular ou desfazer o
// agrupamento nunca apaga a despesa.
// Desde 17/11 não há aba própria: o agrupamento aparece em Movimentações → Despesas como uma linha consolidada que
// expande (ver Movimentacoes.tsx); aqui ficam a criação ("Agrupar despesas"), o gerenciamento e a leitura dos vínculos.
// Rotas: GET/POST /agrupamentos, GET/PATCH/DELETE /agrupamentos/{id}, POST /agrupamentos/{id}/despesas,
// DELETE /agrupamentos/{id}/despesas/{despesa_id}; busca de despesas: GET /lancamentos?tipo=despesa&busca=.
import { useEffect, useState } from 'preact/hooks';
import { Plus, Search, Trash2, ExternalLink } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, plural } from '../../lib/formato';
import { Gaveta, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { Agrupamento, AgrupamentoResumo, Lancamento } from '../../lib/tipos/financeiro';
import { avisar, avisarFalha, atualizarFinanceiro, useNomeCategoria } from './comum';

const atualizar = () => { invalidar('financeiro/agrupamento'); atualizarFinanceiro(); };

/**
 * Todos os agrupamentos da unidade com as despesas de cada um. A lista de lançamentos não diz o agrupamento de cada
 * pagamento, então o vínculo vem daqui: GET /agrupamentos e, para cada um, GET /agrupamentos/{id} (os itens).
 */
export function useAgrupamentosDespesas(ativo = true) {
  return useConsulta(ativo ? 'financeiro/agrupamento:todos' : null, async () => {
    const r = await financeiro.agrupamentos();
    return Promise.all(r.itens.map((g) => financeiro.agrupamento(g.id)));
  });
}

/** Desfazer: só o agrupamento sai; as despesas, pagamentos e valores continuam como estão. */
export const pedidoDesfazerAgrupamento = (g: Pick<AgrupamentoResumo, 'id' | 'titulo'>, depois?: () => void): PedidoConfirmacao => ({
  titulo: 'Desfazer este agrupamento?',
  texto: `Só o agrupamento “${g.titulo}” sai. As despesas, pagamentos e valores continuam exatamente como estão.`,
  confirmar: 'Desfazer agrupamento',
  acao: async () => { await financeiro.excluirAgrupamento(g.id); atualizar(); depois?.(); },
  sucesso: 'Agrupamento desfeito. Nenhuma despesa foi apagada.',
});

/** Busca de despesas existentes (qualquer situação, menos cancelada) para vincular. A que já está em outro agrupamento
 * aparece marcada e não pode ser escolhida (o backend recusaria). */
function BuscarDespesas({ escolhidas, alternar, ignorar, ocupadas }: { escolhidas: Set<string>; alternar: (l: Lancamento) => void; ignorar?: Set<string>; ocupadas?: Map<string, string> }) {
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
              {linhas.map((l) => {
                const outro = ocupadas?.get(l.id);
                return (
                  <li key={l.id}>
                    <label class="linha" style={{ gap: '8px', alignItems: 'flex-start', opacity: outro ? 0.6 : 1 }}>
                      <input type="checkbox" disabled={!!outro} checked={escolhidas.has(l.id)} onChange={() => alternar(l)} aria-label={`Agrupar ${l.descricao}`} />
                      <span style={{ flex: 1 }}>{l.descricao}<span class="sub">{dataCurta(l.data)}{l.fornecedor ? ` · ${l.fornecedor}` : ''}{outro ? ` · já em “${outro}”` : ''}</span></span>
                      <span class="num">{moeda(l.valor)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </Dados>
    </section>
  );
}

export function NovoAgrupamento({ aoFechar, aoCriar, ocupadas }: { aoFechar: () => void; aoCriar: (id: string) => void; ocupadas?: Map<string, string> }) {
  const [titulo, setTitulo] = useState('');
  const [escolhidas, setEscolhidas] = useState<Map<string, Lancamento>>(new Map());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const total = [...escolhidas.values()].reduce((t, l) => t + Math.round(Number(l.valor) * 100), 0) / 100;
  const alternar = (l: Lancamento) => setEscolhidas((m) => { const n = new Map(m); if (n.has(l.id)) n.delete(l.id); else n.set(l.id, l); return n; });
  const salvar = async () => {
    if (titulo.trim().length < 2) return setErro('Dê um nome ao agrupamento.');
    if (escolhidas.size === 0) return setErro('Escolha as despesas do agrupamento.');
    setOcupado(true);
    try {
      const g = await financeiro.criarAgrupamento({ titulo: titulo.trim(), despesas: [...escolhidas.keys()] });
      atualizar();
      avisar('Agrupamento criado. Nenhuma despesa nova foi lançada.', 'ok');
      aoCriar(g.id);
    } catch (e) { avisarFalha(e); } finally { setOcupado(false); }
  };
  return (
    <Gaveta aberta aoFechar={aoFechar} titulo="Agrupar despesas" subtitulo="Junta despesas já lançadas; não cria outra despesa"
      rodape={<><span class="fraco num">{plural(escolhidas.size, 'despesa', 'despesas')} · {moeda(total)}</span><Botao variante="primario" disabled={ocupado} onClick={salvar}>Criar agrupamento</Botao></>}>
      <div class="pilha">
        <Campo rotulo="Nome" erro={erro}>{(id, d) => <input id={id} aria-describedby={d} class="entrada" maxLength={120} placeholder="Passagens — 3ª semana de novembro" value={titulo} onInput={(e) => { setTitulo(e.currentTarget.value); setErro(null); }} />}</Campo>
        <BuscarDespesas escolhidas={new Set(escolhidas.keys())} alternar={(l) => { alternar(l); setErro(null); }} ocupadas={ocupadas} />
      </div>
    </Gaveta>
  );
}

/** Renomear, acrescentar ou tirar despesas e desfazer o agrupamento. Tirar uma despesa nunca a apaga. */
export function GerenciarAgrupamento({ id, aoFechar, abrirDespesa, confirmar, ocupadas }: { id: string; aoFechar: () => void; abrirDespesa: (id: string) => void; confirmar: (p: PedidoConfirmacao) => void; ocupadas?: Map<string, string> }) {
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
      rodape={g ? (adicionar ? (
        <>
          <Botao variante="fantasma" onClick={() => setAdicionar(null)}>Voltar</Botao>
          <Botao variante="primario" disabled={ocupado || adicionar.size === 0} onClick={() => agir(async () => { await financeiro.vincularAgrupamento(g.id, [...adicionar.keys()]); setAdicionar(null); }, 'Despesas vinculadas.')}>Vincular {adicionar.size || ''}</Botao>
        </>
      ) : (
        <>
          <Botao variante="fantasma" disabled={ocupado} onClick={() => confirmar(pedidoDesfazerAgrupamento(g, aoFechar))}>Desfazer agrupamento</Botao>
          <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setAdicionar(new Map())}>Adicionar despesas</Botao>
        </>
      )) : undefined}>
      <Dados consulta={consulta} recurso="O agrupamento" esqueleto={<Esqueleto linhas={4} />}>
        {(a: Agrupamento) => adicionar ? (
          <BuscarDespesas escolhidas={new Set(adicionar.keys())} ignorar={new Set(a.itens.map((i) => i.despesa_id))} ocupadas={ocupadas}
            alternar={(l) => setAdicionar((m) => { const n = new Map(m); if (n.has(l.id)) n.delete(l.id); else n.set(l.id, l); return n; })} />
        ) : (
          <div class="pilha">
            <div class="fin-totais">
              <div><span>Total (consolidado)</span><strong class="num">{moeda(a.total)}</strong></div>
              <div><span>Pago</span><strong class="num">{moeda(a.pago)}</strong></div>
              <div><span>Despesas</span><strong class="num">{a.quantidade}</strong></div>
            </div>
            {titulo === null ? (
              <Botao tamanho="p" variante="fantasma" onClick={() => setTitulo(a.titulo)}>Renomear</Botao>
            ) : (
              <div class="linha" style={{ gap: '8px' }}>
                <input class="entrada" aria-label="Nome do agrupamento" maxLength={120} value={titulo} onInput={(e) => setTitulo(e.currentTarget.value)} />
                <Botao tamanho="p" variante="primario" disabled={ocupado || titulo.trim().length < 2} onClick={() => agir(async () => { await financeiro.alterarAgrupamento(a.id, { versao: a.versao, titulo: titulo.trim() }); setTitulo(null); }, 'Nome alterado.')}>Salvar</Botao>
              </div>
            )}
            {a.itens.length === 0 ? <Vazio compacto titulo="Nenhuma despesa vinculada">Use “Adicionar despesas”.</Vazio> : (
              <ul class="fin-escolha" role="list" aria-label="Despesas do agrupamento">
                {a.itens.map((i) => (
                  <li key={i.despesa_id} class="linha" style={{ gap: '8px', alignItems: 'flex-start', opacity: i.status === 'cancelada' ? 0.6 : 1 }}>
                    <span style={{ flex: 1 }}>
                      {i.descricao} {i.status === 'cancelada' && <Etiqueta tom="neutro">cancelada · fora do total</Etiqueta>}
                      <span class="sub">{i.pago_em ? `paga em ${dataCurta(i.pago_em)}` : 'em aberto'} · {nome(i.categoria)}</span>
                    </span>
                    <span class="num">{moeda(i.valor)}</span>
                    <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Abrir ${i.descricao}`} title="Abrir a despesa" icone={<ExternalLink aria-hidden="true" />} onClick={() => abrirDespesa(i.despesa_id)} />
                    <Botao tamanho="p" variante="fantasma" so_icone disabled={ocupado} aria-label={`Tirar ${i.descricao} do agrupamento`} title="Tirar do agrupamento (a despesa continua)" icone={<Trash2 aria-hidden="true" />} onClick={() => agir(() => financeiro.desvincularAgrupamento(a.id, i.despesa_id), 'Despesa tirada do agrupamento (ela continua lançada).')} />
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
