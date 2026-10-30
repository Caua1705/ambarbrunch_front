// /sitemap.xml (SEO local, 2026-10-30): só as páginas que devem aparecer no Google — as indexáveis do site público.
// Privacidade, confirmação da reserva, telas do Clube e painel ficam de fora (têm noindex ou não são públicas).
// Sem <lastmod>: a data do build não é a data em que o conteúdo mudou, e um lastmod falso faz o Google ignorá-lo.
import type { APIRoute } from 'astro';
import { SITE } from '../data/seo';
import { CLUBE_NA_HOME } from '../lib/clube-modo';
import { REVISAO } from '../lib/conteudo';

export const prerender = true;

/** Caminhos indexáveis. O Clube só entra quando for lançado (o convite volta à home com PUBLIC_CLUBE_HOME=1). */
const PAGINAS_INDEXADAS = ['/', '/reservar/', ...(CLUBE_NA_HOME ? ['/clube/'] : [])];

export const GET: APIRoute = () => {
  const urls = REVISAO ? [] : PAGINAS_INDEXADAS;
  const corpo = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((p) => `  <url><loc>${new URL(p, SITE).href}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(corpo, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
