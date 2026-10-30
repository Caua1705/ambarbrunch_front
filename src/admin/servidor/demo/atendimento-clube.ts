// DEMONSTRAÇÃO — conversas do WhatsApp e Clube Âmbar fictícios. O Clube aparece como no backend antes do lançamento:
// inscrições fechadas e programa de pontos desligado (nada de pontos inventados).
import type { Rota } from './roteador';
import { TODOS, GERENCIA, ADMIN, ErroDemo, agoraMenos, uuid, paginar, exigirMotivo, hojeFortaleza, instante } from './roteador';
import type { ConversaDetalhe, MensagemPainel, MembroLista, MembroFicha, VendaClube, ConviteClube } from '../../lib/tipos/atendimento-clube';
import { usuarioDemo } from './sessao';
import type { Papel } from '../../lib/sessao';

// Atendimento -----------------------------------------------------------------------------------------------------------
let seqMsg = 1000;
function msg(direcao: 'entrada' | 'saida', autor: string, texto: string, minutos: number, extra: Partial<MensagemPainel> = {}): MensagemPainel {
  return { id: seqMsg++, direcao, autor, usuario_nome: null, tipo: 'texto', texto, transcricao: null, status: direcao === 'entrada' ? 'recebida' : 'lida', erro: null, intencao: null, criado_em: agoraMenos(minutos), enviada_em: direcao === 'saida' ? agoraMenos(minutos) : null, ...extra };
}

const conversas: ConversaDetalhe[] = [
  conversa('Renata Holanda', '+5585991230001', 'humano', true, 'atendimento_humano', [
    msg('entrada', 'cliente', 'Oi! Vocês fazem bolo de aniversário por encomenda?', 42),
    msg('saida', 'robo', 'Olá, Renata! Encomendas são combinadas direto com a nossa equipe. Já avisei o pessoal e alguém responde por aqui em instantes.', 41),
    msg('entrada', 'cliente', 'Seria para sábado, umas 15 pessoas 🎂', 38),
  ]),
  conversa('Marcos Sales', '+5585991230002', 'robo', false, null, [
    msg('entrada', 'cliente', 'Bom dia, até que horas abre hoje?', 25),
    msg('saida', 'robo', 'Bom dia, Marcos! Hoje estamos abertos das 8h às 14h. Quer reservar uma mesa? É só usar o link: ambarbrunch.com/reservar', 24),
    msg('entrada', 'cliente', 'Perfeito, obrigado', 20),
    msg('saida', 'robo', 'Por nada! Até já ☕', 20),
  ]),
  conversa('Paula Ximenes', '+5585991230003', 'humano', false, 'encomenda', [
    msg('entrada', 'cliente', 'Queria saber se tem opção sem glúten', 180, { tipo: 'audio', texto: null, transcricao: 'Oi, tudo bem? Queria saber se vocês têm opção sem glúten no brunch.' }),
    msg('saida', 'robo', 'Temos algumas opções, mas para restrições alimentares a equipe confirma com a cozinha. Vou chamar alguém.', 179),
    msg('saida', 'equipe', 'Oi Paula! Temos o bowl de frutas e a tapioca, preparados separados. Quer que eu reserve uma mesa?', 170, { usuario_nome: 'Gabriela Gerente (demo)' }),
    msg('entrada', 'cliente', 'Ótimo, vou reservar pelo site', 160),
  ], 'gerente'),
  conversa(null, '+5585991230004', 'robo', false, null, [
    msg('entrada', 'cliente', 'Vcs aceitam pet no jardim?', 300),
    msg('saida', 'robo', 'Aceitamos pets no Jardim, sim! 🐶', 299, { status: 'falhou', erro: 'Número sem WhatsApp ativo (131026)' }),
  ]),
  conversa('Tiago Moura', '+5585991230005', 'encerrada', false, null, [
    msg('entrada', 'cliente', 'Consigo mudar minha reserva de amanhã?', 1500),
    msg('saida', 'equipe', 'Consegue sim! Passei para as 10h30.', 1490, { usuario_nome: 'Otávio Operação (demo)' }),
    msg('entrada', 'cliente', 'Valeu!', 1485),
  ], 'operador'),
];

