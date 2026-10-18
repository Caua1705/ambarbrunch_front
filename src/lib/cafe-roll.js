// @ts-check
// Âmbar Brunch — CAFÉ + ROLL: troca de dupla (bebida + roll), profundidade pelo ponteiro e atalho para o cardápio.
// - escolher uma dupla (toque, clique ou setas no grupo de rádio) troca a foto do roll, a cor do copo e as etiquetas;
//   a troca é uma animação curta (data-trocando, ~420 ms) e some com movimento reduzido;
// - desktop (ponteiro fino): as camadas da colagem acompanham o ponteiro em profundidades diferentes (--px, --py, rAF);
// - “ver bebidas no cardápio”: o link leva ao cardápio e abre a etiqueta dos gelados.
import { motionAllowed } from './motion.js';

/** @param {HTMLElement} root */
export function initCafeRoll(root) {
  const palco = /** @type {HTMLElement | null} */ (root.querySelector('[data-dupla]'));
  const botoes = /** @type {HTMLButtonElement[]} */ ([...root.querySelectorAll('[data-par]')]);
  if (!palco || !botoes.length) return;
  const bebida = root.querySelector('[data-bebida]');
  const nomeRoll = root.querySelector('[data-roll]');
  const frase = root.querySelector('[data-frase]');
  let fim = 0;

  /** @param {HTMLButtonElement} b @param {boolean} [focar] */
  const escolher = (b, focar = false) => {
    if (b.getAttribute('aria-checked') === 'true') return;
    botoes.forEach((o) => { const sel = o === b; o.setAttribute('aria-checked', String(sel)); o.tabIndex = sel ? 0 : -1; });
    if (focar) b.focus();
    const d = b.dataset;
    palco.style.setProperty('--liq-a', d.liqA ?? '');
    palco.style.setProperty('--liq-b', d.liqB ?? '');
    root.querySelectorAll('[data-foto]').forEach((f) => f.toggleAttribute('data-ativo', /** @type {HTMLElement} */ (f).dataset.foto === d.par));
    if (bebida) bebida.textContent = d.bebida ?? '';
    if (nomeRoll) nomeRoll.textContent = d.roll ?? '';
    if (frase) frase.textContent = d.frase ?? '';
    if (!motionAllowed()) return;
    palco.removeAttribute('data-trocando');
    void palco.offsetWidth;   // recomeça a animação de troca
    palco.setAttribute('data-trocando', '');
    clearTimeout(fim);
    fim = window.setTimeout(() => palco.removeAttribute('data-trocando'), 480);
  };
  botoes.forEach((b, i) => {
    b.addEventListener('click', () => escolher(b));
    b.addEventListener('keydown', (e) => {
      const n = ['ArrowRight', 'ArrowDown'].includes(e.key) ? i + 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? i - 1 : null;
      if (n === null) return;
      e.preventDefault();
      escolher(botoes[(n + botoes.length) % botoes.length], true);
    });
  });

  // Profundidade pelo ponteiro (só mouse/caneta, só com movimento liberado)
  const fino = matchMedia('(hover: hover) and (pointer: fine)');
  let raf = 0;
  let px = 0;
  let py = 0;
  const aplicar = () => { raf = 0; palco.style.setProperty('--px', px.toFixed(3)); palco.style.setProperty('--py', py.toFixed(3)); };
  palco.addEventListener('pointermove', (e) => {
    if (!fino.matches || !motionAllowed() || e.pointerType === 'touch') return;
    const r = palco.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (!raf) raf = requestAnimationFrame(aplicar);
  });
  palco.addEventListener('pointerleave', () => { px = 0; py = 0; if (!raf) raf = requestAnimationFrame(aplicar); });

  // “ver bebidas no cardápio” → cardápio com a etiqueta aberta
  root.querySelectorAll('[data-abrir]').forEach((a) => a.addEventListener('click', (ev) => {
    const id = /** @type {HTMLElement} */ (a).dataset.abrir;
    const tap = /** @type {HTMLButtonElement | null} */ (document.querySelector(`.bands__tap[data-categoria="${id}"]`));
    if (!tap) return;
    ev.preventDefault();
    if (tap.getAttribute('aria-expanded') !== 'true') tap.click();
    tap.scrollIntoView({ block: 'center', behavior: motionAllowed() ? 'smooth' : 'auto' });
    tap.focus({ preventScroll: true });
  }));
}
