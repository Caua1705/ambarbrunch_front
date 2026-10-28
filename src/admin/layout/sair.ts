// Sair do painel (DELETE /admin/api/sessao): o servidor do painel pede ao backend para invalidar o token
// (POST /admin/auth/sair — a conta sai de todos os aparelhos) e apaga o cookie deste navegador.
// Se a chamada falhar, a tela de login percebe a sessão ainda aberta e oferece encerrar de novo.
export async function sair(): Promise<void> {
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
  location.assign(ok ? '/admin/login?saiu=1' : '/admin/login');
}
