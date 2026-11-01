import { sair } from './sair';
import { iniciarAvisos } from './avisos';

// Comportamento da moldura do painel (sem framework): menu no celular, recolher a lateral, tema, unidade (no menu do
// perfil), perfil, sair e o sino de pendências (layout/avisos.ts).
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

document.getElementById('sair')?.addEventListener('click', () => void sair());

// Pendências (sino) e contador de Reservas da lateral -------------------------------------------------------------------
iniciarAvisos();
