// Configuração do servidor do painel, lida em tempo de execução (astro:env, nunca no navegador).
import { PAINEL_MODO, PAINEL_API_URL, PAINEL_CLUBE_CONVITES, PAINEL_MODULOS } from 'astro:env/server';
import type { ModoPainel } from '../lib/sessao';
import type { Modulo } from '../lib/permissoes';

/** `false` no build da Vercel (integracao.mjs): lá a demonstração não existe nem no código. */
export const DEMO_PERMITIDO = import.meta.env.PAINEL_DEMO_PERMITIDO === true;

/**
 * - `api`: fala com o backend em PAINEL_API_URL (login real, dados reais).
 * - `demo`: dados de DEMONSTRAÇÃO em memória, nada sai para o backend. Só em build local (nunca na Vercel).
 * - `indisponivel` (padrão): a tela de login explica que o painel ainda não está conectado; ninguém entra.
 */
export function modoPainel(): ModoPainel {
  const modo = PAINEL_MODO ?? 'indisponivel';
  if (modo === 'demo') return DEMO_PERMITIDO && !process.env.VERCEL ? 'demo' : 'indisponivel';
  if (modo === 'api') return apiBase() ? 'api' : 'indisponivel';
  return 'indisponivel';
}

/** URL base do backend, sem barra no fim. Na Vercel só https. */
export function apiBase(): string | null {
  const url = PAINEL_API_URL?.trim().replace(/\/+$/, '');
  if (!url) return null;
  if (process.env.VERCEL && !url.startsWith('https://')) return null;
  return url;
}

export const clubeConvites = () => PAINEL_CLUBE_CONVITES === true;

const TODOS_OS_MODULOS: Modulo[] = ['visao-geral', 'reservas', 'atendimento', 'clube', 'financeiro', 'estoque'];

/**
 * Liberação controlada: PAINEL_MODULOS=visao-geral,reservas mostra e libera só esses módulos — no menu, nas páginas e
 * na ponte da API (o servidor recusa as rotas dos outros com 403). Sem a variável, todos. Assim publicar o backend de um
 * módulo (Financeiro, Estoque…) não o abre para a equipe por consequência: abrir é uma decisão de configuração.
 */
export function modulosLiberados(): Modulo[] {
  const bruto = PAINEL_MODULOS?.trim();
  if (!bruto) return TODOS_OS_MODULOS;
  const pedidos = bruto.split(',').map((m) => m.trim());
  return TODOS_OS_MODULOS.filter((m) => pedidos.includes(m));
}

/** Módulo dono de uma rota da API do backend (`reservas/…` → reservas). `null` = rota comum (sessão, unidades). */
export function moduloDaRota(caminho: string): Modulo | 'arquivos' | null {
  const raiz = caminho.split('/')[0];
  if (raiz === 'reservas' || raiz === 'clientes') return 'reservas';
  if (raiz === 'atendimento') return 'atendimento';
  if (raiz === 'clube') return 'clube';
  if (raiz === 'financeiro') return 'financeiro';
  if (raiz === 'estoque') return 'estoque';
  if (raiz === 'visao-geral') return 'visao-geral';
  if (raiz === 'julia') return 'financeiro';
  // documentos (notas e comprovantes) servem o Financeiro e o Estoque
  if (raiz === 'arquivos') return 'arquivos';
  return null;
}

export function rotaLiberada(caminho: string, modulos: Modulo[]): boolean {
  const dono = moduloDaRota(caminho);
  if (dono === null) return true;
  if (dono === 'arquivos') return modulos.includes('financeiro') || modulos.includes('estoque');
  // a conferência de compras do Estoque lê as categorias e os fornecedores do Financeiro (o backend libera ao operador)
  if (/^financeiro\/(categorias|fornecedores)(\/|$)/.test(caminho)) return modulos.includes('financeiro') || modulos.includes('estoque');
  return modulos.includes(dono);
}
