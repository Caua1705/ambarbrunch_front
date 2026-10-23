/** @jsxImportSource preact */
// Histórico de pontos (/clube/historico) — só apresentação. Hoje o backend não publica o histórico para o site
// (lib/api/clube-futuro.ts): a página mostra o estado “em preparação”. A lista já existe para quando a rota vier —
// recebe os movimentos por props, com os estados carregando, vazio e erro. Nada é calculado no navegador.
import { Icone } from './icones';
import type { Movimento } from '../../lib/api/clube-futuro';

const pts = new Intl.NumberFormat('pt-BR', { signDisplay: 'always' });
const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const mesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const ROTULO: Record<Movimento['tipo'], string> = { ganho: 'Pontos ganhos', uso: 'Pontos usados', estorno: 'Estorno', expiracao: 'Pontos expirados', ajuste: 'Ajuste' };

export type EstadoLista = 'carregando' | 'vazio' | 'erro' | 'ok';

/** estado “em preparação”: a página existe, o programa ainda não */
export function EmPreparo({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div class="area-vazio area-vazio--preparo">
      <Icone nome="espiral" class="area-vazio__icone" />
      <p class="area-vazio__titulo">{titulo}</p>
      <p class="area-vazio__texto">{texto}</p>
      <a class="ticket__link" href="/clube/conta/">Voltar para a conta</a>
    </div>
  );
}

/** movimentos em ordem cronológica (do mais novo), agrupados por mês */
export function ListaMovimentos({ estado, itens = [], erro, aoTentar }: { estado: EstadoLista; itens?: Movimento[]; erro?: string; aoTentar?: () => void }) {
  if (estado === 'carregando') {
    return (
      <ul class="extrato extrato--esqueleto" role="status" aria-label="Carregando o histórico">
        {[0, 1, 2, 3].map(() => <li><span /><span /></li>)}
      </ul>
    );
  }
  if (estado === 'erro') {
    return (
      <div class="area-vazio" role="alert">
        <p class="area-vazio__titulo">Não deu para carregar o histórico</p>
        <p class="area-vazio__texto">{erro ?? 'Tente de novo em instantes.'}</p>
        {aoTentar && <button class="btn btn--wine" type="button" onClick={aoTentar}>Tentar de novo</button>}
      </div>
    );
  }
  if (estado === 'vazio' || !itens.length) {
    return (
      <div class="area-vazio">
        <Icone nome="historico" class="area-vazio__icone" />
        <p class="area-vazio__titulo">Nenhuma movimentação ainda</p>
        <p class="area-vazio__texto">Suas compras identificadas no Âmbar aparecem aqui.</p>
      </div>
    );
  }
  const grupos = new Map<string, Movimento[]>();
  for (const m of [...itens].sort((a, b) => b.data.localeCompare(a.data))) {
    const g = mesAno.format(new Date(m.data));
    grupos.set(g, [...(grupos.get(g) ?? []), m]);
  }
  return (
    <div class="historico">
      {[...grupos].map(([mes, ms]) => (
        <section class="historico__mes" aria-label={mes}>
          <h2 class="historico__titulo">{mes}</h2>
          <ul class="extrato">
            {ms.map((m) => (
              <li data-tipo={m.tipo} data-situacao={m.situacao}>
                <time dateTime={m.data}>{dia.format(new Date(m.data)).replace('.', '')}</time>
                <span class="extrato__desc">
                  {m.descricao}
                  <small>{ROTULO[m.tipo]}{m.situacao === 'pendente' ? ' · em liberação' : ''}</small>
                </span>
                <span class="extrato__pts" data-sinal={m.pontos < 0 ? 'neg' : 'pos'}>{pts.format(m.pontos)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
