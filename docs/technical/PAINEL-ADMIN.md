# Painel administrativo (`/admin`)

> Atualizado em 28/10/2026. Contratos do backend lidos (somente leitura) em `giardini_back`
> `docs/auditoria-ambar/arquitetura/CONTRATO-PAINEL-ADMIN.md` e `CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md` (commit
> `f7e782e`) e conferidos no código (`app/modulos/**`). Produção conferida em 28/10: `GET /saude` → revisão
> `0004_mensagens_reserva`.

## 1. Como está montado

- **Mesmo repositório e mesmo domínio do site**, mas o painel só entra no build com `PAINEL_ADMIN=1`
  (`scripts/painel.mjs`). Sem a variável, `npm run build` gera exatamente o site público de antes: estático, sem
  adaptador e sem nenhuma rota `/admin`. Com ela, o Astro usa o adaptador Node (local) ou o da Vercel (`VERCEL=1`); as
  páginas públicas continuam pré-geradas e só as do `/admin` rodam no servidor.
- Tudo do painel mora em `src/admin/` (nada em `src/pages/`): rotas em `rotas/`, injetadas por `integracao.mjs`;
  middleware próprio; estilos só carregados pelas páginas do painel (nada vaza para o site).

```
src/admin/
  integracao.mjs        injeta as rotas e o middleware (só com PAINEL_ADMIN=1)
  middleware.ts         sessão + papel a cada página, cabeçalhos de segurança, CSP com hash
  rotas/                páginas (.astro) e a ponte /admin/api/* (+ /admin/api/sessao)
  servidor/             config (astro:env), cookie de sessão, chamada ao backend, demo/ (dados fictícios)
  layout/               moldura (lateral, topo, tema sem piscar), página "sem acesso"
  lib/                  cliente HTTP, cache de consultas, permissões, formatação pt-BR, tipos por domínio
  ui/                   design system (Preact): base, camadas, tabela, entradas, gráficos, estados
  modulos/              visao-geral, reservas, atendimento, clube, financeiro, estoque, configuracoes, Login
  estilos/              tokens.css (claro/escuro) e painel.css
```

## 2. Autenticação e segurança

- Login **real do backend**: `POST /admin/auth/login {email, senha}` feito pelo **servidor do painel** (rota
  `/admin/api/sessao`). O token Bearer vira um cookie `ambar_painel` **HttpOnly, SameSite=Strict, Path=/admin,
  Secure em https**, com a validade do token (`expira_em`, 600 min por padrão). O navegador nunca vê o token (nem
  `localStorage`, nem JS) — isso resolve o risco apontado no contrato (§1, opção A) sem precisar de outro domínio.
- O navegador fala só com `/admin/api/<caminho>`; o servidor repassa a `<PAINEL_API_URL>/admin/<caminho>` com
  `Authorization: Bearer`. `auth/*` e `..` são recusados na ponte. A unidade escolhida no topo vai como `?unidade=`.
- Cada página do painel confere `GET /admin/auth/me` e `GET /admin/unidades` no servidor antes de sair HTML: papel,
  unidades e `ativo` vêm do backend a cada navegação (desativar alguém vale na hora). Sem sessão → `303 /admin/login`;
  na ponte → `401`. 401 do backend apaga o cookie e manda ao login lembrando a página.
- Requisição forjada: cookie `SameSite=Strict` + cabeçalho `X-Painel: 1` obrigatório (um site de fora não consegue
  mandá-lo sem permissão de CORS, que o painel não dá) + host do `Origin` igual ao `Host` da requisição em toda escrita.
