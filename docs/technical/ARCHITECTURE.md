# Arquitetura — Âmbar (frontend)

Guia de onde cada coisa mora e de como acrescentar código sem duplicar nem acoplar. Atualizado em 2026-10-31 (refatoração
estrutural). Regras de Git e publicação: [`../../CLAUDE.md`](../../CLAUDE.md). Painel em detalhe:
[`PAINEL-ADMIN.md`](PAINEL-ADMIN.md). Contratos com o backend: [`CONTRATO-API-RESERVAS.md`](CONTRATO-API-RESERVAS.md),
[`CONTRATO-API-CLUBE.md`](CONTRATO-API-CLUBE.md).

## 1. Visão geral

Um único projeto **Astro 7** com duas aplicações que compartilham build e deploy (Vercel, branch `main`):

| Aplicação | Onde | Renderização | Quem usa |
| --- | --- | --- | --- |
| **Site público** (home, reserva, privacidade, Clube) | `src/` (exceto `src/admin/`) | estático; Preact só nas ilhas | clientes |
| **Painel** (`/admin`) | `src/admin/` | servidor (adaptador Vercel/Node), ilhas Preact | equipe |

O backend (FastAPI, repositório `giardini_back`) é a fonte das regras de negócio. O frontend **mostra e pede**: não
recalcula valores financeiros, não decide permissões de verdade e não inventa campos de contrato.

**Por que um projeto só:** o painel já é isolado por diretório, por integração (`src/admin/integracao.mjs` injeta as
rotas) e por build (`PAINEL_ADMIN`). Separar em dois repositórios dobraria deploy, tokens e dependências sem ganho real
no tamanho atual.

## 2. Árvore

```text
src/
├── pages/            ROTAS PÚBLICAS (roteamento por arquivo do Astro) — URLs não mudam sem plano explícito
├── layouts/          Base.astro (cabeçalho <head>, SEO, medição, script global)
├── sections/         Seções da home e das páginas (uma seção = um bloco da página, compõe componentes)
├── components/       Componentes de apresentação reutilizáveis (.astro e Preact)
│   ├── clube/        Peças Preact do Clube (conta, histórico, carteira, código de confirmação…)
│   └── reserva/      Peças Preact da comanda (calendário, grupo de chips)
├── islands/          Ilhas Preact hidratadas no navegador — o ponto de entrada de cada parte com estado
├── lib/              Lógica TypeScript sem DOM (contratos, clientes HTTP, regras de exibição)
│   ├── reservas/     contrato, cliente HTTP, simulação, datas, validação, agenda, confirmação
│   ├── clube/        contrato e cliente (acesso), erros, modo, origem, simulação, prévia
│   ├── medicao/      configuração e eventos do GA4 (desligado até aprovação)
│   ├── conteudo.ts   revisão × produção, conteúdo pendente, origem das imagens
│   ├── media.ts      catálogo de imagens/vídeos (src/assets/media, public/media)
│   └── telefone.ts   máscara e validação de telefone (reserva e Clube)
├── scripts/          Comportamentos de página em JS puro (motion, carrossel, menu…) — importados por <script>
├── data/             Conteúdo e textos (copies, cardápio, SEO, política de privacidade, ambientes)
├── styles/           CSS global em camadas: tokens/ → components/ → sections/ → acabamento → motion → docs
├── assets/media/     Originais de imagem usados pelo build (geram AVIF/WebP)
├── env.d.ts          Tipos das variáveis PUBLIC_* e de Astro.locals
└── admin/            PAINEL (ver §4)
public/               Arquivos servidos como estão (vídeos .web.mp4, ícones, manifest)
tests/                Site: contrato de tokens, e2e (Chromium/WebKit), fidelidade ao v1
tests-reservas/       Reserva em modo API contra uma API falsa (build dist-reservas-api)
tests-reservas-real/  Conferência só de leitura contra a API real
tests-painel/         Painel: segurança, permissões e telas (build dist-painel, demo + backend falso)
scripts/              Ferramentas de linha de comando (mídia, painel, servidores de teste, medições)
experiments/          Protótipos congelados (concept-b-aprovado-v1 é a referência de fidelidade) — fora do build
docs/                 Marca, design, conteúdo e documentação técnica
```

