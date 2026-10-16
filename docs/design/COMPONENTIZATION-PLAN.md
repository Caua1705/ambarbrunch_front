# Plano de componentização — do protótipo B ao código definitivo

> **Situação:** aprovado (2026-10-16). O design system já foi extraído para `src/styles/` e `src/lib/` ([`design-system/`](design-system/README.md)); a aplicação Astro ainda não foi criada.
> Fonte da verdade visual: `experiments/concept-b-aprovado-v1/` (código, não screenshots).
> Relacionados: [`CONCEITO-B-APROVADO.md`](CONCEITO-B-APROVADO.md) · [`HOMEPAGE-STORYBOARD.md`](HOMEPAGE-STORYBOARD.md) · [`MOTION-PLAN.md`](MOTION-PLAN.md) · [`../technical/ARCHITECTURE.md`](../technical/ARCHITECTURE.md).

## 1. Stack recomendada

### Recomendação: **Astro** + CSS próprio + TypeScript, com uma única ilha interativa para a reserva

| Peça | Escolha | Por quê |
| --- | --- | --- |
| Framework | **Astro** (versão estável atual) | O protótipo é HTML + CSS + um pouco de JS. Astro gera HTML estático e manda **zero JS por padrão**, então o markup e o CSS do v1 entram quase sem alteração em componentes `.astro`. |
| Estilos | **CSS próprio** (custom properties + estilos com escopo do Astro) | O visual depende de máscaras, `clip-path`, rotações, sombras deslocadas e posições calculadas. Reescrever em utilitários (Tailwind) traria risco de perder fidelidade sem ganho. Os tokens do v1 viram `tokens.css`. |
| Interatividade leve | **TypeScript puro**: um módulo `motion.ts` com observer compartilhado, CTA fixo, vídeos e pausa global | São ~80 linhas hoje; não justificam framework. |
| Reserva | **Uma ilha Preact** (`client:visible`) | É o único trecho com estado real: 5 passos, chamadas assíncronas à API e estados de erro. Preact pesa ~4 KB e tem modelo conhecido (JSX/hooks). Só carrega quando a comanda se aproxima da tela. A mesma ilha serve a rota `/reservar`. |
| Imagens | **`astro:assets`** (sharp) | Gera AVIF/WebP, `srcset` e dimensões fixas (sem CLS) a partir dos originais aprovados. Resolve o JPG de 995 KB e o PNG da Roll de 117 KB sem trabalho manual. |
| Vídeos | Reexporte com **ffmpeg** (script no repositório) para `public/media/video/*.web.mp4` + poster `*.poster.webp` | H.264 720p, ~1 Mbps, **sem faixa de áudio**, ≤ 1,5 MB por vídeo. Segue a política de `public/media` do `.gitignore`. |
| Fontes | Auto-hospedadas (pacotes Fontsource da Bricolage Grotesque e da Fraunces, subset latino, `font-display: swap`) | Remove o CDN externo e deixa a renderização determinística para os testes visuais. |
| Conteúdo | **Content collections** do Astro (JSON/YAML com esquema validado) | Cardápio, sabores do mês, ambientes, vídeos e dados de visita ficam editáveis sem tocar no layout. O esquema obriga campos como `autorizado` e `fotoAntiga`. |
| Deploy | Vercel (estático) | Combina com o fluxo GitHub → Vercel previsto. A reserva conversa com a API FastAPI existente por HTTPS. |
| Testes | Playwright (visual + e2e) + axe-core + Lighthouse CI | Ver §6. Só dependências de desenvolvimento. |

### Alternativas consideradas

| Opção | Por que não |
| --- | --- |
| **Next.js / React SPA** | Hidrataria a página inteira (dezenas de KB de JS) para um conteúdo quase todo estático. Mais complexidade de servidor do que o site precisa. |
| **Vite + HTML puro** | Leve, mas sem pipeline de imagens, sem componentes, sem coleções de conteúdo e sem rotas. Acabaria reinventando o Astro. |
| **SvelteKit** | Tecnicamente bom, mas o ganho sobre Astro + ilha é pequeno aqui, e o modelo de componentes do Astro é mais próximo do HTML do protótipo. |
| **Tailwind** | Ver “Estilos” acima. |
| **GSAP / Motion / Lenis** | Ver `MOTION-PLAN.md` §10. |

## 2. Estrutura de pastas proposta

