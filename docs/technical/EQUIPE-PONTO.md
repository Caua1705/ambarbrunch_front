# Equipe e Ponto

Frontend do módulo: tablet (`/ponto`) e área **Equipe** do painel (`/admin/equipe`). Contrato: `docs/equipe-ponto/API.md`, no backend.

**Implementação concluída não é ativação.** Com `AMBAR_PONTO_ATIVO=false`, tudo responde `ponto_desativado` e as telas dizem isso. O reconhecimento facial não está homologado: `docs/equipe-ponto/HOMOLOGACAO.md`, no backend.

## Onde fica

| O quê | Onde |
|---|---|
| Tablet | `src/pages/ponto.astro`, `src/islands/Ponto.tsx`, `src/styles/ponto.css` |
| Câmera e captura, usadas nas duas telas | `src/lib/ponto/captura.ts` |
| Cliente do quiosque | `src/lib/ponto/http.ts`, `contrato.ts` |
| Área Equipe | `src/admin/modulos/equipe/` |
| Cliente e tipos do painel | `src/admin/lib/api/equipe.ts`, `lib/tipos/equipe.ts` |
| Rotas do painel | `src/admin/rotas/equipe.astro`, `cadastro-facial.astro` |

## Decisões

**O tablet não guarda token ao alcance do JavaScript.** O código do tablet vira um cookie HttpOnly em `POST /quiosque/ponto/parear`, restrito às rotas do quiosque. Nada fica em `localStorage`, na página ou na URL. O cookie é `SameSite=Strict`, então **o tablet precisa abrir `https://ambarbrunch.com/ponto`**: em `*.vercel.app` ele não chega, e a tela avisa.

**Autorizar um tablet:** Equipe › Tablets › Cadastrar tablet. No próprio tablet, com a conta do Proprietário, use *Autorizar este aparelho*: o código passa pela memória da aba e some. Em outro aparelho, cole o código em `/ponto`. Tablet revogado não volta: cadastre outro.

**Quadros não passam pela Vercel.** O tablet fala direto com a API. No cadastro facial, a sessão traz `captura_token`, que vale só para ela, e a página envia direto a `/captura-direta`. Sem esse token (backend anterior), o envio cai na ponte. Cada quadro tem ~40 KB, longe dos 4,5 MB da Vercel.

**Câmera só onde precisa.** `/admin/equipe/cadastro-facial` é a única página do painel com `camera=(self)` e com a API no `connect-src`. Em `/ponto`, a câmera liga depois do toque e desliga antes do envio.

**Sem nada falso.** A demonstração responde `ponto_desativado`: não há dado fictício de jornada nem identificação simulada. Sem motor, a tela diz que o reconhecimento está indisponível.

**Quadros crus.** O espelho é só CSS. Espelhar o quadro trocaria esquerda e direita e reprovaria o desafio.

**Cálculos no backend.** O painel só formata minutos, status e sinalizações.

## Regras de tela

- Sucesso só com o recibo. Sem resposta, a tela repete com a mesma `Idempotency-Key` e, se não der, diz que o registro não foi confirmado.
- Horário do recibo, nunca do aparelho. O relógio da tela usa a diferença para `horario_servidor`.
- Escala muda de hoje em diante. Dia passado, só por exceção com motivo. Dia com jornada não aceita exceção.
- A previsão de uma jornada feita não se corrige, e atribuição não se apaga.
- Marcação original nunca some: a correção cria outra, e a tela mostra as duas, com quem fez e quando.
- Registro assistido fica só no painel, nunca no tablet.

## Testes

| Suíte | O que prova |
|---|---|
| `npm run test:ponto-real` | Navegador real, painel, API, motor facial e Postgres, com câmera falsa alimentada por vídeo. Só o projeto `estados-de-tela` simula a API, e não conta como integração |
| `npm run test:painel` | Segurança, permissões e telas do resto do painel |

Passo a passo no topo de `playwright.ponto-real.config.ts`. O ambiente local sobe com `ops/biometria/homologacao_local.py`, no backend. Nunca aponte para a produção: os testes gravam.

Os vídeos saem de fotos públicas, deformadas para simular a virada do rosto. Isso prova a integração. **Não prova prova de vida:** o motor aprovar esse vídeo é, ao contrário, um dado contra ela.

## Antes de ativar

1. Publicar o backend com o cookie do tablet e a captura direta.
2. Homologar a biometria no tablet real: `HOMOLOGACAO.md`, seção 3.
3. Revisar com o jurídico o aviso da tela inicial de `/ponto` e o texto de autorização do cadastro facial.
4. Conferir `AMBAR_CORS_ORIGENS` com `https://ambarbrunch.com`.
5. Definir `PUBLIC_PONTO_API_URL` só se a API do ponto for outra; sem ela, vale `PUBLIC_RESERVAS_API_URL`.
6. No Android: Chrome em modo quiosque, câmera liberada para o site, tela sempre ligada.
