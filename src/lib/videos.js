// @ts-check
// Âmbar Brunch — vídeos verticais (stories): um por vez, mudos, só quando visíveis.
// - toca o card com maior área visível (≥ 60%); os outros pausam;
// - com movimento reduzido ou pausa global, nada toca sozinho; o toque no card toca/pausa;
// - preload="none" + poster: o arquivo só é baixado quando o vídeo vai tocar.
import { motionAllowed } from './motion.js';

export function initStories(scope = document) {
  /** @type {HTMLVideoElement[]} */
  const videos = [...scope.querySelectorAll('video[data-autoplay]')].map((v) => /** @type {HTMLVideoElement} */ (v));
  if (!videos.length) return;
  // Posters sob demanda: a ~1,5 tela de distância. Sem IntersectionObserver, aplica direto.
  const aplicarPoster = (/** @type {HTMLVideoElement} */ v) => { if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster; };
  if (!('IntersectionObserver' in window)) { videos.forEach(aplicarPoster); return; }
  const perto = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { aplicarPoster(/** @type {HTMLVideoElement} */ (e.target)); perto.unobserve(e.target); } }), { rootMargin: '150% 0px' });
  videos.forEach((v) => perto.observe(v));
  const ratio = new Map(videos.map((v) => [v, 0]));
  /** vídeos que o visitante tocou ou pausou à mão: a regra automática não mexe mais neles */
  const manual = new Map();
  /** o visitante pausou um vídeo: nenhum outro começa sozinho até o carrossel sair da tela */
  let calado = false;

  /** @param {HTMLVideoElement} v */
  const card = (v) => v.closest('.story');
  /** @param {HTMLVideoElement} v @param {boolean} playing */
  const setState = (v, playing) => card(v)?.setAttribute('data-state', playing ? 'playing' : 'paused');
  /** @param {HTMLVideoElement} v */
  const play = (v) => { v.preload = 'auto'; v.play().then(() => setState(v, true)).catch(() => setState(v, false)); };
  /** @param {HTMLVideoElement} v */
  const pause = (v) => { v.pause(); setState(v, false); };

  const pick = () => {
    let best = null; let max = 0.6;
    for (const [v, r] of ratio) if (r >= max && manual.get(v) !== 'paused') { best = v; max = r; }
    for (const v of videos) {
      if (manual.get(v) === 'playing' && (ratio.get(v) ?? 0) > 0) continue;
      if (v === best && motionAllowed() && !calado) { if (v.paused) play(v); } else if (!v.paused) pause(v);
    }
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = /** @type {HTMLVideoElement} */ (e.target);
      ratio.set(v, e.intersectionRatio);
      if (e.intersectionRatio === 0) { manual.delete(v); if (!v.paused) pause(v); }
    });
    if ([...ratio.values()].every((r) => r === 0)) calado = false;
    pick();
  }, { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] });
  videos.forEach((v) => { io.observe(v); setState(v, false); });

  // Botão que cobre o card (se existir): tocar/pausar à mão. Toque é gesto do usuário: vale mesmo com a pausa global.
  scope.querySelectorAll('.story__toggle').forEach((btn) => btn.addEventListener('click', () => {
    const v = /** @type {HTMLVideoElement | null} */ (btn.closest('.story')?.querySelector('video') ?? null);
    if (!v) return;
    if (v.paused) { videos.forEach((o) => { if (o !== v && !o.paused) { manual.set(o, 'paused'); pause(o); } }); manual.set(v, 'playing'); play(v); }
    else { manual.set(v, 'paused'); calado = true; pause(v); }
    btn.setAttribute('aria-pressed', String(!v.paused));
  }));

  // Barra de progresso (só enquanto toca).
  videos.forEach((v) => {
    const bar = /** @type {HTMLElement | null} */ (card(v)?.querySelector('.story__progress') ?? null);
    if (!bar) return;
    let raf = 0;
    const tick = () => { bar.style.setProperty('--p', String(v.duration ? v.currentTime / v.duration : 0)); raf = requestAnimationFrame(tick); };
    v.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
    v.addEventListener('pause', () => cancelAnimationFrame(raf));
  });

  window.addEventListener('ambar:motion', pick);
}
