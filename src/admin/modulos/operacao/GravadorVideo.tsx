// Vídeo da abertura, gravado no próprio tablet: câmera traseira, sem som, um vídeo só para o dia.
//   Abrir câmera → Gravar → Parar (ou para sozinho no limite) → assistir a prévia → Refazer ou Enviar.
// Gravação pelo navegador (MediaRecorder) quando o aparelho suporta; senão (ou se a câmera falhar), "Usar a câmera do
// aparelho": o seletor de arquivo do Android abre a câmera nativa e o vídeo volta para cá. Limites de tamanho e duração vêm
// do backend. O envio mostra o progresso, não sai duas vezes ao mesmo tempo e, se falhar, o arquivo continua aqui para
// tentar de novo — as respostas do checklist já estão salvas no servidor e não dependem do vídeo.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Camera, Circle, RotateCcw, Square, Upload, Video } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { abertura, enviarVideo } from '../../lib/api/operacao';
import type { ChecklistAbertura } from '../../lib/tipos/abertura';
import { Aviso, Botao } from '../../ui/base';

type Estado =
  | { e: 'parado' }
  | { e: 'abrindo' }
  | { e: 'pronto' }
  | { e: 'gravando'; inicio: number }
  | { e: 'previa'; arquivo: Blob; url: string; duracao: number | null }
  | { e: 'enviando'; arquivo: Blob; url: string; duracao: number | null; fracao: number };

const TIPOS = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
// Leve de propósito: o bucket privado aceita 15 MB por arquivo; ~0,9 Mbps em 960×540 deixa 2 min em ~13 MB e ainda
// mostra bem os ambientes.
const BITS_POR_SEGUNDO = 900_000;

