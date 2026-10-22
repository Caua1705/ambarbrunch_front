// Cliente HTTP da API de reservas do Âmbar (contrato.ts).
// Só é usado com PUBLIC_RESERVAS_MODO=api e PUBLIC_RESERVAS_API_URL definidos no build.
import { ErroReserva, type ReservasApi, type ReservaConfig, type Disponibilidade, type ReservaCriada } from './contrato';

const TEMPO_LIMITE = 12_000;

async function pedir<T>(base: string, caminho: string, init: RequestInit = {}, sinal?: AbortSignal): Promise<T> {
  const tempo = AbortSignal.timeout(TEMPO_LIMITE);
  const signal = sinal ? AbortSignal.any([sinal, tempo]) : tempo;
  let res: Response;
  try {
    res = await fetch(new URL(caminho, base), { ...init, signal, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  } catch (e) {
    if (sinal?.aborted) throw e;
    if (tempo.aborted) throw new ErroReserva('tempo', 'O sistema de reservas demorou a responder.');
    throw new ErroReserva('rede', 'Sem conexão com o sistema de reservas.');
  }
  if (res.ok) return res.json() as Promise<T>;
  const corpo = await res.json().catch(() => ({})) as { detail?: unknown; mensagem?: string; campos?: Record<string, string> };
  // FastAPI devolve 422 com `detail: [{ loc: [...], msg }]` — mapeado para campos do formulário.
  const campos: Record<string, string> = { ...(corpo.campos ?? {}) };
  if (Array.isArray(corpo.detail)) for (const d of corpo.detail as { loc?: unknown[]; msg?: string }[]) {
    const campo = String(d.loc?.at(-1) ?? ''); if (campo) campos[campo] = d.msg ?? 'Valor inválido';
  }
  const msg = corpo.mensagem ?? (typeof corpo.detail === 'string' ? corpo.detail : undefined);
  if (res.status === 409) throw new ErroReserva('conflito', msg ?? 'Este horário acabou de ser reservado. Escolha outro.');
  if (res.status === 422 || res.status === 400) throw new ErroReserva('validacao', msg ?? 'Confira os dados da reserva.', campos);
  if (res.status === 429) throw new ErroReserva('limite', 'Muitas tentativas. Aguarde um instante.');
  if (res.status === 503) throw new ErroReserva('indisponivel', 'O sistema de reservas está indisponível no momento.');
  throw new ErroReserva('servidor', 'Não foi possível concluir. Tente de novo em instantes.');
}

export function criarApiHttp(base: string): ReservasApi {
  return {
    modo: 'api',
    config: () => pedir<ReservaConfig>(base, 'reservas/config'),
    disponibilidade: (q, sinal) => pedir<Disponibilidade>(base, `reservas/disponibilidade?${new URLSearchParams({ data: q.data, pessoas: String(q.pessoas), ambiente: q.ambienteId })}`, {}, sinal),
    criar: (r, chave) => pedir<ReservaCriada>(base, 'reservas', { method: 'POST', body: JSON.stringify(r), headers: { 'Idempotency-Key': chave } }),
  };
}
