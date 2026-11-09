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
  | `/painel/clientes.html` | `/admin/clientes` (desde 02/11/2026 redireciona com 303 para `/admin/atendimento`) |
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
| Reservas | Período (Dia, Semana, Mês) e visualização (Calendário, Por ambiente); detalhe com chegada, ausência, corrigir/desfazer, aviso comunicado, alterar contato/observações; Modo Operação (tablet) |
| Atendimento | caixa (Todas · Esperando · Assistente · Equipe · Encerradas), conversa com linha do tempo única (mídia, campanhas, templates de reserva/Clube, respostas automáticas), assistente ligado/desligado por conversa, assumir/transferir, responder, encerrar, follow-up; ficha do contato (gaveta); nova conversa com template; Cardápio e capacidades e Campanhas (gerência), cada um numa gaveta; o Atendente lê a Base de conhecimento por um botão próprio. Base de conhecimento e Cadastros duplicados ficam em Configurações, seção Atendimento (§4e). **Não há mais página Clientes** (02/11/2026): `/admin/clientes` redireciona para cá |
| Clube Âmbar | (ainda não lançado ao público; selo "em breve") |
| Financeiro | Três abas (07/11/2026, ver 4f): Movimentações (despesas, outras receitas, contas a pagar, pagamentos), Pendências (Revisão da Júlia e Conciliação: Banco, Stone e recebíveis, Divergências) e Relatórios (Resultado, Despesas por categoria, Evolução; Fechamento e Vendas). Categorias e Fornecedores em Configurações → Financeiro |
| Estoque | Estoque atual (saldos, situação, gaveta do insumo com histórico), Recebimentos (Júlia, nota, sem nota — uma conferência), Contagem (3 passos), Fichas e custos (fichas técnicas; CMV e custos); "Registrar movimento" (entrada, saída, ajuste); vendas canceladas depois da baixa numa gaveta |
| Equipe | Três abas (08/11/2026, ver 4g): Hoje, Funcionários (dias e horários na ficha; Semana e escalas numa vista secundária) e Registros (batidas, Para revisar, Correções feitas). Tablets e Auditoria em Configurações → Ponto |

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
| Reservas | `reservas`, `reservas/operacao`, `reservas/lotacao`, `reservas/ambientes`, `reservas/{id}` (PATCH só contato e observações), `…/status`, `…/comparecimento` (PUT; cai para PATCH `…/status` só em 404 de rota), `…/aviso-comunicado`, `reservas/comparecimento/pendentes`, `reservas/mensagens`. Nova reserva: `reservas/disponibilidade` e POST `reservas` (403 `criacao_manual_desativada` enquanto `AMBAR_PAINEL_CRIACAO_MANUAL` estiver desligada; a tela explica). Buscar reserva: `reservas?busca=`, em todas as datas. |
| Configurações | `reservas/configuracao/{unidade}`, `…/politica`, `reservas/ambientes/{id}`, `reservas/regras/{id}`, `usuarios` (equipe) |
| Atendimento | `atendimento/resumo` (`por_estado`, `configuracao`), `atendimento/conversas?estado=` (busca com 2+ letras; POST = nova conversa), `…/{id}`, `…/{id}/contato`, `…/mensagens`, `…/responder`, `…/assumir`, `…/assistente`, `…/encerrar`, `…/followup`, `atendimento/mensagens/{id}/midia` (binário pela ponte; só imagem/áudio/vídeo/PDF/texto abrem, o resto desce como download), `atendimento/falhas`, `atendimento/templates`, `atendimento/contatos`, `atendimento/campanhas` (+ `{id}`, `…/enviar` em lotes, `…/cancelar`), `atendimento/conhecimento` (GET, `PUT/DELETE …/{chave}`), `atendimento/duplicidades`, `atendimento/vinculos` (POST); eventos (§4d): `atendimento/eventos` (+ `/opcoes`, `/{id}` GET/PATCH), `atendimento/conversas/{id}/evento` (POST), `assunto` e `evento` na conversa, `eventos` no resumo |
| Visão Geral | `financeiro/relatorios/vendas` (receita, ticket médio, por meio), `financeiro/relatorios/despesas-por-categoria`, `financeiro/relatorios/resultado?mes=` (só mês civil), `financeiro/lancamentos?tipo=despesa&status=confirmada` (distribuição do gráfico), `estoque/analises/produtos` (top 5); sem Financeiro: `reservas/operacao` |
| Sino (topo) | `reservas?status=pendente`, `reservas/comparecimento/pendentes`, `atendimento/resumo`, `financeiro/revisao?limite=1`, `financeiro/resumo`, `estoque/compras?etapa=aguardando_conferencia` — só módulos liberados ao papel, da unidade da aba |
| Financeiro | `financeiro/resumo`, `relatorios/vendas`, `lancamentos`, `despesas` (+ confirmar/cancelar), `outras-receitas` (+ cancelar), `contas-a-pagar`, `parcelas/{id}/pagamentos`, `pagamentos/{id}/estornar`, `revisao`, `revisao/documentos/{id}` (GET/PATCH) e `…/resolver`, `despesas/{id}/documentos`, `despesas/{id}/unidade`, `comprovantes/{id}/enviar-para-compras`, `relatorios/resultado`, `relatorios/despesas-por-categoria`, `fechamento/{mes}`, `apuracoes/{mes}` (+ conferir/fechar/reabrir, `participacao`), `recorrencias`, `taxas-pagamento`, `conciliacao/*`, `extratos/*`, `contas-bancarias`, `categorias` (GET/POST/PATCH, `PUT …/{codigo}/unidades/{unidade}`), `fornecedores` (GET/POST, `fornecedores/{id}` GET/PATCH), `conciliacao/repasses`, `arquivos/{id}/url` |
| Estoque | `estoque/resumo`, `compras` (+ PUT manual, nota, confirmar, cancelar, reprocessar, itens; POST `compras` e `compras/manual` sem tela desde 09/11), `ajustes`, `insumos` (+ movimentos), `insumos-sugestoes` (um objeto), `perdas`, `fichas/{produto|preparo}/{id}`, `inventarios` (+ sugestão, itens, fechar, cancelar), `cancelamentos` (+ resolver), `analises/{cmv,produtos,cardapio,fornecedores,reposicao,ruptura}` |

## 4a. Organização das telas (redesign de 01/11/2026)

Princípio: menos elementos visíveis, uma função por área, nenhuma capacidade perdida. A complexidade fica no código e no
backend; a tela mostra primeiro o essencial e o resto sob pedido (filtros recolhidos, gavetas, "Mais").

