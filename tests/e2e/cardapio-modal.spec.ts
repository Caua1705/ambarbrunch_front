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

test('a imagem grande só baixa ao abrir, uma vez, e reabrir não baixa de novo', async ({ page }) => {
  const pedidas: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'image') pedidas.push(r.url()); });
  await page.goto('/cardapio/');
  await page.waitForTimeout(500);
  const grandes = await page.evaluate(() => [...document.querySelectorAll('template')].flatMap((t) => [...t.content.querySelectorAll('source, img')].flatMap((e) => ((e as HTMLImageElement).srcset ?? '').split(',').map((s) => s.trim().split(' ')[0]))).filter(Boolean));
  expect(grandes.length).toBeGreaterThan(100);
  const baixadas = () => pedidas.filter((u) => grandes.some((g) => u.endsWith(g)));
  expect(baixadas()).toEqual([]);
  const b = linha(page, 'sucos.green').getByRole('button');
  await b.click();
  await expect(modal(page).locator('[data-pronta]')).toHaveCount(1);
  expect(baixadas()).toHaveLength(1);
  await page.keyboard.press('Escape');
  await b.click();
  // reaproveita a imagem: já abre pronta, sem prévia nem indicador
  await expect(modal(page).locator('.produto-modal__quadro')).toHaveAttribute('data-pronta', '');
  await expect(modal(page).locator('[data-carregando]')).toHaveCount(0);
  expect(baixadas()).toHaveLength(1);
});

test('em rede lenta: a moldura não muda de tamanho, a prévia não dá zoom e a imagem certa entra sem pular', async ({ page }) => {
  await page.goto('/cardapio/');
  await page.addStyleTag({ content: '.sticky-cta{display:none!important}' });
  const l = linha(page, 'bowls.camarao_fresh');
  await l.scrollIntoViewIfNeeded();
  await expect.poll(() => l.locator('.prato__foto img').evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  let soltar = () => {};
  const espera = new Promise<void>((r) => { soltar = r; });
  await page.route(/camarao-fresh\.[^/]*\.(avif|webp)/, async (rota) => {
    if (rota.request().url().endsWith('.avif') || rota.request().url().endsWith('.webp')) await espera;
    await rota.continue();
  });
  await l.getByRole('button').click();
  const quadro = modal(page).locator('.produto-modal__quadro');
  await expect(quadro).toHaveAttribute('data-carregando', '');
  const antes = (await modal(page).boundingBox())!;
  const previa = await quadro.evaluate((e) => ({ mini: getComputedStyle(e).getPropertyValue('--miniatura'), ajuste: getComputedStyle(e.querySelector('.produto-modal__previa')!, '::after').backgroundSize, imagem: getComputedStyle(e.querySelector('img')!).opacity }));
  expect(previa.mini).toContain('camarao-fresh');
  expect(previa.ajuste).toBe('contain');
  expect(previa.imagem).toBe('0');
  soltar();
  await expect(quadro).toHaveAttribute('data-pronta', '');
  await expect(quadro).not.toHaveAttribute('data-carregando', '');
  expect(await modal(page).boundingBox()).toEqual(antes);
  await page.unroute(/camarao-fresh/);
});

test('se a imagem grande falhar, o popup segue útil e a próxima abertura tenta de novo', async ({ page }) => {
  await page.goto('/cardapio/');
  const imagens = /atum\.[^/]*\.(avif|webp)$/;
  await page.route(imagens, (rota) => rota.abort());
  const b = linha(page, 'bowls.atum').getByRole('button');
  await b.click();
  await expect(modal(page).locator('[data-carregando]')).toHaveCount(0);
  await expect(modal(page).getByRole('heading')).toHaveText('Atum');
  await page.keyboard.press('Escape');
  await page.unroute(imagens);
  await b.click();
  await expect(modal(page).locator('[data-pronta]')).toHaveCount(1);
});

test('gestos acidentais: toque duplo não fecha, arrastar do texto para o fundo não fecha', async ({ page }) => {
  await page.goto('/cardapio/');
  await page.addStyleTag({ content: '.sticky-cta{display:none!important}' });
  // a linha fica fora da caixa do modal: o segundo clique cai no fundo escurecido
  const l = linha(page, 'brunches.green_morning');
  await l.scrollIntoViewIfNeeded();
  await l.evaluate((e) => { const y = e.getBoundingClientRect().top + scrollY - 70; scrollTo({ top: y, behavior: 'instant' }); });
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
  for (let volta = 0; volta < 3; volta++) {
    for (const id of ids) {
      const alt = FOTOS_PRODUTO[id].alt;
      // fecha e abre o próximo na mesma tarefa: o evento close chega depois
      const r = await page.evaluate(([i]) => {
        const m = document.querySelector<HTMLDialogElement>('[data-produto-modal]')!;
        if (m.open) m.close();
        document.querySelector<HTMLElement>(`.prato[data-item="${i}"] [data-abrir-produto]`)!.click();
        return new Promise<string | null>((ok) => setTimeout(() => ok(m.querySelector('img')?.alt ?? null), 20));
      }, [id]);
      expect(r, id).toBe(alt);
      await expect(modal(page).locator('img'), id).toHaveCount(1);
    }
  }
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
