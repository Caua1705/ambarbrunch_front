// Registrar pagamento de uma conta (POST /admin/financeiro/parcelas/{id}/pagamentos): total ou parcial.
// Conta fixa de valor variável: paga-se o valor REAL do mês; a conta fixa (recorrência) não muda.
import { useEffect, useState } from 'preact/hooks';
import { Check, Info } from 'lucide-preact';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, num, paraDecimal, hojeISO, dataCurta } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { EntradaMoeda, EnvioArquivo } from '../../ui/entradas';
import type { FormaPagamento } from '../../lib/tipos/financeiro';
import { FORMAS, atualizarFinanceiro, avisar } from './comum';

export interface ContaParaPagar {
  parcela_id: string;
  descricao: string;
  fornecedor?: string | null;
  vencimento: string;
  valor: string;
  valor_pago: string;
  saldo: string;
  valor_a_confirmar: boolean;
}

const brl = (v: string | null) => (v === null ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function Pagar({ conta, aoFechar }: { conta: ContaParaPagar | null; aoFechar: () => void }) {
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeISO());
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [ident, setIdent] = useState('');
  const [arquivo, setArquivo] = useState<{ id: string; nome: string } | null>(null);
  const [enviandoArq, setEnviandoArq] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);

  useEffect(() => {
    if (!conta) return;
    setValor(conta.valor_a_confirmar ? '' : brl(conta.saldo));
    setData(hojeISO());
    setForma('pix');
    setIdent('');
    setArquivo(null);
    setErro(null);
  }, [conta?.parcela_id]);

  if (!conta) return <Gaveta aberta={false} aoFechar={aoFechar} titulo="">{null}</Gaveta>;
  const v = paraDecimal(valor);
  const saldo = num(conta.saldo) ?? 0;
  const parcial = !conta.valor_a_confirmar && v !== null && Number(v) < saldo - 0.004;
  const acima = !conta.valor_a_confirmar && v !== null && Number(v) > saldo + 0.004;

  async function anexar(f: File) {
    setEnviandoArq(true);
    try {
      const r = await financeiro.enviarArquivo(f, 'comprovante');
      setArquivo({ id: r.id, nome: f.name });
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi('servidor', 'Não foi possível enviar o comprovante.'));
    } finally {
      setEnviandoArq(false);
    }
  }

  async function pagar(e: Event) {
    e.preventDefault();
    if (!v || Number(v) <= 0) return setErro(new ErroApi('validacao', 'Informe o valor pago.', 0, null, { valor: 'Informe o valor pago.' }));
    if (acima) return setErro(new ErroApi('validacao', `O valor passa do saldo da conta (${moeda(conta!.saldo)}).`, 0, null, { valor: 'Acima do saldo.' }));
    setEnviando(true);
    setErro(null);
    try {
      await financeiro.pagar(conta!.parcela_id, { pago_em: data, forma, valor: v, identificador_transacao: ident.trim() || null, arquivo_id: arquivo?.id ?? null });
      atualizarFinanceiro();
      avisar(parcial ? 'Pagamento parcial registrado.' : 'Pagamento registrado.', 'ok');
      aoFechar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível registrar.');
      if (x.codigo === 'identificador_repetido') x.message = 'Este identificador de transação já foi usado em outro pagamento. Confira se a conta já não foi paga.';
      setErro(x);
      if (x.tipo === 'conflito') atualizarFinanceiro();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Gaveta
      aberta
      aoFechar={aoFechar}
      titulo="Registrar pagamento"
      subtitulo={`${conta.descricao}${conta.fornecedor ? ` · ${conta.fornecedor}` : ''}`}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-pagar" carregando={enviando} disabled={enviandoArq} icone={<Check aria-hidden="true" />}>
            {parcial ? 'Registrar pagamento parcial' : 'Registrar pagamento'}
          </Botao>
        </>
      }
    >
      <form id="form-pagar" class="pilha" onSubmit={pagar} noValidate>
        <div class="fin-valores">
          <div><span>{conta.valor_a_confirmar ? 'Previsto' : 'Valor da conta'}</span><strong class="num">{moeda(conta.valor)}</strong></div>
          <div><span>Já pago</span><strong class="num">{moeda(conta.valor_pago)}</strong></div>
          <div><span>Em aberto</span><strong class="num">{conta.valor_a_confirmar ? '—' : moeda(conta.saldo)}</strong></div>
          <div><span>Vencimento</span><strong>{dataCurta(conta.vencimento, { ano: true })}</strong></div>
        </div>
        {conta.valor_a_confirmar && (
          <Aviso tom="info" icone={<Info aria-hidden="true" />}>
            <strong>Conta de valor variável.</strong> O valor previsto é só uma estimativa. Informe quanto foi realmente pago neste mês — isso fixa o valor desta conta, sem mudar a conta fixa dos próximos meses.
          </Aviso>
        )}
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
        <div class="grade-campos">
          <Campo rotulo={conta.valor_a_confirmar ? 'Valor real pago' : 'Valor pago'} erro={erro?.campos.valor}>
            {(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} invalido={!!erro?.campos.valor} autofoco />}
          </Campo>
          <Campo rotulo="Data do pagamento" erro={erro?.campos.pago_em}>
            {(id, d) => <input id={id} type="date" class="entrada" max={hojeISO()} aria-describedby={d} value={data} onChange={(e) => setData(e.currentTarget.value)} />}
          </Campo>
          <Campo rotulo="Forma">
            {(id) => (
              <select id={id} class="selecao" value={forma} onChange={(e) => setForma(e.currentTarget.value as FormaPagamento)}>
                {FORMAS.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Identificador da transação" opcional ajuda="Código do Pix (E2E) ou autenticação. Ajuda a conciliar com o extrato.">
            {(id, d) => <input id={id} class="entrada" autocomplete="off" aria-describedby={d} value={ident} maxLength={120} onInput={(e) => setIdent(e.currentTarget.value)} />}
          </Campo>
        </div>
        {parcial && <p class="campo__ajuda" style={{ color: 'var(--atencao)' }}>Pagamento parcial: ficam {moeda(saldo - Number(v))} em aberto nesta conta.</p>}
        <div class="campo">
          <span class="campo__rotulo">Comprovante <em>(opcional)</em></span>
          {arquivo ? (
            <div class="linha linha--entre aviso"><span>{arquivo.nome}</span><Botao tamanho="p" variante="fantasma" onClick={() => setArquivo(null)}>Remover</Botao></div>
          ) : (
            <EnvioArquivo aceitar="image/*,application/pdf" titulo={enviandoArq ? 'Enviando…' : 'Anexar comprovante'} detalhe="Foto ou PDF" desativado={enviandoArq} aoEscolher={anexar} />
          )}
        </div>
      </form>
    </Gaveta>
  );
}
