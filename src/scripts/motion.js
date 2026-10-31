// @ts-check
// Âmbar Brunch — preferências de movimento, revelação ao rolar e entrada do hero.
// Sem dependências. Ver docs/design/design-system/MOTION.md.

const KEY = 'ambar:motion';
const root = document.documentElement;
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** O visitante pediu menos movimento no sistema? */
export const prefersReducedMotion = () => reduceQuery.matches;

/** Movimento automático liberado? (nem reduzido no sistema, nem pausado no site) */
export const motionAllowed = () => !prefersReducedMotion() && root.dataset.motion !== 'paused';

// O site não tem mais o botão “pausar animações” (2026-10-17): vale só o movimento reduzido do sistema.
// Uma pausa salva por versões anteriores é apagada, para ninguém ficar preso sem animação e sem botão para voltar.
// O botão continua existindo só na página interna do design system, valendo apenas para aquela visita.
function readPaused() {
  try { localStorage.removeItem(KEY); } catch { /* armazenamento bloqueado */ }
  return false;
}

/** Aplica a pausa salva e liga todos os botões [data-motion-toggle]. Dispara `ambar:motion` a cada mudança. */
export function initMotionPreference() {
  /** @param {boolean} paused */
  const apply = (paused) => {
    if (paused) root.dataset.motion = 'paused'; else delete root.dataset.motion;
    document.querySelectorAll('[data-motion-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(paused)));
    window.dispatchEvent(new CustomEvent('ambar:motion', { detail: { allowed: motionAllowed() } }));
  };
  apply(readPaused());
  document.addEventListener('click', (ev) => {
    const btn = /** @type {HTMLElement} */ (ev.target).closest?.('[data-motion-toggle]');
    if (!btn) return;
    const paused = root.dataset.motion !== 'paused';
    apply(paused);
  });
  reduceQuery.addEventListener?.('change', () => apply(root.dataset.motion === 'paused'));
}

/** Revelação ao rolar, uma vez por elemento (v1). Sem IntersectionObserver ou com movimento reduzido, tudo aparece. */
export function initReveal(scope = document) {
  const items = scope.querySelectorAll('[data-reveal], [data-draw]');
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => io.observe(el));
}

/**
 * Descida da 3ª foto do hero ([data-desce]) ligada à rolagem: o progresso vai de 0 (topo) a 1 (hero inteiro fora da tela),
 * então a foto continua descendo até o hero sair — antes, a deriva do scroll-timeline terminava cedo e não existia no
 * Safari antigo. Um rAF por quadro de rolagem, só enquanto o hero está na tela; escreve uma variável CSS (só transform).
 */
export function initHeroDescida() {
  const peca = /** @type {HTMLElement | null} */ (document.querySelector('[data-desce]'));
  const hero = peca?.closest('.hero');
  if (!peca || !hero || !('IntersectionObserver' in window)) return;
  let raf = 0;
  let ligado = false;
  const aplicar = () => {
    raf = 0;
    const h = /** @type {HTMLElement} */ (hero).offsetHeight || 1;
    const p = motionAllowed() ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    peca.style.setProperty('--desce', p.toFixed(4));
  };
  const rolar = () => { if (!raf) raf = requestAnimationFrame(aplicar); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !ligado) { ligado = true; window.addEventListener('scroll', rolar, { passive: true }); rolar(); }
    else if (!e.isIntersecting && ligado) { ligado = false; window.removeEventListener('scroll', rolar); peca.style.setProperty('--desce', '1'); }
  }).observe(hero);
}

/**
 * Entrada do hero: em todo carregamento, F5 incluso (o <head> põe a classe `enter` antes da 1ª pintura, volta ao topo no
 * recarregamento e tira a âncora velha da URL — ver layouts/Base.astro).
 * Aqui só removemos a classe quando a última peça (a faixa de categorias, ~1,6 s) termina, para que nada repita; o prazo de 2,4 s
 * cobre abas abertas em segundo plano (onde as animações não andam).
 */
export function initHeroEntrance() {
  if (!root.classList.contains('enter')) return;
  if (!motionAllowed()) { root.classList.remove('enter'); return; }
  const sair = () => root.classList.remove('enter');
  // a última peça é a faixa de categorias (~1,6 s); o evento da trilha em loop (filha) não conta
  const faixa = document.querySelector('.ticker');
  if (faixa) faixa.addEventListener('animationend', (e) => { if (e.target === faixa) sair(); });
  else document.querySelector('.hero__foot .btn')?.addEventListener('animationend', sair, { once: true });
  window.setTimeout(sair, 2400);
}
