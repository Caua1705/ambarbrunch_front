// DEMONSTRAÇÃO — Reservas fictícias (nomes, telefones e capacidades inventados; o cadastro real vem do backend).
// Regras imitadas do backend: máquina de estados (estados.py), comparecimento a partir do dia da reserva e ausência só depois da
// tolerância, motivo obrigatório para corrigir/desfazer, criação manual pela equipe, e o recorte do Atendente (sem telefone e
// e-mail do cliente; agenda de hoje até 14 dias à frente).
import type { Rota } from './roteador';
import type { Papel } from '../../lib/sessao';
import { TODOS, GERENCIA, ErroDemo, dia, instante, uuid, sorteio, hojeFortaleza, resposta, exigirMotivo } from './roteador';
import type { ReservaPainel, AmbienteConfig, StatusReservaBase, Comparecimento, HistoricoComparecimento, PoliticaReserva, RegraReserva } from '../../lib/tipos/reservas';

const TOLERANCIA_MIN = 15;

const AMBIENTES: AmbienteConfig[] = [
  { id: 'a0000001-0000-4000-8000-000000000001', codigo: 'salao', nome: 'Salão', capacidade_max: 56, pessoas_min: 1, pessoas_max_por_reserva: 12, duracao_min: 120, exige_aprovacao: false, aceita_reserva_online: true, ordem: 1, limites_confirmados_em: null, ativo: true },
  { id: 'a0000001-0000-4000-8000-000000000002', codigo: 'jardim', nome: 'Jardim', capacidade_max: 40, pessoas_min: 1, pessoas_max_por_reserva: 10, duracao_min: 120, exige_aprovacao: false, aceita_reserva_online: true, ordem: 2, limites_confirmados_em: null, ativo: true },
  { id: 'a0000001-0000-4000-8000-000000000003', codigo: 'lounge', nome: 'Lounge', capacidade_max: 20, pessoas_min: 2, pessoas_max_por_reserva: 8, duracao_min: 120, exige_aprovacao: false, aceita_reserva_online: true, ordem: 3, limites_confirmados_em: null, ativo: true },
  { id: 'a0000001-0000-4000-8000-000000000004', codigo: 'sala_privativa', nome: 'Sala Privativa', capacidade_max: 14, pessoas_min: 6, pessoas_max_por_reserva: 14, duracao_min: 180, exige_aprovacao: true, aceita_reserva_online: true, ordem: 4, limites_confirmados_em: null, ativo: true },
];

let politica: PoliticaReserva = { aceita_reservas: true, exige_email: false, antecedencia_min_horas: 2, antecedencia_max_dias: 60, tolerancia_atraso_min: TOLERANCIA_MIN, privacidade_texto_versao: '2026-10', lembrete_1h_ativo: true, privacidade_aprovada_em: null };
const regras: RegraReserva[] = [
  { id: 'r0000001-0000-4000-8000-000000000001', dia_semana: 0, primeiro_horario: '08:00:00', ultimo_horario: '14:00:00', intervalo_min: 30, fechado: false, motivo: null, ativo: true },
  { id: 'r0000001-0000-4000-8000-000000000002', dia_semana: 1, fechado: true, motivo: 'Fechado às segundas', ativo: true },
];

const NOMES = ['Mariana Albuquerque', 'Rafael Holanda', 'Camila Feitosa', 'Pedro Bezerra', 'Larissa Moreira', 'Thiago Pinheiro', 'Beatriz Sampaio', 'Lucas Cavalcante', 'Juliana Teles', 'Gustavo Aragão', 'Fernanda Lima', 'Bruno Castelo', 'Isabela Rocha', 'Diego Montenegro', 'Patrícia Nogueira', 'Rodrigo Uchôa', 'Aline Fontenele', 'Vinícius Studart', 'Natália Brígido', 'Eduardo Pontes', 'Carolina Mota', 'Felipe Benevides'];
const OBS = [null, null, null, 'Aniversário — levar vela', 'Cadeira para bebê', null, 'Mesa perto da janela, se possível', null, 'Uma pessoa celíaca', null, 'Chega com carrinho de bebê', null];
const HORAS = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'];
const CANAIS = ['site', 'site', 'site', 'whatsapp', 'telefone', 'site', 'instagram'];

interface Linha {
  r: ReservaPainel;
  historico: HistoricoComparecimento[];
  avisar: string | null;
  /** Posição em NOMES = o cliente do cadastro único (demo/clientes.ts); não muda se o contato da reserva mudar. */
  cliente: number;
}
const banco: Linha[] = [];

