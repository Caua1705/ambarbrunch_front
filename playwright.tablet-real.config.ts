import { defineConfig } from '@playwright/test';

// Tablet do café (Modo Operação) CONTRA O BACKEND REAL local, com a câmera falsa do Chromium (um padrão de teste: nenhuma
// imagem de pessoa). Prova a sessão renovável, o ponto sem código de tablet com confirmação, o checklist com vídeo gravado no
// navegador e a consulta do Proprietário. Nunca aponte para a produção: os testes gravam ponto, checklist e vídeo.
//
//   giardini_back: python <scratchpad>/tablet_real.py preparar   (banco descartável local, contas e rosto sintético)
//                  python <scratchpad>/tablet_real.py subir      (API em 127.0.0.1:8767, motor facial FALSO)
//   aqui:          npm run painel:build
//                  TABLET_REAL_SEGREDOS=<tablet_real.json> npx playwright test -c playwright.tablet-real.config.ts
const API = process.env.TABLET_REAL_API ?? 'http://127.0.0.1:8767';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(API)) throw new Error('TABLET_REAL_API precisa ser um backend LOCAL.');
if (!process.env.TABLET_REAL_SEGREDOS) throw new Error('Defina TABLET_REAL_SEGREDOS (JSON com a senha das contas de teste).');

export default defineConfig({
  testDir: 'tests-tablet-real',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4497',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
  webServer: {
    command: 'node dist-painel/server/entry.mjs',
    url: 'http://127.0.0.1:4497/admin/login',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { HOST: '127.0.0.1', PORT: '4497', PAINEL_MODO: 'api', PAINEL_API_URL: API.replace(/\/+$/, ''), PAINEL_MODULOS: '', PAINEL_API_CHAVE: '' },
  },
});
