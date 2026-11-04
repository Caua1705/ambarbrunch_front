// Cardápio, localização e handoff CONTRA O BACKEND REAL local (giardini_back com a migração 0024, banco isolado, dados fictícios,
// Meta simulada em 127.0.0.1, assistente LIGADO). O "n8n" é este teste, e faz o papel de um modelo que ERRA: esquece o anexo,
// responde o que devia ir para a equipe. O backend tem de garantir a regra mesmo assim, e o painel tem de mostrar o que saiu.
// Preparo: python ops/atendimento/integracao_local.py <url_admin> <pasta> eventos
//   PAINEL_REAL_API=http://127.0.0.1:8767 PAINEL_REAL_CHAVE=<painel_chave> PAINEL_REAL_EVENTOS=<pasta>/eventos.json \
//     npx playwright test -c playwright.painel-real.config.ts tests-painel-real/atendimento-cardapio.spec.ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';

const PAINEL = 'http://127.0.0.1:4494';
const caminho = process.env.PAINEL_REAL_EVENTOS ?? '';
test.skip(!caminho, 'Defina PAINEL_REAL_EVENTOS (JSON de integracao_local.py ... eventos).');
test.describe.configure({ mode: 'serial' });

interface Cliente { wa_id: string; nome: string }
interface Integracao {
  api: string; meta: string; numero_meta: string; segredo_app: string; n8n_api_key: string; senha: string;
  contas: Record<'atendente' | 'gerente', string>;
  clientes: Record<'cardapio', Cliente>;
}
const A: Integracao = caminho ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : ({} as Integracao);
const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: PAINEL };
const N8N = () => ({ 'X-Api-Key': A.n8n_api_key, 'Content-Type': 'application/json' });
const AVISO = 'Vou chamar alguém da nossa equipe pra te ajudar por aqui!';

interface Enviada { to: string; type: string; text?: { body: string }; document?: { id: string; filename: string }; location?: { latitude: number; longitude: number } }
const enviadas = async (r: APIRequestContext) =>
  ((await (await r.get(`${A.meta}/_enviadas`)).json()) as Enviada[]).filter((m) => m.to === A.clientes.cardapio.wa_id);

async function clienteEscreve(r: APIRequestContext, texto: string) {
  const c = A.clientes.cardapio;
  const bruto = Buffer.from(JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba-simulada', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: A.numero_meta },
      contacts: [{ wa_id: c.wa_id, profile: { name: c.nome } }],
      messages: [{ from: c.wa_id, id: `wamid.cardapio.${crypto.randomUUID()}`, timestamp: `${Math.floor(Date.now() / 1000)}`, type: 'text', text: { body: texto } }],
    } }] }],
  }), 'utf8');
  const assinatura = 'sha256=' + crypto.createHmac('sha256', A.segredo_app).update(bruto).digest('hex');
  const resp = await r.post(`${A.api}/webhooks/whatsapp`, { data: bruto, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': assinatura } });
  expect(resp.status(), await resp.text()).toBe(200);
}

interface Rodada { conversa_id: string; lote: string; ate_mensagem_id: number; telefone_e164: string }
/** O n8n pede rodadas até aparecer a deste cliente e responde como o modelo responderia. */
async function modeloResponde(r: APIRequestContext, texto: string, intencao: string) {
  let achada: Rodada | undefined;
  await expect.poll(async () => {
    const resp = await r.post(`${A.api}/internal/atendimento/rodadas`, { headers: N8N(), data: { silencio_segundos: 2 } });
    expect(resp.status(), await resp.text()).toBe(200);
    achada = ((await resp.json()).rodadas as Rodada[]).find((x) => x.telefone_e164 === `+${A.clientes.cardapio.wa_id}`);
    return !!achada;
  }, { timeout: 20_000, intervals: [1000] }).toBe(true);
  const resp = await r.post(`${A.api}/internal/atendimento/conversas/${achada!.conversa_id}/resposta`, {
    headers: N8N(),
    data: { lote: achada!.lote, ate_mensagem_id: achada!.ate_mensagem_id, partes: [texto], intencao, links: [], encaminhar: false, motivo: null, followup: null },
  });
  expect(resp.status(), await resp.text()).toBe(200);
  return { conversaId: achada!.conversa_id, ...(await resp.json()) } as { conversaId: string; encaminhada: boolean };
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
async function abrirConversa(page: Page) {
  await page.goto(`${PAINEL}/admin/atendimento`);
  await page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: new RegExp(A.clientes.cardapio.nome) }).click();
}

let conversaId = '';

