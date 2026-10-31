// @ts-check
// Página interna /design-system/: lê os valores CALCULADOS pelo navegador (tokens, tipografia, contraste, breakpoints)
// e liga as demonstrações (rever animações, simular movimento reduzido, telas responsivas). Só existe nessa página.
import { initComandaPreview } from './comanda-preview.js';

const raiz = document.documentElement;
const $ = (/** @type {string} */ s, /** @type {ParentNode} */ r = document) => /** @type {HTMLElement[]} */ ([...r.querySelectorAll(s)]);
const css = (/** @type {string} */ nome) => getComputedStyle(raiz).getPropertyValue(nome).trim();

// Cores: normaliza qualquer valor CSS de cor para [r, g, b, a] usando o próprio navegador.
const tinta = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
/** @param {string} valor @returns {number[]} */
function rgba(valor) {
  tinta.fillStyle = '#000';
  tinta.fillStyle = valor;
  const v = tinta.fillStyle;
  if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(1);
  const m = v.match(/[\d.]+/g) ?? ['0', '0', '0', '1'];
  return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])];
}
/** @param {number[]} f @param {number[]} b */
const sobre = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
/** @param {number[]} c */
const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** @param {number[]} a @param {number[]} b */
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** @param {number[]} c */
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

function preencherCores() {
  $('[data-cor]').forEach((el) => {
    const v = css(/** @type {string} */ (el.dataset.cor));
    if (!v) return;
    const c = rgba(v);
    el.textContent = c[3] < 1 ? `${hex(c)} · ${Math.round(c[3] * 100)}% · rgb ${c.slice(0, 3).join(' ')}` : `${hex(c)} · rgb ${c.slice(0, 3).join(' ')}`;
  });
  $('[data-contraste]').forEach((el) => {
    const [f, b, base] = /** @type {string} */ (el.dataset.contraste).split('|');
    const fundoBase = base ? rgba(base) : null;
    let fundo = rgba(css(b));
    if (fundo[3] < 1) fundo = sobre(fundo, fundoBase ?? rgba(css('--cream')));
    const frente = sobre(rgba(css(f)), fundo);
    const r = razao(frente, fundo);
    const alvo = /** @type {HTMLElement} */ (el.querySelector('[data-razao]'));
    const nivel = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA grande' : 'falha';
    alvo.textContent = `${r.toFixed(2).replace('.', ',')}:1 · ${nivel}`;
    el.dataset.nivel = r >= 4.5 ? 'ok' : r >= 3 ? 'grande' : 'falha';
  });
  $('[data-token]').forEach((el) => { el.textContent = css(/** @type {string} */ (el.dataset.token)); });
}

// Tipografia: tamanho, entrelinha, peso, largura e família efetivos NESTA largura de tela.
function medirTipos() {
  $('[data-tipo]').forEach((el) => {
    const cs = getComputedStyle(el);
    const lh = cs.lineHeight === 'normal' ? 'normal' : `${(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2).replace(/0$/, '')}`;
    const medida = /** @type {HTMLElement | null} */ (el.parentElement?.querySelector('[data-medida]') ?? null);
    if (medida) medida.textContent = `${+parseFloat(cs.fontSize).toFixed(1)} px / ${lh} · ${cs.fontWeight} · ${cs.fontStretch} · ${cs.fontFamily.split(',')[0].replace(/"/g, '')}`;
  });
}

// Breakpoints e largura atual.
function medirTela() {
  const w = innerWidth;
  const faixa = w >= 960 ? 'desktop' : w >= 600 ? 'tablet' : 'mobile';
  $('[data-largura]').forEach((el) => { el.textContent = `${w} px · ${faixa}`; });
  $('[data-bp]').forEach((el) => el.toggleAttribute('data-ativo', matchMedia(/** @type {string} */ (el.dataset.bp)).matches));
}

// Navegação: categoria atual marcada; o chip ativo rola para dentro da barra (sem mexer na rolagem da página).
function navegar() {
  const links = new Map($('[data-nav]').map((a) => [a.dataset.nav, a]));
  const barra = document.querySelector('.ds-nav ol');
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      const a = links.get(e.target.id);
      if (!a || !barra) return;
      a.setAttribute('aria-current', 'true');
      barra.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $('.ds-sec').forEach((s) => io.observe(s));
}

