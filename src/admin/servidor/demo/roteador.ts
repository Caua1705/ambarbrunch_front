// DEMONSTRAÇÃO — imita as rotas /admin/* do backend com dados em memória (por processo do servidor de desenvolvimento).
// Mesmos formatos, mesmos papéis exigidos (403 igual ao backend) e mesmos códigos de erro principais, para que a tela
// seja exercitada pelo MESMO caminho do modo real. Nunca usado em build publicado.
import type { Papel } from '../../lib/sessao';

export interface PedidoDemo {
  metodo: string;
  caminho: string;
  query: URLSearchParams;
  papel: Papel;
  request: Request;
}

export interface Contexto extends PedidoDemo {
  params: string[];
  corpo: <T = Record<string, unknown>>() => Promise<T>;
}

export class RespostaDemo {
  constructor(public status: number, public corpo: unknown) {}
}
/** Resposta com status diferente de 200 (ex.: 201 ao criar). */
export const resposta = (status: number, corpo: unknown) => new RespostaDemo(status, corpo);
export type Resposta = unknown;
export type Rota = [metodo: string, padrao: RegExp, papeis: Papel[] | null, fn: (c: Contexto) => Resposta | Promise<Resposta>];

export const TODOS: Papel[] = ['admin', 'gerente', 'operador'];
export const GERENCIA: Papel[] = ['admin', 'gerente'];
export const ADMIN: Papel[] = ['admin'];

export class ErroDemo extends Error {
  constructor(public status: number, public codigo: string, message: string, public dados?: unknown) {
    super(message);
  }
}

// Carregadas na primeira chamada: os módulos de dados usam os utilitários deste arquivo ao serem avaliados, então
// importá-los no topo daqui criaria um ciclo (utilitário ainda não inicializado).
let rotas: Rota[] | null = null;
async function todasAsRotas(): Promise<Rota[]> {
  if (!rotas) {
    const [r, a, f, e, v, q] = await Promise.all([import('./reservas'), import('./atendimento-clube'), import('./financeiro'), import('./estoque'), import('./visao'), import('./equipe')]);
    rotas = [...r.ROTAS_RESERVAS, ...a.ROTAS_ATENDIMENTO_CLUBE, ...f.ROTAS_FINANCEIRO, ...e.ROTAS_ESTOQUE, ...v.ROTAS_VISAO, ...q.ROTAS_EQUIPE];
  }
  return rotas;
}

function json(status: number, corpo: unknown) {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Painel-Modo': 'demonstracao' } });
}

export async function responderDemo(p: PedidoDemo): Promise<Response> {
  // pequena espera para os estados de carregamento serem vistos como no uso real
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
  for (const [metodo, padrao, papeis, fn] of await todasAsRotas()) {
    if (metodo !== p.metodo) continue;
    const m = padrao.exec(p.caminho);
    if (!m) continue;
    if (papeis && !papeis.includes(p.papel)) return json(403, { detail: 'Seu perfil não tem acesso a esta área.', codigo: 'acesso_negado' });
    let lido: unknown;
    const ctx: Contexto = {
      ...p,
      params: m.slice(1),
      corpo: async <T,>() => {
        if (lido === undefined) lido = await p.request.json().catch(() => ({}));
        return (lido ?? {}) as T;
      },
    };
    try {
      const r = await fn(ctx);
      if (r instanceof RespostaDemo) return json(r.status, r.corpo);
      return json(200, r);
    } catch (e) {
      if (e instanceof ErroDemo) return json(e.status, { detail: e.message, codigo: e.codigo, dados: e.dados });
      console.error('[painel demo]', e);
      return json(500, { detail: 'Erro interno da demonstração.', codigo: 'erro' });
    }
  }
  return json(404, { detail: 'Not Found' });
}

// Utilidades dos dados fictícios ---------------------------------------------------------------------------------------

export function hojeFortaleza(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
}
export function dia(deslocamento: number, base = hojeFortaleza()): string {
  const [a, m, d] = base.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + deslocamento, 12)).toISOString().slice(0, 10);
}
/** Instante ISO de uma data/hora de Fortaleza (UTC−3). */
export function instante(data: string, hora = '12:00'): string {
  return new Date(`${data}T${hora.slice(0, 5)}:00-03:00`).toISOString();
}
export function agoraMenos(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}
let n = 0;
export function uuid(): string {
  n++;
  return `d${String(n).padStart(7, '0')}-0000-4000-8000-${String(Date.now() % 1e12).padStart(12, '0')}`;
}
/** Pseudoaleatório determinístico (os mesmos dados a cada reinício). */
export function sorteio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
export const dec = (v: number, casas = 2) => v.toFixed(casas);
export function paginar<T>(itens: T[], q: URLSearchParams) {
  const lim = Number(q.get('limite') ?? 50);
  const des = Number(q.get('deslocamento') ?? 0);
  return { total: itens.length, itens: itens.slice(des, des + lim) };
}
export function exigirMotivo(motivo: unknown, minimo = 5) {
  if (typeof motivo !== 'string' || motivo.trim().length < minimo) {
    throw new ErroDemo(422, 'regra_violada', `Informe o motivo (pelo menos ${minimo} caracteres).`);
  }
}
