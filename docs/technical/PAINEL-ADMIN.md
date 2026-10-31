# Painel administrativo (`/admin`)

> Atualizado em 30/10/2026. Contratos conferidos no código do backend `giardini_back` (`app/modulos/**`, main
> `b17e496`/`d265d0f`) e no painel antigo `app/painel` (referência funcional, commit `fcdd8a1`). Produção conferida em
> 30/10: `GET /saude` → revisão `0017_julia_classificacao`, versão `7463dcd` — todas as rotas do painel no ar.

## 0. Arquitetura (decisão do responsável, 30/10/2026)

- **Frontend (este repositório, Vercel) = site público + TODO o painel administrativo em `/admin`.** Um painel só.
- **Backend (FastAPI) = só API, regras de negócio e integrações** (Eyemobile, Júlia/n8n, WhatsApp oficial, auditoria).
  O painel estático antigo do backend (`app/painel`, servido em `/painel/`) foi a referência funcional da migração e
  sai do backend depois da validação do `/admin` em produção, com redirecionamento temporário dos endereços antigos:

  | Endereço antigo (API) | Novo (site) |
  |---|---|
  | `/painel/` e `/painel/index.html` | `/admin/login` |
  | `/painel/reservas.html` | `/admin/reservas` |
  | `/painel/clientes.html` | `/admin/clientes` |
  | `/painel/atendimento.html` | `/admin/atendimento` |
  | `/painel/financeiro.html` | `/admin/financeiro` |
  | `/painel/estoque.html` | `/admin/estoque` |

- O navegador nunca fala com o Supabase nem com a API direto: só com `/admin/api/*` deste site, cujo servidor repassa
  ao backend com o token da sessão (cookie HttpOnly). Nenhuma chave no navegador; nenhuma regra de negócio no JS — as
  telas mostram o que a API calcula e o backend confere permissão em toda rota.

Módulos e abas (paridade com o painel antigo):

| Módulo | Abas / telas |
|---|---|
| Visão Geral | cartões do dia, atenção, radar, atividade |
| Reservas | Dia, Semana, Mês, Lista (Hoje/Amanhã/7 dias/Todas), Ambientes; detalhe com chegada, ausência, corrigir/desfazer, aviso comunicado, alterar contato/observações; Modo Operação (tablet) |
| Clientes (Gerente e Proprietário; acompanha a liberação de Reservas) | lista com busca, ficha com histórico, canais e consentimentos, edição (`clientes.editar`) |
| Atendimento | caixa, conversa, assumir/transferir, responder, devolver ao assistente, encerrar |
| Clube Âmbar | (ainda não lançado ao público; selo "em breve") |
| Financeiro | Resumo, Vendas (Eyemobile), Lançamentos (+ Banco/conciliação), Contas a pagar, Revisão (despesas e documentos da Júlia: corrigir leitura, pago × a pagar, vincular a conta/pagamento/despesa já lançados), Resultado (+ fechamento e participação — Proprietário), Contas fixas e taxas, Categorias (por unidade, do banco) |
| Estoque | Resumo, Compras, Insumos, Fichas técnicas, Contagem, Cancelamentos, Análises |

**Unidade de negócio.** Toda consulta vai com `?unidade=<codigo>` da unidade do topo — o servidor do painel grava o
cookie `ambar_painel_unidade` já no primeiro acesso, porque sem `unidade` o backend usa a unidade padrão DELE (na
produção, `AMBAR_OPERACAO_UNIDADE=ambar_teste`). A unidade de ensaio (código começa com `teste` ou termina em `_teste`,
mesma regra de `unidades/escopo.py`; na produção `ambar_teste`, "Âmbar · TESTES") aparece com a faixa **AMBIENTE DE
TESTE** fixa no topo de toda página; os números dela nunca entram nos do Âmbar Café (regra do backend).

## 1. Como está montado

- **Mesmo repositório e mesmo domínio do site.** O painel entra no build com `PAINEL_ADMIN=1` (`scripts/painel.mjs`)
  e, **na Vercel, por padrão** (preview e produção; `PAINEL_ADMIN=0` desliga). Sem ele, `npm run build` gera exatamente
  o site público de antes: estático, sem adaptador e sem nenhuma rota `/admin`. Com ele, o Astro usa o adaptador Node (local) ou o da Vercel (`VERCEL=1`); as
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
| `indisponivel` (padrão fora da Vercel) | A tela de login explica que o painel não está conectado; ninguém entra. |
| `api` (padrão na Vercel) | Login e dados reais em `PAINEL_API_URL` — ou, sem ela, na mesma API do site público do ambiente (`PUBLIC_RESERVAS_API_URL`, gravada no build). https obrigatório na Vercel. |
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

## 4. O que cada tela usa

Produção em 30/10/2026 (`0017_julia_classificacao`): **todas** as rotas abaixo no ar (401 sem sessão). Cada bloco
ainda cai sozinho no estado certo se uma rota faltar: **404 de rota** (`{"detail":"Not Found"}` sem `codigo`) vira
"Este recurso ainda não está no ar"; 403 vira "Sem acesso"; rede/tempo/5xx viram erro com "Tentar de novo". Nenhum
valor indisponível vira "R$ 0,00".

