// /cardapio/: a etiqueta marcada é sempre uma só e é a da seção que está sob a barra, em qualquer sentido e velocidade de rolagem. Roda com a
// rolagem suave ligada: é nela que as categorias do caminho piscavam ao tocar numa etiqueta distante.
import { test, expect, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

const NAV = '[data-carta-nav]';
const irPara = (page: Page, y: number) => page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
const fimDaPagina = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

/** Espera os dois quadros que a marcação leva para refletir a posição. */
const assentar = (page: Page) => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));

const estado = (page: Page) => page.evaluate((seletor) => {
  const nav = document.querySelector(seletor)!;
  const limite = nav.getBoundingClientRect().bottom + 24;
  let esperada = '';
  for (const s of document.querySelectorAll('[data-carta-secao]')) {
    if (!esperada || s.getBoundingClientRect().top <= limite) esperada = s.querySelector('h2')!.textContent!;
  }
  return { ativas: [...nav.querySelectorAll('a[aria-current="true"]')].map((a) => a.textContent!), esperada };
}, NAV);

const conferir = async (page: Page, contexto: string) => {
  await assentar(page);
  const { ativas, esperada } = await estado(page);
  expect(ativas, contexto).toEqual([esperada]);
};

/** Passa a registrar cada troca da etiqueta marcada. */
const gravarTrocas = (page: Page) => page.evaluate((seletor) => {
  const nav = document.querySelector(seletor)!;
  const trocas: string[] = [];
  (window as unknown as { trocas: string[] }).trocas = trocas;
  new MutationObserver(() => {
    const ativas = [...nav.querySelectorAll('a[aria-current="true"]')].map((a) => a.textContent!).join('+');
    if (ativas !== trocas.at(-1)) trocas.push(ativas);
  }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
}, NAV);
const trocas = (page: Page) => page.evaluate(() => (window as unknown as { trocas: string[] }).trocas);

/** Espera a rolagem suave terminar. */
const pararDeRolar = (page: Page) => page.evaluate(() => new Promise<void>((ok) => {
  let y = scrollY;
  let parados = 0;
  const passo = () => {
    parados = scrollY === y ? parados + 1 : 0;
    y = scrollY;
    if (parados >= 30) ok(); else requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}));

const tocar = (page: Page, nome: string) => page.locator(NAV).getByRole('link', { name: nome, exact: true }).click();

test.beforeEach(async ({ page }) => { await page.goto('/cardapio/'); });

test('primeira e última categorias: sempre há uma marcada, do topo ao fim da página', async ({ page }) => {
  await assentar(page);
  expect((await estado(page)).ativas).toEqual(['Croissants']);
  await irPara(page, await fimDaPagina(page));
  await assentar(page);
  expect((await estado(page)).ativas).toEqual(['Adicionais']);
});

test('rolagem lenta: a marcação é a mesma descendo e subindo, em cada posição', async ({ page }) => {
  const fim = await fimDaPagina(page);
  const descendo = new Map<number, string>();
  for (let y = 0; y <= fim; y += 90) {
    await irPara(page, y);
    await conferir(page, `descendo em ${y}`);
    descendo.set(y, (await estado(page)).ativas[0]);
  }
  for (const y of [...descendo.keys()].reverse()) {
    await irPara(page, y);
    await conferir(page, `subindo em ${y}`);
    expect((await estado(page)).ativas[0], `subindo em ${y}`).toBe(descendo.get(y));
  }
});

test('rolagem rápida: saltos longos nos dois sentidos caem na categoria certa', async ({ page }) => {
  const fim = await fimDaPagina(page);
  for (const fracao of [0.9, 0.1, 0.65, 0.3, 1, 0, 0.5]) {
    await irPara(page, Math.round(fim * fracao));
    await conferir(page, `em ${fracao}`);
  }
});

test('Cheesecakes → Cinnamon Rolls → Cafés: troca uma vez, quando o título chega à barra', async ({ page }) => {
  const topo = (titulo: string) => page.getByRole('heading', { level: 2, name: titulo, exact: true }).evaluate((h) => h.closest('section')!.getBoundingClientRect().top + scrollY);
  const inicio = await topo('Cheesecakes');
  const fim = await topo('Cafés');
  await irPara(page, inicio - 200);
  await assentar(page);
  await gravarTrocas(page);
  // passo curto, com sobe e desce pequeno na fronteira: uma troca a mais apareceria aqui
  for (let y = inicio - 200; y <= fim; y += 24) {
    await irPara(page, y);
    await assentar(page);
  }
  expect(await trocas(page)).toEqual(['Cheesecakes', 'Cinnamon Rolls', 'Cafés']);
});

test('toque em categoria distante: só o destino fica marcado, nada pisca no caminho', async ({ page }) => {
  await gravarTrocas(page);
  await tocar(page, 'Cafés gelados');
  await pararDeRolar(page);
  expect(await trocas(page)).toEqual(['Cafés gelados']);
  await conferir(page, 'depois da rolagem');
  await tocar(page, 'Croissants');
  await pararDeRolar(page);
  expect(await trocas(page)).toEqual(['Cafés gelados', 'Croissants']);
  await conferir(page, 'de volta ao início');
});

test('toque: o título fica logo abaixo da barra, visível', async ({ page }) => {
  for (const nome of ['Cinnamon Rolls', 'Adicionais', 'Cheesecakes']) {
    await tocar(page, nome);
    await pararDeRolar(page);
    const nav = (await page.locator(NAV).boundingBox())!;
    const titulo = (await page.getByRole('heading', { level: 2, name: nome, exact: true }).boundingBox())!;
    expect(titulo.y, nome).toBeGreaterThanOrEqual(nav.y + nav.height);
    expect(titulo.y, nome).toBeLessThan(nav.y + nav.height + 40);
    expect((await estado(page)).ativas, nome).toEqual([nome]);
  }
});

test('a pessoa assume a rolagem durante um toque: a marcação volta a seguir a posição', async ({ page }) => {
  await tocar(page, 'Cafés gelados');
  await page.evaluate(() => {
    document.querySelector('h1')!.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 40 }));
    scrollTo({ top: 1500, behavior: 'instant' });
  });
  await pararDeRolar(page);
  await conferir(page, 'depois de assumir');
  expect((await estado(page)).ativas).not.toEqual(['Cafés gelados']);
});

