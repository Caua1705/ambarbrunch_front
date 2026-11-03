// Fichas técnicas: o que cada produto vendido na Eyemobile (ou preparo da casa) leva e o custo estimado da porção, com os
// valores oficiais dos insumos — custo e margem vêm prontos do backend e só aparecem com a ficha completa. Editar cria
// uma versão nova a partir de agora (as vendas passadas não mudam). Só gerência (estoque.editar; o backend confere: 403).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Search, Lock, Pencil, Plus, Trash2, Info, FileText, History } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { moeda, pct, quantidade, dataCurta, num, decimal } from '../../lib/formato';
import { Gaveta, useConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Cartao, Situacao, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio, Falha } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { Dec } from '../../lib/tipos/comum';
import type { FichaDetalhe, FichaLista, UnidadeBase } from '../../lib/tipos/estoque';
import { UNIDADE, UNIDADE_CURTA, atualizarEstoque } from './comum';

type Filtro = 'todas' | 'sem' | 'incompletas' | 'completas';
const situacao = (f: FichaLista) => (!f.ficha ? 'sem' : f.ficha.custo_incompleto ? 'incompleta' : 'completa');
/** O backend sabe se há ficha e se algum ingrediente está sem custo; se faltou cadastrar um ingrediente, só quem conhece a
 *  receita sabe — por isso não há um "incompleta" automático além destes. */
const SITUACAO_FICHA = { sem: 'Sem ficha', incompleta: 'Custo indisponível', completa: 'Completa' } as const;

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

export function Fichas({ pode, cobertura, responsavel }: { pode: boolean; cobertura: string | null; responsavel: (r: string | null | undefined) => string | null }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<AlvoFicha | null>(null);
  const lista = useConsulta(pode ? 'estoque/fichas?30' : null, () => estoque.fichas('todas', 30));

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

  if (!pode) return <Vazio icone={<Lock aria-hidden="true" />} titulo="Fichas técnicas são da gerência">Custos dos produtos ficam com a gerência.</Vazio>;

  const n = (s: string) => (lista.dados ?? []).filter((f) => situacao(f) === s).length;
  const colunas: Coluna<FichaLista>[] = [
    { id: 'produto', titulo: 'Produto', ordenar: (f) => f.produto, celula: (f) => <><span class="principal-celula">{f.produto}</span>{f.grupo && <span class="sub">{f.grupo}</span>}</> },
    { id: 'preco', titulo: 'Preço no PDV', numero: true, prioridade: 'media', ordenar: (f) => num(f.preco_pdv), celula: (f) => <span class="num">{moeda(f.preco_pdv)}</span> },
    { id: 'vendas', titulo: 'Vendidos em 30 dias', numero: true, prioridade: 'baixa', ordenar: (f) => num(f.quantidade_periodo), celula: (f) => <span class="num">{decimal(f.quantidade_periodo, 0)}</span> },
    { id: 'custo', titulo: 'Custo estimado', numero: true, ordenar: (f) => num(f.ficha?.custo_porcao_hoje), celula: (f) => (situacao(f) === 'completa' ? <span class="num">{moeda(f.ficha!.custo_porcao_hoje)}</span> : <span class="fraco">{situacao(f) === 'sem' ? '—' : 'Indisponível'}</span>) },
    { id: 'situacao', titulo: 'Ficha', ordenar: situacao, celula: (f) => { const s = situacao(f); return <Situacao tom={s === 'completa' ? 'ok' : 'atencao'} destaque={s === 'sem'}>{SITUACAO_FICHA[s]}</Situacao>; } },
  ];
  const abrir = (f: FichaLista) => setAberta({ alvo: 'produto', id: f.eye_product_id, nome: f.produto, grupo: f.grupo, preco: f.preco_pdv, margem: f.ficha && !f.ficha.custo_incompleto ? f.ficha.margem_hoje_pct : null, semFicha: !f.ficha });

  return (
    <>
      <Cartao justo>
        <div class="estoque-filtros">
          <div class="entrada-grupo estoque-filtros__busca">
            <Search aria-hidden="true" />
            <input class="entrada" type="search" placeholder="Buscar produto" aria-label="Buscar produto" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
          </div>
          <select class="selecao selecao--auto" aria-label="Situação da ficha" value={filtro} onChange={(e) => setFiltro(e.currentTarget.value as Filtro)}>
            <option value="todas">Todas as fichas</option>
            <option value="sem">Sem ficha ({n('sem')})</option>
            <option value="incompletas">Custo indisponível ({n('incompleta')})</option>
            <option value="completas">Completas ({n('completa')})</option>
          </select>
          {cobertura !== null && <span class="fraco estoque-filtros__nota">Fichas cobrem {pct(cobertura, { fracao: true, casas: 0 })} da receita de 30 dias</span>}
        </div>
        <Dados consulta={lista} recurso="As fichas técnicas" esqueleto={<EsqueletoTabela />}>
          {() => <Tabela rotulo="Fichas técnicas" colunas={colunas} linhas={linhas} chave={(f) => f.eye_product_id} aoAbrir={abrir} destaque={(f) => !f.ficha} vazio={<Vazio compacto titulo="Nenhum produto nesta lista">{filtro === 'sem' ? 'Todos os produtos vendidos têm ficha.' : 'Os produtos aparecem quando chegam vendas da Eyemobile.'}</Vazio>} />}
        </Dados>
      </Cartao>
      <GavetaFicha alvo={aberta} aoFechar={() => setAberta(null)} responsavel={responsavel} />
    </>
  );
}

