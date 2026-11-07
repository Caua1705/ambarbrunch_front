// @ts-check
// Âmbar Brunch — modal do produto em /cardapio/: tocar em qualquer linha mostra a imagem ampliada, o nome, a descrição e o preço.
// Usa <dialog>: fica acima de tudo (barra fixa e doca inclusive), prende o foco, fecha com Esc e devolve o foco à linha ao fechar. O texto vem da
// própria linha, que veio do catálogo oficial no build, e a imagem grande sai de um <template>.
// O modal só abre com a imagem definitiva baixada e decodificada: nunca mostra prévia nem carregamento. As imagens das linhas perto da tela são
// adiantadas aos poucos, depois do carregamento da página; se o toque chegar antes, a espera aparece na própria linha.
// Com o modal aberto a página não rola (html:has(...) em cardapio.css), então a posição da lista não muda.

/** o segundo toque de um toque duplo cai no fundo logo depois de abrir e não pode fechar o modal */
const ESPERA_DUPLO_TOQUE = 350;
/** sem resposta depois disso, o modal abre só com o texto: a linha nunca fica carregando para sempre */
const ESPERA_MAXIMA = 12000;
/** quantas imagens grandes ficam guardadas: as mais antigas saem, para não acumular memória */
const LIMITE_IMAGENS = 24;
const PERTO_DA_TELA = '240px 0px';
/** só adianta depois que a rolagem assenta: passar pela lista não baixa o que ficou para trás */
const ASSENTAR_ROLAGEM = 200;

/** @typedef {{ quadro: HTMLElement, img: HTMLImageElement, baixada: Promise<boolean> }} Entrada */

