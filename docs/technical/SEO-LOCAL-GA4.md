# SEO local, Search Console e GA4 — Âmbar

> 30/10/2026 · branch `seo-local-ga4` (worktree `ambarbrunch_front-seo`). O visual do site e o fluxo de reservas não
> mudam: no `<body>`, o HTML de produção é idêntico ao da `main` (só o `uid` interno das ilhas muda com o hash do JS).

## O que o código já faz

| Item | Onde | Situação |
| --- | --- | --- |
| Título e descrição locais (Meireles, Fortaleza) na home e em `/reservar/` | `src/data/seo.ts`, `src/pages/reservar.astro` | no ar com o deploy |
| `<link rel="canonical">` sempre em `https://ambarbrunch.com` (o mesmo site responde em `ambarbrunch-front.vercel.app`) | `src/layouts/Base.astro` | no ar com o deploy |
| Open Graph completo + imagem 1200 × 630 (salão principal) | `Base.astro`, `imagensSeo()` em `src/data/seo.ts` | no ar com o deploy |
| Dados estruturados `CafeOrCoffeeShop` + `WebSite` (nome, endereço, CEP, horário, reserva, Instagram) | `src/pages/index.astro`, `src/data/seo.ts` | no ar com o deploy |
| `/robots.txt` (só `/admin/` bloqueado) e `/sitemap.xml` (`/` e `/reservar/`) | `src/pages/robots.txt.ts`, `src/pages/sitemap.xml.ts` | no ar com o deploy |
| Meta de verificação do Search Console (opcional; o recomendado é DNS) | `PUBLIC_GSC_VERIFICACAO` | só se definida |
| GA4 com conversões, sem dados pessoais | `src/components/Medicao.astro`, `src/lib/medicao.ts`, `src/lib/medicao-config.ts` | **desligado** até as duas condições abaixo |

Fora de propósito (nada inventado): **telefone público, coordenadas, faixa de preço e avaliações não entram** nos dados
estruturados até o responsável confirmar. O cardápio para o Google Maps é de outra frente e não foi tocado aqui.

### Quando o GA4 liga

Só com **as duas coisas** (`MEDICAO_LIGADA` em `src/lib/medicao-config.ts`):

1. `PUBLIC_GA4_ID` = `G-…` na Vercel (Production);
2. `medicao.aprovada: true` em `src/data/privacidade.ts` — o texto da seção de medição aprovado pelo responsável.

Motivo: a política publicada (Versão 2026-11-v1) diz que o site **não usa cookies de rastreamento**. Com o GA4 isso
deixa de ser verdade, então a seção “Cookies…” é trocada pela de medição e a versão passa a **2026-11-v2**. Com o ID e
sem a aprovação, o build avisa no log e o GA4 fica fora. ID com formato errado derruba o build (o site no ar continua o
anterior). Nunca no `astro dev` nem no build de revisão. Para ler o texto proposto: `npm run build:revisao` →
`/privacidade/` (aparece marcado como rascunho, com as notas “Validar”).

### O que vai — e o que nunca vai — ao Google

- **Publicidade desligada:** consentimento de anúncios negado (`ad_storage`, `ad_user_data`, `ad_personalization`),
  `allow_google_signals: false`, `allow_ad_personalization_signals: false`.
- **URL limpa:** `page_location` e `page_referrer` sem query string e sem fragmento; só `utm_*` passa (atribuição de
  campanha). Nenhum token, telefone ou nome pode ir pela URL.
- **Páginas não medidas:** `/clube/*` (área do membro e link de convite com token), `/admin/*`, `/design-system/`.
- **Cookie `_ga` de 13 meses** (`cookie_expires` = 395 dias), não os 2 anos do padrão.
- **Recusa:** botão “Não medir minhas visitas” em `/privacidade/` (fica só no navegador, `localStorage`
  `ambar:medicao`); com ela, ou com o sinal Global Privacy Control, o GA4 nem carrega.
- **Desempenho:** `gtag.js` só baixa depois do `load`, no tempo ocioso.
- A chave secreta do Measurement Protocol **nunca** vai ao frontend (o site não a usa).

