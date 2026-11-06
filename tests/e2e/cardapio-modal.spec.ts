// /cardapio/: tocar em qualquer produto abre o modal com a imagem ampliada e fechar devolve a pessoa ao mesmo ponto da lista. Clique e toque reais: o
// Playwright só clica no que estiver de fato no topo naquele ponto da tela, então um elemento cobrindo a linha ou o modal reprova o teste.
import { test, expect, type Page } from '@playwright/test';
import { FOTOS_PRODUTO } from '../../src/data/cardapio';
import { validarCatalogo, formatarPreco, temCentavos } from '../../src/lib/cardapio/contrato';
import { lerFonte } from '../../src/lib/cardapio/fonte';

const modal = (page: Page) => page.locator('[data-produto-modal]');
const linha = (page: Page, id: string) => page.locator(`.prato[data-item="${id}"]`);
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

test('cada um dos 57 produtos abre pelo clique na linha, com os dados oficiais, a imagem certa e fecha', async ({ page }) => {
  test.setTimeout(240_000);
  const catalogo = validarCatalogo(await lerFonte());
  await page.goto('/cardapio/');
  await page.addStyleTag({ content: '.sticky-cta{display:none!important}' });
  for (const c of catalogo.categorias) {
    const centavos = temCentavos(c.itens);
    for (const i of c.itens) {
      const l = linha(page, i.id);
      await l.scrollIntoViewIfNeeded();
      // clica longe do nome: a linha inteira precisa responder
      const caixa = (await l.boundingBox())!;
      await page.mouse.click(caixa.x + caixa.width - 24, caixa.y + caixa.height - 8);
      await expect(modal(page), i.id).toBeVisible();
      await expect(modal(page).getByRole('heading', { level: 2 })).toHaveText(i.nome);
      await expect(modal(page).locator('.produto-modal__preco')).toHaveText(formatarPreco(i.preco_centavos, centavos));
      if (i.descricao) await expect(modal(page).locator('.produto-modal__descricao')).toHaveText(i.descricao);
      else await expect(modal(page).locator('.produto-modal__descricao')).toBeHidden();
      const foto = FOTOS_PRODUTO[i.id];
      const img = modal(page).locator('img');
      if (foto) {
        await expect(img, i.id).toHaveAttribute('alt', foto.alt);
        await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0), i.id).toBe(true);
      } else {
        await expect(img, i.id).toHaveCount(0);
      }
      await modal(page).getByRole('button', { name: 'Fechar' }).click();
      await expect(modal(page)).toBeHidden();
    }
  }
});

test('toque de verdade na linha abre e o X fecha, no mesmo ponto da lista', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'só em perfil de toque');
  await page.goto('/cardapio/');
  const l = linha(page, 'cheesecakes.pistache');
  await l.scrollIntoViewIfNeeded();
  const antes = await scrollY(page);
  await l.tap({ position: { x: 150, y: 20 } });
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByRole('heading')).toHaveText('Pistache');
  await page.getByRole('button', { name: 'Fechar' }).tap();
  await expect(modal(page)).toBeHidden();
  expect(await scrollY(page)).toBe(antes);
});

