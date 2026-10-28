// Experiência completa do Clube (2026-10-23) — landing, /clube/entrar, /clube/cadastro, /clube/ativar e a área do membro
// (/clube/conta, /historico, /recompensas) — no build SÓ DE TESTES (:4322, dist-sim, PUBLIC_CLUBE_MODO=api apontando para um
// endereço .invalid). A API é interceptada aqui pelo Playwright, imitando o contrato FINAL do backend (giardini_back,
// CLUBE.md §4 e §9, commit e410da2): sessão em cookie HttpOnly (aqui, guardada do lado do “servidor” falso e mantida ao
// recarregar a página), `X-Ambar-Csrf: 1` em tudo que muda algo (sem ele, 403 origem_invalida), `Authorization` = 401,
// erros no formato do FastAPI, campo desconhecido = 422 (extra=forbid), nome obrigatório no 1º envio.
// Um script de teste registra como cada fetch foi chamado, para conferir o `credentials: "include"`.
// Nada sai da máquina e nada disso existe no site publicado.
// Cenários pelo final do número: …0001 membro ativo · …0002 cadastro incompleto (falta só o aceite) · …0003 conta
// suspensa pela gerência (403 conta_suspensa no código, no convite e em toda rota com sessão — b0b0553) · outros, novo.
// GET /clube/me/movimentos imita o livro real (cursor `antesDe`, 20 por página; vazio com o programa desligado).
import { test, expect, type Page, type Route } from '@playwright/test';
import { CLUBE_NA_HOME, MOTIVO_CLUBE_OCULTO } from '../clube-home';
import AxeBuilder from '@axe-core/playwright';

