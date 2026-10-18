// Menu, CTA fixo e navegação (regras da rodada final): um único botão fixo “Reservar mesa”, pela posição das seções;
// selo do menu fixo no alto; folha do menu com entrada e saída animadas, sem contatos.
import { test, expect, type Page } from '@playwright/test';

const visivel = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.classList.contains('is-visible') && el.getAttribute('aria-hidden') === 'false');
const rolarAte = (page: Page, sel: string, dy = 60) => page.locator(sel).first().evaluate((el, d) => scrollTo({ top: el.getBoundingClientRect().top + scrollY + d, behavior: 'instant' }), dy);

test('CTA fixo: escondido no hero, em Novo capítulo e Para sua mesa; aparece em Direto da fornada; some na reserva e no rodapé', async ({ page }) => {
  await page.goto('/');
  for (const [sel, esperado] of [['#novo', false], ['#gastronomia', false], ['#roll', true], ['#cafe-roll', true], ['#saladas', true], ['#quem-provou', true], ['#ambientes', true], ['#reservar', false], ['#visite', true]] as const) {
    await rolarAte(page, sel);
    await expect.poll(() => visivel(page, '[data-sticky-cta]'), { message: sel }).toBe(esperado);
  }
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(false);
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
  await expect(folha.locator('.sheet__nav a')).toHaveCount(7);
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

test('Visite: endereço, horário e “Como chegar”, sem os botões de contato — eles ficam só no rodapé', async ({ page }) => {
  await page.goto('/');
  const maps = page.locator('#visite a', { hasText: /como chegar/i });
  await expect(maps).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Rua%20Tavares%20Coutinho%2C%20180%2C%20Fortaleza%2C%20CE');
  await expect(maps).toHaveAttribute('target', '_blank');
  await expect(page.locator('#visite')).toContainText('Rua Tavares Coutinho, 180');
  await expect(page.locator('#visite')).toContainText('07h às 19h');
  await expect(page.locator('#visite iframe')).toHaveCount(0);
  await expect(page.locator('#visite a[href*="wa.me"], #visite a[href*="instagram.com"]')).toHaveCount(0);
});

test('rodapé: logo, assinatura da Roll e os três contatos funcionais (WhatsApp, Instagram do Âmbar e da Roll), uma vez só', async ({ page }) => {
  await page.goto('/');
  const rodape = page.locator('footer.footer');
  await expect(rodape.locator('img[alt="Âmbar Brunch"]')).toBeVisible();
  await expect(rodape.locator('.footer__sig img[alt="Roll"]')).toBeVisible();
  const contatos = rodape.locator('nav[aria-label="Contatos"] a');
  await expect(contatos).toHaveCount(3);
  await expect(rodape.locator('a[href="https://wa.me/5585994452724"]')).toContainText('(85) 99445-2724');
  await expect(rodape.locator('a[href="https://www.instagram.com/ambarbrunch/"]')).toHaveText('@ambarbrunch');
  await expect(rodape.locator('a[href="https://www.instagram.com/roll.ofc/"]')).toContainText('@roll.ofc');
  for (const a of await contatos.all()) {
    await expect(a).toHaveAttribute('target', '_blank');
    expect((await a.boundingBox())!.height, 'alvo de toque').toBeGreaterThanOrEqual(44);
  }
  // em toda a página, cada contato aparece uma vez (o menu e a Visite não repetem)
  for (const href of ['https://wa.me/5585994452724', 'https://www.instagram.com/ambarbrunch/', 'https://www.instagram.com/roll.ofc/']) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  // o botão fixo some antes de cobrir os contatos
  await rodape.locator('nav[aria-label="Contatos"]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect.poll(() => visivel(page, '[data-sticky-cta]')).toBe(false);
});
