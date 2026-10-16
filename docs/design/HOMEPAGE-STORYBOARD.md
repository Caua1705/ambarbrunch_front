# Homepage — storyboard (Conceito B · Fornada Âmbar)

> **Situação:** **aprovado** (2026-10-16). Nada aqui foi implementado. Decisões registradas abaixo.
> Base visual: `experiments/concept-b-aprovado-v1/` · análise em [`CONCEITO-B-APROVADO.md`](CONCEITO-B-APROVADO.md) · movimento em [`MOTION-PLAN.md`](MOTION-PLAN.md).
> Largura de referência: **390 px**. Também deve funcionar de 360 a 430 px; desktop é secundário.

## Decisões aprovadas (2026-10-16)

1. **Ordem das seções aprovada**, com a Roll e os vídeos integrados na seção 5. Avaliações (seção 7) só se forem reais e autorizadas.
2. **Este é o site de reservas** previsto para 22/10. O formulário só conta como pronto com integração e testes reais com a API.
3. **Com menu:** menu mobile discreto e elegante, sem comprometer a composição. “Reservar” continua sendo a ação principal.
4. Commit dos protótipos e documentos autorizado, com a versão B aprovada preservada.

## A história em uma frase

> *“O Âmbar reabre como Âmbar Brunch: um café e brunch com mesa farta, fornadas assinadas pela Roll e cantos para cada clima — reserve sua mesa.”*

Cada seção responde a uma pergunta do visitante, em ordem, e todas apontam para a reserva:

| # | Seção | Pergunta do visitante | Fundo | Status |
| --- | --- | --- | --- | --- |
| 1 | **Hero · Fornada Âmbar** | Que lugar é este? | vinho | mantido (com correção de dobra) |
| 2 | Faixa de categorias | — (transição e ritmo) | cacau | mantida |
| 3 | **Novo capítulo** | O que mudou? O que é o Âmbar × Roll? | manteiga | **nova** |
| 4 | **Mesa cheia** | O que eu como e bebo? | creme | mantida e ampliada |
| 5 | **Fornadas** (Roll + vídeos) | O que é a Roll? Como é ao vivo? | cacau | mantida; recebe os vídeos |
| 6 | **Escolha o clima** | Onde eu sento? | manteiga | mantida |
| 7 | **Na mesa do Âmbar** (prova social real) | Quem já foi? | creme | **condicional** — só com conteúdo real autorizado |
| 8 | **Reserve sua mesa** (comanda) | Como reservo? | vinho | mantida e completada |
| 9 | **Visite** (localização e funcionamento) | Onde fica? Quando abre? | cacau | **nova** |
| 10 | Rodapé | — | creme | ampliado |

**Mudanças em relação à lista inicial:**
- **“Criações da Roll” e “Vídeos e prova social” viraram uma seção só (5).** Todos os 9 vídeos do acervo são da Roll ou sobre a Roll, e nenhum foi gravado no Âmbar. Uma seção separada de “prova social” agora seria fina e sugeriria avaliações do Âmbar que não existem. O vídeo da criadora (@larizgomes) entra na seção 5, identificado como conteúdo sobre a Roll.
- **A prova social do Âmbar (7) só aparece quando houver material real.** O plano de lançamento prevê captação no soft opening (24/10). Até lá, a seção não é renderizada: nada de espaço vazio ou depoimento de exemplo.
- **Entra o “Novo capítulo” (3):** a página precisa dizer cedo o que é o Âmbar Brunch e qual o papel da Roll, sem que a Roll vire a protagonista.

**Ritmo de cor:** vinho → cacau → manteiga → creme → cacau → manteiga → (creme) → vinho → cacau → creme. Nenhuma cor se repete em sequência, como no protótipo.

**Extensão estimada:** ~7.900 px em 390 (≈ 9,5 telas), contra 6.555 px no protótipo. O acréscimo vem das seções 3 e 9; se a 7 existir, +700 px.

---

## Elementos globais

### CTA fixo “Reservar mesa”
- Mantém o visual do protótipo: barra manteiga, espiral, seta em caixa vinho e sombra deslocada.
- **Regra nova:** fica visível quando o **botão de reserva do hero** não está na tela, em vez de observar o hero inteiro. Em telas onde o hero estoura a dobra, ele aparece desde o início; quando o botão do hero está visível, ele some. Continua oculto dentro da seção de reserva e enquanto o teclado está aberto num campo da comanda.
- **Decisão sua:** o pedido original diz “aparece quando o hero sai da área visível”. A regra nova cumpre isso e ainda cobre o caso das telas baixas. Ver `MOTION-PLAN.md` §7.

