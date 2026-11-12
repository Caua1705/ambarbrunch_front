// Cadastro facial supervisionado, em UMA etapa (12/11/2026): o Proprietário abre a câmera, o funcionário segue as
// instruções e, se tudo passar, o rosto já fica cadastrado — sem segunda captura e sem etapa de confirmação. O backend
// valida qualidade, prova de vida, identidade e a verificação que a segunda captura fazia (com quadros da mesma sessão);
// esta tela só orienta e captura. A captura é GUIADA: a prévia de enquadramento do backend diz "aproxime", "melhore a
// iluminação" e quando a virada do rosto apareceu, e cada pose só é capturada quando aparece. Se falhar, a câmera continua
// aberta e só a captura é repetida. Recadastrar: o rosto atual continua valendo até o novo passar.
import '../../estilos/equipe.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ArrowLeft, CheckCircle2, RotateCcw, ScanFace } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { enviarCapturaFacial, equipe } from '../../lib/api/equipe';
import { invalidar, useConsulta } from '../../lib/consulta';
import { abrirCamera, capturarQuadros, conferidorDaApi, ErroCamera, montarFormulario, pararCamera, textoDaOrientacao } from '../../../lib/ponto/captura';
import { lerParam } from '../../lib/rotas';
import type { ResultadoFacial, SessaoFacial } from '../../lib/tipos/equipe';
import { Aviso, Botao, Cartao } from '../../ui/base';
import { Raiz } from '../../ui/camadas';
import { Dados, Vazio } from '../../ui/estados';

// A imagem na tela é espelhada: virar para a própria esquerda aparece andando para a esquerda da tela.
const INSTRUCAO: Record<string, string> = { frente: 'Olhe para a câmera', esquerda: '← Vire o rosto devagar para a esquerda', direita: 'Vire o rosto devagar para a direita →' };
/** Sem a prévia (rede, backend antigo), a janela fixa por pose fica folgada. */
const PREPARO_POSE_MS = 2200;

type Fase = 'pronto' | 'camera' | 'capturando' | 'conferindo' | 'concluido';

export default function CadastroFacial({ apiUrl }: { apiUrl: string | null }) {
  const id = lerParam('funcionario');
  const funcionario = useConsulta(id ? `equipe:funcionario/${id}` : null, () => equipe.funcionario(id!));
  const voltar = `/admin/equipe?aba=funcionarios${id ? `&funcionario=${id}` : ''}`;
  return (
    <Raiz>
      <div class="pilha">
        <a class="btn btn--p btn--fantasma equipe-voltar" href={voltar}><ArrowLeft aria-hidden="true" /> Voltar para Equipe</a>
        {!id ? <Vazio titulo="Escolha o funcionário">Abra o cadastro facial pela ficha da pessoa, em Equipe.</Vazio> : (
          <Dados consulta={funcionario}>
            {(f) => {
              if (!f.ativo) return <Vazio titulo="Funcionário inativo">Reative o cadastro antes de registrar o rosto.</Vazio>;
              if (f.registro_supervisionado) return <Vazio titulo="Registro com gestor">Esta pessoa registra o ponto sem reconhecimento facial.</Vazio>;
              return <Fluxo id={f.id} nome={f.nome_exibicao} pendente={f.biometria_estado === 'pendente'} recadastro={f.biometria_estado === 'ativa'} apiUrl={apiUrl} voltar={voltar} />;
            }}
          </Dados>
        )}
      </div>
    </Raiz>
  );
}

