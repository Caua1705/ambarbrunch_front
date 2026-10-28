import { defineConfig } from '@playwright/test';

// Reserva pública em modo API (o modo de produção), sobre o build de teste dist-reservas-api/ (npm run build:reservas-api):
// a API é um endereço .invalid interceptado pelos testes (tests-reservas/api-falsa.ts), com os formatos reais do backend.
// Fica fora de tests/ para não entrar na suíte padrão (que serve outros builds). Poucos workers: a máquina é pequena.
const celular = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: 'tests-reservas',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4423', reducedMotion: 'reduce', trace: 'off' },
  webServer: { command: 'node scripts/serve-dist.mjs dist-reservas-api 4423', url: 'http://127.0.0.1:4423/', reuseExistingServer: false },
  projects: [
    { name: 'chromium-celular', use: { browserName: 'chromium', ...celular, deviceScaleFactor: 2 } },
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1366, height: 900 } } },
    { name: 'webkit-celular', use: { browserName: 'webkit', ...celular } },
  ],
});
