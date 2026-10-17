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
 * Entrada do hero: só na primeira pintura, no topo da página e sem âncora.
 * O <head> deve rodar antes: `if(!location.hash&&!scrollY)document.documentElement.classList.add('enter')`.
 * Aqui só removemos a classe quando a última peça (o CTA, ~1,34 s) termina, para que nada repita; o prazo de 2 s
 * cobre abas abertas em segundo plano (onde as animações não andam).
 */
export function initHeroEntrance() {
  if (!root.classList.contains('enter')) return;
  if (!motionAllowed()) { root.classList.remove('enter'); return; }
  const sair = () => root.classList.remove('enter');
  document.querySelector('.hero__foot .btn')?.addEventListener('animationend', sair, { once: true });
  window.setTimeout(sair, 2000);
}