| Tela | Rotas do backend (`/admin/…`) |
|---|---|
| Login, sessão, unidades | `auth/login`, `auth/me`, `auth/sair`, `unidades` |
| Reservas | `reservas`, `reservas/operacao`, `reservas/lotacao`, `reservas/ambientes`, `reservas/{id}` (PATCH só contato e observações), `…/status`, `…/comparecimento` (PUT; cai para PATCH `…/status` só em 404 de rota), `…/aviso-comunicado`, `reservas/comparecimento/pendentes`, `reservas/mensagens`. Nova reserva: desligada no backend (403 `criacao_manual_desativada`, a tela explica). |
| Clientes | `clientes?busca&limite&deslocamento`, `clientes/{id}` (GET, PATCH) |
| Configurações | `reservas/configuracao/{unidade}`, `…/politica`, `reservas/ambientes/{id}`, `reservas/regras/{id}`, `usuarios` (equipe) |
| Atendimento | `atendimento/resumo`, `atendimento/conversas` (busca com 2+ letras), `…/{id}`, `…/mensagens`, `…/responder`, `…/assumir`, `…/devolver`, `…/encerrar`, `atendimento/falhas` |
| Visão Geral | `visao-geral`, `visao-geral/radar`, `financeiro/resumo`, `financeiro/relatorios/evolucao`, `estoque/compras`, `atendimento/resumo`, `reservas/operacao` |
| Financeiro | `financeiro/resumo`, `relatorios/vendas`, `lancamentos`, `despesas` (+ confirmar/cancelar), `outras-receitas` (+ cancelar), `contas-a-pagar`, `parcelas/{id}/pagamentos`, `pagamentos/{id}/estornar`, `revisao`, `revisao/documentos/{id}` (GET/PATCH) e `…/resolver`, `despesas/{id}/documentos`, `despesas/{id}/unidade`, `comprovantes/{id}/enviar-para-compras`, `relatorios/resultado`, `relatorios/despesas-por-categoria`, `fechamento/{mes}`, `apuracoes/{mes}` (+ conferir/fechar/reabrir, `participacao`), `recorrencias`, `taxas-pagamento`, `conciliacao/*`, `extratos/*`, `contas-bancarias`, `categorias` (GET/POST/PATCH, `PUT …/{codigo}/unidades/{unidade}`), `fornecedores`, `arquivos/{id}/url` |
| Estoque | `estoque/resumo`, `compras` (+ manual, confirmar, cancelar, reprocessar, itens), `insumos` (+ movimentos), `insumos-sugestoes` (um objeto), `perdas`, `fichas/{produto|preparo}/{id}`, `inventarios` (+ sugestão, itens, fechar, cancelar), `cancelamentos` (+ resolver), `analises/{cmv,produtos,cardapio,fornecedores,reposicao,ruptura}` |

## 5. Contrato: o que foi conferido e ainda vale saber

Conferido em 30/10 rota a rota contra o código do backend e o painel antigo (`fcdd8a1`). Corrigido nesta migração:
`insumos-sugestoes` é um objeto; 409 `inventario_aberto` → `dados.inventario_id`; 409 `nome_ja_existe` →
`dados.insumo_id`; `ficha.insumos_sem_custo` são ids; respostas de fechar/contar/cancelar inventário, reprocessar,
perda e compra manual com o formato real; envio de compra (multipart) leva `unidade` no formulário; na conciliação,
`conflito` e `classificacao_sugerida` são objetos e os vínculos usam `status`/`desfeita_em`/`desfeita_motivo` (o
"Desfazer" não aparecia); `OperacaoReserva.mensagens` é `{tipo: texto}`; `assumir` manda `{transferir}`; texto da
resposta no atendimento até 2000 caracteres.

Permissões: as telas novas conferem a lista `permissoes` que o `GET auth/me` devolve (a matriz de
`app/modulos/usuarios/permissoes.py`); `lib/permissoes.ts` é só o espelho para esconder o que o perfil não usa, e o
backend decide (403). `financeiro.configurar` e `financeiro.ver_societario` são só do Proprietário (o backend omite
retiradas para o Gerente).

Ainda sem rota no backend (as telas não inventam): auditoria geral/"atividade recente" (a Visão Geral monta com
reservas e compras); recuperação de senha (só CLI); `cliente_id` na reserva (não dá para abrir a ficha do cliente a
partir da reserva); `atendimento/conversas` sem `total` (até 100 por filtro). O painel não precisa de CORS: quem chama
a API é o servidor do painel.

## 5a. Financeiro: documentos da Júlia e categorias (backend 3f37bf1, migrações 0018 e 0019)

Implementado no painel conforme `HANDOFF-FRONT-REVISAO-CATEGORIAS.md` e o contrato §5.1–5.7 do backend. **Só publica
depois do backend 3f37bf1 com as migrações 0018 e 0019 e os workflows da Júlia atualizados**: no backend antigo as rotas
novas respondem 404/405 (a tela mostra "ainda não está no ar", não quebra).

