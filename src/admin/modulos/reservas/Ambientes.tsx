// Reservas por ambiente, no período escolhido na barra da agenda (Dia, Semana ou Mês). Um cartão por ambiente, na ordem do
// backend, com a capacidade oficial (`capacidade_max` de GET /admin/reservas/ambientes; nada de lista paralela aqui). Livres
// também aparecem. Canceladas não entram.
// No Dia, a ocupação vem de GET /admin/reservas/lotacao: é o pico que o próprio backend calcula, com a duração das reservas.
// Em Semana e Mês não há esse número por período, então o cartão mostra reservas, pessoas e dias com reserva, sem estimar.
import { useState } from 'preact/hooks';
import { MapPin, Users, Clock3, TrendingUp, CalendarDays } from 'lucide-preact';
import { useConsulta, type Consulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { dataCurta, hora, plural, hojeISO } from '../../lib/formato';
import type { AmbienteOperacao, ReservaPainel } from '../../lib/tipos/reservas';
import { Situacao, Etiqueta, Aviso } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { statusBase, statusDe, emAberto, comecou } from './comum';
import { ordenar } from './periodo';

type Periodo = 'dia' | 'semana' | 'mes';

const NESTE: Record<Periodo, string> = { dia: 'neste dia', semana: 'nesta semana', mes: 'neste mês' };
/** Linhas por cartão antes de "Ver todas" na Semana e no Mês; no Dia, todas. */
const LINHAS = 6;

interface Grupo {
  id: string;
  nome: string;
  capacidade: number | null;
  ativo: boolean;
  reservas: ReservaPainel[];
  pessoas: number;
}

export function Ambientes({ periodo, de, ate, ambientes, aoAbrir, aoAbrirDia }: { periodo: Periodo; de: string; ate: string; ambientes: Consulta<AmbienteOperacao[]>; aoAbrir: (id: string) => void; aoAbrirDia: (d: string) => void }) {
  const consulta = useConsulta(`reservas?ambientes:${de}:${ate}`, () => reservas.listarTodas({ data_de: de, data_ate: ate }), { intervalo: 60_000 });
  return (
    <section class="pilha" aria-label="Reservas por ambiente">
      <Dados consulta={ambientes} recurso="Os ambientes" esqueleto={<Esqueleto linhas={4} altura={120} />}>
        {(cadastro) => (
          <Dados consulta={consulta} recurso="As reservas por ambiente" esqueleto={<Esqueleto linhas={4} altura={120} />}>
            {({ itens, total }) => {
              const grupos = agrupar(cadastro, itens.filter((r) => statusBase(r) !== 'cancelada'));
              if (!grupos.length) return <Vazio icone={<MapPin aria-hidden="true" />} titulo="Nenhum ambiente disponível">Os ambientes são cadastrados em Configurações.</Vazio>;
              const maisPedido = grupos.reduce<Grupo | null>((m, g) => (g.reservas.length > (m?.reservas.length ?? 0) ? g : m), null);
              return (
                <>
                  {total > itens.length && <Aviso tom="atencao">Contando {plural(itens.length, 'reserva', 'reservas')} de {total}. Escolha um período menor para ver todas.</Aviso>}
                  <p class="suave linha" style={{ gap: '6px' }}>
                    {maisPedido ? <><TrendingUp size={16} aria-hidden="true" /> Ambiente mais pedido {NESTE[periodo]}: <strong>{maisPedido.nome}</strong> ({plural(maisPedido.reservas.length, 'reserva', 'reservas')})</> : <>Nenhuma reserva {NESTE[periodo]}.</>}
                  </p>
                  <div class="grade-ambientes">
                    {grupos.map((g) => <CartaoAmbiente key={g.id} g={g} periodo={periodo} de={de} aoAbrir={aoAbrir} aoAbrirDia={aoAbrirDia} />)}
                  </div>
                </>
              );
            }}
          </Dados>
        )}
      </Dados>
    </section>
  );
}

function agrupar(ambientes: AmbienteOperacao[], lista: ReservaPainel[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  // Todos os ambientes conhecidos, para os vazios também aparecerem.
  for (const a of ambientes) mapa.set(a.id, { id: a.id, nome: a.nome, capacidade: a.capacidade_max, ativo: a.ativo, reservas: [], pessoas: 0 });
  for (const r of lista) {
    let g = mapa.get(r.ambiente_id);
    if (!g) mapa.set(r.ambiente_id, (g = { id: r.ambiente_id, nome: r.ambiente, capacidade: null, ativo: true, reservas: [], pessoas: 0 }));
    g.reservas.push(r);
    g.pessoas += r.pessoas;
  }
  return [...mapa.values()].filter((g) => g.ativo || g.reservas.length);
}

function CartaoAmbiente({ g, periodo, de, aoAbrir, aoAbrirDia }: { g: Grupo; periodo: Periodo; de: string; aoAbrir: (id: string) => void; aoAbrirDia: (d: string) => void }) {
  const [todas, setTodas] = useState(false);
  const lista = ordenar(g.reservas);
  const proxima = lista.find((r) => emAberto(r) && !comecou(r));
  const noDia = periodo === 'dia';
  const visiveis = noDia || todas ? lista : lista.slice(0, LINHAS);
  const resto = lista.length - visiveis.length;
  const hoje = hojeISO();
  const diasComReserva = new Set(lista.map((r) => r.data)).size;
  // Semana e Mês: as reservas agrupadas por dia, com o dia levando à agenda dele.
  const dias = [...new Set(visiveis.map((r) => r.data))];
  return (
    <section class="cartao cartao-ambiente" aria-label={`${g.nome}: ${plural(lista.length, 'reserva', 'reservas')} ${NESTE[periodo]}`}>
      <div class="cartao__topo">
        <div>
          <h2>{g.nome}</h2>
          <p>{g.capacidade ? `Até ${g.capacidade} pessoas · ` : ''}{plural(lista.length, 'reserva', 'reservas')} {NESTE[periodo]}</p>
        </div>
        <div class="empurra"><Situacao tom={lista.length ? 'marca' : 'apagado'}>{lista.length ? 'Com reservas' : 'Livre'}</Situacao></div>
      </div>
      <div class="cartao__corpo pilha pilha--p">
        {noDia && <OcupacaoDia ambiente={g.id} data={de} capacidade={g.capacidade} />}
        <p class="ambiente-resumo">
          <span><Users size={14} aria-hidden="true" /> <span class="num">{plural(g.pessoas, 'pessoa', 'pessoas')}</span></span>
          <span><Clock3 size={14} aria-hidden="true" /> Próxima: <span class="num">{proxima ? `${proxima.data === hoje ? '' : `${dataCurta(proxima.data)} · `}${hora(proxima.hora)}` : '—'}</span></span>
          {!noDia && <span><CalendarDays size={14} aria-hidden="true" /> <span class="num">{plural(diasComReserva, 'dia com reserva', 'dias com reserva')}</span></span>}
        </p>
        {lista.length ? (
          <div class="ambiente-reservas">
            {dias.map((d) => (
              <div key={d}>
                {!noDia && <button type="button" class="ambiente-reservas__dia" onClick={() => aoAbrirDia(d)} aria-label={`Abrir o dia ${dataCurta(d, { semana: true })}`}>{dataCurta(d, { semana: true })}</button>}
                <ul class="lista">
                  {visiveis.filter((r) => r.data === d).map((r) => (
                    <li key={r.id}>
                      <button type="button" class="lista__item ambiente-reservas__item" onClick={() => aoAbrir(r.id)} aria-label={`${r.contato_nome}, ${dataCurta(r.data)} às ${hora(r.hora)}, ${plural(r.pessoas, 'pessoa', 'pessoas')}`}>
                        <span class="num forte">{hora(r.hora)}</span>
                        <span class="ambiente-reservas__nome">{r.contato_nome}</span>
                        <span class="fraco num">{plural(r.pessoas, 'pessoa', 'pessoas')}</span>
                        {statusDe(r) === 'pendente' && <Etiqueta tom="atencao">pendente</Etiqueta>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {resto > 0 && <button type="button" class="link" onClick={() => setTodas(true)}>Ver todas ({lista.length})</button>}
          </div>
        ) : (
          <p class="fraco">Sem reservas {NESTE[periodo]}.</p>
        )}
      </div>
    </section>
  );
}

/** Pico de lugares ocupados no dia, como o backend calcula para a equipe (a reserva ocupa o lugar durante toda a duração). */
function OcupacaoDia({ ambiente, data, capacidade }: { ambiente: string; data: string; capacidade: number | null }) {
  const lotacao = useConsulta(`reservas/lotacao:${ambiente}:${data}:1`, () => reservas.lotacao(ambiente, data, 1));
  if (lotacao.carregando) return <span class="esqueleto" style={{ height: '34px', width: '100%' }} />;
  if (!lotacao.dados) {
    return <p class="fraco">Ocupação indisponível. <button type="button" class="link" onClick={lotacao.recarregar}>Tentar de novo</button></p>;
  }
  const { horarios, capacidade_max } = lotacao.dados;
  if (!horarios.length) return <p class="fraco">Sem horários de reserva nesta data.</p>;
  const pico = horarios.reduce((m, h) => (h.ocupadas > m.ocupadas ? h : m), horarios[0]);
  const total = capacidade ?? capacidade_max;
  const pct = total ? Math.min(100, Math.round((pico.ocupadas / total) * 100)) : 0;
  return (
    <div class="ocupacao-dia">
      <span>{pico.ocupadas ? <>Pico de <strong class="num">{pico.ocupadas} de {total}</strong> lugares às <span class="num">{hora(pico.hora)}</span></> : <>Nenhum lugar ocupado ({total} lugares)</>}</span>
      <div class="ocupacao-dia__barra" role="img" aria-label={`${pct}% da capacidade no horário mais cheio`}><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
