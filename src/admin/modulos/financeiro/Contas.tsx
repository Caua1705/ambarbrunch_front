// Contas a pagar: o que vence, o que venceu, o que foi pago — e as contas fixas (recorrências) separadas.
// Previsto (conta fixa) × devido (a conta do mês) × pago × saldo nunca se misturam. Conta de valor variável paga com o
// valor real, sem mudar a conta fixa. Rotas: GET /contas-a-pagar, POST /parcelas/{id}/pagamentos, /recorrencias.
import { useEffect, useState } from 'preact/hooks';
import { Banknote, Plus, Pencil, CalendarX, Repeat, Info } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, dataCurta, mesAno, num, paraDecimal, hojeISO, inicioMes, somarMeses, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao, Gaveta } from '../../ui/camadas';
import { Botao, Cabecalho, Cartao, Segmentado, Situacao, Etiqueta, Campo, Aviso } from '../../ui/base';
import { EntradaMoeda } from '../../ui/entradas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { ContaPagar, ListaContas, Recorrencia } from '../../lib/tipos/financeiro';
import { SITUACAO_CONTA, useCategorias, nomeCategoria, OpcoesCategoria, atualizarFinanceiro, avisar } from './comum';
import { Pagar, type ContaParaPagar } from './Pagar';
import { DetalheDespesa } from './DetalheDespesa';

type Filtro = 'vencidas' | 'hoje' | 'proximas' | 'abertas' | 'pagas';
const FILTROS: Filtro[] = ['vencidas', 'hoje', 'proximas', 'abertas', 'pagas'];

