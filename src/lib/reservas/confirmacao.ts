// A reserva que a API acabou de criar, da comanda para a página /reserva-confirmada/. Fica no sessionStorage da aba
// (some quando a aba fecha), nunca na URL, e só com o que a tela de confirmação mostra: ambiente, pessoas, data,
// horário, situação e duração — nada de nome, telefone ou e-mail. Recarregar a página de confirmação lê daqui:
// nenhum pedido é enviado de novo.
import type { ReservaAgenda } from './agenda';

export const ROTA_CONFIRMADA = '/reserva-confirmada/';
const CHAVE = 'ambar:reserva-confirmada';

export interface Confirmacao extends ReservaAgenda { fuso: string }

/** Guarda a confirmação. false = o navegador recusou o armazenamento (a comanda mostra a confirmação ali mesmo). */
export function guardarConfirmacao(c: Confirmacao): boolean {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(c));
    return sessionStorage.getItem(CHAVE) !== null;
  } catch {
    return false;
  }
}

/** A confirmação desta aba, se houver e estiver inteira. */
export function lerConfirmacao(): Confirmacao | null {
  try {
    const c = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null') as Partial<Confirmacao> | null;
    if (!c || typeof c.codigo !== 'string' || (c.status !== 'confirmada' && c.status !== 'pendente') || typeof c.ambienteNome !== 'string'
      || typeof c.pessoas !== 'number' || !/^\d{4}-\d{2}-\d{2}$/.test(c.data ?? '') || !/^\d{2}:\d{2}$/.test(c.hora ?? '')) return null;
    return { codigo: c.codigo, status: c.status, ambienteNome: c.ambienteNome, pessoas: c.pessoas, data: c.data!, hora: c.hora!,
      duracaoMin: typeof c.duracaoMin === 'number' ? c.duracaoMin : undefined, fuso: typeof c.fuso === 'string' ? c.fuso : 'America/Fortaleza' };
  } catch {
    return null;
  }
}
