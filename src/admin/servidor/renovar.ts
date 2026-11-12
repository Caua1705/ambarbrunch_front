// Renovação da sessão do tablet (conta do Atendente), sempre no servidor do painel: o navegador nunca vê nenhum dos tokens.
// Acesso vencido (o cookie some junto com ele) ou recusado + cookie de renovação → POST /admin/auth/renovar no backend:
//  - 200: grava o acesso novo e a renovação nova (prazo empurrado, teto contado do login com senha);
//  - 401: a sessão foi encerrada (Sair, "Encerrar sessões" pelo Proprietário, senha trocada, conta desativada, perfil
//    mudado ou teto vencido) → apaga os dois cookies e a tela volta para o login. Nunca entra sem autenticação;
//  - backend fora do ar: não apaga nada (a renovação continua valendo para a próxima tentativa).
import type { AstroCookies } from 'astro';
import { chamarBackend, lerJson, BackendForaDoAr } from './backend';
import { apagarSessao, gravarRenovacao, gravarSessao, lerRenovacao } from './sessao';

export type Renovacao = { token: string } | 'sessao' | 'backend';

export async function renovarSessao(cookies: AstroCookies, https: boolean): Promise<Renovacao> {
  const renovacao = lerRenovacao(cookies);
  if (!renovacao) return 'sessao';
  let res: Response;
  try {
    res = await chamarBackend(null, 'auth/renovar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renovacao }),
    });
  } catch (e) {
    if (e instanceof BackendForaDoAr) return 'backend';
    throw e;
  }
  if (res.status === 401 || res.status === 403 || res.status === 422) {
    apagarSessao(cookies);
    return 'sessao';
  }
  if (!res.ok) return 'backend';
  const corpo = await lerJson<{ token: string; expira_em: string; renovacao?: string | null; renovacao_expira_em?: string | null }>(res);
  if (!corpo?.token) return 'backend';
  gravarSessao(cookies, https, corpo.token, new Date(corpo.expira_em));
  if (corpo.renovacao && corpo.renovacao_expira_em) gravarRenovacao(cookies, https, corpo.renovacao, new Date(corpo.renovacao_expira_em));
  return { token: corpo.token };
}
