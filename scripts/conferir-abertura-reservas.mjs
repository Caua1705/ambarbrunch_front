// Confere, só com leituras (GET), se a API de reservas está pronta para o site público abrir:
//   node scripts/conferir-abertura-reservas.mjs [--api https://api.ambarbrunch.com] [--abertura 2026-11-06] [--politica arquivo]
// Decisão operacional (28/10/2026): o Âmbar inaugura em 03/11, mas a primeira data reservável pelo site é 06/11.
// - /reservas/config responde (reservas abertas pela unidade, não 503 reservas_indisponiveis);
// - em cada ambiente, nenhum dia antes da abertura é oferecido (datasFechadas, vindas de AMBAR_RESERVAS_ABERTURA);
// - a disponibilidade da véspera da abertura vem sem horários e a do dia da abertura tem horários em algum ambiente;
// - a versão da política aprovada no backend (privacidadeVersao) é a publicada no site e o site a marca como aprovada.
// Não cria, altera nem apaga nada.
// Saída: 0 = pronto para publicar · 1 = configuração incorreta (datas ou horários divergentes) ·
//        2 = reservas fechadas na API (503 reservas_indisponiveis) · 3 = falha de comunicação (rede, tempo, resposta inesperada).
import { readFile } from 'node:fs/promises';

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : padrao;
};
const API = arg('api', 'https://api.ambarbrunch.com').replace(/\/+$/, '');
const ABERTURA = arg('abertura', '2026-11-06');
// texto da política publicado pelo site (os testes passam outro arquivo)
const POLITICA = arg('politica', new URL('../src/data/privacidade.ts', import.meta.url));
const somar = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10);
};
const VESPERA = somar(ABERTURA, -1);

class FalhaDeComunicacao extends Error {}

/** GET com tempo limite. Rede, tempo esgotado ou corpo que não é JSON viram FalhaDeComunicacao. */
async function obter(caminho) {
  let r;
  try {
    r = await fetch(`${API}${caminho}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new FalhaDeComunicacao(`${caminho}: ${e?.name === 'TimeoutError' ? 'sem resposta em 15 s' : `sem conexão (${e?.cause?.code ?? e?.message})`}`);
  }
  let corpo;
  try {
    corpo = await r.json();
  } catch {
    throw new FalhaDeComunicacao(`${caminho}: resposta ${r.status} sem JSON`);
  }
  return { status: r.status, ok: r.ok, corpo };
}

async function conferir() {
  const cfg = await obter('/reservas/config');
  if (cfg.status === 503 && cfg.corpo?.codigo === 'reservas_indisponiveis') {
    console.log(`FECHADA: ${API} responde 503 reservas_indisponiveis — o site mostra "As reservas pelo site não estão abertas no momento".`);
    return 2;
  }
  if (!cfg.ok) throw new FalhaDeComunicacao(`/reservas/config respondeu ${cfg.status} (${cfg.corpo?.codigo ?? cfg.corpo?.detail ?? 'sem código'})`);
  const c = cfg.corpo;
  if (!Array.isArray(c.ambientes) || !c.antecedencia?.diasMax) throw new FalhaDeComunicacao('/reservas/config sem ambientes ou sem antecedência: formato inesperado');

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: c.fusoHorario ?? 'America/Fortaleza' }).format(new Date());
  const janela = Array.from({ length: c.antecedencia.diasMax + 1 }, (_, i) => somar(hoje, i));
  console.log(`API ${API} · hoje ${hoje} (${c.fusoHorario}) · janela ${c.antecedencia.diasMax} dias · antecedência mínima ${c.antecedencia.horasMin ?? '?'} h · abertura esperada ${ABERTURA}`);

  const problemas = [];
  let algumHorarioNaAbertura = false;
  for (const amb of c.ambientes) {
    const fechadas = new Set(amb.datasFechadas ?? []);
    const abertasAntes = janela.filter((d) => d < ABERTURA && !fechadas.has(d));
    const primeira = janela.find((d) => !fechadas.has(d)) ?? '—';
    console.log(`- ${amb.nome} (${amb.id}): primeira data aberta ${primeira} · até ${amb.pessoasMax} pessoas por reserva · lotação ${amb.capacidadeMax}`);
    if (abertasAntes.length) problemas.push(`${amb.nome}: oferece datas antes da abertura (${abertasAntes.join(', ')})`);
    for (const data of [VESPERA, ABERTURA]) {
      if (!janela.includes(data)) continue;
      const q = new URLSearchParams({ data, pessoas: '2', ambiente: amb.id });
      const d = await obter(`/reservas/disponibilidade?${q}`);
      if (d.status === 503 && d.corpo?.codigo === 'reservas_indisponiveis') {
        console.log('FECHADA: a disponibilidade responde reservas_indisponiveis.');
        return 2;
      }
      if (!d.ok || !Array.isArray(d.corpo?.horarios)) throw new FalhaDeComunicacao(`/reservas/disponibilidade (${amb.id}, ${data}) respondeu ${d.status}`);
      const n = d.corpo.horarios.length;
      if (data === VESPERA && n) problemas.push(`${amb.nome}: ${data} tem ${n} horários (deveria ter nenhum)`);
      if (data === ABERTURA && n) algumHorarioNaAbertura = true;
    }
  }
  if (janela.includes(ABERTURA) && !algumHorarioNaAbertura) problemas.push(`nenhum ambiente tem horários em ${ABERTURA}`);

  // A versão gravada em cada aceite (backend, privacidade_texto_versao) tem de ser a do texto publicado no site.
  const politica = await readFile(POLITICA, 'utf8');
  const versaoSite = politica.match(/versao:\s*'Versão ([^']+)'/)?.[1];
  const aprovadaSite = /aprovada:\s*true/.test(politica);
  console.log(`Política: backend ${c.privacidadeVersao ?? '—'} · site ${versaoSite ?? '(sem versão)'}${aprovadaSite ? '' : ' (aprovada: false no site)'}`);
  if (!versaoSite || c.privacidadeVersao !== versaoSite) {
    problemas.push(`versão da política diferente: backend "${c.privacidadeVersao ?? '—'}", site "${versaoSite ?? '—'}" (src/data/privacidade.ts)`);
  }
  if (!aprovadaSite) problemas.push('a política do site ainda está com aprovada: false (src/data/privacidade.ts)');

  if (problemas.length) {
    console.log(`\nCONFIGURAÇÃO INCORRETA:\n${problemas.map((p) => `  · ${p}`).join('\n')}`);
    console.log(`(No backend: AMBAR_RESERVAS_ABERTURA=${ABERTURA}; política: app.cli aprovar-privacidade --versao <a do site>.)`);
    return 1;
  }
  console.log(`\nOK: nenhuma data antes de ${ABERTURA} é oferecida e a abertura tem horários. O site pode publicar.`);
  return 0;
}

// process.exitCode (não process.exit): no Windows, sair à força logo depois de um fetch derruba o Node com uma asserção.
try {
  process.exitCode = await conferir();
} catch (e) {
  if (!(e instanceof FalhaDeComunicacao)) throw e;
  console.log(`FALHA DE COMUNICAÇÃO: ${e.message}. Nada foi concluído — confira a API e rode de novo.`);
  process.exitCode = 3;
}
