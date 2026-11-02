// /admin/clientes não é mais uma página (02/11/2026): quem é o contato aparece na ficha da conversa, no Atendimento.
// Links e favoritos antigos (inclusive /admin/clientes?id=…) continuam funcionando: 303 para o Atendimento. A sessão já
// foi conferida no middleware (sem login, o redirecionamento vai para o login e volta para cá). Nenhum dado é apagado: as
// rotas /admin/clientes* do backend seguem existindo.
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => new Response(null, { status: 303, headers: { Location: '/admin/atendimento' } });
