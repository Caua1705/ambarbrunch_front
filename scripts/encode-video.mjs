// Reexporta os vídeos dos stories para a web: H.264, 540×960, SEM faixa de áudio, faststart, trecho curto.
// Requer ffmpeg no PATH. Saída em public/media/video/*.web.mp4 (política do .gitignore).
//
//   npm run media:video            (todos)
//   npm run media:video -- IV-06b  (só os ids indicados)
//
// Os vídeos da Roll e de @larizgomes foram autorizados em 2026-10-17 (só as versões web, sem áudio:
// os originais têm música de terceiros). O site só mostra vídeos com `autorizado: true` ou em modo de revisão.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/media/video');
const SRC = path.join(ROOT, 'creative/source/video/roll_reels');

// início/duração escolhidos para um loop limpo; IV-02 não é usado (texto gravado na imagem após ~9 s)
const VIDEOS = [
  { id: 'IV-06', file: '2026-09-17_DdZ5fRIA4f2_video.mp4', out: 'roll-do-forno', start: 0, dur: 9 },
  // “sabores do mês”: 2º trecho do IV-06 (fornada de Nutella saindo do rack; o mirtilo já aparece no “do forno”), sem texto na imagem. Substitui o IV-09,
  // que tinha “Outubro 🤍” gravado no centro de todos os quadros (datado; recortar exigiria ampliar 1,65×).
  { id: 'IV-06b', file: '2026-09-17_DdZ5fRIA4f2_video.mp4', out: 'roll-sabores-do-mes', start: 14.5, dur: 5.5, poster: 'roll/poster-sabores-do-mes.webp', posterAt: 1.5 },
  { id: 'IV-08', file: '2026-10-01_Dd9V9KUz-nV_video.mp4', out: 'roll-bandeja', start: 0, dur: 4.6 },
  // criadora (@larizgomes): trecho sem texto na imagem nem transição, segurando o roll de pistache; sem áudio
  { id: 'IV-05', file: '2026-09-04_Dc4TZTRtHO9_video.mp4', out: 'roll-criadora-larizgomes', start: 38, dur: 9, poster: 'roll/poster-criadora-larizgomes.webp', posterAt: 1 },
];

fs.mkdirSync(OUT, { recursive: true });
const so = process.argv.slice(2);
for (const v of VIDEOS) {
  if (so.length && !so.includes(v.id)) continue;
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
  if (v.poster) {
    const destino = path.join(ROOT, 'src/assets/media', v.poster);
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(v.posterAt ?? 0), '-i', output, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', destino], { stdio: 'inherit' });
  }
  console.log(`✓ ${v.id} → public/media/video/${v.out}.web.mp4  ${(fs.statSync(output).size / 1024).toFixed(0)} KB (${v.dur}s, sem áudio)`);
}