test('a faixa leva a etiqueta da vez para a área visível sem mover a página', async ({ page }) => {
  await gravarTrocas(page);
  await irPara(page, await fimDaPagina(page));
  const y = await page.evaluate(() => scrollY);
  await pararDeRolar(page);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  const faixa = (await page.locator(`${NAV} ul`).boundingBox())!;
  const etiqueta = (await page.locator(`${NAV} a[aria-current="true"]`).boundingBox())!;
  expect(etiqueta.x).toBeGreaterThanOrEqual(faixa.x);
  expect(etiqueta.x + etiqueta.width).toBeLessThanOrEqual(faixa.x + faixa.width);
});

test('a etiqueta marcada mantém o tamanho e não empurra as vizinhas', async ({ page }) => {
  const larguras = () => page.locator(`${NAV} a`).evaluateAll((l) => l.map((a) => a.getBoundingClientRect().width));
  const antes = await larguras();
  await irPara(page, 3000);
  await pararDeRolar(page);
  expect(await larguras()).toEqual(antes);
});

test('imagens carregadas depois não mudam a altura das seções nem a marcação', async ({ page }) => {
  const alturas = () => page.locator('[data-carta-secao]').evaluateAll((l) => l.map((s) => s.getBoundingClientRect().height));
  const antes = await alturas();
  await page.locator('.prato__foto img').evaluateAll(async (imgs) => {
    await Promise.all((imgs as HTMLImageElement[]).map((i) => { i.loading = 'eager'; return i.decode().catch(() => undefined); }));
  });
  expect(await alturas()).toEqual(antes);
  await irPara(page, 4000);
  await conferir(page, 'depois das imagens');
});

test('recarregar no meio do conteúdo e abrir por um link de categoria', async ({ page }) => {
  await irPara(page, 3500);
  await page.reload();
  await pararDeRolar(page);
  await conferir(page, 'recarregada');
  await page.goto('/cardapio/#sucos');
  await pararDeRolar(page);
  expect((await estado(page)).ativas).toEqual(['Sucos']);
});

