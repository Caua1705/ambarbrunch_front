// Confere, só com leituras (GET), se a API de reservas está pronta para o site público abrir:
//   node scripts/conferir-abertura-reservas.mjs [--api https://api.ambarbrunch.com] [--abertura 2026-11-06]
// - /reservas/config responde (reservas abertas pela unidade, não 503 reservas_indisponiveis);
// - em cada ambiente, nenhum dia antes da abertura é oferecido e a primeira data aberta é a da abertura (ou depois, se
//   o próprio dia da abertura estiver fechado nesse ambiente);
// - a disponibilidade da véspera da abertura vem sem horários e a do dia da abertura tem horários em algum ambiente.
// Não cria, altera nem apaga nada. Saída 0 = pode publicar; 1 = divergência ou erro; 2 = reservas fechadas na API.
const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : padrao;
};
const API = arg('api', 'https://api.ambarbrunch.com').replace(/\/+$/, '');
const ABERTURA = arg('abertura', '2026-11-06');
const somar = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10);
};
const VESPERA = somar(ABERTURA, -1);

async function conferir() {
  const r = await fetch(`${API}/reservas/config`, { headers: { Accept: 'application/json' } });
  const corpo = await r.json().catch(() => ({}));
  if (r.status === 503 && corpo.codigo === 'reservas_indisponiveis') {
    console.log(`FECHADA: ${API} responde 503 reservas_indisponiveis — o site mostra "As reservas pelo site não estão abertas no momento".`);
    return 2;
  }
  if (!r.ok) {
    console.log(`ERRO: /reservas/config respondeu ${r.status}.`);
    return 1;
  }
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: corpo.fusoHorario ?? 'America/Fortaleza' }).format(new Date());
  const janela = Array.from({ length: (corpo.antecedencia?.diasMax ?? 60) + 1 }, (_, i) => somar(hoje, i));
  console.log(`API ${API} · hoje ${hoje} (${corpo.fusoHorario}) · janela ${corpo.antecedencia?.diasMax} dias · abertura esperada ${ABERTURA}`);

  const problemas = [];
  let algumHorarioNaAbertura = false;
  for (const amb of corpo.ambientes ?? []) {
    const fechadas = new Set(amb.datasFechadas ?? []);
    const abertasAntes = janela.filter((d) => d < ABERTURA && !fechadas.has(d));
    const primeira = janela.find((d) => !fechadas.has(d)) ?? '—';
    console.log(`- ${amb.nome} (${amb.id}): primeira data aberta ${primeira} · até ${amb.pessoasMax} pessoas por reserva · lotação ${amb.capacidadeMax}`);
    if (abertasAntes.length) problemas.push(`${amb.nome}: oferece datas antes da abertura (${abertasAntes.join(', ')})`);
    for (const data of [VESPERA, ABERTURA]) {
      if (!janela.includes(data)) continue;
      const q = new URLSearchParams({ data, pessoas: '2', ambiente: amb.id });
      const d = await fetch(`${API}/reservas/disponibilidade?${q}`, { headers: { Accept: 'application/json' } }).then((x) => x.json()).catch(() => null);
      const n = d?.horarios?.length ?? 0;
      if (data === VESPERA && n) problemas.push(`${amb.nome}: ${data} tem ${n} horários (deveria ter nenhum)`);
      if (data === ABERTURA && n) algumHorarioNaAbertura = true;
    }
  }
  if (janela.includes(ABERTURA) && !algumHorarioNaAbertura) problemas.push(`nenhum ambiente tem horários em ${ABERTURA}`);

  if (problemas.length) {
    console.log(`\nDIVERGÊNCIAS:\n${problemas.map((p) => `  · ${p}`).join('\n')}`);
    return 1;
  }
  console.log(`\nOK: nenhuma data antes de ${ABERTURA} é oferecida e a abertura tem horários. O site pode publicar.`);
  return 0;
}

// process.exitCode (não process.exit): no Windows, sair à força logo depois de um fetch derruba o Node com uma asserção.
process.exitCode = await conferir();
