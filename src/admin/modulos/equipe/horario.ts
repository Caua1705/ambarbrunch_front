// Dias e horários de uma pessoa, montados sobre as escalas do backend. No backend, a escala é um plano COMPARTILHADO (nome,
// semana, tolerância) e a pessoa entra nele por atribuição, de hoje em diante. Aqui o gestor só vê "dias e horários": quando
// o plano é só dela, um horário novo vira nova versão da mesma escala; quando é compartilhado (ou não existe), cria-se uma
// escala própria ("Horário de <nome>") e a pessoa é atribuída a ela. Nenhuma rota nova, nenhum segundo sistema de horários.
import type { DiaPlano, Escala, VersaoEscala } from '../../lib/tipos/equipe';
import { ROTULO_DIA } from './comum';

export const DIA_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export interface HorarioDia {
  entrada: string;
  saida: string;
  pausa_inicio: string;
  pausa_fim: string;
  tipo?: 'trabalho' | 'plantao';
}

/** O que o editor mostra: dias marcados, mesmo horário para todos (ou um por dia) e intervalo opcional. */
export interface PlanoSemana {
  dias: boolean[];
  igual: boolean;
  intervalo: boolean;
  geral: HorarioDia;
  porDia: HorarioDia[];
}

export const horarioVazio = (): HorarioDia => ({ entrada: '', saida: '', pausa_inicio: '', pausa_fim: '' });
export const planoVazio = (): PlanoSemana => ({ dias: Array(7).fill(false), igual: true, intervalo: false, geral: horarioVazio(), porDia: Array.from({ length: 7 }, horarioVazio) });

const hhmm = (s?: string | null) => (s ? s.slice(0, 5) : '');
const doDia = (d: DiaPlano): HorarioDia => ({
  entrada: hhmm(d.entrada),
  saida: hhmm(d.saida),
  pausa_inicio: hhmm(d.intervalos?.[0]?.inicio),
  pausa_fim: hhmm(d.intervalos?.[0]?.fim),
  ...(d.tipo === 'plantao' ? { tipo: 'plantao' as const } : {}),
});
const chaveHorario = (h: HorarioDia, intervalo = true) => `${h.entrada}|${h.saida}|${intervalo ? `${h.pausa_inicio}|${h.pausa_fim}` : ''}|${h.tipo ?? ''}`;

/** Plano da escala → editor. Sem plano: nada marcado, nada presumido. */
export function planoDe(dias: Record<string, DiaPlano> | undefined | null): PlanoSemana {
  const p = planoVazio();
  if (!dias) return p;
  for (let i = 0; i < 7; i++) {
    const d = dias[String(i)];
    if (d) {
      p.dias[i] = true;
      p.porDia[i] = doDia(d);
    }
  }
  const marcados = p.porDia.filter((_, i) => p.dias[i]);
  p.igual = !marcados.length || marcados.every((h) => chaveHorario(h) === chaveHorario(marcados[0]));
  p.geral = marcados[0] ? { ...marcados[0], tipo: undefined } : horarioVazio();
  p.intervalo = marcados.some((h) => h.pausa_inicio && h.pausa_fim);
  return p;
}

const horarioDoDia = (p: PlanoSemana, i: number) => (p.igual ? p.geral : p.porDia[i]);

/** Editor → `dias` da versão (0 = segunda … 6 = domingo; dia ausente = folga). */
export function paraDias(p: PlanoSemana): Record<string, DiaPlano> {
  const dias: Record<string, DiaPlano> = {};
  p.dias.forEach((marcado, i) => {
    if (!marcado) return;
    const h = horarioDoDia(p, i);
    dias[String(i)] = {
      ...(!p.igual && h.tipo === 'plantao' ? { tipo: 'plantao' as const } : {}),
      entrada: h.entrada,
      saida: h.saida,
      intervalos: p.intervalo && h.pausa_inicio && h.pausa_fim ? [{ inicio: h.pausa_inicio, fim: h.pausa_fim }] : [],
    };
  });
  return dias;
}

/** O que impede salvar, numa frase. */
export function problemaDoPlano(p: PlanoSemana): string | null {
  if (!p.dias.some(Boolean)) return 'Marque pelo menos um dia de trabalho.';
  for (let i = 0; i < 7; i++) {
    if (!p.dias[i]) continue;
    const h = horarioDoDia(p, i);
    const onde = p.igual ? '' : ` de ${ROTULO_DIA[i].toLowerCase()}`;
    if (!h.entrada || !h.saida) return `Preencha a entrada e a saída${onde}.`;
    if (h.entrada === h.saida) return `A entrada e a saída${onde} estão iguais.`;
    if (p.intervalo && !h.pausa_inicio !== !h.pausa_fim) return `Preencha o início e o fim do intervalo${onde}, ou deixe os dois vazios.`;
  }
  return null;
}

