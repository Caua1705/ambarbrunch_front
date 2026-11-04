// Eventos do Atendimento CONTRA O BACKEND REAL local (giardini_back com a migração 0024, banco isolado, dados fictícios,
// Meta simulada em 127.0.0.1, assistente LIGADO). O "n8n" é este teste: pede a rodada e devolve a resposta que um modelo
// daria (regra definitiva: evento = HANDOFF IMEDIATO, sem questionário e sem oportunidade criada pelo assistente).
// Caminho inteiro, sem celular: cliente pede um aniversário → o backend encaminha na hora (a pergunta da IA não sai) →
// a gerência registra a oportunidade no painel → o painel mostra "Evento" e a ficha → a Atendente corrige os dados, não
// muda o status, assume e responde (assistente calado) →
// a Gerente cuida do status comercial e do responsável → evento novo depois do perdido, sem duplicar o aberto →
// registro manual numa conversa sem evento → outra unidade não vê nada.
//   PAINEL_REAL_API=http://127.0.0.1:8767 PAINEL_REAL_CHAVE=<painel_chave> PAINEL_REAL_EVENTOS=<eventos.json de integracao_local.py ... eventos> \
//     npx playwright test -c playwright.painel-real.config.ts tests-painel-real/atendimento-eventos.spec.ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';

const PAINEL = 'http://127.0.0.1:4494';
const caminho = process.env.PAINEL_REAL_EVENTOS ?? '';
test.skip(!caminho, 'Defina PAINEL_REAL_EVENTOS (JSON do preparo da integração de eventos).');
test.describe.configure({ mode: 'serial' });

interface Cliente { wa_id: string; nome: string }
interface Integracao {
  api: string; meta: string; numero_meta: string; segredo_app: string; n8n_api_key: string; senha: string;
  contas: Record<'atendente' | 'gerente' | 'dono' | 'gerente_noite', string>;
  clientes: Record<'aniversario' | 'manual', Cliente>;
}
const A: Integracao = caminho ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : ({} as Integracao);
const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: PAINEL };
const N8N = () => ({ 'X-Api-Key': A.n8n_api_key, 'Content-Type': 'application/json' });
const DATA = new Date(Date.now() + 25 * 86400_000).toISOString().slice(0, 10);

interface Enviada { to: string; type: string; text?: { body: string } }
const textosEnviados = async (r: APIRequestContext, wa: string) =>
  ((await (await r.get(`${A.meta}/_enviadas`)).json()) as Enviada[]).filter((m) => m.to === wa && m.type === 'text').map((m) => m.text?.body ?? '');

