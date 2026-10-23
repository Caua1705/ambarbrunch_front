// ACESSO UNIFICADO ao Clube Âmbar — contrato REAL do backend: giardini_back, docs/auditoria-ambar/arquitetura/CLUBE.md §4 e §9
// (commits e410da2 — sessão em cookie — e ebc8b5d — convite do caixa, “porta A”). Uma entrada só, pelo WhatsApp:
//   A. /clube/ativar?c=<token>: toque em “Ativar meu Clube” → POST /clube/convites/ativar { convite } → sessão de
//      ATIVAÇÃO (30 min, só para concluir o cadastro) ou “entrar” (já é membro: login normal) · 410 link vencido.
//   0. Ao abrir a página: GET /clube/me → 200 sessão valendo (situação, sem pedir código) · 401 formulário do telefone.
//   1. POST /clube/acesso { telefone } → 202 DesafioAcesso — SEMPRE igual, com ou sem cadastro (não revela se o número
//      existe). O envio é em fila: a API não diz se o número tem WhatsApp.
//   2. POST /clube/acesso/verificar { desafioId, codigo } → 200 { sessao: { expiraEm }, situacao, membro, cadastro } +
//      Set-Cookie da sessão. É o BACKEND que diz se a pessoa é membro ou se falta cadastro; o navegador só exibe.
//   3. POST /clube/adesoes (cookie; telefone vem da sessão) — envio parcial vale: devolve a situação de novo.
//   4. POST /clube/sair → 204 sempre; o backend apaga o cookie.
// Sessão: cookie HttpOnly `__Secure-ambar_clube` (SameSite=Strict) — o site NÃO vê nem guarda token: toda chamada vai com
// `credentials: "include"` e o navegador manda o cookie. Toda chamada que muda algo leva `X-Ambar-Csrf: 1` (o navegador
// põe o Origin); sem ele, 403 `origem_invalida`. O cookie só funciona com site e API no MESMO site (ambarbrunch.com →
// api.ambarbrunch.com; localhost → localhost). Em outro domínio (ex.: *.vercel.app) o /clube/me dá 401 e a página só
// mostra o formulário do telefone.
// Erros: { detail: "<texto em português, pode ir ao cliente>", codigo } ou, em campo inválido (422), o formato do FastAPI
// { detail: [{ loc: ["body", "<campo>"], msg, type }], codigo? } — não há chave `campos`. → ErroClube.
import { ErroClube } from './clube-contrato';

/** GET /clube/config */
export interface ConfigClube {
  inscricoesAbertas: boolean;
  /** pontos e carteira ligados (hoje desligado) */
  programaAtivo: boolean;
  /** versões e URLs vêm null enquanto não configuradas no backend */
  regulamento: { versao: string | null; url: string | null } | null;
  privacidade: { versao: string | null; url: string | null } | null;
  marketing: { textoVersao: string | null } | null;
  codigo: { digitos: number; validadeS: number };
}

/** POST /clube/acesso → 202 */
export interface DesafioAcesso {
  desafioId: string;
  canal: 'whatsapp';
  /** “(85) •••••-0000” */
  destino: string;
  /** segundos até poder pedir outro código */
  reenvioEm: number;
  /** ISO 8601 */
  expiraEm: string;
}

export interface MembroClube {
  nome: string;
  /** mascarado */
  telefone: string;
  /** “MM-DD” */
  aniversario: string | null;
  membroDesde: string;
  marketing: { autorizado: boolean };
  /** avisos de serviço do Clube pelo WhatsApp (DELETE /clube/me/mensagens desliga) */
  mensagens: { autorizado: boolean };
  /** saldo só vem com o programa ativo — com ele desligado, null: não mostrar pontos */
  programa: { ativo: boolean; saldo: { pendente: number; disponivel: number; reservado: number } | null };
}

/** o que o backend já tem de quem confirmou o número e ainda não é membro completo */
export interface CadastroPendente {
  nome: string | null;
  /** “MM-DD” */
  aniversario: string | null;
  /** “aceite” = nunca aceitou ou a versão dos termos mudou */
  faltam: ('nome' | 'aceite')[];
  marketing: { autorizado: boolean };
}

/** as duas chaves vêm sempre; a que não vale é null.
 *  membro · cadastro → sessão completa (código confirmado).
 *  ativacao → sessão de ATIVAÇÃO do convite do caixa (30 min, sem renovação): só concluir o cadastro; nome e
 *    aniversário vêm SEMPRE null (a sessão do link nunca mostra dados já gravados).
 *  ativado → o cadastro feito pelo convite ficou ativo; a sessão de ativação acabou (cookie apagado).
 *  entrar → o link do convite é de um número que já é membro: o link não dá acesso, é preciso o login por código. */
export type SituacaoClube =
  | { situacao: 'membro'; membro: MembroClube; cadastro: null }
  | { situacao: 'cadastro' | 'ativacao'; cadastro: CadastroPendente; membro: null }
  | { situacao: 'ativado'; membro: null; cadastro: null }
  | { situacao: 'entrar'; membro: null; cadastro: null };

/** POST /clube/acesso/verificar → 200 (+ Set-Cookie; o token NÃO vem no corpo) */
export type AcessoVerificado = SituacaoClube & { sessao: { expiraEm: string } };

