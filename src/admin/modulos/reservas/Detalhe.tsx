// Gaveta de detalhe da reserva: dados do cliente, situação, histórico de comparecimento e só as ações que o backend aceita
// para aquele estado (máquina de estados de app/modulos/reservas/estados.py) e para o perfil — as mesmas do painel anterior.
import { useEffect, useState } from 'preact/hooks';
import { Check, X, UserCheck, UserX, Phone, MessageCircle, Pencil, Undo2, BellRing, AlertTriangle, Lock } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { ErroApi } from '../../lib/api/cliente';
import { dataLonga, hora, telefone, linkWhatsApp, dataHora, plural, hojeISO } from '../../lib/formato';
import { Gaveta, avisar, avisarErro, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Aviso, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { ReservaPainel } from '../../lib/tipos/reservas';
import { SituacaoReserva, statusDe, emAberto, confirmadaBase, aceitaChegada, atualizarReservas, registrarComparecimento, CANAL, STATUS } from './comum';
import { EditarReserva } from './NovaReserva';
import { pode } from '../../lib/permissoes';
import type { Papel } from '../../lib/sessao';

/** Cancelar (ou recusar a pendente): motivo opcional, até 300 caracteres (MudancaStatus do backend). */
export function pedirCancelamento(r: ReservaPainel, confirmar: (p: PedidoConfirmacao) => void) {
  const pendente = statusDe(r) === 'pendente';
  confirmar({
    titulo: pendente ? `Recusar a reserva de ${r.contato_nome}?` : `Cancelar a reserva de ${r.contato_nome}?`,
    texto: `${dataLonga(r.data)} às ${hora(r.hora)} · ${r.ambiente}. O lugar é liberado na hora e não há como desfazer. O cliente não recebe aviso automático da equipe: o painel lembra de avisar.`,
    confirmar: pendente ? 'Recusar reserva' : 'Cancelar reserva',
    perigo: true,
    motivo: { rotulo: 'Motivo', obrigatorio: false, maximo: 300, ajuda: 'Opcional. Ex.: cliente pediu por telefone. Fica no histórico da reserva.' },
    acao: async (m) => {
      try {
        const nova = await reservas.mudarStatus(r.id, 'cancelada', m || undefined);
        if (nova.avisar_cliente === 'cancelamento') avisar(`${pendente ? 'Reserva recusada' : 'Reserva cancelada'}. O cliente NÃO foi avisado pelo sistema: avise pelo WhatsApp ou telefone.`, 'info');
        else avisar(pendente ? 'Reserva recusada.' : 'Reserva cancelada.', 'ok');
      } finally {
        // resultado incerto (sem conexão, conflito): a tela relê a reserva antes de alguém repetir
        atualizarReservas();
      }
    },
  });
}

export function DetalheReserva({ id, aoFechar, confirmar, papel }: { id: string | null; aoFechar: () => void; confirmar: (p: PedidoConfirmacao) => void; papel: Papel }) {
  // Atendente: só "Chegou" no dia (o backend confere de novo). Gerente e Proprietário: todas as ações do estado.
  const gerencia = pode(papel, 'reservas.mudar_status');
  const alteraReserva = pode(papel, 'reservas.alterar');
  const verContato = pode(papel, 'reservas.ver_contato');
  const consulta = useConsulta(id ? `reservas/${id}` : null, () => reservas.obter(id!));
  const comp = useConsulta(id ? `reservas/${id}/comparecimento` : null, () => reservas.comparecimento(id!));
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  useEffect(() => setEditando(false), [id]);

  const r = consulta.dados;
  const executar = async (rotulo: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupado(rotulo);
    try {
      await fn();
      avisar(ok, 'ok');
    } catch (e) {
      avisarErro(e);
    } finally {
      atualizarReservas();
      setOcupado(null);
    }
  };

  const s = r ? statusDe(r) : null;
  const hoje = hojeISO();
  const ausenciaLiberada = comp.dados ? Date.now() >= new Date(comp.dados.ausencia_liberada_em).getTime() : r ? Date.now() >= new Date(`${r.data}T${r.hora.slice(0, 5)}:00-03:00`).getTime() + 15 * 60_000 : false;
  const travado = !!ocupado;

  const rodape = r && !editando && (
    <>
      {emAberto(r) && alteraReserva && (
        <Botao variante="fantasma" icone={<Pencil aria-hidden="true" />} disabled={travado} onClick={() => setEditando(true)} title="Contato e observações">Alterar</Botao>
      )}
      {s === 'pendente' && gerencia && (
        <>
          <Botao variante="perigo" icone={<X aria-hidden="true" />} disabled={travado} onClick={() => pedirCancelamento(r, confirmar)}>Recusar</Botao>
          <Botao variante="primario" icone={<Check aria-hidden="true" />} carregando={ocupado === 'aprovar'} disabled={travado} onClick={() => executar('aprovar', () => reservas.mudarStatus(r.id, 'confirmada'), 'Reserva aprovada. O cliente recebe a confirmação.')} data-autofoco>
            Aprovar reserva
          </Botao>
        </>
      )}
      {confirmadaBase(r) && emAberto(r) && (
        <>
          {gerencia && <Botao variante="fantasma" icone={<X aria-hidden="true" />} disabled={travado} onClick={() => pedirCancelamento(r, confirmar)}>Cancelar reserva</Botao>}
          {gerencia && r.data <= hoje && (
            <Botao icone={<UserX aria-hidden="true" />} disabled={!ausenciaLiberada || travado} title={ausenciaLiberada ? undefined : 'Liberado depois da tolerância de atraso'} onClick={() => confirmar({ titulo: 'Registrar que o cliente não veio?', texto: `${r.contato_nome} · ${dataLonga(r.data)} às ${hora(r.hora)}. Entra no histórico de frequência do cliente; dá para corrigir depois.`, confirmar: 'Não veio', acao: () => registrarComparecimento(r.id, 'nao_compareceu'), sucesso: 'Ausência registrada.' })}>
              Não veio
            </Botao>
          )}
          {aceitaChegada(r, papel) && (
            <Botao variante="primario" icone={<UserCheck aria-hidden="true" />} carregando={ocupado === 'chegou'} disabled={travado} onClick={() => executar('chegou', () => registrarComparecimento(r.id, 'compareceu'), 'Chegada registrada.')}>
              Chegou
            </Botao>
          )}
        </>
      )}
      {(s === 'compareceu' || s === 'nao_compareceu') && gerencia && (
        <>
          <Botao variante="fantasma" icone={<Undo2 aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Desfazer o registro de comparecimento?', confirmar: 'Desfazer', motivo: { rotulo: 'Justificativa', ajuda: 'Obrigatória: correções ficam no histórico.' }, acao: (m) => registrarComparecimento(r.id, 'nao_registrado', m), sucesso: 'Registro desfeito.' })}>
            Desfazer
          </Botao>
          <Botao onClick={() => { const novo = s === 'compareceu' ? 'nao_compareceu' : 'compareceu'; confirmar({ titulo: `Corrigir para “${STATUS[novo].rotulo}”?`, confirmar: 'Corrigir', motivo: { rotulo: 'Justificativa', ajuda: 'Obrigatória: correções ficam no histórico.' }, acao: (m) => registrarComparecimento(r.id, novo, m), sucesso: 'Registro corrigido.' }); }}>
            Corrigir para “{s === 'compareceu' ? 'Não veio' : 'Chegou'}”
          </Botao>
        </>
      )}
    </>
  );

  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      titulo={r ? r.contato_nome : 'Reserva'}
      subtitulo={r ? `${plural(r.pessoas, 'pessoa', 'pessoas')} · ${r.ambiente} · ${hora(r.hora)}` : undefined}
      rodape={rodape}
    >
      <Dados consulta={consulta} recurso="A reserva" esqueleto={<Esqueleto linhas={8} />}>
        {(r: ReservaPainel) =>
          editando ? (
            <EditarReserva reserva={r} aoTerminar={() => setEditando(false)} />
          ) : (
            <>
              <div class="linha linha--entre">
                <SituacaoReserva r={r} />
                <span class="fraco num">{r.codigo}</span>
              </div>

              {/* Quem não altera reservas (Atendente) não tem o contato nem registra o aviso, como no painel anterior. */}
              {r.avisar_cliente && alteraReserva && (
                <Aviso tom="atencao" icone={<BellRing aria-hidden="true" />}>
                  <strong>O cliente NÃO foi avisado {r.avisar_cliente === 'cancelamento' ? 'do cancelamento' : 'da alteração'}.</strong> O sistema não enviou mensagem desta mudança: avise pelo WhatsApp ou por telefone.
                  <div style={{ marginTop: '8px' }}>
                    <Botao tamanho="p" carregando={ocupado === 'avisado'} disabled={travado} onClick={() => executar('avisado', () => reservas.avisoComunicado(r.id), 'Registrado: a equipe avisou o cliente.')}>Já avisei o cliente</Botao>
                  </div>
                </Aviso>
              )}
              {s === 'pendente' && (
                <Aviso tom="info" icone={<AlertTriangle aria-hidden="true" />}>
                  {gerencia ? 'Este ambiente pede aprovação da equipe. Aprovando, o cliente recebe a confirmação.' : 'Reserva aguardando aprovação da gerência. A chegada só pode ser registrada depois de aprovada.'}
                </Aviso>
              )}
              {!gerencia && confirmadaBase(r) && emAberto(r) && r.data > hoje && <p class="fraco">A chegada pode ser registrada no dia da reserva.</p>}

              <section class="pilha pilha--p">
                <h3 class="secao-titulo">Reserva</h3>
                <dl class="definicoes">
                  <dt>Data</dt>
                  <dd>{dataLonga(r.data)}</dd>
                  <dt>Horário</dt>
                  <dd class="num">{hora(r.hora)} <span class="fraco">· {r.duracao_min} min</span></dd>
                  <dt>Pessoas</dt>
                  <dd class="num">{r.pessoas}</dd>
                  <dt>Ambiente</dt>
                  <dd>{r.ambiente}</dd>
                  <dt>Observações</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{r.observacoes || <span class="fraco">Nenhuma</span>}</dd>
                  <dt>Origem</dt>
                  <dd>{r.importada_de ? `Importada do Giardini (${r.importada_de})` : CANAL[r.canal] ?? r.canal}</dd>
                  <dt>Criada em</dt>
                  <dd>{dataHora(r.criado_em)}</dd>
                  {r.cancelada_em && (
                    <>
                      <dt>Cancelada em</dt>
                      <dd>{dataHora(r.cancelada_em)}{r.motivo_cancelamento ? ` — ${r.motivo_cancelamento}` : ''}</dd>
                    </>
                  )}
                  {r.comparecimento_registrado_em && (
                    <>
                      <dt>{r.comparecimento === 'compareceu' ? 'Chegada registrada' : 'Ausência registrada'}</dt>
                      <dd>{dataHora(r.comparecimento_registrado_em)}{comp.dados?.registrado_por_nome ? ` · ${comp.dados.registrado_por_nome}` : ''}</dd>
                    </>
                  )}
                </dl>
              </section>

              <section class="pilha pilha--p">
                <h3 class="secao-titulo">Contato</h3>
                {verContato ? (
                  <>
                    <dl class="definicoes">
                      <dt>Telefone</dt>
                      <dd class="num">{telefone(r.contato_telefone_e164)}</dd>
                      <dt>E-mail</dt>
                      <dd>{r.contato_email || <span class="fraco">Não informado</span>}</dd>
                    </dl>
                    {r.contato_telefone_e164 && (
                      <div class="linha">
                        <a class="btn btn--p" href={`tel:${r.contato_telefone_e164}`}><Phone aria-hidden="true" /> Ligar</a>
                        {linkWhatsApp(r.contato_telefone_e164) && <a class="btn btn--p" href={linkWhatsApp(r.contato_telefone_e164)!} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a>}
                      </div>
                    )}
                  </>
                ) : (
                  <p class="fraco linha" style={{ gap: '6px' }}><Lock size={14} aria-hidden="true" /> Telefone e e-mail: restritos ao perfil de Gerente ou Proprietário.</p>
                )}
              </section>

              {(comp.dados?.historico.length ?? 0) > 0 && (
                <section class="pilha pilha--p">
                  <h3 class="secao-titulo">Histórico de comparecimento</h3>
                  <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '10px' }}>
                    {comp.dados!.historico.map((h, i) => (
                      <li key={i} style={{ padding: '10px 14px' }}>
                        <div class="linha linha--entre">
                          <span><Etiqueta>{STATUS[h.depois as 'compareceu']?.rotulo ?? 'Sem registro'}</Etiqueta> <span class="fraco">antes: {STATUS[h.antes as 'compareceu']?.rotulo ?? 'sem registro'}</span></span>
                          <span class="fraco">{dataHora(h.ocorreu_em)}</span>
                        </div>
                        <div class="fraco" style={{ marginTop: '4px' }}>{h.usuario_nome ?? h.ator_tipo}{h.motivo ? ` — “${h.motivo}”` : ''}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {comp.erro && comp.erro.tipo !== 'nao_implantado' && comp.erro.tipo !== 'nao_encontrado' && <p class="fraco">Histórico indisponível: {comp.erro.message}</p>}
              {s === 'cancelada' && <p class="fraco">Reserva cancelada: não há ações.</p>}
            </>
          )
        }
      </Dados>
    </Gaveta>
  );
}

export function ehErroCriacaoDesligada(e: unknown) {
  return e instanceof ErroApi && e.codigo === 'criacao_manual_desativada';
}
