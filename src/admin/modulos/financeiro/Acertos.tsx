// Acertos (aba própria do Financeiro, só para quem tem financeiro.ver_societario). Tela simples: quanto o Âmbar deve à
// Roll, quanto a Roll deve ao Âmbar, o acerto líquido e quanto cada lado deve às pessoas que pagaram com dinheiro
// próprio. Tudo vem pronto do backend (GET /admin/financeiro/acertos): para cada pagamento, quem pagou (lado da conta) ×
// responsável da despesa (Pagador e Responsável). Conjunto é a classificação da despesa compartilhada, SEM regra de
// divisão: fica pendente (nunca 50/50 presumido) até alguém reclassificar a despesa. Só despesas e reembolsos.
// "Registrar pagamento" grava um movimento de acerto (nunca uma despesa nova). Valor a acertar não é saldo de banco.
import { useEffect, useState } from 'preact/hooks';
import { AlertTriangle, Plus, List } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, hojeISO, paraDecimal, plural } from '../../lib/formato';
import { Dialogo, Gaveta } from '../../ui/camadas';
import { Botao, Cartao, Campo, Aviso, Segmentado, Situacao } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Acertos as DadosAcertos, ItemAcerto, MovimentoAcerto, PendenciaAcerto, Responsavel, Tratamento } from '../../lib/tipos/financeiro';
import { RESPONSAVEL, TRATAMENTO, PARTE, rotuloConta, useContasPagadoras, atualizarFinanceiro, avisar, avisarFalha } from './comum';

type Sentido = MovimentoAcerto['sentido'];
const SENTIDO: Record<Sentido, string> = {
  roll_para_ambar: 'Roll pagou ao Âmbar', ambar_para_roll: 'Âmbar pagou à Roll', ambar_para_socio: 'Reembolso pago a uma pessoa',
};
const PENDENCIA: Record<PendenciaAcerto, string> = {
  sem_regra: 'Conjunto sem regra de divisão',
  conta_conjunta: 'Pago pela conta conjunta',
  sem_pagador: 'Sem pagador identificado',
  reembolso_a_definir: 'Reembolso a decidir',
};
type Filtro = 'todos' | 'ambar' | 'roll' | 'reembolsos' | 'pendentes';
interface Pedido { sentido: Sentido; valor?: string; conta?: string }

const num = (v: string | null | undefined) => Number(v ?? 0);
const LEGADO_ZERO = { quantidade: 0, valor: '0.00', por_lado: { ambar: '0.00', roll: '0.00' } };

export function Acertos() {
  const dados = useConsulta('financeiro/acertos', () => financeiro.acertos());
  const [novo, setNovo] = useState<Pedido | null>(null);
  const [detalhe, setDetalhe] = useState<Filtro | null>(null);
  return (
    <>
      <Dados consulta={dados} recurso="Os acertos" esqueleto={<Cartao><Esqueleto linhas={4} /></Cartao>}>
        {(a) => (
          <>
            <Conteudo a={a} novo={setNovo} detalhes={setDetalhe} />
            <Detalhes a={a} filtro={detalhe} mudar={setDetalhe} />
          </>
        )}
      </Dados>
      <NovoMovimento pedido={novo} aoFechar={() => setNovo(null)} />
    </>
  );
}

