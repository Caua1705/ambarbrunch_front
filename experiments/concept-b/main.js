// Âmbar Brunch — protótipo de direção visual (sem dependências, sem backend).
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // CTA fixo: aparece quando o hero sai da tela e some ao voltar ao topo.
  // Também se esconde enquanto a própria seção de reserva está visível.
  const hero = document.querySelector('[data-hero]');
  const reserva = document.querySelector('[data-reserva]');
  const cta = document.querySelector('[data-sticky-cta]');
  if (hero && cta && 'IntersectionObserver' in window) {
    const state = { heroVisible: true, reservaVisible: false };
    const update = () => {
      const show = !state.heroVisible && !state.reservaVisible;
      cta.classList.toggle('is-visible', show);
      cta.setAttribute('aria-hidden', String(!show));
      cta.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { state.heroVisible = e.isIntersecting; update(); }, { threshold: 0 }).observe(hero);
    if (reserva) new IntersectionObserver(([e]) => { state.reservaVisible = e.isIntersecting; update(); }, { threshold: 0.25 }).observe(reserva);
  }

  // Revelação ao rolar (uma vez). Sem JS ou com movimento reduzido, tudo já aparece.
  const reveals = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  // Vídeos: carregam e tocam (mudos) só quando visíveis; pausam fora da tela.
  const videos = document.querySelectorAll('video[data-autoplay]');
  if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach(({ target: v, isIntersecting }) => {
        if (isIntersecting && !reduceMotion) { v.preload = 'auto'; v.play().catch(() => {}); }
        else v.pause();
      });
    }, { threshold: 0.35 });
    videos.forEach((v) => vio.observe(v));
  }

  // Prévia de reserva (somente estado visual local).
  const groups = document.querySelectorAll('[data-group]');
  const select = (group, chip) => {
    group.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  };
  groups.forEach((group) => group.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip');
    if (chip) select(group, chip);
  }));

  const datesBox = document.querySelector('[data-dates]');
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

  const out = document.querySelector('[data-people]');
  document.querySelectorAll('[data-step]').forEach((btn) => btn.addEventListener('click', () => {
    const n = Math.min(20, Math.max(1, Number(out.value || out.textContent) + Number(btn.dataset.step)));
    out.value = n; out.textContent = n;
  }));

  // "Reservar aqui" nos ambientes pré-seleciona o ambiente na prévia.
  const ambGroup = document.querySelector('[data-group="ambiente"]');
  document.querySelectorAll('[data-ambiente]').forEach((link) => link.addEventListener('click', () => {
    const chip = [...ambGroup.querySelectorAll('.chip')].find((c) => c.textContent.trim() === link.dataset.ambiente);
    if (chip) select(ambGroup, chip);
  }));
})();
