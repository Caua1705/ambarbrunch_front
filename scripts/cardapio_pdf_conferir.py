"""Confere o PDF do cardápio contra o catálogo que o gerou. Roda pelo npm run cardapio:pdf (via uv, com pymupdf).

Falha se faltar nome, descrição ou preço de qualquer item, se um produto aparecer duas vezes, se houver texto fora da área da página
ou se o preço exato não estiver na linha do produto (ou logo abaixo dele, nos cafés gelados). Renderiza as páginas em PNG para a conferência visual.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import pymupdf

MARGEM_PT = 14  # texto a menos disso da borda seria cortado por uma impressora comum


def normal(texto: str) -> str:
    return " ".join(unicodedata.normalize("NFC", texto).casefold().split())


def preco(centavos: int, com_centavos: bool) -> str:
    return f"R$ {centavos // 100}" + (f",{centavos % 100:02d}" if com_centavos else "")


def main() -> int:
    pdf, catalogo_arq, saida = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    catalogo = json.loads(Path(catalogo_arq).read_text(encoding="utf-8"))
    doc = pymupdf.open(pdf)
    erros: list[str] = []
    paginas = [normal(p.get_text()) for p in doc]
    tudo = " ".join(paginas)

    for n, pagina in enumerate(doc, start=1):
        area = pagina.rect
        for bloco in pagina.get_text("words"):
            x0, y0, x1, y1, palavra = bloco[:5]
            if x0 < MARGEM_PT or y0 < MARGEM_PT or x1 > area.width - MARGEM_PT or y1 > area.height - MARGEM_PT:
                erros.append(f"pág. {n}: texto colado na borda ou cortado: {palavra!r}")
        pagina.get_pixmap(dpi=140).save(saida / f"pagina-{n}.png")

    # todo preço impresso, com a posição: "R$" + número, palavra a palavra (assim "R$ 2" nunca casa dentro de "R$ 25")
    impressos: list[list[tuple[str, pymupdf.Rect]]] = []
    for pagina in doc:
        palavras = pagina.get_text("words", sort=True)
        lista = []
        for n, w in enumerate(palavras):
            if w[4] == "R$" and n + 1 < len(palavras):
                lista.append((f"R$ {palavras[n + 1][4]}", pymupdf.Rect(w[:4]) | pymupdf.Rect(palavras[n + 1][:4])))
            elif re.fullmatch(r"R\$[\d,]+", w[4]):
                lista.append((w[4].replace("R$", "R$ "), pymupdf.Rect(w[:4])))
        impressos.append(lista)

    def conferir(nome: str, valor: str, descricao: str | None) -> None:
        valor = valor.removeprefix("+ ")
        achado = False
        for n, pagina in enumerate(doc):
            # a busca só ignora maiúsculas em ASCII e os nomes saem em caixa alta: "CAMARÃO" não casaria com "Camarão"
            for marca in pagina.search_for(nome) + pagina.search_for(nome.upper()):
                for texto, area in impressos[n]:
                    if texto != valor:
                        continue
                    na_linha = abs(area.y0 - marca.y0) < 9 and area.x0 > marca.x0
                    # cafés gelados: nome centrado com o preço embaixo, na mesma coluna
                    na_coluna = 0 < area.y0 - marca.y1 < 75 and abs((area.x0 + area.x1) - (marca.x0 + marca.x1)) / 2 < 45
                    achado = achado or na_linha or na_coluna
        if not achado:
            erros.append(f"preço não está junto do produto: {nome} = {valor}")
        if descricao and normal(descricao) not in tudo:
            erros.append(f"descrição incompleta: {nome}")

    total = 0
    for categoria in catalogo["categorias"]:
        if normal(categoria["nome"]) not in tudo:
            erros.append(f"categoria faltando: {categoria['nome']}")
        if categoria.get("observacao") and normal(categoria["observacao"]) not in tudo:
            erros.append(f"observação faltando: {categoria['nome']}")
        com_centavos = any(i["preco_centavos"] % 100 for i in categoria["itens"])
        for item in categoria["itens"]:
            total += 1
            conferir(item["nome"], preco(item["preco_centavos"], com_centavos), item.get("descricao"))
    for grupo in catalogo["adicionais"]:
        if normal(grupo["nome"]) not in tudo:
            erros.append(f"grupo de adicionais faltando: {grupo['nome']}")
        for item in grupo["itens"]:
            total += 1
            conferir(item["nome"], "+ " + preco(item["preco_centavos"], bool(item["preco_centavos"] % 100)), None)

    if doc.page_count != 3:
        erros.append(f"o PDF tem {doc.page_count} páginas, esperadas 3")
    fontes = [f for p in doc for f in p.get_fonts()]
    if not fontes:
        erros.append("PDF sem fontes: virou imagem")

    if erros:
        print("\n".join(f"ERRO {e}" for e in erros))
        return 1
    print(f"PDF conferido: {doc.page_count} páginas, {total} itens com preço, texto vetorial")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
