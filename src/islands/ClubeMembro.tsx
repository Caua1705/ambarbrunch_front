/** @jsxImportSource preact */
// Área de membro do Clube Âmbar — ilha Preact: acesso pelo telefone (código, sem senha) e carteira.
// Modos:
//  - "indisponivel" (padrão): o acesso aparece desligado (“Acesso em breve”) e, abaixo, uma PRÉVIA da carteira sem nenhum
//    dado — saldo em traço, histórico e recompensas vazios. Nada é pedido, enviado ou guardado.
//  - "api": a sessão é um cookie httpOnly do backend. Ao abrir: GET /clube/membro → carteira; 401 → acesso.
// Saldo, histórico e recompensas vêm SÓ da API. O navegador não soma, não estima e não guarda pontos.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Carteira from '../components/Carteira';
import { PassoCodigo } from './clube-partes';
import { ErroClube, type ClubeApi, type DesafioCodigo, type Membro, type Movimento, type Recompensas } from '../lib/api/clube-contrato';
import { criarClubeHttp } from '../lib/api/clube-http';
import { mascaraTel, soDigitos, telefoneValido } from '../lib/telefone';
import type { ModoClube } from '../lib/clube-modo';

export type EtapaMembro = 'indisponivel' | 'carregando' | 'entrar' | 'enviando' | 'codigo' | 'verificando' | 'carteira' | 'falha';
type Lista<T> = { estado: 'carregando' | 'ok' | 'erro'; itens: T[]; proximo?: string | null; publicadas?: boolean; msg?: string };
/** Estado forçado — SÓ para a página interna de estados (/clube/estados/, build de revisão). Nada é enviado. */
export interface DemoMembro {
  etapa: EtapaMembro;
  telefone?: string;
  erro?: string;
  desafio?: DesafioCodigo;
  membro?: Membro;
  extrato?: Lista<Movimento>;
  recompensas?: Lista<Recompensas['itens'][number]>;
}
interface Props { modo: ModoClube; apiUrl?: string; ids?: string; demo?: DemoMembro }

const DIGITOS = 6;
const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const dataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const mesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const pts = new Intl.NumberFormat('pt-BR', { signDisplay: 'always' });

/** Prévia sem dados (indisponível e acesso): o lugar de cada coisa, sem número inventado. */
function Previa() {
  return (
    <section class="carteira-area carteira-area--previa" aria-labelledby="previa-titulo">
      <p class="carteira-area__kicker" id="previa-titulo">assim fica a sua carteira</p>
      <Carteira estado="vazia" class="carteira-area__cartao" />
      <div class="carteira-area__paineis">
        <section class="painel" aria-labelledby="previa-hist">
          <h2 class="painel__titulo" id="previa-hist">Histórico de pontos</h2>
          <p class="painel__vazio">Suas compras identificadas aparecem aqui, com data e pontos.</p>
        </section>
        <section class="painel" aria-labelledby="previa-rec">
          <h2 class="painel__titulo" id="previa-rec">Recompensas</h2>
          <p class="painel__vazio">As recompensas do Clube estão em definição e aparecem aqui quando forem publicadas.</p>
        </section>
      </div>
    </section>
  );
}

