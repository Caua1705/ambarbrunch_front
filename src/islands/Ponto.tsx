// Tablet do ponto (/ponto). Quem identifica, decide a batida e dá o horário é sempre o backend: a tela só orienta, captura
// e mostra. Sucesso só aparece com o recibo em mãos; sem ele, a mensagem é de que nada foi confirmado. A câmera liga depois
// do toque em REGISTRAR PONTO e desliga antes do envio, inclusive em erro e ao sair da tela.
import { useEffect, useRef, useState } from 'preact/hooks';
import { CheckCircle2, CircleAlert, Clock3, LoaderCircle, ScanFace, UserRoundCheck, WifiOff } from 'lucide-preact';
import { ErroPonto, ROTULO_BATIDA, type ConfiguracaoQuiosque, type Recibo, type SessaoAberta, type TipoBatida } from '../lib/ponto/contrato';
import { abrirCamera, capturarQuadros, ErroCamera, INSTRUCOES_CAMERA, medirLuz, montarFormulario, pararCamera } from '../lib/ponto/captura';
import { abrirSessao, apiConfigurada, cancelarSessao, enviarCaptura, lerConfiguracao, parear, registrarBatida } from '../lib/ponto/http';

const CHAVE_PAREAMENTO = 'ambar_ponto_pareamento';
const FUSO = 'America/Fortaleza';
const RECIBO_MS = 5_000;
const AVISO_MS = 20_000;
const ATUALIZAR_MS = 5 * 60_000;
const OCUPADA_ESPERA_MS = 2_000;
const OCUPADA_TENTATIVAS = 3;

type Aviso = { titulo: string; mensagem: string; tentar?: boolean; gestor?: boolean; tipo?: 'rede' | 'erro' };
type Tela =
  | { t: 'carregando' }
  | { t: 'desativado' }
  | { t: 'sem_biometria' }
  | { t: 'parear'; erro?: string }
  | { t: 'inicio' }
  | { t: 'preparando' }
  | { t: 'capturando'; instrucao: string; passo: number; total: number }
  | { t: 'analisando' }
  | { t: 'escolher'; nome: string; opcoes: TipoBatida[] }
  | { t: 'registrando'; nome: string }
  | { t: 'sem_resposta'; nome: string }
  | { t: 'recibo'; recibo: Recibo }
  | ({ t: 'aviso' } & Aviso);

interface Batida {
  sessao: SessaoAberta;
  autorizacao: string;
  chave: string;
  tipo?: TipoBatida;
  nome: string;
  expira: number;
}

const horaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const dataFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' });
const dataCurta = (d: string) => d.split('-').reverse().join('/');
const novaChave = () => crypto.randomUUID();
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Relógio da tela: a hora do servidor, nunca a do aparelho. */
function useRelogio(deslocamento: number | null) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return deslocamento === null ? null : agora + deslocamento;
}

function avisoDeErro(e: unknown): Aviso | 'desativado' | 'parear' {
  if (e instanceof ErroPonto) {
    if (e.rede) return { titulo: 'Sem internet', mensagem: 'O ponto não foi registrado. Confira a conexão e tente de novo.', tentar: true, tipo: 'rede' };
    if (e.status === 401) return 'parear';
    if (e.codigo === 'ponto_desativado') return 'desativado';
    if (e.codigo === 'biometria_indisponivel') return { titulo: 'Reconhecimento indisponível', mensagem: 'O ponto não foi registrado. Procure o gestor.', gestor: true };
    if (e.codigo === 'biometria_ocupada') return { titulo: 'Sistema ocupado', mensagem: 'O ponto não foi registrado. Tente de novo em instantes.', tentar: true };
    if (e.status === 429) return { titulo: 'Muitas tentativas', mensagem: 'Aguarde alguns minutos ou procure o gestor.', gestor: true };
    if (e.codigo === 'funcionario_inativo') return { titulo: 'Cadastro inativo', mensagem: e.message, gestor: true };
    if (e.codigo === 'jornada_em_revisao' || e.codigo === 'supervisao_necessaria') return { titulo: 'Fale com o gestor', mensagem: e.message, gestor: true };
    if (e.status === 413 || e.codigo === 'captura_invalida') return { titulo: 'Captura não aceita', mensagem: 'O ponto não foi registrado. Tente de novo.', tentar: true };
    return { titulo: 'Tente de novo', mensagem: 'O ponto não foi registrado. Comece outra vez.', tentar: true };
  }
  return { titulo: 'Algo não funcionou', mensagem: 'O ponto não foi registrado. Tente de novo ou procure o gestor.', tentar: true, gestor: true };
}