/** Mensagem curta para quando a captura não passou (nada técnico na tela). */
function mensagemDaRecusa(r: ResultadoFacial): string {
  switch (r.resultado) {
    case 'falha_prova_de_vida':
      if (r.motivo === 'apresentacao_suspeita') return 'Não deu para confirmar que é uma pessoa na frente da câmera. Tente de novo, sem foto ou tela na frente.';
      return 'Não deu para ver o rosto virando. Vamos repetir: vire devagar quando a seta pedir e volte para a frente.';
    case 'qualidade_insuficiente':
      if (r.motivo === 'pouca_luz') return 'Pouca luz. Procure um lugar mais claro e tente de novo.';
      if (r.motivo === 'rosto_pequeno') return 'O rosto ficou longe. Aproxime um pouco e tente de novo.';
      if (r.motivo === 'multiplos_rostos') return 'Apareceu mais de uma pessoa. Só quem está cadastrando na frente da câmera.';
      return 'A imagem não ficou boa. Tente de novo com o rosto bem iluminado.';
    case 'conflito_biometrico':
      return 'Este rosto se parece com o de outra pessoa já cadastrada. Nada foi salvo: confira se é o funcionário certo.';
    case 'nao_confere':
      return 'Não deu para confirmar o rosto com segurança. Tente de novo com boa luz, olhando para a câmera.';
    case 'sessao_expirada':
      return 'O tempo acabou. Tente de novo.';
    default:
      return r.mensagem || 'Não deu certo. Tente de novo.';
  }
}

