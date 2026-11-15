// Tablet do café (Modo Operação), na demonstração: checklist de abertura de ponta a ponta no fluxo simplificado de 15/11 —
// os nomes aparecem na hora, um toque no próprio nome abre o checklist (sem rosto, sem modal, sem aprovação), Feito / Não
// feito com motivo salvos sozinhos, GRAVAR o vídeo no navegador (câmera falsa do Chromium: um padrão de teste, nada de
// imagem real) com um botão só, prévia, envio com progresso e conclusão — que só libera com o vídeo salvo. Também: recarregar
// a página volta ao mesmo checklist e devolve o vídeo gravado e ainda não enviado; /ponto antigo leva ao Modo Operação; a
// tela cabe no tablet em pé e deitado. A consulta do Proprietário e a sessão renovável são provadas contra o backend real
// (tests-tablet-real/).
import { test, expect, type Page } from '@playwright/test';
import { DEMO, entrarDemo, semRolagemHorizontal } from './apoio';

test.use({
  viewport: { width: 1280, height: 800 },
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const abrirChecklist = async (page: Page) => {
  await page.goto(`${DEMO}/admin/operacao?secao=ponto`);
  await page.getByRole('tab', { name: 'Checklist de abertura' }).click();
  await expect(page).toHaveURL(/ponto=abertura/);
};

const gravar = async (page: Page, ms: number) => {
  await page.getByRole('button', { name: 'Gravar vídeo' }).click();
  await page.getByRole('button', { name: 'Iniciar gravação' }).click();
  await expect(page.locator('.op-video__rec')).toContainText('/ 1:30');
  await page.waitForTimeout(ms);
  await page.getByRole('button', { name: 'Parar' }).click();
  await expect(page.getByLabel('Prévia do vídeo da abertura')).toBeVisible();
};

test('checklist de abertura: toca no nome, marca, grava o vídeo, envia e conclui — sem modal nem aprovação', async ({ page }) => {
  await entrarDemo(page, 'operador');
  await abrirChecklist(page);

  // Os nomes já estão na tela: nenhum botão "Assumir", nenhum rosto, nenhuma confirmação.
  await expect(page.getByRole('heading', { name: 'Quem está abrindo hoje?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Assumir/ })).toHaveCount(0);
  // Tocou no nome errado: Voltar mostra os nomes de novo e o toque no certo troca (sem modal).
  await page.getByRole('button', { name: /Rayssa/ }).click();
  await expect(page.getByText('Responsável: Rayssa')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('heading', { name: 'Quem está abrindo hoje?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rayssa/ })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: /Ritiele/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Responsável: Ritiele')).toBeVisible();
  // Voltar e tocar no mesmo nome só volta ao checklist.
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: /Ritiele/ }).click();
  await expect(page.getByText('Responsável: Ritiele')).toBeVisible();
  await expect(page.getByText(/aguardando|confirmação do gestor/)).toHaveCount(0);
  await expect(page.locator('.op-tarefa')).toHaveCount(13);
  await expect(page.getByText('0 de 13 tarefas')).toBeVisible();

  // Concluir fica travado até tudo estar marcado e o vídeo salvo.
  const concluir = page.getByRole('button', { name: 'Concluir abertura' });
  await expect(concluir).toBeDisabled();
  const tarefas = page.locator('.op-tarefa');
  for (let i = 0; i < 12; i++) await tarefas.nth(i).getByRole('button', { name: 'Feito', exact: true }).click();
  await expect(page.getByText('12 de 13 tarefas')).toBeVisible();
  const vidros = page.getByRole('group', { name: 'Limpar vidros' });
  await vidros.getByRole('button', { name: 'Não feito' }).click();
  const motivo = page.getByLabel('Motivo: Limpar vidros');
  await expect(motivo).toBeFocused();
  await expect(page.getByText('Escreva o motivo de cada tarefa não feita.')).toBeVisible();
  await motivo.pressSequentially('Faltou o rodo');
  // Salva sozinho (sem botão de salvar), quando para de digitar.
  await expect(page.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await expect(page.getByText('13 de 13 tarefas')).toBeVisible();
  await expect(page.getByText('Falta o vídeo da abertura.')).toBeVisible();
  await expect(concluir).toBeDisabled();
  // O caminho de "justificar a falta de vídeo" não existe no tablet.
  await expect(page.getByText(/Por que não há vídeo|Não foi possível gravar/)).toHaveCount(0);

  // Vídeo: um botão, a câmera abre direto; grava, assiste a prévia, grava de novo e envia.
  await expect(page.getByText('Grave um vídeo mostrando o salão, vitrines, banheiros, entrada e jardim.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Usar a câmera do aparelho|Abrir a câmera/ })).toHaveCount(0);
  await gravar(page, 2200);
  await page.getByRole('button', { name: 'Gravar de novo' }).click();
  await gravar(page, 1500);

  // Recarregar a página (queda, toque errado): volta ao mesmo checklist, com as marcações e o vídeo gravado ainda não enviado.
  await page.reload();
  await expect(page.getByText('Responsável: Ritiele')).toBeVisible();
  await expect(page.getByText('13 de 13 tarefas')).toBeVisible();
  await expect(page.getByLabel('Motivo: Limpar vidros')).toHaveValue('Faltou o rodo');
  await expect(page.getByText('Vídeo gravado e ainda não enviado.')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar vídeo' }).click();
  await expect(page.getByText(/^Vídeo salvo/)).toBeVisible({ timeout: 20_000 });

  expect(await semRolagemHorizontal(page)).toBe(true);
  await expect(concluir).toBeEnabled();
  await concluir.click();
  await expect(page.getByText('Abertura concluída', { exact: false })).toBeVisible();
  await expect(page.getByText('12 de 13 tarefas feitas')).toBeVisible();
  await expect(page.getByText(/Não feita: Limpar vidros/)).toBeVisible();

  // O que ficou guardado (consulta da gerência na demonstração).
  await entrarDemo(page, 'admin');
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  const lista = await (await page.request.get(`${DEMO}/admin/api/abertura?de=${hoje}&ate=${hoje}`)).json();
  expect(lista.itens).toHaveLength(1);
  expect(lista.itens[0].estado).toBe('concluido');
  expect(lista.itens[0].responsavel.nome_exibicao).toBe('Ritiele');
  expect(lista.itens[0].nao_feitos).toEqual([{ titulo: 'Limpar vidros', observacao: 'Faltou o rodo' }]);
  expect(lista.itens[0].video.tamanho_bytes).toBeGreaterThan(1000);
  expect(['video/mp4', 'video/webm']).toContain(lista.itens[0].video.mime);
  expect(lista.itens[0].whatsapp.modo).toBe('desligado');
  // Uma abertura por dia: a segunda pessoa recebe quem já assumiu.
  await entrarDemo(page, 'operador');
  const de_novo = await page.request.post(`${DEMO}/admin/api/abertura/hoje/assumir`, { headers: { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: DEMO }, data: { funcionario_id: 'f0000001-0000-4000-8000-000000000001' } });
  expect(de_novo.status()).toBe(409);
});

test('tablet deitado e em pé: nomes, tarefas e botões grandes, sem rolagem horizontal', async ({ page }) => {
  await entrarDemo(page, 'operador');
  for (const tela of [{ width: 1280, height: 800 }, { width: 800, height: 1280 }]) {
    await page.setViewportSize(tela);
    await abrirChecklist(page);
    await page.locator('.op-nome, .op-marca, .op-recibo').first().waitFor();
    expect(await semRolagemHorizontal(page)).toBe(true);
    const alturas = await page.locator('.op-nome, .op-marca, .op-terminal__principal').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(Math.min(...alturas)).toBeGreaterThanOrEqual(56);
  }
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
