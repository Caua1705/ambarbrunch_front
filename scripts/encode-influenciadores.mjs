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

// Regra de duração (2026-10-18, definitiva): no máximo 40 s por vídeo; original com até 40 s entra inteiro, até o último
// quadro (sem acelerar). Campos opcionais: `trechos` = vários pedaços do MESMO original unidos por corte seco na imagem e
// micro-esmaecimento de 30 ms no áudio (tempos no quadro de 30 fps, a sincronia não escorrega); `silencio` = intervalo do
// ORIGINAL (ou lista de intervalos) em que só o áudio é zerado, com rampas de 30 ms (a imagem segue contínua). Um trecho pode
// ter recorte próprio ([início, fim, recorte]) quando o original troca de janela no meio; aí `tamanho` fixa a saída para os
// pedaços casarem. `limite` = exceção aos 40 s, só com pedido explícito do responsável.
const CLIPES = [
  // IF-02 · elevador: o story inteiro, do 1º quadro (0,1 s) ao último antes do story seguinte (troca de cena em 32,733 s).
  // Palavrão “caralho” em 15,75–16,36 s (nível de áudio a cada 10 ms; o modelo small o ouviu em 15,78–16,20 s): cortar a
  // palavra daria salto visível (a mão sai do cabelo, a cabeça vira) e a fala seguinte começa colada, sem pausa — então a
  // imagem segue contínua e só o áudio é silenciado nesse trecho (decisão do responsável, 2026-10-18).
  { id: 'IF-02a', src: 'originais/stories/stories_02_elevador_completo.mp4', out: 'criador-elevador-abrindo', start: 0.1, end: 32.7333, silencio: [15.74, 16.35], posterAt: 12.6 },
  // IF-04 · grupo: expectativa (story A, horizontal) e veredito do Biscoff (story B, combina com a legenda “1- Biscoff 1000/10”)
  // IF-04a (2026-10-18, pedido do responsável: “até o final”, EXCEÇÃO ao limite de 40 s): story A inteiro (0,45–28,533 s,
  // janela A) e, emendado na troca de cena, o story B inteiro (janela B, um pouco maior, reduzida ao tamanho da A) até o
  // último quadro antes do story seguinte (troca de cena em 72,533 s). Total 72,08 s. Áudio zerado, imagem contínua:
  //   42,66–44,45 s  “caralho” (som entre a pausa depois de “Sério?” e a queda de nível; só aparece na janela 42,6–44,0 s)
  //   66,45 s → fim  coro “do caralho” repetido (três vezes na transcrição da janela 66,4–72,4 s), sem pausa limpa até o fim
  //                  da fala (72,45 s); começa na pausa de 66,45–66,85 s, depois de “Malu”.
  // Fica a comparação “igual ao pretzel do Mr. Pretzel” (59,8–64,3 s), antes deixada de fora.
  { id: 'IF-04a', src: 'originais/stories/stories_04_grupo_completo.mp4', out: 'criadores-grupo-expectativa', trechos: [[0.45, 28.5333, MOLDURA.grupoA], [28.5333, 72.5333, MOLDURA.grupoB]], tamanho: '478:266', silencio: [[42.66, 44.45], [66.45, 72.5333]], limite: 75, posterAt: 5.5 },
  // alternativa do IF-04a sem recorte: o story inteiro (vertical), com a legenda “@roll.ofc a gente tava tão ansioso…” dos criadores
  { id: 'IF-04a-story', src: 'originais/stories/stories_04_grupo_completo.mp4', out: 'criadores-grupo-expectativa-story', start: 0.5, end: 14.3, posterAt: 5.5 },
  { id: 'IF-04b', src: 'originais/stories/stories_04_grupo_completo.mp4', out: 'criadores-grupo-biscoff', start: 49.6, end: 59.9, vf: MOLDURA.grupoB, posterAt: 3.5 },
  // IF-05 · @dailysocass, pistache (de volta ao carrossel em 2026-10-18, pedido do responsável; a gravação de tela enviada,
  // “Gravação de Tela 2026-10-17 101705.mp4”, é byte a byte este original). Saem os 5,8 s iniciais (fim do story anterior e
  // a criadora mastigando calada): começa em 5,85 s, logo antes da 1ª fala (“É o de pistache da Roll”, 5,9 s), e vai até o
  // último quadro. “…a Adriana, sua safada” (9,75–12,3 s nas transcrições medium e small) tem o ÁUDIO zerado de 9,70 s até a
  // queda de nível em 12,88 s, logo antes de “Meu Deus” (≥ 12,9 s, confirmado transcrevendo só essa janela).
  { id: 'IF-05a', src: 'originais/stories/stories_05_pistache.mp4', out: 'criadora-dailysocass-pistache', start: 5.85, end: 22.3333, silencio: [9.70, 12.88], vf: MOLDURA.pistache, posterAt: 1.2 },
  // IF-06 · @_magall (DdFJq86OyLo, 33,18 s). 2026-10-18 (pedido do responsável): o card só com música (IF-06a, close da
  // caixa) saiu do carrossel e o IF-06b passou a ser o reel inteiro, contínuo — o mais perto possível dos 40 s pedidos.
  // Voltam a fala “…de quinta a domingo” (4,0–8,56 s) e o convite para encomendar (16,12–22,64 s), antes cortados.
  { id: 'IF-06b', src: 'originais/magall/roll_influencer_DdFJq86OyLo_com_audio.mp4', out: 'criador-magall-viciado', start: 0, end: 33.1667, posterAt: 1.0 },
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
  // Pedaços do original (um só, na maioria) → um grafo trim/concat: imagem com corte seco, áudio com rampas de 30 ms na emenda.
  const trechos = c.trechos ?? [[c.start, c.end]];
  if (trechos.some(([a, b]) => b <= a)) { console.error(`✗ ${c.id}: trecho inválido`); process.exitCode = 1; continue; }
  const dur = +trechos.reduce((s, [a, b]) => s + (b - a), 0).toFixed(3);
  const limite = c.limite ?? 40;
  if (dur > limite) { console.error(`✗ ${c.id}: ${dur}s passa do limite de ${limite} s`); process.exitCode = 1; continue; }
  const vfDe = (recorte) => [recorte ?? c.vf, c.tamanho ? `scale=${c.tamanho}:flags=lanczos` : "scale='min(540,iw)':-2:flags=lanczos", 'fps=30', 'setsar=1'].filter(Boolean).join(',');
  const partes = trechos.map(([a, b, recorte], i) => {
    const vf = vfDe(recorte);
    const emenda = [i > 0 && 'afade=t=in:d=0.03', i < trechos.length - 1 && `afade=t=out:st=${(b - a - 0.03).toFixed(3)}:d=0.03`].filter(Boolean);
    return `[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS,${vf}[v${i}];[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,aresample=48000${emenda.map((f) => ',' + f).join('')}[a${i}]`;
  });
  const juntar = `${trechos.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${trechos.length}:v=1:a=1[vc][ac]`;
  // silêncio só no áudio (tempo do original → tempo do corte), com rampas de 30 ms; a imagem não muda
  // tempo do original → tempo do corte (soma dos pedaços anteriores + deslocamento dentro do pedaço)
  const noCorte = (t) => { let antes = 0; for (const [a, b] of trechos) { if (t <= b) return antes + Math.max(0, t - a); antes += b - a; } return antes; };
  const silencios = c.silencio ? (Array.isArray(c.silencio[0]) ? c.silencio : [c.silencio]) : [];
  const mudo = silencios.length
    ? `,asetnsamples=n=240,volume=eval=frame:volume='${silencios.map(([sa, sb]) => { const a = noCorte(sa); const b = noCorte(sb); return `max(0,min(1,max((${a.toFixed(3)}-t)/0.03,(t-${b.toFixed(3)})/0.03)))`; }).join('*')}'`
    : '';
  const fades = `afade=t=in:d=0.12,afade=t=out:st=${(dur - (c.fadeOut ?? 0.2)).toFixed(3)}:d=${c.fadeOut ?? 0.2}`;
  const grafo = (audioFim) => `${partes.join(';')};${juntar};[ac]${fades}${mudo}${audioFim}[aout]`;

  // Volume uniforme entre criadores (o botão de som não pode “estourar” de um vídeo para o outro): loudnorm em 2 passadas.
  const medida = ff(['-i', input, '-filter_complex', `${grafo(',loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json')};[vc]nullsink`, '-map', '[aout]', '-f', 'null', '-']);
  if (medida.status !== 0) { console.error(`✗ ${c.id}: medição de volume falhou\n${medida.stderr.slice(-1500)}`); process.exitCode = 1; continue; }
  const m = JSON.parse(medida.stderr.slice(medida.stderr.lastIndexOf('{'), medida.stderr.lastIndexOf('}') + 1));
  const loud = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;

  const output = path.join(OUT, `${c.out}.web.mp4`);
  const r = ff([
    '-v', 'error', '-i', input,
    '-filter_complex', grafo(`,${loud},aresample=48000`), '-map', '[vc]', '-map', '[aout]',
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
    id: c.id, origem: c.src, trechos: trechos.map(([a, b]) => [a, b]), silencio: c.silencio ?? null, recorte: c.vf ?? (trechos.some((t) => t[2]) ? trechos.map((t) => t[2]) : null), arquivo: path.relative(ROOT, output).replaceAll('\\', '/'),
    poster: path.relative(ROOT, poster).replaceAll('\\', '/'), largura: v.width, altura: v.height, duracao: +(+p.format.duration).toFixed(2),
    kb: Math.round(p.format.size / 1024), posterKb: Math.round(fs.statSync(poster).size / 1024), loudnessOrigemLUFS: +m.input_i,
  };
  registro.push(item);
  console.log(`✓ ${c.id} → ${item.arquivo}  ${item.largura}×${item.altura} · ${item.duracao}s · ${item.kb} KB (+ poster ${item.posterKb} KB) · origem ${m.input_i} LUFS → −16`);
}
// registro: substitui só os ids recriados agora (rodar alguns ids não apaga os outros)
const REG = path.join(OUT, 'derivados.json');
const antes = fs.existsSync(REG) ? JSON.parse(fs.readFileSync(REG, 'utf8')) : [];
const feitos = new Set(registro.map((r) => r.id));
fs.writeFileSync(REG, JSON.stringify([...antes.filter((r) => !feitos.has(r.id)), ...registro], null, 2) + '\n');
copiarParaRevisao();