// Rever uma revelação: tira o estado final e devolve no quadro seguinte (as transições reais fazem o resto).
function rever() {
  document.addEventListener('click', (ev) => {
    const b = /** @type {HTMLElement} */ (ev.target).closest?.('[data-rever]');
    if (!b) return;
    const alvos = $(/** @type {string} */ (/** @type {HTMLElement} */ (b).dataset.rever));
    // sem transição na volta ao estado inicial (nem nos filhos: linhas do título, traços)
    const todos = alvos.flatMap((el) => [el, .../** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll('*'))]);
    todos.forEach((el) => { el.style.transition = 'none'; });
    alvos.forEach((el) => el.classList.remove('is-in'));
    void document.body.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      todos.forEach((el) => { el.style.transition = ''; });
      alvos.forEach((el) => el.classList.add('is-in'));
    }));
  });
  // trilhos de curva e duração: alternam a posição da bolinha
  document.addEventListener('click', (ev) => { const t = /** @type {HTMLElement} */ (ev.target).closest?.('.ds-trilho'); if (t) t.classList.toggle('is-on'); });
}

// Movimento reduzido SIMULADO: liga as regras reais de @media (prefers-reduced-motion: reduce) trocando a condição
// para “all” no CSSOM (nesta página e nas telas em iframe). Nenhuma regra é duplicada.
/** @type {{ regra: CSSMediaRule, original: string }[]} */
let trocadas = [];
/** @param {Document} doc @param {boolean} ligar */
function reduzir(doc, ligar) {
  /** @param {CSSRuleList} regras */
  const andar = (regras) => {
    for (const r of regras) {
      const m = /** @type {CSSMediaRule} */ (r);
      if ('media' in r && 'conditionText' in r && /prefers-reduced-motion:\s*reduce/.test(m.conditionText)) {
        if (ligar) { trocadas.push({ regra: m, original: m.media.mediaText }); m.media.mediaText = 'all'; }
      } else if ('cssRules' in r && r.cssRules) andar(/** @type {CSSRuleList} */ (r.cssRules));
    }
  };
  if (ligar) for (const folha of doc.styleSheets) { try { andar(folha.cssRules); } catch { /* folha de outra origem */ } }
  doc.documentElement.toggleAttribute('data-sim-reduzido', ligar);
}
const iframes = () => /** @type {HTMLIFrameElement[]} */ ([...document.querySelectorAll('iframe')]);
function movimentoReduzido() {
  const botao = document.querySelector('[data-reduzido]');
  if (!botao) return;
  const aplicar = (/** @type {boolean} */ ligar) => {
    if (!ligar) { trocadas.forEach(({ regra, original }) => { regra.media.mediaText = original; }); trocadas = []; document.documentElement.removeAttribute('data-sim-reduzido'); }
    reduzir(document, ligar);
    iframes().forEach((f) => { try { if (f.contentDocument && ligar) reduzir(f.contentDocument, true); else if (f.contentWindow && !ligar) f.contentWindow.location.reload(); } catch { /* ainda carregando */ } });
    botao.setAttribute('aria-pressed', String(ligar));
  };
  botao.addEventListener('click', () => aplicar(botao.getAttribute('aria-pressed') !== 'true'));
  // telas que carregam depois herdam o modo
  iframes().forEach((f) => f.addEventListener('load', () => { if (botao.getAttribute('aria-pressed') === 'true' && f.contentDocument) reduzir(f.contentDocument, true); }));
}

// Telas: o site real num iframe da largura escolhida, em escala para caber.
function telas() {
  /** @param {HTMLElement} caixa */
  const encaixar = (caixa) => {
    const f = /** @type {HTMLIFrameElement} */ (caixa.querySelector('iframe'));
    const w = Number(caixa.dataset.w), h = Number(caixa.dataset.h);
    const s = Math.min(1, caixa.clientWidth / w);
    f.style.width = `${w}px`; f.style.height = `${h}px`; f.style.transform = `scale(${s})`;
    caixa.style.height = `${Math.round(h * s)}px`;
    const rot = caixa.id === 'frame-tela' ? document.querySelector('[data-tela-escala]') : null;
    if (rot) rot.textContent = s.toFixed(2).replace('.', ',');
  };
  // tela rolada até uma seção SEM âncora na URL (a âncora num iframe também rolaria esta página)
  iframes().filter((f) => f.dataset.rolar).forEach((f) => f.addEventListener('load', () => {
    const w = f.contentWindow, alvo = f.contentDocument?.querySelector(/** @type {string} */ (f.dataset.rolar));
    if (w && alvo) w.scrollTo(0, alvo.getBoundingClientRect().top + w.scrollY);
  }));
  const caixas = $('[data-frame]');
  const ro = new ResizeObserver((es) => es.forEach((e) => encaixar(/** @type {HTMLElement} */ (e.target))));
  caixas.forEach((c) => { encaixar(c); ro.observe(c); });

  const tela = /** @type {HTMLElement | null} */ (document.querySelector('#frame-tela'));
  if (!tela) return;
  const iframe = /** @type {HTMLIFrameElement} */ (tela.querySelector('iframe'));
  const abrir = /** @type {HTMLAnchorElement | null} */ (document.querySelector('[data-tela-abrir]'));
  const marcar = (/** @type {string} */ sel, /** @type {Element} */ b) => $(sel).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  document.addEventListener('click', (ev) => {
    const alvo = /** @type {HTMLElement} */ (ev.target);
    const bw = /** @type {HTMLElement | null} */ (alvo.closest('[data-tela-w]'));
    if (bw) {
      tela.dataset.w = /** @type {string} */ (bw.dataset.telaW); tela.dataset.h = /** @type {string} */ (bw.dataset.telaH);
      marcar('[data-tela-w]', bw); encaixar(tela);
      const r = document.querySelector('[data-tela-rotulo]'); if (r) r.textContent = `${bw.dataset.telaW} × ${bw.dataset.telaH}`;
    }
    const bu = /** @type {HTMLElement | null} */ (alvo.closest('[data-tela-url]'));
    if (bu) { iframe.src = /** @type {string} */ (bu.dataset.telaUrl); if (abrir) abrir.href = iframe.src; marcar('[data-tela-url]', bu); }
    const br = /** @type {HTMLElement | null} */ (alvo.closest('[data-recarregar]'));
    if (br) {
      const f = /** @type {HTMLIFrameElement | null} */ (document.querySelector(`${br.dataset.recarregar} iframe`));
      if (f) { f.contentWindow?.scrollTo(0, 0); const u = new URL(f.src, location.href); u.hash = ''; f.src = 'about:blank'; requestAnimationFrame(() => { f.src = u.pathname; }); }
    }
  });
}

// Estados da comanda: abas (setas do teclado também).
function abas() {
  const tabs = $('.ds-estados [role="tab"]');
  const escolher = (/** @type {HTMLElement} */ t, foco = false) => {
    tabs.forEach((x) => {
      const sel = x === t;
      x.setAttribute('aria-selected', String(sel)); x.tabIndex = sel ? 0 : -1;
      const p = document.getElementById(/** @type {string} */ (x.getAttribute('aria-controls')));
      if (p) p.hidden = !sel;
    });
    if (foco) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => escolher(t));
    t.addEventListener('keydown', (ev) => {
      const passo = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (passo) { ev.preventDefault(); escolher(tabs[(i + passo + tabs.length) % tabs.length], true); }
    });
  });
}

