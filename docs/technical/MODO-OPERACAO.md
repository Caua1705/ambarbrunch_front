# Modo Operação — tablet fixo do café (`/admin/operacao`)

> Criado em 28/10/2026 (frontend `main`, sem push). Parte do painel administrativo (`docs/technical/PAINEL-ADMIN.md`):
> mesma sessão, mesmas permissões, mesmas rotas reais de Reservas. Nenhuma rota nova no backend.

## Para que serve

Uma tela só, para o tablet que fica no salão: a equipe vê as reservas de hoje e registra **"Cliente chegou"** com um
toque. Não é outro painel: cancelar, alterar, aprovar e ver telefone continuam no painel de Reservas.

- **Cabeçalho**: logo, unidade, hora e data de Fortaleza (atualiza a cada minuto), quem está logado e o perfil, menu da
  conta ("Abrir o painel completo", "Sair desta conta"), tema claro/escuro e o botão **Sair** sempre visível.
- **Resumo**: reservas de hoje (sem as canceladas) e quantas faltam chegar, pessoas esperadas, quantas já chegaram (e
  quantas pessoas) e quantas precisam de atenção — toque leva à lista de atenção.
- **Lista**: *Próximas* (atrasadas → já no horário → nos próximos 30 min → mais tarde; as que terminaram sem registro
  vêm por último), *Atenção* (atrasadas, aguardando aprovação, horário encerrado sem registro) e *Dia inteiro*
  (canceladas no fim). Filtro por ambiente em fichas grandes. Cada linha: horário, nome, pessoas, ambiente,
  observação (ex.: alergia) e situação. Tocar na linha abre o detalhe.
- **Cliente chegou**: registra pela API real e a linha muda assim que o servidor confirma. Se a reserva é para mais de
  60 min depois, pede um segundo toque ("Chegou antes do horário?") — o Atendente não consegue desfazer sozinho.

Os dados vêm só de `GET /admin/reservas/operacao?data=<hoje>&unidade=<unidade>` (relido a cada minuto com a aba
visível, e ao tocar em atualizar) e `GET /admin/reservas/ambientes`. "Atrasada" e os minutos de atraso são do backend
(tolerância da política); a tela não recalcula regra nenhuma.

## Chegada, erros e clique duplo

- A chegada usa o mesmo caminho do painel (`reservas/comum.ts → registrarComparecimento`): `PUT …/comparecimento`;
  se o backend publicado ainda não tiver essa rota (produção `80af395`: 404), `PATCH …/status {status: "compareceu"}`.
  O backend aceita a chegada a partir do dia da reserva (o cliente pode chegar antes do horário); repetir é idempotente.
- **Toque duplo**: uma trava por reserva impede o segundo pedido enquanto o primeiro não volta (testado com dois cliques
  no mesmo instante: um `PATCH` só).
- **Erro da API**: aviso com a mensagem do backend; a linha continua com "Cliente chegou" para tentar de novo. Falha de
  leitura com dados na tela mantém a última agenda e mostra "Tentar de novo".
- **Sessão vencida**: qualquer 401 volta ao login com `volta=/admin/operacao`; depois de entrar, a pessoa volta ao tablet.

## Perfis e privacidade

| | Proprietário (`admin`) | Gerente (`gerente`) | Atendente (`operador`) |
|---|---|---|---|
| Abrir o Modo Operação | sim | sim | sim |
| Nome do cliente, pessoas, ambiente, observações | sim | sim | sim (o backend manda) |
| Telefone e e-mail | não aparecem no tablet | não aparecem no tablet | o backend nem envia |
| Cliente chegou | sim | sim | sim, só reservas de hoje (backend confere) |
| Não veio (depois do atraso sinalizado) | sim, no detalhe | sim, no detalhe | não |
| Atalho "Abrir no painel" (alterar, cancelar, contato) | sim | sim | não |
| "Abrir o painel completo" | Visão Geral | Visão Geral | Reservas |

- A página confere no servidor (antes de sair HTML) a sessão, o módulo Reservas liberado em `PAINEL_MODULOS` e o papel;
  sem isso mostra "Sem acesso"/"não liberado". O backend continua sendo quem decide (403).
- Sem Financeiro, Estoque, salários ou dados societários: o Modo Operação não chama nenhuma dessas rotas.
- Unidade: toda consulta vai com `unidade=<código>` da sessão (Âmbar Café); conta sem unidade vê o aviso e nada mais.

## Sessão no tablet compartilhado

- Mesma sessão do painel: token só no cookie HttpOnly `ambar_painel` (SameSite=Strict, Secure em https), nada em
  `localStorage` (lá só fica a preferência de tema). A sessão dura o que o backend define e não é renovada pela tela.
- **Sair** (botão no topo ou menu da conta) chama `DELETE /admin/api/sessao` → backend `POST /admin/auth/sair`: a sessão
  é revogada **em todos os aparelhos daquela conta**, e o tablet volta ao login (que depois retorna ao Modo Operação).
  Por isso cada funcionário deve entrar com a própria conta, e sair ao terminar o turno.
