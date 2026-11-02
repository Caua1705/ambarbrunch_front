// Ficha contextual do contato, em gaveta, aberta pela conversa (não existe mais página Clientes): quem é (nome, telefone,
// e-mail, origem Giardini ou Âmbar), os cadastros deste telefone — sem fundir nada; com mais de um cadastro sem vínculo, o
// selo de "cadastro ambíguo" —, as próximas e as últimas reservas (link para a reserva no módulo Reservas),
// consentimentos e o movimento da conversa. O e-mail vem mascarado para quem não tem clientes.visualizar (o backend decide).
import { ExternalLink, ShieldCheck, BadgeCheck, TriangleAlert } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { dataCurta, dataHora, plural, telefone, inteiro } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Situacao, Etiqueta, Aviso } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { FichaContato, ReservaContato } from '../../lib/tipos/atendimento-clube';
import type { StatusReserva } from '../../lib/tipos/reservas';
import { STATUS } from '../reservas/comum';
import { FINALIDADE, MOTIVO_FOLLOWUP, ORIGEM, SITUACAO_CONSENTIMENTO, origemContato } from './comum';

export function Contato({ conversaId, aoFechar }: { conversaId: string | null; aoFechar: () => void }) {
  const consulta = useConsulta(conversaId ? `atendimento/conversas/${conversaId}/contato` : null, () => atendimento.contato(conversaId!));
  const f = consulta.dados;
  const principal = f?.cadastros.find((c) => c.id === f.cliente_id) ?? (f?.cadastros.length === 1 ? f.cadastros[0] : undefined);
  return (
    <Gaveta
      aberta={!!conversaId}
      aoFechar={aoFechar}
      largura="media"
      titulo={principal?.nome ?? f?.nome_whatsapp ?? 'Contato'}
      subtitulo={f ? `${telefone(f.telefone_e164)} · ${origemContato(f.giardini)}` : undefined}
    >
      <Dados consulta={consulta} recurso="A ficha do contato" esqueleto={<Esqueleto linhas={10} />}>
        {(f: FichaContato) => <Conteudo f={f} />}
      </Dados>
    </Gaveta>
  );
}

