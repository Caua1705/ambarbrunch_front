// Visão da semana: sete dias lado a lado (empilhados no celular) com as reservas de cada um. Clicar no dia abre a lista.
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { somarDias, dataCurta, hora, hojeISO, plural } from '../../lib/formato';
import { Dados, Esqueleto } from '../../ui/estados';
import { statusDe, SituacaoReserva } from './comum';

/** Segunda-feira da semana de `d`. */
function segunda(d: string) {
  const [a, m, dia] = d.split('-').map(Number);
  const sem = new Date(Date.UTC(a, m - 1, dia, 12)).getUTCDay();
  return somarDias(d, -((sem + 6) % 7));
}

export function Semana({ inicio, aoEscolherDia, aoAbrir }: { inicio: string; aoEscolherDia: (d: string) => void; aoAbrir: (id: string) => void }) {
  const de = segunda(inicio);
  const ate = somarDias(de, 6);
  const consulta = useConsulta(`reservas?semana:${de}`, () => reservas.listar({ data_de: de, data_ate: ate, limite: 200 }));
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(de, i));
  const hoje = hojeISO();
  return (
    <Dados consulta={consulta} recurso="A semana" esqueleto={<Esqueleto linhas={6} altura={40} />}>
      {({ itens }) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          {dias.map((d) => {
            const doDia = itens.filter((r) => r.data === d && statusDe(r) !== 'cancelada').sort((a, b) => a.hora.localeCompare(b.hora));
            const pend = doDia.filter((r) => statusDe(r) === 'pendente').length;
            return (
              <section key={d} class="cartao" style={{ display: 'flex', flexDirection: 'column', minHeight: '180px', borderColor: d === hoje ? 'var(--marca)' : undefined }} aria-label={dataCurta(d, { semana: true })}>
                <button onClick={() => aoEscolherDia(d)} style={{ all: 'unset', cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid var(--borda)', display: 'block' }}>
                  <strong style={{ textTransform: 'capitalize', fontWeight: 600 }}>{dataCurta(d, { semana: true })}</strong>
                  <span class="fraco" style={{ display: 'block' }}>
                    {plural(doDia.length, 'reserva', 'reservas')} · {plural(doDia.reduce((s, r) => s + r.pessoas, 0), 'pessoa', 'pessoas')}
                  </span>
                  {pend > 0 && <span class="situacao situacao--atencao situacao--destaque" style={{ marginTop: '4px' }}>{plural(pend, 'pendente', 'pendentes')}</span>}
                </button>
                <ul class="lista" style={{ fontSize: '13px' }}>
                  {doDia.slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <button class="lista__item" style={{ minHeight: '40px', padding: '6px 14px', gap: '8px' }} onClick={() => aoAbrir(r.id)} aria-label={`${r.contato_nome}, ${hora(r.hora)}, ${r.pessoas} pessoas`}>
                        <span class="num forte" style={{ width: '40px' }}>{hora(r.hora)}</span>
                        <span class="lista__texto"><span style={{ color: 'var(--texto)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.contato_nome.split(' ')[0]} · {r.pessoas}</span></span>
                        {statusDe(r) === 'pendente' && <SituacaoReserva r={r} />}
                      </button>
                    </li>
                  ))}
                  {doDia.length > 6 && (
                    <li>
                      <button class="lista__item fraco" style={{ minHeight: '36px', padding: '6px 14px' }} onClick={() => aoEscolherDia(d)}>+ {doDia.length - 6} no dia</button>
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Dados>
  );
}
