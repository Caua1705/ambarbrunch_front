// Painel administrativo (/admin): roda o Astro com o painel ligado, sem mexer nos comandos do site público.
//   node scripts/painel.mjs dev [porta]        → astro dev com o painel (modo do .env / PAINEL_MODO)
//   node scripts/painel.mjs demo [porta]       → astro dev com dados de DEMONSTRAÇÃO (nada vai ao backend)
//   node scripts/painel.mjs build              → build com o painel em dist-painel/ (adaptador Node; na Vercel, o da Vercel)
//   node scripts/painel.mjs serve [porta]      → serve dist-painel/ (servidor Node do build)
// Variáveis: PAINEL_MODO=api|demo|indisponivel · PAINEL_API_URL=https://api… (só do servidor; nunca vai ao navegador).
import { spawn } from 'node:child_process';
import path from 'node:path';

const [cmd = 'dev', porta = '4480'] = process.argv.slice(2);
const env = { ...process.env, PAINEL_ADMIN: '1' };
if (cmd === 'demo') env.PAINEL_MODO = 'demo';

const astro = path.resolve('node_modules/astro/bin/astro.mjs');
const OUT = 'dist-painel';
let args;
if (cmd === 'dev' || cmd === 'demo') args = [astro, 'dev', '--port', porta, '--host', '127.0.0.1'];
else if (cmd === 'build') args = [astro, 'build', '--outDir', OUT];
else if (cmd === 'serve') {
  env.HOST = '127.0.0.1';
  env.PORT = porta;
  args = [path.join(OUT, 'server', 'entry.mjs')];
} else {
  console.error(`comando desconhecido: ${cmd} (use dev, demo, build ou serve)`);
  process.exit(2);
}
const filho = spawn(process.execPath, args, { stdio: 'inherit', env });
filho.on('exit', (code) => process.exit(code ?? 0));
