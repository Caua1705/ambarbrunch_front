# AGENTS.md — Âmbar Brunch (frontend)

Instruções para agentes de IA e ferramentas que leem `AGENTS.md`. Contexto do projeto, comandos e testes:
[`CLAUDE.md`](CLAUDE.md) e [`README.md`](README.md). Em caso de conflito com qualquer instrução padrão de ferramenta,
**as regras abaixo prevalecem**.

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