function conversa(nome: string | null, tel: string, modo: ConversaDetalhe['modo'], aguardando: boolean, motivo: string | null, mensagens: MensagemPainel[], atendente?: Papel): ConversaDetalhe {
  const ultima = mensagens[mensagens.length - 1];
  const ultEntrada = [...mensagens].reverse().find((m) => m.direcao === 'entrada');
  const u = atendente ? usuarioDemo(atendente) : null;
  return {
    id: uuid(), telefone_e164: tel, nome_contato: nome, modo, atendente_id: u?.id ?? null, atendente_nome: u?.nome ?? null, motivo_humano: motivo,
    ultima_entrada_em: ultEntrada?.criado_em ?? null, ultima_atividade_em: ultima.criado_em, ultima_mensagem: ultima.texto ?? ultima.transcricao,
    aguardando_equipe: aguardando, inativa: false,
    dentro_da_janela: !!ultEntrada && Date.now() - new Date(ultEntrada.criado_em).getTime() < 24 * 3600_000,
    mensagens,
  };
}

const resumoConversa = ({ mensagens, ...c }: ConversaDetalhe) => {
  void mensagens;
  return c;
};
const achar = (id: string) => {
  const c = conversas.find((x) => x.id === id);
  if (!c) throw new ErroDemo(404, 'nao_encontrado', 'Conversa não encontrada.');
  return c;
};
/** Regra de servico._assumir do backend: com outra pessoa atendendo, só com `transferir` (senão 409). */
function assumirDemo(c: ConversaDetalhe, papel: Papel, transferir: boolean) {
  const u = usuarioDemo(papel);
  if (c.modo === 'humano' && c.atendente_id === u.id) return;
  if (c.modo === 'humano' && c.atendente_id && !transferir) throw new ErroDemo(409, 'conversa_ja_assumida', 'Outra pessoa da equipe já está atendendo esta conversa.');
  Object.assign(c, { modo: 'humano', atendente_id: u.id, atendente_nome: u.nome });
  // como o backend: o que o robô ia mandar fica descartado
  for (const m of c.mensagens) if (m.autor === 'robo' && m.status === 'pendente') Object.assign(m, { status: 'descartada', erro: 'atendimento_humano' });
}
function atualizar(c: ConversaDetalhe) {
  const ultima = c.mensagens[c.mensagens.length - 1];
  c.ultima_atividade_em = ultima.criado_em;
  c.ultima_mensagem = (ultima.texto ?? ultima.transcricao ?? `[${ultima.tipo}]`).slice(0, 160);
  c.aguardando_equipe = c.modo === 'humano' && ultima.direcao === 'entrada';
  return c;
}

// Clube -----------------------------------------------------------------------------------------------------------------
const membros: (MembroLista & { email: string | null; telefoneInteiro: string })[] = [
  ['Helena Cordeiro', 'ativo', 'site', '1111'], ['Otávio Lins', 'ativo', 'convite_caixa', '2222'], ['Sofia Macedo', 'pendente', 'site', '3333'],
  ['Arthur Fernandes', 'ativo', 'convite_caixa', '4444'], ['Lívia Bastos', 'suspenso', 'site', '5555'], ['Caio Rolim', 'ativo', 'site', '6666'],
].map(([nome, estado, origem, fim], i) => ({
  cliente_id: `c0000000-0000-4000-8000-00000000000${i + 1}`, nome, telefone: `(85) •••••-${fim}`, telefoneInteiro: `+55859988${fim}`.padEnd(14, '0'), email: null,
  estado: estado as MembroLista['estado'], origem, cadastro_iniciado_em: agoraMenos(60 * 24 * (20 - i)), ativado_em: estado === 'pendente' ? null : agoraMenos(60 * 24 * (19 - i)),
  suspenso_em: estado === 'suspenso' ? agoraMenos(60 * 24 * 2) : null, marketing_autorizado: i % 2 === 0, mensagens_autorizadas: true,
}));

