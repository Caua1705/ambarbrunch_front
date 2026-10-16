# Âmbar Brunch — Frontend

Novo frontend do **Âmbar Brunch**, com a marca **Roll** integrada à identidade gastronômica.

O objetivo é um site **mobile-first**, editorial e criativo, com acabamento cuidadoso e foco principal em **reservas**.

> **Situação atual (2026-10-16):** Etapa 4 em andamento — site real em **Astro**, mobile primeiro, a partir do
> **Conceito B · Fornada Âmbar** (protótipo congelado em [`experiments/concept-b-aprovado-v1/`](experiments/concept-b-aprovado-v1/README.md)).
> Reserva em modo **indisponível** até o contrato da API ser validado. Sem deploy.
> Relatório: [`docs/technical/RELATORIO-ETAPA-4.md`](docs/technical/RELATORIO-ETAPA-4.md) · pendências: [`docs/content/PENDENCIAS-CONTEUDO.md`](docs/content/PENDENCIAS-CONTEUDO.md).

## Rodar localmente

Requer Node 22.22+ e, para os vídeos, ffmpeg no PATH. As mídias saem do acervo local `creative/source` (fora do Git).

```bash
npm install
npm run media:prepare      # copia os originais aprovados para src/assets/media
npm run media:video        # reexporta os vídeos sem áudio para public/media/video
npm run build:revisao      # build de REVISÃO: mostra pendências “a confirmar” e mídia com autorização pendente
npm run preview            # http://localhost:4321
```

| Comando | Para quê |
| --- | --- |
| `npm run dev` | desenvolvimento (modo revisão) |
| `npm run build` | build de **produção**: sem marcações de revisão, sem mídia não autorizada |
| `npm run build:simulado` | build só de testes, com a reserva simulada (sempre com aviso) em `dist-sim/` |
| `npm test` | fidelidade ao v1 + e2e em Chromium e WebKit (precisa de `node experiments/serve.mjs` para a fidelidade) |
| `npm run check` | checagem de tipos |
| `npm run perf` | Lighthouse móvel (mediana de 3 rodadas) |
| `npm run shots` | screenshots de revisão por viewport |
| `node scripts/scroll-perf.mjs` · `node scripts/peso-pagina.mjs` | fluidez do scroll (CPU 4×) e bytes transferidos |

Variáveis (`.env.example`): `PUBLIC_REVISAO`, `PUBLIC_RESERVAS_MODO` (`indisponivel` · `simulado` · `api`), `PUBLIC_RESERVAS_API_URL` (staging).

## Como trabalhamos

O projeto avança por etapas. A direção visual é aprovada **antes** do desenvolvimento do site:

1. **Etapa 0** — estrutura de pastas e documentação inicial *(concluída)*
2. **Etapa 1** — catalogação dos materiais recebidos e preenchimento do brief de marca *(concluída)*
3. Exploração visual em `experiments/` e aprovação de uma direção *(concluída: Conceito B)*
4. Design system documentado *(concluída)*
5. Desenvolvimento do frontend em `src/` *(atual)*
6. Integração com a API FastAPI existente *(contrato proposto, aguardando validação)*

## Estrutura de pastas

```text
ambarbrunch_front/
├── creative/              Materiais criativos de trabalho (não publicados)
│   ├── inbox/             Recebidos e ainda não catalogados
│   ├── source/            Originais oficiais
│   │   ├── brand/         Arquivos de marca (logos, manuais etc.)
│   │   ├── photography/   Fotografias originais
│   │   └── video/         Vídeos originais
│   ├── generated/         Elementos gerados por IA — separados dos oficiais
│   │   ├── illustrations/
│   │   ├── backgrounds/
│   │   └── compositions/
│   └── approved/          Selecionados e aprovados para uso no site
├── references/            Referências externas
│   ├── websites/          Sites de referência (links, anotações)
│   ├── screenshots/       Capturas de tela
│   └── motion/            Estudos de animação e efeitos
├── public/
│   └── media/             SOMENTE assets finais, otimizados e aprovados
│       ├── brand/
│       ├── photography/
│       ├── video/
│       └── graphics/
├── docs/
│   ├── brand/             Identidade Âmbar Brunch × Roll
│   ├── design/            Decisões de design e design system
│   ├── content/           Conteúdo e catálogo de assets
│   └── technical/         Arquitetura e documentação técnica
├── experiments/           Protótipos visuais independentes para comparação
│   ├── concept-a/
│   └── concept-b/
└── src/                   Futura aplicação frontend
    ├── components/
    ├── sections/
    ├── layouts/
    ├── styles/
    └── lib/
```

## Fluxo de um asset

```text
creative/inbox  →  creative/source  ou  creative/generated
                         ↓
                 creative/approved   (após aprovação)
                         ↓
                 public/media        (versão final otimizada)
```

- Todo arquivo recebido entra por `creative/inbox/` e é registrado em
  [`docs/content/ASSET-MANIFEST.md`](docs/content/ASSET-MANIFEST.md).
