# Clube Âmbar — arquitetura do frontend e contrato com o backend

> **Situação (2026-10-23):** experiência completa do membro construída sobre o contrato **real** do backend
> (`giardini_back`, `docs/auditoria-ambar/arquitetura/CLUBE.md` §4 e §9; `app/modulos/clube/esquemas.py` e
> `api_publica.py`; commits `47c1d09`, `e410da2`, `ebc8b5d`, `8648b57` e, no fechamento técnico, `b0b0553` — conta
> suspensa, telefone único e histórico real). Em produção o Clube segue em
> **pré-lançamento**: todas as páginas dizem "em breve", sem campos, sem JavaScript do Clube e sem chamar a API.
> Substitui a proposta de 2026-10-20 (carteira em `/clube/membro`, rotas `/clube/membro/*`), que nunca existiu no backend.

## 1. Páginas

| Rota | Composição | O que faz | Backend |
| --- | --- | --- | --- |
| `/clube/` | landing (`sections/ClubePagina.astro`) | apresentação com o acesso primeiro; pede o código e leva para `/clube/entrar`; com sessão, "Abrir minha conta" | real |
| `/clube/entrar/` | tela de acesso (`sections/ClubeFoco.astro`) | WhatsApp e código: reenvio com contagem e limite, trocar número, código incorreto/vencido, sessão vencida, indisponível | real |
| `/clube/cadastro/` | tela de acesso | só o que falta (nome; aceite; aniversário e novidades opcionais) → "Você faz parte do Clube Âmbar!" | real |
| `/clube/ativar/?c=` | tela de acesso | convite do WhatsApp, sem código; sessão de ativação limitada → concluído | real |
| `/clube/conta/` | área do membro (`sections/ClubeAreaMolde.astro`) | saudação, cartão, programa, atalhos, dados, comunicação, sair | real |
| `/clube/historico/` | área do membro | movimentos reais do livro de pontos, por mês, com "ver anteriores"; "em preparação" enquanto o programa estiver desligado | real (`b0b0553`) |
| `/clube/recompensas/` | área do membro | "em preparação", sem ação de resgate | **aguardando** |
| resgate por QR Code | só componente (`components/clube/Resgate.tsx`) | aguardando retirada, utilizado, expirado, cancelado | **aguardando** — sem rota pública |
| `/clube/membro/` | — | redireciona para `/clube/conta/` (endereço antigo) | — |
| `/clube/previa/` | prévia local | todas as telas com dados de exemplo; **só** `astro dev` e build de testes | nenhum |

A ilha de acesso é **uma só** (`islands/ClubeAcesso.tsx`, prop `pagina`: `landing` · `entrar` · `cadastro` ·
`ativar`); a área do membro é `islands/ClubeArea.tsx` (prop `secao`). Peças só de apresentação em
`src/components/clube/` (conta, histórico, recompensas, resgate, ícones) e `components/Carteira.tsx` (o cartão).

## 2. Camada de dados

- [`src/lib/api/clube-acesso.ts`](../../src/lib/api/clube-acesso.ts) — tipos e cliente HTTP do contrato real.
- [`src/lib/api/clube-erro.ts`](../../src/lib/api/clube-erro.ts) — erros normalizados (`sessao`, `codigo`, `versao`, …).
- [`src/lib/api/clube-futuro.ts`](../../src/lib/api/clube-futuro.ts) — **só tipos e bandeiras** de recompensas e
  resgates (`RECURSOS.recompensas` e `.resgates` = `false`). Nenhuma rota inventada. O histórico saiu daqui
  (`RECURSOS.historico` = `true`; a tela ainda depende do programa ativo).
- [`src/lib/telefone.ts`](../../src/lib/telefone.ts) — máscara e validação do telefone (Clube e reserva) com as regras
  do backend (`app/modulos/clientes/telefone.py`).
- [`src/lib/clube-cliente.ts`](../../src/lib/clube-cliente.ts) — endereços (`ROTAS`), destino seguro depois do login
  (`?volta=` só aceita `conta`, `historico`, `recompensas`), passagem do desafio da landing para `/clube/entrar` e o
  gancho `useApiClube` (API real, simulação local ou nenhuma).
