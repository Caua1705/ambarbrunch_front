// Toque: sem o realce azul nativo em nada clicável; controles não selecionam texto; feedback próprio de pressionar;
// textos informativos e campos continuam selecionáveis; foco de teclado continua visível.
import { test, expect } from '@playwright/test';

const TRANSPARENTE = /^(transparent|rgba\(0, 0, 0, 0\))$/;

test('nenhum elemento clicável com realce de toque (-webkit-tap-highlight-color) visível', async ({ page }) => {
  await page.goto('/');
  const comRealce = await page.$$eval('a, button, summary, label, [role="button"], input, select, textarea, [tabindex]', (els) =>
    els.map((e) => ({ el: `${e.tagName.toLowerCase()}.${(e as HTMLElement).className}`, cor: getComputedStyle(e).getPropertyValue('-webkit-tap-highlight-color') }))
      .filter((x) => x.cor && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(x.cor)));
  expect(comRealce).toEqual([]);
  const raiz = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('-webkit-tap-highlight-color'));
  if (raiz) expect(raiz).toMatch(TRANSPARENTE);
  // o WebKit do Playwright no Windows não implementa a propriedade (é do WebKit de iOS/Android): lá não há realce a tirar
  if (!(await page.evaluate(() => CSS.supports('-webkit-tap-highlight-color', 'transparent')))) return;
  const regra = await page.evaluate(() => {
    // as regras ficam dentro de @layer: percorre os grupos
    const todas = (rs: CSSRuleList): CSSRule[] => [...rs].flatMap((r) => ('cssRules' in r ? [r, ...todas((r as CSSGroupingRule).cssRules)] : [r]));
    return [...document.styleSheets].flatMap((s) => { try { return todas(s.cssRules); } catch { return []; } })
      // o minificador pode juntar seletores (“html, *, ::before, ::after”): basta o html estar na lista
      .some((r) => r instanceof CSSStyleRule && r.selectorText.split(',').map((s) => s.trim()).includes('html') && /tap-highlight-color:\s*transparent/.test(r.cssText));
  });
  expect(regra).toBe(true);
});

test('controles não selecionam texto; textos e campos seguem selecionáveis', async ({ page }) => {
  await page.goto('/');
  const sel = (s: string) => page.locator(s).first().evaluate((e) => getComputedStyle(e).userSelect || getComputedStyle(e).webkitUserSelect);
  for (const s of ['.hero__foot .btn', '.menu-btn', '.bands__tap', '[data-trilho]', '.provou__seta']) {
    if (await page.locator(s).count()) expect(await sel(s), s).toBe('none');
  }
  for (const s of ['.hero__note', '.provou__lead', '.visite p']) {
    if (await page.locator(s).count()) expect(await sel(s), s).not.toBe('none');
  }
  const campo = page.locator('input:not([type="hidden"]), textarea').first();
  if (await campo.count()) expect(await campo.evaluate((e) => getComputedStyle(e).userSelect)).not.toBe('none');
});

test('pressionar dá retorno próprio (afunda) e soltar volta', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit móvel não aplica :active pelo mouse sintético (coberto no Chromium)');
  await page.goto('/');
  const seta = page.locator('.provou__seta[data-next]');
  test.skip(!(await seta.count()), 'sem carrossel');
  await seta.scrollIntoViewIfNeeded();
  const escala = () => seta.evaluate((e) => getComputedStyle(e).scale);
  const box = (await seta.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(escala).toBe('0.96');
  await page.mouse.up();
  await expect.poll(escala).toMatch(/^(none|1)$/);
});

test('foco de teclado continua visível nos controles (contorno do Design System)', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Tab no WebKit não percorre botões por padrão (preferência do sistema)');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const contorno = await page.evaluate(() => { const e = document.activeElement!; const s = getComputedStyle(e); return { tag: e.tagName, estilo: s.outlineStyle, largura: s.outlineWidth }; });
  expect(contorno.estilo, contorno.tag).not.toBe('none');
  expect(contorno.largura).not.toBe('0px');
});
