// /cardapio/: tocar em qualquer produto abre o modal com a imagem ampliada e fechar devolve a pessoa ao mesmo ponto da lista. Clique e toque reais: o
// Playwright só clica no que estiver de fato no topo naquele ponto da tela, então um elemento cobrindo a linha ou o modal reprova o teste.
import { test, expect, type Page } from '@playwright/test';
import { FOTOS_PRODUTO } from '../../src/data/cardapio';
import { validarCatalogo, formatarPreco, temCentavos } from '../../src/lib/cardapio/contrato';
import { lerFonte } from '../../src/lib/cardapio/fonte';

const modal = (page: Page) => page.locator('[data-produto-modal]');
const linha = (page: Page, id: string) => page.locator(`.prato[data-item="${id}"]`);
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
/** originais da Roll, menores que uma tela 2× de 430 px: nunca são ampliados (limites em CARDAPIO-FOTOS-PENDENTES.md) */
const ORIGINAL_MENOR = new Set(['cinnamon_rolls.tradicional', 'cinnamon_rolls.mood_cheesecake', 'cinnamon_rolls.biscoff']);

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
        // nitidez: o arquivo entregue cobre a largura na tela, sem esticar, até 2×. Com srcset, naturalWidth já vem dividido pela densidade: mede o arquivo.
        const { natural, tela, escala } = await img.evaluate(async (e: HTMLImageElement) => {
          const arquivo = new Image();
          arquivo.src = e.currentSrc;
          await arquivo.decode();
          return { natural: arquivo.naturalWidth, tela: e.getBoundingClientRect().width, escala: Math.min(devicePixelRatio, 2) };
        });
        if (!ORIGINAL_MENOR.has(i.id)) expect(natural, i.id).toBeGreaterThanOrEqual(Math.floor(tela * escala * 0.98));
        // sem corte nem distorção: a moldura tem a proporção do arquivo e a imagem aparece inteira
        const encaixe = await img.evaluate(async (e: HTMLImageElement) => {
          const q = e.closest('.produto-modal__quadro')!.getBoundingClientRect();
          return { ajuste: getComputedStyle(e).objectFit, moldura: q.width / q.height, arquivo: e.naturalWidth / e.naturalHeight };
        });
        expect(encaixe.ajuste, i.id).toBe('contain');
        expect(Math.abs(encaixe.moldura - encaixe.arquivo), i.id).toBeLessThan(0.02);
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
  await expect(modal(page)).toBeVisible();
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
  // logo depois de abrir o fundo ignora o toque, para o segundo toque de um toque duplo não fechar o popup
  await page.waitForTimeout(400);
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

/** anota o estado da imagem no instante exato em que o modal abre, antes de qualquer quadro */
const vigiarAbertura = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { aberturas: unknown[] };
  w.aberturas = [];
  const m = document.querySelector('[data-produto-modal]')!;
  new MutationObserver(() => {
    if (!m.hasAttribute('open')) return;
    const i = m.querySelector('img');
    w.aberturas.push({ nome: m.querySelector('h2')?.textContent, alt: i?.alt ?? null, pronta: !!i?.complete && (i?.naturalWidth ?? 0) > 0, opacidade: i ? getComputedStyle(i).opacity : null, filhos: m.querySelector('[data-modal-foto]')?.childElementCount });
  }).observe(m, { attributes: true, attributeFilter: ['open'] });
});
const aberturas = (page: Page) => page.evaluate(() => (window as unknown as { aberturas: { nome: string; alt: string | null; pronta: boolean; opacidade: string | null; filhos: number }[] }).aberturas);
/** arquivos grandes de uma linha, tirados do <template> */
const arquivosGrandes = (page: Page) => page.evaluate(() => [...document.querySelectorAll('template')].flatMap((t) => [...t.content.querySelectorAll('source, img')].flatMap((e) => ((e as HTMLImageElement).srcset ?? '').split(',').map((s) => s.trim().split(' ')[0]))).filter(Boolean));

test('adianta só o que está perto da tela, depois da carga, sem baixar tudo', async ({ page }) => {
  const pedidas: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'image') pedidas.push(r.url()); });
  await page.goto('/cardapio/');
  const grandes = await arquivosGrandes(page);
  expect(grandes.length).toBeGreaterThan(100);
  await expect.poll(() => pedidas.filter((u) => grandes.some((g) => u.endsWith(g))).length, { timeout: 8000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  const baixadas = pedidas.filter((u) => grandes.some((g) => u.endsWith(g)));
  expect(new Set(baixadas).size).toBe(baixadas.length);
  expect(baixadas.length).toBeLessThanOrEqual(24);
  expect(pedidas.some((u) => /copo-iced-latte/.test(u))).toBe(false);
});

