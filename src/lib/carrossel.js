// @ts-check
// Âmbar Brunch — carrossel “Reações reais” (referência Zuzzi): palco em laço, três vídeos à vista.
// - lugar de cada card em relação ao central: 0 central (inteiro, maior), ±1 vizinhos (cortados pelas bordas da tela),
//   ±2 fora da tela (invisíveis e inert). Em laço: sempre há um vizinho de cada lado, sem ponta vazia. Os lugares de
//   repouso são CSS (data-pos, já no HTML); o JS só move os cards durante o arraste (--x/--s/--o) e troca data-pos ao soltar;
// - OS TRÊS À VISTA TOCAM AO MESMO TEMPO, mudos, cada um repetindo o próprio corte (máx. 40 s); quem sai da vista pausa;
// - ÁUDIO (ajuste de 2026-10-18): a voz é sempre a do CENTRAL — os vizinhos ficam sempre mudos. Tudo começa mudo; o
//   1º toque no som registra a preferência DA VISITA (`somLigado`, vale para o carrossel, não para um vídeo): a partir
//   daí, cada card que encaixa no centro assume a voz sozinho (inclusive na volta do laço) e o anterior se cala na hora.
//   A troca acontece quando o card vira o central (ao soltar o arraste, no ponto ou na seta), nunca no meio do arraste.
//   Desligar o som também é preferência: as próximas trocas seguem mudas até o visitante ligar de novo;
// - saída da seção (com histerese: entra com 50% do palco na tela, sai abaixo de 30% — sem liga/desliga na borda) ou aba
//   escondida: tudo pausa e a voz para na hora; a preferência continua. De volta, os três tocam e o central retoma a voz
//   se o navegador deixar; se ele recusar som sem um toque, o vídeo segue mudo e o botão fica pronto para retomar;
// - TOQUE NO VÍDEO = SOM (ajuste final de 2026-10-18, referência Zuzzi): tocar na superfície do central liga/desliga a
//   voz — o mesmo que o botão do canto, que mostra o estado — e o vídeo NUNCA pausa nem mostra play/pause no meio.
//   Toque num vizinho: ele vem para o centro; botão de som num vizinho: ele vem para o centro já com a voz.
//   Toque × arraste: só vale como toque o gesto curto (≤ 10 px e ≤ 600 ms); arraste, rolagem ou toque longo não mexem no som;
// - movimento reduzido: nada toca sozinho; o toque no central toca só ele (com a voz) e não o para; a troca não anima;
// - navegação: arraste (dedo ou mouse, com impulso), pontos abaixo do palco e setas do teclado;
// - desempenho: cada card começa só com a capa (img lazy). Quando a seção chega perto (~1 tela antes), só os três à vista
//   ganham o <video> (do <template>, preload=metadata); o MP4 baixa ao tocar. Cada card cria o seu <video> uma vez só e
//   o reaproveita nas voltas do laço (no máximo um por card, nada recriado).
import { motionAllowed } from './motion.js';

