# Vídeos de criadores (influenciadores): importação e curadoria

> **Situação:** em revisão (2026-10-17). **Nenhum vídeo desta página está autorizado.** Originais e derivados ficam em
> `creative/source/video/influenciadores/` (ignorado no Git). Nada foi copiado para `public/media` nem `src/assets`.
> Publicar exige autorização de **imagem, voz e nome** de cada criador, inclusive para cortes reeditados.

## Origem

| Pacote recebido | Onde está agora | Observação |
| --- | --- | --- |
| `AMBAR_REVISAO_VISUAL_E_INFLUENCIADORES/` (raiz; já veio extraído, sem o `.zip`) | mantido intacto na raiz (ignorado no Git); cópias de trabalho abaixo | `LEIA-PRIMEIRO.txt` do pacote lido e seguido |
| `ROLL_REELS_MAGALL_download_kit/` (raiz) | mantido na raiz (ignorado no Git); script corrigido no lugar | o pacote acima tem uma cópia idêntica e **não corrigida** do kit em `json_instagram/` |

### Script `baixar_reels_magall.ps1`: correções

1. **`$id:` → `${id}:`** na mensagem de falha (o erro `InvalidVariableReferenceWithDrive` impedia o script de rodar).
2. **Loop de uma volta só.** No PowerShell 5.1, `@(Get-Content … | ConvertFrom-Json)` embrulha o array inteiro num único
   item; o `foreach` rodaria uma vez com as duas URLs juntas e falharia. Comprovado no PS 5.1.26100 e corrigido.
3. Download em `*.part` e renomeado só quando completo (um download interrompido não é mais tomado como pronto).
4. Barra de progresso desligada (deixa o `Invoke-WebRequest` muito lento no 5.1), TLS 1.2 e User-Agent de navegador.
5. Áudio copiado sem recompressão (AAC original); recompressão só como alternativa. Contagem de falhas e código de saída 1.

Executado em 2026-10-17 às 13:45 UTC. As URLs assinadas venciam em 18/10 entre 21:45 e 23:17 UTC; **as 4 baixaram**
(nenhuma expirada).

### Verificação técnica dos reels baixados

| Reel | Vídeo | Áudio | Duração | Integridade | Sincronização |
| --- | --- | --- | --- | --- | --- |
| `DdFJq86OyLo` (09/09/2026) | H.264 720×1280 30 fps | AAC 44,1 kHz estéreo | 33,1 s | decodificação completa sem erros | 0 ms |
| `Db_ajKouIuH` (13/08/2026) | H.264 720×1280 30 fps | AAC 44,1 kHz estéreo | 49,8 s | decodificação completa sem erros | 0 ms |

O `videoUrl` do Instagram já trazia áudio embutido. A faixa separada (`audioUrl`) é **idêntica** a ele (correlação 1,000 e
defasagem 0 ms medidas por correlação cruzada), então o `*_com_audio.mp4` está sincronizado. Os 3 arquivos de cada reel ficam guardados.

## Inventário (`IF` = influenciador)

