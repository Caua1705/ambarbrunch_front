// Conversa aberta: cabeçalho com o contato e as ações (ficha do contato, assistente ligado/desligado, assumir, assumir no
// lugar, encerrar e, no menu "…", enviar template e follow-up), a linha do tempo única e a caixa de resposta.
// Linha do tempo: as mensagens da conversa (cliente, assistente, equipe, campanha, automação) intercaladas por horário com
// as que saíram por outros caminhos (templates de reserva e do Clube, respostas automáticas dos botões), estas só leitura.
// Mídia (imagem, áudio, documento) vem pela ponte do painel com o login, carregada só quando aparece na tela.
// Um controle só para o assistente: ligar = devolver ao assistente (vale para o que o cliente escrever depois); desligar =
// a conversa vai para "Esperando". Responder também desliga o assistente (o backend faz isso ANTES do envio).
// Evento: com oportunidade (aberta ou a última), a ficha fica na coluna lateral (tela larga) ou numa faixa que abre a gaveta
// (tablet e celular); sem evento aberto, "Registrar evento" no menu "…". O status comercial não muda o estado da conversa.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  Bot, UserRound, Headset, Send, ArrowLeft, Hand, CheckCheck, AlertCircle, Clock, Phone, Mic, ArrowLeftRight, Megaphone, Zap,
  Ellipsis, MessageSquarePlus, Bell, BellOff, Contact, FileText, ImageOff, CalendarCheck, Award, PartyPopper,
} from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento, urlMidia } from '../../lib/api/atendimento-clube';
import { ErroApi } from '../../lib/api/cliente';
import { telefone, horaDe, dataHora } from '../../lib/formato';
import { Gaveta, Suspenso, avisar, avisarErro, type useConfirmacao } from '../../ui/camadas';
import { Botao, Situacao, Aviso, Etiqueta } from '../../ui/base';
import { Esqueleto, Falha } from '../../ui/estados';
import type { ConversaDetalhe, MensagemExterna, MensagemPainel } from '../../lib/tipos/atendimento-clube';
import { ESTADO, TEXTO_MAX, motivoHumano, mensagemDeEnvio } from './comum';
import { Contato } from './Contato';
import type { DestinoInicial } from './NovaConversa';
import { FaixaEvento, FichaEvento, RegistrarEvento, useOpcoesEventos } from './Evento';

type Confirmar = ReturnType<typeof useConfirmacao>['confirmar'];

/** Repassa o erro com a mensagem do Atendimento (o diálogo de confirmação mostra `message`). */
function comMensagem(e: unknown): never {
  if (e instanceof ErroApi) e.message = mensagemDeEnvio(e);
  throw e;
}

/** A mensagem da equipe que acabou de sair voltou com falha? (nunca mostrar "enviada" quando não saiu) */
function falhaDoEnvio(c: ConversaDetalhe): string | null {
  const ultima = [...c.mensagens].reverse().find((m) => m.direcao === 'saida' && m.autor === 'equipe');
  return ultima?.status === 'falhou' ? ultima.erro ?? 'a Meta recusou o envio' : null;
}

