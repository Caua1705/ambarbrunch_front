// Regras de conteúdo do site (ver docs/design/design-system/MIDIA.md §5).

/**
 * Modo de revisão: mostra marcações “a confirmar” e mídia com autorização pendente.
 * Ligado no `astro dev` e quando PUBLIC_REVISAO=1. Num build de produção fica desligado:
 * conteúdo pendente some e mídia não autorizada não entra.
 */
export const REVISAO = import.meta.env.DEV || import.meta.env.PUBLIC_REVISAO === '1';

/** Valor ainda não fornecido pelo cliente. Nunca inventar: usar `pendente(...)` com a descrição do que falta. */
export interface Pendente { pendente: true; falta: string }
export const pendente = (falta: string): Pendente => ({ pendente: true, falta });
export const isPendente = (v: unknown): v is Pendente => typeof v === 'object' && v !== null && 'pendente' in v;

/** Mídia de terceiros só aparece com autorização registrada — ou no modo de revisão local. */
export const podeMostrar = (autorizado: boolean) => autorizado || REVISAO;

/**
 * Origem de uma imagem de produto:
 * - `real`: foto do Âmbar ou da Roll;
 * - `ilustrativa`: recorte de imagem gerada por IA ou arte da proposta Âmbar × Roll — sai sempre com o selo
 *   “imagem ilustrativa” e nunca sustenta ingrediente, preço ou dado nutricional próprio;
 * - `revisao`: ainda não confirmada para publicação — só no modo de revisão.
 */
export type Origem = 'real' | 'ilustrativa' | 'revisao';
export const origemVisivel = (o: Origem) => o !== 'revisao' || REVISAO;
