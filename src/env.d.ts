/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** "1" = modo de revisão: mostra marcações de conteúdo pendente e mídia com autorização pendente. */
  readonly PUBLIC_REVISAO?: string;
  /** "indisponivel" (padrão) · "simulado" (só testes/demonstração, com aviso) · "api" (só após validar o contrato). */
  readonly PUBLIC_RESERVAS_MODO?: 'indisponivel' | 'simulado' | 'api';
  /** URL base da API de reservas (staging). Nunca a de produção antes do contrato validado. */
  readonly PUBLIC_RESERVAS_API_URL?: string;
  /** "indisponivel" (padrão: ficha e carteira fechadas, nada é enviado) · "api" (só com a API do Clube validada).
   *  “simulado” só no `astro dev` (lib/clube-modo.ts): nenhum build finge cadastro, adesão ou saldo. */
  readonly PUBLIC_CLUBE_MODO?: 'indisponivel' | 'api' | 'simulado';   // “simulado” só vale no `astro dev` (lib/clube-modo.ts)
  /** URL base da API do Clube (FastAPI do Âmbar; staging antes de validar). */
  readonly PUBLIC_CLUBE_API_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
