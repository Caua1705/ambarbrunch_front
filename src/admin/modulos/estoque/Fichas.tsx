// Fichas técnicas: o que cada produto vendido (ou preparo da casa) leva, quanto custa a porção hoje e a margem ao preço do
// PDV — custo e margem vêm prontos do backend. Editar cria uma versão nova a partir de agora (as vendas passadas não
// mudam). Só gerência (estoque.editar; o backend confere: 403).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Search, Lock, Pencil, Plus, Trash2, Info, FileText, History } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { moeda, pct, quantidade, dataCurta, num, decimal } from '../../lib/formato';
import { Gaveta, useConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Cartao, Segmentado, Situacao, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio, Falha } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { Dec } from '../../lib/tipos/comum';
import type { FichaDetalhe, FichaLista, UnidadeBase } from '../../lib/tipos/estoque';
import { UNIDADE, UNIDADE_CURTA, atualizarEstoque } from './comum';

type Filtro = 'todas' | 'sem' | 'incompletas' | 'completas';
const situacao = (f: FichaLista) => (!f.ficha ? 'sem' : f.ficha.custo_incompleto ? 'incompleta' : 'completa');

/** O que a gaveta da ficha precisa saber de quem a abriu (a lista de produtos ou o detalhe de um preparo). */
export interface AlvoFicha {
  alvo: 'produto' | 'preparo';
  id: string;
  nome: string;
  grupo?: string | null;
  preco?: Dec | null;
  /** Margem a preço de hoje, calculada pelo backend (lista de fichas). */
  margem?: Dec | null;
  /** Unidade-base do preparo (o rendimento é medido nela). */
  unidade?: UnidadeBase;
  /** A lista já disse que não há ficha: não consulta (evita o 404 esperado). */
  semFicha?: boolean;
}

