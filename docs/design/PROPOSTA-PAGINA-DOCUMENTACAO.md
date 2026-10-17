# Proposta — página interna de documentação visual

> **Situação: implementada em 2026-10-16** em `src/pages/design-system/[...secao].astro` (+ `src/styles/docs/design-system.css`,
> `src/lib/design-system.js`). Uma página só, com navegação por categoria (âncoras), em vez de subpáginas. A auditoria virou o teste
> `tests/tokens.spec.ts`. No build de produção a rota não é gerada e os arquivos da página são removidos do `_astro/`.
> Parte do [design system](DESIGN-SYSTEM.md).

## 1. Objetivo

Uma página do próprio site para **inspecionar isoladamente** tipografia, cores, componentes e estados, construída com os
**componentes reais** (não cópias), para que ela nunca fique desatualizada em relação ao site.

Ela substitui, com vantagem, a vitrine estática de `experiments/design-system/index.html`, que foi útil na Etapa 3 mas
duplica markup.

## 2. Onde e para quem

| Item | Proposta |
| --- | --- |
| Rota | `/design-system/` (e subpáginas) |
| Visibilidade | **só nos builds de revisão e de desenvolvimento**. No build de produção a rota não é gerada (rota dinâmica `src/pages/design-system/[...secao].astro` cujo `getStaticPaths()` devolve `[]` quando `REVISAO` é falso) |
| Indexação | `noindex` e fora do sitemap |
| Público | equipe, cliente na revisão, quem for manter o site |
| Mobile | a página também é mobile-first: tudo navegável em 390 px |

## 3. Seções

| Página | Conteúdo | Como evita duplicação |
| --- | --- | --- |
| **Cores** | amostras dos 11 primitivos e dos papéis; tabela de pares aprovados com o **contraste calculado na hora** | lê os valores com `getComputedStyle(document.documentElement).getPropertyValue('--wine')` |
| **Tipografia** | cada papel renderizado com texto real do site; ao lado, os valores calculados **na largura atual** (tamanho, entrelinha, tracking, largura, eixos) | aplica a própria classe/token; lê os valores computados |
| **Layout** | régua do gutter e dos containers; escala de espaço; indicador do breakpoint ativo; alternador de grade sobre a página | tokens lidos do CSS |
| **Componentes** | cada componente isolado, com **todos os estados lado a lado**: botão (normal, pressionado, desabilitado), chip (normal, selecionado, indisponível, carregando), campo (normal, foco, inválido), stepper (limites), carimbo (prévia, em breve, simulação, reservado, erro), aviso, nota de procedência, story (tocando/pausado), menu (botões e folha aberta) | importa `MenuButton`, `Stamp`, `Story`, `Badge`, `StickerRoll`, `MegaTitle`, `Foto`…; estados forçados por atributo (`aria-checked`, `data-invalid`, `disabled`, `data-state`) |
| **Comanda** | a ilha `ReservaFlow` nos modos `indisponivel` e `simulado`, e um seletor que leva a comanda direto a cada etapa (horários, dados, revisão, confirmação, falha) | a própria ilha, com uma prop de etapa inicial só para esta página |
| **Composições** | palcos do hero e do quadro em 360/390/430 px lado a lado (iframes da própria home com `?secao=`) e as receitas de seção | iframes do site, não cópias |
| **Movimento** | botões “rever” para cada primitiva (`lines`, `piece`, `draw`, `stamp`), a entrada do hero, os tokens de duração e curva com uma demonstração; alternador “simular movimento reduzido” e “pausar” | reaplica `.is-in` / `.enter` nos próprios elementos |
| **Imagens** | proporções de cada peça com as fotos reais; regras de procedência; lista de mídia com autorização pendente | lê `src/data/*` e `src/lib/media.ts` |
| **Auditoria** | resultado do teste de contrato de tokens ([proposta de tokens](PROPOSTA-TOKENS-CSS.md) §6): literais fora dos tokens, tokens sem uso | gerado no build a partir do CSS |

## 4. Interações da página

- Seletor de **largura simulada** (360 · 375 · 390 · 430 · 768) que reenquadra os palcos em iframe.
- Alternadores globais: **movimento reduzido simulado** (classe na raiz que aplica as regras de `prefers-reduced-motion`), **pausa** (o mesmo `data-motion="paused"` do site), **superfície** (ver um componente sobre vinho, cacau, manteiga e creme).
- Cada bloco com o **trecho de markup** do componente, gerado a partir da própria renderização.

## 5. O que ela não faz

- Não define valores: só mostra os de `src/styles/tokens*`.
- Não instala biblioteca (sem Storybook): é uma página Astro com os componentes do site.
- Não vai para produção.

## 6. Custo estimado de manutenção

Baixo: como usa os componentes e os tokens reais, uma mudança no design system aparece nela automaticamente. Só um componente **novo** precisa ser adicionado à página.