/** Telefone fixo de cada cliente fictício: as reservas da mesma pessoa repetem o número, como no cadastro real. */
export const telefoneDemo = (i: number) => `+55859${String(81000000 + i * 413717).slice(0, 8)}`;
export const NOMES_DEMO = NOMES;

function montar(): void {
  if (banco.length) return;
  const rnd = sorteio(42);
  const hoje = hojeFortaleza();
  for (let d = -6; d <= 12; d++) {
    const data = dia(d, hoje);
    const quantas = d === 0 ? 14 : 5 + Math.floor(rnd() * 7);
    for (let i = 0; i < quantas; i++) {
      const amb = AMBIENTES[Math.floor(rnd() * (rnd() < 0.15 ? 4 : 3))];
      const hora = HORAS[Math.floor(rnd() * HORAS.length)];
      const pessoas = amb.codigo === 'sala_privativa' ? 6 + Math.floor(rnd() * 8) : 1 + Math.floor(rnd() * 6);
      let status: StatusReservaBase = 'confirmada';
      let comp: Comparecimento = 'nao_registrado';
      const x = rnd();
      if (d < 0) {
        if (x < 0.12) status = 'cancelada';
        else comp = x < 0.88 ? 'compareceu' : 'nao_compareceu';
      } else if (d === 0) {
        status = x < 0.1 ? 'pendente' : x < 0.17 ? 'cancelada' : x < 0.55 ? 'lembrada' : 'confirmada';
        if (amb.exige_aprovacao && x < 0.3) status = 'pendente';
        // o que já começou há mais de 40 min quase sempre já teve a chegada registrada pela equipe
        const comecouHa = (Date.now() - new Date(instante(data, hora)).getTime()) / 60_000;
        if (status !== 'pendente' && status !== 'cancelada' && comecouHa > 40 && rnd() < 0.85) comp = rnd() < 0.9 ? 'compareceu' : 'nao_compareceu';
      } else {
        status = (amb.exige_aprovacao && x < 0.5) || x < 0.04 ? 'pendente' : x < 0.1 ? 'cancelada' : 'confirmada';
      }
      const iNome = Math.floor(rnd() * NOMES.length);
      const nome = NOMES[iNome];
      void rnd(); // mantém a sequência dos dados de antes (o telefone agora é fixo por cliente)
      const tel = telefoneDemo(iNome);
      const id = uuid();
      const criado = instante(dia(-Math.ceil(rnd() * 6) + Math.min(d, 0), hoje), `${String(8 + Math.floor(rnd() * 13)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`);
      banco.push({
        r: {
          id,
          codigo: `AMB-${(1000 + banco.length).toString(36).toUpperCase()}`,
          unidade: 'ambar_cafe',
          ambiente_id: amb.id,
          ambiente: amb.nome,
          data,
          hora: `${hora}:00`,
          duracao_min: amb.duracao_min,
          pessoas,
          status: comp !== 'nao_registrado' ? comp : status,
          status_reserva: status,
          comparecimento: comp,
          comparecimento_registrado_em: comp !== 'nao_registrado' ? instante(data, hora) : null,
          comparecimento_registrado_por: null,
          canal: CANAIS[Math.floor(rnd() * CANAIS.length)],
          contato_nome: nome,
          contato_telefone_e164: tel,
          contato_email: rnd() < 0.4 ? `${nome.split(' ')[0].toLowerCase()}@exemplo.invalid` : null,
          observacoes: OBS[Math.floor(rnd() * OBS.length)],
          importada_de: null,
          cancelada_em: status === 'cancelada' ? criado : null,
          motivo_cancelamento: status === 'cancelada' ? 'Cliente pediu pelo WhatsApp' : null,
          fechada_em: null,
          criado_em: criado,
          avisar_cliente: null,
        },
        historico: [],
        avisar: null,
        cliente: iNome,
      });
    }
  }
}

