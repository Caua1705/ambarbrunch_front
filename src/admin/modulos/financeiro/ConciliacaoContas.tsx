// Conciliação de contas a pagar (0038): o sistema SUGERE, uma pessoa confirma. Um pagamento já registrado (pela Júlia ou
// no painel, como despesa avulsa já paga) que é o pagamento de uma conta aberta: "Conciliar" passa o pagamento para a
// conta (o original é estornado e a despesa avulsa cancelada — era a mesma saída), sem criar despesa nenhuma. Diferença de
// valor: a pessoa escolhe o motivo (juros/multa, desconto, parcial, valor errado); nada é presumido. Tudo inline, sem
// modal. Rotas: GET /conciliacao-contas/sugestoes, GET /parcelas/{id}/pagamentos-candidatos, POST /parcelas/{id}/conciliar,
// POST /parcelas/{id}/recusar-pagamento, POST /conciliacao-contas/{id}/desfazer.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, Info, Link2, Search, Undo2, X } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, num, paraDecimal, hojeISO } from '../../lib/formato';
import { Botao, Campo, Aviso, Cartao, Etiqueta } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import type { ContaConciliar, MotivoDiferenca, PagamentoRegistrado, SugestaoConciliacao } from '../../lib/tipos/financeiro';
import { FORMAS, ORIGEM, atualizarFinanceiro, avisar, avisarFalha, useContasPagadoras, rotuloConta } from './comum';

const brl = (v: string | null | undefined) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const forma = (f: string) => FORMAS.find((x) => x.valor === f)?.rotulo ?? f;
const MOTIVOS_A_MAIS: { valor: MotivoDiferenca; rotulo: string }[] = [
  { valor: 'juros_multa', rotulo: 'Juros ou multa' },
  { valor: 'ajuste_valor', rotulo: 'O valor da conta estava errado' },
];
const MOTIVOS_A_MENOS: { valor: MotivoDiferenca; rotulo: string }[] = [
  { valor: 'parcial', rotulo: 'Pagamento parcial (o resto continua em aberto)' },
  { valor: 'desconto', rotulo: 'Desconto (a conta fica quitada)' },
  { valor: 'ajuste_valor', rotulo: 'O valor da conta estava errado' },
];

/** Conta de valor variável ainda sem o valor do mês: o pago fixa o valor (sem motivo de diferença). */
const variavel = (c: ContaConciliar) => c.valor_a_confirmar && c.parcelas_total === 1 && Number(c.valor_pago) === 0;

/** Bloco "Pagamentos encontrados" no topo de Contas a pagar. Sem sugestão: não aparece. */
export function SugestoesConciliacao() {
  const q = useConsulta('financeiro/conciliacao-contas/sugestoes', () => financeiro.sugestoesConciliacao());
  const itens = q.dados ?? [];
  if (!itens.length) return null;
  return (
    <Cartao titulo={`Pagamentos encontrados (${itens.length})`} descricao="Pagamentos já registrados que parecem ser destas contas. Nada é baixado sem a sua confirmação.">
      <div class="concilia-lista">
        {itens.map((s) => <Sugestao key={s.conta.parcela_id} s={s} />)}
      </div>
    </Cartao>
  );
}

function CabecalhoConta({ c }: { c: ContaConciliar }) {
  return (
    <div class="concilia-conta">
      <strong>{c.descricao} — {moeda(variavel(c) ? c.valor : c.saldo)}</strong>
      <span class="fraco">
        vence {dataCurta(c.vencimento)}
        {c.parcelas_total > 1 ? ` · parcela ${c.numero}/${c.parcelas_total}` : ''}
        {Number(c.valor_pago) > 0 ? ` · já pago ${moeda(c.valor_pago)}` : ''}
        {variavel(c) ? ' · valor previsto' : ''}
        {c.fornecedor ? ` · ${c.fornecedor}` : ''}
      </span>
    </div>
  );
}

