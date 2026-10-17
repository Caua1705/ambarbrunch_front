# Asset Manifest

Catálogo de todos os arquivos recebidos, gerados ou selecionados para o projeto.

> **Situação:** Etapa 1 aprovada com ajustes — 109 arquivos importados de `AMBAR_BRUNCH_PACK_COMPLETO_v1.zip` em 2026-10-16;
> após a limpeza: 2 duplicatas removidas, 6 arquivos novos extraídos do PDF, 7 cópias otimizadas reclassificadas.
> Todos estão **catalogados** e com aprovação **pendente**. Nada foi copiado para `creative/approved/` ou `public/media/`.

### Registro de alterações

| Data | Alteração |
| --- | --- |
| 2026-10-16 | Importação do pacote v1 (109 arquivos) |
| 2026-10-16 | PDF renderizado por completo (pdf.js em Edge headless); págs. 2, 4, 5 e 6 inspecionadas; logo “CAFÉ & BRUNCH” extraído da pág. 1 (OF-14/15); prévias das págs. 2, 4, 5, 6 adicionadas (OF-16…19) |
| 2026-10-16 | Removidas as duplicatas exatas IG-07 e CR-12 (MD5 idêntico ao arquivo mantido) |
| 2026-10-16 | CR-06…13 reclassificadas como fotos reais otimizadas → `creative/source/photography/roll_instagram/otimizadas/` (IDs `IG-OPT`) |
| 2026-10-16 | `README-PACOTE.md` e `CLAUDE-ETAPA-1-IMPORTACAO.md` movidos para `docs/content/pacote-v1/` |
| 2026-10-16 | Decisão: nome do site **Âmbar Brunch**; logo provisório = OF-14/15 (“âmbar CAFÉ & BRUNCH”) |
| 2026-10-17 | **Autorização registrada** (aprovado por Caua Carvalho, responsável pelo projeto) para uso no site e no repositório público: bandejas IG-OPT-06 (Biscoff), IG-09 (red velvet), IG-OPT-07 (Oreo); vídeos IV-06, IV-08, IV-09 (@roll.ofc) e trecho de 9 s de IV-05 (@larizgomes), todos sem áudio; e as 4 capas derivadas. Situação → **publicado** (ver “Mídia autorizada no site”) |
| 2026-10-17 | Card “sabores do mês”: o IV-09 (texto “Outubro 🤍” gravado no centro de todos os quadros) foi trocado pelo 2º trecho do IV-06 (14,5 s → 20 s, fornada de Nutella; não repete o mirtilo do card “do forno”), da mesma conta e já autorizado; sem texto na imagem, não fica datado. IV-09 sai do site |
| 2026-10-17 | **Revisão visual e influenciadores:** 7 vídeos de criadores catalogados (IF-01…07; IF-01 e IF-03 são trechos duplicados de IF-02 e IF-04), 2 reels de @_magall baixados (script do kit corrigido), 8 cortes em revisão com áudio igualado; referências RF-08/09 e DC-19/20. **Nada autorizado nem publicado.** Detalhes em [`INFLUENCIADORES.md`](INFLUENCIADORES.md) |
| 2026-10-17 | Conceito B, implementação local: hero “& rolls” com recorte da **IG-02** (`hero-roll-espiral.webp`) e “anatomia do roll” com outro recorte da IG-02 (`roll-anatomia.webp`), ambos em `src/assets/media/revisao/` (fora do Git). **A autorização de 17/10 não cobre a IG-02**: no build de produção o hero volta ao croissant e a anatomia não aparece. Vídeos de criadores IF-02a/04a/05a/06a/06b com legendas .vtt revisadas, só na revisão |

> O CSV de origem (`ASSET-MANIFEST-IMPORT.csv`) é mantido como registro histórico e ainda cita os caminhos antigos.
> Seleção inicial em [`CURADORIA-INICIAL.md`](CURADORIA-INICIAL.md) · Reels em [`REVISAO-REELS.md`](REVISAO-REELS.md).

---

## Como registrar

1. Todo arquivo novo entra em `creative/inbox/` e recebe uma linha nesta tabela.
2. Após catalogado, é movido para `creative/source/…` (oficial) ou `creative/generated/…` (IA).
3. Ao ser aprovado, uma cópia vai para `creative/approved/`.
4. Somente a versão otimizada final vai para `public/media/…`.

### Legenda

**Origem**
- `oficial` — material fornecido pelo Âmbar Brunch / Roll
- `fotógrafo` — produção fotográfica/vídeo contratada
- `IA` — gerado por inteligência artificial
- `referência` — material externo, apenas para estudo (não publicar)

**Situação**
- `recebido` — em `creative/inbox/`, ainda não analisado
- `catalogado` — movido para `source/` ou `generated/`
- `em revisão` — em avaliação para uso
- `aprovado` — em `creative/approved/`
- `publicado` — versão otimizada em `public/media/`
- `descartado` — não será usado

