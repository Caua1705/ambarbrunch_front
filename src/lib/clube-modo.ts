// Modo do Clube no build: “indisponivel” (padrão) ou “api” (só com PUBLIC_CLUBE_API_URL). Não existe modo simulado:
// sem a API real, a ficha e a carteira ficam fechadas e dizem isso — nunca fingem cadastro, adesão ou saldo.
export type ModoClube = 'indisponivel' | 'api';
export const CLUBE_API_URL = import.meta.env.PUBLIC_CLUBE_API_URL || undefined;
export const CLUBE_MODO: ModoClube = import.meta.env.PUBLIC_CLUBE_MODO === 'api' && CLUBE_API_URL ? 'api' : 'indisponivel';
