// Nova despesa e EDIÇÃO (mesmo formulário, 0034): o essencial primeiro (descrição, valor, categoria, data e se já foi
// paga); o resto recolhido. Criar: POST /admin/financeiro/despesas com Idempotency-Key. Editar: PATCH /despesas/{id}
// (versão lida; só os campos mudados). Detalhamento opcional em qualquer despesa (Detalhamento.tsx). Despesa com
// pagamento: mudar valor ou responsável é correção financeira (motivo + confirmação; o backend recusa se o pagamento
// está conciliado ou o mês fechado). Recorrente: "somente esta competência" ou "esta e as próximas".
import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, Info, ChevronDown, Plus, Trash2 } from 'lucide-preact';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { hojeISO, paraDecimal, moeda, somarMeses } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao, Campo, Aviso, Segmentado } from '../../ui/base';
import { EntradaMoeda, EnvioArquivo } from '../../ui/entradas';
import type { DespesaEntrada, DespesaSaida, DespesaCorrecao, FormaPagamento } from '../../lib/tipos/financeiro';
import { Detalhamento, paraForm, paraApi, totalItens, deCentavos, erroDetalhamento, type ItemForm, type ModoTotal } from './Detalhamento';
import { FORMAS, useCategorias, OpcoesCategoria, atualizarFinanceiro, avisar, AVISO_ARQUIVO_REPETIDO, useContasPagadoras, rotuloConta, useConfiguracaoFinanceira, RESPONSAVEL, RESPONSAVEIS_NOVOS } from './comum';
import type { ResponsavelNovo } from '../../lib/tipos/financeiro';
import { EscolherFornecedor, type FornecedorEscolhido } from './Fornecedores';

export type Situacao = 'paga' | 'a_pagar' | 'parcelada';

