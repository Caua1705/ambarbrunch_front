/** @jsxImportSource preact */
// Histórico de pontos (/clube/historico) — só apresentação. Os dados vêm de GET /clube/me/movimentos (contrato real,
// lib/api/clube-acesso.ts → MovimentoClube) pela ilha ClubeArea; com o programa desligado, a página mostra o estado
// “em preparação”. A lista recebe os movimentos por props, com os estados carregando, vazio e erro, e “Ver mais” quando
// o backend indica outra página. Nada é calculado no navegador: pontos, situação e datas são os do livro; aqui só se
// escolhe o rótulo de cada tipo e se formata data e valor.
import { Icone } from './icones';
import type { MovimentoClube } from '../../lib/api/clube-acesso';

const pts = new Intl.NumberFormat('pt-BR', { signDisplay: 'exceptZero' });
const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const mesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const TITULO: Record<MovimentoClube['tipo'], string> = {
  compra: 'Compra no Âmbar', estorno: 'Compra cancelada', resgate_reservado: 'Resgate reservado', resgate: 'Resgate concluído',
  resgate_cancelado: 'Resgate cancelado', expiracao: 'Pontos expirados', ajuste: 'Ajuste',
};
const curto = (d: Date) => dia.format(d).replace('.', '');

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

/** a linha de detalhe: valor e dia da compra (quando há) e se os pontos ainda estão em liberação */
function detalhe(m: MovimentoClube): string {
  const partes: string[] = [];
  if (m.compra) partes.push(`${real.format(Number(m.compra.valor))} · compra de ${diaMes.format(new Date(`${m.compra.data}T00:00:00Z`))}`);
  if (m.situacao === 'pendente') partes.push(m.liberarEm ? `em liberação até ${curto(new Date(m.liberarEm))}` : 'em liberação');
  return partes.join(' · ');
}

/** movimentos na ordem do backend (do mais novo), agrupados por mês */
export function ListaMovimentos({ estado, itens = [], erro, aoTentar, aoVerMais, carregandoMais, erroMais }: {
  estado: EstadoLista; itens?: MovimentoClube[]; erro?: string; aoTentar?: () => void;
  /** há outra página (`proximo` do backend) */
  aoVerMais?: () => void; carregandoMais?: boolean; erroMais?: string;
}) {
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
  const grupos = new Map<string, MovimentoClube[]>();
  for (const m of itens) {
    const g = mesAno.format(new Date(m.em));
    grupos.set(g, [...(grupos.get(g) ?? []), m]);
  }
  return (
    <div class="historico">
      {[...grupos].map(([mes, ms]) => (
        <section class="historico__mes" aria-label={mes}>
          <h2 class="historico__titulo">{mes}</h2>
          <ul class="extrato">
            {ms.map((m) => {
              const d = detalhe(m);
              return (
                <li data-tipo={m.tipo} data-situacao={m.situacao ?? undefined}>
                  <time dateTime={m.em}>{curto(new Date(m.em))}</time>
                  <span class="extrato__desc">
                    {TITULO[m.tipo]}
                    {d && <small>{d}</small>}
                  </span>
                  <span class="extrato__pts" data-sinal={m.pontos < 0 ? 'neg' : 'pos'}>{pts.format(m.pontos)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {erroMais && <p class="ticket__status" data-tone="error" role="alert">{erroMais}</p>}
      {aoVerMais && (
        <button class="ticket__link historico__mais" type="button" disabled={carregandoMais} onClick={aoVerMais}>
          {carregandoMais ? 'Carregando…' : 'Ver movimentações anteriores'}
        </button>
      )}
    </div>
  );
}
