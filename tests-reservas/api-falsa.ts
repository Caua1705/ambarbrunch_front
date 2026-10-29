// API de reservas FALSA para os testes, no formato real do backend (giardini_back app/modulos/reservas, camelCase):
//  - GET /reservas/config: janela de 60 dias a partir de hoje (Fortaleza); os dias antes da abertura (09/11/2026) e os
//    dias fechados por evento saem em ambientes[].datasFechadas — exatamente como o backend faz com AMBAR_RESERVAS_ABERTURA.
//  - GET /reservas/disponibilidade: grade 07:00–16:00 de 30 em 30 min; vazia antes da abertura e nos dias fechados.
//  - POST /reservas: 201 (confirmada ou pendente), ou 409 horario_esgotado, ou 422 de data/e-mail/consentimento, ou 429
//    (com Retry-After e a mensagem do backend), ou 500 {codigo: erro_interno, request_id}, conforme o cenário.
//    A mesma Idempotency-Key devolve a mesma reserva, como o backend (servico.py).
//  - Reservas fechadas pela unidade: 503 {codigo: "reservas_indisponiveis"} em todas as rotas.
import type { Page, Route } from '@playwright/test';

export const API = 'http://reservas-api.teste.invalid';
export const SITE = 'http://127.0.0.1:4423';
export const ABERTURA = '2026-11-09';
/** "Agora" dos testes: 28/10/2026 às 10h em Fortaleza (UTC−3). */
export const AGORA = new Date('2026-10-28T10:00:00-03:00');
export const DIA_EVENTO = '2026-11-14';
export const DIA_LOTADO = '2026-11-12';
export const DIA_PARCIAL = '2026-11-10';