| ID | Arquivo de trabalho (`creative/source/video/influenciadores/originais/`) | Formato | Conteúdo | Situação |
| --- | --- | --- | --- | --- |
| IF-01 | `stories/stories_01_elevador_trecho_curto.mp4` | 506×782 · 5,5 s | **Duplicata parcial do IF-02**: 1 s do story anterior (“@roll.ofc 1000/10”) + os primeiros ~4 s do IF-02 | descartado (o IF-02 contém tudo) |
| IF-02 | `stories/stories_02_elevador_completo.mp4` | 510×782 · 33,9 s | Gravação de tela de um story: criadora no elevador abre a caixa de 4 rolls. Textos gravados: “taste test de hoje @roll.ofc”, “cinamon ROLLLLL”. O último 1 s já é o story seguinte | em revisão · crédito **desconhecido** |
| IF-03 | `stories/stories_03_grupo_trecho_curto.mp4` | 502×774 · 12,9 s | **Duplicata parcial do IF-04**: 1 s do story “AI NAOOOO @roll.ofc” + os primeiros ~12 s do IF-04 | descartado |
| IF-04 | `stories/stories_04_grupo_completo.mp4` | 506×762 · 74,2 s | Gravação de tela de **2 stories seguidos** de um grupo (4 pessoas) provando a caixa: story A 0,4–28,5 s (vídeo horizontal dentro do story, legenda “@roll.ofc a gente tava tão ansioso pra issoooo”) e story B 28,5–72,5 s (texto “1- Biscoff 1000/10”). Último 1,7 s = outro story | em revisão · crédito **desconhecido** |
| IF-05 | `stories/stories_05_pistache.mp4` | 512×780 · 22,4 s | Story de **@dailysocass** (nome visível no topo) provando o roll de pistache. Texto: “o de pistache suuurreallll @roll.ofc” | em revisão |
| IF-06 | `magall/roll_influencer_DdFJq86OyLo_*.mp4` (vídeo, áudio, com_audio) | 720×1280 · 33,1 s | Reel de **@_magall** (Guilherme Magalhães), coautoria @roll.ofc, áudio original. Caixa com pistache, tradicional, Nutella com castanha e mirtilo | em revisão |
| IF-07 | `magall/roll_influencer_Db_ajKouIuH_*.mp4` | 720×1280 · 49,8 s | Reel de **@_magall**, coautoria @roll.ofc. Prova o tradicional à noite; **palavrões na fala e nas legendas gravadas** a partir de 12 s | em revisão · P3 |
| — | `transcricoes/*.json` | — | Transcrição automática (faster-whisper `medium`, com tempo por palavra). **Não é fonte de citação**: conferir ouvindo | uso interno |

Os IF-01…05 são gravações de tela (cursor do mouse visível no IF-01), por isso a resolução baixa (~510 px de largura).

### Referências do pacote (somente estudo)

| ID | Arquivo | Conteúdo |
| --- | --- | --- |
| RF-08 | `references/motion/zuzzi_carrossel_influenciadores.mp4` | Carrossel de reviews da Zuzzi (card central maior, vizinhos cortados). Não copiar |
| RF-09 | `references/screenshots/zuzzi_informacao_nutricional.png` | Tabela nutricional da Zuzzi. Não copiar dados nem layout |
| DC-19 | `references/motion/ambar_homepage_atual_390px.mp4` | Gravação da home atual em 390 px |
| DC-20 | `references/screenshots/hero_ambar_atual.png` | Captura do hero atual |

## Curadoria: cortes preparados

Regras: **um trecho contínuo por arquivo** (nada colado de momentos diferentes), começo e fim em pausa da fala, sem palavrão
na fala nem na legenda gravada, sem quadros do story seguinte, textos e @ gravados pelo criador **preservados**.
Recriar: `npm run media:influenciadores` (`scripts/encode-influenciadores.mjs`). Saída em
`creative/source/video/influenciadores/derivados/criadores/` (`*.web.mp4` + `*.poster.webp` + `derivados.json`).
Página local para assistir com som: `creative/source/video/influenciadores/derivados/revisao.html`.

**Rodada de 2026-10-17 (cortes de até 40 s):** os cortes do carrossel foram refeitos a partir dos originais para durar o
máximo possível dentro das regras acima (limite de 40 s, sem repetir/loopar). Pontos de corte escolhidos pela transcrição
com tempo por palavra (faster-whisper `medium` + conferência com o `small`) e confirmados pelo nível de áudio a cada 50 ms
(pausa = queda até o ruído de fundo). Depois de gerar, os `*.web.mp4` foram copiados para `public/media/video/` e as capas
para `src/assets/media/criadores/<arquivo>.webp`. IF-06a e IF-06b não tinham como crescer (motivos na tabela).

**Rodada de 2026-10-18 (regra definitiva: máximo de 40 s; original com até 40 s entra inteiro, sem acelerar):** IF-02a e
IF-04a passaram a usar o story inteiro. IF-06a e IF-06b saem do **mesmo** reel (33,1 s): usar o reel inteiro nos dois
repetiria o vídeo, então o responsável dividiu sem repetir e sem o que está desatualizado (dia antigo, convite para
encomendar). O script ganhou `trechos` (pedaços unidos) e `silencio` (zera só o áudio de um intervalo).
Ordem no carrossel: viciado · larizgomes · elevador · sabores · horizontal — os dois de @_magall nunca lado a lado, nem
na volta do laço.

