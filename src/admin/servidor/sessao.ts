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

export function gravarSessao(cookies: AstroCookies, seguro: boolean, token: string, expiraEm: Date) {
  const segundos = Math.max(60, Math.floor((expiraEm.getTime() - Date.now()) / 1000));
  cookies.set(COOKIE_SESSAO, token, {
    path: '/admin',
    httpOnly: true,
    secure: seguro,
    sameSite: 'strict',
    maxAge: segundos,
  });
}

/**
 * Unidade de negócio em uso (lida também pela moldura no navegador, por isso sem HttpOnly). O servidor grava a unidade
 * que escolheu para a página: sem ela, a ponte não mandaria `?unidade=` e o backend usaria a unidade padrão DELE (na
 * produção, a de testes) — o topo diria "Âmbar Café" com números de outra unidade.
 */
export function gravarUnidade(cookies: AstroCookies, seguro: boolean, codigo: string) {
  cookies.set(COOKIE_UNIDADE, codigo, { path: '/admin', secure: seguro, sameSite: 'strict', maxAge: 31536000 });
}

export function apagarSessao(cookies: AstroCookies) {
  cookies.delete(COOKIE_SESSAO, { path: '/admin' });
}

/**
 * Escrita só da própria origem: cabeçalho `X-Painel: 1` (formulário de outro site não consegue mandar) e, quando o
 * navegador informa `Origin`, o host dele igual ao `Host` da requisição. (O `url.origin` do Astro no servidor não
 * confia no Host e pode dizer "localhost"; por isso a comparação é com o cabeçalho.)
 */
export function requisicaoDoPainel(request: Request): boolean {
  if (request.headers.get('x-painel') !== '1') return false;
  const origem = request.headers.get('origin');
  if (!origem) return true;
  try {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

/** https de verdade (direto ou atrás do proxy da Vercel): só então o cookie leva `Secure`. */
export function ehHttps(request: Request, url: URL): boolean {
  return url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
}