const SITE = 'http://127.0.0.1:4322';
const API = 'http://clube-api.teste.invalid';
const CORS = {
  'access-control-allow-origin': SITE, 'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'content-type, idempotency-key, x-ambar-csrf', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Registro { rota: string; busca: string; metodo: string; corpo: Record<string, unknown> | null; auth?: string; csrf?: string; chave?: string }
type Pendente = { nome: string | null; aniversario: string | null; faltam: string[]; marketing: { autorizado: boolean } };

/** API falsa com o formato do contrato real. Devolve o registro das chamadas. */
async function apiFalsa(page: Page, opcoes: { inscricoesAbertas?: boolean; versaoNova?: boolean; sessaoVenceAntesDeConcluir?: number; reenvioEm?: number; foraDoAr?: boolean; programaAtivo?: boolean; movimentos?: number } = {}) {
  let vencerSessao = opcoes.sessaoVenceAntesDeConcluir ?? 0;
  /** preferências de comunicação de cada número (final de 4 dígitos) */
  const prefs = new Map<string, { marketing: boolean; mensagens: boolean }>();
  const chamadas: Registro[] = [];
  /** a “sessão do cookie”: o telefone com código confirmado (sobrevive a recarregar a página, como o cookie) */
  let sessao: string | null = null;
  /** “ativacao” = sessão limitada do convite (só concluir o cadastro) */
  let escopo: 'completa' | 'ativacao' = 'completa';
  /** convites do caixa (caminho A): token → telefone; usados viram 410 */
  const CONVITES: Record<string, string> = { 'conv-novo': '85977770011', 'conv-incompleto': '85988880002', 'conv-ativo': '85988880001', 'conv-suspenso': '85988880003' };
  /** contas suspensas pela gerência (final de 4 dígitos) */
  const suspensos = new Set<string>(['0003']);
  const usados = new Set<string>();
  /** a sessão de ativação nunca mostra dados já gravados */
  const vistaAtivacao = (c: Pendente) => ({ situacao: 'ativacao', cadastro: { nome: null, aniversario: null, faltam: c.faltam, marketing: { autorizado: false } }, membro: null });
  const pendentes = new Map<string, Pendente>();
  const membros = new Map<string, string>([['0001', 'Maria Clara'], ['0003', 'Conta Suspensa']]);
  let versaoRecusada = false;
  const json = (r: Route, status: number, body?: unknown) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  const suspensa = (r: Route) => json(r, 403, { detail: 'Sua conta do Clube Âmbar está suspensa. Fale com a equipe do Âmbar.', codigo: 'conta_suspensa' });
  const membro = (fim: string, nome: string, autorizado: boolean) => {
    const p = prefs.get(fim) ?? { marketing: autorizado, mensagens: true };
    return { nome, telefone: `(85) •••••-${fim}`, aniversario: fim === '0001' ? '02-07' : null, membroDesde: '2026-10-23', marketing: { autorizado: p.marketing }, mensagens: { autorizado: p.mensagens }, programa: opcoes.programaAtivo ? { ativo: true, saldo: { pendente: 12, disponivel: 80, reservado: 0 } } : { ativo: false, saldo: null } };
  };
  /** o livro de pontos de mentira: ids N..1, do mais novo */
  const linha = (id: number) => ({ id, tipo: id % 4 === 0 ? 'estorno' : 'compra', em: new Date(Date.UTC(2026, 10, 1 + (id % 28), 12)).toISOString(), pontos: id % 4 === 0 ? -5 : 10 + id, situacao: id % 4 === 0 ? null : id > 20 ? 'pendente' : 'disponivel', liberarEm: id > 20 && id % 4 ? '2026-12-05T12:00:00Z' : null, expiraEm: null, compra: { data: '2026-11-01', valor: '45.90' } });
  /** 422 no formato do FastAPI (sem chave `campos`) */
  const campo = (r: Route, nome: string, msg: string, codigo?: string) => json(r, 422, { detail: [{ loc: ['body', nome], msg, type: codigo ?? 'value_error' }], ...(codigo ? { codigo } : {}) });
  const ADESAO = ['nome', 'aniversario', 'aceiteRegulamento', 'regulamentoVersao', 'privacidadeVersao', 'marketing', 'origem'];
  const situacao = (tel: string) => {
    const fim = tel.slice(-4);
    if (membros.has(fim)) return { situacao: 'membro', membro: membro(fim, membros.get(fim)!, fim === '0001'), cadastro: null };
    if (!pendentes.has(fim)) pendentes.set(fim, fim === '0002' ? { nome: 'João Pedro', aniversario: '03-14', faltam: ['aceite'], marketing: { autorizado: true } } : { nome: null, aniversario: null, faltam: ['nome', 'aceite'], marketing: { autorizado: false } });
    return { situacao: 'cadastro', cadastro: pendentes.get(fim), membro: null };
  };
  await page.addInitScript(() => {
    const w = window as unknown as { __fetches: { url: string; credentials?: string }[] };
    w.__fetches = [];
    const original = window.fetch.bind(window);
    window.fetch = (entrada, init) => { w.__fetches.push({ url: String(entrada), credentials: init?.credentials }); return original(entrada, init); };
  });
  await page.route(`${API}/**`, async (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const rota = new URL(req.url()).pathname;
    const corpo = req.postDataJSON?.() ?? null;
    const h = req.headers();
    chamadas.push({ rota, busca: new URL(req.url()).search, metodo: req.method(), corpo, auth: h.authorization, csrf: h['x-ambar-csrf'], chave: h['idempotency-key'] });
    // como o backend: o token antigo no cabeçalho é recusado; mudança sem o cabeçalho anti-CSRF também
    if (h.authorization) return json(r, 401, { detail: 'Entre de novo.', codigo: 'sessao_invalida' });
    if (req.method() !== 'GET' && h['x-ambar-csrf'] !== '1') return json(r, 403, { detail: 'Origem inválida.', codigo: 'origem_invalida' });
    if (opcoes.foraDoAr) return json(r, 503, { detail: 'O Clube está indisponível no momento. Tente mais tarde.', codigo: 'indisponivel' });
    // conta suspensa: toda rota com sessão responde 403 e o backend revoga a sessão (a próxima chamada é 401)
    if (sessao && suspensos.has(sessao.slice(-4)) && (rota.startsWith('/clube/me') || rota === '/clube/adesoes')) { sessao = null; return suspensa(r); }
    if (rota === '/clube/config') return json(r, 200, { inscricoesAbertas: opcoes.inscricoesAbertas ?? true, programaAtivo: !!opcoes.programaAtivo, regulamento: { versao: 'r1', url: 'https://ambar.teste/regulamento' }, privacidade: { versao: 'p1', url: 'https://ambar.teste/privacidade' }, marketing: { textoVersao: 'm1' }, codigo: { digitos: 6, validadeS: 600 } });
    if (rota === '/clube/me') {
      if (!sessao) return json(r, 401, { detail: 'Entre de novo.', codigo: 'sessao_invalida' });
      if (escopo === 'ativacao') {
        const s = situacao(sessao);
        return s.situacao === 'membro' ? json(r, 401, { detail: 'Entre com o código.', codigo: 'entrar_com_codigo' }) : json(r, 200, vistaAtivacao(s.cadastro as Pendente));
      }
      return json(r, 200, situacao(sessao));
    }
    if (rota === '/clube/convites/ativar') {
      if (req.method() !== 'POST') return json(r, 405, { detail: 'Método não permitido.' });
      const token = String(corpo?.convite ?? '');
      const tel = CONVITES[token];
      if (!tel || usados.has(token)) return json(r, 410, { detail: 'Este link venceu ou já foi usado.', codigo: 'link_expirado' });
      usados.add(token);
      if (suspensos.has(tel.slice(-4))) return suspensa(r);
      const s = situacao(tel);
      if (s.situacao === 'membro') return json(r, 200, { situacao: 'entrar', membro: null, cadastro: null });   // sem cookie
      sessao = tel; escopo = 'ativacao';   // Set-Cookie de ativação (30 min)
      return json(r, 200, vistaAtivacao(s.cadastro as Pendente));
    }
    if (rota === '/clube/me/marketing') {
      if (req.method() !== 'PUT') return json(r, 405, { detail: 'Método não permitido.' });
      if (!sessao || escopo !== 'completa') return json(r, 401, { detail: 'Entre de novo.', codigo: 'sessao_invalida' });
      if (corpo?.textoVersao !== 'm1') return json(r, 409, { detail: 'O texto mudou.', codigo: 'versao_desatualizada' });
      const s = situacao(sessao) as { membro: { mensagens: { autorizado: boolean } } };
      prefs.set(sessao.slice(-4), { marketing: !!corpo?.autorizado, mensagens: s.membro.mensagens.autorizado });
      return json(r, 200, situacao(sessao));
    }
    if (rota === '/clube/me/mensagens') {
      if (req.method() !== 'DELETE') return json(r, 405, { detail: 'Método não permitido.' });
      if (!sessao || escopo !== 'completa') return json(r, 401, { detail: 'Entre de novo.', codigo: 'sessao_invalida' });
      const s = situacao(sessao) as { membro: { marketing: { autorizado: boolean } } };
      prefs.set(sessao.slice(-4), { marketing: s.membro.marketing.autorizado, mensagens: false });
      return r.fulfill({ status: 204, headers: CORS });
    }
    if (rota === '/clube/me/movimentos') {
      if (!sessao || escopo !== 'completa') return json(r, 401, { detail: 'Entre com o código.', codigo: 'entrar_com_codigo' });
      if (!opcoes.programaAtivo) return json(r, 200, { programaAtivo: false, saldo: null, itens: [], proximo: null });
      const antes = Number(new URL(req.url()).searchParams.get('antesDe') ?? Infinity);
      const ids = Array.from({ length: opcoes.movimentos ?? 0 }, (_, i) => (opcoes.movimentos ?? 0) - i).filter((id) => id < antes);
      const pagina = ids.slice(0, 20);
      return json(r, 200, { programaAtivo: true, saldo: { pendente: 12, disponivel: 80, reservado: 0 }, itens: pagina.map(linha), proximo: ids.length > 20 ? pagina.at(-1) : null });
    }
    if (rota === '/clube/sair') { sessao = null; return r.fulfill({ status: 204, headers: CORS }); }
    if (rota === '/clube/acesso') {
      const tel = String(corpo?.telefone ?? '');
      return json(r, 202, { desafioId: `d-${tel}`, canal: 'whatsapp', destino: `(${tel.slice(0, 2)}) •••••-${tel.slice(-4)}`, reenvioEm: opcoes.reenvioEm ?? 0, expiraEm: '2030-01-01T00:00:00Z' });
    }
    if (rota === '/clube/acesso/verificar') {
      const tel = String(corpo?.desafioId ?? '').slice(2);
      if (corpo?.codigo === '000000') return json(r, 410, { detail: 'Este código venceu. Peça um novo.', codigo: 'codigo_expirado' });
      if (corpo?.codigo !== '123456') return campo(r, 'codigo', 'Código incorreto. Confira e tente de novo.', 'codigo_incorreto');
      if (suspensos.has(tel.slice(-4))) return suspensa(r);   // o código é gasto; nenhuma sessão
      sessao = tel; escopo = 'completa';   // Set-Cookie
      return json(r, 200, { ...situacao(tel), sessao: { expiraEm: '2026-11-22T23:00:00Z' } });
    }
    if (rota === '/clube/adesoes') {
      if (vencerSessao > 0) { vencerSessao -= 1; sessao = null; }
      if (!sessao) return json(r, 401, { detail: 'Entre de novo.', codigo: 'sessao_invalida' });
      const fim = sessao.slice(-4);
      const c = pendentes.get(fim)!;
      // como o backend: campo desconhecido ou origem que não é texto = 422
      const intruso = Object.keys(corpo ?? {}).find((k) => !ADESAO.includes(k));
      if (intruso) return campo(r, intruso, 'Extra inputs are not permitted', 'extra_forbidden');
      if (corpo?.origem !== undefined && typeof corpo.origem !== 'string') return campo(r, 'origem', 'Input should be a valid string', 'string_type');
      if (corpo?.aceiteRegulamento && !(corpo.regulamentoVersao && corpo.privacidadeVersao)) return campo(r, 'aceiteRegulamento', 'O aceite precisa das versões.');
      if (!c.nome && !corpo?.nome) return campo(r, 'nome', 'Informe seu nome.', 'nome_obrigatorio');
      if (opcoes.versaoNova && !versaoRecusada) { versaoRecusada = true; return json(r, 409, { detail: 'O texto mudou.', codigo: 'versao_desatualizada' }); }
      const nome = (corpo?.nome as string | undefined) ?? c.nome;
      const faltam = [...(nome ? [] : ['nome']), ...(c.faltam.includes('aceite') && !corpo?.aceiteRegulamento ? ['aceite'] : [])];
      if (faltam.length) { pendentes.set(fim, { ...c, nome, faltam }); return json(r, 200, escopo === 'ativacao' ? vistaAtivacao(pendentes.get(fim)!) : situacao(sessao)); }
      membros.set(fim, nome!);
      // concluído pela sessão de ativação: ela acaba (cookie apagado) e a resposta é “ativado”
      if (escopo === 'ativacao') { sessao = null; escopo = 'completa'; return json(r, 200, { situacao: 'ativado', membro: null, cadastro: null }); }
      return json(r, 200, { situacao: 'membro', membro: membro(fim, nome!, (corpo?.marketing as { autorizado?: boolean } | undefined)?.autorizado ?? c.marketing.autorizado), cadastro: null });
    }
    return json(r, 404, { detail: 'rota' });
  });
  /** a sessão vence do lado do servidor (o cookie para de valer) */
  return { chamadas, derrubarSessao: () => { sessao = null; }, suspender: (fim: string) => { suspensos.add(fim); } };
}

/** todas as chamadas à API do Clube saíram com credentials: "include" */
const tudoComCookie = (page: Page) => page.evaluate((api) => (window as unknown as { __fetches: { url: string; credentials?: string }[] }).__fetches
  .filter((f) => f.url.startsWith(api)).every((f) => f.credentials === 'include'), API);

const ficha = (page: Page) => page.locator('#cadastro .ficha');
/** landing → WhatsApp → /clube/entrar já no código (o número não é digitado de novo) */
const entrar = async (page: Page, telefone: string) => {
  await page.goto(`${SITE}/clube/#cadastro`);
  await expect(ficha(page).locator('.ticket__title')).toHaveText(/Seu lugar no Clube começa aqui/i);
  await ficha(page).getByLabel('WhatsApp').fill(telefone);
  await ficha(page).getByRole('button', { name: 'Continuar' }).click();
  await page.waitForURL(`${SITE}/clube/entrar/`);
  await expect(ficha(page).locator('.ticket__title')).toHaveText(/Confirme seu WhatsApp/i);
  return ficha(page);
};
const confirmarCodigo = async (page: Page, codigo = '123456') => {
  await page.locator('#cf-codigo').fill(codigo);
  await page.getByRole('button', { name: 'Confirmar' }).click();
};
/** login completo de um membro (…0001) até a conta */
const entrarNaConta = async (page: Page, telefone = '85988880001') => {
  await entrar(page, telefone);
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/conta/`);
  await expect(page.locator('.conta-topo__ola')).toHaveText(/Olá, Maria/);
};

// ── Landing e /clube/entrar ───────────────────────────────────────────────────────────────────────────────────────
test('entrada única: só o WhatsApp, um botão “Continuar”, sem aplicativo nem senha — e nada revela o cadastro antes do código', async ({ page }) => {
  const api = await apiFalsa(page);
  await page.goto(`${SITE}/clube/#cadastro`);
  const f = ficha(page);
  await expect(f.locator('.ticket__title')).toHaveText(/Seu lugar no Clube começa aqui/i);
  await expect(f).toContainText('Informe seu WhatsApp para entrar ou fazer parte.');
  await expect(f).toContainText('Um único acesso. Sem senha.');
  await expect(f.locator('input')).toHaveCount(1);
  await expect(f.getByLabel('WhatsApp')).toHaveAttribute('placeholder', '(85) 99999-9999');
  await expect(f.getByRole('button')).toHaveText([/^Continuar/]);
  await expect(f.getByRole('button', { name: 'Continuar', exact: true })).toHaveCount(1);   // a seta não entra no nome
  await expect(f.getByRole('button', { name: /cadastrar|entrar/i })).toHaveCount(0);
  // telefone inválido (fixo, sem WhatsApp): erro claro, nada enviado
  await f.getByLabel('WhatsApp').fill('8533334444');
  await f.getByRole('button', { name: 'Continuar' }).click();
  await expect(f.locator('#cf-telefone-erro')).toHaveText(/Informe um celular com WhatsApp: DDD e 9 dígitos/);
  await expect(f.getByLabel('WhatsApp')).toBeFocused();
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso')).toHaveLength(0);
  // membro e não membro veem exatamente a mesma tela do código
  const textos: string[] = [];
  for (const tel of ['85988880001', '85977771234']) {
    await entrar(page, tel);
    textos.push((await ficha(page).innerText()).replace(/\d{4}\b/g, '####'));
  }
  expect(textos[0]).toBe(textos[1]);
  // nada pessoal guardado: só a passagem do desafio, que é apagada ao ser lida
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage).filter((k) => k !== 'ambar:clube:origem')])).toEqual([[], []]);
});