### Navegação mínima (aprovada: com menu)
- Não usar header fixo: ele competiria com o hero e com o CTA.
- Um botão redondo “≡” (manteiga, sombra deslocada) no canto superior direito aparece junto com o CTA fixo. Ele abre uma folha inferior com: Cardápio · Fornadas · Ambientes · Visite · Reservar · Instagram.
- Link “pular para a reserva” escondido no topo, visível ao receber foco do teclado.

### Pausar movimento
- Botão discreto “pausar animações” no rodapé e na folha de navegação. Para a faixa, o selo giratório e os vídeos (WCAG 2.2.2). A escolha fica salva no navegador.

### Aviso de fotos antigas
- Enquanto as fotos do espaço anterior estiverem no ar, cada uso leva a etiqueta “foto de referência · espaço anterior” (como no protótipo). A troca pelas fotos novas remove a etiqueta foto a foto, não globalmente.

---

## 1 · Hero · Fornada Âmbar

```
┌──────────────────────────────┐  390 × 844
│      ┌────────────────┐      │
│      │  âmbar         │ ← etiqueta creme (logo oficial)
│      │  CAFÉ & BRUNCH │      │
│      └╰╯╰╯╰╯╰╯╰╯╰╯╰╯┘      │
│ CAFÉ,                        │
│              BRUNCH          │  ← título condensado
│ & FORNADAS                   │
│  ◯croissant   ▭polaroide    │
│        ▢bruschetta  ◉Roll   │  ← colagem (encolhe pela altura)
│ [RESERVAR MESA →]  *foto ref │
└──────────────────────────────┘
```

- **Objetivo:** identidade imediata (Âmbar Brunch, café, brunch, fornadas) e primeiro convite para reservar.
- **Composição:** a do protótipo, sem redesenho. Única mudança: a colagem passa a ter altura **relativa à tela** (`svh`), para o CTA caber sempre na primeira tela de 360×640 a 430×932.
- **Mídia:** OF-15 (logo), FR-07 (croissant), FR-03 (salão, polaroide com asterisco), FR-06 (bruschetta), OF-03 (selo Roll).
- **Gráficos:** etiqueta com borda recortada, faíscas (CR-18), selo de texto circular.
- **Animação:** sequência de entrada (`MOTION-PLAN.md` §2) com a etiqueta e o título visíveis desde o 1º frame, para não atrasar o LCP; a colagem “se monta” peça por peça; parallax leve ao sair.
- **Mobile:** o título nunca quebra palavra (já validado de 360 a 430). Abaixo de 700 px de altura, a polaroide perde 10% e o ladrilho sobe.
- **CTA:** botão manteiga “Reservar mesa”, que é o gatilho do CTA fixo.
- **Faltante / provisório:** foto do **salão novo** para a polaroide (hoje é foto do espaço anterior). Se a foto nova não chegar, trocar a polaroide por um prato e tirar o asterisco.

## 2 · Faixa de categorias

- **Objetivo:** transição com energia; antecipa o cardápio.
- **Composição:** a do protótipo (cacau, −2,5°, sobreposta 16 px ao hero).
- **Conteúdo:** as categorias das págs. 5–6 do PDF. Deve vir da mesma fonte de dados da seção 4, para não divergir.
- **Animação:** loop horizontal que pausa fora da tela, com o “pausar animações” e com movimento reduzido (aí vira texto estático com quebra de linha).
- **CTA:** nenhum.

## 3 · Novo capítulo — *nova*

```
┌──────────────────────────────┐
│ ⓡ selo "27·10 reabertura"    │  ← carimbo (enquanto fizer sentido)
│ O ÂMBAR                      │
│        AGORA É               │
│ BRUNCH.                      │
│ ~com fornadas assinadas      │  ← scribble
│   pela Roll~                 │
│ Texto curto (2–3 linhas).    │
│ [logo Roll em selo creme]    │
└──────────────────────────────┘
```

