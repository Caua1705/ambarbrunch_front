// Nova reserva e Visão Geral contra um backend REAL local (uma cópia do giardini_back em banco isolado, com dados fictícios).
// Prova que a equipe segue os mesmos horários do site sem a antecedência de 2 h, que o backend recusa o que a tela não oferece e
// o overbooking, que cada unidade usa as próprias regras, que a busca alcança todas as datas e que os indicadores são os da
// operação. O relógio das reservas desse backend fica fixo em `hoje_reservas`, 09:10, depois da abertura. Roda à parte, com o JSON do seu próprio preparo em PAINEL_REAL_RESERVAS (fora do repositório):
//   PAINEL_REAL_API=http://127.0.0.1:8768 PAINEL_REAL_RESERVAS=<json> npx playwright test -c playwright.painel-real.config.ts reservas-e-visao
import fs from 'node:fs';
import { test, expect, type Page, type Locator } from '@playwright/test';

const PAINEL = 'http://127.0.0.1:4494';

interface Preparo {
  api: string;
  senha: string;
  contas: Record<'dono' | 'gerente' | 'atendente' | 'gerente_cafe', string>;
  ambientes: Record<'jardim' | 'salao' | 'lounge' | 'privativa' | 'noite', string>;
  abertura: string;
  data_fechada: string;
  hoje_reservas: string;
  esperado: { receita: string; ticket: string; vendas: number; despesas: string };
}

const caminho = process.env.PAINEL_REAL_RESERVAS;
test.skip(!caminho, 'Defina PAINEL_REAL_RESERVAS (JSON do preparo do backend local).');
const P: Preparo = caminho ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : ({} as Preparo);