test('/clube/entrar: da landing direto ao código, sem redigitar; reenvio com contagem; trocar número; código incorreto e vencido', async ({ page }) => {
  const api = await apiFalsa(page, { reenvioEm: 2 });
  const f = await entrar(page, '(85) 97777-1234');
  await expect(f.locator('.ficha__destino')).toHaveText('(85) •••••-1234');
  await expect(f.locator('#cf-telefone')).toHaveCount(0);
  // o número digitado na landing não foi junto (só o destino mascarado do desafio)
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso')).toHaveLength(1);
  // reenvio: contagem e depois o botão
  await expect(f.getByRole('button', { name: /Reenviar em/ })).toBeDisabled();
  await expect(f.getByRole('button', { name: 'Reenviar código' })).toBeEnabled({ timeout: 5000 });
  // código errado e vencido: mensagens claras, segue na mesma etapa
  await confirmarCodigo(page, '111111');
  await expect(page.locator('#cf-codigo-erro')).toHaveText('Código incorreto. Confira e tente de novo.');
  await confirmarCodigo(page, '000000');
  await expect(page.locator('#cf-codigo-erro')).toHaveText('Este código venceu. Peça um novo.');   // texto do backend
  // trocar número: volta ao WhatsApp nesta mesma tela
  await f.getByRole('button', { name: 'Trocar número' }).click();
  await expect(f.getByLabel('WhatsApp')).toBeFocused();
  await expect(f.locator('.ticket__title')).toHaveText('Acesse o Clube Âmbar');
  await f.getByLabel('WhatsApp').fill('85977779999');
  await f.getByRole('button', { name: 'Continuar' }).click();
  await expect(f.locator('.ficha__destino')).toHaveText('(85) •••••-9999');
  expect(await tudoComCookie(page)).toBe(true);
});

