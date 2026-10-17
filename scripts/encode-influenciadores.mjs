// Cortes de CRIADORES (influenciadores) para a futura seção de reviews — versões web COM áudio, ainda em revisão.
// Requer ffmpeg/ffprobe no PATH. Lê e grava SOMENTE em creative/source/video/influenciadores/ (ignorado no Git):
//   originais/  → brutos (stories gravados da tela + reels de @_magall baixados pelo kit)
//   derivados/criadores/<out>.web.mp4 + <out>.poster.webp + derivados.json
// Nada vai para public/media até a autorização de imagem, voz e nome de cada criador (ver docs/content/INFLUENCIADORES.md).
//
//   npm run media:influenciadores            (todos)
//   npm run media:influenciadores -- IF-05a  (só os ids indicados)
//   npm run media:influenciadores -- --revisao  (só copia os derivados para as pastas de revisão local)
//
// Regras dos cortes: um trecho contínuo por arquivo (sem colar falas de momentos diferentes), começa e termina
// em pausa da fala, sem palavrão na fala nem na legenda gravada, sem a transição para o story seguinte.
// Textos e @ que o criador gravou na imagem ficam como estão. O recorte só remove a moldura da gravação de tela.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = path.join(ROOT, 'creative/source/video/influenciadores');
const OUT = path.join(BASE, 'derivados/criadores');

// Moldura da gravação de tela, medida por variância entre quadros (bordas paradas) — ver docs/content/INFLUENCIADORES.md.
const MOLDURA = {
  grupoA: 'crop=478:266:15:243',   // story A do grupo: vídeo horizontal dentro do story (fundo bege + legenda abaixo)
  grupoB: 'crop=490:274:8:240',    // story B do grupo: outra janela, um pouco maior
  pistache: 'crop=398:654:58:84',  // story com borda escura da gravação, sem a faixa do Instagram no topo (avatar + nome do perfil); a legenda e o @roll.ofc que a criadora escreveu ficam
};

const CLIPES = [
  // IF-02 · elevador: termina em “olha esses” abrindo a caixa, antes de um trecho com palavra possivelmente imprópria (~15,8 s)
  { id: 'IF-02a', src: 'originais/stories/stories_02_elevador_completo.mp4', out: 'criador-elevador-abrindo', start: 0.1, end: 13.5, posterAt: 12.6 },
  // IF-04 · grupo: expectativa (story A, horizontal) e veredito do Biscoff (story B, combina com a legenda “1- Biscoff 1000/10”)
  { id: 'IF-04a', src: 'originais/stories/stories_04_grupo_completo.mp4', out: 'criadores-grupo-expectativa', start: 0.5, end: 14.22, vf: MOLDURA.grupoA, posterAt: 5.5 },
  // alternativa do IF-04a sem recorte: o story inteiro (vertical), com a legenda “@roll.ofc a gente tava tão ansioso…” dos criadores
  { id: 'IF-04a-story', src: 'originais/stories/stories_04_grupo_completo.mp4', out: 'criadores-grupo-expectativa-story', start: 0.5, end: 14.3, posterAt: 5.5 },
  { id: 'IF-04b', src: 'originais/stories/stories_04_grupo_completo.mp4', out: 'criadores-grupo-biscoff', start: 49.6, end: 59.9, vf: MOLDURA.grupoB, posterAt: 3.5 },
  // IF-05 · @dailysocass, pistache: fala contínua 12,8–20,6 s; o trecho 10–12 s (fala incerta na transcrição) fica de fora
  { id: 'IF-05a', src: 'originais/stories/stories_05_pistache.mp4', out: 'criadora-dailysocass-pistache', start: 12.7, end: 20.7, vf: MOLDURA.pistache, posterAt: 1.2 },
  // IF-06 · @_magall (DdFJq86OyLo): abertura sem a frase “fornadas de quinta a domingo” (dia/horário antigo) e sem o CTA de pedido
  { id: 'IF-06a', src: 'originais/magall/roll_influencer_DdFJq86OyLo_com_audio.mp4', out: 'criador-magall-sabores', start: 8.45, end: 16.1, fadeOut: 0.1, posterAt: 1.5 },
  // IF-06 · frase de abertura completa, curta (“eu definitivamente estou viciado e esse vício tem nome: Roll”)
  { id: 'IF-06b', src: 'originais/magall/roll_influencer_DdFJq86OyLo_com_audio.mp4', out: 'criador-magall-viciado', start: 0, end: 4.26, fadeOut: 0.08, posterAt: 1.0 },
  // IF-07 · @_magall (Db_ajKouIuH): apresentação, antes do 1º palavrão (falado e legendado a partir de ~12 s)
  { id: 'IF-07a', src: 'originais/magall/roll_influencer_Db_ajKouIuH_com_audio.mp4', out: 'criador-magall-apresentacao', start: 1.2, end: 11.6, posterAt: 4.6 },
];