const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: PAINEL };
const brl = (v: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
const DIA = '2026-11-16';

async function entrar(page: Page, conta: keyof Preparo['contas']) {
  const r = await page.request.post(`${PAINEL}/admin/api/sessao`, { headers: escrever, data: { email: P.contas[conta], senha: P.senha } });
  if (!r.ok()) throw new Error(`login ${conta}: ${r.status()}`);
}

async function abrirNova(page: Page, data: string, pessoas: string): Promise<Locator> {
  await page.goto(`${PAINEL}/admin/reservas`);
  await page.getByRole('button', { name: 'Nova reserva' }).click();
  const g = page.getByRole('dialog', { name: 'Nova reserva' });
  await g.getByLabel('Data').fill(data);
  await g.getByLabel('Pessoas').fill(pessoas);
  return g;
}

const ambiente = (g: Locator, nome: string) => g.getByRole('group', { name: nome, exact: true });

async function criar(g: Locator, nome: string) {
  await g.getByLabel('Nome do cliente').fill(nome);
  await g.getByLabel('Telefone (WhatsApp)').fill('85999998888');
  await g.getByRole('button', { name: 'Criar reserva' }).click();
}

/** O que o site público receberia, direto no backend. */
async function doSite(page: Page, codigo: string, data: string, pessoas: number) {
  const r = await page.request.get(`${P.api}/reservas/disponibilidade?ambiente=${codigo}&data=${data}&pessoas=${pessoas}`);
  expect(r.ok()).toBe(true);
  return (await r.json()) as { horarios: { hora: string; disponivel: boolean }[] };
}

test.describe.configure({ mode: 'serial' });

test('os horários oferecidos à equipe são exatamente os do site, ambiente por ambiente', async ({ page }) => {
  await entrar(page, 'gerente');
  const g = await abrirNova(page, DIA, '4');
  for (const [codigo, nome] of [['jardim', 'Jardim externo'], ['salao', 'Salão principal'], ['lounge', 'Lounge']] as const) {
    await ambiente(g, nome).getByRole('radio').first().waitFor();
    const site = await doSite(page, codigo, DIA, 4);
    expect(site.horarios.length).toBeGreaterThan(0);
    await expect(ambiente(g, nome).getByRole('radio')).toHaveCount(site.horarios.length);
    await expect(ambiente(g, nome).locator('button[role="radio"]:enabled')).toHaveCount(site.horarios.filter((h) => h.disponivel).length);
  }
  await expect(ambiente(g, 'Sala privativa')).toContainText('Sala privativa recebe reservas a partir de 6 pessoas.');
  await expect(ambiente(g, 'Sala privativa').getByRole('radio')).toHaveCount(0);
  await expect(ambiente(g, 'Jardim externo')).toContainText('Até 20 pessoas');
  await expect(ambiente(g, 'Lounge')).toContainText('Até 15 pessoas');
  await expect(ambiente(g, 'Salão principal')).toContainText('Até 30 pessoas');
});

test('menos de 2 h: o site recusa, a equipe lança, e o que já passou ou está fora da grade o backend recusa', async ({ page }) => {
  const dia = P.hoje_reservas; // relógio do backend: 09:10
  await entrar(page, 'gerente');
  const site = await doSite(page, 'jardim', dia, 2);
  const noSite = Object.fromEntries(site.horarios.map((h) => [h.hora, h.disponivel]));
  expect(noSite['10:00']).toBe(false);
  expect(noSite['11:00']).toBe(false);
  expect(noSite['11:30']).toBe(true);
  const publico = await page.request.post(`${P.api}/reservas`, {
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `integracao-${Date.now()}-site` },
    data: { ambienteId: 'jardim', pessoas: 2, data: dia, hora: '10:00', nome: 'Cliente Site', telefone: '(85) 99999-0000', email: 'cliente@exemplo.com.br', observacoes: '', consentimentoPrivacidade: true, origem: 'site' },
  });
  expect(publico.status()).toBe(422);
  expect((await publico.json()).detail[0].msg).toBe('Data ou horário fora do prazo de reserva online.');

  const g = await abrirNova(page, dia, '2');
  const jardim = ambiente(g, 'Jardim externo');
  await expect(jardim.getByRole('radio', { name: '09:00', exact: true })).toHaveCount(0);
  await jardim.getByRole('radio', { name: '10:00', exact: true }).click();
  await criar(g, 'Balcão Última Hora');
  await expect(page.getByText('Reserva de Balcão Última Hora criada.')).toBeVisible();

  const direto = (hora: string, ambiente_id = P.ambientes.jardim, data = dia) => page.request.post(`${PAINEL}/admin/api/reservas`, { headers: { ...escrever, 'Idempotency-Key': `integracao-${Date.now()}-${hora}` }, data: { unidade: 'ambar_cafe', ambiente_id, data, hora, pessoas: 2, nome: 'Fora da Regra', telefone: '85999995555', canal: 'telefone' } });
  const passado = await direto('09:00');
  expect([passado.status(), (await passado.json()).codigo]).toEqual([422, 'horario_passado']);
  const foraDaGrade = await direto('10:15');
  expect([foraDaGrade.status(), (await foraDaGrade.json()).codigo]).toEqual([422, 'fora_da_agenda']);
  const bloqueada = await direto('12:00', P.ambientes.jardim, P.data_fechada);
  expect([bloqueada.status(), (await bloqueada.json()).codigo]).toEqual([422, 'fora_da_agenda']);
});