const vendas: VendaClube[] = [
  { id: uuid(), eye_transaction_id: '880001', data_hora: instante(hojeFortaleza(), '09:42'), total: '87.50', comanda: '14', loja: 'Âmbar', unidade_id: 1, cancelada: false, telefone: '(85) •••••-9012', telefone_situacao: 'normalizado', telefone_motivo: null, aviso: null, cliente: null, vinculo: null, candidato_membro: false, convite: { pode: true, motivo: null } },
  { id: uuid(), eye_transaction_id: '880002', data_hora: instante(hojeFortaleza(), '10:15'), total: '142.00', comanda: '22', loja: 'Âmbar', unidade_id: 1, cancelada: false, telefone: '(85) ••••-4444', telefone_situacao: 'correcao_provavel', telefone_motivo: 'nono_digito_ausente', aviso: 'CONFERIR TELEFONE', cliente: null, vinculo: null, candidato_membro: true, convite: { pode: false, motivo: 'conferir_telefone' } },
  { id: uuid(), eye_transaction_id: '880003', data_hora: instante(hojeFortaleza(), '11:03'), total: '64.90', comanda: '31', loja: 'Âmbar', unidade_id: 1, cancelada: false, telefone: '(85) •••••-1111', telefone_situacao: 'normalizado', telefone_motivo: null, aviso: null, cliente: { id: membros[0].cliente_id, nome: 'Helena Cordeiro', estado_membro: 'ativo' }, vinculo: 'telefone', candidato_membro: false, convite: { pode: false, motivo: 'ja_membro' } },
];
const convites: ConviteClube[] = [
  { id: uuid(), telefone: '(85) •••••-7788', origem: 'painel', criado_em: agoraMenos(300), criado_por: 'Otávio Operação (demo)', unidade_id: 1, expira_em: agoraMenos(-60 * 24 * 6), aberto_em: null, usado_em: null, situacao: 'aguardando', mensagem: { status: 'entregue', tentativas: 1, enviada_em: agoraMenos(299), erro: null, motivo: null } },
  { id: uuid(), telefone: '(85) •••••-2222', origem: 'venda', criado_em: agoraMenos(60 * 24 * 3), criado_por: 'Gabriela Gerente (demo)', unidade_id: 1, expira_em: agoraMenos(60 * 24 * -4), aberto_em: agoraMenos(60 * 24 * 3 - 30), usado_em: agoraMenos(60 * 24 * 3 - 25), situacao: 'usado', mensagem: { status: 'lida', tentativas: 1, enviada_em: agoraMenos(60 * 24 * 3), erro: null, motivo: null } },
];

function ficha(id: string): MembroFicha {
  const m = membros.find((x) => x.cliente_id === id);
  if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Membro não encontrado.');
  return {
    cliente: { id: m.cliente_id, nome: m.nome, telefone: m.telefoneInteiro, telefone_verificado_em: m.ativado_em, email: m.email },
    membro: { estado: m.estado, origem: m.origem, aniversario: '05-14', cadastro_iniciado_em: m.cadastro_iniciado_em, ativado_em: m.ativado_em, regulamento_versao: '2026-10', privacidade_versao: '2026-10', termos_aceitos_em: m.ativado_em, marketing_autorizado: m.marketing_autorizado, marketing_texto_versao: m.marketing_autorizado ? '2026-10' : null, marketing_atualizado_em: m.ativado_em, suspensao: m.estado === 'suspenso' ? { em: m.suspenso_em!, por: 'Gabriela Gerente (demo)', motivo: 'Cliente disse "não fui eu" pelo WhatsApp', estado_anterior: 'ativo' } : null },
    mensagens_de_servico: { autorizadas: true, origem: 'cadastro', texto_versao: '2026-10', em: m.ativado_em ?? m.cadastro_iniciado_em!, por: null, revogado_em: null, revogacao_origem: null },
    consentimentos: [{ finalidade: 'regulamento', acao: 'aceite', canal: 'site', texto_versao: '2026-10', em: m.ativado_em ?? m.cadastro_iniciado_em! }],
    pontos: { programa_ativo: false, pendente: 0, disponivel: 0, reservado: 0 },
    sessoes_ativas: m.estado === 'ativo' ? 1 : 0,
    compras: { total: vendas.filter((v) => v.cliente?.id === id).length, ultimas: vendas.filter((v) => v.cliente?.id === id) },
    convites: [],
    mensagens: [],
  };
}
const historicos = new Map<string, { em: string; acao: string; ator_tipo: string; ator: string | null; dados: unknown }[]>();

