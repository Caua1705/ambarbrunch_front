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
Home → convite curto (#clube) → sem API: “Conheça o Clube” → /clube/ · com API: “Quero fazer parte” → /clube/#cadastro
/clube/:  página curta — apresentação (título, frase, duas polaroides) e a comanda logo abaixo:
          sem API (pré-lançamento) ou com inscrições fechadas na API: bilhete “em breve”, SEM campos (nada é pedido);
          com API e inscrições abertas: a ficha. Fecha com o rodapé mínimo (Âmbar Café · Política de Privacidade · ©)
Ficha:    dados (nome, WhatsApp, aniversário opcional; aceite da privacidade + regulamento; novidades pelo WhatsApp
          opcional e separado) → código no WhatsApp → bem-vindo → carteira
Carteira: /clube/membro/ → [sessão?] carteira : celular → código → carteira (saldo · histórico · recompensas · novidades · sair)
Mesa:     plaquinha NFC/QR → /clube/?canal=nfc|qr&mesa=ID  (só abre a página e marca a origem do cadastro)
Reserva:  confirmação → convite OPCIONAL (já existente) → url devolvida pela API de reservas, ex.: /clube/?canal=reserva
```

Estados tratados — ficha: fechada = bilhete “em breve” sem campos (sem API, inscrições fechadas ou sem regulamento) · carregando regras · aberta · erro de campo ·
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
{ "nome": "…", "telefone": "85999990000", "aniversario": "12-25 (opcional, MM-DD; só vai se preenchido)",
  "aceiteRegulamento": true, "regulamentoVersao": "2026-11",
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
9. **(2026-10-23) Aniversário:** a ficha pede, opcionalmente, dia e mês e envia `aniversario: "MM-DD"` em
   `POST /clube/adesoes` só quando preenchido. A API precisa aceitar (ou ignorar) esse campo; com `extra = "forbid"` no
   modelo Pydantic, o cadastro com aniversário falharia em 422. Onde ele fica e se poderá ser alterado na carteira.
10. **(2026-10-23) Novidades pelo WhatsApp:** a ficha agora diz “novidades e ofertas do Âmbar pelo WhatsApp” (pedido do
    Âmbar), em vez de montar o texto com `config.marketing.canais`. Se a API passar a oferecer outro canal, o texto da
    ficha precisa mudar junto.
11. **(2026-10-23) WhatsApp do membro:** o campo `telefone` passou a ser rotulado “WhatsApp” e a ficha só aceita celular
    (DDD + 9 + 8 dígitos). O código de confirmação deveria ir por WhatsApp (`canal: "whatsapp"`).

## 5. O que falta para o Clube real

| # | Passo | Quem |
| --- | --- | --- |
| 1 | Decidir a fidelidade (testes Eyemobile) e publicar o regulamento | Âmbar |
| 2 | Validar este contrato (ou receber o real) e ajustar `clube-contrato.ts`/`clube-http.ts` | backend + frontend |
| 3 | URL de staging + CORS com credenciais + cookie de sessão | backend |
| 4 | Preencher `data/clube.ts` (pontuação, recompensas, regulamento, `mesas.ativas`) e a política de privacidade | Âmbar + frontend |
| 5 | Build com `PUBLIC_CLUBE_MODO=api` + `PUBLIC_CLUBE_API_URL` (staging) e testes e2e contra o staging | frontend |
| 6 | Gravar as plaquinhas NFC e imprimir os QR Codes com as URLs da §3 | Âmbar |

## 6. Acesso unificado (2026-10-23) — contrato FINAL do backend

O cadastro e o acesso em `/clube` seguem o contrato final do backend: `giardini_back`,
`docs/auditoria-ambar/arquitetura/CLUBE.md` §4 e §9 (commits `e410da2` — sessão em cookie — e `ebc8b5d` — convite do
caixa, "porta A"; locais). Código:
[`src/lib/api/clube-acesso.ts`](../../src/lib/api/clube-acesso.ts) (tipos e cliente) e
[`src/islands/ClubeCadastro.tsx`](../../src/islands/ClubeCadastro.tsx) (interface). As seções 1–5 acima descrevem a
carteira antiga (`/clube/membro`), que **não existe** neste backend: a carteira real é `GET /clube/me`.

```text
C · abrir    → GET /clube/me (cookie) → 200 {situacao, membro, cadastro} sem pedir código · 401 → formulário do WhatsApp
B · WhatsApp → POST /clube/acesso {telefone} → 202 (sempre igual, com ou sem cadastro)
    código   → POST /clube/acesso/verificar → 200 {situacao, membro|null, cadastro|null, sessao:{expiraEm}} + Set-Cookie
    cadastro → POST /clube/adesoes (cookie; telefone vem da sessão; envio parcial) → {situacao, membro, cadastro}
    sair     → POST /clube/sair → 204 (o backend apaga o cookie)
A · /clube/ativar?c=<token> → (nada ao abrir) → toque “Ativar meu Clube” → POST /clube/convites/ativar {convite}
      → 200 ativacao (+ cookie de ativação, 30 min) · 200 entrar (já é membro, sem cookie) · 410 link_expirado
    cadastro → POST /clube/adesoes → ativacao (falta algo) · ativado (concluído; cookie de ativação apagado)
```

- **Sessão:** cookie HttpOnly `__Secure-ambar_clube` (SameSite=Strict, 30 dias, cai após 7 sem uso). O site não vê nem
  guarda token: todo `fetch` ao Clube vai com `credentials: "include"`, e toda chamada que muda algo leva
  `X-Ambar-Csrf: 1` (sem ele, 403 `origem_invalida`). Ao abrir a página, `GET /clube/me` restaura a situação; 401 em
  qualquer ponto volta ao formulário do WhatsApp. “Não é você? Sair” (cadastro e membro) chama `POST /clube/sair`.
- **Domínio:** o cookie só funciona com site e API no mesmo site — `https://ambarbrunch.com` → `https://api.ambarbrunch.com`
  (ou `localhost` → `localhost:8000` em desenvolvimento, com a origem em `AMBAR_CLUBE_ORIGENS` do backend). Em
  `ambarbrunch-front.vercel.app` o Clube **não** funciona: o `GET /clube/me` dá 401 e o código não abre sessão.
- **Corpo do cadastro:** só `nome`, `aniversario` ("MM-DD"), `aceiteRegulamento` + `regulamentoVersao` +
  `privacidadeVersao`, `marketing {autorizado, textoVersao}` — campo desconhecido é 422 (`extra=forbid`). **Sem
  `origem`**: o backend a ignora (sabe pelo desafio se veio do link) e só aceitaria texto. Nome é obrigatório no 1º envio.
- **Abertura:** `inscricoesAbertas` e as duas versões (regulamento e privacidade) presentes; senão, bilhete "em breve".
  Links do aceite: `privacidade.url` e `regulamento.url` do `config` quando vierem (sem URL, o regulamento fica em texto).
- **Erros:** campo (422) no formato do FastAPI — `detail: [{loc:["body","<campo>"], msg}]`, sem `campos`; regra ou
  estado — `detail` em português, mostrado ao cliente. 409 `versao_desatualizada` → pede o aceite de novo; 410 código
  vencido/usado; 429 (`reenvio_cedo`, `limite_excedido`, 5ª tentativa); 401 → volta ao WhatsApp; 503 Clube fechado. A
  API não diferencia "número sem WhatsApp" (envio em fila): a tela do código traz a dica de conferir ou trocar o número.
- **Convite do caixa (A):** a página `/clube/ativar` (mesmo visual do `/clube`, `sections/ClubePagina.astro`) lê o `c`
  no `<head>`, guarda-o só em memória e o tira da URL na hora (`history.replaceState`); `referrer: no-referrer`; `noindex`.
  Nada é chamado com o token ao abrir (GET em `/clube/convites/ativar` é 405): só o toque em "Ativar meu Clube". Na
  sessão de ativação o backend nunca mostra dados já gravados (nome e aniversário vêm null): o formulário pede só o que
  falta; aniversário e novidades só para quem ainda não tem cadastro. Já membro (`entrar`) → login por código, sem acesso
  pelo link. Concluído (`ativado`) → "Cadastro concluído! Você vai receber a confirmação no WhatsApp." e "Entrar no
  Clube" ("Ver meus pontos" quando `programaAtivo`). Link vencido, usado, substituído ou recarregado sem o token →
  entrada pelo WhatsApp na mesma comanda.
- **Membro ativo:** só a confirmação; sem pontos (`programa.saldo` é null com o programa desligado) e sem link de carteira.
- **Modos:** `indisponivel` (bilhete "em breve", sem campos) · `api` · `simulado` — só no `astro dev`
  (`.env.development`, ligado no `npm run dev`/`dev:clube`; `src/lib/api/clube-simulado.ts`: finais 0001 = membro,
  0002 = incompleto, código 123456; convites `/clube/ativar?c=demo-novo` · `demo-incompleto` · `demo-ativo` ·
  `demo-vencido`). Nenhum build carrega a simulação.
- **Testes:** `tests/e2e/clube-acesso.spec.ts`, no build só de testes (`dist-sim`), com a API interceptada imitando o
  contrato final (cookie e anti-CSRF, 401 com `Authorization`, 422 de campo desconhecido, restauração ao recarregar, sair,
  sessão vencida no meio do cadastro; convite novo, incompleto, de membro, vencido, usado, recarregado, sessão de
  ativação vencida, e o token fora da URL e de qualquer requisição antes do toque).

Pendências: (1) carteira — trocar `/clube/membro` (contrato antigo, cookie) por `GET /clube/me`, `PUT /clube/me/marketing`,
`DELETE /clube/me/mensagens` e `POST /clube/sair`, quando o programa existir (`membro.programa` e `saldo` já chegam
pelo `GET /clube/me`); (2) templates na Meta (`ambar_clube_codigo_acesso`, `ambar_clube_ativar_cadastro` com a URL
`https://ambarbrunch.com/clube/ativar?c={{1}}`, `ambar_clube_cadastro_concluido`) — com o dono; (3) atribuição por mesa (NFC/QR) e UTM não chega mais ao backend — se
for preciso medir isso, combinar um campo com o backend; (4) configurar `AMBAR_CLUBE_REGULAMENTO_URL` e
`_PRIVACIDADE_URL` (https) no backend.