test('larguras de celular e tablet, em retrato e paisagem', async ({ page }) => {
  for (const [width, height] of [[320, 640], [360, 800], [412, 915], [430, 932], [844, 390], [915, 412], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/cardapio/');
    const fim = await fimDaPagina(page);
    for (const fracao of [0, 0.25, 0.5, 0.75, 1]) {
      await irPara(page, Math.round(fim * fracao));
      await conferir(page, `${width}x${height} em ${fracao}`);
    }
    await tocar(page, 'Cheesecakes');
    await pararDeRolar(page);
    expect((await estado(page)).ativas, `${width}x${height}`).toEqual(['Cheesecakes']);
  }
});

test('vindo da home: Ver cardápio de bebidas abre direto em Cafés, com o título visível e a categoria marcada', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('#cafe-roll').getByRole('link', { name: 'Ver cardápio de bebidas' });
  await expect(link).toHaveAttribute('href', '/cardapio/#cafes');
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page).toHaveURL(/\/cardapio\/#cafes$/);
  await pararDeRolar(page);
  expect((await estado(page)).ativas).toEqual(['Cafés']);
  const nav = (await page.locator(NAV).boundingBox())!;
  const titulo = (await page.getByRole('heading', { level: 2, name: 'Cafés', exact: true }).boundingBox())!;
  expect(titulo.y).toBeGreaterThanOrEqual(nav.y + nav.height);
  expect(titulo.y).toBeLessThan(nav.y + nav.height + 40);
});

test('estrutura: pra comer abre a lista, pra beber vem antes de Cafés e nenhuma foto gigante entre as categorias', async ({ page }) => {
  const ordem = await page.evaluate(() => [...document.querySelectorAll('.carta__rotulo, .categoria h2')].map((e) => e.textContent));
  expect(ordem.slice(0, 2)).toEqual(['pra comer', 'Croissants']);
  expect(ordem[ordem.indexOf('Cafés') - 1]).toBe('pra beber');
  await expect(page.locator('.categoria figure')).toHaveCount(0);
  const nav = (await page.locator(NAV).boundingBox())!;
  expect((await page.getByText('pra comer').boundingBox())!.y).toBeGreaterThan(nav.y);
});

test('clicar em Croissants, Brunchs e Cafés posiciona cada um logo abaixo da barra', async ({ page }) => {
  for (const nome of ['Cafés', 'Croissants', 'Brunchs']) {
    await tocar(page, nome);
    await pararDeRolar(page);
    const barra = (await page.locator(NAV).boundingBox())!;
    const titulo = (await page.getByRole('heading', { level: 2, name: nome, exact: true }).boundingBox())!;
    expect(titulo.y, nome).toBeGreaterThanOrEqual(barra.y + barra.height);
    expect(titulo.y, nome).toBeLessThan(barra.y + barra.height + 40);
    expect((await estado(page)).ativas, nome).toEqual([nome]);
  }
});

test('abrir direto em /cardapio/#cafes salta para Cafés, sem rolar pelas comidas, e a barra volta a rolar suave', async ({ page }) => {
  await page.goto('about:blank');
  await page.addInitScript(() => {
    const posicoes = new Set<number>();
    (window as unknown as { posicoes: Set<number> }).posicoes = posicoes;
    const f = () => { posicoes.add(Math.round(scrollY)); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  await page.goto('/cardapio/#cafes');
  await pararDeRolar(page);
  expect((await estado(page)).ativas).toEqual(['Cafés']);
  await expect(page.getByRole('heading', { level: 2, name: 'Cafés', exact: true })).toBeInViewport();
  const posicoes = await page.evaluate(() => [...(window as unknown as { posicoes: Set<number> }).posicoes]);
  expect(posicoes.length, 'sem passar pelas posições intermediárias').toBeLessThanOrEqual(4);
  expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe('');
});

test('tela alta: categoria que não chega à barra porque a página acabou segue marcada depois do toque', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2600 });
  await page.goto('/cardapio/');
  const fim = await fimDaPagina(page);
  await tocar(page, 'Adicionais');
  await pararDeRolar(page);
  expect((await estado(page)).ativas).toEqual(['Adicionais']);
  await irPara(page, Math.round(fim / 2));
  await conferir(page, 'depois de rolar de novo');
});
