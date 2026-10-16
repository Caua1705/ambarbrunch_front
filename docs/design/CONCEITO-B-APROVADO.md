# Conceito B — Fornada Âmbar · versão aprovada

> **Situação:** aprovado como **direção artística** em 2026-10-16. Não é o site final nem o design system.
> **Referência congelada:** `experiments/concept-b-aprovado-v1/` (cópia byte a byte, verificável com `sha256sum -c SHA256SUMS`).
> **Screenshots de referência:** `experiments/screenshots/baseline-concept-b-v1/` (fora do Git, contém mídia sem licença).
> `experiments/concept-b/` continua como área de trabalho; a v1 não deve ser editada.

Documentos relacionados: [`HOMEPAGE-STORYBOARD.md`](HOMEPAGE-STORYBOARD.md) · [`MOTION-PLAN.md`](MOTION-PLAN.md) · [`COMPONENTIZATION-PLAN.md`](COMPONENTIZATION-PLAN.md).

---

## 1. O que define o conceito (e precisa sobreviver à construção)

1. **Marca primeiro.** O logo Âmbar abre a página numa etiqueta creme de borda recortada (como etiqueta de padaria) e fecha a página no rodapé. A Roll aparece como selo, assinatura e seção própria, nunca como dona do site.
2. **Tipografia condensada gigante** em caixa-alta, com linhas alternando alinhamento (esquerda/direita) e um acento manuscrito em serifa itálica (“scribble”).
3. **Blocos de cor chapados** — vinho, cacau, manteiga e creme — alternando a cada seção, com textura de grão sutil.
4. **Colagem física:** fotos reais com moldura (polaroide, recorte circular, ladrilho arredondado), fita adesiva, leve rotação, sombra curta.
5. **Anotações à mão com setas**, linguagem herdada dos posts da Roll.
6. **Formas de papel:** borda recortada (etiqueta), comanda picotada (reserva), painéis em diagonal (ambientes), faixas-pílula (cardápio).
7. **Sombra deslocada sólida** (`4px 4px 0 cacau`) nos botões e chips: tátil e “impressa”.
8. **Reserva como objetivo:** CTA no hero, CTA fixo depois do hero, links “reservar aqui” nos ambientes e o bloco-comanda.

## 2. Estrutura do protótipo

Arquivos: `index.html` (243 linhas) · `styles.css` (481) · `main.js` (81). Sem dependências. Fontes do Google Fonts.

| # | Bloco (seletor) | Fundo | Conteúdo | Composição |
| --- | --- | --- | --- | --- |
| 0 | `.proto-ribbon` | tinta | aviso de protótipo | faixa fina — **remover** no site |
| 1 | `header.hero[data-hero]` | vinho + grão | etiqueta com logo, título “Café, / brunch / & fornadas”, colagem (croissant em círculo, salão em polaroide, bruschetta em ladrilho, selo Roll giratório, faíscas), CTA, nota “*foto de referência do espaço anterior” | coluna flex; colagem com `position:absolute` |
| 2 | `.ticker` | cacau | categorias do cardápio em loop | faixa inclinada −2,5°, sobreposta ao hero |
| 3 | `section.mesa#gastronomia` | creme | título “Mesa / cheia” + scribble; quadro com 3 fotos, fitas, 3 notas e 3 setas; faixas “pra comer / pra beber” | quadro de altura fixa (660 px) com posições absolutas |
| 4 | `section.roll#roll` | cacau + grão | selo Roll, título “Forna / das”, texto; 3 vídeos em carrossel; 3 bandejas em leque | espiral gigante ao fundo; carrossel com scroll-snap |
| 5 | `section.climas#ambientes` | manteiga | título “Escolha / o clima”, aviso de fotos antigas, painel jardim (diagonal), painel salão (diagonal), 2 bolhas (lounge, leitura) | painéis com `clip-path` e bolhas absolutas |
| 6 | `section.reserva#reservar[data-reserva]` | vinho + grão | título “Reserve / sua mesa” + scribble; comanda com carimbo “prévia”, 4 passos | cartão com máscara picotada |
| 7 | `footer.footer` | creme | logo, assinatura Roll, “Endereço, horários e contatos a confirmar” | centralizado |
| 8 | `a.sticky-cta[data-sticky-cta]` | manteiga | espiral + “Reservar mesa” + seta | barra fixa inferior |

