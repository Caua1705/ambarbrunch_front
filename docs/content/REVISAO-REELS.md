# Revisão dos Reels — Roll × Âmbar Brunch

> **Situação:** revisão técnica inicial (Etapa 1, 2026-10-16). **Nenhum vídeo está aprovado ou autorizado.**
> Nenhum arquivo foi editado, recortado, reencodado nem publicado. O áudio não foi alterado.

## Método

- **Técnico:** `ffprobe` (duração, codec, resolução, presença de faixa de áudio) e `volumedetect` (nível médio/pico).
- **Visual:** 8 frames distribuídos por vídeo (16 nos vídeos acima de 40 s), com timecode → `docs/content/catalogos/reels/<reel>-frames.jpg`.
- **Áudio:** campo `musicInfo` do JSON do Apify (nome da faixa, artista, `uses_original_audio`) + espectrograma (`catalogos/reels/espectrogramas-audio.png`).
  O espectrograma é uma inferência; **ninguém ouviu os vídeos ainda** — a natureza do áudio (voz, música, ambiente) deve ser confirmada ouvindo.

## Resumo

| # | Reel | Duração | Autor | Áudio (metadado) | O que mostra | Melhor uso | Prioridade |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| IV-01 | `2026-08-12_Db8YQOYginJ` | 5,7 s | @roll.ofc | Original da Roll | Close de rolls crus → glaceando → bandejas red velvet/Oreo | Loop curto mudo na seção Roll | **P1** |
| IV-02 | `2026-08-25_Dcew--3gAyo` | 21,2 s | @roll.ofc | “Day By Day” — Amaria (biblioteca IG) | Bandeja sobre mármore com fundo de folhagem; glacê sendo espalhado; abrindo um roll | Vídeo “processo” mudo | **P1** |
| IV-03 | `2026-08-26_DchT6--A_h8` | 57,5 s | @roll.ofc · coautores @adrianamisici, @madnutzbr | Original — **o arquivo baixado não tem faixa de áudio** | Pessoa com produtos MadNutz na cozinha, veste avental Roll; produção completa da massa ao forno | Bastidores (trechos sem marca de terceiro) | P3 |
| IV-04 | `2026-09-01_DcwqMBKgisc` | 19,5 s | @roll.ofc | “Window Eyes” — Veni Sun | Três pessoas provando rolls de Nutella/Mad Nutz num jardim | Card de reação/experiência | P2 |
| IV-05 | `2026-09-04_Dc4TZTRtHO9` | 111,4 s | **@larizgomes** (colab. @roll.ofc) | Voz original da autora (microfone de lapela visível) | Influenciadora provando a box de sabores, falando para a câmera | **Depoimento** (trecho de 10–20 s, com legenda) | **P1** se autorizado |
| IV-06 | `2026-09-17_DdZ5fRIA4f2` | 21,2 s | @roll.ofc | “Original audio” de **@justtrip.it** (áudio de terceiro) | Rack de forno com fornadas: pistache, tradicional, mirtilo, Nutella | Vídeo “feito aqui” mudo | **P1** |
| IV-07 | `2026-09-24_Ddrf0LBgz-a` | 9,1 s | @roll.ofc | “Weekend Drive (Instrumental)” — Corduroy Egg | Pessoa apresentando bandejas de quatro sabores numa escada | Card de experiência | P2 |
| IV-08 | `2026-10-01_Dd9V9KUz-nV` | 4,6 s | @roll.ofc | “You Might Be Right” — cloud cover | Bandeja Kinder Bueno, closes | Loop curto mudo | P2 |
| IV-09 | `2026-10-02_DeAT31Yg8Un` | 6,3 s | @roll.ofc | “I Love You More (feat. Lowen) (Instrumental)” — Company Money | Closes: s’mores, crumble de morango, Kinder Bueno | Loop curto mudo | P2 |

**Leitura rápida:** só **2 de 9** têm áudio original da própria Roll (IV-01 e IV-03, e o IV-03 veio sem a faixa). **5** usam música licenciada da biblioteca do Instagram, **1** usa áudio de outra conta e **1** é voz de influenciadora. A licença de música do Instagram vale **dentro do Instagram**, não para o site. A saída mais segura é usar os vídeos **sem a faixa de áudio** (não apenas silenciados no player).

## Fichas

### IV-01 · `2026-08-12_Db8YQOYginJ_video.mp4`
- **Técnico:** H.264 720×1280, 30 fps, AAC estéreo, 2,0 MB. Volume médio −16 dB.
- **Legenda:** “É hora de comer Rolls 😋🤍✨ Amanhã inicia nossas fornadas fresquinhas”.
- **Imagem:** boa nitidez nos closes; luz natural. No 2º segmento (≈1,4–3,6 s) há um **adesivo da interface do Instagram “It’s Roll time” com botões “+” e “×”** gravado na imagem — cortar esse trecho.
- **Áudio:** original da Roll; o espectrograma sugere som ambiente contínuo, sem batida. Confirmar.
- **Uso:** loop mudo de 3–4 s (1º e 3º segmentos). Fala bem com “massa fresquinha”.
- **Pendências:** autorização da Roll.

