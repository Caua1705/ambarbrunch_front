/** @jsxImportSource preact */
// /reserva-confirmada/ — a tela final da reserva feita pelo site, fora da landing: o mesmo cartão da comanda com a
// mensagem, ambiente, pessoas, data, horário e as agendas. Os dados vêm do sessionStorage da aba (lib/reserva-confirmada):
// recarregar mostra a mesma confirmação e não envia nada; sem dados (aba nova, link direto), um aviso e o início.
import { useEffect, useState } from 'preact/hooks';
import { lerConfirmacao, type Confirmacao } from '../lib/reserva-confirmada';
import { linkGoogleAgenda, linkIcs, nomeIcs } from '../lib/agenda';

const dataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function ReservaConfirmada() {
  const [estado, setEstado] = useState<'lendo' | 'ok' | 'vazia'>('lendo');
  const [c, setC] = useState<Confirmacao | null>(null);
  useEffect(() => {
    const lida = lerConfirmacao();
    setC(lida);
    setEstado(lida ? 'ok' : 'vazia');
    // a confirmação começa no topo, inclusive ao recarregar
    scrollTo(0, 0);
  }, []);

  if (estado === 'lendo') return <article class="ticket" aria-busy="true" />;

  if (estado === 'vazia' || !c) {
    return (
      <article class="ticket" aria-labelledby="rc-titulo">
        <h1 class="ticket__title" id="rc-titulo">Nenhuma reserva recente</h1>
        <p class="ticket__slots">Não encontramos uma reserva feita agora há pouco neste aparelho.</p>
        <div class="ticket__actions">
          <a class="ticket__link" href="/">Voltar ao início</a>
        </div>
      </article>
    );
  }

  const pendente = c.status === 'pendente';
  return (
    <article class="ticket" data-etapa="confirmada" aria-labelledby="rc-titulo">
      <div class="stamp ticket__stamp" data-state="reservado" aria-hidden="true">{pendente ? 'recebido' : 'reservado'}</div>
      <h1 class="ticket__title" id="rc-titulo">{pendente ? 'Pedido recebido' : 'Mesa reservada'}</h1>
      <p class="ticket__status" role="status">
        {pendente ? 'Recebemos seu pedido. A reserva só vale depois de aprovada pela equipe do Âmbar.' : 'Tudo certo! Sua reserva está registrada.'}
      </p>
      <dl class="ticket__review">
        <div><dt>Ambiente</dt><dd>{c.ambienteNome}</dd></div>
        <div><dt>Pessoas</dt><dd>{c.pessoas}</dd></div>
        <div><dt>Data</dt><dd>{dataLonga.format(new Date(`${c.data}T12:00:00`))}</dd></div>
        <div><dt>Horário</dt><dd>{c.hora}</dd></div>
      </dl>
      <div class="ticket__actions">
        {/* só com o toque: o Google Agenda abre numa aba (ou no app, se o aparelho associar) já preenchido; nada é baixado */}
        <a class="btn btn--wine btn--block" href={linkGoogleAgenda(c, c.fuso)} target="_blank" rel="noopener">Adicionar ao Google Agenda</a>
        <a class="ticket__link" href={linkIcs(c, c.fuso)} download={nomeIcs(c)}>Outros calendários (.ics)</a>
        <a class="ticket__link" href="/">Voltar ao início</a>
      </div>
    </article>
  );
}
