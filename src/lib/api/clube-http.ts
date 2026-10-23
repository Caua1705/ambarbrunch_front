// Cliente HTTP da API do Clube Âmbar (clube-contrato.ts).
// Só é usado com PUBLIC_CLUBE_MODO=api e PUBLIC_CLUBE_API_URL definidos no build. A sessão do membro é um cookie httpOnly
// do backend (credentials: 'include'); o site não lê nem guarda token.
import { ErroClube, type ClubeApi, type ClubeConfig, type DesafioCodigo, type Membro, type Extrato, type Recompensas } from './clube-contrato';

const TEMPO_LIMITE = 12_000;

async function pedir<T>(base: string, caminho: string, init: RequestInit = {}): Promise<T> {
  const tempo = AbortSignal.timeout(TEMPO_LIMITE);
  let res: Response;
  try {
    res = await fetch(new URL(caminho, base), {
      ...init, signal: tempo, credentials: 'include',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    if (tempo.aborted) throw new ErroClube('tempo', 'O Clube demorou a responder.');
    throw new ErroClube('rede', 'Sem conexão com o Clube.');
  }
  if (res.status === 204) return undefined as T;
  if (res.ok) return res.json() as Promise<T>;
  const corpo = await res.json().catch(() => ({})) as { detail?: unknown; mensagem?: string; campos?: Record<string, string> };
  // FastAPI devolve 422 com `detail: [{ loc: [...], msg }]` — mapeado para campos do formulário.
  const campos: Record<string, string> = { ...(corpo.campos ?? {}) };
  if (Array.isArray(corpo.detail)) for (const d of corpo.detail as { loc?: unknown[]; msg?: string }[]) {
    const campo = String(d.loc?.at(-1) ?? ''); if (campo) campos[campo] = d.msg ?? 'Valor inválido';
  }
  const msg = corpo.mensagem ?? (typeof corpo.detail === 'string' ? corpo.detail : undefined);
  if (res.status === 401) throw new ErroClube('sessao', msg ?? 'Entre de novo para ver sua carteira.');
  if (res.status === 409) throw new ErroClube('ja-membro', msg ?? 'Este telefone já está no Clube.');
  if (res.status === 410) throw new ErroClube('codigo', msg ?? 'Este código venceu. Peça outro.');
  if (res.status === 423) throw new ErroClube('fechado', msg ?? 'As inscrições no Clube ainda não estão abertas.');
  if (res.status === 422 || res.status === 400) throw new ErroClube('validacao', msg ?? 'Confira os dados.', campos);
  if (res.status === 429) throw new ErroClube('limite', msg ?? 'Muitas tentativas. Aguarde um instante.');
  if (res.status === 503) throw new ErroClube('indisponivel', 'O Clube está indisponível no momento.');
  throw new ErroClube('servidor', 'Não foi possível concluir. Tente de novo em instantes.');
}

export function criarClubeHttp(base: string): ClubeApi {
  const post = <T>(caminho: string, corpo: unknown, headers?: Record<string, string>) =>
    pedir<T>(base, caminho, { method: 'POST', body: JSON.stringify(corpo), headers });
  return {
    config: () => pedir<ClubeConfig>(base, 'clube/config'),
    pedirCodigo: (telefone) => post<DesafioCodigo>('clube/acesso', { telefone }),
    verificar: (desafioId, codigo) => post<Membro>('clube/acesso/verificar', { desafioId, codigo }),
    membro: () => pedir<Membro>(base, 'clube/membro'),
    extrato: (cursor) => pedir<Extrato>(base, `clube/membro/extrato${cursor ? `?${new URLSearchParams({ cursor })}` : ''}`),
    recompensas: () => pedir<Recompensas>(base, 'clube/recompensas'),
    marketing: (autorizado) => pedir<Membro['marketing']>(base, 'clube/membro/marketing', { method: 'PUT', body: JSON.stringify({ autorizado }) }),
    sair: () => post<void>('clube/sair', {}),
  };
}
