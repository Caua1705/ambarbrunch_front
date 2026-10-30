// DEMONSTRAÇÃO — cadastro único de clientes, montado a partir das reservas fictícias de demo/reservas.ts (mesmos nomes e
// telefones). Formato e regras de app/modulos/reservas/api_clientes.py e painel.py: só a gerência (clientes.visualizar /
// clientes.editar); busca por nome, e-mail ou 4+ dígitos do telefone; ordem pela próxima reserva e depois pela última;
// telefone verificado não se troca pelo painel; a correção não mexe no contato gravado nas reservas.
import type { Rota } from './roteador';
import { GERENCIA, ErroDemo, hojeFortaleza, paginar, resposta, instante, dia } from './roteador';
import { NOMES_DEMO, telefoneDemo, reservasDosClientes } from './reservas';
import type { ClienteDetalhe, ClientePainel, CanalCliente, ConsentimentoCliente } from '../../lib/tipos/clientes';
import type { ReservaPainel, FrequenciaCliente } from '../../lib/tipos/reservas';

interface Cadastro {
  /** Posição em NOMES_DEMO (liga às reservas fictícias); não sai na resposta. */
  indice: number;
  id: string;
  nome: string;
  telefone_e164: string | null;
  telefone_verificado: boolean;
  email: string | null;
  origem_inicial: string;
  origem_detalhe: string | null;
  importado: boolean;
  criado_em: string;
}

