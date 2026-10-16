# Arquitetura — Âmbar Brunch Frontend

> **Situação:** documento inicial. Nenhuma stack foi escolhida e nenhuma dependência foi instalada.

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
| Endpoints utilizados (ex.: reservas) | _A definir — documentar a partir da API real_ |
| Autenticação / chaves | _A definir_ (nunca versionar credenciais) |
| CORS | _A definir_ |
| Tratamento de erros e indisponibilidade | _A definir_ |
| Contrato de dados (tipos) | _A definir_ |

## 3. Stack do frontend

_A definir._ A escolha (ex.: framework, estilização, animação) será feita após a aprovação da direção visual.

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
| | | |