function tipoSuportado(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return TIPOS.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

const minSeg = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Duração lida do próprio arquivo (o WebM do Chrome às vezes não informa; aí vale a medida da gravação). */
function lerDuracao(url: string): Promise<number | null> {
  return new Promise((ok) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => ok(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => ok(null);
    v.src = url;
  });
}

export function GravadorVideo({ checklistId, maxMb, maxSegundos, apiUrl, aoEnviar, aoCancelar }: {
  checklistId: string;
  maxMb: number;
  maxSegundos: number;
  apiUrl: string | null;
  aoEnviar: (c: ChecklistAbertura) => void;
  aoCancelar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ e: 'parado' });
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const ao_vivo = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const envioRef = useRef<AbortController | null>(null);
  const suportado = tipoSuportado() !== null && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const desligar = () => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    if (ao_vivo.current) ao_vivo.current.srcObject = null;
  };
  useEffect(() => () => {
    envioRef.current?.abort();
    if (gravador.current?.state === 'recording') gravador.current.stop();
    desligar();
  }, []);
  useEffect(() => {
    if (estado.e !== 'gravando') return;
    const t = setInterval(() => {
      setAgora(Date.now());
      if ((Date.now() - estado.inicio) / 1000 >= maxSegundos) parar();
    }, 250);
    return () => clearInterval(t);
  }, [estado]);
  // A prévia guarda um endereço local do vídeo: libera ao trocar de vídeo ou sair.
  const urlAtual = estado.e === 'previa' || estado.e === 'enviando' ? estado.url : null;
  useEffect(() => () => { if (urlAtual) URL.revokeObjectURL(urlAtual); }, [urlAtual]);

  const abrirCamera = async () => {
    setErro(null);
    setEstado({ e: 'abrindo' });
    try {
      fluxo.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 } },
      });
      const v = ao_vivo.current!;
      v.srcObject = fluxo.current;
      await v.play().catch(() => undefined);
      setEstado({ e: 'pronto' });
    } catch (e) {
      desligar();
      const nome = (e as DOMException).name;
      setErro(nome === 'NotAllowedError' || nome === 'SecurityError'
        ? 'A câmera está bloqueada para este site. Libere a câmera nas permissões do navegador, ou use a câmera do aparelho abaixo.'
        : 'A câmera não abriu. Use a câmera do aparelho abaixo.');
      setEstado({ e: 'parado' });
    }
  };

  const gravar = () => {
    if (!fluxo.current) return;
    const tipo = tipoSuportado() || undefined;
    pedacos.current = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(fluxo.current, { mimeType: tipo, videoBitsPerSecond: BITS_POR_SEGUNDO });
    } catch {
      setErro('Este navegador não grava vídeo. Use a câmera do aparelho abaixo.');
      return;
    }
    const inicio = Date.now();
    rec.ondataavailable = (ev) => ev.data.size && pedacos.current.push(ev.data);
    rec.onstop = async () => {
      desligar();
      const arquivo = new Blob(pedacos.current, { type: (rec.mimeType || tipo || 'video/webm').split(';')[0] });
      pedacos.current = [];
      const medida = (Date.now() - inicio) / 1000;
      await mostrarPrevia(arquivo, medida);
    };
    gravador.current = rec;
    rec.start(1000);
    setEstado({ e: 'gravando', inicio });
  };

  const parar = () => {
    if (gravador.current?.state === 'recording') gravador.current.stop();
  };

  const mostrarPrevia = async (arquivo: Blob, medida: number | null) => {
    if (arquivo.size > maxMb * 1024 * 1024) {
      setErro(`O vídeo ficou com ${(arquivo.size / 1024 / 1024).toFixed(0)} MB, acima do limite de ${maxMb} MB. Grave um vídeo mais curto.`);
      return setEstado({ e: 'parado' });
    }
    const url = URL.createObjectURL(arquivo);
    const lida = await lerDuracao(url);
    const duracao = lida ?? medida;
    if (duracao !== null && duracao > maxSegundos + 5) {
      URL.revokeObjectURL(url);
      setErro(`O vídeo tem ${minSeg(duracao)}; o limite é ${minSeg(maxSegundos)}. Grave um vídeo mais curto.`);
      return setEstado({ e: 'parado' });
    }
    setEstado({ e: 'previa', arquivo, url, duracao });
  };

  const escolherArquivo = async (lista: FileList | null) => {
    const arquivo = lista?.[0];
    if (arquivoRef.current) arquivoRef.current.value = '';
    if (!arquivo) return;
    setErro(null);
    if (!arquivo.type.startsWith('video/')) return setErro('Escolha um vídeo.');
    desligar();
    await mostrarPrevia(arquivo, null);
  };

  const refazer = () => {
    setErro(null);
    setEstado({ e: 'parado' });
  };

  const enviar = async () => {
    if (estado.e !== 'previa') return;   // trava contra toque duplo
    const { arquivo, url, duracao } = estado;
    setErro(null);
    setEstado({ e: 'enviando', arquivo, url, duracao, fracao: 0 });
    envioRef.current = new AbortController();
    try {
      const envio = await abertura.autorizarEnvio(checklistId);
      const atualizado = await enviarVideo(envio, arquivo, duracao, apiUrl, (fracao) => setEstado((s) => (s.e === 'enviando' ? { ...s, fracao } : s)), envioRef.current.signal);
      aoEnviar(atualizado);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'O vídeo não foi enviado. Suas respostas estão salvas: tente enviar de novo.');
      setEstado({ e: 'previa', arquivo, url, duracao });
    }
  };

  const gravandoHa = estado.e === 'gravando' ? Math.max(0, (agora - estado.inicio) / 1000) : 0;
  const camera = estado.e === 'abrindo' || estado.e === 'pronto' || estado.e === 'gravando';

  return (
    <div class="op-video">
      <p class="fraco">Mostre os ambientes já prontos para abrir: salão, vitrines, banheiros, entrada e jardim. Até {minSeg(maxSegundos)} e {maxMb} MB, sem som.</p>
      <div class="op-video__tela" hidden={!camera}>
        <video ref={ao_vivo} playsInline muted autoPlay aria-label="Câmera" />
        {estado.e === 'gravando' && (
          <span class="op-video__rec" role="timer" aria-live="off"><Circle aria-hidden="true" /> {minSeg(gravandoHa)} / {minSeg(maxSegundos)}</span>
        )}
      </div>
      {(estado.e === 'previa' || estado.e === 'enviando') && (
        <div class="op-video__tela">
          <video src={estado.url} controls playsInline aria-label="Prévia do vídeo da abertura" />
        </div>
      )}
      {estado.e === 'enviando' && (
        <div class="op-video__progresso" role="progressbar" aria-label="Enviando o vídeo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estado.fracao * 100)}>
          <span style={{ width: `${Math.round(estado.fracao * 100)}%` }} />
          <small>Enviando… {Math.round(estado.fracao * 100)}%</small>
        </div>
      )}
      {erro && <Aviso tom="perigo">{erro}</Aviso>}

      <div class="op-video__acoes">
        {estado.e === 'parado' && (
          <>
            {suportado && <Botao variante="primario" icone={<Video aria-hidden="true" />} onClick={abrirCamera}>Abrir a câmera</Botao>}
            <Botao variante={suportado ? 'secundario' : 'primario'} icone={<Camera aria-hidden="true" />} onClick={() => arquivoRef.current?.click()}>Usar a câmera do aparelho</Botao>
            <Botao variante="fantasma" onClick={aoCancelar}>Voltar ao checklist</Botao>
          </>
        )}
        {estado.e === 'abrindo' && <Botao carregando>Abrindo a câmera…</Botao>}
        {estado.e === 'pronto' && (
          <>
            <Botao variante="primario" icone={<Circle aria-hidden="true" />} onClick={gravar}>Gravar</Botao>
            <Botao variante="fantasma" onClick={() => { desligar(); setEstado({ e: 'parado' }); }}>Cancelar</Botao>
          </>
        )}
        {estado.e === 'gravando' && <Botao variante="primario" icone={<Square aria-hidden="true" />} onClick={parar}>Parar a gravação</Botao>}
        {estado.e === 'previa' && (
          <>
            <Botao variante="primario" icone={<Upload aria-hidden="true" />} onClick={enviar}>Enviar vídeo</Botao>
            <Botao icone={<RotateCcw aria-hidden="true" />} onClick={refazer}>Refazer</Botao>
          </>
        )}
        {estado.e === 'enviando' && <Botao carregando>Enviando o vídeo…</Botao>}
      </div>
      <input ref={arquivoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => void escolherArquivo(e.currentTarget.files)} />
    </div>
  );
}
