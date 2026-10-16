// @ts-check
// Âmbar Brunch — doca inferior: CTA fixo “Reservar mesa” + botão de menu.
// Regra (NAVEGACAO-E-CTA.md):
//   CTA visível  = botão de reserva do hero fora da tela  E  seção de reserva < 25% visível  E  nenhum campo de texto em foco  E  menu fechado
//   Menu visível = gatilho de menu do hero fora da tela   E  seção de reserva < 25% visível  E  nenhum campo de texto em foco  E  menu fechado
// (na reserva a doca inteira sai: o botão fixo cobriria campos e o aceite de privacidade no rodapé da tela)

const TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, select';

/**
 * @param {{ cta: HTMLElement | null, trigger: Element | null, reserva?: Element | null,
 *           dockMenu?: HTMLElement | null, heroMenu?: Element | null, sheet?: HTMLDialogElement | null }} opts
 */
export function initDock({ cta, trigger, reserva = null, dockMenu = null, heroMenu = null, sheet = null }) {
  if (!cta || !trigger || !('IntersectionObserver' in window)) return;
  const s = { trigger: true, reserva: false, heroMenu: true, typing: false, sheet: false };

  /** @param {HTMLElement} el @param {boolean} show */
  const setVisible = (el, show) => {
    el.classList.toggle('is-visible', show);
    el.setAttribute('aria-hidden', String(!show));
    el.tabIndex = show ? 0 : -1;
  };
  const update = () => {
    const quiet = s.typing || s.sheet;
    setVisible(cta, !s.trigger && !s.reserva && !quiet);
    if (dockMenu) setVisible(dockMenu, !s.heroMenu && !s.reserva && !quiet);
  };

  // “Na tela” = ao menos 60% do botão visível; um botão cortado na borda não conta.
  new IntersectionObserver(([e]) => { s.trigger = e.intersectionRatio >= 0.6; update(); }, { threshold: [0, 0.6, 1] }).observe(trigger);
  // A reserva é mais alta que a tela: conta como “na tela” quando ocupa ao menos 30% da altura visível (ou 240 px).
  if (reserva) new IntersectionObserver(([e]) => {
    s.reserva = e.intersectionRect.height >= Math.min(240, window.innerHeight * 0.3);
    update();
  }, { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1] }).observe(reserva);
  if (dockMenu) {
    if (heroMenu) new IntersectionObserver(([e]) => { s.heroMenu = e.isIntersecting; update(); }, { threshold: 0 }).observe(heroMenu);
    else s.heroMenu = false;
    document.documentElement.classList.add('has-dock');
  }

  // Teclado virtual aberto: a doca sai para não cobrir o campo.
  document.addEventListener('focusin', (ev) => { if (/** @type {Element} */ (ev.target).matches?.(TYPING)) { s.typing = true; update(); } });
  document.addEventListener('focusout', (ev) => { if (/** @type {Element} */ (ev.target).matches?.(TYPING)) { s.typing = false; update(); } });

  if (sheet) {
    sheet.addEventListener('ambar:sheet', (ev) => { s.sheet = /** @type {CustomEvent} */ (ev).detail.open; update(); });
  }
  update();
}
