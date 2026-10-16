/** @jsxImportSource preact */
// Comanda de reserva — ilha Preact (única parte com estado real do site).
// Modos:
//  - "indisponivel" (padrão): mostra a comanda, mas deixa claro que as reservas online ainda não estão ativas. Nada é enviado.
//  - "simulado": só para testes e demonstração interna, com aviso visível de simulação. Nada sai do navegador.
//  - "api": usa a API FastAPI (staging) segundo o contrato — só depois de o contrato ser validado.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { ErroReserva, type ReservaConfig, type ReservaCriada, type ReservasApi } from '../lib/api/contrato';
import { criarApiSimulada } from '../lib/api/simulado';
import { criarApiHttp } from '../lib/api/http';

type Modo = 'indisponivel' | 'simulado' | 'api';
interface Props {
  modo: Modo;
  apiUrl?: string;
  ambientes: { id: string; nome: string }[];
  privacidadeUrl: string;
}
type Etapa = 'escolha' | 'revisao' | 'enviando' | 'confirmada' | 'falha';
type Horarios = { estado: 'ocioso' | 'carregando' | 'ok' | 'vazio' | 'erro'; lista: { hora: string; disponivel: boolean }[]; msg?: string };
interface Dados { nome: string; telefone: string; email: string; observacoes: string; consentimento: boolean }

