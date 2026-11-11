// Ponte do navegador para o backend: /admin/api/<caminho> → <PAINEL_API_URL>/admin/<caminho>, com o token da sessão.
// O navegador nunca vê o token nem fala direto com a API. No modo demo, responde com os dados de demonstração.
import type { APIRoute } from 'astro';
import { modoPainel, modulosLiberados, rotaLiberada, DEMO_PERMITIDO } from '../../servidor/config';
import { lerSessao, apagarSessao, COOKIE_UNIDADE, requisicaoDoPainel } from '../../servidor/sessao';
import { chamarBackend, BackendForaDoAr } from '../../servidor/backend';

export const prerender = false;

const CAMINHO_VALIDO = /^[a-z0-9][a-z0-9_\-/.]*$/i;
const REPASSAR = ['content-type', 'idempotency-key'];

// Arquivos que o backend devolve (mídia do WhatsApp no Atendimento): o corpo passa como veio (binário, em fluxo), mas só os
// tipos que o navegador MOSTRA sem executar nada abrem no painel. O resto (HTML, SVG, XML…, que um cliente poderia mandar
// como "documento") desce como download e nunca roda com a origem e a sessão do painel. JSON segue intocado.
const EXIBIVEL = /^(image\/(jpeg|png|webp|gif)|audio\/(ogg|opus|mpeg|mp4|aac|amr|wav|x-wav|webm)|video\/(mp4|3gpp|webm)|application\/pdf|text\/plain)\s*(;|$)/i;
const JSON_TIPO = /^application\/(problem\+)?json/i;

function cabecalhosDeArquivo(origem: Headers, saida: Headers) {
  const tipo = origem.get('content-type') ?? 'application/octet-stream';
  const nome = /filename="?([\w.\- ]{1,120})"?/i.exec(origem.get('content-disposition') ?? '')?.[1] ?? 'arquivo';
  const exibivel = EXIBIVEL.test(tipo);
  saida.set('Content-Type', exibivel ? tipo : 'application/octet-stream');
  // (sem Content-Length: o fetch do servidor pode ter descomprimido o corpo e o tamanho original não vale mais)
  saida.set('Content-Disposition', `${exibivel ? 'inline' : 'attachment'}; filename="${nome}"`);
}

/** Resposta da demonstração: arquivo (não JSON) com os cabeçalhos refeitos; JSON e erros passam sem mudança. */
function blindarArquivo(res: Response): Response {
  const tipo = res.headers.get('content-type') ?? '';
  if (!res.ok || !tipo || JSON_TIPO.test(tipo)) return res;
  const saida = new Headers();
  cabecalhosDeArquivo(res.headers, saida);
  const marca = res.headers.get('x-painel-modo');
  if (marca) saida.set('X-Painel-Modo', marca);
  return new Response(res.body, { status: res.status, headers: saida });
}

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
  if (metodo !== 'GET' && !requisicaoDoPainel(request)) return erro(403, 'Requisição recusada.', 'origem_invalida');

  const sessao = lerSessao(cookies);
  if (!sessao) return erro(401, 'Sua sessão terminou. Entre de novo.', 'nao_autenticado');
  // Liberação controlada (PAINEL_MODULOS): rota de módulo não liberado nem chega ao backend.
  if (!rotaLiberada(caminho, modulosLiberados())) return erro(403, 'Este módulo ainda não foi liberado no painel.', 'modulo_nao_liberado');

  // A unidade de negócio escolhida no topo vale para toda consulta que não disser outra. B4: vale a da PÁGINA que fez a
  // chamada (X-Painel-Unidade, gravada no HTML da aba); o cookie, compartilhado entre as abas, só quando ela não vem.
  // O backend continua conferindo se a pessoa tem acesso à unidade.
  const query = new URLSearchParams(url.search);
  const valida = (u: string | null | undefined) => (u && /^[a-z0-9_]+$/.test(u) ? u : null);
  const unidade = valida(request.headers.get('x-painel-unidade')) ?? valida(cookies.get(COOKIE_UNIDADE)?.value);
  if (unidade && !query.has('unidade')) query.set('unidade', unidade);
  const alvo = query.size ? `${caminho}?${query}` : caminho;

  if (DEMO_PERMITIDO && modoPainel() === 'demo') {
    // Só em build local; no build da Vercel este ramo e todo o servidor/demo/ saem do pacote.
    if (!sessao.demoPapel) return erro(401, 'Sua sessão terminou. Entre de novo.', 'nao_autenticado');
    const { responderDemo } = await import('../../servidor/demo/roteador');
    return blindarArquivo(await responderDemo({ metodo, caminho, query, papel: sessao.demoPapel, request }));
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
  const tipo = res.headers.get('content-type') ?? 'application/json';
  // Erro sem JSON não veio da API do Âmbar (que sempre responde JSON): é o proxy da VPS sem o contêiner no ar (deploy,
  // reinício ou falha de saúde devolvem "404 page not found" em texto). Antes isso virava "Não encontrado. Pode ter sido
  // removido." no painel, como se o registro tivesse sido apagado.
  if (!res.ok && res.status !== 401 && !JSON_TIPO.test(tipo)) {
    await res.body?.cancel().catch(() => undefined);
    return erro(503, 'O sistema do Âmbar está reiniciando ou fora do ar. Tente de novo em instantes.', 'backend_indisponivel');
  }
  const saida = new Headers({ 'Content-Type': tipo });
  if (res.ok && !JSON_TIPO.test(tipo)) cabecalhosDeArquivo(res.headers, saida);
  const req = res.headers.get('x-request-id');
  if (req) saida.set('X-Request-ID', req);
  return new Response(res.body, { status: res.status, headers: saida });
};
