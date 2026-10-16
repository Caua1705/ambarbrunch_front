// @ts-check
// Âmbar Brunch — liga os comportamentos do design system a partir de atributos data-*.
// Nas páginas Astro, cada seção importa só o que usa; este arquivo serve às páginas de demonstração.
import { initMotionPreference, initReveal, initHeroEntrance } from './motion.js';
import { initDock } from './sticky-cta.js';
import { initNavSheet } from './nav-sheet.js';
import { initStories } from './videos.js';
import { initComandaPreview } from './comanda-preview.js';

initMotionPreference();
initHeroEntrance();
initReveal();

const sheet = /** @type {HTMLDialogElement | null} */ (document.querySelector('dialog.sheet'));
initNavSheet(sheet);
initDock({
  cta: document.querySelector('[data-sticky-cta]'),
  trigger: document.querySelector('[data-cta-trigger]') ?? document.querySelector('[data-hero]'),
  reserva: document.querySelector('[data-reserva]'),
  dockMenu: document.querySelector('.menu-btn--dock'),
  heroMenu: document.querySelector('.menu-btn--hero'),
  sheet,
});
initStories();
initComandaPreview();
