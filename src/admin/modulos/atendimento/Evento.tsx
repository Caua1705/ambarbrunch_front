// Eventos no Atendimento: a oportunidade comercial que nasce da conversa (aniversário, comemoração, reunião, sala
// privativa…). Não é um CRM à parte: a ficha mora na própria conversa — coluna lateral na tela larga, faixa + gaveta no
// tablet e no celular — e a visão compacta de oportunidades é uma gaveta do Atendimento que abre a conversa.
// O backend decide tudo (ATENDIMENTO-EVENTOS.md §7): uma oportunidade ABERTA por conversa (409 evento_aberto_na_conversa),
// o resumo e o que falta são gerados lá, o status comercial é separado do estado da conversa. Quem atende registra e
// corrige os dados; status, responsável e motivo da perda só com atendimento.eventos (Gerente e Proprietário).
import { useEffect, useState } from 'preact/hooks';
import { PartyPopper, Pencil, Plus, Search, TriangleAlert, UserRound, CalendarDays } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { ErroApi } from '../../lib/api/cliente';
import { dataCurta, dataHora, inteiro, plural, relativo, telefone } from '../../lib/formato';
import { Gaveta, avisar, type useConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Situacao, Aviso, Segmentado } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type {
  CanalEvento, EventoAtendimento, EventoDados, OpcoesEventos, StatusEvento, StatusEventoAberto, TipoEvento,
} from '../../lib/tipos/atendimento-clube';
import { CANAL_EVENTO, EVENTO_LIMITES, ROTULO_STATUS_EVENTO, TOM_EVENTO, mensagemDeEvento } from './comum';

type Confirmar = ReturnType<typeof useConfirmacao>['confirmar'];

/** Opções do formulário (tipos, ambientes do cadastro, responsáveis): mudam pouco, ficam fora da chave "atendimento". */
export const useOpcoesEventos = (ligado = true) => useConsulta(ligado ? 'opcoes-eventos' : null, () => atendimento.opcoesEventos());

/** Data pretendida com o dia da semana ("sáb, 21 nov 2026"). */
const dataEvento = (d: string | null) => (d ? dataCurta(d, { ano: true, semana: true }) : null);

// Ficha (lateral da conversa ou gaveta) ---------------------------------------------------------------------------------

