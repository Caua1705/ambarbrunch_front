// Sair do painel: apaga o cookie da sessão neste navegador (DELETE /admin/api/sessao). O backend do Âmbar ainda não tem
// rota para revogar o token — ele continua válido no servidor até expirar (600 min por padrão), mas o navegador não o
// tem mais (o cookie é HttpOnly: nenhum script o leu). Revogar de verdade: CLI do backend `revogar-sessoes <e-mail>`.
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