const idDe = (i: number) => `c1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
let cadastros: Cadastro[] | null = null;

function montar(): Cadastro[] {
  if (cadastros) return cadastros;
  const porCliente = reservasDosClientes();
  cadastros = NOMES_DEMO.flatMap((nome, i) => {
    const rs = porCliente.get(i);
    if (!rs?.length) return [];
    const primeira = rs[0];
    return [{
      indice: i,
      id: idDe(i),
      nome,
      telefone_e164: telefoneDemo(i),
      // quem já confirmou o número pelo WhatsApp (Clube, código de acesso): o painel não troca
      telefone_verificado: i % 4 === 0,
      email: rs.find((r) => r.contato_email)?.contato_email ?? null,
      origem_inicial: i === 5 ? 'importacao' : primeira.canal,
      origem_detalhe: primeira.canal === 'instagram' ? 'link da bio' : null,
      importado: i === 5,
      criado_em: i === 5 ? instante(dia(-400), '10:00') : primeira.criado_em,
    }];
  });
  return cadastros;
}

function frequencia(rs: ReservaPainel[]): FrequenciaCliente {
  const visitas = rs.filter((r) => r.comparecimento === 'compareceu').map((r) => r.data);
  const faltas = rs.filter((r) => r.comparecimento === 'nao_compareceu').map((r) => r.data);
  return {
    perfil: visitas.length === 0 ? 'novo' : visitas.length === 1 ? 'visitante' : 'recorrente',
    visitas: visitas.length,
    faltas: faltas.length,
    historico_faltas: faltas.length > 0,
    primeira_visita: visitas[0] ?? null,
    ultima_visita: visitas.at(-1) ?? null,
    ultima_falta: faltas.at(-1) ?? null,
  };
}

const emAberto = (r: ReservaPainel) => r.comparecimento === 'nao_registrado' && r.status_reserva !== 'cancelada';

function painel({ indice, ...c }: Cadastro, rs: ReservaPainel[]): ClientePainel {
  void indice;
  const hoje = hojeFortaleza();
  const passadas = rs.filter((r) => r.data < hoje).map((r) => r.data);
  const futuras = rs.filter((r) => r.data >= hoje && emAberto(r)).map((r) => r.data);
  return {
    ...c,
    reservas_total: rs.length,
    reservas_em_aberto: futuras.length,
    ultima_reserva: passadas.at(-1) ?? null,
    proxima_reserva: futuras[0] ?? null,
    frequencia: frequencia(rs),
  };
}

function todos(): { c: Cadastro; rs: ReservaPainel[] }[] {
  const porCliente = reservasDosClientes();
  return montar().map((c) => ({ c, rs: porCliente.get(c.indice) ?? [] }));
}

function achar(id: string) {
  const x = todos().find((t) => t.c.id === id);
  if (!x) throw new ErroDemo(404, 'nao_encontrado', 'Cliente não encontrado.');
  return x;
}

function canais(rs: ReservaPainel[]): CanalCliente[] {
  const m = new Map<string, CanalCliente>();
  for (const r of rs) {
    const canal = r.importada_de ? 'importacao' : r.canal;
    const e = m.get(canal);
    if (e) {
      e.ocorrencias++;
      e.ultimo_em = r.criado_em > e.ultimo_em ? r.criado_em : e.ultimo_em;
      e.primeiro_em = r.criado_em < e.primeiro_em ? r.criado_em : e.primeiro_em;
    } else m.set(canal, { canal, detalhe: canal === 'instagram' ? 'link da bio' : '', primeiro_em: r.criado_em, ultimo_em: r.criado_em, ocorrencias: 1 });
  }
  return [...m.values()].sort((a, b) => a.primeiro_em.localeCompare(b.primeiro_em));
}

function consentimentos(c: Cadastro, rs: ReservaPainel[]): ConsentimentoCliente[] {
  const site = rs.find((r) => r.canal === 'site');
  const lista: ConsentimentoCliente[] = [];
  if (site) lista.push({ finalidade: 'privacidade_reserva', acao: 'concedido', canal: 'site', texto_versao: '2026-10', registrado_em: site.criado_em });
  if (c.telefone_verificado) lista.push({ finalidade: 'whatsapp_operacional', acao: 'concedido', canal: 'whatsapp', texto_versao: '2026-10', registrado_em: c.criado_em });
  return lista;
}

/** Erro de campo no formato do backend (RegraViolada com `campo`: lista de validação, como o FastAPI). */
const erroDeCampo = (campo: string, msg: string) => resposta(422, { detail: [{ loc: ['body', campo], msg, type: 'regra_violada' }] });

function telefoneE164(t: string): string | null {
  const d = t.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length === 10 || d.length === 11 ? `+55${d}` : null;
}

const UUID = '([0-9a-f-]{36})';

export const ROTAS_CLIENTES: Rota[] = [
  ['GET', /^clientes$/, GERENCIA, ({ query }) => {
    const termo = query.get('busca')?.trim().toLowerCase() ?? '';
    const digitos = termo.replace(/\D/g, '');
    const itens = todos()
      .map(({ c, rs }) => painel(c, rs))
      .filter((c) => !termo || c.nome.toLowerCase().includes(termo) || (c.email ?? '').toLowerCase().includes(termo) || (digitos.length >= 4 && (c.telefone_e164 ?? '').includes(digitos)))
      .sort((a, b) =>
        // próxima reserva (mais perto primeiro, sem próxima no fim), depois a última (mais recente primeiro), depois o nome
        (a.proxima_reserva ?? '9999').localeCompare(b.proxima_reserva ?? '9999') || (b.ultima_reserva ?? '').localeCompare(a.ultima_reserva ?? '') || a.nome.localeCompare(b.nome, 'pt-BR'));
    return paginar(itens, query);
  }],
  ['GET', new RegExp(`^clientes/${UUID}$`), GERENCIA, ({ params }) => {
    const { c, rs } = achar(params[0]);
    const detalhe: ClienteDetalhe = { ...painel(c, rs), canais: canais(rs), consentimentos: consentimentos(c, rs), reservas: rs };
    return detalhe;
  }],
  ['PATCH', new RegExp(`^clientes/${UUID}$`), GERENCIA, async ({ params, corpo }) => {
    const { c, rs } = achar(params[0]);
    const a = await corpo<{ nome?: string | null; telefone?: string | null; email?: string | null }>();
    if ('nome' in a && a.nome) {
      const nome = a.nome.split(/\s+/).filter(Boolean).join(' ');
      if (!nome || nome.length > 120) return erroDeCampo('nome', 'Informe o nome.');
      c.nome = nome;
    }
    if ('telefone' in a && a.telefone) {
      const tel = telefoneE164(a.telefone);
      if (!tel) return erroDeCampo('telefone', 'Telefone inválido: informe com DDD.');
      if (tel !== c.telefone_e164 && c.telefone_verificado) return erroDeCampo('telefone', 'Telefone verificado não se troca pelo painel.');
      c.telefone_e164 = tel;
    }
    if ('email' in a) {
      const email = a.email?.trim() ? a.email.trim().toLowerCase() : null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erroDeCampo('email', 'value is not a valid email address');
      c.email = email;
    }
    return painel(c, rs);
  }],
];
