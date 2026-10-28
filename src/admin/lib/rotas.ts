// Converte a `rota` que o backend manda nos achados e pendências (rota da API, ex.: /admin/estoque/analises/cardapio?…)
// para a tela do painel que resolve aquilo. Rota desconhecida cai no módulo certo, nunca numa página inexistente.
export function rotaPainel(rota: string | null | undefined): string | null {
  if (!rota) return null;
  const [caminho, busca = ''] = rota.split('?');
  const q = new URLSearchParams(busca);
  if (caminho.startsWith('/admin/estoque/analises')) return '/admin/estoque?aba=analises';
  if (caminho.startsWith('/admin/estoque/compras')) return '/admin/estoque?aba=compras';
  if (caminho.startsWith('/admin/estoque/fichas')) return '/admin/estoque?aba=fichas';
  if (caminho.startsWith('/admin/estoque/insumos') || caminho.startsWith('/admin/estoque/inventarios')) return '/admin/estoque?aba=insumos';
  if (caminho.startsWith('/admin/estoque')) return '/admin/estoque';
  if (caminho.startsWith('/admin/financeiro/contas-a-pagar')) return `/admin/financeiro?aba=contas${q.get('situacao') ? `&situacao=${q.get('situacao')}` : ''}`;
  if (caminho.startsWith('/admin/financeiro/revisao') || caminho.startsWith('/admin/financeiro/lancamentos') || caminho.startsWith('/admin/financeiro/conciliacao') || caminho.startsWith('/admin/financeiro/extratos')) return '/admin/financeiro?aba=lancamentos';
  if (caminho.startsWith('/admin/financeiro/relatorios') || caminho.startsWith('/admin/financeiro/fechamento') || caminho.startsWith('/admin/financeiro/apuracoes')) return '/admin/financeiro?aba=relatorios';
  if (caminho.startsWith('/admin/financeiro')) return '/admin/financeiro';
  if (caminho.startsWith('/admin/reservas')) return '/admin/reservas';
  if (caminho.startsWith('/admin/atendimento')) return '/admin/atendimento';
  return null;
}

/** Lê e grava parâmetros da URL da página sem recarregar (abas, filtros). */
export function lerParam(nome: string): string | null {
  return typeof location === 'undefined' ? null : new URLSearchParams(location.search).get(nome);
}
export function gravarParams(mudancas: Record<string, string | null | undefined>) {
  const u = new URL(location.href);
  for (const [k, v] of Object.entries(mudancas)) {
    if (v === null || v === undefined || v === '') u.searchParams.delete(k);
    else u.searchParams.set(k, v);
  }
  history.replaceState(history.state, '', u);
}