function Conteudo({ a, novo, detalhes }: { a: DadosAcertos; novo: (p: Pedido) => void; detalhes: (f: Filtro) => void }) {
  // Backend anterior (sem `acerto`): os mesmos números saem do bloco antigo.
  const r = a.roll;
  const acerto = a.acerto ?? {
    ambar_deve_a_roll: { gerado: r.roll_adiantou_pelo_ambar, pago: r.compensado_ambar_para_roll, em_aberto: String(num(r.roll_adiantou_pelo_ambar) - num(r.compensado_ambar_para_roll)) },
    roll_deve_ao_ambar: { gerado: r.ambar_adiantou_pela_roll, pago: r.compensado_roll_para_ambar, em_aberto: String(num(r.ambar_adiantou_pela_roll) - num(r.compensado_roll_para_ambar)) },
    liquido: { situacao: r.situacao, valor: r.valor, saldo: r.saldo },
  };
  const pend = a.pendencias ?? { sem_regra: LEGADO_ZERO, conta_conjunta: LEGADO_ZERO, reembolso_a_definir: LEGADO_ZERO, sem_pagador: { ...LEGADO_ZERO, ...a.sem_pagador } };
  const l = acerto.liquido;
  const frase = l.situacao === 'zerado' ? 'Âmbar e Roll estão quites.' : l.situacao === 'roll_deve' ? `A Roll deve pagar ${moeda(l.valor)} ao Âmbar.` : `O Âmbar deve pagar ${moeda(l.valor)} à Roll.`;
  const pendentes = (Object.keys(PENDENCIA) as PendenciaAcerto[]).filter((k) => pend[k].quantidade > 0);
  const pessoas = a.socios.filter((s) => num(s.a_reembolsar) !== 0 || num(s.a_definir) > 0);
  const reemb = (lado: 'ambar' | 'roll') => a.reembolsos?.[lado].a_reembolsar ?? String(a.socios.filter((s) => s.conta?.parte === lado).reduce((t, s) => t + num(s.a_reembolsar), 0));

  const divida = (rotulo: string, d: { gerado: string; pago: string; em_aberto: string }) => (
    <div>
      <span>{rotulo}</span>
      <strong class="num">{moeda(d.em_aberto)}</strong>
      {num(d.pago) > 0 && <small>{moeda(d.gerado)} gerado · {moeda(d.pago)} já pago</small>}
    </div>
  );

  return (
    <>
      <p class="fraco">Valores a acertar entre Âmbar e Roll, calculados pelas despesas pagas (Pagador × Responsável). Não é saldo bancário.</p>
      <Cartao titulo="Âmbar × Roll" acoes={<Botao tamanho="p" icone={<List aria-hidden="true" />} onClick={() => detalhes('todos')}>Ver detalhes</Botao>}>
        <div class="fin-valores">
          {divida('Âmbar deve à Roll', acerto.ambar_deve_a_roll)}
          {divida('Roll deve ao Âmbar', acerto.roll_deve_ao_ambar)}
          <div><span>Acerto líquido</span><strong class="num">{l.situacao === 'zerado' ? '—' : moeda(l.valor)}</strong><small>{l.situacao === 'roll_deve' ? 'Roll paga ao Âmbar' : l.situacao === 'ambar_deve' ? 'Âmbar paga à Roll' : 'quites'}</small></div>
        </div>
        <p class="fin-saldo"><strong>{frase}</strong></p>
        {l.situacao !== 'zerado' && (
          <Botao tamanho="p" variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => novo({ sentido: l.situacao === 'ambar_deve' ? 'ambar_para_roll' : 'roll_para_ambar', valor: l.valor })}>Registrar acerto pago</Botao>
        )}
      </Cartao>

      <Cartao titulo="Reembolsos pessoais" descricao="Quanto cada lado deve às pessoas do próprio lado que pagaram despesas com dinheiro próprio. Só conta depois de alguém decidir reembolsar.">
        <div class="fin-valores">
          <div><span>Âmbar deve às pessoas</span><strong class="num">{moeda(reemb('ambar'))}</strong></div>
          <div><span>Roll deve às pessoas</span><strong class="num">{moeda(reemb('roll'))}</strong></div>
        </div>
        {pessoas.length > 0 && (
          <div class="tabela-rolagem">
            <table class="tabela" aria-label="Reembolsos por pessoa">
              <thead><tr><th>Pessoa</th><th data-prioridade="media">Lado</th><th class="num">A reembolsar</th><th class="num">A decidir</th><th /></tr></thead>
              <tbody>
                {pessoas.map((s) => (
                  <tr key={s.conta?.id ?? 'x'}>
                    <td>{s.conta?.apelido ?? '—'}</td>
                    <td data-prioridade="media">{s.conta ? PARTE[s.conta.parte] : '—'}</td>
                    <td class="num forte">{moeda(s.a_reembolsar)}</td>
                    <td class="num">{num(s.a_definir) > 0 ? <span class="fin-falta">{moeda(s.a_definir)}</span> : '—'}</td>
                    <td>{num(s.a_reembolsar) > 0 && s.conta && <Botao tamanho="p" onClick={() => novo({ sentido: 'ambar_para_socio', valor: s.a_reembolsar, conta: s.conta!.id })}>Registrar reembolso</Botao>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {pendentes.length > 0 && (
        <Aviso tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>
          <strong>Pendente, fora da conta:</strong>{' '}
          {pendentes.map((k) => `${PENDENCIA[k]}: ${moeda(pend[k].valor)} (${plural(pend[k].quantidade, 'pagamento', 'pagamentos')})`).join(' · ')}.{' '}
          <button type="button" class="link" onClick={() => detalhes('pendentes')}>Ver detalhes</button>
        </Aviso>
      )}

      {a.movimentos.length > 0 && (
        <details class="fin-detalhes">
          <summary>Acertos e reembolsos registrados ({a.movimentos.length})</summary>
          <ul class="fin-lista-simples">
            {a.movimentos.map((m) => <li key={m.id}><span class="num">{dataCurta(m.data)}</span> · {SENTIDO[m.sentido]}{m.conta ? ` (${m.conta.apelido})` : ''} · <strong class="num">{moeda(m.valor)}</strong> · {m.descricao}</li>)}
          </ul>
        </details>
      )}
    </>
  );
}

/** Situação do pagamento no acerto (dívida, pendência) e, em conta pessoal, a decisão de reembolso. */
function SituacaoItem({ i }: { i: ItemAcerto }) {
  const s = i.situacao;
  const parcial = i.valor_no_acerto && num(i.valor_no_acerto) !== num(i.valor) ? ` ${moeda(i.valor_no_acerto)}` : '';
  return (
    <span class="linha" style={{ gap: '6px', flexWrap: 'wrap' }}>
      {s === 'acerto' && <Situacao tom="info">{i.devedor === 'ambar' ? 'Âmbar deve à Roll' : 'Roll deve ao Âmbar'}{parcial}</Situacao>}
      {s === 'sem_regra' && <Situacao tom="atencao" destaque>Pendente: sem regra</Situacao>}
      {s === 'conta_conjunta' && <Situacao tom="atencao" destaque>Pendente: conta conjunta</Situacao>}
      {s === 'sem_pagador' && <Situacao tom="atencao" destaque>Pendente: sem pagador</Situacao>}
      {s === 'sem_divida' && <Situacao tom="neutro">Sem dívida entre os lados</Situacao>}
      {i.tratamento && <SeletorTratamento item={i} />}
    </span>
  );
}

function Detalhes({ a, filtro, mudar }: { a: DadosAcertos; filtro: Filtro | null; mudar: (f: Filtro | null) => void }) {
  if (!filtro) return null;
  const pendente = (i: ItemAcerto) => i.situacao === 'sem_regra' || i.situacao === 'conta_conjunta' || i.situacao === 'sem_pagador' || i.tratamento === 'a_definir';
  const linhas = a.itens.filter((i) =>
    filtro === 'todos' ? true
      : filtro === 'ambar' ? i.situacao === 'acerto' && i.devedor === 'ambar'
        : filtro === 'roll' ? i.situacao === 'acerto' && i.devedor === 'roll'
          : filtro === 'reembolsos' ? !!i.tratamento
            : pendente(i));
  const colunas: Coluna<ItemAcerto>[] = [
    { id: 'data', titulo: 'Data', prioridade: 'media', largura: '86px', ordenar: (i) => i.pago_em, celula: (i) => <span class="num">{dataCurta(i.pago_em)}</span> },
    { id: 'descricao', titulo: 'Descrição', ordenar: (i) => i.descricao, celula: (i) => <><span class="principal-celula">{i.descricao}</span><span class="sub fin-so-celular">{dataCurta(i.pago_em)} · {i.pagador ? rotuloConta(i.pagador) : 'sem pagador'}</span></> },
    { id: 'valor', titulo: 'Valor', numero: true, ordenar: (i) => Number(i.valor), celula: (i) => <span class="num">{moeda(i.valor)}</span> },
    { id: 'pagador', titulo: 'Pagador', prioridade: 'media', celula: (i) => (i.pagador ? rotuloConta(i.pagador) : <span class="fin-falta">Não identificado</span>) },
    { id: 'responsavel', titulo: 'Responsável', celula: (i) => <SeletorResponsavel item={i} /> },
    { id: 'situacao', titulo: 'Situação', celula: (i) => <SituacaoItem i={i} /> },
  ];
  return (
    <Gaveta aberta largura="larga" aoFechar={() => mudar(null)} titulo="Lançamentos dos acertos" subtitulo="Pagamentos que geraram cada dívida ou que estão pendentes">
      <div class="pilha">
        <Segmentado<Filtro>
          rotulo="Mostrar"
          valor={filtro}
          aoMudar={mudar}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos' },
            { valor: 'ambar', rotulo: 'Âmbar deve' },
            { valor: 'roll', rotulo: 'Roll deve' },
            { valor: 'reembolsos', rotulo: 'Reembolsos' },
            { valor: 'pendentes', rotulo: 'Pendentes' },
          ]}
        />
        <Tabela rotulo="Lançamentos dos acertos" colunas={colunas} linhas={linhas} chave={(i) => i.pagamento_id} ordemInicial={{ coluna: 'data', desc: true }}
          vazio={<Vazio compacto titulo="Nada aqui">Despesas pagas pelo próprio lado não geram acerto.</Vazio>} />
        {!!a.itens_total && a.itens_total > a.itens.length && <p class="fraco">Mostrando os {a.itens.length} mais recentes de {a.itens_total}.</p>}
        <p class="fraco">Para tirar uma despesa do Conjunto da pendência, defina o responsável (Âmbar, Roll ou 50/50). Nada é dividido sozinho.</p>
      </div>
    </Gaveta>
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
    // Sugestão: o valor pago (o lado da pessoa a reembolsa). Quem decide o valor é a pessoa.
    const sugestao = Number(item.valor);
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

function NovoMovimento({ pedido, aoFechar }: { pedido: Pedido | null; aoFechar: () => void }) {
  const sentido = pedido?.sentido ?? null;
  const contas = useContasPagadoras();
  const [s, setS] = useState<Sentido>('roll_para_ambar');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState('');
  const [conta, setConta] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (pedido) {
      setS(pedido.sentido);
      setValor(pedido.valor ? Number(pedido.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
      setDescricao(''); setConta(pedido.conta ?? ''); setErro(null); setData(hojeISO());
    }
  }, [pedido]);
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
        <p class="fraco">Registra só o pagamento do acerto: nenhuma despesa é criada ou repetida.</p>
      </div>
    </Dialogo>
  );
}
