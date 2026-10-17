// @ts-check
// Âmbar Brunch — carrossel “Quem provou, conta”: o card ativo no centro, o anterior e o próximo aparecendo nas bordas.
// - ativo = o card mais perto do centro do trilho (data-ativo): ganha o destaque; setas e contador andam de ativo em ativo;
// - os cards visíveis (≥ 55% na tela, no trilho e na página) tocam juntos, mudos — no máximo 2 ao mesmo tempo;
// - som por card, só com toque do visitante: ligar o som de um silencia o anterior (um audível por vez);
// - card (ou a seção) sai da tela: pausa e, se era o audível, o som desliga;
// - pausa manual é respeitada: o card pausado só volta com novo toque (os outros seguem a regra);
// - movimento reduzido: nada toca sozinho; o toque no card toca/pausa;
// - legendas opcionais (CC) por card, sobre o vídeo, a partir do .vtt — nada de transcrição fixa no layout;
// - desempenho: no meio do swipe nenhum vídeo começa (só pausam os que saem); cada card começa só com a capa (img lazy); o <video> sai do <template> só quando o card vai tocar
//   (ou quando o visitante pede som/legenda), e só esses baixam o arquivo (preload="none" até tocar).
import { motionAllowed } from './motion.js';

const VISIVEL = 0.55;   // fração do card na tela para tocar sozinho
const FORA = 0.2;       // abaixo disso o card conta como fora da tela (o audível só para aqui, não no meio do swipe)

