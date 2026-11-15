// Vídeo da abertura, gravado no próprio tablet: UM botão "Gravar vídeo" → a câmera traseira abre → Iniciar → Parar (ou para
// sozinho no limite) → prévia → "Enviar vídeo" (com progresso) ou "Gravar de novo". Sem som.
//
// A gravação passa por um quadro de tamanho FIXO (720p, deitado ou em pé conforme o tablet no início): girar o tablet no
// meio não muda a resolução do arquivo (um MP4 H.264 com troca de resolução no meio pode não abrir). Preferência por MP4
// H.264, que o WhatsApp toca direto; sem ele, WebM (a Z-API converte). ~1,1 Mbps: 90 s ≈ 12 MB.
//
// Sem gravação no navegador (aparelho antigo) ou se a câmera falhar, a alternativa é a câmera do próprio Android (seletor de
// arquivo com captura): o vídeo volta para cá e, se vier grande demais, é recomprimido aqui mesmo para 720p antes de enviar.
//
// O vídeo gravado fica guardado no tablet (videoLocal.ts) até o servidor confirmar que salvou: recarregar a página ou cair a
// internet não perde a gravação. As respostas do checklist já estão no servidor e não dependem do vídeo.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Camera, Circle, RotateCcw, Square, Upload, Video } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { abertura, enviarVideo } from '../../lib/api/operacao';
import type { ChecklistAbertura } from '../../lib/tipos/abertura';
import { Aviso, Botao } from '../../ui/base';
import { apagarVideoLocal, guardarVideoLocal, lerVideoLocal } from './videoLocal';

const TIPOS = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
const LADO_MAIOR = 1280;
const QUADROS_POR_SEGUNDO = 24;
const BITS_POR_SEGUNDO = 1_100_000;
const RECOMENDADO_MIN = 30;
const RECOMENDADO_MAX = 60;

type Estado =
  | { e: 'inicio' }
  | { e: 'abrindo' }
  | { e: 'pronto' }
  | { e: 'gravando'; inicio: number }
  | { e: 'preparando'; fracao: number }
  | { e: 'previa'; arquivo: Blob; url: string; duracao: number | null; recuperado?: boolean }
  | { e: 'enviando'; arquivo: Blob; url: string; duracao: number | null; fracao: number };

function tipoSuportado(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return TIPOS.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? null;
}

const gravaNoNavegador = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && tipoSuportado() !== null &&
  typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;

const minSeg = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const par = (x: number) => Math.max(2, Math.round(x / 2) * 2);
const mb = (bytes: number) => (bytes / 1048576).toFixed(0);

/** Duração lida do próprio arquivo (o WebM do Chrome às vezes não informa; aí vale a medida da gravação). */
function lerDuracao(url: string): Promise<number | null> {
  return new Promise((ok) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => ok(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
    v.onerror = () => ok(null);
    v.src = url;
  });
}

/**
 * Grava o que aparece em `origem` (a câmera ou um vídeo tocando) num quadro de tamanho fixo, sem som. Devolve o gravador;
 * `aoParar` recebe o arquivo pronto.
 */
function gravarQuadro(origem: HTMLVideoElement, aoParar: (arquivo: Blob) => void): MediaRecorder {
  const tipo = tipoSuportado()!;
  const escala = Math.min(1, LADO_MAIOR / Math.max(origem.videoWidth || LADO_MAIOR, origem.videoHeight || 720));
  const largura = par((origem.videoWidth || LADO_MAIOR) * escala);
  const altura = par((origem.videoHeight || 720) * escala);
  const quadro = document.createElement('canvas');
  quadro.width = largura;
  quadro.height = altura;
  const ctx = quadro.getContext('2d', { alpha: false })!;
  let vivo = true;
  let ultimo = 0;
  const desenhar = (agora: number) => {
    if (!vivo) return;
    if (agora - ultimo >= 1000 / QUADROS_POR_SEGUNDO - 2) {
      ultimo = agora;
      const vw = origem.videoWidth;
      const vh = origem.videoHeight;
      if (vw && vh) {
        // Cabe inteiro no quadro (girou o tablet: aparece com faixas, mas o arquivo segue íntegro).
        const e = Math.min(largura / vw, altura / vh);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, largura, altura);
        ctx.drawImage(origem, (largura - vw * e) / 2, (altura - vh * e) / 2, vw * e, vh * e);
      }
    }
    requestAnimationFrame(desenhar);
  };
  requestAnimationFrame(desenhar);
  const fluxo = quadro.captureStream(QUADROS_POR_SEGUNDO);
  const gravador = new MediaRecorder(fluxo, { mimeType: tipo, videoBitsPerSecond: BITS_POR_SEGUNDO });
  const partes: Blob[] = [];
  gravador.ondataavailable = (ev) => {
    if (ev.data.size) partes.push(ev.data);
  };
  gravador.onstop = () => {
    vivo = false;
    fluxo.getTracks().forEach((t) => t.stop());
    aoParar(new Blob(partes, { type: (gravador.mimeType || tipo).split(';')[0] }));
  };
  gravador.start(1000);
  return gravador;
}