- Arquivos oficiais da marca vão para `creative/source/`; tudo que for gerado por IA
  vai para `creative/generated/` — **nunca misturar os dois**.
- Só chega a `public/media/` o que foi aprovado **e** otimizado para web.
  Mídia bruta nunca vai para `public/`.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [`docs/brand/BRAND-BRIEF.md`](docs/brand/BRAND-BRIEF.md) | Estrutura para documentar Âmbar Brunch × Roll |
| [`docs/design/DESIGN-SYSTEM.md`](docs/design/DESIGN-SYSTEM.md) | Índice do design system do Conceito B |
| [`docs/technical/PLANO-IMPLEMENTACAO.md`](docs/technical/PLANO-IMPLEMENTACAO.md) | Etapas até 22/10, testes e riscos |
| [`docs/technical/CONTRATO-API-RESERVAS.md`](docs/technical/CONTRATO-API-RESERVAS.md) | Contrato proposto da API de reservas e o que falta para reservas reais |
| [`docs/technical/RELATORIO-ETAPA-4.md`](docs/technical/RELATORIO-ETAPA-4.md) | Testes, desempenho e defeitos corrigidos |
| [`docs/content/PENDENCIAS-CONTEUDO.md`](docs/content/PENDENCIAS-CONTEUDO.md) | Conteúdo pendente e onde preencher |
| [`docs/content/ASSET-MANIFEST.md`](docs/content/ASSET-MANIFEST.md) | Catálogo de arquivos recebidos: origem, finalidade, situação e aprovação |
| [`docs/content/CURADORIA-INICIAL.md`](docs/content/CURADORIA-INICIAL.md) | Seleção inicial por seção, conceitos A/B e gaps de conteúdo |
| [`docs/content/REVISAO-REELS.md`](docs/content/REVISAO-REELS.md) | Revisão dos 9 reels: conteúdo, áudio, direitos e uso possível |
| [`docs/design/DIRECAO-CRIATIVA-INICIAL.md`](docs/design/DIRECAO-CRIATIVA-INICIAL.md) | Direção criativa inicial recebida no pacote (não aprovada) |
| [`docs/content/FONTES-PENDENTES.md`](docs/content/FONTES-PENDENTES.md) | Fontes e validações pendentes do pacote |
| [`docs/content/pacote-v1/`](docs/content/pacote-v1/) | README e especificação originais do pacote de assets v1 |
| [`docs/technical/ARCHITECTURE.md`](docs/technical/ARCHITECTURE.md) | Arquitetura inicial e relação com a API FastAPI |

## Git e arquivos grandes

O `.gitignore` foi configurado para **não** versionar:

- o conteúdo de `creative/inbox/`, `creative/source/`, `creative/generated/` e `references/motion/`
  (apenas os `.gitkeep` são rastreados);
- desde a Etapa 1: `creative/source/social/` (JSON com comentários de terceiros), `creative/generated/concepts/`
  e `ornaments/`, `references/screenshots/`, PDFs em `docs/brand/`, imagens derivadas em `docs/content/`
  (folhas de contato, capas de reels, `catalogos/`) e o CSV antigo com URLs assinadas do Instagram;
- vídeos brutos, fotos RAW, arquivos de design de origem (`.psd`, `.ai`, `.indd`…) e pacotes compactados;
- credenciais (`.env`, chaves, `credentials*.json`) e arquivos temporários.

Para versionar algum desses arquivos de propósito, use `git add -f <arquivo>`.

### Mídia do site (`src/assets/media`)

Os originais usados pelo site ficam em `src/assets/media/` (o build gera AVIF/WebP responsivos). Logos oficiais e fotos
do Âmbar (FR-01…07) são versionados, porque precisam existir no deploy. **Fotos e vídeos da Roll** (Instagram, autorização
pendente) ficam **fora do Git** (`src/assets/media/roll/`, `public/media/video/roll-*`) e fora do build de produção;
o próprio build remove qualquer mídia não referenciada.

### `public/media` e deploy

`public/media/` é versionado e vai para o deploy, mas só com versões finais otimizadas:

- **Imagens** (`.webp`, `.avif`, `.jpg`, `.png`, `.svg`) entram normalmente. Meta: até 500 KB por arquivo.
- **Vídeos** só entram com o sufixo de versão web: `<nome>.web.mp4` ou `<nome>.web.webm` (meta: até 4 MB, sem faixa de áudio de terceiros). O poster usa `<nome>.poster.webp`.
- São bloqueados em `public/media`: `.mp4`/`.webm` sem o sufixo, PDFs, TIFF/BMP/HEIC e arquivos `*-original.*` ou `*-raw.*`.

O repositório é **público** no GitHub. Links privados do cliente ficam em arquivos `*.local.md`, que não são versionados.
Se o volume de mídia crescer, avaliar a adoção de **Git LFS**.

## Regras do projeto

- Não inventar logos, cores oficiais, fontes, imagens, preços ou conteúdos.
- Toda decisão visual é registrada em `docs/design/` somente após aprovação.
- O frontend é independente: não altera o backend nem outros repositórios.