export function Contas(_: { contexto: ContextoPainel }) {
  const inicial = lerParam('situacao') as Filtro | null;
  const [filtro, setFiltro] = useState<Filtro>(inicial && FILTROS.includes(inicial) ? inicial : 'abertas');
  const [pagar, setPagar] = useState<ContaParaPagar | null>(null);
  const [despesa, setDespesa] = useState<string | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const cats = useCategorias();
  useEffect(() => gravarParams({ situacao: filtro === 'abertas' ? null : filtro }), [filtro]);

  const q = filtro === 'pagas' ? { situacao: 'pagas', de: somarMeses(inicioMes(hojeISO()), -2) } : { situacao: filtro };
  const lista = useConsulta(`financeiro/contas:${JSON.stringify(q)}`, () => financeiro.contas(q));
  const resumo = useConsulta('financeiro/resumo', () => financeiro.resumo());
  const n = resumo.dados?.contas;

  const colunas: Coluna<ContaPagar>[] = [
    { id: 'vencimento', titulo: 'Vencimento', prioridade: 'media', ordenar: (c) => c.vencimento, largura: '108px', celula: (c) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(c.vencimento)}</span> },
    {
      id: 'descricao', titulo: 'Conta', ordenar: (c) => c.descricao,
      celula: (c) => (
        <>
          <span class="principal-celula">{c.descricao}{c.numero > 1 || c.compra_id ? <span class="fraco"> · {c.numero}ª</span> : null}</span>
          <span class="sub">
            <span class="fin-so-celular"><strong style={{ color: c.situacao_painel === 'vencida' ? 'var(--perigo)' : undefined }}>{SITUACAO_CONTA[c.situacao_painel].rotulo}</strong> · {dataCurta(c.vencimento)} · </span>
            {[c.fornecedor, nomeCategoria(cats.dados, c.categoria)].filter(Boolean).join(' · ')}
            {c.recorrencia_id && ' · Conta fixa'}
          </span>
        </>
      ),
    },
    {
      id: 'valor', titulo: 'Valor', numero: true, prioridade: 'media', ordenar: (c) => Number(c.valor),
      celula: (c) => (c.valor_a_confirmar ? <><span class="num">{moeda(c.valor)}</span><span class="sub">previsto</span></> : <span class="num">{moeda(c.valor)}</span>),
    },
    { id: 'pago', titulo: 'Pago', numero: true, prioridade: 'baixa', celula: (c) => <span class="num">{num(c.valor_pago) ? moeda(c.valor_pago) : '—'}</span> },
    { id: 'saldo', titulo: 'Falta pagar', numero: true, ordenar: (c) => Number(c.saldo), celula: (c) => <span class="num forte" style={{ whiteSpace: 'nowrap' }}>{c.situacao === 'paga' ? '—' : c.valor_a_confirmar ? 'a confirmar' : moeda(c.saldo)}</span> },
    {
      id: 'situacao', titulo: 'Situação', prioridade: 'media',
      celula: (c) => (
        <span class="linha" style={{ gap: '6px' }}>
          <Situacao tom={SITUACAO_CONTA[c.situacao_painel].tom} destaque={SITUACAO_CONTA[c.situacao_painel].destaque}>{SITUACAO_CONTA[c.situacao_painel].rotulo}</Situacao>
          {c.status_despesa === 'em_revisao' && <Etiqueta tom="atencao">em revisão</Etiqueta>}
        </span>
      ),
    },
    {
      id: 'acoes', titulo: '',
      celula: (c) => (c.situacao === 'paga' ? null : (
        <Botao tamanho="p" variante={c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje' ? 'primario' : 'secundario'} icone={<Banknote aria-hidden="true" />} onClick={() => setPagar(c)}>
          Pagar
        </Botao>
      )),
    },
  ];

  return (
    <>
      <Cabecalho titulo="Contas a pagar" descricao="Contas lançadas, parcelas de compras e contas fixas do mês" />
      <Segmentado<Filtro>
        rotulo="Situação das contas"
        valor={filtro}
        aoMudar={setFiltro}
        opcoes={[
          { valor: 'vencidas', rotulo: `Vencidas${n?.vencidas.qtd ? ` (${n.vencidas.qtd})` : ''}` },
          { valor: 'hoje', rotulo: `Vencem hoje${n?.hoje.qtd ? ` (${n.hoje.qtd})` : ''}` },
          { valor: 'proximas', rotulo: 'Próximos dias' },
          { valor: 'abertas', rotulo: 'Todas em aberto' },
          { valor: 'pagas', rotulo: 'Pagas' },
        ]}
      />
      <Cartao justo>
        <Dados consulta={lista} recurso="As contas a pagar" esqueleto={<EsqueletoTabela />}>
          {(r: ListaContas) => (
            <>
              {r.itens.length > 0 && (
                <div class="fin-totais">
                  <div><span>{plural(r.total, 'conta', 'contas')}</span><strong class="num">{moeda(r.totais.valor)}</strong></div>
                  {filtro !== 'pagas' && <div><span>Falta pagar</span><strong class="num">{moeda(r.totais.saldo)}</strong></div>}
                </div>
              )}
              <Tabela
                rotulo="Contas a pagar"
                colunas={colunas}
                linhas={r.itens}
                chave={(c) => c.parcela_id}
                aoAbrir={(c) => setDespesa(c.despesa_id)}
                destaque={(c) => c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje'}
                ordemInicial={{ coluna: 'vencimento', desc: filtro === 'pagas' }}
                vazio={<Vazio compacto titulo={filtro === 'vencidas' ? 'Nenhuma conta vencida' : filtro === 'hoje' ? 'Nada vence hoje' : 'Nenhuma conta aqui'}>{filtro === 'pagas' ? 'Pagamentos dos últimos meses aparecem aqui.' : 'Contas novas entram por “Nova despesa”, pelas compras ou pelas contas fixas.'}</Vazio>}
              />
            </>
          )}
        </Dados>
      </Cartao>

      <Recorrencias confirmar={confirmar} />

      <Pagar conta={pagar} aoFechar={() => setPagar(null)} />
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
      {dialogo}
    </>
  );
}

function Recorrencias({ confirmar }: { confirmar: ReturnType<typeof useConfirmacao>['confirmar'] }) {
  const consulta = useConsulta('financeiro/recorrencias', () => financeiro.recorrencias());
  const cats = useCategorias();
  const [editar, setEditar] = useState<Recorrencia | 'nova' | null>(null);
  return (
    <>
      <Cartao titulo={<span class="linha"><Repeat size={16} aria-hidden="true" /> Contas fixas</span>} descricao="Cadastradas uma vez; a conta de cada mês é criada sozinha" justo acoes={<Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={() => setEditar('nova')}>Nova conta fixa</Botao>}>
        <Dados consulta={consulta} recurso="As contas fixas" compacto esqueleto={<EsqueletoTabela linhas={3} />}>
          {(rs) =>
            rs.length ? (
              <ul class="lista">
                {rs.map((r) => (
                  <li key={r.id} class="lista__item" style={{ flexWrap: 'wrap' }}>
                    <span class="lista__texto" style={{ minWidth: '180px' }}>
                      <strong>{r.descricao}</strong>
                      <span>
                        {nomeCategoria(cats.dados, r.categoria_codigo)} · todo dia {r.dia_vencimento}
                        {r.intervalo_meses > 1 ? ` · a cada ${r.intervalo_meses} meses` : ''}
                        {r.proximas[0] ? ` · próxima ${dataCurta(r.proximas[0].vencimento)}` : ''}
                      </span>
                    </span>
                    <span class="lista__fim" style={{ color: 'var(--texto)' }}>
                      <span class="num forte">{moeda(r.valor_previsto)}</span>
                      {r.valor_variavel && <Etiqueta tom="info">varia</Etiqueta>}
                      <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Alterar ${r.descricao}`} icone={<Pencil aria-hidden="true" />} onClick={() => setEditar(r)} />
                      <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Encerrar ${r.descricao}`} icone={<CalendarX aria-hidden="true" />} onClick={() => confirmar({ titulo: `Encerrar “${r.descricao}”?`, texto: 'Não serão criadas contas depois deste mês. As contas já geradas continuam.', confirmar: 'Encerrar conta fixa', perigo: true, acao: async () => { await financeiro.alterarRecorrencia(r.id, { versao: r.versao, encerrar_em: hojeISO() }); atualizarFinanceiro(); }, sucesso: 'Conta fixa encerrada.' })} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio compacto icone={<Repeat aria-hidden="true" />} titulo="Nenhuma conta fixa">Aluguel, internet, folha: cadastre uma vez e a conta de cada mês aparece aqui em Contas a pagar.</Vazio>
            )
          }
        </Dados>
        <div class="cartao__rodape">
          Valor da conta do mês diferente do previsto (energia, vale-transporte)? Pague pelo botão <strong>Pagar</strong> informando o valor real — a conta fixa não muda.
        </div>
      </Cartao>
      <EditarRecorrencia alvo={editar} aoFechar={() => setEditar(null)} />
    </>
  );
}

function EditarRecorrencia({ alvo, aoFechar }: { alvo: Recorrencia | 'nova' | null; aoFechar: () => void }) {
  const cats = useCategorias();
  const r = alvo && alvo !== 'nova' ? alvo : null;
  const brl = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [variavel, setVariavel] = useState(false);
  const [dia, setDia] = useState(10);
  const [aPartir, setAPartir] = useState(hojeISO().slice(0, 7));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!alvo) return;
    setDescricao(r?.descricao ?? '');
    setCategoria(r?.categoria_codigo ?? '');
    setValor(r ? brl(r.valor_previsto) : '');
    setVariavel(r?.valor_variavel ?? false);
    setDia(r?.dia_vencimento ?? 10);
    setAPartir((r?.proximas[0]?.competencia ?? hojeISO()).slice(0, 7));
    setErro(null);
  }, [alvo]);

  async function salvar(e: Event) {
    e.preventDefault();
    const v = paraDecimal(valor);
    if (descricao.trim().length < 2 || !v || !(dia >= 1 && dia <= 31) || (!r && !categoria)) return setErro('Preencha descrição, categoria, valor previsto e dia de vencimento (1 a 31).');
    setOcupado(true);
    setErro(null);
    try {
      if (r) {
        await financeiro.alterarRecorrencia(r.id, { versao: r.versao, aplicar_a_partir_de: `${aPartir}-01`, descricao: descricao.trim(), valor_previsto: v, dia_vencimento: dia, valor_variavel: variavel });
        avisar(`Conta fixa alterada a partir de ${mesAno(`${aPartir}-01`).toLowerCase()}.`, 'ok');
      } else {
        await financeiro.criarRecorrencia({ descricao: descricao.trim(), categoria, valor_previsto: v, valor_variavel: variavel, dia_vencimento: dia, inicio: `${aPartir}-01` });
        avisar('Conta fixa cadastrada.', 'ok');
      }
      atualizarFinanceiro();
      aoFechar();
    } catch (err) {
      if (err instanceof ErroApi && err.tipo === 'conflito') atualizarFinanceiro();
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível salvar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Gaveta aberta={!!alvo} aoFechar={aoFechar} titulo={r ? 'Alterar conta fixa' : 'Nova conta fixa'} subtitulo={r?.descricao}
      rodape={<><Botao onClick={aoFechar} disabled={ocupado}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-recorrencia" carregando={ocupado}>Salvar</Botao></>}>
      <form id="form-recorrencia" class="pilha" onSubmit={salvar} noValidate>
        {r && <Aviso tom="info" icone={<Info aria-hidden="true" />}>A mudança vale a partir do mês escolhido. Contas já pagas não mudam.</Aviso>}
        {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
        <Campo rotulo="Descrição">{(id) => <input id={id} class="entrada" placeholder="Ex.: Aluguel da loja" value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />}</Campo>
        {!r && (
          <Campo rotulo="Categoria">
            {(id) => (
              <select id={id} class="selecao" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
                <option value="">Escolha…</option>
                <OpcoesCategoria cats={cats.dados ?? []} />
              </select>
            )}
          </Campo>
        )}
        <div class="grade-campos">
          <Campo rotulo="Valor previsto">{(id, d) => <EntradaMoeda id={id} descr={d} valor={valor} aoMudar={setValor} />}</Campo>
          <Campo rotulo="Dia do vencimento">{(id) => <input id={id} type="number" min={1} max={31} class="entrada num" value={dia} onInput={(e) => setDia(Number(e.currentTarget.value))} />}</Campo>
          <Campo rotulo={r ? 'Vale a partir de' : 'Primeiro mês'} class="inteiro">{(id) => <input id={id} type="month" class="entrada" value={aPartir} onChange={(e) => setAPartir(e.currentTarget.value)} />}</Campo>
        </div>
        <label class="marcar">
          <input type="checkbox" checked={variavel} onChange={(e) => setVariavel(e.currentTarget.checked)} />
          <span>O valor muda todo mês <span class="fraco">(energia, água, vale-transporte). O valor real é informado ao pagar.</span></span>
        </label>
      </form>
    </Gaveta>
  );
}
