// @ts-check
// Âmbar Brunch — navegação do cardápio completo: marca a categoria que está na tela e rola só a FAIXA de etiquetas para mantê-la visível.
// Regra única: a categoria da vez é a última seção cujo topo já passou de uma linha logo abaixo da barra. É medida a cada quadro de rolagem,
// então depende só da posição da página: é a mesma descendo ou subindo, e a altura das seções pode mudar à vontade.
// Ao tocar numa etiqueta, ela fica marcada até a rolagem parar (ou até a pessoa assumir a rolagem): as categorias do caminho não piscam.
// Usa scrollTo na faixa, não scrollIntoView, para nunca mexer na rolagem da página. Sem JS, as etiquetas são âncoras comuns.
import { motionAllowed } from './motion.js';

/** px abaixo da barra. Maior que a folga do scroll-margin-top (.categoria em cardapio.css): a seção de destino de um toque cruza a linha. */
const FOLGA = 24;
/** quadros seguidos sem movimento para dar a rolagem por terminada */
const QUADROS_PARADA = 12;

/** @param {HTMLElement} nav */
export function initCartaNav(nav) {
  const lista = /** @type {HTMLElement | null} */ (nav.querySelector('ul'));
  const carta = nav.parentElement;
  const links = new Map(/** @type {HTMLAnchorElement[]} */ ([...nav.querySelectorAll('a')]).map((a) => [a.hash.slice(1), a]));
  const secoes = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-carta-secao]')]);
  if (!lista || !carta || !secoes.length) return;

  let ativa = '';
  /** seção escolhida num toque, enquanto a rolagem até ela acontece */
  let alvo = '';
  let quadro = 0;
  let agendado = false;
  let tocandoFaixa = false;

  const linha = () => nav.getBoundingClientRect().bottom + FOLGA;

  const secaoDaVez = () => {
    const limite = linha();
    let atual = secoes[0];
    for (const s of secoes) {
      if (s.getBoundingClientRect().top > limite) break;
      atual = s;
    }
    return atual.id;
  };

  /** @param {HTMLAnchorElement} a @param {boolean} suave */
  const mostrarNaFaixa = (a, suave) => {
    if (tocandoFaixa) return;   // a pessoa está arrastando a faixa
    const faixa = lista.getBoundingClientRect();
    const etiqueta = a.getBoundingClientRect();
    if (etiqueta.left >= faixa.left && etiqueta.right <= faixa.right) return;
    const left = lista.scrollLeft + etiqueta.left - faixa.left - (faixa.width - etiqueta.width) / 2;
    lista.scrollTo({ left, behavior: suave && motionAllowed() ? 'smooth' : 'auto' });
  };

  /** @param {string} id @param {boolean} [suave] */
  const marcar = (id, suave = true) => {
    if (id === ativa) return;
    links.get(ativa)?.removeAttribute('aria-current');
    const link = links.get(id);
    link?.setAttribute('aria-current', 'true');
    ativa = id;
    if (link) mostrarNaFaixa(link, suave);
  };

  const atualizar = () => { if (!alvo) marcar(secaoDaVez()); };
  const agendar = () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; atualizar(); });
  };

  /** Acompanha a rolagem até o alvo: quando ela para, volta a valer a posição da página. */
  const acompanhar = () => {
    cancelAnimationFrame(quadro);
    let y = scrollY;
    let parados = 0;
    const passo = () => {
      parados = scrollY === y ? parados + 1 : 0;
      y = scrollY;
      if (parados < QUADROS_PARADA) { quadro = requestAnimationFrame(passo); return; }
      quadro = 0;
      document.documentElement.style.removeProperty('scroll-behavior');   // a chegada por link foi direta (pages/cardapio.astro)
      // seção visível que não chega à linha porque a página acabou: segue marcada até a próxima rolagem
      const topo = document.getElementById(alvo)?.getBoundingClientRect().top ?? 0;
      if (topo > linha() && topo < innerHeight) return;
      alvo = '';
      atualizar();
    };
    quadro = requestAnimationFrame(passo);
  };

  /** @param {string} id @param {boolean} [suave] */
  const irPara = (id, suave) => {
    alvo = id;
    marcar(id, suave);
    acompanhar();
  };

  /** A pessoa rolou por conta própria durante a rolagem até o alvo: a posição da página volta a mandar. @param {Event} ev */
  const assumir = (ev) => {
    if (!alvo || nav.contains(/** @type {Node} */ (ev.target))) return;
    cancelAnimationFrame(quadro);
    quadro = 0;
    alvo = '';
    agendar();
  };

  nav.addEventListener('click', (ev) => {
    const a = /** @type {HTMLElement} */ (ev.target).closest('a');
    if (a) irPara(a.hash.slice(1));
  });
  nav.addEventListener('touchstart', () => { tocandoFaixa = true; }, { passive: true });
  for (const fim of ['touchend', 'touchcancel']) nav.addEventListener(fim, () => { tocandoFaixa = false; }, { passive: true });

  for (const entrada of ['wheel', 'touchstart', 'keydown']) window.addEventListener(entrada, assumir, { passive: true });
  window.addEventListener('scroll', () => {
    if (alvo && !quadro) alvo = '';   // fim da página: a rolagem seguinte devolve a marcação à posição
    agendar();
  }, { passive: true });
  window.addEventListener('resize', agendar);
  window.addEventListener('pageshow', agendar);

  // altura real da barra para o scroll-margin-top, e qualquer mudança de altura da página (fonte, imagem, giro da tela) refaz a conta
  new ResizeObserver(() => {
    carta.style.setProperty('--carta-nav-altura', `${nav.offsetHeight}px`);
    agendar();
  }).observe(carta);

  const doEndereco = location.hash.slice(1);
  if (links.has(doEndereco)) irPara(doEndereco, false);
  else {
    document.documentElement.style.removeProperty('scroll-behavior');
    marcar(secaoDaVez(), false);
  }
}
