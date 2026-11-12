// Modo Operação (tablet do café): terminal de ponto e checklist de abertura.
//  - /admin/api/ponto/terminal/* → /admin/ponto/terminal/* do backend, com a sessão da conta logada (sem código de tablet);
//  - /admin/api/abertura/*       → /admin/abertura/*.
// Arquivos grandes (os quadros do rosto e o vídeo da abertura) vão do navegador DIRETO à API, com um token curto que só
// vale para aquela sessão/aquele checklist: não passam pelo servidor do painel (que tem limite de tamanho de corpo).
import { converterErro, ErroApi, montarQuery, pedir, unidadeDaPagina } from './cliente';
import type { Recibo, TipoBatida } from '../../../lib/ponto/contrato';
import type {
  AberturaHoje,
  ChecklistAbertura,
  ConfiguracaoQuiosque,
  EnvioVideo,
  PaginaAberturas,
  ResultadoCaptura,
  SessaoTerminal,
  SituacaoItem,
  TarefaModelo,
} from '../tipos/abertura';

const T = 'ponto/terminal';
const A = 'abertura';
const TEMPO_ENVIO = 30_000;

/** Erro de uma chamada direta à API (sem a ponte): 401 aqui é o token curto vencido, não a sessão do painel. */
async function erroDireto(res: Response): Promise<ErroApi> {
  if (res.status === 401) return new ErroApi('validacao', 'O tempo para enviar acabou. Tente de novo.', 401, 'token_vencido');
  return converterErro(res);
}

export const terminal = {
  configuracao: () => pedir<ConfiguracaoQuiosque>(`${T}/configuracao`),
  abrirSessao: () => pedir<SessaoTerminal>(`${T}/sessoes`, { metodo: 'POST' }),
  cancelar: (sessaoId: string, motivo: 'desistencia' | 'camera_indisponivel' | 'tempo_esgotado' | 'outro') =>
    pedir<void>(`${T}/sessoes/${sessaoId}/cancelar`, { metodo: 'POST', corpo: { motivo } }).catch(() => undefined),
  /** Confirmação explícita na tela: grava a batida. Repetir com a MESMA chave nunca grava duas. */
  bater: (sessaoId: string, autorizacao: string, chave: string, tipo?: TipoBatida) =>
    pedir<Recibo>(`${T}/marcacoes`, { metodo: 'POST', idempotencia: chave, corpo: { sessao_id: sessaoId, autorizacao, ...(tipo ? { tipo } : {}) } }),
};

/** Quadros da identificação: direto à API com o `captura_token`; sem URL da API (demonstração), pela ponte. */
export async function enviarCaptura(sessao: SessaoTerminal, formulario: FormData, apiUrl: string | null): Promise<ResultadoCaptura> {
  if (!sessao.captura_token || !apiUrl) return pedir<ResultadoCaptura>(`${T}/sessoes/${sessao.sessao_id}/captura`, { metodo: 'POST', formulario });
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/admin/${T}/sessoes/${sessao.sessao_id}/captura-direta`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessao.captura_token}` },
      body: formulario,
      credentials: 'omit',
      signal: AbortSignal.timeout(TEMPO_ENVIO),
    });
  } catch {
    throw new ErroApi('rede', 'Sem conexão. Confira a internet e tente de novo.');
  }
  if (res.ok) return (await res.json()) as ResultadoCaptura;
  throw await erroDireto(res);
}

