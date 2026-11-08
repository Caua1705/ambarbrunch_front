// Do cadastro à saída, pelo caminho real: painel → API → motor facial real → Postgres. Câmera falsa com vídeo sintético.
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { API, baterPonto, botaoPonto, entrar, ontemFortaleza, ruidoDeSensor, tokenPainel } from './apoio';

let contexto: BrowserContext;
let page: Page;

test.describe.serial('Jornada completa', () => {
  test.beforeAll(async ({ browser }) => {
    contexto = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ruidoDeSensor(contexto);
    page = await contexto.newPage();
    await entrar(page, 'dono');
  });
  test.afterAll(() => contexto.close());

  test('sem funcionários, a visão geral convida a cadastrar', async () => {
    await page.goto('/admin/equipe');
    await expect(page.getByRole('heading', { name: 'Nenhum funcionário cadastrado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar funcionário' })).toBeVisible();
  });

  test('1. cadastra funcionário', async () => {
    await page.getByRole('button', { name: 'Cadastrar funcionário' }).click();
    await page.getByRole('button', { name: 'Novo funcionário' }).click();
    await page.getByLabel('Nome completo').fill('Ana Homolog');
    await page.getByLabel('Função').fill('Barista');
    // Nome no tablet sai do nome; fica em Dados adicionais, sem precisar abrir.
    await expect(page.getByLabel('Nome no tablet')).toBeHidden();
    await page.getByRole('button', { name: 'Salvar' }).click();
    const ficha = page.getByRole('dialog', { name: 'Ana Homolog' });
    await expect(ficha).toBeVisible();
    await expect(ficha.getByText('Sem cadastro')).toBeVisible();
    await expect(ficha.locator('dd', { hasText: /^Ana$/ })).toBeVisible();
    await expect(ficha.getByText('Sem horário definido')).toBeVisible();
  });

  test('2. edita o cadastro', async () => {
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Função').fill('Barista chefe');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog', { name: 'Ana Homolog' }).getByText('Barista chefe')).toBeVisible();
    await page.getByRole('dialog', { name: 'Ana Homolog' }).getByRole('button', { name: 'Fechar' }).click();
  });

  test('4. cria escala compartilhada e atribui (Funcionários → Semana e escalas)', async () => {
    await page.getByRole('button', { name: 'Semana e escalas' }).click();
    await page.getByRole('button', { name: 'Escalas cadastradas' }).click();
    await page.getByRole('button', { name: 'Criar escala' }).click();
    await page.getByLabel('Nome da escala').fill('Comercial');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Escala criada.')).toBeVisible();
    await page.getByRole('button', { name: 'Atribuir', exact: true }).click();
    await page.getByRole('dialog', { name: 'Atribuir escala' }).getByLabel('Funcionário').selectOption({ label: 'Ana Homolog' });
    await page.getByRole('dialog', { name: 'Atribuir escala' }).getByRole('button', { name: 'Atribuir' }).click();
    await expect(page.getByText('Escala atribuída.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Escalas' }).getByText('Ana')).toBeVisible();
    await page.getByRole('button', { name: 'Semana', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Escala da semana' }).getByRole('rowheader', { name: 'Ana' })).toBeVisible();
  });

  test('atribuição retroativa é recusada', async () => {
    const token = await tokenPainel(page.request, 'dono');
    const cab = { Authorization: `Bearer ${token}` };
    const escalas = await (await page.request.get(`${API}/admin/ponto/escalas`, { headers: cab })).json();
    const pessoas = await (await page.request.get(`${API}/admin/ponto/funcionarios`, { headers: cab })).json();
    const r = await page.request.post(`${API}/admin/ponto/escalas/${escalas[0].id}/atribuicoes`, { headers: cab, data: { funcionario_id: pessoas.itens[0].id, vigente_de: ontemFortaleza() } });
    expect(r.status()).toBe(422);
    expect((await r.json()).codigo).toBe('vigencia_retroativa');
  });

  test('5. cadastro facial supervisionado, com teste e confirmação do Proprietário', async () => {
    await page.getByRole('tab', { name: 'Funcionários' }).click();
    await page.getByRole('cell', { name: 'Ana Homolog' }).click();
    await page.getByRole('link', { name: 'Cadastro facial' }).click();
    await expect(page).toHaveURL(/cadastro-facial/);

    const camera = page.getByRole('button', { name: 'Abrir câmera e capturar' });
    await expect(camera).toBeDisabled();
    await page.getByRole('checkbox').check();
    const envio = page.waitForRequest((r) => r.url().endsWith('/captura-direta'));
    await camera.click();
    expect((await envio).url().startsWith(API), 'os quadros vão direto à API, sem a Vercel').toBeTruthy();
    await expect(page.getByRole('button', { name: 'Abrir câmera e testar' })).toBeVisible({ timeout: 40_000 });
    await page.getByRole('button', { name: 'Abrir câmera e testar' }).click();
    await expect(page.getByRole('button', { name: 'Confirmar cadastro' })).toBeVisible({ timeout: 40_000 });
    await page.getByRole('button', { name: 'Confirmar cadastro' }).click();
    await expect(page.getByText('Cadastro facial de Ana ativo.')).toBeVisible();
  });

  test('18a. cadastra tablet e autoriza este aparelho sem token no armazenamento', async () => {
    await page.goto('/admin/configuracoes?secao=ponto');
    await page.getByRole('button', { name: 'Cadastrar tablet' }).first().click();
    await page.getByLabel('Nome do tablet').fill('Tablet do balcão');
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Autorizar Tablet do balcão' })).toBeVisible();
    await page.getByRole('button', { name: 'Autorizar este aparelho' }).click();
    await expect(page).toHaveURL(/\/ponto/);
    await expect(botaoPonto(page)).toBeVisible();
    await expect(page.getByText('Tablet do balcão')).toBeVisible();
    const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }) + document.cookie);
    expect(guardado).not.toContain('ambar_tablet');
    const cookie = (await contexto.cookies(`${API}/quiosque/ponto/configuracao`)).find((c) => c.name === 'ambar_tablet');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
  });

  test('6 e 9. funcionário reconhecido registra a entrada', async () => {
    await baterPonto(page);
    await expect(page.locator('.ponto__recibo')).toContainText('Ana', { timeout: 20_000 });
    await expect(page.locator('.ponto__recibo')).toContainText('Entrada');
    const camera = await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).srcObject);
    expect(camera, 'a câmera fecha depois da captura').toBeNull();
  });

  test('13. batida duplicada não grava duas vezes', async () => {
    await expect(botaoPonto(page)).toBeVisible({ timeout: 10_000 });
    await baterPonto(page);
    await expect(page.locator('.ponto__cartao')).toContainText('Ponto já registrado');
    await page.getByRole('button', { name: 'Voltar' }).click();
  });

  for (const [n, tipo] of [['10', 'Início do intervalo'], ['11', 'Fim do intervalo'], ['12', 'Saída']] as const) {
    test(`${n}. ${tipo}`, async () => {
      await page.waitForTimeout(26_000);     // passa da janela de repetição da homologação
      await baterPonto(page, tipo);
      await expect(page.locator('.ponto__recibo')).toContainText(tipo, { timeout: 20_000 });
      await expect(botaoPonto(page)).toBeVisible({ timeout: 10_000 });
    });
  }

  test('o painel mostra as quatro batidas calculadas pelo backend', async () => {
    await page.goto('/admin/equipe?aba=registros');
    const linha = page.getByRole('row', { name: /Ana/ }).first();
    await expect(linha).toContainText('Encerrada');
    await linha.click();
    const lista = page.getByRole('list', { name: 'Marcações' });
    for (const tipo of ['Entrada', 'Início do intervalo', 'Fim do intervalo', 'Saída']) await expect(lista).toContainText(tipo);
    await expect(lista).toContainText('Tablet');
  });
});
