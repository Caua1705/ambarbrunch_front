// Interações da rodada de 2026-10-17: cardápio tátil, baralho de bebidas, ficha nutricional e experiência sem avisos internos.
import { test, expect } from '@playwright/test';

test('sem avisos internos na experiência (“a confirmar”, “crédito a confirmar”, marcador de revisão)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.pending, .review-flag, [data-motion-toggle]')).toHaveCount(0);
  const texto = (await page.locator('body').innerText()).toLowerCase();
  for (const t of ['a confirmar', 'autorização pendente', 'foto de referência', 'leitura', 'luz âmbar']) expect(texto, t).not.toContain(t);
});

test('cardápio tátil: etiqueta com itens abre o cartão, troca de conteúdo e fecha com Esc', async ({ page }) => {
  await page.goto('/');
  const sand = page.locator('[data-categoria="sanduiches"]');
  await sand.scrollIntoViewIfNeeded();
  await sand.click();
  await expect(sand).toHaveAttribute('aria-expanded', 'true');
  const painel = page.locator('#painel-comer');
  await expect(painel).toBeVisible();
  await expect(painel.locator('[data-cat="sanduiches"]')).toBeVisible();
  await expect(painel.locator('[data-cat="sanduiches"]')).toContainText('Brie & mirtilo');
  // trocar de etiqueta troca o conteúdo sem fechar
  await page.locator('[data-categoria="saladas"]').click();
  await expect(painel.locator('[data-cat="saladas"]')).toBeVisible();
  await expect(painel.locator('[data-cat="sanduiches"]')).toBeHidden();
  await expect(sand).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden();
  // categorias sem itens confirmados continuam só etiqueta
  await expect(page.locator('.bands__list li', { hasText: 'Cheesecakes' }).locator('button')).toHaveCount(0);
});

test('baralho de bebidas: a camada tocada vem para a frente', async ({ page }) => {
  await page.goto('/');
  const camadas = page.locator('[data-baralho] [data-camada]');
  test.skip((await camadas.count()) < 2, 'sem as camadas de imagem neste build');
  await page.locator('[data-baralho]').scrollIntoViewIfNeeded();
  const cartao = page.locator('.baralho__cartao');
  await expect(cartao).not.toHaveAttribute('data-frente', '');
  await cartao.focus();
  await page.keyboard.press('Enter');
  await expect(cartao).toHaveAttribute('data-frente', '');
});

test('ficha nutricional abre e mostra a tabela (só no build de revisão: valores de exemplo)', async ({ page }) => {
  await page.goto('/');
  const ficha = page.locator('.ficha');
  test.skip(!(await ficha.count()), 'seção de exemplo fora deste build');
  await ficha.locator('summary').click();
  await expect(ficha.locator('tbody tr')).toHaveCount(6);
  await expect(ficha).toContainText('valores de exemplo');
});

test.describe('abertura da fornada (espiral ilustrativa)', () => {
  const irAte = (page: import('@playwright/test').Page) => page.evaluate(() => {
    const el = document.querySelector('.abertura__janela')!;
    scrollTo({ top: el.getBoundingClientRect().top + scrollY - 80, behavior: 'instant' });
  });

  test('movimento reduzido: só a capa e o fio inteiro, nenhum vídeo criado', async ({ page }) => {
    await page.goto('/');
    const ab = page.locator('[data-espiral]');
    test.skip(!(await ab.count()), 'sem a abertura neste build');
    await irAte(page);
    await page.waitForTimeout(800);
    await expect(ab).toHaveAttribute('data-estatico', '');
    await expect(ab.locator('video')).toHaveCount(0);
    expect(await ab.locator('.abertura__fio path').evaluate((p) => getComputedStyle(p).strokeDashoffset)).toMatch(/^0(px)?$/);
  });

  test.describe('com movimento', () => {
    test.use({ reducedMotion: 'no-preference' });
    test('nada baixa no carregamento; perto da tela toca uma vez, para no último quadro e oferece “ver de novo”', async ({ page }) => {
      const pedidos: string[] = [];
      page.on('request', (r) => { if (r.url().includes('roll-espiral-caramelo')) pedidos.push(r.url()); });
      await page.goto('/');
      const ab = page.locator('[data-espiral]');
      test.skip(!(await ab.count()), 'sem a abertura neste build');
      await page.waitForTimeout(1200);
      expect(pedidos, 'vídeo da espiral não baixa na 1ª tela').toEqual([]);
      await expect(ab.locator('video')).toHaveCount(0);
      await irAte(page);
      await expect(ab).toHaveAttribute('data-tocando', '', { timeout: 8000 });
      const v = ab.locator('video');
      expect(await v.evaluate((x: HTMLVideoElement) => x.muted && !x.loop)).toBe(true);
      await expect(ab).toHaveAttribute('data-fim', '', { timeout: 15000 });
      await expect(ab.locator('[data-denovo]')).toBeVisible();
      expect(await v.evaluate((x: HTMLVideoElement) => x.paused)).toBe(true);
      await ab.locator('[data-denovo]').click();
      await expect.poll(() => v.evaluate((x: HTMLVideoElement) => !x.paused)).toBe(true);
    });
  });
});