- **Objetivo:** explicar em 5 segundos o que é o lugar e a hierarquia das marcas: Âmbar Brunch como destino, Roll como assinatura.
- **Composição:** manteiga; mega título vinho em 3 linhas alternadas; scribble; parágrafo curto; selo Roll pequeno. Um **carimbo** circular com a data de reabertura, enquanto ela for notícia, depois trocado por outra mensagem.
- **Mídia:** nenhuma foto, só tipografia (respiro entre o hero e a colagem da Mesa). Opcional: um recorte pequeno, se surgir uma foto da fachada nova.
- **Gráficos:** carimbo (variante do `ticket__stamp`), espiral pequena.
- **Animação:** revelação tipográfica por linha (`MOTION-PLAN.md` §4); o carimbo “bate” uma vez.
- **CTA:** link de texto “Reserve para os primeiros dias →” que leva à seção 8.
- **Faltante / provisório:** **texto oficial** (o título acima é proposta). Precisa confirmar a data de reabertura (o plano de lançamento cita 27/10/2026) e se ela pode ser pública. Não citar nomes de pessoas.

## 4 · Mesa cheia (gastronomia e bebidas)

- **Objetivo:** mostrar que é um brunch completo, não só doce. Comida e bebida antes da Roll.
- **Composição:** a do protótipo (título, quadro com 3 fotos, fitas, notas com setas, faixas “pra comer / pra beber”). Acréscimos:
  - **4ª foto, de bebida**, quando sair o shooting do cardápio (o plano prevê para 21/10). Hoje só há o shake.
  - Link **“ver cardápio completo”**, quando o cardápio digital existir.
- **Mídia:** FR-06, FR-07, FR-05 → substituir pelas fotos novas do shooting assim que aprovadas.
- **Gráficos:** fita, notas manuscritas, setas, pílulas coloridas.
- **Animação:** montagem da colagem (§3), setas se desenhando, pílulas caindo em cascata.
- **Mobile:** o quadro passa a usar unidades relativas (idêntico em 390, proporcional em 360–430).
- **CTA:** nenhum botão próprio (o CTA fixo está visível). Uma nota manuscrita pode virar link “reserve e prove →”.
- **Faltante / provisório:** fotos do cardápio novo; confirmar se as 3 fotos atuais ainda representam o cardápio; cardápio digital. **Preços: não publicar** sem confirmação.

## 5 · Fornadas (Roll, criações e vídeos)

```
┌──────────────────────────────┐ cacau
│ (selo Roll)                  │
│ FORNA                        │
│            DAS               │
│ Os cinnamon rolls do Âmbar   │
│ levam a assinatura da Roll.  │
│ ┌────┐┌────┐┌────┐┌──…       │ ← carrossel vertical (9:16)
│ │forno││sab.││@cri││         │   o card da criadora é identificado
│ └────┘└────┘└────┘          │
│ ● ● ○ ○   ⏸                 │ ← progresso + pausar
│  [Biscoff][Red velvet][Oreo] │ ← leque de bandejas
│  "sabores do mês" (chips)    │
└──────────────────────────────┘
```

- **Objetivo:** apresentar a Roll como assinatura gastronômica dentro do Âmbar, com produto e processo reais. **Não é uma vitrine de loja:** sem preço, sem “comprar”, sem delivery.
- **Composição:** a do protótipo, mais:
  - **Card de criadora** no carrossel: IV-05 (@larizgomes), com etiqueta própria “@larizgomes provou a Roll · set/2026”. Ver as regras abaixo.
  - **Chips “sabores do mês”**, editáveis, porque os sabores mudam todo mês segundo os posts. Os 4 sabores fixos citados (Tradicional, Oreo, Biscoff, Red velvet) ficam nas legendas das bandejas.
- **Mídia:** IV-06 (forno), IV-09 (closes), IV-08 (bandeja), IV-01 (glaceando, só o trecho sem adesivo) e IV-05 (criadora, trecho de 10–20 s com legenda). Bandejas IG-OPT-06, IG-09 e IG-OPT-07.
- **Gráficos:** espiral gigante ao fundo, selo Roll, borda colorida nos cards.
- **Animação:** só toca o card mais visível; barra de progresso tipo story; leque de bandejas abrindo (§6).
- **CTA:** nota final “prove no Âmbar → reservar”.
- **Regras para os vídeos (obrigatórias):**
  1. Toda peça mostra o autor: “vídeo @roll.ofc” ou “@larizgomes · conteúdo sobre a Roll”.
  2. O vídeo da criadora **não pode** ser apresentado como avaliação do Âmbar: ele foi gravado em casa, sobre a box da Roll.
  3. Só entra com autorização escrita (Roll e, no caso de IV-05, a autora).
  4. Arquivos reexportados **sem faixa de áudio**; o depoimento IV-05 é a única exceção possível, com som só por toque do usuário e com legenda.
  5. IV-03 e IV-04 (marca MadNutz e pessoas não identificadas) ficam fora, salvo autorização específica.
