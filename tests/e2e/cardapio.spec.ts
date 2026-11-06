// /cardapio/: o cardápio completo vem do catálogo oficial (o mesmo do build) e é igual na página, na home e no PDF.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import manifesto from '../../src/data/cardapio-pdf.json' with { type: 'json' };
import { validarCatalogo, formatarPreco, temCentavos } from '../../src/lib/cardapio/contrato';
import { lerFonte } from '../../src/lib/cardapio/fonte';
import { FOTOS_PRODUTO } from '../../src/data/cardapio';

const carregar = async () => validarCatalogo(await lerFonte());

test('todos os produtos e adicionais, com nome, descrição e preço do catálogo, sem repetir', async ({ page }) => {
  const catalogo = await carregar();
  await page.goto('/cardapio/');
  const ids = await page.locator('main [data-item]').evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset.item));
  expect(new Set(ids).size).toBe(ids.length);
  const esperados = [...catalogo.categorias.flatMap((c) => c.itens), ...catalogo.adicionais.flatMap((g) => g.itens)];
  expect(ids.length).toBe(esperados.length);
  for (const c of catalogo.categorias) {
    const centavos = temCentavos(c.itens);
    for (const i of c.itens) {
      const linha = page.locator(`main [data-item="${i.id}"]`);
      await expect(linha).toHaveAttribute('data-preco', String(i.preco_centavos));
      await expect(linha).toContainText(i.nome);
      await expect(linha).toContainText(formatarPreco(i.preco_centavos, centavos));
      if (i.descricao) await expect(linha).toContainText(i.descricao);
    }
  }
  for (const g of catalogo.adicionais) {
    await expect(page.getByRole('complementary', { name: g.nome })).toBeVisible();
    for (const i of g.itens) await expect(page.locator(`main [data-item="${i.id}"]`)).toContainText(`+ ${formatarPreco(i.preco_centavos)}`);
  }
});

test('Café coado R$ 6 e Coado na mesa R$ 14: dois produtos, sem confusão', async ({ page }) => {
  await page.goto('/cardapio/');
  await expect(page.locator('[data-item="cafes.cafe_coado"]')).toHaveAttribute('data-preco', '600');
  await expect(page.locator('[data-item="cafes.coado_na_mesa"]')).toHaveAttribute('data-preco', '1400');
});

test('Cinnamon Rolls: os quatro sabores aprovados, sem S’mores e separados dos Cheesecakes', async ({ page }) => {
  await page.goto('/cardapio/');
  const rolls = page.locator('#' + (await page.locator('[data-item="cinnamon_rolls.biscoff"]').evaluate((e) => e.closest('section')!.id)));
  await expect(rolls.locator('[data-item]')).toHaveCount(4);
  for (const [id, preco] of [['tradicional', 1800], ['mood_cheesecake', 2300], ['kinder_bueno', 2400], ['biscoff', 2500]] as const) {
    await expect(rolls.locator(`[data-item="cinnamon_rolls.${id}"]`)).toHaveAttribute('data-preco', String(preco));
  }
  await expect(page.locator('main')).not.toContainText(/S.mores/i);
  await expect(page.locator('[data-item="cheesecakes.biscoff"]')).toHaveAttribute('data-preco', '2600');
  await expect(page.locator('[data-item^="cheesecakes."]')).toHaveCount(7);
});

