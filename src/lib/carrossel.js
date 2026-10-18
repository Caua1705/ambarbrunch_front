// @ts-check
// Âmbar Brunch — carrossel “Provou, conta” (ajuste de 2026-10-18, referência Zuzzi): palco em laço, três vídeos à vista.
// - lugar de cada card em relação ao central: 0 central (inteiro, maior), ±1 vizinhos (cortados pelas bordas da tela),
//   ±2 fora da tela (invisíveis e inert). Em laço: sempre há um vizinho de cada lado, sem ponta vazia. Os lugares de
//   repouso são CSS (data-pos, já no HTML); o JS só move os cards durante o arraste (--x/--s/--o) e troca data-pos ao soltar;
// - OS TRÊS À VISTA TOCAM AO MESMO TEMPO, mudos, cada um repetindo o próprio corte (máx. 40 s); quem sai da vista pausa;
// - UM ÁUDIO POR VEZ: o botão de som liga a voz daquele vídeo e silencia na hora a que estava falando; num vizinho, o
//   mesmo toque o traz para o centro. Trocar de card nunca liga som sozinho (e cala a voz que estava ligada);
// - toque no central: pausa/retoma (pausa respeitada até novo toque); toque num vizinho: ele vem para o centro;
// - seção fora da tela (ou aba escondida): tudo pausa e o som desliga; de volta, os três tocam mudos de novo;
// - movimento reduzido: nada toca sozinho; o toque no central toca/pausa só ele; a troca de card não anima;
// - navegação: arraste (dedo ou mouse, com impulso), pontos abaixo do palco e setas do teclado;
// - desempenho: cada card começa só com a capa (img lazy). Quando a seção chega perto (~1 tela antes), só os três à vista
//   ganham o <video> (do <template>, preload=metadata); o MP4 baixa ao tocar. Os de fora da vista não criam vídeo.
import { motionAllowed } from './motion.js';

const LIMITE_S = 40;     // corte máximo por vídeo (todos os cortes já cabem; guarda para um arquivo novo mais longo)
const VISIVEL = 0.5;     // fração do palco na tela para os vídeos tocarem sozinhos