- **Faltante / provisório:** autorizações; reexportes sem áudio; sabores do mês atuais; trecho escolhido do IV-05.

## 6 · Escolha o clima (ambientes)

- **Objetivo:** ajudar a escolher onde sentar, o que alimenta a reserva com o ambiente pré-selecionado.
- **Composição:** a do protótipo (painéis diagonais jardim e salão, bolhas lounge e leitura). Acréscimo opcional: uma linha curta por ambiente (“ao ar livre”, “ar-condicionado”…), **só com informação confirmada**.
- **Mídia:** FR-04, FR-03, FR-01, FR-02 → **trocar pelas fotos pós-intervenção**. O plano prevê obras e adesivação de 20 a 23/10 e captação a partir de 24/10.
- **Gráficos:** etiquetas, bolhas, aviso tracejado.
- **Animação:** os painéis deslizam pela diagonal (§5); parallax mínimo nas bolhas.
- **CTA:** “reservar aqui →” em cada ambiente, que rola até a comanda já com o ambiente marcado.
- **Faltante / provisório:**
  - lista oficial de ambientes reserváveis (o sistema antigo tinha Jardim, Salão, Lounge e Sala privativa);
  - capacidade de cada ambiente;
  - fotos novas;
  - se “canto de leitura” continua existindo.

## 7 · Na mesa do Âmbar (prova social real) — *condicional*

- **Objetivo:** mostrar gente real no Âmbar novo.
- **Quando existe:** só depois do soft opening, com fotos e vídeos **do Âmbar** e autorização de imagem. Sem isso, a seção **não é renderizada**.
- **Composição proposta:** mural de polaroides (o padrão do hero) com 4–6 fotos e um vídeo curto; legendas com @ apenas de quem autorizou.
- **O que não entra:** notas e estrelas, depoimentos escritos sem fonte, vídeos da Roll gravados fora do Âmbar.
- **CTA:** “sua mesa é a próxima → reservar”.
- **Faltante:** todo o conteúdo e o fluxo de autorização.

## 8 · Reserve sua mesa (comanda)

```
┌──────────────────────────────┐ vinho
│ RESERVE                      │
│          SUA MESA            │
│ ~e chegue com fome~          │
│ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐   │
│ ┆ COMANDA DE RESERVA  (✓) ┆ ← carimbo muda de estado
│ ┆ 01 ambiente  [chips]    ┆   │
│ ┆ 02 pessoas   [− 2 +]    ┆   │
│ ┆ 03 data      [chips →]  ┆   │
│ ┆ 04 horário   [chips]    ┆ ← vindos da API
│ ┆ 05 seus dados (expande) ┆   │
│ ┆ [CONTINUAR]             ┆   │
│ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘   │
└──────────────────────────────┘
```

- **Objetivo:** concluir a reserva no próprio fluxo da página, sem sair da história.
- **Composição:** a comanda do protótipo, com os passos que faltam:
  - **05 · seus dados:** nome, WhatsApp/telefone, e-mail (se a API pedir), observações e aceite de privacidade;
  - **revisão:** a comanda “impressa” com o resumo;
  - **confirmação:** o carimbo passa de “prévia” para “reservado”, com código e botões de adicionar à agenda e falar no WhatsApp;
  - **estados:** carregando horários, sem horários na data, erro de rede, grupo acima do limite (encaminha ao WhatsApp).
- **Rota própria `/reservar`**, com o mesmo componente, para links diretos (Instagram, QR code). Na home, a comanda fica embutida.
- **Mídia:** nenhuma foto dentro da comanda; foco no formulário.
- **Animação:** microinterações (§8 do motion).
- **CTA:** é o destino de todos os CTAs. O CTA fixo fica oculto aqui.
- **Faltante / provisório:**
  - contrato da API FastAPI de reservas (endpoints, campos, regras);
  - política de reserva: tolerância de atraso, limite de pessoas, antecedência mínima e máxima;
  - texto de privacidade (LGPD);
  - canal de confirmação (WhatsApp ou e-mail).
  - **Horários não serão inventados:** vêm da API.

