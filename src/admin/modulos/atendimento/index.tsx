// Atendimento: WhatsApp oficial do Âmbar (Cloud API da Meta). Caixa de entrada à esquerda e conversa à direita; no celular,
// uma de cada vez. O atendente automático é o "Assistente virtual" (robô do n8n) — não é a Júlia do grupo interno.
// Rotas reais /admin/atendimento/* (no ar em produção). Ações iguais às do painel anterior (app/painel/js/atendimento.js):
// assumir, assumir no lugar de outra pessoa, responder (responder também assume), devolver ao assistente e encerrar.
// O servidor decide tudo (pausa do robô, dono da conversa, janela de 24 h); a tela só mostra e pede.
// Uma central de mensagens, não um painel de números: sem cartões de indicador nem título repetido. Filtros principais
// (Todas · Esperando · Com assistente · Com equipe), as encerradas num atalho discreto e as falhas de envio num aviso
// que só aparece quando existem.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Search, Bot, UserRound, Headset, Send, ArrowLeft, Hand, Undo2, CheckCheck, AlertCircle, Clock, Phone, MessageSquareOff, Mic, Inbox, ArrowLeftRight } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { ErroApi } from '../../lib/api/cliente';
import { telefone, relativo, horaDe, dataHora, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz, Gaveta, useConfirmacao, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Segmentado, Situacao, Aviso, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio, Falha } from '../../ui/estados';
import type { ConversaDetalhe, ConversaResumo, MensagemPainel, ModoConversa } from '../../lib/tipos/atendimento-clube';

type Filtro = 'todas' | 'aguardando' | 'robo' | 'humano' | 'encerrada';
/** Limite de texto da resposta da equipe (servico.TEXTO_MAX do backend; o que passar é cortado lá). */
const TEXTO_MAX = 2000;

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

  const resumo = useConsulta('atendimento/resumo', () => atendimento.resumo(), { intervalo: 30_000 });
  const q = { modo: filtro === 'robo' || filtro === 'humano' || filtro === 'encerrada' ? filtro : undefined, aguardando_equipe: filtro === 'aguardando' ? true : undefined, busca: buscaAplicada || undefined };
  // Caixa de entrada: revalida a cada 15 s com a aba visível (mensagens chegam sem a tela saber; sem tempo real).
  const lista = useConsulta(`atendimento/conversas?${JSON.stringify(q)}`, () => atendimento.conversas(q), { intervalo: 15_000 });

  if (resumo.erro?.tipo === 'nao_implantado' && lista.erro?.tipo === 'nao_implantado') {
    return (
      <Raiz>
        <div class="cartao">
          <Falha erro={lista.erro} recurso="O Atendimento pelo WhatsApp" />
        </div>
      </Raiz>
    );
  }

  const r = resumo.dados;
  return (
    <Raiz>
      <div class="cartao caixa" data-aberta={aberta ? '1' : undefined}>
        <div class="caixa__lista">
          <div class="caixa__filtros">
            <div class="entrada-grupo">
              <Search aria-hidden="true" />
              <input class="entrada" type="search" placeholder="Nome ou telefone" aria-label="Buscar conversa" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
            </div>
            <Segmentado
              rotulo="Filtrar conversas"
              valor={filtro === 'encerrada' ? ('' as Filtro) : filtro}
              aoMudar={setFiltro}
              opcoes={[
                { valor: 'todas', rotulo: 'Todas' },
                { valor: 'aguardando', rotulo: <>Esperando{r?.aguardando_equipe ? <span class="contador">{r.aguardando_equipe}</span> : null}</> },
                { valor: 'robo', rotulo: <span title="Com o assistente virtual">Assistente</span> },
                { valor: 'humano', rotulo: <span title="Com alguém da equipe">Equipe</span> },
              ]}
            />
            <div class="caixa__extras">
              <button type="button" class="link link--discreto" aria-pressed={filtro === 'encerrada'} onClick={() => setFiltro(filtro === 'encerrada' ? 'todas' : 'encerrada')}>
                {filtro === 'encerrada' ? 'Voltar às ativas' : 'Ver encerradas'}
              </button>
              {r?.falhas_de_envio_24h ? (
                <button type="button" class="pilula pilula--perigo" onClick={() => setVerFalhas(true)}>
                  <MessageSquareOff aria-hidden="true" /> {plural(r.falhas_de_envio_24h, 'falha de envio', 'falhas de envio')} (24 h)
                </button>
              ) : null}
            </div>
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
  // Uma marca de estado por conversa — a mais urgente — em vez de várias etiquetas empilhadas.
  const alerta = c.inativa ? { tom: 'perigo' as const, texto: 'Parada há 30+ min' } : c.modo === 'humano' && !c.atendente_id ? { tom: 'atencao' as const, texto: 'Ninguém assumiu' } : c.aguardando_equipe ? { tom: 'marca' as const, texto: 'Esperando resposta' } : null;
  return (
    <button class={`conversa-item${ativa ? ' conversa-item--ativa' : ''}${c.aguardando_equipe ? ' conversa-item--nova' : ''}`} onClick={aoAbrir} aria-current={ativa ? 'true' : undefined}>
      <span class="avatar" aria-hidden="true">{(c.nome_contato ?? '?').slice(0, 1).toUpperCase()}</span>
      <span class="conversa-item__texto">
        <span class="conversa-item__topo">
          <strong>{c.nome_contato || telefone(c.telefone_e164)}</strong>
          <span class="fraco">{relativo(c.ultima_atividade_em)}</span>
        </span>
        <span class="conversa-item__ultima">{c.ultima_mensagem ?? 'Sem mensagens'}</span>
        <span class="conversa-item__estado">
          <Situacao tom={MODO[c.modo].tom}>{c.modo === 'humano' && c.atendente_nome ? c.atendente_nome : MODO[c.modo].rotulo}</Situacao>
          {alerta && <Etiqueta tom={alerta.tom}>{alerta.texto}</Etiqueta>}
        </span>
      </span>
      {c.aguardando_equipe && <span class="conversa-item__ponto" aria-label="Mensagem sem resposta" />}
    </button>
  );
}

