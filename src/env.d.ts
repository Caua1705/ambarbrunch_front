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
  /** "1" = mostra o Clube na home e no menu (lib/clube-modo.ts). Desligado por padrão até o lançamento do Clube. */
  readonly PUBLIC_CLUBE_HOME?: string;
  /** ID de medição do GA4 (G-XXXXXXXXXX). Público por natureza; só liga com a seção de medição da política aprovada
   *  (src/lib/medicao-config.ts). Vazio = sem GA4. */
  readonly PUBLIC_GA4_ID?: string;
  /** Valor de content="…" da meta google-site-verification (opcional: a verificação recomendada é por DNS). */
  readonly PUBLIC_GSC_VERIFICACAO?: string;
  /** Definida na compilação pelo painel (src/admin/integracao.mjs): `false` em build da Vercel — sem código de demonstração. */
  readonly PAINEL_DEMO_PERMITIDO?: boolean;
}
interface ImportMeta { readonly env: ImportMetaEnv; }

// Painel administrativo (src/admin/middleware.ts): sessão conferida no servidor, repassada às páginas do /admin.
declare namespace App {
  interface Locals {
    painel?: import('./admin/lib/sessao').ContextoPainel;
    painelModo?: import('./admin/lib/sessao').ModoPainel;
  }
}
