# Arquitetura — Âmbar Brunch Frontend

> **Situação:** stack aprovada no planejamento (2026-10-16). Nenhuma dependência instalada ainda. Plano: [`PLANO-IMPLEMENTACAO.md`](PLANO-IMPLEMENTACAO.md).

---

## 1. Visão geral

Este repositório contém **somente o frontend** do Âmbar Brunch.

- É um projeto **independente**: tem seu próprio repositório, ciclo de desenvolvimento e deploy.
- Não contém código de backend, banco de dados ou infraestrutura.
- Não altera outros repositórios (incluindo o Giardini).

## 2. Relação com o backend

Futuramente, o frontend **consumirá a API FastAPI existente**, que permanece em seu próprio repositório.

```text
┌─────────────────────────┐     HTTPS / JSON     ┌─────────────────────────┐
│  Frontend (este repo)   │  ─────────────────▶  │  API FastAPI existente  │
│  site público           │                      │  (repositório próprio)  │
└─────────────────────────┘                      └─────────────────────────┘
```

Ainda **não** há integração. Os pontos abaixo serão definidos em etapa futura:

| Tema | Situação |
| --- | --- |
| URL base da API por ambiente | _A definir_ |
| Endpoints utilizados (ex.: reservas) | _A definir — documentar a partir da API real_. Referência de UX: o site antigo Giardini (`references/motion/giardini-referencia-02.mp4`) pedia ambiente → nº de pessoas → data → horário → nome/contato/observações |
| Autenticação / chaves | _A definir_ (nunca versionar credenciais) |
| CORS | _A definir_ |
| Tratamento de erros e indisponibilidade | _A definir_ |
| Contrato de dados (tipos) | _A definir_ |

## 3. Stack do frontend

**Astro + CSS próprio + TypeScript, com Preact só na ilha da reserva** (aprovado no planejamento em 2026-10-16).
O CSS e o JS do design system já existem em `src/styles/` e `src/lib/` (puros, sem dependências) e entram no Astro como estão.

> **Detalhes:** Astro + CSS próprio + TypeScript, com uma ilha Preact só para o fluxo de reserva; imagens via `astro:assets`; vídeos reexportados sem áudio; Playwright para testes visuais. Justificativa completa em [`../design/COMPONENTIZATION-PLAN.md`](../design/COMPONENTIZATION-PLAN.md). Nada foi instalado.

Critérios a considerar:
- mobile-first e desempenho em redes móveis;
- conteúdo editorial com mídia pesada (imagens/vídeo) bem otimizada;
- fluxo de reserva confiável e acessível;
- SEO e compartilhamento em redes sociais.

## 4. Organização do código (planejada)

| Pasta | Papel |
| --- | --- |
| `src/components/` | Componentes reutilizáveis de interface |
| `src/sections/` | Seções de página compostas por componentes |
| `src/layouts/` | Estruturas de página |
| `src/styles/` | Estilos globais e tokens do design system |
| `src/lib/` | Utilitários e, futuramente, o cliente da API |
| `public/media/` | Assets finais otimizados e aprovados |
| `experiments/` | Protótipos visuais isolados — não fazem parte da aplicação |

## 5. Ambientes e configuração

- Variáveis de ambiente ficam em arquivos `.env*`, ignorados pelo Git.
- Quando houver variáveis, criar um `.env.example` sem valores reais.

## 6. Deploy

_A definir._ Nenhum deploy foi configurado ou executado.

## 7. Registro de decisões técnicas

| Data | Decisão | Motivo |
| --- | --- | --- |
| 2026-10-16 | Astro + CSS próprio + TS, Preact só na reserva | Protótipo é HTML/CSS; zero JS por padrão; pipeline de imagens; ilha só onde há estado |
| 2026-10-16 | Sem biblioteca de animação nem smooth scroll | CSS nativo cobre tudo; não bloquear o scroll |
| 2026-10-16 | Fidelidade medida por paridade de pixels contra o v1 congelado | Garantir que a componentização não altere o desenho aprovado |
