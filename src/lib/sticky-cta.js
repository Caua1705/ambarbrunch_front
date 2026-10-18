// @ts-check
// Âmbar Brunch — controles fixos: o botão grande “Reservar mesa” (base da tela) e o selo do menu (alto da tela).
// Regra do CTA (rodada final, pela POSIÇÃO DAS SEÇÕES, nunca por um valor fixo de rolagem):
//   escondido no hero, em Novo capítulo e em Para sua mesa; aparece quando “Direto da fornada” (`inicio`) chega a
//   ~60% da altura da tela e segue visível nas seções do meio; some na reserva (cobriria campos e o aceite) e no
//   rodapé; some também com o menu aberto, com um campo de texto em foco e durante a rolagem que o menu dispara
//   para outra seção (não pisca no caminho).
// Selo do menu: aparece quando o selo do hero sai da tela; some com o menu aberto.
// Sem `inicio` (páginas sem a seção), vale a regra antiga: o CTA aparece quando o botão de reserva do hero (`trigger`) sai.

const TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, select';

/**
 * @param {{ cta: HTMLElement | null, inicio?: Element | null, trigger?: Element | null, reserva?: Element | null,
 *           rodape?: Element | null, menuFixo?: HTMLElement | null, heroMenu?: Element | null, sheet?: HTMLDialogElement | null }} opts
 */
export function initDock({ cta, inicio = null, trigger = null, reserva = null, rodape = null, menuFixo = null, heroMenu = null, sheet = null }) {
  if (!cta || !(inicio || trigger) || !('IntersectionObserver' in window)) return;
  const s = { chegou: false, reserva: false, rodape: false, heroMenu: true, typing: false, sheet: false, navegando: false };

  /** @param {HTMLElement} el @param {boolean} show */
  const setVisible = (el, show) => {
    el.classList.toggle('is-visible', show);
    el.setAttribute('aria-hidden', String(!show));
    el.tabIndex = show ? 0 : -1;
  };
  const update = () => {
    setVisible(cta, s.chegou && !s.reserva && !s.rodape && !s.typing && !s.sheet && !s.navegando);
    if (menuFixo) setVisible(menuFixo, !s.heroMenu && !s.sheet);
  };

  if (inicio) {
    // a seção “chegou” quando o topo dela passa da linha a 60% da tela — e continua valendo depois que ela sai por cima.
    // Lido na rolagem (1 leitura por quadro), não por IntersectionObserver: num salto do rodapé ao topo a seção passa de
    // “fora por cima” a “fora por baixo” sem cruzar a tela, e o observer não avisa (o CTA ficava preso no hero).
    let raf = 0;
    const medir = () => {
      raf = 0;
      const chegou = inicio.getBoundingClientRect().top < window.innerHeight * 0.6;
      if (chegou !== s.chegou) { s.chegou = chegou; update(); }
    };
    const agendar = () => { if (!raf) raf = requestAnimationFrame(medir); };
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar, { passive: true });
    medir();
  } else if (trigger) {
    // “Na tela” = ao menos 60% do botão visível; um botão cortado na borda não conta.
    new IntersectionObserver(([e]) => { s.chegou = e.intersectionRatio < 0.6; update(); }, { threshold: [0, 0.6, 1] }).observe(trigger);
  }
  // A reserva é mais alta que a tela: conta como “na tela” quando ocupa ao menos 30% da altura visível (ou 240 px).
  if (reserva) new IntersectionObserver(([e]) => {
    s.reserva = e.intersectionRect.height >= Math.min(240, window.innerHeight * 0.3);
    update();
  }, { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1] }).observe(reserva);
  // rodapé: basta começar a aparecer (o botão não cobre logo nem assinatura)
  if (rodape) new IntersectionObserver(([e]) => { s.rodape = e.isIntersecting; update(); }, { threshold: 0 }).observe(rodape);
  if (menuFixo) {
    if (heroMenu) new IntersectionObserver(([e]) => { s.heroMenu = e.isIntersecting; update(); }, { threshold: 0 }).observe(heroMenu);
    else s.heroMenu = false;
  }

  // Teclado virtual aberto: o CTA sai para não cobrir o campo.
  document.addEventListener('focusin', (ev) => { if (/** @type {Element} */ (ev.target).matches?.(TYPING)) { s.typing = true; update(); } });
  document.addEventListener('focusout', (ev) => { if (/** @type {Element} */ (ev.target).matches?.(TYPING)) { s.typing = false; update(); } });

  if (sheet) {
    let fimNav = 0;
    const assentou = () => { clearTimeout(fimNav); if (!s.navegando) return; s.navegando = false; update(); };
    sheet.addEventListener('ambar:sheet', (ev) => {
      const { open, destino } = /** @type {CustomEvent} */ (ev).detail;
      s.sheet = open;
      // o menu mandou para outra seção: o CTA espera a rolagem assentar antes de decidir
      if (!open && destino) { s.navegando = true; clearTimeout(fimNav); fimNav = window.setTimeout(assentou, 1400); }
      update();
    });
    window.addEventListener('scrollend', assentou);
  }
  update();
}
