// Cadastro facial supervisionado: o Proprietário fica com a conta aberta, o funcionário segue as instruções e nada vale até o
// teste passar e o Proprietário confirmar. O backend valida qualidade, identidade e prova de vida; esta tela só captura.
// Recadastrar é o mesmo caminho: o cadastro anterior vale até a confirmação.
import '../../estilos/equipe.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ArrowLeft, CheckCircle2, ScanFace, ShieldCheck } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { enviarCapturaFacial, equipe } from '../../lib/api/equipe';
import { invalidar, useConsulta } from '../../lib/consulta';
import { abrirCamera, capturarQuadros, ErroCamera, INSTRUCOES_CAMERA, medirLuz, montarFormulario, pararCamera } from '../../../lib/ponto/captura';
import { orientacaoDoMotivo } from '../../../lib/ponto/contrato';
import { lerParam } from '../../lib/rotas';
import type { SessaoFacial } from '../../lib/tipos/equipe';
import { Aviso, Botao, Cartao } from '../../ui/base';
import { Raiz } from '../../ui/camadas';
import { Dados, Vazio } from '../../ui/estados';

type Etapa = 'cadastro' | 'teste' | 'confirmar' | 'concluido';
// A imagem na tela é espelhada: virar para a própria esquerda aparece andando para a esquerda da tela.
const INSTRUCAO: Record<string, string> = { frente: 'Olhe RETO para a câmera', esquerda: '← Vire o rosto para a ESQUERDA', direita: 'Vire o rosto para a DIREITA →' };
/** No cadastro, a pessoa ouve a instrução de quem supervisiona: tempo de sobra para chegar em cada pose e parar. */
const PREPARO_POSE_MS = 2200;
const PREPARO_INICIAL_MS = 3000;
const PASSOS: { id: Etapa; rotulo: string }[] = [{ id: 'cadastro', rotulo: 'Captura' }, { id: 'teste', rotulo: 'Teste' }, { id: 'confirmar', rotulo: 'Confirmação' }];

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

