// Clube Âmbar no build de revisão (:4321), modo padrão “indisponível” (pré-lançamento) — sem a API do Clube:
// convite na home (“Conheça o Clube”) → /clube/ → apresentação + bilhete “em breve”, sem campos; carteira sem dados.
// Nada pode parecer cadastro feito, saldo real ou envio.
// 2026-10-23 (versão final): /clube é uma página curta — apresentação (título, frase, duas polaroides) e a comanda logo
// abaixo; fecha com o rodapé mínimo. O fluxo com a API (botão “Quero fazer parte”, ficha → código → bem-vindo,
// duplicado, erros, inscrições fechadas na API) depende da API real: foi conferido contra respostas interceptadas num
// build em modo api, fora desta suíte.
import { test, expect, type Page } from '@playwright/test';
import { CLUBE_NA_HOME, MOTIVO_CLUBE_OCULTO } from '../clube-home';

const externos = (page: Page) => {
  const lista: string[] = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (['blob:', 'data:'].includes(u.protocol)) return; if (!['127.0.0.1', 'localhost'].includes(u.hostname)) lista.push(r.url()); });
  return lista;
};

test('home com o Clube oculto (pré-lançamento): sem convite, sem item no menu e sem link para o Clube; /clube/ continua no ar', async ({ page }) => {
  test.skip(CLUBE_NA_HOME, 'build com o Clube na home');
  await page.goto('/');
  await expect(page.locator('#clube, .clube-convite')).toHaveCount(0);
  const ids = await page.locator('main > section').evaluateAll((s) => s.map((e) => e.id));
  expect(ids.at(-1), 'a reserva fecha a home').toBe('reservar');
  await expect(page.locator('a[href^="/clube"], a[href*="#clube"]')).toHaveCount(0);
  await expect(page.locator('#menu .sheet__nav a', { hasText: 'Clube' })).toHaveCount(0);
  // a página do Clube não foi apagada: segue acessível pelo endereço direto, em pré-lançamento
  await page.goto('/clube/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Clube Âmbar');
});

test('home: convite curto ao Clube logo depois da reserva; em pré-lançamento, “Conheça o Clube” → /clube/', async ({ page }) => {
  test.skip(!CLUBE_NA_HOME, MOTIVO_CLUBE_OCULTO);
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
  // selo girando sobre a foto: decorativo, só com a marca
  const selo = secao.locator('.clube-convite__selo');
  await expect(selo).toHaveAttribute('aria-hidden', 'true');
  await expect(selo).toContainText('clube âmbar');
  // a foto começa logo abaixo do botão (sem faixa vazia de parede entre os dois)
  const vao = await secao.evaluate((s) => s.querySelector('.clube-convite__palco')!.getBoundingClientRect().top - s.querySelector('.clube-convite__cta')!.getBoundingClientRect().bottom);
  expect(vao, 'foto encostada no botão').toBeLessThan(0);
  await expect(secao).not.toContainText(/prévia|passaporte|navegador|aplicativo|cadastro|telefone/i);
  // pré-lançamento: o botão convida a conhecer (não a “fazer parte” de algo que ainda não abre)
  await expect(secao.getByRole('link', { name: /Quero fazer parte/ })).toHaveCount(0);
  await expect(secao.locator('a[href^="/clube/conta"]')).toHaveCount(0);   // atalho da conta só com o Clube aberto
  const cta = secao.getByRole('link', { name: /Conheça o Clube/ });
  await expect(cta).toHaveClass(/btn--wine/);
  await expect(cta).toHaveAttribute('href', '/clube/');
  await cta.click();
  await expect(page).toHaveURL(/\/clube\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Clube Âmbar');
});

test('/clube (pré-lançamento): apresentação curta e o bilhete “em breve” — nenhum campo, nada pedido nem enviado', async ({ page }) => {
  const fora = externos(page);
  await page.goto('/clube/');
  await expect(page.locator('main > section')).toHaveCount(1);
  // apresentação: título, frase, uma linha e duas polaroides com foto de verdade e título discreto
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Clube Âmbar/i);
  await expect(page.locator('.clube-pag__frase')).toHaveText('Quem volta sempre merece ser reconhecido.');
  const fotos = page.locator('.clube-pag__destaques figure.cut--polaroid');
  await expect(fotos).toHaveCount(2);
  await expect(fotos.locator('figcaption')).toHaveText(['Vantagens especiais', 'Mimos da casa']);
  for (const img of await fotos.locator('img').all()) {
    await expect(img).toBeVisible();
    expect(await img.getAttribute('alt'), 'foto com texto alternativo').toBeTruthy();
  }
  // como vai funcionar: três passos curtos, só o caminho — nenhum número de pontos, recompensa ou nível
  const passos = page.locator('ol.clube-pag__passos > li');
  await expect(passos).toHaveText([/Faça parte pelo WhatsApp/, /Identifique-se nas compras/, /Acompanhe suas vantagens pelo site/]);
  await expect(page.locator('ol.clube-pag__passos')).not.toContainText(/ponto|R\$|recompensa|saldo|nível/i);
  // a foto do convite da home não se repete aqui
  await expect(page.locator('img.clube-convite__foto')).toHaveCount(0);
  // bilhete “em breve”: sem nenhum campo nem botão de envio; volta ao início
  const ficha = page.locator('#cadastro .ficha');
  await expect(ficha).toHaveAttribute('data-etapa', 'fechado');
  await expect(ficha.locator('.ticket__title')).toHaveText(/Inscrições em breve/i);
  await expect(ficha.locator('.ticket__stamp')).toHaveText('em breve');
  await expect(ficha.locator('input, select, textarea, button[type="submit"]')).toHaveCount(0);
  await expect(ficha.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  await expect(ficha).toContainText('Nenhum dado é pedido antes da abertura.');
  // sem a API, a carteira não funciona: nenhum atalho para ela
  await expect(page.locator('a[href="/clube/membro/"]')).toHaveCount(0);
  // nada de passaporte, cartão físico, NFC, plaquinha, aplicativo, pontos, desconto, brinde ou nível
  await expect(page.locator('.jornada, .passos, .plaquinha, .carteira, .clube-regras')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/passaporte|nfc|plaquinha|aplicativo|navegador|pontos|R\$|desconto|ganhe|brinde|grátis|nível|ranking/i);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(fora, 'requisições para fora do site').toEqual([]);
});

for (const largura of [360, 390, 1280]) {
  test(`/clube em ${largura} px: página curta, sem rolagem horizontal, e o rodapé mínimo fechando na base`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura < 600 ? 740 : 800 });
    await page.goto('/clube/');
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(total, 'cerca de uma tela e meia, no máximo').toBeLessThan(largura < 600 ? 1150 : 1000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'sem rolagem horizontal').toBeLessThanOrEqual(largura);
    // sem o rodapé completo (marca, endereço, mapa, contatos): só a linha mínima, com o link da privacidade
    await expect(page.locator('footer.footer, .footer__mapa, .footer__contatos')).toHaveCount(0);
    const rodape = page.locator('footer.rodape-min');
    await expect(rodape).toHaveText(/Âmbar Café\s*·\s*Política de Privacidade\s*·\s*©\s*\d{4}/);
    await expect(rodape.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade/');
    // termina na base: nada depois do rodapé, sem vão artificial
    const base = await rodape.evaluate((f) => Math.round(f.getBoundingClientRect().bottom + scrollY));
    expect(Math.abs(base - total)).toBeLessThanOrEqual(1);
    // retorno ao início no topo
    await expect(page.locator('.page-bar a.page-back')).toHaveAttribute('href', '/');
  });
}

