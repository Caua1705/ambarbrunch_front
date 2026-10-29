# Contrato da API de reservas (público e painel)

> **Situação (2026-10-29):** conferido no código do backend em produção (`ambarbrunch_back`, branch `producao-reservas`,
> versão `80af395` em `api.ambarbrunch.com/health`; rotas em `app/modulos/reservas/api_publica.py` e `api_admin.py`,
> esquemas em `esquemas.py`, erros em `app/nucleo/erros.py`). A regra "painel não muda data/horário/ambiente/pessoas"
> (`403 alteracao_desativada`) está em implementação no backend (ainda sem commit em 29/10).
> Código do site: [`contrato.ts`](../../src/lib/api/contrato.ts) (tipos) · [`http.ts`](../../src/lib/api/http.ts) (cliente) ·
> [`simulado.ts`](../../src/lib/api/simulado.ts) (testes) · [`ReservaFlow.tsx`](../../src/islands/ReservaFlow.tsx) (interface).
> Testes contra a API falsa no formato real: `tests-reservas/` (`api-falsa.ts`).

## 1. Fluxo público na interface

```text
01 ambiente → 02 pessoas → 03 data → 04 horário (da API) → 05 seus dados + aceite da política → revisão → confirmação
```

A ordem segue o contrato: `GET /reservas/disponibilidade` exige **ambiente, pessoas e data** para calcular os horários
(lotação por ambiente). Não existe rota de "ambientes livres numa data e hora"; inverter a ordem exigiria uma chamada por
ambiente. O site não calcula disponibilidade: grade, antecedência, lotação e dias fechados vêm da API.

## 2. Endpoints públicos

| Método e rota | Resposta |
| --- | --- |
| `GET /reservas/config` | `{ ambientes: [{ id, nome, capacidadeMax, pessoasMin, pessoasMax, datasFechadas[] }], pessoas: { min, max }, antecedencia: { diasMax, horasMin }, exigeEmail, fusoHorario, privacidadeVersao }` |
| `GET /reservas/disponibilidade?data=AAAA-MM-DD&pessoas=N&ambiente=id` | `{ data, horarios: [{ hora: "HH:MM", disponivel }] }` (horário dentro do prazo mínimo vem `disponivel: false`) |
| `POST /reservas` + `Idempotency-Key` (8–100) | `201 { codigo, status: "confirmada" \| "pendente", ambienteId, pessoas, data, hora, duracaoMin, clube: { convite, url } }` — a mesma chave devolve a mesma reserva |

Corpo do `POST` (camelCase; o backend aceita também snake_case):

```json
{ "ambienteId": "jardim", "pessoas": 2, "data": "2026-11-06", "hora": "10:30",
  "nome": "… (até 120)", "telefone": "85999990000", "email": "… (opcional, EmailStr)", "observacoes": "… (opcional)",
  "consentimentoPrivacidade": true, "origem": "site" }
```

O aceite grava em `consentimentos`: `finalidade = privacidade_reserva`, `canal = site`,
`texto_versao = politica.privacidade_texto_versao` (a versão aprovada com `app.cli aprovar-privacidade`) e só hashes
de IP e navegador. Não há consentimento de marketing na reserva. A resposta do `POST` **não** informa envio de WhatsApp:
o site não afirma que houve mensagem.

Erros e como o site trata:

| Resposta | Site |
| --- | --- |
| `409 horario_esgotado` | volta à escolha, avisa no topo (com foco), recarrega os horários, mantém os dados |
| `422` com `detail: [{ loc, msg, type }]` | campo de dados → erro no campo; `data`/`hora` → aviso e nova leitura dos horários; erros de tipo do pydantic (em inglês) viram português |
| `422 idempotencia_conflito` | "Os dados mudaram desde a última tentativa. Confira e confirme de novo." |
| `429 limite_excedido` (`Retry-After: 600`) | mensagem do backend ("Tente de novo em alguns minutos.") |
| `503 reservas_indisponiveis` | estado "reservas fechadas" com link do WhatsApp; confere de novo ao voltar à aba |
| `5xx`, sem conexão, tempo esgotado (12 s) | "Tentar de novo" com a **mesma** chave; em rede/tempo avisa que a reserva pode já ter sido registrada e não será duplicada; "Editar" sem mudança mantém a chave |

## 3. Painel da equipe (backend: `app/painel`, em `https://api.ambarbrunch.com/painel/`)

| Rota | Quem (permissão) | Observação |
| --- | --- | --- |
| `GET /admin/auth/me` | todos | `permissoes[]` decide os botões do painel |
| `GET /admin/reservas` (paginado) | `reservas.visualizar` | Atendente: só de hoje a +14 dias, sem telefone/e-mail |
| `GET /admin/reservas/{id}` | `reservas.visualizar` | |
| `PATCH /admin/reservas/{id}` | `reservas.alterar` | só `contato_nome`, `contato_telefone`, `contato_email`, `observacoes`; data/hora/ambiente/pessoas diferentes → `403 alteracao_desativada` (pedido misto é recusado inteiro) |
| `PATCH /admin/reservas/{id}/status` | `reservas.mudar_status`; Atendente só `compareceu` no dia | transições de `estados.py`; fora delas `409` |
| `POST /admin/reservas/{id}/aviso-comunicado` | `reservas.alterar` | "cliente avisado" depois de cancelamento/alteração |

O site tem um segundo painel (`src/admin`, ligado só com `PAINEL_ADMIN=1`, fora de produção). Ele segue a mesma regra de
edição. Os dois são implementações paralelas: ver a pendência em `RESERVAS-LANCAMENTO.md`.

## 4. Pendências de integração

| # | Passo | Quem |
| --- | --- | --- |
| 1 | Publicar no backend a regra `alteracao_desativada` (hoje só no código local) e o painel `e803e1b` | backend |
| 2 | Teste ponta a ponta real (criar, conferir na base, cancelar) contra a API de produção ou homologação | backend + frontend |
| 3 | Política aprovada e `aprovar-privacidade --versao 2026-11-v1` (o script de abertura confere a versão) | Âmbar / jurídico + backend |
| 4 | Teste em iPhone e Android reais | equipe |