/** Webhook como a Meta manda: corpo bruto assinado com o App Secret (X-Hub-Signature-256). */
async function clienteEscreve(r: APIRequestContext, c: Cliente, texto: string) {
  const bruto = Buffer.from(JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba-simulada', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: A.numero_meta },
      contacts: [{ wa_id: c.wa_id, profile: { name: c.nome } }],
      messages: [{ from: c.wa_id, id: `wamid.eventos.${crypto.randomUUID()}`, timestamp: `${Math.floor(Date.now() / 1000)}`, type: 'text', text: { body: texto } }],
    } }] }],
  }), 'utf8');
  const assinatura = 'sha256=' + crypto.createHmac('sha256', A.segredo_app).update(bruto).digest('hex');
  const resp = await r.post(`${A.api}/webhooks/whatsapp`, { data: bruto, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': assinatura } });
  expect(resp.status(), await resp.text()).toBe(200);
}

interface Rodada { conversa_id: string; lote: string; ate_mensagem_id: number }
/** O n8n pede rodadas (silêncio mínimo de 2 s) até aparecer a desta conversa. */
async function rodadaDe(r: APIRequestContext, conversaId: string): Promise<Rodada> {
  let achada: Rodada | undefined;
  await expect.poll(async () => {
    const resp = await r.post(`${A.api}/internal/atendimento/rodadas`, { headers: N8N(), data: { silencio_segundos: 2 } });
    expect(resp.status(), await resp.text()).toBe(200);
    achada = ((await resp.json()).rodadas as Rodada[]).find((x) => x.conversa_id === conversaId);
    return !!achada;
  }, { timeout: 20_000, intervals: [1000] }).toBe(true);
  return achada!;
}
async function iaResponde(r: APIRequestContext, rodada: Rodada, texto: string) {
  const resp = await r.post(`${A.api}/internal/atendimento/conversas/${rodada.conversa_id}/resposta`, {
    headers: N8N(),
    data: { lote: rodada.lote, ate_mensagem_id: rodada.ate_mensagem_id, partes: [texto], intencao: 'evento', links: [], encaminhar: false, motivo: null, followup: null },
  });
  expect(resp.status(), await resp.text()).toBe(200);
  return resp.json() as Promise<{ resultado: string; encaminhada: boolean }>;
}

async function entrar(page: Page, conta: keyof Integracao['contas']) {
  await page.context().clearCookies();
  const r = await page.request.post(`${PAINEL}/admin/api/sessao`, { headers: escrever, data: { email: A.contas[conta], senha: A.senha } });
  expect(r.ok(), `login ${conta}: ${r.status()}`).toBe(true);
}
const api = async <T = any>(page: Page, rota: string): Promise<T> => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await page.request.get(`${PAINEL}/admin/api/${rota}`);
  expect(r.status(), `${rota}: ${await r.text()}`).toBe(200);
  return r.json();
};
async function conversaDoCliente(page: Page, c: Cliente) {
  let achada: { id: string; telefone_e164: string } | undefined;
  await expect.poll(async () => {
    achada = (await api<{ id: string; telefone_e164: string }[]>(page, 'atendimento/conversas')).find((x) => x.telefone_e164 === `+${c.wa_id}`);
    return !!achada;
  }, { timeout: 10_000 }).toBe(true);
  return achada!;
}
const ficha = (page: Page) => page.getByRole('complementary', { name: 'Ficha do evento' });
async function abrirConversa(page: Page, c: Cliente) {
  await page.goto(`${PAINEL}/admin/atendimento`);
  await page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: new RegExp(c.nome) }).click();
}

let conversaId = '';
let oportunidadeId = 0;

test('1. evento: handoff imediato sem perguntas; a gerência registra a oportunidade no painel', async ({ page }) => {
  const c = A.clientes.aniversario;
  await page.request.delete(`${A.meta}/_enviadas`);
  await entrar(page, 'gerente');
  await clienteEscreve(page.request, c, 'Oi! Queria comemorar meu aniversário aí, umas 20 pessoas');
  conversaId = (await conversaDoCliente(page, c)).id;
  const r1 = await rodadaDe(page.request, conversaId);
  const primeira = await iaResponde(page.request, r1, 'Que legal! Qual a data e o horário que você pensou?');
  // a intenção "evento" encaminha na hora; a pergunta da IA não sai e nada é registrado sozinho
  expect(primeira.encaminhada).toBe(true);
  const enviados = await textosEnviados(page.request, c.wa_id);
  expect(enviados.some((t) => t.includes('Vou chamar alguém da nossa equipe'))).toBe(true);
  expect(enviados.some((t) => t.includes('?'))).toBe(false);
  expect((await api(page, 'atendimento/eventos')).total).toBe(0);
  const det = await api(page, `atendimento/conversas/${conversaId}`);
  expect(det).toMatchObject({ assunto: 'evento', estado: 'esperando', assistente_ligado: false });

  // a gerência registra o que o cliente contou à equipe e marca "aguardando contato"
  const criado = await page.request.post(`${PAINEL}/admin/api/atendimento/conversas/${conversaId}/evento`, {
    headers: escrever, data: { tipo: 'aniversario', data_pretendida: DATA, horario: '19h', convidados: 20, ambiente_codigo: 'jardim' } });
  expect(criado.status(), await criado.text()).toBe(200);
  oportunidadeId = (await criado.json()).id;
  const status = await page.request.patch(`${PAINEL}/admin/api/atendimento/eventos/${oportunidadeId}`, { headers: escrever, data: { status: 'aguardando_contato' } });
  expect(status.status(), await status.text()).toBe(200);
  const lista = await api(page, 'atendimento/eventos');
  expect(lista.total).toBe(1);
  expect(lista.itens[0]).toMatchObject({ conversa_id: conversaId, telefone_e164: `+${c.wa_id}`, nome_contato: c.nome, status: 'aguardando_contato', origem: 'equipe', tipo: 'aniversario', data_pretendida: DATA, horario: '19h', convidados: 20, ambiente_codigo: 'jardim', ambiente_nome: 'Jardim', faltando: [] });
  expect((await api(page, 'atendimento/resumo')).eventos.aguardando_contato).toBe(1);
});

