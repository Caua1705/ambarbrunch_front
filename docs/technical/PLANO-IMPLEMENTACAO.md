# Plano de implementação — site de reservas Âmbar Brunch

> **Situação (2026-10-16, noite):** aprovado. Etapas **4.0, 4.1, 4.2 e 4.3 concluídas** (homepage completa, menu, CTA, mídia otimizada, reserva com todos os estados contra a API simulada, 74 testes verdes). **4.4 bloqueada** pelo contrato da API. Nada publicado. Relatório: [`RELATORIO-ETAPA-4.md`](RELATORIO-ETAPA-4.md).
> Meta: **site de reservas apresentado em 22/10/2026 (quinta)**, com uso real no soft opening de 24/10.
> Regra aprovada: **a reserva só conta como pronta com integração e testes reais com a API.**
> Base: [design system](../design/design-system/README.md) · [storyboard](../design/HOMEPAGE-STORYBOARD.md) · [componentização](../design/COMPONENTIZATION-PLAN.md).

## 1. Prioridades para 22/10

| Prioridade | O que entra |
| --- | --- |
| **P0 — sem isto não há apresentação** | homepage mobile com a experiência visual completa (seções 1, 2, 4, 5, 6, 8, 10) · menu e CTA fixo · **reserva integrada à API e testada** (ambiente, pessoas, data, horário, dados, confirmação, erros) · seção 9 Visite com endereço, horários e WhatsApp reais · página de privacidade (LGPD) · mídia otimizada · acessibilidade básica (axe sem erros graves) · preview na Vercel |
| **P1 — se couber até 21/10** | seção 3 Novo capítulo (com texto aprovado) · coreografia completa de movimento (entrada do hero, linhas, montagem) · rota `/reservar` (para o link do Instagram) · troca pelas fotos do shooting de 21/10 · JSON-LD com dados confirmados |
| **P2 — depois de 24/10** | seção 7 Na mesa (com conteúdo real do soft opening) · refinamento do desktop · tablet · som com legenda no vídeo de criadora |

Se a API não estiver disponível a tempo, a comanda **não** é apresentada como pronta: fica com o aviso “reservas em breve” e o botão de WhatsApp, e o item continua aberto.

## 2. Estrutura do frontend

```text
astro.config.mjs        site estático; integração Preact (só para a ilha)
src/
├── pages/
│   ├── index.astro             homepage (seções do storyboard)
│   ├── reservar.astro          P1 · a mesma ilha, em página própria
│   └── privacidade.astro       P0 · texto LGPD fornecido pelo cliente
├── layouts/Base.astro          <head>, fontes, metas/OG, skip link, doca (menu + CTA), folha do menu
├── sections/                   Hero · Ticker · NovoCapitulo · MesaCheia · Fornadas · Climas · NaMesa · Reserva · Visite · Footer
├── components/                 um .astro por componente de COMPONENTES.md, com o markup da vitrine
├── islands/ReservaFlow.tsx     Preact: passos, estados, cliente da API
├── lib/                        (já existe) motion · sticky-cta · nav-sheet · videos  +  api/reservas.ts
├── styles/                     (já existe) tokens · base · motion · components/ · sections/
├── content/                    cardápio, sabores, ambientes, vídeos, visita (esquemas com autorizado/fotoAntiga)
└── assets/media/               originais aprovados (processados pelo astro:assets)
public/media/video/             *.web.mp4 + *.poster.webp
scripts/encode-video.mjs        reexporte sem áudio (ffmpeg)
tests/
├── fidelity/                   v1 × implementação (local; precisa do acervo)
├── visual/                     regressão (CI)
└── e2e/                        CTA, menu, reserva (API simulada e real)
experiments/                    intocado; o v1 congelado é a referência
```

Dependências previstas (todas estáveis e pequenas): `astro`, `@astrojs/preact`, `preact`, `@fontsource-variable/bricolage-grotesque`, `@fontsource/fraunces`. Desenvolvimento: `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`, `typescript`. **Nada disso será instalado sem a sua aprovação deste plano.**

## 3. Etapas

Cada etapa termina com um **portão**: os testes indicados passam, ou a etapa não fecha.

