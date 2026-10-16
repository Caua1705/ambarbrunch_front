// @ts-check
// Âmbar Brunch — comportamentos do site (fora da ilha da reserva). Sem dependências.
import { initMotionPreference, initReveal, initHeroEntrance } from './motion.js';
import { initDock } from './sticky-cta.js';
import { initNavSheet } from './nav-sheet.js';
import { initStories } from './videos.js';

initMotionPreference();
initHeroEntrance();
initReveal();

const sheet = /** @type {HTMLDialogElement | null} */ (document.querySelector('dialog.sheet'));
initNavSheet(sheet);
initDock({
  cta: document.querySelector('[data-sticky-cta]'),
  trigger: document.querySelector('[data-cta-trigger]'),
  reserva: document.querySelector('[data-reserva]'),
  dockMenu: document.querySelector('.menu-btn--dock'),
  heroMenu: document.querySelector('.menu-btn--hero'),
  sheet,
});
initStories();

// “Reservar aqui” num ambiente: avisa a comanda (ilha Preact), mesmo que ela ainda não tenha carregado.
document.addEventListener('click', (ev) => {
  const link = /** @type {HTMLElement} */ (ev.target).closest?.('[data-ambiente]');
  if (!link) return;
  const id = /** @type {HTMLElement} */ (link).dataset.ambiente;
  /** @type {any} */ (window).__ambarAmbiente = id;
  window.dispatchEvent(new CustomEvent('ambar:ambiente', { detail: id }));
});
