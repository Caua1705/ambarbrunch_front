// @ts-check
// Âmbar Brunch — abertura de “Direto da fornada”: a espiral de caramelo (vídeo ilustrativo de 8 s) toca UMA vez.
// - o <video> sai do <template> só quando a seção chega a ~1 tela (nada baixa no carregamento da página);
// - toca mudo quando a janela está ≥ 60% visível; sai da tela, pausa; volta, continua de onde parou;
// - o fio de caramelo (SVG) se desenha no ritmo do vídeo (currentTime), e fica inteiro no fim;
// - no fim, o último quadro fica parado e aparece “ver de novo” (gesto do visitante);
// - movimento reduzido, economia de dados ou reprodução bloqueada: fica a capa e o fio inteiro, sem vídeo.
import { motionAllowed } from './motion.js';

/** @param {HTMLElement} root */
export function initEspiral(root) {
  const janela = /** @type {HTMLElement | null} */ (root.querySelector('.abertura__janela'));
  const tpl = /** @type {HTMLTemplateElement | null} */ (root.querySelector('template[data-video]'));
  const fio = /** @type {SVGPathElement | null} */ (root.querySelector('.abertura__fio path'));
  const denovo = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-denovo]'));
  if (!janela || !tpl) return;

  const estatico = () => { root.setAttribute('data-estatico', ''); if (fio) fio.style.strokeDashoffset = '0'; };
  const conexao = /** @type {{ saveData?: boolean } | undefined} */ (/** @type {any} */ (navigator).connection);
  if (!motionAllowed() || conexao?.saveData || !('IntersectionObserver' in window)) { estatico(); return; }

  /** @type {HTMLVideoElement | null} */
  let v = null;
  let visivel = false;
  let terminou = false;
  let raf = 0;
  const desenhar = () => {
    if (v && fio) fio.style.strokeDashoffset = String(Math.max(0, 1 - v.currentTime / (v.duration || 8)));
    raf = requestAnimationFrame(desenhar);
  };

  const criar = () => {
    if (v) return v;
    const novo = /** @type {HTMLVideoElement} */ (tpl.content.firstElementChild?.cloneNode(true));
    tpl.replaceWith(novo);
    novo.addEventListener('playing', () => { root.setAttribute('data-tocando', ''); cancelAnimationFrame(raf); raf = requestAnimationFrame(desenhar); });
    novo.addEventListener('pause', () => cancelAnimationFrame(raf));
    novo.addEventListener('ended', () => {
      cancelAnimationFrame(raf);
      terminou = true;
      if (fio) fio.style.strokeDashoffset = '0';
      root.setAttribute('data-fim', '');
      if (denovo) denovo.hidden = false;
    });
    v = novo;
    return novo;
  };

  const decidir = () => {
    if (!v) return;
    if (visivel && !terminou && motionAllowed()) {
      if (v.paused) v.play().catch(() => { if (!root.hasAttribute('data-tocando')) estatico(); });
    } else if (!v.paused) v.pause();
  };

  const perto = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    criar().preload = 'auto';
    perto.disconnect();
    decidir();
  }, { rootMargin: '100% 0px' });
  perto.observe(root);
  new IntersectionObserver(([e]) => { visivel = e.intersectionRatio >= 0.6; decidir(); }, { threshold: [0, 0.6, 1] }).observe(janela);

  denovo?.addEventListener('click', () => {
    if (!v) return;
    terminou = false;
    root.removeAttribute('data-fim');
    denovo.hidden = true;
    if (fio) fio.style.strokeDashoffset = '1';
    v.currentTime = 0;
    v.play().catch(() => {});
  });
  window.addEventListener('ambar:motion', decidir);
}
