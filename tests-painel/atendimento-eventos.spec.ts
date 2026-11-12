// Eventos no Atendimento (demonstração): etiqueta "Evento" e prioridade na caixa, visão compacta das oportunidades, ficha
// na lateral da conversa (faixa + gaveta no tablet e no celular), edição dos dados, status comercial só com a gerência,
// registro manual sem duplicar (409), handoff (assumir e responder com o assistente desligado), erros e o backend antigo.
// A demonstração imita app/modulos/atendimento/eventos.py (mesmas regras e códigos de erro do contrato §7).
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo, semRolagemHorizontal } from './apoio';

const escrever = { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO };

async function abrir(page: Page, papel: 'admin' | 'gerente' | 'operador') {
  await entrarDemo(page, papel);
  await page.goto(`${DEMO}/admin/atendimento`);
  // O Atendente vê as Conversas dentro do Modo Operação (o painel administrativo não é dele).
  if (papel === 'operador') await expect(page).toHaveURL(/\/admin\/operacao\?secao=atendimento/);
  else await expect(page.getByRole('heading', { name: 'Atendimento', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Conversas' })).toBeVisible();
}
const item = (page: Page, nome: RegExp) => page.getByRole('list', { name: 'Conversas' }).getByRole('button', { name: nome });
const ficha = (page: Page) => page.getByRole('complementary', { name: 'Ficha do evento' });
const conversaDe = async (page: Page, nome: string) => (await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas?busca=${encodeURIComponent(nome)}`)).json())[0];

test('caixa: etiqueta Evento, atalho com os que aguardam contato e visão compacta que abre a conversa', async ({ page }) => {
  await abrir(page, 'operador');
  // evento encaminhado e esperando a equipe: etiqueta com tom de atenção; com o assistente: etiqueta discreta
  const larissa = item(page, /Larissa Pontes/);
  await expect(larissa.locator('.etiqueta', { hasText: 'Evento' })).toHaveClass(/etiqueta--atencao/);
  await expect(item(page, /Bruno Arrais/).locator('.etiqueta', { hasText: 'Evento' })).not.toHaveClass(/etiqueta--atencao/);
  await expect(item(page, /Marcos Sales/).locator('.etiqueta', { hasText: 'Evento' })).toHaveCount(0);

  const atalho = page.getByRole('button', { name: /^Eventos/ });
  await expect(atalho).toHaveClass(/pilula--atencao/);
  await expect(atalho.locator('.contador')).toContainText('1');
  await atalho.click();
  await expect(page).toHaveURL(/eventos=1/);
  const gaveta = page.getByRole('dialog', { name: 'Eventos' });
  await expect(gaveta.getByLabel('Eventos por status')).toContainText('1 aguardando contato');
  const lista = gaveta.getByRole('list', { name: 'Eventos' });
  // aguardando contato primeiro (o backend ordena), destacado
  await expect(lista.getByRole('button').first()).toContainText('Larissa Pontes');
  await expect(lista.getByRole('button').first()).toHaveClass(/evento-item--prioridade/);
  await expect(lista).toContainText('Bruno Arrais');
  await gaveta.getByRole('button', { name: 'Fechados' }).click();
  await expect(lista).toContainText('Sofia Lins');
  await expect(lista).toContainText('Fechado');
  await gaveta.getByRole('button', { name: 'Perdidos' }).click();
  await expect(gaveta.getByText('Nenhum evento perdido')).toBeVisible();
  await gaveta.getByRole('button', { name: /^Em andamento/ }).click();
  await gaveta.getByRole('searchbox', { name: 'Buscar evento' }).fill('ninguém com este nome');
  await expect(gaveta.getByText('Nenhum evento encontrado')).toBeVisible();
  await gaveta.getByRole('searchbox', { name: 'Buscar evento' }).fill('');
  await lista.getByRole('button', { name: /Larissa Pontes/ }).click();

  // a gaveta fecha e a conversa abre com a ficha na lateral
  await expect(gaveta).toHaveCount(0);
  await expect(page).not.toHaveURL(/eventos=1/);
  const f = ficha(page);
  await expect(f).toBeVisible();
  await expect(f).toContainText('Aguardando contato');
  for (const t of ['Aniversário', '19h', '~20', 'Jardim', 'bolo próprio', 'Pelo assistente']) await expect(f).toContainText(t);
  await expect(page.locator('.conversa__quem .etiqueta', { hasText: 'Evento' })).toBeVisible();
  await expect(page.locator('.conversa__motivo')).toContainText('o assistente passou os detalhes para a equipe');
  // link do sino
  await page.goto(`${DEMO}/admin/atendimento?eventos=1`);
  await expect(page.getByRole('dialog', { name: 'Eventos' })).toBeVisible();
});

test('Atendente: corrige os dados, não muda o status comercial; assume e responde com o assistente desligado', async ({ page }) => {
  await abrir(page, 'operador');
  await item(page, /Larissa Pontes/).click();
  const f = ficha(page);
  await expect(f).toContainText('só a gerência altera');
  await expect(f.getByRole('combobox', { name: 'Status comercial' })).toHaveCount(0);
  await f.getByRole('button', { name: 'Editar dados' }).click();
  await f.getByRole('spinbutton', { name: /Convidados/ }).fill('25');
  await f.getByRole('textbox', { name: /Observações/ }).fill('Prefere mesa comprida perto das árvores');
  await f.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(page.getByText('Dados do evento atualizados.')).toBeVisible();
  await expect(f).toContainText('~25 pessoas');
  await expect(f).toContainText('Prefere mesa comprida');

  // o backend recusa o status para o Atendente (403 sem_permissao), mesmo pela API
  const c = await conversaDe(page, 'Larissa');
  const ev = (await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas/${c.id}`)).json()).evento;
  const negado = await page.request.patch(`${DEMO}/admin/api/atendimento/eventos/${ev.id}`, { headers: escrever, data: { status: 'fechado' } });
  expect(negado.status()).toBe(403);
  expect((await negado.json()).codigo).toBe('sem_permissao');
  // convidados fora do limite: o formulário segura antes de enviar
  await f.getByRole('button', { name: 'Editar dados' }).click();
  await f.getByRole('spinbutton', { name: /Convidados/ }).fill('5000');
  await f.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(f.getByText('Informe de 1 a 2.000 pessoas.')).toBeVisible();
  await f.getByRole('button', { name: 'Cancelar' }).click();

  // handoff: assumir e responder normalmente; o assistente continua desligado e o status comercial não muda sozinho
  await page.getByRole('button', { name: 'Assumir', exact: true }).click();
  await expect(page.getByText('Você assumiu a conversa.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Resposta' }).fill('Oi, Larissa! Aqui é a equipe. Vamos combinar o seu aniversário.');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(page.locator('.mensagens')).toContainText('Vamos combinar o seu aniversário');
  await expect(page.getByRole('switch', { name: /Assistente/ })).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.conversa__quem')).toContainText('Com você');
  await expect(f).toContainText('Aguardando contato');
  // o histórico continua inteiro (a mensagem do cliente com os detalhes do evento)
  await expect(page.locator('.mensagens')).toContainText('Umas 20 pessoas');
});