test('teclado: Enter e Espaço abrem, Esc fecha e o foco volta para o produto', async ({ page }) => {
  await page.goto('/cardapio/');
  const botao = linha(page, 'bowls.atum').getByRole('button');
  await botao.focus();
  for (const tecla of ['Enter', 'Space']) {
    await page.keyboard.press(tecla);
    await expect(modal(page), tecla).toBeVisible();
    await expect(modal(page).getByRole('button', { name: 'Fechar' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(modal(page), tecla).toBeHidden();
    await expect(botao).toBeFocused();
  }
});

test('o foco fica preso no modal enquanto ele está aberto', async ({ page }) => {
  await page.goto('/cardapio/');
  await linha(page, 'bowls.atum').getByRole('button').click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const dentro = await page.evaluate(() => {
    const a = document.activeElement;
    return a === document.body || !!a?.closest('[data-produto-modal]');
  });
  expect(dentro).toBe(true);
  await expect(page.locator('.carta__nav a').first()).not.toBeFocused();
});

test('clicar no fundo fecha; clicar dentro da caixa não fecha', async ({ page }) => {
  await page.goto('/cardapio/');
  await linha(page, 'sucos.retinol').getByRole('button').click();
  await expect(modal(page)).toBeVisible();
  await modal(page).locator('.produto-modal__preco').click();
  await expect(modal(page)).toBeVisible();
  await modal(page).locator('img').click();
  await expect(modal(page)).toBeVisible();
  const caixa = (await modal(page).boundingBox())!;
  await page.mouse.click(caixa.x + caixa.width / 2, Math.max(4, caixa.y - 8));
  await expect(modal(page)).toBeHidden();
});

test('o modal fica acima da barra fixa e da doca, e a página não rola por baixo', async ({ page, hasTouch, browserName }) => {
  await page.goto('/cardapio/');
  const l = linha(page, 'cafes.macchiato');
  await l.scrollIntoViewIfNeeded();
  await l.getByRole('button').click();
  await expect(modal(page)).toBeVisible();
  const antes = await scrollY(page);
  // nada cobre o X nem a caixa, mesmo na altura da barra fixa
  const noTopo = await page.evaluate(() => {
    const m = document.querySelector('[data-produto-modal]')!;
    const fechar = m.querySelector('[data-modal-fechar]')!.getBoundingClientRect();
    const r = m.getBoundingClientRect();
    return [
      [fechar.x + fechar.width / 2, fechar.y + fechar.height / 2],
      [r.x + r.width / 2, r.y + 10],
      [r.x + r.width / 2, r.bottom - 10],
    ].map(([x, y]) => !!document.elementFromPoint(x, y)?.closest('[data-produto-modal]'));
  });
  expect(noTopo).toEqual([true, true, true]);
  // gesto real sobre o fundo escurecido: a lista não sai do lugar
  if (browserName === 'chromium' && hasTouch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.synthesizeScrollGesture', { x: 8, y: 400, yDistance: -500, speed: 1500, gestureSourceType: 'touch', preventFling: true });
  } else if (!hasTouch) {
    await page.mouse.move(8, 400);
    await page.mouse.wheel(0, 900);
  }
  await page.waitForTimeout(250);
  expect(await scrollY(page)).toBe(antes);
  await page.keyboard.press('Escape');
  await expect(modal(page)).toBeHidden();
  expect(await scrollY(page)).toBe(antes);
  // fechado, a página volta a rolar
  await page.evaluate(() => scrollTo({ top: 300, behavior: 'instant' }));
  expect(await scrollY(page)).toBe(300);
});

test('fechar devolve a lista exatamente ao ponto em que estava e a categoria marcada segue a mesma', async ({ page }) => {
  await page.goto('/cardapio/');
  const l = linha(page, 'cafes.macchiato');
  await l.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const antes = await scrollY(page);
  const ativa = await page.locator('.carta__nav a[aria-current="true"]').textContent();
  for (let i = 0; i < 3; i++) {
    await l.getByRole('button').click();
    await expect(modal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal(page)).toBeHidden();
  }
  await page.waitForTimeout(200);
  expect(await scrollY(page)).toBe(antes);
  await expect(page.locator('.carta__nav a[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('.carta__nav a[aria-current="true"]')).toHaveText(ativa!);
});

test('abrir duas vezes não acumula: uma imagem no modal, um modal na página', async ({ page }) => {
  await page.goto('/cardapio/');
  const b = linha(page, 'sucos.green').getByRole('button');
  await b.click();
  await page.keyboard.press('Escape');
  await b.click();
  await expect(modal(page).locator('img')).toHaveCount(1);
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(modal(page).locator('img')).toHaveCount(0);
});

test('sem imagem: mostra nome e preço, sem inventar foto', async ({ page }) => {
  await page.goto('/cardapio/');
  await linha(page, 'outras_bebidas.coca_cola').getByRole('button').click();
  await expect(modal(page).getByRole('heading')).toHaveText('Coca-Cola');
  await expect(modal(page).locator('img')).toHaveCount(0);
  await expect(modal(page).locator('[data-modal-foto]')).toBeHidden();
  await expect(modal(page).locator('.produto-modal__preco')).toBeVisible();
  // o X não cai sobre o nome
  const x = (await modal(page).getByRole('button', { name: 'Fechar' }).boundingBox())!;
  const nome = (await modal(page).getByRole('heading').boundingBox())!;
  expect(nome.x + nome.width).toBeLessThanOrEqual(x.x);
});

test('a imagem grande só baixa ao abrir', async ({ page }) => {
  const grandes: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'image' && /_(660|880)w?/.test(r.url())) grandes.push(r.url()); });
  await page.goto('/cardapio/');
  await page.waitForTimeout(500);
  await expect(page.locator('template img')).toHaveCount(0);
  expect(grandes).toEqual([]);
});

test('modal cabe na tela em retrato e paisagem, com o X e o preço alcançáveis', async ({ page }) => {
  for (const [width, height] of [[360, 740], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/cardapio/');
    await linha(page, 'brunches.italian_morning').getByRole('button').click();
    const caixa = (await modal(page).boundingBox())!;
    const contexto = `${width}x${height}`;
    expect(caixa.x, contexto).toBeGreaterThanOrEqual(0);
    expect(caixa.y, contexto).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width, contexto).toBeLessThanOrEqual(width);
    expect(caixa.y + caixa.height, contexto).toBeLessThanOrEqual(height);
    await expect(modal(page).getByRole('button', { name: 'Fechar' }), contexto).toBeInViewport();
    await modal(page).locator('.produto-modal__preco').scrollIntoViewIfNeeded();
    await expect(modal(page).locator('.produto-modal__preco'), contexto).toBeInViewport();
    await page.keyboard.press('Escape');
  }
});

test('a navegação por categorias continua funcionando depois de usar o modal', async ({ page }) => {
  await page.goto('/cardapio/');
  await linha(page, 'croissants.caprese').getByRole('button').click();
  await page.keyboard.press('Escape');
  await page.locator('.carta__nav').getByRole('link', { name: 'Cafés', exact: true }).click();
  await expect(page).toHaveURL(/#cafes$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Cafés', exact: true })).toBeInViewport();
  await expect(page.locator('.carta__nav a[aria-current="true"]')).toHaveText('Cafés');
});