### IV-02 · `2026-08-25_Dcew--3gAyo_video.mp4`
- **Técnico:** H.264 720×1280, AAC, 5,0 MB. 21,17 s — mesma duração do IV-06, típico de recorte de faixa da biblioteca.
- **Legenda:** “Cinnamon roll tradicional tem o nosso coração 🤍 …”.
- **Imagem:** a mais “editorial” do conjunto: mármore claro, folhagem verde ao fundo, luva preta, glacê. Combina com a paleta creme/verde do jardim (FR-04).
- **Correção (2026-10-16, nos testes dos protótipos):** o vídeo tem **texto do Instagram gravado na imagem** (“so delicious”, com uma seta) na segunda metade, por volta dos 10 s. A grade de frames da primeira revisão não pegou esse trecho. Para usar, recortar o início (antes de ≈9 s) ou pedir o arquivo sem texto.
- **Áudio:** música “Day By Day” — Amaria (batida regular no espectrograma).
- **Uso:** vídeo de processo na seção Roll, **sem áudio**.
- **Pendências:** autorização da Roll; remover a faixa de música.

### IV-03 · `2026-08-26_DchT6--A_h8_video.mp4`
- **Técnico:** **VP9** 1080×1920, **sem faixa de áudio** no arquivo, 12,4 MB. A melhor resolução dos reels.
- **Legenda:** “Vem Aí! 🤍 novo sabor do próximo mês com @madnutzbr”. Coautores: @adrianamisici e @madnutzbr.
- **Imagem:** narrativa completa (sacola/caixas MadNutz → avental Roll → sova → recheio → enrolar → forno → finalização). Há marca de terceiro em vários trechos (abertura e fim).
- **Áudio:** o metadado indica áudio original, mas ele não veio no download. Se precisar de som, pedir o arquivo original.
- **Uso:** só trechos de mãos/massa/forno (≈14–47 s), sem MadNutz e sem rosto, se não houver autorização da pessoa.
- **Pendências:** autorização da Roll, da pessoa em cena (é provável que seja a coautora marcada — confirmar) e cuidado com a marca MadNutz. Sabor sazonal (setembro).

### IV-04 · `2026-09-01_DcwqMBKgisc_video.mp4`
- **Técnico:** H.264 720×1280, AAC, 4,5 MB. Pico −0,8 dB.
- **Legenda:** “Nossa leve reação ao experimentar o novo sabor… Roll com @madnutzbr é sem erro!”.
- **Imagem:** três pessoas com avental Roll provando, fundo de jardim; enquadramento de selfie, câmera fixa. Espontâneo e simpático, mas o produto MadNutz domina a bandeja.
- **Áudio:** música “Window Eyes” — Veni Sun; o espectrograma também sugere reações/vozes.
- **Uso:** card de “experiência” no carrossel, sem áudio.
- **Pendências:** direito de imagem das três pessoas; marca de terceiro; sabor sazonal.

### IV-05 · `2026-09-04_Dc4TZTRtHO9_video.mp4`
- **Técnico:** H.264 720×1280, AAC, 17,9 MB. Volume médio −17,8 dB, pico 0 dB (possível clipping pontual).
- **Autoria:** post de **@larizgomes** em colaboração com @roll.ofc (o vídeo é da influenciadora, não da Roll). 4.018 visualizações e 81 comentários na extração.
- **Legenda:** “Se tem uma coisa que eu sou é curiosa 😂 e, claro, fui experimentar os novos sabores de cinnamon roll da @roll.ofc…”.
- **Imagem:** fala para a câmera em ambiente doméstico (estante ao fundo), box branca, prova de cada sabor. Título sobreposto nos primeiros segundos (“PROVANDO NOVOS SABORES — CINNAMON ROLL”).
- **Áudio:** voz original (o espectrograma mostra fala contínua). Ouvir antes de selecionar o trecho e conferir se há trilha por baixo.
- **Uso:** o único **depoimento** real do acervo. Recortar 10–20 s com legenda em texto (HTML), com som só depois de um toque do usuário.
- **Pendências:** **autorização escrita da @larizgomes** para o uso no site e para o recorte; conferir se a fala cita sabores ou preços que já mudaram.