export function Conversa({ id, meuId, assistenteAtivo, eventos, podeMudarStatus, aoVoltar, aoEnviarTemplate, confirmar }: {
  id: string;
  meuId: string;
  /** O backend tem eventos (resumo.eventos presente; anterior à 0023 não tem). */
  eventos: boolean;
  /** Plano B do papel para atendimento.eventos, enquanto as opções do backend não chegam. */
  podeMudarStatus: boolean;
  /** Assistente ligado na configuração do servidor (resumo.configuracao); desconhecido = undefined. */
  assistenteAtivo: boolean | undefined;
  aoVoltar: () => void;
  aoEnviarTemplate: (destino: DestinoInicial) => void;
  confirmar: Confirmar;
}) {
  // Conversa aberta: relida a cada 5 s com a aba visível (a resposta do cliente aparece sem recarregar).
  const consulta = useConsulta(`atendimento/conversas/${id}`, () => atendimento.conversa(id), { intervalo: 5_000 });
  const [anteriores, setAnteriores] = useState<MensagemPainel[]>([]);
  const [semMais, setSemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [verContato, setVerContato] = useState(false);
  const [verEvento, setVerEvento] = useState(false);
  const [registrar, setRegistrar] = useState(false);
  const opcoesEventos = useOpcoesEventos(eventos);
  const fim = useRef<HTMLDivElement>(null);
  const c = consulta.dados;

  useEffect(() => {
    setAnteriores([]);
    setSemMais(false);
    setTexto('');
    setVerContato(false);
    setVerEvento(false);
    setRegistrar(false);
  }, [id]);
  const qtd = (c?.mensagens.length ?? 0) + (c?.externas?.length ?? 0);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [qtd, id]);

  // Linha do tempo única: mensagens da conversa + as que saíram por outros caminhos, por horário (sort estável).
  const linha = useMemo(() => {
    const itens: ({ tipo: 'msg'; m: MensagemPainel; em: number } | { tipo: 'ext'; e: MensagemExterna; em: number })[] = [
      ...[...anteriores, ...(c?.mensagens ?? [])].map((m) => ({ tipo: 'msg' as const, m, em: Date.parse(m.criado_em) })),
      ...(c?.externas ?? []).map((e) => ({ tipo: 'ext' as const, e, em: Date.parse(e.criado_em) })),
    ];
    return itens.sort((a, b) => a.em - b.em);
  }, [anteriores, c]);

  async function carregarAnteriores() {
    const primeira = anteriores[0] ?? c?.mensagens[0];
    if (!primeira) return;
    setCarregandoMais(true);
    try {
      const mais = await atendimento.anteriores(id, primeira.id);
      if (!mais.length) setSemMais(true);
      setAnteriores((a) => [...mais, ...a]);
    } catch (e) {
      avisarErro(e);
    } finally {
      setCarregandoMais(false);
    }
  }

  async function acao(nome: string, fn: () => Promise<ConversaDetalhe>, ok: string) {
    setOcupado(nome);
    try {
      await fn();
      avisar(ok, 'ok');
    } catch (e) {
      avisar(mensagemDeEnvio(e), 'erro');
    } finally {
      invalidar('atendimento');
      setOcupado(null);
    }
  }

  async function responder(e: Event) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const depois = await atendimento.responder(id, t);
      const falha = falhaDoEnvio(depois);
      if (falha) avisar(`A mensagem não saiu: ${falha}`, 'erro');
      else setTexto('');
    } catch (err) {
      // Fora da janela a conversa fica com você (o assistente desliga), mas nada sai: o texto continua na caixa.
      avisar(mensagemDeEnvio(err), 'erro');
    } finally {
      invalidar('atendimento');
      setEnviando(false);
    }
  }

  if (!c) {
    return consulta.erro ? <Falha erro={consulta.erro} aoTentar={consulta.recarregar} recurso="A conversa" /> : <div style={{ padding: '20px' }}><Esqueleto linhas={6} altura={30} /></div>;
  }
  const comigo = c.modo === 'humano' && c.atendente_id === meuId;
  const deOutro = c.modo === 'humano' && !!c.atendente_id && c.atendente_id !== meuId;
  // Encaminhada pelo assistente e ainda sem ninguém (ou com o assistente): qualquer um pode assumir.
  const semDono = c.modo !== 'humano' || !c.atendente_id;
  // Como o backend: responde quem atende ou qualquer um numa conversa sem dono (e aí assume); só dentro das 24 h.
  const podeEscrever = c.dentro_da_janela && (semDono || comigo);
  const estado = ESTADO[c.estado] ?? ESTADO.automatico;
  const nome = c.nome_contato || telefone(c.telefone_e164);
  const assistenteBloqueado = assistenteAtivo === false && !c.assistente_ligado;
  const evento = eventos ? c.evento ?? null : null;
  const comStatus = opcoesEventos.dados?.pode_mudar_status ?? podeMudarStatus;
  const ficha = evento && (
    <FichaEvento evento={evento} podeMudarStatus={comStatus} confirmar={confirmar} aoRegistrarNovo={() => { setVerEvento(false); setRegistrar(true); }} />
  );

  const alternarAssistente = () => {
    if (c.assistente_ligado) {
      acao('assistente', () => atendimento.assistente(id, false), 'Assistente desligado nesta conversa: ela foi para “Esperando”.');
      return;
    }
    confirmar({
      titulo: 'Ligar o assistente nesta conversa?',
      texto: `${deOutro ? `${c.atendente_nome ?? 'Outra pessoa'} está atendendo e deixa de responder por ela. ` : ''}O assistente volta a responder sozinho, só o que o cliente escrever daqui em diante.`,
      confirmar: 'Ligar assistente',
      acao: async () => {
        try {
          await atendimento.assistente(id, true);
        } catch (e) {
          comMensagem(e);
        } finally {
          invalidar('atendimento');
        }
      },
      sucesso: 'Assistente ligado nesta conversa.',
    });
  };

  return (
    <>
      <div class="conversa__topo">
        <Botao class="menu-voltar" variante="fantasma" so_icone aria-label="Voltar para a lista" icone={<ArrowLeft aria-hidden="true" />} onClick={aoVoltar} />
        <div class="conversa__quem">
          <h3>{nome}</h3>
          <div class="linha fraco" style={{ gap: '8px' }}>
            <span class="num">{telefone(c.telefone_e164)}</span>
            <Situacao tom={estado.tom}>{c.estado === 'em_atendimento' ? (comigo ? 'Com você' : `Com ${c.atendente_nome ?? 'a equipe'}`) : estado.rotulo}</Situacao>
            {eventos && (c.assunto === 'evento' || evento?.aberta) && <Etiqueta tom="marca" icone={<PartyPopper aria-hidden="true" />}>Evento</Etiqueta>}
          </div>
        </div>
        <div class="linha" style={{ flexWrap: 'nowrap', gap: '4px' }}>
          <a class="btn btn--p btn--fantasma btn--icone" href={`tel:${c.telefone_e164}`} aria-label="Ligar para o cliente" title="Ligar"><Phone aria-hidden="true" /></a>
          <Botao tamanho="p" variante="fantasma" icone={<Contact aria-hidden="true" />} aria-label="Ficha do contato" title="Ficha do contato" onClick={() => setVerContato(true)}>
            <span class="so-desktop">Contato</span>
          </Botao>
          <Suspenso rotulo="Mais ações da conversa" gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone icone={<Ellipsis aria-hidden="true" />} {...p} />}>
            {(fechar) => (
              <>
                <button type="button" class="suspenso__item" role="menuitem" onClick={() => { fechar(); aoEnviarTemplate({ telefone: c.telefone_e164, nome: c.nome_contato ?? undefined, conversaId: c.id }); }}>
                  <MessageSquarePlus aria-hidden="true" /> Enviar template
                </button>
                <button
                  type="button"
                  class="suspenso__item"
                  role="menuitem"
                  onClick={() => {
                    fechar();
                    acao('followup', () => atendimento.followup(id, c.followup_desligado), c.followup_desligado ? 'Follow-up ligado nesta conversa.' : 'Follow-up desligado nesta conversa.');
                  }}
                >
                  {c.followup_desligado ? <Bell aria-hidden="true" /> : <BellOff aria-hidden="true" />} {c.followup_desligado ? 'Ligar follow-up' : 'Desligar follow-up'}
                </button>
                {eventos && !evento?.aberta && (
                  <button type="button" class="suspenso__item" role="menuitem" onClick={() => { fechar(); setRegistrar(true); }}>
                    <PartyPopper aria-hidden="true" /> Registrar evento
                  </button>
                )}
              </>
            )}
          </Suspenso>
        </div>
      </div>

      <div class="conversa__barra">
        <button
          type="button"
          role="switch"
          class="interruptor"
          aria-checked={c.assistente_ligado}
          disabled={!!ocupado || assistenteBloqueado}
          title={assistenteBloqueado ? 'O assistente virtual está desligado na configuração do servidor' : c.assistente_ligado ? 'Desligar: a conversa vai para “Esperando”' : 'Ligar: o assistente volta a responder o que o cliente escrever'}
          onClick={alternarAssistente}
        >
          <span class="interruptor__trilho" aria-hidden="true"><span class="interruptor__bola" /></span>
          <span>Assistente: <strong>{c.assistente_ligado ? 'Ligado' : 'Desligado'}</strong></span>
        </button>
        <div class="linha" style={{ gap: '6px', marginLeft: 'auto' }}>
          {semDono && c.modo !== 'encerrada' && (
            <Botao tamanho="p" variante={c.estado === 'esperando' ? 'primario' : 'secundario'} icone={<Hand aria-hidden="true" />} carregando={ocupado === 'assumir'} disabled={!!ocupado} onClick={() => acao('assumir', () => atendimento.assumir(id), 'Você assumiu a conversa. O assistente está desligado nela.')}>
              Assumir
            </Botao>
          )}
          {deOutro && (
            <Botao tamanho="p" icone={<ArrowLeftRight aria-hidden="true" />} onClick={() => confirmar({ titulo: `Assumir a conversa no lugar de ${c.atendente_nome ?? 'outra pessoa'}?`, texto: 'A conversa passa para você; quem atendia deixa de responder por ela.', confirmar: 'Assumir no lugar', acao: async () => { try { await atendimento.assumir(id, true); } catch (e) { comMensagem(e); } finally { invalidar('atendimento'); } }, sucesso: 'Conversa transferida para você.' })}>
              Assumir no lugar{c.atendente_nome ? ` de ${c.atendente_nome.split(' ')[0]}` : ''}
            </Botao>
          )}
          {c.modo !== 'encerrada' && (
            <Botao tamanho="p" icone={<CheckCheck aria-hidden="true" />} aria-label="Encerrar conversa" onClick={() => confirmar({ titulo: 'Encerrar esta conversa?', texto: 'Ela sai da fila e o assistente descarta o que ia responder. Se o cliente escrever de novo, a conversa reabre.', confirmar: 'Encerrar', acao: async () => { try { await atendimento.encerrar(id); } finally { invalidar('atendimento'); } }, sucesso: 'Conversa encerrada.' })}>
              <span class="so-desktop">Encerrar</span>
            </Botao>
          )}
        </div>
      </div>

      {c.motivo_humano && c.modo === 'humano' && (
        <div class="conversa__motivo fraco">Motivo do encaminhamento: {motivoHumano(c.motivo_humano)}</div>
      )}

      <div class={`conversa__corpo${evento ? ' conversa__corpo--evento' : ''}`}>
      <div class="conversa__fluxo">
      {evento && <FaixaEvento evento={evento} aoAbrir={() => setVerEvento(true)} />}
      <div class="mensagens" aria-live="polite" aria-label="Mensagens">
        {!semMais && (c.mensagens.length + anteriores.length) >= 20 && (
          <Botao tamanho="p" variante="fantasma" carregando={carregandoMais} onClick={carregarAnteriores} style={{ alignSelf: 'center' }}>Carregar mensagens anteriores</Botao>
        )}
        {linha.map((i) => (i.tipo === 'msg' ? <Mensagem key={i.m.id} m={i.m} /> : <Externa key={i.e.chave} e={i.e} />))}
        <div ref={fim} />
      </div>

      <form onSubmit={responder} class="conversa__resposta pilha pilha--p">
        {!c.dentro_da_janela ? (
          <Aviso tom="atencao" icone={<Clock aria-hidden="true" />}>
            <span>Passaram 24 h desde a última mensagem do cliente: pela regra da Meta, texto livre não sai. Envie um template aprovado ou ligue para o cliente.</span>{' '}
            <Botao tamanho="p" icone={<MessageSquarePlus aria-hidden="true" />} onClick={() => aoEnviarTemplate({ telefone: c.telefone_e164, nome: c.nome_contato ?? undefined, conversaId: c.id })}>Enviar template</Botao>
          </Aviso>
        ) : semDono ? (
          <p class="fraco">Responder assume a conversa e desliga o assistente nela.</p>
        ) : !comigo ? (
          <p class="fraco">{c.atendente_nome ?? 'Outra pessoa'} está atendendo esta conversa.</p>
        ) : null}
        <div class="linha" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
          <label class="sr" for="resposta">Resposta</label>
          <textarea
            id="resposta"
            class="area"
            rows={1}
            style={{ minHeight: '44px', maxHeight: '160px' }}
            placeholder={!podeEscrever ? 'Resposta indisponível' : comigo ? 'Escreva a resposta…' : 'Responder assume a conversa e desliga o assistente'}
            disabled={!podeEscrever}
            maxLength={TEXTO_MAX}
            value={texto}
            onInput={(e) => setTexto(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
          />
          <Botao type="submit" variante="primario" so_icone aria-label="Enviar resposta" carregando={enviando} disabled={!podeEscrever || !texto.trim()} icone={<Send aria-hidden="true" />} />
        </div>
      </form>
      </div>
      {ficha && <aside class="conversa__lateral" aria-label="Ficha do evento">{ficha}</aside>}
      </div>

      <Contato conversaId={verContato ? c.id : null} aoFechar={() => setVerContato(false)} />
      {ficha && (
        <Gaveta aberta={verEvento} aoFechar={() => setVerEvento(false)} titulo="Evento" subtitulo={nome} largura="media">
          {ficha}
        </Gaveta>
      )}
      {eventos && <RegistrarEvento conversaId={c.id} nome={nome} aberta={registrar} aoFechar={() => setRegistrar(false)} />}
    </>
  );
}

