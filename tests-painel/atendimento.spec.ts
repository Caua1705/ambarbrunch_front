// Atendimento (demonstração): central única — estados da caixa, conversa com mídia e linha do tempo única, assistente
// ligado/desligado, assumir, ficha do contato, nova conversa com template, campanhas, base de conhecimento, cadastros
// duplicados e o fim da página Clientes (redireciona para cá).
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo, post, semRolagemHorizontal } from './apoio';

async function abrirAtendimento(page: Page, papel: 'admin' | 'gerente' | 'operador' = 'operador') {
  await entrarDemo(page, papel);
  await page.goto(`${DEMO}/admin/atendimento`);
  await expect(page.getByRole('heading', { name: 'Atendimento', level: 1 })).toBeVisible();
}
const conversa = (page: Page, nome: RegExp) => page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: nome });

test('conversa com o assistente: responder assume, ligar o assistente de novo e encerrar', async ({ page }) => {
  await abrirAtendimento(page);
  await conversa(page, /Marcos Sales/).click();
  // com o assistente (ou encerrada numa rodada anterior da demonstração): ninguém é dono, qualquer um assume ou responde
  await expect(page.getByRole('switch', { name: /Assistente/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Resposta' }).fill('Oi, Marcos! Aqui é a equipe do Âmbar.');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(page.locator('.mensagens')).toContainText('Aqui é a equipe do Âmbar');
  // responder desligou o assistente nesta conversa
  const chave = page.getByRole('switch', { name: /Assistente/ });
  await expect(chave).toHaveAttribute('aria-checked', 'false');
  await chave.click();
  await page.getByRole('dialog', { name: 'Ligar o assistente nesta conversa?' }).getByRole('button', { name: 'Ligar assistente' }).click();
  await expect(page.getByText('Assistente ligado nesta conversa.')).toBeVisible();
  await expect(chave).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Encerrar conversa' }).click();
  await page.getByRole('dialog', { name: 'Encerrar esta conversa?' }).getByRole('button', { name: 'Encerrar' }).click();
  await expect(page.getByText('Conversa encerrada.')).toBeVisible();
});

test('conversa de outra pessoa: só "Assumir no lugar" libera a resposta', async ({ page }) => {
  // a demonstração guarda o estado no servidor: antes, a Gerente fica com a conversa (transferindo se preciso)
  await entrarDemo(page, 'gerente');
  const [paula] = await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas?busca=Paula`)).json();
  expect((await post(page.request, `${DEMO}/admin/api/atendimento/conversas/${paula.id}/assumir`, { transferir: true }, { 'X-Painel': '1', Origin: DEMO })).ok()).toBe(true);
  await abrirAtendimento(page);
  await conversa(page, /Paula Ximenes/).click();
  await expect(page.getByRole('textbox', { name: 'Resposta' })).toBeDisabled();
  await page.getByRole('button', { name: /^Assumir no lugar/ }).click();
  await page.getByRole('dialog', { name: /^Assumir a conversa no lugar de / }).getByRole('button', { name: 'Assumir no lugar' }).click();
  await expect(page.getByText('Conversa transferida para você.')).toBeVisible();
});

test('caixa: filtro Esperando com contador, não respondidas e o estado de cada conversa', async ({ page }) => {
  await abrirAtendimento(page);
  const filtros = page.getByRole('group', { name: 'Filtrar conversas' });
  for (const f of ['Todas', 'Esperando', 'Assistente', 'Equipe', 'Encerradas']) await expect(filtros.getByRole('button', { name: new RegExp(`^${f}`) })).toBeVisible();
  await filtros.getByRole('button', { name: /^Esperando/ }).click();
  await expect(page).toHaveURL(/filtro=esperando/);
  const renata = conversa(page, /Renata Holanda/);
  await expect(renata).toBeVisible();
  await expect(renata).toHaveAttribute('data-estado', 'esperando');
  await expect(renata.locator('.conversa-item__conta')).toBeVisible();
  await expect(conversa(page, /Marcos Sales/)).toHaveCount(0);
  // a configuração da demonstração tem o assistente e o envio ligados: nenhum aviso de configuração
  await expect(page.getByText('Assistente virtual desligado')).toHaveCount(0);
  // link antigo do sino (filtro=aguardando) cai no mesmo filtro
  await page.goto(`${DEMO}/admin/atendimento?filtro=aguardando`);
  await expect(page.getByRole('group', { name: 'Filtrar conversas' }).getByRole('button', { name: /^Esperando/ })).toHaveAttribute('aria-pressed', 'true');
});

test('linha do tempo: imagem, documento, campanha e mensagens de reserva na mesma conversa', async ({ page }) => {
  await abrirAtendimento(page);
  await conversa(page, /Renata Holanda/).click();
  const msgs = page.locator('.mensagens');
  const img = msgs.locator('.msg__midia img');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(msgs.getByRole('link', { name: /Abrir arquivo: lista-de-convidados\.txt/ })).toBeVisible();
  await expect(msgs.locator('[data-autor="campanha"]').first()).toContainText('Campanha');
  await expect(msgs.locator('[data-autor="campanha"]').first()).toContainText('Template');
  await conversa(page, /Mariana Albuquerque/).click();
  await expect(msgs.locator('[data-externa="reserva"]')).toContainText('Confirmação da reserva AMB-DEMO2');
  await expect(msgs.locator('[data-externa="automacao"]')).toContainText('Presença confirmada');
  await expect(msgs.locator('[data-autor="automacao"]')).toContainText('Follow-up');
});

test('ponte da mídia: imagem abre no painel; documento HTML do cliente desce como download, nunca como página', async ({ page }) => {
  await entrarDemo(page, 'operador');
  const lista = await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas?busca=Teixeira`)).json();
  const detalhe = await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas/${lista[0].id}`)).json();
  const html = detalhe.mensagens.find((m: { midia_mime: string | null }) => m.midia_mime === 'text/html');
  const r = await page.request.get(`${DEMO}/admin/api/atendimento/mensagens/${html.id}/midia`);
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toBe('application/octet-stream');
  expect(r.headers()['content-disposition']).toMatch(/^attachment/);
  expect(r.headers()['content-security-policy']).toBeUndefined();
  const [renata] = await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas?busca=Renata`)).json();
  const d2 = await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas/${renata.id}`)).json();
  const imagem = d2.mensagens.find((m: { tipo: string }) => m.tipo === 'imagem');
  const ri = await page.request.get(`${DEMO}/admin/api/atendimento/mensagens/${imagem.id}/midia`);
  expect(ri.headers()['content-type']).toBe('image/png');
  expect(ri.headers()['content-disposition']).toMatch(/^inline/);
  expect(ri.headers()['x-content-type-options']).toBe('nosniff');
  expect((await ri.body()).subarray(1, 4).toString()).toBe('PNG');
});

test('ficha do contato: reservas com link, consentimentos e o selo de cadastro ambíguo', async ({ page }) => {
  await abrirAtendimento(page, 'gerente');
  await conversa(page, /Mariana Albuquerque/).click();
  await page.getByRole('button', { name: 'Ficha do contato' }).click();
  const ficha = page.getByRole('dialog', { name: /Mariana Albuquerque/ });
  await expect(ficha.getByRole('heading', { name: 'Próximas reservas' })).toBeVisible();
  await expect(ficha.getByText('mariana@exemplo.invalid')).toBeVisible();
  await expect(ficha.getByText('Marketing por WhatsApp')).toBeVisible();
  await expect(ficha.locator('a[href^="/admin/reservas?data="]').first()).toBeVisible();
  await ficha.getByRole('button', { name: 'Fechar' }).click();
  await conversa(page, /Teixeira/).click();
  await page.getByRole('button', { name: 'Ficha do contato' }).click();
  await expect(page.getByRole('dialog').getByText('Cadastro ambíguo: 2 cadastros com este telefone.')).toBeVisible();
});

test('nova conversa: contato achado na busca com template; número sem WhatsApp nunca aparece como enviado', async ({ page }) => {
  await abrirAtendimento(page);
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  const g = page.getByRole('dialog', { name: 'Nova conversa' });
  await g.getByRole('searchbox', { name: 'Buscar contato ou digitar telefone' }).fill('Rafael');
  await g.getByRole('list', { name: 'Contatos encontrados' }).getByRole('button', { name: /Rafael Holanda/ }).click();
  await g.getByLabel('Template').selectOption('boas_vindas_ambar');
  await g.getByLabel('Nome').fill('Rafael');
  await expect(g.getByRole('group', { name: 'Prévia da mensagem' })).toContainText('Olá, Rafael! Aqui é o Âmbar Café.');
  await g.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Mensagem enviada.')).toBeVisible();
  await expect(page.locator('.conversa__quem h3')).toHaveText('Rafael Holanda');
  await expect(page.locator('.mensagens')).toContainText('Olá, Rafael!');

  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await g.getByRole('searchbox', { name: 'Buscar contato ou digitar telefone' }).fill('85 98888-9999');
  await g.getByRole('button', { name: /Usar o número/ }).click();
  await g.getByLabel('Template').selectOption('boas_vindas_ambar');
  await g.getByLabel('Nome', { exact: true }).fill('Teste');
  await g.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText(/A mensagem não saiu: Número sem WhatsApp/)).toBeVisible();
  await expect(page.getByText('Mensagem enviada.')).toHaveCount(0);
});

test('Gerente: campanha de teste — rascunho com bloqueio, confirmação e envio em lotes', async ({ page }) => {
  await abrirAtendimento(page, 'gerente');
  await page.getByRole('button', { name: 'Mais opções do Atendimento' }).click();
  await page.getByRole('menuitem', { name: 'Campanhas' }).click();
  const g = page.getByRole('dialog', { name: 'Campanhas' });
  await expect(g.getByText('Teste do template de boas-vindas')).toBeVisible();
  await g.getByRole('button', { name: 'Nova campanha' }).click();
  const n = page.getByRole('dialog', { name: 'Nova campanha' });
  await n.getByLabel('Nome da campanha').fill('Teste de novembro');
  await n.getByLabel('Template').selectOption('boas_vindas_ambar');
  await n.getByLabel('Nome', { exact: true }).fill('Cliente');
  await expect(n.getByRole('checkbox', { name: /Campanha de teste/ })).toBeChecked();
  await n.getByLabel('Destinatários').fill('85 99123-0001\n85 97777-1234;Ana');
  await n.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page.getByText(/Rascunho criado/)).toBeVisible();
  const d = page.getByRole('dialog', { name: 'Campanhas' });
  await expect(d.getByRole('list', { name: 'Destinatários' })).toContainText('não é número de teste');
  await d.getByRole('button', { name: 'Enviar', exact: true }).click();
  const confirmar = page.getByRole('dialog', { name: /Enviar a campanha de TESTE/ });
  await expect(confirmar).toContainText('só para os números de teste');
  await confirmar.getByRole('button', { name: 'Enviar teste' }).click();
  await expect(page.getByText(/Envio concluído: 1 enviada/)).toBeVisible();
});

test('base de conhecimento: a gerência cadastra com fonte; o Atendente só lê e não vê campanhas', async ({ page }) => {
  await abrirAtendimento(page, 'gerente');
  await page.getByRole('button', { name: 'Mais opções do Atendimento' }).click();
  await page.getByRole('menuitem', { name: 'Base de conhecimento' }).click();
  const g = page.getByRole('dialog', { name: 'Base de conhecimento' });
  await expect(g.getByText('Só o que o Âmbar confirmou. Sem a informação aqui, o assistente passa para a equipe.')).toBeVisible();
  await g.getByRole('button', { name: /Estacionamento/ }).click();
  await g.getByLabel('O que o assistente pode dizer').fill('Há vagas gratuitas na rua em frente; não temos estacionamento próprio.');
  await g.getByLabel('Fonte').fill('Gerência, reunião de 02/11');
  await g.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Salvo: o assistente já pode usar.')).toBeVisible();
  await expect(g.getByRole('list', { name: 'Itens da base de conhecimento' })).toContainText('vagas gratuitas');

  await abrirAtendimento(page, 'operador');
  await page.getByRole('button', { name: 'Mais opções do Atendimento' }).click();
  await expect(page.getByRole('menuitem', { name: 'Campanhas' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Cadastros duplicados' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Base de conhecimento' }).click();
  const leitura = page.getByRole('dialog', { name: 'Base de conhecimento' });
  await expect(leitura.getByText('vagas gratuitas')).toBeVisible();
  await expect(leitura.getByRole('button', { name: /Editar/ })).toHaveCount(0);
  expect((await page.request.get(`${DEMO}/admin/api/atendimento/campanhas`)).status()).toBe(403);
  expect((await page.request.get(`${DEMO}/admin/api/atendimento/duplicidades`)).status()).toBe(403);
});

test('cardápio e capacidades: PDF vigente, catálogo com busca e só a gerência troca o PDF', async ({ page }) => {
  await abrirAtendimento(page, 'operador');
  await page.getByRole('button', { name: 'Mais opções do Atendimento' }).click();
  await page.getByRole('menuitem', { name: 'Cardápio e capacidades' }).click();
  const g = page.getByRole('dialog', { name: 'Cardápio e capacidades' });
  await expect(g.getByText('Versão 2026-11-03.1')).toBeVisible();
  await expect(g.getByRole('link', { name: 'Abrir o PDF vigente' })).toBeVisible();
  await expect(g.getByRole('button', { name: 'Nova versão' })).toHaveCount(0);
  await g.getByLabel('Buscar no catálogo').fill('brie');
  await expect(g.getByText('Brie e geleia')).toBeVisible();
  await expect(g.getByText('Cappuccino')).toHaveCount(0);
  await expect(g.getByText('Jardim externo', { exact: true })).toBeVisible();
  await expect(g.getByText('Sala privativa', { exact: true })).toBeVisible();

  await abrirAtendimento(page, 'gerente');
  await page.getByRole('button', { name: 'Mais opções do Atendimento' }).click();
  await page.getByRole('menuitem', { name: 'Cardápio e capacidades' }).click();
  await expect(page.getByRole('dialog', { name: 'Cardápio e capacidades' }).getByRole('button', { name: 'Nova versão' })).toBeVisible();
});

test('cadastros duplicados: liga ao principal sem apagar nada', async ({ page }) => {
  await abrirAtendimento(page, 'gerente');
  await page.getByRole('button', { name: 'Mais opções do Atendimento' }).click();
  await page.getByRole('menuitem', { name: 'Cadastros duplicados' }).click();
  const g = page.getByRole('dialog', { name: 'Cadastros duplicados' });
  await expect(g.getByText('Nada é apagado nem fundido.', { exact: false })).toBeVisible();
  const grupo = g.locator('.grupo-duplicado', { hasText: 'Provável mesma pessoa' });
  await grupo.getByRole('button', { name: /Ligar 1 cadastro ao principal/ }).click();
  const confirmar = page.getByRole('dialog', { name: /^Ligar 1 cadastro a / });
  await confirmar.getByLabel('Por que são a mesma pessoa?').fill('Mesmo nome e e-mail, confirmado pelo WhatsApp');
  await confirmar.getByRole('button', { name: 'Ligar' }).click();
  await expect(page.getByText('Cadastros ligados ao principal.')).toBeVisible();
  await expect(g.locator('.grupo-duplicado', { hasText: 'Provável mesma pessoa' })).toHaveCount(0);
});

test('a página Clientes saiu do menu e os links antigos caem no Atendimento', async ({ page }) => {
  await entrarDemo(page, 'gerente');
  await page.goto(`${DEMO}/admin`);
  await expect(page.getByRole('navigation', { name: 'Módulos' }).getByRole('link', { name: 'Clientes' })).toHaveCount(0);
  const r = await page.request.get(`${DEMO}/admin/clientes?id=c0000000-0000-4000-8000-000000000001`, { maxRedirects: 0 });
  expect(r.status()).toBe(303);
  expect(r.headers()['location']).toBe('/admin/atendimento');
  await page.goto(`${DEMO}/admin/clientes`);
  await expect(page).toHaveURL(`${DEMO}/admin/atendimento`);
  await expect(page.getByRole('heading', { name: 'Atendimento', level: 1 })).toBeVisible();
});

test('celular: conversa aberta sem rolagem horizontal, com voltar e o interruptor do assistente', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await abrirAtendimento(page);
  await conversa(page, /Renata Holanda/).click();
  await expect(page.getByRole('button', { name: 'Voltar para a lista' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Assistente/ })).toBeVisible();
  expect(await semRolagemHorizontal(page)).toBe(true);
  await page.getByRole('button', { name: 'Voltar para a lista' }).click();
  await expect(page.getByRole('list', { name: 'Conversas' })).toBeVisible();
  expect(await semRolagemHorizontal(page)).toBe(true);
});
