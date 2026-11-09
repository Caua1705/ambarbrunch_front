/** @jsxImportSource preact */
import { useRef, useState } from 'preact/hooks';
import { dataPermitida, ehSegunda, iso, PRIMEIRA_DATA } from '../../lib/reservas/datas';

const mesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/**
 * Calendário mensal da comanda (rodada final: substitui a fileira de 10 dias). Dias fora da janela [hoje, hoje + diasMax]
 * (a mesma da API: hoje + 60 dias inclusive), antes de PRIMEIRA_DATA e dias fechados do ambiente (`fechadas`, vindos da
 * API) ficam riscados; abre no mês da primeira data possível; setas trocam o mês; no teclado, ←/→ andam um dia e ↑/↓
 * uma semana (radiogroup, um dia focável). Segunda-feira (o café fecha) nunca é escolhida: o dia fica riscado, as setas
 * pulam por cima dele e o toque só avisa (aoRecusar).
 */
export function Calendario(p: { id: string; hoje: Date; diasMax: number; fechadas?: ReadonlySet<string>; valor: string | null; aoEscolher: (v: string) => void; aoConfirmar?: () => void; aoRecusar?: () => void }) {
  const hoje = new Date(p.hoje.getFullYear(), p.hoje.getMonth(), p.hoje.getDate());
  const primeira = new Date(`${PRIMEIRA_DATA}T00:00:00`);
  const inicio = primeira > hoje ? primeira : hoje;
  const fim = new Date(hoje); fim.setDate(hoje.getDate() + p.diasMax);
  const [mes, setMes] = useState(() => { const v = p.valor ? new Date(`${p.valor}T12:00:00`) : inicio; return new Date(v.getFullYear(), v.getMonth(), 1); });
  const grade = useRef<HTMLDivElement>(null);
  const primeiroMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const ultimoMes = new Date(fim.getFullYear(), fim.getMonth(), 1);
  const valido = (d: Date) => dataPermitida(iso(d), hoje, p.diasMax, p.fechadas);
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1));
  const selecionado = p.valor && dias.some((d) => iso(d) === p.valor) ? p.valor : null;
  const focavel = selecionado ?? iso(dias.find(valido) ?? dias[0]);
  const mudarMes = (passo: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + passo, 1));
  const aoTeclar = (ev: KeyboardEvent) => {
    const passo = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 } as Record<string, number>)[ev.key];
    if (!passo) return;
    ev.preventDefault();
    const atual = new Date(`${(ev.target as HTMLElement).dataset.valor ?? focavel}T12:00:00`);
    let prox = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate() + passo);
    // ←/→ pulam a segunda (domingo → terça); ↑/↓ andam na mesma coluna e nunca caem nela.
    if (ehSegunda(iso(prox)) && Math.abs(passo) === 1) prox = new Date(prox.getFullYear(), prox.getMonth(), prox.getDate() + passo);
    if (!valido(prox)) return;
    p.aoEscolher(iso(prox));
    if (prox.getMonth() !== mes.getMonth()) setMes(new Date(prox.getFullYear(), prox.getMonth(), 1));
    requestAnimationFrame(() => grade.current?.querySelector<HTMLElement>(`[data-valor="${iso(prox)}"]`)?.focus());
  };
  return (
    <div class="cal">
      <div class="cal__head">
        <button type="button" class="cal__nav" aria-label="Mês anterior" disabled={mes <= primeiroMes} onClick={() => mudarMes(-1)}><span aria-hidden="true">‹</span></button>
        <p class="cal__mes" aria-live="polite">{mesAno.format(mes)}</p>
        <button type="button" class="cal__nav" aria-label="Próximo mês" disabled={mes >= ultimoMes} onClick={() => mudarMes(1)}><span aria-hidden="true">›</span></button>
      </div>
      <div class="cal__semana" aria-hidden="true">{SEMANA.map((d) => <span>{d}</span>)}</div>
      <div class="cal__grade" role="radiogroup" aria-labelledby={p.id} ref={grade} onKeyDown={aoTeclar}>
        {Array.from({ length: mes.getDay() }, () => <span class="cal__vazio" aria-hidden="true" />)}
        {dias.map((d) => {
          const v = iso(d);
          const ok = valido(d);
          // Segunda: não é "disabled" (o toque precisa chegar para avisar por quê), mas não escolhe nunca.
          const segunda = ehSegunda(v);
          return (
            <button type="button" role="radio" class="cal__dia" data-valor={v} aria-checked={v === p.valor && ok} tabIndex={v === focavel && ok ? 0 : -1}
              disabled={!ok && !segunda} aria-disabled={segunda ? 'true' : undefined} data-fechado={segunda ? '' : undefined} data-hoje={v === iso(hoje) ? '' : undefined}
              aria-label={`${v === iso(hoje) ? 'hoje, ' : ''}${SEMANA_LONGA[d.getDay()]}, ${d.getDate()}${segunda ? ', fechado' : ''}`}
              onClick={() => { if (segunda) { p.aoRecusar?.(); return; } if (!ok) return; p.aoEscolher(v); p.aoConfirmar?.(); }}>{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}
