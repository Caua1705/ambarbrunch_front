# Âmbar Brunch — Frontend

Novo frontend do **Âmbar Brunch**, com a marca **Roll** integrada à identidade gastronômica.

O objetivo é um site **mobile-first**, editorial e criativo, com acabamento cuidadoso e foco principal em **reservas**.

> **Situação atual:** Etapa 0 — preparação do repositório.
> Ainda não há aplicação, dependências instaladas nem decisões visuais tomadas.

## Como trabalhamos

O projeto avança por etapas. A direção visual é aprovada **antes** do desenvolvimento do site:

1. **Etapa 0** — estrutura de pastas e documentação inicial *(atual)*
2. Catalogação dos materiais recebidos e preenchimento do brief de marca
3. Exploração visual em `experiments/` e aprovação de uma direção
4. Design system documentado
5. Desenvolvimento do frontend em `src/`
6. Integração com a API FastAPI existente

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
| [`docs/design/DESIGN-SYSTEM.md`](docs/design/DESIGN-SYSTEM.md) | Estrutura do futuro design system (sem decisões ainda) |
| [`docs/content/ASSET-MANIFEST.md`](docs/content/ASSET-MANIFEST.md) | Catálogo de arquivos recebidos: origem, finalidade, situação e aprovação |
| [`docs/technical/ARCHITECTURE.md`](docs/technical/ARCHITECTURE.md) | Arquitetura inicial e relação com a API FastAPI |

## Git e arquivos grandes

O `.gitignore` foi configurado para **não** versionar:

- o conteúdo de `creative/inbox/`, `creative/source/`, `creative/generated/` e `references/motion/`
  (apenas os `.gitkeep` são rastreados);
- vídeos brutos, fotos RAW, arquivos de design de origem (`.psd`, `.ai`, `.indd`…) e pacotes compactados;
- credenciais (`.env`, chaves, `credentials*.json`) e arquivos temporários.

Para versionar algum desses arquivos de propósito, use `git add -f <arquivo>`.
Se o volume de mídia crescer, avaliar a adoção de **Git LFS**.

## Regras do projeto

- Não inventar logos, cores oficiais, fontes, imagens, preços ou conteúdos.
- Toda decisão visual é registrada em `docs/design/` somente após aprovação.
- O frontend é independente: não altera o backend nem outros repositórios.
