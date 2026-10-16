# Pendências de conteúdo do site (2026-10-16)

> Nada abaixo foi inventado no site. Cada item aparece marcado “a confirmar” no **build de revisão**
> (`npm run build:revisao`) e **some** no build de produção. Onde preencher: arquivos em `src/data/`.

| # | Item | Onde aparece | Arquivo | Bloqueia 22/10? |
| --- | --- | --- | --- | --- |
| 1 | Endereço completo, cidade/estado, link do mapa | Visite, rodapé | `src/data/visita.ts` | **sim** |
| 2 | Dias e horários de funcionamento | Visite | `src/data/visita.ts` | **sim** |
| 3 | WhatsApp e Instagram do Âmbar | Visite, menu, rodapé | `src/data/visita.ts` | **sim** |
| 4 | Contrato da API de reservas e regras de reserva | Reserva | `docs/technical/CONTRATO-API-RESERVAS.md` | **sim** (reserva real) |
| 5 | Texto de privacidade (LGPD) e do consentimento | `/privacidade`, Reserva | `src/pages/privacidade.astro` | **sim** (antes de coletar dados) |
| 6 | Ambientes que aceitam reserva e capacidade | Reserva, Escolha o clima | `src/data/ambientes.ts` | sim (reserva real) |
| 7 | Autorização da Roll para fotos (bandejas) e vídeos do Instagram | Fornadas | `src/data/roll.ts` (`autorizado`, `bandejasAutorizadas`) + `.gitignore` | sem ela, Fornadas fica só com texto e selo |
| 8 | Texto oficial do “Novo capítulo” e data de reabertura (se pública) | Novo capítulo | `src/data/novo-capitulo.ts` | não (há texto provisório marcado) |
| 9 | Sabores do mês atuais | Fornadas | `src/data/roll.ts` | não |
| 10 | Itens do cardápio novo e fotos do shooting (21/10) | Hero, Mesa cheia | `src/data/cardapio.ts`, `src/assets/media/` | não (há categorias da proposta e fotos atuais) |
| 11 | Fotos do espaço novo (a partir de 24/10) | Hero (polaroide), Escolha o clima | `src/data/ambientes.ts` (`fotoAntiga`) | não (há aviso de foto antiga) |
| 12 | Conteúdo real e autorizado do soft opening | Na mesa (seção 7) | `src/sections/NaMesa.astro` | não (a seção só aparece com conteúdo) |
| 13 | Estacionamento e acessibilidade | Visite | `src/data/visita.ts` | não |
| 14 | Domínio do site e favicon oficial | metadados | `astro.config.mjs`, `public/favicon.png` | não (favicon provisório = logo oficial reduzido) |
| 15 | Revisão de todos os títulos, scribbles e textos | todas | seções e `src/data/` | não |

Textos que hoje são **provisórios** (escritos para o protótipo e mantidos): títulos e scribbles das seções, o lead da Roll,
o texto do Novo capítulo e os rótulos dos ambientes (“luz do jardim”, “luz âmbar”, “lounge”, “leitura”).