export default function Ponto() {
  const [tela, setTela] = useState<Tela>({ t: 'carregando' });
  const [config, setConfig] = useState<ConfiguracaoQuiosque | null>(null);
  const [deslocamento, setDeslocamento] = useState<number | null>(null);
  const [luz, setLuz] = useState<'ok' | 'escuro' | 'claro'>('ok');
  const [conectado, setConectado] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxoRef = useRef<MediaStream | null>(null);
  const sessaoRef = useRef<SessaoAberta | null>(null);
  const batidaRef = useRef<Batida | null>(null);
  const abortoRef = useRef<AbortController | null>(null);
  const telaRef = useRef(tela);
  telaRef.current = tela;
  const agora = useRelogio(deslocamento);

  const desligarCamera = () => {
    pararCamera(fluxoRef.current, videoRef.current);
    fluxoRef.current = null;
    setLuz('ok');
  };
  const encerrarSessao = (motivo: 'desistencia' | 'camera_indisponivel' | 'tempo_esgotado' | 'outro') => {
    const s = sessaoRef.current;
    sessaoRef.current = null;
    if (s) void cancelarSessao(s.sessao_id, motivo);
  };
  const aplicarErro = (e: unknown) => {
    desligarCamera();
    const r = avisoDeErro(e);
    if (r === 'desativado') setTela({ t: 'desativado' });
    else if (r === 'parear') setTela({ t: 'parear' });
    else setTela({ t: 'aviso', ...r });
  };

  const carregar = async (mudarTela: boolean) => {
    if (!apiConfigurada()) return setTela({ t: 'desativado' });
    try {
      const c = await lerConfiguracao();
      setConfig(c);
      setDeslocamento(new Date(c.horario_servidor).getTime() - Date.now());
      setConectado(true);
      if (mudarTela) setTela(c.biometria_disponivel ? { t: 'inicio' } : { t: 'sem_biometria' });
    } catch (e) {
      if (e instanceof ErroPonto && e.rede) {
        setConectado(false);
        if (mudarTela) setTela({ t: 'aviso', titulo: 'Sem internet', mensagem: 'Confira a conexão do tablet.', tentar: true, tipo: 'rede' });
        return;
      }
      aplicarErro(e);
    }
  };

  // Pareamento vindo do painel neste aparelho: o token passa pela memória da aba e some na mesma hora.
  useEffect(() => {
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(CHAVE_PAREAMENTO);
      sessionStorage.removeItem(CHAVE_PAREAMENTO);
    } catch {
      /* navegação privada: segue para o pareamento manual */
    }
    (async () => {
      if (token) await parear(token).catch(() => undefined);
      await carregar(true);
    })();
    const pedirTela = async () => {
      try {
        await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } }).wakeLock?.request('screen');
      } catch {
        /* sem suporte: o modo quiosque do Android mantém a tela ligada */
      }
    };
    void pedirTela();
    const rede = () => setConectado(navigator.onLine);
    window.addEventListener('online', rede);
    window.addEventListener('offline', rede);
    const atualizar = setInterval(() => {
      if (telaRef.current.t === 'inicio' || telaRef.current.t === 'sem_biometria' || telaRef.current.t === 'desativado') void carregar(telaRef.current.t !== 'inicio');
    }, ATUALIZAR_MS);
    return () => {
      clearInterval(atualizar);
      window.removeEventListener('online', rede);
      window.removeEventListener('offline', rede);
    };
  }, []);

  // Saiu da tela no meio: a câmera desliga e a sessão morre. Ao voltar, religa a tela e confere o tablet.
  useEffect(() => {
    const visibilidade = () => {
      if (document.visibilityState === 'visible') return;
      const em = telaRef.current.t;
      if (em === 'preparando' || em === 'capturando') {
        abortoRef.current?.abort();
        desligarCamera();
        encerrarSessao('desistencia');
        setTela({ t: 'inicio' });
      }
    };
    document.addEventListener('visibilitychange', visibilidade);
    return () => document.removeEventListener('visibilitychange', visibilidade);
  }, []);

  useEffect(() => {
    if (tela.t === 'recibo') {
      const t = setTimeout(() => setTela({ t: 'inicio' }), RECIBO_MS);
      return () => clearTimeout(t);
    }
    if (tela.t === 'aviso') {
      const t = setTimeout(() => setTela({ t: 'inicio' }), AVISO_MS);
      return () => clearTimeout(t);
    }
  }, [tela]);

  useEffect(() => {
    if (tela.t !== 'preparando') return;
    const t = setInterval(() => videoRef.current && setLuz(medirLuz(videoRef.current)), 500);
    return () => clearInterval(t);
  }, [tela.t]);

  const baterAgora = async () => {
    const b = batidaRef.current;
    if (!b) return;
    setTela({ t: 'registrando', nome: b.nome });
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const recibo = await registrarBatida(b.sessao.sessao_id, b.autorizacao, b.chave, b.tipo);
        batidaRef.current = null;
        sessaoRef.current = null;
        return setTela({ t: 'recibo', recibo });
      } catch (e) {
        if (!(e instanceof ErroPonto)) return aplicarErro(e);
        if (e.rede) {
          // Mesma chave: repetir nunca grava duas batidas.
          if (tentativa === 0) {
            await esperar(1200);
            continue;
          }
          return setTela({ t: 'sem_resposta', nome: b.nome });
        }
        batidaRef.current = null;
        if (e.codigo === 'marcacao_recente') {
          encerrarSessao('outro');
          return setTela({ t: 'aviso', titulo: 'Ponto já registrado', mensagem: `${b.nome}, sua batida já está no sistema. Não é preciso bater de novo.` });
        }
        if (e.codigo === 'escolha_necessaria' && Array.isArray(e.dados?.opcoes)) {
          batidaRef.current = { ...b, chave: novaChave() };
          return setTela({ t: 'escolher', nome: b.nome, opcoes: e.dados.opcoes as TipoBatida[] });
        }
        sessaoRef.current = null;
        return aplicarErro(e);
      }
    }
  };

  const escolher = (tipo: TipoBatida) => {
    if (!batidaRef.current) return;
    batidaRef.current = { ...batidaRef.current, tipo };
    void baterAgora();
  };

  const repetirBatida = () => {
    const b = batidaRef.current;
    if (!b || Date.now() > b.expira) {
      batidaRef.current = null;
      return setTela({ t: 'aviso', titulo: 'Não confirmado', mensagem: 'O tempo acabou sem confirmação do sistema. Comece outra vez: uma batida já gravada não é duplicada.', tentar: true });
    }
    void baterAgora();
  };

  const registrar = async () => {
    if (tela.t !== 'inicio' && tela.t !== 'aviso') return;
    abortoRef.current = new AbortController();
    setTela({ t: 'preparando' });
    let sessao: SessaoAberta;
    try {
      sessao = await abrirSessao();
      sessaoRef.current = sessao;
    } catch (e) {
      return aplicarErro(e);
    }
    let quadros: Blob[];
    try {
      const video = videoRef.current!;
      fluxoRef.current = await abrirCamera(video);
      await esperar(1200);
      quadros = await capturarQuadros(video, {
        desafio: sessao.desafio,
        quadrosMax: sessao.quadros_max,
        maxKb: config?.quadro_max_kb,
        sinal: abortoRef.current.signal,
        aoPose: (pose, i, total) => setTela({ t: 'capturando', instrucao: config?.poses[pose] ?? 'Olhe para a câmera', passo: i + 1, total }),
      });
    } catch (e) {
      desligarCamera();
      if ((e as DOMException).name === 'AbortError') return;
      if (e instanceof ErroCamera) {
        encerrarSessao('camera_indisponivel');
        return setTela({ t: 'aviso', titulo: 'Câmera indisponível', mensagem: INSTRUCOES_CAMERA[e.motivo], gestor: true });
      }
      encerrarSessao('outro');
      return aplicarErro(e);
    }
    desligarCamera();
    setTela({ t: 'analisando' });
    const formulario = montarFormulario(sessao.nonce, quadros);
    quadros = [];
    try {
      let resultado = null;
      for (let i = 0; i < OCUPADA_TENTATIVAS && !resultado; i++) {
        try {
          resultado = await enviarCaptura(sessao.sessao_id, formulario);
        } catch (e) {
          if (!(e instanceof ErroPonto) || e.codigo !== 'biometria_ocupada' || i === OCUPADA_TENTATIVAS - 1) throw e;
          await esperar(OCUPADA_ESPERA_MS);
        }
      }
      if (!resultado) return;
      if (resultado.resultado !== 'aprovado' || !resultado.autorizacao || !resultado.proxima_batida) {
        sessaoRef.current = null;
        return setTela({ t: 'aviso', titulo: 'Ponto não registrado', mensagem: resultado.mensagem, tentar: resultado.nova_tentativa, gestor: resultado.encaminhar_gestor });
      }
      const nome = resultado.nome_exibicao ?? '';
      const proxima = resultado.proxima_batida;
      if (proxima.acao === 'ja_registrada') {
        encerrarSessao('outro');
        return setTela({ t: 'aviso', titulo: 'Ponto já registrado', mensagem: `${nome}, sua última batida já está no sistema.` });
      }
      if (proxima.acao === 'supervisao') {
        encerrarSessao('outro');
        return setTela({ t: 'aviso', titulo: 'Fale com o gestor', mensagem: `${nome}, este registro precisa do gestor.`, gestor: true });
      }
      batidaRef.current = {
        sessao,
        autorizacao: resultado.autorizacao,
        chave: novaChave(),
        nome,
        expira: resultado.autorizacao_expira_em ? new Date(resultado.autorizacao_expira_em).getTime() : Date.now() + 30_000,
      };
      if (proxima.acao === 'escolher') return setTela({ t: 'escolher', nome, opcoes: proxima.opcoes });
      await baterAgora();
    } catch (e) {
      sessaoRef.current = null;
      aplicarErro(e);
    }
  };

  const desistir = () => {
    abortoRef.current?.abort();
    desligarCamera();
    batidaRef.current = null;
    encerrarSessao('desistencia');
    setTela({ t: 'inicio' });
  };

  const pareando = async (token: string) => {
    setTela({ t: 'carregando' });
    try {
      await parear(token.trim());
    } catch (e) {
      if (e instanceof ErroPonto && e.status === 401) return setTela({ t: 'parear', erro: 'Código não reconhecido. Confira com o gestor.' });
      return aplicarErro(e);
    }
    try {
      await lerConfiguracao();
    } catch (e) {
      // O cookie só funciona em ambarbrunch.com: noutro endereço, o navegador o descarta.
      if (e instanceof ErroPonto && e.status === 401) return setTela({ t: 'parear', erro: 'Este tablet só pode ser autorizado pelo endereço oficial do site.' });
    }
    await carregar(true);
  };

  const camera = tela.t === 'preparando' || tela.t === 'capturando';
  const relogio = agora === null ? null : new Date(agora);

  return (
    <main class="ponto" data-tela={tela.t}>
      <header class="ponto__topo">
        <span class="ponto__marca" role="img" aria-label="Âmbar"></span>
        {config && <span class="ponto__aparelho">{config.unidade} · {config.dispositivo}</span>}
        {!conectado && <span class="ponto__offline"><WifiOff aria-hidden="true" /> Sem internet</span>}
      </header>

      {/* O vídeo existe sempre: a câmera liga nele, e o espelho é só visual. Os quadros enviados saem crus. */}
      <section class="ponto__camera" hidden={!camera} aria-label="Câmera">
        <div class="ponto__moldura">
          <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" />
          <span class="ponto__oval" aria-hidden="true"></span>
        </div>
        <div class="ponto__guia" role="status" aria-live="assertive">
          {tela.t === 'capturando' ? (
            <>
              <strong>{tela.instrucao}</strong>
              <span class="ponto__passos" aria-label={`Passo ${tela.passo} de ${tela.total}`}>
                {Array.from({ length: tela.total }, (_, i) => <i key={i} data-feito={i < tela.passo || undefined} />)}
              </span>
            </>
          ) : (
            <strong>Encaixe o rosto no oval</strong>
          )}
          {luz !== 'ok' && <span class="ponto__dica">{luz === 'escuro' ? 'Pouca luz aqui. Procure um lugar mais claro.' : 'Luz forte demais atrás de você.'}</span>}
        </div>
        <button type="button" class="ponto__btn ponto__btn--leve" onClick={desistir}>Cancelar</button>
      </section>

      {!camera && (
        <section class="ponto__palco" aria-live="polite">
          {tela.t === 'carregando' && <Espera texto="Preparando o ponto" />}
          {tela.t === 'analisando' && <Espera texto="Conferindo" />}
          {tela.t === 'registrando' && <Espera texto={`Registrando, ${tela.nome}`} />}

          {tela.t === 'inicio' && (
            <>
              <h1 class="ponto__oculto">Registro de ponto</h1>
              <Relogio data={relogio} />
              <button type="button" class="ponto__btn ponto__btn--principal" onClick={registrar}>
                <ScanFace aria-hidden="true" /> REGISTRAR PONTO
              </button>
              <p class="ponto__ajuda">Toque no botão, olhe para a câmera e siga as instruções.</p>
              <p class="ponto__nota">Sua imagem serve só para confirmar quem está registrando o ponto e não fica guardada neste aparelho.</p>
            </>
          )}

          {tela.t === 'desativado' && (
            <Cartao icone={<Clock3 aria-hidden="true" />} titulo="Ponto indisponível">
              <p>O registro de ponto por este tablet não está ativo. Procure o gestor.</p>
            </Cartao>
          )}

          {tela.t === 'sem_biometria' && (
            <>
              <Relogio data={relogio} />
              <Cartao icone={<UserRoundCheck aria-hidden="true" />} titulo="Reconhecimento indisponível">
                <p>O ponto por reconhecimento facial não está disponível agora. Procure o gestor para registrar.</p>
              </Cartao>
            </>
          )}

          {tela.t === 'parear' && <Parear erro={tela.erro} aoEnviar={pareando} />}

          {tela.t === 'escolher' && (
            <>
              <h1 class="ponto__titulo">{tela.nome}, o que você vai registrar?</h1>
              <div class="ponto__opcoes">
                {tela.opcoes.map((o) => (
                  <button type="button" class="ponto__btn ponto__btn--principal" key={o} onClick={() => escolher(o)}>{ROTULO_BATIDA[o]}</button>
                ))}
              </div>
              <button type="button" class="ponto__btn ponto__btn--leve" onClick={desistir}>Cancelar</button>
            </>
          )}

          {tela.t === 'sem_resposta' && (
            <Cartao icone={<WifiOff aria-hidden="true" />} titulo="Registro não confirmado">
              <p>{tela.nome}, o sistema não respondeu. Seu ponto pode não ter sido gravado.</p>
              <button type="button" class="ponto__btn ponto__btn--principal" onClick={repetirBatida}>Tentar de novo</button>
              <button type="button" class="ponto__btn ponto__btn--leve" onClick={desistir}>Procurar o gestor</button>
            </Cartao>
          )}

          {tela.t === 'recibo' && (
            <div class="ponto__recibo" role="status">
              <CheckCircle2 aria-hidden="true" />
              <h1>{tela.recibo.nome_exibicao}</h1>
              <p class="ponto__tipo">{ROTULO_BATIDA[tela.recibo.tipo]}</p>
              <p class="ponto__hora">{tela.recibo.hora.slice(0, 5)}</p>
              <p class="ponto__data">{dataCurta(tela.recibo.data)}</p>
              {tela.recibo.repetida && <p class="ponto__ajuda">Esta batida já estava registrada.</p>}
              <p class="ponto__nota">Comprovante operacional do Âmbar.</p>
            </div>
          )}

          {tela.t === 'aviso' && (
            <Cartao icone={tela.tipo === 'rede' ? <WifiOff aria-hidden="true" /> : <CircleAlert aria-hidden="true" />} titulo={tela.titulo}>
              <p>{tela.mensagem}</p>
              {tela.gestor && !tela.tentar && <p class="ponto__ajuda">O gestor registra pelo painel.</p>}
              {tela.tentar && <button type="button" class="ponto__btn ponto__btn--principal" onClick={tela.tipo === 'rede' ? () => void carregar(true) : registrar}>Tentar de novo</button>}
              <button type="button" class="ponto__btn ponto__btn--leve" onClick={() => setTela({ t: 'inicio' })}>Voltar</button>
            </Cartao>
          )}
        </section>
      )}
    </main>
  );
}

