// 8. Foto parada da pessoa CADASTRADA diante da câmera: o desafio de pose não é cumprido. Isto só mostra que a tela trata a
// falha. Não demonstra proteção contra fraude: vídeo e foto manipulada ficam para a homologação física.
import { test, expect } from '@playwright/test';
import { baterEVerResultado, novoTablet, parearPorCodigo, ruidoDeSensor } from './apoio';

test('8. foto parada da pessoa cadastrada falha na prova de vida', async ({ page, request }) => {
  await ruidoDeSensor(page);
  await parearPorCodigo(page, (await novoTablet(request, `Tablet parada ${Date.now()}`)).token);
  const r = await baterEVerResultado(page);
  expect(r.resultado).toBe('falha_prova_de_vida');
  expect(r.motivo).toBe('desafio_nao_cumprido');
  await expect(page.locator('.ponto__cartao')).toContainText('Ponto não registrado');
  await expect(page.locator('.ponto__recibo')).toHaveCount(0);
});
