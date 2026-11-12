// Ponto na demonstração. De propósito não há dados fictícios de jornada nem identificação simulada: as telas de ponto são
// exercitadas contra o backend real (tests-ponto-real/). O terminal do Modo Operação responde como a produção de hoje:
// reconhecimento facial desligado (a tela mostra o caminho do gestor). O checklist de abertura funciona em memória, com
// funcionárias fictícias, para a tela do tablet e a consulta da gerência serem testadas (o vídeo fica só na memória).
import { ADMIN, ErroDemo, GERENCIA, TODOS, hojeFortaleza, resposta, uuid, type Contexto, type Rota } from './roteador';

const desligado = () => {
  throw new ErroDemo(503, 'ponto_desativado', 'Controle de ponto desativado.');
};

const configuracaoTerminal = () => ({
  dispositivo: 'Modo Operação', unidade: 'Âmbar Café (demonstração)', horario_servidor: new Date().toISOString(),
  fuso: 'America/Fortaleza', biometria_disponivel: false, identificacao_automatica: false, quadros_min: 6, quadros_max: 12,
  quadro_max_kb: 400, quadro_lado_max: 1280, sessao_segundos: 30,
  poses: { frente: 'Olhe para a câmera', esquerda: 'Vire o rosto para a sua esquerda', direita: 'Vire o rosto para a sua direita' },
});

// --- checklist de abertura (memória do processo) ---------------------------------------------------------------------
const FUNCIONARIAS = [
  { id: 'f0000001-0000-4000-8000-000000000001', nome_exibicao: 'Isabela' },
  { id: 'f0000001-0000-4000-8000-000000000002', nome_exibicao: 'Rayssa' },
  { id: 'f0000001-0000-4000-8000-000000000003', nome_exibicao: 'Ritiele' },
];
let modelo = [
  'Abrir o café no horário programado', 'Acender luzes e ligar equipamentos', 'Verificar a limpeza geral',
  'Conferir banheiros e materiais de higiene', 'Organizar mesas e cadeiras', 'Conferir produtos essenciais', 'Abastecer vitrines',
  'Conferir as reservas do dia', 'Verificar sistemas e equipamentos', 'Alinhar as atividades da equipe', 'Regar jardim e flores',
  'Verificar a limpeza da entrada', 'Limpar vidros',
].map((titulo, i) => ({ id: uuid(), ordem: i + 1, titulo, ativo: true }));

type Situacao = 'feito' | 'nao_feito' | null;
interface ChecklistDemo {
  id: string; data: string; estado: 'em_andamento' | 'concluido'; funcionario: string; assumido_em: string; concluido_em: string | null;
  confirmado_por: string | null; confirmado_em: string | null; observacao: string | null; sem_video_motivo: string | null;
  video: { mime: string; tamanho_bytes: number; duracao_s: number | null; enviado_em: string } | null;
  itens: { id: string; ordem: number; titulo: string; situacao: Situacao; observacao: string | null; marcado_em: string | null }[];
}
const checklists: ChecklistDemo[] = [];

function dados(c: ChecklistDemo, comItens = true) {
  const pessoa = FUNCIONARIAS.find((f) => f.id === c.funcionario);
  return {
    id: c.id, data: c.data, estado: c.estado,
    responsavel: { funcionario_id: c.funcionario, nome_exibicao: pessoa?.nome_exibicao ?? null, metodo: 'declarada', verificada: !!c.confirmado_por, confirmado_por: c.confirmado_por, confirmado_em: c.confirmado_em },
    assumido_em: c.assumido_em, concluido_em: c.concluido_em, observacao: c.observacao, sem_video_motivo: c.sem_video_motivo,
    resumo: { total: c.itens.length, feitos: c.itens.filter((i) => i.situacao === 'feito').length, nao_feitos: c.itens.filter((i) => i.situacao === 'nao_feito').length, pendentes: c.itens.filter((i) => !i.situacao).length },
    nao_feitos: c.itens.filter((i) => i.situacao === 'nao_feito').map((i) => ({ titulo: i.titulo, observacao: i.observacao })),
    video: c.video,
    ...(comItens ? { itens: c.itens } : {}),
  };
}

function checklist(id: string): ChecklistDemo {
  const c = checklists.find((x) => x.id === id);
  if (!c) throw new ErroDemo(404, 'checklist_nao_encontrado', 'Checklist não encontrado.');
  return c;
}