| Etapa | Quando | Entrega | Portão |
| --- | --- | --- | --- |
| **4.0 Fundação** | sex 16 → sáb 17 | Astro criado; `src/styles` e `src/lib` importados como estão; fontes auto-hospedadas; `Base.astro`; teste de paridade portado para Playwright | paridade da página montada com os componentes = 0 px em 390×844 |
| **4.1 Seções do v1** | sáb 17 → dom 18 | Hero, Faixa, Mesa cheia, Fornadas, Escolha o clima, casca da Reserva, Rodapé, menu e doca; content collections | paridade por seção (390) · CTA/menu e2e · overflow 0 (360–430) |
| **4.2 Conteúdo e mídia** | dom 18 → seg 19 | Visite com dados reais; Novo capítulo (P1); imagens por `astro:assets`; vídeos reexportados sem áudio; privacidade | Lighthouse dentro do orçamento · axe sem *serious/critical* · nenhum vídeo `autorizado:false` no build |
| **4.3 Reserva (simulada)** | seg 19 | ilha `ReservaFlow` com todos os estados, contra a API **simulada** pelo contrato | e2e de todos os estados (carregando, sem horário, erro de campo, falha de envio, sucesso) · teclado e leitor de tela |
| **4.4 Reserva (real)** | ter 20 → qua 21 | integração com a API FastAPI (staging); CORS; tratamento de erro; preview na Vercel (**com sua autorização**) | **testes reais**: criar, ver na base e cancelar reservas de teste combinadas com o responsável pelo backend; duplicidade; horário esgotado; rede lenta |
| **4.5 Acabamento** | qua 21 | fotos do shooting (se chegarem), revisão de textos, teste em aparelhos reais | iPhone (Safari) e Android (Chrome) reais: reserva completa, CTA, menu, vídeos |
| **Apresentação** | qui 22 | link de preview | produção só com autorização explícita |

## 4. O que precisa chegar, e até quando

| Item | Bloqueia | Prazo para caber em 22/10 |
| --- | --- | --- |
| Contrato da API de reservas (endpoints, campos, erros) + URL de staging + CORS liberado | 4.3 e 4.4 | **seg 19/10** |
| Regras de reserva: antecedência, tamanho máximo do grupo, ambientes reserváveis e capacidade, cancelamento | 4.3 | seg 19/10 |
| Endereço, horários, WhatsApp e Instagram do Âmbar | 4.2 (Visite, rodapé, menu) | dom 18/10 |
| Texto de privacidade (LGPD) e do consentimento | 4.2 e 4.4 | ter 20/10 |
| Autorização dos vídeos da Roll (e da criadora, se for usar IV-05) | 4.2 (Fornadas com vídeo) | ter 20/10 · sem ela, Fornadas usa só fotos |
| Texto do Novo capítulo e revisão dos títulos | 4.2 (P1) | ter 20/10 |
| Fotos do shooting (21/10) | 4.5 (P1) | qua 21/10 · sem elas, ficam as atuais com aviso |
| Acesso à Vercel e ao repositório para o preview | 4.4 | ter 20/10 |

## 5. Testes

| Tipo | Ferramenta | Viewports | Quando |
| --- | --- | --- | --- |
| **Fidelidade ao v1** | `parity.mjs` hoje; Playwright `toHaveScreenshot` por seção a partir da 4.0 | **390×844 (0 px)**; 360, 375, 430 só com desvios aprovados | a cada seção portada (local, precisa do acervo) |
| **Regressão visual** | Playwright, baseline própria no container Linux oficial | 360×740 · 375×667 · 390×844 · 430×932 · 1440×900; Chromium + WebKit | a cada PR (CI) |
| **Funcional (e2e)** | Playwright | 390×844 e 375×667 | a cada PR |
| ↳ CTA e menu | estados da tabela de `NAVEGACAO-E-CTA.md` §2 | | |
| ↳ Reserva | todos os estados com API simulada (`page.route`); fluxo completo com teclado | | |
| ↳ Reserva real | contra o staging, com dados de teste combinados | | 4.4 e antes de cada deploy |
| **Acessibilidade** | `@axe-core/playwright` + revisão manual com VoiceOver e TalkBack | 390 | a cada PR; manual na 4.5 |
| **Performance** | Lighthouse CI (móvel, 4G): LCP ≤ 2,5 s · CLS ≤ 0,05 · INP ≤ 200 ms · JS ≤ 15 KB (+ ilha ≤ 25 KB) · 1ª tela ≤ 400 KB | 390 | a cada PR |
| **Movimento** | DevTools com CPU 4×; Playwright com `reducedMotion` (loops parados, vídeos parados) | 390 | 4.1 e 4.5 |
| **Aparelhos reais** | iPhone com Safari e Android intermediário com Chrome | — | 4.5 |

**Determinismo das capturas:** movimento reduzido, relógio fixo (datas da comanda), fontes locais, vídeos e faixa mascarados, espera de `document.fonts.ready` e das imagens.

## 6. Riscos

| Risco | Efeito | Mitigação |
| --- | --- | --- |
| Contrato da API atrasa | reserva não fica pronta em 22/10 | a ilha é feita pelo contrato simulado; a integração real é o último passo; sem ela, o item fica aberto (não é escondido) |
| Vídeos sem autorização | Fornadas sem vídeo | a seção já funciona só com fotos (bandejas + badge) |
| Fotos novas atrasam | site com fotos antigas | avisos de procedência já fazem parte do desenho |
| Safari iOS | diferenças de `svh`, `dialog`, máscaras | WebKit no CI + iPhone real na 4.5 |
| Prazo curto | qualidade | ordem P0 → P1 → P2; nada de P1 entra antes de P0 estar com portão verde |
