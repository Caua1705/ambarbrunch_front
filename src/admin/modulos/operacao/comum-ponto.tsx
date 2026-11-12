// Peças comuns do Ponto no Modo Operação: relógio pela hora do SERVIDOR (nunca a do tablet) e o procedimento de
// contingência, mostrado sempre que o ponto não pôde ser registrado pelo tablet.
import { useEffect, useState } from 'preact/hooks';
import { ClipboardPen } from 'lucide-preact';

const FUSO = 'America/Fortaleza';
const horaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const dataFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' });

/** Agora pela hora do servidor (deslocamento medido uma vez, na leitura da configuração). */
export function useRelogioDoServidor(horarioServidor: string | null | undefined): number | null {
  const [deslocamento] = useState(() => (horarioServidor ? new Date(horarioServidor).getTime() - Date.now() : null));
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return deslocamento === null ? null : agora + deslocamento;
}

export function Relogio({ agora }: { agora: number | null }) {
  const dia = agora ? dataFmt.format(agora) : '';
  return (
    <div class="op-terminal__relogio" role="timer" aria-live="off">
      <time class="num">{agora ? horaFmt.format(agora) : '--:--'}</time>
      <span>{dia.charAt(0).toUpperCase() + dia.slice(1)}</span>
    </div>
  );
}

/** O que fazer quando o tablet não registrou: o gestor regulariza no painel, com horário, motivo e auditoria. */
export function Contingencia({ compacta }: { compacta?: boolean }) {
  return (
    <div class={`op-contingencia${compacta ? ' op-contingencia--compacta' : ''}`}>
      <ClipboardPen aria-hidden="true" />
      <div>
        <strong>Se o tablet não registrar</strong>
        <p>Anote o horário em que você chegou e avise o gestor. Ele regulariza pelo painel (Equipe → ficha da pessoa → dia →
          Incluir batida), com o horário e o motivo, e fica tudo auditado. Falha do tablet aparece como “sem marcação”, nunca como
          falta confirmada.</p>
      </div>
    </div>
  );
}