- Cabeçalhos: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security` (em https, sem `includeSubDomains`), `Cross-Origin-Opener-Policy` e
  `Cross-Origin-Resource-Policy` e **CSP com o hash sha256 de cada script inline da resposta** (sem `unsafe-inline` em
  scripts).
- Login e limite de tentativas: o backend limita as falhas por IP e por e-mail (10 em 15 min). O login passa pelo
  servidor do painel, que repassa o IP de quem entrou em `X-Forwarded-For` (o endereço informado pelo provedor, não um
  cabeçalho do navegador). **Mas** a API de produção fica atrás de um Traefik que, no padrão, descarta `X-Forwarded-For`
  de quem não é confiável e grava o IP da conexão: na prática o backend tende a ver o IP da Vercel. Então o limite por
  IP vale para o painel inteiro (10 senhas erradas em 15 min, somando a equipe, bloqueiam o login de todos por até
  15 min; o limite por e-mail continua individual). Ver pendência 6 da seção 8.
- Perfis reais: `admin`, `gerente`, `operador` (não existe "sócio" no backend). `lib/permissoes.ts` espelha as regras
  só para esconder o que a pessoa não pode usar; quem decide é o backend (403). As páginas conferem papel e módulo
  liberado no servidor, antes de sair HTML.

### Sair do painel e o que isso NÃO faz

- "Sair" (menu do perfil e Configurações) chama `DELETE /admin/api/sessao`, que **apaga o cookie deste navegador**. A
  partir daí este navegador não tem mais acesso e a tela de login confirma: "Você saiu do painel neste navegador".
- **Dependência do backend:** o backend do Âmbar **não tem rota de logout nem de revogação de token**. O token apagado
  do navegador continua **válido no servidor até expirar** (`AMBAR_JWT_EXPIRA_MINUTOS`, 600 min por padrão). Na
  prática o risco é pequeno — o token nunca esteve acessível a scripts (cookie HttpOnly) — mas o logout do painel
  **não é revogação**. Revogar de verdade hoje só pela CLI do backend: `revogar-sessoes <e-mail>` (incrementa
  `token_versao`, e todo token anterior daquela pessoa deixa de valer na hora). Desativar o usuário também derruba o
  acesso na hora. Para logout com revogação, o backend precisaria de uma rota (ex.: `POST /admin/auth/sair` que
  incremente `token_versao` do próprio usuário); o painel já tem o ponto certo para chamá-la (`rotas/api/sessao.ts`).
- Se a chamada de saída falhar (sem conexão), o cookie fica; a tela de login detecta a sessão aberta e oferece
  "Encerrar sessão" de novo. Sair também limpa a contagem de estoque aberta guardada no navegador.
- Sem tempo de inatividade: a sessão vale até a expiração do token. Em computador compartilhado, a equipe deve sair ao
  terminar (Configurações diz isso).

## 3. Modos (`PAINEL_MODO`, lido em tempo de execução pelo servidor)

| Modo | O que faz |
|---|---|
| `indisponivel` (padrão) | A tela de login explica que o painel não está conectado; ninguém entra. |
| `api` | Login e dados reais em `PAINEL_API_URL` (https obrigatório na Vercel). |
| `demo` | Dados **fictícios** em memória (`src/admin/servidor/demo/`), faixa "DEMONSTRAÇÃO" em toda página, entrada por perfil sem senha. Só em build local. Num build da Vercel (preview ou produção) **o código e os dados de demonstração nem entram no pacote**: a integração troca os módulos da demo por um módulo vazio na compilação (conferido: nenhum texto da demo em `.vercel/output`), e o modo é recusado também em execução. |

`PAINEL_CLUBE_CONVITES=true` liga o envio de convites do Clube pelo WhatsApp (só no lançamento do Clube).

### Liberação controlada (`PAINEL_MODULOS`)

`PAINEL_MODULOS=visao-geral,reservas` (lista separada por vírgulas; vazia = todos) define os módulos **liberados neste
ambiente**. Os outros somem do menu, a página responde "Este módulo ainda não foi liberado" (no servidor) e a ponte da
API recusa as rotas deles com `403 modulo_nao_liberado` sem chamar o backend. A Visão Geral só consulta e mostra o que
está liberado (o bloco financeiro dela só aparece com `financeiro` liberado). Assim, quando o backend publicar o
Financeiro ou o Estoque, **nada abre para a equipe por consequência**: abrir é mudar esta variável. Sem a Visão Geral
liberada, `/admin` leva direto a Reservas. Configurações (conta, tema, regras de reserva) acompanha o módulo Reservas.

Variáveis do painel e quando são lidas:

| Variável | Quando | Valor no preview de 28/10 |
|---|---|---|
| `PAINEL_ADMIN=1` | **build** (liga a integração, o adaptador e as rotas) | `1` |
| `PAINEL_MODO` | **execução** (astro:env, segredo do servidor) | `api` |
| `PAINEL_API_URL` | **execução** | `https://api.ambarbrunch.com` |
| `PAINEL_MODULOS` | **execução** | `visao-geral,reservas` |
| `PAINEL_CLUBE_CONVITES` | **execução** | (vazia) |
| `PUBLIC_REVISAO`, `PUBLIC_RESERVAS_MODO`, `PUBLIC_CLUBE_MODO`, `PUBLIC_CLUBE_HOME` | **build** (site público) | `0`, `indisponivel`, `indisponivel`, (vazia) |