test('isolamento: a unidade de ensaio usa a própria grade e capacidade, e quem não é dela não entra', async ({ page }) => {
  await entrar(page, 'gerente');
  const dia = '2026-11-13';
  const disp = await (await page.request.get(`${PAINEL}/admin/api/reservas/disponibilidade?ambiente_id=${P.ambientes.noite}&data=${dia}&pessoas=2`)).json();
  expect(disp.unidade).toBe('ambar_noite');
  expect(disp.capacidade_max).toBe(3);
  expect(disp.horarios.map((h: { hora: string }) => h.hora.slice(0, 5))).toEqual(['18:00', '18:30', '19:00']);

  const lancar = (hora: string, pessoas: number, chave: string) => page.request.post(`${PAINEL}/admin/api/reservas`, { headers: { ...escrever, 'Idempotency-Key': `integracao-${Date.now()}-${chave}` }, data: { unidade: 'ambar_noite', ambiente_id: P.ambientes.noite, data: dia, hora, pessoas, nome: 'Ensaio', telefone: '85999994444', canal: 'telefone' } });
  expect((await (await lancar('12:00', 1, 'n1')).json()).codigo).toBe('fora_da_agenda');
  expect((await lancar('18:00', 4, 'n2')).status()).toBe(422);
  expect((await lancar('18:00', 3, 'n3')).status()).toBe(201);
  expect((await (await lancar('18:00', 1, 'n4')).json()).codigo).toBe('lotacao_excedida');
  // a ocupação da unidade de ensaio não aparece na real
  const real = await (await page.request.get(`${PAINEL}/admin/api/reservas/disponibilidade?ambiente_id=${P.ambientes.jardim}&data=${dia}&pessoas=2`)).json();
  expect(real.unidade).toBe('ambar_cafe');
  expect(real.horarios.every((h: { ocupadas: number }) => h.ocupadas === 0)).toBe(true);

  await page.context().clearCookies();
  await entrar(page, 'gerente_cafe');
  expect((await page.request.get(`${PAINEL}/admin/api/reservas/disponibilidade?ambiente_id=${P.ambientes.noite}&data=${dia}&pessoas=2`)).status()).toBe(403);
});

test('antes da abertura e em data bloqueada: sem horários, com a próxima data aberta', async ({ page }) => {
  await entrar(page, 'gerente');
  const antes = await abrirNova(page, '2026-11-08', '2');
  await expect(antes.getByText(/^Sem horários em /)).toBeVisible();
  await expect(antes.getByRole('radio')).toHaveCount(0);
  await antes.getByRole('button', { name: /^Ver / }).click();
  await expect(antes.getByLabel('Data')).toHaveValue(P.abertura);

  const fechada = await abrirNova(page, P.data_fechada, '2');
  await expect(fechada.getByText(/^Sem horários em /)).toBeVisible();
  await expect(ambiente(fechada, 'Jardim externo')).toContainText('Sem horários nesta data');
});

test('cria pelo painel, com canal e confirmada, e o lugar some para o site e para a equipe', async ({ page }) => {
  await entrar(page, 'gerente');
  const g = await abrirNova(page, DIA, '20');
  await ambiente(g, 'Jardim externo').getByRole('radio', { name: '12:00', exact: true }).click();
  await g.getByLabel('Como o pedido chegou').selectOption('balcao');
  await criar(g, 'Grupo Integração');
  await expect(page.getByText('Reserva de Grupo Integração criada.')).toBeVisible();
  const detalhe = page.getByRole('dialog', { name: 'Grupo Integração' });
  await expect(detalhe).toBeVisible();
  await expect(detalhe).toContainText('Confirmada');

  const site = await doSite(page, 'jardim', DIA, 1);
  expect(site.horarios.find((h) => h.hora === '12:00')?.disponivel).toBe(false);
  const depois = await abrirNova(page, DIA, '1');
  await expect(ambiente(depois, 'Jardim externo').getByRole('radio', { name: '12:00 (lotado)' })).toBeDisabled();
  // a reserva ocupa o lugar durante a duração (2 h): 13:30 também lotou, e 14:00 ainda não
  await expect(ambiente(depois, 'Jardim externo').getByRole('radio', { name: '13:30 (lotado)' })).toBeDisabled();
  await expect(ambiente(depois, 'Jardim externo').getByRole('radio', { name: '14:00', exact: true })).toBeEnabled();
});

test('duas reservas simultâneas no último lugar: o backend aceita uma e recusa a outra com 409', async ({ page }) => {
  await entrar(page, 'gerente');
  const corpo = (nome: string) => ({ unidade: 'ambar_cafe', ambiente_id: P.ambientes.lounge, data: DIA, hora: '09:00', pessoas: 15, nome, telefone: '85999997777', canal: 'telefone' });
  const pedir = (nome: string, chave: string) => page.request.post(`${PAINEL}/admin/api/reservas`, { headers: { ...escrever, 'Idempotency-Key': chave }, data: corpo(nome) });
  const respostas = await Promise.all([pedir('Primeira Pessoa', `integracao-${Date.now()}-a`), pedir('Segunda Pessoa', `integracao-${Date.now()}-b`)]);
  const situacoes = respostas.map((r) => r.status()).sort();
  expect(situacoes).toEqual([201, 409]);
  const recusa = await respostas.find((r) => r.status() === 409)!.json();
  expect(recusa.codigo).toBe('lotacao_excedida');
});

