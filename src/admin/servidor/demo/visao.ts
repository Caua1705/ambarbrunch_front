// DEMONSTRAÇÃO — GET /admin/visao-geral e o Radar de Lucro, montados com os resumos dos outros módulos de demonstração
// (mesmo formato de app/visao_geral.py). Financeiro e radar só para gerência, como no backend.
import type { Rota } from './roteador';
import { TODOS, GERENCIA, ErroDemo, hojeFortaleza, paginar } from './roteador';
import { resumoReservasHoje } from './reservas';
import * as financeiro from './financeiro';
import * as estoque from './estoque';
import type { VisaoGeral, RadarInsight } from '../../lib/tipos/visao-geral';

// Os blocos vêm dos módulos de Financeiro e Estoque; se um deles não os exportar, o bloco sai vazio (nunca inventado aqui).
const blocoFinanceiro = (financeiro as unknown as Record<string, unknown>).blocoFinanceiroVisaoDemo as (() => VisaoGeral['financeiro']) | undefined;
const radar = (financeiro as unknown as Record<string, unknown>).radarDemo as (() => RadarInsight[]) | undefined;
const blocoEstoque = (estoque as unknown as Record<string, unknown>).blocoEstoqueVisaoDemo as (() => VisaoGeral['estoque']) | undefined;

let achados: RadarInsight[] | null = null;
const todosAchados = () => (achados ??= radar?.() ?? []);
const ABERTOS = ['pendente', 'visto'];
const PESO = { critico: 0, atencao: 1, info: 2 } as const;

export const ROTAS_VISAO: Rota[] = [
  ['GET', /^visao-geral$/, TODOS, ({ papel }) => {
    const gerencia = papel !== 'operador';
    const corpo: VisaoGeral = {
      dia: hojeFortaleza(),
      reservas: resumoReservasHoje(),
      atendimento: { com_equipe: 2 },
      clube: { ativos: 4 },
      estoque: blocoEstoque?.() ?? { abaixo_minimo: 0, compras_em_conferencia: 0, produtos_sem_ficha: 0, cobertura_fichas_30d: null },
      alertas: { criticos: 0, abertos: 0 },
      financeiro: gerencia ? blocoFinanceiro?.() ?? null : null,
      radar: gerencia ? todosAchados().filter((a) => ABERTOS.includes(a.status)).sort((a, b) => PESO[a.severidade] - PESO[b.severidade]).slice(0, 3) : null,
    };
    return corpo;
  }],
  ['GET', /^visao-geral\/radar$/, GERENCIA, ({ query }) => {
    const s = query.get('status') ?? 'abertos';
    const itens = todosAchados().filter((a) => s === 'todos' || (s === 'abertos' ? ABERTOS.includes(a.status) : a.status === s));
    return paginar(itens.sort((a, b) => PESO[a.severidade] - PESO[b.severidade]), query);
  }],
  ['POST', /^visao-geral\/radar\/(\d+)\/status$/, GERENCIA, async ({ params, corpo }) => {
    const a = todosAchados().find((x) => x.id === Number(params[0]));
    if (!a) throw new ErroDemo(404, 'nao_encontrado', 'Achado não encontrado.');
    const { status } = await corpo<{ status: RadarInsight['status'] }>();
    if (!['pendente', 'visto', 'resolvido', 'descartado'].includes(status)) throw new ErroDemo(422, 'regra_violada', 'Situação inválida.');
    a.status = status;
    a.atualizado_em = new Date().toISOString();
    return a;
  }],
];