test('um único botão Abrir o PDF, abaixo da última categoria, levando ao PDF oficial', async ({ page, request }) => {
  await page.goto('/cardapio/');
  const abrir = page.getByRole('link', { name: 'Abrir o PDF' });
  await expect(abrir).toHaveCount(1);
  await expect(page.locator('.carta__topo a')).toHaveCount(0);
  const ultima = (await page.locator('[data-carta-secao]').last().boundingBox())!;
  expect((await abrir.boundingBox())!.y).toBeGreaterThan(ultima.y + ultima.height - 1);
  for (const link of await abrir.all()) {
    await expect(link).toHaveAttribute('href', '/cardapio/cardapio-ambar.pdf');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).not.toHaveAttribute('download');
  }
  await expect(page.getByRole('link', { name: 'Baixar em PDF' })).toHaveCount(0);
  await expect(page.locator('main a[download]')).toHaveCount(0);
  const pdf = await (await request.get('/cardapio/cardapio-ambar.pdf')).body();
  expect(createHash('sha256').update(pdf).digest('hex')).toBe(manifesto.pdf_sha256);
});

test('navegação: etiqueta leva à categoria, fica visível ao rolar e marca a categoria da vez', async ({ page }) => {
  const catalogo = await carregar();
  await page.goto('/cardapio/');
  const nav = page.getByRole('navigation', { name: 'Categorias do cardápio' });
  await expect(nav.getByRole('link')).toHaveCount(catalogo.categorias.length + 1);
  await nav.getByRole('link', { name: 'Cheesecakes' }).click();
  await expect(page).toHaveURL(/#cheesecakes$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Cheesecakes' })).toBeInViewport();
  await expect(nav).toBeInViewport();
  await expect(nav.getByRole('link', { name: 'Cheesecakes' })).toHaveAttribute('aria-current', 'true');
  // o título da categoria não fica escondido atrás da navegação
  const topoNav = await nav.boundingBox();
  const titulo = await page.getByRole('heading', { level: 2, name: 'Cheesecakes' }).boundingBox();
  expect(titulo!.y).toBeGreaterThanOrEqual(topoNav!.y + topoNav!.height);
});

test('sem rolagem horizontal, do menor celular ao desktop', async ({ page }) => {
  for (const width of [320, 360, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/cardapio/');
    const [rolagem, largura] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(rolagem, `${width}px`).toBeLessThanOrEqual(largura);
    // nenhum preço sai da tela nem é cortado
    const fora = await page.locator('.prato__preco, .precos__valor').evaluateAll((l, w) => l.filter((e) => e.getBoundingClientRect().right > (w as number) || e.scrollWidth > e.clientWidth + 1).length, largura);
    expect(fora, `${width}px`).toBe(0);
  }
});

test('imagens: só as mapeadas, com texto alternativo; sem imagem, apresentação neutra', async ({ page }) => {
  await page.goto('/cardapio/');
  const comFoto = page.locator('.prato:not([data-sem-foto]) img');
  await expect(comFoto).toHaveCount(Object.keys(FOTOS_PRODUTO).length);
  for (const alt of await comFoto.evaluateAll((l) => l.map((i) => i.getAttribute('alt')))) expect(alt).toBeTruthy();
  // cada produto com a própria imagem, no ladrilho quadrado e sem arquivo quebrado
  for (const [id, foto] of Object.entries(FOTOS_PRODUTO)) {
    const img = page.locator(`[data-item="${id}"] .prato__foto img`);
    await expect(img).toHaveAttribute('alt', foto.alt);
    await expect(img).toHaveAttribute('width', /^[0-9]+$/);
    await expect(img).toHaveAttribute('height', /^[0-9]+$/);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    const caixa = (await img.boundingBox())!;
    expect(caixa.width, id).toBe(caixa.height);
  }
  expect(new Set(Object.values(FOTOS_PRODUTO).map((f) => f.src)).size).toBe(Object.keys(FOTOS_PRODUTO).length);
  // Biscoff são três produtos, cada um com a própria imagem
  const biscoff = ['cheesecakes.biscoff', 'cinnamon_rolls.biscoff', 'cafes_gelados.biscoff_latte'].map((id) => FOTOS_PRODUTO[id].src);
  expect(new Set(biscoff).size).toBe(3);
  await expect(page.locator('.prato[data-sem-foto] img')).toHaveCount(0);
  await expect(page.locator('.prato[data-sem-foto] svg').first()).toBeAttached();
  // refrigerante com rótulo gerado por IA não entra: só foto real autorizada (docs/technical/CARDAPIO-FOTOS-PENDENTES.md)
  for (const id of ['outras_bebidas.coca_cola', 'outras_bebidas.coca_cola_zero', 'outras_bebidas.guarana', 'outras_bebidas.guarana_zero']) {
    await expect(page.locator(`[data-item="${id}"] img`)).toHaveCount(0);
  }
  // imagens responsivas e fora da primeira tela só sob demanda
  await expect(page.locator('.prato__foto img').first()).toHaveAttribute('loading', 'lazy');
  await expect(page.locator('.prato__foto img').first()).toHaveAttribute('srcset', /avif|webp/);
});

test('acessibilidade: sem violações do axe e título único', async ({ page }) => {
  await page.goto('/cardapio/');
  const { violations } = await new AxeBuilder({ page }).include('main').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('SEO: canônico e cardápio estruturado com os preços do catálogo', async ({ page }) => {
  const catalogo = await carregar();
  await page.goto('/cardapio/');
  // o build de revisão sai como noindex e sem canônico; o de produção precisa dele
  if (!(await page.locator('meta[name="robots"][content*="noindex"]').count())) {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://ambarbrunch.com/cardapio/');
  }
  const menu = JSON.parse((await page.locator('script[type="application/ld+json"]').last().textContent())!);
  expect(menu['@type']).toBe('Menu');
  expect(menu.hasMenuSection.flatMap((s: { hasMenuItem: unknown[] }) => s.hasMenuItem)).toHaveLength(catalogo.categorias.flatMap((c) => c.itens).length);
});

test('home: sem produtos nem etiquetas de categoria, só o caminho para o cardápio completo', async ({ page }) => {
  await page.goto('/');
  const secao = page.locator('#gastronomia');
  await expect(secao.getByRole('button')).toHaveCount(0);
  await expect(page.locator('main [data-item], main [data-preco]')).toHaveCount(0);
  await expect(secao).not.toContainText(/pra comer|pra beber/i);
  for (const nome of ['Croissants', 'Brunchs', 'Sanduíches', 'Bowls', 'Cheesecakes', 'Cinnamon Rolls', 'Sucos', 'Cafés gelados', 'Outras bebidas']) {
    await expect(secao.getByText(nome, { exact: true })).toHaveCount(0);
  }
  const completo = secao.getByRole('link', { name: 'Ver cardápio completo' });
  await expect(completo).toHaveAttribute('href', '/cardapio/');
  await completo.click();
  await expect(page).toHaveURL(/\/cardapio\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cardápio' })).toBeVisible();
});

test('home: só as polaroids de brunch e croissant mudaram; a de bebidas e a composição seguem', async ({ page }) => {
  await page.goto('/');
  const fotos = page.locator('#gastronomia .board__item img');
  await expect(fotos).toHaveCount(3);
  const fontes = await fotos.evaluateAll((l) => l.map((i) => (i as HTMLImageElement).src));
  expect(fontes[0]).toContain('brunch-home');
  expect(fontes[1]).toContain('croissant-home');
  expect(fontes[2]).toContain('bebida-chocolate-creme');
  await expect(page.locator('#gastronomia .tape')).toHaveCount(3);
  await expect(page.locator('#gastronomia .note')).toHaveText(['brunch', 'croissant', /bebidas\s*geladas/]);
  await expect(page.locator('#gastronomia .arrow')).toHaveCount(3);
  for (const i of [0, 1, 2]) {
    const foto = fotos.nth(i);
    await foto.scrollIntoViewIfNeeded();
    await expect.poll(() => foto.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  }
});

test('links oficiais de reserva e cardápio continuam no ar', async ({ request }) => {
  for (const rota of ['/cardapio/', '/reservar/']) expect((await request.get(rota)).status()).toBe(200);
});