async function assumir(ctx: Contexto) {
  const corpo = await ctx.corpo<{ funcionario_id?: string; sessao_id?: string }>();
  if (corpo.sessao_id) throw new ErroDemo(503, 'identificacao_automatica_desligada', 'Identificação facial desligada. Procure o gestor.');
  const hoje = hojeFortaleza();
  const existente = checklists.find((c) => c.data === hoje);
  if (existente) throw new ErroDemo(409, 'abertura_ja_assumida', `A abertura de hoje já foi assumida por ${FUNCIONARIAS.find((f) => f.id === existente.funcionario)?.nome_exibicao}.`);
  if (!FUNCIONARIAS.some((f) => f.id === corpo.funcionario_id)) throw new ErroDemo(404, 'funcionario_nao_encontrado', 'Funcionária não encontrada.');
  const c: ChecklistDemo = {
    id: uuid(), data: hoje, estado: 'em_andamento', funcionario: corpo.funcionario_id!, assumido_em: new Date().toISOString(), concluido_em: null,
    confirmado_por: null, confirmado_em: null, observacao: null, sem_video_motivo: null, video: null,
    itens: modelo.filter((t) => t.ativo).map((t, i) => ({ id: uuid(), ordem: i + 1, titulo: t.titulo, situacao: null, observacao: null, marcado_em: null })),
  };
  checklists.unshift(c);
  return resposta(201, dados(c));
}

async function salvar(ctx: Contexto) {
  const c = checklist(ctx.params[0]);
  if (c.estado !== 'em_andamento') throw new ErroDemo(409, 'checklist_concluido', 'Este checklist já foi concluído.');
  const corpo = await ctx.corpo<{ itens?: { id: string; situacao: Situacao; observacao: string | null }[]; observacao?: string | null }>();
  for (const m of corpo.itens ?? []) {
    const item = c.itens.find((i) => i.id === m.id);
    if (!item) throw new ErroDemo(404, 'item_nao_encontrado', 'Tarefa não encontrada neste checklist.');
    if (item.situacao !== m.situacao) item.marcado_em = m.situacao ? new Date().toISOString() : null;
    item.situacao = m.situacao;
    item.observacao = m.observacao?.trim() || null;
  }
  if ('observacao' in corpo) c.observacao = corpo.observacao?.trim() || null;
  return dados(c);
}

async function concluir(ctx: Contexto) {
  const c = checklist(ctx.params[0]);
  if (c.estado === 'concluido') return dados(c);
  const corpo = await ctx.corpo<{ sem_video_motivo?: string | null }>();
  if (c.itens.some((i) => !i.situacao)) throw new ErroDemo(422, 'tarefas_pendentes', 'Marque todas as tarefas antes de concluir.');
  if (c.itens.some((i) => i.situacao === 'nao_feito' && !i.observacao)) throw new ErroDemo(422, 'observacao_obrigatoria', 'Explique nas observações por que a tarefa não foi feita.');
  const motivo = corpo.sem_video_motivo?.trim() || null;
  if (!c.video && (!motivo || motivo.length < 3)) throw new ErroDemo(422, 'video_obrigatorio', 'Grave o vídeo da abertura ou diga por que não foi possível.');
  c.estado = 'concluido';
  c.concluido_em = new Date().toISOString();
  c.sem_video_motivo = c.video ? null : motivo;
  return dados(c);
}

async function receberVideo(ctx: Contexto) {
  const c = checklist(ctx.params[0]);
  if (c.estado === 'concluido' && c.video) throw new ErroDemo(409, 'video_ja_enviado', 'O vídeo desta abertura já foi enviado.');
  const corpo = await ctx.request.arrayBuffer();
  if (!corpo.byteLength) throw new ErroDemo(422, 'video_vazio', 'Vídeo vazio.');
  const duracao = Number(ctx.query.get('duracao'));
  c.video = { mime: ctx.request.headers.get('content-type')?.split(';')[0] || 'video/webm', tamanho_bytes: corpo.byteLength, duracao_s: Number.isFinite(duracao) && duracao > 0 ? Math.round(duracao) : null, enviado_em: new Date().toISOString() };
  return { ...dados(c), repetido: false };
}