```text
src/
├── pages/
│   ├── index.astro            homepage (seções 1–10 do storyboard)
│   ├── reservar.astro         rota direta da comanda (mesma ilha)
│   └── privacidade.astro
├── layouts/
│   └── Base.astro             <head>, fontes, meta/OG, JSON-LD, skip link, CTA fixo, folha de navegação
├── sections/                  uma por seção do storyboard
│   ├── Hero.astro  Ticker.astro  NovoCapitulo.astro  MesaCheia.astro  Fornadas.astro
│   └── Climas.astro  NaMesa.astro  Reserva.astro  Visite.astro  Footer.astro
├── components/                primitivos visuais (ver §3)
├── islands/
│   └── ReservaFlow.tsx        Preact — passos, estados e cliente da API
├── lib/
│   ├── motion.ts              observer compartilhado, reveal, CTA fixo, vídeos, pausa global
│   └── api/reservas.ts        cliente da API (definido com o contrato real)
├── styles/
│   ├── tokens.css             cores, tipografia, raios, sombras, movimento
│   ├── base.css               reset, corpo, foco, utilitários mínimos
│   └── motion.css             keyframes, regras de reduced-motion e pausa
├── content/                   cardápio, sabores, ambientes, vídeos, visita (com esquema)
└── assets/media/              originais APROVADOS (vindos de creative/approved)
public/media/video/            vídeos .web.mp4 e posters (política do .gitignore)
scripts/encode-video.mjs       reexporte padronizado com ffmpeg
tests/visual/  tests/e2e/      Playwright
experiments/                   intocado (o v1 é a referência)
```

## 3. Mapa de componentes (do protótipo para o código)

Os **nomes de classe do v1 são mantidos** dentro de cada componente, para comparar o CSS lado a lado com o protótipo.

### Primitivos

| Componente | Origem no v1 | Props principais | Notas |
| --- | --- | --- | --- |
| `MegaTitle` | `.mega`, `.mega__r`, `.mega--light`, `.mega--wine` | `lines: {text, align}[]`, `tone`, `as` (h1/h2) | Texto real no DOM; máscara por linha para a revelação |
| `Scribble` | `.scribble`, `--light` | `tone`, `tilt` | |
| `Button` | `.btn`, `--butter`, `--wine`, `--block` | `variant`, `href`/`type`, `icon` | Sombra deslocada, press |
| `Chip`, `ChipGroup` | `.chip`, `.chips`, `--dates` | `options`, `value`, `variant` | `role="radiogroup"` em vez de só `aria-pressed` |
| `Stepper` | `.stepper` | `min`, `max`, `value` | |
| `Label` (etiqueta recortada) | `.hero__label h1` | `edge: scallop` | A máscara vira utilitário `--mask-scallop` |
| `Ticket` (comanda picotada) | `.ticket` | `stamp` | Máscara `--mask-perforated` |
| `Stamp` | `.ticket__stamp` | `text`, `state` (prévia/reservado/erro) | |
| `StickerRing` | `.sticker--roll` | `text`, `logo`, `spin` | Respeita a pausa global |
| `Badge` | `.roll__badge` | `logo` | |
| `Cut` | `.cut--circle`, `--polaroid`, `--tile` | `shape`, `image`, `caption`, `r` (rotação), `pos` | Posição em unidades do protótipo (§4) |
| `Framed` (foto com moldura e fita) | `.board__item`, `.tape` | `image`, `tape`, `r`, `pos` | |
| `Note` + `Arrow` | `.note`, `.arrow--a/b/c` | `text`, `dir`, `pos` | Seta como SVG com traço desenhável |
| `Band` | `.bands__list li` | `label`, `bg`, `fg` | Vem do conteúdo do cardápio |
| `Ticker` | `.ticker` | `items` | Mesma fonte do cardápio |
| `Panel` | `.panel--day`, `--amber` | `image`, `tagline`, `diagonal`, `ambiente` | `RefTag` automático se `fotoAntiga` |
| `Bubble` | `.bubble` | `image`, `caption` | |
| `VideoStory` | `.story`, `.story__tag` | `src`, `poster`, `tag`, `autor`, `legenda` | Só renderiza se `autorizado` |
| `RefTag` / `Notice` | `.hero__note`, `.climas__notice` | `variant` | “foto de referência · espaço anterior” |
| `Ornament` | espiral, faíscas, ramo (SVG inline) | `name`, `tone` | SVGs dos ornamentos CR-15…18 |
| `StickyCta` | `.sticky-cta` | `href`, `observe` | Regra do `MOTION-PLAN.md` §7 |
| `NavSheet`, `MotionToggle` | novos | — | Storyboard, “Elementos globais” |

### Seções

