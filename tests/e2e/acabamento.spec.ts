// Ajustes finais de 2026-10-18: fio da abertura da fornada desenhado com a rolagem até o fim, cartões do cardápio fechando
// com animação (sem salto). (A ficha nutricional saiu com a seção Saladas & bowls; o subtítulo da Visite, com a seção,
// em 2026-10-23.)
import { test, expect, type Page, type Locator } from '@playwright/test';

type Amostra = { t: number; h: number };
/** Clica no botão DENTRO da página (sem a espera de estabilidade do Playwright, que atrasaria o clique) e amostra a altura
 *  do alvo a cada quadro, com o tempo de cada amostra (o WebKit sem janela não entrega quadros a intervalos regulares). */
const medirDurante = async (page: Page, alvo: Locator, clicar: Locator, ms = 900) => {
  await clicar.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);   // revelações da seção assentam
  const botao = await clicar.elementHandle();
  return alvo.evaluate((el, { botao, ms }) => new Promise<{ t: number; h: number }[]>((ok) => {
    const out: { t: number; h: number }[] = [];
    const t0 = performance.now();
    const f = () => { const t = performance.now() - t0; out.push({ t, h: el.getBoundingClientRect().height }); if (t < ms) requestAnimationFrame(f); else ok(out); };
    (botao as HTMLElement).click();
    requestAnimationFrame(f);
  }), { botao, ms });
};

/** a mudança de altura foi uma animação: levou tempo de verdade (da última amostra ainda no início à primeira já no
 *  destino, ≥ `minMs`), nenhum quadro seguido (< 60 ms) saltou metade do caminho e terminou no destino. Um sumiço abrupto
 *  (altura cheia → 0 de um quadro para o outro) falha nas duas contas. */
const continua = (as: Amostra[], de: number, para: number, minMs = 150) => {
  const total = Math.abs(para - de);
  const txt = as.map((a) => `${a.t.toFixed(0)}:${a.h.toFixed(0)}`).join(' ');
  const k = as.findIndex((a) => Math.abs(a.h - para) < total * 0.05);
  expect(k, `chegou ao destino (${txt})`).toBeGreaterThan(0);
  const parado = as.slice(0, k).findLast((a) => Math.abs(a.h - de) <= total * 0.05) ?? as[0];
  expect(as[k].t - parado.t, `duração do movimento (${txt})`).toBeGreaterThanOrEqual(minMs);
  for (let j = 1; j < as.length; j++) {
    if (as[j].t - as[j - 1].t < 60) expect(Math.abs(as[j].h - as[j - 1].h), `salto em ${as[j].t.toFixed(0)} ms (${txt})`).toBeLessThan(total * 0.5);
  }
  expect(Math.abs(as.at(-1)!.h - para), `terminou no destino (${txt})`).toBeLessThan(total * 0.02 + 1);
};

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

  for (const [grupo, categoria] of [['comer', 'sanduiches'], ['beber', 'gelados']] as const) {
    test(`cardápio (${grupo}): o cartão fecha com animação — a altura encolhe aos poucos, sem salto, e só então some`, async ({ page }) => {
      await page.goto('/');
      const tap = page.locator(`[data-categoria="${categoria}"]`);
      const painel = page.locator(`#painel-${grupo}`);
      await tap.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await tap.click();
      await expect(painel).toBeVisible();
      await page.waitForTimeout(700);
      const cheio = (await painel.boundingBox())!.height;
      expect(cheio).toBeGreaterThan(150);
      // fecha tocando de novo na etiqueta
      const alturas = await medirDurante(page, painel, tap);
      continua(alturas, cheio, 0);
      await expect(painel).toBeHidden();
      await expect(tap).toHaveAttribute('aria-expanded', 'false');
      // pelo × (e o foco volta para a etiqueta)
      await tap.click();
      await page.waitForTimeout(700);
      const fechar = painel.locator(`[data-cat="${categoria}"] [data-fechar]`);
      continua(await medirDurante(page, painel, fechar), cheio, 0);
      await expect(painel).toBeHidden();
      await expect(tap).toBeFocused();
      // reabrir no meio da saída: o cartão volta inteiro, aberto
      await tap.click();
      await page.waitForTimeout(700);
      await tap.click();
      await page.waitForTimeout(120);
      await tap.click();
      await page.waitForTimeout(700);
      await expect(painel).toBeVisible();
      await expect(painel).not.toHaveAttribute('data-fechando', '');
      expect(Math.abs((await painel.boundingBox())!.height - cheio)).toBeLessThan(2);
    });
  }
});

test('movimento reduzido: o cartão do cardápio abre e fecha direto; o fio fica inteiro', async ({ page }) => {
  await page.goto('/');
  const tap = page.locator('[data-categoria="sanduiches"]');
  await tap.scrollIntoViewIfNeeded();
  await tap.click();
  await expect(page.locator('#painel-comer')).toBeVisible();
  await tap.click();
  await expect(page.locator('#painel-comer')).toBeHidden();
  const fio = page.locator('.abertura__fio path');
  if (await fio.count()) expect(await fio.evaluate((p) => parseFloat(getComputedStyle(p).strokeDashoffset))).toBe(0);
});
