// Seções do Modo Operação (tablet do café) — o painel do Atendente: Conversas | Reservas | Ponto. Cada seção diz quando
// existe para a pessoa logada; a navegação entre seções só aparece quando há mais de uma.
//
// Para entrar uma seção nova, sem reconstruir a tela:
//  - Atendimento: no ar no backend; quando liberado em PAINEL_MODULOS, a seção aparece sozinha e leva ao módulo de
//    Atendimento do painel (as mesmas rotas reais /admin/atendimento*). Nada de conversa inventada.
//  - Ponto: o terminal oficial (/ponto) embutido, com o módulo Equipe liberado e a permissão `ponto.terminal`. Quem
//    marca é o TABLET pareado + o rosto do funcionário (identificação no backend), nunca a conta logada.
import type { ContextoPainel } from '../../lib/sessao';
import { podeVer, podeTerminalPonto, type Modulo } from '../../lib/permissoes';

export type IdSecao = 'reservas' | 'atendimento' | 'ponto';

export interface SecaoOperacao {
  id: IdSecao;
  rotulo: string;
  /** Seção que ainda vive no painel completo: a navegação leva para lá. */
  href?: string;
  disponivel: (c: ContextoPainel) => boolean;
}

const liberado = (c: ContextoPainel, m: Modulo) => c.modulos.includes(m) && podeVer(c.usuario.papel, m);

export const SECOES: SecaoOperacao[] = [
  { id: 'atendimento', rotulo: 'Conversas', href: '/admin/atendimento', disponivel: (c) => liberado(c, 'atendimento') },
  { id: 'reservas', rotulo: 'Reservas', disponivel: (c) => liberado(c, 'reservas') },
  { id: 'ponto', rotulo: 'Ponto', disponivel: (c) => c.modulos.includes('equipe') && podeTerminalPonto(c.usuario) },
];

export const secoesDe = (c: ContextoPainel) => SECOES.filter((s) => s.disponivel(c));
