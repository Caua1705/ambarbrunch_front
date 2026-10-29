// Backend FALSO, só para os testes do painel no modo `api`: imita as rotas reais de login e reservas o bastante para
// provar o caminho de produção (login no backend → cookie HttpOnly → ponte com Bearer). Guarda o último Authorization
// recebido em GET /__ultimo para o teste conferir. Nunca usado fora dos testes.  node tests-painel/backend-falso.mjs 4491
import http from 'node:http';

const porta = Number(process.argv[2] ?? 4491);
const TOKEN = 'token-de-teste-nao-secreto';
let ultimo = null;
let revogado = false;
let ipDoLogin = null;
const usuario = { id: '11111111-1111-4111-8111-111111111111', nome: 'Gerente Teste', email: 'gerente@teste.invalid', papel: 'gerente', unidades: [1] };
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());

// Cenário do Modo Operação: um dia de movimento em volta de um instante (nomes fictícios, só deste teste).
const controle = { patches: [], falhar: false, expirar: false };
let cenario = null;
const AMBIENTES = [['Jardim', 20], ['Salão', 30], ['Lounge', 15], ['Sala Privativa', 20]].map(([nome, cap], i) => ({ id: `a0000000-0000-4000-8000-00000000000${i + 1}`, unidade: 'ambar_cafe', codigo: nome.toLowerCase().replace(/\W+/g, '_'), nome, capacidade_max: cap, duracao_min: 180, ativo: true }));
function montarCenario(base) {
  const fmt = (d, o) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', ...o }).format(d);
  const data = fmt(base, { year: 'numeric', month: '2-digit', day: '2-digit' });
  // [minutos em relação à base, nome, pessoas, ambiente, status, observação, atrasada]
  const linhas = [
    [-150, 'Helena Teste Martins', 2, 0, 'compareceu'],
    [-120, 'Otávio Teste Ramos', 4, 1, 'compareceu', 'Aniversário — trazer vela'],
    [-200, 'Rita Teste Gomes', 3, 2, 'confirmada'],
    [-35, 'Marcos Teste Viana', 5, 0, 'confirmada', null, true],
    [-5, 'Clara Teste Nunes', 2, 1, 'lembrada'],
    [10, 'Joana Teste Prado', 6, 3, 'confirmada', 'Uma pessoa celíaca'],
    [20, 'Caio Teste Duarte', 2, 2, 'pendente'],
    [25, 'Lia Teste Moura', 4, 0, 'reconfirmada'],
    [80, 'Bruno Teste Sales', 8, 1, 'confirmada', 'Cadeira para bebê'],
    [140, 'Sofia Teste Lima', 2, 2, 'cancelada'],
    [170, 'Davi Teste Rocha', 3, 0, 'confirmada'],
  ];
  return linhas.map(([min, nome, pessoas, amb, status, obs = null, atrasada = false], i) => {
    const inicio = new Date(base.getTime() + min * 60_000);
    const a = AMBIENTES[amb];
    return {
      id: `c0000000-0000-4000-8000-0000000000${String(i + 10)}`, codigo: `AMB-C${i}`, unidade: 'ambar_cafe', ambiente_id: a.id, ambiente: a.nome, data,
      hora: `${fmt(inicio, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}:00`, duracao_min: 180, pessoas, status, canal: i % 3 ? 'site' : 'whatsapp',
      contato_nome: nome, contato_telefone_e164: null, contato_email: null, observacoes: obs, importada_de: null,
      cancelada_em: status === 'cancelada' ? base.toISOString() : null, motivo_cancelamento: null,
      fechada_em: status === 'compareceu' ? new Date(inicio.getTime() + 4 * 60_000).toISOString() : null, criado_em: base.toISOString(),
      inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 180 * 60_000).toISOString(),
      minutos_de_atraso: atrasada ? -min : null, atrasada, mensagens: {},
    };
  });
}

