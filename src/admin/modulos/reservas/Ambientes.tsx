// Visão por ambiente (como no painel anterior): um cartão por ambiente com as reservas do período, pessoas esperadas e a
// próxima. Mostra também os ambientes sem reserva (livres) e destaca o mais pedido. Canceladas não entram.
import { MapPin, Users, Clock3, TrendingUp } from 'lucide-preact';
import { dataCurta, hora, plural, hojeISO, inteiro } from '../../lib/formato';
import type { AmbienteOperacao, ReservaPainel } from '../../lib/tipos/reservas';
import { Segmentado, Situacao, Etiqueta, Aviso } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { statusBase, statusDe, emAberto, comecou } from './comum';
import { PERIODOS, NO_PERIODO, useReservasDoPeriodo, ordenar, type Periodo } from './periodo';

interface Grupo {
  id: string;
  nome: string;
  capacidade: number | null;
  ativo: boolean;
  reservas: ReservaPainel[];
  pessoas: number;
}

export function Ambientes({ periodo, aoMudarPeriodo, ambientes, aoAbrir }: { periodo: Periodo; aoMudarPeriodo: (p: Periodo) => void; ambientes: AmbienteOperacao[]; aoAbrir: (id: string) => void }) {
  const consulta = useReservasDoPeriodo(periodo);
  return (
    <section class="pilha" aria-label="Reservas por ambiente">
      <div class="filtros">
        <Segmentado rotulo="Período dos ambientes" valor={periodo} aoMudar={aoMudarPeriodo} opcoes={PERIODOS} />
        {consulta.atualizando && <span class="fraco">Atualizando…</span>}
      </div>
      <Dados consulta={consulta} recurso="As reservas por ambiente" esqueleto={<Esqueleto linhas={4} altura={120} />}>
        {({ itens, total }) => {
          const grupos = agrupar(ambientes, itens.filter((r) => statusBase(r) !== 'cancelada'));
          const maisPedido = grupos[0]?.reservas.length ? grupos[0] : null;
          if (!grupos.length) return <Vazio icone={<MapPin aria-hidden="true" />} titulo="Nenhum ambiente disponível">Os ambientes são cadastrados em Configurações.</Vazio>;
          return (
            <>
              {total > itens.length && <Aviso tom="atencao">Contando {plural(itens.length, 'reserva', 'reservas')} de {total}. Escolha um período menor para ver todas.</Aviso>}
              {maisPedido && (
                <p class="suave linha" style={{ gap: '6px' }}>
                  <TrendingUp size={16} aria-hidden="true" /> Ambiente mais pedido {NO_PERIODO[periodo]}: <strong>{maisPedido.nome}</strong> ({plural(maisPedido.reservas.length, 'reserva', 'reservas')})
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {grupos.map((g) => <CartaoAmbiente key={g.id} g={g} periodo={periodo} aoAbrir={aoAbrir} />)}
              </div>
            </>
          );
        }}
      </Dados>
    </section>
  );
}

function agrupar(ambientes: AmbienteOperacao[], reservas: ReservaPainel[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  // Todos os ambientes conhecidos, para os vazios também aparecerem.
  for (const a of ambientes) mapa.set(a.id, { id: a.id, nome: a.nome, capacidade: a.capacidade_max, ativo: a.ativo, reservas: [], pessoas: 0 });
  for (const r of reservas) {
    let g = mapa.get(r.ambiente_id);
    if (!g) mapa.set(r.ambiente_id, (g = { id: r.ambiente_id, nome: r.ambiente, capacidade: null, ativo: true, reservas: [], pessoas: 0 }));
    g.reservas.push(r);
    g.pessoas += r.pessoas;
  }
  return [...mapa.values()]
    .filter((g) => g.ativo || g.reservas.length)
    .sort((a, b) => b.reservas.length - a.reservas.length || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function CartaoAmbiente({ g, periodo, aoAbrir }: { g: Grupo; periodo: Periodo; aoAbrir: (id: string) => void }) {
  const lista = ordenar(g.reservas);
  const proxima = lista.find((r) => emAberto(r) && !comecou(r));
  const visiveis = lista.slice(0, 5);
  const resto = lista.length - visiveis.length;
  const hoje = hojeISO();
  const ocupado = lista.length > 0;
  return (
    <section class="cartao" style={{ display: 'flex', flexDirection: 'column' }} aria-label={`${g.nome}: ${plural(lista.length, 'reserva', 'reservas')} ${NO_PERIODO[periodo]}`}>
      <div class="cartao__topo">
        <div>
          <h2>{g.nome}</h2>
          <p>{plural(lista.length, 'reserva', 'reservas')} {NO_PERIODO[periodo]}{g.capacidade ? ` · até ${g.capacidade} pessoas` : ''}</p>
        </div>
        <div class="empurra"><Situacao tom={ocupado ? 'marca' : 'apagado'}>{ocupado ? 'Com reservas' : 'Livre'}</Situacao></div>
      </div>
      <div class="cartao__corpo pilha pilha--p">
        <dl class="definicoes">
          <dt><Users size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Pessoas</dt>
          <dd class="num">{inteiro(g.pessoas)}</dd>
          <dt><Clock3 size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Próxima</dt>
          <dd class="num">{proxima ? `${proxima.data === hoje ? '' : `${dataCurta(proxima.data)} · `}${hora(proxima.hora)}` : '—'}</dd>
        </dl>
        {lista.length ? (
          <ul class="lista" style={{ fontSize: '13px', margin: '0 -20px' }}>
            {visiveis.map((r) => (
              <li key={r.id}>
                <button class="lista__item" style={{ minHeight: '40px', padding: '6px 20px', gap: '8px' }} onClick={() => aoAbrir(r.id)} aria-label={`${r.contato_nome}, ${dataCurta(r.data)} às ${hora(r.hora)}, ${plural(r.pessoas, 'pessoa', 'pessoas')}`}>
                  <span class="num forte" style={{ width: periodo === 'hoje' || periodo === 'amanha' ? '40px' : '92px', flex: 'none' }}>{periodo === 'hoje' || periodo === 'amanha' ? hora(r.hora) : `${dataCurta(r.data)} ${hora(r.hora)}`}</span>
                  <span class="lista__texto"><span style={{ color: 'var(--texto)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.contato_nome} · {r.pessoas}</span></span>
                  {statusDe(r) === 'pendente' && <Etiqueta tom="atencao">pendente</Etiqueta>}
                </button>
              </li>
            ))}
            {resto > 0 && <li class="fraco" style={{ padding: '8px 20px' }}>+ {plural(resto, 'reserva', 'reservas')}</li>}
          </ul>
        ) : (
          <p class="fraco">Sem reservas neste período.</p>
        )}
      </div>
    </section>
  );
}