| Área | Estrutura |
|---|---|
| Moldura | Lateral: só a marca e os módulos (Visão Geral, Reservas, Atendimento, Financeiro, Estoque); embaixo Modo Operação, Configurações, Recolher. **Clube Âmbar fora do menu** (rota, telas e contratos intactos). Topo: só o título da tela, o sino, o tema e a conta. **Unidade de trabalho no menu da conta** (vale para a aba; B4); o topo mostra a unidade só fora da padrão (`unidadePadrao`). |
| Sino | Central das pendências reais (`layout/avisos.ts`), por prioridade e módulo, cada item leva à tela que resolve. Cache de 45 s na sessão do navegador; reconta depois de qualquer `invalidar()` (evento `painel:invalidar`). |
| Visão Geral | Saudação + um filtro de período (Hoje, 7 dias, 30 dias, Este mês, Personalizado ≤ 400 dias) para 4 indicadores (Receita, Despesas, Resultado gerencial, Ticket médio), Receitas × despesas e dois rankings (top 5 produtos — ou vendas por meio — e despesas por categoria). |
| Reservas | Barra única (‹ Hoje ›, intervalo, período Dia · Semana · Mês, visualização Calendário · Por ambiente, Nova reserva); resumo do dia em uma linha; aprovações pendentes numa pílula → gaveta. |
| Atendimento | Central única de conversas (02/11/2026): "Nova conversa", "Cardápio" e "Campanhas" no topo da coluna, avisos discretos só quando o assistente ou o envio estão desligados no servidor, busca, Todas · Esperando · Assistente · Equipe · Encerradas (contador em Esperando), falhas de envio só quando existem. Conversa: cabeçalho com Contato (ficha em gaveta) e "…" (enviar template, follow-up), barra com o interruptor do assistente, Assumir e Encerrar. Sem indicadores e sem página Clientes. |
| Financeiro | Três abas desde 07/11/2026 (ver 4f): Movimentações · Pendências · Relatórios. Sem o Resumo (o executivo é a Visão Geral). Endereços antigos redirecionados em `modulos/financeiro/index.tsx`. |
| Estoque | Três abas desde 08/11/2026 (ver 4h; refinado em 09/11). Antes: quatro áreas (02/11/2026, ver 4c): Estoque atual (tela inicial) · Recebimentos (Pendentes · Histórico) · Contagem (3 passos) · Fichas e custos (Fichas técnicas · CMV e custos). Uma ação principal em todas: "Registrar movimento". Baixa automática mostrada como está no backend (hoje desligada). |
| Configurações | Grupos ao lado: Conta e aparência · Agenda e ambientes · Equipe e acessos · Atendimento · Financeiro (Categorias e Fornecedores; atalhos para contas fixas, taxas e contas bancárias) · Ponto: tablets e auditoria (só quem tem `ponto.dispositivos` ou `auditoria.visualizar`, hoje o Proprietário). |

Decisões registradas:

- **Quarto indicador = Ticket médio** oficial do backend (`receita_liquida_produtos / vendas` em `/relatorios/vendas`), não
  faturamento médio diário.
- **Resultado gerencial só por mês civil**: o backend apura por mês (`/relatorios/resultado?mes=`). Fora de um mês o
  indicador diz "Apurado por mês" e oferece "Ver este mês" — nada é recalculado no painel.
- **Despesas** = confirmadas por competência (`/despesas-por-categoria`); o gráfico distribui as MESMAS despesas por data
  a partir de `/lancamentos` (só soma para desenhar; até 2.000 despesas, com aviso acima disso).
- **Fornecedor nos formulários** vem do cadastro (`fornecedor: { id }`); nome novo só quando a pessoa escolhe "Cadastrar".

## 4b. Contratos que faltam no backend (para uma etapa posterior)

Nada disto foi simulado no painel; a tela mostra o que existe e diz o que falta.

1. **Conciliação Stone por lote/data** — hoje `GET /conciliacao/repasses` dá vendido × liquidado vinculado por meio no
   período. Falta uma rota que devolva, por data de venda (ou lote de repasse) e modalidade (crédito à vista, parcelado,
   débito, Pix, com antecipação): bruto, taxa aplicada pelo contrato vigente, **líquido esperado**, data prevista do
   crédito, **recebido** (crédito vinculado), diferença e situação, já descontando cancelamentos, estornos e chargebacks
   — e sem descontar a antecipação duas vezes quando a taxa contratada já a inclui.
2. **Resultado gerencial por período arbitrário** (`de`/`ate`) — para o indicador de resultado seguir Hoje/7/30 dias.
3. **Despesas por dia** (`GET /relatorios/despesas-por-dia?de&ate`, mesma regra de competência e sigilo) — hoje o gráfico
   pagina `/lancamentos`.
4. **Estado da criação manual de reserva** (`painel_criacao_manual`) numa rota de leitura — hoje só se sabe pelo 403
   `criacao_manual_desativada` (o painel lembra na sessão do navegador).
5. **Lista de fornecedores sem busca** paginada com contagens (despesas, em aberto) — hoje `GET /fornecedores` limita a
   100 por busca.
6. **Ocupação/lotação do dia inteiro** por ambiente para o calendário do mês marcar dias "lotados" — hoje
   `/reservas/lotacao` é por ambiente e data, uma chamada por vez.
7. **Contador de pendências num endpoint só** (o sino faz até 6 consultas leves por página, com cache de 45 s).

Estoque (02/11/2026). Resolvidos no backend `giardini_back` **e814c29** (local, sem migração, ainda não publicado):
ajuste avulso com motivo (`POST /estoque/ajustes`), `uso_interno` fora das perdas, abertura marcada no livro
(motivo "abertura"), nomes de quem registrou e diferença produtos × Pix justificada (ver §4c). Continuam em aberto —
nada disto é simulado no painel:

8. **Observação/justificativa e documento de origem no recebimento sem nota** (`POST /estoque/compras/manual` não tem
   campo de observação; a ausência de nota fica identificada só pela fonte "Digitada").
9. **Recebimento parcial com quantidade pendente**: um item pode ser marcado "Não chegou / ignorar" (não entra no
   estoque e aparece assim na compra confirmada) ou ter a quantidade-base corrigida, mas o que falta chegar não fica
   registrado como pendente para um recebimento seguinte.
10. **Ficha incompleta** (ingrediente faltando) não é detectável: o backend sabe se há ficha e se algum ingrediente está
    sem custo. O painel diz "Custo calculado" (não "Completa") e avisa que o custo considera só os ingredientes listados.
11. **Vínculo de entrada manual a uma despesa escolhida pela pessoa**: a confirmação oferece as candidatas que o backend
    encontra (mesmo fornecedor/valor, até 2%); não há busca livre de despesas na conferência.
12. **Tipo próprio para uso interno no livro**: hoje é `tipo = perda` com motivo `uso_interno` (o CHECK do banco só
    aceita esse tipo de saída manual); toda leitura que quiser perdas precisa filtrar pelo motivo, como
    `analises.divergencias` já faz (`classe`). Um tipo novo exige migração — combinar a numeração com o Atendimento (0022).
