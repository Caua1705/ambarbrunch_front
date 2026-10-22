# Contrato da API do Clube Âmbar — PROPOSTA (não validada)

> **Situação (2026-10-20):** proposta do frontend para a FastAPI do Âmbar, **ainda não validada**. O funcionamento da
> fidelidade será decidido depois dos testes com a Eyemobile. Por padrão o site roda em modo **indisponível**: a ficha de
> inscrição e a carteira aparecem, mas com os campos desligados, dizem que ainda não estão ativas e **não enviam nada**.
> **Não existe modo simulado**: o site nunca finge cadastro, adesão ou saldo.
> Código: [`src/lib/api/clube-contrato.ts`](../../src/lib/api/clube-contrato.ts) (tipos) ·
> [`clube-http.ts`](../../src/lib/api/clube-http.ts) (cliente) · [`src/lib/clube-origem.ts`](../../src/lib/clube-origem.ts)
> (atribuição) · [`src/islands/ClubeCadastro.tsx`](../../src/islands/ClubeCadastro.tsx) e
> [`ClubeMembro.tsx`](../../src/islands/ClubeMembro.tsx) (interface).

## 0. Regras que o contrato preserva

- O Clube funciona no navegador: **sem aplicativo**.
- A adesão é **voluntária e independente da reserva** (reservar não inscreve; o Clube não é exigido para reservar).
- Pontos vêm **só de compras identificadas** — nunca de presença nem de aproximar o celular do NFC da mesa.
- O consentimento de **marketing é separado** da adesão: opcional, desmarcado por padrão, alterável na carteira.
- **Nada de pontuação no navegador**: saldo, histórico e recompensas vêm da API. O site não soma, não estima, não guarda.
- **Sem dado pessoal no navegador**: nada em `localStorage`; a sessão é um cookie `httpOnly` do backend. A única coisa
  guardada (em `sessionStorage`) é a **origem** da visita (canal/mesa/UTM), que não é dado pessoal.

## 1. Telas e fluxos

```text
Home → convite curto (#clube) → /clube/  (conceito · como funciona · direto da mesa · regras · ficha)
Ficha:    dados (nome, celular, aceite do regulamento, novidades opcional) → código no telefone → bem-vindo → carteira
Carteira: /clube/membro/ → [sessão?] carteira : celular → código → carteira (saldo · histórico · recompensas · novidades · sair)
Mesa:     plaquinha NFC/QR → /clube/?canal=nfc|qr&mesa=ID  (só abre a página e marca a origem do cadastro)
Reserva:  confirmação → convite OPCIONAL (já existente) → url devolvida pela API de reservas, ex.: /clube/?canal=reserva
```

Estados tratados — ficha: fechada (sem API ou sem regulamento) · carregando regras · aberta · erro de campo ·
telefone já no Clube (link para a carteira) · enviando · código · código incorreto/vencido · reenvio com contagem ·
trocar número · bem-vindo (só com resposta da API) · falha com nova tentativa.
Carteira: acesso desligado + prévia sem dados · conferindo sessão · entrar · enviando · código · falha ao abrir ·
carteira (histórico e recompensas carregando, vazios, com erro ou com itens; “ver mais” paginado) · saldo em atualização
(`saldo: null`) · novidades ligar/desligar (otimista, volta se falhar) · sair · sessão vencida (volta ao acesso).
Página interna com todos os estados lado a lado: **`/clube/estados/`** (só no build de revisão).

## 2. Endpoints propostos

Base: `PUBLIC_CLUBE_API_URL`. Todas as chamadas com `credentials: 'include'` (CORS com `Allow-Credentials` para o domínio
do site). Erros no mesmo formato da API de reservas (`detail` do FastAPI ou `{ mensagem, campos }`).

| Método e rota | Uso | Resposta |
| --- | --- | --- |
| `GET /clube/config` | inscrições abertas? regulamento vigente, canais de novidades, tamanho do código | `{ inscricoesAbertas, regulamento: { versao, url } \| null, privacidadeVersao?, marketing: { canais: ["whatsapp"\|"email"] }, codigo: { digitos } }` |
| `POST /clube/adesoes` + `Idempotency-Key` | pedir adesão; envia código ao telefone | `202 { desafioId, canal: "whatsapp"\|"sms", destino (mascarado), reenvioEm (s) }` |
| `POST /clube/acesso` `{ telefone }` | entrar na carteira (sem senha) | `202` desafio, igual acima |
| `POST /clube/acesso/verificar` `{ desafioId, codigo }` | confirmar o código (adesão ou acesso) | `200 Membro` + cookie de sessão `httpOnly; Secure; SameSite` |
| `GET /clube/membro` | sessão atual | `200 Membro` · `401` sem sessão |
| `GET /clube/membro/extrato?cursor=` | histórico paginado | `{ itens: [{ id, data, tipo: credito\|resgate\|ajuste\|expiracao, descricao, pontos (com sinal) }], proximo }` |
| `GET /clube/recompensas` | recompensas vigentes | `{ publicadas, itens: [{ id, nome, descricao?, pontos, disponivel }] }` |
| `PUT /clube/membro/marketing` `{ autorizado }` | ligar/desligar novidades | `{ autorizado }` |
| `POST /clube/sair` | encerrar sessão | `204` |

