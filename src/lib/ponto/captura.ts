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

const paraJpeg = (canvas: HTMLCanvasElement, qualidade: number) =>
  new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('quadro vazio'))), 'image/jpeg', qualidade));

const esperar = (ms: number, sinal?: AbortSignal) =>
  new Promise<void>((ok, falha) => {
    const t = setTimeout(ok, ms);
    sinal?.addEventListener('abort', () => {
      clearTimeout(t);
      falha(new DOMException('cancelada', 'AbortError'));
    }, { once: true });
  });

export interface OpcoesCaptura {
  desafio: string[];
  quadrosMax?: number;
  /** Teto por quadro, em KB (`quadro_max_kb`). */
  maxKb?: number;
  /** Avisa a pose pedida agora, para a tela orientar. */
  aoPose?: (pose: string, indice: number, total: number) => void;
  sinal?: AbortSignal;
}

/** Captura enquanto orienta pose a pose. O backend confere a ordem das poses, então cada pose recebe a sua parte dos quadros. */
export async function capturarQuadros(video: HTMLVideoElement, opcoes: OpcoesCaptura): Promise<Blob[]> {
  const { desafio, quadrosMax = QUADROS_PADRAO, maxKb = 400, aoPose, sinal } = opcoes;
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new ErroCamera('ocupada');
  const total = Math.min(quadrosMax, QUADROS_PADRAO);
  const porPose = Math.max(1, Math.floor(total / desafio.length));
  const quadros: Blob[] = [];
  for (let p = 0; p < desafio.length; p++) {
    aoPose?.(desafio[p], p, desafio.length);
    await esperar(PREPARO_MS, sinal);
    for (let q = 0; q < porPose; q++) {
      enquadrar(video, contexto);
      let jpeg = await paraJpeg(canvas, QUALIDADE);
      if (jpeg.size > maxKb * 1024) jpeg = await paraJpeg(canvas, QUALIDADE_REDUZIDA);
      quadros.push(jpeg);
      if (q < porPose - 1) await esperar(INTERVALO_MS, sinal);
    }
  }
  return quadros;
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

export function montarFormulario(nonce: string, quadros: Blob[]): FormData {
  const formulario = new FormData();
  formulario.append('nonce', nonce);
  quadros.forEach((q, i) => formulario.append('quadros', q, `${i}.jpg`));
  return formulario;
}

export const INSTRUCOES_CAMERA: Record<FalhaCamera, string> = {
  permissao: 'A câmera está bloqueada neste aparelho. Libere o acesso nas permissões do navegador ou procure o gestor.',
  ausente: 'Nenhuma câmera foi encontrada neste aparelho. Procure o gestor.',
  ocupada: 'A câmera não respondeu. Feche outros aplicativos que usam a câmera ou procure o gestor.',
  contexto: 'A câmera só funciona em conexão segura (https). Procure o gestor.',
};