test('Gerência: status comercial, responsável e perda com motivo; evento novo depois, sem duplicar o aberto', async ({ page }) => {
  await abrir(page, 'gerente');
  await item(page, /Bruno Arrais/).click();
  const f = ficha(page);
  await expect(f).toContainText('Novo interesse');
  await f.getByRole('combobox', { name: 'Status comercial' }).selectOption('em_negociacao');
  await expect(page.getByText('Status comercial: Em negociação.')).toBeVisible();
  await f.getByRole('combobox', { name: 'Responsável' }).selectOption({ label: 'Gabriela Gerente (demo)' });
  await expect(page.getByText(/Responsável: Gabriela/)).toBeVisible();
  // o status comercial não mexe no estado da conversa (continua com o assistente)
  await expect(page.locator('.conversa__quem')).toContainText('Assistente');

  await f.getByRole('combobox', { name: 'Status comercial' }).selectOption('perdido');
  const dialogo = page.getByRole('alertdialog', { name: 'Marcar o evento como perdido?' });
  await dialogo.getByRole('textbox', { name: 'Motivo da perda' }).fill('Fechou em outro lugar');
  await dialogo.getByRole('button', { name: 'Marcar como perdido' }).click();
  await expect(page.getByText('Evento marcado como perdido.')).toBeVisible();
  await expect(f).toContainText('Motivo da perda: Fechou em outro lugar');

  // concluído: dá para registrar um evento novo nesta conversa
  await f.getByRole('button', { name: 'Registrar novo evento' }).click();
  const nova = page.getByRole('dialog', { name: 'Registrar evento' });
  await nova.getByRole('combobox', { name: /Tipo de evento/ }).selectOption('comemoracao');
  await nova.getByRole('spinbutton', { name: /Convidados/ }).fill('12');
  await nova.getByRole('combobox', { name: /Canal/ }).selectOption('telefone');
  await nova.getByRole('button', { name: 'Registrar evento' }).click();
  await expect(page.getByText('Evento registrado nesta conversa.')).toBeVisible();
  await expect(f).toContainText('Novo interesse');
  await expect(f).toContainText('Comemoração');
  await expect(f).toContainText('Pela equipe · Telefone');

  // uma aberta por conversa: registrar de novo ou reabrir a perdida = 409 evento_aberto_na_conversa
  const c = await conversaDe(page, 'Bruno');
  const outra = await page.request.post(`${DEMO}/admin/api/atendimento/conversas/${c.id}/evento`, { headers: escrever, data: { tipo: 'outro' } });
  expect(outra.status()).toBe(409);
  expect((await outra.json()).codigo).toBe('evento_aberto_na_conversa');
  const todos = (await (await page.request.get(`${DEMO}/admin/api/atendimento/eventos?busca=Bruno`)).json()).itens;
  expect(todos).toHaveLength(2);
  const perdida = todos.find((e: { status: string }) => e.status === 'perdido');
  const reabrir = await page.request.patch(`${DEMO}/admin/api/atendimento/eventos/${perdida.id}`, { headers: escrever, data: { status: 'em_negociacao' } });
  expect(reabrir.status()).toBe(409);
  // as duas são do mesmo contato e da mesma conversa
  expect(new Set(todos.map((e: { conversa_id: string; telefone_e164: string }) => `${e.conversa_id}|${e.telefone_e164}`)).size).toBe(1);
  expect(todos[0].telefone_e164).toBe(c.telefone_e164);
});

