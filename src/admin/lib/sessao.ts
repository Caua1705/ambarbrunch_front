// Tipos da sessão do painel, comuns ao servidor (middleware) e às ilhas.
// Formato do backend: CONTRATO-PAINEL-ADMIN.md §2 (`UsuarioSaida`, `UnidadeSaida`).

export type Papel = 'admin' | 'gerente' | 'operador';
export type ModoPainel = 'api' | 'demo' | 'indisponivel';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** Unidades atribuídas (vazio só para a conta técnica que vê todas). */
  unidades: number[];
  /** Nome visível do perfil e permissões, como o backend decide (GET /admin/auth/me). */
  perfil?: string;
  permissoes?: string[];
}

export interface Unidade {
  id: number;
  codigo: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  ativo: boolean;
}

/** O que cada página recebe do servidor (Astro.locals.painel) e repassa às ilhas. */
export interface ContextoPainel {
  modo: ModoPainel;
  usuario: Usuario;
  unidades: Unidade[];
  /** Unidade de negócio em uso: toda consulta vai com `?unidade=<codigo>`. */
  unidade: Unidade | null;
  /** Convites do Clube pelo WhatsApp (só no lançamento do Clube). */
  clubeConvites: boolean;
  /** Módulos liberados neste ambiente (PAINEL_MODULOS). O papel ainda decide o que cada pessoa vê dentro deles. */
  modulos: import('./permissoes').Modulo[];
}

export const NOME_PAPEL: Record<Papel, string> = { admin: 'Proprietário', gerente: 'Gerente', operador: 'Atendente' };
