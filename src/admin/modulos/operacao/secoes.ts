// Seções do Modo Operação (tablet do café). Cada seção diz quando existe para a pessoa logada; a navegação entre seções
// só aparece quando há mais de uma. Hoje só Reservas está no ar.
//
// Para entrar uma seção nova, sem reconstruir a tela:
//  - Atendimento: no ar no backend; quando liberado em PAINEL_MODULOS, a seção aparece sozinha e leva ao módulo de
//    Atendimento do painel (as mesmas rotas reais /admin/atendimento*). Nada de conversa inventada.
//  - Ponto: só quando o backend tiver a API do ponto (registro oficial de jornada) e a permissão no perfil. Até lá
//    `disponivel` é sempre falso — nenhum botão que pareça registrar ponto aparece. Ver docs/technical/MODO-OPERACAO.md.
import type { ContextoPainel } from '../../lib/sessao';
import { podeVer, type Modulo } from '../../lib/permissoes';

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
  { id: 'reservas', rotulo: 'Reservas', disponivel: (c) => liberado(c, 'reservas') },
  { id: 'atendimento', rotulo: 'Mensagens', href: '/admin/atendimento', disponivel: (c) => liberado(c, 'atendimento') },
  // Sem API de ponto no backend: não existe nesta versão.
  { id: 'ponto', rotulo: 'Ponto', disponivel: () => false },
];

export const secoesDe = (c: ContextoPainel) => SECOES.filter((s) => s.disponivel(c));
