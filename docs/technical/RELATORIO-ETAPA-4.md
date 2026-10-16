# Relatório — Etapa 4: frontend real do Conceito B (2026-10-16)

> Site estático + interativo em Astro 7, mobile primeiro. **Sem backend, sem deploy, sem push.**
> Reserva em modo **indisponível** (não finge funcionar). Detalhes do que falta: [`CONTRATO-API-RESERVAS.md`](CONTRATO-API-RESERVAS.md) · conteúdo: [`../content/PENDENCIAS-CONTEUDO.md`](../content/PENDENCIAS-CONTEUDO.md).

## 1. O que foi testado e como

| Tipo | Onde | Simulado ou real |
| --- | --- | --- |
| Chromium 156 (Playwright), emulação de celular 390×844 DPR 2 com toque | este computador (Windows) | **simulado** |
| WebKit 27.2 (Playwright, build para Windows), mesma emulação | este computador | **simulado** — ver limitação abaixo |
| Lighthouse 13.5 (perfil móvel: celular intermediário, 4G lento, CPU 4×) | este computador | **simulado** |
| Fluidez do scroll com CPU 4× mais lenta | Chromium | **simulado** |
| iPhone / Android reais | — | **não testado** (pendente) |

**Limitação encontrada no WebKit para Windows:** ele não aplica eixos de fontes variáveis (até o peso 400 sai em negrito e a fonte condensada encavala). O próprio protótipo v1, com as fontes do Google, fica igual nesse motor. O Safari do iOS suporta fontes variáveis, mas **só um iPhone real confirma a tipografia**. No WebKit, valem os testes funcionais (todos passam), não a aparência das fontes. Mesmo assim, a largura variável passou a usar `font-stretch` (o caminho padrão), mais robusto em todos os navegadores.

## 2. Resultado dos testes automáticos — 74 aprovados, 1 pulado, 0 falhas

| Projeto | Aprovados | Pulados | O que cobre |
| --- | ---: | ---: | --- |
| `fidelity` (Chromium, 390×844) | 7 / 7 | 0 | cada seção do protótipo aprovado: **geometria de todas as peças (±1 px)** e **estilos calculados idênticos** (cor, fonte, peso, eixos, espaçamento, rotação, raio, borda, sombra); hero também **pixel a pixel** |
| `chromium` (e2e) | 34 / 34 | 0 | 1ª tela em 6 celulares + tablet/desktop, CTA e doca, menu, reserva (indisponível e simulada), movimento, acessibilidade, mídia |
| `webkit` (e2e) | 33 / 34 | 1 | os mesmos; pulado: rolagem por roda do mouse (“Mouse wheel is not supported in mobile WebKit”, verificado; coberto no Chromium) |

Destaques:
- **CTA “Reservar mesa” inteiro na 1ª tela** em 360×640, 360×740, 375×667, 390×844, 414×896 e 430×932, em uma linha, sem a colagem tocar o título.
- **0 px de overflow horizontal** em todos os tamanhos, incluindo 768×1024, 1024×768 e 1440×900.
- **axe-core: 0 violações graves** em `/`, `/reservar/`, `/privacidade/` e com o menu aberto.
- **Reserva indisponível:** botão desabilitado com “Reservas online em breve”, nenhum horário inventado, **nenhuma requisição para fora do site**.
- **Reserva simulada (só testes):** fluxo completo, validação, horário tomado, falha e nova tentativa — sempre com aviso “simulação”.
- **Movimento reduzido:** nenhuma animação infinita, nada escondido, sem entrada do hero. **Pausa global** para faixa, selo e vídeos e **persiste** após recarregar.

## 3. Defeitos encontrados e corrigidos nesta etapa

| Defeito | Correção |
| --- | --- |
| Botão de menu fixo cobria o aceite de privacidade e campos no rodapé da tela durante a reserva | na seção de reserva a doca inteira sai (doc. de navegação atualizado) |
| WebKit encavalava a fonte condensada | largura via `font-stretch`; `font-variation-settings` só com `opsz` |
| `<source>` do `<picture>` viravam itens de grid (logo da Roll deslocado no selo) | `source { display: none }` |
| Scribble da revelação por linhas ficava 4,8 px abaixo | transição corrigida |
| Fraunces sem preload causava CLS 0,138 (o “&” muda a altura da 3ª linha do título) | preload mantido nas duas fontes → CLS 0 |
| Posters dos vídeos baixavam no carregamento da página | `data-poster` aplicado só perto da tela |
| Vídeos e originais da Roll (autorização pendente) iam para a pasta do build mesmo sem referência | passo de build remove mídia não referenciada; produção sem nenhum arquivo da Roll |
| Skip link vazava em capturas e zoom | escondido por recorte até receber foco |

## 4. Desempenho

**Lighthouse móvel (mediana de 3 rodadas), build de produção:**

| Desempenho | Acessibilidade | Boas práticas | SEO | FCP | LCP | TBT | CLS | Speed Index |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **92** | **100** | **100** | **100** | 1,1 s | 3,2 s | 130 ms | **0** | 1,1 s |

Build de revisão (com fotos e vídeos da Roll): desempenho 91, LCP 3,2 s, CLS 0 (SEO 63 por causa do `noindex` proposital).

**LCP 3,2 s acima da meta de 2,5 s** no 4G lento simulado. O elemento é o logo (21 KB, prioridade alta); o atraso vem da banda dividida com as duas fontes variáveis (209 KB). Subconjunto de caracteres economiza só 5% (testado). A redução real seria **tirar o eixo de tamanho óptico** da Bricolage (−50 KB), que muda levemente o desenho das letras grandes em relação ao protótipo — **decisão sua**.

**Transferência (Chromium, 390×844):**

| | 1ª tela | Página inteira rolada |
| --- | ---: | ---: |
| Protótipo v1 (DPR 2) | 2,83 MB | **5,58 MB** (com 2 MB de vídeo) |
| Site, revisão (DPR 2) | **426 KB** | **893 KB** (vídeos só quando tocam) |
| Site, revisão (DPR 3) | 561 KB | 1,30 MB · 2,15 MB com um vídeo tocando |
| Site, produção hoje (DPR 2) | 424 KB | 680 KB |

Vídeos: 4,5 + 1,9 + 1,0 MB → **844 + 787 + 486 KB**, sem áudio. JS do site: **2 KB** (gzip) na 1ª tela; ilha da reserva **16 KB** (gzip: Preact 4,6 + componente 6,0 + runtime 5,7), carregada só perto da comanda — orçamento: 25 KB.

**Fluidez do scroll** (CPU 4× mais lenta, movimento normal com parallax e loops): **60 fps** médios, quadro mediano 16,6 ms, p95 18,7 ms, 1,7% dos quadros acima de 20 ms, **0 tarefas longas** (o protótipo: 60 fps, 0,7%).

## 5. Ainda não verificado

- iPhone (Safari) e Android intermediário reais: tipografia variável, `svh`, `<dialog>`, máscaras, vídeo, teclado virtual.
- Leitores de tela reais (VoiceOver, TalkBack) na comanda.
- Desempenho em rede real e no CDN de produção (as medições usam servidor local com gzip).
