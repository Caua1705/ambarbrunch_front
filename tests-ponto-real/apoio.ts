// Apoio dos testes reais de Equipe e Ponto (playwright.ponto-real.config.ts). Senhas e contas vêm do JSON da homologação local,
// fora do repositório.
import fs from 'node:fs';
import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

export const PAINEL = 'http://127.0.0.1:4495';
export const API = process.env.PONTO_REAL_API ?? 'http://127.0.0.1:8765';

const caminho = process.env.PONTO_REAL_CENARIOS;
if (!caminho) throw new Error('Defina PONTO_REAL_CENARIOS.');
export const SEED: { senha: string; contas: Record<'dono' | 'gerente' | 'atendente', string> } = JSON.parse(fs.readFileSync(caminho, 'utf8'));

/**
 * O vídeo da câmera falsa recomeça igual a cada abertura, e o backend recusa quadro repetido (`captura_repetida`), como deve.
 * Um sensor real nunca repete: este ruído num canto do quadro faz esse papel. Só nos testes, nunca no código da tela.
 */
export async function ruidoDeSensor(alvo: BrowserContext | Page) {
  await alvo.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      (original as (...a: unknown[]) => void).apply(this, args);
      if (this.canvas.width === 480) {
        this.fillStyle = `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`;
        this.fillRect(0, 0, 3, 3);
      }
    } as typeof CanvasRenderingContext2D.prototype.drawImage;
  });
}

export async function entrar(page: Page, conta: keyof typeof SEED.contas) {
  const r = await page.request.post(`${PAINEL}/admin/api/sessao`, {
    headers: { 'X-Painel': '1', 'Content-Type': 'application/json', Origin: PAINEL },
    data: { email: SEED.contas[conta], senha: SEED.senha },
  });
  if (!r.ok()) throw new Error(`login ${conta} falhou: ${r.status()}`);
}

/** Token do painel direto na API local: só para preparar um cenário que não é o assunto do teste. */
export async function tokenPainel(req: APIRequestContext, conta: keyof typeof SEED.contas): Promise<string> {
  const r = await req.post(`${API}/admin/auth/login`, { data: { email: SEED.contas[conta], senha: SEED.senha } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).token as string;
}

export async function novoTablet(req: APIRequestContext, nome: string): Promise<{ id: string; token: string }> {
  const token = await tokenPainel(req, 'dono');
  const r = await req.post(`${API}/admin/ponto/dispositivos`, { headers: { Authorization: `Bearer ${token}` }, data: { nome } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

/** Autoriza o aparelho pela tela de /ponto, colando o código uma vez. */
export async function parearPorCodigo(page: Page, token: string) {
  await page.goto('/ponto/');
  await page.getByLabel('Código do tablet').fill(token);
  await page.getByRole('button', { name: 'Autorizar tablet' }).click();
  await expect(page.getByRole('button', { name: 'REGISTRAR PONTO' })).toBeVisible();
}

export const botaoPonto = (page: Page) => page.getByRole('button', { name: 'REGISTRAR PONTO' });

/** Uma batida inteira pelo tablet. Quando a escala não desempata, a tela pergunta. */
export async function baterPonto(page: Page, opcao?: string) {
  await botaoPonto(page).click();
  const fim = page.locator('.ponto__recibo, .ponto__cartao, .ponto__opcoes');
  await expect(fim).toBeVisible({ timeout: 40_000 });
  if (await page.locator('.ponto__opcoes').isVisible()) {
    await page.getByRole('button', { name: opcao ?? /.+/ }).first().click();
    await expect(page.locator('.ponto__recibo, .ponto__cartao')).toBeVisible({ timeout: 20_000 });
  }
}

/** Bate e devolve o `resultado` que o motor real deu: a tela não pode esconder o que aconteceu. */
export async function baterEVerResultado(page: Page) {
  const resposta = page.waitForResponse((r) => r.url().endsWith('/captura') && r.request().method() === 'POST', { timeout: 40_000 });
  await botaoPonto(page).click();
  return (await (await resposta).json()) as { resultado: string; motivo?: string; mensagem: string };
}

export async function semRolagemHorizontal(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

export const hojeFortaleza = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
export const diasAtras = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date(Date.now() - n * 86_400_000));
export const ontemFortaleza = () => diasAtras(1);