function Fluxo({ id, nome, pendente, recadastro, apiUrl, voltar }: { id: string; nome: string; pendente: boolean; recadastro: boolean; apiUrl: string | null; voltar: string }) {
  const [fase, setFase] = useState<Fase>('pronto');
  const [presente, setPresente] = useState(false);
  const [mensagem, setMensagem] = useState('Posicione o rosto dentro da área indicada');
  const [passo, setPasso] = useState<{ i: number; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ativando, setAtivando] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxoRef = useRef<MediaStream | null>(null);
  const abortoRef = useRef<AbortController | null>(null);

  const desligar = () => {
    pararCamera(fluxoRef.current, videoRef.current);
    fluxoRef.current = null;
  };
  useEffect(() => {
    const sair = () => {
      if (document.visibilityState !== 'visible') {
        abortoRef.current?.abort();
        desligar();
        setFase((f) => (f === 'concluido' ? f : 'pronto'));
      }
    };
    document.addEventListener('visibilitychange', sair);
    return () => {
      document.removeEventListener('visibilitychange', sair);
      abortoRef.current?.abort();
      desligar();
    };
  }, []);

  /** Abre a câmera (se ainda não está aberta) e faz UMA captura completa. Repetir = chamar de novo. */
  const capturar = async () => {
    setErro(null);
    setPasso(null);
    abortoRef.current = new AbortController();
    try {
      if (!fluxoRef.current) {
        setFase('camera');
        fluxoRef.current = await abrirCamera(videoRef.current!);
      }
    } catch (e) {
      desligar();
      setFase('pronto');
      return setErro(e instanceof ErroCamera
        ? { permissao: 'A câmera está bloqueada. Libere a câmera nas permissões do navegador.', ausente: 'Nenhuma câmera encontrada neste aparelho.', ocupada: 'A câmera não respondeu. Feche outros apps que usam a câmera.', contexto: 'A câmera só funciona em conexão segura (https).' }[e.motivo]
        : 'A câmera não abriu. Tente de novo.');
    }
    let sessao: SessaoFacial;
    try {
      sessao = await equipe.iniciarCadastroFacial(id);
    } catch (e) {
      setFase('camera');
      return setErro(e instanceof ErroApi ? e.message : 'Não foi possível iniciar.');
    }
    setFase('capturando');
    setMensagem('Posicione o rosto dentro da área indicada');
    const conferir = sessao.captura_token && apiUrl ? conferidorDaApi(`${apiUrl}/admin/ponto/biometria/sessoes/${sessao.sessao_id}/previa`, sessao.captura_token) : undefined;
    let quadros: Blob[];
    let instrucao = INSTRUCAO.frente;
    try {
      quadros = await capturarQuadros(videoRef.current!, {
        desafio: sessao.desafio,
        quadrosMax: sessao.quadros_max,
        preparoMs: PREPARO_POSE_MS,
        conferir,
        esperaMaxMs: 12_000,
        sinal: abortoRef.current.signal,
        aoPose: (pose, i, total) => {
          instrucao = INSTRUCAO[pose] ?? 'Olhe para a câmera';
          setMensagem(instrucao);
          setPasso({ i: i + 1, total });
        },
        aoOrientacao: (o, certa) => setMensagem(textoDaOrientacao(o, certa, instrucao)),
      });
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
      setFase('camera');
      return setErro('A captura não terminou. Tente de novo.');
    }
    setFase('conferindo');
    setMensagem('Captura concluída. Conferindo…');
    try {
      const r = await enviarCapturaFacial(sessao, montarFormulario(sessao.nonce, quadros), apiUrl);
      if (r.resultado !== 'aprovado') {
        setFase('camera');     // câmera continua aberta: só a captura se repete
        return setErro(mensagemDaRecusa(r));
      }
      invalidar('equipe');
      desligar();
      setFase('concluido');
    } catch (e) {
      setFase('camera');
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar. Confira a internet e tente de novo.');
    }
  };

  const ativarPendente = async () => {
    setAtivando(true);
    setErro(null);
    try {
      await equipe.confirmarBiometria(id);
      invalidar('equipe');
      setFase('concluido');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível ativar.');
    } finally {
      setAtivando(false);
    }
  };

  const cameraVisivel = fase === 'camera' || fase === 'capturando' || fase === 'conferindo';

  return (
    <Cartao titulo={`Cadastro facial — ${nome}`} descricao={recadastro && fase !== 'concluido' ? 'Substitui o rosto cadastrado hoje. Se não der certo, o atual continua valendo.' : undefined}>
      <div class="equipe-camera" hidden={!cameraVisivel}>
        <div class="equipe-camera__moldura">
          <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" />
          <span class="equipe-camera__oval" aria-hidden="true"></span>
        </div>
        <p class="equipe-camera__guia" role="status" aria-live="assertive">{fase === 'camera' ? 'Posicione o rosto dentro da área indicada' : mensagem}</p>
        {passo && fase === 'capturando' && (
          <span class="equipe-camera__passos" aria-label={`Passo ${passo.i} de ${passo.total}`}>
            {Array.from({ length: passo.total }, (_, i) => <i key={i} data-feito={i < passo.i || undefined} />)}
          </span>
        )}
      </div>

      {fase === 'pronto' && (
        <div class="pilha">
          {pendente && (
            <Aviso tom="info">
              <span class="pilha pilha--p">
                <span>{nome} já tem um rosto capturado esperando ativação. Dá para ativar sem nova captura.</span>
                <span><Botao tamanho="p" variante="primario" carregando={ativando} onClick={ativarPendente}>Ativar o cadastro já capturado</Botao></span>
              </span>
            </Aviso>
          )}
          <p>{nome} fica de frente para o aparelho, com o rosto iluminado e sem outra pessoa na imagem. A tela diz o que fazer.</p>
          <label class="marcar">
            <input type="checkbox" checked={presente} onChange={(e) => setPresente(e.currentTarget.checked)} />
            <span>{nome} está aqui comigo e autorizou o cadastro do rosto.</span>
          </label>
          <div class="linha">
            <Botao variante="primario" icone={<ScanFace aria-hidden="true" />} onClick={capturar} disabled={!presente}>Iniciar câmera</Botao>
          </div>
        </div>
      )}

      {fase === 'camera' && erro && (
        <div class="linha">
          <Botao variante="primario" icone={<RotateCcw aria-hidden="true" />} onClick={capturar}>Tentar de novo</Botao>
          <Botao variante="fantasma" onClick={() => { desligar(); setErro(null); setFase('pronto'); }}>Fechar a câmera</Botao>
        </div>
      )}

      {fase === 'concluido' && (
        <div class="pilha">
          <Aviso tom="ok" icone={<CheckCircle2 aria-hidden="true" />}>Rosto cadastrado com sucesso.</Aviso>
          <p class="fraco">{nome} já pode registrar o ponto no tablet.</p>
          <div class="linha"><a class="btn btn--primario" href={voltar}>Voltar para a ficha</a></div>
        </div>
      )}

      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Cartao>
  );
}
