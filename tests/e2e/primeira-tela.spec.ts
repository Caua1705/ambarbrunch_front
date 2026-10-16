// Mobile primeiro: o botão “Reservar mesa” precisa estar INTEIRO na primeira tela, e nada pode vazar na horizontal.
import { test, expect } from '@playwright/test';

const CELULARES: [number, number][] = [[360, 640], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932]];
const MAIORES: [number, number][] = [[768, 1024], [1024, 768], [1440, 900]];

for (const [w, h] of CELULARES) {
  test(`${w}×${h}: CTA do hero inteiro na 1ª tela, título sem quebrar palavra, sem overflow`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const btn = await page.locator('[data-cta-trigger]').boundingBox();
    expect(btn, 'botão do hero').not.toBeNull();
    expect(btn!.y + btn!.height, 'base do botão dentro da tela').toBeLessThanOrEqual(h);
    expect(btn!.height, 'botão em uma linha').toBeLessThan(60);
    // cada linha do título cabe na largura (nada de palavra quebrada)
    const linhas = await page.$$eval('.hero__headline > span', (els) => els.map((e) => (e as HTMLElement).getBoundingClientRect().height));
    for (const a of linhas) expect(a).toBeLessThan(140);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    // a colagem não encosta no título: o topo da colagem fica abaixo do fim do título
    const tit = await page.locator('.hero__headline').boundingBox();
    const col = await page.locator('.hero__collage').boundingBox();
    expect(col!.y).toBeGreaterThanOrEqual(tit!.y + tit!.height - 1);
    test.info().annotations.push({ type: 'medidas', description: `botão até ${Math.round(btn!.y + btn!.height)}px de ${h}px · colagem ${Math.round(col!.height)}px` });
  });
}

for (const [w, h] of MAIORES) {
  test(`${w}×${h}: sem overflow horizontal e CTA visível`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await expect(page.locator('[data-cta-trigger]')).toBeInViewport();
  });
}
