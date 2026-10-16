/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** "1" = modo de revisão: mostra marcações de conteúdo pendente e mídia com autorização pendente. */
  readonly PUBLIC_REVISAO?: string;
  /** "indisponivel" (padrão) · "simulado" (só testes/demonstração, com aviso) · "api" (só após validar o contrato). */
  readonly PUBLIC_RESERVAS_MODO?: 'indisponivel' | 'simulado' | 'api';
  /** URL base da API de reservas (staging). Nunca a de produção antes do contrato validado. */
  readonly PUBLIC_RESERVAS_API_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