test('/clube/entrar: sessão vencida avisa; indisponível oferece tentar de novo', async ({ page }) => {
  await apiFalsa(page);
  await page.goto(`${SITE}/clube/entrar/?motivo=sessao`);
  await expect(ficha(page).locator('.ticket__status[role="status"]')).toHaveText(/sessão terminou/);
  await expect(ficha(page).getByLabel('WhatsApp')).toBeVisible();
  const p2 = await page.context().newPage();
  await apiFalsa(p2, { foraDoAr: true });
  await p2.goto(`${SITE}/clube/entrar/`);
  await expect(ficha(p2).locator('.ticket__title')).toHaveText('Não deu certo agora');
  await expect(ficha(p2).locator('.ticket__status[data-tone="error"]')).toHaveText(/indisponível/);
  await expect(ficha(p2).getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
});

// ── Cadastro ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('cliente novo: código → /clube/cadastro → nome, aniversário, aceite e novidades → “Você faz parte do Clube Âmbar!” → conta', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrar(page, '(85) 97777-1234');
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/cadastro/`);
  const f = ficha(page);
  await expect(f.locator('.ticket__title')).toHaveText(/Quase lá/i);
  await expect(f.getByLabel('Nome')).toBeVisible();
  await expect(f.getByLabel(/Aniversário/)).toBeVisible();
  await expect(f.locator('#cf-aceite')).not.toBeChecked();
  await expect(f.locator('#cf-marketing')).not.toBeChecked();   // novidades: opcional e desmarcado
  // erros sem perder o que foi digitado
  await f.getByLabel(/Aniversário/).fill('3102');
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('#cf-nome-erro')).toHaveText(/chamar você/);
  await expect(f.locator('#cf-aniversario-erro')).toHaveText(/dia e mês/);
  await expect(f.locator('#cf-aceite-erro')).toHaveText(/aceite a política/);
  await expect(f.getByLabel(/Aniversário/)).toHaveValue('31/02');
  await f.getByLabel('Nome').fill('Ana Lúcia');
  await f.getByLabel(/Aniversário/).fill('2512');
  await f.locator('#cf-aceite').check();
  await f.locator('#cf-marketing').check();
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('.ticket__title')).toHaveText('Você faz parte do Clube Âmbar!');
  await expect(f.locator('.ficha__boas-vindas')).toHaveText(/Pronto, Ana!.*Cadastro concluído/s);
  // pelo site não sai WhatsApp de confirmação (só pelo convite): a tela não promete mensagem
  await expect(f).not.toContainText(/receber.*WhatsApp/i);
  const adesao = api.chamadas.find((c) => c.rota === '/clube/adesoes')!;
  expect(api.chamadas.every((c) => !c.auth)).toBe(true);
  expect(api.chamadas.filter((c) => c.metodo !== 'GET').every((c) => c.csrf === '1')).toBe(true);
  expect(await tudoComCookie(page)).toBe(true);
  expect(adesao.chave).toBeTruthy();
  expect(adesao.corpo).toEqual({ nome: 'Ana Lúcia', aniversario: '12-25', aceiteRegulamento: true, regulamentoVersao: 'r1', privacidadeVersao: 'p1', marketing: { autorizado: true, textoVersao: 'm1' } });
  expect(adesao.corpo).not.toHaveProperty('telefone');   // o telefone vem da sessão
  await f.getByRole('link', { name: 'Abrir minha conta' }).click();
  await page.waitForURL(`${SITE}/clube/conta/`);
  await expect(page.locator('.conta-topo__ola')).toHaveText(/Olá, Ana/);
});

test('cadastro incompleto: recupera o nome e pede só o aceite dos termos atuais, com os links reais', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrar(page, '85988880002');
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/cadastro/`);
  const f = ficha(page);
  await expect(f.locator('.ticket__title')).toHaveText(/Falta pouco, João/i);
  await expect(f).toContainText('Só falta confirmar os termos');
  await expect(f.getByLabel('Nome')).toHaveCount(0);
  await expect(f.getByLabel(/Aniversário/)).toHaveCount(0);
  await expect(f.locator('#cf-marketing')).toHaveCount(0);
  await expect(f.getByRole('link', { name: 'política de privacidade' })).toHaveAttribute('href', 'https://ambar.teste/privacidade');
  await expect(f.getByRole('link', { name: 'regulamento do Clube' })).toHaveAttribute('href', 'https://ambar.teste/regulamento');
  await f.locator('#cf-aceite').check();
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('.ficha__boas-vindas')).toHaveText(/Pronto, João!/);
  expect(api.chamadas.find((c) => c.rota === '/clube/adesoes')!.corpo).toEqual({ aceiteRegulamento: true, regulamentoVersao: 'r1', privacidadeVersao: 'p1' });
});

test('termos atualizados (409) e sessão vencida (401) no cadastro: nada do que foi digitado se perde', async ({ page }) => {
  await apiFalsa(page, { versaoNova: true });
  await entrar(page, '85977775678');
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/cadastro/`);
  const f = ficha(page);
  await f.getByLabel('Nome').fill('Bia');
  await f.locator('#cf-aceite').check();
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('#cf-aceite-erro')).toHaveText(/foram atualizados/);
  await expect(f.locator('#cf-aceite')).not.toBeChecked();
  await expect(f.getByLabel('Nome')).toHaveValue('Bia');
  await f.locator('#cf-aceite').check();
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('.ficha__boas-vindas')).toHaveText(/Pronto, Bia!/);
});

test('sessão vencida no meio do cadastro (401): confirma o WhatsApp ali mesmo e volta ao formulário preenchido', async ({ page }) => {
  await apiFalsa(page, { sessaoVenceAntesDeConcluir: 1 });
  await entrar(page, '85977774321');
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/cadastro/`);
  const f = ficha(page);
  await f.getByLabel('Nome').fill('Rui Lima');
  await f.locator('#cf-aceite').check();
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('.ticket__status[data-tone="error"]')).toHaveText(/Confirme o WhatsApp de novo/);
  await f.getByLabel('WhatsApp').fill('85977774321');
  await f.getByRole('button', { name: 'Continuar' }).click();
  await confirmarCodigo(page);
  await expect(f.getByLabel('Nome')).toHaveValue('Rui Lima');
  await expect(page).toHaveURL(`${SITE}/clube/cadastro/`);
});

test('/clube/cadastro sem sessão pede o WhatsApp; membro que abre o cadastro vai para a conta', async ({ page }) => {
  await apiFalsa(page);
  await page.goto(`${SITE}/clube/cadastro/`);
  await expect(ficha(page).locator('.ticket__status[role="status"]')).toHaveText(/continuar o cadastro/);
  await expect(ficha(page).getByLabel('WhatsApp')).toBeVisible();
  await entrarNaConta(page);
  await page.goto(`${SITE}/clube/cadastro/`);
  await page.waitForURL(`${SITE}/clube/conta/`);
});

// ── Conta ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('membro: o código abre a conta — saudação, cartão, programa em preparação, sem pontos nem compras inventadas', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrarNaConta(page);
  await expect(page).toHaveTitle(/Minha conta/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('.conta-topo__desde')).toHaveText('Membro do Clube Âmbar desde outubro de 2026');
  const cartao = page.locator('.carteira[data-estado="membro"]');
  await expect(cartao.locator('.carteira__nome')).toHaveText('Maria Clara');
  await expect(cartao.locator('.carteira__saldo dd')).toHaveText('em breve');
  await expect(page.locator('.conta-programa--preparo')).toContainText('Suas vantagens estão sendo preparadas');
  // histórico, recompensas e resgates: à vista, mas “em breve” enquanto não existem
  await expect(page.locator('.conta-atalho')).toHaveCount(3);
  await expect(page.locator('.conta-atalho__breve')).toHaveCount(3);
  await expect(page.locator('main')).not.toContainText(/\d+\s*pontos|R\$|desconto|grátis/i);
  // dados reais da sessão
  await expect(page.locator('.conta-dados')).toContainText('(85) •••••-0001');
  await expect(page.locator('.conta-dados')).toContainText('7 de fevereiro');
  // a sessão restaura ao recarregar, sem código
  await page.reload();
  await expect(page.locator('.conta-topo__ola')).toHaveText(/Olá, Maria/);
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso')).toHaveLength(1);
  expect(await tudoComCookie(page)).toBe(true);
});

