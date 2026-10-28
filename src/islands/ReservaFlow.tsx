/** @jsxImportSource preact */
// Comanda de reserva — ilha Preact (única parte com estado real do site).
// Modos:
//  - "indisponivel" (padrão): mostra a comanda, mas deixa claro que as reservas online ainda não estão ativas. Nada é enviado.
//  - "simulado": só para testes e demonstração interna, com aviso visível de simulação. Nada sai do navegador.
//  - "api" (produção): a API do Âmbar é a fonte de tudo — ambientes, limites, janela de 60 dias, dias fechados (inclusive
//    os anteriores à abertura, AMBAR_RESERVAS_ABERTURA) e horários. Reservas fechadas na API (503 reservas_indisponiveis):
//    a comanda diz isso, sem datas nem horários, e confere de novo quando a pessoa volta à aba.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { ErroReserva, type ReservaConfig, type ReservaCriada, type ReservasApi } from '../lib/api/contrato';
import { criarApiSimulada } from '../lib/api/simulado';
import { criarApiHttp } from '../lib/api/http';
import { visita } from '../data/visita';
import { conferirTelefone, mascaraTel, telefoneNacional, uuid } from '../lib/telefone';

type Modo = 'indisponivel' | 'simulado' | 'api';
export type Etapa = 'escolha' | 'revisao' | 'enviando' | 'confirmada' | 'falha';
type Horarios = { estado: 'ocioso' | 'carregando' | 'ok' | 'vazio' | 'erro'; lista: { hora: string; disponivel: boolean }[]; msg?: string };
interface Dados { nome: string; telefone: string; email: string; observacoes: string; consentimento: boolean }
/**
 * Estado inicial forçado — SÓ para a página interna /design-system/ (nunca no site): mostra cada etapa da comanda
 * com a API simulada (o aviso de simulação aparece). Sem esta prop, o comportamento é o de sempre.
 */
export interface DemoComanda {
  etapa?: Etapa;
  horarios?: Exclude<Horarios['estado'], 'ocioso'>;
  hora?: string;
  dados?: Partial<Dados>;
  erros?: Record<string, string>;
  falha?: string;
  resultado?: ReservaCriada;
}
interface Props {
  modo: Modo;
  apiUrl?: string;
  ambientes: { id: string; nome: string }[];
  privacidadeUrl: string;
  /** prefixo dos ids (várias comandas na mesma página) */
  ids?: string;
  demo?: DemoComanda;
}
const HORAS_DEMO = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map((hora, i) => ({ hora, disponivel: i % 3 !== 1 }));
function horariosDemo(estado: DemoComanda['horarios']): Horarios {
  if (estado === 'ok') return { estado, lista: HORAS_DEMO };
  if (estado === 'erro') return { estado, lista: [], msg: 'Não foi possível carregar os horários.' };
  return { estado: estado ?? 'ocioso', lista: [] };
}

/** Janela de datas sem API: dois meses à frente (calendário mensal; a API define a dela em config()). */
const DIAS_PADRAO = 60;
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
/** “Hoje” no fuso do restaurante (config.fusoHorario), não no do navegador: quem abre o site à noite noutro fuso
 *  não pode ver liberado um dia que em Fortaleza já passou (nem perder o dia que lá ainda é hoje). */
