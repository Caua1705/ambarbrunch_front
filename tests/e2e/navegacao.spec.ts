// Menu, CTA fixo e navegação (regras da rodada final): um único botão fixo “Reservar mesa”, pela posição das seções;
// selo do menu fixo no alto; folha do menu com entrada e saída animadas, sem contatos.
import { test, expect, type Page } from '@playwright/test';
import { CLUBE_NA_HOME, MOTIVO_CLUBE_OCULTO } from '../clube-home';

const visivel = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.classList.contains('is-visible') && el.getAttribute('aria-hidden') === 'false');
const rolarAte = (page: Page, sel: string, dy = 60) => page.locator(sel).first().evaluate((el, d) => scrollTo({ top: el.getBoundingClientRect().top + scrollY + d, behavior: 'instant' }), dy);

test('CTA fixo: escondido no hero, em Novo capítulo e Para sua mesa; aparece em Direto da fornada; some na reserva; com o Clube na home, volta no Clube e fica até o fim', async ({ page }) => {
  await page.goto('/');
  const secoes: (readonly [string, boolean])[] = [['#novo', false], ['#gastronomia', false], ['#roll', true], ['#cafe-roll', true], ['#quem-provou', true], ['#ambientes', true], ['#reservar', false]];
  if (CLUBE_NA_HOME) secoes.push(['#clube', true]);
  for (const [sel, esperado] of secoes) {
    await rolarAte(page, sel);
    await expect.poll(() => visivel(page, '[data-sticky-cta]'), { message: sel }).toBe(esperado);
  }
  // 2026-10-23: o rodapé não tem botão de reserva — com o Clube na home, o fixo continua sendo o acesso até o fim.
  // Sem o Clube, o fim da página ainda mostra a reserva: o fixo fica oculto (não repete o botão sobre o formulário).
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(CLUBE_NA_HOME);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(false);
});

test('barra inferior: um único botão, sem o botão de menu; o menu continua acessível pelo alto da tela', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.menu-btn--dock')).toHaveCount(0);
  await rolarAte(page, '#roll');
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(true);
  const cta = (await page.locator('[data-sticky-cta]').boundingBox())!;
  expect(cta.width, 'botão grande, de borda a borda no celular').toBeGreaterThan(340);
  const fixo = (await page.locator('.menu-btn--fixo').boundingBox())!;
  expect(fixo.y, 'selo do menu no alto').toBeLessThan(80);
  await expect.poll(() => visivel(page, '.menu-btn--fixo')).toBe(true);
});

test('seta do CTA fixo: quadrado com o mesmo respiro em cima, embaixo e à direita; seta centrada nele', async ({ page }) => {
  await page.goto('/');
  await rolarAte(page, '#roll');
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(true);
  await page.waitForTimeout(700);   // fim da entrada do botão
  const m = await page.locator('[data-sticky-cta]').evaluate((cta) => {
    const r = cta.getBoundingClientRect(); const b = parseFloat(getComputedStyle(cta).borderTopWidth);
    const q = cta.querySelector('.sticky-cta__seta')!.getBoundingClientRect();
    const svg = cta.querySelector('.sticky-cta__seta svg') as SVGSVGElement; const s = svg.getBoundingClientRect();
    const bb = (svg.querySelector('path') as SVGPathElement).getBBox();
    return { cima: q.top - r.top - b, baixo: r.bottom - b - q.bottom, dir: r.right - b - q.right, w: q.width, h: q.height,
      svgDx: s.left + s.width / 2 - (q.left + q.width / 2), svgDy: s.top + s.height / 2 - (q.top + q.height / 2),
      setaX: bb.x + bb.width / 2, setaY: bb.y + bb.height / 2 };
  });
  expect(m.w).toBe(40); expect(m.h).toBe(40);
  expect(Math.abs(m.cima - m.baixo), 'cima = baixo').toBeLessThanOrEqual(1);
  expect(Math.abs(m.dir - m.cima), 'direita = cima').toBeLessThanOrEqual(1);
  expect(Math.abs(m.svgDx)).toBeLessThan(0.5); expect(Math.abs(m.svgDy)).toBeLessThan(0.5);
  // no viewBox 24: vertical no centro exato; horizontal meia unidade à esquerda (compensação óptica do peso da ponta)
  expect(m.setaY).toBeCloseTo(12, 1);
  expect(m.setaX).toBeCloseTo(11.5, 1);
});

