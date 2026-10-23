// Entrada única do Clube (2026-10-23) no build SÓ DE TESTES (:4322, dist-sim, PUBLIC_CLUBE_MODO=api apontando para um
// endereço .invalid). A API é interceptada aqui pelo Playwright, imitando o contrato FINAL do backend (giardini_back,
// CLUBE.md §4 e §9, commit e410da2): sessão em cookie HttpOnly (aqui, guardada do lado do “servidor” falso e mantida ao
// recarregar a página), `X-Ambar-Csrf: 1` em tudo que muda algo (sem ele, 403 origem_invalida), `Authorization` = 401,
// erros no formato do FastAPI, campo desconhecido = 422 (extra=forbid), nome obrigatório no 1º envio.
// Um script de teste registra como cada fetch foi chamado, para conferir o `credentials: "include"`.
// Nada sai da máquina e nada disso existe no site publicado.
// Cenários pelo final do número: …0001 membro ativo · …0002 cadastro incompleto (falta só o aceite) · outros, novo.
import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SITE = 'http://127.0.0.1:4322';
const API = 'http://clube-api.teste.invalid';
const CORS = {
  'access-control-allow-origin': SITE, 'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'content-type, idempotency-key, x-ambar-csrf', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Registro { rota: string; metodo: string; corpo: Record<string, unknown> | null; auth?: string; csrf?: string; chave?: string }
type Pendente = { nome: string | null; aniversario: string | null; faltam: string[]; marketing: { autorizado: boolean } };

/** API falsa com o formato do contrato real. Devolve o registro das chamadas. */
async function apiFalsa(page: Page, opcoes: { inscricoesAbertas?: boolean; versaoNova?: boolean; sessaoVenceAntesDeConcluir?: boolean } = {}) {
  const chamadas: Registro[] = [];
  /** a “sessão do cookie”: o telefone com código confirmado (sobrevive a recarregar a página, como o cookie) */
  let sessao: string | null = null;
  /** “ativacao” = sessão limitada do convite (só concluir o cadastro) */
  let escopo: 'completa' | 'ativacao' = 'completa';
  /** convites do caixa (caminho A): token → telefone; usados viram 410 */
  const CONVITES: Record<string, string> = { 'conv-novo': '85977770011', 'conv-incompleto': '85988880002', 'conv-ativo': '85988880001' };
  const usados = new Set<string>();
  /** a sessão de ativação nunca mostra dados já gravados */
  const vistaAtivacao = (c: Pendente) => ({ situacao: 'ativacao', cadastro: { nome: null, aniversario: null, faltam: c.faltam, marketing: { autorizado: false } }, membro: null });
  const pendentes = new Map<string, Pendente>();
  const membros = new Map<string, string>([['0001', 'Maria Clara']]);
  let versaoRecusada = false;
  const json = (r: Route, status: number, body?: unknown) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  const membro = (nome: string, autorizado: boolean) => ({ nome, telefone: '(85) •••••-0001', aniversario: null, membroDesde: '2026-10-23', marketing: { autorizado }, mensagens: { autorizado: true }, programa: { ativo: false, saldo: null } });
  /** 422 no formato do FastAPI (sem chave `campos`) */
  const campo = (r: Route, nome: string, msg: string, codigo?: string) => json(r, 422, { detail: [{ loc: ['body', nome], msg, type: codigo ?? 'value_error' }], ...(codigo ? { codigo } : {}) });
  const ADESAO = ['nome', 'aniversario', 'aceiteRegulamento', 'regulamentoVersao', 'privacidadeVersao', 'marketing', 'origem'];
  const situacao = (tel: string) => {
    const fim = tel.slice(-4);
    if (membros.has(fim)) return { situacao: 'membro', membro: membro(membros.get(fim)!, fim === '0001'), cadastro: null };
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
    chamadas.push({ rota, metodo: req.method(), corpo, auth: h.authorization, csrf: h['x-ambar-csrf'], chave: h['idempotency-key'] });
    // como o backend: o token antigo no cabeçalho é recusado; mudança sem o cabeçalho anti-CSRF também
    if (h.authorization) return json(r, 401, { detail: 'Entre de novo.', codigo: 'sessao_invalida' });
    if (req.method() !== 'GET' && h['x-ambar-csrf'] !== '1') return json(r, 403, { detail: 'Origem inválida.', codigo: 'origem_invalida' });
    if (rota === '/clube/config') return json(r, 200, { inscricoesAbertas: opcoes.inscricoesAbertas ?? true, programaAtivo: false, regulamento: { versao: 'r1', url: null }, privacidade: { versao: 'p1', url: 'https://ambar.teste/privacidade' }, marketing: { textoVersao: 'm1' }, codigo: { digitos: 6, validadeS: 600 } });
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
      const s = situacao(tel);
      if (s.situacao === 'membro') return json(r, 200, { situacao: 'entrar', membro: null, cadastro: null });   // sem cookie
      sessao = tel; escopo = 'ativacao';   // Set-Cookie de ativação (30 min)
      return json(r, 200, vistaAtivacao(s.cadastro as Pendente));
    }
    if (rota === '/clube/sair') { sessao = null; return r.fulfill({ status: 204, headers: CORS }); }
    if (rota === '/clube/acesso') {
      const tel = String(corpo?.telefone ?? '');
      return json(r, 202, { desafioId: `d-${tel}`, canal: 'whatsapp', destino: `(${tel.slice(0, 2)}) •••••-${tel.slice(-4)}`, reenvioEm: 0, expiraEm: '2026-10-23T23:00:00Z' });
    }
    if (rota === '/clube/acesso/verificar') {
      const tel = String(corpo?.desafioId ?? '').slice(2);
      if (corpo?.codigo === '000000') return json(r, 410, { detail: 'Este código venceu. Peça um novo.', codigo: 'codigo_expirado' });
      if (corpo?.codigo !== '123456') return campo(r, 'codigo', 'Código incorreto. Confira e tente de novo.', 'codigo_incorreto');
      sessao = tel; escopo = 'completa';   // Set-Cookie
      return json(r, 200, { ...situacao(tel), sessao: { expiraEm: '2026-11-22T23:00:00Z' } });
    }
    if (rota === '/clube/adesoes') {
      if (opcoes.sessaoVenceAntesDeConcluir) sessao = null;
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
      return json(r, 200, { situacao: 'membro', membro: membro(nome!, (corpo?.marketing as { autorizado?: boolean } | undefined)?.autorizado ?? c.marketing.autorizado), cadastro: null });
    }
    return json(r, 404, { detail: 'rota' });
  });
  return { chamadas };
}

