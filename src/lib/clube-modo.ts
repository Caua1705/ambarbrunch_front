// Modo do Clube no build: “indisponivel” (padrão) ou “api” (só com PUBLIC_CLUBE_API_URL). Sem a API real, a ficha e a
// carteira ficam fechadas e dizem isso — nunca fingem cadastro, adesão ou saldo.
// “simulado” (2026-10-23) existe SÓ no `astro dev` (import.meta.env.DEV): com PUBLIC_CLUBE_MODO=simulado no
// .env.local, a ficha usa a API de mentira de lib/api/clube-simulado.ts, com aviso visível. Em qualquer build
// (`astro build`), DEV é falso: o modo cai para “indisponivel” e a simulação nem entra no pacote.
export type ModoClube = 'indisponivel' | 'api' | 'simulado';
export const CLUBE_API_URL = import.meta.env.PUBLIC_CLUBE_API_URL || undefined;
export const CLUBE_MODO: ModoClube =
  import.meta.env.PUBLIC_CLUBE_MODO === 'api' && CLUBE_API_URL ? 'api'
  : import.meta.env.DEV && import.meta.env.PUBLIC_CLUBE_MODO === 'simulado' ? 'simulado'
  : 'indisponivel';
/** a ficha recebe gente (API real, ou a simulação local do `astro dev`) */
export const CLUBE_ABERTO = CLUBE_MODO !== 'indisponivel';
