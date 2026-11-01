// Confirmação do recebimento: como a compra aparece no Financeiro. A candidata forte (o pagamento que a Júlia já
// registrou, mesmo fornecedor e valor) vem pré-selecionada para não criar despesa em dobro; criar outra conta exige
// motivo (409 despesa_ja_registrada). Tudo vai numa única chamada: POST /admin/estoque/compras/{id}/confirmar.
// B3: só a candidata `vinculavel` (total ao centavo) pode ser vinculada; a parecida que não bate mostra a diferença e o
// caminho certo (corrigir o valor, ou enviar esta nota à pendência do pagamento). Com uma candidata que
// `aguarda_conferencia`, a compra não vira conta nova de jeito nenhum (409 pagamento_aguarda_conferencia).
import { useRef, useState } from 'preact/hooks';
import { Info, Link2, CalendarClock, BadgeCheck, AlertTriangle, Clock, ExternalLink } from 'lucide-preact';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, hojeISO } from '../../lib/formato';
import { avisar } from '../../ui/camadas';
import { Aviso, Botao, Campo, Etiqueta } from '../../ui/base';
import type { CandidataDespesa, CompraDetalhe, DespesaDaCompra } from '../../lib/tipos/estoque';
import { atualizarEstoque, PENDENCIA, type PermissoesEstoque } from './comum';

export interface Confirmado {
  despesa_id: string | null;
  movimentos: number;
  ja_estava_confirmada: boolean;
}

const FORMAS = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao', 'Cartão'], ['boleto', 'Boleto'], ['transferencia', 'Transferência'], ['debito_automatico', 'Débito automático'], ['outro', 'Outro']] as const;

/** Backend anterior ao B3 não manda `vinculavel`: vale o comportamento antigo (o 409 total_diverge_do_financeiro avisa). */
const vinculavel = (d: CandidataDespesa) => d.vinculavel !== false;

/** "R$ 2,40 a menos que a nota" (diferenca = despesa − compra). */
function textoDiferenca(diferenca: string | number | undefined) {
  const v = Number(diferenca ?? 0);
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return 'mesmo valor da nota';
  return `diferença de ${moeda(Math.abs(v))} (${v > 0 ? 'a mais' : 'a menos'} que a nota)`;
}

