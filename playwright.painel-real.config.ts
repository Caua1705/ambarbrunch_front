import { defineConfig } from '@playwright/test';

// Painel (/admin) CONTRA UM BACKEND REAL local (giardini_back numa base isolada, com cenários semeados) — sem demonstração
// e sem backend falso. Nunca aponte para a produção: os testes gravam (classificam, confirmam compras, registram despesas).
//   npm run painel:build
//   PAINEL_REAL_API=http://127.0.0.1:8765 PAINEL_REAL_CENARIOS=<json fora do repositório> \
//     npx playwright test -c playwright.painel-real.config.ts
// O JSON traz as contas (e-mail/senha de teste) e os ids dos cenários; ver tests-painel-real/apoio.ts. PAINEL_REAL_CHAVE
// (opcional) é a AMBAR_PAINEL_CHAVE do backend local.
const API = process.env.PAINEL_REAL_API ?? '';
if (!API) throw new Error('Defina PAINEL_REAL_API (backend local).');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(API)) throw new Error('PAINEL_REAL_API precisa ser um backend LOCAL (http://127.0.0.1:porta).');

export default defineConfig({
  testDir: 'tests-painel-real',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4494', trace: 'retain-on-failure' },
  webServer: {
    command: 'node dist-painel/server/entry.mjs',
    url: 'http://127.0.0.1:4494/admin/login',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { HOST: '127.0.0.1', PORT: '4494', PAINEL_MODO: 'api', PAINEL_API_URL: API.replace(/\/+$/, ''), PAINEL_MODULOS: '', PAINEL_API_CHAVE: process.env.PAINEL_REAL_CHAVE ?? '' },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1366, height: 860 } } }],
});
