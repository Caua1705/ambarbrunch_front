// @ts-check
// Âmbar Brunch — “detalhes vivos” só onde se vê: áreas com [data-vivo] ganham data-visivel enquanto estão na tela,
// e o CSS (motion.css §3b) pausa os loops (boiar, selo girando, ponto pulsando) fora dela. Vários loops ao mesmo
// tempo pesavam na rolagem de celular intermediário; assim só os da tela atual rodam.
export function initVivo(scope = document) {
  const areas = scope.querySelectorAll('[data-vivo]');
  if (!('IntersectionObserver' in window)) { areas.forEach((a) => a.setAttribute('data-visivel', '')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => e.target.toggleAttribute('data-visivel', e.isIntersecting)));
  areas.forEach((a) => io.observe(a));
}
