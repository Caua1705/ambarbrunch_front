# Experimentos — direções de arte (Etapa 2)

> **Situação:** o **Conceito B foi escolhido** como direção artística (2026-10-16). A versão aprovada está congelada em
> [`concept-b-aprovado-v1/`](concept-b-aprovado-v1/README.md) e não deve ser editada. `concept-a/` fica como histórico.
> Planejamento da homepage: [`docs/design/HOMEPAGE-STORYBOARD.md`](../docs/design/HOMEPAGE-STORYBOARD.md).
> **Design system (Etapa 4):** [`design-system/`](design-system/) — vitrine, página de paridade com o v1 e prévia com menu e doca. Usa `src/styles/` e `src/lib/`.
> **Não são** o site, nem o design system. Cores, fontes e textos são hipóteses de cada conceito.

| Conceito | Pasta | Ideia |
| --- | --- | --- |
| **A · Manhã no Jardim** | [`concept-a/`](concept-a/) | Editorial claro e acolhedor: fotografia dominante, serifa expressiva (Fraunces), creme e verde do jardim com vinho nos destaques. Hero em arco, manifesto com fotos dentro do texto, grade assimétrica, galeria horizontal de ambientes. |
| **B · Fornada Âmbar** | [`concept-b/`](concept-b/) | Expressivo e artesanal: blocos vinho e cacau, tipografia condensada (Bricolage Grotesque), colagens com fita, anotações com setas (linguagem dos posts da Roll), faixa de categorias em movimento, ambientes em painéis diagonais, reserva em formato de comanda. |

As duas seguem a mesma estrutura: hero com identidade Âmbar Brunch e CTA → gastronomia com produtos reais → composição editorial → ambientes reais → prévia da reserva → rodapé.

## Como abrir

Na raiz do repositório:

```bash
node experiments/serve.mjs
```

- Comparação lado a lado: <http://127.0.0.1:4173/experiments/>
- Conceito A: <http://127.0.0.1:4173/experiments/concept-a/>
- Conceito B: <http://127.0.0.1:4173/experiments/concept-b/>
- Design system (vitrine): <http://127.0.0.1:4173/experiments/design-system/>
- Prévia com menu e doca: <http://127.0.0.1:4173/experiments/design-system/preview.html>
- Paridade com o v1: <http://127.0.0.1:4173/experiments/design-system/paridade-v1.html> · teste: `node experiments/design-system/tools/parity.mjs`

O servidor é Node puro, sem dependências. Os arquivos também abrem direto pelo navegador (`file://`). As fontes vêm do Google Fonts e precisam de internet.

> As mídias são lidas de `creative/source/…`, que está fora do Git. Num clone novo, os protótipos só mostram imagens depois que o acervo for extraído.

## Comportamentos implementados

- **CTA fixo “Reservar mesa”:** aparece quando o hero sai da tela e some ao voltar ao topo (`IntersectionObserver`). Também se esconde enquanto a própria seção de reserva está visível, para não duplicar o botão.
- **Revelação ao rolar:** só opacidade e deslocamento, uma vez por elemento. Não bloqueia nem sequestra o scroll.
- **Vídeos:** `preload="none"`, poster estático, tocam mudos só quando visíveis e pausam fora da tela.
- **`prefers-reduced-motion`:** desliga animações, rotação dos selos e autoplay.
- **Prévia de reserva:** ambiente, pessoas e data (próximos 10 dias) são só estado visual local. Os horários **não foram inventados**: o campo indica que virão do sistema de reservas. “Reservar aqui” num ambiente pré-seleciona esse ambiente. Nada é enviado.
- Sem frameworks e sem bibliotecas. Cada conceito tem um HTML, um CSS (~490 linhas) e um JS (~80 linhas) próprios.

## Verificação (Edge headless, 2026-10-16)

| Teste | A mobile | A desktop | B mobile | B desktop |
| --- | --- | --- | --- | --- |
| CTA oculto no topo | ✓ | ✓ | ✓ | ✓ |
| CTA visível após o hero | ✓ | ✓ | ✓ | ✓ |
| CTA oculto na seção de reserva | ✓ | ✓ | ✓ | ✓ |
| CTA oculto ao voltar ao topo | ✓ | ✓ | ✓ | ✓ |
| Overflow horizontal | 0 px | 0 px | 0 px | 0 px |
| Erros no console | 0 | 0 | 0 | 0 |

Mobile: 390 × 844, DPR 2. Desktop: 1440 × 900. Não testado em Safari/iOS real.

## Screenshots

Em `experiments/screenshots/` (fora do Git, porque contêm mídia ainda sem licença):

- `comparacao-pagina-index.png` — os dois conceitos lado a lado, em moldura de celular
- `comparacao-hero-mobile.png` · `comparacao-cta-fixo-mobile.png` · `comparacao-pagina-inteira-mobile.png` · `comparacao-hero-desktop.png`
- `conceito-{a,b}-{mobile,desktop}-00-pagina-inteira.png`, `-01-hero`, `-02-rolado-cta`, `-03-roll`, `-03-ambientes`, `-03-reservar`

## Origem do conteúdo

| Elemento | Fonte | Situação |
| --- | --- | --- |
| Logo Âmbar | OF-15 (pág. 1 do PDF, sem fundo) | Oficial, provisório. Sempre em vinho sobre superfície clara; sem redesenho nem recoloração |
| Logo Roll | OF-03 | Oficial; sempre sobre creme |
| Fotos de pratos | FR-05/06/07 | Reais; podem ser de cardápio antigo |
| Fotos de ambiente | FR-01…04 | Reais, do **espaço anterior**. Sinalizadas na página (“foto de referência · espaço anterior”) |
| Bandejas Roll | IG-06 (`IG-OPT-06`), IG-08 (`IG-OPT-07`), IG-09 | Reais; autorização pendente |
| Vídeos | IV-06 (A e B), IV-08, IV-09 (B) | Da Roll; tocam mudos, mas os arquivos ainda têm a trilha. Autorização pendente |
| Posters dos vídeos | `creative/source/video/roll_reels/posters/` | Frames extraídos dos próprios vídeos (sem a capa do Instagram) |
| Categorias do cardápio | Págs. 5–6 do PDF | Proposta; sem preços |
| Sabores Roll (Tradicional, Oreo, Biscoff, Red velvet) | Legendas dos posts da Roll | Sabores fixos citados em ago/2026 |
| “good coffee · better days”, “coffee tastes better with a Roll” | MK-08, MK-09 | Frases dos materiais de proposta |
| Ornamentos (espiral, ramo, linha, sparkles) | CR-15…18, redesenhados inline | Conceito |
| Demais textos (títulos, manifesto, legendas) | Escritos para os protótipos | **Provisórios**, para avaliar tom de voz |

**Não há** depoimentos, avaliações, preços, horários nem produtos inventados.

## O que ainda falta decidir

1. Qual direção seguir, ou que combinação das duas.
2. Tipografia: Fraunces, Hanken Grotesk e Bricolage Grotesque são escolhas de exploração. A apresentação usa Playfair Display, Lato e Lemon Milk.
3. Paleta: tokens provisórios, partindo das cores amostradas dos logos (vinho `#670D27`, creme `#F4EEE3`, marrom Roll `#6D4A31`).
4. Os itens da lista de gaps da [`CURADORIA-INICIAL.md`](../docs/content/CURADORIA-INICIAL.md), principalmente as fotos atuais do espaço e do cardápio.
