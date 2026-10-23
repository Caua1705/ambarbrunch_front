// Erros do Clube normalizados para a interface (clube-acesso.ts traduz o status HTTP e o corpo do backend para cá).
// `sessao` = 401 (sem sessão, sessão vencida ou sessão de ativação onde é preciso a completa).
export type TipoErroClube = 'rede' | 'tempo' | 'validacao' | 'codigo' | 'limite' | 'sessao' | 'versao' | 'indisponivel' | 'servidor';

export class ErroClube extends Error {
  constructor(public tipo: TipoErroClube, mensagem: string, public campos: Record<string, string> = {}) { super(mensagem); }
}
