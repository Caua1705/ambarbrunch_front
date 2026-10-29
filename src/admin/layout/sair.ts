// Sair do painel (DELETE /admin/api/sessao): o servidor do painel pede ao backend para invalidar o token
// (POST /admin/auth/sair — a conta sai de todos os aparelhos) e apaga o cookie deste navegador.
// Se a chamada falhar, a tela de login percebe a sessão ainda aberta e oferece encerrar de novo.
/** `volta`: página do painel para depois do próximo login (ex.: o tablet volta ao Modo Operação). */
export async function sair(volta?: string): Promise<void> {
  let ok = false;
  try {
    const r = await fetch('/admin/api/sessao', { method: 'DELETE', headers: { 'X-Painel': '1' }, credentials: 'same-origin' });
    ok = r.ok;
  } catch {
    ok = false;
  }
  try {
    // conveniências locais deste navegador que não devem sobrar para a próxima pessoa
    localStorage.removeItem('painel-contagem-aberta');
  } catch {
    /* sem armazenamento */
  }
  const q = volta ? `volta=${encodeURIComponent(volta)}` : '';
  location.assign(ok ? `/admin/login?saiu=1${q ? `&${q}` : ''}` : `/admin/login${q ? `?${q}` : ''}`);
}
