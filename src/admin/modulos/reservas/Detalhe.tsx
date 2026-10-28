// Gaveta de detalhe da reserva: dados do cliente, situação, histórico de comparecimento e só as ações que o backend aceita
// para aquele estado (máquina de estados de app/modulos/reservas/estados.py).
import { useEffect, useState } from 'preact/hooks';
import { Check, X, UserCheck, UserX, Phone, MessageCircle, Pencil, Undo2, BellRing, AlertTriangle } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { ErroApi } from '../../lib/api/cliente';
import { dataLonga, hora, telefone, linkWhatsApp, dataHora, plural } from '../../lib/formato';
import { Gaveta, avisar, avisarErro, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Aviso, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { ReservaPainel } from '../../lib/tipos/reservas';
import { SituacaoReserva, statusDe, emAberto, confirmadaBase, comecou, atualizarReservas, registrarComparecimento, CANAL, STATUS } from './comum';
import { EditarReserva } from './NovaReserva';

export function DetalheReserva({ id, aoFechar, confirmar }: { id: string | null; aoFechar: () => void; confirmar: (p: PedidoConfirmacao) => void }) {
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
  const ausenciaLiberada = comp.dados ? Date.now() >= new Date(comp.dados.ausencia_liberada_em).getTime() : r ? Date.now() >= new Date(`${r.data}T${r.hora.slice(0, 5)}:00-03:00`).getTime() + 15 * 60_000 : false;

  const rodape = r && !editando && (
    <>
      {s === 'pendente' && (
        <>
          <Botao variante="perigo" icone={<X aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Recusar esta reserva?', confirmar: 'Recusar reserva', perigo: true, motivo: { rotulo: 'Motivo', obrigatorio: false, ajuda: 'Opcional. Fica no histórico.' }, acao: async (m) => { await reservas.mudarStatus(r.id, 'cancelada', m || undefined); atualizarReservas(); }, sucesso: 'Reserva recusada.' })}>
            Recusar
          </Botao>
          <Botao variante="primario" icone={<Check aria-hidden="true" />} carregando={ocupado === 'aprovar'} onClick={() => executar('aprovar', () => reservas.mudarStatus(r.id, 'confirmada'), 'Reserva aprovada.')} data-autofoco>
            Aprovar reserva
          </Botao>
        </>
      )}
      {confirmadaBase(r) && emAberto(r) && !comecou(r) && (
        <>
          <Botao variante="fantasma" icone={<X aria-hidden="true" />} onClick={() => confirmar({ titulo: `Cancelar a reserva de ${r.contato_nome}?`, texto: 'O lugar volta a ficar livre. Esta ação não pode ser desfeita.', confirmar: 'Cancelar reserva', perigo: true, motivo: { rotulo: 'Motivo do cancelamento', ajuda: 'Ex.: cliente pediu por telefone. Fica no histórico.' }, acao: async (m) => { await reservas.mudarStatus(r.id, 'cancelada', m); atualizarReservas(); }, sucesso: 'Reserva cancelada.' })}>
            Cancelar reserva
          </Botao>
          <Botao icone={<Pencil aria-hidden="true" />} onClick={() => setEditando(true)}>Alterar</Botao>
        </>
      )}
      {confirmadaBase(r) && emAberto(r) && comecou(r) && (
        <>
          <Botao icone={<UserX aria-hidden="true" />} disabled={!ausenciaLiberada} title={ausenciaLiberada ? undefined : 'Liberado depois da tolerância de atraso'} onClick={() => confirmar({ titulo: 'Registrar que o cliente não veio?', texto: 'Isso entra no histórico de frequência do cliente.', confirmar: 'Não veio', acao: () => registrarComparecimento(r.id, 'nao_compareceu'), sucesso: 'Ausência registrada.' })}>
            Não veio
          </Botao>
          <Botao variante="primario" icone={<UserCheck aria-hidden="true" />} carregando={ocupado === 'chegou'} onClick={() => executar('chegou', () => registrarComparecimento(r.id, 'compareceu'), 'Chegada registrada.')}>
            Chegou
          </Botao>
        </>
      )}
      {(s === 'compareceu' || s === 'nao_compareceu') && (
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

              {r.avisar_cliente && (
                <Aviso tom="atencao" icone={<BellRing aria-hidden="true" />}>
                  <strong>Avise o cliente da {r.avisar_cliente === 'cancelamento' ? 'cancelamento' : 'alteração'}.</strong> O sistema não enviou mensagem automática desta mudança.
                  <div style={{ marginTop: '8px' }}>
                    <Botao tamanho="p" carregando={ocupado === 'avisado'} onClick={() => executar('avisado', () => reservas.avisoComunicado(r.id), 'Marcado como avisado.')}>Já avisei o cliente</Botao>
                  </div>
                </Aviso>
              )}
              {s === 'pendente' && <Aviso tom="info" icone={<AlertTriangle aria-hidden="true" />}>Este ambiente pede aprovação da equipe. Aprovando, o cliente recebe a confirmação.</Aviso>}

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
                  <dd>{r.observacoes || <span class="fraco">Nenhuma</span>}</dd>
                  <dt>Origem</dt>
                  <dd>{CANAL[r.canal] ?? r.canal}{r.importada_de ? ` · importada (${r.importada_de})` : ''}</dd>
                  <dt>Criada em</dt>
                  <dd>{dataHora(r.criado_em)}</dd>
                  {r.cancelada_em && (
                    <>
                      <dt>Cancelada em</dt>
                      <dd>{dataHora(r.cancelada_em)}{r.motivo_cancelamento ? ` — ${r.motivo_cancelamento}` : ''}</dd>
                    </>
                  )}
                </dl>
              </section>

              <section class="pilha pilha--p">
                <h3 class="secao-titulo">Contato</h3>
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