function Conteudo({ f }: { f: FichaContato }) {
  const principal = f.cadastros.find((c) => c.id === f.cliente_id) ?? (f.cadastros.length === 1 ? f.cadastros[0] : undefined);
  const consentimentos = Object.entries(f.consentimentos ?? {});
  return (
    <>
      {f.situacao_cadastro === 'ambiguo' && (
        <Aviso tom="atencao" icone={<TriangleAlert aria-hidden="true" />}>
          <strong>Cadastro ambíguo: {plural(f.cadastros.length, 'cadastro', 'cadastros')} com este telefone.</strong> A conversa não foi ligada a nenhum
          deles (pode ser família, empresa ou número compartilhado). Confira com o cliente antes de usar os dados.
        </Aviso>
      )}

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Contato</h3>
        <dl class="definicoes">
          <dt>Nome</dt>
          <dd>{principal?.nome ?? <span class="fraco">Sem cadastro{f.nome_whatsapp ? ` · no WhatsApp: ${f.nome_whatsapp}` : ''}</span>}</dd>
          {principal && f.nome_whatsapp && f.nome_whatsapp !== principal.nome && (
            <>
              <dt>No WhatsApp</dt>
              <dd>{f.nome_whatsapp}</dd>
            </>
          )}
          <dt>Telefone</dt>
          <dd class="num">{telefone(f.telefone_e164)}{principal?.telefone_verificado && <span class="fraco"> · verificado</span>}</dd>
          <dt>E-mail</dt>
          <dd>{principal?.email || <span class="fraco">Não informado</span>}</dd>
          <dt>Origem</dt>
          <dd>{origemContato(f.giardini)}{principal ? <span class="fraco"> · {ORIGEM[principal.origem] ?? principal.origem}{principal.origem_detalhe ? ` (${principal.origem_detalhe})` : ''}</span> : null}</dd>
        </dl>
      </section>

      {f.cadastros.length > 1 && (
        <section class="pilha pilha--p">
          <h3 class="secao-titulo">Cadastros com este telefone</h3>
          <ul class="lista lista--borda">
            {f.cadastros.map((c) => (
              <li key={c.id} class="lista__item" style={{ cursor: 'default' }}>
                <span class="lista__texto">
                  <strong>
                    {c.nome}
                    {c.id === f.cliente_id && <> <Etiqueta tom="marca">Desta conversa</Etiqueta></>}
                    {c.principal_id && <> <Etiqueta>Ligado a outro cadastro</Etiqueta></>}
                  </strong>
                  <span>{origemContato(c.giardini)} · {ORIGEM[c.origem] ?? c.origem} · desde {dataCurta(c.criado_em, { ano: true })} · {plural(c.reservas, 'reserva', 'reservas')}{c.email ? ` · ${c.email}` : ''}</span>
                </span>
                {c.telefone_verificado && <BadgeCheck size={16} aria-label="Telefone verificado" style={{ flex: 'none', color: 'var(--ok)' }} />}
              </li>
            ))}
          </ul>
          <p class="fraco">Nenhum cadastro é fundido ou apagado. A gerência pode ligar duplicados em “Mais → Cadastros duplicados”.</p>
        </section>
      )}

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Próximas reservas</h3>
        <ListaReservas reservas={f.reservas_futuras} vazio="Nenhuma reserva marcada." />
      </section>

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Últimas reservas{f.reservas_total > f.reservas_futuras.length + f.reservas_passadas.length ? ` (${inteiro(f.reservas_total)} no total)` : ''}</h3>
        <ListaReservas reservas={f.reservas_passadas} vazio="Nenhuma reserva anterior." />
      </section>

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Consentimentos</h3>
        {consentimentos.length ? (
          <ul class="lista lista--borda">
            {consentimentos.map(([finalidade, k]) => {
              const s = SITUACAO_CONSENTIMENTO[k.situacao] ?? { rotulo: k.situacao, tom: 'neutro' as const };
              return (
                <li key={finalidade} class="linha linha--entre" style={{ padding: '10px 14px' }}>
                  <span class="linha" style={{ gap: '6px' }}><ShieldCheck size={14} aria-hidden="true" /> {FINALIDADE[finalidade] ?? finalidade}</span>
                  <span class="linha" style={{ gap: '6px' }}><Situacao tom={s.tom}>{s.rotulo}</Situacao><span class="fraco">{dataCurta(k.em, { ano: true })} · {ORIGEM[k.canal] ?? k.canal}</span></span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="fraco">Nenhum consentimento registrado. Sem autorização de marketing, nada promocional é enviado.</p>
        )}
      </section>

      <section class="pilha pilha--p">
        <h3 class="secao-titulo">Esta conversa</h3>
        <dl class="definicoes">
          <dt>Primeira mensagem</dt>
          <dd>{f.primeira_mensagem_em ? dataHora(f.primeira_mensagem_em) : '—'}</dd>
          <dt>Recebidas</dt>
          <dd class="num">{inteiro(f.mensagens_recebidas)}</dd>
          <dt>Enviadas</dt>
          <dd class="num">{inteiro(f.mensagens_enviadas)}</dd>
          <dt>Follow-up</dt>
          <dd>{f.followup_desligado ? `Desligado${f.followup_motivo ? ` (${MOTIVO_FOLLOWUP[f.followup_motivo] ?? f.followup_motivo.replace(/_/g, ' ')})` : ''}` : 'Ligado'}</dd>
        </dl>
      </section>
    </>
  );
}

function ListaReservas({ reservas, vazio }: { reservas: ReservaContato[]; vazio: string }) {
  if (!reservas.length) return <p class="fraco">{vazio}</p>;
  return (
    <ul class="lista lista--borda">
      {reservas.map((r) => {
        const s = STATUS[r.status as StatusReserva] ?? { rotulo: r.status, tom: 'neutro' as const };
        return (
          <li key={r.id}>
            <a class="lista__item" href={`/admin/reservas?data=${r.data}&reserva=${r.id}`} style={{ gap: '10px' }}>
              <span class="lista__texto">
                <strong style={{ fontWeight: 600 }}>{dataCurta(r.data, { semana: true, ano: true })} · {r.hora.slice(0, 5)}</strong>
                <span>{r.ambiente} · {plural(r.pessoas, 'pessoa', 'pessoas')} · {r.codigo}{r.giardini ? ' · Giardini' : ''}</span>
              </span>
              <Situacao tom={s.tom}>{s.rotulo}</Situacao>
              <ExternalLink size={14} aria-hidden="true" style={{ flex: 'none', color: 'var(--texto-3)' }} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
