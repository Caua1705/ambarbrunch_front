// Seções do Modo Operação (tablet do café) — o painel do Atendente: Conversas | Reservas | Ponto. Cada seção diz quando
// existe para a pessoa logada; a navegação entre seções só aparece quando há mais de uma.
//
// Todas abrem DENTRO do Modo Operação (sem outra aba, sem novo login):
//  - Conversas: o próprio módulo de Atendimento do painel (mesmos componentes e rotas reais /admin/atendimento*).
//  - Reservas: a agenda do dia.
//  - Ponto: registrar ponto pelo rosto e o checklist de abertura, com a permissão `ponto.terminal`. A conta logada abre o
//    terminal; quem marca é o rosto do funcionário identificado no backend, nunca a conta.
import type { ContextoPainel } from '../../lib/sessao';
import { podeVer, podeTerminalPonto, type Modulo } from '../../lib/permissoes';

export type IdSecao = 'reservas' | 'atendimento' | 'ponto';

export interface SecaoOperacao {
  id: IdSecao;
  rotulo: string;
  disponivel: (c: ContextoPainel) => boolean;
}

const liberado = (c: ContextoPainel, m: Modulo) => c.modulos.includes(m) && podeVer(c.usuario.papel, m);

export const SECOES: SecaoOperacao[] = [
  { id: 'atendimento', rotulo: 'Conversas', disponivel: (c) => liberado(c, 'atendimento') },
  { id: 'reservas', rotulo: 'Reservas', disponivel: (c) => liberado(c, 'reservas') },
  { id: 'ponto', rotulo: 'Ponto', disponivel: (c) => c.modulos.includes('equipe') && podeTerminalPonto(c.usuario) },
];

export const secoesDe = (c: ContextoPainel) => SECOES.filter((s) => s.disponivel(c));
