# Composição editorial e colagens — Fornada Âmbar

> Como as peças se juntam. É o que impede o site de virar um template: as regras abaixo valem para as seções que
> já existem no v1 e para as novas (3 · Novo capítulo, 7 · Na mesa, 9 · Visite).

## 1. Princípios

1. **Papel sobre mesa.** Tudo é um objeto físico: etiqueta, polaroide, comanda, fita, carimbo, selo. Nada de cartões com sombra difusa genérica, gradientes ou vidro.
2. **Uma colagem por seção.** Cada seção tem **uma** composição protagonista. O resto da seção é tipografia e respiro.
3. **Tipografia como imagem.** O mega título ocupa a largura e é parte da composição, não um rótulo acima dela.
4. **A reserva está sempre a um toque.** Toda seção tem um caminho visível para a comanda: o CTA fixo, um link “reservar aqui” ou o botão do hero.
5. **Verdade antes de efeito.** Foto antiga leva aviso; vídeo de terceiro leva crédito; conteúdo que não existe não é simulado.

## 2. Ritmo de cor da página

vinho → cacau (faixa) → manteiga (3) → creme (4) → cacau (5) → manteiga (6) → (creme, 7) → vinho (8) → cacau (9) → creme (rodapé).

- Duas seções vizinhas **nunca** têm o mesmo fundo.
- Superfícies escuras (vinho, cacau) recebem grão; as claras, não.
- O vinho abre e fecha a história (hero e reserva): é a cor da marca e da ação.

## 3. Regras de colagem

| Regra | Valor | Exemplo no v1 |
| --- | --- | --- |
| Rotação das peças | entre −10° e +8° (carimbos até +14°) | círculo −10°, polaroide +6°, ladrilho −4° |
| Vizinhas alternam o sinal | sim | quadro: −3°, +4°, −7° |
| Sobreposição | 15–35% da peça menor | ladrilho sobre círculo e polaroide |
| Peças por palco | 3 fotos + 1 selo + 1 ornamento, no máximo | hero |
| Ordem de camadas | foto grande atrás, foto pequena na frente, selo por cima, texto por cima de tudo | `z-index` 1 → 5 |
| Moldura | glacê (quadro), creme (ladrilho, bandejas), manteiga (círculo, bolhas) — conforme o fundo | |
| Fita | só em fotos emolduradas; uma por foto; ±5–8° | quadro da Mesa |
| Nota + seta | a nota nunca cobre foto; a seta aponta da nota para a peça | 3 no quadro |
| Ornamento | no máximo 1 por palco; nunca sobre rosto ou prato | faíscas no hero |
| Logo | só o oficial, sem recolorir, sobre creme (etiqueta, selo, folha, rodapé) | |
| Roll | sempre como **assinatura** (selo, badge, “Fornadas”), nunca como marca principal da página | |

## 4. Transições entre seções

Forma e cor, nunca efeito de página:

- **Faixa inclinada** (hero → seção 3), com margem negativa de 16 px.
- **Borda recortada** na base da seção 3 sobre a 4 (mesma máscara da etiqueta).
- **Diagonal** de 16% entre painéis de ambiente; pode repetir na saída da seção 6.
- **Costura**: um selo ou polaroide invade 16–24 px a seção seguinte.
- Sem cortinas, fade de página inteira ou troca de cor do `body` por scroll.

## 5. Receitas de seção

Cada seção = **mega título + uma composição + uma saída para a reserva**.

| # | Seção | Composição | Saída para a reserva |
| --- | --- | --- | --- |
| 1 | Hero | etiqueta do logo → título em 3 linhas → colagem (círculo, polaroide, ladrilho, selo) → botão | botão manteiga (gatilho do CTA fixo) |
| 2 | Faixa | categorias em loop | — |
| 3 | Novo capítulo *(nova)* | texto curto + carimbo “novo capítulo” + selo da Roll; fundo manteiga com borda recortada | CTA fixo |
| 4 | Mesa cheia | quadro de cortiça (3–4 fotos, fitas, notas e setas) + pílulas do cardápio | CTA fixo |
| 5 | Fornadas | badge da Roll + mega título + stories + leque de bandejas | CTA fixo |
| 6 | Escolha o clima | dois painéis em diagonal + bolhas + aviso de foto antiga | “reservar aqui” em cada ambiente |
| 7 | Na mesa *(condicional)* | mural solto de polaroides reais e autorizadas | CTA fixo |
| 8 | Reserva | mega título + comanda picotada | é a própria reserva |
| 9 | Visite *(nova)* | placa de endereço (etiqueta) + comanda de horários + botões de mapa e WhatsApp | botão “Reservar mesa” |
| 10 | Rodapé | logos, contatos, pausa de animações | — |

## 6. Fotografia

- **Real sempre:** só fotos do acervo real (pratos, ambientes, bandejas da Roll). Imagens geradas por IA não entram como produto, ambiente ou embalagem.
- **Recorte:** pratos de cima ou a 45°; ambientes com luz natural; 4:5 nos painéis, 3:4 nas bandejas, 1:1 nos círculos.
- **Tratamento:** sem filtro. A unidade vem da moldura e do papel, não de cor aplicada.
- **Procedência visível:** foto do espaço anterior = `.ref-note` (com `*`) ou `.notice`. A troca pelas fotos novas remove o aviso foto a foto.

## 7. Texto

- Títulos curtos (1–2 palavras por linha). Scribble com até 6 palavras.
- Tom: acolhedor, direto, com humor leve (“e chegue com fome”).
- Todos os textos do protótipo são **provisórios** até a revisão do cliente.