/** @param {HTMLElement} root */
export function initCarrossel(root) {
  const trilho = /** @type {HTMLElement | null} */ (root.querySelector('[data-trilho]'));
  if (!trilho) return;
  const cards = /** @type {HTMLElement[]} */ ([...trilho.querySelectorAll('.story')]);
  if (!cards.length) return;
  /** @type {(HTMLVideoElement | null)[]} */
  const videos = cards.map(() => null);
  const fracao = cards.map(() => 0);
  const prev = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-prev]'));
  const next = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-next]'));
  const contador = /** @type {HTMLElement | null} */ (root.querySelector('[data-contador]'));
  const limite = () => 2;

  /** cards que o visitante pausou: não voltam a tocar sozinhos (o WebKit também bloquearia) */
  const pausados = new Set();
  /** cards que o visitante mandou tocar, o mais recente por último (valem mesmo com movimento reduzido) */
  /** @type {number[]} */
  let pedidos = [];
  let audivel = -1;
  /** cards que devem estar tocando agora (decisão do carrossel) */
  const devem = new Set();

  /** @param {number} i @param {boolean} tocando */
  const estado = (i, tocando) => {
    cards[i].dataset.state = tocando ? 'playing' : 'paused';
    cards[i].querySelector('.story__toggle')?.setAttribute('aria-pressed', String(tocando));
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
    // o WebKit do Playwright (e alguns WebKit antigos) param na volta do loop: se ninguém mandou pausar, segue tocando
    v.addEventListener('pause', () => { if (devem.has(i) && v.currentTime < 0.2) v.play().catch(() => estado(i, false)); });
    return v;
  };

  const marcarSom = () => cards.forEach((c, i) => {
    const ligado = i === audivel;
    c.toggleAttribute('data-som-ligado', ligado);
    const b = c.querySelector('[data-som]');
    if (!b) return;
    b.setAttribute('aria-pressed', String(ligado));
    b.setAttribute('aria-label', `${ligado ? 'Desativar' : 'Ativar'} o som do vídeo ${b.getAttribute('data-nome') ?? ''}`);
  });
  const silenciar = () => {
    if (audivel < 0) return;
    const v = videos[audivel];
    if (v) v.muted = true;
    audivel = -1;
    marcarSom();
  };

  /** @param {number} i */
  const tocar = (i) => {
    const v = video(i);
    if (!v) return;
    devem.add(i);
    v.muted = i !== audivel;
    if (v.preload !== 'auto') v.preload = 'auto';
    v.play().then(() => estado(i, true)).catch(() => { devem.delete(i); estado(i, false); if (i === audivel) silenciar(); });
  };
  /** @param {number} i */
  const parar = (i) => { devem.delete(i); videos[i]?.pause(); estado(i, false); };

  /** prioridade de quem toca quando há mais candidatos que o limite: o audível, depois os pedidos (o mais recente
   *  primeiro), depois a ordem na tela. @param {number} i */
  const peso = (i) => (i === audivel ? -1e3 : pedidos.includes(i) ? -pedidos.indexOf(i) - 1 : i);

  let rolando = false;
  /** Decide quem toca: os visíveis, até o limite; nunca o que o visitante pausou. */
  const decidir = () => {
    pedidos = pedidos.filter((i) => fracao[i] >= FORA);   // pedido vale enquanto o card está na tela
    const auto = motionAllowed();
    const tocam = cards.map((_, i) => i)
      .filter((i) => !pausados.has(i) && (fracao[i] >= VISIVEL || (i === audivel && fracao[i] >= FORA)))
      .filter((i) => auto || i === audivel || pedidos.includes(i))
      .sort((a, b) => peso(a) - peso(b) || a - b)
      .slice(0, limite());
    if (audivel >= 0 && !tocam.includes(audivel)) silenciar();   // saiu da tela ou foi pausado: o som para junto
    cards.forEach((_, i) => {
      const v = videos[i];
      // no meio do swipe só pausa quem sai: quem entra começa quando o trilho assenta (iniciar um vídeo custa quadros)
      if (tocam.includes(i)) { if (!v || v.paused) { if (!rolando) tocar(i); } else v.muted = i !== audivel; }
      else if (v && !v.paused) parar(i);
    });
  };

  // Legendas opcionais (CC): o texto da fala atual sobre o vídeo, só no card em que o visitante ligou.
  /** @param {number} i @param {boolean} ligar */
  const legendas = (i, ligar) => {
    const el = /** @type {HTMLElement | null} */ (cards[i].querySelector('[data-legenda]'));
    const faixa = video(i)?.textTracks?.[0];
    cards[i].querySelector('[data-cc]')?.setAttribute('aria-pressed', String(ligar));
    if (!el || !faixa) return;
    el.hidden = !ligar;
    el.textContent = '';
    faixa.mode = ligar ? 'hidden' : 'disabled';
    faixa.oncuechange = ligar ? () => { el.textContent = /** @type {VTTCue | undefined} */ (faixa.activeCues?.[0])?.text ?? ''; } : null;
  };

  // Navegação: o ativo é o card mais perto do centro do trilho; setas e contador andam a partir dele.
  let ativo = 0;
  const centro = () => {
    const t = trilho.getBoundingClientRect();
    const meio = t.left + t.width / 2;
    let k = 0; let d = Infinity;
    cards.forEach((c, i) => { const r = c.getBoundingClientRect(); const dist = Math.abs(r.left + r.width / 2 - meio); if (dist < d) { d = dist; k = i; } });
    return k;
  };
  const atualizar = () => {
    const k = centro();
    if (k !== ativo || !cards[k].hasAttribute('data-ativo')) { cards.forEach((c, i) => c.toggleAttribute('data-ativo', i === k)); ativo = k; }
    if (prev) prev.disabled = ativo <= 0;
    if (next) next.disabled = ativo >= cards.length - 1;
    if (contador) contador.textContent = String(ativo + 1).padStart(2, '0');
  };
  /** centraliza o card i no trilho @param {number} i */
  const irPara = (i) => {
    const k = Math.max(0, Math.min(cards.length - 1, i));
    const t = trilho.getBoundingClientRect();
    const r = cards[k].getBoundingClientRect();
    const left = trilho.scrollLeft + r.left - t.left - (t.width - r.width) / 2;
    trilho.scrollTo({ left, behavior: motionAllowed() ? 'smooth' : 'auto' });
  };
  prev?.addEventListener('click', () => irPara(ativo - 1));
  next?.addEventListener('click', () => irPara(ativo + 1));
  atualizar();
  let raf = 0;
  let assentar = 0;
  const assentou = () => { clearTimeout(assentar); if (!rolando) return; rolando = false; decidir(); };
  trilho.addEventListener('scroll', () => {
    cancelAnimationFrame(raf); raf = requestAnimationFrame(atualizar);
    rolando = true; clearTimeout(assentar); assentar = window.setTimeout(assentou, 180);
  }, { passive: true });
  trilho.addEventListener('scrollend', assentou);

  cards.forEach((c, i) => {
    // Toque no card: toca/pausa; se ele está só com a ponta na tela, vem para dentro e toca.
    c.querySelector('.story__toggle')?.addEventListener('click', () => {
      const v = videos[i];
      if (v && !v.paused) { pausados.add(i); pedidos = pedidos.filter((k) => k !== i); }
      else {
        pausados.delete(i); pedidos = [...pedidos.filter((k) => k !== i), i];
        if (fracao[i] < VISIVEL) { irPara(i); fracao[i] = VISIVEL; }
        tocar(i);   // ainda dentro do gesto (Safari)
      }
      decidir();
    });
    // Som: liga só este (o anterior fica mudo); tocar de novo desliga. O play() roda dentro do gesto do visitante.
    c.querySelector('[data-som]')?.addEventListener('click', () => {
      if (audivel === i) { silenciar(); decidir(); return; }
      silenciar();
      audivel = i;
      pausados.delete(i); pedidos = [...pedidos.filter((k) => k !== i), i];
      if (fracao[i] < VISIVEL) { irPara(i); fracao[i] = VISIVEL; }
      marcarSom();
      tocar(i);
      decidir();
    });
    c.querySelector('[data-cc]')?.addEventListener('click', (e) => {
      const b = /** @type {HTMLElement} */ (e.currentTarget);
      legendas(i, b.getAttribute('aria-pressed') !== 'true');
    });
  });

  if ('IntersectionObserver' in window) {
    // a fração conta o recorte do trilho (rolagem lateral) e o da página (rolagem vertical)
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { fracao[cards.indexOf(/** @type {HTMLElement} */ (e.target))] = e.intersectionRatio; });
      atualizar();
      decidir();
    }, { threshold: [0, FORA, VISIVEL, 0.8, 1] });
    cards.forEach((c) => io.observe(c));
    // perto da tela (~1 tela antes): prepara os primeiros vídeos (só metadados), para o 1º quadro chegar logo
    const perto = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      perto.disconnect();
      if (!motionAllowed()) return;
      for (let i = 0; i < Math.min(limite(), cards.length); i++) { const v = video(i); if (v && v.preload === 'none') v.preload = 'metadata'; }
    }, { rootMargin: '100% 0px' });
    perto.observe(trilho);
  } else {
    fracao.fill(1);
  }
  window.addEventListener('ambar:motion', decidir);
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(atualizar); }, { passive: true });
}