test('2. painel: etiqueta Evento na caixa, atalho e ficha com o que o cliente disse', async ({ page }) => {
  await entrar(page, 'atendente');
  await page.goto(`${PAINEL}/admin/atendimento`);
  const item = page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: new RegExp(A.clientes.aniversario.nome) });
  await expect(item.locator('.etiqueta', { hasText: 'Evento' })).toHaveClass(/etiqueta--atencao/);
  const atalho = page.getByRole('button', { name: /^Eventos/ });
  await expect(atalho.locator('.contador')).toContainText('1');
  await atalho.click();
  const gaveta = page.getByRole('dialog', { name: 'Eventos' });
  await expect(gaveta.getByRole('list', { name: 'Eventos' }).getByRole('button').first()).toContainText(A.clientes.aniversario.nome);
  await gaveta.getByRole('list', { name: 'Eventos' }).getByRole('button').first().click();
  const f = ficha(page);
  for (const t of ['Aguardando contato', 'Aniversário', '19h', '~20', 'Jardim', 'Pela equipe']) await expect(f).toContainText(t);
  await expect(page.locator('.conversa__motivo')).toContainText('evento');
});

test('3. Atendente: corrige os dados, não muda o status (403), assume e responde — o assistente continua calado', async ({ page }) => {
  const c = A.clientes.aniversario;
  await entrar(page, 'atendente');
  await abrirConversa(page, c);
  const f = ficha(page);
  await expect(f).toContainText('só a gerência altera');
  await expect(f.getByRole('combobox', { name: 'Status comercial' })).toHaveCount(0);
  await f.getByRole('button', { name: 'Editar dados' }).click();
  await f.getByRole('spinbutton', { name: /Convidados/ }).fill('25');
  await f.getByRole('textbox', { name: /Necessidades/ }).fill('bolo próprio');
  await f.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(page.getByText('Dados do evento atualizados.')).toBeVisible();
  await expect(f).toContainText('~25 pessoas');
  await expect(f).toContainText('Necessidades: bolo próprio');
  const negado = await page.request.patch(`${PAINEL}/admin/api/atendimento/eventos/${oportunidadeId}`, { headers: escrever, data: { status: 'fechado' } });
  expect(negado.status()).toBe(403);
  expect((await negado.json()).codigo).toBe('sem_permissao');
  const ambienteInvalido = await page.request.patch(`${PAINEL}/admin/api/atendimento/eventos/${oportunidadeId}`, { headers: escrever, data: { ambiente_codigo: 'nao_existe' } });
  expect(ambienteInvalido.status()).toBe(422);
  expect((await ambienteInvalido.json()).codigo).toBe('ambiente_desconhecido');

  await page.getByRole('button', { name: 'Assumir', exact: true }).click();
  await expect(page.getByText('Você assumiu a conversa.')).toBeVisible();
  const resposta = `Oi! Aqui é a equipe do Âmbar, vamos combinar o seu aniversário. [${Date.now()}]`;
  await page.getByRole('textbox', { name: 'Resposta' }).fill(resposta);
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(page.locator('.mensagens')).toContainText('vamos combinar o seu aniversário');
  await expect.poll(async () => (await textosEnviados(page.request, c.wa_id)).includes(resposta)).toBe(true);
  await expect(page.getByRole('switch', { name: /Assistente/ })).toHaveAttribute('aria-checked', 'false');
  // o cliente escreve de novo: nenhuma rodada para o assistente nesta conversa
  await clienteEscreve(page.request, c, 'Obrigada! Fico no aguardo');
  await new Promise((r) => setTimeout(r, 2500));
  const rodadas = await (await page.request.post(`${A.api}/internal/atendimento/rodadas`, { headers: N8N(), data: { silencio_segundos: 2 } })).json();
  expect(rodadas.rodadas.map((x: Rodada) => x.conversa_id)).not.toContain(conversaId);
  // status comercial é separado do estado: a conversa está com a equipe, o evento segue aguardando contato
  const det = await api(page, `atendimento/conversas/${conversaId}`);
  expect(det.estado).toBe('em_atendimento');
  expect(det.evento.status).toBe('aguardando_contato');
  expect((await api(page, 'atendimento/eventos')).total).toBe(1);
});

