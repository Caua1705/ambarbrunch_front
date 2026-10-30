// Medição de audiência (GA4) no NAVEGADOR: eventos de conversão sem nenhum dado pessoal. Se a medição não estiver
// ligada nesta página (sem ID, política sem a seção aprovada, pessoa que recusou, Global Privacy Control), `gtag` não
// existe e tudo aqui é nada. Nunca lança erro: medir não pode atrapalhar a reserva.
// Quando a medição liga e o que nunca vai ao Google: src/components/Medicao.astro e docs/technical/SEO-LOCAL-GA4.md.

type Valor = string | number | boolean;

/** Envia um evento ao GA4. Parâmetros só com categorias e números — nunca nome, telefone, e-mail, observação ou código. */
export function medir(evento: string, params: Record<string, Valor | undefined> = {}): void {
  try {
    const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (typeof g !== 'function') return;
    const limpos: Record<string, Valor> = {};
    for (const [k, v] of Object.entries(params)) if (v !== undefined) limpos[k] = v;
    g('event', evento, limpos);
  } catch { /* medição nunca interfere no site */ }
}

/** Dias inteiros entre hoje (no fuso do café) e a data da visita (AAAA-MM-DD). */
function antecedencia(data: string, fuso: string): number | undefined {
  try {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const d = (Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000;
    return Number.isFinite(d) ? Math.round(d) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A conversão principal: reserva criada pela API do site. Só o que descreve a reserva em categorias — situação,
 * ambiente, pessoas, dia da semana, horário e antecedência —, nada que identifique quem reservou.
 */
export function medirReserva(r: { status: string; ambienteId: string; pessoas: number; data: string; hora: string }, fuso: string): void {
  const dia = Date.parse(`${r.data}T12:00:00Z`);
  medir('reserva_concluida', {
    situacao: r.status,
    ambiente: r.ambienteId,
    pessoas: r.pessoas,
    dia_semana: Number.isFinite(dia) ? ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][new Date(dia).getUTCDay()] : undefined,
    hora: r.hora,
    antecedencia_dias: antecedencia(r.data, fuso),
  });
}