// Grade: margens e containers desenhados sobre a página.
function grade() {
  const b = document.querySelector('[data-grade]');
  b?.addEventListener('click', () => { const on = raiz.classList.toggle('ds-grade'); b.setAttribute('aria-pressed', String(on)); });
}

// Largura da Bricolage ao vivo (eixo wdth via font-stretch).
function largura() {
  const r = /** @type {HTMLInputElement | null} */ (document.querySelector('[data-largura-controle]'));
  const amostra = /** @type {HTMLElement | null} */ (document.querySelector('[data-largura-amostra]'));
  const saida = document.querySelector('[data-largura-valor]');
  r?.addEventListener('input', () => { if (amostra) amostra.style.fontStretch = `${r.value}%`; if (saida) saida.textContent = `${r.value}%`; });
}

function suporte() {
  const el = document.querySelector('[data-suporte-parallax]');
  if (el) el.textContent = CSS.supports('animation-timeline: view()')
    ? 'Este navegador tem parallax nativo (animation-timeline).'
    : 'Este navegador não tem animation-timeline: o parallax fica desligado (o site continua igual, só sem o efeito).';
}

let espera = 0;
const atualizar = () => { cancelAnimationFrame(espera); espera = requestAnimationFrame(() => { medirTela(); medirTipos(); preencherCores(); }); };
document.fonts.ready.then(atualizar);
addEventListener('resize', atualizar);
atualizar();
navegar();
rever();
movimentoReduzido();
telas();
abas();
grade();
largura();
suporte();
initComandaPreview(/** @type {Document} */ (/** @type {unknown} */ (document.querySelector('#componentes'))));