export function ConfirmarCompra({ c, perm, form, aoConfirmar, aoEnviando, aoAbrir }: { c: CompraDetalhe; perm: PermissoesEstoque; form: string; aoConfirmar: (r: Confirmado) => void; aoEnviando: (v: boolean) => void; aoAbrir?: (id: string) => void }) {
  const vinculaveis = c.despesa.candidatas.filter(vinculavel);
  const parecidas = c.despesa.candidatas.filter((x) => !vinculavel(x));
  // Pagamento que já espera a conferência da compra dele: esta nota não pode virar conta nova (nem a pagar, nem paga).
  const esperando = c.despesa.candidatas.filter((x) => x.aguarda_conferencia);
  const fortes = vinculaveis.filter((x) => x.forca === 'forte');
  const inicial = c.despesa_origem_id ? 'origem' : fortes[0] ? `vincular:${fortes[0].despesa_id}` : esperando.length ? (vinculaveis[0] ? `vincular:${vinculaveis[0].despesa_id}` : 'bloqueada') : 'automatica';
  const [escolha, setEscolha] = useState<string>(inicial);
  const [pagaEm, setPagaEm] = useState(hojeISO());
  const [forma, setForma] = useState<(typeof FORMAS)[number][0]>('pix');
  const [motivoNova, setMotivoNova] = useState('');
  const [motivoDiv, setMotivoDiv] = useState('');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [procurando, setProcurando] = useState<string | null>(null);
  // Um envio por vez, mesmo com dois cliques antes de o botão desabilitar (o backend também é idempotente).
  const enviandoRef = useRef(false);
  const precisaNova = !esperando.length && (erro?.codigo === 'despesa_ja_registrada' || escolha === 'nova');
  // Nota que não fecha (e ainda não aceita): só quem tem estoque.editar confirma, com o motivo.
  const divergencia = !!c.conferencia && !c.conferencia.ok && !c.divergencia_aceita;
  const gerencia = perm.editar;
  const duplicatas = c.duplicatas ?? [];

  /** A pendência viva do pagamento (a compra que nasceu do comprovante): é nela que esta nota é enviada. */
  async function abrirPendencia(despesaId: string) {
    if (!aoAbrir || procurando) return;
    setProcurando(despesaId);
    try {
      const r = await estoque.compras({ etapa: 'aguardando_conferencia', limite: 200 });
      const pendencia = r.itens.find((x) => x.despesa_origem_id === despesaId && x.id !== c.id);
      if (pendencia) aoAbrir(pendencia.id);
      else avisar('A conferência desse pagamento não está mais aberta. Atualize a lista de compras.', 'info');
    } catch (x) {
      avisar(x instanceof ErroApi ? x.message : 'Não foi possível abrir a conferência do pagamento.', 'erro');
    } finally {
      setProcurando(null);
    }
  }

  async function confirmar(e: Event) {
    e.preventDefault();
    if (escolha === 'bloqueada') return setErro(new ErroApi('validacao', 'Esta compra só pode conferir o pagamento que já espera por ela: abra a conferência dele e envie esta nota lá, ou corrija os valores até baterem.'));
    let despesa: DespesaDaCompra = {};
    if (escolha.startsWith('vincular:')) despesa = { vincular_despesa_id: escolha.slice(9) };
    else if (escolha === 'paga') despesa = { paga_em: pagaEm, forma };
    else if (escolha === 'nova') despesa = { criar_nova: true, motivo_nova: motivoNova.trim() };
    if (escolha === 'nova' && motivoNova.trim().length < 5) return setErro(new ErroApi('validacao', 'Explique por que esta compra precisa de outra conta (pelo menos 5 caracteres).'));
    if (divergencia && motivoDiv.trim().length < 5) return setErro(new ErroApi('validacao', 'Explique a diferença da nota (pelo menos 5 caracteres).'));
    if (enviandoRef.current) return;
    enviandoRef.current = true;
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
      // O pagamento espera a conferência: nada de conta nova; volta para a vinculável (se houver) e recarrega as candidatas.
      if (er.codigo === 'pagamento_aguarda_conferencia') setEscolha(vinculaveis[0] ? `vincular:${vinculaveis[0].despesa_id}` : 'bloqueada');
      if (er.codigo && ['conflito_versao', 'pendencias', 'total_diverge_do_financeiro', 'pagamento_aguarda_conferencia'].includes(er.codigo)) atualizarEstoque();
    } finally {
      enviandoRef.current = false;
      aoEnviando(false);
    }
  }

  const entram = c.itens.filter((i) => i.situacao === 'confirmado' || i.situacao === 'sugerido').length;
  const despesas = c.itens.filter((i) => i.situacao === 'nao_estoque').length;
  const aguardandoNoErro = erro?.codigo === 'pagamento_aguarda_conferencia' && Array.isArray(erro.dados?.candidatas) ? (erro.dados!.candidatas as CandidataDespesa[]) : [];

  const botaoPendencia = (despesaId: string) =>
    aoAbrir && (
      <Botao tamanho="p" variante="secundario" icone={<ExternalLink aria-hidden="true" />} carregando={procurando === despesaId} style={{ alignSelf: 'flex-start' }} onClick={() => abrirPendencia(despesaId)}>
        Abrir a conferência deste pagamento
      </Botao>
    );

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
              {vinculaveis.map((d) => (
                <label class="opcao" key={d.despesa_id}>
                  <input type="radio" name="despesa" checked={escolha === `vincular:${d.despesa_id}`} onChange={() => setEscolha(`vincular:${d.despesa_id}`)} />
                  <span class="opcao__texto">
                    <strong class="linha" style={{ gap: '6px' }}>
                      <Link2 size={15} aria-hidden="true" /> Já foi registrado: {d.descricao}
                      {d.forca === 'forte' && <Etiqueta tom="ok" icone={<BadgeCheck aria-hidden="true" />}>Mesmo fornecedor e valor</Etiqueta>}
                    </strong>
                    <span>{moeda(d.valor)} · {dataCurta(d.competencia)} · {d.origem === 'julia' ? 'pela Júlia' : `pelo ${d.origem}`} · {d.paga ? 'já pago' : 'a pagar'}{d.diferenca !== undefined ? ` · ${textoDiferenca(d.diferenca)}` : ''}. Liga a compra a este lançamento, sem duplicar.</span>
                  </span>
                </label>
              ))}
              {parecidas.map((d) => (
                <div class="opcao" key={d.despesa_id} data-candidata-bloqueada={d.despesa_id} aria-label={`Pagamento parecido: ${d.descricao}`} role="group">
                  <span class="opcao__texto">
                    <strong class="linha" style={{ gap: '6px' }}>
                      <AlertTriangle size={15} aria-hidden="true" /> Parecido, mas o valor não bate: {d.descricao}
                      {d.aguarda_conferencia && <Etiqueta tom="atencao" icone={<Clock aria-hidden="true" />}>Aguarda conferência</Etiqueta>}
                    </strong>
                    <span>
                      {moeda(d.valor)} · {dataCurta(d.competencia)} · {d.origem === 'julia' ? 'pela Júlia' : `pelo ${d.origem}`} · {d.paga ? 'já pago' : 'a pagar'} · <strong>{textoDiferenca(d.diferenca)}</strong>.
                      {' '}Só dá para vincular com o valor batendo ao centavo.
                    </span>
                    <span class="fraco">
                      {d.aguarda_conferencia
                        ? 'Este pagamento já espera a conferência da compra dele (veio do comprovante, sem os produtos). Se esta nota for dele, abra essa conferência e envie esta mesma nota lá: ela passa a conferir o pagamento, sem despesa nova.'
                        : `Se esta nota for deste pagamento, corrija o valor no Financeiro (ou o desconto/itens da nota) até somar ${moeda(d.valor)} e depois vincule.`}
                    </span>
                    {d.aguarda_conferencia && botaoPendencia(d.despesa_id)}
                  </span>
                </div>
              ))}
              {esperando.length > 0 ? (
                <Aviso tom="atencao" icone={<Clock aria-hidden="true" />}>
                  <strong>Esta compra não vira conta nova.</strong> {esperando.length === 1 ? 'Um pagamento parecido já espera' : 'Pagamentos parecidos já esperam'} a conferência desta compra; lançar outra despesa contaria o mesmo gasto duas vezes.
                  {vinculaveis.length ? ' Vincule ao pagamento certo acima.' : ''}
                </Aviso>
              ) : (
                <>
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
                        <span>Só se o pagamento sugerido NÃO for desta nota. Valor diferente não é motivo: corrija o valor.</span>
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
        <Aviso tom={erro.codigo === 'despesa_ja_registrada' || erro.codigo === 'pagamento_aguarda_conferencia' ? 'atencao' : 'perigo'} icone={<AlertTriangle aria-hidden="true" />}>
          {erro.message}
          {erro.codigo === 'pendencias' && Array.isArray(erro.dados?.pendencias) && <div class="fraco" style={{ marginTop: '4px' }}>{(erro.dados!.pendencias as string[]).map(PENDENCIA).join(' · ')}</div>}
          {aguardandoNoErro.map((d) => (
            <div key={d.despesa_id} class="pilha pilha--p" style={{ marginTop: '6px' }}>
              <span class="fraco">{d.descricao} · {moeda(d.valor)} · {textoDiferenca(d.diferenca)}</span>
              {botaoPendencia(d.despesa_id)}
            </div>
          ))}
        </Aviso>
      )}
    </form>
  );
}
