// 8b. A foto da pessoa CADASTRADA, com o nariz deformado para simular a virada, mas com a testa parada: a regra de movimento da
// cabeça recusa (`movimento_insuficiente`) e a tela orienta a virar a cabeça inteira. Mostra que o ataque recriado em laboratório
// é barrado pelo caminho real (navegador, API, motor). Não substitui os ataques físicos da homologação.
import { test, expect } from '@playwright/test';
import { baterEVerResultado, novoTablet, parearPorCodigo, ruidoDeSensor } from './apoio';

test('8b. foto deformada da pessoa cadastrada é recusada pelo movimento da cabeça', async ({ page, request }) => {
  await ruidoDeSensor(page);
  await parearPorCodigo(page, (await novoTablet(request, `Tablet deformada ${Date.now()}`)).token);
  const r = await baterEVerResultado(page);
  expect(r.resultado).toBe('falha_prova_de_vida');
  expect(r.motivo).toBe('movimento_insuficiente');
  await expect(page.locator('.ponto__cartao')).toContainText('Ponto não registrado');
  await expect(page.locator('.ponto__cartao')).toContainText('Vire a cabeça inteira');
  await expect(page.locator('.ponto__recibo')).toHaveCount(0);
});