test('conta: novidades (PUT /clube/me/marketing) e avisos (DELETE /clube/me/mensagens), com anti-CSRF', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrarNaConta(page);
  const novidades = page.getByRole('switch', { name: /Novidades e ofertas/ });
  await expect(novidades).toBeChecked();
  await novidades.uncheck();
  await expect(page.locator('.conta-bloco .ticket__status[role="status"]')).toHaveText(/desligadas/);
  await expect(novidades).not.toBeChecked();
  const put = api.chamadas.find((c) => c.rota === '/clube/me/marketing')!;
  expect(put).toMatchObject({ metodo: 'PUT', corpo: { autorizado: false, textoVersao: 'm1' }, csrf: '1' });
  // parar os avisos de serviço NÃO é uma preferência comum (não tem volta pelo site): fora do bloco de comunicação,
  // recolhido, e o aviso de que não dá para religar vem antes do botão
  const comunicacao = page.locator('.conta-bloco', { has: page.getByRole('heading', { name: 'Comunicação' }) });
  await expect(comunicacao.getByRole('button')).toHaveCount(0);
  await expect(comunicacao.getByRole('switch')).toHaveCount(1);
  const parar = page.locator('details.conta-parar');
  await expect(parar.getByRole('button', { name: 'Parar os avisos' })).toBeHidden();
  await parar.locator('summary').click();
  await expect(parar).toContainText('não dá para religar por aqui');
  expect(api.chamadas.some((c) => c.rota === '/clube/me/mensagens')).toBe(false);
  await parar.getByRole('button', { name: 'Parar os avisos' }).click();
  await expect(page.locator('.conta-mensagens')).toContainText('Desligados. O código de acesso continua chegando');
  await expect(page.locator('details.conta-parar')).toHaveCount(0);   // sem botão de religar inventado
  expect(api.chamadas.find((c) => c.rota === '/clube/me/mensagens')).toMatchObject({ metodo: 'DELETE', csrf: '1' });
  // as novidades continuam como estavam (consentimentos separados)
  await expect(novidades).not.toBeChecked();
});

test('conta sem sessão → /clube/entrar com destino seguro; depois do código, volta à seção pedida', async ({ page }) => {
  await apiFalsa(page);
  await page.goto(`${SITE}/clube/historico/`);
  await page.waitForURL(`${SITE}/clube/entrar/?volta=historico`);
  await ficha(page).getByLabel('WhatsApp').fill('85988880001');
  await ficha(page).getByRole('button', { name: 'Continuar' }).click();
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/historico/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Histórico');
  // destino fora da lista fechada: vai para a conta, nunca para outro endereço
  await page.goto(`${SITE}/clube/entrar/?volta=https://exemplo.invalid/`);
  await page.waitForURL(`${SITE}/clube/conta/`);
});

test('sessão que vence durante o uso da conta (401) → entrar de novo com aviso, voltando à conta', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrarNaConta(page);
  api.derrubarSessao();
  await page.getByRole('switch', { name: /Novidades e ofertas/ }).click();
  await page.waitForURL(`${SITE}/clube/entrar/?motivo=sessao`);
  await expect(ficha(page).locator('.ticket__status[role="status"]')).toHaveText(/sessão terminou/);
});

test('cadastro pela metade que abre a conta vai para /clube/cadastro; sair encerra e volta à landing', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrar(page, '85988880002');
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/cadastro/`);
  await page.goto(`${SITE}/clube/conta/`);
  await page.waitForURL(`${SITE}/clube/cadastro/`);
  // membro: sair da conta
  await page.locator('#cf-aceite').check();
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
  await page.getByRole('link', { name: 'Abrir minha conta' }).click();
  await page.waitForURL(`${SITE}/clube/conta/`);
  await page.getByRole('button', { name: 'Sair deste aparelho' }).click();
  await page.waitForURL(`${SITE}/clube/`);
  expect(api.chamadas.find((c) => c.rota === '/clube/sair')!.csrf).toBe('1');
  await expect(ficha(page).getByLabel('WhatsApp')).toBeVisible();
});

test('da home à conta: “Minha conta” ao lado do botão do Clube leva o membro direto à conta, sem a apresentação', async ({ page }) => {
  test.skip(!CLUBE_NA_HOME, `${MOTIVO_CLUBE_OCULTO}: com o Clube oculto, a conta segue em /clube/conta/ (testes acima)`);
  await apiFalsa(page);
  await entrarNaConta(page);
  await page.goto(`${SITE}/`);
  const atalho = page.locator('#clube').getByRole('link', { name: 'Minha conta' });
  await expect(atalho).toHaveAttribute('href', '/clube/conta/');
  await atalho.click();
  await page.waitForURL(`${SITE}/clube/conta/`);
  await expect(page.locator('.conta-topo__ola')).toHaveText(/Olá, Maria/);
  // sem sessão, o mesmo atalho leva ao login e volta para a conta
  await page.context().clearCookies();
  await page.getByRole('button', { name: 'Sair deste aparelho' }).click();
  await page.waitForURL(`${SITE}/clube/`);
  await page.goto(`${SITE}/`);
  await page.locator('#clube').getByRole('link', { name: 'Minha conta' }).click();
  await page.waitForURL(`${SITE}/clube/entrar/`);
  await expect(ficha(page).getByLabel('WhatsApp')).toBeVisible();
});

test('landing com sessão: “Olá” e “Abrir minha conta”, sem repetir a apresentação; “Minha conta” no topo', async ({ page }) => {
  await apiFalsa(page);
  await entrarNaConta(page);
  await page.goto(`${SITE}/clube/`);
  const f = ficha(page);
  await expect(f.locator('.ticket__title')).toHaveText('Olá, Maria!');
  await expect(f.getByRole('link', { name: 'Abrir minha conta' })).toHaveAttribute('href', '/clube/conta/');
  await expect(page.locator('.clube-pag__mais')).toBeHidden();
  await expect(page.locator('.page-bar').getByRole('link', { name: 'Minha conta' })).toHaveAttribute('href', '/clube/conta/');
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await f.getByRole('button', { name: 'Não é você? Sair' }).click();
  await expect(f.locator('.ticket__title')).toHaveText(/Seu lugar no Clube começa aqui/i);
});

test('histórico e recompensas: “em preparação”, sem lista, saldo, produto ou botão de resgate', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrarNaConta(page);
  for (const [rota, titulo] of [['historico', 'Histórico'], ['recompensas', 'Recompensas']]) {
    await page.goto(`${SITE}/clube/${rota}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);
    await expect(page.locator('.area-vazio--preparo')).toBeVisible();
    await expect(page.locator('.extrato, .catalogo, .recompensa, .resgate')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /resgatar/i })).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/\d+\s*pontos/i);
    await expect(page.locator(`.area-abas--base .area-aba[aria-current="page"]`)).toHaveText(titulo);
  }
  // programa desligado: o histórico nem é pedido
  expect(api.chamadas.filter((c) => c.rota === '/clube/me/movimentos')).toHaveLength(0);
});

