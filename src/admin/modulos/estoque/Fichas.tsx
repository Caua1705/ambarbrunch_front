// Fichas técnicas: o que cada produto vendido leva, quanto custa a porção hoje e a margem ao preço do PDV.
// Editar cria uma versão nova (as vendas passadas não mudam). Só gerência (o backend confere: 403).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Search, Lock, Pencil, Plus, Trash2, Info, FileText, History } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, pct, quantidade, dataCurta, num, decimal } from '../../lib/formato';
import { Gaveta, useConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Cartao, Segmentado, Situacao, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { FichaDetalhe, FichaLista, UnidadeBase } from '../../lib/tipos/estoque';
import { UNIDADE_CURTA, atualizarEstoque } from './comum';

type Filtro = 'todas' | 'sem' | 'incompletas' | 'completas';
const situacao = (f: FichaLista) => (!f.ficha ? 'sem' : f.ficha.custo_incompleto ? 'incompleta' : 'completa');

export function Fichas({ pode }: { pode: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<FichaLista | null>(null);
  const lista = useConsulta(pode ? 'estoque/fichas' : null, () => estoque.fichas('todas'));

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
    { id: 'vendas', titulo: 'Vendas (30 dias)', numero: true, prioridade: 'baixa', ordenar: (f) => num(f.receita_periodo), celula: (f) => <span class="num">{decimal(f.quantidade_periodo, 0)} <span class="sub">{moeda(f.receita_periodo)}</span></span> },
    { id: 'custo', titulo: 'Custo da porção', numero: true, ordenar: (f) => num(f.ficha?.custo_porcao_hoje), celula: (f) => <span class="num">{moeda(f.ficha?.custo_porcao_hoje)}</span> },
    { id: 'margem', titulo: 'Margem hoje', numero: true, prioridade: 'media', ordenar: (f) => num(f.ficha?.margem_hoje_pct), celula: (f) => <span class="num">{pct(f.ficha?.margem_hoje_pct)}</span> },
    { id: 'situacao', titulo: 'Ficha', ordenar: situacao, celula: (f) => { const s = situacao(f); return <Situacao tom={s === 'sem' ? 'atencao' : s === 'incompleta' ? 'atencao' : 'ok'} destaque={s === 'sem'}>{s === 'sem' ? 'Sem ficha' : s === 'incompleta' ? 'Custo incompleto' : `Completa · v${f.ficha!.versao}`}</Situacao>; } },
  ];

  return (
    <>
      <p class="suave">Produtos que apareceram nas vendas. A margem usa o custo médio de hoje e o último preço do PDV — é estimada, não é lucro.</p>
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
        </div>
        <Dados consulta={lista} recurso="As fichas técnicas" esqueleto={<EsqueletoTabela />}>
          {() => <Tabela rotulo="Fichas técnicas" colunas={colunas} linhas={linhas} chave={(f) => f.eye_product_id} aoAbrir={setAberta} destaque={(f) => !f.ficha} vazio={<Vazio compacto titulo="Nenhum produto nesta lista" />} />}
        </Dados>
      </Cartao>
      <GavetaFicha produto={aberta} aoFechar={() => setAberta(null)} />
    </>
  );
}

function GavetaFicha({ produto, aoFechar }: { produto: FichaLista | null; aoFechar: () => void }) {
  const id = produto?.eye_product_id ?? null;
  const consulta = useConsulta(id && produto?.ficha ? `estoque/fichas/produto/${id}` : null, () => estoque.ficha('produto', id!));
  const [editando, setEditando] = useState(false);
  useEffect(() => setEditando(false), [id]);
  const f = consulta.dados;
  const preco = num(produto?.preco_pdv);
  return (
    <Gaveta
      aberta={!!produto}
      aoFechar={aoFechar}
      titulo={produto?.produto ?? 'Ficha técnica'}
      subtitulo={produto ? `${produto.grupo ?? 'Sem grupo'} · ${moeda(produto.preco_pdv)} no PDV` : undefined}
      largura="media"
      rodape={!editando && produto ? <Botao variante="primario" icone={produto.ficha ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />} onClick={() => setEditando(true)}>{produto.ficha ? 'Editar ficha' : 'Criar ficha'}</Botao> : undefined}
    >
      {!produto ? null : editando ? (
        <EditorFicha produto={produto} atual={f ?? null} aoTerminar={() => { setEditando(false); consulta.recarregar(); }} />
      ) : !produto.ficha ? (
        <Vazio icone={<FileText aria-hidden="true" />} titulo="Este produto ainda não tem ficha técnica">Sem ficha, o custo e a margem dele ficam de fora do CMV teórico e do Cardápio Inteligente.</Vazio>
      ) : (
        <Dados consulta={consulta} recurso="A ficha" esqueleto={<Esqueleto linhas={8} />}>
          {(f: FichaDetalhe) => (
            <>
              <section class="indicadores indicadores--3" style={{ gap: '10px' }}>
                <div class="cartao indicador"><span class="indicador__rotulo">Custo da porção</span><span class="indicador__valor indicador__valor--m num">{moeda(f.custo_porcao)}</span></div>
                <div class="cartao indicador"><span class="indicador__rotulo">Margem hoje</span><span class="indicador__valor indicador__valor--m num">{preco && num(f.custo_porcao) !== null ? pct(((preco - num(f.custo_porcao)!) / preco) * 100) : '—'}</span></div>
                <div class="cartao indicador"><span class="indicador__rotulo">Rendimento</span><span class="indicador__valor indicador__valor--m num">{decimal(f.rendimento, 2)}</span><span class="indicador__rodape">{num(f.rendimento) === 1 ? 'porção' : 'porções por receita'}</span></div>
              </section>
              {f.insumos_sem_custo.length > 0 && (
                <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
                  <strong>Custo incompleto:</strong> {f.insumos_sem_custo.join(', ')} ainda sem custo (nenhuma compra registrada). Margem e custo ficam sem número até lá.
                </Aviso>
              )}
              <div class="tabela-rolagem" style={{ border: '1px solid var(--borda)', borderRadius: '12px' }}>
                <table class="tabela" aria-label="Ingredientes">
                  <thead><tr><th>Ingrediente</th><th class="num">Quantidade</th><th class="num" data-prioridade="baixa">Perda</th><th class="num">Custo</th></tr></thead>
                  <tbody>
                    {f.itens.map((i) => (
                      <tr key={i.insumo_id}>
                        <td>{i.insumo}{i.opcional && <span class="sub">opcional</span>}</td>
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
                      <span class="fraco">desde {dataCurta(v.vigente_de.slice(0, 10), { ano: true })}{v.criada_por ? ` · ${v.criada_por}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
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
}

function EditorFicha({ produto, atual, aoTerminar }: { produto: FichaLista; atual: FichaDetalhe | null; aoTerminar: () => void }) {
  const [linhas, setLinhas] = useState<LinhaFicha[]>(() =>
    atual ? atual.itens.map((i) => ({ insumo: { valor: i.insumo_id, rotulo: i.insumo }, unidade: i.unidade_base, quantidade: String(Number(i.quantidade)), perda: Number(i.perda_percentual) ? String(Number(i.perda_percentual)) : '' })) : [{ insumo: null, unidade: null, quantidade: '', perda: '' }],
  );
  const [rendimento, setRendimento] = useState(atual ? String(Number(atual.rendimento)) : '1');
  const [obs, setObs] = useState(atual?.observacao ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const { confirmar, elemento } = useConfirmacao();
  const set = (k: number, m: Partial<LinhaFicha>) => setLinhas(linhas.map((l, i) => (i === k ? { ...l, ...m } : l)));
  const buscar = async (t: string): Promise<OpcaoAuto[]> => (await estoque.insumos({ busca: t || undefined, limite: 20 })).itens.map((i) => ({ valor: i.id, rotulo: i.nome, detalhe: `em ${UNIDADE_CURTA[i.unidade_base]}` }));

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
    if (!(Number(rendimento.replace(',', '.')) > 0)) return setErro('O rendimento precisa ser maior que zero.');
    setErro(null);
    confirmar({
      titulo: atual ? `Salvar a versão ${atual.versao + 1} da ficha?` : 'Criar a ficha técnica?',
      texto: 'A ficha nova passa a valer agora para custo e margem. Vendas que já aconteceram não mudam.',
      confirmar: 'Salvar ficha',
      acao: async () => {
        try {
          await estoque.salvarFicha('produto', produto.eye_product_id, {
            rendimento: String(Number(rendimento.replace(',', '.'))),
            itens: usadas.map((l) => ({ insumo_id: l.insumo!.valor, quantidade: String(Number(l.quantidade.replace(',', '.'))), perda_percentual: String(Number((l.perda || '0').replace(',', '.'))) })),
            observacao: obs.trim() || undefined,
          });
        } catch (x) {
          throw x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível salvar.');
        } finally {
          atualizarEstoque();
        }
        aoTerminar();
      },
      sucesso: 'Ficha técnica salva.',
    });
  }

  return (
    <form class="pilha" onSubmit={salvar} noValidate>
      <h3 class="secao-titulo">{atual ? `Editar ficha (nova versão ${atual.versao + 1})` : 'Nova ficha técnica'}</h3>
      <p class="suave">Quantidades na unidade-base de cada insumo (g, ml ou un). A perda é o que se joga fora no preparo (casca, aparas).</p>
      <div class="linhas-edicao">
        {linhas.map((l, k) => (
          <div class="linha-edicao linha-edicao--ficha" key={k}>
            <div class="campo">
              <span class="campo__rotulo">Ingrediente {k + 1}</span>
              <Autocompletar rotulo={`Ingrediente ${k + 1}`} placeholder="Buscar insumo" valor={l.insumo} buscar={buscar} aoEscolher={(o) => set(k, { insumo: o, unidade: o?.detalhe?.includes('ml') ? 'ml' : o?.detalhe?.includes('un') ? 'un' : o ? 'g' : null })} />
            </div>
            <Campo rotulo={`Quantidade${l.unidade ? ` (${l.unidade})` : ''}`}>{(id) => <input id={id} class="entrada num" inputMode="decimal" value={l.quantidade} onInput={(e) => set(k, { quantidade: e.currentTarget.value })} />}</Campo>
            <Campo rotulo="Perda %">{(id) => <input id={id} class="entrada num" inputMode="decimal" placeholder="0" value={l.perda} onInput={(e) => set(k, { perda: e.currentTarget.value })} />}</Campo>
            <Botao so_icone variante="fantasma" aria-label={`Remover o ingrediente ${k + 1}`} icone={<Trash2 aria-hidden="true" />} disabled={linhas.length === 1} onClick={() => setLinhas(linhas.filter((_, i) => i !== k))} />
          </div>
        ))}
        <Botao tamanho="p" icone={<Plus aria-hidden="true" />} style={{ alignSelf: 'flex-start' }} onClick={() => setLinhas([...linhas, { insumo: null, unidade: null, quantidade: '', perda: '' }])}>Adicionar ingrediente</Botao>
      </div>
      <div class="grade-campos">
        <Campo rotulo="Rendimento (porções)" ajuda="Quantas porções a receita rende. Uma bebida feita na hora rende 1.">{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={rendimento} onInput={(e) => setRendimento(e.currentTarget.value)} />}</Campo>
        <Campo rotulo="Observação" opcional>{(id) => <input id={id} class="entrada" value={obs} onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
      </div>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar}>Voltar</Botao>
        <Botao type="submit" variante="primario">Revisar e salvar</Botao>
      </div>
      {elemento}
    </form>
  );
}