/** todas as chamadas à API do Clube saíram com credentials: "include" */
const tudoComCookie = (page: Page) => page.evaluate((api) => (window as unknown as { __fetches: { url: string; credentials?: string }[] }).__fetches
  .filter((f) => f.url.startsWith(api)).every((f) => f.credentials === 'include'), API);

const entrar = async (page: Page, telefone: string) => {
  await page.goto(`${SITE}/clube/#cadastro`);
  const ficha = page.locator('#cadastro .ficha');
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
  await ficha.getByLabel('WhatsApp').fill(telefone);
  await ficha.getByRole('button', { name: 'Continuar' }).click();
  await expect(ficha.locator('.ticket__title')).toHaveText(/Confirme seu WhatsApp/i);
  return ficha;
};
const confirmarCodigo = async (page: Page, codigo = '123456') => {
  await page.locator('#cf-codigo').fill(codigo);
  await page.getByRole('button', { name: 'Confirmar' }).click();
};

test('entrada única: só o WhatsApp, um botão “Continuar”, sem aplicativo nem senha — e nada revela o cadastro antes do código', async ({ page }) => {
  const api = await apiFalsa(page);
  await page.goto(`${SITE}/clube/#cadastro`);
  const ficha = page.locator('#cadastro .ficha');
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
  await expect(ficha).toContainText('Seu WhatsApp é a chave para suas vantagens.');
  await expect(ficha).toContainText('Sem aplicativo. Sem senha.');
  await expect(ficha.locator('input')).toHaveCount(1);
  await expect(ficha.getByLabel('WhatsApp')).toHaveAttribute('placeholder', '(85) 99999-9999');
  await expect(ficha.getByRole('button')).toHaveText(['Continuar']);
  await expect(ficha.getByRole('button', { name: /cadastrar|entrar/i })).toHaveCount(0);
  // telefone inválido: erro claro, nada enviado
  await ficha.getByLabel('WhatsApp').fill('8533334444');
  await ficha.getByRole('button', { name: 'Continuar' }).click();
  await expect(ficha.locator('#cf-telefone-erro')).toHaveText(/Confira o WhatsApp com DDD/);
  await expect(ficha.getByLabel('WhatsApp')).toBeFocused();
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso')).toHaveLength(0);
  // membro e não membro veem exatamente a mesma tela depois do “Continuar”
  const textos: string[] = [];
  for (const tel of ['85988880001', '85977771234']) {
    await ficha.getByLabel('WhatsApp').fill(tel);
    await ficha.getByRole('button', { name: 'Continuar' }).click();
    await expect(ficha.locator('.ticket__title')).toHaveText(/Confirme seu WhatsApp/i);
    textos.push((await ficha.innerText()).replace(/\d{4}\b/g, '####'));
    await ficha.getByRole('button', { name: 'Trocar número' }).click();
    await expect(ficha.getByLabel('WhatsApp')).toHaveValue(/\(85\)/);   // o número digitado continua lá
  }
  expect(textos[0]).toBe(textos[1]);
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage).filter((k) => k !== 'ambar:clube:origem')])).toEqual([[], []]);
});

