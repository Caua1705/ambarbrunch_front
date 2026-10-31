// @ts-check
// Âmbar Brunch — menu mobile em folha inferior (<dialog> modal nativo).
// O navegador cuida do foco preso; aqui: abrir, fechar (X, Esc, toque fora, link) e devolver o foco.
// Saída animada (rodada final): a folha só fecha de verdade (dialog.close) quando a animação de saída termina —
// antes ela sumia de uma vez. Movimento reduzido: fecha direto.
import { motionAllowed } from './motion.js';

const SAIDA_MS = 340;   // igual à --dur-sheet-out (tokens/motion.css); o prazo extra cobre abas em segundo plano

/** @param {HTMLDialogElement | null} sheet */
export function initNavSheet(sheet) {
  if (!sheet || typeof sheet.showModal !== 'function') return;
  /** @type {HTMLElement | null} */
  let opener = null;
  let prazo = 0;
  /** @param {boolean} open @param {string} [destino] seção para onde o menu mandou (a doca espera a rolagem) */
  const announce = (open, destino) => sheet.dispatchEvent(new CustomEvent('ambar:sheet', { detail: { open, destino } }));

  const terminar = () => {
    clearTimeout(prazo);
    if (!sheet.hasAttribute('data-fechando')) return;
    sheet.removeAttribute('data-fechando');
    sheet.close();
  };
  /** Fecha com a animação de saída; a folha continua montada (e o fundo travado) até ela acabar. */
  const fechar = () => {
    if (!sheet.open || sheet.hasAttribute('data-fechando')) return;
    if (!motionAllowed()) { sheet.close(); return; }
    sheet.setAttribute('data-fechando', '');
    prazo = window.setTimeout(terminar, SAIDA_MS + 160);
  };
  sheet.addEventListener('animationend', (ev) => { if (ev.target === sheet && sheet.hasAttribute('data-fechando')) terminar(); });
  // Esc: o navegador fecharia na hora; segura o fechamento para a saída animar
  sheet.addEventListener('cancel', (ev) => { ev.preventDefault(); fechar(); });

  document.querySelectorAll(`[data-menu-open="${sheet.id}"]`).forEach((btn) => {
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-controls', sheet.id);
    btn.addEventListener('click', () => {
      if (sheet.open) return;
      opener = /** @type {HTMLElement} */ (btn);
      sheet.showModal();
      btn.setAttribute('aria-expanded', 'true');
      announce(true);
    });
  });

  sheet.addEventListener('close', () => {
    clearTimeout(prazo);
    sheet.removeAttribute('data-fechando');
    document.querySelectorAll(`[data-menu-open="${sheet.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
    // Fechou por link interno: o foco vai para a seção de destino; senão, volta ao botão que abriu.
    const target = sheet.dataset.goto ? document.querySelector(sheet.dataset.goto) : null;
    delete sheet.dataset.goto;
    announce(false, target ? `#${target.id}` : undefined);
    if (target) {
      target.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto' });
      /** @type {HTMLElement} */ (target).focus?.({ preventScroll: true });
    } else if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
  });

  sheet.addEventListener('click', (ev) => {
    const el = /** @type {HTMLElement} */ (ev.target);
    if (el.closest('[data-menu-close]')) { fechar(); return; }
    const link = /** @type {HTMLAnchorElement | null} */ (el.closest('a[href^="#"]'));
    if (link) { ev.preventDefault(); sheet.dataset.goto = link.getAttribute('href') ?? ''; fechar(); return; }
    // Toque no fundo escurecido (fora da caixa da folha).
    if (el === sheet) {
      const r = sheet.getBoundingClientRect();
      const { clientX: x, clientY: y } = /** @type {MouseEvent} */ (ev);
      if (y < r.top || y > r.bottom || x < r.left || x > r.right) fechar();
    }
  });
}
