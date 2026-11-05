// Contrato do catálogo público do cardápio. Nomes de campo = os do backend (docs/technical/CONTRATO-API-CARDAPIO.md).
// O backend guarda e garante os dados; aqui só se valida o formato e se escreve o preço. Sem nada de Astro ou Vite: o gerador
// do PDF (scripts/cardapio-pdf.mjs) usa este mesmo arquivo, para o site e o PDF lerem o catálogo do mesmo jeito.
import { createHash } from 'node:crypto';

export interface ItemCatalogo { id: string; nome: string; descricao: string | null; preco_centavos: number; ordem: number }
export interface CategoriaCatalogo { id: string; nome: string; observacao: string | null; ordem: number; itens: ItemCatalogo[] }
export interface AdicionalCatalogo { id: string; nome: string; preco_centavos: number }
/** `aplicavel_a` vazio: o cardápio não diz a quais produtos o grupo se aplica; o site não promete por produto. */
export interface GrupoAdicionais { id: string; nome: string; observacao: string | null; aplicavel_a: string[]; itens: AdicionalCatalogo[] }
export interface Catalogo { versao: string; atualizado_em: string | null; categorias: CategoriaCatalogo[]; adicionais: GrupoAdicionais[] }

type Bruto = Record<string, unknown>;
const objeto = (v: unknown, onde: string): Bruto => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`Catálogo inválido: ${onde} não é um objeto.`);
  return v as Bruto;
};
const texto = (v: unknown, onde: string): string => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Catálogo inválido: ${onde} sem texto.`);
  return v.trim();
};
const opcional = (v: unknown, onde: string): string | null => {
  if (v === null || v === undefined || v === '') return null;
  return texto(v, onde);
};
const centavos = (v: unknown, onde: string): number => {
  if (!Number.isInteger(v) || (v as number) <= 0) throw new Error(`Catálogo inválido: preço de ${onde} precisa ser inteiro em centavos.`);
  return v as number;
};
const inteiro = (v: unknown, onde: string): number => {
  if (!Number.isInteger(v)) throw new Error(`Catálogo inválido: ordem de ${onde}.`);
  return v as number;
};
const lista = (v: unknown, onde: string): unknown[] => {
  if (!Array.isArray(v) || !v.length) throw new Error(`Catálogo inválido: ${onde} vazio.`);
  return v;
};
const porOrdem = <T extends { ordem: number }>(l: T[]) => [...l].sort((a, b) => a.ordem - b.ordem);

/** Valida a resposta da API. Qualquer falta derruba o build: o site publicado continua o anterior, nunca um cardápio pela metade. */
export function validarCatalogo(bruto: unknown): Catalogo {
  const raiz = objeto(bruto, 'resposta');
  const categorias = lista(raiz.categorias, 'categorias').map((c) => {
    const cat = objeto(c, 'categoria');
    const nome = texto(cat.nome, 'categoria');
    return {
      id: texto(cat.id, `id de ${nome}`), nome, observacao: opcional(cat.observacao, `observação de ${nome}`), ordem: inteiro(cat.ordem, nome),
      itens: porOrdem(lista(cat.itens, `itens de ${nome}`).map((i) => {
        const item = objeto(i, `item de ${nome}`);
        const n = texto(item.nome, `item de ${nome}`);
        return {
          id: texto(item.id, `id de ${n}`), nome: n, descricao: opcional(item.descricao, `descrição de ${n}`),
          preco_centavos: centavos(item.preco_centavos, n), ordem: inteiro(item.ordem, n),
        };
      })),
    };
  });
  const adicionais = (Array.isArray(raiz.adicionais) ? raiz.adicionais : []).map((g) => {
    const grupo = objeto(g, 'grupo de adicionais');
    const nome = texto(grupo.nome, 'grupo de adicionais');
    return {
      id: texto(grupo.id, `id de ${nome}`), nome, observacao: opcional(grupo.observacao, `observação de ${nome}`),
      aplicavel_a: Array.isArray(grupo.aplicavel_a) ? grupo.aplicavel_a.map((a) => texto(a, `aplicavel_a de ${nome}`)) : [],
      itens: lista(grupo.itens, `itens de ${nome}`).map((i) => {
        const item = objeto(i, `adicional de ${nome}`);
        const n = texto(item.nome, `adicional de ${nome}`);
        return { id: texto(item.id, `id de ${n}`), nome: n, preco_centavos: centavos(item.preco_centavos, n) };
      }),
    };
  });
  const ids = [...categorias.flatMap((c) => [c.id, ...c.itens.map((i) => i.id)]), ...adicionais.flatMap((g) => [g.id, ...g.itens.map((i) => i.id)])];
  const repetidos = [...new Set(ids.filter((id, n) => ids.indexOf(id) !== n))];
  if (repetidos.length) throw new Error(`Catálogo inválido: ids repetidos (${repetidos.join(', ')}).`);
  return {
    versao: texto(raiz.versao, 'versao'),
    atualizado_em: opcional(raiz.atualizado_em, 'atualizado_em'),
    categorias: porOrdem(categorias),
    adicionais,
  };
}

/** Assinatura do conteúdo: muda quando muda produto, preço, texto ou ordem. Prende o PDF à versão do catálogo que o gerou. */
export function assinaturaCatalogo(c: Catalogo): string {
  const { atualizado_em: _data, ...conteudo } = c;
  return createHash('sha256').update(JSON.stringify(conteudo)).digest('hex');
}

/** Numa mesma lista os preços têm o mesmo formato, como nas artes: “R$ 16” e, se algum tem centavos, “R$ 25,00” ao lado de “R$ 24,15”. */
export const temCentavos = (itens: { preco_centavos: number }[]) => itens.some((i) => i.preco_centavos % 100 !== 0);
export function formatarPreco(preco: number, comCentavos = preco % 100 !== 0): string {
  const reais = Math.floor(preco / 100);
  return `R$ ${reais}${comCentavos ? `,${String(preco % 100).padStart(2, '0')}` : ''}`;
}
