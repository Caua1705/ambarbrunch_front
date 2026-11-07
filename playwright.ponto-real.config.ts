import { defineConfig } from '@playwright/test';
import path from 'node:path';

// Equipe e Ponto CONTRA O BACKEND REAL local, com o motor facial real e câmera falsa do Chromium alimentada por vídeo. Nada
// aqui usa mock. Nunca aponte para a produção: os testes gravam funcionários, batidas e tablets.
//
//   giardini_back: python ops/biometria/homologacao_local.py preparar <cenarios.json>
//                  python ops/biometria/homologacao_local.py subir            (porta 8765, módulo ligado)
//                  python ops/biometria/homologacao_local.py subir 8766 --desligado
//   aqui:          PAINEL_ADMIN=1 PUBLIC_PONTO_API_URL=http://127.0.0.1:8765 npm run painel:build
//                  PONTO_REAL_CENARIOS=<cenarios.json> PONTO_REAL_VIDEOS=<pasta> npx playwright test -c playwright.ponto-real.config.ts
//
// Os vídeos saem de fotos públicas (ops/biometria/video_sintetico.py), nunca de funcionários. Passar aqui prova a integração,
// não prova de vida: o rosto "vira" por manipulação digital de uma foto parada.
const API = process.env.PONTO_REAL_API ?? 'http://127.0.0.1:8765';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(API)) throw new Error('PONTO_REAL_API precisa ser um backend LOCAL.');
const VIDEOS = process.env.PONTO_REAL_VIDEOS ?? '';
if (!VIDEOS) throw new Error('Defina PONTO_REAL_VIDEOS (pasta com os .y4m).');

const camera = (arquivo: string) => ({
  channel: undefined,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${path.join(VIDEOS, arquivo)}`],
});
const projeto = (name: string, arquivo: string, testMatch: RegExp, dependencies: string[] = []) => ({
  name,
  testMatch,
  dependencies,
  use: { browserName: 'chromium' as const, viewport: { width: 1280, height: 800 }, launchOptions: camera(arquivo) },
});

const servidor = (porta: number, api: string) => ({
  command: 'node dist-painel/server/entry.mjs',
  url: `http://127.0.0.1:${porta}/admin/login`,
  reuseExistingServer: false,
  timeout: 60_000,
  env: { HOST: '127.0.0.1', PORT: String(porta), PAINEL_MODO: 'api', PAINEL_API_URL: api, PAINEL_MODULOS: '', PAINEL_API_CHAVE: '' },
});

export default defineConfig({
  testDir: 'tests-ponto-real',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4495', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [servidor(4495, API.replace(/\/+$/, '')), servidor(4496, 'http://127.0.0.1:8766')],
  projects: [
    projeto('pessoa-cadastrada', 'pessoa_a.y4m', /01-.*\.spec\.ts/),
    projeto('rosto-desconhecido', 'pessoa_b.y4m', /02-.*\.spec\.ts/, ['pessoa-cadastrada']),
    projeto('foto-parada', 'foto_parada.y4m', /03-.*\.spec\.ts/, ['pessoa-cadastrada']),
    projeto('sem-rosto', 'sem_rosto.y4m', /04-.*\.spec\.ts/, ['pessoa-cadastrada']),
    projeto('dois-rostos', 'dois_rostos.y4m', /05-.*\.spec\.ts/, ['pessoa-cadastrada']),
    {
      name: 'sem-camera',
      testMatch: /06-.*\.spec\.ts/,
      dependencies: ['pessoa-cadastrada'],
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--use-fake-ui-for-media-stream'] } },
    },
    {
      name: 'painel',
      testMatch: /07-.*\.spec\.ts/,
      dependencies: ['pessoa-cadastrada'],
      use: { browserName: 'chromium', viewport: { width: 1366, height: 860 } },
    },
    // API simulada: só estados de tela. Não conta como integração.
    projeto('estados-de-tela', 'pessoa_a.y4m', /08-.*\.spec\.ts/),
    { name: 'modulo-desligado', testMatch: /09-.*\.spec\.ts/, use: { browserName: 'chromium' } },
  ],
});