test('com a imagem já pronta o modal abre nítido no primeiro quadro e reabrir não baixa de novo', async ({ page }) => {
  const pedidas: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'image') pedidas.push(r.url()); });
  await page.goto('/cardapio/');
  await vigiarAbertura(page);
  const b = linha(page, 'croissants.classico').getByRole('button');
  await b.click();
  await expect(modal(page)).toBeVisible();
  await page.keyboard.press('Escape');
  const grandes = await arquivosGrandes(page);
  const conta = () => pedidas.filter((u) => grandes.some((g) => u.endsWith(g)) && /classico/.test(u)).length;
  expect(conta()).toBe(1);
  await b.click();
  await expect(modal(page)).toBeVisible();
  expect(conta()).toBe(1);
  for (const a of await aberturas(page)) expect(a).toMatchObject({ nome: 'Clássico', pronta: true, opacidade: '1', filhos: 1 });
});

test('cache vazio e rede lenta: a lista espera com um aviso na linha e o modal só abre com a imagem pronta', async ({ page }) => {
  await page.goto('/cardapio/');
  await vigiarAbertura(page);
  const l = linha(page, 'bowls.camarao_fresh');
  let soltar = () => {};
  const espera = new Promise<void>((r) => { soltar = r; });
  const grande = /camarao-fresh\.[^/]*\.(avif|webp)$/;
  await page.route(grande, async (rota) => { await espera; await rota.continue(); });
  await l.scrollIntoViewIfNeeded();
  await l.getByRole('button').click();
  await page.waitForTimeout(500);
  await expect(modal(page)).toBeHidden();
  await expect(l).toHaveAttribute('data-abrindo', '');
  await expect(l.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  soltar();
  await expect(modal(page)).toBeVisible();
  await expect(l).not.toHaveAttribute('data-abrindo', '');
  await expect(l.getByRole('button')).not.toHaveAttribute('aria-busy', 'true');
  expect(await aberturas(page)).toEqual([{ nome: 'Camarão Fresh', alt: FOTOS_PRODUTO['bowls.camarao_fresh'].alt, pronta: true, opacidade: '1', filhos: 1 }]);
  await expect(modal(page).locator('.produto-modal__previa, [data-carregando]')).toHaveCount(0);
  await page.unroute(grande);
});

test('troca rápida: tocar em outro produto durante a espera abre só o último, com a imagem dele', async ({ page }) => {
  await page.goto('/cardapio/');
  await vigiarAbertura(page);
  let soltar = () => {};
  const espera = new Promise<void>((r) => { soltar = r; });
  const grandes = /(atum|ragu)\.[^/]*\.(avif|webp)$/;
  await page.route(grandes, async (rota) => { await espera; await rota.continue(); });
  const a = linha(page, 'bowls.ragu');
  const b = linha(page, 'bowls.atum');
  await a.scrollIntoViewIfNeeded();
  await b.scrollIntoViewIfNeeded();
  await a.getByRole('button').click();
  await b.getByRole('button').click();
  await expect(a).not.toHaveAttribute('data-abrindo', '');
  await expect(b).toHaveAttribute('data-abrindo', '');
  soltar();
  await expect(modal(page).getByRole('heading')).toHaveText('Atum');
  await page.waitForTimeout(300);
  const lista = await aberturas(page);
  expect(lista).toHaveLength(1);
  expect(lista[0]).toMatchObject({ nome: 'Atum', alt: FOTOS_PRODUTO['bowls.atum'].alt, pronta: true });
  await page.unroute(grandes);
});

test('cancelar: Esc durante a espera não abre o modal e rolar para longe também não', async ({ page }) => {
  await page.goto('/cardapio/');
  let soltar = () => {};
  const espera = new Promise<void>((r) => { soltar = r; });
  const grandes = /(citrico-chicken|morango)\.[^/]*\.(avif|webp)$/;
  await page.route(grandes, async (rota) => { await espera; await rota.continue(); });
  const l = linha(page, 'bowls.citrico_chicken');
  await l.scrollIntoViewIfNeeded();
  await l.getByRole('button').click();
  await expect(l).toHaveAttribute('data-abrindo', '');
  await page.keyboard.press('Escape');
  await expect(l).not.toHaveAttribute('data-abrindo', '');
  const m = linha(page, 'cheesecakes.morango');
  await m.scrollIntoViewIfNeeded();
  await m.getByRole('button').click();
  await expect(m).toHaveAttribute('data-abrindo', '');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  soltar();
  await page.waitForTimeout(500);
  await expect(modal(page)).toBeHidden();
  await expect(m).not.toHaveAttribute('data-abrindo', '');
  await page.unroute(grandes);
});

test('se a imagem falhar não há carregamento infinito: abre só o texto e a próxima abertura tenta de novo', async ({ page }) => {
  await page.goto('/cardapio/');
  await page.waitForTimeout(100);
  const imagens = /tuna\.[^/]*\.(avif|webp)$/;
  await page.route(imagens, (rota) => rota.abort());
  const l = linha(page, 'sanduiches.tuna');
  await l.scrollIntoViewIfNeeded();
  await l.getByRole('button').click();
  await expect(modal(page)).toBeVisible();
  await expect(l).not.toHaveAttribute('data-abrindo', '');
  await expect(modal(page).getByRole('heading')).toHaveText('Tuna');
  await expect(modal(page).locator('.produto-modal__preco')).toBeVisible();
  await expect(modal(page).locator('img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.unroute(imagens);
  await l.getByRole('button').click();
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).locator('img')).toHaveAttribute('alt', FOTOS_PRODUTO['sanduiches.tuna'].alt);
});

test('gestos acidentais: toque duplo não fecha, arrastar do texto para o fundo não fecha', async ({ page }) => {
  await page.goto('/cardapio/');
  await page.addStyleTag({ content: '.sticky-cta{display:none!important}' });
  // a linha fica fora da caixa do modal: o segundo clique cai no fundo escurecido
  const l = linha(page, 'brunches.green_morning');
  await l.scrollIntoViewIfNeeded();
  await l.evaluate((e) => { const y = e.getBoundingClientRect().top + window.scrollY - 70; scrollTo({ top: y, behavior: 'instant' }); });
  await page.waitForTimeout(150);
  const c = (await l.boundingBox())!;
  await page.mouse.dblclick(c.x + 40, c.y + 12);
  await page.waitForTimeout(450);
  await expect(modal(page)).toBeVisible();
  const caixa = (await modal(page).boundingBox())!;
  expect(c.y + 12).toBeLessThan(caixa.y);
  const nome = (await modal(page).getByRole('heading').boundingBox())!;
  await page.mouse.move(nome.x + 10, nome.y + 8);
  await page.mouse.down();
  await page.mouse.move(6, 6, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  await expect(modal(page)).toBeVisible();
  // depois da espera, o clique no fundo fecha normalmente
  await page.mouse.click(6, 6);
  await expect(modal(page)).toBeHidden();
});

test('fechar e abrir outro produto em sequência nunca mostra a imagem errada', async ({ page }) => {
  await page.goto('/cardapio/');
  const ids = ['croissants.caprese', 'bowls.atum', 'cafes.macchiato', 'sucos.green', 'cheesecakes.morango', 'cafes_gelados.iced_latte'];
  for (let volta = 0; volta < 2; volta++) {
    for (const id of ids) {
      // fecha e pede o próximo na mesma tarefa: o evento close chega depois
      await page.evaluate(([i]) => {
        const m = document.querySelector<HTMLDialogElement>('[data-produto-modal]')!;
        if (m.open) m.close();
        const l = document.querySelector<HTMLElement>(`.prato[data-item="${i}"]`)!;
        l.scrollIntoView({ block: 'center', behavior: 'instant' });
        l.querySelector<HTMLElement>('[data-abrir-produto]')!.click();
      }, [id]);
      await expect(modal(page).locator('img'), id).toHaveAttribute('alt', FOTOS_PRODUTO[id].alt);
      await expect(modal(page).locator('img'), id).toHaveCount(1);
    }
  }
});

test('modal cabe na tela em retrato e paisagem, com o X e o preço alcançáveis', async ({ page }) => {
  for (const [width, height] of [[360, 740], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/cardapio/');
    await linha(page, 'brunches.italian_morning').getByRole('button').click();
    await expect(modal(page)).toBeVisible();
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
