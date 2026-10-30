// Nova despesa: o essencial primeiro (descrição, valor, categoria, data e se já foi paga); o resto recolhido.
// POST /admin/financeiro/despesas com Idempotency-Key (reenviar o mesmo formulário não lança em dobro).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, Info, ChevronDown, Plus, Trash2 } from 'lucide-preact';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { hojeISO, paraDecimal, moeda, somarMeses } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao, Campo, Aviso, Segmentado } from '../../ui/base';
import { EntradaMoeda, EnvioArquivo } from '../../ui/entradas';
import type { DespesaEntrada, FormaPagamento } from '../../lib/tipos/financeiro';
import { FORMAS, useCategorias, OpcoesCategoria, atualizarFinanceiro, avisar } from './comum';

type Situacao = 'paga' | 'a_pagar' | 'parcelada';

/** Mesmo dia `i` meses depois (31/01 → 28/02 → 31/03). */
function mesmoDia(iso: string, i: number) {
  const d = Number(iso.slice(8, 10));
  const inicio = somarMeses(iso, i);
  const [na, nm] = inicio.split('-').map(Number);
  const ultimo = new Date(Date.UTC(na, nm, 0)).getUTCDate();
  return `${inicio.slice(0, 8)}${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

export function NovaDespesa({ aberta, aoFechar, aoCriar }: { aberta: boolean; aoFechar: () => void; aoCriar?: (id: string) => void }) {
  const cats = useCategorias();
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [data, setData] = useState(hojeISO());
  const [situacao, setSituacao] = useState<Situacao>('paga');
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [pagoEm, setPagoEm] = useState(hojeISO());
  const [ident, setIdent] = useState('');
  const [vencimento, setVencimento] = useState(hojeISO());
  const [nParcelas, setNParcelas] = useState(2);
  const [parcelas, setParcelas] = useState<{ vencimento: string; valor: string }[]>([]);
  const [avancado, setAvancado] = useState(false);
  const [fornNome, setFornNome] = useState('');
  const [fornDoc, setFornDoc] = useState('');
  const [arquivo, setArquivo] = useState<{ id: string; nome: string } | null>(null);
  const [enviandoArq, setEnviandoArq] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const chave = useRef(novaChave());

  useEffect(() => {
    if (!aberta) return;
    setDescricao('');
    setValor('');
    setCategoria('');
    setData(hojeISO());
    setSituacao('paga');
    setForma('pix');
    setPagoEm(hojeISO());
    setIdent('');
    setVencimento(hojeISO());
    setNParcelas(2);
    setParcelas([]);
    setAvancado(false);
    setFornNome('');
    setFornDoc('');
    setArquivo(null);
    setErro(null);
    setErros({});
    chave.current = novaChave();
  }, [aberta]);

  // Parcelas iguais, a partir do vencimento escolhido, um mês de distância (centavos na última).
  useEffect(() => {
    if (situacao !== 'parcelada') return;
    const total = Number(paraDecimal(valor) ?? 0);
    const n = Math.max(2, Math.min(24, nParcelas));
    const base = Math.floor((total / n) * 100) / 100;
    setParcelas(Array.from({ length: n }, (_, i) => ({ vencimento: mesmoDia(vencimento, i), valor: (i === n - 1 ? total - base * (n - 1) : base).toFixed(2) })));
  }, [situacao, valor, nParcelas, vencimento]);

  async function anexar(f: File) {
    setEnviandoArq(true);
    try {
      const r = await financeiro.enviarArquivo(f, 'comprovante');
      setArquivo({ id: r.id, nome: f.name });
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi('servidor', 'Não foi possível enviar o arquivo.'));
    } finally {
      setEnviandoArq(false);
    }
  }

  async function enviar(e: Event) {
    e.preventDefault();
    const v = paraDecimal(valor);
    const es: Record<string, string> = {};
    if (descricao.trim().length < 2) es.descricao = 'Descreva a despesa (ex.: Conta de energia de outubro).';
    if (!v || Number(v) <= 0) es.valor = 'Informe o valor.';
    if (!categoria) es.categoria = 'Escolha a categoria.';
    if (!data) es.competencia = 'Informe a data.';
    if (situacao === 'paga' && !pagoEm) es.pago_em = 'Informe quando foi pago.';
    if (situacao === 'parcelada') {
      const soma = parcelas.reduce((s, p) => s + Number(p.valor), 0);
      if (v && Math.abs(soma - Number(v)) > 0.009) es.parcelas = `A soma das parcelas (${moeda(soma)}) precisa ser igual ao valor (${moeda(v)}).`;
    }
    setErros(es);
    if (Object.keys(es).length) return;
    const corpo: DespesaEntrada = {
      descricao: descricao.trim(),
      valor: v!,
      competencia: data,
      categoria,
      fornecedor: fornNome.trim() || fornDoc.trim() ? { nome: fornNome.trim() || null, documento: fornDoc.replace(/\D/g, '') || null } : null,
      arquivo_id: arquivo?.id ?? null,
      // Sem `pagamento` nem `parcelas`, o backend cria uma conta a pagar que vence na competência.
      pagamento: situacao === 'paga' ? { pago_em: pagoEm, forma, identificador_transacao: ident.trim() || null, arquivo_id: arquivo?.id ?? null } : null,
      parcelas: situacao === 'a_pagar' ? [{ vencimento, valor: v! }] : situacao === 'parcelada' ? parcelas : null,
    };
    setEnviando(true);
    setErro(null);
    try {
      const d = await financeiro.criarDespesa(corpo, chave.current);
      atualizarFinanceiro();
      avisar(d.status === 'em_revisao' ? 'Despesa lançada. Ela ficou em revisão (veja o motivo no detalhe).' : 'Despesa lançada.', 'ok');
      aoCriar?.(d.id);
      aoFechar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível lançar.');
      setErros(x.campos);
      setErro(x);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Nova despesa"
      subtitulo="Lançada pelo painel"
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-nova-despesa" carregando={enviando} disabled={enviandoArq} icone={<Check aria-hidden="true" />}>Lançar despesa</Botao>
        </>
      }
    >
      <form id="form-nova-despesa" class="pilha" onSubmit={enviar} noValidate>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
        <Campo rotulo="Descrição" erro={erros.descricao}>
          {(id, d) => <input id={id} class="entrada" maxLength={300} placeholder="Ex.: Conta de energia de outubro" aria-describedby={d} aria-invalid={!!erros.descricao || undefined} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} data-autofoco />}
        </Campo>
        <div class="grade-campos">
          <Campo rotulo="Valor" erro={erros.valor}>
            {(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} invalido={!!erros.valor} />}
          </Campo>
          <Campo rotulo="Data" erro={erros.competencia} ajuda="Dia da despesa (competência).">
            {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={data} onChange={(e) => setData(e.currentTarget.value)} />}
          </Campo>
          <Campo rotulo="Categoria" class="inteiro" erro={erros.categoria}>
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} aria-invalid={!!erros.categoria || undefined} value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                <option value="">Escolha…</option>
                <OpcoesCategoria cats={cats.dados ?? []} />
              </select>
            )}
          </Campo>
        </div>

        <div class="campo">
          <span class="campo__rotulo" id="rotulo-situacao">Situação</span>
          <Segmentado<Situacao> rotulo="Situação do pagamento" valor={situacao} aoMudar={setSituacao} opcoes={[{ valor: 'paga', rotulo: 'Já foi paga' }, { valor: 'a_pagar', rotulo: 'A pagar' }, { valor: 'parcelada', rotulo: 'Parcelada' }]} />
        </div>
        {situacao === 'paga' && (
          <div class="grade-campos">
            <Campo rotulo="Pago em" erro={erros.pago_em}>
              {(id, d) => <input id={id} type="date" class="entrada" max={hojeISO()} aria-describedby={d} value={pagoEm} onChange={(e) => setPagoEm(e.currentTarget.value)} />}
            </Campo>
            <Campo rotulo="Forma de pagamento">
              {(id) => (
                <select id={id} class="selecao" value={forma} onChange={(e) => setForma(e.currentTarget.value as FormaPagamento)}>
                  {FORMAS.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Identificador da transação" opcional class="inteiro" ajuda="Código do Pix (E2E) ou autenticação. Ajuda a conciliar com o extrato.">
              {(id, d) => <input id={id} class="entrada" autocomplete="off" maxLength={120} aria-describedby={d} value={ident} onInput={(e) => setIdent(e.currentTarget.value)} />}
            </Campo>
          </div>
        )}
        {situacao === 'a_pagar' && (
          <Campo rotulo="Vencimento" ajuda="Vira uma conta em Contas a pagar.">
            {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={vencimento} onChange={(e) => setVencimento(e.currentTarget.value)} />}
          </Campo>
        )}
        {situacao === 'parcelada' && (
          <div class="pilha pilha--p">
            <div class="grade-campos">
              <Campo rotulo="Número de parcelas">
                {(id) => <input id={id} type="number" min={2} max={24} class="entrada num" value={nParcelas} onInput={(e) => setNParcelas(Number(e.currentTarget.value) || 2)} />}
              </Campo>
              <Campo rotulo="1º vencimento">
                {(id) => <input id={id} type="date" class="entrada" value={vencimento} onChange={(e) => setVencimento(e.currentTarget.value)} />}
              </Campo>
            </div>
            <ul class="lista fin-parcelas" aria-label="Parcelas">
              {parcelas.map((p, i) => (
                <li key={i} class="linha linha--entre">
                  <span>{i + 1}ª · {p.vencimento.split('-').reverse().join('/')}</span>
                  <span class="num">{moeda(p.valor)}</span>
                </li>
              ))}
            </ul>
            {erros.parcelas && <span class="campo__erro" role="alert">{erros.parcelas}</span>}
          </div>
        )}

        <button type="button" class="btn btn--fantasma btn--p" style={{ alignSelf: 'flex-start' }} aria-expanded={avancado} onClick={() => setAvancado(!avancado)}>
          {avancado ? <ChevronDown aria-hidden="true" style={{ transform: 'rotate(180deg)' }} /> : <Plus aria-hidden="true" />} Fornecedor e comprovante
        </button>
        {avancado && (
          <div class="pilha">
            <div class="grade-campos">
              <Campo rotulo="Fornecedor" opcional>
                {(id) => <input id={id} class="entrada" maxLength={160} value={fornNome} onInput={(e) => setFornNome(e.currentTarget.value)} />}
              </Campo>
              <Campo rotulo="CNPJ ou CPF" opcional>
                {(id) => <input id={id} class="entrada num" inputMode="numeric" maxLength={20} value={fornDoc} onInput={(e) => setFornDoc(e.currentTarget.value)} />}
              </Campo>
            </div>
            <div class="campo">
              <span class="campo__rotulo">Comprovante ou nota <em>(opcional)</em></span>
              {arquivo ? (
                <div class="linha linha--entre aviso"><span>{arquivo.nome}</span><Botao tamanho="p" variante="fantasma" icone={<Trash2 aria-hidden="true" />} onClick={() => setArquivo(null)}>Remover</Botao></div>
              ) : (
                <EnvioArquivo aceitar="image/*,application/pdf" titulo={enviandoArq ? 'Enviando…' : 'Anexar arquivo'} detalhe="Foto ou PDF, até 15 MB" desativado={enviandoArq} aoEscolher={anexar} />
              )}
            </div>
          </div>
        )}
      </form>
    </Gaveta>
  );
}
