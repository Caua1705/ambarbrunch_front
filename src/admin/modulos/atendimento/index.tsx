// Atendimento: WhatsApp oficial do Âmbar (Cloud API da Meta). Caixa de entrada à esquerda e conversa à direita; no celular,
// uma de cada vez. O atendente automático é o "Assistente virtual" (robô do n8n) — não é a Júlia do grupo interno.
// Rotas reais /admin/atendimento/* (código pronto; em produção só depois da migração 0006).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Search, Bot, UserRound, Headset, Send, ArrowLeft, Hand, Undo2, CheckCheck, AlertCircle, Clock, Phone, MessageSquareOff, Mic, Inbox } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { ErroApi } from '../../lib/api/cliente';
import { telefone, relativo, horaDe, dataHora, plural, inteiro } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz, Gaveta, useConfirmacao, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Cabecalho, Indicador, Segmentado, Situacao, Aviso, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio, Falha } from '../../ui/estados';
import type { ConversaDetalhe, ConversaResumo, MensagemPainel, ModoConversa } from '../../lib/tipos/atendimento-clube';

type Filtro = 'todas' | 'aguardando' | 'robo' | 'humano' | 'encerrada';

const MODO: Record<ModoConversa, { rotulo: string; tom: 'info' | 'marca' | 'apagado' }> = {
  robo: { rotulo: 'Assistente virtual', tom: 'info' },
  humano: { rotulo: 'Equipe', tom: 'marca' },
  encerrada: { rotulo: 'Encerrada', tom: 'apagado' },
};