test('/clube: NFC e QR da mesa — atribuição validada na URL, cumprimento, e só a origem (nada pessoal) na sessão', async ({ page }) => {
  await page.goto('/clube/?canal=nfc&mesa=12&utm_source=mesa');
  await expect(page.locator('[data-chegada]')).toHaveText('bem-vindo à mesa 12');
  const origem = await page.evaluate(() => sessionStorage.getItem('ambar:clube:origem'));
  expect(JSON.parse(origem ?? '{}')).toEqual({ canal: 'nfc', mesa: '12', utm: { source: 'mesa' } });
  // lixo na URL não passa pela lista fechada
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/clube/?canal=<script>&mesa=../../x');
  await expect(page.locator('[data-chegada]')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('ambar:clube:origem'))).toBeNull();
});

test('/clube/ativar (pré-lançamento): o link do convite também só mostra “em breve” — e tira o token da URL', async ({ page }) => {
  await page.goto('/clube/ativar?c=token-de-teste');
  expect(page.url()).not.toContain('token-de-teste');
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  const ficha = page.locator('#cadastro .ficha');
  await expect(ficha.locator('.ticket__title')).toHaveText(/Inscrições em breve/i);
  await expect(ficha.locator('input, button')).toHaveCount(0);
});

test('telas do Clube no pré-lançamento: entrar, cadastro, conta, histórico e recompensas dizem “em breve”, sem campo nem chamada', async ({ page }) => {
  const fora = externos(page);
  for (const rota of ['/clube/entrar/', '/clube/cadastro/']) {
    await page.goto(rota);
    await expect(page.locator('#cadastro .ficha .ticket__title')).toHaveText(/Inscrições em breve/i);
    await expect(page.locator('#cadastro .ficha').getByRole('link', { name: 'Conhecer o Clube' })).toHaveAttribute('href', '/clube/');
    await expect(page.locator('input, button[type="submit"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
  for (const rota of ['/clube/conta/', '/clube/historico/', '/clube/recompensas/']) {
    await page.goto(rota);
    await expect(page.locator('[data-estado="fechado"]')).toContainText('O Clube Âmbar abre em breve');
    await expect(page.locator('.carteira, .conta, input')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /resgatar/i })).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/[0-9]+ *pontos/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
  expect(fora).toEqual([]);
  // a landing não mostra “Minha conta” enquanto o Clube não abre
  await page.goto('/clube/');
  await expect(page.locator('.page-bar').getByRole('link', { name: 'Minha conta' })).toHaveCount(0);
});

test('a prévia local e a simulação não existem no build publicado; a carteira antiga redireciona para a conta', async ({ page, request }) => {
  expect((await request.get('/clube/previa/')).status()).toBe(404);
  expect((await request.get('/clube/previa/conta/')).status()).toBe(404);
  await page.goto('/clube/');
  await expect(page.locator('.clube-dev, .previa-faixa')).toHaveCount(0);
  await page.goto('/clube/membro/');
  await page.waitForURL(/[/]clube[/]conta[/]$/);
});

test('reserva continua acessível a partir das páginas do Clube', async ({ page }) => {
  await page.goto('/clube/');
  await page.getByRole('link', { name: /voltar ao início/ }).click();
  await expect(page.locator('#reservar .ticket')).toBeVisible();
});