## 3. Tokens visuais observados (provisórios)

### Cores

| Token | Valor | Origem / uso | Contraste-chave |
| --- | --- | --- | --- |
| `--wine` | `#670D27` | tinta do logo (pág. 1 do PDF) · fundos de hero e reserva, títulos | creme 10,93:1 · manteiga 9,48:1 |
| `--wine-deep` | `#4C0A1D` | **não usado** | — |
| `--cacao` | `#3A2218` | fundo Roll, faixa, sombra deslocada | manteiga 11,09:1 |
| `--caramel` | `#C98A45` | faixas, borda dos vídeos, anel de foco | tinta 6,06:1 · **manteiga 2,19:1 (falha como foco)** |
| `--caramel-lt` | `#E7B676` | “BRUNCH”, “&”, scribble claro | sobre vinho 6,82:1 |
| `--caramel-dk` | `#9A5F25` | scribble e legendas sobre creme | **4,50:1 (no limite do AA)** |
| `--butter` | `#F3DDAE` | texto do hero, CTA, fundo de ambientes | — |
| `--cream` | `#F4EEE3` | fundo do logo · seções claras | — |
| `--glaze` | `#FFFBF4` | molduras, chips | — |
| `--berry` | `#A8203A` | faixas (red velvet) | creme 6,20:1 |
| `--leaf` | `#3D5A3E` | faixas (salada, chá) | creme 6,66:1 |
| `--ink` | `#24150F` | texto corrido | — |

### Tipografia

| Papel | Família | Configuração |
| --- | --- | --- |
| Mega título | Bricolage Grotesque | 800, `wdth 75`, caixa-alta, `clamp(78px, 25vw, 200px)/.8`, `-0,02em` |
| Título do hero | Bricolage Grotesque | 800, `wdth 75`, `clamp(70px, 21.5vw, 168px)/.8` |
| Faixa / botão / rótulo | Bricolage Grotesque | 700–800, `wdth 78–85`, caixa-alta |
| Texto corrido | Bricolage Grotesque | 400, `wdth 100`, 16–17 px |
| Scribble / notas / legendas | Fraunces itálico | 500, 15–24 px |

Fraunces e Bricolage são escolhas de exploração. A apresentação oficial usa Playfair Display, Lato e Lemon Milk; a fonte da marca ainda não foi definida.

### Outros recursos

- **Raios:** 14 px (chips, botões de passo), 16–18 px (botões, CTA fixo), 26 px (vídeos, painéis), 999 px (pílulas).
- **Sombras:** deslocada sólida `4px 4px 0 var(--cacao)`; projetada nas fotos `0 16–18px 26–30px -14/-18px`.
- **Grão:** SVG `feTurbulence` inline em data-URI, com `soft-light` e opacidade de 35%.
- **Máscaras:** borda recortada da etiqueta (`radial-gradient` repetido), comanda picotada (círculos laterais), diagonais (`clip-path: polygon`).
- **Easing único:** `cubic-bezier(.2, .7, .2, 1)`.

## 4. Padrões reutilizáveis identificados

| Padrão | Onde aparece | Variações |
| --- | --- | --- |
| **Mega título** em linhas alternadas | Mesa, Roll, Climas, Reserva | cor (vinho/manteiga), com ou sem scribble |
| **Scribble** | Mesa, Reserva | escuro/claro |
| **Recorte fotográfico** | hero, mesa, roll, climas | círculo, polaroide, ladrilho, moldura com fita, painel diagonal, bolha |
| **Fita** | quadro da Mesa | esquerda/direita |
| **Nota + seta** | quadro da Mesa | 3 direções de seta |
| **Selo circular com texto girando** | hero (Roll) | — |
| **Selo simples** | Roll (logo em círculo creme) | — |
| **Faixa (ticker)** | após o hero | — |
| **Pílula de categoria** | Mesa | cor de fundo/texto por item |
| **Botão** | hero, comanda | manteiga, vinho, largura total |
| **Chip** (seleção) | comanda | texto, data (2 linhas) |
| **Stepper** | comanda | — |
| **Aviso de foto antiga** | hero (nota), climas (caixa tracejada) | inline, bloco |
| **Card de vídeo vertical** | Roll | etiqueta, cor da borda |
| **CTA fixo** | global | — |

