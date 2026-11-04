// Atendimento: central única das conversas do WhatsApp oficial do Âmbar (Cloud API da Meta). Caixa de entrada à esquerda
// e conversa à direita; no celular, uma de cada vez. O atendente automático é o "Assistente virtual" — não é a Júlia do
// grupo interno. O servidor decide tudo (estado, dono da conversa, janela de 24 h, bloqueios de campanha); a tela só mostra
// e pede.
// Uma central de mensagens, não um painel de números: quatro estados (Assistente · Esperando · Equipe · Encerradas) e as
// conversas esperando a equipe primeiro (o backend ordena). O Cardápio abre numa gaveta. Campanhas, base de conhecimento e
// cadastros duplicados saíram daqui (04/11/2026): as telas Campanhas.tsx, Conhecimento.tsx e Duplicidades.tsx e as rotas do
// backend continuam no código, sem entrada no painel, à espera de um lugar em Configurações. Não existe mais página
// Clientes: quem é o contato aparece na ficha da própria conversa.
// Tempo real: a caixa é relida a cada 15 s e a conversa aberta a cada 5 s (com a aba visível), sem WebSocket.
// Eventos (backend com a 0023): etiqueta "Evento" na conversa e, acima da lista, o atalho "Eventos" com os que aguardam
// contato — abre a visão compacta das oportunidades (gaveta), que leva de volta à conversa. Sem página nova no menu.
import { useEffect, useState } from 'preact/hooks';
import { Search, Inbox, MessageSquareOff, MessageSquarePlus, UtensilsCrossed, BotOff, CloudOff, AlertCircle, PartyPopper } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { telefone, relativo, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { pode } from '../../lib/permissoes';
import { Raiz, Gaveta, useConfirmacao } from '../../ui/camadas';
import { Botao, Segmentado, Situacao, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { ConversaResumo, EstadoConversa } from '../../lib/tipos/atendimento-clube';
import { ESTADO, PREFIXO_ORIGEM } from './comum';
import { Conversa } from './Conversa';
import { NovaConversa, type DestinoInicial } from './NovaConversa';
import { Cardapio } from './Cardapio';
import { Oportunidades } from './Evento';

type Filtro = 'todas' | EstadoConversa;

/** Filtro da URL, aceitando os nomes antigos (links do sino e favoritos de antes dos quatro estados). */
function filtroInicial(): Filtro {
  const f = lerParam('filtro');
  const antigos: Record<string, Filtro> = { aguardando: 'esperando', robo: 'automatico', humano: 'em_atendimento' };
  if (f && antigos[f]) return antigos[f];
  return f && ['esperando', 'automatico', 'em_atendimento', 'encerrada'].includes(f) ? (f as Filtro) : 'todas';
}

export default function Atendimento({ contexto }: { contexto: ContextoPainel }) {
  const papel = contexto.usuario.papel;
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [aberta, setAberta] = useState<string | null>(lerParam('conversa'));
  const [verFalhas, setVerFalhas] = useState(false);
  const [nova, setNova] = useState<DestinoInicial | null>(null);
  const [verCardapio, setVerCardapio] = useState(false);
  const [verEventos, setVerEventos] = useState(lerParam('eventos') === '1');
  const { confirmar, elemento: dialogo } = useConfirmacao();

  useEffect(() => gravarParams({ filtro: filtro === 'todas' ? null : filtro, conversa: aberta, eventos: verEventos ? '1' : null }), [filtro, aberta, verEventos]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const resumo = useConsulta('atendimento/resumo', () => atendimento.resumo(), { intervalo: 30_000 });
  const q = { estado: filtro === 'todas' ? undefined : filtro, busca: buscaAplicada || undefined };
  // Caixa de entrada: revalida a cada 15 s com a aba visível (mensagens chegam sem a tela saber).
  const lista = useConsulta(`atendimento/conversas?${JSON.stringify(q)}`, () => atendimento.conversas(q), { intervalo: 15_000 });

  const r = resumo.dados;
  const config = r?.configuracao;
  // Backend anterior à 0023 não manda `eventos` no resumo: nada de evento aparece (nem chamada a rota que não existe).
  const eventos = r?.eventos;
  const comEventos = !!eventos;
  const aguardandoContato = eventos?.aguardando_contato ?? 0;
  const eventosAbertos = eventos ? Object.values(eventos).reduce((s, n) => s + n, 0) : 0;
  const abrirConversa = (id: string) => {
    setNova(null);
    setVerEventos(false);
    setAberta(id);
  };

  return (
    <Raiz>
      <div class="cartao caixa" data-aberta={aberta ? '1' : undefined}>
        <div class="caixa__lista">
          <div class="caixa__filtros">
            <div class="caixa__acoes">
              <Botao tamanho="p" variante="primario" icone={<MessageSquarePlus aria-hidden="true" />} onClick={() => setNova({})}>
                Nova conversa
              </Botao>
              <Botao tamanho="p" variante="fantasma" icone={<UtensilsCrossed aria-hidden="true" />} title="Cardápio e capacidades" onClick={() => setVerCardapio(true)}>Cardápio</Botao>
            </div>
            {config && !config.assistente_ativo && (
              <p class="caixa__aviso" role="note"><BotOff aria-hidden="true" /> Assistente virtual desligado: as conversas vão direto para a equipe.</p>
            )}
            {config && !config.envio_configurado && (
              <p class="caixa__aviso caixa__aviso--perigo" role="note"><CloudOff aria-hidden="true" /> Envio pelo WhatsApp não configurado no servidor (respostas não saem).</p>
            )}
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
                { valor: 'esperando', rotulo: <>Esperando{r?.por_estado?.esperando ? <span class="contador">{r.por_estado.esperando}</span> : null}</> },
                { valor: 'automatico', rotulo: <span title="Com o assistente virtual">Assistente</span> },
                { valor: 'em_atendimento', rotulo: <span title="Com alguém da equipe">Equipe</span> },
                { valor: 'encerrada', rotulo: 'Encerradas' },
              ]}
            />
            {r?.falhas_de_envio_24h || comEventos ? (
              <div class="caixa__extras">
                {comEventos && (
                  <button
                    type="button"
                    class={`pilula ${aguardandoContato ? 'pilula--atencao' : 'pilula--neutra'}`}
                    onClick={() => setVerEventos(true)}
                    title={aguardandoContato ? plural(aguardandoContato, 'evento aguardando contato da equipe', 'eventos aguardando contato da equipe') : plural(eventosAbertos, 'evento em andamento', 'eventos em andamento')}
                  >
                    <PartyPopper aria-hidden="true" /> Eventos
                    {aguardandoContato ? <span class="contador">{aguardandoContato}<span class="sr"> aguardando contato</span></span> : eventosAbertos ? <span class="fraco">· {eventosAbertos}</span> : null}
                  </button>
                )}
                {r?.falhas_de_envio_24h ? (
                  <button type="button" class="pilula pilula--perigo" onClick={() => setVerFalhas(true)}>
                    <MessageSquareOff aria-hidden="true" /> {plural(r.falhas_de_envio_24h, 'falha de envio', 'falhas de envio')} (24 h)
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <Dados consulta={lista} recurso="A caixa de entrada" compacto esqueleto={<div style={{ padding: '16px' }}><Esqueleto linhas={6} altura={36} /></div>}>
            {(conversas) =>
              conversas.length ? (
                <ul class="lista" aria-label="Conversas">
                  {conversas.map((c) => (
                    <li key={c.id}>
                      <ItemConversa c={c} ativa={c.id === aberta} evento={comEventos && c.assunto === 'evento'} aoAbrir={() => setAberta(c.id)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Vazio compacto icone={<Inbox aria-hidden="true" />} titulo={buscaAplicada ? 'Nenhuma conversa encontrada' : filtro === 'esperando' ? 'Ninguém esperando a equipe' : 'Nenhuma conversa aqui'}>
                  {filtro === 'esperando' && !buscaAplicada ? 'Quando o assistente encaminhar alguém, a conversa aparece aqui.' : undefined}
                </Vazio>
              )
            }
          </Dados>
        </div>
        <div class="caixa__conversa">
          {aberta ? (
            <Conversa
              id={aberta}
              meuId={contexto.usuario.id}
              assistenteAtivo={config?.assistente_ativo}
              eventos={comEventos}
              podeMudarStatus={pode(papel, 'atendimento.eventos')}
              aoVoltar={() => setAberta(null)}
              aoEnviarTemplate={(destino) => setNova(destino)}
              confirmar={confirmar}
            />
          ) : (
            <Vazio icone={<MessageSquareOff aria-hidden="true" />} titulo="Escolha uma conversa">As conversas esperando a equipe aparecem primeiro.</Vazio>
          )}
        </div>
      </div>

      <NovaConversa aberta={nova !== null} inicial={nova ?? {}} aoFechar={() => setNova(null)} aoAbrirConversa={abrirConversa} />
      {comEventos && <Oportunidades aberta={verEventos} aoFechar={() => setVerEventos(false)} aoAbrirConversa={abrirConversa} />}
      <Falhas aberta={verFalhas} aoFechar={() => setVerFalhas(false)} aoAbrir={(id) => { setVerFalhas(false); setAberta(id); }} />
      <Cardapio aberta={verCardapio} aoFechar={() => setVerCardapio(false)} podeEditar={pode(papel, 'atendimento.conhecimento')} />
      {dialogo}
    </Raiz>
  );
}

function ItemConversa({ c, ativa, evento, aoAbrir }: { c: ConversaResumo; ativa: boolean; evento: boolean; aoAbrir: () => void }) {
  const estado = ESTADO[c.estado] ?? ESTADO.automatico;
  const esperando = c.estado === 'esperando';
  // Não respondidas: só o que importa agora (numa conversa encerrada, não cobra ninguém).
  const pendentes = c.estado !== 'encerrada' ? c.nao_respondidas : 0;
  const prefixo = c.ultima_origem && c.ultima_origem !== 'cliente' ? PREFIXO_ORIGEM[c.ultima_origem] : '';
  return (
    <button
      type="button"
      class={`conversa-item${ativa ? ' conversa-item--ativa' : ''}${pendentes ? ' conversa-item--nova' : ''}${esperando ? ' conversa-item--esperando' : ''}`}
      onClick={aoAbrir}
      aria-current={ativa ? 'true' : undefined}
      data-estado={c.estado}
    >
      <span class="avatar" aria-hidden="true">{(c.nome_contato ?? '?').slice(0, 1).toUpperCase()}</span>
      <span class="conversa-item__texto">
        <span class="conversa-item__topo">
          <strong>{c.nome_contato || telefone(c.telefone_e164)}</strong>
          <span class="fraco">{relativo(c.ultima_atividade_em)}</span>
        </span>
        <span class="conversa-item__ultima">
          {prefixo && <span class="fraco">{prefixo}</span>}
          {c.ultima_mensagem ?? 'Sem mensagens'}
        </span>
        <span class="conversa-item__estado">
          <Situacao tom={estado.tom}>{c.estado === 'em_atendimento' && c.atendente_nome ? c.atendente_nome : estado.rotulo}</Situacao>
          {/* Evento esperando a equipe é a prioridade comercial: a etiqueta ganha o tom de atenção. */}
          {evento && <Etiqueta tom={esperando ? 'atencao' : 'neutro'} icone={<PartyPopper aria-hidden="true" />}>Evento</Etiqueta>}
          {c.inativa && <Etiqueta tom="perigo">Parada há 30+ min</Etiqueta>}
        </span>
      </span>
      {pendentes > 0 && (
        <span class="contador conversa-item__conta" title={plural(pendentes, 'mensagem sem resposta', 'mensagens sem resposta')}>
          {pendentes > 99 ? '99+' : pendentes}
          <span class="sr"> {pendentes === 1 ? 'mensagem sem resposta' : 'mensagens sem resposta'}</span>
        </span>
      )}
    </button>
  );
}

function Falhas({ aberta, aoFechar, aoAbrir }: { aberta: boolean; aoFechar: () => void; aoAbrir: (id: string) => void }) {
  const consulta = useConsulta(aberta ? 'atendimento/falhas' : null, () => atendimento.falhas(30));
  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Mensagens que não saíram" subtitulo="Do assistente, da equipe, de campanhas e automações, mais novas primeiro">
      <Dados consulta={consulta} recurso="A lista de falhas">
        {(itens) =>
          itens.length ? (
            <ul class="lista" style={{ margin: '-8px -20px' }}>
              {itens.map((f) => (
                <li key={f.id}>
                  <button type="button" class="lista__item" onClick={() => aoAbrir(f.conversa_id)}>
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
            <Vazio titulo="Nenhuma falha recente">Nenhuma mensagem com problema.</Vazio>
          )
        }
      </Dados>
    </Gaveta>
  );
}
