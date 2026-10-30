// SEO local e medição (2026-10-30), sobre o build de produção de teste (dist-reservas-api): o que os buscadores leem
// (canonical no domínio oficial, Open Graph, dados estruturados do café, robots e sitemap) e a garantia de que, sem a
// seção de medição aprovada e sem PUBLIC_GA4_ID, nenhum pedido vai ao Google — nem na reserva concluída.
import { test, expect, type Page } from '@playwright/test';
import { apiFalsa, relogio } from './api-falsa';

const OFICIAL = 'https://ambarbrunch.com';
const meta = (page: Page, seletor: string, attr = 'content') => page.locator(seletor).first().getAttribute(attr);

test('home: título local, canonical e Open Graph no domínio oficial, imagem 1200 × 630 publicada', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Âmbar — cafeteria e brunch no Meireles, Fortaleza');
  expect(await meta(page, 'meta[name="description"]')).toContain('Meireles, em Fortaleza');
  expect(await meta(page, 'link[rel="canonical"]', 'href')).toBe(`${OFICIAL}/`);
  expect(await meta(page, 'meta[property="og:url"]')).toBe(`${OFICIAL}/`);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  const imagem = await meta(page, 'meta[property="og:image"]');
  expect(imagem).toMatch(new RegExp(`^${OFICIAL}/_astro/.+\\.jpg$`));
  // o arquivo existe no build (não foi podado como “não referenciado”)
  expect((await request.get(new URL(imagem!).pathname)).status()).toBe(200);
});

test('home: dados estruturados do café (CafeOrCoffeeShop) com endereço, horário e reserva — sem dado inventado', async ({ page, request }) => {
  await page.goto('/');
  const blocos = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocos).toHaveLength(1);
  const grafo = JSON.parse(blocos[0])['@graph'] as Record<string, any>[];
  const cafe = grafo.find((n) => n['@type'] === 'CafeOrCoffeeShop')!;
  expect(cafe.name).toBe('Âmbar');
  expect(cafe.alternateName).toContain('Âmbar Café');
  expect(cafe.url).toBe(`${OFICIAL}/`);
  expect(cafe.address).toMatchObject({ streetAddress: 'Rua Tavares Coutinho, 1580', addressLocality: 'Fortaleza', addressRegion: 'CE', postalCode: '60160-130', addressCountry: 'BR' });
  expect(cafe.openingHoursSpecification).toEqual([expect.objectContaining({ dayOfWeek: expect.arrayContaining(['Monday', 'Sunday']), opens: '07:00', closes: '19:00' })]);
  expect(cafe.potentialAction.target.urlTemplate).toBe(`${OFICIAL}/reservar/`);
  expect(cafe.sameAs).toEqual(['https://www.instagram.com/ambarbrunch/']);
  for (const campo of ['image', 'logo']) expect((await request.get(new URL(cafe[campo]).pathname)).status(), campo).toBe(200);
  // nada que o responsável não confirmou: telefone público, coordenadas, faixa de preço, avaliações
  for (const campo of ['telephone', 'geo', 'priceRange', 'aggregateRating', 'review']) expect(cafe[campo], campo).toBeUndefined();
  expect(grafo.find((n) => n['@type'] === 'WebSite')?.url).toBe(`${OFICIAL}/`);
});

test('páginas fora do Google (privacidade, confirmação, Clube) seguem com noindex e sem canonical', async ({ page }) => {
  for (const url of ['/privacidade/', '/reserva-confirmada/', '/clube/entrar/']) {
    await page.goto(url);
    await expect(page.locator('meta[name="robots"]'), url).toHaveAttribute('content', 'noindex');
    await expect(page.locator('link[rel="canonical"]'), url).toHaveCount(0);
  }
  await page.goto('/reservar/');
  expect(await meta(page, 'link[rel="canonical"]', 'href')).toBe(`${OFICIAL}/reservar/`);
});

test('robots.txt e sitemap.xml: só o painel bloqueado; o sitemap lista só páginas indexáveis que existem', async ({ page, request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toBe(`User-agent: *\nDisallow: /admin/\n\nSitemap: ${OFICIAL}/sitemap.xml\n`);
  // (o Content-Type vem da extensão na Vercel; o servidor local dos testes não conhece .xml)
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs).toEqual([`${OFICIAL}/`, `${OFICIAL}/reservar/`]);
  for (const loc of locs) {
    const caminho = new URL(loc).pathname;
    await page.goto(caminho);
    await expect(page.locator('meta[name="robots"]'), caminho).toHaveCount(0);
    expect(await meta(page, 'link[rel="canonical"]', 'href')).toBe(loc);
  }
});

test('sem GA4 aprovado: nenhum pedido ao Google e nenhum gtag, da home até a reserva concluída', async ({ page }) => {
  const google: string[] = [];
  page.on('request', (r) => { if (/googletagmanager|google-analytics|analytics\.google|doubleclick/.test(r.url())) google.push(r.url()); });
  await relogio(page);
  await apiFalsa(page);
  await page.goto('/');
  await page.goto('/reservar/');
  await page.locator('form.ticket').scrollIntoViewIfNeeded();
  await expect(page.locator('.data-campo:visible, .cal__grade:visible').first()).toBeVisible();
  const campo = page.locator('.data-campo');
  if ((await campo.isVisible()) && (await campo.getAttribute('aria-expanded')) !== 'true') await campo.click();
  for (let i = 0; i < 4 && !(await page.locator('.cal__dia[data-valor="2026-11-10"]').count()); i++) await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.locator('.cal__dia[data-valor="2026-11-10"]').click();
  await page.getByRole('radio', { name: '09:00', exact: true }).click();
  await page.getByLabel('Nome').fill('Maria Teste');
  await page.getByLabel('WhatsApp ou telefone').fill('85987654321');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();
  await expect(page).toHaveURL(/\/reserva-confirmada\/$/);
  await expect(page.getByRole('heading', { name: 'Mesa reservada' })).toBeVisible();
  expect(await page.evaluate(() => typeof (window as unknown as { gtag?: unknown }).gtag)).toBe('undefined');
  expect(google).toEqual([]);
  // a política continua a aprovada (2026-11-v1), com a seção de cookies de sempre e sem botão de medição
  await page.goto('/privacidade/');
  await expect(page.getByText('Este site não usa cookies de rastreamento nem ferramentas de publicidade.')).toBeVisible();
  await expect(page.getByText('Versão 2026-11-v1')).toBeVisible();
  await expect(page.locator('[data-medicao-recusa]')).toHaveCount(0);
});