export function FichaEvento({ evento, podeMudarStatus, confirmar, aoRegistrarNovo }: {
  evento: EventoAtendimento;
  /** atendimento.eventos (vem das opções do backend; o papel do painel é só o plano B). */
  podeMudarStatus: boolean;
  confirmar: Confirmar;
  /** Evento concluído (fechado/perdido): abre o formulário de um evento novo nesta conversa. */
  aoRegistrarNovo: () => void;
}) {
  const opcoes = useOpcoesEventos();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  useEffect(() => setEditando(false), [evento.id]);

  async function alterar(nome: string, mudancas: Parameters<typeof atendimento.alterarEvento>[1], ok: string) {
    setSalvando(nome);
    try {
      await atendimento.alterarEvento(evento.id, mudancas);
      avisar(ok, 'ok');
    } catch (e) {
      avisar(mensagemDeEvento(e), 'erro');
    } finally {
      invalidar('atendimento');
      setSalvando(null);
    }
  }

  const mudarStatus = (novo: StatusEvento) => {
    if (novo === evento.status) return;
    if (novo === 'perdido') {
      confirmar({
        titulo: 'Marcar o evento como perdido?',
        texto: 'A oportunidade sai das abertas. A conversa e o histórico continuam como estão.',
        confirmar: 'Marcar como perdido',
        perigo: true,
        motivo: { rotulo: 'Motivo da perda', obrigatorio: false, maximo: EVENTO_LIMITES.motivo_perda, ajuda: 'Opcional: ex. data indisponível, desistiu, fechou em outro lugar.' },
        acao: async (motivo) => {
          try {
            await atendimento.alterarEvento(evento.id, { status: 'perdido', motivo_perda: motivo || null });
          } catch (e) {
            if (e instanceof ErroApi) e.message = mensagemDeEvento(e);
            throw e;
          } finally {
            invalidar('atendimento');
          }
        },
        sucesso: 'Evento marcado como perdido.',
      });
      return;
    }
    alterar('status', { status: novo }, `Status comercial: ${ROTULO_STATUS_EVENTO[novo]}.`);
  };

  const o = opcoes.dados;
  const responsaveis = o?.responsaveis ?? [];
  const comResponsavelAtual = evento.responsavel_id && !responsaveis.some((r) => r.id === evento.responsavel_id)
    ? [...responsaveis, { id: evento.responsavel_id, nome: evento.responsavel_nome ?? 'Responsável atual' }]
    : responsaveis;

  return (
    <div class="evento-ficha pilha pilha--p" data-evento={evento.id} data-status={evento.status}>
      <div class="evento-ficha__topo">
        <span class="evento-ficha__titulo"><PartyPopper aria-hidden="true" /> Evento</span>
        <Situacao tom={TOM_EVENTO[evento.status]} destaque={evento.status === 'aguardando_contato'}>{evento.status_rotulo}</Situacao>
      </div>
      {/* O resumo do backend já termina com "Falta: …" quando faltam dados; os campos vazios aparecem como "A definir". */}
      {evento.resumo && <p class="evento-ficha__resumo">{evento.resumo}</p>}
      {evento.aberta && evento.cliente_desistiu_em && (
        <Aviso tom="atencao" icone={<TriangleAlert aria-hidden="true" />}>
          O cliente disse que desistiu ({relativo(evento.cliente_desistiu_em)}). {podeMudarStatus ? 'Se for o caso, marque como perdido.' : 'Quem marca “Perdido” é a gerência.'}
        </Aviso>
      )}

      {!o && opcoes.erro && (
        <Aviso tom="atencao" icone={<TriangleAlert aria-hidden="true" />}>
          Não foi possível carregar as opções do evento: editar e mudar o status ficam indisponíveis.{' '}
          <Botao tamanho="p" variante="fantasma" onClick={opcoes.recarregar}>Tentar de novo</Botao>
        </Aviso>
      )}

      {editando ? (
        o ? (
          <FormEvento
            opcoes={o}
            inicial={evento}
            rotuloEnviar="Salvar dados"
            aoCancelar={() => setEditando(false)}
            aoEnviar={async (dados) => {
              const mudancas = diferencas(evento, dados);
              if (!Object.keys(mudancas).length) {
                setEditando(false);
                return;
              }
              await atendimento.alterarEvento(evento.id, mudancas);
              invalidar('atendimento');
              avisar('Dados do evento atualizados.', 'ok');
              setEditando(false);
            }}
          />
        ) : (
          <Esqueleto linhas={4} />
        )
      ) : (
        <>
          <dl class="definicoes evento-ficha__dados">
            <dt>Tipo</dt>
            <dd>{evento.tipo_rotulo ?? <span class="fraco">A definir</span>}</dd>
            <dt>Data</dt>
            <dd>{dataEvento(evento.data_pretendida) ?? <span class="fraco">A definir</span>}</dd>
            <dt>Horário</dt>
            <dd>{evento.horario ?? <span class="fraco">A definir</span>}</dd>
            <dt>Convidados</dt>
            <dd class="num">{evento.convidados ? `~${inteiro(evento.convidados)}` : <span class="fraco">A definir</span>}</dd>
            <dt>Ambiente</dt>
            <dd>{evento.ambiente_nome ?? <span class="fraco">Sem preferência</span>}</dd>
            {evento.necessidades && (
              <>
                <dt>Necessidades</dt>
                <dd>{evento.necessidades}</dd>
              </>
            )}
            {evento.observacoes && (
              <>
                <dt>Observações</dt>
                <dd>{evento.observacoes}</dd>
              </>
            )}
            <dt>Registro</dt>
            <dd class="fraco">
              {evento.origem === 'assistente' ? 'Pelo assistente' : 'Pela equipe'} · {CANAL_EVENTO[evento.canal] ?? evento.canal} · {dataHora(evento.criado_em)}
            </dd>
          </dl>
          <div>
            <Botao tamanho="p" icone={<Pencil aria-hidden="true" />} onClick={() => setEditando(true)} disabled={!o}>
              Editar dados
            </Botao>
          </div>
        </>
      )}

      <div class="evento-ficha__comercial pilha pilha--p">
        <h4 class="secao-titulo">Comercial</h4>
        {podeMudarStatus && o ? (
          <>
            <Campo rotulo="Status comercial">
              {(id) => (
                <select id={id} class="selecao" value={evento.status} disabled={!!salvando} onChange={(e) => mudarStatus(e.currentTarget.value as StatusEvento)}>
                  {o.status.map((s) => <option key={s.codigo} value={s.codigo}>{s.rotulo}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Responsável">
              {(id) => (
                <select
                  id={id}
                  class="selecao"
                  value={evento.responsavel_id ?? ''}
                  disabled={!!salvando}
                  onChange={(e) => {
                    const v = e.currentTarget.value || null;
                    alterar('responsavel', { responsavel_id: v }, v ? `Responsável: ${comResponsavelAtual.find((r) => r.id === v)?.nome ?? 'definido'}.` : 'Evento sem responsável.');
                  }}
                >
                  <option value="">Sem responsável</option>
                  {comResponsavelAtual.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              )}
            </Campo>
          </>
        ) : (
          <dl class="definicoes">
            <dt>Status</dt>
            <dd>{evento.status_rotulo}</dd>
            <dt>Responsável</dt>
            <dd>{evento.responsavel_nome ?? <span class="fraco">Ninguém</span>}</dd>
          </dl>
        )}
        {evento.status === 'perdido' && (
          <p class="fraco evento-ficha__motivo">Motivo da perda: {evento.motivo_perda ?? 'não informado'}</p>
        )}
        {!podeMudarStatus && <p class="fraco evento-ficha__nota">Status comercial e responsável: só a gerência altera.</p>}
        {evento.encaminhada_em && <p class="fraco evento-ficha__nota">Com a equipe desde {dataHora(evento.encaminhada_em)}.</p>}
      </div>

      {!evento.aberta && (
        <Botao tamanho="p" variante="fantasma" icone={<Plus aria-hidden="true" />} onClick={aoRegistrarNovo}>
          Registrar novo evento
        </Botao>
      )}
    </div>
  );
}

/** Só o que mudou vai no PATCH (null apaga). */
function diferencas(atual: EventoAtendimento, dados: EventoDados): EventoDados {
  const m: EventoDados = {};
  const chaves = ['tipo', 'data_pretendida', 'horario', 'convidados', 'ambiente_codigo', 'necessidades', 'observacoes', 'canal'] as const;
  for (const k of chaves) {
    if (!(k in dados)) continue;
    if ((dados[k] ?? null) !== (atual[k] ?? null)) (m as Record<string, unknown>)[k] = dados[k] ?? null;
  }
  return m;
}

// Formulário (registrar ou corrigir os dados) ---------------------------------------------------------------------------

interface Rascunho {
  tipo: string;
  data_pretendida: string;
  horario: string;
  convidados: string;
  ambiente_codigo: string;
  necessidades: string;
  observacoes: string;
  canal: string;
}

const rascunhoDe = (e?: Partial<EventoAtendimento>): Rascunho => ({
  tipo: e?.tipo ?? '',
  data_pretendida: e?.data_pretendida ?? '',
  horario: e?.horario ?? '',
  convidados: e?.convidados ? String(e.convidados) : '',
  ambiente_codigo: e?.ambiente_codigo ?? '',
  necessidades: e?.necessidades ?? '',
  observacoes: e?.observacoes ?? '',
  canal: e?.canal ?? 'whatsapp',
});

export function FormEvento({ opcoes, inicial, rotuloEnviar, aoEnviar, aoCancelar }: {
  opcoes: OpcoesEventos;
  inicial?: EventoAtendimento;
  rotuloEnviar: string;
  aoEnviar: (dados: EventoDados) => Promise<void>;
  aoCancelar: () => void;
}) {
  const [r, setR] = useState<Rascunho>(() => rascunhoDe(inicial));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (p: Partial<Rascunho>) => setR((x) => ({ ...x, ...p }));
  const texto = (v: string) => v.replace(/\s+/g, ' ').trim() || null;
  // Ambiente que saiu do cadastro continua visível (o backend devolve o nome), para não sumir da tela sem aviso.
  const espacos = inicial?.ambiente_codigo && !opcoes.espacos.some((e) => e.codigo === inicial.ambiente_codigo)
    ? [...opcoes.espacos, { codigo: inicial.ambiente_codigo, nome: inicial.ambiente_nome ?? inicial.ambiente_codigo, capacidade: null }]
    : opcoes.espacos;

  async function enviar(ev: Event) {
    ev.preventDefault();
    if (enviando) return;
    const e: Record<string, string> = {};
    const n = r.convidados.trim() ? Number(r.convidados) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > EVENTO_LIMITES.convidados)) e.convidados = `Informe de 1 a ${inteiro(EVENTO_LIMITES.convidados)} pessoas.`;
    setErros(e);
    setErroGeral(null);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      await aoEnviar({
        tipo: (r.tipo || null) as TipoEvento | null,
        data_pretendida: r.data_pretendida || null,
        horario: texto(r.horario),
        convidados: n,
        ambiente_codigo: r.ambiente_codigo || null,
        necessidades: texto(r.necessidades),
        observacoes: r.observacoes.trim() || null,
        canal: (r.canal || 'whatsapp') as CanalEvento,
      });
    } catch (err) {
      if (err instanceof ErroApi && Object.keys(err.campos).length) setErros(err.campos);
      if (err instanceof ErroApi && err.codigo === 'ambiente_desconhecido') setErros({ ambiente_codigo: mensagemDeEvento(err) });
      setErroGeral(mensagemDeEvento(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form class="pilha pilha--p evento-form" onSubmit={enviar} noValidate>
      <p class="fraco">Só o que o cliente disse. Preço, pacote e disponibilidade são combinados pela equipe com o cliente.</p>
      <div class="evento-form__grade">
        <Campo rotulo="Tipo de evento" opcional erro={erros.tipo}>
          {(id, d) => (
            <select id={id} class="selecao" aria-describedby={d} value={r.tipo} onChange={(e) => set({ tipo: e.currentTarget.value })}>
              <option value="">A definir</option>
              {opcoes.tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.rotulo}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Data pretendida" opcional erro={erros.data_pretendida}>
          {(id, d) => <input id={id} class="entrada" type="date" aria-describedby={d} aria-invalid={!!erros.data_pretendida || undefined} value={r.data_pretendida} onInput={(e) => set({ data_pretendida: e.currentTarget.value })} />}
        </Campo>
        <Campo rotulo="Horário" opcional erro={erros.horario} ajuda="Como o cliente disse: 19h, à tarde…">
          {(id, d) => <input id={id} class="entrada" aria-describedby={d} maxLength={EVENTO_LIMITES.horario} value={r.horario} onInput={(e) => set({ horario: e.currentTarget.value })} />}
        </Campo>
        <Campo rotulo="Convidados" opcional erro={erros.convidados}>
          {(id, d) => <input id={id} class="entrada num" type="number" inputMode="numeric" min={1} max={EVENTO_LIMITES.convidados} aria-describedby={d} aria-invalid={!!erros.convidados || undefined} value={r.convidados} onInput={(e) => set({ convidados: e.currentTarget.value })} />}
        </Campo>
        <Campo rotulo="Ambiente" opcional erro={erros.ambiente_codigo}>
          {(id, d) => (
            <select id={id} class="selecao" aria-describedby={d} aria-invalid={!!erros.ambiente_codigo || undefined} value={r.ambiente_codigo} onChange={(e) => set({ ambiente_codigo: e.currentTarget.value })}>
              <option value="">Sem preferência</option>
              {espacos.map((s) => <option key={s.codigo} value={s.codigo}>{s.nome}{s.capacidade ? ` (até ${s.capacidade})` : ''}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Canal" erro={erros.canal}>
          {(id, d) => (
            <select id={id} class="selecao" aria-describedby={d} value={r.canal} onChange={(e) => set({ canal: e.currentTarget.value })}>
              {opcoes.canais.map((c) => <option key={c} value={c}>{CANAL_EVENTO[c] ?? c}</option>)}
            </select>
          )}
        </Campo>
      </div>
      <Campo rotulo="Necessidades" opcional erro={erros.necessidades} ajuda="Ex.: bolo próprio, decoração simples, cadeirão.">
        {(id, d) => <textarea id={id} class="area" rows={2} aria-describedby={d} maxLength={EVENTO_LIMITES.necessidades} value={r.necessidades} onInput={(e) => set({ necessidades: e.currentTarget.value })} />}
      </Campo>
      <Campo rotulo="Observações" opcional erro={erros.observacoes}>
        {(id, d) => <textarea id={id} class="area" rows={2} aria-describedby={d} maxLength={EVENTO_LIMITES.observacoes} value={r.observacoes} onInput={(e) => set({ observacoes: e.currentTarget.value })} />}
      </Campo>
      {erroGeral && <Aviso tom="perigo">{erroGeral}</Aviso>}
      <div class="linha" style={{ gap: '8px' }}>
        <Botao type="submit" variante="primario" tamanho="p" carregando={enviando}>{rotuloEnviar}</Botao>
        <Botao tamanho="p" variante="fantasma" onClick={aoCancelar} disabled={enviando}>Cancelar</Botao>
      </div>
    </form>
  );
}

/** Gaveta "Registrar evento" (conversa sem evento aberto). 409: já existe um aberto → mostra o que existe, sem duplicar. */
export function RegistrarEvento({ conversaId, nome, aberta, aoFechar }: { conversaId: string; nome: string; aberta: boolean; aoFechar: () => void }) {
  const opcoes = useOpcoesEventos(aberta);
  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Registrar evento" subtitulo={nome} largura="media">
      <Dados consulta={opcoes} recurso="As opções de evento" esqueleto={<Esqueleto linhas={6} altura={32} />}>
        {(o) =>
          o.unidade_id === null ? (
            <Vazio titulo="Sem acesso à unidade do atendimento">O evento fica na unidade que atende o WhatsApp; seu usuário não tem acesso a ela.</Vazio>
          ) : (
            <FormEvento
              opcoes={o}
              rotuloEnviar="Registrar evento"
              aoCancelar={aoFechar}
              aoEnviar={async (dados) => {
                const corpo = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== null && v !== '')) as EventoDados;
                try {
                  await atendimento.registrarEvento(conversaId, corpo);
                  avisar('Evento registrado nesta conversa.', 'ok');
                  aoFechar();
                } catch (e) {
                  if (e instanceof ErroApi && e.codigo === 'evento_aberto_na_conversa') {
                    avisar(mensagemDeEvento(e), 'erro');
                    aoFechar();
                    return;
                  }
                  throw e;
                } finally {
                  invalidar('atendimento');
                }
              }}
            />
          )
        }
      </Dados>
    </Gaveta>
  );
}

/** Faixa compacta no topo da conversa (tablet e celular): o essencial e o botão para a ficha. */
export function FaixaEvento({ evento, aoAbrir }: { evento: EventoAtendimento; aoAbrir: () => void }) {
  return (
    <button type="button" class="evento-faixa" onClick={aoAbrir} data-status={evento.status} aria-label={`Ficha do evento: ${evento.status_rotulo}`}>
      <PartyPopper aria-hidden="true" />
      <span class="evento-faixa__texto">{evento.resumo ?? evento.tipo_rotulo ?? 'Evento'}</span>
      <Situacao tom={TOM_EVENTO[evento.status]}>{evento.status_rotulo}</Situacao>
    </button>
  );
}

// Visão compacta das oportunidades (gaveta do Atendimento) --------------------------------------------------------------

type FiltroOportunidade = 'abertas' | 'fechado' | 'perdido';
const ABERTOS: StatusEventoAberto[] = ['aguardando_contato', 'novo_interesse', 'em_negociacao', 'proposta_enviada'];

export function Oportunidades({ aberta, aoFechar, aoAbrirConversa }: { aberta: boolean; aoFechar: () => void; aoAbrirConversa: (id: string) => void }) {
  const [filtro, setFiltro] = useState<FiltroOportunidade>('abertas');
  const [busca, setBusca] = useState('');
  const [aplicada, setAplicada] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);
  const q = { ...(filtro === 'abertas' ? { abertas: true } : { status: [filtro] as StatusEvento[] }), busca: aplicada || undefined };
  const consulta = useConsulta(aberta ? `atendimento/eventos?${JSON.stringify(q)}` : null, () => atendimento.eventos(q), { intervalo: 30_000 });
  const por = consulta.dados?.por_status;
  const abertasTotal = por ? ABERTOS.reduce((s, k) => s + (por[k] ?? 0), 0) : null;

  return (
    <Gaveta aberta={aberta} aoFechar={aoFechar} titulo="Eventos" subtitulo="Oportunidades das conversas · aguardando contato primeiro" largura="media">
      <div class="pilha pilha--p">
        {por && (
          <p class="evento-contagem" aria-label="Eventos por status">
            {ABERTOS.filter((k) => por[k]).map((k) => (
              <span key={k} class={k === 'aguardando_contato' ? 'evento-contagem__destaque' : undefined}>{inteiro(por[k])} {ROTULO_STATUS_EVENTO[k].toLowerCase()}</span>
            ))}
            {!abertasTotal && <span>Nenhum evento em andamento</span>}
          </p>
        )}
        <Segmentado
          rotulo="Filtrar eventos"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: 'abertas', rotulo: <>Em andamento{abertasTotal ? <span class="contador">{abertasTotal}</span> : null}</> },
            { valor: 'fechado', rotulo: 'Fechados' },
            { valor: 'perdido', rotulo: 'Perdidos' },
          ]}
        />
        <div class="entrada-grupo">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Nome ou telefone" aria-label="Buscar evento" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        <Dados consulta={consulta} recurso="A lista de eventos" compacto esqueleto={<Esqueleto linhas={5} altura={44} />}>
          {(l) =>
            l.itens.length ? (
              <>
                <ul class="lista evento-lista" aria-label="Eventos">
                  {l.itens.map((e) => (
                    <li key={e.id}>
                      <button type="button" class={`lista__item evento-item${e.status === 'aguardando_contato' ? ' evento-item--prioridade' : ''}`} data-status={e.status} onClick={() => aoAbrirConversa(e.conversa_id)}>
                        <span class="lista__icone" aria-hidden="true"><PartyPopper /></span>
                        <span class="lista__texto">
                          <strong>{e.nome_contato || telefone(e.telefone_e164)}</strong>
                          <span>{e.resumo ?? e.tipo_rotulo ?? 'Evento sem detalhes'}</span>
                          <span class="evento-item__meta">
                            <Situacao tom={TOM_EVENTO[e.status]}>{e.status_rotulo}</Situacao>
                            {e.data_pretendida && <span class="fraco"><CalendarDays size={12} aria-hidden="true" /> {dataEvento(e.data_pretendida)}</span>}
                            {e.responsavel_nome && <span class="fraco"><UserRound size={12} aria-hidden="true" /> {e.responsavel_nome}</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {l.total > l.itens.length && <p class="fraco">Mostrando {inteiro(l.itens.length)} de {plural(l.total, 'evento', 'eventos')}. Use a busca para achar os outros.</p>}
              </>
            ) : (
              <Vazio compacto icone={<PartyPopper aria-hidden="true" />} titulo={aplicada ? 'Nenhum evento encontrado' : filtro === 'abertas' ? 'Nenhum evento em andamento' : filtro === 'fechado' ? 'Nenhum evento fechado' : 'Nenhum evento perdido'}>
                {!aplicada && filtro === 'abertas' ? 'Quando um cliente pedir um evento na conversa, ele aparece aqui.' : undefined}
              </Vazio>
            )
          }
        </Dados>
      </div>
    </Gaveta>
  );
}
