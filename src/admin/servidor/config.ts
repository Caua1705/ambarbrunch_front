// Configuração do servidor do painel, lida em tempo de execução (astro:env, nunca no navegador).
import { PAINEL_MODO, PAINEL_API_URL, PAINEL_CLUBE_CONVITES } from 'astro:env/server';
import type { ModoPainel } from '../lib/sessao';

/**
 * - `api`: fala com o backend em PAINEL_API_URL (login real, dados reais).
 * - `demo`: dados de DEMONSTRAÇÃO em memória, nada sai para o backend. Proibido na Vercel (preview ou produção).
 * - `indisponivel` (padrão): a tela de login explica que o painel ainda não está conectado; ninguém entra.
 */
export function modoPainel(): ModoPainel {
  const modo = PAINEL_MODO ?? 'indisponivel';
  if (modo === 'demo') return process.env.VERCEL ? 'indisponivel' : 'demo';
  if (modo === 'api') return apiBase() ? 'api' : 'indisponivel';
  return 'indisponivel';
}

/** URL base do backend, sem barra no fim. Em produção só https. */
export function apiBase(): string | null {
  const url = PAINEL_API_URL?.trim().replace(/\/+$/, '');
  if (!url) return null;
  if (process.env.VERCEL && !url.startsWith('https://')) return null;
  return url;
}

export const clubeConvites = () => PAINEL_CLUBE_CONVITES === true;