test('CTA oculto não recebe toque nem foco', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('[data-sticky-cta]');
  expect(await cta.getAttribute('tabindex')).toBe('-1');
  expect(await cta.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
});

test('menu: só logo, seções, “Reservar mesa” e fechar — sem endereço, horário, WhatsApp ou Instagrams', async ({ page }) => {
  await page.goto('/');
  await page.locator('.menu-btn--hero').click();
  const folha = page.locator('dialog#menu');
  await expect(folha).toBeVisible();
  await expect(folha.locator('.sheet__logo')).toBeVisible();
  // sem “Saladas & bowls” desde 2026-10-20; “Clube Âmbar” entre Ambientes e Visite só com o Clube na home (2026-10-27)
  const itens = ['Cardápio', 'Fornada', 'Café + Roll', 'Reações reais', 'Ambientes', ...(CLUBE_NA_HOME ? ['Clube Âmbar'] : []), 'Visite'];
  await expect(folha.locator('.sheet__nav a')).toHaveText(itens);
  // numeração sequencial 01 … 0N: todos os itens numa só lista, cada um com o contador do CSS
  await expect(folha.locator('ol.sheet__nav > li > a')).toHaveCount(itens.length);
  const numeros = await folha.locator('.sheet__nav a').evaluateAll((as) => as.map((a) => getComputedStyle(a, '::before').content));
  for (const n of numeros) expect(n).toContain('counter(nav');
  await expect(folha.locator('.btn.btn--wine')).toHaveText(/Reservar mesa/);
  await expect(folha.locator('[data-menu-close]')).toBeVisible();
  const texto = await folha.innerText();
  for (const t of ['Tavares', '07h', 'WhatsApp', '@ambarbrunch', '@roll.ofc']) expect(texto).not.toContain(t);
  await expect(folha.locator('a[href*="wa.me"], a[href*="instagram"]')).toHaveCount(0);
});

test('menu: abre pelo selo do hero, prende o foco, fecha com Esc e devolve o foco', async ({ page }) => {
  await page.goto('/');
  const abrir = page.locator('.menu-btn--hero');
  await abrir.click();
  const folha = page.locator('dialog#menu');
  await expect(folha).toBeVisible();
  await expect(abrir).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog#menu'))).toBe(true);
  expect(await visivel(page, '[data-sticky-cta]')).toBe(false);
  await page.keyboard.press('Escape');
  await expect(folha).toBeHidden();
  await expect(abrir).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.activeElement?.classList.contains('menu-btn--hero'))).toBe(true);
});

test.describe('entrada do menu sem salto', () => {
  test.use({ reducedMotion: 'no-preference' });
  for (const w of [360, 390, 430]) {
    for (const onde of ['topo', 'rolado'] as const) {
      test(`${w} px, ${onde}: a folha sobe direto ao lugar — sem passar do ponto, sem vão na base, página parada (3 aberturas)`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 800 });
        await page.goto('/');
        await page.waitForTimeout(2600);
        if (onde === 'rolado') { await rolarAte(page, '#quem-provou', 0); await expect.poll(() => visivel(page, '.menu-btn--fixo')).toBe(true); }
        const botao = page.locator(onde === 'topo' ? '.menu-btn--hero' : '.menu-btn--fixo');
        for (let vez = 0; vez < 3; vez++) {
          await page.waitForTimeout(600);   // o selo fixo termina de voltar
          // registra a folha a cada quadro da abertura
          await page.evaluate(() => {
            const s = document.querySelector<HTMLDialogElement>('dialog#menu')!; const y0 = scrollY; const t0 = performance.now();
            const w = window as unknown as { quadros: { vao: number; top: number; dy: number }[]; pronto: boolean; aberto: number }; w.quadros = []; w.pronto = false; w.aberto = 0;
            // amostra da 1ª pintura aberta até 700 ms depois (a entrada dura 420 ms)
            const f = (t: number) => { if (s.open) { if (!w.aberto) w.aberto = t; const r = s.getBoundingClientRect(); w.quadros.push({ vao: innerHeight - r.bottom, top: r.top, dy: scrollY - y0 }); } if ((w.aberto && t - w.aberto > 700) || t - t0 > 6000) w.pronto = true; else requestAnimationFrame(f); };
            requestAnimationFrame(f);
          });
          await botao.click();
          await expect.poll(() => page.evaluate(() => (window as unknown as { pronto: boolean }).pronto), { timeout: 7000 }).toBe(true);
          const q = await page.evaluate(() => (window as unknown as { quadros: { vao: number; top: number; dy: number }[] }).quadros);
          expect(q.length, 'quadros da abertura').toBeGreaterThan(5);
          const final = q.at(-1)!.top;
          expect(Math.max(...q.map((x) => x.vao)), 'vão na base').toBeLessThanOrEqual(0.5);
          expect(Math.min(...q.map((x) => x.top)), 'nunca acima do lugar final').toBeGreaterThanOrEqual(final - 0.5);
          for (let k = 1; k < q.length; k++) expect(q[k].top, 'só sobe').toBeLessThanOrEqual(q[k - 1].top + 0.5);
          expect(Math.max(...q.map((x) => Math.abs(x.dy))), 'página atrás parada').toBe(0);
          await page.keyboard.press('Escape');
          await expect(page.locator('dialog#menu')).toBeHidden();
          if (onde === 'rolado') await expect.poll(() => visivel(page, '.menu-btn--fixo')).toBe(true);
        }
      });
    }
  }
});

