// Sessão do painel: o token do backend fica num cookie HttpOnly do próprio site (o navegador nunca lê o token).
// O navegador fala só com /admin/api/* (mesma origem); o servidor do painel repassa ao backend com `Authorization: Bearer`.
import type { AstroCookies } from 'astro';
import type { Papel } from '../lib/sessao';

export const COOKIE_SESSAO = 'ambar_painel';
export const COOKIE_UNIDADE = 'ambar_painel_unidade';

export interface Sessao {
  /** Token Bearer do backend, ou `demo:<papel>` no modo de demonstração. */
  token: string;
  demoPapel: Papel | null;
}

export function lerSessao(cookies: AstroCookies): Sessao | null {
  const token = cookies.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const demo = /^demo:(admin|gerente|operador)$/.exec(token);
  return { token, demoPapel: demo ? (demo[1] as Papel) : null };
}

export function gravarSessao(cookies: AstroCookies, url: URL, token: string, expiraEm: Date) {
  const segundos = Math.max(60, Math.floor((expiraEm.getTime() - Date.now()) / 1000));
  cookies.set(COOKIE_SESSAO, token, {
    path: '/admin',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'strict',
    maxAge: segundos,
  });
}

export function apagarSessao(cookies: AstroCookies) {
  cookies.delete(COOKIE_SESSAO, { path: '/admin' });
}