- [`src/lib/clube-modo.ts`](../../src/lib/clube-modo.ts) — `indisponivel` (padrão) · `api` · `simulado` (só `astro
  dev`); `CLUBE_PREVIA` (só `astro dev` e `--mode simulado`).
- [`src/lib/api/clube-simulado.ts`](../../src/lib/api/clube-simulado.ts) — API de mentira do `astro dev` (nunca num
  build). [`src/lib/clube-previa.ts`](../../src/lib/clube-previa.ts) — dados de exemplo da prévia (nunca num build
  publicado).

## 3. Contrato real usado

```text
GET    /clube/config            → inscricoesAbertas, programaAtivo, regulamento{versao,url}, privacidade{versao,url},
                                  marketing{textoVersao}, codigo{digitos,validadeS}
GET    /clube/me                → {situacao, membro, cadastro} · 401 sem sessão
POST   /clube/acesso            {telefone} → 202 {desafioId, canal, destino, reenvioEm, expiraEm} (sempre igual)
POST   /clube/acesso/verificar  {desafioId, codigo} → {situacao, membro|null, cadastro|null, sessao{expiraEm}} + cookie
POST   /clube/adesoes           só o que falta → situação (ativado na sessão de ativação, com o cookie apagado)
POST   /clube/convites/ativar   {convite} → ativacao (+ cookie de 30 min) · entrar (sem cookie) · 410
PUT    /clube/me/marketing      {autorizado, textoVersao} → situação · 409 versao_desatualizada
DELETE /clube/me/mensagens      → 204 (desliga avisos de serviço)
GET    /clube/me/movimentos     ?antesDe=&limite= → {programaAtivo, saldo|null, itens[{id, tipo, em, pontos, situacao,
                                  liberarEm, expiraEm, compra{data, valor}|null}], proximo|null} (sessão completa)
POST   /clube/sair              → 204
```

- **Conta suspensa** (gerência, `b0b0553`): `403 {"codigo": "conta_suspensa", "detail": "…"}` em
  `/clube/acesso/verificar` (o código certo é gasto e nenhuma sessão nasce), `/clube/convites/ativar` e em toda rota
  com sessão (`/clube/me`, `/adesoes`, `/me/marketing`, `/me/mensagens`, `/me/movimentos`; o backend revoga a
  sessão). O site mostra "Conta suspensa" com o `detail` e o WhatsApp do Âmbar — sem erro genérico, sem "tentar de
  novo", sem cartão, pontos, histórico ou preferências. Pedir o código (`/clube/acesso`) continua sem revelar nada.
- **Telefone** (`b0b0553`): Clube e reservas recusam o que não é "normalizado" — celular sem o nono dígito, 9
  excedente, DDD inexistente → `422` no campo `telefone`. O site confere antes de enviar com as mesmas regras
  (`lib/telefone.ts`), explica o que conferir e **nunca** acrescenta nem remove o 9; a máscara não corta dígitos a mais e
  mostra o `+55` quando ele veio. O WhatsApp do Clube exige celular; a reserva aceita fixo.
- **Histórico:** `tipo` = `compra` · `estorno` · `resgate_reservado` · `resgate` · `resgate_cancelado` · `expiracao`
  · `ajuste`; `pontos` com sinal; `situacao` (`pendente`/`disponivel`) só em compra. O backend não manda descrição: o
  site escolhe o rótulo pelo tipo e formata data e valor; nada é calculado.

`situacao`: `membro` · `cadastro` · `ativacao` · `ativado` · `entrar`. `membro.programa = {ativo, saldo}` e
`saldo = {pendente, disponivel, reservado}` (null com o programa desligado — a conta mostra "em breve", e passa a mostrar
os pontos sozinha quando o backend ligar o programa, sem redesenho).

- **Sessão:** cookie HttpOnly `__Secure-ambar_clube` (SameSite=Strict). O site não vê nem guarda token: todo `fetch` vai
  com `credentials: "include"`; tudo que muda algo leva `X-Ambar-Csrf: 1`. Nada de `Authorization` nem `localStorage`.
- **Domínio:** só funciona com site e API no mesmo site (`ambarbrunch.com` → `api.ambarbrunch.com`). Em `*.vercel.app` o
  `GET /clube/me` dá 401.
- **Guarda de sessão:** a área do membro confere `GET /clube/me`: 401 → `/clube/entrar/?volta=<seção>`; cadastro ou
  ativação → `/clube/cadastro/`; 401 durante o uso → `/clube/entrar/?motivo=sessao`. A sessão de ativação nunca vê a conta.