export default function ClubeMembro({ modo, apiUrl, ids: px = 'cm', demo }: Props) {
  const api: ClubeApi | null = useMemo(() => (!demo && modo === 'api' && apiUrl ? criarClubeHttp(apiUrl) : null), [modo, apiUrl]);
  const [etapa, setEtapa] = useState<EtapaMembro>(demo?.etapa ?? (api ? 'carregando' : 'indisponivel'));
  const [telefone, setTelefone] = useState(demo?.telefone ?? '');
  const [erro, setErro] = useState(demo?.erro ?? '');
  const [erroCodigo, setErroCodigo] = useState('');
  const [desafio, setDesafio] = useState<DesafioCodigo | null>(demo?.desafio ?? null);
  const [membro, setMembro] = useState<Membro | null>(demo?.membro ?? null);
  const [extrato, setExtrato] = useState<Lista<Movimento>>(demo?.extrato ?? { estado: 'carregando', itens: [] });
  const [recompensas, setRecompensas] = useState<Lista<Recompensas['itens'][number]>>(demo?.recompensas ?? { estado: 'carregando', itens: [] });
  const [salvandoMkt, setSalvandoMkt] = useState(false);
  const [erroMkt, setErroMkt] = useState('');
  const [anuncio, setAnuncio] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const topo = useRef<HTMLHeadingElement>(null);

  /** Erros de sessão em qualquer chamada levam de volta ao acesso. */
  const tratar = (e: unknown, padrao: string) => {
    const erro = e instanceof ErroClube ? e : new ErroClube('servidor', padrao);
    if (erro.tipo === 'sessao') { setMembro(null); setEtapa('entrar'); setErro(''); }
    return erro;
  };

  // Abrir: há sessão? (cookie do backend)
  useEffect(() => {
    if (!api) return;
    setEtapa('carregando');
    api.membro()
      .then((m) => { setMembro(m); setEtapa('carteira'); })
      .catch((e) => { const r = tratar(e, 'Não foi possível abrir a carteira.'); if (r.tipo !== 'sessao') { setErro(r.message); setEtapa('falha'); } });
  }, [api, tentativa]);
  // Carteira aberta: extrato e recompensas em paralelo, cada um com o próprio estado.
  useEffect(() => {
    if (!api || etapa !== 'carteira') return;
    setExtrato({ estado: 'carregando', itens: [] });
    api.extrato().then((x) => setExtrato({ estado: 'ok', itens: x.itens, proximo: x.proximo }))
      .catch((e) => { const r = tratar(e, 'Não foi possível carregar o histórico.'); setExtrato({ estado: 'erro', itens: [], msg: r.message }); });
    setRecompensas({ estado: 'carregando', itens: [] });
    api.recompensas().then((r) => setRecompensas({ estado: 'ok', itens: r.itens, publicadas: r.publicadas }))
      .catch((e) => { const r = tratar(e, 'Não foi possível carregar as recompensas.'); setRecompensas({ estado: 'erro', itens: [], msg: r.message }); });
  }, [api, etapa === 'carteira', tentativa]);
  const montou = useRef(false);
  useEffect(() => { if (!montou.current) { montou.current = true; return; } if (etapa === 'carteira' || etapa === 'codigo') topo.current?.focus(); }, [etapa]);

  const pedirCodigo = async (ev?: Event) => {
    ev?.preventDefault();
    if (!api) return;
    if (!telefoneValido(telefone)) { setErro('Confira o número com DDD (10 ou 11 dígitos).'); document.getElementById(`${px}-telefone`)?.focus(); return; }
    setEtapa(desafio ? 'verificando' : 'enviando'); setErro('');
    try {
      const d = await api.pedirCodigo(soDigitos(telefone));
      setDesafio(d); setErroCodigo(''); setEtapa('codigo'); setAnuncio(`Código enviado para ${d.destino}.`);
    } catch (e) {
      const r = tratar(e, 'Não foi possível enviar o código.');
      setErro(r.message); setEtapa(desafio ? 'codigo' : 'entrar'); setAnuncio(r.message);
    }
  };
  const confirmar = async (codigo: string) => {
    if (!api || !desafio) return;
    setEtapa('verificando'); setErroCodigo('');
    try {
      const m = await api.verificar(desafio.desafioId, codigo);
      setMembro(m); setDesafio(null); setEtapa('carteira'); setAnuncio(`Olá, ${m.nome.split(' ')[0]}. Sua carteira está aberta.`);
    } catch (e) {
      const r = tratar(e, 'Não foi possível confirmar. Tente de novo.');
      setEtapa('codigo'); setErroCodigo(r.tipo === 'validacao' ? (r.campos.codigo ?? 'Código incorreto. Confira e tente de novo.') : r.message);
    }
  };
  const maisExtrato = async () => {
    if (!api || !extrato.proximo) return;
    try {
      const x = await api.extrato(extrato.proximo);
      setExtrato((a) => ({ estado: 'ok', itens: [...a.itens, ...x.itens], proximo: x.proximo }));
    } catch (e) { const r = tratar(e, 'Não foi possível carregar mais.'); setAnuncio(r.message); }
  };
  const mudarMarketing = async (autorizado: boolean) => {
    if (!api || !membro) return;
    // o interruptor vira na hora; a resposta da API confirma o valor (ou ele volta ao anterior, com aviso)
    const antes = membro.marketing;
    setMembro({ ...membro, marketing: { autorizado } });
    setSalvandoMkt(true);
    try {
      const mk = await api.marketing(autorizado);
      setMembro((m) => (m ? { ...m, marketing: mk } : m));
      setAnuncio(mk.autorizado ? 'Novidades ligadas.' : 'Novidades desligadas.');
    } catch (e) {
      setMembro((m) => (m ? { ...m, marketing: antes } : m));
      const r = tratar(e, 'Não foi possível salvar.'); setErroMkt(r.message); setAnuncio(r.message);
    }
    setSalvandoMkt(false);
  };
  const sair = async () => {
    if (!api) return;
    try { await api.sair(); } catch { /* a sessão some do lado do servidor de qualquer forma ao expirar */ }
    setMembro(null); setTelefone(''); setEtapa('entrar'); setAnuncio('Você saiu da carteira.');
  };

  // ------------------------------------------------------------------------------------------------ carteira aberta
  if ((etapa === 'carteira') && membro) {
    const primeiro = membro.nome.split(' ')[0];
    return (
      <div class="membro" data-etapa={etapa}>
        <section class="carteira-area" aria-labelledby={`${px}-ola`}>
          <h2 class="carteira-area__ola" id={`${px}-ola`} ref={topo} tabIndex={-1}>Olá, {primeiro}</h2>
          <p class="carteira-area__kicker">membro desde {mesAno.format(new Date(`${membro.desde}T12:00:00`))}</p>
          <Carteira estado="membro" nome={membro.nome} numero={membro.numero} pontos={membro.saldo?.pontos ?? null} class="carteira-area__cartao" />
          <p class="carteira-area__meta">
            {membro.saldo ? `Saldo atualizado em ${dataHora.format(new Date(membro.saldo.atualizadoEm))}.` : 'Saldo em atualização. Volte daqui a pouco.'}
          </p>

          <div class="carteira-area__paineis">
            <section class="painel" aria-labelledby={`${px}-hist`} aria-busy={extrato.estado === 'carregando'}>
              <h2 class="painel__titulo" id={`${px}-hist`}>Histórico de pontos</h2>
              {extrato.estado === 'carregando' && <ul class="extrato extrato--esqueleto" aria-hidden="true">{[0, 1, 2].map(() => <li><span /><span /></li>)}</ul>}
              {extrato.estado === 'erro' && <p class="ticket__status" data-tone="error" role="alert">{extrato.msg} <button class="ticket__link" type="button" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button></p>}
              {extrato.estado === 'ok' && !extrato.itens.length && <p class="painel__vazio">Nenhuma compra identificada ainda. Quando houver, ela aparece aqui com a data e os pontos.</p>}
              {extrato.estado === 'ok' && extrato.itens.length > 0 && (
                <>
                  <ul class="extrato">
                    {extrato.itens.map((m) => (
                      <li data-tipo={m.tipo}>
                        <time dateTime={m.data}>{dataCurta.format(new Date(m.data))}</time>
                        <span class="extrato__desc">{m.descricao}</span>
                        <strong class="extrato__pts" data-sinal={m.pontos < 0 ? 'neg' : 'pos'}>{pts.format(m.pontos)}</strong>
                      </li>
                    ))}
                  </ul>
                  {extrato.proximo && <button class="ticket__link painel__mais" type="button" onClick={maisExtrato}>Ver mais</button>}
                </>
              )}
            </section>

            <section class="painel" aria-labelledby={`${px}-rec`} aria-busy={recompensas.estado === 'carregando'}>
              <h2 class="painel__titulo" id={`${px}-rec`}>Recompensas</h2>
              {recompensas.estado === 'carregando' && <ul class="extrato extrato--esqueleto" aria-hidden="true">{[0, 1].map(() => <li><span /><span /></li>)}</ul>}
              {recompensas.estado === 'erro' && <p class="ticket__status" data-tone="error" role="alert">{recompensas.msg} <button class="ticket__link" type="button" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button></p>}
              {recompensas.estado === 'ok' && (!recompensas.publicadas || !recompensas.itens.length) && (
                <p class="painel__vazio">As recompensas do Clube estão em definição e aparecem aqui quando forem publicadas.</p>
              )}
              {recompensas.estado === 'ok' && recompensas.publicadas && recompensas.itens.length > 0 && (
                <ul class="recompensas">
                  {recompensas.itens.map((r) => (
                    <li data-disponivel={r.disponivel ? '' : undefined}>
                      <div><p class="recompensas__nome">{r.nome}</p>{r.descricao && <p class="recompensas__desc">{r.descricao}</p>}</div>
                      <p class="recompensas__pts"><strong>{new Intl.NumberFormat('pt-BR').format(r.pontos)}</strong> pontos</p>
                      <span class="recompensas__estado">{r.disponivel ? 'disponível' : 'ainda não'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section class="painel" aria-labelledby={`${px}-pref`}>
              <h2 class="painel__titulo" id={`${px}-pref`}>Novidades e promoções</h2>
              <label class="interruptor">
                <input type="checkbox" role="switch" checked={membro.marketing.autorizado} disabled={!api} aria-busy={salvandoMkt}
                  onChange={(ev) => { if (!salvandoMkt) { setErroMkt(''); mudarMarketing((ev.currentTarget as HTMLInputElement).checked); } }} />
                <span>{membro.marketing.autorizado ? 'Você recebe novidades do Âmbar.' : 'Você não recebe novidades do Âmbar.'}</span>
              </label>
              {erroMkt && <p class="ticket__status" data-tone="error" role="alert">{erroMkt}</p>}
              <p class="painel__nota">Separado do Clube: ligar ou desligar não muda sua participação nem seus pontos.</p>
            </section>
          </div>

          <button class="ticket__link carteira-area__sair" type="button" onClick={sair} disabled={!api}>Sair da carteira</button>
        </section>
        <p class="visually-hidden" aria-live="polite">{anuncio}</p>
      </div>
    );
  }

  // ------------------------------------------------------------------------------------------------ acesso
  const desligado = etapa === 'indisponivel';
  const carimbo = etapa === 'falha' ? { estado: 'erro', texto: 'tente de novo' } : { estado: undefined, texto: desligado ? 'em breve' : etapa === 'carregando' ? 'abrindo' : 'acesso' };
  return (
    <div class="membro" data-etapa={etapa}>
      <form class="ticket ficha ficha--acesso" onSubmit={pedirCodigo} noValidate aria-describedby={`${px}-nota`} aria-busy={etapa === 'carregando' || etapa === 'enviando' || etapa === 'verificando'}>
        <div class="stamp ticket__stamp" data-state={carimbo.estado} aria-hidden="true">{carimbo.texto}</div>
        <h2 class="ticket__title" ref={topo} tabIndex={-1}>{etapa === 'codigo' || etapa === 'verificando' ? 'Confirme seu telefone' : 'Entrar na carteira'}</h2>

        {etapa === 'carregando' && (
          <div class="ficha__carregando" aria-hidden="true"><span class="chip chip--skeleton" /><span class="chip chip--skeleton" /></div>
        )}

        {(etapa === 'indisponivel' || etapa === 'entrar' || etapa === 'enviando') && (
          <fieldset class="ficha__dados" disabled={etapa !== 'entrar'}>
            <legend>seu número de membro</legend>
            <label class="field" data-invalid={erro ? '' : undefined}>
              <span class="field__label">Celular</span>
              <input id={`${px}-telefone`} class="field__input" type="tel" inputMode="tel" autocomplete="tel-national" placeholder="(00) 00000-0000"
                value={telefone} onInput={(ev) => { setTelefone(mascaraTel((ev.currentTarget as HTMLInputElement).value)); setErro(''); }}
                aria-invalid={!!erro} aria-describedby={`${px}-telefone-dica${erro ? ` ${px}-telefone-erro` : ''}`} />
              <span class="field__hint" id={`${px}-telefone-dica`}>Sem senha: enviamos um código para o número cadastrado no Clube.</span>
              <span class="field__error" id={`${px}-telefone-erro`} role={erro ? 'alert' : undefined}>{erro}</span>
            </label>
          </fieldset>
        )}
        {etapa === 'indisponivel' && <button class="btn btn--wine btn--block" type="button" disabled>Acesso em breve</button>}
        {etapa === 'entrar' && <button class="btn btn--wine btn--block" type="submit">Receber código</button>}
        {etapa === 'enviando' && <button class="btn btn--wine btn--block" type="button" disabled>Enviando…</button>}

        {(etapa === 'codigo' || etapa === 'verificando') && desafio && (
          <PassoCodigo px={px} desafio={desafio} digitos={DIGITOS} ocupado={etapa === 'verificando'} erro={erroCodigo || erro}
            aoConfirmar={confirmar} aoReenviar={() => pedirCodigo()}
            aoTrocarNumero={() => { setDesafio(null); setErro(''); setErroCodigo(''); setEtapa('entrar'); }} />
        )}

        {etapa === 'falha' && (
          <>
            <p class="ticket__status" data-tone="error" role="alert">{erro}</p>
            <button class="btn btn--wine btn--block" type="button" onClick={() => { setErro(''); setTentativa((t) => t + 1); }}>Tentar de novo</button>
          </>
        )}

        <p class="ticket__note" id={`${px}-nota`}>
          {etapa === 'indisponivel' && 'A carteira do Clube ainda não está ativa. Nada é enviado.'}
          {etapa === 'entrar' && <>Ainda não é do Clube? <a class="ficha__inline" href="/clube/#cadastro">Faça sua inscrição</a>.</>}
        </p>
        <p class="visually-hidden" aria-live="polite">{anuncio}</p>
      </form>
      {(etapa === 'indisponivel' || etapa === 'entrar') && <Previa />}
    </div>
  );
}
