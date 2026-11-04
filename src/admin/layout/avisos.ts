// Sino do topo: a central das pendências operacionais. Só números que o backend devolve (nunca estimados aqui), só dos
// módulos que a página liberou para o papel (data-fontes, decidido no servidor) e da unidade que ESTA aba mostra (B4).
// Uma rodada de consultas leves por página — sem polling —, guardada 45 s na sessão do navegador para não repetir a cada
// clique na lateral. Cada item leva direto à tela que resolve aquilo.

type Prioridade = 0 | 1 | 2 | 3; // 0 = urgente … 3 = informativo
interface Aviso {
  id: string;
  modulo: string;
  titulo: string;
  detalhe?: string;
  href: string;
  prioridade: Prioridade;
  quantidade: number;
}
interface Resultado {
  avisos: Aviso[];
  falhas: number;
  em: number;
}

const VALIDADE = 45_000;
const TOM: Record<Prioridade, string> = { 0: 'perigo', 1: 'atencao', 2: 'marca', 3: 'info' };

const unidade = () => document.querySelector<HTMLMetaElement>('meta[name="painel-unidade"]')?.content ?? '';
const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
const moeda = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
};

async function pedir<T>(caminho: string): Promise<T> {
  const u = unidade();
  const r = await fetch(`/admin/api/${caminho}`, { credentials: 'same-origin', headers: u ? { 'X-Painel-Unidade': u } : {} });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

async function consultar(fontes: string[]): Promise<Resultado> {
  const avisos: Aviso[] = [];
  const hoje = hojeISO();
  const tarefas: Promise<void>[] = [];
  if (fontes.includes('reservas')) {
    tarefas.push(
      pedir<{ total: number }>(`reservas?status=pendente&data_de=${hoje}&limite=1`).then(({ total }) => {
        if (total > 0) avisos.push({ id: 'reservas-pendentes', modulo: 'Reservas', titulo: plural(total, 'reserva aguardando aprovação', 'reservas aguardando aprovação'), detalhe: 'Hoje e próximos dias', href: '/admin/reservas?status=pendente', prioridade: 0, quantidade: total });
      }),
      pedir<unknown[]>(`reservas/comparecimento/pendentes?data_de=${hoje}&data_ate=${hoje}`).then((l) => {
        const n = Array.isArray(l) ? l.length : 0;
        if (n > 0) avisos.push({ id: 'chegadas', modulo: 'Reservas', titulo: plural(n, 'chegada para registrar', 'chegadas para registrar'), detalhe: 'Reservas de hoje que já começaram', href: '/admin/reservas', prioridade: 2, quantidade: n });
      }),
    );
  }
  if (fontes.includes('atendimento')) {
    tarefas.push(
      // Esperando = encaminhada à equipe e ninguém assumiu (o mesmo contador do filtro "Esperando" da caixa de entrada).
      pedir<{ aguardando_equipe?: number; por_estado?: { esperando?: number }; eventos?: { aguardando_contato?: number } }>('atendimento/resumo').then((r) => {
        const n = r.por_estado?.esperando ?? r.aguardando_equipe ?? 0;
        if (n > 0) avisos.push({ id: 'conversas', modulo: 'Atendimento', titulo: plural(n, 'conversa esperando a equipe', 'conversas esperando a equipe'), detalhe: 'Encaminhada à equipe e ninguém assumiu', href: '/admin/atendimento?filtro=esperando', prioridade: 0, quantidade: n });
        // Eventos (backend com a 0023): encaminhados pelo assistente e ainda sem contato comercial.
        const ev = r.eventos?.aguardando_contato ?? 0;
        if (ev > 0) avisos.push({ id: 'eventos', modulo: 'Atendimento', titulo: plural(ev, 'evento aguardando contato', 'eventos aguardando contato'), detalhe: 'Oportunidade encaminhada à equipe', href: '/admin/atendimento?eventos=1', prioridade: 1, quantidade: ev });
      }),
    );
  }
  if (fontes.includes('financeiro')) {
    tarefas.push(
      pedir<{ despesas?: { total?: number; sem_categoria_total?: number }; documentos?: { total?: number } }>('financeiro/revisao?limite=1').then((f) => {
        const docs = f.documentos?.total ?? 0;
        const sem = f.despesas?.sem_categoria_total;
        const emRevisao = f.despesas?.total ?? 0;
        if (docs > 0) avisos.push({ id: 'documentos', modulo: 'Financeiro', titulo: plural(docs, 'documento aguardando decisão', 'documentos aguardando decisão'), detalhe: 'Comprovantes e notas que a Júlia não resolveu', href: '/admin/financeiro?aba=revisao&filtro=documentos', prioridade: 1, quantidade: docs });
        if (typeof sem === 'number' && sem > 0) avisos.push({ id: 'sem-categoria', modulo: 'Financeiro', titulo: plural(sem, 'despesa sem categoria', 'despesas sem categoria'), detalhe: 'Pagamento registrado; falta classificar', href: '/admin/financeiro?aba=revisao&filtro=sem', prioridade: 1, quantidade: sem });
        // `sem_categoria_total` é parte das despesas em revisão (mesma situação no backend): o resto é conferência.
        const outras = typeof sem === 'number' ? emRevisao - sem : emRevisao;
        if (outras > 0) avisos.push({ id: 'despesas-revisao', modulo: 'Financeiro', titulo: plural(outras, 'despesa para conferir', 'despesas para conferir'), detalhe: 'Valor, data ou fornecedor a confirmar', href: '/admin/financeiro?aba=revisao&filtro=despesas', prioridade: 1, quantidade: outras });
      }),
      pedir<{ contas?: Record<'vencidas' | 'hoje', { qtd: number; valor: string }>; conciliacao_mes_anterior?: { texto: string } | null }>('financeiro/resumo').then((r) => {
        const v = r.contas?.vencidas;
        if (v && v.qtd > 0) avisos.push({ id: 'vencidas', modulo: 'Financeiro', titulo: plural(v.qtd, 'conta vencida', 'contas vencidas'), detalhe: `${moeda(v.valor)} em aberto`, href: '/admin/financeiro?aba=contas&situacao=vencidas', prioridade: 0, quantidade: v.qtd });
        const h = r.contas?.hoje;
        if (h && h.qtd > 0) avisos.push({ id: 'vence-hoje', modulo: 'Financeiro', titulo: plural(h.qtd, 'conta vence hoje', 'contas vencem hoje'), detalhe: moeda(h.valor), href: '/admin/financeiro?aba=contas&situacao=hoje', prioridade: 1, quantidade: h.qtd });
        if (r.conciliacao_mes_anterior) avisos.push({ id: 'conciliacao', modulo: 'Financeiro', titulo: 'Conciliação bancária do mês anterior incompleta', detalhe: r.conciliacao_mes_anterior.texto, href: '/admin/financeiro?aba=conciliacao', prioridade: 3, quantidade: 1 });
      }),
    );
  }
  if (fontes.includes('estoque')) {
    tarefas.push(
      pedir<{ total: number }>('estoque/compras?etapa=aguardando_conferencia&limite=1').then(({ total }) => {
        if (total > 0) avisos.push({ id: 'compras', modulo: 'Estoque', titulo: plural(total, 'recebimento aguardando conferência', 'recebimentos aguardando conferência'), detalhe: 'Conferir os itens antes de entrar no estoque', href: '/admin/estoque?aba=recebimentos', prioridade: 1, quantidade: total });
      }),
    );
  }
  const r = await Promise.allSettled(tarefas);
  avisos.sort((a, b) => a.prioridade - b.prioridade || a.modulo.localeCompare(b.modulo));
  return { avisos, falhas: r.filter((x) => x.status === 'rejected').length, em: Date.now() };
}

function guardado(chave: string): Resultado | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(chave) ?? 'null') as Resultado | null;
    return r && Date.now() - r.em < VALIDADE ? r : null;
  } catch {
    return null;
  }
}
function guardar(chave: string, r: Resultado) {
  try {
    sessionStorage.setItem(chave, JSON.stringify(r));
  } catch {
    /* navegação privada: vale só nesta página */
  }
}

