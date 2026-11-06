// Ajustes finais de 2026-10-18: fio da abertura da fornada desenhado com a rolagem até o fim.
import { test, expect } from '@playwright/test';

test.describe('com movimento', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('fio da abertura (“…e vira roll de verdade”): desenha com a rolagem, contínuo, até o fim — e não congela com o vídeo', async ({ page }) => {
    await page.goto('/');
    const svg = page.locator('.abertura__fio');
    test.skip(!(await svg.count()), 'sem a abertura neste build');
    const offset = () => svg.locator('path').evaluate((p) => parseFloat(getComputedStyle(p).strokeDashoffset));
    // posição da página em que o topo do fio fica a `f` da altura da tela
    const topoEm = (f: number) => svg.evaluate((el, f) => { const r = el.getBoundingClientRect(); scrollTo({ top: r.top + scrollY - innerHeight * f, behavior: 'instant' }); }, f);
    await topoEm(1.2);
    await page.waitForTimeout(150);
    expect(await offset(), 'ainda abaixo da tela: vazio').toBeGreaterThan(0.98);
    const vals: number[] = [];
    for (let f = 1.0; f >= -0.3; f -= 0.05) { await topoEm(f); await page.waitForTimeout(60); vals.push(await offset()); }
    for (let k = 1; k < vals.length; k++) expect(vals[k], `recua no passo ${k}`).toBeLessThanOrEqual(vals[k - 1] + 1e-3);
    for (let k = 1; k < vals.length; k++) expect(vals[k - 1] - vals[k], `salto no passo ${k}`).toBeLessThan(0.2);
    expect(vals.filter((v) => v > 0.02 && v < 0.98).length, `meio do desenho (${vals.map((v) => v.toFixed(2)).join(' ')})`).toBeGreaterThanOrEqual(8);
    expect(vals.at(-1), 'chega ao destino: inteiro').toBe(0);
    // aqui o vídeo da espiral já pode estar parado (janela < 60% na tela) e o fio está inteiro mesmo assim
    await page.locator('.anatomia').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(200);
    expect(await offset(), 'mais abaixo: continua inteiro').toBe(0);
    // e acompanha a rolagem também de volta
    await topoEm(1.2);
    await page.waitForTimeout(200);
    expect(await offset()).toBeGreaterThan(0.98);
  });
});

test('movimento reduzido: o fio fica inteiro', async ({ page }) => {
  await page.goto('/');
  const fio = page.locator('.abertura__fio path');
  if (await fio.count()) expect(await fio.evaluate((p) => parseFloat(getComputedStyle(p).strokeDashoffset))).toBe(0);
});