test('1. o cliente pede o cardápio e o modelo esquece o anexo: sai o PDF nativo, e o painel mostra', async ({ page }) => {
  await page.request.delete(`${A.meta}/_enviadas`);
  await entrar(page, 'atendente');
  await clienteEscreve(page.request, 'Oi! Me manda o cardápio?');
  conversaId = (await modeloResponde(page.request, 'Claro!', 'cardapio')).conversaId;
  const saida = await enviadas(page.request);
  expect(saida.map((m) => m.type)).toEqual(['text', 'document']);
  expect(saida[1].document).toMatchObject({ id: 'midia-simulada-1', filename: 'Cardapio-Ambar-Cafe.pdf' });
  await abrirConversa(page);
  await expect(page.getByText('PDF do cardápio')).toBeVisible();
  const mensagens = await api<{ id: number; tipo: string }[]>(page, `atendimento/conversas/${conversaId}/mensagens`);
  const pdf = mensagens.find((m) => m.tipo === 'documento')!;
  const baixado = await page.request.get(`${PAINEL}/admin/api/atendimento/mensagens/${pdf.id}/midia`);
  expect(baixado.status()).toBe(200);
  expect((await baixado.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('2. localização pedida: pino nativo com as coordenadas oficiais, etiquetado no painel', async ({ page }) => {
  await entrar(page, 'atendente');
  await clienteEscreve(page.request, 'me manda a localização');
  await modeloResponde(page.request, 'Te mando aqui!', 'informacao');
  const saida = (await enviadas(page.request)).at(-1)!;
  expect(saida.type).toBe('location');
  expect(saida.location).toMatchObject({ latitude: -3.732444, longitude: -38.489108 });
  await abrirConversa(page);
  await expect(page.getByText('Localização no mapa')).toBeVisible();
});

test('3. Cardápio e capacidades: catálogo com 59 itens, PDF vigente e capacidade conferida', async ({ page }) => {
  await entrar(page, 'gerente');
  await page.goto(`${PAINEL}/admin/atendimento`);
  const mais = page.getByRole('button', { name: 'Mais opções do Atendimento' });
  await expect(mais.or(page.getByRole('button', { name: 'Cardápio', exact: true })).first()).toBeVisible();
  if (await mais.count()) {
    await mais.click();
    await page.getByRole('menuitem', { name: 'Cardápio' }).click();
  } else {
    await page.getByRole('button', { name: 'Cardápio', exact: true }).click();
  }
  const g = page.getByRole('dialog', { name: 'Cardápio e capacidades' });
  await expect(g.getByText('Catálogo (59 itens)')).toBeVisible();
  await expect(g.getByText('PDF enviado aos clientes')).toBeVisible();
  await expect(g.getByRole('button', { name: /Nova versão/ })).toBeVisible();
  const capacidades = g.getByRole('region', { name: 'Capacidades dos ambientes' });
  await expect(capacidades).toContainText('Jardim externo');
  await expect(capacidades).toContainText('Capacidade diferente'); // o Jardim da base de teste tem 10
  await expect(capacidades).toContainText('Confere');
  await expect(capacidades).toContainText('Não cadastrado');
});

test('4. alergia que o modelo tentou responder: nada dele sai, Esperando equipe, e a equipe responde pelo painel', async ({ page }) => {
  await entrar(page, 'atendente');
  await clienteEscreve(page.request, 'Sou alérgico, esse croissant tem glúten?');
  const r = await modeloResponde(page.request, 'Não tem não, pode comer!', 'cardapio');
  expect(r.encaminhada).toBe(true);
  expect((await enviadas(page.request)).at(-1)!.text?.body).toBe(AVISO);
  await expect.poll(async () => (await api(page, `atendimento/conversas/${conversaId}`)).estado).toBe('esperando');
  expect((await api(page, `atendimento/conversas/${conversaId}`)).assistente_ligado).toBe(false);
  await abrirConversa(page);
  const caixa = page.getByRole('textbox', { name: 'Resposta' });
  await caixa.fill('Oi! Aqui é da equipe, vou confirmar com a cozinha.');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect.poll(async () => (await api(page, `atendimento/conversas/${conversaId}`)).estado).toBe('em_atendimento');
  await expect.poll(async () => (await enviadas(page.request)).at(-1)!.text?.body).toBe('Oi! Aqui é da equipe, vou confirmar com a cozinha.');
  // O histórico inteiro continua na mesma conversa: cliente, assistente, PDF, localização e equipe.
  const mensagens = await api<{ autor: string; tipo: string }[]>(page, `atendimento/conversas/${conversaId}/mensagens`);
  expect(new Set(mensagens.map((m) => m.autor))).toEqual(new Set(['cliente', 'robo', 'equipe']));
  expect(mensagens.some((m) => m.tipo === 'documento') && mensagens.some((m) => m.tipo === 'localizacao')).toBe(true);
  // Mensagem nova do cliente com a equipe atendendo: o assistente continua calado.
  await clienteEscreve(page.request, 'obrigado!');
  await page.waitForTimeout(3000);
  const rodadas = await page.request.post(`${A.api}/internal/atendimento/rodadas`, { headers: N8N(), data: { silencio_segundos: 2 } });
  expect(((await rodadas.json()).rodadas as Rodada[]).some((x) => x.conversa_id === conversaId)).toBe(false);
});
