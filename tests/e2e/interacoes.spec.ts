// Interações da homepage: cardápio tátil, Café + Roll, Saladas & bowls, espiral da fornada e experiência sem avisos internos.
import { test, expect } from '@playwright/test';

test('sem avisos internos na experiência (“a confirmar”, “crédito a confirmar”, marcador de revisão)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.pending, .review-flag, [data-motion-toggle]')).toHaveCount(0);
  const texto = (await page.locator('body').innerText()).toLowerCase();
  for (const t of ['a confirmar', 'autorização pendente', 'foto de referência', 'leitura', 'vídeo da própria roll', 'sem trilha sonora', 'ilustração animada', 'bastidores da roll', 'enquanto as reservas online', 'reservar pelo whatsapp', 'inaugura']) expect(texto, t).not.toContain(t);
});

test('ordem final das seções e títulos aprovados', async ({ page }) => {
  await page.goto('/');
  const ids = await page.$$eval('main > section', (ss) => ss.map((x) => x.id));
  expect(ids).toEqual(['novo', 'gastronomia', 'roll', 'cafe-roll', 'saladas', 'quem-provou', 'ambientes', 'reservar', 'visite']);
  const titulos = await page.$$eval('main > section .mega', (ms) => ms.map((m) => [...m.querySelectorAll(':scope > span')].map((s) => s.textContent).join(' ').toUpperCase()));
  expect(titulos).toEqual(['O ÂMBAR, AGORA BRUNCH.', 'PARA SUA MESA', 'DIRETO DA FORNADA', 'CAFÉ + ROLL', 'SALADAS & BOWLS', 'QUEM PROVOU, CONTA', 'ESCOLHA SEU LUGAR', 'RESERVE SUA MESA', 'VISITE O ÂMBAR']);
  await expect(page.locator('.hero .cut--polaroid figcaption')).toHaveCount(0);
  await expect(page.locator('#roll')).toContainText('Os sabores mudam. A vontade fica.');
  const lugares = (await page.locator('#ambientes').innerText()).toLowerCase();
  for (const l of ['jardim', 'salão principal', 'lounge', 'sala privativa']) expect(lugares).toContain(l);
});

test('cardápio tátil: etiqueta abre o cartão (foto principal), troca de conteúdo e fecha com Esc', async ({ page }) => {
  await page.goto('/');
  const sand = page.locator('[data-categoria="sanduiches"]');
  await sand.scrollIntoViewIfNeeded();
  await sand.click();
  await expect(sand).toHaveAttribute('aria-expanded', 'true');
  const painel = page.locator('#painel-comer');
  await expect(painel).toBeVisible();
  await expect(painel.locator('[data-cat="sanduiches"]')).toBeVisible();
  await expect(painel.locator('[data-cat="sanduiches"]')).toContainText('Brie & mirtilo');
  await expect(painel.locator('[data-cat="sanduiches"] .cartao__prato img')).toBeVisible();
  await expect(painel.locator('[data-cat="sanduiches"] .selo-ia')).toHaveText('imagem ilustrativa');
  // trocar de etiqueta troca o conteúdo sem fechar
  await page.locator('[data-categoria="saladas"]').click();
  await expect(painel.locator('[data-cat="saladas"]')).toBeVisible();
  await expect(painel.locator('[data-cat="sanduiches"]')).toBeHidden();
  await expect(sand).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden();
  // toda categoria tem foto principal; nenhuma mostra preço
  expect(await page.locator('.cartao__cat').count()).toBe(13);
  expect(await page.locator('.cartao__cat .cartao__prato').count()).toBe(13);
  expect(await page.locator('#gastronomia').innerText()).not.toMatch(/R\$/);
});

test('cartão dos rolls: abas doces | salgados, miniaturas e sabores extras guardados', async ({ page }) => {
  await page.goto('/');
  const rolls = page.locator('[data-categoria="rolls"]');
  await rolls.scrollIntoViewIfNeeded();
  await rolls.click();
  const cat = page.locator('[data-cat="rolls"]');
  const doces = cat.locator('[data-aba="doces"]');
  const salgados = cat.locator('[data-aba="salgados"]');
  await expect(doces).toBeVisible();
  await expect(salgados).toBeHidden();
  await expect(doces.locator('.cartao__mini')).toHaveCount(3);
  await expect(doces.locator('.cartao__mais p')).toBeHidden();
  await doces.locator('.cartao__mais summary').click();
  await expect(doces.locator('.cartao__mais p')).toContainText('Red velvet');
  await cat.getByRole('tab', { name: 'salgados' }).click();
  await expect(salgados).toBeVisible();
  await expect(doces).toBeHidden();
  await expect(salgados).toContainText('Quatro queijos');
});

test('Café + Roll: escolher a dupla troca roll, bebida e cor do copo; atalho abre a bebida no cardápio', async ({ page }) => {
  await page.goto('/');
  const sec = page.locator('#cafe-roll');
  await sec.scrollIntoViewIfNeeded();
  const par = sec.locator('[data-par="matcha"]');
  await par.click();
  await expect(par).toHaveAttribute('aria-checked', 'true');
  await expect(sec.locator('.dupla [data-bebida]')).toHaveText('Matcha frutas vermelhas');
  await expect(sec.locator('.dupla [data-roll]')).toHaveText('Mood cheesecake');
  await expect(sec.locator('[data-foto="matcha"]')).toHaveAttribute('data-ativo', '');
  expect(await sec.locator('[data-dupla]').evaluate((d) => (d as HTMLElement).style.getPropertyValue('--liq-a'))).toContain('berry');
  await par.focus();
  await page.keyboard.press('ArrowRight');
  await expect(sec.locator('[data-par="americano"]')).toHaveAttribute('aria-checked', 'true');
  await sec.locator('[data-abrir="cappuccino"]').click();
  await expect(page.locator('[data-categoria="cappuccino"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-cat="cappuccino"]')).toBeVisible();
});

test('Saladas & bowls: abas trocam o prato; informações do prato sem números fictícios fora da revisão', async ({ page }) => {
  await page.goto('/');
  const sec = page.locator('#saladas');
  await sec.scrollIntoViewIfNeeded();
  await expect(sec.locator('#prato-salada-atum')).toBeVisible();
  await expect(sec.locator('#prato-poke')).toBeHidden();
  await sec.getByRole('tab', { name: /poke/i }).click();
  await expect(sec.locator('#prato-poke')).toBeVisible();
  const ficha = sec.locator('#prato-poke .ficha');
  await ficha.locator('summary').click();
  await expect(ficha).toContainText('Alergênicos');
  const linhas = await ficha.locator('tbody tr').count();
  // revisão: valores de exemplo marcados; site publicado: “em validação”, sem tabela
  if (linhas) await expect(ficha).toContainText('valores de exemplo');
  else await expect(ficha).toContainText('em validação');
  const texto = (await sec.innerText()).toLowerCase();
  for (const t of ['baixo em calorias', 'rico em proteína']) expect(texto).not.toContain(t);
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
    test('nada baixa no carregamento; perto da tela toca mudo e volta ao início com esmaecimento, sem botão', async ({ page }) => {
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
      await expect(ab).toHaveAttribute('data-voltando', '', { timeout: 15000 });
      // recomeça sozinho, do início
      await expect.poll(() => v.evaluate((x: HTMLVideoElement) => !x.paused && x.currentTime < 3), { timeout: 8000 }).toBe(true);
      await expect(ab.locator('button')).toHaveCount(0);
    });
  });
});