- **Revisão:** a fila é normalizada em `lib/api/financeiro.ts` (lista ausente vira vazia; a despesa que vinha misturada
  em `candidatas` antes da 0018 vai para `despesas_candidatas` — era o que quebrava a lista). Cada documento mostra a
  categoria da Júlia (`categoria_codigo` + `classificacao.origem`/`opcoes`), já escolhida no seletor; "Corrigir leitura"
  (PATCH com versão e motivo; 409 recarrega; "Leitura original da IA" quando corrigido; mudar a unidade tira o documento
  da fila); "Marcar como paga" só para comprovante/recibo/ambíguo (`candidatas`); boleto → "Vincular a esta conta"
  (`contas_candidatas`); comprovante → "Vincular a este pagamento" (`pagamentos_candidatos`); nota → "Vincular a esta
  despesa" (`despesas_candidatas`). "Registrar como despesa" pede **Já está pago × É uma conta a pagar** (ambíguo exige;
  nota e boleto começam em "a pagar"), com data do pagamento e forma ou vencimento.
- **Despesa:** anexos de `despesas/{id}/documentos` (um por arquivo, com o papel) e "Mudar unidade" (409
  `despesa_de_compra`, `despesa_conciliada`, `apuracao_fechada` explicados); o histórico mostra o motivo.
- **Categorias (aba nova):** cadastro de `categorias?todas=true&incluir_inativas=true`; criar (código estável, grupo,
  descrição, apelidos que a Júlia reconhece, padrão, unidades), editar, ativar/desativar na unidade do topo e no
  cadastro; excluir não existe. **Nenhuma lista de categorias no código:** todo seletor usa `categorias?unidade=` (só as
  válidas) e os nomes de lançamentos antigos vêm do cadastro (`useNomeCategoria`).
- **Demonstração:** `servidor/demo/financeiro.ts` imita as rotas novas e tem as duas unidades (`ambar_cafe`,
  `ambar_teste`); testes em `tests-painel/financeiro-revisao.spec.ts` e `financeiro-categorias.spec.ts`.

## 5b. Modo Operação (tablet do café)

`/admin/operacao`: tela própria para o tablet fixo do salão — reservas de hoje e "Cliente chegou" com um toque, para
Proprietário, Gerente e Atendente, sobre as mesmas rotas reais de Reservas. Detalhes, perfis, sessão compartilhada,
testes e o que falta para Atendimento e Ponto: [`MODO-OPERACAO.md`](MODO-OPERACAO.md).

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

## 8. Produção e pendências (30/10/2026)

**Publicação:** push na `main` → deploy de Production da Vercel com o painel ligado (padrão na Vercel), modo `api`,
backend = `PUBLIC_RESERVAS_API_URL` do ambiente (`https://api.ambarbrunch.com`). Nenhuma variável nova é obrigatória.
Variáveis que, se postas no projeto, mandam por cima do padrão: `PAINEL_ADMIN=0` (tira o painel do build),
`PAINEL_MODO`, `PAINEL_API_URL`, `PAINEL_MODULOS` (ex.: esconder um módulo), `PAINEL_API_CHAVE` (ver item 3).

Conferido antes do push: o HTML das páginas públicas do build com o painel na Vercel é idêntico ao do build estático,
a não ser pelos nomes dos arquivos em `_astro/`; a suíte da reserva pública (`tests-reservas`, 141 testes) passa sobre
esse build; o pacote da Vercel não tem dados nem código de demonstração.

Pendências:
1. **Remover o painel antigo do backend** (`app/painel` e o `mount("/painel")` em `app/main.py`) só depois de validar
   o `/admin` em produção com login real — combinado com a sessão do backend; redirecionar `/painel/*` para as rotas
   da tabela da seção 0.
2. **Contas da equipe** são criadas pela CLI do backend (o painel não cria usuários nem recupera senha).
3. **Limite de login por IP:** sem `PAINEL_API_CHAVE` (= `AMBAR_PAINEL_CHAVE` do backend) na Production da Vercel, todo
   login chega ao backend com o IP da Vercel (o backend ignora X-Ambar-Cliente-IP/Navegador sem a chave) — 30 falhas em
   15 min por origem, somando a equipe, bloqueiam o login de todos (o limite de 10 por conta continua individual). O
   backend de produção já tem AMBAR_PAINEL_CHAVE; falta o responsável copiar o MESMO valor para PAINEL_API_CHAVE na
   Production da Vercel e refazer o deploy.
4. **Nova reserva pela equipe** continua desligada no backend (`AMBAR_PAINEL_CRIACAO_MANUAL`); a tela explica.
5. **Unidade padrão do backend** na produção é `ambar_teste` (`AMBAR_OPERACAO_UNIDADE`): o painel sempre manda
   `?unidade=`, mas qualquer outro cliente da API sem `unidade` cai nos dados de teste.