### Eventos

| Evento | Quando | Parâmetros (só categorias e números) | Marcar como evento-chave? |
| --- | --- | --- | --- |
| `reserva_concluida` | API criou a reserva (confirmada ou pendente) | `situacao`, `ambiente` (id), `pessoas`, `dia_semana`, `hora`, `antecedencia_dias` | **Sim (principal)** |
| `como_chegar` | clique no mapa “Como chegar” do rodapé | `origem` | Sim |
| `abrir_reserva` | clique em qualquer “Reservar mesa” | `origem` (`hero`, `menu`, `botao_fixo`, `ambiente`, `link`) | Não (funil) |
| `adicionar_agenda` | “Adicionar à agenda” na confirmação | — | Não |
| `abrir_instagram` | clique no Instagram | `perfil` (`ambar`, `roll`) | Não |
| `page_view` | cada página medida (`/reserva-confirmada/` conta como página de sucesso) | — | Não |

Nunca vão: nome, telefone, e-mail, observações, código da reserva. Testado (ver “Testes”).

## Etapas manuais — na ordem

### 1. Publicar este código

Branch `seo-local-ga4` → revisão → merge na `main` → push (deploy automático da Vercel). Sem nenhuma variável nova,
o deploy já publica SEO, robots, sitemap e dados estruturados; o GA4 continua fora.

### 2. Search Console — propriedade de domínio (verificação por DNS na Cloudflare)

O DNS de `ambarbrunch.com` está na **Cloudflare** (`shane.ns.cloudflare.com`). Verificação por DNS cobre `https`,
`www` e qualquer subdomínio, e não põe nada no site.

1. https://search.google.com/search-console → **Adicionar propriedade** → coluna **Domínio** → digite
   `ambarbrunch.com` → **Continuar**.
2. Copie o registro TXT que o Google mostrar (começa com `google-site-verification=`). Não feche a janela.
3. https://dash.cloudflare.com → conta → **ambarbrunch.com** → **DNS** → **Records** → **Add record**:
   - **Type:** `TXT`
   - **Name:** `@`
   - **Content:** o texto inteiro copiado (`google-site-verification=…`)
   - **TTL:** `Auto` → **Save**.
   - **Não** apague nem edite o TXT de SPF que já existe (`v=spf1 include:_spf.mx.cloudflare.net ~all`): são
     registros separados.
4. Volte ao Search Console → **Verificar**. Se falhar, espere de 5 a 60 min e tente de novo
   (`nslookup -type=TXT ambarbrunch.com` mostra o registro quando já propagou).
5. Deixe o registro TXT para sempre (apagar desfaz a verificação).

> Alternativa só se o DNS não puder ser mexido: propriedade **Prefixo do URL** `https://ambarbrunch.com/` → método
> **Tag HTML** → copie só o valor de `content="…"` → Vercel → projeto `ambarbrunch-front` → Settings → Environment
> Variables → `PUBLIC_GSC_VERIFICACAO` (Production) → **Redeploy** → **Verificar**.

### 3. Search Console — depois de verificado

1. **Sitemaps** → “Adicionar um novo sitemap”: `sitemap.xml` → **Enviar**. Status esperado: “Sucesso”, 2 URLs.
2. **Inspeção de URL** → `https://ambarbrunch.com/` → **Solicitar indexação**. Repita para
   `https://ambarbrunch.com/reservar/`.
3. Teste os dados estruturados: https://search.google.com/test/rich-results com `https://ambarbrunch.com/` — deve
   achar “Empresa local” sem erros. Opcional: https://validator.schema.org.
4. (Opcional) **Configurações → Associações** → associar à propriedade do GA4 (depois do passo 4).

### 4. GA4 — criar propriedade e fluxo

1. https://analytics.google.com → **Administrador** → **Criar** → **Propriedade**:
   - Nome: `Âmbar — site` · Fuso horário: **Brasil — (GMT-03:00) Fortaleza** (ou o horário de Brasília) ·
     Moeda: **Real brasileiro (R$)** → Avançar → dados da empresa → objetivos: “Gerar leads” → **Criar**.