- **Passagem landing → entrar:** a landing pede o código e guarda na `sessionStorage` da aba, por instantes, só o
  desafio (id, destino mascarado, prazos); `/clube/entrar` lê e apaga. O número digitado não vai junto; o desafio sem o
  código do WhatsApp não abre nada.
- **Convite:** `/clube/ativar` captura o `c` no `<head>`, guarda só em memória e o tira da URL; `no-referrer`;
  `noindex`; nada é chamado ao abrir. Aparelho compartilhado: com outra sessão aberta, mostra a conta atual e a opção
  "Ativar o convite recebido".
- **Mensagens:** o frontend não dispara nenhuma. Concluído pelo site, a confirmação é só a tela; pelo convite, o backend
  manda uma confirmação no WhatsApp (e a tela diz isso).

## 4. Inconsistências e lacunas encontradas no contrato

1. **Não há rota pública de catálogo, resgate nem QR Code** (`CLUBE.md`: "Fora desta etapa"; proposta em
   `CLUBE-APIS-FUTURAS.md`). O serviço de resgate existe no backend, mas o site não tem como pedir. As telas estão
   prontas e desligadas (`RECURSOS`). O histórico já tem rota (`GET /clube/me/movimentos`) e está ligado.
2. **`DELETE /clube/me/mensagens` não tem volta:** não existe rota para religar os avisos de serviço pelo site. A conta
   mostra "Desligados" sem botão para religar.
3. **Não há rota para editar dados** (nome, aniversário): a conta mostra os dados só para leitura.
4. **Não há número de membro** em `MembroSaida`: o cartão mostra "membro desde" no lugar.
5. **`/clube/config` não traz a URL da política de privacidade quando não configurada** (`url: null`): o site usa a
   própria `/privacidade/`. O regulamento sem URL aparece em texto, sem link — `AMBAR_CLUBE_REGULAMENTO_URL` precisa ser
   configurado antes do lançamento.
6. **A atribuição da visita (mesa NFC/QR, UTM) não chega ao backend:** `AdesaoEntrada.origem` aceita só texto e o backend
   a ignora (usa o desafio). Se for preciso medir as mesas, combinar um campo.

## 5. Como testar

- `npm run dev:clube` — tudo funcionando contra a simulação local, com o painel "Simulação local" (canto inferior
  esquerdo): finais `0001` membro, `0002` cadastro incompleto, `0003` conta suspensa, outro novo; código `123456`
  (`000000` vencido); convites `/clube/ativar?c=demo-novo` · `demo-incompleto` · `demo-ativo` · `demo-suspenso` ·
  `demo-vencido`; "Zerar simulação".
- `/clube/previa/` — cada tela e estado com dados de exemplo (inclusive conta com pontos, histórico, recompensas e QR).
- Testes: `tests/e2e/clube-acesso.spec.ts` (build `dist-sim`, API interceptada imitando o contrato real) e
  `tests/e2e/clube.spec.ts` (pré-lançamento, build de revisão).

## 6. Pendências para o lançamento

1. Backend publicar a API em `api.ambarbrunch.com` e o site em `ambarbrunch.com` (cookie do mesmo site);
   `AMBAR_CLUBE_ORIGENS`, `AMBAR_CLUBE_REGULAMENTO_URL` e `_PRIVACIDADE_URL` configurados.
2. Templates aprovados na Meta (`ambar_clube_codigo_acesso`, `ambar_clube_ativar_cadastro` com
   `https://ambarbrunch.com/clube/ativar?c={{1}}`, `ambar_clube_cadastro_concluido`).
3. Regulamento e política de privacidade do Clube publicados.
4. Na Vercel: `PUBLIC_CLUBE_MODO=api` e `PUBLIC_CLUBE_API_URL` — só com autorização do responsável.
5. Programa de pontos (regras, recompensas, Eyemobile): com `AMBAR_CLUBE_PROGRAMA_ATIVO=true`, a conta mostra o saldo e o
   histórico aparece sozinho. Depois, as rotas de catálogo e resgate no backend; então tipar em `clube-futuro.ts`,
   criar as chamadas em `clube-acesso.ts` e ligar `RECURSOS`.
