import { defineConfig } from '@playwright/test';

// Servidores (reaproveitados se já estiverem no ar):
//  - 4321: build de REVISÃO (dist/)             → npm run build:revisao && astro preview
//  - 4322: build de SIMULAÇÃO da reserva (dist-sim/) → só testes
//  - 4173: protótipo aprovado v1 (experiments/)  → só o teste de fidelidade (precisa do acervo local)
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 2,
  reporter: [['list'], ['json', { outputFile: 'reports/playwright.json' }]],
  snapshotPathTemplate: 'tests/__screenshots__/{projectName}/{arg}{ext}',
  use: { baseURL: 'http://127.0.0.1:4321', reducedMotion: 'reduce', trace: 'off' },
  webServer: [
    { command: 'npx astro preview --port 4321 --host 127.0.0.1', url: 'http://127.0.0.1:4321/', reuseExistingServer: true, timeout: 60_000 },
    { command: 'node scripts/serve-dist.mjs dist-sim 4322', url: 'http://127.0.0.1:4322/', reuseExistingServer: true },
    { command: 'node experiments/serve.mjs', url: 'http://127.0.0.1:4173/experiments/', reuseExistingServer: true },
  ],
  projects: [
    { name: 'fidelity', testMatch: /fidelity\.spec\.ts/, use: { browserName: 'chromium', ...mobile } },
    { name: 'contrato', testMatch: /tokens\.spec\.ts/ },
    { name: 'chromium', testIgnore: /(fidelity|tokens)\.spec\.ts/, use: { browserName: 'chromium', ...mobile } },
    { name: 'webkit', testIgnore: /(fidelity|tokens)\.spec\.ts/, use: { browserName: 'webkit', ...mobile } },
  ],
});
