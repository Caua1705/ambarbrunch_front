// Câmera e captura de quadros do ponto: usadas pelo tablet (/ponto) e pelo cadastro facial do painel. Aqui não há nenhum
// reconhecimento: quem decide é o backend. Os quadros vivem só na memória desta tentativa e nunca vão para armazenamento
// do navegador. Saem crus, sem espelhar: espelhar troca esquerda e direita e reprovaria o desafio de pose.

export type Pose = 'frente' | 'esquerda' | 'direita';
export type FalhaCamera = 'permissao' | 'ausente' | 'ocupada' | 'contexto';

export class ErroCamera extends Error {
  constructor(public motivo: FalhaCamera) {
    super(motivo);
  }
}

// 480 × 640: o modelo de prova de vida foi treinado em 3:4 retrato (API.md, seção 3).
const LARGURA = 480;
const ALTURA = 640;
const QUALIDADE = 0.85;
const QUALIDADE_REDUZIDA = 0.7;
const INTERVALO_MS = 250;
/** Tempo para virar o rosto depois de cada instrução. */
const PREPARO_MS = 700;
const QUADROS_PADRAO = 12;

export async function abrirCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new ErroCamera('contexto');
  let fluxo: MediaStream;
  try {
    fluxo = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
    });
  } catch (e) {
    const nome = (e as DOMException).name;
    if (nome === 'NotAllowedError' || nome === 'SecurityError') throw new ErroCamera('permissao');
    if (nome === 'NotFoundError' || nome === 'OverconstrainedError') throw new ErroCamera('ausente');
    throw new ErroCamera('ocupada');
  }
  video.srcObject = fluxo;
  try {
    await video.play();
  } catch {
    pararCamera(fluxo, video);
    throw new ErroCamera('ocupada');
  }
  return fluxo;
}

export function pararCamera(fluxo: MediaStream | null, video?: HTMLVideoElement | null) {
  fluxo?.getTracks().forEach((t) => t.stop());
  if (video) video.srcObject = null;
}

function enquadrar(video: HTMLVideoElement, contexto: CanvasRenderingContext2D) {
  const vl = video.videoWidth;
  const va = video.videoHeight;
  const corteL = Math.min(vl, va * (LARGURA / ALTURA));
  const corteA = Math.min(va, vl * (ALTURA / LARGURA));
  contexto.drawImage(video, (vl - corteL) / 2, (va - corteA) / 2, corteL, corteA, 0, 0, LARGURA, ALTURA);
}

/**
 * JPEG na hora, SÍNCRONO (toDataURL). 18/11/2026: o `canvas.toBlob` do Chrome codifica em "tempo ocioso" da página e, no
 * tablet (câmera ligada, animações, medida de luz), pode demorar segundos por quadro — suspeita principal dos ~20 s em
 * "Rosto encontrado. Segure assim". Aqui o custo é fixo (dezenas de ms por quadro de 480×640) e não depende da página ociosa.
 */