**Aprovação**
- `pendente` · `aprovado` · `reprovado` — com nome de quem aprovou e data

### Categorias (Etapa 1)

| Prefixo | Categoria | Regra de uso |
| --- | --- | --- |
| `OF` | **Oficial** — apresentação Âmbar × Roll e logos extraídos literalmente do PDF | Usar sem redesenhar; confirmar versão do logo |
| `MK` | **Mockup / proposta** — copos, caixas, uniformes, cardápios | Nunca apresentar como foto de objeto real |
| `FR` | **Foto real** — ambientes (Giardini, estado anterior) e pratos | Confirmar se ambiente/prato ainda é atual |
| `IG` / `IV` | **Instagram Roll** — fotos (`IG`) e reels (`IV`) de @roll.ofc e parceiros | Exige autorização de imagem, áudio e pessoas |
| `CR` | **Criado / conceitual** — texturas, ornamentos, montagens, moodboard IA | Conceito; não é identidade aprovada |
| `RF` | **Referência externa** — Zuzzi, site antigo Giardini | Só estudo; nunca publicar nem copiar |
| `DC` | **Documento / derivado** — PDFs de contexto, CSVs, folhas de contato, capas | Uso interno |

**Prioridade** (para os conceitos visuais): `P1` candidato forte · `P2` apoio · `P3` só consulta · `—` não usar.

**Destinos sugeridos:** `hero` · `gastronomia` · `roll` · `ambiente` · `reviews` (vídeos/depoimentos) · `reserva` · `background` · `ornamento` · `consulta`.

---

## Catálogo

Fonte técnica: dimensões e duração medidas com `ffprobe` na importação; MD5 usado para detectar duplicatas.
O CSV de origem do pacote (`docs/content/ASSET-MANIFEST-IMPORT.csv`) foi preservado e mesclado aqui.

### OF — Oficial (13)

| ID | Arquivo | Dimensões / orientação | Conteúdo | Destino | Direitos / status | Prioridade | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OF-01 | `creative/source/brand/ambar-x-roll-apresentacao-original.pdf` | 14 págs. · 34,4 MB · Canva | Proposta Âmbar × Roll. Todas as páginas trazem o selo **“Ana Mônica arquitetura e interiores”** (autoria da proposta) | consulta | Oficial · pendente | P1 | Todas as 14 págs. inspecionadas em 2026-10-16. Fontes embutidas: Playfair Display (Regular e Bold Italic), Lato Regular e Lemon Milk Light — são fontes **da apresentação**, não necessariamente da marca |
| OF-02 | `creative/source/brand/logo-ambar-cafe-extraido-pdf-original.png` | 656×268 · paisagem · RGBA | Logo “âmbar / CAFÉ”, pincel minúsculo, vinho ≈ `#740527` (amostrado) | consulta | Oficial (extração raster da pág. 2) · pendente | P2 | Substituído no site por OF-14/15 (decisão “Café & Brunch”) |
| OF-03 | `creative/source/brand/logo-roll-extraido-pdf-original.png` | 642×235 · paisagem · RGBA | Logo “ROLL” com espiral de cinnamon roll, marrom ≈ `#6D4A31` (amostrado) | roll, assinatura | Oficial (extração raster da pág. 2) · pendente | P1 | Pedir vetor |
| OF-04 | `creative/source/brand/apresentacao-paginas/pagina-01.webp` | 1224×689 · paisagem | Logo “âmbar CAFÉ & BRUNCH” sobre creme ≈ `#F2EDE1` | consulta | Oficial | P2 | Única fonte da versão “& BRUNCH” |
| OF-05 | `…/apresentacao-paginas/pagina-03.webp` | 1224×689 | Copos Âmbar × Roll em mãos com avental | consulta | **Contém mockup** | P3 | Ver MK-01 |
| OF-06 | `…/apresentacao-paginas/pagina-07.webp` | 1224×689 | Cardápio e capa vinho | consulta | **Contém mockup** | P3 | Ver MK-02 |
| OF-07 | `…/apresentacao-paginas/pagina-08.webp` | 1224×689 | Cardápios rolls/sanduíches e cafés gelados | consulta | **Contém mockup** | P3 | Preços: não publicar |
| OF-08 | `…/apresentacao-paginas/pagina-09.webp` | 1224×689 | Combo copo + box Roll | consulta | **Contém mockup** | P3 | |
| OF-09 | `…/apresentacao-paginas/pagina-10.webp` | 1224×689 | Caixas Roll “Simplesmente irresistível” | consulta | **Contém mockup** | P3 | |
| OF-10 | `…/apresentacao-paginas/pagina-11.webp` | 1224×689 | Ambientes com sinalização ROLL, balcão e copos | consulta | **Render/proposta de ambiente** — não é foto do espaço | P3 | Proposta do escritório de interiores (selo da apresentação); confirmar se já foi executada |
| OF-11 | `…/apresentacao-paginas/pagina-12.webp` | 1224×689 | Sanduíches, saladas, rolls salgados | consulta | **Imagens de comida de proposta** (provável IA/banco) | P3 | Útil como lista de categorias do cardápio |
| OF-12 | `…/apresentacao-paginas/pagina-13.webp` | 1224×689 | Moodboard com marcas de terceiros (atis, AURA, BLANK) | consulta | **Terceiros** | — | Nunca publicar |
| OF-13 | `…/apresentacao-paginas/pagina-14.webp` | 1224×689 | Uniformes, bonés, aventais, sacolas | consulta | **Contém mockup** | P3 | Ver MK-08 |
| OF-14 | `creative/source/brand/logo-ambar-cafe-brunch-extraido-pdf-p01-original.png` | 1774×887 · paisagem · fundo creme opaco | Logo “âmbar CAFÉ & BRUNCH”: imagem embutida na pág. 1, extraída sem alteração | logo do site (provisório) | Oficial · pendente | **P1** | Maior resolução de logo disponível. Tinta ≈ `#670D27`, fundo ≈ `#F4EEE3` |
| OF-15 | `creative/source/brand/derivados/logo-ambar-cafe-brunch-p01-fundo-removido.png` | 1296×494 · RGBA | OF-14 com o fundo creme removido (alfa pela distância de cor, tinta sólida `#670D27`, recorte com margem de 24 px) | logo do site (provisório) | **Derivado técnico** do oficial · pendente | **P1** | Desenho, proporção e cor preservados; sem redesenho. Usar sempre em vinho, sobre superfície clara |
| OF-16 | `…/apresentacao-paginas/pagina-02.webp` | 2160×1214 | “Proposta” + logos “âmbar CAFÉ × ROLL” | consulta | Oficial | P2 | Origem de OF-02/OF-03 |
| OF-17 | `…/apresentacao-paginas/pagina-04.webp` | 2160×1214 | Abertura “Cardápio — Projeto Âmbar x Roll” | consulta | Oficial | P3 | |
| OF-18 | `…/apresentacao-paginas/pagina-05.webp` | 2160×1214 | Categorias de comida: Bruschettas, Cheesecakes, Sanduíches, Saladas, Cinnamon Roll salgado e doce, Bowls, Brownies diferentes | conteúdo | Oficial (proposta de cardápio) | P1 | Fonte das categorias usadas nos protótipos |
| OF-19 | `…/apresentacao-paginas/pagina-06.webp` | 2160×1214 | Categorias de bebida: Cafés gelados, Cappuccino, Frappé, Cafés diversos, Chá, Smoothies proteicos | conteúdo | Oficial (proposta de cardápio) | P1 | Idem |

