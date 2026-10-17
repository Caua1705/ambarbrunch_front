// @ts-check
// Âmbar Brunch — baralho de camadas (Café e bebidas): a camada tocada vem para a frente e as outras recuam em ordem.
// A posição de cada camada sai de --ordem (0 = frente) no CSS; aqui só se reordena. Com mouse, o baralho acompanha o
// ponteiro pela profundidade (--px/--py, um rAF por movimento). Movimento reduzido: troca de ordem sem animação (CSS).
import { motionAllowed } from './motion.js';

/** @param {HTMLElement} root */
export function initBaralho(root) {
  const camadas = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-camada]')]);
  if (camadas.length < 2) return;
  /** ordem atual: camadas da frente para o fundo */
  let ordem = [...camadas].sort((a, b) => Number(a.style.getPropertyValue('--ordem')) - Number(b.style.getPropertyValue('--ordem')));

  const aplicar = () => ordem.forEach((c, i) => {
    c.style.setProperty('--ordem', String(i));
    c.dataset.pos = String(i);
    c.toggleAttribute('data-frente', i === 0);
  });
  /** @param {HTMLElement} c */
  const frente = (c) => {
    if (ordem[0] === c) return;
    ordem = [c, ...ordem.filter((x) => x !== c)];
    root.setAttribute('data-embaralhando', '');
    window.setTimeout(() => root.removeAttribute('data-embaralhando'), 520);
    aplicar();
  };
  camadas.forEach((c) => {
    c.addEventListener('click', () => frente(c));
    // o cartão não é <button>: Enter/Espaço também o trazem para a frente
    if (c.tagName !== 'BUTTON') c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); frente(c); } });
  });
  aplicar();

  // profundidade pelo ponteiro (só mouse/caneta: no toque o baralho já reage ao toque)
  if (window.matchMedia('(pointer: fine)').matches) {
    let raf = 0;
    root.addEventListener('pointermove', (ev) => {
      if (!motionAllowed()) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = root.getBoundingClientRect();
        root.style.setProperty('--px', ((ev.clientX - r.left) / r.width - 0.5).toFixed(3));
        root.style.setProperty('--py', ((ev.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    });
    root.addEventListener('pointerleave', () => { root.style.setProperty('--px', '0'); root.style.setProperty('--py', '0'); });
  }
}
