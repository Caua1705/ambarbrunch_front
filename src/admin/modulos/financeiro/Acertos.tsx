// Acertos Âmbar × Roll e reembolsos de sócio (0029) — área secundária e compacta (Pendências → Acertos), só para quem
// tem financeiro.ver_societario. O saldo vem pronto do backend (GET /admin/financeiro/acertos): para cada pagamento, quem
// pagou (lado da conta) × quem deveria pagar (responsável da despesa: Âmbar, Roll ou 50/50) − compensações já feitas.
// NUNCA a diferença entre os totais gastos. Pagamento sem pagador não entra (aviso de saldo incompleto).
// Conta pessoal de sócio do Âmbar: "a definir" até alguém decidir reembolsar (quanto), aporte ou sem reembolso.
import { useEffect, useState } from 'preact/hooks';
import { AlertTriangle, Plus } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, hojeISO, paraDecimal } from '../../lib/formato';
import { Dialogo } from '../../ui/camadas';
import { Botao, Cartao, Campo, Aviso } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Acertos as DadosAcertos, ItemAcerto, MovimentoAcerto, Responsavel, Tratamento } from '../../lib/tipos/financeiro';
import { RESPONSAVEL, TRATAMENTO, PARTE, rotuloConta, useContasPagadoras, atualizarFinanceiro, avisar, avisarFalha } from './comum';

type Sentido = MovimentoAcerto['sentido'];
const SENTIDO: Record<Sentido, string> = {
  roll_para_ambar: 'Roll pagou ao Âmbar', ambar_para_roll: 'Âmbar pagou à Roll', ambar_para_socio: 'Empresa reembolsou sócio',
};

export function Acertos() {
  const dados = useConsulta('financeiro/acertos', () => financeiro.acertos());
  const [novo, setNovo] = useState<Sentido | null>(null);
  return (
    <>
      <Dados consulta={dados} recurso="Os acertos" esqueleto={<Cartao><Esqueleto linhas={4} /></Cartao>}>
        {(a) => <Conteudo a={a} novo={setNovo} />}
      </Dados>
      <NovoMovimento sentido={novo} aoFechar={() => setNovo(null)} />
    </>
  );
}

