// Clube Âmbar (2026-10-20) no build de revisão (:4321), modo padrão “indisponível” — sem a API do Clube:
// convite na home → /clube/ → ficha fechada; carteira sem dados. Nada pode parecer cadastro feito, saldo real ou envio.
import { test, expect, type Page } from '@playwright/test';

const externos = (page: Page) => {
  const lista: string[] = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (['blob:', 'data:'].includes(u.protocol)) return; if (!['127.0.0.1', 'localhost'].includes(u.hostname)) lista.push(r.url()); });
  return lista;
};

test('home: convite curto ao Clube logo depois da reserva, com “Quero fazer parte” → /clube/', async ({ page }) => {
  await page.goto('/');
  const ordem = await page.locator('main > section').evaluateAll((s) => s.map((e) => e.id));
  expect(ordem.indexOf('clube')).toBe(ordem.indexOf('reservar') + 1);
  const secao = page.locator('#clube');
  await expect(secao.getByRole('heading', { level: 2 })).toContainText('Clube');
  await expect(secao).not.toContainText(/\d+\s*pontos|desconto|R\$|grátis|%/i);
  const altura = await secao.evaluate((e) => e.getBoundingClientRect().height);
  expect(altura, 'seção compacta: não maior que a versão anterior (647 px em 390)').toBeLessThanOrEqual(650);
  // 2026-10-23 (refino): foto, título em duas linhas no mesmo eixo, frase curta, dois micro-benefícios e o botão
  await expect(secao.locator('img.clube-convite__foto')).toBeVisible();
  const linhas = await secao.locator('.mega > span').evaluateAll((ss) => ss.map((s) => Math.round(s.getBoundingClientRect().left)));
  expect(new Set(linhas).size, '“CLUBE” e “ÂMBAR” alinhados à esquerda').toBe(1);
  await expect(secao.locator('.clube-convite__frase')).toHaveText('Feito para quem volta sempre.');
  await expect(secao.locator('.clube-marcas li')).toHaveText(['vantagens especiais', 'mimos da casa']);
  const pilulas = await secao.locator('.clube-marcas li').evaluateAll((ls) => ls.map((l) => Math.round(l.getBoundingClientRect().top / 10)));
  expect(new Set(pilulas).size, 'as duas pílulas na mesma linha').toBe(1);
  await expect(secao.locator('.jornada, .carteira')).toHaveCount(0);
  // selo girando sobre a foto: decorativo, só com a marca (lido por leitor de tela? não)
  const selo = secao.locator('.clube-convite__selo');
  await expect(selo).toHaveAttribute('aria-hidden', 'true');
  await expect(selo).toContainText('clube âmbar');
  // a foto começa logo abaixo do botão (sem faixa vazia de parede entre os dois)
  const vao = await secao.evaluate((s) => s.querySelector('.clube-convite__palco')!.getBoundingClientRect().top - s.querySelector('.clube-convite__cta')!.getBoundingClientRect().bottom);
  expect(vao, 'foto encostada no botão').toBeLessThan(0);
  await expect(secao).not.toContainText(/prévia|passaporte|navegador|aplicativo|cadastro|telefone/i);
  const cta = secao.getByRole('link', { name: /Quero fazer parte/ });
  await expect(cta).toHaveClass(/btn--wine/);
  await cta.click();
  await expect(page).toHaveURL(/\/clube\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Clube');
});

test('/clube: ficha fechada sem a API — campos desligados, nada enviado nem guardado', async ({ page }) => {
  const fora = externos(page);
  await page.goto('/clube/');
  await page.locator('#cadastro').scrollIntoViewIfNeeded();
  const ficha = page.locator('#cadastro .ficha');
  await expect(ficha.locator('.ticket__stamp')).toHaveText('em breve');
  await expect(ficha.getByRole('button', { name: 'Inscrições em breve' })).toBeDisabled();
  await expect(ficha.locator('#cf-nome')).toBeDisabled();
  await expect(ficha.locator('#cf-telefone')).toBeDisabled();
  await expect(ficha).toContainText('ainda não estão abertas. Nada é enviado.');
  // só nome e telefone; aceite do regulamento e novidades em caixas separadas, novidades desmarcada e opcional
  await expect(ficha.locator('input:not([type="checkbox"])')).toHaveCount(2);
  await expect(ficha.locator('#cf-aceite')).not.toBeChecked();
  await expect(ficha.locator('#cf-marketing')).not.toBeChecked();
  await expect(ficha.locator('legend', { hasText: 'novidades' })).toContainText('opcional');
  await expect(ficha).toContainText('Separado do Clube');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(fora, 'requisições para fora do site').toEqual([]);
});

test('/clube: regras decididas à vista e nada de pontuação ou recompensa inventada', async ({ page }) => {
  await page.goto('/clube/');
  const corpo = page.locator('main');
  await expect(corpo).toContainText('não precisa baixar aplicativo');
  await expect(corpo).toContainText('não soma pontos');
  await expect(page.locator('.clube-definicao')).toContainText('Em definição');
  await expect(corpo).not.toContainText(/\d+\s*pontos|R\$|% de desconto|ganhe/i);
  // 2026-10-22: o topo mostra o Passaporte Âmbar — prévia conceitual, sem cartão, sem cliente simulado e sem número
  const passaporte = page.locator('.clube-topo .jornada');
  await expect(passaporte).toContainText('prévia');
  await expect(passaporte.locator('.marco')).toHaveCount(5);
  await expect(passaporte.locator('.marco--definicao')).toHaveCount(2);
  await expect(passaporte).not.toContainText(/\d/);
  await expect(page.locator('.clube-topo .carteira')).toHaveCount(0);
});

test('/clube: NFC e QR da mesa — atribuição validada na URL, cumprimento, e só a origem (nada pessoal) na sessão', async ({ page }) => {
  await page.goto('/clube/?canal=nfc&mesa=12&utm_source=mesa');
  await expect(page.locator('[data-chegada]')).toHaveText('bem-vindo à mesa 12');
  await page.locator('#cadastro').scrollIntoViewIfNeeded();
  await expect(page.locator('.ficha__origem')).toHaveText('inscrição pela mesa 12');
  const origem = await page.evaluate(() => sessionStorage.getItem('ambar:clube:origem'));
  expect(JSON.parse(origem ?? '{}')).toEqual({ canal: 'nfc', mesa: '12', utm: { source: 'mesa' } });
  // lixo na URL não passa pela lista fechada
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/clube/?canal=<script>&mesa=../../x');
  await expect(page.locator('[data-chegada]')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('ambar:clube:origem'))).toBeNull();
});

test('/clube/membro: acesso desligado e prévia da carteira sem nenhum número', async ({ page }) => {
  const fora = externos(page);
  await page.goto('/clube/membro/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('carteira');
  await expect(page.getByRole('button', { name: 'Acesso em breve' })).toBeDisabled();
  await expect(page.locator('#cm-telefone')).toBeDisabled();
  await expect(page.locator('.carteira-area--previa')).toContainText('assim fica a sua carteira');
  await expect(page.locator('.carteira__saldo dd')).toHaveText('—');
  await expect(page.locator('.carteira-area--previa')).not.toContainText(/\d/);
  expect(fora).toEqual([]);
});

test('reserva continua acessível a partir das páginas do Clube', async ({ page }) => {
  await page.goto('/clube/');
  await page.getByRole('link', { name: /voltar ao início/ }).click();
  await expect(page.locator('#reservar .ticket')).toBeVisible();
});