const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8' });
const probe = (f) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'json', f], { encoding: 'utf8' }).stdout);

fs.mkdirSync(OUT, { recursive: true });
// Revisão local: o site (modo revisão) lê vídeos, legendas e capas de pastas IGNORADAS no Git
// (public/media/revisao/ e src/assets/media/revisao/). Só vai para public/media/video depois de autorizado.
const REV_VIDEO = path.join(ROOT, 'public/media/revisao/criadores');
const REV_IMG = path.join(ROOT, 'src/assets/media/revisao');
const LEGENDAS = path.join(BASE, 'derivados/legendas');   // .vtt revisadas à mão a partir das transcrições
const FOTOS = path.join(ROOT, 'creative/source/photography/roll_instagram/candidatos');
function copiarParaRevisao() {
  fs.mkdirSync(REV_VIDEO, { recursive: true }); fs.mkdirSync(path.join(REV_IMG, 'criadores'), { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.web.mp4')) { fs.copyFileSync(path.join(OUT, f), path.join(REV_VIDEO, f)); n++; }
    if (f.endsWith('.poster.webp')) { fs.copyFileSync(path.join(OUT, f), path.join(REV_IMG, 'criadores', f.replace('.poster', ''))); n++; }
  }
  if (fs.existsSync(LEGENDAS)) for (const f of fs.readdirSync(LEGENDAS)) if (f.endsWith('.vtt')) { fs.copyFileSync(path.join(LEGENDAS, f), path.join(REV_VIDEO, f)); n++; }
  // fotos da Roll ainda sem autorização específica (IG-02): hero e anatomia do roll
  if (fs.existsSync(FOTOS)) for (const f of fs.readdirSync(FOTOS)) if (f.endsWith('.webp')) { fs.copyFileSync(path.join(FOTOS, f), path.join(REV_IMG, f)); n++; }
  console.log(`→ ${n} arquivos copiados para a revisão local (public/media/revisao, src/assets/media/revisao)`);
}
if (process.argv.includes('--revisao')) { copiarParaRevisao(); process.exit(0); }
const so = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const registro = [];
for (const c of CLIPES) {
  if (so.length && !so.includes(c.id)) continue;
  const input = path.join(BASE, c.src);
  if (!fs.existsSync(input)) { console.warn(`! ${c.id} não encontrado: ${c.src}`); continue; }
  const dur = +(c.end - c.start).toFixed(3);
  const vf = [c.vf, "scale='min(540,iw)':-2:flags=lanczos", 'fps=30', 'setsar=1'].filter(Boolean).join(',');
  const fades = `afade=t=in:d=0.12,afade=t=out:st=${(dur - (c.fadeOut ?? 0.2)).toFixed(3)}:d=${c.fadeOut ?? 0.2}`;

  // Volume uniforme entre criadores (o botão de som não pode “estourar” de um vídeo para o outro): loudnorm em 2 passadas.
  const medida = ff(['-ss', String(c.start), '-t', String(dur), '-i', input, '-vn', '-af', `${fades},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  const m = JSON.parse(medida.stderr.slice(medida.stderr.lastIndexOf('{'), medida.stderr.lastIndexOf('}') + 1));
  const loud = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;

  const output = path.join(OUT, `${c.out}.web.mp4`);
  const r = ff([
    '-v', 'error', '-ss', String(c.start), '-t', String(dur), '-i', input,
    '-vf', vf, '-af', `${fades},${loud},aresample=48000`,
    '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '25', '-maxrate', '1400k', '-bufsize', '2800k',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
    '-movflags', '+faststart', output,
  ]);
  if (r.status !== 0) { console.error(`✗ ${c.id} falhou\n${r.stderr}`); process.exitCode = 1; continue; }
  const poster = path.join(OUT, `${c.out}.poster.webp`);
  ff(['-v', 'error', '-ss', String(c.posterAt), '-i', output, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', poster]);

  const p = probe(output);
  const v = p.streams.find((s) => s.codec_type === 'video');
  const item = {
    id: c.id, origem: c.src, trecho: [c.start, c.end], recorte: c.vf ?? null, arquivo: path.relative(ROOT, output).replaceAll('\\', '/'),
    poster: path.relative(ROOT, poster).replaceAll('\\', '/'), largura: v.width, altura: v.height, duracao: +(+p.format.duration).toFixed(2),
    kb: Math.round(p.format.size / 1024), posterKb: Math.round(fs.statSync(poster).size / 1024), loudnessOrigemLUFS: +m.input_i,
  };
  registro.push(item);
  console.log(`✓ ${c.id} → ${item.arquivo}  ${item.largura}×${item.altura} · ${item.duracao}s · ${item.kb} KB (+ poster ${item.posterKb} KB) · origem ${m.input_i} LUFS → −16`);
}
if (!so.length) fs.writeFileSync(path.join(OUT, 'derivados.json'), JSON.stringify(registro, null, 2) + '\n');
copiarParaRevisao();
