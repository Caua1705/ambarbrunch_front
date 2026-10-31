// @ts-check
// Âmbar Brunch — “Direto da fornada”: o divisor acima dos vídeos da Roll vira o progresso do carrossel.
// --p (0 a 1) = posição horizontal do trilho entre a primeira e a última posição possível, interpolada entre os pontos
// de encaixe de cada vídeo: assim cada vídeo vale um passo igual (com 3 vídeos o fio marca 1/3, 2/3 e cheio), mesmo o
// último encaixando antes do fim da rolagem. Acompanha o dedo no arraste (contínuo, sem pular de estado), o encaixe do
// scroll-snap e qualquer outro jeito de rolar (teclado, leitor de tela). O tempo dos vídeos não entra na conta.
// Uma leitura por quadro (rAF) só quando o trilho rola; as posições de encaixe só são medidas no início e ao mudar o
// tamanho da tela. Nada na rolagem vertical. Sem transição própria: o movimento é o da rolagem (movimento reduzido incluso).

/** @param {HTMLElement | null} fita @param {HTMLElement | null} trilho */
export function initFita(fita, trilho) {
  if (!fita || !trilho) return;
  const cards = /** @type {HTMLElement[]} */ ([...trilho.children]);
  /** @type {number[]} */
  let pontos = [];
  let raf = 0;

  // posição de rolagem em que cada vídeo encaixa (scroll-snap no início, com o scroll-padding), limitada ao fim do trilho
  const medirPontos = () => {
    const max = trilho.scrollWidth - trilho.clientWidth;
    const pad = parseFloat(getComputedStyle(trilho).scrollPaddingLeft) || 0;
    const t = trilho.getBoundingClientRect().left;
    pontos = cards.map((c) => Math.min(max, Math.max(0, c.getBoundingClientRect().left - t + trilho.scrollLeft - pad)));
    fita.toggleAttribute('data-sem-rolagem', max < 2 || cards.length < 2);
  };
  const pintar = () => {
    raf = 0;
    const x = trilho.scrollLeft;
    const n = pontos.length;
    if (n < 2) return;
    let k = 0;
    while (k < n - 2 && x > pontos[k + 1]) k++;
    const trecho = pontos[k + 1] - pontos[k];
    const f = trecho > 0 ? Math.min(1, Math.max(0, (x - pontos[k]) / trecho)) : 1;
    fita.style.setProperty('--p', ((k + f) / (n - 1)).toFixed(4));
  };
  const agendar = () => { if (!raf) raf = requestAnimationFrame(pintar); };
  trilho.addEventListener('scroll', agendar, { passive: true });
  window.addEventListener('resize', () => { medirPontos(); agendar(); }, { passive: true });
  medirPontos();
  pintar();
}