test('histórico com o programa ativo: GET /clube/me/movimentos, agrupado por mês, com “ver anteriores” pelo cursor', async ({ page }) => {
  const api = await apiFalsa(page, { programaAtivo: true, movimentos: 25 });
  await entrarNaConta(page);
  await page.goto(`${SITE}/clube/historico/`);
  await expect(page.locator('.extrato li')).toHaveCount(20);
  await expect(page.locator('.extrato li').first()).toContainText('Compra no Âmbar');
  await expect(page.locator('.extrato li').first()).toContainText('R$ 45,90');
  await expect(page.locator('.extrato li[data-situacao="pendente"]').first()).toContainText('em liberação');
  await expect(page.locator('.extrato li[data-tipo="estorno"]').first()).toContainText('Compra cancelada');
  await page.getByRole('button', { name: 'Ver movimentações anteriores' }).click();
  await expect(page.locator('.extrato li')).toHaveCount(25);
  await expect(page.getByRole('button', { name: 'Ver movimentações anteriores' })).toHaveCount(0);
  const pedidos = api.chamadas.filter((c) => c.rota === '/clube/me/movimentos');
  expect(pedidos.map((c) => c.busca)).toEqual(['', '?antesDe=6']);
  expect(await tudoComCookie(page)).toBe(true);
});

for (const largura of [360, 390]) {
  test(`área do membro em ${largura} px: abas na base, sem rolagem horizontal, axe sem violações graves`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await apiFalsa(page);
    await entrarNaConta(page);
    await expect(page.locator('.area-abas--base')).toBeVisible();
    await expect(page.locator('.area-abas--topo')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const graves = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
      .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    expect(graves).toEqual([]);
  });
}

test('área do membro no desktop: abas no topo, conta em duas colunas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await apiFalsa(page);
  await entrarNaConta(page);
  await expect(page.locator('.area-abas--topo')).toBeVisible();
  await expect(page.locator('.area-abas--base')).toBeHidden();
  const [a, b] = await page.locator('.conta-topo, .conta__colunas').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().left));
  expect(b).toBeGreaterThan(a + 300);
});

test('inscrições fechadas na API: bilhete “em breve”, sem nenhum campo', async ({ page }) => {
  await apiFalsa(page, { inscricoesAbertas: false });
  await page.goto(`${SITE}/clube/`);
  await expect(ficha(page).locator('.ticket__title')).toHaveText(/Inscrições em breve/i);
  await expect(ficha(page).locator('input, button[type="submit"]')).toHaveCount(0);
});

// 2026-10-23 (acesso primeiro): o cartão vem logo depois do título e da frase; fotos e passos, depois dele
for (const [largura, altura] of [[360, 780], [390, 844]]) {
  test(`acesso primeiro em ${largura} × ${altura}: campo e “Continuar” na primeira tela, sem carimbo nem aviso técnico`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await apiFalsa(page);
    await page.goto(`${SITE}/clube/`);
    const f = ficha(page);
    await expect(f.locator('.ticket__title')).toHaveText('Seu lugar no Clube começa aqui.');
    const ordem = await page.locator('.clube-pag > :not(.clube-chegada)').evaluateAll((es) => es.map((e) => e.className));
    expect(ordem).toEqual(['clube-pag__cabeca', 'clube-pag__ficha', 'clube-pag__mais']);
    for (const alvo of [f.getByLabel('WhatsApp'), f.getByRole('button', { name: 'Continuar' })]) {
      expect((await alvo.boundingBox())!.y + (await alvo.boundingBox())!.height, 'visível sem rolar').toBeLessThanOrEqual(altura);
    }
    const t = await f.locator('.ticket__title').evaluate((e) => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight), caixa: getComputedStyle(e).textTransform }));
    expect(Math.round(t.h / t.lh)).toBeLessThanOrEqual(2);
    expect(t.caixa).toBe('none');
    await expect(f.locator('.ticket__stamp')).toHaveCount(0);
    await expect(page.locator('.clube-dev')).toHaveCount(0);   // o painel da simulação só existe no `astro dev`
    await expect(f).not.toContainText(/simula|teste|0001|123456/i);
    const fimFicha = (await f.boundingBox())!.y + (await f.boundingBox())!.height;
    expect((await page.locator('.clube-pag__destaques').boundingBox())!.y).toBeGreaterThan(fimFicha);
  });
}

for (const largura of [360, 390]) {
  test(`telas de acesso em ${largura} px: código e cadastro cabem sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await apiFalsa(page);
    const f = await entrar(page, '85977771234');
    const semEstouro = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await semEstouro(), 'código').toBe(true);
    await confirmarCodigo(page);
    await page.waitForURL(`${SITE}/clube/cadastro/`);
    await expect(f.getByLabel('Nome')).toBeVisible();
    expect(await semEstouro(), 'cadastro').toBe(true);
    expect(await f.evaluate((e) => [...e.querySelectorAll('input, button, .check')].every((x) => x.getBoundingClientRect().right <= e.getBoundingClientRect().right + 1))).toBe(true);
  });
}

test('acessibilidade (axe) nas telas de acesso: código, WhatsApp e cadastro com erros', async ({ page }) => {
  await apiFalsa(page);
  const graves = async () => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
    .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  const f = await entrar(page, '85977771234');
  expect(await graves(), 'código').toEqual([]);
  await f.getByRole('button', { name: 'Trocar número' }).click();
  expect(await graves(), 'WhatsApp').toEqual([]);
  // vindo da landing, o número não fica guardado: a troca começa com o campo vazio
  await expect(f.getByLabel('WhatsApp')).toHaveValue('');
  await f.getByLabel('WhatsApp').fill('85977771234');
  await f.getByRole('button', { name: 'Continuar' }).click();
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/cadastro/`);
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();   // com os erros à vista
  expect(await graves(), 'cadastro com erros').toEqual([]);
});

// ── Caminho A: convite do WhatsApp (/clube/ativar?c=<token>) ──────────────────────────────────────────────────────
const abrirConvite = async (page: Page, token: string) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(`${SITE}/clube/ativar?c=${token}`);
  await expect(ficha(page).locator('.ticket__title')).toHaveText(/Ative seu Clube Âmbar/i);
  return { ficha: ficha(page), urls };
};

test('convite (A): abrir o link não usa o convite — token fora da URL, no-referrer, só o toque chama POST', async ({ page }) => {
  const api = await apiFalsa(page);
  const { ficha: f, urls } = await abrirConvite(page, 'conv-novo');
  expect(page.url()).toBe(`${SITE}/clube/ativar`);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  expect(urls.filter((u) => u.includes('conv-novo') && !u.startsWith(`${SITE}/clube/ativar?c=`))).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __ambarConvite?: string }).__ambarConvite)).toBeUndefined();
  expect(api.chamadas.filter((c) => c.rota === '/clube/convites/ativar')).toHaveLength(0);
  await expect(f.getByRole('button', { name: 'Ativar meu Clube' })).toBeVisible();
  await expect(f.locator('input')).toHaveCount(0);
  await expect(page).toHaveTitle(/Ative seu Clube/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(f.getByLabel('Nome')).toBeVisible();
  const ativar = api.chamadas.filter((c) => c.rota === '/clube/convites/ativar');
  expect(ativar).toHaveLength(1);
  expect(ativar[0]).toMatchObject({ metodo: 'POST', corpo: { convite: 'conv-novo' }, csrf: '1' });
  expect(ativar[0].auth).toBeUndefined();
  expect(await tudoComCookie(page)).toBe(true);
});

