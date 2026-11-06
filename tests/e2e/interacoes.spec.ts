// Interações da homepage: cardápio tátil, Café + Roll, espiral da fornada e experiência sem avisos internos.
import { test, expect } from '@playwright/test';
import { CLUBE_NA_HOME } from '../clube-home';

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
  // 2026-10-27: o convite ao Clube saiu da home até o lançamento (PUBLIC_CLUBE_HOME)
  const comClube = (lista: string[], clube: string) => (CLUBE_NA_HOME ? [...lista, clube] : lista);
  expect(ids).toEqual(comClube(['novo', 'gastronomia', 'roll', 'cafe-roll', 'quem-provou', 'ambientes', 'reservar'], 'clube'));
  const titulos = await page.$$eval('main > section .mega', (ms) => ms.map((m) => [...m.querySelectorAll(':scope > span')].map((s) => s.textContent).join(' ').toUpperCase()));
  expect(titulos).toEqual(comClube(['O ÂMBAR AGORA É BRUNCH.', 'PARA SUA MESA', 'DIRETO DA FORNADA', 'CAFÉ + ROLL', 'REAÇÕES REAIS', 'ESCOLHA SEU LUGAR', 'RESERVE SUA MESA'], 'CLUBE ÂMBAR'));
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

test('Café + Roll: escolher a dupla troca roll, bebida e cor do copo', async ({ page }) => {
  await page.goto('/');
  const sec = page.locator('#cafe-roll');
  await sec.scrollIntoViewIfNeeded();
  const par = sec.locator('[data-par="matcha"]');
  await par.click();
  await expect(par).toHaveAttribute('aria-checked', 'true');
  await expect(sec.locator('.dupla [data-bebida]')).toHaveText('Matcha Geleia de Morango');
  await expect(sec.locator('.dupla [data-roll]')).toHaveText('Mood Cheesecake');
  await expect(sec.locator('[data-foto="matcha"]')).toHaveAttribute('data-ativo', '');
  expect(await sec.locator('[data-dupla]').evaluate((d) => (d as HTMLElement).style.getPropertyValue('--liq-a'))).toContain('berry');
  await par.focus();
  await page.keyboard.press('ArrowRight');
  await expect(sec.locator('[data-par="biscoff"]')).toHaveAttribute('aria-checked', 'true');
  await expect(sec.locator('.dupla [data-roll]')).toHaveText('Biscoff');
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

test('imagens: o hero inteiro é eager (as três fotos da colagem)', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('.hero__collage .cut img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('loading')))).toEqual(['eager', 'eager', 'eager']);
});
