// 19. Chromium sem nenhum dispositivo de vídeo: a falha é real, não simulada.
import { test, expect } from '@playwright/test';
import { botaoPonto, novoTablet, parearPorCodigo } from './apoio';

test('19. câmera indisponível orienta a procurar o gestor', async ({ page, request }) => {
  await parearPorCodigo(page, (await novoTablet(request, `Tablet sem câmera ${Date.now()}`)).token);
  await botaoPonto(page).click();
  await expect(page.locator('.ponto__cartao')).toContainText('Câmera indisponível', { timeout: 15_000 });
  await expect(page.locator('.ponto__cartao')).toContainText('gestor');
});
