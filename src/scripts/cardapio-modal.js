// @ts-check
// Âmbar Brunch — modal do produto em /cardapio/: tocar em qualquer linha mostra a imagem ampliada, o nome, a descrição e o preço.
// Usa <dialog>: fica acima de tudo (barra fixa e doca inclusive), prende o foco, fecha com Esc e devolve o foco à linha ao fechar. O texto vem da
// própria linha, que veio do catálogo oficial no build, e a imagem grande sai de um <template> só ao abrir: nada dela baixa antes do toque.
// A moldura já nasce com a proporção do arquivo: a miniatura serve de prévia na mesma geometria e a imagem grande entra por cima, sem mudar o tamanho
// do modal. Com o modal aberto a página não rola (html:has(...) em cardapio.css), então a posição da lista não muda.

/** o segundo toque de um toque duplo cai no fundo logo depois de abrir e não pode fechar o modal */
const ESPERA_DUPLO_TOQUE = 350;

/** @param {HTMLElement} carta */
export function initProdutoModal(carta) {
  const modal = /** @type {HTMLDialogElement | null} */ (carta.querySelector('[data-produto-modal]'));
  if (!modal?.showModal) return;
  const foto = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-foto]'));
  const nome = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-nome]'));
  const descricao = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-descricao]'));
  const preco = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-preco]'));
  /** imagem de cada linha: reabrir reaproveita o mesmo elemento, sem baixar nem decodificar de novo @type {WeakMap<HTMLElement, HTMLElement>} */
  const quadros = new WeakMap();
  let abertoEm = 0;
  let pressaoNoFundo = false;

  /** @param {HTMLElement} linha @returns {HTMLElement | null} */
  const quadroDa = (linha) => {
    const pronto = quadros.get(linha);
    if (pronto) return pronto;
    const molde = /** @type {HTMLTemplateElement | null} */ (linha.querySelector('template'));
    const quadro = /** @type {HTMLElement | null} */ (molde && document.importNode(molde.content, true).firstElementChild);
    const img = quadro?.querySelector('img');
    if (!quadro || !img) return null;
    quadros.set(linha, quadro);
    img.addEventListener('load', () => {
      // só aparece depois de decodificada: nada de imagem pela metade nem piscada no fade
      img.decode().catch(() => {}).finally(() => {
        quadro.removeAttribute('data-carregando');
        quadro.setAttribute('data-pronta', '');
      });
    }, { once: true });
    img.addEventListener('error', () => {
      // sem rede: fica a prévia, para de indicar carregamento e a próxima abertura tenta de novo
      quadro.removeAttribute('data-carregando');
      quadros.delete(linha);
    }, { once: true });
    return quadro;
  };

  /** @param {HTMLElement} linha */
  const abrir = (linha) => {
    nome.textContent = linha.querySelector('h3')?.textContent ?? '';
    const texto = linha.querySelector('.prato__texto p')?.textContent ?? '';
    descricao.textContent = texto;
    descricao.hidden = !texto;
    preco.textContent = linha.querySelector('.prato__preco')?.textContent ?? '';

    const quadro = quadroDa(linha);
    foto.hidden = !quadro;
    foto.replaceChildren(quadro ?? '');
    // a miniatura já está na tela: serve de prévia enquanto a imagem grande baixa
    const mini = /** @type {HTMLImageElement | null} */ (linha.querySelector('.prato__foto img'));
    if (quadro && mini?.complete && mini.currentSrc) quadro.style.setProperty('--miniatura', `url("${mini.currentSrc}")`);

    abertoEm = performance.now();
    modal.showModal();
    modal.scrollTop = 0;
  };

  carta.addEventListener('click', (ev) => {
    const botao = /** @type {HTMLElement} */ (ev.target).closest('[data-abrir-produto]');
    const linha = /** @type {HTMLElement | null} */ (botao?.closest('.prato') ?? null);
    if (linha) abrir(linha);
  });

  /** fora da caixa de verdade: a barra de rolagem do modal também tem o <dialog> como alvo @param {MouseEvent} ev */
  const noFundo = (ev) => {
    if (ev.target !== modal) return false;
    const r = modal.getBoundingClientRect();
    return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
  };
  // só fecha se o gesto começou no fundo: arrastar um texto para fora da caixa não é fechar
  modal.addEventListener('pointerdown', (ev) => { pressaoNoFundo = noFundo(ev); });
  modal.addEventListener('click', (ev) => {
    if (/** @type {HTMLElement} */ (ev.target).closest('[data-modal-fechar]')) modal.close();
    else if (pressaoNoFundo && noFundo(ev) && performance.now() - abertoEm > ESPERA_DUPLO_TOQUE) modal.close();
    pressaoNoFundo = false;
  });
  // o evento close é assíncrono: se outro produto já abriu, a imagem no modal é a dele
  modal.addEventListener('close', () => { if (!modal.open) foto.replaceChildren(); });
  // iPhone: um dedo sobre o fundo, ou sobre um modal que não precisa rolar, não pode arrastar a página. Pinça segue livre.
  modal.addEventListener('touchmove', (ev) => {
    if (ev.touches.length === 1 && (ev.target === modal || modal.scrollHeight <= modal.clientHeight)) ev.preventDefault();
  }, { passive: false });
}
