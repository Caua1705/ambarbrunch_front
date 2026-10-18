// @ts-check
// Âmbar Brunch — carrossel “Provou, conta”: três vídeos à vista, o central em destaque e os vizinhos aparecendo nas bordas.
// - ativo = o card mais perto do centro do trilho (data-ativo): é o ÚNICO que toca — o foco é sempre o central;
// - o vídeo toca até o fim (ou até 40 s, o que vier antes) e o próximo vira o central; no último, volta ao primeiro;
// - abre no 2º card (com 3+ vídeos), para já existir um vizinho de cada lado;
// - som: começa mudo (regra dos navegadores); o botão de som libera a voz e ela segue para os próximos cards enquanto o
//   visitante não desligar (se o navegador recusar, o próximo toca mudo e o botão volta ao estado mudo);
// - toque no card: pausa/retoma (pausa manual respeitada até novo toque); toque num vizinho: ele vem para o centro;
// - seção fora da tela: pausa e o som desliga; movimento reduzido: nada toca sozinho, o toque no card toca/pausa;
// - pontos abaixo do trilho mostram e escolhem o card (setas do teclado também);
// - desempenho: cada card começa só com a capa (img lazy); o <video> sai do <template> só quando o card vai tocar,
//   e só ele baixa o arquivo. No meio do swipe nenhum vídeo começa.
import { motionAllowed } from './motion.js';

const LIMITE_S = 40;     // corte máximo por vídeo antes de passar ao próximo
const VISIVEL = 0.5;     // fração da seção na tela para o central tocar sozinho