test.describe('saída animada do menu', () => {
  test.use({ reducedMotion: 'no-preference' });
  for (const [modo, fechar] of [
    ['X', (p: Page) => p.locator('[data-menu-close]').click()],
    ['Esc', (p: Page) => p.keyboard.press('Escape')],
    ['toque fora', (p: Page) => p.mouse.click(200, 20)],
  ] as const) {
    test(`fecha pelo ${modo}: continua montado durante a saída (250–400 ms) e só então fecha`, async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2600);   // fim da entrada do hero
      await page.locator('.menu-btn--hero').click();
      const folha = page.locator('dialog#menu');
      await expect(folha).toBeVisible();
      await page.waitForTimeout(600);
      await fechar(page);
      expect(await folha.evaluate((d) => (d as HTMLDialogElement).open && d.hasAttribute('data-fechando'))).toBe(true);
      expect(await folha.evaluate((d) => getComputedStyle(d).animationName)).toBe('sheet-out');
      // duração da saída: 250–400 ms (a mesma ordem de grandeza da entrada)
      const ms = await folha.evaluate((d) => parseFloat(getComputedStyle(d).animationDuration) * 1000);
      expect(ms).toBeGreaterThanOrEqual(250);
      expect(ms).toBeLessThanOrEqual(400);
      // o fundo segue travado durante a saída
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
      await expect(folha).toBeHidden();
      expect(await folha.evaluate((d) => d.hasAttribute('data-fechando'))).toBe(false);
    });
  }
});