2. Plataforma **Web** → URL `ambarbrunch.com` (https) → nome `Site ambarbrunch.com`.
   Em **Medição otimizada**, clique na engrenagem e deixe **assim**:
   - Visualizações de página: **ligado** — e, em “Mostrar configurações avançadas”, **desmarque** “Mudanças de página
     com base em eventos de histórico de navegação”;
   - Rolagens: ligado · Downloads de arquivos: ligado;
   - **Cliques de saída: desligado** (os cliques que importam já são eventos próprios, sem URL);
   - **Pesquisa no site: desligado** · **Interações de formulário: desligado** · **Engajamento com vídeo: desligado**.
   → **Criar fluxo**.
3. Copie o **ID da métrica** (`G-XXXXXXXXXX`). É público (vai no HTML), mas **não** crie “Chaves secretas da API do
   Measurement Protocol” — o site não usa.
4. **Administrador → Coleta e modificação de dados → Retenção de dados** → eventos: **14 meses** → Salvar.
5. **Administrador → Coleta de dados**: **Google Signals desligado** (é o padrão; confira).
6. (Opcional) **Fluxos de dados → o fluxo → Configurar as definições da tag → Definir tráfego interno**: o IP da
   internet do café, para não contar a equipe. Depois, em **Filtros de dados**, ative o filtro “Internal Traffic”.

### 5. GA4 — dimensões e eventos-chave

**Administrador → Definições personalizadas → Criar dimensão personalizada** (escopo **Evento**), uma por linha:

| Nome da dimensão | Parâmetro do evento |
| --- | --- |
| Situação da reserva | `situacao` |
| Ambiente | `ambiente` |
| Dia da semana da visita | `dia_semana` |
| Horário da visita | `hora` |
| Origem do clique | `origem` |
| Perfil do Instagram | `perfil` |

**Criar métrica personalizada** (escopo Evento, unidade Padrão): `Pessoas na reserva` → `pessoas`;
`Antecedência (dias)` → `antecedencia_dias`.

**Eventos-chave:** os eventos só aparecem na lista depois de acontecerem uma vez. Para não esperar:
**Administrador → Eventos-chave → Novo evento-chave** → `reserva_concluida` → Salvar; de novo para `como_chegar`.

### 6. Ligar o GA4 no site

1. O responsável lê e aprova o texto em `src/data/privacidade.ts` → `medicao` (no build de revisão,
   `/privacidade/`). Pontos para decidir: base legal (legítimo interesse com recusa simples vs. aviso de consentimento,
   que muda o visual) e a transferência internacional (Google). Aprovado: `aprovada: true` → commit na `main`.
2. Vercel → `ambarbrunch-front` → **Settings → Environment Variables** → **Add**: Key `PUBLIC_GA4_ID`, Value
   `G-XXXXXXXXXX` (o do passo 4.3), Environment **Production** apenas → Save.
3. Push/redeploy (variável `PUBLIC_*` só vale a partir de um novo build).
4. Na VPS, registrar a nova versão da política (a que vai em cada aceite de reserva):
   `docker exec ambar-api python -m app.cli aprovar-privacidade --unidade ambar_cafe --versao 2026-11-v2`
   (não fecha nem reabre as reservas; só troca a versão registrada).
5. Conferir: `/privacidade/` mostra “Versão 2026-11-v2” e o botão “Não medir minhas visitas”; o código-fonte da home
   tem `gtag/js?id=G-…` (no Chrome: Ver código-fonte → procurar `G-`).

### 7. Validar a medição

1. GA4 → **Relatórios → Tempo real**: abra `https://ambarbrunch.com/?utm_source=teste&utm_medium=manual` no celular —
   aparece 1 usuário, origem `teste`.