function Conteudo({ a, novo }: { a: DadosAcertos; novo: (s: Sentido) => void }) {
  const r = a.roll;
  const frase = r.situacao === 'zerado' ? 'Âmbar e Roll estão quites.' : r.situacao === 'roll_deve' ? `A Roll deve ${moeda(r.valor)} ao Âmbar.` : `O Âmbar deve ${moeda(r.valor)} à Roll.`;
  const colunas: Coluna<ItemAcerto>[] = [
    { id: 'data', titulo: 'Data', prioridade: 'media', largura: '86px', ordenar: (i) => i.pago_em, celula: (i) => <span class="num">{dataCurta(i.pago_em)}</span> },
    { id: 'descricao', titulo: 'Despesa', celula: (i) => <><span class="principal-celula">{i.descricao}</span><span class="sub">{rotuloConta(i.pagador)}</span></> },
    { id: 'valor', titulo: 'Valor', numero: true, celula: (i) => <span class="num">{moeda(i.valor)}</span> },
    { id: 'responsavel', titulo: 'Responsável', celula: (i) => <SeletorResponsavel item={i} /> },
    { id: 'tratamento', titulo: 'Conta pessoal', prioridade: 'media', celula: (i) => (i.tratamento ? <SeletorTratamento item={i} /> : <span class="fraco">—</span>) },
  ];
  return (
    <>
      {!a.completo && (
        <Aviso tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>
          Saldo incompleto: {a.sem_pagador.quantidade} {a.sem_pagador.quantidade === 1 ? 'pagamento' : 'pagamentos'} ({moeda(a.sem_pagador.valor)}) sem pagador identificado ficam fora da conta.
        </Aviso>
      )}
      <Cartao titulo="Âmbar × Roll" acoes={<Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => novo(r.situacao === 'ambar_deve' ? 'ambar_para_roll' : 'roll_para_ambar')}>Registrar compensação</Botao>}>
        <p class="fin-saldo"><strong>{frase}</strong></p>
        <div class="fin-valores">
          <div><span>Âmbar pagou pela Roll</span><strong class="num">{moeda(r.ambar_adiantou_pela_roll)}</strong></div>
          <div><span>Roll pagou pelo Âmbar</span><strong class="num">{moeda(r.roll_adiantou_pelo_ambar)}</strong></div>
          <div><span>Já compensado</span><strong class="num">{moeda(String(Number(r.compensado_roll_para_ambar) + Number(r.compensado_ambar_para_roll)))}</strong></div>
        </div>
      </Cartao>
      {a.empresa && (
        <Cartao titulo="Pago pela empresa (Âmbar × Roll)" descricao="Dinheiro da empresa conjunta: não gera dívida entre os sócios.">
          <div class="fin-valores">
            <div><span>Total pago</span><strong class="num">{moeda(a.empresa.pago)}</strong></div>
            <div><span>Despesas do Âmbar</span><strong class="num">{moeda(a.empresa.por_responsavel.ambar)}</strong></div>
            <div><span>Despesas da Roll</span><strong class="num">{moeda(a.empresa.por_responsavel.roll)}</strong></div>
            <div><span>Compartilhadas</span><strong class="num">{moeda(a.empresa.por_responsavel.compartilhada)}</strong></div>
            {Number(a.empresa.assumido_de_socios) > 0 && <div><span>Assumido de sócios</span><strong class="num">{moeda(a.empresa.assumido_de_socios)}</strong><small>reembolso ou aporte</small></div>}
          </div>
        </Cartao>
      )}
      {!!a.decisoes_pendentes && (
        <p class="fraco">{a.decisoes_pendentes} {a.decisoes_pendentes === 1 ? 'pagamento pessoal ainda' : 'pagamentos pessoais ainda'} sem decisão (reembolsar, aporte ou sem reembolso): por enquanto contam como adiantamento do lado.</p>
      )}
      {a.socios.length > 0 && (
        <Cartao titulo="Contas pessoais dos sócios" acoes={<Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => novo('ambar_para_socio')}>Registrar reembolso</Botao>} justo>
          <div class="tabela-rolagem">
            <table class="tabela" aria-label="Reembolsos por sócio">
              <thead><tr><th>Conta</th><th data-prioridade="media">Lado</th><th class="num">Pago</th><th class="num">A definir</th><th class="num" data-prioridade="media">Aporte</th><th class="num">A reembolsar</th></tr></thead>
              <tbody>
                {a.socios.map((s) => (
                  <tr key={s.conta?.id ?? 'x'}>
                    <td>{s.conta?.apelido ?? '—'}</td>
                    <td data-prioridade="media">{s.conta ? PARTE[s.conta.parte] : '—'}</td>
                    <td class="num">{moeda(s.pago)}</td>
                    <td class="num">{Number(s.a_definir) ? <span class="fin-falta">{moeda(s.a_definir)}</span> : '—'}</td>
                    <td class="num" data-prioridade="media">{Number(s.aporte) ? moeda(s.aporte) : '—'}</td>
                    <td class="num forte">{moeda(s.a_reembolsar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}
      <Cartao titulo="Pagamentos que mexem nos acertos" justo>
        <Tabela rotulo="Pagamentos dos acertos" colunas={colunas} linhas={a.itens} chave={(i) => i.pagamento_id} ordemInicial={{ coluna: 'data', desc: true }}
          vazio={<Vazio compacto titulo="Nada a acertar">Pagamentos da conta do Âmbar para despesas do Âmbar não entram aqui.</Vazio>} />
      </Cartao>
      {a.movimentos.length > 0 && (
        <details class="fin-detalhes">
          <summary>Compensações e reembolsos registrados ({a.movimentos.length})</summary>
          <ul class="fin-lista-simples">
            {a.movimentos.map((m) => <li key={m.id}><span class="num">{dataCurta(m.data)}</span> · {SENTIDO[m.sentido]}{m.conta ? ` (${m.conta.apelido})` : ''} · <strong class="num">{moeda(m.valor)}</strong> · {m.descricao}</li>)}
          </ul>
        </details>
      )}
      <p class="fraco">Aportes de capital registrados: {moeda(a.aportes.registrados)} (fora do faturamento).</p>
    </>
  );
}

function SeletorResponsavel({ item }: { item: ItemAcerto }) {
  const [salvando, setSalvando] = useState(false);
  async function mudar(v: Responsavel) {
    setSalvando(true);
    try {
      const d = await financeiro.despesa(item.despesa_id);
      await financeiro.definirResponsavel(item.despesa_id, d.versao, v);
      atualizarFinanceiro();
    } catch (e) {
      avisarFalha(e);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <select class="selecao selecao--auto" aria-label={`Responsável por ${item.descricao}`} value={item.responsavel} disabled={salvando} onChange={(e) => mudar(e.currentTarget.value as Responsavel)}>
      {Object.entries(RESPONSAVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

function SeletorTratamento({ item }: { item: ItemAcerto }) {
  const [salvando, setSalvando] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const [valor, setValor] = useState('');
  async function gravar(v: Exclude<Tratamento, 'nao_se_aplica'>, reembolso: string | null) {
    if (item.versao === null) return;
    setSalvando(true);
    try {
      await financeiro.definirTratamento(item.pagamento_id, { versao: item.versao, tratamento: v, valor_reembolso: reembolso });
      atualizarFinanceiro();
      setPedindo(false);
    } catch (e) {
      avisarFalha(e);
    } finally {
      setSalvando(false);
    }
  }
  function mudar(v: Exclude<Tratamento, 'nao_se_aplica'>) {
    if (v !== 'reembolsar') return void gravar(v, null);
    // Sugestão: a parte do Âmbar no pagamento (metade quando a despesa é compartilhada). Quem decide é a pessoa.
    const sugestao = item.responsavel === 'compartilhada' ? Number(item.valor) / 2 : Number(item.valor);
    setValor(sugestao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setPedindo(true);
  }
  const confirmar = () => {
    const v = paraDecimal(valor);
    if (!v || Number(v) <= 0) return avisar('Informe o valor a reembolsar.', 'erro');
    void gravar('reembolsar', v);
  };
  return (
    <>
      <select class="selecao selecao--auto" aria-label={`Tratamento de ${item.descricao}`} value={item.tratamento ?? 'a_definir'} disabled={salvando} onChange={(e) => mudar(e.currentTarget.value as Exclude<Tratamento, 'nao_se_aplica'>)}>
        {(['a_definir', 'reembolsar', 'aporte', 'sem_reembolso'] as const).map((k) => <option key={k} value={k}>{TRATAMENTO[k]}{k === 'reembolsar' && item.valor_reembolso ? ` ${moeda(item.valor_reembolso)}` : ''}</option>)}
      </select>
      <Dialogo aberto={pedindo} aoFechar={() => setPedindo(false)} titulo="Quanto reembolsar?" acoes={<><Botao onClick={() => setPedindo(false)} disabled={salvando}>Cancelar</Botao><Botao variante="primario" carregando={salvando} onClick={confirmar}>Salvar</Botao></>}>
        <p class="fraco">{item.descricao} · pago {moeda(item.valor)} com {item.pagador?.apelido ?? 'conta pessoal'}.</p>
        <Campo rotulo="Valor a reembolsar">{(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} autofoco />}</Campo>
      </Dialogo>
    </>
  );
}

function NovoMovimento({ sentido, aoFechar }: { sentido: Sentido | null; aoFechar: () => void }) {
  const contas = useContasPagadoras();
  const [s, setS] = useState<Sentido>('roll_para_ambar');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState('');
  const [conta, setConta] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (sentido) { setS(sentido); setValor(''); setDescricao(''); setConta(''); setErro(null); setData(hojeISO()); }
  }, [sentido]);
  if (!sentido) return null;
  const socios = (contas.dados?.itens ?? []).filter((c) => c.natureza === 'pessoal' && c.parte !== 'conjunta');

  async function salvar() {
    const v = paraDecimal(valor);
    if (!v || Number(v) <= 0) return setErro('Informe o valor.');
    if (descricao.trim().length < 2) return setErro('Descreva o acerto.');
    if (s === 'ambar_para_socio' && !conta) return setErro('Escolha a conta do sócio.');
    setSalvando(true);
    setErro(null);
    try {
      await financeiro.registrarAcerto({ sentido: s, valor: v, data, descricao: descricao.trim(), conta_id: s === 'ambar_para_socio' ? conta : null });
      atualizarFinanceiro();
      avisar('Acerto registrado.', 'ok');
      aoFechar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível registrar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto aoFechar={aoFechar} titulo="Registrar acerto" acoes={<><Botao onClick={aoFechar} disabled={salvando}>Cancelar</Botao><Botao variante="primario" carregando={salvando} onClick={salvar}>Registrar</Botao></>}>
      <div class="pilha">
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} class="selecao" value={s} onChange={(e) => setS(e.currentTarget.value as Sentido)}>
              {Object.entries(SENTIDO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
        </Campo>
        {s === 'ambar_para_socio' && (
          <Campo rotulo="Conta do sócio">
            {(id) => (
              <select id={id} class="selecao" value={conta} onChange={(e) => setConta(e.currentTarget.value)}>
                <option value="">Escolha</option>
                {socios.map((c) => <option key={c.id} value={c.id}>{c.apelido} · {PARTE[c.parte]}</option>)}
              </select>
            )}
          </Campo>
        )}
        <div class="grade-campos">
          <Campo rotulo="Valor">{(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} />}</Campo>
          <Campo rotulo="Data">{(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={data} onChange={(e) => setData(e.currentTarget.value)} />}</Campo>
        </div>
        <Campo rotulo="Descrição">{(id) => <input id={id} class="entrada" maxLength={300} value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />}</Campo>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
      </div>
    </Dialogo>
  );
}