**Ajuste de 2026-10-18 (pedido do responsável):** o card só com música (**IF-06a**, close da caixa) **saiu** do carrossel e
do site. **IF-06b** passou a ser o reel inteiro, contínuo (0–33,17 s; o reel não chega a 40 s), e com isso voltam “…de
quinta a domingo” e o convite para encomendar. **IF-04a** ganhou o começo do story B (janela B reduzida ao tamanho da A),
até a pausa de 39,8 s: 39,4 s, antes de “Esse é perfeição” e do palavrão de 43,5 s. **IF-05a** (@dailysocass) **voltou**
com a legenda gravada pela criadora: 5,85 s até o fim (16,5 s), sem o fim do story anterior nem a mastigação calada do
início, e com o áudio zerado em 9,70–12,88 s (“…a Adriana, sua safada”), confirmado por transcrição do corte final. A
gravação enviada (“Gravação de Tela 2026-10-17 101705.mp4”) é idêntica a `stories_05_pistache.mp4`. Nova ordem: viciado ·
larizgomes · elevador · pistache · horizontal.

| ID | Arquivo | Origem · trecho | Formato | Peso | Fala (transcrição automática) | Prior. |
| --- | --- | --- | --- | ---: | --- | --- |
| IF-06b | `criador-magall-viciado` | IF-06 · 0–4,267 s **+** 8,467–16,1 s (2026-10-18; antes só 0–4,26 s) | 540×960 · 11,9 s | 1454 KB | “Eu definitivamente estou viciado, e esse vício tem nome: Roll.” + “E olha a perfeição desses sabores. Isso aqui é absurdo: pistache, tradicional, Nutella com castanha.” Dois trechos do mesmo reel unidos (divisão do responsável): fica fora a frase do dia antigo (“…de quinta a domingo”, 4,27–8,4 s). Emenda numa pausa da fala (4,15–4,27 s → antes de “e olha”, 8,56 s), cortes no quadro de 30 fps (sem escorregar a sincronia), áudio com rampas de 30 ms; na imagem é uma troca de plano (ele na câmera → close da caixa) | **P1** |
| IF-05a | `criadora-dailysocass-pistache` | IF-05 · 12,7–20,7 s · recorte da moldura | 398×708 · 8 s | 548 KB | “Meu Deus, tá muito bom. É que eu amo o doce com salgado, que é tipo pão. Essa massa é boa.” | **P1** |
| IF-04a | `criadores-grupo-expectativa` | IF-04 · 0,45–28,533 s (2026-10-18: story A inteiro; antes 0,45–24,7 s) · recorte do vídeo horizontal | 478×266 · 28,1 s | 1963 KB | “Gente, simplesmente hoje vamos provar isso aqui, que a gente tava muito ansioso. Num mundo onde todos os doces já estão saturados, achei o máximo começarem a vender cinnamon roll aqui em Fortaleza… Ai, meu Deus… Bora provar. Tem de red velvet. — É melhor o tradicional. — Qual tradicional? — Esse. — Tradicional, red velvet, esse deve ser Oreo e esse que é biscoff. — Eu tô…” Do 1º quadro do story A ao último antes do story B (troca de cena em 28,533 s). Termina como o próprio story termina, no começo de uma fala | **P1** |
| IF-04a-story | `criadores-grupo-expectativa-story` | IF-04 · 0,5–14,3 s (trecho antigo do IF-04a; não recriado, fora do site), story inteiro sem recorte | 506×762 · 14 s | 1010 KB | idem; mantém a legenda “@roll.ofc a gente tava tão ansioso…” | alternativa |
| IF-02a | `criador-elevador-abrindo` | IF-02 · 0,1–32,733 s (2026-10-18: story inteiro; antes 0,1–13,85 s) · áudio zerado em 15,74–16,35 s | 510×782 · 32,6 s | 3724 KB | “Gente, vocês sabem, amor: tem coisa com as minhas amigas, sempre a gente traz um doce pra provar, e o do dia não foi cookie, foi cinnamon roll. Olha esses. Ai… [palavrão silenciado] é enorme, né, e é bonito, e é cheiroso, esse vai estar muito bom. Oreo, o tradicional, né, biscoff… fica bonito, e red velvet, que é o que é bom mesmo, bom.” Até o último quadro antes do story seguinte (troca de cena em 32,733 s). O palavrão (“caralho”, 15,75–16,36 s pelo nível de áudio) foi **silenciado**, não cortado: cortar dava salto visível (a mão sai do cabelo, a cabeça vira) e a fala seguinte começa colada, sem pausa. Imagem contínua; rampas de 30 ms no áudio (decisão do responsável) | P1 |
| IF-06a | `criador-magall-sabores` | IF-06 · 22,767–33,1 s (2026-10-18; antes 8,45–16,1 s) | 540×960 · 10,3 s | 1150 KB | Sem fala: o close dos produtos e da caixa com a música do reel, da troca de cena em 22,767 s (logo depois do fim do convite para encomendar, “chama”, 22,64 s) ao fim do reel. Fica fora o convite (16,1–22,77 s) | P2 |
| IF-04b | `criadores-grupo-biscoff` | IF-04 · 49,6–59,9 s · recorte do vídeo horizontal | 490×274 · 10 s | 799 KB | várias vozes ao mesmo tempo; elogios ao Biscoff, coerentes com o texto “1- Biscoff 1000/10” | P2 |
| IV-05 | `roll-criadora-larizgomes` (`scripts/encode-video.mjs`) | reel `Dc4TZTRtHO9` (111 s) · 46,95–72,15 s (antes 46,95–57,75 s) | 540×960 · 25,2 s | 2412 KB | “Gente, o de pistache me hipnotizou de um jeito que eu esqueci tudo que eu queria falar. Além do pistache e do chocolate branco, ele é finalizado com pedaços de pistache… Muito bom. O próximo que eu também fiquei apaixonada foi esse de Nutella com nuts… é castanha… Com certeza entrou para os meus favoritos, porque a castanha e a Nutella são perfeitas.” Termina na pausa de 72,0–72,35 s; depois vem fala que a transcrição não entende e, de ~75 s, o mirtilo (texto gravado na imagem em ~101 s; passaria dos 40 s). Antes de 46,95 s: “esses daqui são sabores novos” (datado) | P1 |
| IF-07a | `criador-magall-apresentacao` | IF-07 · 1,2–11,6 s | 540×960 · 10 s | 1465 KB | “Rapaziada, hoje eu vou apresentar pra vocês a novidade aqui de Fortaleza, o nome é cinnamon roll, lá da Roll. Esse é o tradicional, eu nunca comi esse doce…” | P3 |

