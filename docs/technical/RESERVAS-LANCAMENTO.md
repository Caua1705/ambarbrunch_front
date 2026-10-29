# Reservas públicas — pronto para o lançamento

> Atualizado em 28/10/2026 (frontend `main`, sem push). Backend lido (só leitura) em `giardini_back`; produção da API
> conferida em 28/10: `GET /reservas/config` → 503 `reservas_indisponiveis` (`aceita_reservas=false`). Segundo a sessão
> do backend, `AMBAR_RESERVAS_ABERTURA=2026-11-03` em produção. **Decisão de 29/10/2026: a primeira data de visita é
> 09/11/2026** — o backend passa a `AMBAR_RESERVAS_ABERTURA=2026-11-09` e o site impõe a mesma data sozinho.

## Como o site funciona em produção

`PUBLIC_RESERVAS_MODO=api` e `PUBLIC_RESERVAS_API_URL=https://api.ambarbrunch.com` (variáveis de **build**, no projeto
da Vercel, ambiente Production). Com isso a comanda de `/` (#reservar) e de `/reservar/`:

- **API fechada** (503 `reservas_indisponiveis`): mostra "As reservas pelo site não estão abertas no momento" e o link do
  WhatsApp da equipe — sem calendário, sem horários, sem nada inventado. Quando a pessoa volta para a aba, confere de
  novo: **abrir as reservas no backend não exige novo build do site**.
- **API aberta**: ambientes, limites por reserva (= lotação: Jardim 20, Salão 30, Lounge 15, Privativa 20), janela de
  60 dias e dias fechados vêm de `/reservas/config`. Os dias antes de `AMBAR_RESERVAS_ABERTURA` chegam em
  `ambientes[].datasFechadas` e ficam riscados no calendário; os horários (07h–16h, de 30 em 30 min, 2 h de antecedência,
  lotação somando reservas sobrepostas, duração de 3 h) vêm de `/reservas/disponibilidade`. O site não recalcula
  nenhuma regra.
- **Envio**: o backend reconfere tudo. 409 `horario_esgotado` volta à escolha com o aviso e recarrega os horários;
  422 de data/hora (prazo, abertura) mostra a mensagem e recarrega; erro técnico ou sem conexão deixa "Tentar de novo"
  com a mesma `Idempotency-Key` (nada duplica); clique duplo não manda dois pedidos.
- **Fuso**: "hoje" do calendário é o de America/Fortaleza (vem da config), em qualquer fuso do navegador.
- **Privacidade**: com as reservas em modo API, `/privacidade/` mostra os tratamentos reais (dados pedidos, finalidades,
  operadores: Supabase em São Paulo, servidor da API, Meta WhatsApp Business Platform, Z-API, Vercel) com o aviso
  "Texto aguardando a aprovação do responsável pelo Âmbar Café". Decisões do controlador de 29/10/2026 já no texto:
  canal de privacidade = WhatsApp oficial (85) 95855-0369; nenhuma exclusão ou anonimização automática e nenhum prazo
  fixo (guarda descrita como o sistema funciona; eliminação a pedido, quando a lei exigir); sem parecer jurídico — o
  responsável aprova como representante da empresa, e o site não afirma validação jurídica. **Ainda não aprovada**
  (`aprovada: false`): quando ele aprovar, marcar `aprovada: true` em `src/data/privacidade.ts` e publicar. Notas de
  revisão ("Validar: …") aparecem só no build de revisão (`npm run build:revisao`). Análise:
  `docs/technical/PRIVACIDADE-REVISAO.md`. A `versao` publicada
  tem de ser a mesma registrada no backend (`app.cli aprovar-privacidade --unidade ambar_cafe --versao …`). Avisos ao
  grupo conforme a regra de 29/10/2026 do backend: reserva nova e agenda das 06h; **alteração e cancelamento não vão
  ao grupo** (na 1ª versão data, horário, ambiente e pessoas não mudam: `AMBAR_PAINEL_ALTERACAO=false`).

## A primeira data de visita (09/11/2026)

O cliente só escolhe datas de visita **a partir de 09/11/2026, inclusive** (decisão do responsável de 29/10/2026; a
anterior era 06/11). Pedidos podem ser feitos antes disso, desde que a data escolhida seja 09/11 ou depois. Duas
proteções independentes:

- **Backend** (`AMBAR_RESERVAS_ABERTURA=2026-11-09`): dias anteriores saem em `datasFechadas`, sem horários, e o
  `POST /reservas` recusa com 422 `antes_da_abertura` (“Reservas a partir de 09/11/2026.”).
- **Site** (`src/data/visita.ts`, `reservasDesde`): o calendário abre em novembro, 08/11 e antes ficam desabilitados
  mesmo que a API os ofereça, as setas do teclado não passam de 09/11, nenhum horário é pedido nem reserva enviada para
  data anterior. Trocar a data exige novo build.

Antes e depois de abrir:

```bash
node scripts/conferir-abertura-reservas.mjs          # só GETs na API de produção; não cria nada
# 0 = pronto: nenhuma data antes de 09/11 em nenhum ambiente, 08/11 sem horários e 09/11 com horários
# 1 = CONFIGURAÇÃO INCORRETA: alguma data antes de 09/11 aberta (aponta quais) ou 09/11 sem horários
# 2 = FECHADA: a API responde 503 reservas_indisponiveis (o site mostra o aviso)
# 3 = FALHA DE COMUNICAÇÃO: sem conexão, tempo esgotado (15 s), erro HTTP ou resposta que não é JSON
# opções: --api <url> (outra API, ex. homologação) e --abertura AAAA-MM-DD
```

Em 28/10 a produção devolve **2** (fechada). `tests-reservas/conferir-abertura.spec.ts` testa as quatro saídas contra
APIs locais mínimas.

## Vercel — o que conferir antes do deploy

Projeto `ambarbrunch-front` (framework Astro, `npm ci`, `npm run build`, Node 22.x, Production Branch `main`,
proteção de deployments `all_except_custom_domains`). O build com adaptador gera `.vercel/output`, que prevalece sobre
`outputDirectory: dist`.

**Ambiente Production — Reservas (obrigatório):**

| Variável | Valor | Quando vale |
| --- | --- | --- |
| `PUBLIC_REVISAO` | `0` | build (já existe) |
| `PUBLIC_RESERVAS_MODO` | `api` | build (já existe; valor criptografado — conferir que está `api`, hoje `indisponivel`) |
| `PUBLIC_RESERVAS_API_URL` | `https://api.ambarbrunch.com` | build (**não existe — criar**) |
| `PUBLIC_CLUBE_MODO` | ausente ou `indisponivel` | build (Clube fica fora; não definir `PUBLIC_CLUBE_HOME`) |

Variáveis `PUBLIC_*` são embutidas no HTML/JS no build: mudar o valor na Vercel **não muda o site no ar** até um novo
deploy. Com `PUBLIC_RESERVAS_MODO=api` e sem `PUBLIC_RESERVAS_API_URL`, o build cai em `indisponivel` (comanda
ilustrativa, nada coletado) e a privacidade volta ao texto antigo — ou seja, as reservas não entram no ar.
Conferência rápida depois do deploy: o HTML de `/reservar/` precisa conter `api.ambarbrunch.com`.

**Painel `/admin` — NÃO definir em Production agora.** Sem `PAINEL_ADMIN=1` o build é estático: não existe `/admin`
nem função de servidor (conferido: `/admin` e `/admin/login` dão 404 no preview). A liberação do painel é separada
(`docs/technical/PAINEL-ADMIN.md`) e exige: `PAINEL_ADMIN=1` (build), `PAINEL_MODO=api`,
`PAINEL_API_URL=https://api.ambarbrunch.com`, `PAINEL_MODULOS` e `PAINEL_API_CHAVE` (segredos lidos pela função em
tempo de execução — na Vercel também só valem a partir do próximo deploy), mais as contas da equipe criadas no backend.

**Preview privado do HEAD (sem push, sem produção):** `vercel deploy` com `-b PUBLIC_REVISAO=0 -b PUBLIC_RESERVAS_MODO=api
-b PUBLIC_RESERVAS_API_URL=https://api.ambarbrunch.com -b PUBLIC_CLUBE_MODO=indisponivel`. O de 28/10
(`ambarbrunch-front-4yks0omif-cauas-projects-3c9f6aea.vercel.app`, commit `cec125d`) confirmou: home sem Clube, menu
sem Clube, `/admin` 404, privacidade provisória com os operadores, `/reservar/` apontando para a API oficial. A comanda
ali mostra "Não foi possível carregar as reservas agora" porque a origem do preview não está no CORS da API — esperado;
em `ambarbrunch.com` a API responde 503 com CORS e o site mostra o aviso de reservas fechadas.

CORS conferido em 28/10: a API libera `https://ambarbrunch.com` e `https://ambarbrunch-front.vercel.app`;
`www.ambarbrunch.com` redireciona (308) para `ambarbrunch.com`.

## Para publicar (nesta ordem)

1. Backend: `AMBAR_RESERVAS_ABERTURA=2026-11-09` em produção (sessão do backend).
2. Vercel Production: conferir/criar as variáveis da tabela acima (sem `PAINEL_*`).
3. Com autorização do responsável: `git push origin main` → a Vercel faz o deploy de produção.
4. Conferir `https://ambarbrunch.com/reservar/` (aviso de reservas fechadas, link do WhatsApp), `/privacidade/`
   (tratamentos reais), home sem Clube, `/admin` 404.
5. Backend: abrir as reservas (`aceita_reservas=true`) — decisão do responsável, depois da privacidade validada.
6. `node scripts/conferir-abertura-reservas.mjs` → precisa sair **0**. Se sair 1, fechar as reservas no backend e
   corrigir a abertura antes de qualquer coisa. Conferir no celular que a primeira data é 09/11. Desde 29/10 o script
   também exige a mesma versão da política no backend (`privacidadeVersao`) e no site, e `aprovada: true` no site.

Os passos 2–4 antes do 1 também são seguros enquanto a API está fechada (o site só mostra o aviso). O passo 5 antes do
1 não abre 03–08/11 no site (ele bloqueia sozinho), mas o painel e outros caminhos do backend aceitariam essas datas.

## Painel da equipe (onde mora e o que falta)

- **Produção:** o painel de reservas da equipe é o do backend: `app/painel/` em `ambarbrunch_back`, servido em
  `https://api.ambarbrunch.com/painel/`. Commits locais de 29/10 no branch `producao-reservas` (sem push): `e803e1b`
  (edição só de contato e observações, ações por perfil, confirmação antes de cancelar, trava de clique duplo, erros
  sem falso sucesso, releitura a cada minuto, contraste AA) e `46670f8` (testes de interface em `tests/painel_ui`,
  `npm ci && npx playwright test`). Publicar = deploy do backend na VPS, que depende de autorização.
- **Duplicado:** `src/admin` deste repositório é um segundo painel (Astro/Preact, só com `PAINEL_ADMIN=1`, fora de
  produção). Ele segue a mesma regra de edição, mas manter os dois é trabalho dobrado: decidir qual fica.
- **Main do backend:** `main` tem outra versão de `app/painel/js/reservas.js` (com Atendimento). Se o painel do `main` for
  publicado, ele precisa receber as mudanças de `e803e1b`.

## Rollback

- **Site**: a produção atual é o deployment `dpl_5AhMWRKxEVYwrWgskHZdQDPhJoDS` (commit `85dc36e`, reservas
  `indisponivel`). Voltar para ele: Vercel → Deployments → esse deployment → **Instant Rollback** (ou
  `vercel rollback dpl_5AhMWRKxEVYwrWgskHZdQDPhJoDS`). Depois de um rollback a Vercel não promove sozinha os próximos
  deploys até alguém promover de novo. Alternativa sem painel: `git revert` dos commits e push (nunca force-push).
- **Só a comanda**: trocar `PUBLIC_RESERVAS_MODO` para `indisponivel` em Production e fazer redeploy.
- **Reservas em si**: fechar no backend (`aceita_reservas=false`) — vale na hora, sem mexer no site: a comanda passa a
  mostrar o aviso na próxima consulta.

## Testes

```bash
npm run build:reservas-api && npm run test:reservas-api   # API INTERCEPTADA (formato real do backend) — não é teste real
```

`tests-reservas/` cobre: calendário abrindo em novembro, 08/11 e anteriores bloqueados (também com a API mal
configurada, por clique forçado e pelo teclado), 09/11 primeira data com horários 07:00–16:00, 422 `antes_da_abertura`, ocupação
parcial, dia fechado por evento, limite de 60 dias, ambiente lotado, máximo por ambiente, confirmação (corpo e
Idempotency-Key), clique duplo, erro de API, sem conexão no envio, horário esgotado (409), data recusada (422), API
fechada e reaberta sem build, erro de configuração, fuso de Fortaleza, navegação a partir do botão da home, celular
375/390/430 px, política de privacidade (tratamentos reais, sem "não coleta dados", sem "aprovada"), consentimento
obrigatório, Clube oculto e as quatro saídas do script de conferência — em Chromium (celular e desktop) e WebKit
(celular).

### Ponta a ponta com a API real (quando a homologação estiver no ar)

Sem mocks: site → API real → config → disponibilidade → revisão (e, com autorização, reserva → resposta).

```bash
# build apontando para a API de homologação (exemplo com a local da sessão do backend)
PUBLIC_REVISAO=0 PUBLIC_RESERVAS_MODO=api PUBLIC_RESERVAS_API_URL=http://127.0.0.1:8090/ npx astro build --outDir dist-reservas-real
# só leitura: nada antes de 09/11 na config real e o site mostra exatamente os horários da API
RESERVAS_API_REAL=http://127.0.0.1:8090 npx playwright test -c playwright.reservas-real.config.ts
# cria UMA reserva de teste ("TESTE E2E — pode apagar") e confere o código devolvido; recusado em api.ambarbrunch.com
RESERVAS_API_REAL=http://127.0.0.1:8090 RESERVAS_CRIAR=1 RESERVAS_TELEFONE=<telefone de teste> npx playwright test -c playwright.reservas-real.config.ts
```

Se a API real estiver fechada (503), o teste é pulado e diz isso. Em produção, só leitura: **nunca** criar reserva de
teste. Pendente em 28/10: a homologação (`127.0.0.1:8090`) não pôde ser ligada por falta de memória na máquina, então a
integração real ainda **não foi testada** — tudo acima foi com a API interceptada.