`Membro = { nome, numero, desde (AAAA-MM-DD), saldo: { pontos, atualizadoEm } | null, marketing: { autorizado } }`.

Corpo de `POST /clube/adesoes`:

```json
{ "nome": "…", "telefone": "85999990000", "aceiteRegulamento": true, "regulamentoVersao": "2026-11",
  "marketing": { "autorizado": false },
  "origem": { "canal": "nfc", "mesa": "12", "campanha": "…(opcional)", "utm": { "source": "…", "medium": "…", "campaign": "…" } } }
```

Reenvio de código na ficha: o site repete o `POST /clube/adesoes` com uma nova `Idempotency-Key` (a adesão continua
pendente até o código ser confirmado). Na carteira: repete `POST /clube/acesso`.

Erros mapeados (o cliente já trata): `401` sessão · `409` telefone já no Clube · `410` código vencido · `422/400`
validação (inclusive código incorreto em `codigo`) · `423` inscrições fechadas · `429` muitas tentativas · `503`
indisponível · rede/tempo esgotado (12 s).

## 3. Atribuição (NFC, QR Code, campanhas)

| Entrada | URL gravada |
| --- | --- |
| Plaquinha NFC da mesa 12 | `https://<domínio>/clube/?canal=nfc&mesa=12` |
| QR Code da mesa 12 | `https://<domínio>/clube/?canal=qr&mesa=12` |
| Convite depois da reserva | `/clube/?canal=reserva` (campo `clube.url` da resposta de `POST /reservas`) |
| Campanhas | `&campanha=…` e/ou `utm_source`, `utm_medium`, `utm_campaign` |

Validação por lista fechada (`lib/clube-origem.ts`): `canal` ∈ nfc, qr, site, reserva, instagram, whatsapp; `mesa`
só com NFC/QR, até 8 caracteres `[A-Za-z0-9-]`; textos até 64 caracteres `[\w.-]`. Qualquer outra coisa é descartada.
Quem chega pela mesa vê “bem-vindo à mesa 12” e “inscrição pela mesa 12” na ficha — **nada é registrado nem pontuado
pela aproximação**; a origem só vai junto com o cadastro, se a pessoa se inscrever.

## 4. Perguntas para o backend e para o Âmbar

1. Como a compra é **identificada** no caixa (telefone? número de membro? CPF?) e como a Eyemobile envia as compras.
2. Regras: pontos por compra, validade, recompensas e custo em pontos, regulamento (versão + URL).
3. Verificação do telefone: canal (WhatsApp ou SMS), tamanho do código, validade, limite de tentativas e reenvios.
4. Sessão: duração, renovação, cookie em domínio próprio (`api.<domínio>`) para evitar bloqueio de cookie de terceiros.
5. `saldo: null` — em que situações (sincronização atrasada?) e com que frequência o saldo é atualizado.
6. Mesas: lista de IDs, onde ficam as plaquinhas e se haverá campanha por mesa.
7. Exclusão de conta e retirada de dados pelo próprio membro (LGPD) — rota e fluxo.
8. Texto do aceite (regulamento + privacidade) e da autorização de novidades — validação jurídica.

## 5. O que falta para o Clube real

| # | Passo | Quem |
| --- | --- | --- |
| 1 | Decidir a fidelidade (testes Eyemobile) e publicar o regulamento | Âmbar |
| 2 | Validar este contrato (ou receber o real) e ajustar `clube-contrato.ts`/`clube-http.ts` | backend + frontend |
| 3 | URL de staging + CORS com credenciais + cookie de sessão | backend |
| 4 | Preencher `data/clube.ts` (pontuação, recompensas, regulamento, `mesas.ativas`) e a política de privacidade | Âmbar + frontend |
| 5 | Build com `PUBLIC_CLUBE_MODO=api` + `PUBLIC_CLUBE_API_URL` (staging) e testes e2e contra o staging | frontend |
| 6 | Gravar as plaquinhas NFC e imprimir os QR Codes com as URLs da §3 | Âmbar |
