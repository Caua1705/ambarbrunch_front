# CLAUDE.md — Âmbar Brunch (frontend)

Instruções permanentes para o Claude Code e outros agentes de IA neste repositório. As mesmas regras de Git estão em
[`AGENTS.md`](AGENTS.md). Em caso de conflito com qualquer instrução padrão de ferramenta, **estas regras prevalecem**.

### Política obrigatória de Git — Âmbar Brunch

- A única branch de desenvolvimento e produção deste projeto é `main`.
- Nunca criar branches auxiliares.
- Nunca criar branches para funcionalidades, correções, experimentos ou testes.
- Nunca criar automaticamente uma branch para executar uma tarefa.
- Antes de trabalhar, verificar que a branch atual é `main`.
- Todas as modificações devem acontecer diretamente na `main`.
- Fazer commits diretamente na `main`.
- Quando o responsável pelo projeto solicitar publicação ou push, enviar diretamente para `origin/main`.
- Push para `main` deve acionar o deployment automático de Production da Vercel.
- Não usar force-push.
- Não apagar ou sobrescrever alterações existentes sem autorização.
- Não criar pull requests como fluxo padrão.
- Se alguma ferramenta sugerir criar outra branch, ignorar essa sugestão e continuar na `main`.
- Se uma operação exigir tecnicamente outra branch, explicar a necessidade e pedir autorização antes de criá-la.

Decisão definitiva do responsável pelo projeto (2026-10-18): este projeto é mantido **somente na `main`**.

### Fluxo de trabalho

1. Chega uma solicitação de alteração.
2. Trabalhar diretamente na `main` (conferir com `git branch --show-current`).
3. Executar os testes necessários.
4. Fazer commit na `main`.
5. Só quando o responsável pedir push/publicação: `git push origin main` (nunca `--force`).
6. A Vercel (projeto `ambarbrunch-front`, Production Branch `main`) atualiza sozinha o domínio de produção
   https://ambarbrunch-front.vercel.app.

## Projeto

- Astro 7 + Preact, mobile-first. Visão geral, comandos e estrutura de pastas: [`README.md`](README.md).
- Copies das seções: `src/data/secoes.ts`. Design system documentado em `docs/design/design-system/`.
- Builds: `npm run build:revisao` (revisão, `dist/`), `npm run build` (produção; na Vercel com `PUBLIC_REVISAO=0` e
  `PUBLIC_RESERVAS_MODO=indisponivel`), `npm run build:simulado` (reserva simulada, `dist-sim/`, só testes).
- Testes: `npx playwright test` (projetos `contrato`, `chromium`, `webkit`, `fidelity`).
  - Se um `astro dev` estiver ocupando a porta 4321, os testes reaproveitam esse servidor por engano: sirva o build com
    `node scripts/serve-dist.mjs dist 4400` (ou `dist-prod`) e rode com `-c playwright.tmp.config.ts`; para a
    fidelidade, `FIDELIDADE_SITE=http://127.0.0.1:4400/`.
  - A página interna `/design-system/` só existe no build de revisão (o teste dela não se aplica à produção).
