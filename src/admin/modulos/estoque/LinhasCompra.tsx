// Linhas de produtos da conferência de uma compra que veio sem os itens (comprovante do pagamento) ou de um rascunho
// digitado: Insumo (seletor único do cadastro, pelo id), Quantidade, Unidade, Valor unitário e Subtotal. A unidade é a da
// compra (KG, L, UN, CX…); o backend converte para a unidade cadastrada do insumo e, quando não dá (ex.: CX sem
// conteúdo), o item fica pendente só da conversão.
import { useId } from 'preact/hooks';
import { Plus, Trash2 } from 'lucide-preact';
import { moeda, paraDecimal } from '../../lib/formato';
import { Botao } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import type { ItemManual, UnidadeBase } from '../../lib/tipos/estoque';
import { SeletorInsumo, type InsumoEscolhido } from './SeletorInsumo';

export interface LinhaManual {
  /** Insumo do cadastro escolhido no seletor (obrigatório para salvar: nada de texto livre). */
  insumo: InsumoEscolhido | null;
  /** Texto do rascunho anterior quando o item ainda não tinha insumo (só para mostrar). */
  lido?: string;
  quantidade: string;
  unidade: string;
  /** Valor unitário (R$ por unidade de compra); o subtotal é quantidade × unitário. */
  unitario: string;
  /** Subtotal já gravado (rascunho reaberto): vale até a pessoa mudar quantidade ou valor, para o centavo do unitário
   *  arredondado não mudar a soma sozinho. */
  total?: string;
}
export const linhaVazia = (): LinhaManual => ({ insumo: null, quantidade: '', unidade: 'UN', unitario: '' });

const qtd = (t: string) => Number(t.replace(',', '.'));
/** Subtotal da linha em reais, arredondado ao centavo (0 se faltar quantidade ou valor). */
export const subtotal = (l: LinhaManual) => {
  if (l.total !== undefined) return Number(l.total);
  const q = qtd(l.quantidade);
  const u = Number(paraDecimal(l.unitario) ?? NaN);
  return q > 0 && u >= 0 ? Math.round(q * u * 100) / 100 : 0;
};
export const somaLinhas = (linhas: LinhaManual[]) => Math.round(linhas.reduce((s, l) => s + subtotal(l), 0) * 100) / 100;

/** Validação comum (o backend valida de novo: quantidade > 0, valor ≥ 0, insumo existente). */
export function validarLinhas(linhas: LinhaManual[]): { itens: ItemManual[]; erro: string | null; linha?: number } {
  const usadas = linhas.map((l, k) => ({ l, k })).filter(({ l }) => l.insumo || l.quantidade || l.unitario);
  if (!usadas.length) return { itens: [], erro: 'Adicione pelo menos um item.' };
  const itens: ItemManual[] = [];
  for (const { l, k } of usadas) {
    const q = qtd(l.quantidade);
    const u = paraDecimal(l.unitario);
    if (!l.insumo) return { itens, erro: `Linha ${k + 1}: escolha o insumo no cadastro.`, linha: k };
    const nome = l.insumo.nome;
    if (!(q > 0) || !Number.isFinite(q)) return { itens, erro: `${nome}: informe uma quantidade maior que zero.`, linha: k };
    if (u === null || !(Number(u) >= 0)) return { itens, erro: `${nome}: informe o valor unitário.`, linha: k };
    itens.push({ descricao: nome, quantidade: String(q), unidade: l.unidade.trim().toUpperCase() || 'UN', valor_total: subtotal(l).toFixed(2), insumo_id: l.insumo.id });
  }
  return { itens, erro: null };
}

const UNIDADES_COMPRA = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'BDJ', 'DZ', 'SC'];
/** Unidade de compra que costuma acompanhar a unidade cadastrada (g → KG, ml → L, un → UN). */
const COMPRA_DA_BASE: Record<UnidadeBase, string> = { g: 'KG', ml: 'L', un: 'UN' };

/** Linhas editáveis: cabeçalho único no computador; no celular, cada linha vira um cartão com os rótulos. */
export function LinhasItens({ linhas, aoMudar, invalida }: { linhas: LinhaManual[]; aoMudar: (l: LinhaManual[]) => void; invalida?: number | null }) {
  const base = useId();
  // Mudou quantidade ou valor: o subtotal volta a ser quantidade × unitário.
  const set = (k: number, m: Partial<LinhaManual>) =>
    aoMudar(linhas.map((l, i) => (i === k ? { ...l, ...m, ...('quantidade' in m || 'unitario' in m ? { total: undefined } : {}) } : l)));
  return (
    <div class="itens-tabela" role="group" aria-label="Itens da compra">
      <div class="itens-tabela__cabeca itens-tabela__linha" aria-hidden="true">
        <span>Insumo</span><span class="num">Quantidade</span><span>Unidade</span><span class="num">Valor unitário</span><span class="num">Subtotal</span><span />
      </div>
      {linhas.map((l, k) => (
        <div class="itens-tabela__linha" key={k} data-invalida={invalida === k ? '' : undefined}>
          <div class="itens-tabela__insumo">
            <SeletorInsumo
              rotulo={`Insumo ${k + 1}`}
              tipo="comprado"
              valor={l.insumo}
              invalido={invalida === k}
              placeholder={l.lido ? `Na nota: ${l.lido}` : 'Buscar insumo'}
              // Só sugere a unidade do cadastro rápido quando a linha já diz o peso ou o volume (o UN de partida não diz nada).
              unidadeSugerida={l.unidade === 'KG' || l.unidade === 'G' ? 'g' : l.unidade === 'L' || l.unidade === 'ML' ? 'ml' : null}
              // Ao escolher, a unidade da compra acompanha a cadastrada enquanto a linha ainda está em branco.
              aoEscolher={(i) => set(k, { insumo: i, ...(i && !l.quantidade ? { unidade: COMPRA_DA_BASE[i.unidade_base] } : {}) })}
            />
          </div>
          <label class="itens-tabela__celula">
            <span class="itens-tabela__rotulo">Quantidade</span>
            <input class="entrada num" inputMode="decimal" aria-label="Quantidade" value={l.quantidade} onInput={(e) => set(k, { quantidade: e.currentTarget.value })} />
          </label>
          <label class="itens-tabela__celula">
            <span class="itens-tabela__rotulo">Unidade</span>
            <select class="selecao" aria-label="Unidade" value={l.unidade} onChange={(e) => set(k, { unidade: e.currentTarget.value })}>
              {(UNIDADES_COMPRA.includes(l.unidade) ? UNIDADES_COMPRA : [l.unidade, ...UNIDADES_COMPRA]).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label class="itens-tabela__celula">
            <span class="itens-tabela__rotulo">Valor unitário</span>
            <EntradaMoeda id={`${base}-unit-${k}`} valor={l.unitario} aoMudar={(v) => set(k, { unitario: v })} />
          </label>
          <div class="itens-tabela__celula">
            <span class="itens-tabela__rotulo">Subtotal</span>
            <output class="itens-tabela__subtotal num" aria-label="Subtotal">{moeda(subtotal(l))}</output>
          </div>
          <Botao so_icone variante="fantasma" aria-label={`Remover a linha ${k + 1}`} icone={<Trash2 aria-hidden="true" />} disabled={linhas.length === 1} onClick={() => aoMudar(linhas.filter((_, i) => i !== k))} />
        </div>
      ))}
      <Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => aoMudar([...linhas, linhaVazia()])} style={{ alignSelf: 'flex-start' }}>Adicionar linha</Botao>
    </div>
  );
}
