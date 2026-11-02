// Atendimento: central única das conversas do WhatsApp oficial do Âmbar (Cloud API da Meta). Caixa de entrada à esquerda
// e conversa à direita; no celular, uma de cada vez. O atendente automático é o "Assistente virtual" — não é a Júlia do
// grupo interno. O servidor decide tudo (estado, dono da conversa, janela de 24 h, bloqueios de campanha); a tela só mostra
// e pede.
// Uma central de mensagens, não um painel de números: quatro estados (Assistente · Esperando · Equipe · Encerradas), as
// conversas esperando a equipe primeiro (o backend ordena), e o que é da gerência (campanhas, base de conhecimento,
// cadastros duplicados) num menu discreto "Mais", cada um numa gaveta. Não existe mais página Clientes: quem é o contato
// aparece na ficha da própria conversa.
// Tempo real: a caixa é relida a cada 15 s e a conversa aberta a cada 5 s (com a aba visível), sem WebSocket.
import { useEffect, useState } from 'preact/hooks';
import { Search, Inbox, MessageSquareOff, MessageSquarePlus, Ellipsis, Megaphone, BookOpen, UsersRound, BotOff, CloudOff, AlertCircle } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { telefone, relativo, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { pode } from '../../lib/permissoes';
import { Raiz, Gaveta, Suspenso, useConfirmacao } from '../../ui/camadas';
import { Botao, Segmentado, Situacao, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { ConversaResumo, EstadoConversa } from '../../lib/tipos/atendimento-clube';
import { ESTADO, PREFIXO_ORIGEM } from './comum';
import { Conversa } from './Conversa';
import { NovaConversa, type DestinoInicial } from './NovaConversa';
import { Campanhas } from './Campanhas';
import { Conhecimento } from './Conhecimento';
import { Duplicidades } from './Duplicidades';

type Filtro = 'todas' | EstadoConversa;
type Gestao = 'campanhas' | 'conhecimento' | 'duplicidades' | null;

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
  const [gestao, setGestao] = useState<Gestao>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();

  useEffect(() => gravarParams({ filtro: filtro === 'todas' ? null : filtro, conversa: aberta }), [filtro, aberta]);
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
  const veCampanhas = pode(papel, 'atendimento.campanhas');
  const veDuplicidades = pode(papel, 'clientes.visualizar');
  const abrirConversa = (id: string) => {
    setNova(null);
    setGestao(null);
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
              <Suspenso rotulo="Mais opções do Atendimento" gatilho={(p) => <Botao tamanho="p" variante="fantasma" icone={<Ellipsis aria-hidden="true" />} {...p}>Mais</Botao>}>
                {(fechar) => (
                  <>
                    {veCampanhas && <button type="button" class="suspenso__item" role="menuitem" onClick={() => { fechar(); setGestao('campanhas'); }}><Megaphone aria-hidden="true" /> Campanhas</button>}
                    <button type="button" class="suspenso__item" role="menuitem" onClick={() => { fechar(); setGestao('conhecimento'); }}><BookOpen aria-hidden="true" /> Base de conhecimento</button>
                    {veDuplicidades && <button type="button" class="suspenso__item" role="menuitem" onClick={() => { fechar(); setGestao('duplicidades'); }}><UsersRound aria-hidden="true" /> Cadastros duplicados</button>}
                  </>
                )}
              </Suspenso>
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
            {r?.falhas_de_envio_24h ? (
              <div class="caixa__extras">
                <button type="button" class="pilula pilula--perigo" onClick={() => setVerFalhas(true)}>
                  <MessageSquareOff aria-hidden="true" /> {plural(r.falhas_de_envio_24h, 'falha de envio', 'falhas de envio')} (24 h)
                </button>
              </div>
            ) : null}
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
      <Falhas aberta={verFalhas} aoFechar={() => setVerFalhas(false)} aoAbrir={(id) => { setVerFalhas(false); setAberta(id); }} />
      {veCampanhas && <Campanhas aberta={gestao === 'campanhas'} aoFechar={() => setGestao(null)} aoAbrirConversa={abrirConversa} confirmar={confirmar} />}
      <Conhecimento aberta={gestao === 'conhecimento'} aoFechar={() => setGestao(null)} podeEditar={pode(papel, 'atendimento.conhecimento')} confirmar={confirmar} />
      {veDuplicidades && <Duplicidades aberta={gestao === 'duplicidades'} aoFechar={() => setGestao(null)} podeVincular={pode(papel, 'clientes.editar')} confirmar={confirmar} />}
      {dialogo}
    </Raiz>
  );
}

function ItemConversa({ c, ativa, aoAbrir }: { c: ConversaResumo; ativa: boolean; aoAbrir: () => void }) {
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
