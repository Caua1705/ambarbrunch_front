# Contrato da API de reservas — PROPOSTA (não validada)

> **Situação (2026-10-16):** proposta do frontend, **ainda não validada** com o responsável pela API FastAPI.
> Nenhuma chamada é feita ao backend. Por padrão o site roda em modo **indisponível** (a comanda diz que as reservas
> online ainda não estão ativas e não envia nada). O modo **simulado** existe só para testes, sempre com aviso visível.
> Código: [`src/lib/api/contrato.ts`](../../src/lib/api/contrato.ts) (tipos) · [`http.ts`](../../src/lib/api/http.ts) (cliente) · [`simulado.ts`](../../src/lib/api/simulado.ts) (testes) · [`src/islands/ReservaFlow.tsx`](../../src/islands/ReservaFlow.tsx) (interface).

## 1. Fluxo na interface

```text
01 ambiente → 02 pessoas → 03 data → 04 horário (vem da API) → 05 seus dados → revisão → confirmação
```

Estados tratados: carregando horários · sem horários na data · erro ao carregar (tentar de novo) · validação de campos ·
horário tomado no envio (volta ao passo 04 com aviso) · falha de envio (carimbo “tente de novo”) · enviando (botão bloqueado,
`aria-busy`) · confirmada ou pendente de confirmação do restaurante. Envio com `Idempotency-Key` para não duplicar reserva
em reenvio.

## 2. Endpoints propostos

| Método e rota | Uso | Resposta |
| --- | --- | --- |
| `GET /reservas/config` | ambientes, limites e antecedência | `{ ambientes: [{ id, nome, capacidadeMax? }], pessoas: { min, max }, antecedencia: { diasMax, horasMin? }, exigeEmail, fusoHorario? }` |
| `GET /reservas/disponibilidade?data=AAAA-MM-DD&pessoas=N&ambiente=id` | horários do dia | `{ data, horarios: [{ hora: "HH:MM", disponivel }] }` |
| `POST /reservas` + cabeçalho `Idempotency-Key` | criar reserva | `201 { codigo, status: "confirmada" \| "pendente", ambienteId, pessoas, data, hora }` |

Corpo do `POST`:

```json
{ "ambienteId": "jardim", "pessoas": 2, "data": "2026-10-24", "hora": "10:30",
  "nome": "…", "telefone": "85999990000", "email": "…(opcional)", "observacoes": "…(opcional)",
  "consentimentoPrivacidade": true, "origem": "site" }
```

Erros esperados (o cliente já trata): `409` horário tomado · `422` validação (formato padrão do FastAPI `detail: [{ loc, msg }]`,
mapeado para os campos) · `429` limite de tentativas · `503` indisponível · rede/tempo esgotado (12 s).

## 3. Perguntas para o responsável pelo backend

1. As rotas existem com outros nomes ou formatos? (o cliente se adapta em `http.ts`)
2. URL de **staging** para testes e regras de **CORS** para o domínio do site.
3. Autenticação: a API é pública para criar reserva? Há proteção contra abuso (rate limit, captcha)?
4. A reserva é confirmada na hora ou fica “pendente” até o restaurante aprovar? Por qual canal o cliente é avisado?
5. Fuso horário e formato de data/hora; antecedência mínima e máxima; tolerância de atraso.
6. Ambientes reserváveis, capacidade e limite de pessoas por reserva (acima disso, contato direto?).
7. Campos obrigatórios (e-mail? CPF? nenhum além de nome e telefone?).
8. Cancelamento e alteração: existem? (o site hoje não oferece)
9. Idempotência: o backend aceita `Idempotency-Key`? Se não, como evitar reservas duplicadas?
10. Dados de teste: podemos criar e apagar reservas de teste no staging?

## 4. O que falta para reservas reais

| # | Passo | Quem |
| --- | --- | --- |
| 1 | Validar este contrato (ou receber o real) e ajustar `contrato.ts`/`http.ts` | backend + frontend |
| 2 | URL de staging + CORS liberado | backend |
| 3 | Texto de privacidade (LGPD) e do consentimento | Âmbar / jurídico |
| 4 | Regras de reserva (§3, perguntas 4–7) | Âmbar |
| 5 | Ativar `PUBLIC_RESERVAS_MODO=api` + `PUBLIC_RESERVAS_API_URL` (staging) e rodar os testes e2e contra o staging | frontend |
| 6 | Testes reais combinados: criar, conferir na base e cancelar reservas de teste; duplicidade; horário esgotado; rede lenta | backend + frontend |
| 7 | Teste em iPhone e Android reais | equipe |
| 8 | Só então: URL de produção, com autorização | Âmbar |

Até o passo 6 estar verde, a reserva **não** é apresentada como funcional.