## 3. Site público

- **Página** (`pages/`) só monta: escolhe layout, seções e passa props. Lógica de dados fica em `lib/` ou `data/`.
- **Seção** (`sections/`) é um bloco da página com o seu texto vindo de `data/`. Se precisa de comportamento, importa um
  módulo de `scripts/` num `<script>` (o Vite empacota; nada de script inline além do que já existe).
- **Componente** (`components/`) não sabe de qual página faz parte. Peças Preact de uma funcionalidade ficam numa
  subpasta com o nome dela (`components/reserva/`, `components/clube/`).
- **Ilha** (`islands/`) é a raiz hidratada (`client:visible`, `client:load`…). Ela guarda o estado e conversa com a API
  por um cliente de `lib/<dominio>/`; o resto (calendário, validação, datas) vem de componentes e módulos importados.
- **Contrato com o backend**: tipos e erros em `lib/<dominio>/contrato.ts` (ou `acesso.ts` no Clube), cliente em
  `http.ts`/`acesso.ts`, simulação em `simulado.ts`. Nomes de campo, rotas e códigos de erro são os do backend — nunca
  traduzidos.

## 4. Painel (`src/admin/`)

```text
src/admin/
├── integracao.mjs     integração Astro: injeta rotas e middleware só com o painel ligado
├── middleware.ts      sessão, unidade, cabeçalhos de segurança (CSP com hash)
├── rotas/             páginas .astro injetadas (uma por módulo) e rotas/api (sessão e ponte para o backend)
├── servidor/          código SÓ do servidor: backend.ts (fetch ao FastAPI), config, sessão; demo/ (dados fictícios,
│                      fora do build da Vercel)
├── layout/            moldura do painel (Painel.astro, menu, tema, sair, sino de pendências em avisos.ts)
├── lib/
│   ├── api/           clientes por domínio (cliente.ts = pedir(), erros, idempotência)
│   ├── tipos/         contratos do backend, um arquivo por domínio (espelho manual de app/modulos/*/esquemas.py)
│   ├── consulta.ts    useConsulta: cache SWR por chave + invalidação por prefixo
│   ├── formato.ts     moeda, datas, plural — formatação pt-BR (não calcula regra de negócio)
│   ├── permissoes.ts  espelho de UI da matriz de papéis (o backend decide)
│   ├── rotas.ts       rotaPainel, lerParam/gravarParams (abas e vistas na query string)
│   └── sessao.ts      tipos do contexto (usuário, papel, unidades)
├── ui/                componentes genéricos do painel (base, camadas = gaveta/diálogo, entradas, estados, gráficos, tabela)
├── estilos/           tokens.css, painel.css e uma folha por módulo grande
└── modulos/<modulo>/  uma pasta por módulo: index.tsx (entrada da ilha), telas em PascalCase, comum.tsx com o que
                       só esse módulo compartilha (rótulos, hooks, permissões do módulo)
```

Módulos: `visao-geral`, `reservas`, `atendimento`, `clube`, `financeiro`, `estoque`, `configuracoes`,
`operacao` (Modo Operação) e `login`.

**Por que contratos (`lib/api`, `lib/tipos`) ficam fora dos módulos:** vários módulos usam o mesmo contrato (Estoque usa
categorias e fornecedores do Financeiro; Visão Geral e Operação usam Reservas) e o servidor de demonstração importa os
mesmos tipos para o compilador acusar divergência. Telas ficam por módulo; contratos ficam por domínio do backend.

Limites entre módulos: um módulo pode importar `lib/`, `ui/` e o `comum.tsx` de outro módulo **só** para reaproveitar
rótulos ou componentes de exibição (hoje: Visão Geral, Operação e Atendimento usam `reservas/comum`). Nunca importar a
tela de outro módulo.

## 5. Convenções de nome