test('cliente novo: código → nome, aniversário, aceite e novidades → membro, pela sessão em cookie (sem token no navegador)', async ({ page }) => {
  const api = await apiFalsa(page);
  const ficha = await entrar(page, '(85) 97777-1234');
  // código errado e vencido: mensagens claras, segue na mesma etapa
  await confirmarCodigo(page, '111111');
  await expect(page.locator('#cf-codigo-erro')).toHaveText('Código incorreto. Confira e tente de novo.');
  await confirmarCodigo(page, '000000');
  await expect(page.locator('#cf-codigo-erro')).toHaveText('Este código venceu. Peça um novo.');   // texto do backend
  await confirmarCodigo(page);
  await expect(ficha.locator('.ticket__title')).toHaveText(/Quase lá/i);
  await expect(ficha.getByLabel('Nome')).toBeVisible();
  await expect(ficha.getByLabel(/Aniversário/)).toBeVisible();
  await expect(ficha.locator('#cf-aceite')).not.toBeChecked();
  await expect(ficha.locator('#cf-marketing')).not.toBeChecked();
  // erros sem perder o que foi digitado
  await ficha.getByLabel(/Aniversário/).fill('3102');
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('#cf-nome-erro')).toHaveText(/chamar você/);
  await expect(ficha.locator('#cf-aniversario-erro')).toHaveText(/dia e mês/);
  await expect(ficha.locator('#cf-aceite-erro')).toHaveText(/aceite a política/);
  await expect(ficha.getByLabel(/Aniversário/)).toHaveValue('31/02');
  await ficha.getByLabel('Nome').fill('Ana Lúcia');
  await ficha.getByLabel(/Aniversário/).fill('2512');
  await ficha.locator('#cf-aceite').check();
  await ficha.locator('#cf-marketing').check();
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Pronto, Ana!.*Agora você faz parte do Clube Âmbar/s);
  await expect(ficha.locator('.ticket__stamp')).toHaveText('membro');
  const adesao = api.chamadas.find((c) => c.rota === '/clube/adesoes')!;
  // sessão só no cookie: nada de Authorization; toda mudança com o cabeçalho anti-CSRF; todo fetch com credentials
  expect(api.chamadas.every((c) => !c.auth)).toBe(true);
  expect(api.chamadas.filter((c) => c.metodo !== 'GET').every((c) => c.csrf === '1')).toBe(true);
  expect(await tudoComCookie(page)).toBe(true);
  expect(adesao.chave).toBeTruthy();
  expect(adesao.corpo).toEqual({ nome: 'Ana Lúcia', aniversario: '12-25', aceiteRegulamento: true, regulamentoVersao: 'r1', privacidadeVersao: 'p1', marketing: { autorizado: true, textoVersao: 'm1' } });
  expect(adesao.corpo).not.toHaveProperty('telefone');   // o telefone vem da sessão
  // sem carteira de mentira e nada guardado pelo site
  await expect(ficha.locator('.carteira, a[href="/clube/membro/"]')).toHaveCount(0);
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage).filter((k) => k !== 'ambar:clube:origem')])).toEqual([[], []]);
});