/** @param {HTMLElement} root */
export function initCarrossel(root) {
  const trilho = /** @type {HTMLElement | null} */ (root.querySelector('[data-trilho]'));
  if (!trilho) return;
  const cards = /** @type {HTMLElement[]} */ ([...trilho.querySelectorAll('.story')]);
  const n = cards.length;
  if (!n) return;
  const pontos = /** @type {HTMLButtonElement[]} */ ([...root.querySelectorAll('[data-ponto]')]);
  /** @type {(HTMLVideoElement | null)[]} */
  const videos = cards.map(() => null);

  let atual = Math.min(n - 1, Number(trilho.dataset.inicial) || 0);
  let som = -1;                 // card com a voz ligada (no máximo um)
  let visivel = false;          // palco na tela
  let pausado = -1;             // card pausado pelo visitante
  let pedido = -1;              // card que o visitante mandou tocar (vale mesmo com movimento reduzido)

  /** distância em cards, no laço, de i até o centro c — de −n/2 a n/2 @param {number} i @param {number} [c] */
  const lugar = (i, c = atual) => { const d = (((i - c) % n) + n) % n; return d > n / 2 ? d - n : d; };
  /** @param {number} i */
  const aVista = (i) => Math.abs(lugar(i)) <= 1;

  /** @param {number} i @param {boolean} tocando */
  const estado = (i, tocando) => {
    cards[i].dataset.state = tocando ? 'playing' : 'paused';
    cards[i].querySelector('.story__toggle')?.setAttribute('aria-pressed', String(tocando));
  };
  // a voz: só o card `som` fica audível; todos os outros, mudos — na hora
  const aplicarSom = () => {
    videos.forEach((v, i) => { if (v) v.muted = i !== som; });
    cards.forEach((c, i) => {
      const ligado = i === som;
      c.toggleAttribute('data-som-ligado', ligado);
      const b = c.querySelector('[data-som]');
      if (!b) return;
      b.setAttribute('aria-pressed', String(ligado));
      b.setAttribute('aria-label', `${ligado ? 'Desativar' : 'Ativar'} o som do vídeo ${b.getAttribute('data-nome') ?? ''}`);
    });
  };

  /** Cria (uma vez) o <video> do card a partir do <template>, sobre a capa. @param {number} i */
  const video = (i) => {
    const existente = videos[i];
    if (existente) return existente;
    const tpl = /** @type {HTMLTemplateElement | null} */ (cards[i].querySelector('template[data-video]'));
    const v = /** @type {HTMLVideoElement | null} */ (tpl?.content.firstElementChild?.cloneNode(true) ?? null);
    if (!tpl || !v) return null;
    v.muted = i !== som;
    tpl.replaceWith(v);
    videos[i] = v;
    v.addEventListener('timeupdate', () => { if (v.currentTime >= LIMITE_S) v.currentTime = 0; });
    return v;
  };

  const ativa = () => visivel && !document.hidden;
  /** @param {number} i */
  const deveTocar = (i) => ativa() && aVista(i) && pausado !== i && (motionAllowed() || pedido === i);

  /** @param {number} i */
  const parar = (i) => { const v = videos[i]; if (v && !v.paused) v.pause(); estado(i, false); };
  /** @param {number} i */
  const tocar = (i) => {
    const v = video(i);
    if (!v) return;
    v.muted = i !== som;
    if (v.preload !== 'auto') v.preload = 'auto';
    v.play().then(() => estado(i, !v.paused)).catch((e) => {
      // play() interrompido por um pause() (o card saiu da vista ou a seção saiu da tela): não insiste
      if (e?.name === 'AbortError' || !deveTocar(i)) { estado(i, false); return; }
      // som recusado fora de um gesto: toca mudo, e o botão volta ao estado mudo
      if (!v.muted) { som = -1; aplicarSom(); v.play().then(() => estado(i, true)).catch(() => estado(i, false)); }
      else estado(i, false);
    });
  };

  /** Os três à vista tocam (mudos, menos o do som); os de fora pausam; fora da tela, tudo pausa e a voz desliga. */
  const decidir = () => {
    if (!ativa() && som >= 0) { som = -1; aplicarSom(); }
    cards.forEach((_, i) => {
      if (!deveTocar(i)) { parar(i); return; }
      const v = videos[i];
      if (!v || v.paused) tocar(i); else v.muted = i !== som;
    });
  };

  // Lugares -----------------------------------------------------------------------------------------------------------
  const limparArraste = () => cards.forEach((c) => { c.style.removeProperty('--x'); c.style.removeProperty('--s'); c.style.removeProperty('--o'); });
  const marcar = () => {
    cards.forEach((c, i) => {
      const p = lugar(i);
      c.dataset.pos = String(Math.max(-2, Math.min(2, p)));
      c.toggleAttribute('data-ativo', p === 0);
      c.inert = Math.abs(p) > 1;
    });
    pontos.forEach((p, i) => p.setAttribute('aria-current', i === atual ? 'true' : 'false'));
  };
  /** traz o card k para o centro (pelo caminho mais curto do laço) @param {number} k */
  const posicionar = (k) => {
    const novo = ((k % n) + n) % n;
    if (novo === atual) { limparArraste(); return; }
    const delta = lugar(novo);
    const antes = cards.map((_, i) => lugar(i));
    // quem dá a volta no laço (sai por um lado e entra pelo outro) salta, invisível, para fora da tela do lado de onde
    // vai entrar — senão atravessaria o palco por cima dos outros
    const saltam = cards.filter((_, i) => lugar(i, novo) !== antes[i] - delta);
    saltam.forEach((c) => { c.setAttribute('data-salto', ''); c.dataset.pos = lugar(cards.indexOf(c), novo) < 0 ? '-2' : '2'; c.style.removeProperty('--x'); c.style.removeProperty('--o'); });
    if (saltam.length) void trilho.offsetWidth;   // aplica o salto antes de liberar a transição
    saltam.forEach((c) => c.removeAttribute('data-salto'));
    atual = novo;
    // trocar de card nunca carrega a voz: o novo central começa mudo e quem falava se cala
    if (som >= 0 && som !== atual) som = -1;
    if (pausado !== atual) pausado = -1;
    if (pedido !== atual) pedido = -1;
    limparArraste();
    marcar();
    aplicarSom();
    decidir();
  };

  // Arraste -----------------------------------------------------------------------------------------------------------
  /** @type {{ id: number, x0: number, y0: number, dx: number, horizontal: boolean | null, t: number, vx: number, m: ReturnType<typeof medir> } | null} */
  let arrasto = null;
  let arrastou = false;
  const medir = () => {
    const cs = getComputedStyle(trilho);
    const num = (/** @type {string} */ p, /** @type {number} */ padrao) => parseFloat(cs.getPropertyValue(p)) || padrao;
    const w = cards[0].offsetWidth;
    const sc = num('--s-centro', 1.04); const sl = num('--s-lado', .86); const gap = num('--gap', 12); const ol = num('--o-lado', .9);
    return { sc, sl, ol, p1: w * (sc + sl) / 2 + gap, p2: w * sl + gap };
  };
  /** desenha o palco deslocado f cards (f > 0 = rumo ao próximo) @param {number} f @param {ReturnType<typeof medir>} m */
  const pintar = (f, m) => cards.forEach((c, i) => {
    let d = ((((i - atual - f) % n) + n) % n); if (d > n / 2) d -= n;
    const a = Math.abs(d);
    const x = Math.sign(d) * (a <= 1 ? a * m.p1 : m.p1 + (a - 1) * m.p2);
    c.style.setProperty('--x', `${x.toFixed(1)}px`);
    c.style.setProperty('--s', String(a <= 1 ? m.sc + (m.sl - m.sc) * a : m.sl));
    c.style.setProperty('--o', String(a <= 1 ? 1 + (m.ol - 1) * a : Math.max(0, m.ol * (2 - a))));
  });

  trilho.addEventListener('pointerdown', (e) => {
    if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    arrasto = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, horizontal: null, t: e.timeStamp, vx: 0, m: medir() };
  });
  trilho.addEventListener('pointermove', (e) => {
    const a = arrasto;
    if (!a || e.pointerId !== a.id) return;
    const dx = e.clientX - a.x0; const dy = e.clientY - a.y0;
    if (a.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      a.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!a.horizontal) { arrasto = null; return; }    // gesto vertical: a página rola
      try { trilho.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
      trilho.setAttribute('data-arrastando', '');
    }
    e.preventDefault();
    const dt = e.timeStamp - a.t;
    if (dt > 0) a.vx = 0.7 * ((dx - a.dx) / dt) + 0.3 * a.vx;   // px/ms, suavizado
    a.dx = dx; a.t = e.timeStamp;
    pintar(-dx / a.m.p1, a.m);
  });
  /** @param {PointerEvent} e */
  const soltar = (e) => {
    const a = arrasto;
    if (!a || e.pointerId !== a.id) return;
    arrasto = null;
    if (!a.horizontal) return;
    trilho.removeAttribute('data-arrastando');
    arrastou = true; window.setTimeout(() => { arrastou = false; }, 350);
    const f = -a.dx / a.m.p1;
    const impulso = -a.vx;                                  // > 0 = jogou rumo ao próximo
    let passos = Math.round(f);
    if (!passos && (Math.abs(f) > 0.18 || Math.abs(impulso) > 0.35)) passos = Math.sign(Math.abs(impulso) > 0.35 ? impulso : f);
    passos = Math.max(-2, Math.min(2, passos));
    posicionar(atual + passos);
  };
  trilho.addEventListener('pointerup', soltar);
  trilho.addEventListener('pointercancel', soltar);
  // o clique que encerra um arraste não vale como toque no card
  trilho.addEventListener('click', (e) => { if (arrastou) { e.stopPropagation(); e.preventDefault(); arrastou = false; } }, true);

  pontos.forEach((p, i) => p.addEventListener('click', () => { pedido = i; posicionar(i); }));
  root.addEventListener('keydown', (e) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!passo || !(/** @type {HTMLElement} */ (e.target).closest('[data-trilho], [data-pontos]'))) return;
    e.preventDefault();
    posicionar(atual + passo);
    if (document.activeElement?.hasAttribute('data-ponto')) pontos[atual]?.focus();
  });

  cards.forEach((c, i) => {
    // Toque no card: no central, toca/pausa; num vizinho, ele vem para o centro (e segue tocando mudo).
    c.querySelector('.story__toggle')?.addEventListener('click', () => {
      if (i !== atual) { posicionar(i); return; }
      const v = videos[i];
      if (v && !v.paused) { pausado = i; pedido = -1; parar(i); return; }
      pausado = -1; pedido = i;
      tocar(i);   // ainda dentro do gesto (Safari)
    });
    // Som: liga a voz DESTE vídeo e cala a anterior na hora; tocar de novo desliga. Num vizinho, ele vem para o centro.
    // O play()/unmute roda dentro do gesto do visitante (regra dos navegadores).
    c.querySelector('[data-som]')?.addEventListener('click', () => {
      if (i !== atual) posicionar(i);
      som = som === i ? -1 : i;
      pausado = -1; pedido = i;
      aplicarSom();
      const v = video(i);
      if (v && som === i && v.paused) tocar(i);
    });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting && e.intersectionRatio >= VISIVEL; decidir(); }, { threshold: [0, VISIVEL, 1] }).observe(trilho);
    // perto da tela (~1 tela antes): só os três à vista ganham o <video> (metadados), para o 1º quadro chegar logo
    const perto = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      perto.disconnect();
      if (!motionAllowed()) return;
      cards.forEach((_, i) => { if (!aVista(i)) return; const v = video(i); if (v && v.preload === 'none') v.preload = 'metadata'; });
    }, { rootMargin: '100% 0px' });
    perto.observe(trilho);
  } else {
    visivel = true;
  }
  document.addEventListener('visibilitychange', decidir);
  window.addEventListener('ambar:motion', decidir);
  marcar();
}
