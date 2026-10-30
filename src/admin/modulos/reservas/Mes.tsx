// Calendário do mês (o "Calendário" do painel anterior): cada dia com quantas reservas ativas e pessoas; tocar no dia mostra
// a lista dele ao lado (embaixo, no celular). Canceladas não contam no dia, mas aparecem apagadas no fim da lista.
import { ChevronLeft, ChevronRight, CalendarDays, ArrowRight } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { hojeISO, inicioMes, fimMes, somarMeses, mesAno, dataLonga, hora, plural, somarDias } from '../../lib/formato';
import { Botao, Cartao, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { SituacaoReserva, statusBase, statusDe } from './comum';
import { ordenar } from './periodo';

const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

/** 0 = segunda … 6 = domingo. */
function diaDaSemana(d: string) {
  const [a, m, dia] = d.split('-').map(Number);
  return (new Date(Date.UTC(a, m - 1, dia, 12)).getUTCDay() + 6) % 7;
}

export function Mes({ mes, aoMudarMes, dia, aoEscolherDia, aoAbrirDia, aoAbrir }: { mes: string; aoMudarMes: (m: string) => void; dia: string | null; aoEscolherDia: (d: string | null) => void; aoAbrirDia: (d: string) => void; aoAbrir: (id: string) => void }) {
  const de = inicioMes(mes);
  const ate = fimMes(mes);
  const consulta = useConsulta(`reservas?mes:${de}`, () => reservas.listarTodas({ data_de: de, data_ate: ate }), { intervalo: 60_000 });
  const hoje = hojeISO();
  const nDias = Number(ate.slice(8, 10));
  const brancos = diaDaSemana(de);
  const dias = Array.from({ length: nDias }, (_, i) => somarDias(de, i));
  const doDia = dia && dia >= de && dia <= ate ? ordenar((consulta.dados?.itens ?? []).filter((r) => r.data === dia)) : [];
  const ativasDoDia = doDia.filter((r) => statusBase(r) !== 'cancelada');

  return (
    <div class="pilha">
      <div class="linha" style={{ gap: '8px' }}>
        <Botao so_icone aria-label="Mês anterior" icone={<ChevronLeft aria-hidden="true" />} onClick={() => aoMudarMes(somarMeses(de, -1))} />
        <strong style={{ minWidth: '150px', textAlign: 'center' }} aria-live="polite">{mesAno(de)}</strong>
        <Botao so_icone aria-label="Próximo mês" icone={<ChevronRight aria-hidden="true" />} onClick={() => aoMudarMes(somarMeses(de, 1))} />
        <Botao onClick={() => { aoMudarMes(inicioMes(hoje)); aoEscolherDia(hoje); }} disabled={inicioMes(hoje) === de && dia === hoje}>Hoje</Botao>
        {consulta.atualizando && <span class="fraco">Atualizando…</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
        <Cartao>
          <Dados consulta={consulta} recurso="O calendário" esqueleto={<Esqueleto linhas={6} altura={44} />}>
            {({ itens }) => {
              const porDia = new Map<string, { reservas: number; pessoas: number; pendentes: number }>();
              for (const r of itens) {
                if (statusBase(r) === 'cancelada') continue;
                const e = porDia.get(r.data) ?? { reservas: 0, pessoas: 0, pendentes: 0 };
                e.reservas++;
                e.pessoas += r.pessoas;
                if (statusDe(r) === 'pendente') e.pendentes++;
                porDia.set(r.data, e);
              }
              return (
                <div role="group" aria-label={`Reservas de ${mesAno(de)}`}>
                  <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                    {SEMANA.map((s) => <span key={s} class="fraco pequeno" style={{ textAlign: 'center', textTransform: 'uppercase' }}>{s}</span>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {Array.from({ length: brancos }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
                    {dias.map((d) => {
                      const e = porDia.get(d);
                      const escolhido = d === dia;
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={escolhido}
                          aria-label={`${dataLonga(d)}${e ? `, ${plural(e.reservas, 'reserva', 'reservas')}, ${plural(e.pessoas, 'pessoa', 'pessoas')}` : ', sem reservas'}`}
                          onClick={() => aoEscolherDia(escolhido ? null : d)}
                          style={{
                            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: '58px', padding: '6px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '2px',
                            border: `1px solid ${escolhido ? 'var(--marca)' : d === hoje ? 'var(--borda-forte, var(--borda))' : 'var(--borda)'}`,
                            background: escolhido ? 'var(--marca-suave)' : e ? 'var(--superficie)' : 'var(--afundado)',
                          }}
                        >
                          <span class="num" style={{ fontWeight: d === hoje ? 700 : 500, color: d === hoje ? 'var(--marca)' : undefined }}>{Number(d.slice(8, 10))}</span>
                          {e && <span class="pequeno num" style={{ color: 'var(--texto)' }}>{e.reservas} <span class="fraco">· {e.pessoas}p</span></span>}
                          {e?.pendentes ? <span class="pequeno" style={{ color: 'var(--atencao)' }}>{e.pendentes} pend.</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }}
          </Dados>
        </Cartao>

        <Cartao
          titulo={dia ? dataLonga(dia) : 'Detalhes do dia'}
          descricao={dia ? plural(ativasDoDia.length, 'reserva ativa', 'reservas ativas') : undefined}
          acoes={dia ? <Botao tamanho="p" variante="fantasma" icone={<ArrowRight aria-hidden="true" />} onClick={() => aoAbrirDia(dia)}>Abrir o dia</Botao> : undefined}
          justo
        >
          {!dia ? (
            <Vazio compacto icone={<CalendarDays aria-hidden="true" />} titulo="Escolha um dia no calendário">As reservas do dia aparecem aqui.</Vazio>
          ) : !doDia.length ? (
            <Vazio compacto icone={<CalendarDays aria-hidden="true" />} titulo="Nenhuma reserva neste dia" />
          ) : (
            <ul class="lista">
              {doDia.map((r) => (
                <li key={r.id}>
                  <button class="lista__item" style={{ gap: '10px', opacity: statusBase(r) === 'cancelada' ? 0.6 : undefined }} onClick={() => aoAbrir(r.id)}>
                    <span class="num forte" style={{ width: '44px', flex: 'none' }}>{hora(r.hora)}</span>
                    <span class="lista__texto">
                      <strong style={{ fontWeight: 600 }}>{r.contato_nome}</strong>
                      <span>{r.ambiente} · {plural(r.pessoas, 'pessoa', 'pessoas')}</span>
                    </span>
                    {statusDe(r) === 'pendente' ? <Etiqueta tom="atencao">pendente</Etiqueta> : <SituacaoReserva r={r} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}
