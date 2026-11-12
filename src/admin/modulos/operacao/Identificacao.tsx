// Identificação pelo rosto no tablet (Modo Operação): abre a sessão no backend, liga a câmera só depois do toque, orienta as
// poses do desafio, desliga a câmera ANTES de enviar e devolve o que o backend decidiu. Não registra nada: quem chama mostra
// nome e marcação e só grava depois da confirmação da pessoa. Usada por "Registrar ponto" e por "Assumir a abertura".
// Os quadros vão direto à API com o token curto da sessão; vivem só na memória desta tentativa. A captura é GUIADA pela
// prévia de enquadramento do backend ("aproxime", "melhore a iluminação", e só captura a virada quando ela aparece).
import { useEffect, useRef, useState } from 'preact/hooks';
import { ErroApi } from '../../lib/api/cliente';
import { enviarCaptura, terminal } from '../../lib/api/operacao';
import type { ConfiguracaoQuiosque, ResultadoCaptura, SessaoTerminal } from '../../lib/tipos/abertura';
import { abrirCamera, capturarQuadros, conferidorDaApi, ErroCamera, medirLuz, montarFormulario, pararCamera, textoDaOrientacao } from '../../../lib/ponto/captura';
import { Botao } from '../../ui/base';

const OCUPADA_TENTATIVAS = 3;
const OCUPADA_ESPERA_MS = 2_000;
// A imagem na tela é espelhada: virar para a própria esquerda aparece andando para a esquerda da tela.
const INSTRUCAO: Record<string, string> = { frente: 'Olhe para a câmera', esquerda: '← Vire o rosto para a esquerda', direita: 'Vire o rosto para a direita →' };
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export type FimIdentificacao =
  | { tipo: 'resultado'; sessao: SessaoTerminal; resultado: ResultadoCaptura }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'cancelada' };

/** Monta já capturando (o toque no botão é a autorização para ligar a câmera). */
export function Identificacao({ config, apiUrl, aoTerminar }: { config: ConfiguracaoQuiosque; apiUrl: string | null; aoTerminar: (fim: FimIdentificacao) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxoRef = useRef<MediaStream | null>(null);
  const sessaoRef = useRef<SessaoTerminal | null>(null);
  const abortoRef = useRef(new AbortController());
  const terminouRef = useRef(false);
  const [fase, setFase] = useState<'preparando' | 'capturando' | 'analisando'>('preparando');
  const [instrucao, setInstrucao] = useState('Encaixe o rosto no oval');
  const [passo, setPasso] = useState<{ i: number; total: number } | null>(null);
  const [luz, setLuz] = useState<'ok' | 'escuro' | 'claro'>('ok');

  const desligar = () => {
    pararCamera(fluxoRef.current, videoRef.current);
    fluxoRef.current = null;
  };
  const terminar = (fim: FimIdentificacao) => {
    if (terminouRef.current) return;
    terminouRef.current = true;
    desligar();
    aoTerminar(fim);
  };
  const cancelarSessao = (motivo: 'desistencia' | 'camera_indisponivel' | 'tempo_esgotado' | 'outro') => {
    const s = sessaoRef.current;
    sessaoRef.current = null;
    if (s) void terminal.cancelar(s.sessao_id, motivo);
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      let sessao: SessaoTerminal;
      try {
        sessao = await terminal.abrirSessao();
        sessaoRef.current = sessao;
      } catch (e) {
        return terminar({ tipo: 'erro', erro: e });
      }
      let quadros: Blob[];
      try {
        fluxoRef.current = await abrirCamera(videoRef.current!);
        if (!vivo) return;
        await esperar(600);
        setFase('capturando');
        let atual = INSTRUCAO.frente;
        const conferir = sessao.captura_token && apiUrl
          ? conferidorDaApi(`${apiUrl}/admin/ponto/terminal/sessoes/${sessao.sessao_id}/previa`, sessao.captura_token) : undefined;
        quadros = await capturarQuadros(videoRef.current!, {
          desafio: sessao.desafio,
          quadrosMax: sessao.quadros_max,
          maxKb: config.quadro_max_kb,
          conferir,
          // A sessão do tablet vence em ~30 s: cada pose espera no máximo 6 s.
          esperaMaxMs: 6_000,
          sinal: abortoRef.current.signal,
          aoPose: (pose, i, total) => {
            atual = INSTRUCAO[pose] ?? config.poses[pose] ?? 'Olhe para a câmera';
            setInstrucao(atual);
            setPasso({ i: i + 1, total });
          },
          aoOrientacao: (o, certa) => setInstrucao(textoDaOrientacao(o, certa, atual)),
        });
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
        cancelarSessao(e instanceof ErroCamera ? 'camera_indisponivel' : 'outro');
        return terminar({ tipo: 'erro', erro: e });
      }
      desligar();
      setFase('analisando');
      try {
        const formulario = montarFormulario(sessao.nonce, quadros);
        let resultado: ResultadoCaptura | null = null;
        for (let i = 0; i < OCUPADA_TENTATIVAS && !resultado; i++) {
          try {
            resultado = await enviarCaptura(sessao, formulario, apiUrl);
          } catch (e) {
            if (!(e instanceof ErroApi) || e.codigo !== 'biometria_ocupada' || i === OCUPADA_TENTATIVAS - 1) throw e;
            await esperar(OCUPADA_ESPERA_MS);
          }
        }
        terminar({ tipo: 'resultado', sessao, resultado: resultado! });
      } catch (e) {
        sessaoRef.current = null;
        terminar({ tipo: 'erro', erro: e });
      }
    })();
    // Saiu da tela no meio (trocou de aba, apagou a tela): câmera desliga e a sessão morre.
    const sumiu = () => {
      if (document.visibilityState === 'visible') return;
      abortoRef.current.abort();
      cancelarSessao('desistencia');
      terminar({ tipo: 'cancelada' });
    };
    document.addEventListener('visibilitychange', sumiu);
    const t = setInterval(() => videoRef.current && setLuz(medirLuz(videoRef.current)), 600);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', sumiu);
      abortoRef.current.abort();
      desligar();
    };
  }, []);

  const desistir = () => {
    abortoRef.current.abort();
    cancelarSessao('desistencia');
    terminar({ tipo: 'cancelada' });
  };

  return (
    <div class="op-camera" data-fase={fase}>
      <div class="op-camera__moldura">
        {/* O espelho é só visual: os quadros enviados saem crus. */}
        <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" />
        <span class="op-camera__oval" aria-hidden="true" />
        {fase === 'analisando' && <span class="op-camera__veu" aria-hidden="true" />}
      </div>
      <div class="op-camera__guia" role="status" aria-live="assertive">
        <strong>{fase === 'analisando' ? 'Conferindo…' : fase === 'preparando' ? 'Abrindo a câmera…' : instrucao}</strong>
        {passo && fase === 'capturando' && (
          <span class="op-camera__passos" aria-label={`Passo ${passo.i} de ${passo.total}`}>
            {Array.from({ length: passo.total }, (_, i) => <i key={i} data-feito={i < passo.i || undefined} />)}
          </span>
        )}
        {luz !== 'ok' && fase !== 'analisando' && <span class="op-camera__dica">{luz === 'escuro' ? 'Pouca luz: procure um lugar mais claro.' : 'Luz forte atrás de você.'}</span>}
      </div>
      {fase !== 'analisando' && <Botao variante="fantasma" onClick={desistir}>Cancelar</Botao>}
    </div>
  );
}

