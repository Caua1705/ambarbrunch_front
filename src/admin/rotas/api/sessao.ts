// Entrar e sair. POST {email, senha} → login no backend e cookie HttpOnly; DELETE → apaga o cookie.
// Demonstração: POST {demo: "gerente"} — só existe com PAINEL_MODO=demo (nunca na Vercel).
import type { APIRoute } from 'astro';
import { modoPainel } from '../../servidor/config';
import { gravarSessao, apagarSessao, requisicaoDoPainel, ehHttps } from '../../servidor/sessao';
import { chamarBackend, lerJson, BackendForaDoAr } from '../../servidor/backend';
import type { Usuario } from '../../lib/sessao';

export const prerender = false;

function json(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (!requisicaoDoPainel(request)) return json(403, { detail: 'Requisição recusada.', codigo: 'origem_invalida' });
  const modo = modoPainel();
  const corpo = (await request.json().catch(() => null)) as { email?: unknown; senha?: unknown; demo?: unknown } | null;
  if (!corpo) return json(422, { detail: 'Informe e-mail e senha.', codigo: 'validacao' });

  if (modo === 'demo') {
    const papel = corpo.demo;
    if (papel !== 'admin' && papel !== 'gerente' && papel !== 'operador') return json(422, { detail: 'Escolha um perfil de demonstração.', codigo: 'validacao' });
    gravarSessao(cookies, ehHttps(request, url), `demo:${papel}`, new Date(Date.now() + 8 * 3600_000));
    return json(200, { ok: true });
  }
  if (modo !== 'api') return json(503, { detail: 'O painel ainda não está conectado ao sistema do Âmbar.', codigo: 'indisponivel' });

  const email = typeof corpo.email === 'string' ? corpo.email.trim() : '';
  const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
  if (!email || !senha) return json(422, { detail: 'Informe e-mail e senha.', codigo: 'validacao' });

  let res: Response;
  try {
    res = await chamarBackend(null, 'auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) });
  } catch (e) {
    if (e instanceof BackendForaDoAr) return json(502, { detail: 'O sistema do Âmbar não respondeu. Tente de novo em instantes.', codigo: 'backend_indisponivel' });
    throw e;
  }
  if (res.status === 429) return json(429, { detail: 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.', codigo: 'limite_excedido' });
  if (res.status === 401 || res.status === 403 || res.status === 422) return json(401, { detail: 'E-mail ou senha incorretos.', codigo: 'credenciais' });
  if (!res.ok) return json(502, { detail: 'Não foi possível entrar agora. Tente de novo em instantes.', codigo: 'backend_indisponivel' });

  const login = await lerJson<{ token: string; expira_em: string; usuario: Usuario }>(res);
  if (!login?.token) return json(502, { detail: 'Resposta inesperada do sistema.', codigo: 'backend_indisponivel' });
  gravarSessao(cookies, ehHttps(request, url), login.token, new Date(login.expira_em));
  // O token não volta para o navegador.
  return json(200, { ok: true, usuario: { nome: login.usuario.nome, papel: login.usuario.papel } });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!requisicaoDoPainel(request)) return json(403, { detail: 'Requisição recusada.', codigo: 'origem_invalida' });
  // O backend não revoga o token (sem rota de logout): o cookie some daqui e o token expira sozinho.
  apagarSessao(cookies);
  return json(200, { ok: true });
};