### O que ficou de fora, e por quê

- **IF-06, 4–8,4 s:** “fornadas de quinta a domingo”, dia de funcionamento antigo da Roll que não vale para o Âmbar.
  **16–22 s:** convite para encomendar com a Roll; o site não vende.
- **IF-07, depois de 12 s:** palavrões falados **e** gravados como legenda (“porra”, “caralho muito bom”, “puta que pariu”).
  Não há trecho de veredito limpo; o único trecho aproveitável é a apresentação (P3).
- **IF-02, 13,9–16,4 s:** palavrão. Na rodada de 2026-10-17 o modelo `small` (faster-whisper) ouviu “Ai, diabos, é levado, caralho” (“caralho” em 15,78–16,20 s, confiança ≥ 0,5); o `medium` tinha “engolido” o trecho num “é” de 1,9 s. Na dúvida, fora de todos os cortes. **Desde 2026-10-18** o IF-02a usa o story inteiro com o áudio desse trecho silenciado (15,74–16,35 s), imagem contínua.
- **IF-04, 43,5 s e 67–69 s:** palavrões. **59,8–64 s:** comparação com outra marca (“Mr. Pretzel”).
- **IF-05, 10–12 s:** fala incompreensível na transcrição; não usar sem ouvir.

### Recortes e textos sobrepostos

- **IF-05a:** só a borda escura da gravação de tela sai (`crop=398:708:58:30`, 9:16). Nome **@dailysocass** e “@roll.ofc” continuam na imagem.
- **IF-04a / IF-04b (horizontais):** o story mostrava um vídeo horizontal sobre fundo bege. O recorte pega a janela do vídeo
  (sem zoom, ninguém é cortado). A legenda do story A ficava **fora** do vídeo e sai do recorte. Ela pode voltar como texto
  do card, ou usa-se a alternativa IF-04a-story. O “1- Biscoff 1000/10” do story B fica dentro do vídeo e foi mantido.
- **IF-02a:** sem recorte (proporção original 510×782); textos “taste test de hoje @roll.ofc” / “cinamon ROLLLLL” mantidos.
- **IF-06/07:** 720×1280 → 540×960, sem recorte. As legendas do IF-07a (“rapaziada hoje eu vou…”) são do autor e ficam.