function ResumoPagamento({ p }: { p: PagamentoRegistrado }) {
  return (
    <span class="concilia-pagamento">
      <span>Pagamento encontrado: <strong class="num">{moeda(p.valor)}</strong> em {dataCurta(p.pago_em)}</span>
      <span class="fraco">
        {p.descricao} · {forma(p.forma)} · {ORIGEM[p.origem] ?? p.origem}
        {p.conta_pagadora ? ` · pago por ${p.conta_pagadora}` : ' · pagador não identificado'}
      </span>
      <span class="concilia-evidencias">
        {p.evidencias.map((e) => <Etiqueta key={e} tom={e === 'Mesmo valor' || e === 'Mesmo fornecedor' ? 'ok' : 'neutro'}>{e}</Etiqueta>)}
        {p.so_valor && <Etiqueta tom="atencao">Só valor e data conferem</Etiqueta>}
        {p.em_revisao && <Etiqueta tom="atencao">Em revisão</Etiqueta>}
        {p.recusado && <Etiqueta tom="apagado">Marcado como não corresponde</Etiqueta>}
      </span>
    </span>
  );
}

function Sugestao({ s }: { s: SugestaoConciliacao }) {
  const [escolhido, setEscolhido] = useState(s.candidatos[0].pagamento_id);
  const [aberto, setAberto] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const p = s.candidatos.find((c) => c.pagamento_id === escolhido) ?? s.candidatos[0];

  async function recusar() {
    setRecusando(true);
    try {
      await financeiro.recusarPagamento(s.conta.parcela_id, p.pagamento_id);
      atualizarFinanceiro();
      avisar('Sugestão descartada. O pagamento continua em "Buscar pagamento".', 'ok');
    } catch (e) {
      avisarFalha(e);
    } finally {
      setRecusando(false);
    }
  }

  return (
    <div class="concilia-item">
      <CabecalhoConta c={s.conta} />
      {s.ambigua && (
        <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
          {s.candidatos.length > 1 ? 'Mais de um pagamento pode ser desta conta: escolha o certo.' : 'Este pagamento também pode ser de outra conta: confira antes de conciliar.'}
        </Aviso>
      )}
      {s.candidatos.length > 1 ? (
        <div class="concilia-opcoes" role="radiogroup" aria-label={`Pagamentos possíveis para ${s.conta.descricao}`}>
          {s.candidatos.map((c) => (
            <label key={c.pagamento_id} class="concilia-opcao">
              <input type="radio" name={`pg-${s.conta.parcela_id}`} checked={c.pagamento_id === escolhido} disabled={aberto} onChange={() => setEscolhido(c.pagamento_id)} />
              <ResumoPagamento p={c} />
            </label>
          ))}
        </div>
      ) : <ResumoPagamento p={p} />}
      {aberto ? (
        <FormConciliar conta={s.conta} pagamento={p} aoFechar={() => setAberto(false)} />
      ) : (
        <div class="linha concilia-acoes">
          <Botao tamanho="p" variante="primario" icone={<Link2 aria-hidden="true" />} onClick={() => setAberto(true)}>Conciliar</Botao>
          <Botao tamanho="p" variante="fantasma" icone={<X aria-hidden="true" />} carregando={recusando} onClick={recusar}>Não corresponde</Botao>
        </div>
      )}
    </div>
  );
}

