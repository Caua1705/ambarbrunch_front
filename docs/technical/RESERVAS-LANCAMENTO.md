# Reservas públicas — pronto para o lançamento

> 28/10/2026. Backend lido (só leitura) em `giardini_back` `65e8fb3` (abertura e máximo por reserva = lotação).
> Produção conferida em 28/10: `GET /reservas/config` → 503 `reservas_indisponiveis` (política com
> `aceita_reservas=false`); segundo a sessão do backend, `AMBAR_RESERVAS_ABERTURA=2026-11-03` em produção.

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
  422 de data/hora (prazo, abertura) mostra a mensagem e recarrega; erro técnico deixa "Tentar de novo" com a mesma
  `Idempotency-Key` (nada duplica); clique duplo não manda dois pedidos.
- **Fuso**: "hoje" do calendário é o de America/Fortaleza (vem da config), em qualquer fuso do navegador.

## A data de abertura (06/11/2026)

A fonte de verdade é o backend (`AMBAR_RESERVAS_ABERTURA`): o site não tem data fixa no código. Hoje a produção está
em **2026-11-03**: se as reservas fossem abertas assim, o site ofereceria 03, 04 e 05/11. Por isso, antes de publicar:

```bash
node scripts/conferir-abertura-reservas.mjs          # só leituras na API de produção
# 0 = pronto (nada antes de 06/11, e 06/11 com horários) · 1 = divergência · 2 = reservas fechadas na API
```

## Para publicar (nesta ordem)

1. Backend: `AMBAR_RESERVAS_ABERTURA=2026-11-06` em produção (outra sessão).
2. Backend: aprovar a privacidade e abrir as reservas (`aceita_reservas=true`) — decisão do responsável.
3. Rodar `node scripts/conferir-abertura-reservas.mjs` → precisa sair 0.
4. Vercel (Production): `PUBLIC_RESERVAS_MODO=api` e `PUBLIC_RESERVAS_API_URL=https://api.ambarbrunch.com`
   (hoje estão em `indisponivel`; são lidas no build).
5. Push da `main` (com autorização) → deploy de produção. Conferir em `https://ambarbrunch.com/reservar/`.

A ordem 4–5 antes de 1–3 também é segura: com a API fechada o site mostra o aviso e não oferece nada; mas, se as
reservas forem abertas no backend antes do passo 1, o site ofereceria 03–05/11 (é a API que decide).

CORS conferido em 28/10: a API libera `https://ambarbrunch.com` e `https://ambarbrunch-front.vercel.app`;
`www.ambarbrunch.com` redireciona (308) para `ambarbrunch.com`.

## Testes

```bash
npm run build:reservas-api && npm run test:reservas-api   # modo API com a API interceptada (formato real do backend)
```

`tests-reservas/` cobre: 05/11 e anteriores bloqueados, 06/11 primeira data com horários 07:00–16:00, ocupação
parcial, dia fechado por evento, limite de 60 dias, ambiente lotado, máximo por ambiente, confirmação (corpo e
Idempotency-Key), clique duplo, erro de API, horário esgotado (409), data recusada (422), API fechada e reaberta sem
build, erro de configuração, fuso de Fortaleza, navegação a partir do botão da home e celular 375/390/430 px — em
Chromium (celular e desktop) e WebKit (celular).

Pendente: o mesmo roteiro no navegador contra a homologação real (`127.0.0.1:8090`), que não pôde ser ligada em
28/10 por falta de memória na máquina.
