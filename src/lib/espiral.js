// @ts-check
// Âmbar Brunch — abertura de “Direto da fornada”: a espiral de caramelo (vídeo decorativo de 8 s) em volta suave.
// - o <video> sai do <template> só quando a seção chega a ~1 tela (nada baixa no carregamento da página);
// - toca mudo quando a janela está ≥ 60% visível; sai da tela, pausa; volta, continua de onde parou;
// - o 1º e o último quadro não se emendam: perto do fim o vídeo esmaece sobre a capa, recomeça e reaparece
//   (data-voltando) — sem salto visível e sem botão;
// - o fio de caramelo (SVG) se desenha no ritmo da 1ª passada (currentTime) e depois fica inteiro;
// - movimento reduzido, economia de dados ou reprodução bloqueada: fica a capa e o fio inteiro, sem vídeo.
import { motionAllowed } from './motion.js';

const PONTE = 0.9;   // segundos antes do fim em que a volta começa (≈ a transição da capa, --dur-espiral-fade)

/** @param {HTMLElement} root */
export function initEspiral(root) {
  const janela = /** @type {HTMLElement | null} */ (root.querySelector('.abertura__janela'));
  const tpl = /** @type {HTMLTemplateElement | null} */ (root.querySelector('template[data-video]'));
  const fio = /** @type {SVGPathElement | null} */ (root.querySelector('.abertura__fio path'));
  if (!janela || !tpl) return;

  const estatico = () => { root.setAttribute('data-estatico', ''); if (fio) fio.style.strokeDashoffset = '0'; };
  const conexao = /** @type {{ saveData?: boolean } | undefined} */ (/** @type {any} */ (navigator).connection);
  if (!motionAllowed() || conexao?.saveData || !('IntersectionObserver' in window)) { estatico(); return; }

  /** @type {HTMLVideoElement | null} */
  let v = null;
  let visivel = false;
  let primeira = true;   // o fio só acompanha a 1ª passada
  let voltando = false;
  let raf = 0;
  const desenhar = () => {
    if (v && fio && primeira) fio.style.strokeDashoffset = String(Math.max(0, 1 - v.currentTime / (v.duration || 8)));
    raf = requestAnimationFrame(desenhar);
  };

  const criar = () => {
    if (v) return v;
    const novo = /** @type {HTMLVideoElement} */ (tpl.content.firstElementChild?.cloneNode(true));
    tpl.replaceWith(novo);
    novo.addEventListener('playing', () => {
      root.setAttribute('data-tocando', '');
      root.removeAttribute('data-voltando');
      voltando = false;
      cancelAnimationFrame(raf);
      if (primeira) raf = requestAnimationFrame(desenhar);
    });
    novo.addEventListener('pause', () => cancelAnimationFrame(raf));
    novo.addEventListener('timeupdate', () => {
      if (voltando || !novo.duration || novo.currentTime < novo.duration - PONTE) return;
      voltando = true;
      root.setAttribute('data-voltando', '');
      root.removeAttribute('data-tocando');   // a capa volta por cima enquanto o vídeo esmaece
    });
    novo.addEventListener('ended', () => {
      cancelAnimationFrame(raf);
      primeira = false;
      if (fio) fio.style.strokeDashoffset = '0';
      novo.currentTime = 0;
      if (visivel && motionAllowed()) novo.play().catch(() => {});
    });
    v = novo;
    return novo;
  };

  const decidir = () => {
    if (!v) return;
    if (visivel && motionAllowed()) {
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
  window.addEventListener('ambar:motion', decidir);
}