test('convite novo: ativar → nome, aniversário, aceite e novidades → concluído, sem código; a sessão de ativação não vê a conta', async ({ page }) => {
  const api = await apiFalsa(page);
  const { ficha: f } = await abrirConvite(page, 'conv-novo');
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(f).toContainText('Convite confirmado. Agora, como podemos chamar você?');
  // a sessão de ativação não abre a carteira nem nada privado: conta, histórico e recompensas mandam de volta ao
  // cadastro; a landing não mostra nome; nenhuma preferência é alterável
  for (const rota of ['conta', 'historico', 'recompensas']) {
    await page.goto(`${SITE}/clube/${rota}/`);
    await page.waitForURL(`${SITE}/clube/cadastro/`);
    await expect(page.locator('.carteira, .conta, .conta-dados, .area-secao')).toHaveCount(0);
  }
  await page.goto(`${SITE}/clube/`);
  await expect(f.locator('.ticket__title')).toHaveText('Falta pouco');
  await expect(page.locator('main')).not.toContainText(/Olá|•••••|aniversário/i);
  expect(api.chamadas.some((c) => c.rota.startsWith('/clube/me/'))).toBe(false);
  await page.goto(`${SITE}/clube/cadastro/`);
  await expect(f).toContainText('Convite confirmado');
  await f.getByLabel('Nome').fill('Bia Torres');
  await f.getByLabel(/Aniversário/).fill('0907');
  await f.locator('#cf-aceite').check();
  await f.locator('#cf-marketing').check();
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('.ticket__title')).toHaveText('Você faz parte do Clube Âmbar!');
  await expect(f.locator('.ficha__boas-vindas')).toHaveText(/Cadastro concluído!.*confirmação no WhatsApp/s);
  await expect(f).not.toContainText(/pontos|saldo/i);
  expect(api.chamadas.some((c) => c.rota === '/clube/acesso')).toBe(false);   // nenhum código pedido
  expect(api.chamadas.find((c) => c.rota === '/clube/adesoes')!.corpo).toEqual({ nome: 'Bia Torres', aniversario: '07-09', aceiteRegulamento: true, regulamentoVersao: 'r1', privacidadeVersao: 'p1', marketing: { autorizado: true, textoVersao: 'm1' } });
  // a conta se abre pelo login normal
  await f.getByRole('link', { name: 'Entrar na minha conta' }).click();
  await page.waitForURL(`${SITE}/clube/entrar/`);
  await expect(f.getByLabel('WhatsApp')).toBeVisible();
});

test('convite incompleto: pede só o aceite — nome e aniversário já gravados não aparecem nem são enviados', async ({ page }) => {
  const api = await apiFalsa(page);
  const { ficha: f } = await abrirConvite(page, 'conv-incompleto');
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(f.locator('.ticket__title')).toHaveText(/Falta pouco/i);
  await expect(f).toContainText('Só falta aceitar os termos do Clube.');
  await expect(f.locator('#cf-nome, #cf-aniversario, #cf-marketing')).toHaveCount(0);
  await f.locator('#cf-aceite').check();
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('.ficha__boas-vindas')).toHaveText(/Cadastro concluído!/);
  expect(api.chamadas.find((c) => c.rota === '/clube/adesoes')!.corpo).toEqual({ aceiteRegulamento: true, regulamentoVersao: 'r1', privacidadeVersao: 'p1' });
});

test('convite de quem já é membro: o link não dá acesso — login por código abre a conta', async ({ page }) => {
  const api = await apiFalsa(page);
  const { ficha: f } = await abrirConvite(page, 'conv-ativo');
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(f.locator('.ticket__status[role="status"]')).toHaveText(/já faz parte do Clube.*confirme seu WhatsApp/i);
  await expect(f.locator('.ficha__boas-vindas, .carteira')).toHaveCount(0);
  await f.getByLabel('WhatsApp').fill('85988880001');
  await f.getByRole('button', { name: 'Continuar' }).click();
  await confirmarCodigo(page);
  await page.waitForURL(`${SITE}/clube/conta/`);
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso')).toHaveLength(1);
});

test('link vencido, usado ou recarregado: recuperação segura pela entrada do WhatsApp', async ({ page }) => {
  await apiFalsa(page);
  let { ficha: f } = await abrirConvite(page, 'conv-vencido');
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(f.locator('.ticket__status[data-tone="error"]')).toHaveText(/venceu ou já foi usado/);
  await expect(f.getByLabel('WhatsApp')).toBeVisible();
  ({ ficha: f } = await abrirConvite(page, 'conv-incompleto'));
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await f.getByRole('button', { name: 'Não é você? Sair' }).click();
  ({ ficha: f } = await abrirConvite(page, 'conv-incompleto'));
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(f.locator('.ticket__status[data-tone="error"]')).toHaveText(/venceu ou já foi usado/);
  ({ ficha: f } = await abrirConvite(page, 'conv-novo'));
  await page.reload();
  await expect(f.locator('.ticket__status[role="status"]')).toHaveText(/toque de novo no botão da mensagem/);
  await expect(f.getByLabel('WhatsApp')).toBeVisible();
});

test('sessão de ativação vence no meio (401): aviso do convite e entrada pelo WhatsApp', async ({ page }) => {
  await apiFalsa(page, { sessaoVenceAntesDeConcluir: 1 });
  const { ficha: f } = await abrirConvite(page, 'conv-novo');
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await f.getByLabel('Nome').fill('Rui');
  await f.locator('#cf-aceite').check();
  await f.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(f.locator('.ticket__status[data-tone="error"]')).toHaveText(/tempo para ativar pelo convite acabou/);
  await expect(f.getByLabel('WhatsApp')).toBeVisible();
});

test('aparelho compartilhado: com outra sessão aberta, o convite mostra a conta atual e oferece “Ativar o convite recebido”', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrarNaConta(page);
  await page.goto(`${SITE}/clube/ativar?c=conv-novo`);
  expect(page.url()).toBe(`${SITE}/clube/ativar`);
  const f = ficha(page);
  await expect(f.locator('.ticket__title')).toHaveText('Olá, Maria!');
  expect(api.chamadas.filter((c) => c.rota === '/clube/convites/ativar')).toHaveLength(0);
  await f.getByRole('button', { name: 'Ativar o convite recebido' }).click();
  await expect(f.getByLabel('Nome')).toBeVisible();
  await expect(f).not.toContainText('Maria');
  expect(api.chamadas.filter((c) => c.rota === '/clube/convites/ativar')).toHaveLength(1);
  await expect(f.getByRole('button', { name: 'Ativar o convite recebido' })).toHaveCount(0);
  // convite já usado com a sessão de Maria aberta: ela continua na própria conta, com o aviso
  await f.getByRole('button', { name: 'Não é você? Sair' }).click();
  await entrarNaConta(page);
  await page.goto(`${SITE}/clube/ativar?c=conv-novo`);
  await f.getByRole('button', { name: 'Ativar o convite recebido' }).click();
  await expect(f.locator('.ticket__status[data-tone="error"]')).toHaveText(/venceu ou já foi usado/);
  await expect(f.locator('.ticket__title')).toHaveText('Olá, Maria!');
  await expect(f.getByRole('button', { name: 'Ativar o convite recebido' })).toHaveCount(0);
  // “Sair” com um convite ainda não usado leva ao botão do convite
  await page.goto(`${SITE}/clube/ativar?c=conv-incompleto`);
  await f.getByRole('button', { name: 'Não é você? Sair' }).click();
  await expect(f.getByRole('button', { name: 'Ativar meu Clube' })).toBeVisible();
});

