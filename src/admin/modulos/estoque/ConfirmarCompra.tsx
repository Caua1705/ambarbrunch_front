// Confirmação do recebimento: como a compra aparece no Financeiro. A candidata forte (o pagamento que a Júlia já
// registrou, mesmo fornecedor e valor) vem pré-selecionada para não criar despesa em dobro; criar outra conta exige
// motivo (409 despesa_ja_registrada). Tudo vai numa única chamada: POST /admin/estoque/compras/{id}/confirmar.
import { useState } from 'preact/hooks';
import { Info, Link2, CalendarClock, BadgeCheck, AlertTriangle } from 'lucide-preact';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, hojeISO } from '../../lib/formato';
import { Aviso, Campo, Etiqueta } from '../../ui/base';
import type { CompraDetalhe, DespesaDaCompra } from '../../lib/tipos/estoque';
import { atualizarEstoque, PENDENCIA, type PermissoesEstoque } from './comum';

export interface Confirmado {
  despesa_id: string | null;
  movimentos: number;
  ja_estava_confirmada: boolean;
}

const FORMAS = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao', 'Cartão'], ['boleto', 'Boleto'], ['transferencia', 'Transferência'], ['debito_automatico', 'Débito automático'], ['outro', 'Outro']] as const;

export function ConfirmarCompra({ c, perm, form, aoConfirmar, aoEnviando }: { c: CompraDetalhe; perm: PermissoesEstoque; form: string; aoConfirmar: (r: Confirmado) => void; aoEnviando: (v: boolean) => void }) {
  const fortes = c.despesa.candidatas.filter((x) => x.forca === 'forte');
  const [escolha, setEscolha] = useState<string>(c.despesa_origem_id ? 'origem' : fortes[0] ? `vincular:${fortes[0].despesa_id}` : c.despesa.candidatas[0] ? 'automatica' : 'automatica');
  const [pagaEm, setPagaEm] = useState(hojeISO());
  const [forma, setForma] = useState<(typeof FORMAS)[number][0]>('pix');
  const [motivoNova, setMotivoNova] = useState('');
  const [motivoDiv, setMotivoDiv] = useState('');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const precisaNova = erro?.codigo === 'despesa_ja_registrada' || escolha === 'nova';
  // Nota que não fecha (e ainda não aceita): só quem tem estoque.editar confirma, com o motivo.
  const divergencia = !!c.conferencia && !c.conferencia.ok && !c.divergencia_aceita;
  const gerencia = perm.editar;
  const duplicatas = c.duplicatas ?? [];

  async function confirmar(e: Event) {
    e.preventDefault();
    let despesa: DespesaDaCompra = {};
    if (escolha.startsWith('vincular:')) despesa = { vincular_despesa_id: escolha.slice(9) };
    else if (escolha === 'paga') despesa = { paga_em: pagaEm, forma };
    else if (escolha === 'nova') despesa = { criar_nova: true, motivo_nova: motivoNova.trim() };
    if (escolha === 'nova' && motivoNova.trim().length < 5) return setErro(new ErroApi('validacao', 'Explique por que esta compra precisa de outra conta (pelo menos 5 caracteres).'));
    if (divergencia && motivoDiv.trim().length < 5) return setErro(new ErroApi('validacao', 'Explique a diferença da nota (pelo menos 5 caracteres).'));
    aoEnviando(true);
    setErro(null);
    try {
      const r = await estoque.confirmarCompra(c.id, { versao: c.versao, despesa, ...(divergencia ? { motivo_divergencia: motivoDiv.trim() } : {}) });
      atualizarEstoque();
      aoConfirmar({ despesa_id: r.despesa_id, movimentos: r.movimentos, ja_estava_confirmada: r.ja_estava_confirmada });
    } catch (x) {
      const er = x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível confirmar.');
      setErro(er);
      if (er.codigo === 'despesa_ja_registrada' && fortes[0]) setEscolha(`vincular:${fortes[0].despesa_id}`);
      if (er.codigo === 'conflito_versao' || er.codigo === 'pendencias') atualizarEstoque();
    } finally {
      aoEnviando(false);
    }
  }

  const entram = c.itens.filter((i) => i.situacao === 'confirmado' || i.situacao === 'sugerido').length;
  const despesas = c.itens.filter((i) => i.situacao === 'nao_estoque').length;

  return (
    <form id={form} class="pilha" onSubmit={confirmar} noValidate>
      <Aviso tom="info" icone={<Info aria-hidden="true" />}>
        Ao confirmar, <strong>{entram} {entram === 1 ? 'item entra' : 'itens entram'} no estoque</strong>
        {despesas ? <> e {despesas} {despesas === 1 ? 'vira despesa' : 'viram despesa'}</> : null}. Tudo numa vez só; dá para cancelar depois (gerência).
      </Aviso>

      <fieldset class="pilha pilha--p" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend class="secao-titulo" style={{ marginBottom: '8px' }}>Como esta compra aparece no Financeiro</legend>
        <div class="opcoes-despesa" role="radiogroup">
          {c.despesa_origem_id ? (
            <label class="opcao">
              <input type="radio" name="despesa" checked readOnly />
              <span class="opcao__texto">
                <strong class="linha" style={{ gap: '6px' }}><Link2 size={15} aria-hidden="true" /> É o pagamento que a Júlia registrou</strong>
                <span>Esta compra só detalha os produtos daquele pagamento de {moeda(c.totais.total)}. Nenhuma conta nova é criada.</span>
              </span>
            </label>
          ) : (
            <>
              {c.despesa.candidatas.map((d) => (
                <label class="opcao" key={d.despesa_id}>
                  <input type="radio" name="despesa" checked={escolha === `vincular:${d.despesa_id}`} onChange={() => setEscolha(`vincular:${d.despesa_id}`)} />
                  <span class="opcao__texto">
                    <strong class="linha" style={{ gap: '6px' }}>
                      <Link2 size={15} aria-hidden="true" /> Já foi registrado: {d.descricao}
                      {d.forca === 'forte' && <Etiqueta tom="ok" icone={<BadgeCheck aria-hidden="true" />}>Mesmo fornecedor e valor</Etiqueta>}
                    </strong>
                    <span>{moeda(d.valor)} · {dataCurta(d.competencia)} · {d.origem === 'julia' ? 'pela Júlia' : `pelo ${d.origem}`} · {d.paga ? 'já pago' : 'a pagar'}. Liga a compra a este lançamento, sem duplicar.</span>
                  </span>
                </label>
              ))}
              <label class="opcao">
                <input type="radio" name="despesa" checked={escolha === 'automatica'} onChange={() => setEscolha('automatica')} />
                <span class="opcao__texto">
                  <strong class="linha" style={{ gap: '6px' }}><CalendarClock size={15} aria-hidden="true" /> Conta a pagar</strong>
                  <span>
                    {duplicatas.length
                      ? `Com as parcelas da nota: ${duplicatas.map((d) => `${moeda(d.valor)} em ${dataCurta(d.vencimento)}`).join(' · ')}.`
                      : `Um vencimento na data da nota (${moeda(c.totais.total)}). Ajuste depois em Contas a pagar, se preciso.`}
                  </span>
                </span>
              </label>
              <label class="opcao">
                <input type="radio" name="despesa" checked={escolha === 'paga'} onChange={() => setEscolha('paga')} />
                <span class="opcao__texto">
                  <strong>Já foi paga (supermercado, feira)</strong>
                  <span>Registra a despesa como paga, sem conta em aberto.</span>
                </span>
              </label>
              {escolha === 'paga' && (
                <div class="grade-campos">
                  <Campo rotulo="Pago em">{(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={pagaEm} onChange={(e) => setPagaEm(e.currentTarget.value)} />}</Campo>
                  <Campo rotulo="Forma">
                    {(id) => (
                      <select id={id} class="selecao" value={forma} onChange={(e) => setForma(e.currentTarget.value as (typeof FORMAS)[number][0])}>
                        {FORMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                      </select>
                    )}
                  </Campo>
                </div>
              )}
              {(precisaNova || fortes.length > 0) && (
                <label class="opcao">
                  <input type="radio" name="despesa" checked={escolha === 'nova'} onChange={() => setEscolha('nova')} />
                  <span class="opcao__texto">
                    <strong>É outra compra: criar uma conta nova</strong>
                    <span>Só se o pagamento sugerido NÃO for desta nota.</span>
                  </span>
                </label>
              )}
              {escolha === 'nova' && (
                <Campo rotulo="Por que criar outra conta?" ajuda="Fica registrado no histórico. Ex.: o Pix foi de outra entrega.">
                  {(id, d) => <textarea id={id} class="area" aria-describedby={d} maxLength={300} value={motivoNova} onInput={(e) => setMotivoNova(e.currentTarget.value)} />}
                </Campo>
              )}
            </>
          )}
        </div>
      </fieldset>

      {divergencia &&
        (gerencia ? (
          <Campo rotulo="A nota não fecha: explique a diferença" ajuda="Só a gerência confirma uma nota com diferença. Ex.: frete cobrado à parte.">
            {(id, d) => <textarea id={id} class="area" aria-describedby={d} maxLength={300} value={motivoDiv} onInput={(e) => setMotivoDiv(e.currentTarget.value)} />}
          </Campo>
        ) : (
          <Aviso tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>A soma da nota não fecha. Peça para a gerência confirmar esta compra.</Aviso>
        ))}

      {erro && (
        <Aviso tom={erro.codigo === 'despesa_ja_registrada' ? 'atencao' : 'perigo'} icone={<AlertTriangle aria-hidden="true" />}>
          {erro.message}
          {erro.codigo === 'pendencias' && Array.isArray(erro.dados?.pendencias) && <div class="fraco" style={{ marginTop: '4px' }}>{(erro.dados!.pendencias as string[]).map(PENDENCIA).join(' · ')}</div>}
        </Aviso>
      )}
    </form>
  );
}
