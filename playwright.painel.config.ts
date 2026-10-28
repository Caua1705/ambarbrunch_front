import { defineConfig } from '@playwright/test';
// (Fica fora de tests/ para não entrar na suíte do site público, que roda tudo o que está em tests/.)

// Testes do painel administrativo (/admin) sobre o BUILD com o painel ligado (npm run painel:build → dist-painel/).
// Três servidores do mesmo build, cada um num modo, mais um backend falso para o modo api:
//  - 4490: PAINEL_MODO=demo (dados fictícios)          - 4492: PAINEL_MODO=api contra o backend falso (4491)
//  - 4493: sem configuração (indisponível: ninguém entra)
// Poucos workers: a máquina de desenvolvimento já ficou sem memória com a suíte inteira.
const servidor = (porta: number, env: Record<string, string>) => ({
  command: 'node dist-painel/server/entry.mjs',
  url: `http://127.0.0.1:${porta}/admin/login`,
  reuseExistingServer: false,
  timeout: 60_000,
  env: { HOST: '127.0.0.1', PORT: String(porta), PAINEL_MODO: '', PAINEL_API_URL: '', PAINEL_MODULOS: '', ...env },
});

export default defineConfig({
  testDir: 'tests-painel',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4490', trace: 'off' },
  webServer: [
    { command: 'node tests-painel/backend-falso.mjs 4491', url: 'http://127.0.0.1:4491/saude', reuseExistingServer: false },
    servidor(4490, { PAINEL_MODO: 'demo' }),
    // como o preview: só Visão Geral e Reservas liberados
    servidor(4492, { PAINEL_MODO: 'api', PAINEL_API_URL: 'http://127.0.0.1:4491', PAINEL_MODULOS: 'visao-geral,reservas' }),
    servidor(4493, {}),
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1366, height: 860 } } },
    { name: 'webkit-celular', testMatch: /(reservas|responsivo)\.spec\.ts/, use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