for (const largura of [360, 390]) {
  test(`convite em ${largura} px: botão, cadastro e conclusão cabem, e passam no axe`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await apiFalsa(page);
    const graves = async () => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
      .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
    const { ficha: f } = await abrirConvite(page, 'conv-novo');
    expect(await graves(), 'convite').toEqual([]);
    await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
    await f.getByLabel('Nome').fill('Bia');
    await f.locator('#cf-aceite').check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await f.getByRole('button', { name: 'Concluir cadastro' }).click();
    await expect(f.locator('.ficha__boas-vindas')).toBeVisible();
    expect(await graves(), 'concluído').toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

// ── Prévia local: só no build de testes (e no `astro dev`) ────────────────────────────────────────────────────────
test('prévia local: todas as telas com dados de exemplo marcados, sem chamar a API', async ({ page }) => {
  const api = await apiFalsa(page);
  await page.goto(`${SITE}/clube/previa/`);
  const links = await page.locator('.previa-indice a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
  expect(links.length).toBeGreaterThanOrEqual(30);
  for (const href of links) {
    await page.goto(`${SITE}${href}`);
    await expect(page.locator('.previa-faixa')).toContainText('dados de exemplo');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
  expect(api.chamadas).toEqual([]);
  // o QR Code do exemplo vem pronto como imagem (o componente nunca gera QR a partir do id)
  await page.goto(`${SITE}/clube/previa/resgate-aguardando/`);
  await expect(page.locator('.resgate__qr img')).toHaveAttribute('src', /^data:image\/svg\+xml/);
});

// ── Conta suspensa (403 conta_suspensa, b0b0553) ─────────────────────────────────────────────────────────────────────

const TEXTO_SUSPENSA = /Sua conta do Clube Âmbar está suspensa\. Fale com a equipe do Âmbar\./;

test('conta suspensa: o código certo mostra “Conta suspensa” com o texto do backend — sem erro genérico, sem tentar de novo, sem abrir a conta', async ({ page }) => {
  const api = await apiFalsa(page);
  const f = await entrar(page, '85988880003');
  const antes = api.chamadas.length;
  await confirmarCodigo(page);
  await expect(f.locator('.ticket__title')).toHaveText('Conta suspensa');
  await expect(f.getByRole('alert')).toHaveText(TEXTO_SUSPENSA);
  await expect(f.getByRole('link', { name: 'Falar com a equipe no WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\//);
  await expect(f.getByRole('button', { name: /tentar de novo|confirmar/i })).toHaveCount(0);
  await expect(f.locator('input')).toHaveCount(0);
  await expect(f).not.toContainText(/não está disponível|Não foi possível/);
  await page.waitForTimeout(400);
  expect(page.url()).toBe(`${SITE}/clube/entrar/`);
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso/verificar')).toHaveLength(1);
  // depois do 403, nada mais é pedido: nem a conta, nem outra verificação
  expect(api.chamadas.slice(antes).map((c) => c.rota)).toEqual(['/clube/acesso/verificar']);
});

test('conta suspensa durante o uso: a conta some — sem cartão, pontos ou preferências, sem nova tentativa — e a carteira não abre de novo', async ({ page }) => {
  const api = await apiFalsa(page, { programaAtivo: true, movimentos: 3 });
  await entrarNaConta(page);
  await expect(page.locator('.conta')).toBeVisible();
  api.suspender('0001');
  const antes = api.chamadas.length;
  await page.reload();
  const tela = page.locator('[data-estado="suspensa"]');
  await expect(tela).toBeVisible();
  await expect(tela).toContainText('Conta suspensa');
  await expect(tela).toContainText(TEXTO_SUSPENSA);
  await expect(page.locator('.conta, .conta-topo, .conta-programa, .extrato')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /tentar de novo/i })).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(api.chamadas.slice(antes).filter((c) => c.rota === '/clube/me')).toHaveLength(1);
  // a sessão foi revogada pelo backend: o histórico não abre — vai para a entrada pelo WhatsApp
  await page.goto(`${SITE}/clube/historico/`);
  await page.waitForURL(`${SITE}/clube/entrar/?volta=historico`);
  await expect(page.locator('.extrato')).toHaveCount(0);
  expect(api.chamadas.filter((c) => c.rota === '/clube/me/movimentos')).toHaveLength(0);
});

test('conta suspensa na landing (sessão restaurada) e no convite: “Conta suspensa”, sem cadastro nem convite pendente', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrarNaConta(page);
  api.suspender('0001');
  await page.goto(`${SITE}/clube/#cadastro`);
  await expect(ficha(page).locator('.ticket__title')).toHaveText('Conta suspensa');
  await expect(ficha(page).getByRole('alert')).toHaveText(TEXTO_SUSPENSA);
  await expect(ficha(page).locator('input')).toHaveCount(0);

  const { ficha: f } = await abrirConvite(page, 'conv-suspenso');
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(f.locator('.ticket__title')).toHaveText('Conta suspensa');
  await expect(f.getByRole('alert')).toHaveText(TEXTO_SUSPENSA);
  await expect(f.getByRole('button', { name: /Ativar|tentar de novo/i })).toHaveCount(0);
  await expect(f.getByLabel('Nome')).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(api.chamadas.filter((c) => c.rota === '/clube/convites/ativar')).toHaveLength(1);
});

test('aparelho compartilhado: a sessão guardada é de uma conta suspensa — o convite de OUTRO número continua valendo', async ({ page }) => {
  const api = await apiFalsa(page);
  await entrarNaConta(page);
  api.suspender('0001');
  const { ficha: f } = await abrirConvite(page, 'conv-novo');
  await expect(f.getByRole('button', { name: 'Ativar meu Clube' })).toBeVisible();
  await expect(f).not.toContainText('Conta suspensa');
  await f.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(f.getByLabel('Nome')).toBeVisible();
  expect(api.chamadas.filter((c) => c.rota === '/clube/convites/ativar')).toHaveLength(1);
});

// ── Telefone (regras do backend; o nono dígito nunca é posto nem tirado) ────────────────────────────────────────────

test('WhatsApp: sem o nono dígito, dígitos a mais, DDD inexistente ou fixo — o site explica e não envia; nada é completado nem cortado', async ({ page }) => {
  const api = await apiFalsa(page);
  await page.goto(`${SITE}/clube/entrar/`);
  const f = ficha(page);
  const campo = f.getByLabel('WhatsApp');
  const tentar = async (digitado: string, mostrado: string, erro: RegExp) => {
    await campo.fill(digitado);
    await expect(campo).toHaveValue(mostrado);
    await f.getByRole('button', { name: 'Continuar' }).click();
    await expect(f.locator('#cf-telefone-erro')).toHaveText(erro);
    await expect(campo).toHaveValue(mostrado);
  };
  await tentar('8591439014', '(85) 9143-9014', /Celular tem 9 dígitos depois do DDD/);
  await tentar('859991439014', '(85) 99914-39014', /dígitos a mais/);
  await tentar('20991439014', '(20) 99143-9014', /DDD 20 não existe/);
  await tentar('8532345678', '(85) 3234-5678', /celular com WhatsApp/);
  await tentar('85991439', '(85) 9914-39', /Faltam dígitos/);
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso')).toHaveLength(0);
  // número colado com o código do país: a máscara mostra o +55 e envia DDD + número, sem tirar nem pôr o 9
  await campo.fill('+55 85 99143-9014');
  await expect(campo).toHaveValue('+55 (85) 99143-9014');
  await f.getByRole('button', { name: 'Continuar' }).click();
  await expect(f.locator('.ticket__title')).toHaveText(/Confirme seu WhatsApp/i);
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso').map((c) => c.corpo)).toEqual([{ telefone: '85991439014' }]);
});