function json(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(corpo));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let corpo = '';
  for await (const parte of req) corpo += parte;
  if (url.pathname === '/saude') return json(res, 200, { status: 'ok' });
  if (url.pathname === '/__ultimo') return json(res, 200, { authorization: ultimo, ip_do_login: ipDoLogin, revogado, patches: controle.patches });
  if (url.pathname === '/__controle' && req.method === 'POST') {
    // ?cenario=<instante ISO> monta um dia de movimento em volta desse instante; ?cenario= (vazio) volta ao padrão
    if (url.searchParams.has('cenario')) cenario = url.searchParams.get('cenario') ? montarCenario(new Date(url.searchParams.get('cenario'))) : null;
    if (url.searchParams.has('falhar')) controle.falhar = true;
    if (url.searchParams.has('expirar')) controle.expirar = true;
    if (url.searchParams.has('zerar')) controle.patches = [];
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/admin/auth/login' && req.method === 'POST') {
    // IP de quem entra: só vale com a chave do painel (o backend real ignora sem ela).
    ipDoLogin = req.headers['x-ambar-painel-chave'] === 'chave-do-painel-de-teste-com-40-caracteres!!' ? (req.headers['x-ambar-cliente-ip'] ?? null) : null;
    revogado = false;
    const { email, senha } = JSON.parse(corpo || '{}');
    if (email === 'gerente@teste.invalid' && senha === 'senha-certa') return json(res, 200, { token: TOKEN, tipo: 'bearer', expira_em: new Date(Date.now() + 3600_000).toISOString(), usuario });
    return json(res, 401, { detail: 'Credenciais inválidas', codigo: 'nao_autenticado' });
  }
  ultimo = req.headers.authorization ?? null;
  if (req.headers.authorization !== `Bearer ${TOKEN}` || revogado) return json(res, 401, { detail: 'Não autenticado', codigo: 'nao_autenticado' });
  if (url.pathname === '/admin/auth/sair' && req.method === 'POST') {
    revogado = true;      // como o backend real: o token deixa de valer no servidor
    res.writeHead(204);
    return res.end();
  }
  if (url.pathname === '/admin/auth/me') return json(res, 200, usuario);
  if (url.pathname === '/admin/unidades') return json(res, 200, [{ id: 1, codigo: 'ambar_cafe', nome: 'Âmbar Café', razao_social: null, cnpj: null, ativo: true }]);
  // Modo Operação: chegada como na produção de hoje (sem PUT …/comparecimento → PATCH …/status), com contagem, demora,
  // falha e sessão vencida sob demanda.
  if (/^\/admin\/reservas\/[0-9a-f-]{36}\/comparecimento$/.test(url.pathname) && req.method === 'PUT') return json(res, 404, { detail: 'Not Found' });
  const status = /^\/admin\/reservas\/([0-9a-f-]{36})\/status$/.exec(url.pathname);
  if (status && req.method === 'PATCH') {
    controle.patches.push(JSON.parse(corpo || '{}'));
    await new Promise((r) => setTimeout(r, 400));
    if (controle.expirar) {
      controle.expirar = false;
      revogado = true;
      return json(res, 401, { detail: 'Não autenticado', codigo: 'nao_autenticado' });
    }
    if (controle.falhar) {
      controle.falhar = false;
      return json(res, 503, { detail: 'O sistema do Âmbar está em manutenção. Tente de novo em instantes.', codigo: 'indisponivel' });
    }
    const r = cenario?.find((x) => x.id === status[1]);
    if (!r) return json(res, 404, { detail: 'Reserva não encontrada.', codigo: 'nao_encontrado' });
    const { status: novo } = JSON.parse(corpo || '{}');
    if (r.status !== novo) Object.assign(r, { status: novo, fechada_em: new Date().toISOString(), atrasada: false, minutos_de_atraso: null });
    return json(res, 200, r);
  }
  if (url.pathname === '/admin/reservas/operacao' && cenario) return json(res, 200, cenario);
  if (url.pathname === '/admin/reservas/ambientes' && cenario) return json(res, 200, AMBIENTES);
  if (url.pathname === '/admin/reservas/operacao') {
    return json(res, 200, [{ id: '22222222-2222-4222-8222-222222222222', codigo: 'AMB-T1', unidade: 'ambar_cafe', ambiente_id: '33333333-3333-4333-8333-333333333333', ambiente: 'Jardim', data: url.searchParams.get('data') ?? hoje, hora: '23:30:00', duracao_min: 120, pessoas: 4, status: 'confirmada', status_reserva: 'confirmada', comparecimento: 'nao_registrado', comparecimento_registrado_em: null, comparecimento_registrado_por: null, canal: 'site', contato_nome: 'Cliente Real de Teste', contato_telefone_e164: '+5585999990000', contato_email: null, observacoes: null, importada_de: null, cancelada_em: null, motivo_cancelamento: null, fechada_em: null, criado_em: new Date().toISOString(), inicio: new Date().toISOString(), fim: new Date(Date.now() + 7200_000).toISOString(), minutos_de_atraso: null, atrasada: false, mensagens: {} }]);
  }
  if (url.pathname === '/admin/reservas') return json(res, 200, { total: 0, itens: [] });
  if (url.pathname === '/admin/reservas/ambientes') return json(res, 200, []);
  // Como a produção hoje: tudo o que não está publicado responde 404 do FastAPI.
  return json(res, 404, { detail: 'Not Found' });
}).listen(porta, '127.0.0.1', () => console.log(`backend falso em http://127.0.0.1:${porta}`));