## 9 · Visite (localização e funcionamento) — *nova*

```
┌──────────────────────────────┐ cacau
│ VISITE                       │
│      O ÂMBAR                 │
│ ┌─ placa creme ───────────┐ │
│ │ Rua …, nº … — bairro    │ │
│ │ Fortaleza · CE (?)      │ │
│ │ [COMO CHEGAR ↗]         │ │
│ └─────────────────────────┘ │
│ ┌─ ticket de horários ────┐ │
│ │ ter–dom  ··· a confirmar│ │
│ └─────────────────────────┘ │
│ [WhatsApp] [Instagram Âmbar] │
│ [Instagram Roll]             │
└──────────────────────────────┘
```

- **Objetivo:** responder onde fica e quando abre. É o “segundo CTA”: quem não reserva agora precisa saber chegar.
- **Composição:** cacau; mega título manteiga; **placa** creme com o endereço (variação da etiqueta do hero) e **ticket de horários** (variação da comanda). Botões “Como chegar” (link para o app de mapas, **sem mapa embutido**, que é pesado e coleta dados), WhatsApp e Instagram.
- **Mídia:** opcional, foto da fachada nova.
- **Gráficos:** etiqueta, ticket picotado, espiral pequena como pino.
- **Animação:** placa entra levemente rotacionada (§3); sem loops.
- **CTA:** “Reservar mesa” ao lado de “Como chegar”.
- **Faltante (tudo):** endereço completo, horário por dia, telefone/WhatsApp, Instagram do Âmbar, estacionamento e acessibilidade (se houver), confirmação da cidade (Fortaleza-CE é só um indício vindo de uma hashtag).

## 10 · Rodapé

- Logo Âmbar (OF-15), “com assinatura gastronômica” + Roll.
- Links: Reservar · Cardápio · Instagram · Política de privacidade.
- “Pausar animações”.
- Créditos de imagem quando exigidos pela autorização: “vídeos e fotos da Roll: @roll.ofc”.
- Dados legais, se o cliente quiser (razão social, CNPJ).

---

## Conteúdo necessário, consolidado

| Item | Seções | Bloqueia? | Fonte esperada |
| --- | --- | --- | --- |
| Endereço, horários, WhatsApp, Instagram do Âmbar | 9, 10 | **sim** | proprietários |
| Contrato da API de reservas e política de reserva | 8 | **sim** (para o fluxo real) | backend FastAPI / proprietários |
| Lista e capacidade dos ambientes reserváveis | 6, 8 | **sim** | proprietários |
| Autorização dos vídeos (Roll; @larizgomes para IV-05) | 5 | sim, para a seção 5 com vídeo | Roll / criadora |
| Fotos do cardápio novo (shooting previsto para 21/10) | 1, 4 | não (há fotos atuais) | marketing |
| Fotos do espaço pós-intervenção (captação a partir de 24/10) | 1, 6 | não (há aviso de foto antiga) | marketing |
| Texto do “Novo capítulo” e revisão de todos os títulos e scribbles | 3–9 | não | cliente |
| Data de reabertura pública | 3 | não | proprietários |
| Sabores do mês atuais da Roll | 5 | não | Roll |
| Conteúdo real do soft opening (com autorização) | 7 | não (seção condicional) | marketing |
| Texto de privacidade (LGPD) | 8, 10 | sim, antes de coletar dados | jurídico / proprietários |

## Prazo — atenção

O plano de lançamento (`docs/brand/plano-lancamento-contexto.pdf`, contexto interno) prevê a **apresentação do novo site de reservas aos proprietários em 22/10/2026** e o uso real no soft opening de **24/10**. Se este site for esse “site de reservas”, sugiro duas fases:

1. **Até 22/10:** homepage com as seções 1–6, 8 e 10 usando o acervo atual (com os avisos); comanda conectada à API (se o contrato chegar a tempo) ou ligada ao WhatsApp como plano B; seção 9 com os dados que existirem.
2. **Depois de 24/10:** troca das fotos pelas do shooting e da operação real, seção 7 (se houver conteúdo autorizado) e ajustes do “Novo capítulo” após a reabertura.

**Confirmado (2026-10-16):** este projeto é o “site de reservas” do plano. A reserva só é considerada pronta com integração e testes reais.