test('horário que esgota com o formulário aberto: não grava e devolve a escolha', async ({ page }) => {
  await entrar(page, 'gerente');
  const g = await abrirNova(page, DIA, '30');
  await ambiente(g, 'Salão principal').getByRole('radio', { name: '10:00', exact: true }).click();
  // outra pessoa ocupa o salão enquanto este formulário está aberto
  const r = await page.request.post(`${PAINEL}/admin/api/reservas`, { headers: { ...escrever, 'Idempotency-Key': `integracao-${Date.now()}-c` }, data: { unidade: 'ambar_cafe', ambiente_id: P.ambientes.salao, data: DIA, hora: '10:00', pessoas: 5, nome: 'Outra Pessoa', telefone: '85999996666', canal: 'telefone' } });
  expect(r.status()).toBe(201);
  await criar(g, 'Não Deve Gravar');
  await expect(g.getByText('O horário escolhido não está mais disponível. Escolha outro.')).toBeVisible();
  const lista = await page.request.get(`${PAINEL}/admin/api/reservas?data_de=${DIA}&data_ate=${DIA}&limite=200`);
  expect(JSON.stringify(await lista.json())).not.toContain('Não Deve Gravar');
});

test('Por ambiente: capacidades do backend, reservas do intervalo e pico de ocupação calculado por ele', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/reservas?apresentacao=ambiente&data=${DIA}`);
  const jardim = page.getByRole('region', { name: /^Jardim externo: / });
  await expect(jardim).toContainText('Até 20 pessoas');
  await expect(jardim).toContainText('Grupo Integração');
  await expect(jardim.locator('.ocupacao-dia')).toContainText('Pico de 20 de 20 lugares');
  await expect(page.getByRole('region', { name: /^Sala privativa: / })).toContainText('Livre');
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Semana' }).click();
  await expect(page.getByRole('region', { name: /^Jardim externo: 1 reserva nesta semana$/ })).toBeVisible();
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Mês' }).click();
  await expect(page.getByRole('region', { name: /^Jardim externo: 2 reservas neste mês$/ })).toBeVisible();
});

test('Buscar reserva alcança outras datas, por nome sem acento e por telefone formatado', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/reservas`);
  await page.getByRole('button', { name: 'Buscar reserva' }).click();
  const g = page.getByRole('dialog', { name: 'Buscar reserva' });
  const campo = g.getByRole('searchbox', { name: 'Buscar em todas as reservas' });
  const resultado = g.getByRole('list', { name: 'Resultado da busca' });
  await campo.fill('grupo integracao');
  await expect(resultado.getByRole('button').first()).toContainText('Grupo Integração');
  await campo.fill('(85) 99999-8888');
  await expect(resultado.getByRole('button', { name: /Grupo Integração/ })).toBeVisible();
  await expect(resultado.getByRole('button', { name: /Balcão Última Hora/ })).toBeVisible();
  await resultado.getByRole('button', { name: /Grupo Integração/ }).click();
  await expect(page.getByRole('dialog', { name: 'Grupo Integração' })).toBeVisible();

  await page.context().clearCookies();
  await entrar(page, 'atendente');
  const nome = await (await page.request.get(`${PAINEL}/admin/api/reservas?busca=grupo%20integracao`)).json();
  expect(nome.total).toBeGreaterThan(0);
  expect(nome.itens[0].contato_telefone_e164).toBeNull();
  const fone = await (await page.request.get(`${PAINEL}/admin/api/reservas?busca=${encodeURIComponent('(85) 99999-8888')}`)).json();
  expect(fone.total).toBe(0);
});

