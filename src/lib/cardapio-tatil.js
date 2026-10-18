// @ts-check
// Âmbar Brunch — cardápio tátil: a etiqueta abre o cartão do seu grupo; tocar de novo (ou ×, ou Esc) fecha.
// Um cartão aberto por grupo; trocar de etiqueta troca o conteúdo sem fechar (o conteúdo novo entra com um esmaecimento
// curto). A entrada é CSS (@keyframes, que recomeçam sozinhas quando o conteúdo aparece).
// A SAÍDA (ajuste final de 2026-10-18) é o espelho da entrada: o papel se dobra de volta para cima (o recorte sobe, a
// opacidade some no fim) enquanto a altura do cartão encolhe junto — o que vem abaixo sobe deslizando, sem salto —,
// e só no fim o cartão vira hidden. Duração e curva vêm dos tokens (--fechar-dur/--fechar-curva em bands.css).
// Reabrir no meio da saída cancela a saída e desdobra de novo. Abas (doces | salgados) dentro do cartão: sem JS, os dois
// grupos aparecem um embaixo do outro. Movimento reduzido: tudo direto.
import { motionAllowed } from './motion.js';

/** @param {string} v duração CSS (“320ms” ou “.32s”) */
const ms = (v) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000) || 0;

/** @param {HTMLElement} root */
export function initCardapioTatil(root) {
  /** @type {WeakMap<HTMLElement, Animation[]>} */
  const saidas = new WeakMap();
  /** interrompe a saída em andamento (se houver) e devolve o cartão ao estado de repouso @param {HTMLElement} painel */
  const interromper = (painel) => {
    saidas.get(painel)?.forEach((a) => a.cancel());
    saidas.delete(painel);
    painel.removeAttribute('data-fechando');
  };
  /** @param {HTMLElement} painel */
  const fechar = (painel) => {
    if (painel.hasAttribute('data-fechando')) return;   // já está se dobrando (ex.: Esc duas vezes)
    const dentro = /** @type {HTMLElement | null} */ (painel.querySelector('.cartao__dentro'));
    const cs = getComputedStyle(painel);
    const dur = ms(cs.getPropertyValue('--fechar-dur'));
    if (!motionAllowed() || painel.hidden || !dentro || !dur || !painel.animate) { interromper(painel); painel.hidden = true; return; }
    interromper(painel);
    painel.setAttribute('data-fechando', '');
    const opcoes = { duration: dur, easing: cs.getPropertyValue('--fechar-curva').trim() || 'ease', fill: /** @type {const} */ ('forwards') };
    const anims = [
      painel.animate([{ height: `${painel.offsetHeight}px`, marginTop: cs.marginTop }, { height: '0px', marginTop: '0px' }], opcoes),
      dentro.animate([
        { opacity: 1, clipPath: 'inset(-40px -20px -20px -20px)', transform: 'none' },
        { opacity: 1, offset: 0.55 },
        { opacity: 0, clipPath: 'inset(-40px -20px 100% -20px)', transform: 'translateY(-6px) rotate(-1.2deg)' },
      ], opcoes),
    ];
    saidas.set(painel, anims);
    Promise.all(anims.map((a) => a.finished)).then(() => {
      if (saidas.get(painel) !== anims) return;
      painel.hidden = true;
      interromper(painel);
    }, () => { /* cancelada: o cartão foi reaberto */ });
  };

  /** @param {HTMLElement} painel @param {HTMLButtonElement | null} ativo */
  const mostrar = (painel, ativo) => {
    const grupo = root.querySelectorAll(`[aria-controls="${painel.id}"]`);
    grupo.forEach((b) => b.setAttribute('aria-expanded', String(b === ativo)));
    if (!ativo) { fechar(painel); return; }
    // reaberto no meio da saída: cancela a saída e o papel se desdobra de novo (a entrada CSS recomeça)
    if (painel.hasAttribute('data-fechando')) { interromper(painel); painel.hidden = true; void painel.offsetWidth; }
    const trocando = !painel.hidden;
    const cat = ativo.dataset.categoria;
    painel.toggleAttribute('data-trocando', trocando);
    painel.querySelectorAll('[data-cat]').forEach((a) => { /** @type {HTMLElement} */ (a).hidden = /** @type {HTMLElement} */ (a).dataset.cat !== cat; });
    painel.hidden = false;
    // traz o cartão para a tela se ele abriu fora dela (sem sequestrar a rolagem)
    const r = painel.getBoundingClientRect();
    if (r.top > innerHeight - 140) painel.scrollIntoView({ block: 'nearest', behavior: motionAllowed() ? 'smooth' : 'auto' });
  };

  root.addEventListener('click', (ev) => {
    const alvo = /** @type {HTMLElement} */ (ev.target);
    const botao = /** @type {HTMLButtonElement | null} */ (alvo.closest('.bands__tap'));
    if (botao) {
      const painel = /** @type {HTMLElement} */ (document.getElementById(botao.getAttribute('aria-controls') ?? ''));
      mostrar(painel, botao.getAttribute('aria-expanded') === 'true' ? null : botao);
      root.setAttribute('data-tocado', '');   // o convite do 1º indicador “+” para de pulsar
      return;
    }
    const aba = /** @type {HTMLButtonElement | null} */ (alvo.closest('[role="tab"]'));
    if (aba) { escolherAba(aba); return; }
    const fechar = alvo.closest('[data-fechar]');
    if (fechar) {
      const painel = /** @type {HTMLElement} */ (fechar.closest('[data-painel]'));
      const dono = /** @type {HTMLButtonElement | null} */ (root.querySelector(`[aria-controls="${painel.id}"][aria-expanded="true"]`));
      mostrar(painel, null);
      dono?.focus();
    }
  });

  // Abas (padrão WAI-ARIA: setas trocam, só a aba ativa entra no Tab)
  /** @param {HTMLButtonElement} aba */
  const escolherAba = (aba) => {
    const lista = /** @type {HTMLElement} */ (aba.closest('[role="tablist"]'));
    lista.querySelectorAll('[role="tab"]').forEach((t) => {
      const sel = t === aba;
      t.setAttribute('aria-selected', String(sel));
      t.setAttribute('tabindex', sel ? '0' : '-1');
      const p = document.getElementById(t.getAttribute('aria-controls') ?? '');
      if (p) p.hidden = !sel;
    });
  };
  root.querySelectorAll('[data-abas]').forEach((lista) => {
    /** @type {HTMLElement} */ (lista).hidden = false;
    const abas = /** @type {HTMLButtonElement[]} */ ([...lista.querySelectorAll('[role="tab"]')]);
    const sel = abas.find((a) => a.getAttribute('aria-selected') === 'true') ?? abas[0];
    if (sel) escolherAba(sel);
    lista.addEventListener('keydown', (ev) => {
      const e = /** @type {KeyboardEvent} */ (ev);
      const i = abas.indexOf(/** @type {HTMLButtonElement} */ (e.target));
      if (i < 0) return;
      const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? abas.length - 1 : null;
      if (n === null) return;
      e.preventDefault();
      const prox = abas[(n + abas.length) % abas.length];
      escolherAba(prox);
      prox.focus();
    });
  });

  // Esc no documento: no Safari o toque/clique num botão não lhe dá foco, então o evento não nasce dentro do cardápio
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const alvo = /** @type {HTMLElement} */ (ev.target);
    const painel = /** @type {HTMLElement | null} */ (alvo.closest?.('[data-painel]') ?? null);
    const aberto = painel ?? /** @type {HTMLElement | null} */ (root.querySelector('[data-painel]:not([hidden])'));
    if (!aberto) return;
    const dono = /** @type {HTMLButtonElement | null} */ (root.querySelector(`[aria-controls="${aberto.id}"][aria-expanded="true"]`));
    mostrar(aberto, null);
    dono?.focus();
  });
}