## 5. Composições editoriais

1. **Hero empilhado:** etiqueta → título em 3 linhas → colagem → rodapé com CTA. É a “capa”.
2. **Quadro de cortiça (Mesa cheia):** 3 fotos sobrepostas e rotacionadas, com anotações nos espaços livres.
3. **Cardápio em faixas:** pílulas coloridas com rotação alternada ±1,5°.
4. **Stories + leque (Fornadas):** carrossel vertical seguido de 3 bandejas abertas como cartas.
5. **Painéis em diagonal (Escolha o clima):** 2 fotos grandes encaixadas pela diagonal, com bolhas sobrepostas.
6. **Comanda (Reserva):** cartão de papel picotado com carimbo.

## 6. Assets usados

| ID | Arquivo | Peso | Onde |
| --- | --- | ---: | --- |
| OF-15 | `creative/source/brand/derivados/logo-ambar-cafe-brunch-p01-fundo-removido.png` | 42 KB | hero, rodapé — **é o elemento de LCP** |
| OF-03 | `creative/source/brand/logo-roll-extraido-pdf-original.png` | 117 KB | selo hero, selo Roll, rodapé (PNG pesado para 60–120 px) |
| FR-07 | `…/gastronomia/croissant-prato-azul.webp` | 115 KB | hero (círculo), mesa |
| FR-06 | `…/gastronomia/bruschetta-brunch.webp` | 316 KB | hero (ladrilho), mesa |
| FR-05 | `…/gastronomia/bebida-chocolate-creme.webp` | 91 KB | mesa |
| FR-03 | `…/ambientes/sala-03.webp` | 113 KB | hero (polaroide), climas |
| FR-04 | `…/ambientes/sala-04.webp` | 398 KB | climas |
| FR-01 | `…/ambientes/sala-01.webp` | 137 KB | climas (bolha) |
| FR-02 | `…/ambientes/sala-02.webp` | 219 KB | climas (bolha) |
| IG-OPT-06 | `…/roll_instagram/otimizadas/2026-08-16_DcGojKjlvml_image.webp` | 260 KB | bandeja Biscoff |
| IG-09 | `…/roll_instagram/2026-08-16_DcGojKjlvml_image_3.jpg` | **995 KB** | bandeja red velvet |
| IG-OPT-07 | `…/roll_instagram/otimizadas/2026-08-16_DcGojKjlvml_image_2.webp` | 265 KB | bandeja Oreo |
| IV-06 | `…/roll_reels/2026-09-17_DdZ5fRIA4f2_video.mp4` | **4,5 MB** | story “do forno” |
| IV-09 | `…/roll_reels/2026-10-02_DeAT31Yg8Un_video.mp4` | 1,9 MB | story “sabores do mês” |
| IV-08 | `…/roll_reels/2026-10-01_Dd9V9KUz-nV_video.mp4` | 1,0 MB | story “bandeja” |
| IV-P | `…/roll_reels/posters/*_poster.webp` (3) | 60–139 KB | posters |
| CR-15/18 | espiral e faíscas (SVG inline) | — | Roll, CTA fixo, hero |

## 7. Efeitos e interações existentes