| Seção | Compõe |
| --- | --- |
| `Hero` | `Label` + `MegaTitle(h1 visual)` + `Cut×3` + `StickerRing` + `Ornament(sparks)` + `Button` + `RefTag` |
| `Ticker` | `Ticker` |
| `NovoCapitulo` | `Stamp` + `MegaTitle` + `Scribble` + `Badge` |
| `MesaCheia` | `MegaTitle` + `Scribble` + `Framed×3–4` + `Note/Arrow×3–4` + `Band×n` |
| `Fornadas` | `Badge` + `MegaTitle` + `VideoStory×n` + `Cut(polaroide)×3` + chips de sabores |
| `Climas` | `MegaTitle` + `Notice` + `Panel×2` + `Bubble×2` |
| `NaMesa` | `MegaTitle` + `Cut(polaroide)×n` (renderiza só com conteúdo) |
| `Reserva` | `MegaTitle` + `Scribble` + `Ticket` + ilha `ReservaFlow` |
| `Visite` | `MegaTitle` + `Label(placa)` + `Ticket(horários)` + `Button×3` |
| `Footer` | logos + links + `MotionToggle` |

### Modelo de conteúdo (resumo)

```ts
// src/content — esquemas validados no build
cardapio:  { comer: string[]; beber: string[]; fonte: 'proposta-pdf' | 'oficial' }
sabores:   { fixos: string[]; doMes: { nome: string; mes: string }[] }
ambientes: { id; nome; foto; fotoAntiga: boolean; reservavel: boolean; capacidade?: number }
videos:    { id; src; poster; autor: '@roll.ofc' | string; tipo: 'roll' | 'criadora';
             autorizado: boolean; semAudio: boolean; legenda?: string }
visita:    { endereco?; cidade?; horarios?: { dias; abre; fecha }[]; whatsapp?; instagram? }
```

**Regras de build:**
- vídeo com `autorizado: false` não é renderizado em produção;
- ambiente com `fotoAntiga: true` mostra o `RefTag`;
- seção `NaMesa` sem itens não é renderizada;
- campos vazios em `visita` mostram “a confirmar” no preview e **quebram o build de produção**, para não publicar a seção com buracos.

## 4. Fidelidade: como portar sem perder o desenho

1. **Portar o código, não a imagem.** Cada componente começa com o markup e o CSS copiados do v1 e só depois é parametrizado. Nada é redesenhado a partir de screenshot.
2. **Unidade do protótipo para as colagens.** As composições do v1 usam px pensados para 390 px. Dentro de cada palco de colagem (hero, quadro, bandejas, climas):

   ```css
   /* o contêiner é o PAI do palco: cqi resolve contra o contêiner ancestral */
   .mesa  { container-type: inline-size; }
   .board { --u: min(calc(100cqi / 390), calc(100svh / 844));   /* 1 px do protótipo */
            height: calc(660 * var(--u)); }
   .board__item--b { top: calc(262 * var(--u)); }
   ```

   (`--u` é uma propriedade não registrada, então é substituída onde é usada, e `100cqi` sempre se refere ao contêiner `.mesa`. Ajuste fino: em 390 o `cqi` mede a largura de conteúdo da seção, então o divisor deve ser a largura real do palco no v1 — 358 px no quadro, com 16 px de margem de cada lado — e não 390. Medir cada palco no v1 antes de portar.)

   Em 390×844 o resultado é **idêntico ao v1**. Em 360 ou 430 escala proporcionalmente. Em telas baixas (375×667) o termo `svh` encolhe a colagem do hero, o que resolve o CTA fora da dobra sem redesenhar.
3. **Tokens extraídos, valores iguais.** `tokens.css` nasce com os valores exatos do v1 (`CONCEITO-B-APROVADO.md` §3). Mudanças de token só depois do design system.
4. **Desvios intencionais documentados.** Toda diferença em relação ao v1 (correção da dobra, novo anel de foco, novas seções) entra numa tabela “desvios aprovados” no PR, com o screenshot antes e depois.
5. **Uma seção por vez**, cada uma com teste de fidelidade verde antes da próxima.

## 5. Acessibilidade e SEO na transição

- Título do hero com texto real (sem `aria-label` em `<p>`); `h1` = logo com alt “Âmbar Brunch”.
- Anel de foco: **vinho sobre superfícies claras e manteiga sobre escuras** (a combinação caramelo sobre manteiga tem 2,19:1 e falha).
- Chips como `radiogroup`, mensagens com `aria-live`, foco gerenciado entre passos.
- Vídeos com `<track>` quando houver fala; controle de pausa.
- `<html lang="pt-BR">`, metadados, imagem Open Graph desenhada a partir do hero.
- JSON-LD `Restaurant`/`CafeOrCoffeeShop` **só com dados confirmados** (endereço, horários).
- Páginas de protótipo continuam com `noindex`.