/** Mensagem humana para um erro da identificação. `gestor`: o caminho é o registro pelo gestor. */
export function mensagemDeErro(e: unknown): { titulo: string; mensagem: string; tentar: boolean; gestor: boolean; rede?: boolean } {
  if (e instanceof ErroCamera) {
    const textos: Record<string, string> = {
      permissao: 'A câmera está bloqueada para este site. Libere a câmera nas permissões do navegador do tablet.',
      ausente: 'Nenhuma câmera foi encontrada neste aparelho.',
      ocupada: 'A câmera não respondeu. Feche outros aplicativos que usam a câmera e tente de novo.',
      contexto: 'A câmera só funciona em conexão segura (https).',
    };
    return { titulo: 'Câmera indisponível', mensagem: textos[e.motivo] ?? textos.ocupada, tentar: true, gestor: true };
  }
  if (e instanceof ErroApi) {
    if (e.tipo === 'rede' || e.tipo === 'tempo') return { titulo: 'Sem internet', mensagem: 'Não foi possível falar com o sistema.', tentar: true, gestor: true, rede: true };
    if (e.codigo === 'ponto_desativado') return { titulo: 'Ponto desligado', mensagem: 'O controle de ponto está desligado no sistema.', tentar: false, gestor: true };
    if (e.codigo === 'identificacao_automatica_desligada' || e.codigo === 'biometria_indisponivel') return { titulo: 'Reconhecimento facial indisponível', mensagem: 'O ponto pelo rosto não está disponível agora.', tentar: false, gestor: true };
    if (e.codigo === 'biometria_ocupada') return { titulo: 'Sistema ocupado', mensagem: 'Tente de novo em instantes.', tentar: true, gestor: false };
    if (e.tipo === 'limite') return { titulo: 'Muitas tentativas', mensagem: 'Aguarde alguns minutos.', tentar: false, gestor: true };
    if (e.tipo === 'indisponivel') return { titulo: 'Sistema fora do ar', mensagem: 'O sistema do Âmbar não respondeu.', tentar: true, gestor: true, rede: true };
    if (e.tipo === 'arquivo' || e.codigo === 'captura_invalida' || e.codigo === 'token_vencido') return { titulo: 'Captura não aceita', mensagem: 'Tente de novo.', tentar: true, gestor: false };
    return { titulo: 'Não foi possível concluir', mensagem: e.message, tentar: true, gestor: true };
  }
  return { titulo: 'Algo não funcionou', mensagem: 'Tente de novo.', tentar: true, gestor: true };
}
