// Comportamento da moldura do painel (sem framework): menu no celular, recolher a lateral, tema, unidade, perfil, sair e o
// contador de reservas pendentes (uma consulta leve por página; nada de polling).
const raiz = document.documentElement;

function guardar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    /* navegação privada: vale só nesta página */
  }
}

// Tema ----------------------------------------------------------------------------------------------------------------
document.getElementById('tema')?.addEventListener('click', () => {
  const novo = raiz.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
  raiz.setAttribute('data-tema', novo);
  guardar('painel-tema', novo);
});

// Lateral -------------------------------------------------------------------------------------------------------------
const abrir = document.getElementById('abrir-menu');
const lateral = document.getElementById('lateral');
const fecharMenu = () => {
  raiz.removeAttribute('data-menu');
  abrir?.setAttribute('aria-expanded', 'false');
};
abrir?.addEventListener('click', () => {
  raiz.setAttribute('data-menu', '1');
  abrir.setAttribute('aria-expanded', 'true');
  lateral?.querySelector<HTMLElement>('a,button')?.focus();
});
document.getElementById('veu-lateral')?.addEventListener('click', fecharMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && raiz.hasAttribute('data-menu')) {
    fecharMenu();
    abrir?.focus();
  }
});
document.getElementById('recolher')?.addEventListener('click', () => {
  const r = raiz.getAttribute('data-recolhida') === '1';
  if (r) raiz.removeAttribute('data-recolhida');
  else raiz.setAttribute('data-recolhida', '1');
  guardar('painel-recolhida', r ? null : '1');
});

// Unidade de negócio (cookie lido pelo servidor do painel; recarrega com os dados da outra unidade) -------------------
document.querySelector<HTMLSelectElement>('[data-unidade]')?.addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  document.cookie = `ambar_painel_unidade=${encodeURIComponent(v)}; path=/admin; SameSite=Strict; max-age=31536000${location.protocol === 'https:' ? '; Secure' : ''}`;
  location.reload();
});

// Perfil ----------------------------------------------------------------------------------------------------------------
const perfil = document.getElementById('perfil');
const botaoPerfil = perfil?.querySelector<HTMLButtonElement>('button.perfil');
const menuPerfil = document.getElementById('perfil-menu');
const alternarPerfil = (abrirMenu: boolean) => {
  if (!menuPerfil || !botaoPerfil) return;
  menuPerfil.hidden = !abrirMenu;
  botaoPerfil.setAttribute('aria-expanded', String(abrirMenu));
  if (abrirMenu) menuPerfil.querySelector<HTMLElement>('.suspenso__item')?.focus();
};
botaoPerfil?.addEventListener('click', (e) => {
  e.stopPropagation();
  alternarPerfil(!!menuPerfil?.hidden);
});
document.addEventListener('click', (e) => {
  if (menuPerfil && !menuPerfil.hidden && !perfil?.contains(e.target as Node)) alternarPerfil(false);
});
menuPerfil?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    alternarPerfil(false);
    botaoPerfil?.focus();
  }
});

document.getElementById('sair')?.addEventListener('click', async () => {
  try {
    await fetch('/admin/api/sessao', { method: 'DELETE', headers: { 'X-Painel': '1' }, credentials: 'same-origin' });
  } finally {
    location.assign('/admin/login');
  }
});

// Reservas pendentes de aprovação (de hoje em diante) -------------------------------------------------------------------
(async () => {
  const conta = document.querySelector<HTMLElement>('[data-pendentes]');
  if (!conta) return;
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
  try {
    const r = await fetch(`/admin/api/reservas?status=pendente&data_de=${hoje}&limite=1`, { credentials: 'same-origin' });
    if (!r.ok) return;
    const { total } = (await r.json()) as { total: number };
    if (total > 0) {
      conta.textContent = String(total);
      conta.hidden = false;
      conta.setAttribute('aria-label', `${total} pendentes de aprovação`);
      const sino = document.querySelector<HTMLElement>('[data-sino]');
      if (sino) sino.hidden = false;
    }
  } catch {
    /* sem contador: nada de errado na página */
  }
})();