/** Mesmo dia `i` meses depois (31/01 → 28/02 → 31/03). */
function mesmoDia(iso: string, i: number) {
  const d = Number(iso.slice(8, 10));
  const inicio = somarMeses(iso, i);
  const [na, nm] = inicio.split('-').map(Number);
  const ultimo = new Date(Date.UTC(na, nm, 0)).getUTCDate();
  return `${inicio.slice(0, 8)}${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

const brl = (v: string | number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function NovaDespesa({ aberta, aoFechar, aoCriar, situacaoInicial = 'paga', editar = null }: { aberta: boolean; aoFechar: () => void; aoCriar?: (id: string) => void; situacaoInicial?: Situacao; editar?: DespesaSaida | null }) {
  const ed = editar;
  const [detAtivo, setDetAtivo] = useState(false);
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [modo, setModo] = useState<ModoTotal>('automatico');
  const [motivo, setMotivo] = useState('');
  const [confirmo, setConfirmo] = useState(false);
  const [proximas, setProximas] = useState<'esta' | 'proximas'>('esta');
  const cats = useCategorias();
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [data, setData] = useState(''); // 0033: opcional, nunca preenchida com hoje
  const [situacao, setSituacao] = useState<Situacao>('paga');
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [pagoEm, setPagoEm] = useState(hojeISO());
  const [ident, setIdent] = useState('');
  // 0029: conta que pagou; começa na padrão (a empresarial do Âmbar).
  const contasPag = useContasPagadoras();
  const [pagador, setPagador] = useState('');
  // 0031: a quem pertence a despesa; começa no responsável padrão da unidade (Conjunto).
  const config = useConfiguracaoFinanceira();
  const [responsavel, setResponsavel] = useState<ResponsavelNovo>('conjunto');
  const [vencimento, setVencimento] = useState(hojeISO());
  const [nParcelas, setNParcelas] = useState(2);
  const [parcelas, setParcelas] = useState<{ vencimento: string; valor: string }[]>([]);
  const [avancado, setAvancado] = useState(false);
  // Fornecedor do cadastro (vai `{ id }`) ou um nome novo escolhido de propósito (vai nome + documento; o backend resolve).
  const [forn, setForn] = useState<FornecedorEscolhido | null>(null);
  const [fornDoc, setFornDoc] = useState('');
  // `ja_existia` (mesmo SHA-256 já enviado): avisa ANTES de lançar; o backend recusa o arquivo de outro lançamento (B2).
  const [arquivo, setArquivo] = useState<{ id: string; nome: string; jaExistia?: boolean } | null>(null);
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
    setData('');
    setSituacao(situacaoInicial);
    setForma('pix');
    setPagoEm(hojeISO());
    setIdent('');
    setPagador(contasPag.dados?.padrao_id ?? '');
    setResponsavel(config.dados?.responsavel_padrao ?? 'conjunto');
    setVencimento(hojeISO());
    setNParcelas(2);
    setParcelas([]);
    setAvancado(false);
    setForn(null);
    setFornDoc('');
    setArquivo(null);
    setErro(null);
    setErros({});
    setMotivo('');
    setConfirmo(false);
    setProximas('esta');
    setModo('automatico');
    setItens(paraForm(ed?.itens));
    setDetAtivo(!!ed?.itens?.length);
    if (ed) {
      setDescricao(ed.descricao);
      setValor(brl(ed.valor));
      setCategoria(ed.categoria_codigo);
      setData(ed.competencia ?? '');
      setResponsavel((ed.responsavel === 'compartilhada' ? 'conjunto' : ed.responsavel ?? 'conjunto') as ResponsavelNovo);
      const aberta1 = ed.parcelas.filter((p) => p.situacao === 'aberta').sort((a, b) => a.numero - b.numero)[0];
      setVencimento(aberta1?.vencimento ?? '');
    }
    chave.current = novaChave();
  }, [aberta, ed?.id, ed?.versao]);
  // Total automático: o valor acompanha a soma dos itens.
  useEffect(() => {
    if (detAtivo && modo === 'automatico' && itens.length) setValor(brl(deCentavos(totalItens(itens))));
  }, [detAtivo, modo, itens]);
  const pago = ed ? ed.parcelas.reduce((s, p) => s + Number(p.valor_pago), 0) : 0;
  const temAberta = ed ? ed.parcelas.some((p) => p.situacao === 'aberta') : false;
  const sensivel = !!ed && pago > 0 && (Number(paraDecimal(valor) ?? ed.valor) !== Number(ed.valor) || responsavel !== ed.responsavel);
  // A lista de contas pode chegar depois de abrir: aí a padrão entra (só se ninguém escolheu outra ainda).
  useEffect(() => {
    if (aberta && contasPag.dados?.padrao_id) setPagador((atual) => atual || contasPag.dados!.padrao_id!);
  }, [aberta, contasPag.dados?.padrao_id]);

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
      setArquivo({ id: r.id, nome: f.name, jaExistia: r.ja_existia });
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
    const erroDet = erroDetalhamento(detAtivo, itens, modo, valor);
    if (erroDet) es.itens = erroDet;
    if (ed) {
      if (v && Number(v) < pago) es.valor = `O total não pode ser menor que o já pago (${moeda(String(pago))}).`;
      if (sensivel && motivo.trim().length < 5) es.motivo = 'Explique o motivo da correção.';
      if (sensivel && !confirmo) es.confirmo = 'Confirme a correção financeira.';
      setErros(es);
      if (Object.keys(es).length) return;
      return salvarEdicao(ed, v!);
    }
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
      competencia: data || null,
      categoria,
      fornecedor: forn ? ('id' in forn ? { id: forn.id } : { nome: forn.novo, documento: fornDoc.replace(/\D/g, '') || null }) : null,
      arquivo_id: arquivo?.id ?? null,
      // Sem `pagamento` nem `parcelas`, o backend cria uma conta a pagar que vence na competência.
      responsavel,
      itens: detAtivo && itens.length ? paraApi(itens).itens : null,
      pagamento: situacao === 'paga' ? { pago_em: pagoEm, forma, identificador_transacao: ident.trim() || null, arquivo_id: arquivo?.id ?? null, conta_pagadora_id: pagador || null } : null,
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

  async function salvarEdicao(d: DespesaSaida, v: string) {
    const c: DespesaCorrecao = { versao: d.versao };
    if (descricao.trim() !== d.descricao) c.descricao = descricao.trim();
    if (Number(v) !== Number(d.valor)) c.valor = v;
    if (data && data !== d.competencia) c.competencia = data;
    if (categoria !== d.categoria_codigo) c.categoria = categoria;
    if (responsavel !== d.responsavel) c.responsavel = responsavel;
    const venc = d.parcelas.filter((p) => p.situacao === 'aberta').sort((a, b) => a.numero - b.numero)[0]?.vencimento;
    if (temAberta && vencimento && vencimento !== venc) c.vencimento = vencimento;
    const novos = detAtivo ? paraApi(itens).itens : [];
    const antes = JSON.stringify(paraApi(paraForm(d.itens)).itens);
    if (JSON.stringify(novos) !== antes) c.itens = novos;
    if (sensivel) { c.confirmar = true; c.motivo = motivo.trim(); }
    if (d.recorrencia_id && proximas === 'proximas') c.aplicar_proximas = true;
    if (Object.keys(c).length === 1) return aoFechar();
    setEnviando(true);
    setErro(null);
    try {
      await financeiro.corrigirDespesa(d.id, c);
      atualizarFinanceiro();
      avisar('Despesa atualizada.', 'ok');
      aoFechar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível salvar.');
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
      titulo={ed ? 'Editar despesa' : 'Nova despesa'}
      subtitulo={ed ? (pago > 0 ? (temAberta ? 'Parcialmente paga' : 'Paga') : 'Em aberto') : 'Lançada pelo painel'}
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-nova-despesa" carregando={enviando} disabled={enviandoArq} icone={<Check aria-hidden="true" />}>{ed ? 'Salvar' : 'Lançar despesa'}</Botao>
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
            {(id, d) => (detAtivo && modo === 'automatico' && itens.length
              ? <input id={id} class="entrada num" aria-describedby={d} readOnly value={valor} title="Soma dos itens do detalhamento" />
              : <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} invalido={!!erros.valor} />)}
          </Campo>
          <Campo rotulo="Data (opcional)" erro={erros.competencia} ajuda="Dia da despesa (competência). Pode ser informada depois.">
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

        <Detalhamento ativo={detAtivo} aoAtivar={(a) => { setDetAtivo(a); if (a && !itens.length) setItens([{ descricao: '', base: '', observacao: '', acrescimos: [], descontos: [] }]); }} itens={itens} aoMudar={setItens} modo={modo} aoMudarModo={setModo} valorInformado={valor} />
        {erros.itens && <span class="campo__erro" role="alert">{erros.itens}</span>}

        <div class="campo">
          <span class="campo__rotulo" id="rotulo-situacao">{ed ? 'Responsável' : 'Situação'}</span>
          <Campo rotulo="Responsável" ajuda="A quem pertence a despesa (não é quem pagou).">
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={responsavel} onChange={(e) => setResponsavel(e.currentTarget.value as ResponsavelNovo)}>
                {RESPONSAVEIS_NOVOS.map((k) => <option key={k} value={k}>{RESPONSAVEL[k]}{k === (config.dados?.responsavel_padrao ?? 'conjunto') ? ' (padrão)' : ''}</option>)}
              </select>
            )}
          </Campo>
          {!ed && <Segmentado<Situacao> rotulo="Situação do pagamento" valor={situacao} aoMudar={setSituacao} opcoes={[{ valor: 'paga', rotulo: 'Já foi paga' }, { valor: 'a_pagar', rotulo: 'A pagar' }, { valor: 'parcelada', rotulo: 'Parcelada' }]} />}
        </div>
        {ed && temAberta && (
          <Campo rotulo="Vencimento" ajuda={pago > 0 ? 'Da próxima parcela em aberto. Os pagamentos feitos não mudam.' : 'Da próxima parcela em aberto.'}>
            {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={vencimento} onChange={(e) => setVencimento(e.currentTarget.value)} />}
          </Campo>
        )}
        {ed?.recorrencia_id && (
          <Segmentado<'esta' | 'proximas'> rotulo="Aplicar a mudança" valor={proximas} aoMudar={setProximas} opcoes={[{ valor: 'esta', rotulo: 'Somente esta competência' }, { valor: 'proximas', rotulo: 'Esta e as próximas' }]} />
        )}
        {sensivel && (
          <div class="pilha pilha--p">
            <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>Despesa com pagamento: mudar valor ou responsável é uma correção financeira e fica no histórico. Os pagamentos e comprovantes não mudam.</Aviso>
            <Campo rotulo="Motivo da correção" erro={erros.motivo}>
              {(id, d) => <input id={id} class="entrada" maxLength={300} aria-describedby={d} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} />}
            </Campo>
            <label class="linha" style={{ gap: '8px' }}><input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.currentTarget.checked)} /> Confirmo a correção financeira</label>
            {erros.confirmo && <span class="campo__erro" role="alert">{erros.confirmo}</span>}
          </div>
        )}
        {!ed && situacao === 'paga' && (
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
            <Campo rotulo="Pago com a conta" class="inteiro" ajuda={pagador ? undefined : 'Sem a conta, a despesa fica em Pendências como “pagador não identificado”.'}>
              {(id, d) => (
                <select id={id} class="selecao" aria-describedby={d} value={pagador} onChange={(e) => setPagador(e.currentTarget.value)}>
                  <option value="">Não informar agora</option>
                  {(contasPag.dados?.itens ?? []).map((c) => <option key={c.id} value={c.id}>{rotuloConta(c)}{c.padrao ? ' — padrão' : ''}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Identificador da transação" opcional class="inteiro" ajuda="Código do Pix (E2E) ou autenticação. Ajuda a conciliar com o extrato.">
              {(id, d) => <input id={id} class="entrada" autocomplete="off" maxLength={120} aria-describedby={d} value={ident} onInput={(e) => setIdent(e.currentTarget.value)} />}
            </Campo>
          </div>
        )}
        {!ed && situacao === 'a_pagar' && (
          <Campo rotulo="Vencimento" ajuda="Vira uma conta em Contas a pagar.">
            {(id, d) => <input id={id} type="date" class="entrada" aria-describedby={d} value={vencimento} onChange={(e) => setVencimento(e.currentTarget.value)} />}
          </Campo>
        )}
        {!ed && situacao === 'parcelada' && (
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

        {!ed && <button type="button" class="btn btn--fantasma btn--p" style={{ alignSelf: 'flex-start' }} aria-expanded={avancado} onClick={() => setAvancado(!avancado)}>
          {avancado ? <ChevronDown aria-hidden="true" style={{ transform: 'rotate(180deg)' }} /> : <Plus aria-hidden="true" />} Fornecedor e comprovante
        </button>}
        {!ed && avancado && (
          <div class="pilha">
            <div class="grade-campos">
              <Campo rotulo="Fornecedor" opcional ajuda="Busque no cadastro; só cadastre um novo se ele não aparecer.">
                {(id, d) => <EscolherFornecedor id={id} descr={d} valor={forn} aoEscolher={setForn} />}
              </Campo>
              {forn && 'novo' in forn && (
                <Campo rotulo="CNPJ ou CPF do novo fornecedor" opcional ajuda="Com o documento, o sistema reconhece o mesmo fornecedor escrito de outro jeito.">
                  {(id, d) => <input id={id} class="entrada num" inputMode="numeric" maxLength={20} aria-describedby={d} value={fornDoc} onInput={(e) => setFornDoc(e.currentTarget.value)} />}
                </Campo>
              )}
            </div>
            <div class="campo">
              <span class="campo__rotulo">Comprovante ou nota <em>(opcional)</em></span>
              {arquivo ? (
                <>
                  <div class="linha linha--entre aviso"><span>{arquivo.nome}</span><Botao tamanho="p" variante="fantasma" icone={<Trash2 aria-hidden="true" />} onClick={() => setArquivo(null)}>Remover</Botao></div>
                  {arquivo.jaExistia && <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>{AVISO_ARQUIVO_REPETIDO}</Aviso>}
                </>
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

/** Botão Editar das listas: carrega a despesa (versão atual) e abre o mesmo formulário do cadastro. */
export function EditarDespesa({ id, aoFechar }: { id: string | null; aoFechar: () => void }) {
  const [d, setD] = useState<DespesaSaida | null>(null);
  useEffect(() => {
    if (!id) return setD(null);
    let vivo = true;
    financeiro.despesa(id).then((x) => vivo && setD(x)).catch((e) => { avisar(e instanceof ErroApi ? e.message : 'Não foi possível abrir a despesa.', 'erro'); aoFechar(); });
    return () => { vivo = false; };
  }, [id]);
  return <NovaDespesa aberta={!!id && !!d} editar={d} aoFechar={() => { setD(null); aoFechar(); }} />;
}
