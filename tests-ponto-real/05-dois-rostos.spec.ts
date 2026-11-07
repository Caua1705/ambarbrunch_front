// Duas pessoas na imagem: de quem seria a batida? Não registra.
import { test, expect } from '@playwright/test';
import { baterEVerResultado, novoTablet, parearPorCodigo, ruidoDeSensor } from './apoio';

test('dois rostos na imagem não registram ponto', async ({ page, request }) => {
  await ruidoDeSensor(page);
  await parearPorCodigo(page, (await novoTablet(request, `Tablet dois ${Date.now()}`)).token);
  const r = await baterEVerResultado(page);
  expect(r.resultado).toBe('qualidade_insuficiente');
  expect(r.motivo).toBe('multiplos_rostos');
  await expect(page.locator('.ponto__cartao')).toContainText('Ponto não registrado');
});