export function codificarJpeg(canvas: HTMLCanvasElement, qualidade: number): Blob {
  const url = canvas.toDataURL('image/jpeg', qualidade);
  if (!url.startsWith('data:image/jpeg')) throw new Error('quadro vazio');
  const binario = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

const cancelada = () => new DOMException('cancelada', 'AbortError');

// Cancelar antes da espera também vale (antes, um sinal já cancelado era ignorado e a captura seguia até enviar).
const esperar = (ms: number, sinal?: AbortSignal) =>
  new Promise<void>((ok, falha) => {
    if (sinal?.aborted) return falha(cancelada());
    const t = setTimeout(ok, ms);
    sinal?.addEventListener('abort', () => {
      clearTimeout(t);
      falha(cancelada());
    }, { once: true });
  });

/** Espera a câmera entregar o primeiro quadro de verdade (no lugar de uma pausa fixa). */
export async function aguardarVideo(video: HTMLVideoElement, maxMs = 1_500, sinal?: AbortSignal): Promise<void> {
  const fim = Date.now() + maxMs;
  while (!(video.readyState >= 2 && video.videoWidth > 0) && Date.now() < fim) await esperar(40, sinal);
}

/** O que a prévia de enquadramento do backend diz de um quadro (não identifica ninguém). */
export interface Orientacao {
  orientacao: 'ok' | 'sem_rosto' | 'varios_rostos' | 'aproxime' | 'afaste' | 'pouca_luz' | 'luz_excessiva' | 'parado' | 'ocupado' | string;
  pose: string | null;
}

export interface OpcoesCaptura {
  desafio: string[];
  quadrosMax?: number;
  /** Teto por quadro, em KB (`quadro_max_kb`). */
  maxKb?: number;
  /** Tempo para a pessoa chegar em cada pose antes dos quadros (padrão do tablet: PREPARO_MS). */
  preparoMs?: number;
  /** Avisa a pose pedida agora, para a tela orientar. */
  aoPose?: (pose: string, indice: number, total: number) => void;
  /**
   * Captura GUIADA: antes dos quadros de cada pose, pergunta ao backend (prévia de enquadramento) até a pose pedida
   * aparecer com o rosto bem enquadrado, e só então captura — no lugar da janela fixa de tempo. Erro ou sem resposta:
   * cai na janela fixa (quem decide continua sendo o backend, com a captura inteira).
   */
  conferir?: (quadro: Blob) => Promise<Orientacao | null>;
  /** O que dizer agora (aproxime, luz…), e se a pose pedida já foi vista. */
  aoOrientacao?: (o: Orientacao, poseCerta: boolean) => void;
  /** Quanto esperar a pose aparecer, por pose, na captura guiada. */
  esperaMaxMs?: number;
  /** Intervalo entre quadros da mesma pose (padrão INTERVALO_MS). O ponto usa menor: identificação na hora. */
  intervaloMs?: number;
  /** Todos os quadros já foram tirados (falta só codificar): a tela pode desligar a câmera e liberar a pessoa. */
  aoTirarQuadros?: () => void;
  sinal?: AbortSignal;
}

/** Captura enquanto orienta pose a pose. O backend confere a ordem das poses, então cada pose recebe a sua parte dos quadros. */
export async function capturarQuadros(video: HTMLVideoElement, opcoes: OpcoesCaptura): Promise<Blob[]> {
  const { desafio, quadrosMax = QUADROS_PADRAO, maxKb = 400, preparoMs = PREPARO_MS, aoPose, conferir, aoOrientacao, esperaMaxMs = 8_000, intervaloMs = INTERVALO_MS, aoTirarQuadros, sinal } = opcoes;
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new ErroCamera('ocupada');
  const total = Math.min(quadrosMax, QUADROS_PADRAO);
  const porPose = Math.max(1, Math.floor(total / desafio.length));
  // Os quadros são TIRADOS no ritmo de sempre (mesma quantidade, mesmo intervalo, mesma ordem de poses) e só codificados
  // depois: a pessoa fica parada só o tempo de tirar (~0,6 s no ponto), nunca o da codificação ou do envio.
  const tirados: HTMLCanvasElement[] = [];
  let guiada = !!conferir;
  for (let p = 0; p < desafio.length; p++) {
    aoPose?.(desafio[p], p, desafio.length);
    if (guiada) guiada = await esperarPose(video, contexto, canvas, desafio[p], conferir!, aoOrientacao, esperaMaxMs, sinal);
    if (!guiada) await esperar(preparoMs, sinal);
    for (let q = 0; q < porPose; q++) {
      if (sinal?.aborted) throw cancelada();
      const quadro = document.createElement('canvas');
      quadro.width = LARGURA;
      quadro.height = ALTURA;
      const ctx = quadro.getContext('2d');
      if (!ctx) throw new ErroCamera('ocupada');
      enquadrar(video, ctx);
      tirados.push(quadro);
      if (q < porPose - 1) await esperar(intervaloMs, sinal);
    }
  }
  if (sinal?.aborted) throw cancelada();
  aoTirarQuadros?.();
  return tirados.map((quadro) => {
    const jpeg = codificarJpeg(quadro, QUALIDADE);
    return jpeg.size > maxKb * 1024 ? codificarJpeg(quadro, QUALIDADE_REDUZIDA) : jpeg;
  });
}

/**
 * Espera a pose pedida aparecer, bem enquadrada, numa prévia do backend. Devolve false se a prévia não responde (sem rede,
 * backend antigo): aí a captura segue na janela fixa. Tempo esgotado também segue (o backend julga a captura inteira).
 */
async function esperarPose(video: HTMLVideoElement, contexto: CanvasRenderingContext2D, canvas: HTMLCanvasElement, pose: string,
  conferir: (q: Blob) => Promise<Orientacao | null>, aoOrientacao: OpcoesCaptura['aoOrientacao'], esperaMaxMs: number, sinal?: AbortSignal): Promise<boolean> {
  const fim = Date.now() + esperaMaxMs;
  let falhas = 0;
  while (Date.now() < fim) {
    if (sinal?.aborted) throw cancelada();
    enquadrar(video, contexto);
    const quadro = codificarJpeg(canvas, QUALIDADE_REDUZIDA);
    const r = await conferir(quadro).catch(() => null);
    if (!r) {
      if (++falhas >= 2) return false;
      continue;
    }
    if (r.orientacao === 'ocupado') {
      await esperar(200, sinal);
      continue;
    }
    const certa = r.orientacao === 'ok' && r.pose === pose;
    aoOrientacao?.(r, certa);
    if (certa) return true;
    await esperar(120, sinal);
  }
  return true;
}

/** Sem bloquear: só avisa a pessoa antes da captura. Quem reprova por luz é o backend. */
export function medirLuz(video: HTMLVideoElement): 'ok' | 'escuro' | 'claro' {
  if (!video.videoWidth) return 'ok';
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 32;
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  if (!contexto) return 'ok';
  contexto.drawImage(video, 0, 0, 24, 32);
  const { data } = contexto.getImageData(0, 0, 24, 32);
  let soma = 0;
  for (let i = 0; i < data.length; i += 4) soma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const media = soma / (data.length / 4);
  return media < 50 ? 'escuro' : media > 215 ? 'claro' : 'ok';
}

/** `tempos`: etapas medidas no aparelho (ms desde o toque), só para o log de desempenho do backend. */
export function montarFormulario(nonce: string, quadros: Blob[], tempos?: Record<string, number>): FormData {
  const formulario = new FormData();
  formulario.append('nonce', nonce);
  if (tempos) formulario.append('tempos', JSON.stringify(tempos));
  quadros.forEach((q, i) => formulario.append('quadros', q, `${i}.jpg`));
  return formulario;
}

/** Prévia de enquadramento direto na API, com o token curto da sessão. Erro de rede/HTTP: null (a captura segue sem guia). */
export function conferidorDaApi(url: string, token: string): (quadro: Blob) => Promise<Orientacao | null> {
  return async (quadro) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
        body: quadro,
        credentials: 'omit',
        signal: AbortSignal.timeout(4_000),
      });
      if (!res.ok) return null;
      return (await res.json()) as Orientacao;
    } catch {
      return null;
    }
  };
}

