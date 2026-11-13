// Tablet do café (Modo Operação), na demonstração: checklist de abertura de ponta a ponta — assumir pelo nome (sem
// reconhecimento facial, como a produção de hoje), marcar Feito / Não feito com observação, GRAVAR o vídeo no navegador
// (câmera falsa do Chromium: um padrão de teste, nada de imagem real), prévia, envio com progresso e conclusão. Também:
// /ponto antigo leva ao Modo Operação e a tela cabe no tablet sem rolagem horizontal. A consulta do Proprietário e a sessão
// renovável são provadas contra o backend real (tests-tablet-real/).
import { test, expect } from '@playwright/test';
import { DEMO, entrarDemo, semRolagemHorizontal } from './apoio';

test.use({
  viewport: { width: 1280, height: 800 },
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

test('checklist de abertura: assume pelo nome, marca, grava o vídeo, envia e conclui', async ({ page }) => {
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin/operacao?secao=ponto`);
  await page.getByRole('tab', { name: 'Checklist de abertura' }).click();
  await expect(page).toHaveURL(/ponto=abertura/);
  await expect(page.getByText('Ninguém assumiu ainda.')).toBeVisible();
  await expect(page.getByText('13 tarefas no checklist de hoje.')).toBeVisible();

  // Sem rosto: escolhe o nome e fica aguardando a confirmação do gestor.
  await page.getByRole('button', { name: /escolher meu nome/ }).click();
  await page.getByRole('button', { name: /Ritiele/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Assumir a abertura como Ritiele?' });
  await dialogo.getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByText('aguardando confirmação do gestor')).toBeVisible();
  await expect(page.locator('.op-tarefa')).toHaveCount(13);

  // Concluir fica travado até tudo estar marcado.
  const concluir = page.getByRole('button', { name: 'Concluir e enviar' });
  await expect(concluir).toBeDisabled();
  const tarefas = page.locator('.op-tarefa');
  for (let i = 0; i < 12; i++) await tarefas.nth(i).getByRole('button', { name: 'Feito', exact: true }).click();
  const vidros = page.getByRole('group', { name: 'Limpar vidros' });
  await vidros.getByRole('button', { name: 'Não feito' }).click();
  await expect(page.getByText('Explique por que cada tarefa não foi feita.')).toBeVisible();
  const obs = page.getByLabel('Observação sobre Limpar vidros');
  await obs.fill('Faltou o rodo');
  await obs.blur();
  await expect(page.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await expect(page.getByText('12 de 13 feitas · 1 não feita')).toBeVisible();
  await expect(concluir).toBeDisabled();   // falta o vídeo

  // Vídeo: abre a câmera, grava, para, assiste a prévia, refaz, grava de novo e envia.
  await page.getByRole('button', { name: 'Gravar vídeo da abertura' }).click();
  await page.getByRole('button', { name: 'Abrir a câmera' }).click();
  await page.getByRole('button', { name: 'Gravar', exact: true }).click();
  await expect(page.locator('.op-video__rec')).toContainText('/ 2:00');
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Parar a gravação' }).click();
  await expect(page.getByLabel('Prévia do vídeo da abertura')).toBeVisible();
  await page.getByRole('button', { name: 'Refazer' }).click();
  await page.getByRole('button', { name: 'Abrir a câmera' }).click();
  await page.getByRole('button', { name: 'Gravar', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Parar a gravação' }).click();
  await page.getByRole('button', { name: 'Enviar vídeo' }).click();
  await expect(page.getByText(/Vídeo enviado às/)).toBeVisible({ timeout: 20_000 });

  expect(await semRolagemHorizontal(page)).toBe(true);
  await expect(concluir).toBeEnabled();
  await concluir.click();
  await expect(page.getByText('Checklist de hoje concluído.')).toBeVisible();
  await expect(page.locator('.op-marca').first()).toBeDisabled();

  // O que ficou guardado (consulta da gerência na demonstração).
  await entrarDemo(page, 'admin');
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const lista = await (await page.request.get(`${DEMO}/admin/api/abertura?de=${hoje}&ate=${hoje}`)).json();
  expect(lista.itens).toHaveLength(1);
  expect(lista.itens[0].estado).toBe('concluido');
  expect(lista.itens[0].responsavel.nome_exibicao).toBe('Ritiele');
  expect(lista.itens[0].nao_feitos).toEqual([{ titulo: 'Limpar vidros', observacao: 'Faltou o rodo' }]);
  expect(lista.itens[0].video.tamanho_bytes).toBeGreaterThan(1000);
  // Uma abertura por dia: a segunda pessoa recebe quem já assumiu.
  await entrarDemo(page, 'operador');
  const de_novo = await page.request.post(`${DEMO}/admin/api/abertura/hoje/assumir`, { headers: { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO }, data: { funcionario_id: 'f0000001-0000-4000-8000-000000000001' } });
  expect(de_novo.status()).toBe(409);
});

test('registrar ponto sem reconhecimento facial: diz que nada foi registrado e mostra o caminho do gestor', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });   // tablet em pé
  await entrarDemo(page, 'operador');
  await page.goto(`${DEMO}/admin/operacao?secao=ponto`);
  await expect(page.getByRole('tab', { name: 'Registrar ponto' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Ponto pelo rosto desligado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar ponto' })).toHaveCount(0);
  await expect(page.getByText('Incluir batida')).toBeVisible();
  expect(await semRolagemHorizontal(page)).toBe(true);
});

test('o endereço antigo /ponto leva ao Modo Operação; a câmera só é liberada lá', async ({ page }) => {
  const html = await (await page.request.get(`${DEMO}/ponto`)).text();
  expect(html).toContain('url=/admin/operacao?secao=ponto');
  await entrarDemo(page, 'operador');
  const r = await page.request.get(`${DEMO}/admin/operacao`);
  expect(r.headers()['permissions-policy']).toContain('camera=(self)');
  expect(r.headers()['content-security-policy']).toContain("media-src 'self' blob: https:");
  const manifesto = await (await page.request.get(`${DEMO}/operacao.webmanifest`)).json();
  expect(manifesto.start_url).toBe('/admin/operacao');
  expect(manifesto.display).toBe('fullscreen');
});
