// Aprovações pendentes de hoje em diante, numa lista curta com Aprovar/Recusar ao lado de cada uma.
import { Check, X, CalendarCheck } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { hojeISO, dataCurta, hora, plural } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao } from '../../ui/base';
import { Dados, Vazio } from '../../ui/estados';
import type { ReservaPainel } from '../../lib/tipos/reservas';

export function Pendentes({ aberta, aoFechar, aoAprovar, aoRecusar, aoAbrir }: { aberta: boolean; aoFechar: () => void; aoAprovar: (r: ReservaPainel) => void; aoRecusar: (r: ReservaPainel) => void; aoAbrir: (id: string) => void }) {
  const hoje = hojeISO();
  const consulta = useConsulta(aberta ? `reservas?pendentes:${hoje}` : null, () => reservas.listar({ data_de: hoje, status: ['pendente'], limite: 100 }));
  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Aguardando aprovação" subtitulo={consulta.dados ? plural(consulta.dados.total, 'reserva', 'reservas') : undefined}>
      <Dados consulta={consulta} recurso="A lista de pendentes">
        {({ itens }) =>
          itens.length ? (
            <ul class="lista" style={{ margin: '-8px -20px' }}>
              {[...itens].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).map((r) => (
                <li key={r.id} style={{ padding: '12px 20px' }}>
                  <div class="linha linha--entre" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <button class="btn--fantasma" style={{ all: 'unset', cursor: 'pointer', minWidth: 0 }} onClick={() => aoAbrir(r.id)}>
                      <strong style={{ fontWeight: 600 }}>{r.contato_nome}</strong>
                      <span class="sub fraco" style={{ display: 'block' }}>
                        {dataCurta(r.data, { semana: true })} às {hora(r.hora)} · {plural(r.pessoas, 'pessoa', 'pessoas')} · {r.ambiente}
                      </span>
                      {r.observacoes && <span class="fraco" style={{ display: 'block' }}>{r.observacoes}</span>}
                    </button>
                    <div class="linha" style={{ flexWrap: 'nowrap' }}>
                      <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Recusar a reserva de ${r.contato_nome}`} icone={<X aria-hidden="true" />} onClick={() => aoRecusar(r)} />
                      <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} onClick={() => aoAprovar(r)} aria-label={`Aprovar a reserva de ${r.contato_nome}`}>Aprovar</Botao>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio icone={<CalendarCheck aria-hidden="true" />} titulo="Nenhuma reserva aguardando">Tudo aprovado por enquanto.</Vazio>
          )
        }
      </Dados>
    </Gaveta>
  );
}
