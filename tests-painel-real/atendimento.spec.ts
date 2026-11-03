// Atendimento CONTRA O BACKEND REAL local (giardini_back: ops/atendimento/integracao_local.py — banco isolado, dados
// fictícios, Meta simulada em 127.0.0.1, assistente DESLIGADO). O caminho inteiro da homologação, sem celular:
// webhook assinado da Meta → conversa "Esperando" no painel → resposta humana sai pela Meta → o assistente continua
// desligado (nem o n8n consegue pedir rodada) e a mensagem seguinte do cliente não gera aviso repetido.
//   PAINEL_REAL_API=http://127.0.0.1:8765 PAINEL_REAL_CHAVE=<painel_chave> PAINEL_REAL_ATENDIMENTO=<atendimento.json> \
//     npx playwright test -c playwright.painel-real.config.ts tests-painel-real/atendimento.spec.ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';

const PAINEL = 'http://127.0.0.1:4494';
const caminho = process.env.PAINEL_REAL_ATENDIMENTO ?? '';
test.skip(!caminho, 'Defina PAINEL_REAL_ATENDIMENTO (JSON do ops/atendimento/integracao_local.py).');

interface Integracao {
  api: string; meta: string; numero_meta: string; segredo_app: string; n8n_api_key: string; senha: string;
  contas: Record<'atendente' | 'gerente', string>; cliente: { wa_id: string; nome: string };
}
const A: Integracao = caminho ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : ({} as Integracao);
const AVISO = 'Recebemos sua mensagem! Nossa equipe vai te responder em breve.';
const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: PAINEL };

interface Enviada { to: string; type: string; text?: { body: string } }
const enviadas = async (r: APIRequestContext): Promise<Enviada[]> => (await r.get(`${A.meta}/_enviadas`)).json();

/** Webhook como a Meta manda: corpo bruto assinado com o App Secret (X-Hub-Signature-256). */
async function clienteEscreve(r: APIRequestContext, texto: string) {
  const bruto = Buffer.from(JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba-simulada', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: A.numero_meta },
      contacts: [{ wa_id: A.cliente.wa_id, profile: { name: A.cliente.nome } }],
      messages: [{ from: A.cliente.wa_id, id: `wamid.integ.${crypto.randomUUID()}`, timestamp: `${Math.floor(Date.now() / 1000)}`,
                   type: 'text', text: { body: texto } }],
    } }] }],
  }), 'utf8');
  const assinatura = 'sha256=' + crypto.createHmac('sha256', A.segredo_app).update(bruto).digest('hex');
  const resp = await r.post(`${A.api}/webhooks/whatsapp`, { data: bruto, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': assinatura } });
  expect(resp.status(), await resp.text()).toBe(200);
}

async function entrar(page: Page, conta: keyof Integracao['contas']) {
  const r = await page.request.post(`${PAINEL}/admin/api/sessao`, { headers: escrever, data: { email: A.contas[conta], senha: A.senha } });
  expect(r.ok(), `login ${conta}: ${r.status()}`).toBe(true);
}

async function conversaPelaApi(page: Page) {
  const lista = await (await page.request.get(`${PAINEL}/admin/api/atendimento/conversas`)).json();
  const c = lista.find((x: { telefone_e164: string }) => x.telefone_e164 === `+${A.cliente.wa_id}`);
  expect(c, 'conversa do cliente fictício na API').toBeTruthy();
  return c;
}

test('cliente escreve → painel mostra → equipe responde pela Meta → assistente segue desligado', async ({ page }) => {
  await page.request.delete(`${A.meta}/_enviadas`);
  const pergunta = `Oi! Vocês têm mesa para 4 no sábado? [integ ${Date.now()}]`;
  await clienteEscreve(page.request, pergunta);

  // 1. Assistente desligado: a conversa espera a equipe e o cliente recebe UM aviso de recebimento.
  await expect.poll(async () => (await enviadas(page.request)).map((m) => m.text?.body)).toEqual([AVISO]);

  // 2. Painel: a conversa aparece em "Esperando", com a mensagem do cliente.
  await entrar(page, 'atendente');
  await page.goto(`${PAINEL}/admin/atendimento`);
  await expect(page.getByRole('heading', { name: 'Atendimento', level: 1 })).toBeVisible();
  await page.getByRole('group', { name: 'Filtrar conversas' }).getByRole('button', { name: /^Esperando/ }).click();
  const item = page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: new RegExp(A.cliente.nome) });
  await expect(item).toHaveAttribute('data-estado', 'esperando');
  await item.click();
  await expect(page.locator('.mensagens')).toContainText(pergunta);
  const chave = page.getByRole('switch', { name: /Assistente/ });
  await expect(chave).toHaveAttribute('aria-checked', 'false');

  // 3. Resposta humana: sai pela Meta (simulada) para o número do cliente e entra na conversa.
  const resposta = 'Oi! Aqui é a equipe do Âmbar. Para sábado, a reserva é pelo site; posso te ajudar com algo mais?';
  await page.getByRole('textbox', { name: 'Resposta' }).fill(resposta);
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(page.locator('.mensagens')).toContainText('Aqui é a equipe do Âmbar');
  await expect.poll(async () => (await enviadas(page.request)).map((m) => [m.to, m.text?.body]))
    .toEqual([[A.cliente.wa_id, AVISO], [A.cliente.wa_id, resposta]]);

  // 4. Depois do envio humano: em atendimento, assistente desligado, e o n8n não consegue pedir rodada da IA.
  await expect(chave).toHaveAttribute('aria-checked', 'false');
  let c = await conversaPelaApi(page);
  expect([c.estado, c.assistente_ligado]).toEqual(['em_atendimento', false]);
  const rodada = await page.request.post(`${A.api}/internal/atendimento/rodadas`, {
    headers: { 'X-Api-Key': A.n8n_api_key, 'Content-Type': 'application/json' }, data: { silencio_segundos: 0 } });
  expect(rodada.status()).toBe(503);

  // 5. O cliente responde: entra na mesma conversa, continua com a equipe, sem aviso repetido nem robô.
  const seguinte = `Obrigado! Vou reservar pelo site. [integ ${Date.now()}]`;
  await clienteEscreve(page.request, seguinte);
  await expect.poll(async () => {
    const d = await (await page.request.get(`${PAINEL}/admin/api/atendimento/conversas/${c.id}`)).json();
    return d.mensagens.map((m: { texto: string | null }) => m.texto);
  }).toContain(seguinte);
  await page.reload();
  await expect(page.locator('.mensagens')).toContainText(seguinte);
  c = await conversaPelaApi(page);
  expect([c.estado, c.assistente_ligado]).toEqual(['em_atendimento', false]);
  await page.waitForTimeout(1500);                       // dá tempo de um aviso indevido sair
  expect((await enviadas(page.request)).length).toBe(2);
});