### MK — Mockup / proposta (11)

| ID | Arquivo | Dimensões / orientação | Conteúdo | Destino | Direitos / status | Prioridade | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MK-01 | `creative/source/brand/packaging-concepts/apresentacao-p03-arte-01-conceito.webp` | 1254×1254 · quadrado | Copos matcha/latte Âmbar × Roll, avental ROLL | consulta | Mockup | P3 | Não representar como produto real |
| MK-02 | `…/packaging-concepts/apresentacao-p07-arte-01-conceito.webp` | 1536×1024 · paisagem | Cardápio + capa vinho | consulta | Mockup | P3 | |
| MK-03 | `…/packaging-concepts/apresentacao-p08-arte-01-conceito.webp` | 1312×1199 · paisagem | Cardápio rolls/croissants/sanduíches/saladas | consulta | Mockup com preços | P3 | Preços não confirmados |
| MK-04 | `…/packaging-concepts/apresentacao-p08-arte-02-conceito.webp` | 922×1383 · retrato | Cardápio cafés gelados | consulta | Mockup com preços | P3 | |
| MK-05 | `…/packaging-concepts/apresentacao-p09-arte-01-conceito.webp` | 1312×1199 · paisagem | Combo copo + box | consulta | Mockup | P3 | |
| MK-06 | `…/packaging-concepts/apresentacao-p10-arte-01-conceito.webp` | 1600×1200 · paisagem | Caixas abertas com rolls | consulta | Mockup | P3 | Caixa parece ter sido produzida (ver IG-25); confirmar |
| MK-07 | `…/packaging-concepts/apresentacao-p10-arte-02-conceito.webp` | 1200×1600 · retrato | Caixa Roll marrom fechada, fundo preto | consulta | Mockup | P3 | |
| MK-08 | `…/packaging-concepts/apresentacao-p14-arte-01-conceito.webp` | 1536×1024 · paisagem | Kit uniformes/acessórios | consulta | Mockup | P3 | Frase “good coffee, better days” aparece em vários materiais |
| MK-09 | `creative/source/brand/recebidos-whatsapp-1.jpeg` | 1024×1536 · retrato | Cardápio “Âmbar Café — Cafés gelados” com preços (R$ 14–22) | consulta | Arte de cardápio · status desconhecido | P3 | Copos parecem render. Verificar se é o cardápio vigente |
| MK-10 | `creative/source/brand/recebidos-whatsapp-2.jpeg` | 1024×1536 · retrato | Cardápio Âmbar Café: sanduíches, bruschettas & toasts, croissants, menu saudável | consulta | Arte de cardápio · status desconhecido | P2 | Melhor fonte textual do cardápio de brunch; ilustrações de traço úteis como referência de linguagem |
| MK-11 | `creative/source/brand/recebidos-whatsapp-3.jpeg` | 731×1280 · retrato | Menu Roll: Tradicional, Mood Cheesecake, S’mores, Kinder Bueno com preços | consulta | Arte de cardápio · status desconhecido | P3 | Sabores sazonais; preços não publicar |

