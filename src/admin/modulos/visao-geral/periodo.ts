// Período da Visão Geral: um filtro só para os quatro indicadores e os gráficos. As datas são as da operação
// (America/Fortaleza, hojeISO). Nada aqui calcula valor financeiro: só decide QUAIS datas pedir ao backend.
import { hojeISO, somarDias, inicioMes, fimMes, somarMeses } from '../../lib/formato';

export type TipoPeriodo = 'hoje' | '7d' | '30d' | 'mes' | 'personalizado';
export interface Periodo {
  tipo: TipoPeriodo;
  de: string;
  ate: string;
}

export const OPCOES: { valor: TipoPeriodo; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
];

/** Limite do backend em /relatorios/vendas e /despesas-por-categoria (400 dias). */
export const MAX_DIAS = 400;

export const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000) + 1;

export function periodoDe(tipo: TipoPeriodo, personalizado?: { de: string; ate: string }): Periodo {
  const hoje = hojeISO();
  if (tipo === 'hoje') return { tipo, de: hoje, ate: hoje };
  if (tipo === '7d') return { tipo, de: somarDias(hoje, -6), ate: hoje };
  if (tipo === '30d') return { tipo, de: somarDias(hoje, -29), ate: hoje };
  if (tipo === 'mes') return { tipo, de: inicioMes(hoje), ate: hoje };
  return { tipo, de: personalizado?.de ?? somarDias(hoje, -29), ate: personalizado?.ate ?? hoje };
}

/** Mesmo comprimento, logo antes. No "Este mês": o mês anterior até o mesmo dia (como o resumo do backend compara). */
export function anterior(p: Periodo): { de: string; ate: string } {
  if (p.tipo === 'mes') {
    const de = somarMeses(p.de, -1);
    const mesmoDia = somarDias(de, dias(p.de, p.ate) - 1);
    const fim = fimMes(de);
    return { de, ate: mesmoDia < fim ? mesmoDia : fim };
  }
  const n = dias(p.de, p.ate);
  return { de: somarDias(p.de, -n), ate: somarDias(p.de, -1) };
}

/**
 * O resultado gerencial é apurado por MÊS no backend (GET /relatorios/resultado?mes=). Ele só entra no indicador quando o
 * período é um mês civil: "Este mês" (parcial) ou um personalizado do dia 1 ao último dia do mesmo mês.
 */
export function mesDoPeriodo(p: Periodo): string | null {
  if (p.de !== inicioMes(p.de)) return null;
  if (p.tipo === 'mes') return p.de.slice(0, 7);
  return p.ate === fimMes(p.de) ? p.de.slice(0, 7) : null;
}

/** Granularidade do gráfico principal: dia até ~2 meses, semana até ~6 meses, mês acima (as mesmas do backend). */
export function agrupamento(de: string, ate: string): 'dia' | 'semana' | 'mes' {
  const n = dias(de, ate);
  return n <= 62 ? 'dia' : n <= 190 ? 'semana' : 'mes';
}

/** Início do balde de uma data: o mesmo date_trunc do backend (semana começa na segunda-feira). */
export function inicioBalde(iso: string, agrupar: 'dia' | 'semana' | 'mes'): string {
  if (agrupar === 'dia') return iso;
  if (agrupar === 'mes') return inicioMes(iso);
  const semana = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return somarDias(iso, -((semana + 6) % 7));
}

/** Todos os baldes do período, em ordem (dias sem venda nem despesa também aparecem no eixo). */
export function baldes(de: string, ate: string, agrupar: 'dia' | 'semana' | 'mes'): string[] {
  const lista: string[] = [];
  let atual = inicioBalde(de, agrupar);
  while (atual <= ate) {
    lista.push(atual);
    atual = agrupar === 'dia' ? somarDias(atual, 1) : agrupar === 'semana' ? somarDias(atual, 7) : somarMeses(atual, 1);
  }
  return lista;
}

/** Janela do gráfico: o período escolhido, mas pelo menos 7 dias terminando nele (um dia só não forma evolução). */
export function janelaGrafico(p: Periodo): { de: string; ate: string; ampliada: boolean } {
  if (dias(p.de, p.ate) >= 7) return { de: p.de, ate: p.ate, ampliada: false };
  return { de: somarDias(p.ate, -6), ate: p.ate, ampliada: true };
}
