// Detalhamento opcional de qualquer despesa (0034): itens com base, acréscimos (comissão, bônus, extra) e descontos.
// Total do item = base + acréscimos − descontos; total = soma dos itens. Contas em CENTAVOS inteiros (sem erro de ponto
// flutuante). O backend confere de novo (soma = valor) e o banco também, no fim da transação.
import { Plus, Trash2, Minus } from 'lucide-preact';
import { paraDecimal, moeda } from '../../lib/formato';
import { Botao } from '../../ui/base';
import type { ItemDetalhe } from '../../lib/tipos/financeiro';

export interface AjusteForm { descricao: string; valor: string }
export interface ItemForm { descricao: string; base: string; observacao: string; acrescimos: AjusteForm[]; descontos: AjusteForm[] }
export type ModoTotal = 'automatico' | 'informado';

const brl = (v: string | number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "1.000,50" → 100050 centavos (null = vazio/inválido). */
export const centavos = (v: string): number | null => {
  const d = paraDecimal(v);
  return d === null || d === undefined ? null : Math.round(Number(d) * 100);
};
export const deCentavos = (c: number) => (c / 100).toFixed(2);

export function totalItem(i: ItemForm): number {
  const soma = (l: AjusteForm[]) => l.reduce((s, a) => s + (centavos(a.valor) ?? 0), 0);
  return (centavos(i.base) ?? 0) + soma(i.acrescimos) - soma(i.descontos);
}
export const totalItens = (itens: ItemForm[]) => itens.reduce((s, i) => s + totalItem(i), 0);

/** Itens vindos do backend → formulário. */
export function paraForm(itens: ItemDetalhe[] | undefined | null): ItemForm[] {
  return (itens ?? []).map((i) => ({
    descricao: i.descricao, base: brl(i.valor_base), observacao: i.observacao ?? '',
    acrescimos: (i.acrescimos ?? []).map((a) => ({ descricao: a.descricao, valor: brl(a.valor) })),
    descontos: (i.descontos ?? []).map((a) => ({ descricao: a.descricao, valor: brl(a.valor) })),
  }));
}

/** Formulário → corpo da API (só itens com descrição). Erro em texto quando algo está inválido. */
export function paraApi(itens: ItemForm[]): { itens: ItemDetalhe[]; erro: string | null } {
  const saida: ItemDetalhe[] = [];
  for (const [n, i] of itens.entries()) {
    if (!i.descricao.trim()) return { itens: [], erro: `Item ${n + 1}: informe a descrição.` };
    const base = centavos(i.base);
    if (base === null || base < 0) return { itens: [], erro: `${i.descricao}: valor base inválido.` };
    const aj = (l: AjusteForm[], nome: string) => l.map((a) => ({ descricao: a.descricao.trim() || nome, valor: deCentavos(centavos(a.valor) ?? 0) }));
    const acrescimos = aj(i.acrescimos, 'Acréscimo');
    const descontos = aj(i.descontos, 'Desconto');
    if ([...acrescimos, ...descontos].some((a) => Number(a.valor) <= 0)) return { itens: [], erro: `${i.descricao}: acréscimo e desconto maiores que zero.` };
    if (totalItem(i) < 0) return { itens: [], erro: `${i.descricao}: total negativo.` };
    saida.push({ descricao: i.descricao.trim(), valor_base: deCentavos(base), observacao: i.observacao.trim() || null, acrescimos, descontos });
  }
  return { itens: saida, erro: null };
}

/** Editor dos itens. `semAjustes`: só a base (itens-base de conta recorrente). */
export function EditorItens({ itens, aoMudar, semAjustes = false }: { itens: ItemForm[]; aoMudar: (i: ItemForm[]) => void; semAjustes?: boolean }) {
  const mudar = (n: number, parte: Partial<ItemForm>) => aoMudar(itens.map((i, k) => (k === n ? { ...i, ...parte } : i)));
  const ajuste = (n: number, tipo: 'acrescimos' | 'descontos', k: number, parte: Partial<AjusteForm> | null) => {
    const lista = itens[n][tipo];
    mudar(n, { [tipo]: parte === null ? lista.filter((_, j) => j !== k) : lista.map((a, j) => (j === k ? { ...a, ...parte } : a)) });
  };
  return (
    <div class="pilha pilha--p fin-itens">
      {itens.map((i, n) => (
        <div key={n} class="fin-item">
          <div class="fin-item__linha">
            <input class="entrada" aria-label={`Descrição do item ${n + 1}`} placeholder="Descrição ou nome" maxLength={200} value={i.descricao} onInput={(e) => mudar(n, { descricao: e.currentTarget.value })} />
            <input class="entrada num fin-item__valor" aria-label={`Valor base de ${i.descricao || `item ${n + 1}`}`} inputMode="decimal" placeholder="0,00" value={i.base} onInput={(e) => mudar(n, { base: e.currentTarget.value })} />
            <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Remover ${i.descricao || `item ${n + 1}`}`} icone={<Trash2 aria-hidden="true" />} onClick={() => aoMudar(itens.filter((_, k) => k !== n))} />
          </div>
          {!semAjustes && (['acrescimos', 'descontos'] as const).map((tipo) => i[tipo].map((a, k) => (
            <div key={`${tipo}${k}`} class="fin-item__linha fin-item__ajuste">
              <span class="fraco" aria-hidden="true">{tipo === 'acrescimos' ? '+' : '−'}</span>
              <input class="entrada" aria-label={tipo === 'acrescimos' ? 'Descrição do acréscimo' : 'Descrição do desconto'} placeholder={tipo === 'acrescimos' ? 'Comissão, bônus, extra…' : 'Desconto'} maxLength={120} value={a.descricao} onInput={(e) => ajuste(n, tipo, k, { descricao: e.currentTarget.value })} />
              <input class="entrada num fin-item__valor" aria-label="Valor" inputMode="decimal" placeholder="0,00" value={a.valor} onInput={(e) => ajuste(n, tipo, k, { valor: e.currentTarget.value })} />
              <Botao tamanho="p" variante="fantasma" so_icone aria-label="Remover" icone={<Trash2 aria-hidden="true" />} onClick={() => ajuste(n, tipo, k, null)} />
            </div>
          )))}
          <div class="fin-item__linha fin-item__rodape">
            {!semAjustes && (
              <span class="linha" style={{ gap: '4px' }}>
                <Botao tamanho="p" variante="fantasma" icone={<Plus aria-hidden="true" />} onClick={() => mudar(n, { acrescimos: [...i.acrescimos, { descricao: '', valor: '' }] })}>Acréscimo</Botao>
                <Botao tamanho="p" variante="fantasma" icone={<Minus aria-hidden="true" />} onClick={() => mudar(n, { descontos: [...i.descontos, { descricao: '', valor: '' }] })}>Desconto</Botao>
              </span>
            )}
            <span class="num forte">{moeda(deCentavos(totalItem(i)))}</span>
          </div>
        </div>
      ))}
      <Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => aoMudar([...itens, { descricao: '', base: '', observacao: '', acrescimos: [], descontos: [] }])}>Adicionar item</Botao>
    </div>
  );
}

/** Caixa "Adicionar detalhamento" (recolhida por padrão) com o modo do total e a diferença. */
export function Detalhamento({ ativo, aoAtivar, itens, aoMudar, modo, aoMudarModo, valorInformado }: {
  ativo: boolean; aoAtivar: (v: boolean) => void; itens: ItemForm[]; aoMudar: (i: ItemForm[]) => void;
  modo: ModoTotal; aoMudarModo: (m: ModoTotal) => void; valorInformado: string;
}) {
  const total = totalItens(itens);
  const informado = centavos(valorInformado);
  const diferenca = modo === 'informado' && informado !== null ? informado - total : 0;
  return (
    <div class="pilha pilha--p">
      <label class="linha" style={{ gap: '8px' }}>
        <input type="checkbox" checked={ativo} onChange={(e) => aoAtivar(e.currentTarget.checked)} /> Adicionar detalhamento
      </label>
      {ativo && (
        <>
          <EditorItens itens={itens} aoMudar={aoMudar} />
          <div class="linha linha--entre" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <label class="linha" style={{ gap: '6px' }}>
              <select class="selecao selecao--auto" aria-label="Como fica o total" value={modo} onChange={(e) => aoMudarModo(e.currentTarget.value as ModoTotal)}>
                <option value="automatico">Total automático (soma dos itens)</option>
                <option value="informado">Total informado (conferir)</option>
              </select>
            </label>
            <span>Soma dos itens: <strong class="num">{moeda(deCentavos(total))}</strong></span>
          </div>
          {diferenca !== 0 && <span class="campo__erro" role="alert">O valor informado difere da soma dos itens em {moeda(deCentavos(diferenca))}. Corrija antes de salvar.</span>}
        </>
      )}
    </div>
  );
}

/** Erro que impede salvar (null = ok). */
export function erroDetalhamento(ativo: boolean, itens: ItemForm[], modo: ModoTotal, valorInformado: string): string | null {
  if (!ativo || itens.length === 0) return null;
  const { erro } = paraApi(itens);
  if (erro) return erro;
  if (totalItens(itens) <= 0) return 'O total do detalhamento precisa ser maior que zero.';
  const informado = centavos(valorInformado);
  if (modo === 'informado' && informado !== totalItens(itens)) return 'O valor informado não bate com a soma dos itens.';
  return null;
}
