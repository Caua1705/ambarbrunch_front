// /robots.txt (SEO local, 2026-10-30): tudo liberado, menos o painel da equipe; aponta o sitemap do domínio oficial.
// Páginas com noindex (privacidade, confirmação, Clube) NÃO entram no Disallow: o Google precisa abri-las para ler o noindex.
// No build de revisão (nunca publicado), nada é rastreável.
import type { APIRoute } from 'astro';
import { SITE } from '../data/seo';
import { REVISAO } from '../lib/conteudo';

export const prerender = true;

export const GET: APIRoute = () => new Response(
  REVISAO
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