export const ROTAS_ATENDIMENTO_CLUBE: Rota[] = [
  ['GET', /^atendimento\/resumo$/, TODOS, () => ({
    por_modo: { robo: conversas.filter((c) => c.modo === 'robo').length, humano: conversas.filter((c) => c.modo === 'humano').length, encerrada: conversas.filter((c) => c.modo === 'encerrada').length },
    aguardando_equipe: conversas.filter((c) => c.aguardando_equipe).length,
    inativas: 0,
    falhas_de_envio_24h: conversas.flatMap((c) => c.mensagens).filter((m) => m.status === 'falhou').length,
  })],
  ['GET', /^atendimento\/falhas$/, TODOS, () => conversas.flatMap((c) => c.mensagens.filter((m) => m.status === 'falhou').map((m) => ({ ...m, conversa_id: c.id, nome_contato: c.nome_contato, telefone_e164: c.telefone_e164 })))],
  ['GET', /^atendimento\/conversas$/, TODOS, ({ query }) => {
    const modo = query.get('modo');
    const ag = query.get('aguardando_equipe') === 'true';
    const busca = query.get('busca')?.toLowerCase();
    if (busca !== undefined && busca.trim().length < 2) throw new ErroDemo(422, 'validacao', 'A busca precisa de pelo menos 2 caracteres.');
    return conversas
      .filter((c) => (!modo || c.modo === modo) && (!ag || c.aguardando_equipe) && (!busca || (c.nome_contato ?? '').toLowerCase().includes(busca) || c.telefone_e164.includes(busca.replace(/\D/g, '') || '§')))
      .sort((a, b) => Number(b.aguardando_equipe) - Number(a.aguardando_equipe) || b.ultima_atividade_em.localeCompare(a.ultima_atividade_em))
      .map(resumoConversa);
  }],
  ['GET', /^atendimento\/conversas\/([0-9a-f-]{36})\/mensagens$/, TODOS, () => []],
  ['GET', /^atendimento\/conversas\/([0-9a-f-]{36})$/, TODOS, ({ params }) => achar(params[0])],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/assumir$/, TODOS, async ({ params, papel, corpo }) => {
    const c = achar(params[0]);
    assumirDemo(c, papel, Boolean((await corpo<{ transferir?: boolean } | null>())?.transferir));
    return atualizar(c);
  }],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/responder$/, TODOS, async ({ params, papel, corpo }) => {
    const c = achar(params[0]);
    const { texto } = await corpo<{ texto: string }>();
    if (!texto?.trim()) throw new ErroDemo(422, 'regra_violada', 'Escreva a resposta.');
    // como o backend: responder também assume (e pausa o robô) antes de conferir a janela de 24 h
    assumirDemo(c, papel, false);
    if (!c.dentro_da_janela) throw new ErroDemo(409, 'fora_da_janela_24h', 'Passaram 24 h da última mensagem do cliente: a Meta só aceita template. Fale com o cliente por telefone.');
    const u = usuarioDemo(papel);
    // DEMONSTRAÇÃO: nada é enviado — a mensagem só entra na lista local.
    c.mensagens.push(msg('saida', 'equipe', texto.trim().slice(0, 2000), 0, { usuario_nome: u.nome, status: 'enviada' }));
    return atualizar(c);
  }],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/devolver$/, TODOS, ({ params }) => atualizar(Object.assign(achar(params[0]), { modo: 'robo', atendente_id: null, atendente_nome: null, motivo_humano: null }))],
  ['POST', /^atendimento\/conversas\/([0-9a-f-]{36})\/encerrar$/, TODOS, ({ params }) => atualizar(Object.assign(achar(params[0]), { modo: 'encerrada', atendente_id: null, atendente_nome: null, motivo_humano: null }))],

  ['GET', /^clube\/resumo$/, TODOS, () => ({
    inscricoes_abertas: false, programa_ativo: false, credito_automatico: false,
    membros: { pendente: membros.filter((m) => m.estado === 'pendente').length, ativo: membros.filter((m) => m.estado === 'ativo').length, suspenso: membros.filter((m) => m.estado === 'suspenso').length, encerrado: 0 },
    convites_aguardando: convites.filter((c) => c.situacao === 'aguardando').length, mensagens_falhas_7_dias: 0,
    pendencias: { vendas_com_telefone_sem_cliente_verificado: 1, vendas_com_telefone_correcao_provavel: 1, vendas_com_telefone_invalido: 0, vendas_so_com_documento: 0, eventos_de_venda_sem_processar: 0, membros_pendentes_com_pontos: 0 },
  })],
  ['GET', /^clube\/membros$/, TODOS, ({ query }) => {
    const estado = query.get('estado');
    const busca = query.get('busca')?.toLowerCase();
    return paginar(membros.filter((m) => (!estado || m.estado === estado) && (!busca || (m.nome ?? '').toLowerCase().includes(busca) || m.telefone.endsWith(busca))).map(({ email, telefoneInteiro, ...m }) => { void email; void telefoneInteiro; return m; }), query);
  }],
  ['GET', /^clube\/membros\/([0-9a-f-]{36})$/, TODOS, ({ params }) => ficha(params[0])],
  ['GET', /^clube\/membros\/([0-9a-f-]{36})\/historico$/, TODOS, ({ params }) => [...(historicos.get(params[0]) ?? []), { em: membros.find((m) => m.cliente_id === params[0])?.cadastro_iniciado_em ?? agoraMenos(1), acao: 'iniciar_cadastro', ator_tipo: 'cliente', ator: null, dados: null }]],
  ['POST', /^clube\/membros\/([0-9a-f-]{36})\/suspender$/, GERENCIA, async ({ params, corpo, papel }) => {
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    const m = membros.find((x) => x.cliente_id === params[0]);
    if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Membro não encontrado.');
    if (m.estado !== 'suspenso') {
      m.estado = 'suspenso';
      m.suspenso_em = new Date().toISOString();
      historicos.set(m.cliente_id, [{ em: m.suspenso_em, acao: 'suspender', ator_tipo: 'usuario', ator: usuarioDemo(papel).nome, dados: { motivo } }, ...(historicos.get(m.cliente_id) ?? [])]);
    }
    return { ok: true };
  }],
  ['POST', /^clube\/membros\/([0-9a-f-]{36})\/reativar$/, ADMIN, async ({ params, corpo, papel }) => {
    const { motivo } = await corpo<{ motivo: string }>();
    exigirMotivo(motivo);
    const m = membros.find((x) => x.cliente_id === params[0]);
    if (!m) throw new ErroDemo(404, 'nao_encontrado', 'Membro não encontrado.');
    m.estado = 'ativo';
    m.suspenso_em = null;
    historicos.set(m.cliente_id, [{ em: new Date().toISOString(), acao: 'reativar', ator_tipo: 'usuario', ator: usuarioDemo(papel).nome, dados: { motivo } }, ...(historicos.get(m.cliente_id) ?? [])]);
    return { ok: true };
  }],
  ['POST', /^clube\/membros\/([0-9a-f-]{36})\/sessoes\/revogar$/, GERENCIA, async ({ corpo }) => {
    exigirMotivo((await corpo<{ motivo: string }>()).motivo);
    return { revogadas: 1 };
  }],
  ['GET', /^clube\/vendas$/, TODOS, ({ query }) => {
    const s = query.get('situacao') ?? 'todas';
    return paginar(vendas.filter((v) => s === 'todas' || (s === 'sem_cliente' && !v.cliente && v.telefone_situacao === 'normalizado') || (s === 'conferir_telefone' && v.aviso) || (s === 'ligadas' && v.cliente)), query);
  }],
  ['POST', /^clube\/vendas\/([0-9a-f-]{36})\/confirmar-telefone$/, GERENCIA, async ({ params, corpo }) => {
    exigirMotivo((await corpo<{ motivo: string }>()).motivo);
    const v = vendas.find((x) => x.id === params[0]);
    if (!v) throw new ErroDemo(404, 'nao_encontrado', 'Venda não encontrada.');
    if (!v.candidato_membro) throw new ErroDemo(409, 'sem_candidato', 'O número corrigido não é de nenhum membro.');
    Object.assign(v, { cliente: { id: membros[3].cliente_id, nome: membros[3].nome, estado_membro: 'ativo' }, vinculo: 'telefone_conferido', aviso: null, convite: { pode: false, motivo: 'ja_membro' } });
    return { ok: true };
  }],
  ['GET', /^clube\/convites$/, TODOS, ({ query }) => paginar(convites.filter((c) => !query.get('situacao') || c.situacao === query.get('situacao')), query)],
  ['GET', /^clube\/mensagens$/, TODOS, ({ query }) => paginar([], query)],
];