test('menu: item leva à seção e fecha a folha; “Reservar mesa” chega à reserva sem o CTA piscar no caminho', async ({ page }) => {
  await page.goto('/');
  await page.locator('.menu-btn--hero').click();
  await page.locator('.sheet__nav a[href="#ambientes"]').click();
  await expect(page.locator('dialog#menu')).toBeHidden();
  await expect.poll(() => page.locator('#ambientes').evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(40);

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('.menu-btn--hero').click();
  await page.locator('.sheet__cta').click();
  let piscou = false;
  const fim = Date.now() + 2000;
  while (Date.now() < fim) { if (await visivel(page, '[data-sticky-cta]')) piscou = true; await page.waitForTimeout(50); }
  expect(piscou).toBe(false);
  await expect.poll(() => page.locator('#reservar').evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(40);
});

test('menu sem o Clube enquanto ele está oculto, na home e nas páginas internas; /#clube antigo abre a home normalmente', async ({ page }) => {
  test.skip(CLUBE_NA_HOME, 'build com o Clube na home');
  for (const url of ['/', '/privacidade/', '/reservar/']) {
    await page.goto(url);
    await expect(page.locator('#menu .sheet__nav a', { hasText: 'Clube' }), url).toHaveCount(0);
  }
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto('/#clube');
  await expect(page.locator('#novo')).toBeVisible();
  expect(erros).toEqual([]);
});

test('menu: “Clube Âmbar” fecha a folha e leva à seção do Clube; fora da home, volta à home já na seção', async ({ page }) => {
  test.skip(!CLUBE_NA_HOME, MOTIVO_CLUBE_OCULTO);
  await page.goto('/');
  await page.locator('.menu-btn--hero').click();
  await page.locator('.sheet__nav a', { hasText: 'Clube Âmbar' }).click();
  await expect(page.locator('dialog#menu')).toBeHidden();
  await expect.poll(() => page.locator('#clube').evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(40);
  await expect(page).not.toHaveURL(/#clube/);   // rolagem pelo script, sem deixar âncora na URL

  await page.goto('/privacidade/');
  await expect(page.locator('#menu .sheet__nav a', { hasText: 'Clube Âmbar' })).toHaveAttribute('href', '/#clube');
  await page.goto('/#clube');
  await expect.poll(() => page.locator('#clube').evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(40);
});

test('selo fixo do menu abre a mesma folha depois de rolar; com o menu aberto, CTA e selo somem', async ({ page }) => {
  await page.goto('/');
  await rolarAte(page, '#roll');
  await expect.poll(() => visivel(page, '.menu-btn--fixo')).toBe(true);
  await page.locator('.menu-btn--fixo').click();
  await expect(page.locator('dialog#menu')).toBeVisible();
  expect(await visivel(page, '[data-sticky-cta]')).toBe(false);
  expect(await visivel(page, '.menu-btn--fixo')).toBe(false);
  await page.locator('[data-menu-close]').click();
  await expect(page.locator('dialog#menu')).toBeHidden();
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(true);
});

test('ambientes: tocar no card escolhe o ambiente na comanda e rola até a reserva, sem reservar nada', async ({ page }) => {
  await page.goto('/');
  for (const [id, nome] of [['privativa', 'Sala privativa'], ['lounge', 'Lounge'], ['salao', 'Salão principal'], ['jardim', 'Jardim']]) {
    await rolarAte(page, '#ambientes', 200);
    const alvo = page.locator(`.climas__alvo[data-ambiente="${id}"]`);
    // a área clicável é o card inteiro (foto incluída)
    const fig = (await alvo.locator('xpath=..').boundingBox())!;
    const box = (await alvo.boundingBox())!;
    expect(box.width * box.height).toBeGreaterThanOrEqual(fig.width * fig.height * 0.95);
    await alvo.click();
    await expect.poll(() => page.locator('#reservar').evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(40);
    await expect(page.locator('#reservar .chip[aria-checked="true"]')).toHaveText(nome);
  }
  expect(await page.evaluate(() => location.hash)).toBe('');
  await expect(page.locator('#reservar')).not.toContainText(/reserva confirmada|mesa reservada/i);
});

test('ambientes: acessível pelo teclado', async ({ page }) => {
  await page.goto('/');
  const alvo = page.locator('.climas__alvo[data-ambiente="salao"]');
  await alvo.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#reservar .chip[aria-checked="true"]')).toHaveText('Salão principal');
});

test('pular para a reserva: primeiro elemento focável', async ({ page, browserName }) => {
  await page.goto('/');
  const link = page.locator('.skip-link');
  if (browserName === 'webkit') {
    // WebKit (como o Safari) não foca links com Tab por padrão, e o Option+Tab não é emulado aqui:
    // verificamos que o link é focável e aparece ao receber foco. Tab no Safari real: verificação manual.
    await link.focus();
  } else {
    await page.keyboard.press('Tab');
  }
  await expect(link).toBeFocused();
  expect((await link.boundingBox())!.width).toBeGreaterThan(100);
});

test('rodapé absorve a Visite (2026-10-23): endereço 1580 no Meireles, horário e o minimapa que leva ao Google Maps, sem botão de reserva', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section.visite')).toHaveCount(0);
  const rodape = page.locator('footer.footer');
  await expect(rodape).toHaveAttribute('id', 'visite');
  const maps = rodape.getByRole('link', { name: /como chegar/i });
  await expect(maps).toHaveCount(1);
  await expect(maps).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Rua%20Tavares%20Coutinho%2C%201580%2C%20Meireles%2C%20Fortaleza%2C%20CE');
  await expect(maps).toHaveAttribute('target', '_blank');
  expect((await maps.boundingBox())!.height, 'alvo de toque').toBeGreaterThanOrEqual(44);
  await expect(rodape).toContainText('Rua Tavares Coutinho, 1580');
  await expect(rodape).toContainText('Meireles, Fortaleza - CE');
  await expect(rodape).toContainText('07h às 19h');
  await expect(rodape.locator('iframe, .selo')).toHaveCount(0);
  // o minimapa desenhado é o link “Como chegar” (sem mapa embutido de terceiros)
  await expect(maps.locator('svg .mapa__pino')).toHaveCount(1);
  await expect(rodape.getByRole('link', { name: /reservar mesa/i })).toHaveCount(0);
  // o número antigo não aparece em nenhum ponto da página
  expect(await page.locator('body').innerText()).not.toMatch(/Coutinho,?\s*180\b/);
  // o item “Visite” do menu continua existindo e aponta para o rodapé
  await expect(page.locator('#menu a[href="#visite"]')).toHaveCount(1);
});

test('rodapé: logo, assinatura da Roll e os três contatos funcionais (WhatsApp, Instagram do Âmbar e da Roll), uma vez só', async ({ page }) => {
  await page.goto('/');
  const rodape = page.locator('footer.footer');
  await expect(rodape.locator('img[alt="Âmbar Café"]')).toBeVisible();
  await expect(rodape).toContainText('Âmbar Café');
  await expect(rodape).not.toContainText('Âmbar Brunch');
  await expect(rodape.locator('.footer__sig img[alt="Roll"]')).toBeVisible();
  const contatos = rodape.locator('nav[aria-label="Contatos"] a');
  await expect(contatos).toHaveCount(3);
  await expect(rodape.locator('a[href="https://wa.me/5585958550369"]')).toHaveAttribute('aria-label', 'WhatsApp (85) 95855-0369');
  await expect(rodape.locator('a[href="https://www.instagram.com/ambarbrunch/"]')).toHaveText('@ambarbrunch');
  await expect(rodape.locator('a[href="https://www.instagram.com/roll.ofc/"]')).toContainText('@roll.ofc');
  for (const a of await contatos.all()) {
    await expect(a).toHaveAttribute('target', '_blank');
    expect((await a.boundingBox())!.height, 'alvo de toque').toBeGreaterThanOrEqual(44);
  }
  // em toda a página, cada contato aparece uma vez (o menu não repete)
  for (const href of ['https://wa.me/5585958550369', 'https://www.instagram.com/ambarbrunch/', 'https://www.instagram.com/roll.ofc/']) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  // no fim da rolagem o botão fixo (quando aparece: só com o Clube na home) não cobre nada do rodapé
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(CLUBE_NA_HOME);
  if (!CLUBE_NA_HOME) return;
  await page.waitForTimeout(700);   // o botão termina de subir
  const cta = (await page.locator('[data-sticky-cta]').boundingBox())!;
  for (const peca of await rodape.locator('a, .footer__fine, .footer__texto').all()) {
    const b = (await peca.boundingBox())!;
    const cruza = b.x < cta.x + cta.width && cta.x < b.x + b.width && b.y < cta.y + cta.height && cta.y < b.y + b.height;
    expect(cruza, `botão fixo por cima de “${(await peca.innerText()).trim()}”`).toBe(false);
  }
});

for (const largura of [360, 390]) {
  test(`rodapé em ${largura} px: espaço do botão fixo só na home; nas páginas internas termina logo após os créditos`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    const vao = () => page.locator('footer.footer').evaluate((f) => f.getBoundingClientRect().bottom - f.querySelector('.footer__fine')!.getBoundingClientRect().bottom);
    // /clube tem só o fechamento mínimo (sem footer.footer) — coberto em clube.spec.ts
    for (const url of ['/reservar/', '/privacidade/']) {
      await page.goto(url);
      expect(await vao(), `${url}: respiro após os créditos`).toBeLessThanOrEqual(40);
    }
    await page.goto('/');
    expect(await vao(), 'home: guarda o espaço do botão fixo').toBeGreaterThanOrEqual(80);
  });

  test(`rodapé compacto em ${largura} px: endereço e horário à esquerda, minimapa à direita, contatos numa fileira com ícone`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await page.goto('/');
    const rodape = page.locator('footer.footer');
    await rodape.scrollIntoViewIfNeeded();
    const info = (await rodape.locator('.footer__info').boundingBox())!;
    const mapa = (await rodape.locator('.footer__mapa').boundingBox())!;
    expect(mapa.x, 'mapa à direita do texto').toBeGreaterThanOrEqual(info.x + info.width - 1);
    expect(mapa.width, 'mapa visível, não um ícone').toBeGreaterThan(100);
    const linhas = await rodape.locator('.footer__contatos a').evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().top)));
    expect(new Set(linhas).size, 'os três contatos na mesma linha').toBe(1);
    await expect(rodape.locator('.footer__contatos a svg')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'sem rolagem horizontal').toBeLessThanOrEqual(largura);
    // nenhum texto do rodapé estoura a própria caixa
    const estouro = await rodape.locator('.footer__texto, .footer__contatos a, .footer__sig').evaluateAll((es) => es.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
    expect(estouro).toBe(0);
  });
}
