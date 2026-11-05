// Contrato do catálogo: o que o build aceita e o que recusa. Sem navegador e sem API.
import { test, expect } from '@playwright/test';
import { assinaturaCatalogo, formatarPreco, temCentavos, validarCatalogo } from '../src/lib/cardapio/contrato';
import { montarCardapio } from '../src/data/cardapio';

const item = (id: string, nome: string, preco_centavos: number, ordem = 1) => ({ id, nome, descricao: null, preco_centavos, disponivel: true, imagem: null, ordem });
const base = () => ({
  versao: 'teste', atualizado_em: null,
  categorias: [
    { id: 'cinnamon_rolls', nome: 'Cinnamon Rolls', observacao: null, ordem: 2, itens: [
      item('cinnamon_rolls.mood_cheesecake', 'Mood Cheesecake', 2415, 1), item('cinnamon_rolls.smores', 'S’mores', 2520, 2), item('cinnamon_rolls.kinder_bueno', 'Kinder Bueno', 2500, 3),
    ] },
    { id: 'cafes', nome: 'Cafés', observacao: null, ordem: 1, itens: [item('cafes.cafe_coado', 'Café coado', 600)] },
  ],
  adicionais: [{ id: 'extras', nome: 'Extras', observacao: null, aplicavel_a: [], itens: [{ id: 'extras.chantilly', nome: 'Chantilly', preco_centavos: 400 }] }],
});

test('aceita o formato do contrato e ordena por `ordem`', () => {
  expect(validarCatalogo(base()).categorias.map((c) => c.id)).toEqual(['cafes', 'cinnamon_rolls']);
});

const invalidos: [string, (b: ReturnType<typeof base>) => void][] = [
  ['preço em reais, com fração', (b) => { b.categorias[1].itens[0].preco_centavos = 6.5; }],
  ['preço zero', (b) => { b.categorias[1].itens[0].preco_centavos = 0; }],
  ['produto sem nome', (b) => { b.categorias[1].itens[0].nome = ' '; }],
  ['produto sem id', (b) => { (b.categorias[1].itens[0] as { id?: string }).id = undefined; }],
  ['id repetido', (b) => { b.categorias[1].itens[0].id = 'cinnamon_rolls.smores'; }],
  ['categoria vazia', (b) => { b.categorias[1].itens = []; }],
  ['sem categorias', (b) => { b.categorias = []; }],
  ['sem versão', (b) => { b.versao = ''; }],
];
for (const [nome, estraga] of invalidos) {
  test(`recusa: ${nome}`, () => {
    const b = base();
    estraga(b);
    expect(() => validarCatalogo(b)).toThrow(/Catálogo inválido/);
  });
}

test('preço: sem centavos quando a lista toda é inteira; com centavos em toda a lista se algum tiver', () => {
  expect(formatarPreco(600)).toBe('R$ 6');
  expect(formatarPreco(1943)).toBe('R$ 19,43');
  expect(formatarPreco(2500, temCentavos([{ preco_centavos: 2500 }, { preco_centavos: 2415 }]))).toBe('R$ 25,00');
  expect(formatarPreco(2505)).toBe('R$ 25,05');
});

test('assinatura muda com o preço e ignora a data da leitura', () => {
  const a = validarCatalogo(base());
  const data = validarCatalogo({ ...base(), atualizado_em: '2026-11-05T17:00:00Z' });
  const b = base();
  b.categorias[1].itens[0].preco_centavos = 1200;
  expect(assinaturaCatalogo(data)).toBe(assinaturaCatalogo(a));
  expect(assinaturaCatalogo(validarCatalogo(b))).not.toBe(assinaturaCatalogo(a));
});

test('categoria sem apresentação no site e foto de produto que saiu do catálogo derrubam o build', () => {
  const nova = validarCatalogo({ ...base(), categorias: [...base().categorias, { id: 'nova', nome: 'Nova', observacao: null, ordem: 3, itens: [item('nova.x', 'X', 100)] }] });
  expect(() => montarCardapio(nova)).toThrow(/Categoria sem apresentação/);
  const semFoto = base();
  semFoto.categorias[0].itens = semFoto.categorias[0].itens.slice(1);
  expect(() => montarCardapio(validarCatalogo(semFoto))).toThrow(/Foto de produto que não existe/);
});

test('adicionais sem categoria definida ficam em bebidas, sem prometer por produto', () => {
  const { adicionaisBebidas, beber } = montarCardapio(validarCatalogo(base()));
  expect(adicionaisBebidas.map((a) => a.id)).toEqual(['extras']);
  expect(beber.flatMap((c) => c.adicionais)).toEqual([]);
});