13. **Nome de quem criou a versão da ficha** (`criada_por_nome` em `/fichas`): só o Proprietário vê o nome hoje.

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

## 4c. Estoque em quatro áreas (02/11/2026) — substituída pela §4h

Antes: Compras (tela inicial, 4 filtros, "Compra sem nota" e "Enviar nota" soltos) · Insumos (3 filtros, coluna de
confiabilidade) · Fichas técnicas · Inventário (4 passos) · Mais (Cancelamentos, Análises e CMV).

| Área | O que tem |
|---|---|
| Estoque atual | Três números discretos (insumos cadastrados, abaixo do mínimo, recebimentos pendentes), uma busca, filtro de situação e — só com mais de uma categoria — de categoria. Tabela: insumo, categoria, disponível, unidade, mínimo, situação. Gaveta do insumo: disponível, mínimo, custo médio (quando há), última entrada, última contagem, histórico com o nome de quem registrou e as ações Entrada · Saída · Ajuste. Linha discreta: "Baixa automática pelas vendas: desligada" e, se houver, vendas canceladas a responder (gaveta). |
| Recebimentos | Pendentes (para conferir, sendo lidos, com falha) · Histórico (conferidos e cancelados). Origem em uma linha: Júlia · comprovante de pagamento / Painel · nota fiscal / Painel · sem nota. "Novo recebimento" → com nota (foto/PDF/XML) ou sem nota (digitado); todos caem na MESMA conferência (`Conferencia.tsx`). |
| Contagem | 1) Selecionar itens (prioritários = abaixo do mínimo/sem estoque + sugestão do backend; todos; escolher) · 2) Informar quantidades (registrado × contado, salvo ao sair do campo) · 3) Revisar e confirmar (diferença prevista; abertura aparece como "Saldo inicial"). Histórico compacto com o responsável. |
| Fichas e custos | Fichas técnicas (produto da Eyemobile, custo estimado só com ficha completa; situações Sem ficha · Custo indisponível · Completa; cobertura da receita) · CMV e custos (CMV teórico × consumo e diferenças físicas, motivos quando indisponível, compras do mês marcadas como "não é CMV", mais vendidos, preços por fornecedor, cardápio). Previsão de falta e reposição só aparecem com a baixa ligada. |

Regras de tela (nenhum cálculo de regra no painel):

