// @ts-check
// Âmbar Brunch — PRÉVIA da comanda (estado visual local, igual ao v1). Nada é enviado.
// No site definitivo, este arquivo é substituído pela ilha Preact `ReservaFlow` ligada à API de reservas.

export function initComandaPreview(scope = document) {
  /** @param {Element} group @param {Element} chip */
  const select = (group, chip) => {
    group.querySelectorAll('.chip').forEach((/** @type {Element} */ c) => c.setAttribute('aria-pressed', String(c === chip)));
  };
  scope.querySelectorAll('[data-group]').forEach((group) => group.addEventListener('click', (ev) => {
    const chip = /** @type {Element} */ (ev.target).closest('.chip');
    if (chip) select(group, chip);
  }));

  const datesBox = scope.querySelector('[data-dates]');
  if (datesBox) {
    const fmtDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
    const today = new Date();
    for (let i = 0; i < 10; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip';
      b.setAttribute('aria-pressed', String(i === 0));
      b.innerHTML = `<small>${i === 0 ? 'hoje' : fmtDay.format(d).replace('.', '')}</small>${d.getDate()}`;
      datesBox.append(b);
    }
  }

  /** @type {HTMLOutputElement | null} */
  const out = scope.querySelector('[data-people]');
  scope.querySelectorAll('[data-step]').forEach((btn) => btn.addEventListener('click', () => {
    if (!out) return;
    const n = Math.min(20, Math.max(1, Number(out.value || out.textContent) + Number(/** @type {HTMLElement} */ (btn).dataset.step)));
    out.value = String(n); out.textContent = String(n);
  }));

  // “Reservar aqui” nos ambientes pré-seleciona o ambiente na comanda.
  const ambGroup = scope.querySelector('[data-group="ambiente"]');
  scope.querySelectorAll('[data-ambiente]').forEach((link) => link.addEventListener('click', () => {
    if (!ambGroup) return;
    const chip = [...ambGroup.querySelectorAll('.chip')].find((c) => c.textContent?.trim() === /** @type {HTMLElement} */ (link).dataset.ambiente);
    if (chip) select(ambGroup, chip);
  }));
}