export const abertura = {
  hoje: () => pedir<AberturaHoje>(`${A}/hoje`),
  assumirPeloRosto: (sessaoId: string, autorizacao: string) =>
    pedir<ChecklistAbertura>(`${A}/hoje/assumir`, { metodo: 'POST', corpo: { sessao_id: sessaoId, autorizacao } }),
  assumirDeclarada: (funcionarioId: string) => pedir<ChecklistAbertura>(`${A}/hoje/assumir`, { metodo: 'POST', corpo: { funcionario_id: funcionarioId } }),
  salvar: (id: string, itens: { id: string; situacao: SituacaoItem | null; observacao: string | null }[], observacao?: string | null) =>
    pedir<ChecklistAbertura>(`${A}/${id}`, { metodo: 'PATCH', corpo: { itens, ...(observacao !== undefined ? { observacao } : {}) } }),
  autorizarEnvio: (id: string) => pedir<EnvioVideo>(`${A}/${id}/video/envio`, { metodo: 'POST' }),
  concluir: (id: string, semVideoMotivo?: string | null) =>
    pedir<ChecklistAbertura>(`${A}/${id}/concluir`, { metodo: 'POST', corpo: { sem_video_motivo: semVideoMotivo || null } }),
  // consulta (gerência)
  listar: (de: string, ate: string) => pedir<PaginaAberturas>(A, { query: { de, ate, limite: 200 } }),
  detalhe: (id: string) => pedir<ChecklistAbertura>(`${A}/${id}`),
  linkVideo: (id: string) => pedir<{ url: string | null; mime: string; expira_em: string }>(`${A}/${id}/video`),
  confirmarResponsavel: (id: string) => pedir<ChecklistAbertura>(`${A}/${id}/confirmar-responsavel`, { metodo: 'POST' }),
  // modelo (Proprietário)
  modelo: () => pedir<TarefaModelo[]>(`${A}/modelo`),
  criarTarefa: (titulo: string) => pedir<TarefaModelo>(`${A}/modelo`, { metodo: 'POST', corpo: { titulo } }),
  alterarTarefa: (id: string, mudanca: { titulo?: string; ativo?: boolean }) => pedir<TarefaModelo>(`${A}/modelo/${id}`, { metodo: 'PATCH', corpo: mudanca }),
  ordenar: (ids: string[]) => pedir<void>(`${A}/modelo/ordem`, { metodo: 'PUT', corpo: { ids } }),
};

/** Endereço para assistir quando o armazenamento não dá link assinado (desenvolvimento): o arquivo pela ponte. */
export const conteudoDoVideo = (id: string) => `/admin/api/${A}/${id}/video/conteudo${montarQuery({ unidade: unidadeDaPagina() })}`;

/**
 * Envio do vídeo com progresso (XMLHttpRequest: o fetch não informa o progresso do upload). Direto à API com o token curto
 * do checklist; sem URL da API (demonstração), pela ponte. Nunca envia duas vezes ao mesmo tempo: quem chama trava o botão
 * e, se der erro, o mesmo arquivo pode ser reenviado (o backend reconhece o mesmo conteúdo e não duplica).
 */
export function enviarVideo(envio: EnvioVideo, arquivo: Blob, duracaoS: number | null, apiUrl: string | null,
  aoProgresso: (fracao: number) => void, sinal?: AbortSignal): Promise<ChecklistAbertura & { repetido?: boolean }> {
  const direto = !!apiUrl;
  const query = montarQuery({ duracao: duracaoS !== null ? Math.round(duracaoS) : null, ...(direto ? {} : { unidade: unidadeDaPagina() }) });
  const url = direto ? `${apiUrl}${envio.caminho}${query}` : `/admin/api${envio.caminho.replace(/^\/admin/, '')}${query}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', arquivo.type || 'application/octet-stream');
    if (direto) xhr.setRequestHeader('Authorization', `Bearer ${envio.token}`);
    else xhr.setRequestHeader('X-Painel', '1');
    xhr.withCredentials = !direto;
    xhr.timeout = 10 * 60_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && aoProgresso(e.loaded / e.total);
    xhr.onload = async () => {
      const res = new Response(xhr.responseText || '{}', { status: xhr.status, headers: { 'Content-Type': 'application/json' } });
      if (xhr.status >= 200 && xhr.status < 300) return resolve(JSON.parse(xhr.responseText));
      reject(direto ? await erroDireto(res) : await converterErro(res));
    };
    xhr.onerror = () => reject(new ErroApi('rede', 'O vídeo não foi enviado: sem conexão. Suas respostas estão salvas; tente enviar de novo.'));
    xhr.ontimeout = () => reject(new ErroApi('tempo', 'O envio demorou demais. Suas respostas estão salvas; tente de novo com uma conexão melhor.'));
    xhr.onabort = () => reject(new ErroApi('rede', 'Envio cancelado.'));
    sinal?.addEventListener('abort', () => xhr.abort());
    xhr.send(arquivo);
  });
}