| O quê | Regra | Exemplo |
| --- | --- | --- |
| Idioma | Domínio, identificadores e comentários em **português**. Pastas impostas ou convencionais do Astro em inglês (`pages`, `layouts`, `components`, `styles`, `assets`, `public`). Primitivos do design system mantêm o nome documentado em `docs/design/` e na classe CSS (`MegaTitle`/`.mega`, `Story`/`.story`). | `ReservaFlow`, `dataPermitida` |
| Contratos externos | Rotas, parâmetros, campos JSON, enums e códigos de erro **exatamente como o backend** (snake_case quando ele usa). | `valor_pago`, `parcela_quitada` |
| Componente (.astro/.tsx) com um componente principal | `PascalCase` = nome do componente | `PageBar.astro`, `Calendario.tsx` |
| Módulo com vários exports (helpers, rótulos, ícones) | minúsculas, kebab-case | `comum.tsx`, `icones.tsx`, `nav-sheet.js` |
| Entrada de módulo do painel | `index.tsx` | `modulos/login/index.tsx` |
| Hooks | `useAlgo` | `useConsulta`, `useCategorias` |
| Constantes de módulo | `MAIUSCULAS` | `PRIMEIRA_DATA`, `NOME_MAX` |
| Tipos e interfaces | `PascalCase`, sem prefixo `I` | `DadosContato`, `ReservaConfig` |
| Testes | `<assunto>.spec.ts` na suíte da área | `tests-painel/seguranca.spec.ts` |
| CSS | classes BEM em português/inglês conforme o design system (`bloco__elemento--variante`); tokens em `styles/tokens/` (site) e `admin/estilos/tokens.css` (painel); `tests/tokens.spec.ts` recusa cor, tamanho e duração fora dos tokens no site | `.cal__dia`, `.lista__item` |

Imports são **relativos** (no máximo três níveis, `../../../`). Não há alias de caminho: a profundidade é pequena e um
alias exigiria reescrever todos os imports de uma vez — fazer só se a árvore crescer.

## 6. Como acrescentar

- **Componente do site:** `src/components/Nome.astro` (ou `components/<funcionalidade>/Nome.tsx` se for Preact de uma
  funcionalidade). Estilo em `src/styles/components/<nome>.css`, importado em `styles/index.css` na camada `components`.
- **Comportamento de página:** `src/scripts/<nome>.js` exportando `initAlgo()`; a seção chama num `<script>`. Respeitar
  `motionAllowed()` de `scripts/motion.js`.
- **Funcionalidade do site que fala com o backend:** `src/lib/<dominio>/contrato.ts` (tipos + erro), `http.ts`
  (cliente com tempo-limite e sem nova tentativa automática), ilha em `src/islands/`, peças em
  `src/components/<dominio>/`. Documentar o contrato em `docs/technical/CONTRATO-API-<DOMINIO>.md`.
- **Tela nova no painel:** `src/admin/modulos/<modulo>/Tela.tsx`, ligada ao `index.tsx` do módulo (aba na query string
  via `lib/rotas.ts`). Dados com `useConsulta(chave, () => api.algo())`; estados com `Dados`/`Vazio`/`Esqueleto` de
  `ui/estados.tsx`; ações com `Botao` + `useConfirmacao`.
- **Endpoint novo do painel:** tipo em `lib/tipos/<dominio>.ts`, chamada em `lib/api/<dominio>.ts` via `pedir()` (nunca
  `fetch` direto). Se a resposta pode vir incompleta de um backend antigo, normalizar na borda (exemplo:
  `normalizarDocumento` em `lib/api/financeiro.ts`). Demo correspondente em `servidor/demo/<dominio>.ts`.
- **Módulo novo no painel:** pasta em `modulos/`, rota em `rotas/<modulo>.astro` registrada em `integracao.mjs`, item de
  menu em `layout/Painel.astro`, raiz da API em `servidor/config.ts` (`moduloDaRota`) e permissão em
  `lib/permissoes.ts`.

## 7. Regras contra duplicação e acoplamento

1. Antes de criar helper, procurar em `lib/` (site) ou `admin/lib/` e `admin/ui/` (painel). Formatação de moeda e data
   do painel é `lib/formato.ts`.