const LIMITE_S = 40;     // corte máximo por vídeo (todos os cortes já cabem; guarda para um arquivo novo mais longo)
const ENTRA = 0.5;       // fração do palco na tela para os vídeos tocarem…
const SAI = 0.3;         // …e abaixo da qual tudo para (histerese)
const TOQUE_PX = 10;     // deslocamento máximo para o gesto ainda valer como toque (acima disso é arraste ou rolagem)
const TOQUE_MS = 600;    // duração máxima de um toque (acima disso é toque longo: não mexe no som)

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
  let somLigado = false;        // preferência da visita: o visitante ligou o som (vale para todo card que vier ao centro)
  let bloqueado = false;        // o navegador recusou som sem um toque: segue mudo até o próximo toque no botão
  let visivel = false;          // palco na tela
  let pedido = -1;              // card que o visitante mandou tocar (vale mesmo com movimento reduzido)

  /** distância em cards, no laço, de i até o centro c — de −n/2 a n/2 @param {number} i @param {number} [c] */
  const lugar = (i, c = atual) => { const d = (((i - c) % n) + n) % n; return d > n / 2 ? d - n : d; };
  /** @param {number} i */
  const aVista = (i) => Math.abs(lugar(i)) <= 1;
  const ativa = () => visivel && !document.hidden;
  /** o único card que pode ter voz agora (ou −1) */
  const audivel = () => (somLigado && !bloqueado && ativa() ? atual : -1);

  /** @param {number} i @param {boolean} tocando */
  const estado = (i, tocando) => {
    cards[i].dataset.state = tocando ? 'playing' : 'paused';
  };
  // a voz: só o central, e só com a preferência ligada; todos os outros, mudos — na hora
  const aplicarSom = () => {
    const a = audivel();
    videos.forEach((v, i) => { if (v) v.muted = i !== a; });
    cards.forEach((c, i) => {
      const ligado = i === atual && somLigado && !bloqueado;
      c.toggleAttribute('data-som-ligado', ligado);
      const b = c.querySelector('[data-som]');
      if (!b) return;
      b.setAttribute('aria-pressed', String(ligado));
      b.setAttribute('aria-label', `${ligado ? 'Desativar' : 'Ativar'} o som do vídeo ${b.getAttribute('data-nome') ?? ''}`);
    });
  };
  // o navegador não deixou tocar com voz sem um toque (comum na volta à seção): segue mudo, botão pronto para retomar
  /** @param {HTMLVideoElement} v @param {number} i */
  const recusouSom = (v, i) => {
    bloqueado = true;
    aplicarSom();
    v.muted = true;
    if (deveTocar(i)) v.play().then(() => estado(i, true)).catch(() => estado(i, false));
  };

  /** Cria (uma vez) o <video> do card a partir do <template>, sobre a capa. @param {number} i */
  const video = (i) => {
    const existente = videos[i];
    if (existente) return existente;
    const tpl = /** @type {HTMLTemplateElement | null} */ (cards[i].querySelector('template[data-video]'));
    const v = /** @type {HTMLVideoElement | null} */ (tpl?.content.firstElementChild?.cloneNode(true) ?? null);
    if (!tpl || !v) return null;
    v.muted = i !== audivel();
    tpl.replaceWith(v);
    videos[i] = v;
    v.addEventListener('timeupdate', () => { if (v.currentTime >= LIMITE_S) v.currentTime = 0; });
    // Pausa que não veio daqui (nossas pausas acontecem só quando o card não deve tocar): o WebKit pausa um vídeo mudo
    // que volta ao início do laço enquanto outro tem voz, e o Safari pausa um vídeo que ganha voz fora de um toque.
    // Retoma na hora (no máximo uma vez a cada meio segundo, sem disputar com o navegador); se a voz for recusada,
    // segue mudo e o botão fica pronto para retomar.
    let retomada = 0;
    v.addEventListener('pause', () => {
      if (!deveTocar(i)) return;
      const agora = performance.now();
      if (agora - retomada < 500) { estado(i, false); return; }
      retomada = agora;
      v.play().then(() => estado(i, true)).catch(() => { if (!v.muted) recusouSom(v, i); else estado(i, false); });
    });
    return v;
  };

  /** @param {number} i */
  const deveTocar = (i) => ativa() && aVista(i) && (motionAllowed() || pedido === i);

  /** @param {number} i */
  const parar = (i) => { const v = videos[i]; if (v) { v.muted = true; if (!v.paused) v.pause(); } estado(i, false); };
  /** @param {number} i */
  const tocar = (i) => {
    const v = video(i);
    if (!v) return;
    v.muted = i !== audivel();
    if (v.preload !== 'auto') v.preload = 'auto';
    v.play().then(() => estado(i, !v.paused)).catch((e) => {
      // play() interrompido por um pause() (o card saiu da vista ou a seção saiu da tela): não insiste
      if (e?.name === 'AbortError' || !deveTocar(i)) { estado(i, false); return; }
      if (!v.muted) recusouSom(v, i); else estado(i, false);
    });
  };

  /** Os três à vista tocam (só o central com voz, se a preferência estiver ligada); os de fora pausam; fora da tela ou com
   *  a aba escondida, tudo pausa e fica mudo. */
  const decidir = () => {
    aplicarSom();
    cards.forEach((_, i) => {
      if (!deveTocar(i)) { parar(i); return; }
      const v = videos[i];
      if (!v || v.paused) tocar(i);
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
  /** traz o card k para o centro (pelo caminho mais curto do laço); a voz passa junto, se a preferência estiver ligada
   *  @param {number} k */
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
    bloqueado = false;            // o toque/arraste que trouxe o card é um gesto: tenta a voz de novo
    if (pedido !== atual) pedido = -1;
    limparArraste();
    marcar();
    decidir();                    // cala o anterior e dá a voz ao novo central no mesmo quadro
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

  // o último gesto no palco, para separar toque de arraste, rolagem e toque longo
  let gesto = { x: 0, y: 0, t: 0, longe: false };
  trilho.addEventListener('pointerdown', (e) => {
    gesto = { x: e.clientX, y: e.clientY, t: e.timeStamp, longe: false };
    if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    arrasto = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, horizontal: null, t: e.timeStamp, vx: 0, m: medir() };
  });
  trilho.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - gesto.x, e.clientY - gesto.y) > TOQUE_PX) gesto.longe = true;
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

  /** Som: no central, liga/desliga a PREFERÊNCIA (vale para os próximos cards); num vizinho, ele vem para o centro já com
   *  a voz. Só mexe no mudo: quem está tocando segue tocando (com movimento reduzido, o central passa a tocar). O
   *  play()/unmute roda dentro do gesto do visitante (regra dos navegadores). @param {number} i */
  const alternarSom = (i) => {
    const vizinho = i !== atual;
    somLigado = vizinho ? true : !(somLigado && !bloqueado);
    bloqueado = false;
    pedido = i;
    if (vizinho) posicionar(i); else decidir();
    const v = video(i);
    if (v && v.paused && deveTocar(i)) tocar(i);
    // retorno no ícone do canto — o único sinal do toque (nada aparece no meio do vídeo)
    const b = /** @type {HTMLElement | null} */ (cards[i].querySelector('[data-som]'));
    if (b && motionAllowed()) { b.removeAttribute('data-pulso'); void b.offsetWidth; b.setAttribute('data-pulso', ''); }
  };
  cards.forEach((c, i) => {
    // Toque na superfície: no central, liga/desliga o som (nunca pausa); num vizinho, ele vem para o centro.
    c.querySelector('[data-superficie]')?.addEventListener('click', (e) => {
      if (gesto.longe || e.timeStamp - gesto.t > TOQUE_MS) return;   // arraste, rolagem ou toque longo: não é toque
      if (i !== atual) { posicionar(i); return; }
      if (c.querySelector('[data-som]')) alternarSom(i);
      else if (videos[i]?.paused) { pedido = i; tocar(i); }            // vídeo sem voz: o toque só o põe para tocar
    });
    c.querySelector('[data-som]')?.addEventListener('click', () => alternarSom(i));
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const r = e.isIntersecting ? e.intersectionRatio : 0;
      const antes = visivel;
      if (!visivel && r >= ENTRA) visivel = true;
      else if (visivel && r < SAI) visivel = false;
      if (visivel !== antes) { if (visivel) bloqueado = false; decidir(); }
    }, { threshold: [0, 0.1, 0.2, SAI, 0.4, ENTRA, 0.75, 1] }).observe(trilho);
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
  // aba escondida: para tudo e cala na hora; de volta, retoma (a voz, se o navegador deixar)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bloqueado = false; decidir(); });
  window.addEventListener('ambar:motion', decidir);
  marcar();
}