## 4. O que cada tela usa e o que já funciona com dados reais

Situação do backend publicado em 28/10/2026 (sem autenticação, só para ver se a rota existe: 401 = existe, 404 = não
publicada): `auth/*`, `unidades`, `reservas`, `reservas/operacao`, `reservas/lotacao`, `reservas/mensagens`,
`reservas/configuracao/*`, `clientes` → **no ar**. `reservas/{id}/comparecimento`, `reservas/comparecimento/pendentes`,
`reservas/{id}/aviso-comunicado`, `atendimento/*`, `clube/*`, `visao-geral*`, `financeiro/*`, `estoque/*`,
`arquivos/*` → **404 (só no código)**.

| Tela | Rotas | Com dados reais hoje? |
|---|---|---|
| Login, sessão, unidades | `auth/login`, `auth/me`, `unidades` | **Sim** |
| Reservas — dia, semana, detalhe, aprovar/recusar, cancelar, alterar, lotação, nova reserva | `reservas*` | **Sim.** Nova reserva: a rota existe mas está **desligada** no backend (`AMBAR_PAINEL_CRIACAO_MANUAL=false` → 403 `criacao_manual_desativada`); o painel mostra o aviso. |
| Reservas — chegou / não veio / corrigir / desfazer | `PUT reservas/{id}/comparecimento` (novo) | Parcial: produção ainda não tem a rota nova; o painel cai para `PATCH reservas/{id}/status` (rota antiga, no ar) para "Chegou"/"Não veio". Corrigir/desfazer com histórico depende da 0007. |
| Reservas — "Já avisei o cliente" | `reservas/{id}/aviso-comunicado` | Depende do backend novo (0004+código novo). |
| Configurações — regras de reserva, ambientes | `reservas/configuracao/{unidade}`, `…/politica`, `reservas/ambientes/{id}` | **Sim** (gerente e admin) |
| Visão Geral | `reservas/operacao` (no ar) + `visao-geral`, `financeiro/resumo`, `financeiro/relatorios/evolucao`, `estoque/compras`, `atendimento/resumo`, `reservas/comparecimento/pendentes` | Parcial: cartões de Reservas, "Hoje no salão", pendentes de aprovação e atividade de reservas funcionam; os blocos de faturamento, resultado, radar, contas e compras mostram "ainda não está no ar" até a 0010+. |
| Atendimento | `atendimento/*` | Depende da 0006 |
| Clube Âmbar | `clube/*` | Depende da 0008 (e do lançamento) |
| Financeiro | `financeiro/*`, `arquivos/*` | Depende da 0010–0017 |
| Estoque | `estoque/*` | Depende da 0011–0017 |

Cada bloco cai sozinho no estado certo: **404 de rota** (`{"detail":"Not Found"}` sem `codigo`) vira "Este recurso
ainda não está no ar"; 403 vira "Sem acesso"; rede/tempo/5xx viram erro com "Tentar de novo". Nenhum valor
indisponível vira "R$ 0,00".

## 5. Diferenças e dúvidas de contrato (registradas aqui, sem mexer no backend)

1. Produção roda um código de Reservas anterior à 0007: as respostas podem não ter `status_reserva`/`comparecimento`.
   O painel usa `status_reserva ?? status` e trata `comparecimento` ausente como "não registrado".
2. Não há rota de auditoria geral nem de "atividade recente": a Visão Geral monta a atividade com as reservas criadas e
   as compras recebidas.
3. Gestão de usuários, logout com revogação e recuperação de senha não têm rota (só CLI) — a tela de Configurações
   explica.