/** Confirmação inline: valor, data e pagador já preenchidos com o que foi registrado; diferença exige o motivo. */
function FormConciliar({ conta, pagamento, aoFechar }: { conta: ContaConciliar; pagamento: PagamentoRegistrado; aoFechar: () => void }) {
  const [valor, setValor] = useState(brl(pagamento.valor));
  const [data, setData] = useState(pagamento.pago_em);
  const [pagador, setPagador] = useState<string>(pagamento.conta_pagadora_id ?? '');
  const [motivo, setMotivo] = useState<MotivoDiferenca | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const contas = useContasPagadoras();

  const v = num(paraDecimal(valor));
  const saldo = num(conta.saldo) ?? 0;
  const dif = v === null || variavel(conta) ? 0 : Math.round((v - saldo) * 100) / 100;
  const opcoes = dif > 0 ? MOTIVOS_A_MAIS : dif < 0 ? MOTIVOS_A_MENOS : [];
  useEffect(() => { if (!opcoes.some((o) => o.valor === motivo)) setMotivo(null); }, [dif > 0, dif < 0]);
  const fica = dif < 0 && motivo === 'parcial' ? `Parcialmente paga — faltam ${moeda((saldo - (v ?? 0)).toFixed(2))}` : 'Paga';

  async function confirmar(e: Event) {
    e.preventDefault();
    if (v === null || v <= 0) return setErro(new ErroApi('validacao', 'Informe o valor pago.', 0, null, { valor: 'Informe o valor pago.' }));
    if (opcoes.length && !motivo) return setErro(new ErroApi('validacao', 'Escolha o motivo da diferença.', 0, null, { motivo: 'Escolha o motivo.' }));
    setEnviando(true);
    setErro(null);
    try {
      const r = await financeiro.conciliarConta(conta.parcela_id, {
        pagamento_id: pagamento.pagamento_id, valor: v.toFixed(2), pago_em: data,
        conta_pagadora_id: pagador || null, motivo_diferenca: opcoes.length ? motivo : null,
      });
      atualizarFinanceiro();
      avisar(r.conta?.situacao === 'parcial' ? 'Conciliado: a conta ficou parcialmente paga.' : 'Conciliado: a conta está paga.', 'ok');
      aoFechar();
    } catch (err) {
      const x = err instanceof ErroApi ? err : new ErroApi('servidor', 'Não foi possível conciliar.');
      setErro(x);
      if (x.tipo === 'conflito') atualizarFinanceiro();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form class="concilia-form pilha" onSubmit={confirmar} noValidate>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
      <div class="grade-campos">
        <Campo rotulo="Valor pago" erro={erro?.campos.valor}>
          {(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} invalido={!!erro?.campos.valor} />}
        </Campo>
        <Campo rotulo="Data do pagamento">
          {(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={data} onChange={(e) => setData(e.currentTarget.value)} />}
        </Campo>
        <Campo rotulo="Pago com a conta">
          {(id) => (
            <select id={id} class="selecao" value={pagador} onChange={(e) => setPagador(e.currentTarget.value)}>
              <option value="">Não identificado</option>
              {(contas.dados?.itens ?? []).map((c) => <option key={c.id} value={c.id}>{rotuloConta(c)}</option>)}
            </select>
          )}
        </Campo>
      </div>
      {opcoes.length > 0 && (
        <fieldset class="concilia-motivo">
          <legend>
            {dif > 0 ? `Pago ${moeda(dif.toFixed(2))} a mais que a conta (${moeda(conta.saldo)}). Por quê?` : `Pago ${moeda((-dif).toFixed(2))} a menos que a conta (${moeda(conta.saldo)}). Por quê?`}
          </legend>
          {opcoes.map((o) => (
            <label key={o.valor} class="concilia-opcao">
              <input type="radio" name={`motivo-${conta.parcela_id}`} checked={motivo === o.valor} onChange={() => setMotivo(o.valor)} />
              <span>{o.rotulo}</span>
            </label>
          ))}
          {erro?.campos.motivo && <p class="campo__erro">{erro.campos.motivo}</p>}
        </fieldset>
      )}
      <p class="fraco">A conta fica: <strong>{opcoes.length && !motivo ? '—' : fica}</strong>. O pagamento sai da despesa avulsa “{pagamento.descricao}”, que é cancelada (era a mesma saída). Pode ser desfeito.</p>
      <div class="linha concilia-acoes">
        <Botao tamanho="p" variante="primario" type="submit" carregando={enviando} icone={<Check aria-hidden="true" />}>Confirmar conciliação</Botao>
        <Botao tamanho="p" variante="fantasma" onClick={aoFechar} disabled={enviando}>Voltar</Botao>
      </div>
    </form>
  );
}

/** "Buscar pagamento" (conciliação manual): pagamentos registrados perto do vencimento ou pela busca. */
export function BuscarPagamento({ parcelaId, aoFechar }: { parcelaId: string; aoFechar: () => void }) {
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const q = useConsulta(`financeiro/conciliacao-contas/busca:${parcelaId}:${termo}`, () => financeiro.buscarPagamentos(parcelaId, termo || undefined));
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [parcelaId]);
  useEffect(() => { setTexto(''); setTermo(''); setAberto(null); }, [parcelaId]);
  const r = q.dados;

  return (
    <div ref={ref}>
      <Cartao titulo="Buscar pagamento" descricao="Pagamentos já registrados (Júlia ou painel) que podem ser desta conta." acoes={<Botao tamanho="p" variante="fantasma" so_icone aria-label="Fechar busca" icone={<X aria-hidden="true" />} onClick={aoFechar} />}>
        <div class="concilia-lista">
          {r && <CabecalhoConta c={r.conta} />}
          <form class="linha" onSubmit={(e) => { e.preventDefault(); setTermo(texto.trim()); }}>
            <div class="entrada-grupo" style={{ flex: '1 1 220px' }}>
              <Search aria-hidden="true" />
              <input class="entrada" type="search" placeholder="Descrição, fornecedor ou valor (ex.: 120,00)" aria-label="Buscar pagamento registrado" maxLength={80} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
            </div>
            <Botao tamanho="p" type="submit">Buscar</Botao>
          </form>
          {q.erro && !r && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{q.erro.message}</Aviso>}
          {r && r.itens.length === 0 && (
            <p class="fraco">{termo ? 'Nenhum pagamento registrado com essa busca.' : 'Nenhum pagamento registrado perto do vencimento.'} Se a conta foi paga e o pagamento ainda não está no sistema, use “Pagar”.</p>
          )}
          {r?.itens.map((p) => (
            <div key={p.pagamento_id} class="concilia-item">
              <ResumoPagamento p={p} />
              {aberto === p.pagamento_id ? (
                <FormConciliar conta={r.conta} pagamento={p} aoFechar={() => setAberto(null)} />
              ) : (
                <div class="linha concilia-acoes">
                  <Botao tamanho="p" variante={p.compativel ? 'primario' : 'secundario'} icone={<Link2 aria-hidden="true" />} onClick={() => setAberto(p.pagamento_id)}>Conciliar</Botao>
                </div>
              )}
            </div>
          ))}
        </div>
      </Cartao>
    </div>
  );
}

/** Desfazer uma conciliação errada (com motivo): a conta volta a ficar em aberto e a despesa avulsa volta como era. */
export function DesfazerConciliacao({ conciliacaoId, descricao, aoFechar }: { conciliacaoId: string; descricao: string; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function desfazer(e: Event) {
    e.preventDefault();
    if (motivo.trim().length < 5) return setErro('Explique o motivo (5 a 300 caracteres).');
    setEnviando(true);
    setErro(null);
    try {
      await financeiro.desfazerConciliacao(conciliacaoId, motivo.trim());
      atualizarFinanceiro();
      avisar('Conciliação desfeita: a conta voltou a ficar em aberto.', 'ok');
      aoFechar();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível desfazer.');
      if (err instanceof ErroApi && err.tipo === 'conflito') atualizarFinanceiro();
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Cartao titulo="Desfazer conciliação" descricao={`${descricao}: o pagamento volta para a despesa avulsa e a conta volta a ficar em aberto.`}>
      <form class="concilia-lista" onSubmit={desfazer} noValidate>
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
        <Campo rotulo="Motivo">
          {(id) => <input id={id} class="entrada" maxLength={300} value={motivo} placeholder="Ex.: era o pagamento de outra conta" onInput={(e) => setMotivo(e.currentTarget.value)} autofocus />}
        </Campo>
        <div class="linha concilia-acoes">
          <Botao tamanho="p" variante="perigo" type="submit" carregando={enviando} icone={<Undo2 aria-hidden="true" />}>Desfazer</Botao>
          <Botao tamanho="p" variante="fantasma" onClick={aoFechar} disabled={enviando}>Voltar</Botao>
        </div>
      </form>
    </Cartao>
  );
}
