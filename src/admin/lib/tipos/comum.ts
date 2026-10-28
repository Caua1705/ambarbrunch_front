// Convenções do backend (CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md §1): dinheiro e quantidades chegam como STRING decimal,
// datas "AAAA-MM-DD", instantes ISO com fuso. Valor desconhecido é null — a tela mostra "—", nunca zero.

/** Decimal em texto: "1234.50". */
export type Dec = string;
/** Data "AAAA-MM-DD". */
export type Data = string;
/** Instante ISO 8601 com fuso. */
export type Instante = string;
export type Uuid = string;

export interface Pagina<T> {
  total: number;
  itens: T[];
}

export interface Cursor<T> {
  itens: T[];
  proximo: number | null;
}