2. Um cliente HTTP por aplicação e domínio. O painel inteiro passa por `pedir()`; o site tem um cliente por contrato
   (reservas e Clube têm tempos-limite e cabeçalhos diferentes de propósito).
3. Regra de negócio (valores, saldos, situação de conta, permissão efetiva) vem do backend. A tela pode somar para
   exibir, nunca para decidir.
4. Constante que espelha o backend (limites, códigos) fica num lugar só e cita a origem no comentário.
5. Código morto sai do repositório (o histórico do Git guarda); `npm run lint` acusa import e variável sem uso.

## 8. Qualidade e comandos

| Comando | O que faz |
| --- | --- |
| `npm run check` | `astro check`: tipos de `.astro`, `.ts` e `.tsx` |
| `npm run lint` | `tsc` com `noUnusedLocals`/`noUnusedParameters`: imports, variáveis e parâmetros sem uso |
| `npm run verificar` | os dois acima |
| `npm run build:revisao` · `build:simulado` · `build:reservas-api` · `painel:build` | builds de revisão, testes do site, reserva em modo API e painel |
| `npx playwright test --project=contrato --project=chromium` | site (precisa de `dist/` e `dist-sim/`) |
| `npm run test:reservas-api` | reserva contra a API falsa (precisa de `dist-reservas-api/`) |
| `npm run test:painel` | painel (precisa de `dist-painel/`) |

Formatação: `.editorconfig` (UTF-8, LF, 2 espaços). Não há Prettier nem ESLint: entraria uma dependência e a
reformatação de todos os arquivos de uma vez; o `lint` acima usa só o TypeScript que o projeto já tem. As suítes do
Playwright rodam com 1 worker nesta máquina (memória).

## 9. Ambientes e deploy

- Variáveis `PUBLIC_*` (site) em `.env.<modo>` versionados só com valores de teste (`*.invalid`); produção vem da
  Vercel. Segredos do painel são `envField` com `access: 'secret'` em `astro.config.mjs` e nunca chegam ao navegador.
- Push na `main` publica em Production (Vercel). O painel entra no build da Vercel por padrão (`PAINEL_ADMIN=0`
  desliga); o modo demo é recusado no build da Vercel.

## 10. Registro de decisões

| Data | Decisão | Motivo |
| --- | --- | --- |
| 2026-10-16 | Astro + CSS próprio + TS, Preact só nas ilhas | Protótipo é HTML/CSS; zero JS por padrão; pipeline de imagens |
| 2026-10-16 | Sem biblioteca de animação nem smooth scroll | CSS nativo cobre tudo; não bloquear o scroll |
| 2026-10-16 | Fidelidade medida por paridade de pixels contra o v1 congelado | A componentização não pode alterar o desenho aprovado |
| 2026-10-30 | Painel completo em `/admin` deste projeto | O backend fica só com a API |
| 2026-10-31 | `src/lib` por domínio (`reservas/`, `clube/`, `medicao/`) e scripts de página em `src/scripts/` | Separar lógica sem DOM de comportamento de página; achar o contrato de cada domínio num lugar só |
| 2026-10-31 | Contratos do painel continuam em `admin/lib/{api,tipos}` por domínio | Compartilhados entre módulos e com a demo |
| 2026-10-31 | Sem alias de import, sem Prettier/ESLint; `lint` pelo `tsc` | Evitar reescrita em massa e dependência nova |
| 2026-11-01 | Redesign do painel: uma função por área, sino como central de pendências, unidade no menu da conta, Clube fora do menu, Financeiro em 5 áreas, Estoque abrindo em Compras | Menos elementos visíveis sem perder capacidade; detalhes e contratos faltantes em PAINEL-ADMIN.md §4a/§4b |
| 2026-11-02 | Estoque em 4 áreas (Estoque atual, Recebimentos, Contagem, Fichas e custos) e "Registrar movimento" único; ajuste = contagem de um item | Responder "o que temos" na primeira tela; o backend não tem ajuste avulso; detalhes em PAINEL-ADMIN.md §4c/§4b |
