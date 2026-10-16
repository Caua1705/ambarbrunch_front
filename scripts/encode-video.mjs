// Reexporta os vídeos dos stories para a web: H.264, 540×960, SEM faixa de áudio, faststart, trecho curto.
// Requer ffmpeg no PATH. Saída em public/media/video/*.web.mp4 (política do .gitignore).
//
//   npm run media:video
//
// Os vídeos da Roll têm autorização pendente e música de terceiros: a saída fica fora do Git
// (ver .gitignore) e o site só os mostra com `autorizado: true` ou em modo de revisão local.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/media/video');
const SRC = path.join(ROOT, 'creative/source/video/roll_reels');

// início/duração escolhidos para um loop limpo; IV-02 não é usado (texto gravado na imagem após ~9 s)
const VIDEOS = [
  { id: 'IV-06', file: '2026-09-17_DdZ5fRIA4f2_video.mp4', out: 'roll-do-forno', start: 0, dur: 9 },
  { id: 'IV-09', file: '2026-10-02_DeAT31Yg8Un_video.mp4', out: 'roll-sabores-do-mes', start: 0, dur: 6.3 },
  { id: 'IV-08', file: '2026-10-01_Dd9V9KUz-nV_video.mp4', out: 'roll-bandeja', start: 0, dur: 4.6 },
];

fs.mkdirSync(OUT, { recursive: true });
for (const v of VIDEOS) {
  const input = path.join(SRC, v.file);
  if (!fs.existsSync(input)) { console.warn(`! ${v.id} não encontrado: ${v.file}`); continue; }
  const output = path.join(OUT, `${v.out}.web.mp4`);
  const args = [
    '-y', '-v', 'error', '-ss', String(v.start), '-t', String(v.dur), '-i', input,
    '-an',                                             // sem áudio (música de terceiros)
    '-vf', 'scale=540:960:force_original_aspect_ratio=increase,crop=540:960,fps=30',
    '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-preset', 'slow', '-crf', '27', '-maxrate', '1100k', '-bufsize', '2200k',
    '-movflags', '+faststart', output,
  ];
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`✗ ${v.id} falhou`); process.exitCode = 1; continue; }
  console.log(`✓ ${v.id} → public/media/video/${v.out}.web.mp4  ${(fs.statSync(output).size / 1024).toFixed(0)} KB (${v.dur}s, sem áudio)`);
}
