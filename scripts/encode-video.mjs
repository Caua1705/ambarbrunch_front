// Reexporta os vídeos dos stories para a web: H.264, 540×960, faststart, trecho curto. Os da Roll saem SEM áudio
// (música de terceiros); o de criadora (`audio: true`) mantém a voz original, com o volume nivelado ao dos outros criadores.
// Requer ffmpeg no PATH. Saída em public/media/video/*.web.mp4 (política do .gitignore).
//
//   npm run media:video            (todos)
//   npm run media:video -- IV-06b  (só os ids indicados)
//
// Os vídeos da Roll e de @larizgomes foram autorizados em 2026-10-17. Na mesma data o responsável pediu o áudio
// original em todos os vídeos de criadores: @larizgomes passa a sair com a voz dela. O site só mostra vídeos com
// `autorizado: true` ou em modo de revisão.
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
  // criadora (@larizgomes), com a voz dela: pistache e Nutella com castanha, de “Gente, o de pistache me hipnotizou…” até
  // “…a castanha e a Nutella são perfeitas.” (46,95–72,15 s, 25,2 s), começando e terminando em pausa (−50 dB e −45 dB).
  // Sem texto na imagem e depois da transição de papel rasgado (~37 s). Fica de fora: antes, “esses daqui são sabores novos”
  // (datado); depois, ~72,4–74,8 s de fala que a transcrição não entende (“não ficou muito…”, “meu Deus do céu”) e, a partir
  // de ~75 s, o de mirtilo, que tem texto gravado na imagem (~101 s) e passaria dos 40 s.
  { id: 'IV-05', file: '2026-09-04_Dc4TZTRtHO9_video.mp4', out: 'roll-criadora-larizgomes', start: 46.95, dur: 25.2, audio: true, poster: 'roll/poster-criadora-larizgomes.webp', posterAt: 3.2 },
];

// Volume igual ao dos outros criadores (scripts/encode-influenciadores.mjs): loudnorm em 2 passadas, −16 LUFS.
function nivel(input, v) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(v.start), '-t', String(v.dur), '-i', input, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
  return `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
}

fs.mkdirSync(OUT, { recursive: true });
const so = process.argv.slice(2);
for (const v of VIDEOS) {
  if (so.length && !so.includes(v.id)) continue;
  const input = path.join(SRC, v.file);
  if (!fs.existsSync(input)) { console.warn(`! ${v.id} não encontrado: ${v.file}`); continue; }
  const output = path.join(OUT, `${v.out}.web.mp4`);
  const audio = v.audio
    ? ['-af', `afade=t=in:d=0.12,afade=t=out:st=${(v.dur - 0.2).toFixed(2)}:d=0.2,${nivel(input, v)},aresample=48000`, '-c:a', 'aac', '-b:a', '96k', '-ac', '2']
    : ['-an'];                                         // sem áudio (música de terceiros)
  const args = [
    '-y', '-v', 'error', '-ss', String(v.start), '-t', String(v.dur), '-i', input,
    ...audio,
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
  console.log(`✓ ${v.id} → public/media/video/${v.out}.web.mp4  ${(fs.statSync(output).size / 1024).toFixed(0)} KB (${v.dur}s, ${v.audio ? 'com a voz original' : 'sem áudio'})`);
}