### FR — Foto real: ambientes e gastronomia (7)

Todas: 1200×1799 · retrato 2:3 · fotografia profissional (luz controlada, foco correto). Origem: enviadas na conversa; ambientes são do **Giardini (estado anterior)**.

| ID | Arquivo | Conteúdo | Destino | Direitos / status | Prioridade | Observações |
| --- | --- | --- | --- | --- | --- | --- |
| FR-01 | `creative/source/photography/ambientes/sala-01.webp` | Lounge: sofá curvo verde-oliva, poltronas claras, luz de janela | ambiente, reserva | Foto real · pendente | P1 | Provável “Lounge reservado” do fluxo antigo |
| FR-02 | `…/ambientes/sala-02.webp` | Estante de livros e expositor giratório | ambiente, detalhe | Foto real · pendente | P2 | Bom para “canto de leitura”; muitas capas de livros visíveis |
| FR-03 | `…/ambientes/sala-03.webp` | Salão de parede laranja-âmbar, pendente aceso, quadros de paisagem | hero B, ambiente | Foto real · pendente | P1 | Luz âmbar literal; a mais coerente com o nome |
| FR-04 | `…/ambientes/sala-04.webp` | Jardim externo, mesas de madeira, folhagem densa | hero A, ambiente | Foto real · pendente | P1 | Melhor profundidade e luz; ótima em retrato |
| FR-05 | `creative/source/photography/gastronomia/bebida-chocolate-creme.webp` | Shake de chocolate com calda + prato, fundo de jardim desfocado | gastronomia | Foto real · pendente | P1 | Item pode ser do cardápio antigo |
| FR-06 | `…/gastronomia/bruschetta-brunch.webp` | Torrada/bruschetta vista de cima, café em xícara florida, jogo americano de palha | gastronomia, hero alt. | Foto real · pendente | P1 | Composição limpa com espaço negativo |
| FR-07 | `…/gastronomia/croissant-prato-azul.webp` | Croissant em prato azul sobre sofá capitonê laranja | gastronomia, hero B alt. | Foto real · pendente | P1 | Bloco de cor forte; muito legível em tamanho pequeno |

### IG — Instagram Roll: fotos (24 arquivos após remover a duplicata IG-07)

Origem: extração Apify de @roll.ofc (posts de 2026-08-07 a 2026-10-03). **Direitos:** pertencem à Roll/autores; uso no site requer autorização. Não há metadado de autoria do fotógrafo.
Classe: **foto** = foto real de celular · **arte** = post com fundo liso, setas e texto embutido (aparência de render/IA ou retoque pesado — confirmar com a Roll) · **capa** = capa de reel.

