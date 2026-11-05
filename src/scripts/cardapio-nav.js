// @ts-check
// Âmbar Brunch — navegação do cardápio completo: marca a categoria que está na tela e rola só a FAIXA de etiquetas para mantê-la visível.
// Usa scrollTo na faixa, não scrollIntoView, para nunca mexer na rolagem da página. Sem JS, as etiquetas são âncoras comuns.

/** @param {HTMLElement} nav */
export function initCartaNav(nav) {
  const lista = /** @type {HTMLElement | null} */ (nav.querySelector('ul'));
  const links = /** @type {HTMLAnchorElement[]} */ ([...nav.querySelectorAll('a')]);
  const secoes = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-carta-secao]')]);
  if (!lista || !secoes.length || !('IntersectionObserver' in window)) return;

  /** @param {string} id */
  const marcar = (id) => {
    links.forEach((a) => {
      const ativo = a.getAttribute('href') === `#${id}`;
      if (ativo) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      if (ativo) lista.scrollTo({ left: a.offsetLeft - (lista.clientWidth - a.offsetWidth) / 2, behavior: 'auto' });
    });
  };

  // faixa estreita logo abaixo da navegação: a seção que passa por ela é a da vez
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) marcar(e.target.id); });
  }, { rootMargin: '-96px 0px -70% 0px' });
  secoes.forEach((s) => obs.observe(s));
}