test('4. Gerente: status comercial, responsável, perdido com motivo e evento novo sem duplicar o aberto', async ({ page }) => {
  await entrar(page, 'gerente');
  await abrirConversa(page, A.clientes.aniversario);
  const f = ficha(page);
  await f.getByRole('combobox', { name: 'Status comercial' }).selectOption('em_negociacao');
  await expect(page.getByText('Status comercial: Em negociação.')).toBeVisible();
  await f.getByRole('combobox', { name: 'Responsável' }).selectOption({ label: 'Integração gerente' });
  await expect(page.getByText('Responsável: Integração gerente.')).toBeVisible();
  await f.getByRole('combobox', { name: 'Status comercial' }).selectOption('proposta_enviada');
  await expect(page.getByText('Status comercial: Proposta enviada.')).toBeVisible();
  await f.getByRole('combobox', { name: 'Status comercial' }).selectOption('perdido');
  const dialogo = page.getByRole('alertdialog', { name: 'Marcar o evento como perdido?' });
  await dialogo.getByRole('textbox', { name: 'Motivo da perda' }).fill('Data indisponível para o grupo');
  await dialogo.getByRole('button', { name: 'Marcar como perdido' }).click();
  await expect(page.getByText('Evento marcado como perdido.')).toBeVisible();
  await expect(f).toContainText('Motivo da perda: Data indisponível para o grupo');
  const perdida = await api(page, `atendimento/eventos/${oportunidadeId}`);
  expect(perdida).toMatchObject({ status: 'perdido', aberta: false, responsavel_nome: 'Integração gerente', motivo_perda: 'Data indisponível para o grupo' });
  expect(perdida.concluida_em).toBeTruthy();
  // a conversa não mudou de estado por causa do status comercial
  expect((await api(page, `atendimento/conversas/${conversaId}`)).estado).toBe('em_atendimento');

  await f.getByRole('button', { name: 'Registrar novo evento' }).click();
  const nova = page.getByRole('dialog', { name: 'Registrar evento' });
  await nova.getByRole('combobox', { name: /Tipo de evento/ }).selectOption('comemoracao');
  await nova.getByRole('spinbutton', { name: /Convidados/ }).fill('12');
  await nova.getByRole('combobox', { name: /Ambiente/ }).selectOption('privativa');
  await nova.getByRole('button', { name: 'Registrar evento' }).click();
  await expect(page.getByText('Evento registrado nesta conversa.')).toBeVisible();
  await expect(f).toContainText('Novo interesse');
  await expect(f).toContainText('Sala Privativa');
  // uma aberta por conversa: registrar de novo e reabrir a perdida dão 409
  const outra = await page.request.post(`${PAINEL}/admin/api/atendimento/conversas/${conversaId}/evento`, { headers: escrever, data: {} });
  expect(outra.status()).toBe(409);
  const corpo = await outra.json();
  expect(corpo.codigo).toBe('evento_aberto_na_conversa');
  expect(corpo.dados.oportunidade_id).toBeGreaterThan(oportunidadeId);
  const reabrir = await page.request.patch(`${PAINEL}/admin/api/atendimento/eventos/${oportunidadeId}`, { headers: escrever, data: { status: 'em_negociacao' } });
  expect(reabrir.status()).toBe(409);
  const todas = await api(page, 'atendimento/eventos');
  expect(todas.total).toBe(2);
  expect(todas.por_status).toMatchObject({ perdido: 1, novo_interesse: 1 });
  expect(new Set(todas.itens.map((e: { conversa_id: string }) => e.conversa_id))).toEqual(new Set([conversaId]));
});