/** @param {HTMLElement} root */
export function initCarrossel(root) {
  const trilho = /** @type {HTMLElement | null} */ (root.querySelector('[data-trilho]'));
  if (!trilho) return;
  const cards = /** @type {HTMLElement[]} */ ([...trilho.querySelectorAll('.story')]);
  if (!cards.length) return;
  const pontos = /** @type {HTMLButtonElement[]} */ ([...root.querySelectorAll('[data-ponto]')]);
  /** @type {(HTMLVideoElement | null)[]} */
  const videos = cards.map(() => null);

  let ativo = -1;
  let somLigado = false;        // o visitante liberou o som (vale para os próximos cards)
  let visivel = false;          // seção na tela
  let rolando = false;
  let pausado = -1;             // card pausado pelo visitante
  let pedido = -1;              // card que o visitante mandou tocar (vale mesmo com movimento reduzido)

  /** @param {number} i @param {boolean} tocando */
  const estado = (i, tocando) => {
    cards[i].dataset.state = tocando ? 'playing' : 'paused';
    cards[i].querySelector('.story__toggle')?.setAttribute('aria-pressed', String(tocando));
  };
  const marcarSom = () => cards.forEach((c, i) => {
    const ligado = somLigado && i === ativo;
    c.toggleAttribute('data-som-ligado', ligado);
    const b = c.querySelector('[data-som]');
    if (!b) return;
    b.setAttribute('aria-pressed', String(ligado));
    b.setAttribute('aria-label', `${ligado ? 'Desativar' : 'Ativar'} o som do vídeo ${b.getAttribute('data-nome') ?? ''}`);
  });

  /** Cria (uma vez) o <video> do card a partir do <template>, sobre a capa. @param {number} i */
  const video = (i) => {
    const existente = videos[i];
    if (existente) return existente;
    const tpl = /** @type {HTMLTemplateElement | null} */ (cards[i].querySelector('template[data-video]'));
    const v = /** @type {HTMLVideoElement | null} */ (tpl?.content.firstElementChild?.cloneNode(true) ?? null);
    if (!tpl || !v) return null;
    tpl.replaceWith(v);
    videos[i] = v;
    v.addEventListener('ended', () => { if (i === ativo) proximo(); });
    v.addEventListener('timeupdate', () => { if (i === ativo && v.currentTime >= LIMITE_S) proximo(); });
    return v;
  };

  /** @param {number} i */
  const parar = (i) => { const v = videos[i]; if (v && !v.paused) v.pause(); estado(i, false); };
  /** @param {number} i */
  const tocar = (i) => {
    const v = video(i);
    if (!v) return;
    v.muted = !somLigado;
    if (v.preload !== 'auto') v.preload = 'auto';
    if (v.ended || v.currentTime >= LIMITE_S) v.currentTime = 0;
    v.play().then(() => estado(i, true)).catch((e) => {
      // play() interrompido por um pause() (o card saiu do centro ou a seção saiu da tela): não insiste
      if (e?.name === 'AbortError' || i !== ativo || !visivel) { estado(i, false); return; }
      // som recusado fora de um gesto: tenta mudo, e o botão volta ao estado mudo
      if (!v.muted) { somLigado = false; marcarSom(); v.muted = true; v.play().then(() => estado(i, true)).catch(() => estado(i, false)); }
      else estado(i, false);
    });
  };

  /** Só o central toca: com a seção na tela, sem pausa manual e com movimento liberado (ou a pedido do visitante). */
  const decidir = () => {
    cards.forEach((_, i) => { if (i !== ativo) parar(i); });
    if (ativo < 0) return;
    const pode = visivel && pausado !== ativo && (motionAllowed() || pedido === ativo);
    if (!pode) { parar(ativo); if (!visivel && somLigado) { somLigado = false; marcarSom(); } return; }
    const v = videos[ativo];
    if (!v || v.paused) { if (!rolando) tocar(ativo); } else v.muted = !somLigado;
  };

  // Navegação ---------------------------------------------------------------------------------------------------------
  const centro = () => {
    const t = trilho.getBoundingClientRect();
    const meio = t.left + t.width / 2;
    let k = 0; let d = Infinity;
    cards.forEach((c, i) => { const r = c.getBoundingClientRect(); const dist = Math.abs(r.left + r.width / 2 - meio); if (dist < d) { d = dist; k = i; } });
    return k;
  };
  const atualizar = () => {
    const k = centro();
    if (k === ativo) return;
    if (ativo >= 0) { const v = videos[ativo]; if (v) { v.pause(); v.currentTime = 0; } estado(ativo, false); }
    ativo = k;
    if (pausado !== k) pausado = -1;
    if (pedido !== k) pedido = -1;
    cards.forEach((c, i) => c.toggleAttribute('data-ativo', i === k));
    pontos.forEach((p, i) => p.setAttribute('aria-current', i === k ? 'true' : 'false'));
    marcarSom();
  };
  /** centraliza o card i no trilho @param {number} i @param {boolean} [suave] */
  const irPara = (i, suave = motionAllowed()) => {
    const k = (i + cards.length) % cards.length;
    const t = trilho.getBoundingClientRect();
    const r = cards[k].getBoundingClientRect();
    const left = trilho.scrollLeft + r.left - t.left - (t.width - r.width) / 2;
    trilho.scrollTo({ left, behavior: suave ? 'smooth' : 'auto' });
  };
  // do último volta ao primeiro sem atravessar o trilho inteiro (o WebKit para nos pontos de snap no meio do caminho)
  function proximo() { if (ativo + 1 >= cards.length) irPara(0, false); else irPara(ativo + 1); }

  pontos.forEach((p, i) => p.addEventListener('click', () => { pedido = i; irPara(i); }));
  root.addEventListener('keydown', (e) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!passo || !(/** @type {HTMLElement} */ (e.target).closest('[data-trilho], [data-pontos]'))) return;
    e.preventDefault();
    irPara(ativo + passo);
    const p = pontos[(ativo + passo + cards.length) % cards.length];
    if (p && document.activeElement?.hasAttribute('data-ponto')) p.focus();
  });

  let raf = 0;
  let assentar = 0;
  const assentou = () => { clearTimeout(assentar); if (!rolando) return; rolando = false; atualizar(); decidir(); };
  trilho.addEventListener('scroll', () => {
    cancelAnimationFrame(raf); raf = requestAnimationFrame(atualizar);
    rolando = true; clearTimeout(assentar); assentar = window.setTimeout(assentou, 180);
  }, { passive: true });
  trilho.addEventListener('scrollend', assentou);

  cards.forEach((c, i) => {
    // Toque no card: no central, toca/pausa; num vizinho, ele vem para o centro e toca.
    c.querySelector('.story__toggle')?.addEventListener('click', () => {
      if (i !== ativo) { pedido = i; pausado = -1; irPara(i); return; }
      const v = videos[i];
      if (v && !v.paused) { pausado = i; pedido = -1; parar(i); return; }
      pausado = -1; pedido = i;
      tocar(i);   // ainda dentro do gesto (Safari)
    });
    // Som: liga/desliga a voz; ligado, vale para os próximos cards. O play() roda dentro do gesto do visitante.
    c.querySelector('[data-som]')?.addEventListener('click', () => {
      if (i !== ativo) { irPara(i); }
      somLigado = !(somLigado && i === ativo);
      pausado = -1; pedido = i;
      marcarSom();
      if (i === ativo) { const v = video(i); if (v) { v.muted = !somLigado; if (v.paused) tocar(i); } }
    });
  });

  // começa no 2º card (com 3+ vídeos): um vizinho de cada lado desde o primeiro quadro
  const inicial = cards.length >= 3 ? 1 : 0;
  requestAnimationFrame(() => { irPara(inicial, false); atualizar(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting && e.intersectionRatio >= VISIVEL; decidir(); }, { threshold: [0, VISIVEL, 1] }).observe(trilho);
    // perto da tela (~1 tela antes): prepara o vídeo central (só metadados), para o 1º quadro chegar logo
    const perto = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      perto.disconnect();
      if (!motionAllowed() || ativo < 0) return;
      const v = video(ativo); if (v && v.preload === 'none') v.preload = 'metadata';
    }, { rootMargin: '100% 0px' });
    perto.observe(trilho);
  } else {
    visivel = true;
  }
  window.addEventListener('ambar:motion', decidir);
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => irPara(ativo, false)); }, { passive: true });
}