/** Frase curta para a tela, a partir da prévia. `instrucao` = o que fazer para a pose pedida. */
export function textoDaOrientacao(o: Orientacao, poseCerta: boolean, instrucao: string): string {
  switch (o.orientacao) {
    case 'sem_rosto': return 'Posicione o rosto dentro da área indicada';
    case 'varios_rostos': return 'Só uma pessoa na frente da câmera';
    case 'aproxime': return 'Aproxime um pouco';
    case 'afaste': return 'Afaste um pouco';
    case 'pouca_luz': return 'Melhore a iluminação';
    case 'luz_excessiva': return 'Luz forte demais atrás de você';
    case 'parado': return 'Segure firme um instante';
    default: return poseCerta ? 'Rosto encontrado. Segure assim' : instrucao;
  }
}

export const INSTRUCOES_CAMERA: Record<FalhaCamera, string> = {
  permissao: 'A câmera está bloqueada neste aparelho. Libere o acesso nas permissões do navegador ou procure o gestor.',
  ausente: 'Nenhuma câmera foi encontrada neste aparelho. Procure o gestor.',
  ocupada: 'A câmera não respondeu. Feche outros aplicativos que usam a câmera ou procure o gestor.',
  contexto: 'A câmera só funciona em conexão segura (https). Procure o gestor.',
};