| ID | Arquivo (`creative/source/photography/roll_instagram/`) | Dimensões | Classe | Conteúdo | Destino | Prioridade | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IG-01 | `2026-08-07_Dbvb3SMARpK_image.jpg` | 1365×1820 retrato | arte | Roll de Oreo anotado | consulta | P3 | Texto embutido |
| IG-02 | `2026-08-07_DbvbwuOg_vg_image.jpg` | 2613×2808 quase quadrado | **foto** | Bandeja com os sabores iniciais + caixa branca Roll | roll, gastronomia | **P1** | Maior resolução do acervo |
| IG-03 | `2026-08-07_Dbvj0DhAd6G_image.jpg` | 1365×1820 | arte | Roll de Biscoff anotado | consulta | P3 | |
| IG-04 | `2026-08-07_DbvjlWdhgKl_image.jpg` | 1365×1820 | arte | Red velvet anotado | consulta | P3 | |
| IG-05 | `2026-08-12_Db8YQOYginJ_image.jpg` | 1215×2160 retrato 9:16 | capa | Bandeja red velvet (capa do reel IV-01) | roll | P2 | |
| IG-06 | `2026-08-16_DcGojKjlvml_image.jpg` | 2268×3024 retrato | **foto** | Bandeja Biscoff com hera e tábua | roll | **P1** | Carrossel (5 arquivos) |
| ~~IG-07~~ | ~~`2026-08-16_DcGojKjlvml_image_1.jpg`~~ | — | — | — | — | — | **Removido em 2026-10-16**: duplicata exata de IG-06 (MD5 `48de08ad…`); a cópia original continua no ZIP |
| IG-08 | `2026-08-16_DcGojKjlvml_image_2.jpg` | 2268×3024 | **foto** | Bandeja Oreo | roll | P1 | |
| IG-09 | `2026-08-16_DcGojKjlvml_image_3.jpg` | 2268×3024 | **foto** | Bandeja red velvet | roll, gastronomia | **P1** | Vermelho dialoga com o vinho da marca |
| IG-10 | `2026-08-16_DcGojKjlvml_image_4.jpg` | 2268×3008 | foto | Bandeja tradicional com glacê, plano chapado | roll | P3 | Pouco contraste |
| IG-11 | `2026-08-25_Dcew--3gAyo_image.jpg` | 720×1280 | capa | Mão com luva abrindo roll (IV-02) | roll | P2 | Baixa resolução |
| IG-12 | `2026-08-26_DchT6--A_h8_image.jpg` | 720×1280 | capa | Pessoa com caixas MadNutz na cozinha (IV-03) | — | — | Marca de terceiro + pessoa |
| IG-13 | `2026-09-01_DcwqMBKgisc_image.jpg` | 1215×2160 | capa | Rolls com caixas MadNutz (IV-04) | — | — | Marca de terceiro em destaque |
| IG-14 | `2026-09-01_DcwqVtvgCSI_image.jpg` | 1448×1931 | arte | Roll Nutella/Mad Nutz anotado | consulta | P3 | Aparência de render |
| IG-15 | `2026-09-04_Dc4TZTRtHO9_image.jpg` | 815×1447 | capa | Influenciadora segurando roll (IV-05, @larizgomes) | reviews | P2 | Direito de imagem da autora |
| IG-16 | `2026-09-14_DdRe2BOgPRt_image.jpg` | 1440×1899 | arte | Cardápio do mês: Nutella c/ Mad Nutz, Pistache, Mirtilo, Tradicional | consulta | P2 | Linguagem de faixas coloridas é uma boa referência; rolls parecem render |
| IG-17 | `2026-09-17_DdZ5fRIA4f2_image.jpg` | 1170×2080 | capa | Rack de forno com fornadas (IV-06) | roll | P1 | Bastidores, bom para “feito aqui” |
| IG-18 | `2026-09-24_Ddq9g2oAGyf_image.jpg` | 1254×1254 quadrado | arte | Gráfico “:( + roll = :)” | consulta | P3 | Tom de voz bem-humorado |
| IG-19 | `2026-09-24_Ddrf0LBgz-a_image.jpg` | 720×1280 | capa | Pessoa com bandeja (IV-07) | reviews | P2 | Texto “Você pediu Roll” embutido |
| IG-20 | `2026-10-01_Dd9TYOdA8Ch_image.jpg` | 1365×1820 | arte | Roll x Mood Cheesecake (parceria @moodcheescake) | consulta | — | Parceria de terceiro |
| IG-21 | `2026-10-01_Dd9V9KUz-nV_image.jpg` | 1215×2160 | capa | Bandeja Kinder Bueno (IV-08) | roll | P2 | Marca de terceiro no produto |
| IG-22 | `2026-10-01_Dd9VieXADfy_image.jpg` | 1365×1820 | arte | Kinder Bueno anotado | consulta | P3 | |
| IG-23 | `2026-10-01_Dd9Z7OBAGSP_image.jpg` | 1365×1820 | arte | S’mores anotado | consulta | P3 | |
| IG-24 | `2026-10-02_DeAT31Yg8Un_image.jpg` | 1215×2160 | capa | Bandeja crumble de morango (IV-09) | roll | P2 | |
| IG-25 | `2026-10-03_DeCm12SAfCp_image.jpg` | 1556×2070 retrato | foto? | Box de outubro aberta + sacola kraft Roll | roll | P1 condicional | Pode ser foto produzida **ou** render — confirmar. Se real, prova que a embalagem MK-06 existe |

### Mídia autorizada no site (2026-10-17)

Aprovação: **aprovado** · Caua Carvalho · 2026-10-17. Escopo: somente os arquivos abaixo, nas versões finais; os originais
continuam fora do Git. Os vídeos não têm faixa de áudio (as músicas de terceiros dos originais não são usadas).