- Não há "bloquear tela" separado: sem uma senha de desbloqueio no backend, um bloqueio só de tela seria enfeite. Sair
  é o bloqueio real.

## Acessar localmente

```bash
npm run painel:demo                     # http://127.0.0.1:4480/admin/login → escolha o perfil → /admin/operacao
# com uma API de homologação (não aponte para a produção: o toque em “Cliente chegou” grava de verdade)
PAINEL_MODO=api PAINEL_API_URL=http://127.0.0.1:8090 npm run painel:dev
```

No painel, o item **Modo Operação** fica no rodapé da lateral (para quem opera Reservas). No tablet, abrir
`/admin/operacao` direto (no Chrome do Android, "Adicionar à tela inicial" cria o atalho).

## Testes

```bash
npm run painel:build
npx playwright test -c playwright.painel.config.ts operacao        # 26 testes do Modo Operação
CAPTURAS=<pasta> npx playwright test -c playwright.painel.config.ts operacao -g captura   # capturas para revisão
```

`tests-painel/operacao.spec.ts`: sem sessão → login com volta (demo, api e indisponível); login volta à operação;
resumo e ordem das próximas com o formato da produção; "Cliente chegou" com toque duplo (um pedido só); chegada
antecipada pede confirmação; erro 503; sessão vencida no meio do uso; filtros (atenção, dia inteiro, ambiente); detalhe
com "Não veio" só depois do atraso; sair revoga no backend; Atendente sem contato nem ações de gerência; Proprietário e
Gerente; sem rolagem horizontal e botão ≥ 48 px em tablet 10" e 8" (em pé e deitado), celular 375/390/430 e desktop,
claro e escuro; axe sem violação séria/crítica nos dois temas. O backend falso (`tests-painel/backend-falso.mjs`)
monta um dia de movimento em volta de um instante (`POST /__controle?cenario=<ISO>`), com falha e sessão vencida sob
demanda — nomes fictícios, só de teste.

## Seções: Conversas | Reservas | Ponto (11/11/2026)

O Modo Operação é o painel do **Atendente**: depois do login ele cai aqui (`/admin` → `/admin/operacao`), e "Abrir o
painel completo" leva a Reservas. As seções vêm de `src/admin/modulos/operacao/secoes.ts`; a escolhida fica na URL
(`?secao=ponto`).

- **Conversas**: atalho para o módulo Atendimento do painel (`/admin/atendimento`), com o módulo liberado em
  `PAINEL_MODULOS`.
- **Reservas**: a agenda acima.
- **Ponto**: o terminal **oficial** (`/ponto`, `src/islands/Ponto.tsx`) embutido num iframe da mesma origem
  (`TerminalPonto.tsx`, `allow="camera"`), com o botão "Reiniciar terminal". Aparece com o módulo `equipe` liberado e a
  permissão `ponto.terminal` do backend (Atendente, Gerente e Proprietário). Nada foi reimplementado: câmera, desafio
  de pose, rosto desconhecido, baixa confiança, repetição e "procure o gestor" são do próprio terminal.

**De quem é o ponto:** quem fala com a API do ponto (`/quiosque/ponto/*`) é o **tablet pareado** pelo Proprietário
(Equipe → Tablets, cookie HttpOnly do aparelho), e a marcação é do **funcionário identificado pelo rosto** no backend —
nunca da conta logada. A sessão do Atendente sozinha não marca ponto (401 no quiosque) e não abre cadastro facial,
registros, ajustes nem tablets (403). Sem o tablet pareado, o terminal pede o pareamento ao gestor.

**Câmera:** o middleware libera `Permissions-Policy: camera=(self)` só em `/admin/operacao` (para delegar ao iframe) e
no cadastro facial; o resto do painel continua `camera=()`. O CSP do painel já permite `frame-src 'self'`.

**Conta do Atendente:** criada pelo Proprietário em Configurações → Equipe → **Nova conta** (perfil padrão Atendente);
**Definir nova senha** no menu da pessoa encerra as sessões abertas dela. A senha só é enviada ao salvar e nunca é
exibida. Backend: `POST /admin/usuarios` e `POST /admin/usuarios/{id}/senha` (ver
`giardini_back/docs/equipe-ponto/ATENDENTE-TABLET.md`).

**Limitações:** a prova de vida não é anti-fraude certificada; a identificação automática fica desligada em produção
(`AMBAR_PONTO_IDENTIFICACAO_AUTOMATICA`) até a homologação no tablet e a autorização do dono — até lá o ponto segue pelo
registro assistido. Pendências de LGPD (base legal, RIPD) em `giardini_back/docs/equipe-ponto/TRATAMENTO-DE-DADOS.md`.

**Testes:** `tests-painel/permissoes.spec.ts` (Atendente cai no Modo Operação, seções, iframe `/ponto` com câmera,
política de câmera só nesta página, 1024×768 sem rolagem horizontal; Nova conta e Definir nova senha).