export default function Atendimento({ contexto }: { contexto: ContextoPainel }) {
  const [filtro, setFiltro] = useState<Filtro>((lerParam('filtro') as Filtro) || 'todas');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [aberta, setAberta] = useState<string | null>(lerParam('conversa'));
  const [verFalhas, setVerFalhas] = useState(false);
  const { confirmar, elemento: dialogo } = useConfirmacao();

  useEffect(() => gravarParams({ filtro: filtro === 'todas' ? null : filtro, conversa: aberta }), [filtro, aberta]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const resumo = useConsulta('atendimento/resumo', () => atendimento.resumo());
  const q = { modo: filtro === 'robo' || filtro === 'humano' || filtro === 'encerrada' ? filtro : undefined, aguardando_equipe: filtro === 'aguardando' ? true : undefined, busca: buscaAplicada || undefined };
  // Caixa de entrada: revalida a cada 30 s com a aba visível (mensagens chegam sem a tela saber).
  const lista = useConsulta(`atendimento/conversas?${JSON.stringify(q)}`, () => atendimento.conversas(q), { intervalo: 30_000 });

  if (resumo.erro?.tipo === 'nao_implantado' && lista.erro?.tipo === 'nao_implantado') {
    return (
      <Raiz>
        <Cabecalho titulo="Atendimento" descricao="WhatsApp oficial do Âmbar" />
        <div class="cartao">
          <Falha erro={lista.erro} recurso="O Atendimento pelo WhatsApp" />
        </div>
      </Raiz>
    );
  }

  const r = resumo.dados;
  return (
    <Raiz>
      <Cabecalho titulo="Atendimento" descricao="Conversas do WhatsApp oficial do Âmbar. O assistente virtual responde; a equipe assume quando precisa." />

      <section class="indicadores" aria-label="Resumo do atendimento">
        <Indicador rotulo="Esperando a equipe" icone={<Hand aria-hidden="true" />} carregando={resumo.carregando} valor={r ? inteiro(r.aguardando_equipe) : '—'} rodape="Cliente escreveu e ninguém respondeu" />
        <Indicador rotulo="Com o assistente" icone={<Bot aria-hidden="true" />} carregando={resumo.carregando} valor={r ? inteiro(r.por_modo.robo) : '—'} rodape="Respondidas automaticamente" />
        <Indicador rotulo="Com a equipe" icone={<Headset aria-hidden="true" />} carregando={resumo.carregando} valor={r ? inteiro(r.por_modo.humano) : '—'} rodape="Assistente pausado nelas" />
        <Indicador
          rotulo="Falhas de envio (24 h)"
          icone={<MessageSquareOff aria-hidden="true" />}
          carregando={resumo.carregando}
          valor={r ? inteiro(r.falhas_de_envio_24h) : '—'}
          rodape={r?.falhas_de_envio_24h ? <button class="btn btn--p btn--fantasma" style={{ margin: '-6px -8px', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setVerFalhas(true)}>Ver quais</button> : 'Tudo entregue'}
        />
      </section>

      <div class="cartao caixa" data-aberta={aberta ? '1' : undefined}>
        <div class="caixa__lista">
          <div class="pilha pilha--p" style={{ padding: '12px', borderBottom: '1px solid var(--borda)', position: 'sticky', top: 0, background: 'var(--superficie)', zIndex: 1 }}>
            <div class="entrada-grupo">
              <Search aria-hidden="true" />
              <input class="entrada" type="search" placeholder="Nome ou telefone" aria-label="Buscar conversa" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
            </div>
            <Segmentado
              rotulo="Filtrar conversas"
              valor={filtro}
              aoMudar={setFiltro}
              opcoes={[
                { valor: 'todas', rotulo: 'Todas' },
                { valor: 'aguardando', rotulo: `Esperando${r?.aguardando_equipe ? ` (${r.aguardando_equipe})` : ''}` },
                { valor: 'humano', rotulo: 'Equipe' },
                { valor: 'robo', rotulo: 'Assistente' },
                { valor: 'encerrada', rotulo: 'Encerradas' },
              ]}
            />
          </div>
          <Dados consulta={lista} recurso="A caixa de entrada" compacto esqueleto={<div style={{ padding: '16px' }}><Esqueleto linhas={6} altura={36} /></div>}>
            {(conversas) =>
              conversas.length ? (
                <ul class="lista" aria-label="Conversas">
                  {conversas.map((c) => (
                    <li key={c.id}>
                      <ItemConversa c={c} ativa={c.id === aberta} aoAbrir={() => setAberta(c.id)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Vazio compacto icone={<Inbox aria-hidden="true" />} titulo={buscaAplicada ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa aqui'}>
                  {filtro === 'aguardando' ? 'Nenhum cliente esperando resposta da equipe.' : undefined}
                </Vazio>
              )
            }
          </Dados>
        </div>
        <div class="caixa__conversa">
          {aberta ? (
            <Conversa id={aberta} meuId={contexto.usuario.id} aoVoltar={() => setAberta(null)} confirmar={confirmar} />
          ) : (
            <Vazio icone={<MessageSquareOff aria-hidden="true" />} titulo="Escolha uma conversa">As conversas esperando a equipe aparecem primeiro em “Esperando”.</Vazio>
          )}
        </div>
      </div>

      <Falhas aberta={verFalhas} aoFechar={() => setVerFalhas(false)} aoAbrir={(id) => { setVerFalhas(false); setAberta(id); }} />
      {dialogo}
    </Raiz>
  );
}

function ItemConversa({ c, ativa, aoAbrir }: { c: ConversaResumo; ativa: boolean; aoAbrir: () => void }) {
  return (
    <button class="lista__item" style={{ alignItems: 'flex-start', background: ativa ? 'var(--marca-suave)' : undefined, padding: '12px 14px' }} onClick={aoAbrir} aria-current={ativa ? 'true' : undefined}>
      <span class="avatar" aria-hidden="true" style={{ marginTop: '2px' }}>{(c.nome_contato ?? '?').slice(0, 1).toUpperCase()}</span>
      <span class="lista__texto">
        <span class="linha linha--entre" style={{ flexWrap: 'nowrap' }}>
          <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: c.aguardando_equipe ? 650 : 500 }}>{c.nome_contato || telefone(c.telefone_e164)}</strong>
          <span class="fraco" style={{ flex: 'none' }}>{relativo(c.ultima_atividade_em)}</span>
        </span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: c.aguardando_equipe ? 'var(--texto)' : undefined }}>{c.ultima_mensagem ?? 'Sem mensagens'}</span>
        <span class="linha" style={{ marginTop: '4px', gap: '6px' }}>
          <Situacao tom={MODO[c.modo].tom}>{c.modo === 'humano' && c.atendente_nome ? c.atendente_nome : MODO[c.modo].rotulo}</Situacao>
          {c.aguardando_equipe && <Etiqueta tom="marca">Esperando resposta</Etiqueta>}
        </span>
      </span>
    </button>
  );
}

function Conversa({ id, meuId, aoVoltar, confirmar }: { id: string; meuId: string; aoVoltar: () => void; confirmar: ReturnType<typeof useConfirmacao>['confirmar'] }) {
  const consulta = useConsulta(`atendimento/conversas/${id}`, () => atendimento.conversa(id), { intervalo: 15_000 });
  const [anteriores, setAnteriores] = useState<MensagemPainel[]>([]);
  const [semMais, setSemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const c = consulta.dados;

  useEffect(() => {
    setAnteriores([]);
    setSemMais(false);
    setTexto('');
  }, [id]);
  const qtd = c?.mensagens.length ?? 0;
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [qtd, id]);

  const mensagens = useMemo(() => [...anteriores, ...(c?.mensagens ?? [])], [anteriores, c]);

  async function carregarAnteriores() {
    const primeira = mensagens[0];
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
      avisarErro(e);
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
      await atendimento.responder(id, t);
      setTexto('');
    } catch (err) {
      if (err instanceof ErroApi && err.codigo === 'fora_da_janela_24h') avisar('Passou de 24 h da última mensagem do cliente: a Meta não aceita texto livre. Ligue para o cliente.', 'erro');
      else avisarErro(err);
    } finally {
      invalidar('atendimento');
      setEnviando(false);
    }
  }

  if (!c) {
    return consulta.erro ? <Falha erro={consulta.erro} aoTentar={consulta.recarregar} recurso="A conversa" /> : <div style={{ padding: '20px' }}><Esqueleto linhas={6} altura={30} /></div>;
  }
  const comigo = c.modo === 'humano' && c.atendente_id === meuId;
  const deOutro = c.modo === 'humano' && c.atendente_id && c.atendente_id !== meuId;

  return (
    <>
      <div class="linha" style={{ padding: '12px 16px', borderBottom: '1px solid var(--borda)', flexWrap: 'nowrap' }}>
        <Botao class="menu-voltar" variante="fantasma" so_icone aria-label="Voltar para a lista" icone={<ArrowLeft aria-hidden="true" />} onClick={aoVoltar} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome_contato || telefone(c.telefone_e164)}</h3>
          <div class="linha fraco" style={{ gap: '8px' }}>
            <span class="num">{telefone(c.telefone_e164)}</span>
            <Situacao tom={MODO[c.modo].tom}>{c.modo === 'humano' ? `Com ${c.atendente_nome ?? 'a equipe'}` : MODO[c.modo].rotulo}</Situacao>
          </div>
        </div>
        <div class="linha" style={{ flexWrap: 'nowrap' }}>
          <a class="btn btn--p btn--fantasma btn--icone" href={`tel:${c.telefone_e164}`} aria-label="Ligar para o cliente" title="Ligar"><Phone aria-hidden="true" /></a>
          {c.modo !== 'humano' && (
            <Botao tamanho="p" variante="primario" icone={<Hand aria-hidden="true" />} carregando={ocupado === 'assumir'} onClick={() => acao('assumir', () => atendimento.assumir(id), 'Você assumiu a conversa. O assistente está pausado nela.')}>
              Assumir
            </Botao>
          )}
          {deOutro && (
            <Botao tamanho="p" onClick={() => confirmar({ titulo: `Assumir a conversa de ${c.atendente_nome}?`, texto: 'A conversa passa para você.', confirmar: 'Assumir', acao: async () => { await atendimento.assumir(id, true); invalidar('atendimento'); }, sucesso: 'Conversa transferida para você.' })}>
              Assumir de {c.atendente_nome?.split(' ')[0]}
            </Botao>
          )}
          {c.modo === 'humano' && (
            <>
              <Botao tamanho="p" icone={<Undo2 aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Devolver ao assistente virtual?', texto: 'O assistente volta a responder esta conversa automaticamente.', confirmar: 'Devolver', acao: async () => { await atendimento.devolver(id); invalidar('atendimento'); }, sucesso: 'Conversa devolvida ao assistente.' })}>
                <span class="so-desktop">Devolver ao assistente</span>
              </Botao>
              <Botao tamanho="p" icone={<CheckCheck aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Encerrar esta conversa?', texto: 'Ela sai da fila. Se o cliente escrever de novo, a conversa reabre com o assistente.', confirmar: 'Encerrar', acao: async () => { await atendimento.encerrar(id); invalidar('atendimento'); }, sucesso: 'Conversa encerrada.' })}>
                <span class="so-desktop">Encerrar</span>
              </Botao>
            </>
          )}
        </div>
      </div>

      {c.motivo_humano && c.modo === 'humano' && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--borda)' }} class="fraco">
          Motivo do encaminhamento: {c.motivo_humano}
        </div>
      )}

      <div class="mensagens" aria-live="polite" aria-label="Mensagens">
        {!semMais && mensagens.length >= 20 && (
          <Botao tamanho="p" variante="fantasma" carregando={carregandoMais} onClick={carregarAnteriores} style={{ alignSelf: 'center' }}>Carregar mensagens anteriores</Botao>
        )}
        {mensagens.map((m) => <Mensagem key={m.id} m={m} />)}
        <div ref={fim} />
      </div>

      <form onSubmit={responder} style={{ padding: '12px 16px', borderTop: '1px solid var(--borda)', background: 'var(--superficie)' }} class="pilha pilha--p">
        {!c.dentro_da_janela ? (
          <Aviso tom="atencao" icone={<Clock aria-hidden="true" />}>
            Passaram 24 h desde a última mensagem do cliente. Pela regra da Meta, só é possível responder por telefone ou quando o cliente escrever de novo.
          </Aviso>
        ) : c.modo !== 'humano' ? (
          <p class="fraco">Para responder, assuma a conversa: o assistente virtual pausa enquanto a equipe atende.</p>
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
            placeholder={comigo && c.dentro_da_janela ? 'Escreva a resposta…' : 'Resposta indisponível'}
            disabled={!comigo || !c.dentro_da_janela}
            maxLength={4096}
            value={texto}
            onInput={(e) => setTexto(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
          />
          <Botao type="submit" variante="primario" so_icone aria-label="Enviar resposta" carregando={enviando} disabled={!comigo || !c.dentro_da_janela || !texto.trim()} icone={<Send aria-hidden="true" />} />
        </div>
      </form>
    </>
  );
}

const AUTOR: Record<string, { rotulo: string; icone: preact.ComponentChildren }> = {
  cliente: { rotulo: 'Cliente', icone: <UserRound aria-hidden="true" /> },
  robo: { rotulo: 'Assistente virtual', icone: <Bot aria-hidden="true" /> },
  equipe: { rotulo: 'Equipe', icone: <Headset aria-hidden="true" /> },
};

function Mensagem({ m }: { m: MensagemPainel }) {
  const saida = m.direcao === 'saida';
  const a = AUTOR[m.autor] ?? AUTOR.equipe;
  const falhou = m.status === 'falhou' || m.status === 'descartada';
  return (
    <div class={`msg${saida ? ' msg--saida' : ''}${falhou ? ' msg--falha' : ''}`}>
      {saida && (
        <div class="msg__autor">
          {a.icone} {m.autor === 'robo' ? a.rotulo : m.usuario_nome ?? a.rotulo}
        </div>
      )}
      {m.tipo === 'audio' && (
        <div class="fraco linha" style={{ gap: '4px' }}>
          <Mic size={13} aria-hidden="true" /> Áudio{m.transcricao ? ' (transcrição)' : ''}
        </div>
      )}
      {m.texto ?? m.transcricao ?? <span class="fraco">[{m.tipo}]</span>}
      <div class="msg__meta">
        <span title={dataHora(m.criado_em)}>{horaDe(m.criado_em)}</span>
        {saida && !falhou && <span>{m.status === 'lida' ? 'Lida' : m.status === 'entregue' ? 'Entregue' : m.status === 'enviada' ? 'Enviada' : m.status}</span>}
        {falhou && (
          <span style={{ color: 'var(--perigo)', display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
            <AlertCircle size={12} aria-hidden="true" /> {m.status === 'descartada' ? 'Não enviada (a equipe assumiu antes)' : `Não entregue${m.erro ? `: ${m.erro}` : ''}`}
          </span>
        )}
      </div>
    </div>
  );
}

function Falhas({ aberta, aoFechar, aoAbrir }: { aberta: boolean; aoFechar: () => void; aoAbrir: (id: string) => void }) {
  const consulta = useConsulta(aberta ? 'atendimento/falhas' : null, () => atendimento.falhas(30));
  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Mensagens que não saíram" subtitulo="Do assistente ou da equipe, mais novas primeiro">
      <Dados consulta={consulta} recurso="A lista de falhas">
        {(itens) =>
          itens.length ? (
            <ul class="lista" style={{ margin: '-8px -20px' }}>
              {itens.map((f) => (
                <li key={f.id}>
                  <button class="lista__item" onClick={() => aoAbrir(f.conversa_id)}>
                    <span class="lista__icone lista__icone--perigo" aria-hidden="true"><AlertCircle /></span>
                    <span class="lista__texto">
                      <strong>{f.nome_contato ?? telefone(f.telefone_e164)}</strong>
                      <span>{f.erro ?? 'Falha na entrega'} · {relativo(f.criado_em)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio titulo="Nenhuma falha recente">{plural(0, 'mensagem', 'mensagens')} com problema.</Vazio>
          )
        }
      </Dados>
    </Gaveta>
  );
}