export function Fichas({ pode }: { pode: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [dias, setDias] = useState(30);
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<AlvoFicha | null>(null);
  const lista = useConsulta(pode ? `estoque/fichas?${dias}` : null, () => estoque.fichas('todas', dias));

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (lista.dados ?? []).filter((f) => {
      const s = situacao(f);
      if (filtro === 'sem' && s !== 'sem') return false;
      if (filtro === 'incompletas' && s !== 'incompleta') return false;
      if (filtro === 'completas' && s !== 'completa') return false;
      return !t || f.produto.toLowerCase().includes(t) || (f.grupo ?? '').toLowerCase().includes(t);
    });
  }, [lista.dados, filtro, busca]);

  if (!pode) return <Vazio icone={<Lock aria-hidden="true" />} titulo="Fichas técnicas são da gerência">Custos e margens dos produtos ficam com a gerência. Para registrar perdas e conferir compras, use as outras abas.</Vazio>;

  const n = (s: string) => (lista.dados ?? []).filter((f) => situacao(f) === s).length;
  const colunas: Coluna<FichaLista>[] = [
    { id: 'produto', titulo: 'Produto', ordenar: (f) => f.produto, celula: (f) => <><span class="principal-celula">{f.produto}</span>{f.grupo && <span class="sub">{f.grupo}</span>}</> },
    { id: 'preco', titulo: 'Preço no PDV', numero: true, prioridade: 'media', ordenar: (f) => num(f.preco_pdv), celula: (f) => <span class="num">{moeda(f.preco_pdv)}</span> },
    { id: 'vendas', titulo: `Vendas (${dias} dias)`, numero: true, prioridade: 'baixa', ordenar: (f) => num(f.receita_periodo), celula: (f) => <span class="num">{decimal(f.quantidade_periodo, 0)} <span class="sub">{moeda(f.receita_periodo)}</span></span> },
    { id: 'custo', titulo: 'Custo da porção', numero: true, ordenar: (f) => num(f.ficha?.custo_porcao_hoje), celula: (f) => <span class="num">{moeda(f.ficha?.custo_porcao_hoje)}</span> },
    { id: 'margem', titulo: 'Margem hoje', numero: true, prioridade: 'media', ordenar: (f) => num(f.ficha?.margem_hoje_pct), celula: (f) => <span class="num">{pct(f.ficha?.margem_hoje_pct)}</span> },
    { id: 'situacao', titulo: 'Ficha', ordenar: situacao, celula: (f) => { const s = situacao(f); return <Situacao tom={s === 'completa' ? 'ok' : 'atencao'} destaque={s === 'sem'}>{s === 'sem' ? 'Sem ficha' : s === 'incompleta' ? 'Custo incompleto' : `Completa · v${f.ficha!.versao}`}</Situacao>; } },
  ];
  const abrir = (f: FichaLista) => setAberta({ alvo: 'produto', id: f.eye_product_id, nome: f.produto, grupo: f.grupo, preco: f.preco_pdv, margem: f.ficha?.margem_hoje_pct ?? null, semFicha: !f.ficha });

  return (
    <>
      <p class="suave">Produtos que apareceram nas vendas. A margem usa o custo médio de hoje e o último preço do PDV — é estimada, não é lucro. Fichas de preparos da casa ficam no cadastro do insumo (aba Insumos).</p>
      <Cartao justo>
        <div class="filtros" style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }}>
          <div class="entrada-grupo">
            <Search aria-hidden="true" />
            <input class="entrada" type="search" placeholder="Buscar produto" aria-label="Buscar produto" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
          </div>
          <Segmentado
            rotulo="Situação da ficha"
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { valor: 'todas', rotulo: 'Todas' },
              { valor: 'sem', rotulo: `Sem ficha (${n('sem')})` },
              { valor: 'incompletas', rotulo: `Incompletas (${n('incompleta')})` },
              { valor: 'completas', rotulo: 'Completas' },
            ]}
          />
          <select class="selecao" aria-label="Período das vendas" style={{ width: 'auto' }} value={dias} onChange={(e) => setDias(Number(e.currentTarget.value))}>
            <option value={7}>Vendas de 7 dias</option>
            <option value={30}>Vendas de 30 dias</option>
            <option value={90}>Vendas de 90 dias</option>
          </select>
        </div>
        <Dados consulta={lista} recurso="As fichas técnicas" esqueleto={<EsqueletoTabela />}>
          {() => <Tabela rotulo="Fichas técnicas" colunas={colunas} linhas={linhas} chave={(f) => f.eye_product_id} aoAbrir={abrir} destaque={(f) => !f.ficha} vazio={<Vazio compacto titulo="Nenhum produto nesta lista">{filtro === 'sem' ? 'Todos os produtos vendidos no período têm ficha.' : 'Sem vendas no período (as vendas chegam do PDV).'}</Vazio>} />}
        </Dados>
      </Cartao>
      <GavetaFicha alvo={aberta} aoFechar={() => setAberta(null)} />
    </>
  );
}

