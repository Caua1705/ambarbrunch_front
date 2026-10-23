// Interações da homepage: cardápio tátil, Café + Roll, espiral da fornada e experiência sem avisos internos.
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
  // 2026-10-20: convite ao Clube Âmbar depois da reserva; 2026-10-23: a Visite foi absorvida pelo rodapé
  expect(ids).toEqual(['novo', 'gastronomia', 'roll', 'cafe-roll', 'quem-provou', 'ambientes', 'reservar', 'clube']);
  const titulos = await page.$$eval('main > section .mega', (ms) => ms.map((m) => [...m.querySelectorAll(':scope > span')].map((s) => s.textContent).join(' ').toUpperCase()));
  expect(titulos).toEqual(['O ÂMBAR AGORA É BRUNCH.', 'PARA SUA MESA', 'DIRETO DA FORNADA', 'CAFÉ + ROLL', 'REAÇÕES REAIS', 'ESCOLHA SEU LUGAR', 'RESERVE SUA MESA', 'CLUBE ÂMBAR']);
  await expect(page.locator('.hero .cut--polaroid figcaption')).toHaveCount(0);
  // Direto da fornada enxuta (2026-10-20): termina nos vídeos — sem bandejas, frase e pílulas de sabores
  const fornada = page.locator('#roll');
  await expect(fornada.locator('.stories .story')).toHaveCount(3);
  await expect(fornada.locator('.trays, .sabores, .roll__frase')).toHaveCount(0);
  await expect(fornada).not.toContainText('Os sabores mudam');
  await expect(fornada).not.toContainText('já passaram pela fornada');
  await expect(page.locator('#saladas, .prato')).toHaveCount(0);
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
  await expect(painel.locator('[data-cat="sanduiches"]')).toContainText('Brie & Blueberry');
  await expect(painel.locator('[data-cat="sanduiches"] .cartao__prato img')).toBeVisible();
  // sem selo “imagem ilustrativa” desde a rodada final (a origem segue registrada em data/cardapio.ts)
  await expect(painel.locator('.selo-ia')).toHaveCount(0);
  // trocar de etiqueta troca o conteúdo sem fechar
  await page.locator('[data-categoria="bowls"]').click();
  await expect(painel.locator('[data-cat="bowls"]')).toBeVisible();
  await expect(painel.locator('[data-cat="sanduiches"]')).toBeHidden();
  await expect(sand).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden();
  // cardápio oficial (2026-10-20): só estas categorias; foto principal só onde há uma foto correta (sucos e bowls
  // abrem só com o título); nenhum preço e nenhum aviso de cardápio provisório
  const categorias = await page.$$eval('[data-categoria]', (bs) => bs.map((b) => b.getAttribute('data-categoria')));
  expect(categorias).toEqual(['croissants', 'toasts', 'sanduiches', 'bowls', 'rolls', 'cafes', 'gelados', 'sucos']);
  expect(await page.locator('.cartao__cat').count()).toBe(8);
  await expect(page.locator('.cartao__cat .cartao__prato')).toHaveCount(6);
  await expect(page.locator('[data-cat="sucos"] .cartao__prato, [data-cat="bowls"] .cartao__prato')).toHaveCount(0);
  const cardapio = await page.locator('#gastronomia').evaluate((s) => s.textContent ?? '');
  expect(cardapio).not.toMatch(/R\$/);
  for (const t of ['estreia', 'consulte a equipe', 'Saladas', 'Bruschetta', 'Cheesecake', 'Brownie', 'Frappé', 'Smoothie', 'Poke', 'Iced latte']) expect(cardapio, t).not.toContain(t);
  for (const t of ['Expresso duplo', 'Antioxidant', 'Cinnamon latte', 'Prosciutto', 'Toast americano', 'Steak & Herbs', 'Vegetariano', 'Chicken']) expect(cardapio, t).toContain(t);
});

test('cartão dos rolls: abas doces | salgados, uma miniatura por sabor', async ({ page }) => {
  await page.goto('/');
  const rolls = page.locator('[data-categoria="rolls"]');
  await rolls.scrollIntoViewIfNeeded();
  await rolls.click();
  const cat = page.locator('[data-cat="rolls"]');
  const doces = cat.locator('[data-aba="doces"]');
  const salgados = cat.locator('[data-aba="salgados"]');
  await expect(doces).toBeVisible();
  await expect(salgados).toBeHidden();
  await expect(doces.locator('.cartao__mini')).toHaveCount(4);
  await expect(doces.locator('.cartao__mais')).toHaveCount(0);
  await cat.getByRole('tab', { name: 'salgados' }).click();
  await expect(salgados).toBeVisible();
  await expect(doces).toBeHidden();
  await expect(salgados).toContainText('Quatro queijos');
  await expect(salgados.locator('.cartao__mini')).toHaveCount(4);
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
  await expect(sec.locator('[data-abrir]')).toHaveCount(1);
  await sec.locator('[data-abrir="gelados"]').click();
  await expect(page.locator('[data-categoria="gelados"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-cat="gelados"]')).toBeVisible();
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

test('cardápio: sem aviso instrutivo nas etiquetas; o indicador “+” basta', async ({ page }) => {
  await page.goto('/');
  const sec = page.locator('#gastronomia');
  await expect(sec).not.toContainText(/toque num/i);
  await expect(sec.locator('.bands__hint')).toHaveCount(0);
  await expect(sec.locator('.bands__tap .bands__mais').first()).toBeVisible();
});

test('imagens: as fotos dos cartões já estão baixadas quando o cartão abre (nada de quadro branco)', async ({ page }) => {
  await page.goto('/');
  // chega perto do cardápio sem abrir nada
  await page.locator('#novo').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect.poll(() => page.locator('.cartao__cat img').evaluateAll((imgs) => imgs.filter((i) => !(i as HTMLImageElement).complete || !(i as HTMLImageElement).naturalWidth).length), { timeout: 15_000 }).toBe(0);
  // e cada foto tem a cor dominante como fundo enquanto baixa
  expect(await page.locator('.cartao__cat .cartao__prato img').first().evaluate((i) => (i as HTMLElement).style.backgroundColor)).toMatch(/^rgb/);
  // o hero inteiro é eager (as três fotos da colagem)
  expect(await page.locator('.hero__collage .cut img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('loading')))).toEqual(['eager', 'eager', 'eager']);
});