/** Ficha de um produto do PDV ou de um preparo: custo de hoje, ingredientes, versões e o editor (nova versão). */
export function GavetaFicha({ alvo, aoFechar, responsavel }: { alvo: AlvoFicha | null; aoFechar: () => void; responsavel?: (r: string | null | undefined) => string | null }) {
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
      subtitulo={alvo ? (preparo ? `Preparo da casa${alvo.unidade ? ` · em ${UNIDADE[alvo.unidade]}` : ''}` : `Produto da Eyemobile · ${alvo.grupo ?? 'sem grupo'} · ${moeda(alvo.preco)}`) : undefined}
      largura="media"
      rodape={!editando && alvo && (semFicha || f) ? <Botao variante="primario" icone={f ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />} onClick={() => setEditando(true)}>{f ? 'Editar ficha' : 'Criar ficha'}</Botao> : undefined}
    >
      {!alvo ? null : editando ? (
        <EditorFicha alvo={alvo} atual={f} aoTerminar={(ok) => { setEditando(false); if (ok) { setSalvou(true); consulta.recarregar(); } }} />
      ) : semFicha ? (
        <Vazio icone={<FileText aria-hidden="true" />} titulo={preparo ? 'Este preparo ainda não tem ficha técnica' : 'Este produto ainda não tem ficha técnica'}>
          {preparo ? 'Sem ficha, o preparo não tem custo e os produtos que o usam ficam com custo indisponível.' : 'Sem ficha, o custo dele fica de fora do CMV teórico. Liste os ingredientes e a quantidade de cada um.'}
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
                  <div class="cartao indicador"><span class="indicador__rotulo">{preparo ? `Custo por ${alvo.unidade ? UNIDADE_CURTA[alvo.unidade] : 'unidade'}` : 'Custo da porção'}</span><span class="indicador__valor indicador__valor--m num">{f.insumos_sem_custo.length ? <span class="fraco">Indisponível</span> : moeda(f.custo_porcao)}</span></div>
                  {preparo ? (
                    <div class="cartao indicador"><span class="indicador__rotulo">Custo da receita</span><span class="indicador__valor indicador__valor--m num">{moeda(f.custo_receita)}</span></div>
                  ) : (
                    <div class="cartao indicador"><span class="indicador__rotulo">Margem hoje</span><span class="indicador__valor indicador__valor--m num">{salvou || f.insumos_sem_custo.length ? '—' : pct(alvo.margem)}</span>{salvou ? <span class="indicador__rodape">Atualiza na lista de fichas</span> : <span class="indicador__rodape">estimada, a preço de hoje</span>}</div>
                  )}
                  <div class="cartao indicador"><span class="indicador__rotulo">Rendimento</span><span class="indicador__valor indicador__valor--m num">{preparo && alvo.unidade ? quantidade(f.rendimento, alvo.unidade) : decimal(f.rendimento, 2)}</span><span class="indicador__rodape">{preparo ? 'por receita' : num(f.rendimento) === 1 ? 'porção' : 'porções por receita'}</span></div>
                </section>
                {f.insumos_sem_custo.length > 0 && (
                  <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
                    <strong>Custo indisponível:</strong> {f.insumos_sem_custo.map((id) => nomes.get(id) ?? 'insumo').join(', ')} ainda sem custo (nenhum recebimento com valor). Custo e margem ficam sem número até lá.
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
                        <span class="fraco">desde {dataCurta(v.vigente_de.slice(0, 10), { ano: true })}{v.vigente_ate ? ` até ${dataCurta(v.vigente_ate.slice(0, 10), { ano: true })}` : ''} · rend. {decimal(v.rendimento, 2)}{v.criada_por && responsavel ? ` · ${responsavel(v.criada_por)}` : ''}</span>
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

