// Chamada ao backend do Âmbar a partir do servidor do painel (nunca do navegador).
import { apiBase } from './config';

const TEMPO_LIMITE = 20_000;

export class BackendForaDoAr extends Error {}

/** `caminho` é relativo a `/admin/` do backend (ex.: `reservas?data_de=…`). */
export async function chamarBackend(token: string | null, caminho: string, init: RequestInit = {}): Promise<Response> {
  const base = apiBase();
  if (!base) throw new BackendForaDoAr('PAINEL_API_URL não configurada');
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(`${base}/admin/${caminho}`, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(TEMPO_LIMITE) });
  } catch (e) {
    throw new BackendForaDoAr(e instanceof Error ? e.message : String(e));
  }
}

/** Serviço público das reservas (o mesmo do site), sem token. `caminho` é relativo à raiz do backend. */
export async function chamarPublico(caminho: string): Promise<Response> {
  const base = apiBase();
  if (!base) throw new BackendForaDoAr('PAINEL_API_URL não configurada');
  try {
    return await fetch(`${base}/${caminho}`, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(TEMPO_LIMITE) });
  } catch (e) {
    throw new BackendForaDoAr(e instanceof Error ? e.message : String(e));
  }
}

export async function lerJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