2. Com a extensão **Tag Assistant** (https://tagassistant.google.com) conectada ao site, clique em “Reservar mesa” e em
   “Como chegar” → aparecem `abrir_reserva` e `como_chegar` em **Administrador → DebugView**.
3. Reserva de teste real (marque e depois cancele pelo painel) → `reserva_concluida` com `situacao`, `ambiente`,
   `pessoas`… e **nada** de nome, telefone ou código.
4. Depois de 24–48 h: **Relatórios → Engajamento → Eventos-chave** mostra `reserva_concluida`.

### 8. Links com origem (atribuição)

O site preserva só `utm_*`. Use estes links para saber de onde vêm as reservas:

| Onde | Link |
| --- | --- |
| Perfil da Empresa no Google — campo **Site** | `https://ambarbrunch.com/?utm_source=google&utm_medium=organic&utm_campaign=perfil_empresa` |
| Perfil da Empresa no Google — link de **Reservas** | `https://ambarbrunch.com/reservar/?utm_source=google&utm_medium=organic&utm_campaign=perfil_empresa_reserva` |
| Bio do Instagram @ambarbrunch | `https://ambarbrunch.com/reservar/?utm_source=instagram&utm_medium=social&utm_campaign=bio` |
| QR code da mesa/balcão | `https://ambarbrunch.com/reservar/?utm_source=qrcode&utm_medium=offline&utm_campaign=loja` |

O canonical continua sem parâmetros: os links com `utm_` não viram páginas duplicadas no Google.

### 9. Perfil da Empresa no Google (NAP igual em todo lugar)

- O **nome** dos dados estruturados é `Âmbar` (`src/data/seo.ts`, `seo.nome`), o nome pedido ao Google para o Perfil
  da Empresa em 30/10/2026, com “Âmbar Café”, “Âmbar Brunch” e “Âmbar Café & Brunch” como nomes alternativos. “Cafeteria”
  e “brunch” ficam no título e na descrição (não no nome: o Google pede o nome real, sem palavras-chave). **Tem de ser
  idêntico ao nome do Perfil da Empresa.** Se o Google recusar a alteração, volte `seo.nome` para o nome que ficar.
- Endereço do perfil: `Rua Tavares Coutinho, 1580 - Meireles, Fortaleza - CE, 60160-130`; horário: todos os dias,
  07:00–19:00 — os mesmos do site. Mudou o horário? Mude `visita.horarios` **e** `seo.abre`/`seo.fecha`.
- Telefone: o site não publica telefone (decisão de 29/10/2026). Se o perfil tiver um número público e o responsável
  quiser o mesmo no site, ele entra em `dadosEstruturados()` como `telephone`.
- Quando houver o link do perfil (`https://maps.app.goo.gl/…` ou `https://www.google.com/maps?cid=…`), ele pode entrar
  em `hasMap` e em `visita.mapaUrl` (o “Como chegar” passa a abrir o perfil em vez de uma busca pelo endereço).

### 10. Opcional — `ambarbrunch-front.vercel.app`

O canonical já diz ao Google que o oficial é `ambarbrunch.com`. Para não haver nenhuma cópia acessível: Vercel →
Settings → Domains → `ambarbrunch-front.vercel.app` → **Edit** → **Redirect to** `ambarbrunch.com` (308). Antes,
confirme que ninguém da equipe usa o painel `/admin` por esse endereço.

## Testes

- `tests-reservas/seo-e-medicao.spec.ts` (no `npm run build:reservas-api` + `npx playwright test -c
  playwright.reservas.config.ts`): canonical, Open Graph e imagem publicada; JSON-LD sem dado inventado;
  noindex mantido nas páginas fora do Google; robots e sitemap; **sem GA4 aprovado, nenhum pedido ao Google** da home
  até a reserva concluída, e a política continua a 2026-11-v1.
- Verificação do GA4 ligado (30/10/2026, build descartável com ID de teste e `aprovada: true` só na cópia, `gtag.js`
  substituído e nenhum envio ao Google): consentimento de anúncios negado, URL sem `?c=`/nome e com `utm_*`,
  `reserva_concluida` com os parâmetros esperados e sem nome/telefone/código, cliques medidos, Clube sem GA4, recusa e
  Global Privacy Control desligando tudo.
