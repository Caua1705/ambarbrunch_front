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
- Requisição forjada: cookie `SameSite=Strict` + cabeçalho `X-Painel: 1` obrigatório + `Origin` igual ao do site
  em toda escrita.
- Cabeçalhos: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy` e **CSP com o hash sha256 de cada script inline da resposta** (sem `unsafe-inline` em scripts).
- Sair apaga o cookie. **Limite do backend:** não há rota de logout/revogação; o token continua válido até expirar
  (revogação só pela CLI `revogar-sessoes`). Recuperação de senha também não existe: a tela de login diz para falar
  com o administrador.
- Perfis reais: `admin`, `gerente`, `operador` (não existe "sócio" no backend). `lib/permissoes.ts` espelha as regras
  só para esconder o que a pessoa não pode usar; quem decide é o backend (403).

## 3. Modos (`PAINEL_MODO`, lido em tempo de execução pelo servidor)

| Modo | O que faz |
|---|---|
| `indisponivel` (padrão) | A tela de login explica que o painel não está conectado; ninguém entra. |
| `api` | Login e dados reais em `PAINEL_API_URL` (https obrigatório na Vercel). |
| `demo` | Dados **fictícios** em memória (`src/admin/servidor/demo/`), faixa "DEMONSTRAÇÃO" em toda página, entrada por perfil sem senha. **Recusado na Vercel** (em preview e produção) e no build de produção. Nada sai para o backend. |

`PAINEL_CLUBE_CONVITES=true` liga o envio de convites do Clube pelo WhatsApp (só no lançamento do Clube).

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

## 6. Rodar, testar

```bash
npm run painel:demo            # astro dev em http://127.0.0.1:4480/admin (dados fictícios)
PAINEL_MODO=api PAINEL_API_URL=https://… npm run painel:dev   # contra um backend (homologação)
npm run painel:build           # build com o painel em dist-painel/ (adaptador Node)
npm run painel:serve           # serve dist-painel/ (defina PAINEL_MODO/PAINEL_API_URL no ambiente)
npx playwright test -c playwright.painel.config.ts   # testes do painel (sobe 3 servidores do build + backend falso)
```

No Windows, `PAINEL_MODO=…` antes do comando funciona no Git Bash; no PowerShell use `$env:PAINEL_MODO='api'`.

## 7. Antes de liberar o acesso real em produção

1. Decidir publicar o painel: configurar na Vercel `PAINEL_ADMIN=1` (build), `PAINEL_MODO=api` e
   `PAINEL_API_URL=https://api.ambarbrunch.com` (ambiente). Sem isso, nada muda no site.
2. Fazer um deploy de **preview** primeiro e conferir que o site público continua idêntico (as páginas são as mesmas,
   agora servidas pelo adaptador da Vercel) e que `/admin` pede login.
3. Criar os usuários reais da equipe pela CLI do backend (papéis corretos e unidades atribuídas) e testar cada perfil.
4. Aplicar no backend as migrações e o código dos módulos que se quer ligar (0005–0017), na ordem do
   `IMPLANTACAO-*.md` do backend — cada tela passa a funcionar sozinha quando a rota existir.
5. Decidir sobre a criação manual de reservas (`AMBAR_PAINEL_CRIACAO_MANUAL`).
6. Conferir que o backend em produção mantém o limite de tentativas de login e tokens de 600 min.
