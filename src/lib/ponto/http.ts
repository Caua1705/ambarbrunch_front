// Cliente do quiosque de ponto. Fala direto com a API (os quadros não passam pela Vercel). A credencial do tablet mora num
// cookie HttpOnly que o JavaScript não lê: nada de token em armazenamento do navegador, na página ou na URL.
import { ErroPonto, type ConfiguracaoQuiosque, type Recibo, type ResultadoCaptura, type SessaoAberta, type TipoBatida } from './contrato';

const BASE = (import.meta.env.PUBLIC_PONTO_API_URL || import.meta.env.PUBLIC_RESERVAS_API_URL || '').trim().replace(/\/+$/, '');
const TEMPO_PADRAO = 15_000;
const TEMPO_ENVIO = 30_000;

export const apiConfigurada = () => !!BASE;

interface Opcoes {
  metodo?: 'GET' | 'POST';
  corpo?: unknown;
  formulario?: FormData;
  chave?: string;
  portador?: string;
  tempo?: number;
  credenciais?: RequestCredentials;
}

async function chamar<T>(caminho: string, o: Opcoes = {}): Promise<T> {
  const metodo = o.metodo ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (metodo !== 'GET') headers['X-Ponto'] = '1';
  if (o.portador) headers.Authorization = `Bearer ${o.portador}`;
  if (o.chave) headers['Idempotency-Key'] = o.chave;
  let body: BodyInit | undefined;
  if (o.formulario) body = o.formulario;
  else if (o.corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(o.corpo);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/quiosque/ponto${caminho}`, {
      method: metodo,
      headers,
      body,
      credentials: o.credenciais ?? 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(o.tempo ?? TEMPO_PADRAO),
    });
  } catch {
    throw new ErroPonto('Sem conexão com o sistema.', 0, null, null, true);
  }
  if (res.status === 204) return undefined as T;
  const dados = (await res.json().catch(() => ({}))) as { detail?: unknown; codigo?: string; dados?: Record<string, unknown> } & T;
  if (res.ok) return dados;
  throw new ErroPonto(typeof dados.detail === 'string' ? dados.detail : 'Não foi possível concluir.', res.status, dados.codigo ?? null, dados.dados ?? null);
}

/**
 * Primeira leitura do tablet. Backend sem CORS com cookie (versão publicada antes do pareamento) faz o navegador esconder a
 * resposta, que parece falta de internet: uma segunda tentativa sem cookie separa "desativado" de "sem conexão".
 */
export async function lerConfiguracao(): Promise<ConfiguracaoQuiosque> {
  try {
    return await chamar<ConfiguracaoQuiosque>('/configuracao');
  } catch (e) {
    if (!(e instanceof ErroPonto) || !e.rede) throw e;
    return chamar<ConfiguracaoQuiosque>('/configuracao', { credenciais: 'omit' });
  }
}

/** Troca o token, digitado uma vez, pelo cookie HttpOnly. O token não fica guardado em lugar nenhum daqui. */
export const parear = (token: string) => chamar<void>('/parear', { metodo: 'POST', portador: token });

export const abrirSessao = () => chamar<SessaoAberta>('/sessoes', { metodo: 'POST' });

export const enviarCaptura = (sessaoId: string, formulario: FormData) =>
  chamar<ResultadoCaptura>(`/sessoes/${sessaoId}/captura`, { metodo: 'POST', formulario, tempo: TEMPO_ENVIO });

export const cancelarSessao = (sessaoId: string, motivo: 'desistencia' | 'camera_indisponivel' | 'tempo_esgotado' | 'outro') =>
  chamar<void>(`/sessoes/${sessaoId}/cancelar`, { metodo: 'POST', corpo: { motivo } }).catch(() => undefined);

export const registrarBatida = (sessaoId: string, autorizacao: string, chave: string, tipo?: TipoBatida) =>
  chamar<Recibo>('/marcacoes', { metodo: 'POST', chave, corpo: { sessao_id: sessaoId, autorizacao, ...(tipo ? { tipo } : {}) } });