// Linha do tempo -------------------------------------------------------------------------------------------------------

function autorDe(m: MensagemPainel): { rotulo: string; icone: ComponentChildren } {
  switch (m.autor) {
    case 'robo':
      return { rotulo: 'Assistente virtual', icone: <Bot aria-hidden="true" /> };
    case 'campanha':
      return { rotulo: 'Campanha', icone: <Megaphone aria-hidden="true" /> };
    case 'automacao':
      return { rotulo: m.followup ? 'Follow-up' : 'Automático', icone: <Zap aria-hidden="true" /> };
    case 'cliente':
      return { rotulo: 'Cliente', icone: <UserRound aria-hidden="true" /> };
    default:
      return { rotulo: m.usuario_nome ?? 'Equipe', icone: <Headset aria-hidden="true" /> };
  }
}

const SITUACAO_MSG: Record<string, string> = { pendente: 'Enviando…', enviada: 'Enviada', entregue: 'Entregue', lida: 'Lida', recebida: '' };
const TIPO_SEM_TEXTO: Record<string, string> = {
  imagem: 'Imagem', figurinha: 'Figurinha', audio: 'Áudio', documento: 'Documento', video: 'Vídeo', localizacao: 'Localização',
  contato: 'Contato compartilhado', botao: 'Clique em botão', template: 'Template', outro: 'Arquivo', texto: 'Mensagem',
};