/** @param {HTMLElement} carta */
export function initProdutoModal(carta) {
  const modal = /** @type {HTMLDialogElement | null} */ (carta.querySelector('[data-produto-modal]'));
  if (!modal?.showModal) return;
  const foto = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-foto]'));
  const nome = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-nome]'));
  const descricao = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-descricao]'));
  const preco = /** @type {HTMLElement} */ (modal.querySelector('[data-modal-preco]'));
  /** imagem de cada linha, da mais antiga para a mais recente: reabrir reaproveita o mesmo elemento @type {Map<HTMLElement, Entrada>} */
  const imagens = new Map();
  /** linhas perto da tela, candidatas a adiantar @type {Set<HTMLElement>} */
  const perto = new Set();
  /** linha que espera a imagem para abrir @type {HTMLElement | null} */
  let pedido = null;
  let adiantando = 0;
  let liberado = false;
  let abertoEm = 0;
  let pressaoNoFundo = false;

  /** tira a imagem mais antiga que não esteja em uso @returns {boolean} */
  const liberarEspaco = () => {
    for (const linha of imagens.keys()) {
      if (linha === pedido || perto.has(linha) || imagens.get(linha)?.quadro.isConnected) continue;
      imagens.delete(linha);
      return true;
    }
    return false;
  };

  /** começa a baixar a imagem da linha, uma vez só @param {HTMLElement} linha @param {'high' | 'low'} prioridade @returns {Entrada | null} */
  const imagemDa = (linha, prioridade) => {
    const pronta = imagens.get(linha);
    if (pronta) {
      pronta.img.fetchPriority = prioridade;
      return pronta;
    }
    const molde = /** @type {HTMLTemplateElement | null} */ (linha.querySelector('template'));
    const quadro = /** @type {HTMLElement | null} */ (molde && document.importNode(molde.content, true).firstElementChild);
    const img = quadro?.querySelector('img');
    if (!quadro || !img) return null;
    img.fetchPriority = prioridade;
    img.decoding = 'sync';
    const baixada = new Promise((fim) => {
      img.addEventListener('load', () => fim(true), { once: true });
      img.addEventListener('error', () => {
        // a próxima abertura tenta de novo
        if (imagens.get(linha)?.img === img) imagens.delete(linha);
        fim(false);
      }, { once: true });
    });
    imagens.set(linha, { quadro, img, baixada });
    if (imagens.size > LIMITE_IMAGENS) liberarEspaco();
    return /** @type {Entrada} */ (imagens.get(linha));
  };

  /** adianta as imagens perto da tela, uma por vez em rede lenta */
  const adiantar = () => {
    const conexao = /** @type {{ effectiveType?: string } | undefined} */ (/** @type {any} */ (navigator).connection);
    const simultaneas = !conexao?.effectiveType || conexao.effectiveType === '4g' ? 2 : 1;
    while (liberado && !pedido && adiantando < simultaneas) {
      const linha = [...perto].find((l) => !imagens.has(l));
      if (!linha || (imagens.size >= LIMITE_IMAGENS && !liberarEspaco())) return;
      const entrada = imagemDa(linha, 'low');
      if (!entrada) { perto.delete(linha); continue; }
      adiantando++;
      entrada.baixada.then(() => { adiantando--; adiantar(); });
    }
  };

  const conexao = /** @type {{ saveData?: boolean, effectiveType?: string } | undefined} */ (/** @type {any} */ (navigator).connection);
  if ('IntersectionObserver' in window && !conexao?.saveData && !/2g/.test(conexao?.effectiveType ?? '')) {
    let espera = 0;
    const observador = new IntersectionObserver((itens) => {
      for (const i of itens) {
        const linha = /** @type {HTMLElement} */ (i.target);
        if (i.isIntersecting) perto.add(linha);
        else perto.delete(linha);
      }
      clearTimeout(espera);
      espera = window.setTimeout(adiantar, ASSENTAR_ROLAGEM);
    }, { rootMargin: PERTO_DA_TELA });
    carta.querySelectorAll('.prato:has(template)').forEach((l) => observador.observe(l));
    // a primeira tela vem antes: só adianta com a página carregada e o navegador livre
    const liberar = () => { liberado = true; adiantar(); };
    const quandoLivre = () => ('requestIdleCallback' in window ? requestIdleCallback(liberar, { timeout: 2000 }) : setTimeout(liberar, 1000));
    if (document.readyState === 'complete') quandoLivre();
    else addEventListener('load', quandoLivre, { once: true });
  }

  const pararEspera = () => {
    pedido?.removeAttribute('data-abrindo');
    pedido?.querySelector('[data-abrir-produto]')?.removeAttribute('aria-busy');
    pedido = null;
  };

  /** só chega aqui com a imagem decodificada, ou sem imagem nenhuma @param {HTMLElement} linha @param {Entrada | null} entrada */
  const mostrar = (linha, entrada) => {
    nome.textContent = linha.querySelector('h3')?.textContent ?? '';
    const texto = linha.querySelector('.prato__texto p')?.textContent ?? '';
    descricao.textContent = texto;
    descricao.hidden = !texto;
    preco.textContent = linha.querySelector('.prato__preco')?.textContent ?? '';
    foto.hidden = !entrada;
    foto.replaceChildren(entrada?.quadro ?? '');
    abertoEm = performance.now();
    modal.showModal();
    modal.scrollTop = 0;
  };

  /** @param {HTMLElement} linha */
  const abrir = async (linha) => {
    if (pedido === linha) return;
    pararEspera();
    const entrada = imagemDa(linha, 'high');
    if (!entrada) { mostrar(linha, null); return; }
    pedido = linha;
    // a mais usada fica por último: é a última a sair da memória
    imagens.delete(linha);
    imagens.set(linha, entrada);
    linha.setAttribute('data-abrindo', '');
    linha.querySelector('[data-abrir-produto]')?.setAttribute('aria-busy', 'true');
    const pronta = await Promise.race([
      entrada.baixada.then((ok) => ok && entrada.img.decode().then(() => true, () => false)),
      new Promise((fim) => setTimeout(fim, ESPERA_MAXIMA, false)),
    ]);
    if (pedido !== linha) return;    // outro produto, ou Esc, cancelou esta espera
    pararEspera();
    const r = linha.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;    // a pessoa rolou para longe: não abre sobre outra parte da lista
    mostrar(linha, pronta ? entrada : null);
    adiantar();
  };

  carta.addEventListener('click', (ev) => {
    const botao = /** @type {HTMLElement} */ (ev.target).closest('[data-abrir-produto]');
    const linha = /** @type {HTMLElement | null} */ (botao?.closest('.prato') ?? null);
    if (linha) abrir(linha);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') pararEspera(); });

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