function Fluxo({ id, nome, pendente, recadastro, apiUrl, voltar }: { id: string; nome: string; pendente: boolean; recadastro: boolean; apiUrl: string | null; voltar: string }) {
  const [etapa, setEtapa] = useState<Etapa>(pendente ? 'teste' : 'cadastro');
  const [presente, setPresente] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [instrucao, setInstrucao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [luz, setLuz] = useState<'ok' | 'escuro' | 'claro'>('ok');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxoRef = useRef<MediaStream | null>(null);
  const abortoRef = useRef<AbortController | null>(null);

  const desligar = () => {
    pararCamera(fluxoRef.current, videoRef.current);
    fluxoRef.current = null;
    setInstrucao(null);
  };
  useEffect(() => {
    const sair = () => {
      if (document.visibilityState !== 'visible') {
        abortoRef.current?.abort();
        desligar();
        setCapturando(false);
      }
    };
    document.addEventListener('visibilitychange', sair);
    return () => {
      document.removeEventListener('visibilitychange', sair);
      abortoRef.current?.abort();
      desligar();
    };
  }, []);
  useEffect(() => {
    if (!capturando) return;
    const t = setInterval(() => videoRef.current && setLuz(medirLuz(videoRef.current)), 500);
    return () => clearInterval(t);
  }, [capturando]);

  const iniciar = async () => {
    setErro(null);
    setCapturando(true);
    abortoRef.current = new AbortController();
    let sessao: SessaoFacial;
    try {
      sessao = etapa === 'cadastro' ? await equipe.iniciarCadastroFacial(id) : await equipe.iniciarTesteFacial(id);
    } catch (e) {
      setCapturando(false);
      return setErro(e instanceof ErroApi ? e.message : 'Não foi possível iniciar.');
    }
    let quadros: Blob[];
    try {
      fluxoRef.current = await abrirCamera(videoRef.current!);
      setInstrucao('Prepare-se: olhe RETO para a câmera');
      await new Promise((ok) => setTimeout(ok, PREPARO_INICIAL_MS));
      quadros = await capturarQuadros(videoRef.current!, {
        desafio: sessao.desafio,
        quadrosMax: sessao.quadros_max,
        preparoMs: PREPARO_POSE_MS,
        sinal: abortoRef.current.signal,
        aoPose: (pose, i, total) => setInstrucao(`${i + 1} de ${total}: ${INSTRUCAO[pose] ?? pose}`),
      });
    } catch (e) {
      desligar();
      setCapturando(false);
      if ((e as DOMException).name === 'AbortError') return;
      return setErro(e instanceof ErroCamera ? INSTRUCOES_CAMERA[e.motivo].replace(' ou procure o gestor', '').replace(' Procure o gestor.', '') : 'A captura não terminou. Tente de novo.');
    }
    desligar();
    setCapturando(false);
    setEnviando(true);
    try {
      const r = await enviarCapturaFacial(sessao, montarFormulario(sessao.nonce, quadros), apiUrl);
      if (r.resultado !== 'aprovado') return setErro([r.mensagem, orientacaoDoMotivo(r.motivo)].filter(Boolean).join(' '));
      invalidar('equipe');
      setEtapa(r.proximo_passo === 'confirmar' ? 'confirmar' : 'teste');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await equipe.confirmarBiometria(id);
      invalidar('equipe');
      setEtapa('concluido');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível confirmar.');
    } finally {
      setEnviando(false);
    }
  };

  const texto = etapa === 'cadastro'
    ? `Peça para ${nome} ficar de frente para o aparelho, com o rosto bem iluminado e sem outra pessoa na imagem.`
    : `Agora um teste: ${nome} repete o movimento para conferir se o sistema reconhece.`;

  return (
    <Cartao titulo={`Cadastro facial de ${nome}`} descricao={recadastro && etapa !== 'concluido' ? 'O cadastro atual continua valendo até você confirmar o novo.' : undefined}>
      <ol class="equipe-passos" aria-label="Etapas do cadastro">
        {PASSOS.map((p, i) => {
          const atual = PASSOS.findIndex((x) => x.id === etapa);
          const feito = etapa === 'concluido' || i < atual;
          return <li key={p.id} aria-current={p.id === etapa ? 'step' : undefined} data-feito={feito || undefined}>{p.rotulo}</li>;
        })}
      </ol>

      <div class="equipe-camera" hidden={!capturando}>
        <div class="equipe-camera__moldura">
          <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" />
          <span class="equipe-camera__oval" aria-hidden="true"></span>
        </div>
        <p class="equipe-camera__guia" role="status" aria-live="assertive">{instrucao ?? 'Encaixe o rosto no oval'}</p>
        <p class="fraco">Faça cada movimento devagar e fique parado até a próxima instrução.</p>
        {luz !== 'ok' && <p class="fraco">{luz === 'escuro' ? 'Pouca luz. Procure um lugar mais claro.' : 'Luz forte demais atrás da pessoa.'}</p>}
      </div>

      {!capturando && (etapa === 'cadastro' || etapa === 'teste') && (
        <div class="pilha">
          <p>{texto}</p>
          {etapa === 'cadastro' && (
            <label class="marcar">
              <input type="checkbox" checked={presente} onChange={(e) => setPresente(e.currentTarget.checked)} />
              <span>{nome} está aqui comigo e autorizou o cadastro do rosto.</span>
            </label>
          )}
          <div class="linha">
            <Botao variante="primario" icone={<ScanFace aria-hidden="true" />} onClick={iniciar} carregando={enviando} disabled={etapa === 'cadastro' && !presente}>
              {enviando ? 'Conferindo' : etapa === 'cadastro' ? 'Abrir câmera e capturar' : 'Abrir câmera e testar'}
            </Botao>
          </div>
        </div>
      )}

      {etapa === 'confirmar' && (
        <div class="pilha">
          <Aviso tom="ok" icone={<ShieldCheck aria-hidden="true" />}>O teste passou. O cadastro só vale depois da sua confirmação.</Aviso>
          <div class="linha"><Botao variante="primario" onClick={confirmar} carregando={enviando}>Confirmar cadastro</Botao></div>
        </div>
      )}

      {etapa === 'concluido' && (
        <div class="pilha">
          <Aviso tom="ok" icone={<CheckCircle2 aria-hidden="true" />}>Cadastro facial de {nome} ativo.</Aviso>
          <div class="linha"><a class="btn btn--primario" href={voltar}>Voltar para a ficha</a></div>
        </div>
      )}

      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Cartao>
  );
}
