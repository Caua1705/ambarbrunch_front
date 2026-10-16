// Capturas de ESTADOS de interface (390×844): doca ao rolar, menu aberto, reserva indisponível e simulada.
//   node scripts/shots-estados.mjs [--out reports/estados]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const OUT = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'reports/estados');
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
try {
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' });
  await p.locator('#gastronomia .board').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/1-rolando-doca.png` });
  await p.locator('.menu-btn--dock').click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/2-menu-aberto.png` });
  await p.keyboard.press('Escape');
  await p.locator('#reservar .ticket').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.locator('.chips--dates .chip[role="radio"]').first().waitFor();
  await p.evaluate(() => scrollBy(0, -60));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/3-reserva-indisponivel.png` });

  const s = await ctx.newPage();
  await s.goto('http://127.0.0.1:4322/', { waitUntil: 'networkidle' });
  await s.locator('#reservar .ticket').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await s.locator('.chips--dates .chip[role="radio"]').first().waitFor();
  const datas = s.locator('[aria-labelledby="rf-l3"] [role="radio"]');
  for (let i = 1; i < 4; i++) { await datas.nth(i).click(); await s.locator('.ticket__slots:has-text("Carregando")').waitFor({ state: 'detached' }); if (await s.locator('[aria-labelledby="rf-l4"] [role="radio"]:not([disabled])').count()) break; }
  await s.locator('[aria-labelledby="rf-l4"] [role="radio"]:not([disabled])').nth(1).click();
  await s.locator('#reservar .ticket').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await s.evaluate(() => scrollBy(0, 330));
  await s.waitForTimeout(300);
  await s.screenshot({ path: `${OUT}/4-simulado-horarios.png` });
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.waitForTimeout(300);
  await s.locator('#rf-nome').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await s.screenshot({ path: `${OUT}/5-simulado-validacao.png` });
  await s.locator('#rf-nome').fill('Cliente de Teste');
  await s.locator('#rf-telefone').fill('85999990000');
  await s.locator('#rf-consentimento').click();
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByRole('button', { name: 'Confirmar reserva' }).click();
  await s.locator('.ticket__code').waitFor();
  await s.locator('#reservar .ticket').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await s.evaluate(() => scrollBy(0, -40));
  await s.waitForTimeout(300);
  await s.screenshot({ path: `${OUT}/6-simulado-confirmacao.png` });
  console.log('ok', OUT);
} finally { await b.close(); }