function desenhar(r: Resultado) {
  const conta = document.querySelector<HTMLElement>('[data-sino]');
  const lista = document.querySelector<HTMLUListElement>('[data-avisos-lista]');
  const estado = document.querySelector<HTMLElement>('[data-avisos-estado]');
  const rodape = document.querySelector<HTMLElement>('[data-avisos-rodape]');
  const total = r.avisos.reduce((s, a) => s + a.quantidade, 0);
  const botao = document.querySelector<HTMLButtonElement>('#avisos .sino');
  if (conta) {
    conta.hidden = total === 0;
    conta.textContent = total > 99 ? '99+' : String(total);
  }
  botao?.setAttribute('aria-label', total ? `Pendências: ${total}` : 'Pendências: nenhuma');
  if (estado) estado.textContent = r.avisos.length ? plural(r.avisos.length, 'assunto', 'assuntos') : '';
  if (lista) {
    lista.replaceChildren(
      ...(r.avisos.length
        ? r.avisos.map((a) => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.className = `avisos__item avisos__item--${TOM[a.prioridade]}`;
            link.href = a.href;
            link.dataset.aviso = a.id;
            const marca = document.createElement('i');
            marca.setAttribute('aria-hidden', 'true');
            const texto = document.createElement('span');
            texto.className = 'avisos__texto';
            const modulo = document.createElement('small');
            modulo.textContent = a.modulo;
            const titulo = document.createElement('strong');
            titulo.textContent = a.titulo;
            texto.append(modulo, titulo);
            if (a.detalhe) {
              const d = document.createElement('span');
              d.textContent = a.detalhe;
              texto.append(d);
            }
            link.append(marca, texto);
            li.append(link);
            return li;
          })
        : [Object.assign(document.createElement('li'), { className: 'avisos__vazio', textContent: 'Tudo em dia. Nenhuma pendência nas áreas que você acompanha.' })]),
    );
  }
  if (rodape) {
    rodape.hidden = r.falhas === 0;
    rodape.textContent = r.falhas ? 'Algumas áreas não responderam agora e não entram nesta lista.' : '';
  }
  // Contador de Reservas na lateral: o mesmo número do sino (aprovação pendente), sem segunda consulta.
  const pendentes = r.avisos.find((a) => a.id === 'reservas-pendentes')?.quantidade ?? 0;
  const lateral = document.querySelector<HTMLElement>('[data-pendentes]');
  if (lateral) {
    lateral.hidden = pendentes === 0;
    lateral.textContent = String(pendentes);
    lateral.setAttribute('aria-label', `${pendentes} pendentes de aprovação`);
  }
}

