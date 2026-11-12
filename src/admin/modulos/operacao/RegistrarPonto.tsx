// Registrar ponto no Modo Operação (tablet do café). Quem marca é o ROSTO identificado no backend, nunca a conta logada:
//   toque em "Registrar ponto" → câmera → o backend identifica → a tela mostra nome, marcação e horário → a pessoa CONFIRMA
//   → o backend grava → recibo → volta ao início, pronto para a próxima pessoa.
// Nada é gravado sem confirmação, e sucesso só aparece com o recibo do backend nas mãos. Sem rosto reconhecido, sem câmera,
// sem internet ou com o sistema fora do ar, a tela diz que o ponto NÃO foi registrado e manda ao gestor, que regulariza pelo
// painel (registro assistido ou inclusão com horário e motivo, auditados). Repetir a confirmação usa a mesma chave: nunca
// grava duas batidas.
import { useEffect, useRef, useState } from 'preact/hooks';
import { CheckCircle2, CircleAlert, LoaderCircle, ScanFace, UserRoundX, WifiOff } from 'lucide-preact';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { terminal } from '../../lib/api/operacao';
import type { ConfiguracaoQuiosque, SessaoTerminal } from '../../lib/tipos/abertura';
import { ROTULO_BATIDA, orientacaoDoMotivo, type Recibo, type TipoBatida } from '../../../lib/ponto/contrato';
import { Botao } from '../../ui/base';
import { Identificacao, mensagemDeErro, type FimIdentificacao } from './Identificacao';
import { Contingencia, Relogio, useRelogioDoServidor } from './comum-ponto';

const RECIBO_MS = 6_000;
const AVISO_MS = 25_000;

type Tela =
  | { t: 'inicio' }
  | { t: 'camera' }
  | { t: 'confirmar'; nome: string; tipo: TipoBatida | null; opcoes: TipoBatida[] }
  | { t: 'registrando'; nome: string }
  | { t: 'sem_resposta'; nome: string }
  | { t: 'recibo'; recibo: Recibo }
  | { t: 'aviso'; titulo: string; mensagem: string; tentar: boolean; gestor: boolean; rede?: boolean };

interface Batida {
  sessao: SessaoTerminal;
  autorizacao: string;
  chave: string;
  expira: number;
  nome: string;
}

