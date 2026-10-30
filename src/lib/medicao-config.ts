// Medição (GA4) e verificação do Search Console no BUILD. Os dois valores são públicos por natureza (vão no HTML de
// qualquer site que usa GA4 / a meta de verificação) — nenhum segredo: a chave secreta do Measurement Protocol nunca
// entra no frontend, e este site não a usa. Valor inválido derruba o build (melhor que publicar o site medindo errado).
import { medicao, privacidade } from '../data/privacidade';
import { REVISAO } from './conteudo';

const ga4 = (import.meta.env.PUBLIC_GA4_ID ?? '').trim();
if (ga4 && !/^G-[A-Z0-9]{6,14}$/.test(ga4)) {
  throw new Error(`PUBLIC_GA4_ID inválido (“${ga4}”): use o ID de medição do fluxo da Web do GA4, no formato G-XXXXXXXXXX.`);
}

const gsc = (import.meta.env.PUBLIC_GSC_VERIFICACAO ?? '').trim();
if (gsc && !/^[A-Za-z0-9_-]{20,80}$/.test(gsc)) {
  throw new Error('PUBLIC_GSC_VERIFICACAO inválido: use só o valor de content="…" da meta google-site-verification.');
}

/** ID de medição do GA4 (G-…), ou '' sem ele. */
export const GA4_ID = ga4;

/**
 * O GA4 entra nas páginas? Só com o ID, com a seção de medição da política aprovada (src/data/privacidade.ts) e num
 * build de produção — nunca no `astro dev` nem no build de revisão, para não misturar testes com visitas reais.
 */
export const MEDICAO_LIGADA = !!GA4_ID && privacidade.aprovada && medicao.aprovada && !REVISAO;

if (GA4_ID && !medicao.aprovada) {
  console.warn('[medição] PUBLIC_GA4_ID definido, mas a seção de medição da política não está aprovada: GA4 fora do site.');
}

/** Token da meta de verificação do Search Console (só se a verificação por DNS não for usada). */
export const GSC_VERIFICACAO = gsc;

/** Páginas medidas: tudo, menos o Clube (área de membro, link de convite com token) e páginas internas. */
export const paginaMedida = (caminho: string) => !caminho.startsWith('/clube') && !caminho.startsWith('/design-system') && !caminho.startsWith('/admin');
