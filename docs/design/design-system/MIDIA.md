# Mídia: otimização e carregamento — Fornada Âmbar

> O v1 transferia **5,4 MB** ao rolar a página inteira (3,3 MB de imagens, 2,0 MB de vídeo), com um JPG de 995 KB,
> um vídeo de 4,5 MB **com trilha de terceiros** e o PNG da Roll (117 KB) repetido três vezes.

## 1. Fluxo de um arquivo até o site

```text
creative/source/…        acervo bruto (fora do Git)
      │  curadoria + autorização registradas no ASSET-MANIFEST
      ▼
creative/approved/…      original aprovado (fora do Git)
      │  cópia para o código
      ▼
src/assets/media/…       original aprovado, processado no build pelo astro:assets (sharp)
public/media/video/…     só *.web.mp4 / *.web.webm e *.poster.webp (política do .gitignore)
```

Nada vai para `public/media` ou `src/assets` sem autorização registrada.

## 2. Imagens

| Regra | Valor |
| --- | --- |
| Formatos | AVIF com fallback WebP, via `<Picture>` do `astro:assets` |
| Larguras geradas | 360, 540, 720, 1080 (e 1440 só no desktop) |
| `sizes` | pela largura real da peça na colagem; ex.: círculo do hero `sizes="(min-width: 960px) 30vw, 46vw"` |
| Dimensões | `width`/`height` sempre declarados (CLS = 0) |
| Prioridade | **só** o logo e a foto do círculo do hero com `fetchpriority="high"` e sem `loading="lazy"`; todo o resto `loading="lazy"` + `decoding="async"` |
| Qualidade | AVIF q≈55, WebP q≈72; conferir pratos lado a lado |
| Logos | o logo Âmbar continua em PNG transparente otimizado (é o oficial; sem redesenhar em SVG); o da Roll é reduzido a 2× do tamanho exibido (de 117 KB para ~15 KB) |
| Orçamento | 1ª tela ≤ 400 KB · página inteira sem vídeos ≤ 2,5 MB |

## 3. Vídeos

| Regra | Valor |
| --- | --- |
| Reexporte | `scripts/encode-video.mjs` (ffmpeg): H.264 720×1280, ~1 Mbps, `-an` (**sem faixa de áudio**), `+faststart`; opcional WebM VP9 |
| Duração | trecho de 4–10 s em loop; o IV-02 só até ~9 s (depois disso tem o texto “so delicious” gravado na imagem) |
| Peso | ≤ 1,5 MB por vídeo |
| Poster | frame do próprio vídeo em WebP (já gerados em `creative/source/video/roll_reels/posters/`) |
| Carregamento | `preload="none"` + poster; o arquivo só baixa quando o card vai tocar |
| Reprodução | mudo, `playsinline`, **um por vez** (o card mais visível, ≥ 60%), pausa fora da tela |
| Controle | toque no card toca/pausa; pausa global e movimento reduzido impedem o autoplay |
| Fala | vídeo com fala (ex.: IV-05) só com autorização, com legenda WebVTT e botão “ativar som” acionado pelo visitante |
| Crédito | `.story__by` obrigatório: “@roll.ofc · vídeo da própria Roll” ou “@criadora · sobre a Roll” |
| Publicação | no build de produção, vídeo com `autorizado: false` **não é renderizado** |

## 4. Fontes

Bricolage Grotesque e Fraunces auto-hospedadas (Fontsource), subset latino, `font-display: swap`, *preload* só do arquivo usado no título do hero. Remove a dependência do Google Fonts e deixa os testes visuais determinísticos.

## 5. Procedência e direitos (regras de conteúdo)

| Campo no conteúdo | Efeito |
| --- | --- |
| `fotoAntiga: true` | mostra `.ref-note` ou `.notice` |
| `autorizado: false` | não vai para produção |
| `autor` | preenche o crédito do story |
| `semAudio: true` | obrigatório para vídeo com música de terceiros |

## 6. Orçamento de performance (Lighthouse, perfil móvel 4G)

LCP ≤ 2,5 s · CLS ≤ 0,05 · INP ≤ 200 ms · JS da home ≤ 15 KB gzip (sem a ilha) · ilha da reserva ≤ 25 KB gzip · 1ª tela ≤ 400 KB.

Hoje o JS do design system tem 5 módulos pequenos, sem dependências: ver `src/lib/`.
