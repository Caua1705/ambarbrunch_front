// Cliente HTTP da API de reservas do Âmbar (contrato.ts).
// Só é usado com PUBLIC_RESERVAS_MODO=api e PUBLIC_RESERVAS_API_URL definidos no build.
import { ErroReserva, type ReservasApi, type ReservaConfig, type Disponibilidade, type ReservaCriada } from './contrato';

const TEMPO_LIMITE = 12_000;

/** Erros de tipo do FastAPI/pydantic chegam em inglês: viram texto em português. Os do backend (regras) já vêm em português. */
const MSG_PYDANTIC: Record<string, string> = {
  string_too_long: 'Texto longo demais.',
  string_too_short: 'Preencha este campo.',
  missing: 'Campo obrigatório.',
  value_error: 'Valor inválido.',
  int_parsing: 'Valor inválido.',
};
/** O backend aceita camelCase e snake_case; o formulário usa os nomes curtos. */
const CAMPO_DO_FORMULARIO: Record<string, string> = { consentimentoPrivacidade: 'consentimento', consentimento_privacidade: 'consentimento', ambiente_id: 'ambienteId' };

async function pedir<T>(base: string, caminho: string, init: RequestInit = {}, sinal?: AbortSignal): Promise<T> {
  // Tempo-limite sem AbortSignal.any/timeout (ausentes no Safari/iOS anterior a 17.4/16 e no Chrome anterior a 116):
  // um controlador só, abortado pelo relógio ou pelo sinal de quem chamou.
  const ctrl = new AbortController();
  let esgotou = false;
  const relogio = setTimeout(() => { esgotou = true; ctrl.abort(); }, TEMPO_LIMITE);
  const repassar = () => ctrl.abort();
  if (sinal?.aborted) ctrl.abort(); else sinal?.addEventListener('abort', repassar, { once: true });
  let res: Response;
  try {
    res = await fetch(new URL(caminho, base), { ...init, signal: ctrl.signal, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  } catch (e) {
    if (sinal?.aborted) throw e instanceof Error && e.name === 'AbortError' ? e : new DOMException('cancelado', 'AbortError');
    if (esgotou) throw new ErroReserva('tempo', 'O sistema de reservas demorou a responder.');
    throw new ErroReserva('rede', 'Sem conexão com o sistema de reservas.');
  } finally {
    clearTimeout(relogio);
    sinal?.removeEventListener('abort', repassar);
  }
  if (res.ok) return res.json() as Promise<T>;
  const corpo = await res.json().catch(() => ({})) as { detail?: unknown; mensagem?: string; campos?: Record<string, string>; codigo?: string };
  // FastAPI devolve 422 com `detail: [{ loc: [...], msg, type }]` — mapeado para campos do formulário.
  const campos: Record<string, string> = { ...(corpo.campos ?? {}) };
  if (Array.isArray(corpo.detail)) for (const d of corpo.detail as { loc?: unknown[]; msg?: string; type?: string }[]) {
    const original = String(d.loc?.at(-1) ?? '');
    if (!original) continue;
    const campo = CAMPO_DO_FORMULARIO[original] ?? original;
    const traduzida = d.type && MSG_PYDANTIC[d.type];
    campos[campo] = traduzida ? (campo === 'email' ? 'Confira o e-mail.' : traduzida) : d.msg ?? 'Valor inválido.';
  }
  const msg = corpo.mensagem ?? (typeof corpo.detail === 'string' ? corpo.detail : undefined);
  const codigo = corpo.codigo;
  if (res.status === 409) throw new ErroReserva('conflito', msg ?? 'Este horário acabou de ser reservado. Escolha outro.', {}, codigo);
  if (codigo === 'idempotencia_conflito') throw new ErroReserva('validacao', 'Os dados mudaram desde a última tentativa. Confira e confirme de novo.', {}, codigo);
  // Sem mensagem geral (ex.: ambiente ou pessoas recusados em /disponibilidade): a do primeiro campo.
  if (res.status === 422 || res.status === 400) throw new ErroReserva('validacao', msg ?? Object.values(campos)[0] ?? 'Confira os dados da reserva.', campos, codigo);
  if (res.status === 429) throw new ErroReserva('limite', msg ?? 'Muitas tentativas seguidas. Tente de novo em alguns minutos.', {}, codigo);
  // Reservas fechadas pela unidade (aceita_reservas desligado): estado da comanda, não erro técnico.
  if (res.status === 503 && codigo === 'reservas_indisponiveis') throw new ErroReserva('fechado', 'As reservas pelo site estão fechadas no momento.', {}, codigo);
  // Recusa de acesso (rotas públicas não a usam hoje; um bloqueio na frente da API, sim): a mensagem do servidor, sem
  // sugerir que repetir resolve.
  if (res.status === 403) throw new ErroReserva('servidor', msg ?? 'O sistema de reservas recusou o pedido. Fale com a equipe pelo WhatsApp.', {}, codigo);
  if (res.status === 503) throw new ErroReserva('indisponivel', 'O sistema de reservas está indisponível no momento.', {}, codigo);
  throw new ErroReserva('servidor', 'Não foi possível concluir. Tente de novo em instantes.', {}, codigo);
}

export function criarApiHttp(base: string): ReservasApi {
  return {
    modo: 'api',
    config: () => pedir<ReservaConfig>(base, 'reservas/config'),
    disponibilidade: (q, sinal) => pedir<Disponibilidade>(base, `reservas/disponibilidade?${new URLSearchParams({ data: q.data, pessoas: String(q.pessoas), ambiente: q.ambienteId })}`, {}, sinal),
    criar: (r, chave) => pedir<ReservaCriada>(base, 'reservas', { method: 'POST', body: JSON.stringify(r), headers: { 'Idempotency-Key': chave } }),
  };
}
