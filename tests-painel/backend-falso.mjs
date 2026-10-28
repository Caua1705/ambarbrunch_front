// Backend FALSO, só para os testes do painel no modo `api`: imita as rotas reais de login e reservas o bastante para
// provar o caminho de produção (login no backend → cookie HttpOnly → ponte com Bearer). Guarda o último Authorization
// recebido em GET /__ultimo para o teste conferir. Nunca usado fora dos testes.  node tests-painel/backend-falso.mjs 4491
import http from 'node:http';

const porta = Number(process.argv[2] ?? 4491);
const TOKEN = 'token-de-teste-nao-secreto';
let ultimo = null;
const usuario = { id: '11111111-1111-4111-8111-111111111111', nome: 'Gerente Teste', email: 'gerente@teste.invalid', papel: 'gerente', unidades: [1] };
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());

function json(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(corpo));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let corpo = '';
  for await (const parte of req) corpo += parte;
  if (url.pathname === '/saude') return json(res, 200, { status: 'ok' });
  if (url.pathname === '/__ultimo') return json(res, 200, { authorization: ultimo });
  if (url.pathname === '/admin/auth/login' && req.method === 'POST') {
    const { email, senha } = JSON.parse(corpo || '{}');
    if (email === 'gerente@teste.invalid' && senha === 'senha-certa') return json(res, 200, { token: TOKEN, tipo: 'bearer', expira_em: new Date(Date.now() + 3600_000).toISOString(), usuario });
    return json(res, 401, { detail: 'Credenciais inválidas', codigo: 'nao_autenticado' });
  }
  ultimo = req.headers.authorization ?? null;
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { detail: 'Não autenticado', codigo: 'nao_autenticado' });
  if (url.pathname === '/admin/auth/me') return json(res, 200, usuario);
  if (url.pathname === '/admin/unidades') return json(res, 200, [{ id: 1, codigo: 'ambar_cafe', nome: 'Âmbar Café', razao_social: null, cnpj: null, ativo: true }]);
  if (url.pathname === '/admin/reservas/operacao') {
    return json(res, 200, [{ id: '22222222-2222-4222-8222-222222222222', codigo: 'AMB-T1', unidade: 'ambar_cafe', ambiente_id: '33333333-3333-4333-8333-333333333333', ambiente: 'Jardim', data: url.searchParams.get('data') ?? hoje, hora: '23:30:00', duracao_min: 120, pessoas: 4, status: 'confirmada', status_reserva: 'confirmada', comparecimento: 'nao_registrado', comparecimento_registrado_em: null, comparecimento_registrado_por: null, canal: 'site', contato_nome: 'Cliente Real de Teste', contato_telefone_e164: '+5585999990000', contato_email: null, observacoes: null, importada_de: null, cancelada_em: null, motivo_cancelamento: null, fechada_em: null, criado_em: new Date().toISOString(), inicio: new Date().toISOString(), fim: new Date(Date.now() + 7200_000).toISOString(), minutos_de_atraso: null, atrasada: false, mensagens: {} }]);
  }
  if (url.pathname === '/admin/reservas') return json(res, 200, { total: 0, itens: [] });
  if (url.pathname === '/admin/reservas/ambientes') return json(res, 200, []);
  // Como a produção hoje: tudo o que não está publicado responde 404 do FastAPI.
  return json(res, 404, { detail: 'Not Found' });
}).listen(porta, '127.0.0.1', () => console.log(`backend falso em http://127.0.0.1:${porta}`));
