// @ts-check
// Âmbar Brunch — abertura de “Direto da fornada”: a espiral de caramelo (vídeo decorativo de 8 s) em volta suave.
// - o <video> sai do <template> só quando a seção chega a ~1 tela (nada baixa no carregamento da página);
// - toca mudo quando a janela está ≥ 60% visível; sai da tela, pausa; volta, continua de onde parou;
// - o 1º e o último quadro não se emendam: perto do fim o vídeo esmaece sobre a capa, recomeça e reaparece
//   (data-voltando) — sem salto visível e sem botão;
// - o fio de caramelo (SVG, até “…e vira roll de verdade”) se desenha COM A ROLAGEM (ajuste final de 2026-10-18): antes
//   ele seguia o tempo do vídeo e congelava no meio quando o vídeo pausava ao sair da tela. Agora vai de vazio (topo do
//   fio a 90% da altura da tela) a inteiro (fim do fio a 45%), contínuo e nos dois sentidos, independente do vídeo;
// - movimento reduzido: fica a capa e o fio inteiro, sem vídeo; economia de dados ou reprodução bloqueada: sem vídeo
//   (o fio continua acompanhando a rolagem).
import { motionAllowed } from './motion.js';

const PONTE = 0.9;      // segundos antes do fim em que a volta começa (≈ a transição da capa, --dur-espiral-fade)
const FIO_INICIO = 0.9; // fração da altura da tela em que o topo do fio está quando ele começa a se desenhar…
const FIO_FIM = 0.45;   // …e em que o fim do fio está quando ele fica inteiro

/** @param {HTMLElement} root */
export function initEspiral(root) {
  const janela = /** @type {HTMLElement | null} */ (root.querySelector('.abertura__janela'));
  const tpl = /** @type {HTMLTemplateElement | null} */ (root.querySelector('template[data-video]'));
  if (!janela || !tpl) return;
  initFio(root);

  const estatico = () => root.setAttribute('data-estatico', '');
  const conexao = /** @type {{ saveData?: boolean } | undefined} */ (/** @type {any} */ (navigator).connection);
  if (!motionAllowed() || conexao?.saveData || !('IntersectionObserver' in window)) { estatico(); return; }

  /** @type {HTMLVideoElement | null} */
  let v = null;
  let visivel = false;
  let voltando = false;

  const criar = () => {
    if (v) return v;
    const novo = /** @type {HTMLVideoElement} */ (tpl.content.firstElementChild?.cloneNode(true));
    tpl.replaceWith(novo);
    novo.addEventListener('playing', () => {
      root.setAttribute('data-tocando', '');
      root.removeAttribute('data-voltando');
      voltando = false;
    });
    novo.addEventListener('timeupdate', () => {
      if (voltando || !novo.duration || novo.currentTime < novo.duration - PONTE) return;
      voltando = true;
      root.setAttribute('data-voltando', '');
      root.removeAttribute('data-tocando');   // a capa volta por cima enquanto o vídeo esmaece
    });
    novo.addEventListener('ended', () => {
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

/**
 * O fio de caramelo ligado à rolagem: escreve stroke-dashoffset (1 = vazio, 0 = inteiro; o path tem pathLength="1").
 * Um rAF por quadro de rolagem, só enquanto o fio está perto da tela; fora dela fica no estado do lado em que saiu.
 * @param {HTMLElement} root
 */
function initFio(root) {
  const svg = /** @type {SVGSVGElement | null} */ (root.querySelector('.abertura__fio'));
  const fio = svg?.querySelector('path');
  if (!svg || !fio) return;
  let raf = 0;
  let ligado = false;
  const aplicar = () => {
    raf = 0;
    if (!motionAllowed()) { fio.style.strokeDashoffset = '0'; return; }
    const r = svg.getBoundingClientRect();
    const h = innerHeight;
    const p = Math.min(1, Math.max(0, (h * FIO_INICIO - r.top) / (h * (FIO_INICIO - FIO_FIM) + r.height)));
    fio.style.strokeDashoffset = (1 - p).toFixed(4);
  };
  const rolar = () => { if (!raf) raf = requestAnimationFrame(aplicar); };
  if (!('IntersectionObserver' in window)) { fio.style.strokeDashoffset = '0'; return; }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !ligado) { ligado = true; window.addEventListener('scroll', rolar, { passive: true }); }
    else if (!e.isIntersecting && ligado) { ligado = false; window.removeEventListener('scroll', rolar); }
    rolar();   // entrando ou saindo: pinta o estado exato daquele lado (nada fica no meio)
  }, { rootMargin: '25% 0px' }).observe(svg);
  window.addEventListener('resize', rolar, { passive: true });
  window.addEventListener('ambar:motion', rolar);
  aplicar();
}
