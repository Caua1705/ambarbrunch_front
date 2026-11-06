// Preview no WhatsApp: as tags saem no HTML inicial, sem JavaScript, com URL absoluta do domínio oficial, e as imagens são públicas,
// em 1200 × 630 e leves. Lê a resposta crua, como o robô, com o User-Agent dele.
import { test, expect } from '@playwright/test';
import sharp from 'sharp';

const ROBO = { 'User-Agent': 'WhatsApp/2.23.20.0 A' };
const PAGINAS = [
  { rota: '/', titulo: 'Âmbar — cafeteria e brunch no Meireles, Fortaleza', descricao: 'Cafeteria e brunch no Meireles, em Fortaleza: mesa cheia, café e os cinnamon rolls da Roll. Aberto todos os dias, das 07h às 19h. Reserve sua mesa pelo site.', imagem: '/og/home.jpg' },
  { rota: '/reservar/', titulo: 'Reservar mesa — Âmbar Brunch', descricao: 'Reserve sua mesa no Âmbar Café & Brunch.', imagem: '/og/reservar.jpg' },
  { rota: '/cardapio/', titulo: 'Cardápio — Âmbar Brunch', descricao: 'Confira o cardápio do Âmbar Café & Brunch.', imagem: '/og/cardapio.jpg' },
];

const meta = (html: string, nome: string) => {
  const m = new RegExp(`<meta[^>]*property="${nome}"[^>]*content="([^"]*)"`).exec(html);
  return m?.[1].replace(/&#38;|&amp;/g, '&');
};

for (const p of PAGINAS) {
  test(`${p.rota}: preview no HTML inicial, com imagem pública`, async ({ request }) => {
    const r = await request.get(p.rota, { headers: ROBO });
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(meta(html, 'og:title')).toBe(p.titulo);
    expect(meta(html, 'og:description')).toBe(p.descricao);
    expect(meta(html, 'og:url')).toBe(`https://ambarbrunch.com${p.rota}`);
    expect(meta(html, 'og:image')).toBe(`https://ambarbrunch.com${p.imagem}`);
    expect(meta(html, 'og:image:width')).toBe('1200');
    expect(meta(html, 'og:image:height')).toBe('630');
    expect(meta(html, 'og:image:type')).toBe('image/jpeg');
    // o robô lê só o começo da página
    expect(html.indexOf('og:image')).toBeLessThan(4_000);

    const imagem = await request.get(p.imagem, { headers: ROBO });
    expect(imagem.status()).toBe(200);
    expect(imagem.headers()['content-type']).toContain('image/jpeg');
    const corpo = await imagem.body();
    expect(corpo.length).toBeLessThan(300 * 1024);
    const { width, height } = await sharp(corpo).metadata();
    expect([width, height]).toEqual([1200, 630]);
  });
}

test('/cardapio: abre e baixa o PDF oficial', async ({ page, request }) => {
  await page.goto('/cardapio/');
  await expect(page.getByRole('heading', { level: 1, name: 'Cardápio' })).toBeVisible();
  const abrir = page.getByRole('link', { name: 'Abrir o PDF' }).first();
  await expect(abrir).toHaveAttribute('target', '_blank');
  const href = await abrir.getAttribute('href');
  await expect(page.getByRole('link', { name: 'Baixar em PDF' }).first()).toHaveAttribute('href', href!);
  await expect(page.getByRole('link', { name: 'Baixar em PDF' }).first()).toHaveAttribute('download', 'Cardapio-Ambar.pdf');
  const pdf = await request.get(href!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('robots.txt não bloqueia as páginas nem as imagens do preview', async ({ request }) => {
  const r = await request.get('/robots.txt');
  expect(r.status()).toBe(200);
  expect(await r.text()).not.toMatch(/Disallow: \/(cardapio|reservar|og)/);
});