test('Campanhas, Base de conhecimento e Cadastros duplicados abrem com os dados do backend real', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/atendimento`);
  await page.getByRole('button', { name: 'Campanhas', exact: true }).click();
  const campanhas = page.getByRole('dialog', { name: 'Campanhas' });
  await expect(campanhas.getByRole('button', { name: 'Nova campanha' })).toBeVisible();
  await expect(campanhas.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);

  await page.goto(`${PAINEL}/admin/configuracoes?secao=atendimento`);
  await page.getByRole('button', { name: /Base de conhecimento da IA/ }).click();
  const base = page.getByRole('dialog', { name: 'Base de conhecimento' });
  await expect(base.getByText('Só o que o Âmbar confirmou.', { exact: false })).toBeVisible();
  await expect(base.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);

  await page.goto(`${PAINEL}/admin/configuracoes?secao=atendimento`);
  await page.getByRole('button', { name: /Cadastros duplicados/ }).click();
  const duplicados = page.getByRole('dialog', { name: 'Cadastros duplicados' });
  await expect(duplicados.getByText('Nada é apagado nem fundido.', { exact: false })).toBeVisible();
  await expect(duplicados.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);

  await page.context().clearCookies();
  await entrar(page, 'atendente');
  expect((await page.request.get(`${PAINEL}/admin/api/atendimento/campanhas`)).status()).toBe(403);
  expect((await page.request.get(`${PAINEL}/admin/api/atendimento/duplicidades`)).status()).toBe(403);
  expect((await page.request.get(`${PAINEL}/admin/api/atendimento/conhecimento`)).status()).toBe(200);
});

test('Atendente não cria: a API recusa e o botão não aparece', async ({ page }) => {
  await entrar(page, 'atendente');
  await page.goto(`${PAINEL}/admin/reservas`);
  await expect(page.locator('.agenda-barra')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova reserva' })).toHaveCount(0);
  const r = await page.request.post(`${PAINEL}/admin/api/reservas`, { headers: { ...escrever, 'Idempotency-Key': `integracao-${Date.now()}-d` }, data: { unidade: 'ambar_cafe', ambiente_id: P.ambientes.lounge, data: DIA, hora: '11:00', pessoas: 1, nome: 'Sem Permissão', telefone: '85999995555', canal: 'telefone' } });
  expect(r.status()).toBe(403);
});

test('Visão Geral: venda cancelada fora da receita, despesas do Financeiro e produtos da Eyemobile', async ({ page }) => {
  await entrar(page, 'dono');
  await page.goto(`${PAINEL}/admin`);
  const kpi = (nome: string) => page.locator('.indicador', { hasText: nome });
  await expect(kpi('Receita').locator('.indicador__valor')).toHaveText(brl(P.esperado.receita));
  await expect(kpi('Ticket médio').locator('.indicador__valor')).toHaveText(brl(P.esperado.ticket));
  await expect(kpi('Ticket médio')).toContainText(`${P.esperado.vendas} vendas`);
  await expect(kpi('Despesas').locator('.indicador__valor')).toHaveText(brl(P.esperado.despesas));
  const produtos = page.getByRole('list', { name: 'Produtos mais vendidos' });
  await expect(produtos).toContainText('Cinnamon roll');
  await expect(produtos).toContainText('Cappuccino');
  const categorias = page.getByRole('list', { name: 'Despesas por categoria' });
  await expect(categorias).toContainText('Manutenção');
  await expect(categorias).toContainText('Limpeza');
  await expect(page.getByText('Aguardando dados de vendas')).toHaveCount(0);
});

test('Visão Geral: unidade sem a loja do PDV ligada mostra "—", sem zero nem aviso', async ({ page }) => {
  await entrar(page, 'dono');
  await page.goto(`${PAINEL}/admin`);
  await page.locator('#perfil button.perfil').click();
  await page.locator('[data-unidade]').selectOption('ambar_noite');
  await page.waitForLoadState('load');
  const receita = page.locator('.indicador', { hasText: 'Receita' });
  await expect(receita).toContainText('Sem vendas sincronizadas');
  await expect(receita.locator('.indicador__valor')).toHaveText('—');
  await expect(page.getByText('Aguardando dados de vendas')).toHaveCount(0);
});