test('registro manual numa conversa sem evento: menu "…", etiqueta na caixa e nada de segundo registro', async ({ page }) => {
  await abrir(page, 'operador');
  await item(page, /Tiago Moura/).click();
  await expect(ficha(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Mais ações da conversa' }).click();
  await page.getByRole('menuitem', { name: 'Registrar evento' }).click();
  const nova = page.getByRole('dialog', { name: 'Registrar evento' });
  await nova.getByRole('combobox', { name: /Tipo de evento/ }).selectOption('aniversario');
  await nova.getByLabel(/Data pretendida/).fill('2026-12-12');
  await nova.getByRole('textbox', { name: /Horário/ }).fill('à tarde');
  await nova.getByRole('combobox', { name: /Ambiente/ }).selectOption('sala_privativa');
  await nova.getByRole('textbox', { name: /Necessidades/ }).fill('cadeirão para bebê');
  await nova.getByRole('button', { name: 'Registrar evento' }).click();
  await expect(page.getByText('Evento registrado nesta conversa.')).toBeVisible();
  const f = ficha(page);
  for (const t of ['Aniversário', 'sáb 12/12/2026', 'à tarde', 'Sala Privativa', 'cadeirão para bebê', 'Falta: pessoas']) await expect(f).toContainText(t);
  await expect(item(page, /Tiago Moura/).locator('.etiqueta', { hasText: 'Evento' })).toBeVisible();
  await page.getByRole('button', { name: 'Mais ações da conversa' }).click();
  await expect(page.getByRole('menuitem', { name: 'Registrar evento' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // evento ligado ao contato certo
  const c = await conversaDe(page, 'Tiago');
  const ev = (await (await page.request.get(`${DEMO}/admin/api/atendimento/conversas/${c.id}`)).json()).evento;
  expect(ev).toMatchObject({ conversa_id: c.id, telefone_e164: c.telefone_e164, nome_contato: 'Tiago Moura', origem: 'equipe', status: 'novo_interesse' });
  expect(ev.responsavel_id).toBeNull();
});

test('erros: lista de eventos e opções indisponíveis, ambiente que não existe, e backend sem eventos (anterior à 0023)', async ({ page }) => {
  await abrir(page, 'gerente');
  await page.route('**/admin/api/atendimento/eventos?*', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: /^Eventos/ }).click();
  const gaveta = page.getByRole('dialog', { name: 'Eventos' });
  await expect(gaveta.getByText('Não foi possível carregar')).toBeVisible();
  await expect(gaveta.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await page.unroute('**/admin/api/atendimento/eventos?*');
  await gaveta.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(gaveta.getByRole('list', { name: 'Eventos' })).toBeVisible();
  await page.keyboard.press('Escape');

  // opções indisponíveis: a ficha mostra os dados, avisa e não deixa editar nem mudar o status
  await page.route('**/admin/api/atendimento/eventos/opcoes', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto(`${DEMO}/admin/atendimento`);
  await item(page, /Larissa Pontes/).click();
  await expect(ficha(page)).toContainText('Não foi possível carregar as opções do evento');
  await expect(ficha(page)).toContainText('Aniversário');
  await expect(ficha(page).getByRole('button', { name: 'Editar dados' })).toBeDisabled();
  await expect(ficha(page).getByRole('combobox', { name: 'Status comercial' })).toHaveCount(0);
  await page.unroute('**/admin/api/atendimento/eventos/opcoes');
  await ficha(page).getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(ficha(page).getByRole('combobox', { name: 'Status comercial' })).toBeVisible();

  // ambiente desconhecido: o backend devolve 422 ambiente_desconhecido e o formulário mostra no campo
  await item(page, /Larissa Pontes/).click();
  const f = ficha(page);
  await page.route('**/admin/api/atendimento/eventos/*', (r) => (r.request().method() === 'PATCH'
    ? r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: 'Ambiente desconhecido nesta unidade.', codigo: 'ambiente_desconhecido' }) })
    : r.fallback()));
  await f.getByRole('button', { name: 'Editar dados' }).click();
  await f.getByRole('combobox', { name: /Ambiente/ }).selectOption('lounge');
  await f.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(f.getByRole('alert').first()).toContainText('não existe');
  await f.getByRole('button', { name: 'Cancelar' }).click();
  await page.unroute('**/admin/api/atendimento/eventos/*');

  // backend antigo: o resumo não tem `eventos` → nenhum atalho, etiqueta, ficha ou "Registrar evento"
  await page.route('**/admin/api/atendimento/resumo', async (r) => {
    const resp = await r.fetch();
    const corpo = await resp.json();
    delete corpo.eventos;
    await r.fulfill({ response: resp, json: corpo });
  });
  await page.goto(`${DEMO}/admin/atendimento`);
  await expect(item(page, /Larissa Pontes/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Eventos/ })).toHaveCount(0);
  await expect(page.locator('.conversa-item .etiqueta', { hasText: 'Evento' })).toHaveCount(0);
  await item(page, /Larissa Pontes/).click();
  await expect(page.getByRole('textbox', { name: 'Resposta' })).toBeVisible();
  await expect(ficha(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Mais ações da conversa' }).click();
  await expect(page.getByRole('menuitem', { name: 'Registrar evento' })).toHaveCount(0);
});

for (const [nome, viewport] of [['tablet', { width: 1024, height: 768 }], ['celular', { width: 390, height: 844 }]] as const) {
  test(`responsivo (${nome}): faixa do evento abre a ficha em gaveta, sem rolagem lateral`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await abrir(page, 'gerente');
    expect(await semRolagemHorizontal(page)).toBe(true);
    await item(page, /Larissa Pontes/).click();
    await expect(ficha(page)).toBeHidden();
    const faixa = page.getByRole('button', { name: /^Ficha do evento/ });
    await expect(faixa).toBeVisible();
    expect(await semRolagemHorizontal(page)).toBe(true);
    await faixa.click();
    const gaveta = page.getByRole('dialog', { name: 'Evento', exact: true });
    await expect(gaveta.getByRole('combobox', { name: 'Status comercial' })).toBeVisible();
    await expect(gaveta).toContainText('Aniversário');
    expect(await semRolagemHorizontal(page)).toBe(true);
    await gaveta.getByRole('button', { name: 'Fechar' }).click();
    await expect(gaveta).toHaveCount(0);
    // no celular a conversa ocupa a tela: volta para a lista, onde fica o atalho
    const voltar = page.getByRole('button', { name: 'Voltar para a lista' });
    if (await voltar.isVisible()) await voltar.click();
    await page.getByRole('button', { name: /^Eventos/ }).click();
    await expect(page.getByRole('dialog', { name: 'Eventos' }).getByRole('list', { name: 'Eventos' })).toBeVisible();
    expect(await semRolagemHorizontal(page)).toBe(true);
  });
}