function hojeNoFuso(fuso?: string): Date {
  const agora = new Date();
  if (!fuso) return agora;
  try {
    const [a, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(agora).split('-').map(Number);
    return new Date(a, m - 1, d);
  } catch {
    return agora;
  }
}
function validar(d: Dados, exigeEmail: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.nome.trim().length < 2) e.nome = 'Diga como podemos chamar você.';
  // as regras do backend (lib/telefone.ts): celular sem o nono dígito é recusado com a explicação, nunca completado
  const tel = conferirTelefone(d.telefone);
  if (!tel.ok) e.telefone = tel.mensagem;
  if (exigeEmail && !d.email.trim()) e.email = 'Informe o e-mail.';
  else if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Confira o e-mail.';
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

/**
 * Calendário mensal da comanda (rodada final: substitui a fileira de 10 dias). Dias fora da janela [hoje, hoje + diasMax]
 * (a mesma da API: hoje + 60 dias inclusive) e dias fechados do ambiente (`fechadas`, vindos da API) ficam riscados; setas trocam o mês; no teclado, ←/→ andam um dia e ↑/↓ uma semana (radiogroup, um dia focável).
 */
function Calendario(p: { id: string; hoje: Date; diasMax: number; fechadas?: ReadonlySet<string>; valor: string | null; aoEscolher: (v: string) => void; aoConfirmar?: () => void }) {
  const inicio = new Date(p.hoje.getFullYear(), p.hoje.getMonth(), p.hoje.getDate());
  const fim = new Date(inicio); fim.setDate(inicio.getDate() + p.diasMax);
  const [mes, setMes] = useState(() => { const v = p.valor ? new Date(`${p.valor}T12:00:00`) : inicio; return new Date(v.getFullYear(), v.getMonth(), 1); });
  const grade = useRef<HTMLDivElement>(null);
  const primeiroMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const ultimoMes = new Date(fim.getFullYear(), fim.getMonth(), 1);
  const valido = (d: Date) => d >= inicio && d <= fim && !p.fechadas?.has(iso(d));
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1));
  const selecionado = p.valor && dias.some((d) => iso(d) === p.valor) ? p.valor : null;
  const focavel = selecionado ?? iso(dias.find(valido) ?? dias[0]);
  const mudarMes = (passo: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + passo, 1));
  const aoTeclar = (ev: KeyboardEvent) => {
    const passo = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 } as Record<string, number>)[ev.key];
    if (!passo) return;
    ev.preventDefault();
    const atual = new Date(`${(ev.target as HTMLElement).dataset.valor ?? focavel}T12:00:00`);
    const prox = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate() + passo);
    if (!valido(prox)) return;
    p.aoEscolher(iso(prox));
    if (prox.getMonth() !== mes.getMonth()) setMes(new Date(prox.getFullYear(), prox.getMonth(), 1));
    requestAnimationFrame(() => grade.current?.querySelector<HTMLElement>(`[data-valor="${iso(prox)}"]`)?.focus());
  };
  return (
    <div class="cal">
      <div class="cal__head">
        <button type="button" class="cal__nav" aria-label="Mês anterior" disabled={mes <= primeiroMes} onClick={() => mudarMes(-1)}><span aria-hidden="true">‹</span></button>
        <p class="cal__mes" aria-live="polite">{mesAno.format(mes)}</p>
        <button type="button" class="cal__nav" aria-label="Próximo mês" disabled={mes >= ultimoMes} onClick={() => mudarMes(1)}><span aria-hidden="true">›</span></button>
      </div>
      <div class="cal__semana" aria-hidden="true">{SEMANA.map((d) => <span>{d}</span>)}</div>
      <div class="cal__grade" role="radiogroup" aria-labelledby={p.id} ref={grade} onKeyDown={aoTeclar}>
        {Array.from({ length: mes.getDay() }, () => <span class="cal__vazio" aria-hidden="true" />)}
        {dias.map((d) => {
          const v = iso(d);
          const ok = valido(d);
          return (
            <button type="button" role="radio" class="cal__dia" data-valor={v} aria-checked={v === p.valor} tabIndex={v === focavel && ok ? 0 : -1}
              disabled={!ok} data-hoje={v === iso(inicio) ? '' : undefined}
              aria-label={`${v === iso(inicio) ? 'hoje, ' : ''}${SEMANA_LONGA[d.getDay()]}, ${d.getDate()}`}
              onClick={() => { p.aoEscolher(v); p.aoConfirmar?.(); }}>{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function ReservaFlow({ modo: modoPedido, apiUrl, ambientes, privacidadeUrl, ids: px = 'rf', demo }: Props) {
  const nota = px === 'rf' ? 'ticket-note' : `${px}-note`;
  const api: ReservasApi | null = useMemo(() => {
    if (demo || modoPedido === 'simulado') return criarApiSimulada();
    if (modoPedido === 'api' && apiUrl) return criarApiHttp(apiUrl);
    return null;
  }, [modoPedido, apiUrl]);
  const modo: Modo = api ? api.modo : 'indisponivel';
  /** Na API real, calendário e horários só existem com a configuração vinda dela (ambientes, janela, dias fechados —
   *  inclusive os dias antes da abertura). Até lá, nada de janela padrão: nenhuma data ou horário é oferecido por conta
   *  própria. `fechado` = a API respondeu que as reservas online estão fechadas (503 reservas_indisponiveis). */
  const precisaCfg = modo === 'api' && !demo;
  const [estadoCfg, setEstadoCfg] = useState<'carregando' | 'ok' | 'fechado' | 'erro'>(precisaCfg ? 'carregando' : 'ok');
  const [cfgTentativa, setCfgTentativa] = useState(0);
  const pronto = estadoCfg === 'ok';
  /** Um envio por vez: o clique duplo não manda dois pedidos (a mesma Idempotency-Key já protege no servidor). */
  const enviandoAgora = useRef(false);

  const [cfg, setCfg] = useState<ReservaConfig>({ ambientes, pessoas: { min: 1, max: 20 }, antecedencia: { diasMax: DIAS_PADRAO }, exigeEmail: false });
  const [hoje, setHoje] = useState<Date | null>(null);
  const [ambiente, setAmbiente] = useState<string>(ambientes[0]?.id ?? '');
  /** ambiente que veio da seção “Escolha seu lugar”: o chip dele acende por um instante quando a comanda aparece */
  const [destaque, setDestaque] = useState(0);
  const [pessoas, setPessoas] = useState(2);
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(demo?.hora ?? null);
  const [horarios, setHorarios] = useState<Horarios>(horariosDemo(demo?.horarios));
  const [dados, setDados] = useState<Dados>({ nome: '', telefone: '', email: '', observacoes: '', consentimento: false, ...demo?.dados });
  const [erros, setErros] = useState<Record<string, string>>(demo?.erros ?? {});
  const [etapa, setEtapa] = useState<Etapa>(demo?.etapa ?? 'escolha');
  const [resultado, setResultado] = useState<ReservaCriada | null>(demo?.resultado ?? null);
  const [falha, setFalha] = useState<string>(demo?.falha ?? '');
  const [anuncio, setAnuncio] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const chave = useRef<string>(uuid());
  const topo = useRef<HTMLParagraphElement>(null);
  const passo4 = useRef<HTMLLegendElement>(null);
  // Campo de data (celular): o calendário começa fechado e abre dentro da comanda; um toque num dia escolhe e fecha.
  // No desktop (≥ 960 px) o calendário fica sempre aberto e o campo some (CSS: .data-campo / .data-painel).
  const [calAberto, setCalAberto] = useState(false);
  const campoData = useRef<HTMLButtonElement>(null);
  const fecharCal = () => {
    setCalAberto(false);
    const campo = campoData.current;
    if (campo && campo.offsetParent) requestAnimationFrame(() => campo.focus());
  };

  const amb = cfg.ambientes.find((a) => a.id === ambiente);
  const nomeAmbiente = amb?.nome ?? ambiente;
  /** Limites de UMA reserva online no ambiente escolhido (a lotação é capacidadeMax, conferida pela API). */
  const minPessoas = amb?.pessoasMin ?? cfg.pessoas.min;
  const maxPessoas = amb?.pessoasMax ?? cfg.pessoas.max;
  /** Dias sem nenhum horário neste ambiente (dia fechado, feriado, evento), segundo a API. */
  const fechadas = useMemo(() => new Set(amb?.datasFechadas ?? []), [amb]);
  /** Acima do máximo online: atendimento de grupos (a equipe lança pelo painel). */
  const grupo = pessoas > maxPessoas;
  const linkEquipe = `${visita.whatsapp.url}?text=${encodeURIComponent('Olá! Quero reservar uma mesa no Âmbar.')}`;
  const linkGrupo = `${visita.whatsapp.url}?text=${encodeURIComponent(`Olá! Quero reservar para um grupo de mais de ${maxPessoas} pessoas (${nomeAmbiente}).`)}`;

  // Datas só no navegador (o HTML estático foi gerado em outro dia). Nenhuma data vem escolhida (2026-10-22): o campo
  // começa em “Escolher uma data” e os horários só são buscados depois da escolha.
  // Os estados de demonstração (/design-system/) continuam com hoje marcado, para mostrar horários e revisão completos.
  useEffect(() => { const d = hojeNoFuso(cfg.fusoHorario); setHoje(d); if (demo) setData(iso(d)); }, [cfg.fusoHorario]);
  // Ambiente pedido por um “reservar aqui” (mesmo antes de a ilha carregar).
  useEffect(() => {
    const w = window as unknown as { __ambarAmbiente?: string };
    if (w.__ambarAmbiente) { setAmbiente(w.__ambarAmbiente); setDestaque((n) => n + 1); }
    const ouvir = (ev: Event) => { setAmbiente((ev as CustomEvent<string>).detail); setHora(null); setDestaque((n) => n + 1); };
    window.addEventListener('ambar:ambiente', ouvir);
    return () => window.removeEventListener('ambar:ambiente', ouvir);
  }, []);
  // Configuração vinda da API (ambientes, limites, antecedência, dias fechados). Fechada ou com erro, a comanda diz isso
  // e confere de novo quando a pessoa volta para a aba — abrir as reservas no backend não exige novo build do site.
  useEffect(() => {
    if (!api) return;
    let vivo = true;
    if (precisaCfg) setEstadoCfg('carregando');
    api.config()
      .then((c) => {
        if (!vivo) return;
        setCfg(c);
        setEstadoCfg('ok');
        setAmbiente((atual) => (c.ambientes.some((a) => a.id === atual) ? atual : c.ambientes[0]?.id ?? ''));
      })
      .catch((e) => { if (vivo && precisaCfg) setEstadoCfg(e instanceof ErroReserva && e.tipo === 'fechado' ? 'fechado' : 'erro'); });
    return () => { vivo = false; };
  }, [api, cfgTentativa]);
  useEffect(() => {
    if (estadoCfg !== 'fechado' && estadoCfg !== 'erro') return;
    const conferir = () => { if (document.visibilityState === 'visible') setCfgTentativa((t) => t + 1); };
    document.addEventListener('visibilitychange', conferir);
    return () => document.removeEventListener('visibilitychange', conferir);
  }, [estadoCfg]);
  // Ao trocar de ambiente, o número de pessoas entra na faixa dele (o grupo continua grupo).
  useEffect(() => { setPessoas((n) => (n < minPessoas ? minPessoas : n > maxPessoas + 1 ? maxPessoas + 1 : n)); }, [minPessoas, maxPessoas]);
  // A data escolhida deixou de valer (outro ambiente fechado nesse dia): volta a “Escolher uma data”.
  useEffect(() => { if (data && fechadas.has(data)) { setData(null); setHora(null); } }, [fechadas, data]);
  // Horários: buscados a cada mudança de ambiente, pessoas ou data. Requisições antigas são canceladas.
  useEffect(() => {
    if (!api || !pronto || !data || !ambiente || demo?.horarios) return;
    if (pessoas < minPessoas || pessoas > maxPessoas) { setHora(null); setHorarios({ estado: 'ocioso', lista: [] }); return; }
    const ctrl = new AbortController();
    setHora(null);
    setHorarios({ estado: 'carregando', lista: [] });
    api.disponibilidade({ data, pessoas, ambienteId: ambiente }, ctrl.signal)
      .then((d) => {
        const livres = d.horarios.filter((h) => h.disponivel).length;
        setHorarios({ estado: livres ? 'ok' : 'vazio', lista: d.horarios });
        setAnuncio(livres ? `${livres} horários disponíveis.` : 'Sem horários nesta data.');
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        if (e instanceof ErroReserva && e.tipo === 'fechado') { setEstadoCfg('fechado'); return; }
        setHorarios({ estado: 'erro', lista: [], msg: e instanceof ErroReserva ? e.message : 'Não foi possível carregar os horários.' });
      });
    return () => ctrl.abort();
  }, [api, pronto, data, pessoas, ambiente, tentativa, minPessoas, maxPessoas]);
  // Foco no topo da comanda a cada TROCA de etapa (leitor de tela e teclado); não na montagem.
  const montou = useRef(false);
  useEffect(() => { if (!montou.current) { montou.current = true; return; } if (etapa !== 'escolha') topo.current?.focus(); }, [etapa]);

  const dataTexto = data ? dataLonga.format(new Date(`${data}T12:00:00`)) : '';
  const mudarDado = (campo: keyof Dados) => (ev: Event) => {
    const alvo = ev.currentTarget as HTMLInputElement;
    const valor = campo === 'consentimento' ? alvo.checked : campo === 'telefone' ? mascaraTel(alvo.value) : alvo.value;
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((e) => { const n = { ...e }; delete n[campo]; return n; });
  };

  const continuar = (ev: Event) => {
    ev.preventDefault();
    if (!api || grupo) return;
    if (etapa === 'revisao' || etapa === 'falha') { enviar(); return; }
    if (!hora) { setAnuncio('Escolha um horário.'); passo4.current?.scrollIntoView({ block: 'center' }); return; }
    const e = validar(dados, cfg.exigeEmail);
    setErros(e);
    if (Object.keys(e).length) {
      setAnuncio('Confira os campos destacados.');
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${px}-${Object.keys(e)[0]}`)?.focus());
      return;
    }
    chave.current = uuid();
    setEtapa('revisao');
  };

  const enviar = async () => {
    if (!api || !data || !hora || enviandoAgora.current) return;
    enviandoAgora.current = true;
    setEtapa('enviando');
    setAnuncio('Enviando a reserva…');
    try {
      const r = await api.criar({
        ambienteId: ambiente, pessoas, data, hora,
        nome: dados.nome.trim(), telefone: telefoneNacional(dados.telefone),
        email: dados.email.trim() || undefined, observacoes: dados.observacoes.trim() || undefined,
        consentimentoPrivacidade: true, origem: 'site',
      }, chave.current);
      setResultado(r);
      setEtapa('confirmada');
      setAnuncio(`Reserva ${r.status === 'confirmada' ? 'confirmada' : 'recebida'}. Código ${r.codigo}.`);
    } catch (e) {
      const erro = e instanceof ErroReserva ? e : new ErroReserva('servidor', 'Não foi possível concluir. Tente de novo em instantes.');
      // As reservas foram fechadas enquanto a pessoa preenchia: nada foi registrado; a comanda passa ao estado fechado.
      if (erro.tipo === 'fechado') { setEtapa('escolha'); setHora(null); setEstadoCfg('fechado'); setAnuncio(erro.message); return; }
      if (erro.tipo === 'conflito') { setEtapa('escolha'); setHora(null); setTentativa((t) => t + 1); setAnuncio(erro.message); setFalha(erro.message); return; }
      if (erro.tipo === 'validacao' && Object.keys(erro.campos).length) {
        // Erro de um campo que não fica no formulário de dados (pessoas, data, hora…): mostrar no topo da comanda.
        const foraDosDados = ['pessoas', 'data', 'hora', 'ambienteId'].map((c) => erro.campos[c]).find(Boolean);
        setErros(erro.campos); setEtapa('escolha'); setFalha(foraDosDados ?? ''); setAnuncio(foraDosDados ?? erro.message);
        // Data ou horário recusados na confirmação (o prazo de 2 h passou, a agenda mudou): a lista mostrada ficou velha.
        if (erro.campos.data || erro.campos.hora) { setHora(null); setTentativa((t) => t + 1); }
        return;
      }
      setFalha(erro.message);
      setEtapa('falha');
      setAnuncio(erro.message);
    } finally {
      enviandoAgora.current = false;
    }
  };

  const agenda = () => {
    if (!resultado) return '#';
    const [y, m, d] = resultado.data.split('-'); const [h, min] = resultado.hora.split(':');
    const inicio = `${y}${m}${d}T${h}${min}00`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ambar Brunch//Reserva//PT', 'BEGIN:VEVENT', `UID:${resultado.codigo}@ambarbrunch`,
      `DTSTART:${inicio}`, `DURATION:PT${resultado.duracaoMin ?? 180}M`, `SUMMARY:Reserva no Âmbar Brunch (${resultado.pessoas} pessoas)`,
      `DESCRIPTION:Código ${resultado.codigo} · ${nomeAmbiente}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  };

  const carimbo = etapa === 'confirmada'
    ? { estado: 'reservado', texto: modo === 'simulado' ? 'simulado' : 'reservado' }
    : etapa === 'falha' ? { estado: 'erro', texto: 'tente de novo' }
    : { estado: undefined, texto: modo === 'indisponivel' || estadoCfg === 'fechado' ? 'em breve' : modo === 'simulado' ? 'simulação' : 'reserva' };

  const resumo = (
    <dl class="ticket__review">
      <div><dt>Ambiente</dt><dd>{nomeAmbiente}</dd></div>
      <div><dt>Pessoas</dt><dd>{pessoas}</dd></div>
      <div><dt>Data</dt><dd>{dataTexto}</dd></div>
      <div><dt>Horário</dt><dd>{hora}</dd></div>
      {etapa !== 'confirmada' && <div><dt>Nome</dt><dd>{dados.nome}</dd></div>}
      {etapa !== 'confirmada' && <div><dt>Telefone</dt><dd>{dados.telefone}</dd></div>}
      {etapa !== 'confirmada' && dados.email.trim() && <div><dt>E-mail</dt><dd>{dados.email.trim()}</dd></div>}
    </dl>
  );

  return (
    <form class="ticket" data-modo={modo} data-etapa={etapa} onSubmit={continuar} noValidate aria-describedby={nota} aria-busy={etapa === 'enviando'}>
      <div class="stamp ticket__stamp" data-state={carimbo.estado} aria-hidden="true">{carimbo.texto}</div>
      <p class="ticket__title" ref={topo} tabIndex={-1}>
        {etapa === 'confirmada' ? (modo === 'simulado' ? 'Reserva simulada' : 'Mesa reservada') : etapa === 'escolha' ? 'Comanda de reserva' : 'Confira sua reserva'}
      </p>
      {modo === 'simulado' && <p class="ticket__sim" role="note">Simulação para testes — nenhuma reserva é feita e nada é enviado.</p>}

      {etapa === 'escolha' && estadoCfg === 'fechado' && (
        <>
          <p class="ticket__status" role="status">As reservas pelo site não estão abertas no momento.</p>
          <p class="ticket__slots">Para reservar agora, a equipe atende você. <a class="ticket__link" href={linkEquipe} target="_blank" rel="noopener">Falar com a equipe no WhatsApp</a></p>
        </>
      )}
      {etapa === 'escolha' && estadoCfg === 'erro' && (
        <p class="ticket__status" data-tone="error" role="alert">
          Não foi possível carregar as reservas agora. <button type="button" class="ticket__link" onClick={() => setCfgTentativa((t) => t + 1)}>Tentar de novo</button>
        </p>
      )}
      {etapa === 'escolha' && (estadoCfg === 'ok' || estadoCfg === 'carregando') && (
        <>
          {falha && <p class="ticket__status" data-tone="error" role="alert">{falha}</p>}
          <fieldset key={`amb-${destaque}`} data-destaque={destaque ? '' : undefined}>
            <legend id={`${px}-l1`} data-done={api && ambiente ? '' : undefined}>01 · ambiente</legend>
            <Escolha id={`${px}-l1`} rotulo="Ambiente" valor={ambiente}
              opcoes={cfg.ambientes.map((a) => ({ valor: a.id, texto: a.nome }))}
              aoEscolher={(v) => { setAmbiente(v); setFalha(''); }} />
          </fieldset>
          <fieldset>
            <legend id={`${px}-l2`} data-done={api ? '' : undefined}>02 · pessoas</legend>
            <div class="stepper">
              <button type="button" aria-label="Menos uma pessoa" disabled={pessoas <= minPessoas} onClick={() => setPessoas((n) => Math.max(minPessoas, Math.min(n, maxPessoas + 1) - 1))}>−</button>
              <output aria-live="polite" aria-labelledby={`${px}-l2`}>{grupo ? `+${maxPessoas}` : pessoas}</output>
              <button type="button" aria-label={pessoas >= maxPessoas ? `Mais de ${maxPessoas} pessoas` : 'Mais uma pessoa'} disabled={grupo} onClick={() => setPessoas((n) => Math.min(maxPessoas + 1, n + 1))}>+</button>
            </div>
            {api && minPessoas > 1 && pessoas <= minPessoas && <p class="ticket__slots ticket__slots--after">{nomeAmbiente}: reservas a partir de {minPessoas} pessoas.</p>}
            {api && grupo && (
              <p class="ticket__status" role="status">
                Reservas online em {nomeAmbiente} vão até {maxPessoas} pessoas. Para grupos maiores, a equipe monta a reserva com você.{' '}
                <a class="ticket__link" href={linkGrupo} target="_blank" rel="noopener">Falar com a equipe no WhatsApp</a>
              </p>
            )}
          </fieldset>
          {!grupo && <fieldset>
            <legend id={`${px}-l3`} data-done={api && data ? '' : undefined}>03 · data</legend>
            <button type="button" class="data-campo" ref={campoData} aria-expanded={calAberto} aria-controls={`${px}-cal`}
              data-escolhida={data ? '' : undefined} onClick={() => setCalAberto((a) => !a)}>
              <svg class="data-campo__icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5.5h13a1.5 1.5 0 0 1 1.5 1.5v11.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V7a1.5 1.5 0 0 1 1.5-1.5zM4 10h16M8.5 3.5v4M15.5 3.5v4" /><path class="data-campo__ponto" d="M8 14h.01M12 14h.01M16 14h.01" /></svg>
              <span class="data-campo__texto">{data ? dataTexto : 'Escolher uma data'}</span>
              <span class="data-campo__acao" aria-hidden="true">{data ? 'trocar' : ''}<i /></span>
            </button>
            <div class="data-painel" id={`${px}-cal`} data-aberto={calAberto ? '' : undefined}
              onKeyDown={(ev) => { if (ev.key === 'Escape' && calAberto) { ev.stopPropagation(); fecharCal(); } }}>
              {hoje && pronto
                ? <Calendario id={`${px}-l3`} hoje={hoje} diasMax={cfg.antecedencia.diasMax} fechadas={fechadas} valor={data}
                    aoEscolher={(v) => { setData(v); setFalha(''); }} aoConfirmar={fecharCal} />
                : <div class="cal cal--esqueleto" aria-hidden="true"><div class="cal__grade">{Array.from({ length: 35 }, () => <span class="cal__dia chip--skeleton" />)}</div></div>}
            </div>
          </fieldset>}
          {!grupo && <fieldset>
            <legend id={`${px}-l4`} ref={passo4} data-done={hora ? '' : undefined}>04 · horário</legend>
            {!api && <p class="ticket__slots">Os horários aparecem aqui quando as reservas pelo site forem ativadas.</p>}
            {api && !pronto && <p class="ticket__slots">Carregando a agenda…</p>}
            {api && pronto && !data && !demo?.horarios && <p class="ticket__slots">Escolha uma data para ver os horários.</p>}
            {api && horarios.estado === 'carregando' && <><div class="chips" aria-hidden="true">{[0, 1, 2, 3].map(() => <span class="chip chip--skeleton" />)}</div><p class="ticket__slots ticket__slots--after">Carregando horários…</p></>}
            {api && horarios.estado === 'vazio' && <p class="ticket__slots">Sem horários nesta data. Escolha outro dia.</p>}
            {api && horarios.estado === 'erro' && <p class="ticket__status" data-tone="error" role="alert">{horarios.msg} <button type="button" class="ticket__link" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button></p>}
            {api && horarios.estado === 'ok' && (
              <Escolha id={`${px}-l4`} rotulo="Horário" valor={hora}
                opcoes={horarios.lista.map((h) => ({ valor: h.hora, texto: h.hora, desabilitado: !h.disponivel }))}
                aoEscolher={(v) => { setHora(v); setFalha(''); }} />
            )}
          </fieldset>}
          {api && hora && !grupo && (
            <fieldset class="ticket__dados">
              <legend>05 · seus dados</legend>
              <div class="ticket__fields">
                <label class="field" data-invalid={erros.nome ? '' : undefined}>
                  <span class="field__label">Nome</span>
                  <input id={`${px}-nome`} class="field__input" autocomplete="name" value={dados.nome} onInput={mudarDado('nome')} aria-invalid={!!erros.nome} aria-describedby={erros.nome ? `${px}-nome-erro` : undefined} />
                  <span class="field__error" id={`${px}-nome-erro`}>{erros.nome}</span>
                </label>
                <label class="field" data-invalid={erros.telefone ? '' : undefined}>
                  <span class="field__label">WhatsApp ou telefone</span>
                  <input id={`${px}-telefone`} class="field__input" type="tel" inputMode="tel" autocomplete="tel-national" placeholder="(00) 00000-0000" value={dados.telefone} onInput={mudarDado('telefone')} aria-invalid={!!erros.telefone} aria-describedby={erros.telefone ? `${px}-telefone-erro` : undefined} />
                  <span class="field__error" id={`${px}-telefone-erro`}>{erros.telefone}</span>
                </label>
                <label class="field" data-invalid={erros.email ? '' : undefined}>
                  <span class="field__label">E-mail {!cfg.exigeEmail && <small>(opcional)</small>}</span>
                  <input id={`${px}-email`} class="field__input" type="email" inputMode="email" autocomplete="email" required={cfg.exigeEmail} aria-required={cfg.exigeEmail} value={dados.email} onInput={mudarDado('email')} aria-invalid={!!erros.email} aria-describedby={erros.email ? `${px}-email-erro` : undefined} />
                  <span class="field__error" id={`${px}-email-erro`}>{erros.email}</span>
                </label>
                <label class="field">
                  <span class="field__label">Observações <small>(opcional)</small></span>
                  <textarea id={`${px}-observacoes`} class="field__input" rows={3} maxLength={300} value={dados.observacoes} onInput={mudarDado('observacoes')} placeholder="Aniversário, cadeirinha, restrição alimentar…" />
                </label>
                <label class="check" data-invalid={erros.consentimento ? '' : undefined}>
                  <input id={`${px}-consentimento`} type="checkbox" checked={dados.consentimento} onChange={mudarDado('consentimento')} aria-invalid={!!erros.consentimento} aria-describedby={`${px}-consentimento-erro`} />
                  <span>Concordo com o uso dos meus dados para esta reserva, conforme a <a href={privacidadeUrl}>política de privacidade</a>.</span>
                </label>
                <p class="ticket__slots">Vale só para esta reserva: não é cadastro no Clube Âmbar nem autorização para promoções.</p>
                {erros.consentimento && <span class="field__error field__error--block" id={`${px}-consentimento-erro`}>{erros.consentimento}</span>}
              </div>
            </fieldset>
          )}
          {api
            ? <button class="btn btn--wine btn--block" type="submit" disabled={grupo || !pronto}>Continuar</button>
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
          {resultado.clube?.convite && resultado.clube.url && (
            <aside class="ticket__clube" aria-label="Convite opcional ao Clube Âmbar">
              <p><strong>Conheça o Clube Âmbar.</strong> Pontos a cada compra no café. É opcional: sua reserva já está garantida.</p>
              <a class="ticket__link" href={resultado.clube.url}>Ver o Clube</a>
            </aside>
          )}
        </>
      )}

      <p class="ticket__note" id={nota}>
        {modo === 'indisponivel' && 'As reservas pelo site ainda não estão ativas. Nada é enviado.'}
        {modo === 'simulado' && 'Simulação: nenhum dado sai deste navegador.'}
        {modo === 'api' && etapa === 'escolha' && (estadoCfg === 'fechado' ? 'Nada é enviado por esta comanda enquanto as reservas estão fechadas.' : 'Você confere tudo antes de confirmar.')}
      </p>
      <p class="visually-hidden" aria-live="polite">{anuncio}</p>
    </form>
  );
}
