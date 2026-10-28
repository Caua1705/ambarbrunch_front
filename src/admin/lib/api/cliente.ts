// Cliente HTTP das ilhas do painel. Fala só com /admin/api/* (mesma origem); o servidor do painel repassa ao backend com
// o token da sessão. Erros viram ErroApi com uma mensagem humana e o código do backend (CONTRATO §2: {detail, codigo, dados}).

export type TipoErro =
  | 'sessao' // 401
  | 'permissao' // 403
  | 'nao_encontrado' // 404 de um registro
  | 'nao_implantado' // 404 da ROTA: o backend publicado ainda não tem esse recurso
  | 'conflito' // 409
  | 'validacao' // 422
  | 'limite' // 429
  | 'arquivo' // 413 / 415
  | 'indisponivel' // 502 / 503
  | 'servidor' // 500
  | 'tempo'
  | 'rede';

export class ErroApi extends Error {
  constructor(
    public tipo: TipoErro,
    message: string,
    public status = 0,
    public codigo: string | null = null,
    /** Erros de campo (422): nome do campo → mensagem. */
    public campos: Record<string, string> = {},
    /** `dados` do backend (ex.: `versao` no 409 conflito_versao, `pendencias` no 409 pendencias). */
    public dados: Record<string, unknown> | null = null,
  ) {
    super(message);
  }
}

const TEMPO_LIMITE = 25_000;

export interface Pedido {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined | (string | number)[]>;
  corpo?: unknown;
  /** multipart (arquivos). */
  formulario?: FormData;
  /** Idempotency-Key: o mesmo valor em reenvios evita lançamento duplicado. */
  idempotencia?: string;
  sinal?: AbortSignal;
}

export function montarQuery(query: Pedido['query']): string {
  if (!query) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function pedir<T>(caminho: string, p: Pedido = {}): Promise<T> {
  const metodo = p.metodo ?? 'GET';
  const tempo = AbortSignal.timeout(TEMPO_LIMITE);
  const signal = p.sinal ? AbortSignal.any([p.sinal, tempo]) : tempo;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (metodo !== 'GET') headers['X-Painel'] = '1';
  if (p.idempotencia) headers['Idempotency-Key'] = p.idempotencia;
  let body: BodyInit | undefined;
  if (p.formulario) body = p.formulario;
  else if (p.corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(p.corpo);
  }
  let res: Response;
  try {
    res = await fetch(`/admin/api/${caminho}${montarQuery(p.query)}`, { method: metodo, headers, body, signal, credentials: 'same-origin' });
  } catch (e) {
    if (p.sinal?.aborted) throw e;
    if (tempo.aborted) throw new ErroApi('tempo', 'O sistema demorou a responder. Confira sua conexão e tente de novo.');
    throw new ErroApi('rede', 'Sem conexão. Confira a internet e tente de novo.');
  }
  if (res.status === 204) return undefined as T;
  if (res.ok) return (await res.json()) as T;
  throw await converterErro(res);
}

async function converterErro(res: Response): Promise<ErroApi> {
  const corpo = (await res.json().catch(() => ({}))) as { detail?: unknown; codigo?: string; dados?: Record<string, unknown> };
  const codigo = corpo.codigo ?? null;
  const campos: Record<string, string> = {};
  if (Array.isArray(corpo.detail)) {
    for (const d of corpo.detail as { loc?: unknown[]; msg?: string }[]) {
      const campo = String(d.loc?.at(-1) ?? '');
      if (campo) campos[campo] = traduzirValidacao(d.msg);
    }
  }
  const detalhe = typeof corpo.detail === 'string' ? corpo.detail : null;
  const s = res.status;
  if (s === 401) {
    // Sessão expirada: volta ao login lembrando onde a pessoa estava.
    if (typeof location !== 'undefined') location.assign(`/admin/login?volta=${encodeURIComponent(location.pathname + location.search)}`);
    return new ErroApi('sessao', 'Sua sessão terminou. Entre de novo.', s, codigo);
  }
  if (s === 403) return new ErroApi('permissao', detalhe ?? 'Seu perfil não tem acesso a isso.', s, codigo);
  if (s === 404) {
    if (!codigo && detalhe === 'Not Found') return new ErroApi('nao_implantado', 'Este recurso ainda não está disponível no sistema do Âmbar.', s, null);
    return new ErroApi('nao_encontrado', detalhe ?? 'Não encontrado. Pode ter sido removido.', s, codigo);
  }
  if (s === 409) {
    const msg = codigo === 'conflito_versao' ? 'Alguém alterou isto enquanto você editava. Os dados foram recarregados: confira e tente de novo.' : detalhe ?? 'Esta ação conflita com o estado atual. Recarregue e confira.';
    return new ErroApi('conflito', msg, s, codigo, {}, corpo.dados ?? null);
  }
  if (s === 422 || s === 400) return new ErroApi('validacao', detalhe ?? (Object.keys(campos).length ? 'Confira os campos destacados.' : 'Dados inválidos.'), s, codigo, campos, corpo.dados ?? null);
  if (s === 429) return new ErroApi('limite', 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.', s, codigo);
  if (s === 413) return new ErroApi('arquivo', 'O arquivo é grande demais.', s, codigo);
  if (s === 415) return new ErroApi('arquivo', 'Este tipo de arquivo não é aceito.', s, codigo);
  if (s === 502 || s === 503) return new ErroApi('indisponivel', detalhe ?? 'O sistema do Âmbar está indisponível no momento. Tente de novo em instantes.', s, codigo);
  return new ErroApi('servidor', 'O sistema teve um problema ao processar. Nada foi alterado; tente de novo.', s, codigo);
}

function traduzirValidacao(msg?: string): string {
  if (!msg) return 'Valor inválido.';
  if (/field required/i.test(msg)) return 'Campo obrigatório.';
  if (/at least (\d+) character/i.test(msg)) return `Use pelo menos ${/at least (\d+)/i.exec(msg)?.[1]} caracteres.`;
  if (/at most (\d+) character/i.test(msg)) return `Use no máximo ${/at most (\d+)/i.exec(msg)?.[1]} caracteres.`;
  if (/greater than 0/i.test(msg)) return 'Informe um valor maior que zero.';
  if (/valid date/i.test(msg)) return 'Data inválida.';
  if (/valid email/i.test(msg)) return 'E-mail inválido.';
  return msg;
}

/** Chave de idempotência nova (um envio = uma chave; reenviar o MESMO formulário reaproveita a chave). */
export const novaChave = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