4. `atendimento/conversas` devolve lista sem `total`; a caixa mostra até 100 conversas por filtro.
5. O contrato recomenda subdomínio próprio para o painel por causa do token no `localStorage`. Com o token em cookie
   HttpOnly do servidor do painel, o mesmo domínio fica seguro; o subdomínio continua possível sem mudar o código
   (basta publicar o mesmo build em outro host).
6. Para o modo `api` em produção, o backend **não** precisa liberar CORS para o site: quem chama a API é o servidor do
   painel (servidor→servidor).

### Financeiro e Estoque × backend `f5b3b55` (conferido em 28/10/2026, só leitura)

Todas as rotas que as telas de Financeiro, Estoque e os blocos da Visão Geral chamam existem no código do backend
(`app/modulos/financeiro/*`, `app/modulos/estoque/*`, `app/visao_geral.py`, `app/radar.py`, `app/julia/api.py`), com
campos em snake_case, dinheiro em string decimal e datas `AAAA-MM-DD` dos dois lados. Em produção (`80af395`, revisão
0004) elas dão **404**: dependem das migrações 0005–0017 (head `0017_julia_classificacao`) e da imagem nova. Liberar
depois = incluir `financeiro` e/ou `estoque` em `PAINEL_MODULOS` e refazer o deploy (sem mudar código), **depois** de
testar com dados reais.

Divergências do lado do painel (Estoque), a corrigir antes de liberar o módulo:

| # | Onde | Backend devolve | Painel espera | Efeito |
|---|---|---|---|---|
| 1 | `GET estoque/insumos-sugestoes` | **um objeto** `{insumo_id, insumo, unidade_base, confianca, motivo, fator, alertas}` (`estoque/api_compras.py:356`) | lista `SugestaoInsumo[]` e faz `.map` (`lib/api/estoque.ts:19`, `modulos/estoque/ItemConferencia.tsx:56`) | **quebra** a busca de insumo na conferência de compras (a demo devolve lista, por isso os testes passam) |
| 2 | 409 `inventario_aberto` | `dados.inventario_id` (`estoque/operacoes.py:187`) | `dados.id` (`modulos/estoque/Contagem.tsx:64`) | não reabre a contagem já aberta; só mostra o erro |
| 3 | 409 `nome_ja_existe` | `dados.insumo_id` (`estoque/insumos.py:81`) | `dados.id` (`modulos/estoque/Insumos.tsx:347`) | o botão "Abrir o insumo existente" não aparece |

Menores (sem efeito hoje): para Gerente o backend omite `fora_do_resultado.retirada` (sigilo) e a tela mostra "—";
`financeiro.configurar` é só do Proprietário no backend e o painel não usa essa ação; no envio de compra (multipart)
o backend lê `unidade` do formulário, não da query que a ponte injeta (só importa com mais de uma unidade). Não
conferidos campo a campo: `ResumoEstoque`, `ConciliacaoMes`, `Apuracao`, `CompraDetalhe`, `Fechamento`.

## 6. Rodar, testar

```bash
npm run painel:demo            # astro dev em http://127.0.0.1:4480/admin (dados fictícios)
PAINEL_MODO=api PAINEL_API_URL=https://… npm run painel:dev   # contra um backend (homologação)
npm run painel:build           # build com o painel em dist-painel/ (adaptador Node)
npm run painel:serve           # serve dist-painel/ (defina PAINEL_MODO/PAINEL_API_URL no ambiente)
npx playwright test -c playwright.painel.config.ts   # testes do painel (sobe 3 servidores do build + backend falso)
```

No Windows, `PAINEL_MODO=…` antes do comando funciona no Git Bash; no PowerShell use `$env:PAINEL_MODO='api'`.

## 7. Preview privado (como foi feito em 28/10/2026)

Sem push e sem tocar nas variáveis do projeto: uma cópia exata do commit (`git archive HEAD`) enviada pela CLI, com as
variáveis só daquele deploy. O projeto tem Vercel Authentication em todos os deploys exceto domínios próprios
(`ssoProtection: all_except_custom_domains`), então o preview só abre para quem entra na conta da Vercel do time.

