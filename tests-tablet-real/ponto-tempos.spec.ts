// Tempo do ponto no tablet (18/11/2026), medido de fora — o mesmo teste roda no build de ANTES e no de DEPOIS da
// otimização. Backend REAL local (motor falso: aprova a funcionária cadastrada; prévia em rodízio de poses), câmera falsa
// do Chromium, tablet Android emulado e CPU 4× mais lenta. Um MutationObserver anota quando cada texto aparece na tela.
// Cada rodada: toque em "Registrar ponto" → tela "Confira" → "Não sou eu" (nada é gravado, a próxima rodada é igual).
// Saída: mediana e p95 de toque→"Rosto encontrado", "Rosto encontrado"→resultado e toque→resultado.
import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect, devices, type Page } from '@playwright/test';
import { ruidoDeSensor } from './ruido';

const SEGREDOS = JSON.parse(readFileSync(process.env.TABLET_REAL_SEGREDOS!, 'utf-8')) as { senha: string };
const RODADAS = Number(process.env.PONTO_RODADAS ?? 15);
const CPU = Number(process.env.PONTO_CPU ?? 4);
const ROTULO = process.env.PONTO_ROTULO ?? 'medida';

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
};

test('tempo do ponto: toque → rosto encontrado → resultado', async ({ browser }) => {
  test.setTimeout(RODADAS * 30_000 + 60_000);
  const ctx = await browser.newContext({ ...devices['Galaxy Tab S4'], baseURL: 'http://127.0.0.1:4497' });
  await ctx.addInitScript(ruidoDeSensor);
  await ctx.addInitScript(() => {
    const w = window as unknown as { __marcos: Record<string, number> };
    w.__marcos = {};
    const textos: [string, string][] = [['rosto', 'Rosto encontrado'], ['enviando', 'Registrando ponto'], ['enviando', 'Conferindo'],
      ['confira', 'Confira'], ['ja', 'Ponto já registrado']];
    new MutationObserver(() => {
      const corpo = document.body?.textContent ?? '';
      for (const [chave, texto] of textos) if (!(chave in w.__marcos) && corpo.includes(texto)) w.__marcos[chave] = performance.now();
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const page: Page = await ctx.newPage();
  await page.goto('/admin/login?volta=%2Fadmin%2Foperacao');
  await page.getByLabel('E-mail').fill('tablet@tablet.local');
  await page.getByRole('textbox', { name: 'Senha' }).fill(SEGREDOS.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/admin\/operacao/);
  await page.goto('/admin/operacao?secao=ponto');
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

  const ate = { rosto: [] as number[], resultado: [] as number[], rostoAoResultado: [] as number[], enviando: [] as number[] };
  for (let i = 0; i < RODADAS; i++) {
    await page.getByRole('button', { name: 'Registrar ponto' }).waitFor();
    await page.evaluate(() => { (window as unknown as { __marcos: Record<string, number> }).__marcos = {}; });
    const toque = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: 'Registrar ponto' }).click();
    const confira = page.getByRole('dialog', { name: 'Confirmar ponto' });
    const aviso = page.locator('.op-terminal__cartao[role="alert"]');
    await expect(confira.or(aviso)).toBeVisible({ timeout: 40_000 });
    if (await aviso.isVisible()) throw new Error(`rodada ${i + 1}: ${await aviso.innerText()}`);
    const m = await page.evaluate(() => (window as unknown as { __marcos: Record<string, number> }).__marcos);
    ate.resultado.push(m.confira - toque);
    if (m.rosto) {
      ate.rosto.push(m.rosto - toque);
      ate.rostoAoResultado.push(m.confira - m.rosto);
    }
    if (m.enviando) ate.enviando.push(m.enviando - (m.rosto ?? toque));
    await confira.getByRole('button', { name: 'Não sou eu' }).click();
  }
  const linha = (nome: string, xs: number[]) => `${nome.padEnd(34)} n=${String(xs.length).padStart(2)}  mediana ${Math.round(pct(xs, 0.5))} ms  p95 ${Math.round(pct(xs, 0.95))} ms`;
  const relatorio = [
    `== ${ROTULO} (CPU ${CPU}×, ${RODADAS} rodadas)`,
    linha('toque → "Rosto encontrado"', ate.rosto),
    linha('"Rosto encontrado" → tela Confira', ate.rostoAoResultado),
    linha('"Rosto encontrado" → aviso de envio', ate.enviando),
    linha('toque → tela Confira', ate.resultado),
  ].join('\n');
  console.log(relatorio);
  if (process.env.PONTO_SAIDA) writeFileSync(process.env.PONTO_SAIDA, JSON.stringify({ rotulo: ROTULO, cpu: CPU, ...ate }));
  await ctx.close();
});