const saida = (l: Linha): ReservaPainel => ({ ...l.r, avisar_cliente: l.avisar, status: l.r.comparecimento !== 'nao_registrado' ? l.r.comparecimento : l.r.status_reserva });
/** Como o backend: quem não tem reservas.ver_contato (Atendente) recebe a reserva sem telefone e sem e-mail. */
const paraPapel = (r: ReservaPainel, papel: Papel): ReservaPainel => (papel === 'operador' ? { ...r, contato_telefone_e164: null, contato_email: null } : r);
/** Janela do Atendente (sem reservas.alterar): de hoje até 14 dias à frente; fora dela, 403 como no backend. */
const ATENDENTE_DIAS = 14;
function naJanela(papel: Papel, data: string) {
  if (papel === 'operador' && (data < hojeFortaleza() || data > dia(ATENDENTE_DIAS))) throw new ErroDemo(403, 'sem_permissao', 'Você não tem permissão para acessar esta área.');
}
/** Para demo/clientes.ts: as reservas de cada cliente fictício (posição em NOMES), no formato do backend, por data. */
export function reservasDosClientes(): Map<number, ReservaPainel[]> {
  montar();
  const m = new Map<number, ReservaPainel[]>();
  for (const l of [...banco].sort((a, b) => (a.r.data + a.r.hora).localeCompare(b.r.data + b.r.hora))) m.set(l.cliente, [...(m.get(l.cliente) ?? []), saida(l)]);
  return m;
}
const achar = (id: string) => {
  montar();
  const l = banco.find((x) => x.r.id === id);
  if (!l) throw new ErroDemo(404, 'nao_encontrado', 'Reserva não encontrada.');
  return l;
};
const inicio = (r: ReservaPainel) => new Date(instante(r.data, r.hora)).getTime();
const liberacaoAusencia = (r: ReservaPainel) => new Date(inicio(r) + TOLERANCIA_MIN * 60_000).toISOString();

const TRANSICOES: Record<StatusReservaBase, StatusReservaBase[]> = {
  pendente: ['confirmada', 'cancelada'],
  confirmada: ['lembrada', 'reconfirmada', 'cancelada'],
  lembrada: ['reconfirmada', 'cancelada'],
  reconfirmada: ['cancelada'],
  cancelada: [],
};

function registrar(l: Linha, novo: Comparecimento, motivo: string | null, papel: string) {
  const r = l.r;
  // so_chegada_no_dia do backend: o Atendente só registra "compareceu", e só no dia da reserva
  if (papel === 'operador' && !(novo === 'compareceu' && r.data === hojeFortaleza())) throw new ErroDemo(403, 'sem_permissao', 'Você não tem permissão para acessar esta área.');
  if (r.comparecimento === novo) return;
  if (!['confirmada', 'lembrada', 'reconfirmada'].includes(r.status_reserva)) throw new ErroDemo(422, 'regra_violada', 'Só reserva confirmada recebe comparecimento.');
  // como o backend: comparecimento a partir do DIA da reserva (o cliente pode chegar antes do horário)
  if (r.data > hojeFortaleza()) throw new ErroDemo(422, 'regra_violada', 'Comparecimento só pode ser registrado a partir do dia da reserva.');
  if (novo === 'nao_compareceu' && Date.now() < new Date(liberacaoAusencia(r)).getTime()) throw new ErroDemo(422, 'ausencia_antes_da_tolerancia', `Ausência só depois de ${TOLERANCIA_MIN} minutos do horário.`);
  if (r.comparecimento !== 'nao_registrado') exigirMotivo(motivo);
  l.historico.unshift({ ocorreu_em: new Date().toISOString(), antes: r.comparecimento, depois: novo, motivo, ator_tipo: 'usuario', usuario_id: null, usuario_nome: `Usuário ${papel} (demo)` });
  r.comparecimento = novo;
  r.comparecimento_registrado_em = novo === 'nao_registrado' ? null : new Date().toISOString();
}

function filtrar(q: URLSearchParams) {
  montar();
  const de = q.get('data_de');
  const ate = q.get('data_ate');
  const st = q.getAll('status');
  const amb = q.get('ambiente_id');
  const busca = q.get('busca')?.toLowerCase().trim();
  return banco
    .filter((l) => (!de || l.r.data >= de) && (!ate || l.r.data <= ate) && (!amb || l.r.ambiente_id === amb))
    .filter((l) => !st.length || st.includes(saida(l).status))
    .filter((l) => !busca || l.r.contato_nome.toLowerCase().includes(busca) || (l.r.contato_telefone_e164 ?? '').includes(busca.replace(/\D/g, '') || '§') || l.r.codigo.toLowerCase().includes(busca))
    .sort((a, b) => (a.r.data + a.r.hora).localeCompare(b.r.data + b.r.hora));
}