```bash
git archive HEAD | tar -x -C <pasta-temporária> && cd <pasta-temporária>
vercel link --yes --project ambarbrunch-front --scope cauas-projects-3c9f6aea   # apague o .env.local que ele cria
vercel deploy --yes --scope cauas-projects-3c9f6aea --target preview \
  -b PAINEL_ADMIN=1 -b PUBLIC_REVISAO=0 -b PUBLIC_RESERVAS_MODO=indisponivel -b PUBLIC_CLUBE_MODO=indisponivel \
  -e PAINEL_MODO=api -e PAINEL_API_URL=https://api.ambarbrunch.com -e PAINEL_MODULOS=visao-geral,reservas
```

Observações:
- `-b` vale no build, `-e` em execução (é onde o astro:env lê `PAINEL_MODO`, `PAINEL_API_URL` e `PAINEL_MODULOS`).
- Com o adaptador da Vercel o build sai em `.vercel/output` (Build Output API), que a Vercel usa no lugar de
  `outputDirectory: dist` das configurações do projeto. As páginas públicas saem com o mesmo HTML do build estático; o
  redirecionamento `/clube/membro` vira uma rota 301 da Vercel em vez de página.
- Não use `vercel curl` para conferir um deploy protegido: ele pode criar um segredo de "bypass" permanente no projeto.
  Confira pelo navegador com a conta da Vercel.

## 8. Antes de liberar o acesso real em produção (pendências)

1. **Contas da equipe** (nenhuma existe ainda em 28/10): criar pela CLI do backend, no servidor da API — a senha é
   pedida no terminal, sem eco (`giardini_back/ops/DEPLOY.md`). O painel não cria usuários.

   ```bash
   docker exec -it ambar-api python -m app.cli listar-usuarios        # conferir antes (sem senha)
   docker exec -it ambar-api python -m app.cli criar-usuario --nome "<seu nome>" --email <e-mail> --papel admin
   docker exec -it ambar-api python -m app.cli criar-usuario --nome "<gerente>" --email <e-mail> --papel gerente --unidade ambar_cafe
   docker exec -it ambar-api python -m app.cli criar-usuario --nome "<recepção>" --email <e-mail> --papel operador --unidade ambar_cafe
   ```

   Gerente e operador só enxergam as unidades atribuídas: confira antes que a unidade `ambar_cafe` existe (o
   seletor do painel mostra as unidades que `GET /admin/unidades` devolve). **Não** rode `abrir-reservas` nem outros
   comandos da lista: eles mudam o site público.
2. **Verificar no preview, com essas contas:** login de admin, gerente e operador; Reservas do dia; aprovar/recusar;
   o que cada papel vê (o operador não vê regras de reserva em Configurações).
3. **Variáveis no projeto da Vercel (Production):** `PAINEL_ADMIN=1` (build), `PAINEL_MODO=api`,
   `PAINEL_API_URL=https://api.ambarbrunch.com` e `PAINEL_MODULOS=visao-geral,reservas` (execução). Manter
   `PUBLIC_RESERVAS_MODO=indisponivel` e o Clube como está enquanto não houver decisão contrária.
4. **Push para `main`** (dispara o deploy de produção) — só com autorização. Depois, conferir que `/` e `/reservar/`
   continuam iguais e que `/admin` pede login no domínio de produção.
5. **Decisões do backend (sem mudança no frontend):** criação manual de reservas pelo painel
   (`AMBAR_PAINEL_CRIACAO_MANUAL`, hoje desligada); a rota nova de comparecimento (0007) para corrigir/desfazer com
   histórico; e, se quiserem logout que revogue o token, uma rota como `POST /admin/auth/sair`.
6. **Limite de login por IP com o painel no servidor (backend):** todo login do painel chega ao backend pelo IP da
   Vercel (o Traefik da API descarta o `X-Forwarded-For` que o painel manda). Somando a equipe, 10 senhas erradas em
   15 min bloqueiam o login de todos por até 15 min. Opções do lado do backend: aceitar o IP do usuário só do servidor
   do painel (cabeçalho assinado com um segredo compartilhado) ou aplicar ao painel só o limite por e-mail. Também
   vale lembrar: o Traefik limita a 20 req/s por IP de origem (rajada 40), e o tráfego do painel sai de poucos IPs da
   Vercel — folgado para uma equipe pequena, mas é um limite compartilhado.
7. Liberar outros módulos depois: publicar o backend do módulo (migrações da ordem do `IMPLANTACAO-*.md`) e então
   incluir o nome em `PAINEL_MODULOS`.
