// Calendário do mês (o "Calendário" do painel anterior): cada dia com quantas reservas ativas e pessoas; tocar no dia mostra
// a lista dele ao lado (embaixo, no celular). Canceladas não contam no dia, mas aparecem apagadas no fim da lista.
import { CalendarDays, ArrowRight } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { hojeISO, inicioMes, fimMes, mesAno, dataLonga, hora, plural, somarDias } from '../../lib/formato';
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

export function Mes({ mes, dia, aoEscolherDia, aoAbrirDia, aoAbrir }: { mes: string; dia: string | null; aoEscolherDia: (d: string | null) => void; aoAbrirDia: (d: string) => void; aoAbrir: (id: string) => void }) {
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
      <div class="cal-mes">
        <Cartao class="cal-mes__calendario">
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
                  <div aria-hidden="true" class="cal-mes__semana">
                    {SEMANA.map((s) => <span key={s}>{s}</span>)}
                  </div>
                  <div class="cal-mes__grade">
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
                          class={['cal-mes__dia', e && 'cal-mes__dia--com', d === hoje && 'cal-mes__dia--hoje', d < hoje && 'cal-mes__dia--passado'].filter(Boolean).join(' ')}
                        >
                          <span class="cal-mes__num num">{Number(d.slice(8, 10))}</span>
                          {e && (
                            <span class="cal-mes__marca num">
                              <strong>{e.reservas}</strong> <span>{e.reservas === 1 ? 'reserva' : 'reservas'}</span>
                              <span class="cal-mes__pessoas">{e.pessoas} pessoas</span>
                            </span>
                          )}
                          {e?.pendentes ? <span class="cal-mes__pendente" title={plural(e.pendentes, 'aguardando aprovação', 'aguardando aprovação')}>{e.pendentes} pend.</span> : null}
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