/** Horários de envio, entrega e leitura no title do indicador (o que a Meta confirmou). */
function tituloEnvio(m: MensagemPainel): string {
  return [m.enviada_em && `Enviada ${dataHora(m.enviada_em)}`, m.entregue_em && `Entregue ${dataHora(m.entregue_em)}`, m.lida_em && `Lida ${dataHora(m.lida_em)}`].filter(Boolean).join(' · ') || dataHora(m.criado_em);
}

function Mensagem({ m }: { m: MensagemPainel }) {
  const saida = m.direcao === 'saida';
  const a = autorDe(m);
  const falhou = m.status === 'falhou' || m.status === 'descartada';
  const corpo = m.texto ?? (m.tipo === 'audio' ? null : m.transcricao);
  return (
    <div class={`msg${saida ? ' msg--saida' : ''} msg--${m.autor}${falhou ? ' msg--falha' : ''}`} data-autor={m.autor}>
      {saida && (
        <div class="msg__autor">
          {a.icone} {a.rotulo}
          {m.tipo === 'template' && <Etiqueta tom="info"><span title={m.template_nome ?? undefined}>Template</span></Etiqueta>}
        </div>
      )}
      {m.tem_midia && <Midia m={m} />}
      {m.tipo === 'audio' && (
        <div class="fraco linha" style={{ gap: '4px' }}>
          <Mic size={13} aria-hidden="true" /> Áudio{m.transcricao ? ' · transcrição:' : ''}
        </div>
      )}
      {m.tipo === 'audio' && m.transcricao && <div>{m.transcricao}</div>}
      {corpo ? <div>{corpo}</div> : !m.tem_midia && m.tipo !== 'audio' && <span class="fraco">[{TIPO_SEM_TEXTO[m.tipo] ?? m.tipo}]</span>}
      <div class="msg__meta">
        <span title={dataHora(m.criado_em)}>{horaDe(m.criado_em)}</span>
        {saida && !falhou && SITUACAO_MSG[m.status] !== '' && <span title={tituloEnvio(m)}>{SITUACAO_MSG[m.status] ?? m.status}</span>}
        {falhou && (
          <span class="msg__falha">
            <AlertCircle size={12} aria-hidden="true" /> {m.status === 'descartada' ? 'Não enviada (atendimento humano)' : `Falhou${m.erro ? `: ${m.erro}` : ''}`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Imagem (sob demanda, tamanho máximo), áudio com player e documento/vídeo como link. Tudo pela ponte, com o login. */
function Midia({ m }: { m: MensagemPainel }) {
  const [quebrou, setQuebrou] = useState(false);
  const url = urlMidia(m.id);
  if ((m.tipo === 'imagem' || m.tipo === 'figurinha') && !quebrou) {
    return (
      <a class="msg__midia" href={url} target="_blank" rel="noopener" title="Abrir a imagem em outra aba">
        <img src={url} alt={m.midia_nome ?? (m.tipo === 'figurinha' ? 'Figurinha enviada pelo cliente' : 'Imagem enviada pelo cliente')} loading="lazy" decoding="async" onError={() => setQuebrou(true)} />
      </a>
    );
  }
  if (m.tipo === 'audio') {
    return <audio class="msg__audio" controls preload="none" src={url} aria-label="Áudio da mensagem" />;
  }
  return (
    <a class="msg__arquivo" href={url} target="_blank" rel="noopener">
      {quebrou ? <ImageOff size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
      {quebrou ? 'Imagem indisponível aqui — abrir arquivo' : `Abrir arquivo${m.midia_nome ? `: ${m.midia_nome}` : ''}`}
    </a>
  );
}

const ORIGEM_EXTERNA: Record<MensagemExterna['origem'], ComponentChildren> = {
  reserva: <CalendarCheck aria-hidden="true" />,
  clube: <Award aria-hidden="true" />,
  automacao: <Zap aria-hidden="true" />,
};

/** Saiu por outro caminho (template de reserva/Clube, resposta automática de botão): balão de saída discreto, sem ações. */
function Externa({ e }: { e: MensagemExterna }) {
  const falhou = e.status === 'falhou';
  return (
    <div class={`msg msg--saida msg--externa${falhou ? ' msg--falha' : ''}`} data-externa={e.origem}>
      <div class="msg__autor">
        {ORIGEM_EXTERNA[e.origem] ?? <Zap aria-hidden="true" />} {e.rotulo}
        {e.tipo === 'template' && <span class="fraco"> · template</span>}
      </div>
      {e.texto && <div>{e.texto}</div>}
      <div class="msg__meta">
        <span title={dataHora(e.criado_em)}>{horaDe(e.criado_em)}</span>
        {falhou ? (
          <span class="msg__falha"><AlertCircle size={12} aria-hidden="true" /> Falhou{e.erro ? `: ${e.erro}` : ''}</span>
        ) : (
          <span>{SITUACAO_MSG[e.status] || e.status}</span>
        )}
      </div>
    </div>
  );
}
