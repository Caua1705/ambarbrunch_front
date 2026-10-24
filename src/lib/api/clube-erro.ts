// Erros do Clube normalizados para a interface (clube-acesso.ts traduz o status HTTP e o corpo do backend para cá).
// `sessao` = 401 (sem sessão, sessão vencida ou sessão de ativação onde é preciso a completa).
// `suspensa` = 403 `conta_suspensa` (a gerência suspendeu a conta): a mensagem é o `detail` do backend; não se tenta de
// novo e nada da conta é mostrado.
export type TipoErroClube = 'rede' | 'tempo' | 'validacao' | 'codigo' | 'limite' | 'sessao' | 'suspensa' | 'versao' | 'indisponivel' | 'servidor';

export class ErroClube extends Error {
  constructor(public tipo: TipoErroClube, mensagem: string, public campos: Record<string, string> = {}) { super(mensagem); }
}

/** texto do backend para a conta suspensa — usado só se o `detail` não vier */
export const TEXTO_SUSPENSA = 'Sua conta do Clube Âmbar está suspensa. Fale com a equipe do Âmbar.';