- **Situação**: Não conferido = sem contagem (ou contagem antes de `inicio_controle`), conferido pelo campo
  `ultima_contagem_em` — com a baixa desligada o backend devolve o motivo `baixa_desligada` e esconde o
  `nunca_contado`. Sem estoque = conferido e saldo ≤ 0. Estoque baixo = `abaixo_minimo` do backend. O resto, Normal.
  Item não conferido nunca aparece como "0": mostra "—" (nada registrado) ou o registrado esmaecido ("só entradas, sem
  contagem").
- **Unidade de exibição**: kg/L quando os números da linha passam de mil, senão g/ml/un; o painel só desloca a vírgula
  (÷/× 1000, por texto) e o backend recebe sempre a unidade-base.
- **Responsável**: o nome vem do backend (`registrado_por_nome`, `aberto_por_nome`); com o backend anterior, o painel
  deduz pelo id (quem está usando, a lista da equipe do Proprietário ou "Equipe"). Nenhum id técnico na tela.
- **Entrada** = recebimento (estoque só muda em "Confirmar recebimento"). **Saída** = `POST /estoque/perdas` (vencido,
  quebra, preparo, `uso_interno`, outro); uso interno aparece como "Uso interno", nunca como perda, e o relatório de
  divergências o separa (`classe`). **Ajuste** = `POST /estoque/ajustes` (motivo: contagem física, erro de registro ou
  outro com explicação); a resposta e o histórico trazem saldo anterior, saldo novo, diferença, motivo, responsável e
  data. Vale com uma contagem geral aberta. A primeira contagem de um insumo é gravada como "abertura" e aparece como
  "Contagem inicial". Backend anterior: sem a rota, nada é lançado e a tela manda para a Contagem; sem `uso_interno`, a
  saída é recusada — o painel nunca troca o motivo sozinho.
- **Financeiro**: a confirmação continua com as regras do backend (B1–B3): pagamento da Júlia já vinculado ("É o
  pagamento que a Júlia registrou"), candidata forte pré-selecionada, conta nova só com motivo, nada de segunda despesa
  quando um pagamento espera a conferência.
- **Produtos × Pix**: se não somam o pagamento, a gerência confirma **justificando** — motivo coerente com o sentido
  (produtos acima: desconto, pagamento parcial, outro; abaixo: frete, itens fora do estoque, outro) e uma explicação.
  Nada é rateado entre os insumos (cada um entra pelo valor informado) e nenhuma despesa nova nasce. Pagamento parcial:
  a MESMA despesa passa ao valor dos produtos e o restante fica em aberto nela; os outros motivos mantêm o valor do
  pagamento. Sem justificativa, 409 `total_diverge_do_financeiro` como antes. A compra confirmada mostra a diferença,
  o motivo, a explicação e o que ficou no Financeiro.
- **Sem dado, sem número**: CMV teórico só aparece com vendas no mês, cobertura conhecida e nenhuma ficha faltando
  ("R$ 0,00" sem vendas virou "Indisponível"); custo e margem da ficha só com todos os ingredientes com custo.

Testes: `tests-painel/estoque.spec.ts` (demonstração, 11) e `tests-painel-real/estoque.spec.ts` (backend real local,
base isolada; JSON em `PAINEL_REAL_ESTOQUE`, 10 cenários). No backend: `tests/test_estoque_rastreabilidade.py`.

## 4d. Eventos no Atendimento (03/11/2026 — backend giardini_back 5ab71c8 + migração 0023)

Contrato: `giardini_back/docs/auditoria-ambar/arquitetura/ATENDIMENTO-EVENTOS.md` §7. Sem página nova e sem item no
menu: tudo mora no Atendimento. Tipos em `lib/tipos/atendimento-clube.ts` (`EventoAtendimento`, `OpcoesEventos`…),
chamadas em `lib/api/atendimento-clube.ts`, telas em `modulos/atendimento/Evento.tsx`.

| Onde | O que mostra |
|---|---|
| Caixa de entrada | Etiqueta discreta **Evento** na conversa com `assunto = "evento"` (tom de atenção quando a conversa está Esperando). Acima da lista, o atalho **Eventos** com o contador dos que estão em *Aguardando contato* (`resumo.eventos`). |
| Visão compacta (gaveta "Eventos") | `GET /eventos` — Em andamento · Fechados · Perdidos, busca por nome/telefone, contagem por status; aguardando contato primeiro e destacado. Clicar abre a conversa. `?eventos=1` abre a gaveta (link do sino). |
| Conversa | Ficha do evento na **coluna lateral** (≥ 1180 px) ou numa **faixa** acima das mensagens que abre a mesma ficha em gaveta (tablet e celular). Resumo do backend (já traz "Falta: …"), tipo, data com dia da semana, horário, convidados, ambiente, necessidades, observações, origem/canal. "Editar dados" (todos). Status comercial e responsável em seletores, perda com motivo opcional (diálogo) — só Gerente e Proprietário (`pode_mudar_status` das opções; o Atendente vê o texto). Evento concluído: "Registrar novo evento". Sem evento aberto: "…" → **Registrar evento**. |
| Sino | "N eventos aguardando contato" → `/admin/atendimento?eventos=1`. |

Regras que a tela respeita (quem decide é o backend): o status comercial **não** muda o estado da conversa (assumir,
responder e o assistente seguem como antes); uma oportunidade aberta por conversa — `409 evento_aberto_na_conversa`
vira aviso e a tela mostra a que já existe; o PATCH manda só o que mudou (`null` apaga); `403 sem_permissao`,
`422 ambiente_desconhecido` e `responsavel_invalido` viram mensagem em português; opções indisponíveis → a ficha mostra
os dados e avisa, sem editar. **Backend anterior à 0023** (`resumo` sem `eventos`): nada de evento aparece e nenhuma rota
de evento é chamada — o painel novo pode ir para o ar antes do backend sem quebrar.

Testes: `tests-painel/atendimento-eventos.spec.ts` (demonstração, 7: caixa e visão compacta, Atendente edita/assume/
responde, Gerência status/perda/novo sem duplicar, registro manual, erros e backend antigo, tablet e celular) e
`tests-painel-real/atendimento-eventos.spec.ts` (backend real local com a 0023, base isolada, assistente ligado e o
"n8n" feito pelo teste; JSON em `PAINEL_REAL_EVENTOS`, 6 cenários, inclusive outra unidade sem acesso).

## 4e. Visão Geral, Reservas e Atendimento (04/11/2026)

**Visão Geral.** Saiu a faixa "Aguardando dados de vendas". Sem a loja do PDV ligada (`disponivel: false` em
`financeiro/relatorios/vendas`), Receita e Ticket médio mostram "—" e "Sem vendas sincronizadas", nunca zero. Falha de API é
outro estado: fica no próprio indicador ou cartão, com "Tentar de novo", e não vira "sem vendas" (antes, um erro no relatório
do gráfico dizia que as vendas não estavam sincronizadas, e um erro nos produtos trocava o cartão por outro assunto). A faixa
"Vendas desatualizadas" continua: é sincronização atrasada de verdade. Fontes conferidas com o backend:

- Receita = `receita_liquida` de `relatorios.v_vendas_dia` (produtos − descontos − devoluções, sem canceladas e sem taxa de
  serviço). Não é faturamento bruto nem o que caiu na conta; o recebido por meio é o registrado no PDV.
- Despesas = confirmadas por competência (`v_despesas_categoria`). O gráfico distribui as mesmas despesas por
  `financeiro/lancamentos`, inclusive sem retiradas para a Gerente. Sem duplicidade: a venda entra uma vez por dia da view e o
  repasse da Stone é recebimento.

Pendência fora do código: `vendas_configuradas` só fica verdadeiro com uma linha em `pdv_lojas` com `sincronizar`. Em produção
isso depende da seção C de `ops/DEPLOY.md` do backend: chaves da Eyemobile, `ligar-loja-pdv --point-id 39424 --unidade ambar_cafe
--desde <data>`, carga do histórico e worker `ambar-sync`, além da decisão da data inicial e da taxa de serviço.

**Reservas.** Período (Dia, Semana, Mês) e visualização (Calendário, Por ambiente) são duas escolhas independentes, e a data de
referência acompanha a troca. Na URL: `vista` (período) e `apresentacao=ambiente`; links antigos continuam abrindo
(`vista=lista` cai no Dia e `vista=ambientes` em Por ambiente). `Lista.tsx` ficou no código sem entrada na navegação. A busca em
todas as datas é a gaveta **Buscar reserva**, que consulta `GET /admin/reservas?busca=`: nome sem depender de acento, telefone em
qualquer formato (só para quem vê o contato) e código, com as próximas reservas primeiro. O Atendente busca por nome ou código, de
hoje até 14 dias à frente. A busca da barra do Dia continua sendo só do dia aberto. Por ambiente mostra a
capacidade de `reservas/ambientes`; a ocupação do Dia é o pico de `reservas/lotacao` e em Semana e Mês não há esse número.

**Nova reserva.** Quem calcula é o backend, em `GET /admin/reservas/disponibilidade?ambiente_id=&data=&pessoas=` (`reservas.criar`),
sempre para a unidade do ambiente: grade, bloqueios, primeira data e lotação. A tela não repete regra nenhuma
(`modulos/reservas/disponibilidade.ts`): data e pessoas → horários por ambiente, com lotado desligado e o que já passou fora da
lista. Sem resposta não há horário nem como gravar. Ao gravar, o horário é consultado de novo e `POST /admin/reservas` confere tudo
de novo no backend: `fora_da_agenda` e `horario_passado` (422), `lotacao_excedida` (409, sob a mesma trava do site). A tela trata
esses códigos devolvendo a escolha, sem perder o que foi digitado.

Reserva pública × administrativa: a antecedência mínima (2 h) e o limite de pessoas de UMA reserva online valem só no site. A equipe
pode lançar para daqui a pouco, desde que o horário não tenha passado; horários, bloqueios, mínimo de pessoas do ambiente, primeira
data e lotação valem igual. A reserva da equipe nasce confirmada, o e-mail é opcional e não há consentimento registrado.
`AMBAR_PAINEL_CRIACAO_MANUAL` liga o lançamento; a disponibilidade informa o valor (`criacao_manual`) para a tela avisar antes.

**Atendimento.** O menu "Mais" saiu. No topo da coluna: "Cardápio" e, para a gerência, "Campanhas". Em Configurações, seção
Atendimento: Base de conhecimento da IA e Cadastros duplicados, com as mesmas permissões e rotas. O Atendente, que não entra em
Configurações, continua lendo a base por um botão no Atendimento, sem editar.

Testes: `tests-painel/visao-geral.spec.ts`, `reservas-navegacao.spec.ts`, `reservas-nova.spec.ts`, `reservas-busca.spec.ts` e
`atendimento.spec.ts` (demonstração e respostas simuladas); `tests-painel-real/reservas-e-visao.spec.ts` (backend real local em base
isolada, JSON em `PAINEL_REAL_RESERVAS`); no backend, `tests/test_reserva_administrativa.py`. Nenhum deles fala com a Eyemobile.

## 4f. Financeiro em três abas (07/11/2026)

Pedido do dono: menos navegação, nenhuma função a menos. Só front; nenhuma rota, regra ou tabela do backend mudou.

| Aba | O que tem | Onde estava |
|---|---|---|
| **Movimentações** (`/admin/financeiro`) | Barra: busca, período, Filtros (Mostrar, categoria, origem, situação), **Outra receita** e **Nova despesa**. Filtros simples `?tipo=`: Todas · Despesas (`despesas`) · Outras receitas (`receitas`) · A pagar (`a-pagar`). Linha de totais no topo (Vendas do PDV/Eyemobile — "indisponível" sem a integração —, outras receitas, despesas confirmadas, em revisão, pagamentos realizados, a pagar em aberto). Contas vencidas ou que vencem hoje em destaque, com atalho para A pagar. A pagar = contas a pagar (situações, Pagar, botão **Contas fixas** → `?vista=recorrentes`); a busca da barra vale para elas. | Lançamentos + Contas a pagar |
| **Pendências** (`?aba=pendencias`) | Um seletor `?vista=`: Revisão da Júlia (padrão; filtros `?filtro=`) · Banco · Stone e recebíveis · Divergências (as três só com `financeiro.conciliar`). Banco = extrato, Importar extrato e conferência; sem conta bancária, Stone e Divergências mostram "Cadastrar conta bancária" em vez de números vazios. | Revisão + Conciliação |
| **Relatórios** (`?aba=relatorios`) | Principais: Resultado do mês · Despesas por categoria · Evolução financeira. Grupo discreto "Mais relatórios": Fechamento do mês · Vendas (Eyemobile). `?relatorio=`. | Relatórios e cadastros (sem os cadastros) |

Cadastros: Categorias e Fornecedores em **Configurações → Financeiro** (`?secao=financeiro&cadastro=categorias|fornecedores`,
os mesmos componentes e permissões), com atalhos para contas fixas, taxas da adquirente e contas bancárias, que ficam onde
são usadas.

Contadores: Movimentações = contas vencidas; Pendências = despesas em revisão + comprovantes pendentes (`/resumo`, os mesmos
do sino; o backend conta só `em_revisao` e `pendente`). No seletor, Banco = movimentações do extrato do mês ainda abertas
(pendentes + parciais + conflitos, a mesma soma do fechamento no backend).

Sem duplicar: em Todas, a despesa paga aparece uma vez (o pagamento só em Filtros → Mostrar → "Só pagamentos feitos" ou
"Tudo"); A pagar mostra a obrigação, nunca o pagamento. Outra receita lembra que aporte, empréstimo e transferência entre
contas não são receita (classificam-se no extrato).

Endereços antigos (`abaDaUrl` em `modulos/financeiro/index.tsx`; a URL é reescrita para a nova):

| Antes | Agora |
|---|---|
| `?aba=lancamentos`, `?aba=resumo`, sem `aba` | Movimentações (`&despesa=` continua abrindo o detalhe) |
| `?aba=contas[&situacao=…]` | `?tipo=a-pagar[&situacao=…]` |
| `?aba=contas&vista=recorrentes`, `?aba=contas-fixas`, `fixas`, `configuracoes` | `?tipo=a-pagar&vista=recorrentes` |
| `?aba=revisao[&filtro=…]`, `?aba=lancamentos&revisar=1` | `?aba=pendencias[&filtro=…]` |
| `?aba=conciliacao`, `?aba=lancamentos&vista=banco` | `?aba=pendencias&vista=banco` |
| `?aba=conciliacao&vista=stone` (ou `divergencias`), `?aba=taxas` | `?aba=pendencias&vista=stone` (ou `divergencias`) |
| `?aba=resultado[&vista=…]`, `?aba=vendas` | `?aba=relatorios&relatorio=…` |
| `?aba=categorias`, `?aba=relatorios&relatorio=categorias` (ou `fornecedores`) | `/admin/configuracoes?secao=financeiro&cadastro=…` |

Testes: `tests-painel/financeiro.spec.ts` (abas, endereços antigos, filtros, criar despesa e receita, pagar sem duplicar,
contadores, Relatórios, Configurações), `financeiro-revisao`, `financeiro-categorias`, `estoque-compras` e `responsivo`.

## 4h. Estoque em três abas (08/11/2026)

Pedido do dono: o Estoque de um café pequeno, sem estoquista, em três abas — **Insumos · Compras · Fichas técnicas** —
sem mudar backend, Financeiro, Z-API, Ponto nem o cardápio público. Substitui a organização da §4c; as regras de tela
de lá (situação, unidade, responsável, Financeiro, Produtos × Pix, sem dado sem número) continuam valendo.

| Aba | O que tem |
|---|---|
| Insumos | (Refinada em 09/11: ver "Refinamento de 09/11/2026" abaixo.) Busca e duas ações: **Contar estoque** e **Novo insumo** (com a lista vazia, só o convite do meio da tela: um botão de cadastro por vez). Tabela: insumo (categoria), quantidade com unidade, mínimo, ideal (só quando o backend guardar), preço médio, situação (Normal · Baixo · Esgotado · Não conferido) e "Conferido em". Sem números no topo, sem filtro de situação, sem "Saldo = …". Com a baixa pelas vendas desligada, um aviso: "As vendas ainda não descontam do estoque" (some quando o backend ligar a baixa). Vendas canceladas a responder: aviso com link para a gaveta. Gaveta do insumo: quantidade estimada, mínimo, preço médio, última compra, última conferência, histórico e as ações **Conferir quantidade · Perda ou uso interno · Corrigir saldo · Editar** (e Ficha do preparo). |
| Contar estoque (`?vista=contagem`) | Dentro de Insumos, com "← Insumos". Três escolhas: Todos os insumos (padrão enquanto houver insumo nunca conferido — o inventário inicial), Escolher insumos, Só os baixos ou com divergência (abaixo do mínimo, esgotados, saldo negativo). Os três passos e o histórico (responsável e data) são os de antes. Abrir ou abandonar não muda saldo; só "Confirmar contagem". |
| Compras | (Desde 09/11, só conferência: "Registrar compra" saiu — ver abaixo.) **Pendentes · Histórico** (o Histórico traz as conferidas e as canceladas). Origem na linha do fornecedor (Júlia · comprovante de pagamento / Painel · nota fiscal / sem nota). Botão "Conferir" em cada pendente; **Registrar compra** (com nota: foto/PDF/XML lida e revisada por uma pessoa; sem nota: digitada) para o que não passou pela Júlia. Tudo na MESMA conferência; "Confirmar recebimento" é o único passo que dá entrada; nenhuma segunda despesa (B1–B3). |
| Fichas técnicas | Produtos: só a busca (sem filtros nem texto de ordenação); cartões largos (3 por linha no tablet), do mais vendido ao menos vendido em 30 dias, com foto (só com vínculo), nome, vendidos em 30 dias, preço de venda, custo calculado e situação (Completa · Incompleta · Sem ficha). A falta de vínculo com o cardápio não aparece nos cartões: fica numa linha discreta na gaveta. Ficha: preço de venda, custo dos ingredientes, **margem de contribuição parcial** (preço − ingredientes, "não é lucro líquido"), rendimento, ingredientes, versões. Editor: à vista só ingrediente (busca no estoque, sem texto livre), quantidade e unidade (kg/g, L/ml, un), e "Adicionar ingrediente"; rendimento (padrão 1 porção), perda %, opcional e observação ficam em **Opções avançadas** (abertas de saída quando a ficha já usa alguma; no preparo da casa o rendimento fica à vista, porque é medido na unidade do preparo). Produto pronto (água, refrigerante) = ficha com o item do estoque e 1 un. Mostra o preço médio de cada ingrediente ou "sem preço". **Custos e CMV** (`&secao=custos`): custo dos ingredientes vendidos no mês (só quando o CMV teórico é confiável), cobertura das fichas, produtos sem ficha (só o número), sem custo conhecido, tabela preço × ingredientes **só com as fichas completas** e "mais vendidos sem ficha"; sem nenhuma ficha, só "Ainda não há fichas técnicas" (sem o botão "Ver produtos sem ficha"). Os relatórios de antes ficam em "Relatórios avançados" (montados só ao abrir). |

Endereços antigos continuam: `?aba=estoque|resumo` → Insumos; `recebimentos` → Compras; `contagem|inventario(s)` →
Insumos › Contar estoque; `custos` → Fichas técnicas; `analises|mais` e `secao=cmv` → Custos e CMV; `cancelamentos` →
Insumos + gaveta. O sino (`avisos.ts`), `rotas.ts` e o Financeiro ainda usam os nomes antigos de propósito.

Cadastro de insumo (simplificado na noite de 08/11): Nome, Unidade (g, kg, ml, L, un — kg e L são gravados em g e ml),
Quantidade inicial, **Estoque mínimo (obrigatório: "quantidade que dispara o alerta")** e Estoque ideal ("quantidade que
queremos alcançar depois de comprar"). Sem Categoria (as que já existem continuam aparecendo) e sem "Mais opções": o
tipo "preparo da casa" — que o backend não deixa mudar depois — é um link discreto no fim do formulário, e o controle do
preparo fica na edição. **Cadastro em sequência**: cadastrou, a gaveta fica aberta, limpa, com a mesma unidade e o cursor
no nome; a lista "Cadastrados agora" abre cada um. A quantidade inicial é gravada logo depois do cadastro como a
primeira conferência (`POST /estoque/ajustes`, motivo `contagem_fisica` → o backend marca "abertura"); se só o
cadastro der certo, o item entra na lista com o aviso e a pessoa usa "Conferir quantidade". A edição também exige o mínimo. Todas as
mudanças de saldo pedem confirmação com o resumo (quantidade, de → para, motivo).

### Refinamento de 09/11/2026 (só front; backend, Financeiro, Júlia e Eyemobile intocados)

Pedido do dono antes do cadastro real dos insumos e fichas: o módulo enxuto, sem textos permanentes, sem caminhos
duplicados. As três abas continuam; o que mudou:

- **Insumos**: tabela compacta (Nome · Quantidade com unidade · Estoque mínimo · Custo médio · Situação · Detalhes). O
  ideal e a última conferência saíram da tabela e ficam no detalhe (o ideal aparece "Ainda não salvo pelo sistema" até o
  backend guardar). "As vendas ainda não descontam do estoque" virou uma nota discreta no rodapé da tabela (não banner).
  Gaveta do insumo com duas ações: **Ajustar estoque** e **Editar cadastro** (e Ficha do preparo).
- **Ajustar estoque** (`Movimento.tsx`, uma gaveta, `Tipo de ajuste`): **Entrada** — identificada, sem formulário: não
  há rota de entrada avulsa no backend; entradas nascem na conferência de Compras ("Ir para Compras") · **Perda** —
  `POST /estoque/perdas` (vencido, quebra, sobra de preparo, uso interno, outro), com data e observação · **Correção de
  inventário** — `POST /estoque/ajustes` com motivo (contagem física, erro de registro, outro; os dois últimos exigem
  justificativa). Quantidade, motivo e "Responsável: <quem está logado>" à vista; o backend grava quem registrou.
  Confirmação com o resumo antes de lançar, como antes.
- **Cadastro**: saíram "O preço médio vem das compras conferidas em Compras." e a pergunta "É um preparo feito aqui
  (molho, massa, calda)?"; o tipo continua (o backend precisa dele e não deixa mudar depois) num campo discreto **Tipo**
  (Comprado · Preparo da casa). Ajudas encurtadas. Cadastro em sequência preservado.
- **Seletor único de insumos** (`SeletorInsumo.tsx`): combobox pesquisável sobre `GET /estoque/insumos` (mesmo cache da
  tabela; acima de 200 insumos a busca vai ao backend), busca sem acento, escolha sempre pelo **id**, unidade cadastrada
  dentro do campo e na lista, só insumos ativos (Compras: só comprados; Fichas: todos, menos o próprio preparo). Estados
  dentro da lista: carregando, erro com "Tentar de novo", busca vazia. Sem o insumo: **Cadastrar "…"** (só com
  `estoque.editar`, e só quando não há um com o mesmo nome) abre o **cadastro rápido** (`NovoInsumo` em modo rápido,
  montado uma vez em `index.tsx` via contexto) e devolve o insumo criado já escolhido; 409 `nome_ja_existe` oferece "Usar o
  insumo existente". Usado na conferência de Compras (itens digitados e itens lidos da nota) e nas Fichas técnicas.
- **Compras**: saíram "Registrar compra", o modal "Com nota fiscal / Sem nota" e a compra digitada pelo Estoque (o
  Financeiro é a entrada oficial de compras/despesas; o Estoque confere e dá entrada). Pendentes e Histórico continuam.
  `estoque.compraManual` e `estoque.enviarNota` seguem no cliente da API (contrato intacto), sem tela que os chame.
- **Conferência**: cabeçalho com Fornecedor (documento e nº numa linha pequena) · Data · Total; documento à esquerda;
  status numa linha discreta (itens sem insumo, sugestões a confirmar, foto lida por IA) no lugar das faixas amarelas.
  Itens numa grade única **Insumo · Quantidade · Unidade · Valor unitário · Subtotal** (itens digitados: editáveis, com
  adicionar/remover linha; itens lidos: valores do documento, insumo pelo seletor, conversão e "não é estoque/não
  chegou" no "…"). **Total dos itens × Registrado no Financeiro**, com a diferença e um aviso vermelho só quando ela existe.
  Leitura da nota fiscal opcional recolhida em "Ler a nota fiscal (opcional)". A confirmação continua com as regras do
  backend (B1–B3, justificativa da gerência) — nenhuma despesa nova.
- **Sugestão da leitura não passa sozinha**: o backend dá entrada em itens `sugerido` (confiança alta) ao confirmar a
  compra. O painel agora exige que uma pessoa clique em **Confirmar** em cada sugestão (PATCH do item com o mesmo
  `insumo_id` → `confirmado`, a conversão mantida); "Continuar" fica desligado e o rodapé diz "N sugestões a confirmar".
  Item escolhido no seletor ao digitar já nasce conferido (`_associar_escolhidos`), como antes.
- **Fichas técnicas**: editor com o seletor único (Ingrediente · Quantidade · Unidade · Adicionar ingrediente),
  rendimento/perda/opcional/observação em "Opções avançadas", textos repetidos removidos; produto pronto (água,
  refrigerante) segue como o item do estoque e 1 un. Cartões da Eyemobile e gaveta sem mudança.

Depende do backend (continua identificado na tela, nada simulado): entrada avulsa de estoque (não há rota; só
`ajustes`, `perdas` e a conferência de Compras). Os demais itens desta lista foram resolvidos pela 0028 (abaixo).

### Estoque sincronizado — integração com o backend 0028 (09/11/2026)

Backend `giardini_back` c17ea15 + e78d36a (branch `estoque-sincronizacao-0028`, local; contrato
`CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md` §12). Cada recurso liga sozinho quando o backend responde e cai no comportamento
anterior com o backend publicado antes da 0028 (testado com o backend simulado sem as chaves/rotas):

| Recurso | Rota / campo | Na tela | Backend anterior |
|---|---|---|---|
| Estoque ideal | `estoque_ideal` em POST/PATCH/listagem/detalhe; `falta_para_ideal` | Campo no cadastro e na edição (apagar manda `null`, que limpa); detalhe com "Estoque ideal" e "Falta para o ideal" (só quando o backend calcula — com a baixa desligada vem null) | Campo desligado: "Ainda não é salvo pelo sistema" |
| Quantidade e custo inicial | `quantidade_inicial`, `custo_unitario_inicial` no POST (abertura na mesma transação, com `Idempotency-Key`); `custo_unitario` no POST /ajustes só na abertura | "Custo unitário inicial (R$/kg)" no cadastro; "Custo unitário" na correção de inventário quando é a 1ª contagem e não há custo de compras. Histórico: "Custo inicial informado". Não vira despesa | Sem campo de custo; a quantidade vira um POST /ajustes logo depois (resposta sem `abertura`) |
| Parecidos | GET /insumos/semelhantes; `semelhantes` na resposta do POST | Aviso discreto no cadastro ("Parecido com o que já existe"), nunca bloqueio | — |
| Combobox | GET /insumos/opcoes (acha também pelo texto de nota já confirmado: "pelo texto da nota") | SeletorInsumo | 404 de rota → listagem de insumos (como antes) |
| Correspondência | GET /compras/{id}/itens/{item}/candidatos | Item lido pendente: "Pode ser:" com até 3 candidatos (status, %); escolher = PATCH do item com o `insumo_id` (e o fator do alias, se houver) | Sem candidatos; o seletor continua |
| Produtos sem venda | GET /fichas?incluir_sem_venda=true | Fichas técnicas mostra o cardápio da loja: "Sem venda em 30 dias · no cardápio da loja". Custos e CMV continua só com os vendidos | O parâmetro é ignorado |
| Vínculo com o catálogo | GET /vinculos-cardapio; PUT /fichas/produto/{id}/catalogo | Gaveta da ficha: sugestões por nome como botões "confirme" (nunca aplicadas), escolha no cardápio do site por categoria, Trocar/Desfazer; a foto da miniatura aparece pelo id. 409 `catalogo_ja_vinculado`/422 mostrados | Linha discreta, sem seleção |
| Confirmação humana | `pendencias` com `item_N_sugestao_nao_confirmada` e `item_N_sem_confirmacao_humana`; 409 `pendencias`; PATCH sem `insumo_id` → 422 `insumo_nao_informado` | O botão "Confirmar" de cada item manda o `insumo_id`; o rodapé não repete a pendência; a API recusa a confirmação forçada (testado) | Só o painel bloqueava |

Rotas conferidas uma a uma contra as fichas do contrato (38 chamadas do Estoque, nenhuma inexistente).

Testes: demonstração 22 (Estoque + Compras, com o backend simulado no formato da 0028 e um teste do backend anterior),
responsivo (Chromium e WebKit, inclusive as gavetas a 375 px), permissões/segurança/Visão Geral 35, Financeiro 30,
Operação/Unidade 28 (+1 intermitente já conhecido, 3/3 isolado). Integração real (`tests-painel-real/estoque.spec.ts`,
base isolada no Postgres `ambar-pg-estoque`, backend cd06c84): 12/12. `financeiro-estoque.spec.ts` (B3) não rodou: exige
o seed de cenários do Financeiro.

Testes do refinamento: `tests-painel/estoque.spec.ts` (15, incluindo ajuste com entrada identificada, nota lida com
sugestões confirmadas uma a uma, estados do seletor e o ponta a ponta cadastrar → comprar com cadastro rápido → conferir →
ficha), `tests-painel/estoque-compras.spec.ts` (3) e `tests-painel/responsivo.spec.ts` (gavetas do Estoque a 375, 768 e
1366 px). `tests-painel-real/estoque.spec.ts` e `financeiro-estoque.spec.ts` atualizados para os rótulos novos (rodam só
com o Postgres de integração).

### Contratos que faltam no backend (a interface está preparada, nada é simulado)

1. **Estoque ideal** — `estoque_ideal` (Decimal ≥ 0, na unidade-base) em `InsumoEntrada`, `InsumoAlteracao`, na saída
   do insumo (`_insumo_saida`) e na listagem (`GET /admin/estoque/insumos`). O painel liga campo e coluna quando a
   resposta trouxer a chave `estoque_ideal` (mesmo `null`); hoje o campo aparece desligado ("Ainda não é salvo pelo
   sistema: o campo é liberado quando passar a ser") e a coluna não aparece. Sem migração no backend, o ideal **não é
   salvo** — conferido em 08/11 23h: `InsumoEntrada`/`InsumoAlteracao` (giardini_back 54748c5) não têm o campo. Sugestão: validar ideal ≥ mínimo.
2. **Custo unitário conhecido no cadastro** — não existe. Proposta: `custo_unitario` opcional em `POST /estoque/ajustes`
   aceito só na abertura (vira `saldo_inicial`/abertura com custo), ou em `POST /estoque/insumos` junto com a quantidade
   inicial. Até lá, o preço médio vem só de compras conferidas (a tela diz isso).
3. **Vínculo produto da Eyemobile ↔ catálogo oficial** — não existe tabela nem campo (`produtos_pdv` não referencia o
   catálogo da 0025; nada liga `eye_product_id` a ids como `sucos.antioxidant`). Proposta: coluna
   `catalogo_item_id text null` (único por unidade) em `produtos_pdv` ou tabela própria; `catalogo_item_id` na lista de
   `GET /admin/estoque/fichas`; `PUT /admin/estoque/fichas/produto/{eye_product_id}/catalogo` `{catalogo_item_id |
   null}` (estoque.editar, auditado, recusando id que não está no catálogo vigente e vínculo duplicado). O painel já
   mostra "Não vinculado" e, com a chave, a foto da miniatura do cardápio pelo id (`modulos/estoque/fotos.ts`); a
   seleção manual entra quando a rota existir. A ficha técnica já é por `eye_product_id` (persistente) e os insumos pela
   ficha — essa parte do vínculo existe e foi preservada.
4. **Produtos sem venda no período** — `GET /admin/estoque/fichas` só lista o que vendeu nos últimos `dias` (padrão 30).
   Produto novo sem venda não aparece para cadastrar ficha antes de vender; se for preciso, um parâmetro para listar
   todo o `produtos_pdv` ativo.

**Baixa automática pelas vendas**: continua desligada e não foi tocada. Ligar exige comprovar no backend o desconto de
itens vendidos, adicionais e cancelamentos (e as fichas completas dos mais vendidos).

Testes: `tests-painel/estoque.spec.ts` (demonstração, 12: três abas, cadastro em sequência com mínimo obrigatório, perda/uso interno,
corrigir, conferir sem diferença, contar estoque e abandonar, compra sem nota, endereço antigo, fichas, editor em kg,
custos sem número inventado, vínculo por id com foto) e `tests-painel-real/estoque.spec.ts` (backend real local, 11).

### Cores de receita e despesa (08/11/2026)

Tokens `--receita` (verde, #2f6b46 claro / #86c79a escuro) e `--despesa` (vermelho, #c0473b / #e07b6f) em
`estilos/tokens.css`. Receita sempre verde e despesa sempre vermelha em barras, linhas, legenda e dica (a dica ganhou a
amostra de cor ao lado do nome): Visão Geral (Receitas × despesas e Despesas por categoria), Financeiro › Resultado
(evolução mensal; o resultado gerencial segue tracejado em caramelo) e Financeiro › Vendas (receita). O vinho continua
na marca (botões, menu, navegação). Valor indisponível segue sem barra e "—" na dica, nunca zero. Nenhum cálculo,
endpoint ou dado mudou. Teste: `tests-painel/visao-geral.spec.ts`.

## 4g. Equipe em três abas (08/11/2026)

Pedido do dono: de 7 abas (Hoje, Funcionários, Escalas, Registros, Correções, Tablets, Auditoria) para 3, sem mexer no
backend do ponto, no reconhecimento facial nem na Z-API. Nenhuma rota, tabela ou histórico foi removido.

| Aba | O que tem |
|---|---|
| Hoje | Presentes agora (de N ativos), Em intervalo, Atrasados, Ausentes; botão Registro assistido; aviso "N registros de ponto precisam de revisão" quando há; listas Presentes · Atrasados e ausentes · Ainda não chegaram. |
| Funcionários | Lista com "Dias e horários". Novo funcionário: Nome completo, Função e Dias de trabalho (dias como botões, entrada e saída; "Mesmo horário em todos os dias" desmarcável para horário por dia; "Tem intervalo previsto" opcional, nunca presumido). "Dados adicionais" (fechado): Nome no tablet (gerado do nome: primeiro nome, ou + inicial do sobrenome se repetir), Data de admissão (padrão hoje), Telefone, E-mail, Matrícula (opcional), registro com o gestor. Ficha: Editar · Dias e horários · Cadastro facial (só `ponto.biometria`) · Histórico; registro assistido, registros de ponto, inativar. "Semana e escalas" (`?vista=escalas`): a semana com folga ou troca de um dia e as escalas compartilhadas (criar, mudar horário, atribuir, desfazer atribuição futura), as mesmas telas de antes. |
| Registros | `?vista=` Batidas (o espelho, Exportar CSV) · Para revisar (Precisam de revisão e Tipo a conferir, últimos 30 dias; contador também na aba) · Correções feitas (histórico com responsável e justificativa, Exportar CSV). Corrigir, incluir, anular e corrigir previsão continuam no dia aberto, com justificativa e auditoria. |

**Dias e horários sobre as escalas que já existem** (`modulos/equipe/horario.ts` e `DiasHorarios.tsx`). No backend a
escala é um plano compartilhado e a pessoa entra por atribuição, de hoje em diante. Ao salvar na ficha:

- escala só da pessoa (ninguém mais nela, fixa e ativa) → nova versão da mesma escala a partir da data (`POST /escalas/{id}/versoes`);
- sem escala ou em escala compartilhada → escala própria "Horário de <nome completo>" (`POST /escalas`) e atribuição
  (`POST /escalas/{id}/atribuicoes`). Se já existe uma com esse nome e sem ninguém (tentativa anterior), ela é
  reaproveitada: nunca duplica. Os outros da escala compartilhada não mudam, e a tela avisa antes;
- quem entrou na escala atual HOJE só troca de escala a partir de amanhã (o backend recusa sobreposição); a tela já propõe amanhã;
- mudança de escala já marcada para o futuro bloqueia o salvar até ser desfeita (botão "Desfazer mudança marcada" na própria gaveta);
- "Opções avançadas" (fechado): Vale a partir de, Tolerância de atraso (padrão 10 min, a mesma do formulário antigo) e
  "Usar um horário compartilhado" (atribui a uma escala existente, sem criar outra).

| Endereço antigo | Agora |
|---|---|
| `/admin/equipe?aba=escalas` | `?aba=funcionarios&vista=escalas` |
| `?aba=correcoes` | `?aba=registros&vista=revisar` |
| `?aba=tablets` | `/admin/configuracoes?secao=ponto` |
| `?aba=auditoria` | `/admin/configuracoes?secao=ponto&item=auditoria` |

Tablet do café (o gestor cadastra ali): com a Equipe aberta, `<html data-equipe>` (`modulos/equipe/tablet.ts`) faz a
gaveta e os diálogos ocuparem só a área visível quando o teclado do Android abre e rola o campo tocado para o meio; em tela
de toque, campos de 48 px e texto de 16 px. Nada disso vale fora da Equipe e de Configurações → Ponto.

Testes: `tests-ponto-real/` contra o backend real local (`playwright.ponto-real.config.ts`); `11-equipe-simples.spec.ts`
cobre as três abas, cadastro com dias e horários, horário por dia e intervalo sem duplicar escala, horário compartilhado,
opções avançadas, editar, histórico, Registros, endereços antigos e o formulário no tablet em pé.

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
