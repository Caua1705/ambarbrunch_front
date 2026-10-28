import { defineConfig } from '@playwright/test';

// Ponta a ponta CONTRA UMA API REAL (homologação) — não usa API falsa. Roteiro em docs/technical/RESERVAS-LANCAMENTO.md:
//   PUBLIC_REVISAO=0 PUBLIC_RESERVAS_MODO=api PUBLIC_RESERVAS_API_URL=<API>/ npx astro build --outDir dist-reservas-real
//   RESERVAS_API_REAL=<API> npx playwright test -c playwright.reservas-real.config.ts
// Por padrão só lê (vai até a revisão, sem POST). Criar uma reserva exige RESERVAS_CRIAR=1 e é recusado na produção.
export default defineConfig({
  testDir: 'tests-reservas-real',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4424', trace: 'off' },
  webServer: { command: 'node scripts/serve-dist.mjs dist-reservas-real 4424', url: 'http://127.0.0.1:4424/', reuseExistingServer: false },
  projects: [{ name: 'chromium-celular', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
});