test('sessão em cookie: recarregar a página volta direto à situação, sem código; “Sair” encerra e volta ao WhatsApp', async ({ page }) => {
  const api = await apiFalsa(page);
  const ficha = await entrar(page, '85988880001');
  await confirmarCodigo(page);
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Olá, Maria!/);
  // abrir de novo: GET /clube/me restaura (sem pedir código)
  await page.reload();
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Olá, Maria!/);
  await expect(ficha.locator('#cf-telefone, #cf-codigo')).toHaveCount(0);
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso')).toHaveLength(1);
  // ao abrir já na sessão, a página não rola sozinha até a comanda
  await page.goto(`${SITE}/clube/`);
  await expect(ficha.locator('.ficha__boas-vindas')).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  // sair: POST /clube/sair com o cabeçalho anti-CSRF → volta ao WhatsApp; recarregar não restaura mais
  await ficha.getByRole('button', { name: 'Não é você? Sair' }).click();
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
  expect(api.chamadas.find((c) => c.rota === '/clube/sair')!.csrf).toBe('1');
  await page.reload();
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
  expect(await tudoComCookie(page)).toBe(true);
});

test('sessão vencida no meio do cadastro (401): volta ao WhatsApp com aviso, sem perder o número', async ({ page }) => {
  await apiFalsa(page, { sessaoVenceAntesDeConcluir: true });
  const ficha = await entrar(page, '85977774321');
  await confirmarCodigo(page);
  await ficha.getByLabel('Nome').fill('Rui');
  await ficha.locator('#cf-aceite').check();
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
  await expect(ficha.locator('.ticket__status[data-tone="error"]')).toHaveText(/Confirme o WhatsApp de novo/);
  await expect(ficha.getByLabel('WhatsApp')).toHaveValue('(85) 97777-4321');
});

test('cadastro incompleto: recupera o nome e pede só o aceite dos termos atuais', async ({ page }) => {
  const api = await apiFalsa(page);
  const ficha = await entrar(page, '85988880002');
  await confirmarCodigo(page);
  await expect(ficha.locator('.ticket__title')).toHaveText(/Falta pouco, João/i);
  await expect(ficha).toContainText('Só falta confirmar os termos');
  await expect(ficha.getByLabel('Nome')).toHaveCount(0);           // já existe
  await expect(ficha.getByLabel(/Aniversário/)).toHaveCount(0);    // já existe
  await expect(ficha.locator('#cf-marketing')).toHaveCount(0);     // já autorizado antes
  // links do aceite: a política vem da URL do backend; o regulamento, sem URL configurada, fica em texto
  await expect(ficha.getByRole('link', { name: 'política de privacidade' })).toHaveAttribute('href', 'https://ambar.teste/privacidade');
  await expect(ficha.getByRole('link', { name: 'regulamento do Clube' })).toHaveCount(0);
  await ficha.locator('#cf-aceite').check();
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Pronto, João!/);
  expect(api.chamadas.find((c) => c.rota === '/clube/adesoes')!.corpo).toEqual({ aceiteRegulamento: true, regulamentoVersao: 'r1', privacidadeVersao: 'p1' });
});

test('termos atualizados durante o cadastro (409): pede o aceite de novo sem perder os campos', async ({ page }) => {
  await apiFalsa(page, { versaoNova: true });
  const ficha = await entrar(page, '85977775678');
  await confirmarCodigo(page);
  await ficha.getByLabel('Nome').fill('Bia');
  await ficha.locator('#cf-aceite').check();
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('#cf-aceite-erro')).toHaveText(/foram atualizados/);
  await expect(ficha.locator('#cf-aceite')).not.toBeChecked();
  await expect(ficha.getByLabel('Nome')).toHaveValue('Bia');
  await ficha.locator('#cf-aceite').check();
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Pronto, Bia!/);
});