const normalizar = (dias: Record<string, DiaPlano>) =>
  JSON.stringify(
    Object.keys(dias)
      .sort()
      .map((k) => [k, dias[k].tipo === 'plantao' ? 'plantao' : 'trabalho', hhmm(dias[k].entrada), hhmm(dias[k].saida), (dias[k].intervalos ?? []).map((x) => `${hhmm(x.inicio)}-${hhmm(x.fim)}`)]),
  );
export const mesmoPlano = (a: Record<string, DiaPlano>, b: Record<string, DiaPlano>) => normalizar(a) === normalizar(b);

/** Versão em vigor hoje (as versões vêm da mais nova para a mais antiga). */
export const versaoAtual = (e: Escala, hoje: string): VersaoEscala | undefined => e.versoes.find((v) => v.vigente_de <= hoje) ?? e.versoes.at(-1);
/** A próxima versão já marcada para depois de hoje, se houver. */
export const versaoFutura = (e: Escala, hoje: string): VersaoEscala | undefined => e.versoes.filter((v) => v.vigente_de > hoje).at(-1);

/** [0,1,2,3,4] → "Seg a Sex"; [0,2] → "Seg e Qua"; [0,1,2,5] → "Seg a Qua e Sáb". */
export function nomesDosDias(indices: number[]): string {
  const ordem = [...indices].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < ordem.length; ) {
    let j = i;
    while (j + 1 < ordem.length && ordem[j + 1] === ordem[j] + 1) j++;
    if (j - i >= 2) partes.push(`${DIA_CURTO[ordem[i]]} a ${DIA_CURTO[ordem[j]]}`);
    else for (let k = i; k <= j; k++) partes.push(DIA_CURTO[ordem[k]]);
    i = j + 1;
  }
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}` : partes[0] ?? '';
}

/** "Seg a Sex, 08:00–17:00 · Sáb, 08:00–12:00". Intervalo não entra no resumo curto. */
export function resumoDias(dias: Record<string, DiaPlano> | undefined | null): string {
  const p = planoDe(dias);
  const grupos = new Map<string, { h: HorarioDia; dias: number[] }>();
  p.porDia.forEach((h, i) => {
    if (!p.dias[i]) return;
    const k = chaveHorario(h, false);
    grupos.set(k, { h, dias: [...(grupos.get(k)?.dias ?? []), i] });
  });
  if (!grupos.size) return 'Nenhum dia de trabalho';
  return [...grupos.values()].map((g) => `${nomesDosDias(g.dias)}, ${g.h.entrada}–${g.h.saida}${g.h.tipo === 'plantao' ? ' (plantão)' : ''}`).join(' · ');
}

/** Intervalos do plano, em uma linha, ou null quando não há. */
export function resumoIntervalos(dias: Record<string, DiaPlano> | undefined | null): string | null {
  const p = planoDe(dias);
  if (!p.intervalo) return null;
  const grupos = new Map<string, number[]>();
  p.porDia.forEach((h, i) => {
    if (p.dias[i] && h.pausa_inicio && h.pausa_fim) grupos.set(`${h.pausa_inicio}–${h.pausa_fim}`, [...(grupos.get(`${h.pausa_inicio}–${h.pausa_fim}`) ?? []), i]);
  });
  return [...grupos.entries()].map(([faixa, d]) => `${nomesDosDias(d)}, ${faixa}`).join(' · ');
}

/** Nome curto para o tablet: o primeiro nome; se já houver alguém com ele, primeiro nome + inicial do último. */
export function nomeNoTablet(nomeCompleto: string, outros: string[]): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  const usado = new Set(outros.map((n) => n.trim().toLocaleLowerCase('pt-BR')));
  const opcoes = [partes[0], ...(partes.length > 1 ? [`${partes[0]} ${partes.at(-1)![0].toLocaleUpperCase('pt-BR')}.`, `${partes[0]} ${partes.at(-1)}`] : []), partes.join(' ')];
  return (opcoes.find((o) => !usado.has(o.toLocaleLowerCase('pt-BR'))) ?? opcoes.at(-1)!).slice(0, 60);
}