### IV-06 · `2026-09-17_DdZ5fRIA4f2_video.mp4`
- **Técnico:** H.264 720×1280, AAC, 4,7 MB. 21,17 s.
- **Legenda:** “Fornadas do mês esperando você! … #cinnamonroll #fortaleza-ce”.
- **Imagem:** rack de inox com várias fornadas coloridas — mostra volume e produção. Luz de cozinha um pouco amarelada.
- **Áudio:** “Original audio” atribuído a **@justtrip.it** — é o áudio de outra conta reaproveitado, não da Roll. O espectrograma mostra conteúdo tonal sustentado (provável música).
- **Uso:** vídeo “feito aqui / fornadas” **sem áudio**.
- **Pendências:** autorização da Roll; remover áudio de terceiro.

### IV-07 · `2026-09-24_Ddrf0LBgz-a_video.mp4`
- **Técnico:** H.264 720×1280, AAC, 1,7 MB.
- **Legenda:** “Nossas fornadas de Setembro que ganhou tantos elogios! … *Última semana desses sabores*”.
- **Imagem:** pessoa sorrindo e trocando bandejas (Nutella, pistache, tradicional, mirtilo); texto “Você pediu Roll 🤍” sobreposto o tempo todo. Ambiente de escada mais escuro.
- **Áudio:** “Weekend Drive (Instrumental)” — Corduroy Egg.
- **Uso:** card do carrossel; o texto gravado na imagem limita o reaproveitamento.
- **Pendências:** direito de imagem da pessoa (não identificada nos metadados); remover música; sabores de setembro.

### IV-08 · `2026-10-01_Dd9V9KUz-nV_video.mp4`
- **Técnico:** H.264 720×1280, AAC, 1,1 MB. O mais leve.
- **Legenda:** “Vai uma fornada de kinder bueno? 🫣😋🤍”.
- **Imagem:** closes da bandeja Kinder Bueno; corte para o fundo de folhagem. A marca Kinder é reconhecível no produto.
- **Áudio:** “You Might Be Right” — cloud cover.
- **Uso:** loop curto mudo.
- **Pendências:** autorização da Roll; remover música; marca de terceiro.

### IV-09 · `2026-10-02_DeAT31Yg8Un_video.mp4`
- **Técnico:** H.264 720×1280, AAC, 2,0 MB.
- **Legenda:** “Qual vai ser seu favorito?🤍🤌🏻”.
- **Imagem:** três closes muito apetitosos (s’mores tostado, crumble de morango, Kinder Bueno); texto “Outubro 🤍” sobreposto.
- **Áudio:** “I Love You More (feat. Lowen) (Instrumental)” — Company Money.
- **Uso:** loop mudo; o texto “Outubro” deixa o vídeo datado.
- **Pendências:** autorização da Roll; remover música; sabores sazonais.

## Recomendações para o carrossel de vídeos

1. **Carrossel de depoimentos** (o pedido de “vídeos de influenciadores”): hoje só existe **um** depoimento de fato (IV-05). IV-04 e IV-07 são vídeos de experiência com pessoas. Com 3 cards o carrossel funciona, mas é fino. **Precisamos de mais 2–4 vídeos de clientes/influenciadores, gravados no Âmbar, com autorização.**
2. **Faixa “fornadas”** (vídeos de produto, sem pessoas): IV-01, IV-02, IV-06, IV-08 e IV-09 — conteúdo da própria Roll, só precisa da autorização dela e da remoção do áudio.
3. Em todos: poster estático antes de tocar, carregamento sob demanda, sem autoplay com som, legenda em HTML.
4. **Nenhum vídeo mostra o Âmbar** (salão, jardim, mesa de brunch). Todos são da Roll, em cozinha ou casas. O carrossel reforça a Roll, não o destino “Âmbar Brunch”.
5. Vários sabores são sazonais (MadNutz, Kinder, s’mores, mirtilo, pistache); confirmar o que continua no cardápio.

## Checklist de autorização (por vídeo)

| Item | IV-01 | IV-02 | IV-03 | IV-04 | IV-05 | IV-06 | IV-07 | IV-08 | IV-09 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Autorização da Roll (@roll.ofc) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Autorização do autor/coautor externo | — | — | ☐ @adrianamisici | — | ☐ @larizgomes | — | — | — | — |
| Direito de imagem das pessoas em cena | — | — | ☐ | ☐ (3) | ☐ | — | ☐ | — | — |
| Áudio: remover faixa ou licenciar | ☐ confirmar | ☐ remover | sem faixa | ☐ remover | ☐ voz autorizada | ☐ remover | ☐ remover | ☐ remover | ☐ remover |
| Marca de terceiro visível | — | — | MadNutz | MadNutz | — | — | — | Kinder | Kinder |
| Texto/UI gravado na imagem | adesivo IG | “so delicious” (~10 s) | — | — | título | — | “Você pediu Roll” | — | “Outubro” |
| Sabor ainda no cardápio? | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