test('cliente ativo: entra direto, sem cadastro de novo e sem carteira de mentira', async ({ page }) => {
  const api = await apiFalsa(page);
  const ficha = await entrar(page, '85988880001');
  await confirmarCodigo(page);
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Olá, Maria!.*Você já faz parte do Clube Âmbar/s);
  await expect(ficha.locator('input')).toHaveCount(0);
  await expect(ficha.locator('.carteira, a[href="/clube/membro/"]')).toHaveCount(0);
  await expect(ficha).not.toContainText(/\d+\s*pontos|saldo/i);
  await expect(ficha.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  expect(api.chamadas.some((c) => c.rota === '/clube/adesoes')).toBe(false);
});

test('inscrições fechadas na API: bilhete “em breve”, sem nenhum campo', async ({ page }) => {
  await apiFalsa(page, { inscricoesAbertas: false });
  await page.goto(`${SITE}/clube/`);
  const ficha = page.locator('#cadastro .ficha');
  await expect(ficha.locator('.ticket__title')).toHaveText(/Inscrições em breve/i);
  await expect(ficha.locator('input, button[type="submit"]')).toHaveCount(0);
});

for (const largura of [360, 390]) {
  test(`entrada única em ${largura} px: cada etapa cabe sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await apiFalsa(page);
    const ficha = await entrar(page, '85977771234');
    const semEstouro = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await semEstouro(), 'código').toBe(true);
    await confirmarCodigo(page);
    await expect(ficha.getByLabel('Nome')).toBeVisible();
    expect(await semEstouro(), 'cadastro').toBe(true);
    expect(await ficha.evaluate((f) => [...f.querySelectorAll('input, button, .check')].every((e) => e.getBoundingClientRect().right <= f.getBoundingClientRect().right + 1))).toBe(true);
  });
}

test('acessibilidade (axe) nas três etapas da entrada: WhatsApp, código e cadastro', async ({ page }) => {
  await apiFalsa(page);
  const graves = async () => (await new AxeBuilder({ page }).include('#cadastro').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
    .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  const ficha = await entrar(page, '85977771234');
  expect(await graves(), 'código').toEqual([]);
  await ficha.getByRole('button', { name: 'Trocar número' }).click();
  expect(await graves(), 'WhatsApp').toEqual([]);
  await ficha.getByRole('button', { name: 'Continuar' }).click();
  await confirmarCodigo(page);
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();   // com os erros à vista
  expect(await graves(), 'cadastro com erros').toEqual([]);
});

// ── Caminho A: convite do caixa (/clube/ativar?c=<token>) ──────────────────────────────────────────────────────────
const abrirConvite = async (page: Page, token: string) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(`${SITE}/clube/ativar?c=${token}`);
  const ficha = page.locator('#cadastro .ficha');
  await expect(ficha.locator('.ticket__title')).toHaveText(/Ative seu Clube Âmbar/i);
  return { ficha, urls };
};

test('convite (A): abrir o link não usa o convite — token fora da URL, no-referrer, só o toque chama POST', async ({ page }) => {
  const api = await apiFalsa(page);
  const { ficha, urls } = await abrirConvite(page, 'conv-novo');
  // o token saiu da barra (e do histórico) e nenhuma outra requisição levou o token na URL
  expect(page.url()).toBe(`${SITE}/clube/ativar`);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  expect(urls.filter((u) => u.includes('conv-novo') && !u.startsWith(`${SITE}/clube/ativar?c=`))).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __ambarConvite?: string }).__ambarConvite)).toBeUndefined();
  // nada usou o convite ao abrir
  expect(api.chamadas.filter((c) => c.rota === '/clube/convites/ativar')).toHaveLength(0);
  await expect(ficha.getByRole('button', { name: 'Ativar meu Clube' })).toBeVisible();
  await expect(ficha.locator('input')).toHaveCount(0);
  await expect(page).toHaveTitle(/Ative seu Clube/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  // o toque: POST com o token no corpo, cookie e anti-CSRF — nunca GET
  await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(ficha.getByLabel('Nome')).toBeVisible();
  const ativar = api.chamadas.filter((c) => c.rota === '/clube/convites/ativar');
  expect(ativar).toHaveLength(1);
  expect(ativar[0]).toMatchObject({ metodo: 'POST', corpo: { convite: 'conv-novo' }, csrf: '1' });
  expect(ativar[0].auth).toBeUndefined();
  expect(await tudoComCookie(page)).toBe(true);
});

test('convite novo: ativar → nome, aniversário, aceite e novidades → “Cadastro concluído”; a sessão de ativação acaba', async ({ page }) => {
  const api = await apiFalsa(page);
  const { ficha } = await abrirConvite(page, 'conv-novo');
  await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(ficha).toContainText('Convite confirmado. Agora, como podemos chamar você?');
  await expect(ficha.getByLabel(/Aniversário/)).toBeVisible();
  await ficha.getByLabel('Nome').fill('Bia Torres');
  await ficha.getByLabel(/Aniversário/).fill('0907');
  await ficha.locator('#cf-aceite').check();
  await ficha.locator('#cf-marketing').check();
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Cadastro concluído!.*confirmação no WhatsApp/s);
  // sem saldo nem recompensa: com o programa desligado, o botão leva ao login normal
  await expect(ficha).not.toContainText(/pontos|saldo/i);
  expect(api.chamadas.find((c) => c.rota === '/clube/adesoes')!.corpo).toEqual({ nome: 'Bia Torres', aniversario: '07-09', aceiteRegulamento: true, regulamentoVersao: 'r1', privacidadeVersao: 'p1', marketing: { autorizado: true, textoVersao: 'm1' } });
  await ficha.getByRole('button', { name: 'Entrar no Clube' }).click();
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
  // a sessão de ativação acabou: abrir o Clube de novo pede o WhatsApp
  await page.goto(`${SITE}/clube/`);
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
});

test('convite incompleto: pede só o aceite — nome e aniversário já gravados não aparecem nem são enviados', async ({ page }) => {
  const api = await apiFalsa(page);
  const { ficha } = await abrirConvite(page, 'conv-incompleto');
  await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(ficha.locator('.ticket__title')).toHaveText(/Falta pouco/i);
  await expect(ficha).toContainText('Só falta aceitar os termos do Clube.');
  await expect(ficha.locator('#cf-nome, #cf-aniversario, #cf-marketing')).toHaveCount(0);
  await ficha.locator('#cf-aceite').check();
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Cadastro concluído!/);
  expect(api.chamadas.find((c) => c.rota === '/clube/adesoes')!.corpo).toEqual({ aceiteRegulamento: true, regulamentoVersao: 'r1', privacidadeVersao: 'p1' });
});

test('convite de quem já é membro: o link não dá acesso — vai para o login por código', async ({ page }) => {
  const api = await apiFalsa(page);
  const { ficha } = await abrirConvite(page, 'conv-ativo');
  await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
  await expect(ficha.locator('.ticket__status[role="status"]')).toHaveText(/já faz parte do Clube.*confirme seu WhatsApp/i);
  await expect(ficha.locator('.ficha__boas-vindas, .carteira')).toHaveCount(0);
  // sem sessão: só o código abre a conta
  await ficha.getByLabel('WhatsApp').fill('85988880001');
  await ficha.getByRole('button', { name: 'Continuar' }).click();
  await confirmarCodigo(page);
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Olá, Maria!/);
  expect(api.chamadas.filter((c) => c.rota === '/clube/acesso')).toHaveLength(1);
});

test('link vencido, usado ou recarregado: recuperação segura pela entrada do WhatsApp', async ({ page }) => {
  await apiFalsa(page);
  // inválido/vencido
  let { ficha } = await abrirConvite(page, 'conv-vencido');
  await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(ficha.locator('.ticket__title')).toHaveText(/Entre para o Clube Âmbar/i);
  await expect(ficha.locator('.ticket__status[data-tone="error"]')).toHaveText(/venceu ou já foi usado/);
  await expect(ficha.getByLabel('WhatsApp')).toBeVisible();
  // já usado: ativa, sai e tenta o mesmo link de novo
  ({ ficha } = await abrirConvite(page, 'conv-incompleto'));
  await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await ficha.getByRole('button', { name: 'Não é você? Sair' }).click();
  ({ ficha } = await abrirConvite(page, 'conv-incompleto'));
  await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await expect(ficha.locator('.ticket__status[data-tone="error"]')).toHaveText(/venceu ou já foi usado/);
  // recarregar depois que o token saiu da URL: aviso e entrada normal (o token não volta)
  ({ ficha } = await abrirConvite(page, 'conv-novo'));
  await page.reload();
  await expect(ficha.locator('.ticket__status[role="status"]')).toHaveText(/toque de novo no botão da mensagem/);
  await expect(ficha.getByLabel('WhatsApp')).toBeVisible();
});

test('sessão de ativação vence no meio (401): aviso do convite e entrada pelo WhatsApp', async ({ page }) => {
  await apiFalsa(page, { sessaoVenceAntesDeConcluir: true });
  const { ficha } = await abrirConvite(page, 'conv-novo');
  await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
  await ficha.getByLabel('Nome').fill('Rui');
  await ficha.locator('#cf-aceite').check();
  await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(ficha.locator('.ticket__status[data-tone="error"]')).toHaveText(/tempo para ativar pelo convite acabou/);
  await expect(ficha.getByLabel('WhatsApp')).toBeVisible();
});

test('aparelho compartilhado: com outra sessão aberta, o convite mostra a conta atual e oferece “Ativar o convite recebido”', async ({ page }) => {
  const api = await apiFalsa(page);
  let ficha = await entrar(page, '85988880001');
  await confirmarCodigo(page);
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Olá, Maria!/);
  // abre o convite de outra pessoa neste navegador: a sessão de Maria aparece, o convite não é usado sozinho
  await page.goto(`${SITE}/clube/ativar?c=conv-novo`);
  expect(page.url()).toBe(`${SITE}/clube/ativar`);
  ficha = page.locator('#cadastro .ficha');
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Olá, Maria!/);
  expect(api.chamadas.filter((c) => c.rota === '/clube/convites/ativar')).toHaveLength(0);
  // o toque usa o convite (o backend troca a sessão deste navegador pela de ativação) → cadastro de quem foi convidado
  await ficha.getByRole('button', { name: 'Ativar o convite recebido' }).click();
  await expect(ficha.getByLabel('Nome')).toBeVisible();
  await expect(ficha).not.toContainText('Maria');
  expect(api.chamadas.filter((c) => c.rota === '/clube/convites/ativar')).toHaveLength(1);
  await expect(ficha.getByRole('button', { name: 'Ativar o convite recebido' })).toHaveCount(0);
  // convite já usado com a sessão de Maria aberta: ela continua na própria conta, com o aviso
  await ficha.getByRole('button', { name: 'Não é você? Sair' }).click();
  await expect(ficha.getByLabel('WhatsApp')).toBeVisible();
  ficha = await entrar(page, '85988880001');
  await confirmarCodigo(page);
  await page.goto(`${SITE}/clube/ativar?c=conv-novo`);
  await ficha.getByRole('button', { name: 'Ativar o convite recebido' }).click();
  await expect(ficha.locator('.ticket__status[data-tone="error"]')).toHaveText(/venceu ou já foi usado/);
  await expect(ficha.locator('.ficha__boas-vindas')).toHaveText(/Olá, Maria!/);
  await expect(ficha.getByRole('button', { name: 'Ativar o convite recebido' })).toHaveCount(0);
  // “Sair” com um convite ainda não usado leva ao botão do convite
  await page.goto(`${SITE}/clube/ativar?c=conv-incompleto`);
  await ficha.getByRole('button', { name: 'Não é você? Sair' }).click();
  await expect(ficha.getByRole('button', { name: 'Ativar meu Clube' })).toBeVisible();
});

for (const largura of [360, 390]) {
  test(`convite em ${largura} px: botão, cadastro e conclusão cabem, e passam no axe`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await apiFalsa(page);
    const graves = async () => (await new AxeBuilder({ page }).include('#cadastro').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
      .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
    const { ficha } = await abrirConvite(page, 'conv-novo');
    expect(await graves(), 'convite').toEqual([]);
    await ficha.getByRole('button', { name: 'Ativar meu Clube' }).click();
    await ficha.getByLabel('Nome').fill('Bia');
    await ficha.locator('#cf-aceite').check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ficha.getByRole('button', { name: 'Concluir cadastro' }).click();
    await expect(ficha.locator('.ficha__boas-vindas')).toBeVisible();
    expect(await graves(), 'concluído').toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
