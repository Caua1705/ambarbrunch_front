// @ts-check
// Âmbar Brunch — carrossel “Quem provou, conta”: um vídeo em destaque no centro, vizinhos aparecendo nas bordas.
// - o card ativo é o mais próximo do centro do trilho (swipe nativo com scroll-snap; setas no desktop);
// - só o ativo toca, mudo, e só com o carrossel visível (≥ 50%); ao trocar, o anterior pausa e volta a ficar mudo;
// - “som” liga/desliga o áudio do ativo (gesto do visitante: toca mesmo com movimento reduzido ou pausa global);
// - pausa manual é respeitada: o vídeo que o visitante pausou só volta a tocar quando ele mandar (os outros seguem a regra);
// - movimento reduzido ou pausa global: nada toca sozinho; o toque no card toca/pausa;
// - legendas (.vtt) aparecem abaixo do carrossel, sem cobrir o vídeo nem os créditos gravados pelos criadores;
// - desempenho: cada card começa só com a capa (img lazy); o <video> sai do <template> quando o card fica ativo
//   com o carrossel por perto, e só o ativo baixa o arquivo (preload="none" até tocar).
import { motionAllowed } from './motion.js';

/** @param {HTMLElement} root */
export function initCarrossel(root) {
  const trilho = /** @type {HTMLElement | null} */ (root.querySelector('[data-trilho]'));
  if (!trilho) return;
  const cards = /** @type {HTMLElement[]} */ ([...trilho.querySelectorAll('.story')]);
  if (!cards.length) return;
  /** @type {(HTMLVideoElement | null)[]} */
  const videos = cards.map(() => null);
  const fala = /** @type {HTMLElement | null} */ (root.querySelector('[data-fala]'));
  const prev = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-prev]'));
  const next = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-next]'));

  let ativo = -1;
  let visivel = false;
  /** carrossel a até ~1,5 tela: antes disso nenhum vídeo nem legenda é criado */
  let perto = !('IntersectionObserver' in window);
  /** cards que o visitante pausou: não voltam a tocar sozinhos (o WebKit também bloquearia) */
  const pausados = new Set();
  /** o visitante mandou tocar este card (vale mesmo com movimento reduzido) */
  let pedido = false;
  let som = false;

  /** @param {number} i @param {boolean} tocando */
  const estado = (i, tocando) => {
    cards[i].dataset.state = tocando ? 'playing' : 'paused';
    cards[i].querySelector('.story__toggle')?.setAttribute('aria-pressed', String(tocando));
    if (i === ativo) fala?.toggleAttribute('data-tocando', tocando);
  };

  /** Cria (uma vez) o <video> do card a partir do <template>, sobre a capa. @param {number} i */
  const video = (i) => {
    const existente = videos[i];
    if (existente) return existente;
    const tpl = /** @type {HTMLTemplateElement | null} */ (cards[i].querySelector('template[data-video]'));
    const v = /** @type {HTMLVideoElement | null} */ (tpl?.content.firstElementChild?.cloneNode(true) ?? null);
    if (!tpl || !v) return null;
    tpl.replaceWith(v);
    videos[i] = v;
    // progresso tipo story (só enquanto toca)
    const bar = /** @type {HTMLElement | null} */ (cards[i].querySelector('.story__progress'));
    let r = 0;
    const tick = () => { bar?.style.setProperty('--p', String(v.duration ? v.currentTime / v.duration : 0)); r = requestAnimationFrame(tick); };
    if (bar) { v.addEventListener('play', () => { cancelAnimationFrame(r); r = requestAnimationFrame(tick); }); v.addEventListener('pause', () => cancelAnimationFrame(r)); }
    return v;
  };

  const marcarSom = () => cards.forEach((c, i) => {
    const ligado = i === ativo && som;
    c.toggleAttribute('data-som-ligado', ligado);
    const b = c.querySelector('[data-som]');
    if (!b) return;
    b.setAttribute('aria-pressed', String(ligado));
    const tag = c.querySelector('.story__tag')?.textContent ?? '';
    b.setAttribute('aria-label', `${ligado ? 'Desativar' : 'Ativar'} o som do vídeo: ${tag}`);
  });

  /** @param {number} i */
  const tocar = (i) => {
    const v = video(i);
    if (!v) return;
    v.muted = !som;
    if (v.preload !== 'auto') v.preload = 'auto';
    v.play().then(() => estado(i, true)).catch(() => { estado(i, false); if (!v.muted) { som = false; v.muted = true; marcarSom(); } });
  };
  /** @param {number} i */
  const parar = (i) => { videos[i]?.pause(); estado(i, false); };

  /** Decide quem toca: só o ativo, com o carrossel visível, se o visitante pediu ou se o movimento automático é permitido. */
  const decidir = () => {
    cards.forEach((_, i) => {
      const v = videos[i];
      if (i !== ativo) { if (v && !v.paused) parar(i); return; }
      const pode = visivel && (pedido || (motionAllowed() && !pausados.has(i)));
      if (pode) { if (!v || v.paused) tocar(i); } else if (v && !v.paused) parar(i);
    });
  };

  // Legendas do ativo, abaixo do carrossel.
  /** @type {TextTrack | null} */
  let faixa = null;
  const mostrarFala = () => {
    if (!fala) return;
    const cue = /** @type {VTTCue | undefined} */ (faixa?.activeCues?.[0]);
    fala.textContent = cue ? cue.text : '';
  };
  const ligarLegendas = () => {
    if (faixa) { faixa.removeEventListener('cuechange', mostrarFala); faixa.mode = 'disabled'; }
    const tpl = /** @type {HTMLTemplateElement | null} */ (cards[ativo]?.querySelector('template[data-video]'));
    const temFaixa = !!(videos[ativo] ?? tpl?.content)?.querySelector('track');
    faixa = perto && temFaixa ? (video(ativo)?.textTracks?.[0] ?? null) : null;
    if (faixa) { faixa.mode = 'hidden'; faixa.addEventListener('cuechange', mostrarFala); }
    if (fala) { fala.textContent = ''; fala.toggleAttribute('data-vazia', !temFaixa); }
  };

  /** @param {number} i */
  const ativar = (i) => {
    if (i === ativo) return;
    if (ativo >= 0) { parar(ativo); const v = videos[ativo]; if (v) v.muted = true; }
    ativo = i;
    som = false; pedido = false;
    cards.forEach((c, k) => c.toggleAttribute('data-ativo', k === i));
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === cards.length - 1;
    marcarSom();
    ligarLegendas();
    decidir();
  };

  /** card mais perto do centro do trilho */
  const centro = () => {
    const meio = trilho.scrollLeft + trilho.clientWidth / 2;
    let melhor = 0; let dist = Infinity;
    cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - meio); if (d < dist) { dist = d; melhor = i; } });
    return melhor;
  };
  // rolagem pelo código (setas, toque num vizinho): os cards do meio do caminho não viram ativos
  let alvo = -1; let soltar = 0;
  let raf = 0;
  trilho.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { const c = centro(); if (alvo >= 0) { if (c !== alvo) return; alvo = -1; } ativar(c); });
  }, { passive: true });

  /** @param {number} i */
  const irPara = (i) => {
    const k = Math.max(0, Math.min(cards.length - 1, i));
    const c = cards[k];
    alvo = k; clearTimeout(soltar); soltar = window.setTimeout(() => { alvo = -1; }, 1200);
    trilho.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - trilho.clientWidth / 2, behavior: motionAllowed() ? 'smooth' : 'auto' });
  };
  prev?.addEventListener('click', () => irPara(ativo - 1));
  next?.addEventListener('click', () => irPara(ativo + 1));

  cards.forEach((c, i) => {
    // Toque no card: no ativo, toca/pausa; num vizinho, traz para o centro (e ele passa a tocar).
    c.querySelector('.story__toggle')?.addEventListener('click', () => {
      if (i !== ativo) { irPara(i); ativar(i); pedido = true; pausados.delete(i); decidir(); return; }
      const v = videos[i];
      if (!v || v.paused) { pedido = true; pausados.delete(i); } else { pedido = false; pausados.add(i); }
      decidir();
    });
    c.querySelector('[data-som]')?.addEventListener('click', () => {
      if (i !== ativo) { irPara(i); ativar(i); }
      som = !som;
      const v = video(i);
      if (v) v.muted = !som;
      if (som) { pedido = true; pausados.delete(i); }
      marcarSom();
      decidir();
    });
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { perto = true; ligarLegendas(); io.disconnect(); } }, { rootMargin: '150% 0px' });
    io.observe(trilho);
    new IntersectionObserver(([e]) => {
      visivel = e.intersectionRatio >= 0.5;
      // saiu da tela: tudo para e o som desliga (o que o visitante pausou continua pausado)
      if (e.intersectionRatio === 0) { pedido = false; if (som) { som = false; marcarSom(); } videos.forEach((v) => { if (v) v.muted = true; }); }
      decidir();
    }, { threshold: [0, 0.5, 0.75] }).observe(trilho);
  }
  window.addEventListener('ambar:motion', decidir);
  ativar(centro());
}