/** Vídeo da câmera do aparelho grande demais: toca escondido e regrava em 720p (leva o tempo do próprio vídeo). */
function recomprimir(arquivo: Blob, aoProgresso: (fracao: number) => void): Promise<Blob> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onerror = () => {
      URL.revokeObjectURL(url);
      falha(new Error('video_ilegivel'));
    };
    v.onloadedmetadata = async () => {
      const gravador = gravarQuadro(v, (pronto) => {
        URL.revokeObjectURL(url);
        ok(pronto);
      });
      const t = setInterval(() => v.duration && aoProgresso(Math.min(1, v.currentTime / v.duration)), 500);
      v.onended = () => {
        clearInterval(t);
        if (gravador.state === 'recording') gravador.stop();
      };
      try {
        await v.play();
      } catch {
        clearInterval(t);
        if (gravador.state === 'recording') gravador.stop();
        falha(new Error('video_ilegivel'));
      }
    };
  });
}

export function GravadorVideo({ checklistId, maxMb, maxSegundos, apiUrl, aoSalvar, aoCancelar }: {
  checklistId: string;
  maxMb: number;
  maxSegundos: number;
  apiUrl: string | null;
  aoSalvar: (c: ChecklistAbertura) => void;
  aoCancelar?: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ e: 'inicio' });
  const [erro, setErro] = useState<string | null>(null);
  const [pelaCameraDoTablet, setPelaCameraDoTablet] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const aoVivo = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const inicioRef = useRef(0);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const envioRef = useRef<AbortController | null>(null);
  const noNavegador = gravaNoNavegador();

  const desligar = () => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    if (aoVivo.current) aoVivo.current.srcObject = null;
  };
  useEffect(() => () => {
    envioRef.current?.abort();
    if (gravador.current?.state === 'recording') gravador.current.stop();
    desligar();
  }, []);
  // Gravou e não enviou (recarregou a página, caiu a internet): o vídeo volta para enviar.
  useEffect(() => {
    void lerVideoLocal(checklistId).then((v) => {
      if (!v) return;
      setEstado((s) => (s.e === 'inicio' ? { e: 'previa', arquivo: v.arquivo, url: URL.createObjectURL(v.arquivo), duracao: v.duracao, recuperado: true } : s));
    });
  }, [checklistId]);
  useEffect(() => {
    if (estado.e !== 'gravando') return;
    const t = setInterval(() => {
      setAgora(Date.now());
      if ((Date.now() - estado.inicio) / 1000 >= maxSegundos) parar();
    }, 250);
    return () => clearInterval(t);
  }, [estado]);
  const urlAtual = estado.e === 'previa' || estado.e === 'enviando' ? estado.url : null;
  useEffect(() => () => {
    if (urlAtual) URL.revokeObjectURL(urlAtual);
  }, [urlAtual]);

  const gravar = () => {
    setErro(null);
    if (!noNavegador || pelaCameraDoTablet) return arquivoRef.current?.click();
    void abrirCamera();
  };

  const abrirCamera = async () => {
    setEstado({ e: 'abrindo' });
    try {
      fluxo.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: QUADROS_POR_SEGUNDO } },
      });
      const v = aoVivo.current!;
      v.srcObject = fluxo.current;
      await v.play().catch(() => undefined);
      setEstado({ e: 'pronto' });
    } catch (e) {
      desligar();
      const nome = (e as DOMException).name;
      setPelaCameraDoTablet(true);
      setErro(nome === 'NotAllowedError' || nome === 'SecurityError'
        ? 'A câmera está bloqueada para o painel. Toque em Gravar vídeo para usar a câmera do tablet.'
        : 'A câmera não abriu aqui. Toque em Gravar vídeo para usar a câmera do tablet.');
      setEstado({ e: 'inicio' });
    }
  };

  const iniciar = () => {
    const v = aoVivo.current;
    if (!v || !fluxo.current) return;
    try {
      inicioRef.current = Date.now();
      gravador.current = gravarQuadro(v, (arquivo) => {
        desligar();
        void mostrarPrevia(arquivo, (Date.now() - inicioRef.current) / 1000);
      });
      setEstado({ e: 'gravando', inicio: inicioRef.current });
    } catch {
      desligar();
      setPelaCameraDoTablet(true);
      setErro('Este navegador não grava vídeo. Toque em Gravar vídeo para usar a câmera do tablet.');
      setEstado({ e: 'inicio' });
    }
  };

  const parar = () => {
    if (gravador.current?.state === 'recording') gravador.current.stop();
  };

  const cancelarCamera = () => {
    desligar();
    setEstado({ e: 'inicio' });
    aoCancelar?.();
  };

  const mostrarPrevia = async (arquivo: Blob, medida: number | null) => {
    const url = URL.createObjectURL(arquivo);
    const duracao = (await lerDuracao(url)) ?? medida;
    if (duracao !== null && duracao > maxSegundos + 5) {
      URL.revokeObjectURL(url);
      setErro(`O vídeo tem ${minSeg(duracao)}. O máximo é ${minSeg(maxSegundos)}: grave de novo, mais curto.`);
      return setEstado({ e: 'inicio' });
    }
    if (arquivo.size > maxMb * 1024 * 1024) {
      URL.revokeObjectURL(url);
      setErro(`O vídeo ficou com ${mb(arquivo.size)} MB (máximo ${maxMb} MB). Grave de novo, mais curto.`);
      return setEstado({ e: 'inicio' });
    }
    void guardarVideoLocal(checklistId, { arquivo, duracao, gravado_em: Date.now() });
    setEstado({ e: 'previa', arquivo, url, duracao });
  };

  /** Vídeo da câmera do aparelho: confere a duração e, se passar do tamanho, recomprime em 720p. */
  const doAparelho = async (lista: FileList | null) => {
    const arquivo = lista?.[0];
    if (arquivoRef.current) arquivoRef.current.value = '';
    if (!arquivo) return;
    setErro(null);
    if (!arquivo.type.startsWith('video/')) return setErro('Isso não é um vídeo. Toque em Gravar vídeo de novo.');
    const url = URL.createObjectURL(arquivo);
    const duracao = await lerDuracao(url);
    URL.revokeObjectURL(url);
    if (duracao !== null && duracao > maxSegundos + 5) {
      return setErro(`O vídeo tem ${minSeg(duracao)}. O máximo é ${minSeg(maxSegundos)}: grave de novo, mais curto.`);
    }
    if (arquivo.size <= maxMb * 1024 * 1024) return mostrarPrevia(arquivo, duracao);
    if (tipoSuportado() === null) {
      return setErro(`O vídeo ficou com ${mb(arquivo.size)} MB (máximo ${maxMb} MB). Grave de novo, mais curto.`);
    }
    setEstado({ e: 'preparando', fracao: 0 });
    try {
      const menor = await recomprimir(arquivo, (fracao) => setEstado({ e: 'preparando', fracao }));
      await mostrarPrevia(menor, duracao);
    } catch {
      setErro('Não foi possível preparar este vídeo. Grave de novo.');
      setEstado({ e: 'inicio' });
    }
  };

  const descartar = () => {
    setErro(null);
    void apagarVideoLocal(checklistId);
    setEstado({ e: 'inicio' });
  };

  const enviar = async () => {
    if (estado.e !== 'previa') return;   // trava contra toque duplo
    const { arquivo, url, duracao } = estado;
    setErro(null);
    setEstado({ e: 'enviando', arquivo, url, duracao, fracao: 0 });
    envioRef.current = new AbortController();
    try {
      const envio = await abertura.autorizarEnvio(checklistId);
      const salvo = await enviarVideo(envio, arquivo, duracao, apiUrl, (fracao) => setEstado((s) => (s.e === 'enviando' ? { ...s, fracao } : s)), envioRef.current.signal);
      // Sucesso só com o vídeo confirmado pelo servidor.
      if (!salvo.video) throw new ErroApi('validacao', 'O servidor não confirmou o vídeo.');
      void apagarVideoLocal(checklistId);
      aoSalvar(salvo);
    } catch (e) {
      setErro(`${e instanceof ErroApi ? e.message : 'O vídeo não foi enviado.'} O vídeo continua guardado aqui: toque em Enviar vídeo de novo.`);
      setEstado({ e: 'previa', arquivo, url, duracao });
    }
  };

  const gravandoHa = estado.e === 'gravando' ? Math.max(0, (agora - estado.inicio) / 1000) : 0;
  const camera = estado.e === 'abrindo' || estado.e === 'pronto' || estado.e === 'gravando';

  return (
    <div class="op-video" data-estado={estado.e}>
      <div class="op-video__tela" hidden={!camera}>
        <video ref={aoVivo} playsInline muted autoPlay aria-label="Câmera" />
        {estado.e === 'gravando' && (
          <span class={`op-video__rec${gravandoHa > RECOMENDADO_MAX ? ' op-video__rec--longo' : ''}`} role="timer" aria-live="off">
            <Circle aria-hidden="true" /> {minSeg(gravandoHa)} / {minSeg(maxSegundos)}
          </span>
        )}
      </div>
      {(estado.e === 'previa' || estado.e === 'enviando') && (
        <div class="op-video__tela">
          <video src={estado.url} controls playsInline muted aria-label="Prévia do vídeo da abertura" />
        </div>
      )}
      {estado.e === 'previa' && estado.recuperado && <p class="op-video__nota">Vídeo gravado e ainda não enviado.</p>}
      {estado.e === 'gravando' && (
        <p class="op-video__nota">
          {gravandoHa < RECOMENDADO_MIN
            ? `Mostre salão, vitrines, banheiros, entrada e jardim (${RECOMENDADO_MIN} a ${RECOMENDADO_MAX} s).`
            : gravandoHa <= RECOMENDADO_MAX ? 'Pode parar quando terminar.' : `Para sozinho em ${minSeg(maxSegundos)}.`}
        </p>
      )}
      {(estado.e === 'preparando' || estado.e === 'enviando') && (
        <div class="op-video__progresso" role="progressbar" aria-label={estado.e === 'enviando' ? 'Enviando o vídeo' : 'Preparando o vídeo'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estado.fracao * 100)}>
          <span style={{ width: `${Math.round(estado.fracao * 100)}%` }} />
          <small>{estado.e === 'enviando' ? 'Enviando…' : 'Preparando o vídeo…'} {Math.round(estado.fracao * 100)}%</small>
        </div>
      )}
      {erro && <Aviso tom="perigo">{erro}</Aviso>}

      <div class="op-video__acoes">
        {estado.e === 'inicio' && (
          <button type="button" class="op-terminal__principal" onClick={gravar}>
            {pelaCameraDoTablet || !noNavegador ? <Camera aria-hidden="true" /> : <Video aria-hidden="true" />} Gravar vídeo
          </button>
        )}
        {estado.e === 'abrindo' && <Botao carregando>Abrindo a câmera…</Botao>}
        {estado.e === 'pronto' && (
          <>
            <button type="button" class="op-terminal__principal op-video__iniciar" onClick={iniciar}>
              <Circle aria-hidden="true" /> Iniciar gravação
            </button>
            <Botao variante="fantasma" onClick={cancelarCamera}>Cancelar</Botao>
          </>
        )}
        {estado.e === 'gravando' && (
          <button type="button" class="op-terminal__principal op-video__parar" onClick={parar}>
            <Square aria-hidden="true" /> Parar
          </button>
        )}
        {estado.e === 'previa' && (
          <>
            <button type="button" class="op-terminal__principal" onClick={enviar}>
              <Upload aria-hidden="true" /> Enviar vídeo
            </button>
            <Botao icone={<RotateCcw aria-hidden="true" />} onClick={descartar}>Gravar de novo</Botao>
          </>
        )}
        {estado.e === 'enviando' && <Botao carregando>Enviando o vídeo…</Botao>}
      </div>
      <input ref={arquivoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => void doAparelho(e.currentTarget.files)} />
    </div>
  );
}