const CORS = { 'access-control-allow-origin': SITE, 'access-control-allow-headers': 'content-type, idempotency-key, accept', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

export function somarDias(iso: string, n: number) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

const HORAS = Array.from({ length: 19 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`); // 07:00 … 16:00

export interface Cenario {
  fechada?: boolean;
  configFalha?: boolean;
  /** resposta do POST */
  envio?: 'ok' | 'pendente' | 'esgotado' | 'prazo' | 'abertura' | 'erro' | 'fechada' | 'limite' | 'email' | 'consentimento';
  /** atraso do POST (ms), para o teste de clique duplo */
  atrasoEnvio?: number;
  hoje?: string;
  /** abertura configurada NA API (padrão: ABERTURA). Outra data simula um backend mal configurado: o site tem de
   *  continuar sem oferecer nada antes de 09/11. */
  aberturaApi?: string;
}

export interface Registro {
  configs: number;
  disponibilidades: { data: string; pessoas: string; ambiente: string }[];
  envios: { corpo: Record<string, unknown>; chave: string | null }[];
}

export async function apiFalsa(page: Page, c: Cenario = {}) {
  const hoje = c.hoje ?? '2026-10-28';
  const abertura = c.aberturaApi ?? ABERTURA;
  const reg: Registro = { configs: 0, disponibilidades: [], envios: [] };
  /** chave de idempotência → código: a mesma chave devolve a mesma reserva */
  const criadas = new Map<string, string>();
  const fechadas = Array.from({ length: 61 }, (_, i) => somarDias(hoje, i)).filter((d) => d < abertura || d === DIA_EVENTO);
  const ambiente = (id: string, nome: string, cap: number, min = 1) => ({ id, nome, capacidadeMax: cap, pessoasMin: min, pessoasMax: cap, datasFechadas: fechadas });
  const json = (r: Route, status: number, body: unknown) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });
  const fechado = (r: Route) => json(r, 503, { detail: 'Reservas online indisponíveis no momento.', codigo: 'reservas_indisponiveis' });

  await page.route(`${API}/**`, async (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    if (url.pathname === '/reservas/config') {
      reg.configs++;
      if (c.fechada) return fechado(r);
      if (c.configFalha) return json(r, 500, { detail: 'erro' });
      return json(r, 200, {
        ambientes: [ambiente('jardim', 'Jardim externo', 20), ambiente('salao', 'Salão principal', 30), ambiente('lounge', 'Lounge', 15), ambiente('privativa', 'Sala privativa', 20, 6)],
        pessoas: { min: 1, max: 30 },
        antecedencia: { diasMax: 60, horasMin: 2 },
        exigeEmail: false,
        fusoHorario: 'America/Fortaleza',
        privacidadeVersao: '2026-11-v1',
      });
    }
    if (url.pathname === '/reservas/disponibilidade') {
      if (c.fechada) return fechado(r);
      const q = { data: url.searchParams.get('data')!, pessoas: url.searchParams.get('pessoas')!, ambiente: url.searchParams.get('ambiente')! };
      reg.disponibilidades.push(q);
      const semGrade = q.data < abertura || q.data === DIA_EVENTO;
      const horarios = semGrade ? [] : HORAS.map((hora, i) => ({
        hora,
        disponivel: q.data === DIA_LOTADO && q.ambiente === 'jardim' ? false : q.data === DIA_PARCIAL ? i % 3 !== 0 : true,
      }));
      return json(r, 200, { data: q.data, horarios });
    }
    if (url.pathname === '/reservas' && req.method() === 'POST') {
      const corpo = req.postDataJSON() as Record<string, unknown>;
      reg.envios.push({ corpo, chave: req.headers()['idempotency-key'] ?? null });
      if (c.atrasoEnvio) await new Promise((ok) => setTimeout(ok, c.atrasoEnvio));
      const envio = c.envio ?? 'ok';
      if (envio === 'fechada') return fechado(r);
      if (envio === 'esgotado') return json(r, 409, { detail: 'Este horário acabou de esgotar. Escolha outro.', codigo: 'horario_esgotado' });
      if (envio === 'prazo') return json(r, 422, { detail: [{ loc: ['body', 'data'], msg: 'Data ou horário fora do prazo de reserva online.', type: 'regra_violada' }], codigo: 'regra_violada' });
      // conferir_abertura do backend (servico.py): data antes de AMBAR_RESERVAS_ABERTURA, em qualquer caminho
      if (envio === 'abertura') return json(r, 422, { detail: [{ loc: ['body', 'data'], msg: 'Reservas a partir de 09/11/2026.', type: 'antes_da_abertura' }], codigo: 'antes_da_abertura' });
      if (envio === 'erro') return json(r, 500, { detail: 'Erro interno. Informe o código da requisição ao suporte.', codigo: 'erro_interno', request_id: 'teste' });
      if (envio === 'limite') return r.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '600' }, contentType: 'application/json', body: JSON.stringify({ detail: 'Muitas tentativas. Tente de novo em alguns minutos.', codigo: 'limite_excedido' }) });
      if (envio === 'email') return json(r, 422, { detail: [{ loc: ['body', 'email'], msg: 'value is not a valid email address: The part after the @-sign is not valid.', type: 'value_error' }] });
      if (envio === 'consentimento') return json(r, 422, { detail: [{ loc: ['body', 'consentimentoPrivacidade'], msg: 'É preciso aceitar a política de privacidade para reservar.', type: 'regra_violada' }], codigo: 'regra_violada' });
      const chave = req.headers()['idempotency-key'] ?? '';
      const codigo = criadas.get(chave) ?? (criadas.size ? `AMB-${criadas.size + 1}X9P` : 'AMB-7Q2K');
      criadas.set(chave, codigo);
      return json(r, 201, { codigo, status: envio === 'pendente' ? 'pendente' : 'confirmada', ambienteId: corpo.ambienteId, pessoas: corpo.pessoas, data: corpo.data, hora: corpo.hora, duracaoMin: 180, clube: { convite: envio === 'pendente', url: envio === 'pendente' ? '/clube/' : null } });
    }
    return json(r, 404, { detail: 'Not Found' });
  });
  return reg;
}

/** Data e hora fixas no navegador (timers continuam reais). O "hoje" do calendário vem do fuso de Fortaleza. */
export async function relogio(page: Page, quando: Date = AGORA) {
  await page.clock.setFixedTime(quando);
}