export function iniciarAvisos() {
  const raiz = document.getElementById('avisos');
  const botao = raiz?.querySelector<HTMLButtonElement>('.sino');
  const painel = document.getElementById('avisos-painel');
  if (!raiz || !botao || !painel) return;
  const fontes = (raiz.dataset.fontes ?? '').split(',').filter(Boolean);
  const chave = `painel-avisos:${unidade()}:${fontes.join(',')}`;

  const carregar = async (forcar = false) => {
    const pronto = forcar ? null : guardado(chave);
    if (pronto) return desenhar(pronto);
    if (!fontes.length) return desenhar({ avisos: [], falhas: 0, em: Date.now() });
    const r = await consultar(fontes);
    guardar(chave, r);
    desenhar(r);
  };
  void carregar();
  // Toda ação do painel termina num invalidar() (lib/consulta.ts): aprovou, classificou, pagou — o sino reconta na hora.
  let espera: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('painel:invalidar', () => {
    clearTimeout(espera);
    espera = setTimeout(() => void carregar(true), 600);
  });

  const alternar = (abrir: boolean) => {
    painel.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    if (abrir) {
      // Ao abrir, vale o número de agora (o cache pode ter até 45 s).
      void carregar(true);
      painel.querySelector<HTMLElement>('a')?.focus();
    }
  };
  botao.addEventListener('click', (e) => {
    e.stopPropagation();
    alternar(painel.hidden === true);
  });
  document.addEventListener('click', (e) => {
    if (!painel.hidden && !raiz.contains(e.target as Node)) alternar(false);
  });
  painel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      alternar(false);
      botao.focus();
    }
  });
}

