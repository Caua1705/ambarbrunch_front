// Nenhum rosto diante da câmera.
import { test, expect } from '@playwright/test';
import { baterEVerResultado, novoTablet, parearPorCodigo, ruidoDeSensor } from './apoio';

test('sem rosto na imagem, orienta e não registra', async ({ page, request }) => {
  await ruidoDeSensor(page);
  await parearPorCodigo(page, (await novoTablet(request, `Tablet vazio ${Date.now()}`)).token);
  const r = await baterEVerResultado(page);
  expect(r.resultado).toBe('qualidade_insuficiente');
  expect(r.motivo).toBe('sem_rosto');
  await expect(page.locator('.ponto__cartao')).toContainText('Ponto não registrado');
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
});