test('5. registro manual numa conversa sem evento (cliente que ligou), ligado ao contato certo', async ({ page }) => {
  const c = A.clientes.manual;
  await entrar(page, 'atendente');
  await clienteEscreve(page.request, c, 'Oi, boa tarde');
  const conversa = await conversaDoCliente(page, c);
  await abrirConversa(page, c);
  await expect(ficha(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Mais ações da conversa' }).click();
  await page.getByRole('menuitem', { name: 'Registrar evento' }).click();
  const nova = page.getByRole('dialog', { name: 'Registrar evento' });
  await expect(nova.getByRole('combobox', { name: /Ambiente/ })).toContainText('Jardim (até 10)');
  await nova.getByRole('combobox', { name: /Tipo de evento/ }).selectOption('reuniao');
  await nova.getByRole('spinbutton', { name: /Convidados/ }).fill('8');
  await nova.getByRole('textbox', { name: /Horário/ }).fill('de manhã');
  await nova.getByRole('combobox', { name: /Canal/ }).selectOption('telefone');
  await nova.getByRole('button', { name: 'Registrar evento' }).click();
  await expect(page.getByText('Evento registrado nesta conversa.')).toBeVisible();
  const f = ficha(page);
  for (const t of ['Novo interesse', 'Reunião', 'de manhã', '~8', 'Pela equipe · Telefone', 'Falta: data']) await expect(f).toContainText(t);
  const ev = (await api(page, `atendimento/conversas/${conversa.id}`)).evento;
  expect(ev).toMatchObject({ conversa_id: conversa.id, telefone_e164: `+${c.wa_id}`, nome_contato: c.nome, origem: 'equipe', canal: 'telefone', responsavel_id: null });
  expect((await api(page, `atendimento/conversas/${conversa.id}`)).assunto).toBe('evento');
  await page.getByRole('button', { name: 'Mais ações da conversa' }).click();
  await expect(page.getByRole('menuitem', { name: 'Registrar evento' })).toHaveCount(0);
  expect((await api(page, 'atendimento/eventos')).total).toBe(3);
});

test('6. unidades: quem é de outra unidade não vê evento algum; o Proprietário vê todos', async ({ page }) => {
  await entrar(page, 'gerente_noite');
  const lista = await api(page, 'atendimento/eventos');
  expect(lista.total).toBe(0);
  expect(lista.itens).toEqual([]);
  expect((await page.request.get(`${PAINEL}/admin/api/atendimento/eventos/${oportunidadeId}`)).status()).toBe(404);
  const negado = await page.request.patch(`${PAINEL}/admin/api/atendimento/eventos/${oportunidadeId}`, { headers: escrever, data: { observacoes: 'não devia' } });
  expect(negado.status()).toBe(404);
  expect((await api(page, 'atendimento/eventos/opcoes')).unidade_id).toBeNull();
  const resumo = await api(page, 'atendimento/resumo');
  expect(Object.values(resumo.eventos).every((n) => n === 0)).toBe(true);
  // na tela: a conversa não traz a ficha (o evento é do Café) e o atalho não aponta nada aguardando
  await page.goto(`${PAINEL}/admin/atendimento`);
  await expect(page.getByRole('button', { name: /^Eventos/ }).locator('.contador')).toHaveCount(0);

  await entrar(page, 'dono');
  expect((await api(page, 'atendimento/eventos')).total).toBe(3);
});