function hoje() {
  const data = hojeFortaleza();
  const c = checklists.find((x) => x.data === data);
  return {
    data, horario_servidor: new Date().toISOString(), biometria_disponivel: false, video: { max_mb: 50, max_segundos: 120 },
    checklist: c ? dados(c) : null,
    ...(c ? {} : { tarefas: modelo.filter((t) => t.ativo).map((t) => t.titulo), funcionarios: FUNCIONARIAS.map((f) => ({ ...f, ponto_hoje: false })) }),
  };
}

export const ROTAS_PONTO: Rota[] = [
  ['GET', /^ponto\/terminal\/configuracao$/, TODOS, configuracaoTerminal],
  ['POST', /^ponto\/terminal\/sessoes$/, TODOS, () => {
    throw new ErroDemo(503, 'identificacao_automatica_desligada', 'Identificação facial desligada. Procure o gestor.');
  }],
  ...(['GET', 'POST', 'PATCH'] as const).map((metodo): Rota => [metodo, /^ponto(\/.*)?$/, null, desligado]),

  ['GET', /^abertura\/hoje$/, TODOS, hoje],
  ['POST', /^abertura\/hoje\/assumir$/, TODOS, assumir],
  ['GET', /^abertura\/modelo$/, ADMIN, () => modelo],
  ['POST', /^abertura\/modelo$/, ADMIN, async (ctx) => {
    const { titulo } = await ctx.corpo<{ titulo: string }>();
    const t = { id: uuid(), ordem: modelo.length + 1, titulo: titulo.trim(), ativo: true };
    modelo.push(t);
    return resposta(201, t);
  }],
  ['PUT', /^abertura\/modelo\/ordem$/, ADMIN, async (ctx) => {
    const { ids } = await ctx.corpo<{ ids: string[] }>();
    modelo = [...ids.map((id, i) => ({ ...modelo.find((t) => t.id === id)!, ordem: i + 1 })), ...modelo.filter((t) => !t.ativo)];
    return resposta(204, undefined);
  }],
  ['PATCH', /^abertura\/modelo\/([^/]+)$/, ADMIN, async (ctx) => {
    const t = modelo.find((x) => x.id === ctx.params[0]);
    if (!t) throw new ErroDemo(404, 'tarefa_nao_encontrada', 'Tarefa não encontrada.');
    Object.assign(t, await ctx.corpo<{ titulo?: string; ativo?: boolean }>());
    return t;
  }],
  ['GET', /^abertura$/, GERENCIA, (ctx) => {
    const de = ctx.query.get('de') ?? '';
    const ate = ctx.query.get('ate') ?? '9999';
    const itens = checklists.filter((c) => c.data >= de && c.data <= ate).map((c) => dados(c, false));
    return { itens, total: itens.length, limite: 200, deslocamento: 0 };
  }],
  ['PATCH', /^abertura\/([^/]+)$/, TODOS, salvar],
  ['POST', /^abertura\/([^/]+)\/video\/envio$/, TODOS, (ctx) => {
    const c = checklist(ctx.params[0]);
    if (c.estado === 'concluido' && c.video) throw new ErroDemo(409, 'video_ja_enviado', 'O vídeo desta abertura já foi enviado.');
    return { caminho: `/admin/abertura/${c.id}/video`, metodo: 'PUT', token: 'demonstracao', expira_em: new Date(Date.now() + 1800_000).toISOString(), max_mb: 50, max_segundos: 120 };
  }],
  ['PUT', /^abertura\/([^/]+)\/video$/, TODOS, receberVideo],
  ['POST', /^abertura\/([^/]+)\/concluir$/, TODOS, concluir],
  ['GET', /^abertura\/([^/]+)$/, GERENCIA, (ctx) => dados(checklist(ctx.params[0]))],
  ['GET', /^abertura\/([^/]+)\/video$/, GERENCIA, (ctx) => {
    if (!checklist(ctx.params[0]).video) throw new ErroDemo(404, 'sem_video', 'Esta abertura não tem vídeo.');
    return { url: null, mime: 'video/webm', expira_em: new Date(Date.now() + 600_000).toISOString() };
  }],
  ['POST', /^abertura\/([^/]+)\/confirmar-responsavel$/, GERENCIA, (ctx) => {
    const c = checklist(ctx.params[0]);
    c.confirmado_por ??= 'Proprietário (demonstração)';
    c.confirmado_em ??= new Date().toISOString();
    return dados(c);
  }],
];