| Origem | Arquivo no site | Formato | Crédito exibido |
| --- | --- | --- | --- |
| IG-OPT-06 | `src/assets/media/roll/bandeja-biscoff.webp` | 1000×1333 | seção Fornadas (Roll) |
| IG-09 | `src/assets/media/roll/bandeja-red-velvet.webp` | 1200×1600 | seção Fornadas (Roll) |
| IG-OPT-07 | `src/assets/media/roll/bandeja-oreo.webp` | 1000×1333 | seção Fornadas (Roll) |
| IV-06 | `public/media/video/roll-do-forno.web.mp4` + `roll/poster-do-forno.webp` | 540×960 · 9 s · sem áudio | @roll.ofc |
| IV-06 (2º trecho) | `public/media/video/roll-sabores-do-mes.web.mp4` + `roll/poster-sabores-do-mes.webp` | 540×960 · 5,5 s (14,5 s → 20 s) · sem áudio | @roll.ofc |
| IV-08 | `public/media/video/roll-bandeja.web.mp4` + `roll/poster-bandeja.webp` | 540×960 · 4,5 s · sem áudio | @roll.ofc |
| IV-05 | `public/media/video/roll-criadora-larizgomes.web.mp4` + `roll/poster-criadora-larizgomes.webp` | 540×960 · 9 s (38 s → 47 s) · sem áudio | @larizgomes · conteúdo sobre a Roll |

### IV — Instagram Roll: reels (9) e metadados

Detalhes, áudio e pendências em [`REVISAO-REELS.md`](REVISAO-REELS.md). Pasta `creative/source/video/roll_reels/`.

| ID | Arquivo | Duração | Resolução | Autor | Áudio | Destino | Prioridade |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| IV-01 | `2026-08-12_Db8YQOYginJ_video.mp4` | 5,7 s | 720×1280 | @roll.ofc | Original da Roll | roll (loop) | P1 |
| IV-02 | `2026-08-25_Dcew--3gAyo_video.mp4` | 21,2 s | 720×1280 | @roll.ofc | Música “Day By Day” — Amaria | roll | P1 (mudo) |
| IV-03 | `2026-08-26_DchT6--A_h8_video.mp4` | 57,5 s | 1080×1920 VP9 | @roll.ofc + coautores | **Arquivo sem faixa de áudio** | reviews | P3 |
| IV-04 | `2026-09-01_DcwqMBKgisc_video.mp4` | 19,5 s | 720×1280 | @roll.ofc | Música “Window Eyes” — Veni Sun | reviews | P2 |
| IV-05 | `2026-09-04_Dc4TZTRtHO9_video.mp4` | 111,4 s | 720×1280 | **@larizgomes** (colab. @roll.ofc) | Voz original da autora | reviews | P1 (trecho) |
| IV-06 | `2026-09-17_DdZ5fRIA4f2_video.mp4` | 21,2 s | 720×1280 | @roll.ofc | Áudio de terceiro (@justtrip.it) | roll | P1 (mudo) |
| IV-07 | `2026-09-24_Ddrf0LBgz-a_video.mp4` | 9,1 s | 720×1280 | @roll.ofc | Música “Weekend Drive (Instrumental)” — Corduroy Egg | reviews | P2 |
| IV-08 | `2026-10-01_Dd9V9KUz-nV_video.mp4` | 4,6 s | 720×1280 | @roll.ofc | Música “You Might Be Right” — cloud cover | roll (loop) | P2 (mudo) |
| IV-09 | `2026-10-02_DeAT31Yg8Un_video.mp4` | 6,3 s | 720×1280 | @roll.ofc | Música “I Love You More (Instrumental)” — Company Money | roll (loop) | P2 (mudo) |
| IV-P | `creative/source/video/roll_reels/posters/*_poster.webp` (4, criados em 2026-10-16) | — | 720×1280 | derivado de IV-02/06/08/09 | sem áudio (imagem) | poster nos protótipos | P2 · mesma restrição de direitos do vídeo |
| IG-JSON | `creative/source/social/instagram-roll-extraido.json` | 312 KB | — | Apify | — | consulta | P3 · contém comentários e usernames de terceiros: **não publicar nem versionar** |

### IG-OPT — Fotos reais da Roll, cópias otimizadas (7)

Pasta `creative/source/photography/roll_instagram/otimizadas/`. O nome do arquivo é o mesmo da foto original (data + shortcode do post), trocando `.jpg` por `.webp`. Antes ficavam em `creative/generated/compositions/roll-candidato-*`.

| ID | Arquivo | Dimensões | Original | Uso |
| --- | --- | --- | --- | --- |
| IG-OPT-01 | `2026-08-07_Dbvb3SMARpK_image.webp` | 1000×1333 | IG-01 (arte) | consulta |
| IG-OPT-02 | `2026-08-07_DbvbwuOg_vg_image.webp` | 1000×1075 | IG-02 (foto) | protótipos (roll) |
| IG-OPT-03 | `2026-08-07_Dbvj0DhAd6G_image.webp` | 1000×1333 | IG-03 (arte) | consulta |
| IG-OPT-04 | `2026-08-07_DbvjlWdhgKl_image.webp` | 1000×1333 | IG-04 (arte) | consulta |
| IG-OPT-05 | `2026-08-12_Db8YQOYginJ_image.webp` | 787×1400 | IG-05 (capa) | consulta |
| IG-OPT-06 | `2026-08-16_DcGojKjlvml_image.webp` | 1000×1333 | IG-06 (foto) | protótipos (roll) |
| IG-OPT-07 | `2026-08-16_DcGojKjlvml_image_2.webp` | 1000×1333 | IG-08 (foto) | protótipos (roll) |

