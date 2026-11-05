# Contrato — catálogo público do cardápio

Definido com a sessão do backend em 05/11/2026. O backend guarda e garante os dados; o front só apresenta. Tipos e validação:
`src/lib/cardapio/contrato.ts`. Como usar e atualizar: [`CARDAPIO.md`](CARDAPIO.md).

## `GET https://api.ambarbrunch.com/cardapio`

Sem autenticação. CORS para `ambarbrunch.com` e `ambarbrunch-front.vercel.app`, `ETag` (304 com `If-None-Match`) e `Cache-Control` público curto.

```json
{
  "versao": "2026-11-05.1",
  "atualizado_em": "2026-11-05T17:00:00Z",
  "categorias": [
    { "id": "cafes", "nome": "Cafés", "observacao": null, "ordem": 7, "itens": [
      { "id": "cafes.cafe_coado", "nome": "Café coado", "descricao": null, "preco_centavos": 600, "disponivel": true, "imagem": null, "ordem": 6 }
    ] }
  ],
  "adicionais": [
    { "id": "personalize_seu_pao", "nome": "Personalize seu pão", "observacao": null, "aplicavel_a": ["brunches"], "itens": [
      { "id": "personalize_seu_pao.integral", "nome": "Integral", "preco_centavos": 200 }
    ] }
  ]
}
```

| Campo | Regra |
|---|---|
| `id` | Chave estável do backend. **Não muda quando o nome muda**: nunca derivar do nome. Ex.: a categoria se chama “Brunchs” e o id é `brunches`. |
| `preco_centavos` | Inteiro, em centavos. Quem formata é o front. |
| `descricao`, `observacao` | Texto da fonte ou `null`. O front não completa nem reescreve. |
| `disponivel` | Sempre `true` por enquanto: não existe controle de esgotado. O front não usa. |
| `imagem` | Sempre `null`: a foto é ligada ao id no front (`FOTOS_PRODUTO`, `src/data/cardapio.ts`). |
| `aplicavel_a` | Ids de categoria. Vazio = o cardápio não diz a quais produtos o grupo se aplica: o site mostra na seção de bebidas e não promete por produto. |

Só itens ativos. Qualquer resposta fora deste formato derruba o build do site, de propósito: a versão no ar continua a anterior.