export function resumoReservasHoje() {
  const hoje = filtrar(new URLSearchParams({ data_de: hojeFortaleza(), data_ate: hojeFortaleza() })).filter((l) => l.r.status_reserva !== 'cancelada');
  return { hoje: hoje.length, pessoas: hoje.reduce((s, l) => s + l.r.pessoas, 0) };
}
export const pendentesAprovacao = () => filtrar(new URLSearchParams({ data_de: hojeFortaleza() })).filter((l) => l.r.status_reserva === 'pendente').map(saida);

const UUID = '([0-9a-f-]{36})';

export const ROTAS_RESERVAS: Rota[] = [
  ['GET', /^reservas$/, TODOS, ({ query, papel }) => {
    if (papel === 'operador') {
      // como o backend: a janela do Atendente corta o filtro (sem erro)
      const ate = dia(ATENDENTE_DIAS);
      const de = query.get('data_de');
      const ateQ = query.get('data_ate');
      query.set('data_de', !de || de < hojeFortaleza() ? hojeFortaleza() : de);
      query.set('data_ate', !ateQ || ateQ > ate ? ate : ateQ);
    }
    const itens = filtrar(query).map((l) => paraPapel(saida(l), papel));
    const lim = Number(query.get('limite') ?? 50);
    const des = Number(query.get('deslocamento') ?? 0);
    return { total: itens.length, itens: itens.slice(des, des + lim) };
  }],
  ['GET', /^reservas\/operacao$/, TODOS, ({ query, papel }) => {
    const data = query.get('data') ?? hojeFortaleza();
    naJanela(papel, data);
    return filtrar(new URLSearchParams({ data_de: data, data_ate: data })).map((l) => {
      const ini = inicio(l.r);
      const atraso = Math.floor((Date.now() - ini) / 60_000);
      const emAberto = l.r.comparecimento === 'nao_registrado' && l.r.status_reserva !== 'cancelada';
      return {
        ...paraPapel(saida(l), papel),
        inicio: new Date(ini).toISOString(),
        fim: new Date(ini + l.r.duracao_min * 60_000).toISOString(),
        minutos_de_atraso: emAberto && atraso > 0 ? atraso : null,
        atrasada: emAberto && atraso > TOLERANCIA_MIN,
        // como o backend: tipo da mensagem → status (texto), não um objeto
        mensagens: l.r.status_reserva === 'pendente' ? {} : { confirmacao: 'entregue', ...(l.r.status_reserva === 'lembrada' ? { lembrete_1h: 'lida' } : {}) },
      };
    });
  }],
  ['GET', /^reservas\/ambientes$/, TODOS, () => AMBIENTES.map(({ id, codigo, nome, capacidade_max, duracao_min, ativo }) => ({ id, unidade: 'ambar_cafe', codigo, nome, capacidade_max, duracao_min, ativo }))],
  ['GET', /^reservas\/lotacao$/, TODOS, ({ query }) => {
    const amb = AMBIENTES.find((a) => a.id === query.get('ambiente_id'));
    if (!amb) throw new ErroDemo(404, 'nao_encontrado', 'Ambiente não encontrado.');
    const data = query.get('data') ?? hojeFortaleza();
    const pessoas = Number(query.get('pessoas') ?? 0);
    const doDia = filtrar(new URLSearchParams({ data_de: data, data_ate: data, ambiente_id: amb.id })).filter((l) => l.r.status_reserva !== 'cancelada' && l.r.comparecimento === 'nao_registrado');
    const horarios = ['08:00', ...HORAS, '13:30', '14:00'].map((h) => {
      const t = new Date(instante(data, h)).getTime();
      const ocupadas = doDia.filter((l) => t >= inicio(l.r) && t < inicio(l.r) + l.r.duracao_min * 60_000).reduce((s, l) => s + l.r.pessoas, 0);
      return { hora: `${h}:00`, ocupadas, cabe: ocupadas + pessoas <= amb.capacidade_max };
    });
    return { ambiente_id: amb.id, ambiente: amb.nome, data, capacidade_max: amb.capacidade_max, duracao_min: amb.duracao_min, ativo: amb.ativo, pessoas, horarios };
  }],
  ['GET', /^reservas\/mensagens$/, GERENCIA, () => {
    montar();
    const falha = banco.filter((l) => l.r.data >= hojeFortaleza()).slice(3, 5);
    return { total: falha.length, itens: falha.map((l) => ({ id: uuid(), tipo: 'confirmacao', status: 'falhou', motivo: null, tentativas: 3, agendada_para: l.r.criado_em, enviada_em: null, entregue_em: null, lida_em: null, erro: 'Número sem WhatsApp', reserva: { id: l.r.id, codigo: l.r.codigo, data: l.r.data, hora: l.r.hora, status: l.r.status, contato_nome: l.r.contato_nome } })) };
  }],
  ['GET', /^reservas\/comparecimento\/pendentes$/, TODOS, () => {
    montar();
    return banco
      .filter((l) => ['confirmada', 'lembrada', 'reconfirmada'].includes(l.r.status_reserva) && l.r.comparecimento === 'nao_registrado' && inicio(l.r) <= Date.now())
      .map((l) => ({ ...saida(l), inicio: new Date(inicio(l.r)).toISOString(), ausencia_liberada_em: liberacaoAusencia(l.r), pode_registrar_ausencia: Date.now() >= new Date(liberacaoAusencia(l.r)).getTime(), cliente: { perfil: 'recorrente', visitas: 3, faltas: 0, historico_faltas: false, primeira_visita: null, ultima_visita: null, ultima_falta: null } }));
  }],
  ['POST', /^reservas$/, GERENCIA, async ({ corpo }) => {
    montar();
    const e = await corpo<Record<string, string | number>>();
    const amb = AMBIENTES.find((a) => a.id === e.ambiente_id);
    if (!amb) throw new ErroDemo(422, 'regra_violada', 'Escolha o ambiente.');
    if (!e.nome || !e.telefone || !e.data || !e.hora) throw new ErroDemo(422, 'regra_violada', 'Preencha nome, telefone, data e horário.');
    const pessoas = Number(e.pessoas);
    if (pessoas > amb.pessoas_max_por_reserva) throw new ErroDemo(422, 'regra_violada', `No ${amb.nome}, até ${amb.pessoas_max_por_reserva} pessoas por reserva.`);
    const r: ReservaPainel = { id: uuid(), codigo: `AMB-${(1000 + banco.length).toString(36).toUpperCase()}`, unidade: 'ambar_cafe', ambiente_id: amb.id, ambiente: amb.nome, data: String(e.data), hora: String(e.hora).length === 5 ? `${e.hora}:00` : String(e.hora), duracao_min: amb.duracao_min, pessoas, status: amb.exige_aprovacao ? 'pendente' : 'confirmada', status_reserva: amb.exige_aprovacao ? 'pendente' : 'confirmada', comparecimento: 'nao_registrado', comparecimento_registrado_em: null, comparecimento_registrado_por: null, canal: String(e.canal ?? 'painel'), contato_nome: String(e.nome), contato_telefone_e164: `+55${String(e.telefone).replace(/\D/g, '')}`, contato_email: (e.email as string) || null, observacoes: (e.observacoes as string) || null, importada_de: null, cancelada_em: null, motivo_cancelamento: null, fechada_em: null, criado_em: new Date().toISOString() };
    // cliente novo (fora dos fictícios) não entra no cadastro de demonstração de Clientes
    banco.push({ r, historico: [], avisar: null, cliente: NOMES.indexOf(String(e.nome)) });
    return resposta(201, r);
  }],
  ['GET', new RegExp(`^reservas/${UUID}$`), TODOS, ({ params, papel }) => {
    const l = achar(params[0]);
    naJanela(papel, l.r.data);
    return paraPapel(saida(l), papel);
  }],
  ['PATCH', new RegExp(`^reservas/${UUID}$`), GERENCIA, async ({ params, corpo }) => {
    const l = achar(params[0]);
    const a = await corpo<Record<string, unknown>>();
    if (l.r.status_reserva === 'cancelada') throw new ErroDemo(409, 'reserva_cancelada', 'Reserva cancelada não pode ser alterada.');
    // Como o backend (AMBAR_PAINEL_ALTERACAO=false): data, horário, ambiente e pessoas não mudam pelo painel.
    const muda = (a.data && a.data !== l.r.data) || (a.hora && String(a.hora).slice(0, 5) !== l.r.hora.slice(0, 5))
      || (a.pessoas && Number(a.pessoas) !== l.r.pessoas) || (a.ambiente_id && a.ambiente_id !== l.r.ambiente_id);
    if (muda) throw new ErroDemo(403, 'alteracao_desativada', 'Nesta versão, data, horário, ambiente e pessoas não mudam pelo painel: cancele e peça ao cliente uma nova reserva pelo site.');
    for (const k of ['observacoes', 'contato_nome', 'contato_email'] as const) if (a[k] !== undefined) (l.r as unknown as Record<string, unknown>)[k] = a[k] === '' ? null : a[k];
    if (a.contato_telefone) l.r.contato_telefone_e164 = `+55${String(a.contato_telefone).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')}`;
    return saida(l);
  }],
  ['PATCH', new RegExp(`^reservas/${UUID}/status$`), TODOS, async ({ params, corpo, papel }) => {
    const l = achar(params[0]);
    const { status, motivo } = await corpo<{ status: string; motivo?: string | null }>();
    if (status === 'compareceu' || status === 'nao_compareceu') {
      registrar(l, status, motivo ?? null, papel);
      return paraPapel(saida(l), papel);
    }
    if (papel === 'operador') throw new ErroDemo(403, 'sem_permissao', 'Você não tem permissão para acessar esta área.');
    const atual = l.r.status_reserva;
    if (status === atual) return saida(l);
    if (l.r.comparecimento !== 'nao_registrado') throw new ErroDemo(409, 'reserva_fechada', 'O comparecimento já foi registrado: o status não muda mais.');
    if (!TRANSICOES[atual].includes(status as StatusReservaBase)) throw new ErroDemo(409, 'transicao_invalida', `Não é possível passar de ${atual} para ${status}.`);
    l.r.status_reserva = status as StatusReservaBase;
    if (status === 'cancelada') {
      l.r.cancelada_em = new Date().toISOString();
      l.r.motivo_cancelamento = motivo ?? null;
      l.avisar = 'cancelamento';
    }
    return saida(l);
  }],
  ['POST', new RegExp(`^reservas/${UUID}/aviso-comunicado$`), GERENCIA, ({ params }) => {
    const l = achar(params[0]);
    l.avisar = null;
    return saida(l);
  }],
  ['GET', new RegExp(`^reservas/${UUID}/comparecimento$`), TODOS, ({ params }) => {
    const l = achar(params[0]);
    return { reserva_id: l.r.id, codigo: l.r.codigo, status_reserva: l.r.status_reserva, comparecimento: l.r.comparecimento, registrado_em: l.r.comparecimento_registrado_em, registrado_por: null, registrado_por_nome: l.r.comparecimento_registrado_em ? 'Equipe (demo)' : null, aceita_registro: ['confirmada', 'lembrada', 'reconfirmada'].includes(l.r.status_reserva), ausencia_liberada_em: liberacaoAusencia(l.r), historico: l.historico };
  }],
  ['PUT', new RegExp(`^reservas/${UUID}/comparecimento$`), TODOS, async ({ params, corpo, papel }) => {
    const l = achar(params[0]);
    const { comparecimento, motivo } = await corpo<{ comparecimento: Comparecimento; motivo?: string | null }>();
    registrar(l, comparecimento, motivo ?? null, papel);
    return { reserva_id: l.r.id, codigo: l.r.codigo, status_reserva: l.r.status_reserva, comparecimento: l.r.comparecimento, registrado_em: l.r.comparecimento_registrado_em, registrado_por: null, registrado_por_nome: 'Equipe (demo)', aceita_registro: true, ausencia_liberada_em: liberacaoAusencia(l.r), historico: l.historico };
  }],
  ['GET', /^reservas\/configuracao\/([a-z_]+)$/, GERENCIA, ({ params }) => ({ unidade: params[0], politica, ambientes: AMBIENTES, regras })],
  ['PUT', /^reservas\/configuracao\/([a-z_]+)\/politica$/, GERENCIA, async ({ corpo }) => {
    politica = { ...politica, ...(await corpo<Partial<PoliticaReserva>>()) };
    return politica;
  }],
  ['PATCH', new RegExp(`^reservas/ambientes/${UUID}$`), GERENCIA, async ({ params, corpo }) => {
    const a = AMBIENTES.find((x) => x.id === params[0]);
    if (!a) throw new ErroDemo(404, 'nao_encontrado', 'Ambiente não encontrado.');
    const mud = await corpo<Partial<AmbienteConfig>>();
    for (const [k, v] of Object.entries(mud)) if (v !== null && v !== undefined) (a as unknown as Record<string, unknown>)[k] = v;
    return a;
  }],
  ['PATCH', new RegExp(`^reservas/regras/${UUID}$`), GERENCIA, async ({ params, corpo }) => {
    const r = regras.find((x) => x.id === params[0]);
    if (!r) throw new ErroDemo(404, 'nao_encontrado', 'Regra não encontrada.');
    r.ativo = Boolean((await corpo<{ ativo: boolean }>()).ativo);
    return r;
  }],
];
