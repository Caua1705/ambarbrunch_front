# Diretrizes visuais — imagens e identidade

> Fontes: componentes em `src/components/` (`Foto.astro`, `StickerRoll.astro`, `Badge.astro`), mídia em `src/assets/media/`,
> preparo em `scripts/prepare-media.mjs` e `scripts/encode-video.mjs`, catálogo em [`../content/ASSET-MANIFEST.md`](../content/ASSET-MANIFEST.md).
> Parte do [design system](DESIGN-SYSTEM.md).

## 1. Logos oficiais

| Logo | Arquivo no site | Origem | Onde aparece | Tamanho exibido |
| --- | --- | --- | --- | --- |
| **Âmbar · café & brunch** | `src/assets/media/brand/logo-ambar.png` (1296 × 494, fundo transparente, tinta `#670D27`) | OF-15, extraído da pág. 1 do PDF oficial | etiqueta do hero (`h1`), folha do menu, rodapé, barra das páginas internas, ícone do site | hero ≈ 248 px (390) · 312 px (desktop) · rodapé 240 · menu 132 · barra 122 |
| **Roll** | `src/assets/media/brand/logo-roll.png` (reduzido a 420 px) | OF-03 | selo do hero, selo da seção Fornadas e do Novo capítulo, rodapé | selo hero ≈ 60 px · selo 87 px · rodapé 56 px |

**Regras**

1. **Só os arquivos oficiais.** Nada de redesenho, vetorização própria, recoloração, contorno, sombra no próprio logo ou logos gerados por IA.
2. **Âmbar sempre sobre creme** (`--cream`): dentro da etiqueta recortada, na folha ou no rodapé creme. Nunca direto sobre vinho, cacau ou foto.
3. **Roll sempre sobre creme e dentro de um círculo** (`.badge`, `.sticker--roll`) — nunca solta sobre cor ou foto, nunca maior que a marca Âmbar na mesma tela.
4. **Hierarquia:** Âmbar Brunch é a marca da página; a Roll aparece como **assinatura** (“assinatura gastronômica”, “com assinatura gastronômica”), nunca como marca principal.
5. **Respiro:** a etiqueta tem padding de 20/24/30 px ao redor do logo; não colocar texto dentro da etiqueta do logo.
6. **Ícone do site (oficial, confirmado em 2026-10-16):** o logo do Âmbar Brunch sobre creme — `favicon.png` (512), `favicon-48.png`, `apple-touch-icon.png` (180), `icon-192.png` e `site.webmanifest`.

## 2. Fotografia

### O que pode entrar

| Tipo | Exemplos | Regra |
| --- | --- | --- |
| **Fotos reais do Âmbar** | FR-01…07 (pratos e ambientes) | permitidas; fotos do **espaço anterior** levam aviso de procedência (§2.4) |
| **Fotos e vídeos da Roll** (Instagram) | IG-OPT-06, IG-09, IG-OPT-07; IV-06, IV-08, IV-09 | **só com autorização registrada**; até lá ficam fora do Git e do build de produção |
| **Conceitos de IA** (`creative/generated/`) | colagens, mockups, embalagens | **nunca** como produto, ambiente, embalagem ou logo; o site não usa nenhum hoje |
| Fotos do shooting (21/10) e do espaço novo (24/10) | — | quando chegarem, substituem as atuais foto a foto (e removem o aviso) |

### 2.1 Tratamento

- **Sem filtros, sem correção de cor estilizada, sem duotone.** A unidade visual vem da moldura (papel, fita, borda) e da composição, não de cor aplicada sobre a foto.
- Pratos de cima ou a 45°; ambientes com luz natural.
- Recorte por `object-fit: cover` centralizado.

### 2.2 Proporções por peça (do código)

| Peça | Proporção | Classe |
| --- | --- | --- |
| Recorte circular, bolha | 1 : 1 | `.cut--circle`, `.bubble img` |
| Polaroide | 3 : 3,6 | `.cut--polaroid img` |
| Ladrilho | 3 : 3,9 | `.cut--tile` |
| Quadro da Mesa — a / b / c | 4 : 4,9 · 1 : 1,08 · 3 : 3,7 | `.board__item--a/b/c img` |
| Bandeja | 3 : 4 | `.trays img` |
| Painel de ambiente | 4 : 5 (recortado em diagonal de 16%) | `.panel img` |
| Vídeo | 9 : 16 | `.story` |

Ao trocar uma foto, escolher um enquadramento que funcione **nessa proporção** — o recorte é fixo.

### 2.3 Entrega (performance)

| Regra | Valor |
| --- | --- |
| Componente | `Foto.astro` → `<picture>` com **AVIF + WebP**, fallback WebP, `display: contents` |
| Larguras geradas | 240 · 360 · 540 · 720 · 1080 (limitadas à largura do original) |
| `sizes` | pela largura real da peça (ex.: círculo do hero `(min-width: 960px) 26vw, 46vw`) |
| Qualidade | 64 nas fotos; 80–82 nos logos |
| Prioridade | **só 2 imagens** com `fetchpriority="high"` e carga imediata: logo e círculo do hero. Todas as outras: `loading="lazy"`, `decoding="async"` |
| Dimensões | `width`/`height` sempre declarados (CLS = 0 medido) |
| Originais no repositório | ≤ 1.600 px; os da Roll fora do Git até a autorização |