function Conversa({ id, meuId, aoVoltar, confirmar }: { id: string; meuId: string; aoVoltar: () => void; confirmar: ReturnType<typeof useConfirmacao>['confirmar'] }) {
  // Conversa aberta: relida a cada 8 s, como no painel anterior (a resposta do cliente aparece sem recarregar).
  const consulta = useConsulta(`atendimento/conversas/${id}`, () => atendimento.conversa(id), { intervalo: 8_000 });
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
      // Fora da janela a conversa fica com você (o robô pausa), mas nada sai: o texto continua na caixa.
      if (err instanceof ErroApi && err.codigo === 'fora_da_janela_24h') avisar('Passou de 24 h da última mensagem do cliente: a Meta não aceita texto livre. Ligue para o cliente.', 'erro');
      else if (err instanceof ErroApi && err.codigo === 'conversa_ja_assumida') avisar('Outra pessoa da equipe assumiu esta conversa antes. Nada foi enviado.', 'erro');
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
  // Encaminhada pelo assistente para a equipe e ainda sem ninguém: qualquer um pode assumir.
  const semDono = c.modo !== 'humano' || !c.atendente_id;
  // Como o backend: responde quem atende ou qualquer um numa conversa sem dono (e aí assume); só dentro das 24 h.
  const podeEscrever = c.dentro_da_janela && (semDono || comigo);

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
          {semDono && (
            <Botao tamanho="p" variante="primario" icone={<Hand aria-hidden="true" />} carregando={ocupado === 'assumir'} disabled={!!ocupado} onClick={() => acao('assumir', () => atendimento.assumir(id), 'Você assumiu a conversa. O assistente está pausado nela.')}>
              Assumir
            </Botao>
          )}
          {deOutro && (
            <Botao tamanho="p" icone={<ArrowLeftRight aria-hidden="true" />} onClick={() => confirmar({ titulo: `Assumir a conversa no lugar de ${c.atendente_nome ?? 'outra pessoa'}?`, texto: 'A conversa passa para você; quem atendia deixa de responder por ela.', confirmar: 'Assumir no lugar', acao: async () => { try { await atendimento.assumir(id, true); } finally { invalidar('atendimento'); } }, sucesso: 'Conversa transferida para você.' })}>
              Assumir no lugar{c.atendente_nome ? ` de ${c.atendente_nome.split(' ')[0]}` : ''}
            </Botao>
          )}
          {c.modo === 'humano' && (
            <Botao tamanho="p" icone={<Undo2 aria-hidden="true" />} aria-label="Devolver ao assistente" onClick={() => confirmar({ titulo: 'Devolver ao assistente virtual?', texto: deOutro ? `${c.atendente_nome ?? 'Outra pessoa'} está atendendo. O assistente volta a responder sozinho, só o que o cliente escrever daqui em diante.` : 'O assistente volta a responder sozinho, só o que o cliente escrever daqui em diante.', confirmar: 'Devolver', acao: async () => { try { await atendimento.devolver(id); } finally { invalidar('atendimento'); } }, sucesso: 'Conversa devolvida ao assistente.' })}>
              <span class="so-desktop">Devolver ao assistente</span>
            </Botao>
          )}
          {c.modo !== 'encerrada' && (
            <Botao tamanho="p" icone={<CheckCheck aria-hidden="true" />} aria-label="Encerrar conversa" onClick={() => confirmar({ titulo: 'Encerrar esta conversa?', texto: 'Ela sai da fila e o assistente descarta o que ia responder. Se o cliente escrever de novo, a conversa reabre com o assistente.', confirmar: 'Encerrar', acao: async () => { try { await atendimento.encerrar(id); } finally { invalidar('atendimento'); } }, sucesso: 'Conversa encerrada.' })}>
              <span class="so-desktop">Encerrar</span>
            </Botao>
          )}
        </div>
      </div>

      {c.motivo_humano && c.modo === 'humano' && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--borda)' }} class="fraco">
          Motivo do encaminhamento: {MOTIVO_HUMANO[c.motivo_humano] ?? c.motivo_humano.replace(/_/g, ' ')}
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
        ) : semDono ? (
          <p class="fraco">Responder assume a conversa: o assistente virtual fica pausado enquanto a equipe atende.</p>
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
            placeholder={!podeEscrever ? 'Resposta indisponível' : comigo ? 'Escreva a resposta…' : 'Responder assume a conversa e pausa o assistente'}
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
    </>
  );
}

const MOTIVO_HUMANO: Record<string, string> = {
  atendimento_humano: 'o cliente pediu para falar com alguém',
  encomenda: 'encomenda',
  reclamacao: 'reclamação',
};

const AUTOR: Record<string, { rotulo: string; icone: preact.ComponentChildren }> = {
  cliente: { rotulo: 'Cliente', icone: <UserRound aria-hidden="true" /> },
  robo: { rotulo: 'Assistente virtual', icone: <Bot aria-hidden="true" /> },
  equipe: { rotulo: 'Equipe', icone: <Headset aria-hidden="true" /> },
};

const SITUACAO_MSG: Record<string, string> = { pendente: 'Enviando…', enviada: 'Enviada', entregue: 'Entregue', lida: 'Lida' };

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
        {saida && !falhou && <span>{SITUACAO_MSG[m.status] ?? m.status}</span>}
        {falhou && (
          <span style={{ color: 'var(--perigo)', display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
            <AlertCircle size={12} aria-hidden="true" /> {m.status === 'descartada' ? 'Não enviada (atendimento humano)' : `Não entregue${m.erro ? `: ${m.erro}` : ''}`}
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