### CR — Criado / conceitual (10 após a reclassificação)

| ID | Arquivo | Dimensões | Conteúdo | Destino | Status | Prioridade | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CR-01 | `creative/generated/backgrounds/papel-creme-leve.webp` | 1152×1600 | Papel creme quase liso (5,7 KB) | background | Conceito | P2 | Reproduzível em CSS; ganho visual mínimo |
| CR-02 | `…/backgrounds/papel-areia-leve.webp` | 1152×1600 | Papel areia (3,4 KB) | background | Conceito | P2 | Idem |
| CR-03 | `…/backgrounds/papel-vinho-leve.webp` | 1152×1600 | Papel vinho (3,4 KB) | background | Conceito | P2 | Idem; tom mais claro que o logo |
| CR-04 | `creative/generated/compositions/colagem-ambiente-brunch-mobile-conceito.webp` | 1080×1536 retrato | Colagem jardim + croissant + shake com arco vinho | consulta | Conceito com fotos reais | P2 | Bom estudo de layout; montar em HTML/CSS em vez de imagem fixa |
| CR-05 | `…/compositions/mosaico-brunch-cafe-horizontal-conceito.webp` | 1600×900 paisagem | Mosaico bruschetta + shake + croissant | consulta | Conceito com fotos reais | P3 | |
| CR-06…13 | _reclassificados_ | — | Eram `roll-candidato-*.webp`: cópias otimizadas de **fotos reais**, não IA | — | Movidos para `IG-OPT` (abaixo); CR-12 era duplicata e foi removido | — | |
| CR-14 | `creative/generated/concepts/moodboard-IA-NAO-OFICIAL.png` | 1536×1024 | Moodboard gerado por IA com logos, embalagens e comidas sintéticas | consulta | **IA não oficial** | — | Nunca publicar; nunca usar como prova de produto ou logo |
| CR-15 | `creative/generated/ornaments/espiral-decorativa-conceito.svg` | 240×240 viewBox | Espiral em traço vinho com riscos âmbar | ornamento | Conceito autoral | P1 | Ecoa a espiral da Roll sem copiar o logo |
| CR-16 | `…/ornaments/ramo-botanico-conceito.svg` | 320×280 | Ramo com folhas em contorno | ornamento | Conceito | P1 | Conversa com o jardim (FR-04) |
| CR-17 | `…/ornaments/linha-editorial-conceito.svg` | 900×130 | Linha ondulada com folhas | ornamento | Conceito | P2 | Divisor de seção |
| CR-18 | `…/ornaments/sparkles-artesanais-conceito.svg` | 320×200 | Riscos de “brilho” | ornamento | Conceito | P2 | Parecido com os riscos laterais do logo Roll — usar com moderação |

### IF — Vídeos de criadores (influenciadores), em revisão

Catálogo completo, origem, cortes e pendências em [`INFLUENCIADORES.md`](INFLUENCIADORES.md). Originais e derivados em
`creative/source/video/influenciadores/` (ignorado no Git). Situação: **em revisão** · aprovação **pendente**.

### RF — Referência externa (7)

| ID | Arquivo | Dimensões | Conteúdo | Uso | Observações |
| --- | --- | --- | --- | --- | --- |
| RF-01–05 | `references/screenshots/zuzzi-1000332175…183.jpg` | 316–709 × 1536 | Site mobile Zuzzi Drinks: blocos de cor, tipografia condensada, carrossel de vídeos de reviews, barra fixa de compra | Estudo de ritmo, carrossel de reviews e CTA fixo | Marca e assets proprietários; **não publicar nem copiar** |
| RF-06 | `references/motion/giardini-referencia-01.mp4` | 1916×948 · 71,8 s · 66,7 MB | Gravação do site antigo Giardini: hero, cardápio escuro, “Reserve sua mesa” | Estudo de UX | Mostra fotos de ambiente/pessoa que **não estão no pacote** |
| RF-07 | `references/motion/giardini-referencia-02.mp4` | 1918×854 · 14,7 s · 12,8 MB | Fluxo de reserva antigo: ambiente (Jardim Externo, Salão Principal, Lounge Reservado, Sala Privativa) → pessoas → data → horário → dados | Estudo de UX de reservas | Base para mapear a API existente |
| RF-08 | `references/motion/zuzzi_carrossel_influenciadores.mp4` | 450×910 · 26,8 s | Carrossel de reviews da Zuzzi: card central maior, vizinhos parcialmente visíveis | Estudo do carrossel de influenciadores | Pacote de revisão 2026-10-17; **não copiar** |
| RF-09 | `references/screenshots/zuzzi_informacao_nutricional.png` | 453×876 | Tabela nutricional da Zuzzi | Estudo de UI futura | Não copiar dados nem layout; tabela do Âmbar só com ficha técnica |