const DIAS_PADRAO = 10;
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const dataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const soDigitos = (s: string) => s.replace(/\D/g, '');
const mascaraTel = (s: string) => {
  const d = soDigitos(s).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function validar(d: Dados, exigeEmail: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.nome.trim().length < 2) e.nome = 'Diga como podemos chamar você.';
  const tel = soDigitos(d.telefone);
  if (tel.length < 10 || tel.length > 11) e.telefone = 'Confira o número com DDD (10 ou 11 dígitos).';
  if ((exigeEmail || d.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Confira o e-mail.';
  if (!d.consentimento) e.consentimento = 'Para reservar, é preciso concordar com o uso dos dados.';
  return e;
}

/** Grupo de chips com papel de radiogroup e setas do teclado. */
function Escolha<T extends string>(p: { rotulo: string; id: string; opcoes: { valor: T; texto: JSX.Element | string; desabilitado?: boolean }[]; valor: T | null; aoEscolher: (v: T) => void; datas?: boolean }) {
  const grupo = useRef<HTMLDivElement>(null);
  const ativos = p.opcoes.filter((o) => !o.desabilitado);
  const aoTeclar = (ev: KeyboardEvent) => {
    const passo = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
    if (!passo || !ativos.length) return;
    ev.preventDefault();
    const i = Math.max(0, ativos.findIndex((o) => o.valor === p.valor));
    const prox = ativos[(i + passo + ativos.length) % ativos.length];
    p.aoEscolher(prox.valor);
    requestAnimationFrame(() => grupo.current?.querySelector<HTMLElement>(`[data-valor="${prox.valor}"]`)?.focus());
  };
  return (
    <div ref={grupo} class={`chips${p.datas ? ' chips--dates' : ''}`} role="radiogroup" aria-labelledby={p.id} onKeyDown={aoTeclar}>
      {p.opcoes.map((o) => {
        const marcado = o.valor === p.valor;
        const foco = marcado || (!p.valor && o === ativos[0]);
        return (
          <button type="button" class="chip" role="radio" aria-checked={marcado} data-valor={o.valor}
            tabIndex={foco ? 0 : -1} disabled={o.desabilitado} onClick={() => p.aoEscolher(o.valor)}>{o.texto}</button>
        );
      })}
    </div>
  );
}

export default function ReservaFlow({ modo: modoPedido, apiUrl, ambientes, privacidadeUrl }: Props) {
  const api: ReservasApi | null = useMemo(() => {
    if (modoPedido === 'simulado') return criarApiSimulada();
    if (modoPedido === 'api' && apiUrl) return criarApiHttp(apiUrl);
    return null;
  }, [modoPedido, apiUrl]);
  const modo: Modo = api ? api.modo : 'indisponivel';

  const [cfg, setCfg] = useState<ReservaConfig>({ ambientes, pessoas: { min: 1, max: 20 }, antecedencia: { diasMax: DIAS_PADRAO }, exigeEmail: false });
  const [hoje, setHoje] = useState<Date | null>(null);
  const [ambiente, setAmbiente] = useState<string>(ambientes[0]?.id ?? '');
  const [pessoas, setPessoas] = useState(2);
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<Horarios>({ estado: 'ocioso', lista: [] });
  const [dados, setDados] = useState<Dados>({ nome: '', telefone: '', email: '', observacoes: '', consentimento: false });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [etapa, setEtapa] = useState<Etapa>('escolha');
  const [resultado, setResultado] = useState<ReservaCriada | null>(null);
  const [falha, setFalha] = useState<string>('');
  const [anuncio, setAnuncio] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const chave = useRef<string>(uuid());
  const topo = useRef<HTMLParagraphElement>(null);
  const passo4 = useRef<HTMLLegendElement>(null);

  // Datas só no navegador (o HTML estático foi gerado em outro dia).
  useEffect(() => { const d = new Date(); setHoje(d); setData(iso(d)); }, []);
  // Ambiente pedido por um “reservar aqui” (mesmo antes de a ilha carregar).
  useEffect(() => {
    const w = window as unknown as { __ambarAmbiente?: string };
    if (w.__ambarAmbiente) setAmbiente(w.__ambarAmbiente);
    const ouvir = (ev: Event) => { setAmbiente((ev as CustomEvent<string>).detail); setHora(null); };
    window.addEventListener('ambar:ambiente', ouvir);
    return () => window.removeEventListener('ambar:ambiente', ouvir);
  }, []);
  // Configuração vinda da API (ambientes, limites, antecedência).
  useEffect(() => {
    if (!api) return;
    api.config().then((c) => { setCfg(c); if (!c.ambientes.some((a) => a.id === ambiente)) setAmbiente(c.ambientes[0]?.id ?? ''); }).catch(() => {});
  }, [api]);
  // Horários: buscados a cada mudança de ambiente, pessoas ou data. Requisições antigas são canceladas.
  useEffect(() => {
    if (!api || !data || !ambiente) return;
    const ctrl = new AbortController();
    setHora(null);
    setHorarios({ estado: 'carregando', lista: [] });
    api.disponibilidade({ data, pessoas, ambienteId: ambiente }, ctrl.signal)
      .then((d) => {
        const livres = d.horarios.filter((h) => h.disponivel).length;
        setHorarios({ estado: livres ? 'ok' : 'vazio', lista: d.horarios });
        setAnuncio(livres ? `${livres} horários disponíveis.` : 'Sem horários nesta data.');
      })
      .catch((e) => { if (e?.name !== 'AbortError') setHorarios({ estado: 'erro', lista: [], msg: e instanceof ErroReserva ? e.message : 'Não foi possível carregar os horários.' }); });
    return () => ctrl.abort();
  }, [api, data, pessoas, ambiente, tentativa]);
  // Foco no topo da comanda a cada troca de etapa (leitor de tela e teclado).
  useEffect(() => { if (etapa !== 'escolha') topo.current?.focus(); }, [etapa]);

  const datas = useMemo(() => {
    if (!hoje) return [];
    return Array.from({ length: cfg.antecedencia.diasMax }, (_, i) => { const d = new Date(hoje); d.setDate(hoje.getDate() + i); return d; });
  }, [hoje, cfg.antecedencia.diasMax]);

  const nomeAmbiente = cfg.ambientes.find((a) => a.id === ambiente)?.nome ?? ambiente;
  const dataTexto = data ? dataLonga.format(new Date(`${data}T12:00:00`)) : '';
  const mudarDado = (campo: keyof Dados) => (ev: Event) => {
    const alvo = ev.currentTarget as HTMLInputElement;
    const valor = campo === 'consentimento' ? alvo.checked : campo === 'telefone' ? mascaraTel(alvo.value) : alvo.value;
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((e) => { const n = { ...e }; delete n[campo]; return n; });
  };

  const continuar = (ev: Event) => {
    ev.preventDefault();
    if (!api) return;
    if (etapa === 'revisao' || etapa === 'falha') { enviar(); return; }
    if (!hora) { setAnuncio('Escolha um horário.'); passo4.current?.scrollIntoView({ block: 'center' }); return; }
    const e = validar(dados, cfg.exigeEmail);
    setErros(e);
    if (Object.keys(e).length) {
      setAnuncio('Confira os campos destacados.');
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`#rf-${Object.keys(e)[0]}`)?.focus());
      return;
    }
    chave.current = uuid();
    setEtapa('revisao');
  };

  const enviar = async () => {
    if (!api || !data || !hora) return;
    setEtapa('enviando');
    setAnuncio('Enviando a reserva…');
    try {
      const r = await api.criar({
        ambienteId: ambiente, pessoas, data, hora,
        nome: dados.nome.trim(), telefone: soDigitos(dados.telefone),
        email: dados.email.trim() || undefined, observacoes: dados.observacoes.trim() || undefined,
        consentimentoPrivacidade: true, origem: 'site',
      }, chave.current);
      setResultado(r);
      setEtapa('confirmada');
      setAnuncio(`Reserva ${r.status === 'confirmada' ? 'confirmada' : 'recebida'}. Código ${r.codigo}.`);
    } catch (e) {
      const erro = e instanceof ErroReserva ? e : new ErroReserva('servidor', 'Não foi possível concluir. Tente de novo em instantes.');
      if (erro.tipo === 'conflito') { setEtapa('escolha'); setHora(null); setTentativa((t) => t + 1); setAnuncio(erro.message); setFalha(erro.message); return; }
      if (erro.tipo === 'validacao' && Object.keys(erro.campos).length) { setErros(erro.campos); setEtapa('escolha'); setAnuncio(erro.message); return; }
      setFalha(erro.message);
      setEtapa('falha');
      setAnuncio(erro.message);
    }
  };

  const agenda = () => {
    if (!resultado) return '#';
    const [y, m, d] = resultado.data.split('-'); const [h, min] = resultado.hora.split(':');
    const inicio = `${y}${m}${d}T${h}${min}00`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ambar Brunch//Reserva//PT', 'BEGIN:VEVENT', `UID:${resultado.codigo}@ambarbrunch`,
      `DTSTART:${inicio}`, 'DURATION:PT1H30M', `SUMMARY:Reserva no Âmbar Brunch (${resultado.pessoas} pessoas)`,
      `DESCRIPTION:Código ${resultado.codigo} · ${nomeAmbiente}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  };

  const carimbo = etapa === 'confirmada'
    ? { estado: 'reservado', texto: modo === 'simulado' ? 'simulado' : 'reservado' }
    : etapa === 'falha' ? { estado: 'erro', texto: 'tente de novo' }
    : { estado: undefined, texto: modo === 'indisponivel' ? 'em breve' : modo === 'simulado' ? 'simulação' : 'prévia' };

  const resumo = (
    <dl class="ticket__review">
      <div><dt>Ambiente</dt><dd>{nomeAmbiente}</dd></div>
      <div><dt>Pessoas</dt><dd>{pessoas}</dd></div>
      <div><dt>Data</dt><dd>{dataTexto}</dd></div>
      <div><dt>Horário</dt><dd>{hora}</dd></div>
      {etapa !== 'confirmada' && <div><dt>Nome</dt><dd>{dados.nome}</dd></div>}
      {etapa !== 'confirmada' && <div><dt>Telefone</dt><dd>{dados.telefone}</dd></div>}
    </dl>
  );

  return (
    <form class="ticket" data-modo={modo} data-etapa={etapa} onSubmit={continuar} noValidate aria-describedby="ticket-note" aria-busy={etapa === 'enviando'}>
      <div class="stamp ticket__stamp" data-state={carimbo.estado} aria-hidden="true">{carimbo.texto}</div>
      <p class="ticket__title" ref={topo} tabIndex={-1}>
        {etapa === 'confirmada' ? (modo === 'simulado' ? 'Reserva simulada' : 'Mesa reservada') : etapa === 'escolha' ? 'Comanda de reserva' : 'Confira sua reserva'}
      </p>
      {modo === 'simulado' && <p class="ticket__sim" role="note">Simulação para testes — nenhuma reserva é feita e nada é enviado.</p>}

      {etapa === 'escolha' && (
        <>
          {falha && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
          <fieldset>
            <legend id="rf-l1" data-done={api && ambiente ? '' : undefined}>01 · ambiente</legend>
            <Escolha id="rf-l1" rotulo="Ambiente" valor={ambiente}
              opcoes={cfg.ambientes.map((a) => ({ valor: a.id, texto: a.nome }))}
              aoEscolher={(v) => { setAmbiente(v); setFalha(''); }} />
          </fieldset>
          <fieldset>
            <legend id="rf-l2" data-done={api ? '' : undefined}>02 · pessoas</legend>
            <div class="stepper">
              <button type="button" aria-label="Menos uma pessoa" disabled={pessoas <= cfg.pessoas.min} onClick={() => setPessoas((n) => Math.max(cfg.pessoas.min, n - 1))}>−</button>
              <output aria-live="polite" aria-labelledby="rf-l2">{pessoas}</output>
              <button type="button" aria-label="Mais uma pessoa" disabled={pessoas >= cfg.pessoas.max} onClick={() => setPessoas((n) => Math.min(cfg.pessoas.max, n + 1))}>+</button>
            </div>
            {pessoas >= cfg.pessoas.max && api && <p class="ticket__slots" style="margin-top:10px">Para grupos maiores, fale direto com o Âmbar.</p>}
          </fieldset>
          <fieldset>
            <legend id="rf-l3" data-done={api && data ? '' : undefined}>03 · data</legend>
            {datas.length
              ? <Escolha id="rf-l3" rotulo="Data" datas valor={data}
                  opcoes={datas.map((d, i) => ({ valor: iso(d), texto: <><small>{i === 0 ? 'hoje' : diaSemana.format(d).replace('.', '')}</small>{d.getDate()}</> }))}
                  aoEscolher={(v) => { setData(v); setFalha(''); }} />
              : <div class="chips chips--dates" aria-hidden="true">{Array.from({ length: 6 }, () => <span class="chip chip--skeleton" />)}</div>}
          </fieldset>
          <fieldset>
            <legend id="rf-l4" ref={passo4} data-done={hora ? '' : undefined}>04 · horário</legend>
            {!api && <p class="ticket__slots">Os horários aparecem aqui quando as reservas pelo site forem ativadas.</p>}
            {api && horarios.estado === 'carregando' && <><div class="chips" aria-hidden="true">{[0, 1, 2, 3].map(() => <span class="chip chip--skeleton" />)}</div><p class="ticket__slots" style="margin-top:10px">Carregando horários…</p></>}
            {api && horarios.estado === 'vazio' && <p class="ticket__slots">Sem horários nesta data. Escolha outro dia.</p>}
            {api && horarios.estado === 'erro' && <p class="ticket__status" data-tone="error" role="alert">{horarios.msg} <button type="button" class="ticket__link" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button></p>}
            {api && horarios.estado === 'ok' && (
              <Escolha id="rf-l4" rotulo="Horário" valor={hora}
                opcoes={horarios.lista.map((h) => ({ valor: h.hora, texto: h.hora, desabilitado: !h.disponivel }))}
                aoEscolher={(v) => { setHora(v); setFalha(''); }} />
            )}
          </fieldset>
          {api && hora && (
            <fieldset class="ticket__dados">
              <legend>05 · seus dados</legend>
              <div class="ticket__fields">
                <label class="field" data-invalid={erros.nome ? '' : undefined}>
                  <span class="field__label">Nome</span>
                  <input id="rf-nome" class="field__input" autocomplete="name" value={dados.nome} onInput={mudarDado('nome')} aria-invalid={!!erros.nome} aria-describedby={erros.nome ? 'rf-nome-erro' : undefined} />
                  <span class="field__error" id="rf-nome-erro">{erros.nome}</span>
                </label>
                <label class="field" data-invalid={erros.telefone ? '' : undefined}>
                  <span class="field__label">WhatsApp ou telefone</span>
                  <input id="rf-telefone" class="field__input" type="tel" inputMode="tel" autocomplete="tel-national" placeholder="(00) 00000-0000" value={dados.telefone} onInput={mudarDado('telefone')} aria-invalid={!!erros.telefone} aria-describedby={erros.telefone ? 'rf-telefone-erro' : undefined} />
                  <span class="field__error" id="rf-telefone-erro">{erros.telefone}</span>
                </label>
                <label class="field" data-invalid={erros.email ? '' : undefined}>
                  <span class="field__label">E-mail {!cfg.exigeEmail && <small>(opcional)</small>}</span>
                  <input id="rf-email" class="field__input" type="email" inputMode="email" autocomplete="email" value={dados.email} onInput={mudarDado('email')} aria-invalid={!!erros.email} aria-describedby={erros.email ? 'rf-email-erro' : undefined} />
                  <span class="field__error" id="rf-email-erro">{erros.email}</span>
                </label>
                <label class="field">
                  <span class="field__label">Observações <small>(opcional)</small></span>
                  <textarea id="rf-observacoes" class="field__input" rows={3} maxLength={300} value={dados.observacoes} onInput={mudarDado('observacoes')} placeholder="Aniversário, cadeirinha, restrição alimentar…" />
                </label>
                <label class="check" data-invalid={erros.consentimento ? '' : undefined}>
                  <input id="rf-consentimento" type="checkbox" checked={dados.consentimento} onChange={mudarDado('consentimento')} aria-invalid={!!erros.consentimento} aria-describedby="rf-consentimento-erro" />
                  <span>Concordo com o uso dos meus dados para esta reserva, conforme a <a href={privacidadeUrl}>política de privacidade</a>.</span>
                </label>
                {erros.consentimento && <span class="field__error" id="rf-consentimento-erro" style="display:block">{erros.consentimento}</span>}
              </div>
            </fieldset>
          )}
          {api
            ? <button class="btn btn--wine btn--block" type="submit">Continuar</button>
            : <button class="btn btn--wine btn--block" type="button" disabled>Reservas online em breve</button>}
        </>
      )}

      {(etapa === 'revisao' || etapa === 'enviando' || etapa === 'falha') && (
        <>
          {resumo}
          {etapa === 'falha' && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
          <div class="ticket__actions">
            <button class="btn btn--wine btn--block" type="submit" disabled={etapa === 'enviando'}>
              {etapa === 'enviando' ? 'Enviando…' : etapa === 'falha' ? 'Tentar de novo' : 'Confirmar reserva'}
            </button>
            <button class="ticket__link" type="button" disabled={etapa === 'enviando'} onClick={() => { setEtapa('escolha'); setFalha(''); }}>Editar</button>
          </div>
        </>
      )}

      {etapa === 'confirmada' && resultado && (
        <>
          <p class="ticket__status" role="status">
            {resultado.status === 'confirmada' ? 'Tudo certo! ' : 'Recebemos seu pedido. O Âmbar confirma em seguida. '}
            Código <strong class="ticket__code">{resultado.codigo}</strong>
          </p>
          {resumo}
          <div class="ticket__actions">
            <a class="btn btn--wine btn--block" href={agenda()} download={`reserva-ambar-${resultado.codigo}.ics`}>Adicionar à agenda</a>
            <button class="ticket__link" type="button" onClick={() => { setResultado(null); setHora(null); setEtapa('escolha'); setTentativa((t) => t + 1); }}>Fazer outra reserva</button>
          </div>
        </>
      )}

      <p class="ticket__note" id="ticket-note">
        {modo === 'indisponivel' && 'As reservas pelo site ainda não estão ativas. Nada é enviado.'}
        {modo === 'simulado' && 'Simulação: nenhum dado sai deste navegador.'}
        {modo === 'api' && etapa === 'escolha' && 'Você confere tudo antes de confirmar.'}
      </p>
      <p class="visually-hidden" aria-live="polite">{anuncio}</p>
    </form>
  );
}