/** Ficha de um produto do PDV ou de um preparo: custo de hoje, ingredientes, versões e o editor (nova versão). */
export function GavetaFicha({ alvo, aoFechar }: { alvo: AlvoFicha | null; aoFechar: () => void }) {
  const [salvou, setSalvou] = useState(false);
  const chave = alvo ? `estoque/fichas/${alvo.alvo}/${alvo.id}` : null;
  const consulta = useConsulta(chave && (!alvo!.semFicha || salvou) ? chave : null, () => estoque.ficha(alvo!.alvo, alvo!.id));
  const [editando, setEditando] = useState(false);
  useEffect(() => {
    setEditando(false);
    setSalvou(false);
  }, [alvo?.alvo, alvo?.id]);
  // 404 `sem_ficha` é o estado normal de quem ainda não tem ficha.
  const semFicha = (alvo?.semFicha && !salvou) || consulta.erro?.codigo === 'sem_ficha' || (consulta.erro?.tipo === 'nao_encontrado' && !consulta.dados);
  const f = semFicha ? null : consulta.dados ?? null;
  const preparo = alvo?.alvo === 'preparo';

  return (
    <Gaveta
      aberta={!!alvo}
      aoFechar={aoFechar}
      titulo={alvo?.nome ?? 'Ficha técnica'}
      subtitulo={alvo ? (preparo ? `Preparo da casa${alvo.unidade ? ` · em ${UNIDADE[alvo.unidade]}` : ''}` : `${alvo.grupo ?? 'Sem grupo'} · ${moeda(alvo.preco)} no PDV`) : undefined}
      largura="media"
      rodape={!editando && alvo && (semFicha || f) ? <Botao variante="primario" icone={f ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />} onClick={() => setEditando(true)}>{f ? 'Editar ficha' : 'Criar ficha'}</Botao> : undefined}
    >
      {!alvo ? null : editando ? (
        <EditorFicha alvo={alvo} atual={f} aoTerminar={(ok) => { setEditando(false); if (ok) { setSalvou(true); consulta.recarregar(); } }} />
      ) : semFicha ? (
        <Vazio icone={<FileText aria-hidden="true" />} titulo={preparo ? 'Este preparo ainda não tem ficha técnica' : 'Este produto ainda não tem ficha técnica'}>
          {preparo ? 'Sem ficha, o preparo não tem custo e os produtos que o usam ficam com custo incompleto.' : 'Sem ficha, o custo e a margem dele ficam de fora do CMV teórico e do Cardápio Inteligente.'}
        </Vazio>
      ) : consulta.erro && !consulta.dados ? (
        <Falha erro={consulta.erro} aoTentar={consulta.recarregar} recurso="A ficha" />
      ) : (
        <Dados consulta={consulta} recurso="A ficha" esqueleto={<Esqueleto linhas={8} />}>
          {(f: FichaDetalhe) => {
            const nomes = new Map(f.itens.map((i) => [i.insumo_id, i.insumo]));
            return (
              <>
                <section class="indicadores indicadores--3" style={{ gap: '10px' }}>
                  <div class="cartao indicador"><span class="indicador__rotulo">{preparo ? `Custo por ${alvo.unidade ? UNIDADE_CURTA[alvo.unidade] : 'unidade'}` : 'Custo da porção'}</span><span class="indicador__valor indicador__valor--m num">{moeda(f.custo_porcao)}</span></div>
                  {preparo ? (
                    <div class="cartao indicador"><span class="indicador__rotulo">Custo da receita</span><span class="indicador__valor indicador__valor--m num">{moeda(f.custo_receita)}</span></div>
                  ) : (
                    <div class="cartao indicador"><span class="indicador__rotulo">Margem hoje</span><span class="indicador__valor indicador__valor--m num">{salvou ? '—' : pct(alvo.margem)}</span>{salvou && <span class="indicador__rodape">Atualiza na lista de fichas</span>}</div>
                  )}
                  <div class="cartao indicador"><span class="indicador__rotulo">Rendimento</span><span class="indicador__valor indicador__valor--m num">{preparo && alvo.unidade ? quantidade(f.rendimento, alvo.unidade) : decimal(f.rendimento, 2)}</span><span class="indicador__rodape">{preparo ? 'por receita' : num(f.rendimento) === 1 ? 'porção' : 'porções por receita'}</span></div>
                </section>
                {f.insumos_sem_custo.length > 0 && (
                  <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
                    <strong>Custo incompleto:</strong> {f.insumos_sem_custo.map((id) => nomes.get(id) ?? 'insumo').join(', ')} ainda sem custo (nenhuma compra registrada). O custo da porção fica sem número até lá.
                  </Aviso>
                )}
                <div class="tabela-rolagem" style={{ border: '1px solid var(--borda)', borderRadius: '12px' }}>
                  <table class="tabela" aria-label="Ingredientes">
                    <thead><tr><th>Ingrediente</th><th class="num">Quantidade</th><th class="num" data-prioridade="baixa">Perda</th><th class="num">Custo</th></tr></thead>
                    <tbody>
                      {f.itens.map((i) => (
                        <tr key={i.insumo_id}>
                          <td>{i.insumo}{i.opcional && <span class="sub">opcional (fora do custo)</span>}</td>
                          <td class="num">{quantidade(i.quantidade, i.unidade_base)}</td>
                          <td class="num" data-prioridade="baixa">{num(i.perda_percentual) ? pct(i.perda_percentual) : '—'}</td>
                          <td class="num">{moeda(i.custo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p class="fraco">Custo da receita inteira: <strong class="num">{moeda(f.custo_receita)}</strong>{f.observacao ? ` · ${f.observacao}` : ''}</p>
                <section class="pilha pilha--p">
                  <h3 class="secao-titulo linha" style={{ gap: '6px' }}><History size={13} aria-hidden="true" /> Versões</h3>
                  <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '12px' }}>
                    {f.versoes.map((v) => (
                      <li key={v.versao} class="linha linha--entre" style={{ padding: '10px 14px' }}>
                        <span><strong style={{ fontWeight: 500 }}>Versão {v.versao}</strong>{v.vigente_ate === null && <span class="fraco"> · em uso</span>}</span>
                        <span class="fraco">desde {dataCurta(v.vigente_de.slice(0, 10), { ano: true })}{v.vigente_ate ? ` até ${dataCurta(v.vigente_ate.slice(0, 10), { ano: true })}` : ''} · rend. {decimal(v.rendimento, 2)}{v.criada_por ? ` · ${v.criada_por}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            );
          }}
        </Dados>
      )}
    </Gaveta>
  );
}

interface LinhaFicha {
  insumo: OpcaoAuto | null;
  unidade: UnidadeBase | null;
  quantidade: string;
  perda: string;
  opcional: boolean;
}
const linhaNova = (): LinhaFicha => ({ insumo: null, unidade: null, quantidade: '', perda: '', opcional: false });
const decimalDigitado = (t: string) => String(Number(t.replace(',', '.')));

function EditorFicha({ alvo, atual, aoTerminar }: { alvo: AlvoFicha; atual: FichaDetalhe | null; aoTerminar: (salvou: boolean) => void }) {
  const [linhas, setLinhas] = useState<LinhaFicha[]>(() =>
    atual?.itens.length ? atual.itens.map((i) => ({ insumo: { valor: i.insumo_id, rotulo: i.insumo }, unidade: i.unidade_base, quantidade: String(Number(i.quantidade)), perda: Number(i.perda_percentual) ? String(Number(i.perda_percentual)) : '', opcional: i.opcional })) : [linhaNova()],
  );
  const [rendimento, setRendimento] = useState(atual ? String(Number(atual.rendimento)) : '1');
  const [obs, setObs] = useState(atual?.observacao ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [unidades] = useState(() => new Map<string, UnidadeBase>());
  const { confirmar, elemento } = useConfirmacao();
  const set = (k: number, m: Partial<LinhaFicha>) => setLinhas(linhas.map((l, i) => (i === k ? { ...l, ...m } : l)));
  const buscar = async (t: string): Promise<OpcaoAuto[]> =>
    (await estoque.insumos({ busca: t.trim() || undefined, limite: 20 })).itens
      // Um preparo não entra na própria ficha (o backend recusa ciclo).
      .filter((i) => !(alvo.alvo === 'preparo' && i.id === alvo.id))
      .map((i) => {
        unidades.set(i.id, i.unidade_base);
        return { valor: i.id, rotulo: i.nome, detalhe: `${i.tipo === 'preparo' ? 'preparo · ' : ''}em ${UNIDADE_CURTA[i.unidade_base]}` };
      });

  function salvar(e: Event) {
    e.preventDefault();
    const usadas = linhas.filter((l) => l.insumo || l.quantidade);
    if (!usadas.length) return setErro('Adicione pelo menos um ingrediente.');
    for (const l of usadas) {
      if (!l.insumo) return setErro('Escolha o insumo de cada linha.');
      if (!(Number(l.quantidade.replace(',', '.')) > 0)) return setErro(`${l.insumo.rotulo}: informe a quantidade.`);
      const p = Number((l.perda || '0').replace(',', '.'));
      if (!(p >= 0 && p < 100)) return setErro(`${l.insumo.rotulo}: a perda vai de 0 a 99%.`);
    }
    if (new Set(usadas.map((l) => l.insumo!.valor)).size !== usadas.length) return setErro('Cada ingrediente entra uma vez só: some as quantidades na mesma linha.');
    if (!(Number(rendimento.replace(',', '.')) > 0)) return setErro('O rendimento precisa ser maior que zero.');
    setErro(null);
    confirmar({
      titulo: atual ? `Salvar a versão ${atual.versao + 1} da ficha?` : 'Criar a ficha técnica?',
      texto: 'A ficha nova passa a valer agora para custo e margem. Vendas que já aconteceram não mudam.',
      confirmar: 'Salvar ficha',
      acao: async () => {
        try {
          await estoque.salvarFicha(alvo.alvo, alvo.id, {
            rendimento: decimalDigitado(rendimento),
            itens: usadas.map((l) => ({ insumo_id: l.insumo!.valor, quantidade: decimalDigitado(l.quantidade), perda_percentual: decimalDigitado(l.perda || '0'), opcional: l.opcional })),
            observacao: obs.trim() || undefined,
          });
        } finally {
          atualizarEstoque();
        }
        aoTerminar(true);
      },
      sucesso: 'Ficha técnica salva (nova versão).',
    });
  }

  return (
    <form class="pilha" onSubmit={salvar} noValidate>
      <h3 class="secao-titulo">{atual ? `Editar ficha (nova versão ${atual.versao + 1})` : 'Nova ficha técnica'}</h3>
      <p class="suave">Quantidades na unidade-base de cada insumo (g, ml ou un). A perda é o que se joga fora no preparo (casca, aparas). Ingrediente opcional não entra no custo.</p>
      <div class="linhas-edicao">
        {linhas.map((l, k) => (
          <div class="linha-edicao linha-edicao--ficha" key={k}>
            <div class="campo">
              <span class="campo__rotulo">Ingrediente {k + 1}</span>
              <Autocompletar rotulo={`Ingrediente ${k + 1}`} placeholder="Buscar insumo" valor={l.insumo} buscar={buscar} aoEscolher={(o) => set(k, { insumo: o, unidade: o ? unidades.get(o.valor) ?? null : null })} />
            </div>
            <Campo rotulo={`Quantidade${l.unidade ? ` (${l.unidade})` : ''}`}>{(id) => <input id={id} class="entrada num" inputMode="decimal" value={l.quantidade} onInput={(e) => set(k, { quantidade: e.currentTarget.value })} />}</Campo>
            <Campo rotulo="Perda %">{(id) => <input id={id} class="entrada num" inputMode="decimal" placeholder="0" value={l.perda} onInput={(e) => set(k, { perda: e.currentTarget.value })} />}</Campo>
            <label class="marcar ficha-opcional"><input type="checkbox" checked={l.opcional} onChange={(e) => set(k, { opcional: e.currentTarget.checked })} /> Opcional</label>
            <Botao so_icone variante="fantasma" aria-label={`Remover o ingrediente ${k + 1}`} icone={<Trash2 aria-hidden="true" />} disabled={linhas.length === 1} onClick={() => setLinhas(linhas.filter((_, i) => i !== k))} />
          </div>
        ))}
        <Botao tamanho="p" icone={<Plus aria-hidden="true" />} style={{ alignSelf: 'flex-start' }} onClick={() => setLinhas([...linhas, linhaNova()])}>Adicionar ingrediente</Botao>
      </div>
      <div class="grade-campos">
        <Campo
          rotulo={alvo.alvo === 'preparo' ? `Rendimento (${alvo.unidade ? UNIDADE_CURTA[alvo.unidade] : 'unidade do preparo'})` : 'Rendimento (porções)'}
          ajuda={alvo.alvo === 'preparo' ? 'Quanto a receita inteira rende, na unidade do preparo.' : 'Quantas porções a receita rende. Uma bebida feita na hora rende 1.'}
        >
          {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={rendimento} onInput={(e) => setRendimento(e.currentTarget.value)} />}
        </Campo>
        <Campo rotulo="Observação" opcional>{(id) => <input id={id} class="entrada" maxLength={300} value={obs} onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
      </div>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={() => aoTerminar(false)}>Voltar</Botao>
        <Botao type="submit" variante="primario">Revisar e salvar</Botao>
      </div>
      {elemento}
    </form>
  );
}