### 2.4 Procedência (obrigatória)

- Foto do **espaço anterior** usada no hero → `.ref-note` com `*` (“foto de referência do espaço anterior”).
- Seção de ambientes com fotos antigas → `.notice` (“Fotos de referência do espaço anterior — serão trocadas…”).
- Vídeo → crédito visível em cada card (`.story__by`): “@roll.ofc · vídeo da própria Roll” ou “@criadora · conteúdo sobre a Roll”. Vídeo de criadora **nunca** é apresentado como avaliação do Âmbar.
- O aviso some quando a foto é trocada pela atual (`fotoAntiga: false` em `src/data/ambientes.ts`).

### 2.5 Vídeos

| Regra | Valor |
| --- | --- |
| Reexporte | H.264 540 × 960, CRF 27, teto 1,1 Mbps, **sem faixa de áudio**, `+faststart` (`npm run media:video`) |
| Duração | trecho de 4–9 s em loop |
| Peso | 486–844 KB por vídeo (originais: 1,0–4,5 MB) |
| Excluídos | IV-02 depois de ~9 s (texto “so delicious” gravado na imagem); IV-03 e IV-04 (marca de terceiro e pessoas sem autorização) |
| Áudio | só com autorização e legenda, acionado pelo visitante (nenhum hoje) |

## 3. Sobreposição de imagens (colagem)

| Regra | Valor |
| --- | --- |
| Peças por palco | até 3 fotos + 1 selo + 1 ornamento |
| Sobreposição | 15–35% da peça menor |
| Rotação | entre −10° e +8° (carimbos até +14°); vizinhas alternam o sinal |
| Camadas | foto grande atrás → pequena na frente → selo → texto (z-index 1–4, ver [`LAYOUT-AND-GRID.md`](LAYOUT-AND-GRID.md) §7) |
| Moldura conforme o fundo | glacê (quadro, polaroide) · creme (ladrilho, bandejas) · manteiga (círculo, bolhas) |
| Fita | só em foto emoldurada; uma por foto; ±5–8° |
| Nota + seta | a nota nunca cobre foto; a seta aponta da nota para a peça |
| Rosto e prato | nenhum ornamento, selo ou texto sobre rosto ou sobre o prato principal |
| Escala | posições em `--u` (1 px do protótipo), para a composição escalar inteira |

## 4. Ornamentos SVG

Todos inline, `aria-hidden="true"`, desenhados a traço (sem preenchimento), pontas arredondadas.

| Ornamento | Onde | Cor · traço | Origem |
| --- | --- | --- | --- |
| Faíscas | hero | `--butter` · 6 (no viewBox) | CR-18 redesenhado |
| Espiral | fundo da Roll (560 px, 22% de opacidade, gira com o scroll), Novo capítulo (210 px, 25%), CTA fixo (28 px) | `--caramel` / `--wine` · 9–18 | CR-15 redesenhado |
| Setas à mão | quadro da Mesa | `--wine` · 3,2 | protótipo |
| Ícone de menu (3 traços irregulares) e ✕ | botões de menu | `currentColor` · 2,6 | novo |
| ✺ | separador da faixa | caractere tipográfico | protótipo |
| Pino | placa da Visite | círculo `--berry` com sombra interna | novo |

Regras: no máximo **um ornamento por palco**; nunca sobre rosto ou prato; ornamentos não carregam informação (por isso `aria-hidden`).

## 5. Texturas e máscaras

| Recurso | Regra |
| --- | --- |
| **Grão** (`--grain`) | ruído SVG 160 × 160, `soft-light`, opacidade .35; **só sobre vinho e cacau** (hero, Fornadas, reserva, Visite). Superfícies claras ficam limpas |
| **Borda recortada** (`--mask-scallop`) | ondas de 20 px: base da etiqueta do logo, base da seção Novo capítulo; virada para cima na folha do menu (`--mask-scallop-top`) |
| **Picote** (`--mask-perforated`) | furos de 9 px a cada 28 px nas laterais: só em comandas (reserva, horários) |
| **Diagonal** | 16% nos painéis de ambiente |
| **Pontilhado** | 2 px `--rule`: separa passos, itens de menu, linhas de revisão e horários |

## 6. Materiais — o que é oficial, real ou conceito

| Categoria | Pasta | No site? |
| --- | --- | --- |
| Oficial da marca (logos, PDF de proposta) | `creative/source/brand/` | logos sim (§1); o PDF serviu de fonte para cores e categorias do cardápio |
| Fotos reais do Âmbar | `creative/source/photography/{gastronomia,ambientes}` → `src/assets/media/` | sim, com procedência |
| Instagram da Roll | `creative/source/photography/roll_instagram`, `video/roll_reels` → `src/assets/media/roll/`, `public/media/video/` (fora do Git) | só no build de revisão até a autorização |
| Conceitos de IA, ornamentos gerados | `creative/generated/` | **não** |
| Referências de outros sites | `references/` | **não** (estudo) |

## 7. Exemplo real

```astro
<!-- Foto.astro: AVIF/WebP responsivo; o CSS do v1 estiliza o <img> -->
<figure class="cut cut--circle">
  <Foto src="gastronomia/croissant-prato-azul.webp" alt="Croissant em prato azul sobre sofá laranja"
        sizes="(min-width: 960px) 26vw, 46vw" prioridade />
</figure>
```
