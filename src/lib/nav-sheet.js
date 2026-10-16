// @ts-check
// Âmbar Brunch — menu mobile em folha inferior (<dialog> modal nativo).
// O navegador cuida do foco preso e do Esc; aqui: abrir, fechar por link/fundo e devolver o foco.

/** @param {HTMLDialogElement | null} sheet */
export function initNavSheet(sheet) {
  if (!sheet || typeof sheet.showModal !== 'function') return;
  /** @type {HTMLElement | null} */
  let opener = null;
  const announce = (open) => sheet.dispatchEvent(new CustomEvent('ambar:sheet', { detail: { open } }));

  document.querySelectorAll(`[data-menu-open="${sheet.id}"]`).forEach((btn) => {
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-controls', sheet.id);
    btn.addEventListener('click', () => {
      opener = /** @type {HTMLElement} */ (btn);
      sheet.showModal();
      btn.setAttribute('aria-expanded', 'true');
      announce(true);
    });
  });

  sheet.addEventListener('close', () => {
    document.querySelectorAll(`[data-menu-open="${sheet.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
    announce(false);
    // Fechou por link interno: o foco vai para a seção de destino; senão, volta ao botão que abriu.
    const target = sheet.dataset.goto ? document.querySelector(sheet.dataset.goto) : null;
    delete sheet.dataset.goto;
    if (target) {
      target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      /** @type {HTMLElement} */ (target).focus?.({ preventScroll: true });
    } else opener?.focus();
  });

  sheet.addEventListener('click', (ev) => {
    const el = /** @type {HTMLElement} */ (ev.target);
    if (el.closest('[data-menu-close]')) { sheet.close(); return; }
    const link = /** @type {HTMLAnchorElement | null} */ (el.closest('a[href^="#"]'));
    if (link) { ev.preventDefault(); sheet.dataset.goto = link.getAttribute('href') ?? ''; sheet.close(); return; }
    // Toque no fundo escurecido (fora da caixa da folha).
    if (el === sheet) {
      const r = sheet.getBoundingClientRect();
      const { clientX: x, clientY: y } = /** @type {MouseEvent} */ (ev);
      if (y < r.top || y > r.bottom || x < r.left || x > r.right) sheet.close();
    }
  });
}
