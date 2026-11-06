// @ts-check
// Âmbar Brunch — modal do produto em /cardapio/: tocar em qualquer linha mostra a imagem ampliada, o nome, a descrição e o preço.
// Usa <dialog>: fica acima de tudo (barra fixa e doca inclusive), prende o foco, fecha com Esc e devolve o foco à linha ao fechar. O texto vem da
// própria linha, que veio do catálogo oficial no build, e a imagem grande sai de um <template> só ao abrir: nada dela baixa antes do toque.
// Com o modal aberto a página não rola (html:has(...) em cardapio.css), então a posição da lista não muda.

/** @param {HTMLElement} carta */
export function initProdutoModal(carta) {
  const modal = /** @type {HTMLDialogElement | null} */ (carta.querySelector('[data-produto-modal]'));
  if (!modal?.showModal) return;
  const foto = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-foto]'));
  const nome = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-nome]'));
  const descricao = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-descricao]'));
  const preco = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-preco]'));

  /** @param {HTMLElement} linha */
  const abrir = (linha) => {
    nome.textContent = linha.querySelector('h3')?.textContent ?? '';
    const texto = linha.querySelector('.prato__texto p')?.textContent ?? '';
    descricao.textContent = texto;
    descricao.hidden = !texto;
    preco.textContent = linha.querySelector('.prato__preco')?.textContent ?? '';

    const molde = /** @type {HTMLTemplateElement | null} */ (linha.querySelector('template'));
    foto.hidden = !molde;
    foto.replaceChildren(molde ? molde.content.cloneNode(true) : '');
    // a miniatura já está na tela: serve de prévia enquanto a imagem grande baixa
    const grande = foto.querySelector('img');
    const mini = /** @type {HTMLImageElement | null} */ (linha.querySelector('.prato__foto img'));
    if (grande && mini?.currentSrc) grande.style.background = `center / cover no-repeat url("${mini.currentSrc}")`;

    modal.showModal();
    modal.scrollTop = 0;
  };

  carta.addEventListener('click', (ev) => {
    const botao = /** @type {HTMLElement} */ (ev.target).closest('[data-abrir-produto]');
    const linha = /** @type {HTMLElement | null} */ (botao?.closest('.prato') ?? null);
    if (linha) abrir(linha);
  });
  // o alvo só é o próprio <dialog> no fundo escurecido: dentro da caixa, o alvo é sempre um filho
  modal.addEventListener('click', (ev) => {
    const alvo = /** @type {HTMLElement} */ (ev.target);
    if (alvo === modal || alvo.closest('[data-modal-fechar]')) modal.close();
  });
  modal.addEventListener('close', () => foto.replaceChildren());
}