/** POST /clube/adesoes — só o que falta; o backend confere pela base dele. Campo desconhecido = 422 (extra=forbid).
 *  Sem `origem`: o backend a ignora (sabe pelo desafio se veio do link) e só aceitaria texto, não o objeto do site. */
export interface ConclusaoCadastro {
  nome?: string;
  aniversario?: string;
  aceiteRegulamento?: true;
  regulamentoVersao?: string;
  privacidadeVersao?: string;
  marketing?: { autorizado: boolean; textoVersao: string };
}

export interface AcessoClubeApi {
  config(): Promise<ConfigClube>;
  /** GET /clube/me — restaura a sessão do cookie; 401 (ErroClube “sessao”) = sem sessão válida */
  me(): Promise<SituacaoClube>;
  pedirCodigo(telefone: string): Promise<DesafioAcesso>;
  verificar(desafioId: string, codigo: string): Promise<AcessoVerificado>;
  concluir(c: ConclusaoCadastro, chaveIdempotencia: string): Promise<SituacaoClube>;
  /** POST /clube/convites/ativar — SÓ no toque em “Ativar meu Clube” (nunca ao abrir a página). 200 “ativacao”
   *  (+ cookie de ativação) ou “entrar” (sem cookie) · 410 link vencido, usado, substituído ou inválido. */
  ativarConvite(convite: string): Promise<SituacaoClube>;
  /** POST /clube/sair — 204 sempre; o backend apaga o cookie (o JavaScript não consegue) */
  sair(): Promise<void>;
}

const TEMPO_LIMITE = 12_000;

async function pedir<T>(base: string, caminho: string, init: RequestInit = {}): Promise<T> {
  const tempo = AbortSignal.timeout(TEMPO_LIMITE);
  const muda = (init.method ?? 'GET') !== 'GET';
  let res: Response;
  try {
    res = await fetch(new URL(caminho, base), {
      ...init, signal: tempo, credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        // anti-CSRF: o cabeçalho próprio obriga o pré-voo de CORS; o backend confere também o Origin
        ...(muda ? { 'X-Ambar-Csrf': '1' } : {}),
        ...init.headers,
      },
    });
  } catch {
    if (tempo.aborted) throw new ErroClube('tempo', 'O Clube demorou a responder. Tente de novo.');
    throw new ErroClube('rede', 'Sem conexão com o Clube. Confira sua internet e tente de novo.');
  }
  if (res.status === 204) return undefined as T;
  if (res.ok) return res.json() as Promise<T>;
  const corpo = await res.json().catch(() => ({})) as { detail?: unknown; codigo?: string };
  // 422 de campo: `detail` é a lista do FastAPI; o campo é o último item de `loc`
  const campos: Record<string, string> = {};
  if (Array.isArray(corpo.detail)) for (const d of corpo.detail as { loc?: unknown[]; msg?: string }[]) {
    const campo = String(d.loc?.at(-1) ?? ''); if (campo && !campos[campo]) campos[campo] = d.msg ?? 'Valor inválido';
  }
  // regra ou estado: `detail` é texto em português, feito para o cliente
  const msg = typeof corpo.detail === 'string' && corpo.detail.trim() ? corpo.detail : undefined;
  if (res.status === 401) throw new ErroClube('sessao', 'Sua confirmação expirou. Confirme o WhatsApp de novo.');
  // 403 origem_invalida: o site não está numa origem do Clube (ou faltou o cabeçalho) — nada que a pessoa resolva
  if (res.status === 403) throw new ErroClube('indisponivel', 'O Clube não está disponível por este endereço. Acesse pelo site do Âmbar.');
  if (res.status === 409 && corpo.codigo === 'versao_desatualizada') throw new ErroClube('versao', 'Os termos do Clube foram atualizados. Confira e aceite de novo.');
  if (res.status === 410) throw new ErroClube('codigo', msg ?? 'Este código venceu ou já foi usado. Peça um novo.');
  if (res.status === 422 || res.status === 400) throw new ErroClube('validacao', msg ?? 'Confira os dados.', campos);
  if (res.status === 429) throw new ErroClube('limite', msg ?? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  if (res.status === 503) throw new ErroClube('indisponivel', msg ?? 'O Clube está indisponível no momento. Tente mais tarde.');
  throw new ErroClube('servidor', 'Não foi possível concluir. Tente de novo em instantes.');
}

export function criarAcessoHttp(base: string): AcessoClubeApi {
  const post = <T>(caminho: string, corpo?: unknown, headers?: Record<string, string>) =>
    pedir<T>(base, caminho, { method: 'POST', ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }), headers });
  return {
    config: () => pedir<ConfigClube>(base, 'clube/config'),
    me: () => pedir<SituacaoClube>(base, 'clube/me'),
    pedirCodigo: (telefone) => post<DesafioAcesso>('clube/acesso', { telefone }),
    verificar: (desafioId, codigo) => post<AcessoVerificado>('clube/acesso/verificar', { desafioId, codigo }),
    concluir: (c, chave) => post<SituacaoClube>('clube/adesoes', c, { 'Idempotency-Key': chave }),
    sair: () => post<void>('clube/sair'),
    ativarConvite: (convite) => post<SituacaoClube>('clube/convites/ativar', { convite }),
  };
}
