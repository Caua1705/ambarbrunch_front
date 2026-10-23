/** @jsxImportSource preact */
// Catálogo de recompensas (/clube/recompensas) — só apresentação, pronto para os dados reais. Hoje não há catálogo nem
// resgate no contrato do site (lib/api/clube-futuro.ts): a página mostra “em preparação” e NENHUMA ação de resgate.
// Estas peças recebem tudo por props; os botões de resgate só aparecem quando a ilha passa a ação (bandeira
// RECURSOS.resgates ligada e rota real). Sem produto, valor ou estoque inventado: na prévia local, os dados são de exemplo.
import { Icone } from './icones';
import type { Recompensa } from '../../lib/api/clube-futuro';

const fmt = new Intl.NumberFormat('pt-BR');

function Foto({ r }: { r: Pick<Recompensa, 'foto' | 'nome'> }) {
  return r.foto
    ? <img class="recompensa__foto" src={r.foto} alt="" loading="lazy" decoding="async" />
    : <span class="recompensa__foto recompensa__foto--vazia" aria-hidden="true"><Icone nome="presente" /></span>;
}

/** situação de uma recompensa para quem está vendo: disponível, faltam pontos ou fora do cardápio no momento */
export function situacaoRecompensa(r: Recompensa, saldo: number | null) {
  if (!r.disponivel) return { tipo: 'indisponivel' as const, texto: 'Indisponível no momento' };
  if (saldo !== null && saldo < r.pontos) return { tipo: 'insuficiente' as const, texto: `Faltam ${fmt.format(r.pontos - saldo)} pontos` };
  return { tipo: 'disponivel' as const, texto: 'Disponível para você' };
}

export function CartaoRecompensa({ r, saldo, href }: { r: Recompensa; saldo: number | null; href?: string }) {
  const s = situacaoRecompensa(r, saldo);
  const Raiz = href ? 'a' : 'article';
  return (
    <Raiz class="recompensa" data-situacao={s.tipo} {...(href ? { href } : {})}>
      <Foto r={r} />
      <span class="recompensa__corpo">
        <strong class="recompensa__nome">{r.nome}</strong>
        <span class="recompensa__pontos"><b>{fmt.format(r.pontos)}</b> pontos</span>
        <span class="recompensa__situacao">{s.texto}</span>
      </span>
    </Raiz>
  );
}

export function CatalogoRecompensas({ itens, saldo }: { itens: Recompensa[]; saldo: number | null }) {
  return (
    <div class="catalogo">
      {saldo !== null && <p class="catalogo__saldo">Você tem <strong>{fmt.format(saldo)}</strong> pontos disponíveis</p>}
      <ul class="catalogo__grade">
        {itens.map((r) => <li><CartaoRecompensa r={r} saldo={saldo} /></li>)}
      </ul>
    </div>
  );
}

/** detalhe: foto grande, descrição e a ação — que só existe com o resgate ligado (`aoResgatar`) */
export function DetalheRecompensa({ r, saldo, aoResgatar, aoVoltar }: { r: Recompensa; saldo: number | null; aoResgatar?: () => void; aoVoltar?: () => void }) {
  const s = situacaoRecompensa(r, saldo);
  return (
    <article class="recompensa-detalhe" data-situacao={s.tipo} aria-labelledby="rd-nome">
      <Foto r={r} />
      <div class="recompensa-detalhe__corpo">
        <h2 class="recompensa-detalhe__nome" id="rd-nome">{r.nome}</h2>
        <p class="recompensa-detalhe__pontos"><strong>{fmt.format(r.pontos)}</strong> pontos</p>
        {r.descricao && <p class="recompensa-detalhe__desc">{r.descricao}</p>}
        <p class="recompensa__situacao">{s.texto}</p>
        {aoResgatar
          ? <button class="btn btn--wine btn--block" type="button" disabled={s.tipo !== 'disponivel'} onClick={aoResgatar}>Resgatar</button>
          : <p class="recompensa-detalhe__nota">Os resgates abrem quando o programa começar.</p>}
        {aoVoltar && <button class="ticket__link" type="button" onClick={aoVoltar}>Voltar ao catálogo</button>}
      </div>
    </article>
  );
}

/** confirmação antes do resgate: o que sai do saldo. O backend é quem reserva os pontos e emite o QR Code */
export function ConfirmacaoResgate({ r, saldo, ocupado, erro, aoConfirmar, aoVoltar }: { r: Recompensa; saldo: number; ocupado?: boolean; erro?: string; aoConfirmar?: () => void; aoVoltar?: () => void }) {
  return (
    <section class="resgate-confirma" aria-labelledby="rc-t">
      <h2 class="resgate-confirma__titulo" id="rc-t">Confirmar resgate</h2>
      <div class="resgate-confirma__item"><Foto r={r} /><strong>{r.nome}</strong></div>
      <dl class="resgate-confirma__contas">
        <div><dt>Seu saldo</dt><dd>{fmt.format(saldo)}</dd></div>
        <div><dt>Esta recompensa</dt><dd>− {fmt.format(r.pontos)}</dd></div>
        <div class="resgate-confirma__fica"><dt>Fica com</dt><dd>{fmt.format(saldo - r.pontos)}</dd></div>
      </dl>
      <p class="resgate-confirma__nota">Depois de confirmar, você recebe um QR Code para mostrar no caixa.</p>
      {erro && <p class="ticket__status" data-tone="error" role="alert">{erro}</p>}
      <button class="btn btn--wine btn--block" type="button" disabled={ocupado} onClick={aoConfirmar}>{ocupado ? 'Confirmando…' : 'Confirmar resgate'}</button>
      <button class="ticket__link" type="button" disabled={ocupado} onClick={aoVoltar}>Voltar</button>
    </section>
  );
}