function Espera({ texto }: { texto: string }) {
  return (
    <div class="ponto__espera" role="status">
      <LoaderCircle class="ponto__girando" aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}

function Relogio({ data }: { data: Date | null }) {
  return (
    <div class="ponto__relogio">
      <time class="ponto__horas">{data ? horaFmt.format(data) : '--:--'}</time>
      <p class="ponto__dia">{data ? dataFmt.format(data) : ''}</p>
    </div>
  );
}

function Cartao({ icone, titulo, children }: { icone: preact.ComponentChildren; titulo: string; children: preact.ComponentChildren }) {
  return (
    <div class="ponto__cartao" role="status">
      {icone}
      <h1>{titulo}</h1>
      {children}
    </div>
  );
}

function Parear({ erro, aoEnviar }: { erro?: string; aoEnviar: (token: string) => void }) {
  const [token, setToken] = useState('');
  return (
    <form class="ponto__cartao" onSubmit={(e) => { e.preventDefault(); if (token.trim()) aoEnviar(token); }}>
      <CircleAlert aria-hidden="true" />
      <h1>Tablet não autorizado</h1>
      <p>Só o gestor autoriza este aparelho, pelo painel, em Equipe › Tablets.</p>
      <label class="ponto__campo">
        Código do tablet
        <input type="password" autocomplete="off" value={token} onInput={(e) => setToken(e.currentTarget.value)} />
      </label>
      {erro && <p class="ponto__erro" role="alert">{erro}</p>}
      <button type="submit" class="ponto__btn ponto__btn--principal" disabled={!token.trim()}>Autorizar tablet</button>
    </form>
  );
}