### Áudio (para a seção de influenciadores)

- AAC 96 kbps 48 kHz; **volume igualado** em −16 LUFS (loudnorm em 2 passadas; medido depois: −15,2 a −16,0 LUFS, picos ≤ −1,2 dBFS),
  para o botão de som não “estourar” de um criador para outro. Fade de 0,12 s na entrada e 0,2 s na saída, para não estalar no corte.
- Um arquivo por corte: o player começa **mudo** (`muted`) e o mesmo arquivo toca com som quando o visitante pede.
- Comportamento no site (ajuste de 2026-10-18, referência Zuzzi; `lib/carrossel.js`, `tests/e2e/carrossel.spec.ts`): palco em laço
  com o central inteiro e um vizinho cortado em cada borda, sempre; **os três à vista tocam ao mesmo tempo, mudos** (cada um
  repetindo o próprio corte); **um áudio por vez, sempre o do central** (os vizinhos ficam mudos). Tudo começa mudo; o 1º
  toque no som registra a preferência da visita (em memória, não entre sessões): a partir daí cada card que encaixa no
  centro assume a voz sozinho — ao soltar o arraste, no ponto ou na seta, inclusive na volta do laço — e o anterior se cala
  no mesmo instante; desligar também é preferência (as trocas seguem mudas). **Tocar no vídeo central = som** (ajuste
  final de 2026-10-18): a superfície liga/desliga a voz como o botão do canto (que mostra o estado), o vídeo **nunca pausa**
  e não aparece play/pause no meio; só vale como toque o gesto curto (≤ 10 px, ≤ 600 ms) — arraste, rolagem ou toque longo
  não mexem no som. Teclado e leitor de tela: botão de som (`aria-pressed`), setas e pontos. Saída da seção (histerese: entra com 50% do
  palco na tela, sai abaixo de 30%) ou aba escondida: tudo pausa e a voz para; de volta, o central retoma a voz se o
  navegador deixar — se ele recusar som sem um toque, segue mudo com o botão pronto. No WebKit, um vídeo mudo que volta ao
  início do laço enquanto outro fala é pausado pelo navegador: o carrossel o retoma na hora (teste dedicado).
  Vídeos só são criados para os três à vista, quando a seção chega perto; cada card reaproveita o seu nas voltas do laço.
  Medido (Chromium, CPU 4× mais lenta, 390 px, rolando sobre a seção): 57 fps com 3 vídeos × 59 com 1 × 60 sem vídeo; os três
  decodificam a 30 fps sem quadro perdido. Vídeos da Roll nunca ganham botão de som.
- Diferente dos vídeos da Roll (música de biblioteca do Instagram, publicados sem faixa de áudio), aqui o áudio é **a voz do criador**
  (`uses_original_audio: true` nos reels). Ainda assim depende da autorização de voz.

## Roll × criadores

| Grupo | Vídeos | Seção |
| --- | --- | --- |
| **Bastidores da própria Roll** (@roll.ofc) | IV-06, IV-06b, IV-08 (publicados, sem áudio); candidatos IV-01 e IV-02 (`REVISAO-REELS.md`) | “Bastidores da Roll” |
| **Criadores** | IF-02a, IF-04a/b, IF-05a, IF-06a/b, IF-07a e IV-05 (@larizgomes, já autorizado sem áudio) | “Influenciadores” (carrossel próprio) |

Nenhum arquivo do pacote novo é da própria Roll: os reels de @_magall têm a Roll como **coautora**, mas o conteúdo e a voz são do criador.

## Pendências antes de publicar

1. **Identificar** os criadores do IF-02 (elevador) e do IF-04 (grupo). O pacote não traz o @ deles.
2. **Autorização por escrito** de @_magall, @dailysocass e dos criadores acima: imagem, voz, nome e corte reeditado.
3. Ouvir cada corte e confirmar a fala (as citações acima são transcrição automática).
4. Confirmar que os sabores citados (pistache, Nutella com castanha etc.) aparecem no Âmbar. Se não, usar só os cortes sem sabor (IF-06b, IF-05a, IF-04a).
5. Os reels têm data (ago e set/2026) e falam em “novidade em Fortaleza”. Exibir a data no crédito, como no IV-05.