## 6. Testes de comparação visual

### Ferramentas

Playwright Test com `toHaveScreenshot` (pixelmatch), `@axe-core/playwright` e Lighthouse CI. Todas são dependências de desenvolvimento.

### A. Fidelidade ao protótipo (v1 × implementação), local

- **O que compara:** cada seção da implementação contra a mesma seção renderizada de `experiments/concept-b-aprovado-v1/`, recortada pelo elemento (`locator.screenshot()`), e não a página inteira, para localizar a diferença.
- **Viewport de referência:** **390×844, DPR 2**, Chromium. Também 360×740 e 430×932 para conferir a escala proporcional (sem tolerância rígida).
- **Determinismo:**
  - `reducedMotion: 'reduce'` + `animations: 'disabled'`;
  - relógio fixo (`page.clock.setFixedTime`) para os chips de data;
  - as fontes do v1 interceptadas (`page.route`) para usar os **mesmos arquivos auto-hospedados**;
  - máscara (`mask`) sobre vídeos, faixa e selo giratório;
  - espera de `document.fonts.ready` e das imagens carregadas.
- **Tolerância inicial:** `maxDiffPixelRatio: 0.02` por seção. Acima disso, o diff (imagem com destaques) vai para revisão. Os desvios aprovados atualizam a baseline com registro.
- **Roda só localmente:** o v1 depende das mídias de `creative/source/`, que estão fora do Git.

### B. Regressão da implementação (baseline própria), em CI

- **Viewports:** 360×740 · 375×667 · **390×844** · 430×932 · 1440×900.
- **Motores:** Chromium e WebKit (emulação de iPhone), porque Safari iOS é o público principal.
- **Baselines geradas no container oficial do Playwright** (Linux) no GitHub Actions, para não haver diferença de fonte e antialiasing entre máquinas.
- **Tolerância:** `maxDiffPixelRatio: 0.005`.

### C. Testes funcionais que acompanham as screenshots

| Teste | Critério |
| --- | --- |
| CTA fixo | Oculto com o botão do hero visível; visível ao rolar; oculto na reserva; oculto ao voltar ao topo; oculto com campo em foco. Em 375×667, visível desde o início se o botão do hero não couber |
| Overflow horizontal | 0 px em todos os viewports |
| Console | sem erros nem 404 |
| Movimento reduzido | nenhum `animation-play-state: running` em loop; vídeos parados |
| Pausa global | faixa, selo e vídeos param; a preferência persiste após recarregar |
| Comanda | navegação por teclado completa; estados carregando, vazio, erro e sucesso com a API simulada (`page.route`) |
| Acessibilidade | axe-core sem violações *serious*/*critical* |
| Mídia não autorizada | o build de produção não contém vídeos com `autorizado: false` |

### D. Orçamento de performance (Lighthouse CI, perfil móvel 4G)

| Métrica | Meta |
| --- | --- |
| LCP | ≤ 2,5 s |
| CLS | ≤ 0,05 |
| INP (comanda) | ≤ 200 ms |
| JS na home (sem a ilha) | ≤ 15 KB gzip |
| Ilha da reserva | ≤ 25 KB gzip, carregada só perto da comanda |
| Transferência da 1ª tela | ≤ 400 KB |
| Página inteira rolada (sem vídeos) | ≤ 2,5 MB, contra 3,3 MB só de imagens no v1 |
| Cada vídeo | ≤ 1,5 MB, contra até 4,5 MB no v1 |

## 7. Ordem de construção sugerida

1. Base: Astro, `tokens.css`, `base.css`, fontes auto-hospedadas, layout, harness de teste de fidelidade.
2. `Hero` + `Ticker` + `StickyCta` (com a correção da dobra) → teste de fidelidade.
3. `MesaCheia` (unidade do protótipo nas colagens) → teste.
4. `Climas` → teste.
5. `Reserva` com a ilha (API simulada) → testes e2e.
6. `Fornadas` (vídeos reexportados; renderiza só com autorização) → teste.
7. `NovoCapitulo`, `Visite`, `Footer`, `NavSheet`, `MotionToggle`.
8. Motion completo (`MOTION-PLAN.md`), auditoria de acessibilidade e performance.
9. Desktop.
10. Conexão real com a API FastAPI, quando o contrato estiver definido.

O **design system definitivo** sai do passo 1, com os tokens e primitivos do v1 formalizados em `docs/design/DESIGN-SYSTEM.md` depois da sua aprovação desta estrutura.