### DC — Documentos e derivados (18)

| ID | Arquivo | Conteúdo | Observações |
| --- | --- | --- | --- |
| DC-01 | `docs/content/pacote-v1/README-PACOTE.md` | Instruções do pacote | Movido da raiz em 2026-10-16 |
| DC-02 | `docs/content/pacote-v1/CLAUDE-ETAPA-1-IMPORTACAO.md` | Especificação da Etapa 1 | Idem |
| DC-03 | `docs/brand/plano-lancamento-contexto.pdf` | Plano de lançamento em 10 dias (10 págs., feito no Gemini Notebook) | Lido em 2026-10-16. Marcos: shooting de produto em 21/10, **apresentação do novo site de reservas em 22/10**, intervenções físicas de 20 a 23/10, soft opening com captação real em 24/10, reabertura oficial do Âmbar Brunch e lançamento da parceria em 27/10. **Não traz** endereço nem horários. A foto de ambiente com placas ROLL (pág. 3) repete a pág. 11 da apresentação e tem forte indício de ter sido gerada por IA. Contexto interno: não publicar |
| DC-04 | `docs/content/ASSET-MANIFEST-IMPORT.csv` | Manifesto de origem do pacote | Mesclado neste documento |
| DC-05 | `docs/content/FONTES-PENDENTES.md` | Pendências do pacote (Drive, vetores, autorizações) | Incorporadas em `CURADORIA-INICIAL.md` |
| DC-06 | `docs/content/CONTATO-FOTOS.jpg` | Folha de contato (1360×1848) | Reaproveitada |
| DC-07 | `docs/content/instagram-roll-curadoria-anterior.md` | Análise anterior dos reels | Confirmada/corrigida em `REVISAO-REELS.md` |
| DC-08 | `docs/content/instagram-roll-inventario-original.csv` | Inventário Instagram anterior | Contém URLs assinadas da CDN: ignorado no Git |
| DC-09–17 | `docs/content/reel-capa-*.jpg` (9) | Capas dos reels, 280×498 | Só para curadoria; resolução insuficiente para o site |
| DC-18 | `docs/design/DIRECAO-CRIATIVA-INICIAL.md` | Direção criativa inicial (não aprovada) | Paleta sugerida diverge das cores amostradas dos logos |
| DC-19 | `references/motion/ambar_homepage_atual_390px.mp4` | Gravação da home atual em 390 px (406×870, 27,6 s) | Pacote de revisão 2026-10-17; base da proposta de evolução |
| DC-20 | `references/screenshots/hero_ambar_atual.png` | Captura do hero atual (434×899) | Idem |

### Catálogos gerados na Etapa 1 (derivados, uso interno, ignorados no Git)

Folhas de contato numeradas em `docs/content/catalogos/`:
`contato-fotos-reais.jpg` · `contato-logos-sobre-creme.png` · `contato-marca-apresentacao.jpg` · `contato-mockups-cardapios.jpg` · `contato-roll-instagram-01..03.jpg` · `contato-criados-conceito.jpg` · `contato-referencia-zuzzi.jpg` · `contato-referencia-giardini-01..02.jpg` · `reels/<reel>-frames.jpg` (8–16 frames com timecode) · `reels/espectrogramas-audio.png`.

### Totais

| Categoria | Importado | Após a limpeza |
| --- | ---: | ---: |
| Oficial (PDF, logos, prévias de página) | 13 | 19 (+ logo pág. 1, versão sem fundo, 4 prévias) |
| Mockup / proposta (8 recortes + 3 cardápios recebidos) | 11 | 11 |
| Foto real — ambientes (4) e gastronomia (3) | 7 | 7 |
| Instagram Roll — fotos | 25 | 24 (−1 duplicata) |
| Instagram Roll — cópias otimizadas (`IG-OPT`) | — | 7 (vindas de CR) |
| Instagram Roll — reels | 9 | 9 |
| Instagram Roll — JSON de metadados | 1 | 1 |
| Criado / conceitual | 18 | 10 (3 fundos, 2 montagens, 1 moodboard IA, 4 SVGs) |
| Referência externa (5 capturas + 2 vídeos) | 7 | 7 |
| Documentos / derivados | 18 | 18 |
| **Total** | **109** | **113** |

(Um arquivo novo de documento, `LINKS-PRIVADOS.local.md`, existe só localmente.)
