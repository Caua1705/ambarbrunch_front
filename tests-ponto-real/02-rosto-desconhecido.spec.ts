// 7. Pessoa sem cadastro, diante do motor real: nunca é identificada.
import { test, expect } from '@playwright/test';
import { baterEVerResultado, novoTablet, parearPorCodigo, ruidoDeSensor } from './apoio';

test('7. rosto desconhecido não registra ponto', async ({ page, request }) => {
  await ruidoDeSensor(page);
  await parearPorCodigo(page, (await novoTablet(request, `Tablet desconhecido ${Date.now()}`)).token);
  const r = await baterEVerResultado(page);
  expect(['rosto_desconhecido', 'baixa_confianca']).toContain(r.resultado);
  await expect(page.locator('.ponto__cartao')).toContainText('Ponto não registrado');
  await expect(page.locator('.ponto__recibo')).toHaveCount(0);
});
