// @ts-check
// Âmbar Brunch — comportamentos do site (fora da ilha da reserva). Sem dependências.
import { initMotionPreference, initReveal, initHeroEntrance, initHeroDescida, motionAllowed } from './motion.js';
import { initDock } from './sticky-cta.js';
import { initNavSheet } from './nav-sheet.js';
import { initStories } from './videos.js';
import { initVivo } from './vivo.js';

initMotionPreference();
initHeroEntrance();
initHeroDescida();
initReveal();
initVivo();

const sheet = /** @type {HTMLDialogElement | null} */ (document.querySelector('dialog.sheet'));
initNavSheet(sheet);
initDock({
  cta: document.querySelector('[data-sticky-cta]'),
  trigger: document.querySelector('[data-cta-trigger]'),
  reserva: document.querySelector('[data-reserva]'),
  inicio: document.getElementById('roll'),
  rodape: document.querySelector('footer.footer'),
  menuFixo: document.querySelector('.menu-btn--fixo'),
  heroMenu: document.querySelector('.menu-btn--hero'),
  sheet,
});
// vídeos da Roll (bastidores); o carrossel de criadores tem a própria lógica (lib/carrossel.js)
const bastidores = document.getElementById('roll');
if (bastidores) initStories(bastidores);

// Toque num ambiente (“Escolha seu lugar”): avisa a comanda (ilha Preact), mesmo que ela ainda não tenha carregado,
// e rola suave até a reserva — sem deixar “#reservar” na URL (a âncora velha atrapalhava o F5).
document.addEventListener('click', (ev) => {
  const link = /** @type {HTMLElement} */ (ev.target).closest?.('[data-ambiente]');
  if (!link) return;
  const id = /** @type {HTMLElement} */ (link).dataset.ambiente;
  /** @type {any} */ (window).__ambarAmbiente = id;
  window.dispatchEvent(new CustomEvent('ambar:ambiente', { detail: id }));
  const destino = /** @type {HTMLElement | null} */ (document.querySelector(link.getAttribute('href') ?? '') ?? null);
  if (!destino) return;
  ev.preventDefault();
  destino.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'start' });
  destino.focus({ preventScroll: true });
});

// Imagens que só aparecem depois de um toque (cartões do cardápio, prato da 2ª aba, duplas do Café + Roll): o lazy do
// navegador só as baixaria no toque, e o cartão abria com a foto em branco. Quando a seção chega a ~1 tela de distância,
// elas passam a “eager” e baixam em segundo plano; seções longe da tela continuam sem custo no carregamento inicial.
if ('IntersectionObserver' in window) {
  const antecipar = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    antecipar.unobserve(e.target);
    e.target.querySelectorAll('img[loading="lazy"]').forEach((img) => { /** @type {HTMLImageElement} */ (img).loading = 'eager'; });
  }), { rootMargin: '120% 0px' });
  document.querySelectorAll('[data-antecipar]').forEach((el) => antecipar.observe(el));
}