| Efeito | Implementação | Observação |
| --- | --- | --- |
| CTA fixo | `IntersectionObserver` no hero e na reserva; classe `.is-visible` | Aparece após o hero e some na reserva e no topo |
| Revelação ao rolar | `[data-reveal]` (14 elementos), opacidade + 30 px, 0,7 s, uma vez | Sem JS, tudo fica visível |
| Selo girando | CSS `spin` de 24 s, infinito | Não tem controle de pausa |
| Faixa | CSS `translateX(-50%)` em 32 s, infinito | Não tem controle de pausa |
| Espiral da Roll | `animation-timeline: view()` (rotação ligada ao scroll) | Só em navegadores com suporte; sem fallback necessário |
| Vídeos | `IntersectionObserver` (35%): `preload=auto` + `play()` mudo; pausa fora da tela | Vários podem tocar ao mesmo tempo |
| Comanda | Chips com `aria-pressed`, stepper 1–20, 10 datas geradas, pré-seleção por “reservar aqui” | Só estado visual |
| Movimento reduzido | Desliga animações e transições, mostra tudo | Correto |

## 8. Diagnóstico medido (Edge headless, 2026-10-16)

| Medição | 360×740 | 375×667 | 390×844 | 430×932 |
| --- | ---: | ---: | ---: | ---: |
| Altura do hero / tela | **802 / 740** | **816 / 667** | 828 / 844 | 904 / 932 |
| CTA do hero visível na 1ª tela | **não** | **não** | sim | sim |
| Colagem invade o título | não | não | não | não |
| Selo Roll encosta no rodapé do hero | sim | sim | sim | não |
| Overflow horizontal | 0 | 0 | 0 | 0 |
| Peso transferido ao rolar a página inteira | 5,4 MB | 5,4 MB | 5,4 MB | 5,4 MB |
| ↳ imagens / vídeo | 3,3 / 2,0 MB | | | |

O LCP é o PNG do logo (42 KB), rápido em rede local. Ainda não foi medido em 4G real.

## 9. Pontos que precisam melhorar (sem mudar a identidade)

### Bloqueantes para o site

1. **Hero em telas baixas:** em 360×740 e 375×667 o CTA do hero fica abaixo da dobra. Como o CTA fixo só aparece depois do hero, **nenhum botão de reserva fica visível na primeira tela**. A colagem precisa encolher pela altura disponível, e o CTA fixo deve passar a observar o próprio botão do hero (ver `MOTION-PLAN.md` §7).
2. **Colagens com medidas em px fixos** (`.board` com 660 px, notas e setas com `top` em px): funcionam em 390, mas não escalam. Converter para unidades relativas ao contêiner, preservando exatamente o desenho em 390 (ver `COMPONENTIZATION-PLAN.md` §4).
3. **Movimento infinito sem pausa** (faixa, selo, vídeos): o WCAG 2.2.2 exige pausar movimento automático com mais de 5 s.
4. **Anel de foco** caramelo sobre manteiga tem 2,19:1 (o mínimo é 3:1).
5. **Mídia pesada:** JPG de 995 KB, vídeo de 4,5 MB **com trilha de terceiros**, PNG da Roll de 117 KB repetido. Falta `srcset` e AVIF/WebP responsivos.

### Importantes

6. `aria-label` num `<p>` (título do hero) não é anunciado de forma confiável; usar texto real e esconder visualmente só a decoração.
7. Vídeos sem legenda nem controle de pausa; mais de um pode tocar ao mesmo tempo.
8. Faltam seções: explicação do que é o Âmbar × Roll, localização e funcionamento, e uma navegação mínima (ver storyboard).
9. A comanda não tem os estados reais: dados pessoais, confirmação, erro, sem disponibilidade, carregando.
10. As fontes vêm de CDN externo; no site, auto-hospedar com subset latino.
11. Código morto: `.grain`, `.climas__inner`, `--wine-deep`. JS duplicado do conceito A.
12. Desktop: funciona, mas ainda não foi desenhado com o mesmo cuidado (o foco desta etapa é mobile).

### Conteúdo provisório

- Todos os títulos, scribbles e textos corridos foram escritos para o protótipo e precisam de revisão do cliente.
- Fotos de ambiente são do espaço anterior; fotos de pratos podem ser antigas.
- Os vídeos da Roll ainda não têm autorização e precisam ser reexportados sem trilha.