export function RegistrarPonto({ config, apiUrl, aoRecarregar }: { config: ConfiguracaoQuiosque; apiUrl: string | null; aoRecarregar: () => void }) {
  const [tela, setTela] = useState<Tela>({ t: 'inicio' });
  const batidaRef = useRef<Batida | null>(null);
  const agora = useRelogioDoServidor(config.horario_servidor);
  const disponivel = config.biometria_disponivel && config.identificacao_automatica !== false;

  // Recibo e avisos voltam sozinhos ao início: o tablet fica pronto para a próxima pessoa.
  useEffect(() => {
    if (tela.t !== 'recibo' && tela.t !== 'aviso') return;
    const t = setTimeout(() => setTela({ t: 'inicio' }), tela.t === 'recibo' ? RECIBO_MS : AVISO_MS);
    return () => clearTimeout(t);
  }, [tela]);
  // A autorização vence (backend: ~45 s): confirmação esquecida na tela não fica valendo.
  useEffect(() => {
    if (tela.t !== 'confirmar') return;
    const b = batidaRef.current;
    const t = setTimeout(() => {
      descartar();
      setTela({ t: 'aviso', titulo: 'Tempo esgotado', mensagem: 'Nada foi registrado. Toque em Registrar ponto de novo.', tentar: false, gestor: false });
    }, Math.max(1000, (b?.expira ?? Date.now()) - Date.now()));
    return () => clearTimeout(t);
  }, [tela.t]);

  const descartar = () => {
    const b = batidaRef.current;
    batidaRef.current = null;
    if (b) void terminal.cancelar(b.sessao.sessao_id, 'desistencia');
  };

  const aoIdentificar = (fim: FimIdentificacao) => {
    if (fim.tipo === 'cancelada') return setTela({ t: 'inicio' });
    if (fim.tipo === 'erro') {
      const m = mensagemDeErro(fim.erro);
      if (fim.erro instanceof ErroApi && (fim.erro.codigo === 'identificacao_automatica_desligada' || fim.erro.codigo === 'ponto_desativado')) aoRecarregar();
      return setTela({ t: 'aviso', ...m });
    }
    const { sessao, resultado } = fim;
    if (resultado.resultado !== 'aprovado' || !resultado.autorizacao || !resultado.proxima_batida) {
      const dica = orientacaoDoMotivo(resultado.motivo);
      return setTela({
        t: 'aviso',
        titulo: resultado.resultado === 'rosto_desconhecido' ? 'Rosto não reconhecido' : 'Ponto não registrado',
        mensagem: dica ? `${resultado.mensagem} ${dica}` : resultado.mensagem,
        tentar: resultado.nova_tentativa,
        gestor: !!resultado.encaminhar_gestor,
      });
    }
    const nome = resultado.nome_exibicao ?? '';
    const proxima = resultado.proxima_batida;
    const expira = resultado.autorizacao_expira_em ? new Date(resultado.autorizacao_expira_em).getTime() : Date.now() + 30_000;
    batidaRef.current = { sessao, autorizacao: resultado.autorizacao, chave: novaChave(), expira, nome };
    if (proxima.acao === 'ja_registrada') {
      descartar();
      return setTela({ t: 'aviso', titulo: 'Ponto já registrado', mensagem: `${nome}, sua última marcação já está no sistema. Não precisa registrar de novo.`, tentar: false, gestor: false });
    }
    if (proxima.acao === 'supervisao') {
      descartar();
      return setTela({ t: 'aviso', titulo: 'Fale com o gestor', mensagem: `${nome}, este registro precisa do gestor. Nada foi registrado.`, tentar: false, gestor: true });
    }
    setTela({ t: 'confirmar', nome, tipo: proxima.acao === 'registrar' ? proxima.tipo : null, opcoes: proxima.acao === 'escolher' ? proxima.opcoes : [] });
  };

  const confirmar = async (tipo?: TipoBatida) => {
    const b = batidaRef.current;
    if (!b) return;
    setTela({ t: 'registrando', nome: b.nome });
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const recibo = await terminal.bater(b.sessao.sessao_id, b.autorizacao, b.chave, tipo);
        batidaRef.current = null;
        return setTela({ t: 'recibo', recibo });
      } catch (e) {
        if (e instanceof ErroApi && (e.tipo === 'rede' || e.tipo === 'tempo')) {
          // Mesma chave: repetir nunca grava duas batidas.
          if (tentativa === 0) {
            await new Promise((ok) => setTimeout(ok, 1200));
            continue;
          }
          return setTela({ t: 'sem_resposta', nome: b.nome });
        }
        batidaRef.current = null;
        if (e instanceof ErroApi && e.codigo === 'marcacao_recente') {
          return setTela({ t: 'aviso', titulo: 'Ponto já registrado', mensagem: `${b.nome}, sua marcação já está no sistema. Não precisa registrar de novo.`, tentar: false, gestor: false });
        }
        if (e instanceof ErroApi && e.codigo === 'escolha_necessaria' && Array.isArray(e.dados?.opcoes)) {
          // Raro: a escala mudou entre a identificação e a confirmação.
          return setTela({ t: 'aviso', titulo: 'Confira a marcação', mensagem: 'Nada foi registrado. Registre o ponto de novo.', tentar: true, gestor: false });
        }
        if (e instanceof ErroApi && (e.codigo === 'sessao_expirada' || e.codigo === 'autorizacao_invalida')) {
          return setTela({ t: 'aviso', titulo: 'Tempo esgotado', mensagem: 'Nada foi registrado. Toque em Registrar ponto de novo.', tentar: true, gestor: false });
        }
        const m = mensagemDeErro(e);
        return setTela({ t: 'aviso', ...m, titulo: 'Ponto não registrado', mensagem: e instanceof ErroApi ? e.message : m.mensagem });
      }
    }
  };

  const repetir = () => {
    const b = batidaRef.current;
    if (!b || Date.now() > b.expira) {
      batidaRef.current = null;
      return setTela({ t: 'aviso', titulo: 'Não confirmado', mensagem: 'O sistema não confirmou a tempo. Registre de novo: uma marcação já gravada nunca é duplicada.', tentar: true, gestor: true });
    }
    void confirmar();
  };

  const desistir = () => {
    descartar();
    setTela({ t: 'inicio' });
  };

  if (!disponivel && tela.t === 'inicio') {
    return (
      <div class="op-terminal">
        <Relogio agora={agora} />
        <div class="op-terminal__cartao" role="status">
          <UserRoundX aria-hidden="true" />
          <h2>Ponto pelo rosto indisponível</h2>
          <p>O reconhecimento facial não está liberado neste momento. <strong>Nenhum ponto é registrado por este tablet.</strong></p>
        </div>
        <Contingencia />
      </div>
    );
  }

  return (
    <div class="op-terminal" data-tela={tela.t}>
      {tela.t === 'inicio' && (
        <>
          <Relogio agora={agora} />
          <button type="button" class="op-terminal__principal" onClick={() => setTela({ t: 'camera' })}>
            <ScanFace aria-hidden="true" /> Registrar ponto
          </button>
          <p class="op-terminal__ajuda">Cada pessoa registra o próprio ponto: toque, olhe para a câmera e siga as instruções.</p>
          <p class="op-terminal__nota">A imagem serve só para confirmar quem está registrando e não fica guardada no tablet.</p>
        </>
      )}

      {tela.t === 'camera' && <Identificacao config={config} apiUrl={apiUrl} aoTerminar={aoIdentificar} />}

      {tela.t === 'confirmar' && (
        <div class="op-confirma" role="dialog" aria-label="Confirmar ponto">
          <p class="op-confirma__rotulo">Confira e confirme</p>
          <h2 class="op-confirma__nome">{tela.nome}</h2>
          {tela.tipo ? (
            <>
              <p class="op-confirma__tipo">{ROTULO_BATIDA[tela.tipo]}</p>
              <p class="op-confirma__hora num">{agora ? horaCurta(agora) : '--:--'}</p>
              <div class="op-confirma__acoes">
                <button type="button" class="op-terminal__principal" onClick={() => confirmar()}>
                  <CheckCircle2 aria-hidden="true" /> Confirmar
                </button>
                <Botao variante="fantasma" onClick={desistir}>Não sou eu / cancelar</Botao>
              </div>
            </>
          ) : (
            <>
              <p class="op-confirma__pergunta">O que você vai registrar agora? <span class="num">{agora ? horaCurta(agora) : ''}</span></p>
              <div class="op-confirma__opcoes">
                {tela.opcoes.map((o) => (
                  <button type="button" key={o} class="op-terminal__principal op-terminal__principal--opcao" onClick={() => confirmar(o)}>{ROTULO_BATIDA[o]}</button>
                ))}
              </div>
              <Botao variante="fantasma" onClick={desistir}>Não sou eu / cancelar</Botao>
            </>
          )}
        </div>
      )}

      {tela.t === 'registrando' && (
        <div class="op-terminal__cartao" role="status">
          <LoaderCircle class="girando" aria-hidden="true" />
          <h2>Registrando, {tela.nome}…</h2>
        </div>
      )}

      {tela.t === 'sem_resposta' && (
        <div class="op-terminal__cartao op-terminal__cartao--atencao" role="alert">
          <WifiOff aria-hidden="true" />
          <h2>Registro NÃO confirmado</h2>
          <p>{tela.nome}, o sistema não respondeu. Seu ponto pode não ter sido gravado.</p>
          <div class="op-confirma__acoes">
            <button type="button" class="op-terminal__principal" onClick={repetir}>Tentar de novo</button>
            <Botao variante="fantasma" onClick={desistir}>Avisar o gestor</Botao>
          </div>
        </div>
      )}

      {tela.t === 'recibo' && (
        <div class="op-recibo" role="status">
          <CheckCircle2 aria-hidden="true" />
          <p class="op-recibo__rotulo">Ponto registrado</p>
          <h2>{tela.recibo.nome_exibicao}</h2>
          <p class="op-recibo__tipo">{ROTULO_BATIDA[tela.recibo.tipo]}</p>
          <p class="op-recibo__hora num">{tela.recibo.hora.slice(0, 5)}</p>
          <p class="op-recibo__data">{tela.recibo.data.split('-').reverse().join('/')}</p>
          {tela.recibo.repetida && <p class="fraco">Esta marcação já estava registrada (nada foi duplicado).</p>}
          <Botao variante="fantasma" onClick={() => setTela({ t: 'inicio' })}>Próxima pessoa</Botao>
        </div>
      )}

      {tela.t === 'aviso' && (
        <div class={`op-terminal__cartao${tela.gestor ? ' op-terminal__cartao--atencao' : ''}`} role="alert">
          {tela.rede ? <WifiOff aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
          <h2>{tela.titulo}</h2>
          <p>{tela.mensagem}</p>
          {tela.titulo !== 'Ponto já registrado' && <p><strong>O ponto não foi registrado.</strong></p>}
          <div class="op-confirma__acoes">
            {tela.tentar && <button type="button" class="op-terminal__principal" onClick={() => setTela(tela.rede ? { t: 'inicio' } : { t: 'camera' })}>Tentar de novo</button>}
            <Botao variante="fantasma" onClick={() => setTela({ t: 'inicio' })}>Voltar</Botao>
          </div>
          {tela.gestor && <Contingencia compacta />}
        </div>
      )}
    </div>
  );
}

const horaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' });
const horaCurta = (ms: number) => horaFmt.format(ms);
