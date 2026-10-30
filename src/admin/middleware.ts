// Guarda do /admin: nenhuma página do painel sai sem sessão válida, conferida no backend a cada navegação (o backend relê
// papel, unidades e `ativo` do usuário em toda requisição: desativar alguém vale na hora).
import { defineMiddleware } from 'astro:middleware';
import { createHash } from 'node:crypto';
import { modoPainel, clubeConvites, modulosLiberados, DEMO_PERMITIDO } from './servidor/config';
import { lerSessao, apagarSessao, gravarUnidade, COOKIE_UNIDADE, ehHttps } from './servidor/sessao';
import { chamarBackend, lerJson, BackendForaDoAr } from './servidor/backend';
import type { ContextoPainel, Unidade, Usuario } from './lib/sessao';

const PUBLICAS = new Set(['/admin/login', '/admin/api/sessao']);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const caminho = ctx.url.pathname.replace(/\/+$/, '') || '/';
  if (caminho !== '/admin' && !caminho.startsWith('/admin/')) return next();

  const api = caminho.startsWith('/admin/api/');
  const modo = modoPainel();
  ctx.locals.painelModo = modo;
  const https = ehHttps(ctx.request, ctx.url);

  if (!PUBLICAS.has(caminho)) {
    const sessao = lerSessao(ctx.cookies);
    const negar = () => {
      apagarSessao(ctx.cookies);
      if (api) return json(401, { detail: 'Sua sessão terminou. Entre de novo.', codigo: 'nao_autenticado' });
      const volta = caminho === '/admin' ? '' : `?volta=${encodeURIComponent(caminho + ctx.url.search)}`;
      return ctx.redirect(`/admin/login${volta}`, 303);
    };
    // Sessão de demonstração só vale no modo demo (e vice-versa).
    if (!sessao || modo === 'indisponivel' || (modo === 'demo') !== (sessao.demoPapel !== null)) return seguro(negar(), modo, https);

    // As rotas de API não conferem /me: o backend valida o token em cada chamada repassada.
    if (!api) {
      const cookieUnidade = ctx.cookies.get(COOKIE_UNIDADE)?.value;
      const carregado = await carregarContexto(sessao.token, sessao.demoPapel, cookieUnidade);
      if (carregado === 'sessao') return seguro(negar(), modo, https);
      if (carregado === 'backend') return seguro(paginaForaDoAr(), modo, https);
      // A ponte da API manda a unidade do cookie: ele precisa dizer a mesma unidade que esta página mostra no topo.
      if (carregado.unidade && carregado.unidade.codigo !== cookieUnidade) gravarUnidade(ctx.cookies, https, carregado.unidade.codigo);
      ctx.locals.painel = { ...carregado, modo };
    }
  }
  return seguro(await next(), modo, https);
});

type Carregado = Omit<ContextoPainel, 'modo'>;

async function carregarContexto(token: string, demoPapel: ContextoPainel['usuario']['papel'] | null, unidadeCookie?: string): Promise<Carregado | 'sessao' | 'backend'> {
  let usuario: Usuario;
  let unidades: Unidade[];
  if (demoPapel) {
    // Só em build local: no build da Vercel este ramo e o módulo de demonstração saem do pacote.
    if (!DEMO_PERMITIDO) return 'sessao';
    const demo = await import('./servidor/demo/sessao');
    usuario = demo.usuarioDemo(demoPapel);
    unidades = demo.UNIDADES_DEMO;
  } else {
    try {
      const [me, un] = await Promise.all([chamarBackend(token, 'auth/me'), chamarBackend(token, 'unidades')]);
      if (me.status === 401 || me.status === 403) return 'sessao';
      if (!me.ok) return 'backend';
      const u = await lerJson<Usuario>(me);
      if (!u) return 'backend';
      usuario = u;
      unidades = un.ok ? ((await lerJson<Unidade[]>(un)) ?? []) : [];
    } catch (e) {
      if (e instanceof BackendForaDoAr) return 'backend';
      throw e;
    }
  }
  const ativas = unidades.filter((u) => u.ativo);
  const unidade = ativas.find((u) => u.codigo === unidadeCookie) ?? ativas.find((u) => u.codigo === 'ambar_cafe') ?? ativas[0] ?? null;
  return { usuario, unidades: ativas, unidade, clubeConvites: clubeConvites(), modulos: modulosLiberados() };
}

function json(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function paginaForaDoAr() {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Painel Âmbar — sem conexão</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#F7F5F2;color:#1F1A17;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:420px}a{color:#670D27;font-weight:600}</style></head>
<body><main><h1 style="font-size:20px">Não foi possível falar com o sistema do Âmbar</h1><p>O painel está no ar, mas o sistema que guarda os dados não respondeu. Seus dados não foram alterados.</p><p><a href="">Tentar de novo</a></p></main></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '30' } });
}

/**
 * Cabeçalhos de segurança do painel. A CSP libera só os scripts inline que estão NESTA resposta (hash sha256 de cada um:
 * o tema antes da pintura e o carregador das ilhas do Astro) — nada de 'unsafe-inline' para scripts.
 */
async function seguro(res: Response, modo: string, https = false): Promise<Response> {
  const headers = new Headers(res.headers);
  // https: o navegador não volta a tentar http neste host (sem includeSubDomains: não mexe em outros subdomínios)
  if (https) headers.set('Strict-Transport-Security', 'max-age=31536000');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (modo === 'demo') headers.set('X-Painel-Modo', 'demonstracao');
  const tipo = headers.get('Content-Type') ?? '';
  if (!tipo.includes('text/html') || res.status === 304) return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  const html = await res.text();
  const hashes = new Set<string>();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1]) hashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  }
  // `astro dev` (Vite) precisa de eval e do websocket de recarga; o build não.
  const dev = import.meta.env.DEV ? ' ws: http://localhost:* http://127.0.0.1:*' : '';
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].join(' ')}${import.meta.env.DEV ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // documentos (notas, comprovantes) abrem por URL assinada do armazenamento do backend
    "img-src 'self' data: blob: https:",
    "frame-src 'self' blob: https:",
    `connect-src 'self'${dev}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '));
  return new Response(html, { status: res.status, statusText: res.statusText, headers });
}
