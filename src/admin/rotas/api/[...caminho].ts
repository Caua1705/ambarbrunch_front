// Ponte do navegador para o backend: /admin/api/<caminho> → <PAINEL_API_URL>/admin/<caminho>, com o token da sessão.
// O navegador nunca vê o token nem fala direto com a API. No modo demo, responde com os dados de demonstração.
import type { APIRoute } from 'astro';
import { modoPainel } from '../../servidor/config';
import { lerSessao, apagarSessao, COOKIE_UNIDADE } from '../../servidor/sessao';
import { chamarBackend, BackendForaDoAr } from '../../servidor/backend';
import { responderDemo } from '../../servidor/demo/roteador';

export const prerender = false;

const CAMINHO_VALIDO = /^[a-z0-9][a-z0-9_\-/.]*$/i;
const REPASSAR = ['content-type', 'idempotency-key'];

function erro(status: number, detail: string, codigo: string) {
  return new Response(JSON.stringify({ detail, codigo }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export const ALL: APIRoute = async ({ params, request, cookies, url }) => {
  const caminho = params.caminho ?? '';
  // Login e /me só pelo fluxo da sessão; nada de subir de pasta.
  if (!CAMINHO_VALIDO.test(caminho) || caminho.includes('..') || caminho.startsWith('auth/')) return erro(404, 'Não encontrado.', 'nao_encontrado');

  const metodo = request.method.toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo)) return erro(405, 'Método não permitido.', 'metodo');
  // Proteção contra requisição forjada: cookie SameSite=Strict + cabeçalho próprio + mesma origem.
  if (metodo !== 'GET') {
    const origem = request.headers.get('origin');
    if (request.headers.get('x-painel') !== '1' || (origem && origem !== url.origin)) return erro(403, 'Requisição recusada.', 'origem_invalida');
  }

  const sessao = lerSessao(cookies);
  if (!sessao) return erro(401, 'Sua sessão terminou. Entre de novo.', 'nao_autenticado');

  // A unidade de negócio escolhida no topo vale para toda consulta que não disser outra.
  const query = new URLSearchParams(url.search);
  const unidade = cookies.get(COOKIE_UNIDADE)?.value;
  if (unidade && !query.has('unidade') && /^[a-z0-9_]+$/.test(unidade)) query.set('unidade', unidade);
  const alvo = query.size ? `${caminho}?${query}` : caminho;

  if (modoPainel() === 'demo') {
    if (!sessao.demoPapel) return erro(401, 'Sua sessão terminou. Entre de novo.', 'nao_autenticado');
    return responderDemo({ metodo, caminho, query, papel: sessao.demoPapel, request });
  }
  if (sessao.demoPapel) {
    apagarSessao(cookies);
    return erro(401, 'Sua sessão terminou. Entre de novo.', 'nao_autenticado');
  }

  const headers = new Headers();
  for (const h of REPASSAR) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  let res: Response;
  try {
    res = await chamarBackend(sessao.token, alvo, {
      method: metodo,
      headers,
      body: metodo === 'GET' ? undefined : await request.arrayBuffer(),
    });
  } catch (e) {
    if (e instanceof BackendForaDoAr) return erro(502, 'O sistema do Âmbar não respondeu. Tente de novo em instantes.', 'backend_indisponivel');
    throw e;
  }
  if (res.status === 401) apagarSessao(cookies);
  const saida = new Headers({ 'Content-Type': res.headers.get('content-type') ?? 'application/json' });
  const req = res.headers.get('x-request-id');
  if (req) saida.set('X-Request-ID', req);
  return new Response(res.body, { status: res.status, headers: saida });
};
