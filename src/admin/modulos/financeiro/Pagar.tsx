// Registrar pagamento de uma conta (POST /admin/financeiro/parcelas/{id}/pagamentos): total ou parcial.
// Conta fixa de valor variável: paga-se o valor REAL do mês; a conta fixa (recorrência) não muda.
// Juros/multa/encargos (0042): a pessoa informa SEPARADO o valor da conta quitado e os encargos; vai `valor` = total
// que saiu e `encargos`. Valor acima do saldo sem encargos continua bloqueado (aqui e no backend): nada é presumido.
import { useEffect, useState } from 'preact/hooks';
import { Check, Info } from 'lucide-preact';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, num, paraDecimal, hojeISO, dataCurta } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { EntradaMoeda, EnvioArquivo } from '../../ui/entradas';
import type { FormaPagamento } from '../../lib/tipos/financeiro';
import { FORMAS, atualizarFinanceiro, avisar, AVISO_ARQUIVO_REPETIDO, useContasPagadoras, rotuloConta } from './comum';

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
  const [comEncargos, setComEncargos] = useState(false);
  const [encargos, setEncargos] = useState('');
  const [data, setData] = useState(hojeISO());
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [ident, setIdent] = useState('');
  // `ja_existia`: avisa antes; o boleto desta mesma conta é aceito, o arquivo de outro lançamento não (409, B2).
  const [arquivo, setArquivo] = useState<{ id: string; nome: string; jaExistia?: boolean } | null>(null);
  const [enviandoArq, setEnviandoArq] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  // 0029: quem pagou. Começa na conta padrão (a empresarial do Âmbar); conta pessoal só quando foi assim.
  const contas = useContasPagadoras();
  const [pagador, setPagador] = useState('');

  useEffect(() => {
    if (!conta) return;
    setPagador(contas.dados?.padrao_id ?? '');
    setValor(conta.valor_a_confirmar ? '' : brl(conta.saldo));
    setComEncargos(false);
    setEncargos('');
    setData(hojeISO());
    setForma('pix');
    setIdent('');
    setArquivo(null);
    setErro(null);
  }, [conta?.parcela_id]);
  useEffect(() => {
    if (conta && contas.dados?.padrao_id) setPagador((atual) => atual || contas.dados!.padrao_id!);
  }, [conta?.parcela_id, contas.dados?.padrao_id]);

  if (!conta) return <Gaveta aberta={false} aoFechar={aoFechar} titulo="">{null}</Gaveta>;
  const v = paraDecimal(valor);
  const enc = comEncargos ? paraDecimal(encargos) : null;
  const saldo = num(conta.saldo) ?? 0;
  const parcial = !conta.valor_a_confirmar && v !== null && Number(v) < saldo - 0.004;
  const acima = !conta.valor_a_confirmar && v !== null && Number(v) > saldo + 0.004;
  const excedente = acima ? Number(v) - saldo : 0;
  // O que sai do caixa: valor da conta quitado + encargos.
  const total = v !== null ? Number(v) + (enc !== null ? Number(enc) : 0) : null;

  /** "Foi juros": separa o que passou do saldo como encargos e deixa a conta pelo saldo (a pessoa confere e confirma). */
  function separarEncargos() {
    if (!acima) return setComEncargos(true);
    setEncargos(brl(excedente.toFixed(2)));
    setValor(brl(conta!.saldo));
    setComEncargos(true);
    setErro(null);
  }

  async function anexar(f: File) {
    setEnviandoArq(true);
    try {
      const r = await financeiro.enviarArquivo(f, 'comprovante');
      setArquivo({ id: r.id, nome: f.name, jaExistia: r.ja_existia });
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi('servidor', 'Não foi possível enviar o comprovante.'));
    } finally {
      setEnviandoArq(false);
    }
  }

  async function pagar(e: Event) {
    e.preventDefault();
    if (!v || Number(v) <= 0) return setErro(new ErroApi('validacao', 'Informe o valor pago.', 0, null, { valor: 'Informe o valor pago.' }));
    if (acima) {
      const msg = comEncargos
        ? `O valor da conta quitado passa do saldo (${moeda(conta!.saldo)}). Informe só o valor da conta; o resto vai em juros/encargos.`
        : `O valor passa do saldo da conta (${moeda(conta!.saldo)}) em ${moeda(excedente)}. Se a diferença foi juros, multa ou encargos, informe-a separadamente.`;
      return setErro(new ErroApi('validacao', msg, 0, null, { valor: 'Acima do saldo.' }));
    }
    if (comEncargos && (!enc || Number(enc) <= 0)) return setErro(new ErroApi('validacao', 'Informe o valor dos juros, multa ou encargos.', 0, null, { encargos: 'Informe os encargos.' }));
    const comJuros = comEncargos && enc !== null && Number(enc) > 0;
    setEnviando(true);
    setErro(null);
    try {
      await financeiro.pagar(conta!.parcela_id, {
        pago_em: data, forma, valor: comJuros ? total!.toFixed(2) : v, encargos: comJuros ? enc : null,
        identificador_transacao: ident.trim() || null, arquivo_id: arquivo?.id ?? null, conta_pagadora_id: pagador || null,
      });
      atualizarFinanceiro();
      avisar(comJuros ? `Pagamento de ${moeda(total)} registrado (${moeda(enc)} de juros/encargos).` : parcial ? 'Pagamento parcial registrado.' : 'Pagamento registrado.', 'ok');
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
            {parcial ? 'Registrar pagamento parcial' : comEncargos ? 'Registrar pagamento com encargos' : 'Registrar pagamento'}
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
          <Campo
            rotulo={comEncargos ? (conta.valor_a_confirmar ? 'Valor real da conta' : 'Valor da conta quitado') : conta.valor_a_confirmar ? 'Valor real pago' : 'Valor pago'}
            erro={erro?.campos.valor}
            ajuda={comEncargos ? 'Só o valor da conta, sem juros/multa.' : undefined}
          >
            {(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} invalido={!!erro?.campos.valor} autofoco />}
          </Campo>
          {comEncargos && (
            <Campo rotulo="Juros, multa ou encargos" erro={erro?.campos.encargos} ajuda="Valor pago a mais por atraso ou tarifa.">
              {(id, d) => <EntradaMoeda id={id} descr={d} valor={encargos} aoMudar={setEncargos} invalido={!!erro?.campos.encargos} />}
            </Campo>
          )}
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
          <Campo rotulo="Pago com a conta" ajuda={pagador ? undefined : 'Sem a conta, o pagamento fica em Pendências como “pagador não identificado”.'}>
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={pagador} onChange={(e) => setPagador(e.currentTarget.value)}>
                <option value="">Não informar agora</option>
                {(contas.dados?.itens ?? []).map((c) => <option key={c.id} value={c.id}>{rotuloConta(c)}{c.padrao ? ' — padrão' : ''}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Identificador da transação" opcional ajuda="Código do Pix (E2E) ou autenticação. Ajuda a conciliar com o extrato.">
            {(id, d) => <input id={id} class="entrada" autocomplete="off" aria-describedby={d} value={ident} maxLength={120} onInput={(e) => setIdent(e.currentTarget.value)} />}
          </Campo>
        </div>
        {parcial && <p class="campo__ajuda" style={{ color: 'var(--atencao)' }}>Pagamento parcial: ficam {moeda(saldo - Number(v))} em aberto nesta conta.</p>}
        {acima && !comEncargos && (
          <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
            <span>O valor passa do saldo da conta em <strong class="num">{moeda(excedente)}</strong>. Se a diferença foi juros, multa ou encargos, separe-a: a conta fica quitada por {moeda(conta.saldo)} e o pagamento registra o total.</span>{' '}
            <Botao tamanho="p" onClick={separarEncargos}>Separar como juros/encargos</Botao>
          </Aviso>
        )}
        {comEncargos ? (
          <div class="fin-valores" aria-live="polite">
            <div><span>Conta quitada</span><strong class="num">{moeda(v)}</strong></div>
            <div><span>Juros/encargos</span><strong class="num">{moeda(enc)}</strong></div>
            <div><span>Total pago (sai do caixa)</span><strong class="num">{moeda(total)}</strong></div>
            <div><Botao tamanho="p" variante="fantasma" onClick={() => { setComEncargos(false); setEncargos(''); }}>Sem encargos</Botao></div>
          </div>
        ) : !acima && (
          <Botao tamanho="p" variante="fantasma" onClick={separarEncargos}>Houve juros, multa ou encargos?</Botao>
        )}
        <div class="campo">
          <span class="campo__rotulo">Comprovante <em>(opcional)</em></span>
          {arquivo ? (
            <>
              <div class="linha linha--entre aviso"><span>{arquivo.nome}</span><Botao tamanho="p" variante="fantasma" onClick={() => setArquivo(null)}>Remover</Botao></div>
              {arquivo.jaExistia && <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>{AVISO_ARQUIVO_REPETIDO} O boleto desta mesma conta pode ser anexado.</Aviso>}
            </>
          ) : (
            <EnvioArquivo aceitar="image/*,application/pdf" titulo={enviandoArq ? 'Enviando…' : 'Anexar comprovante'} detalhe="Foto ou PDF" desativado={enviandoArq} aoEscolher={anexar} />
          )}
        </div>
      </form>
    </Gaveta>
  );
}
