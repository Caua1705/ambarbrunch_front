// Fichas técnicas: catálogo visual dos produtos vendidos na Eyemobile (GET /admin/estoque/fichas: só os que tiveram venda
// no período), dos mais vendidos para os menos — são a prioridade para cadastrar. Cada cartão: foto (só quando o produto
// está vinculado ao catálogo oficial pelo id estável; o vínculo ainda não existe no backend), nome, grupo, preço, vendidos
// em 30 dias, custo estimado e a situação da ficha. Ao abrir, a ficha: preço, custo dos ingredientes e margem de
// contribuição parcial (não é lucro), ingredientes e versões. Custo e margem vêm prontos do backend e só aparecem com todos
// os ingredientes com preço conhecido. Editar cria uma versão nova a partir de agora (as vendas passadas não mudam).
// Só gerência (estoque.editar; o backend confere: 403).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Search, Lock, Pencil, Plus, Trash2, Info, FileText, History, UtensilsCrossed, Link2Off } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { moeda, pct, quantidade, dataCurta, num, decimal, custoBase, plural } from '../../lib/formato';
import { Gaveta, useConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Situacao, Aviso, Segmentado, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio, Falha } from '../../ui/estados';
import { Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { Dec } from '../../lib/tipos/comum';
import type { FichaDetalhe, FichaLista, UnidadeBase } from '../../lib/tipos/estoque';
import { UNIDADE, UNIDADE_CURTA, atualizarEstoque, paraBase, quantidadeDigitada, unidadesDaBase } from './comum';
import { fotoDoCatalogo } from './fotos';

export type SituacaoFicha = 'sem' | 'incompleta' | 'completa';
export const situacaoFicha = (f: FichaLista): SituacaoFicha => (!f.ficha ? 'sem' : f.ficha.custo_incompleto ? 'incompleta' : 'completa');
/** "Completa" = todos os ingredientes listados têm preço conhecido. Se faltou listar um ingrediente, só quem conhece a
 *  receita sabe — a gaveta da ficha lembra disso. */
export const SITUACAO_FICHA: Record<SituacaoFicha, { rotulo: string; tom: 'ok' | 'atencao' | 'neutro' }> = {
  sem: { rotulo: 'Sem ficha', tom: 'atencao' },
  incompleta: { rotulo: 'Incompleta', tom: 'neutro' },
  completa: { rotulo: 'Completa', tom: 'ok' },
};
type Filtro = 'todas' | SituacaoFicha;
/** Mais vendidos primeiro (quantidade em 30 dias; empate pela receita). */
export const porVendas = (a: FichaLista, b: FichaLista) => num(b.quantidade_periodo)! - num(a.quantidade_periodo)! || num(b.receita_periodo)! - num(a.receita_periodo)!;

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
  /** Vínculo com o catálogo oficial: undefined = o backend ainda não informa; null = não vinculado. */
  catalogo?: string | null;
}

export const alvoDoProduto = (f: FichaLista): AlvoFicha => ({
  alvo: 'produto', id: f.eye_product_id, nome: f.produto, grupo: f.grupo, preco: f.preco_pdv,
  margem: f.ficha && !f.ficha.custo_incompleto ? f.ficha.margem_hoje_pct : null, semFicha: !f.ficha, catalogo: f.catalogo_item_id,
});

/** Lista de produtos com ficha (30 dias): a mesma consulta para o catálogo e para Custos e CMV. */
export const useFichas = (pode: boolean) => useConsulta(pode ? 'estoque/fichas?30' : null, () => estoque.fichas('todas', 30));

export function Fichas({ pode, filtroInicial, responsavel }: { pode: boolean; filtroInicial?: Filtro; responsavel: (r: string | null | undefined, nome?: string | null) => string | null }) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial ?? 'todas');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<AlvoFicha | null>(null);
  const lista = useFichas(pode);
  useEffect(() => void (filtroInicial && setFiltro(filtroInicial)), [filtroInicial]);

  const todos = useMemo(() => [...(lista.dados ?? [])].sort(porVendas), [lista.dados]);
  const posicao = useMemo(() => new Map(todos.map((f, k) => [f.eye_product_id, k + 1])), [todos]);
  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return todos.filter((f) => (filtro === 'todas' || situacaoFicha(f) === filtro) && (!t || f.produto.toLowerCase().includes(t) || (f.grupo ?? '').toLowerCase().includes(t)));
  }, [todos, filtro, busca]);

  if (!pode) return <Vazio icone={<Lock aria-hidden="true" />} titulo="Fichas técnicas são da gerência">Custos dos produtos ficam com a gerência.</Vazio>;
  const n = (s: SituacaoFicha) => todos.filter((f) => situacaoFicha(f) === s).length;
  const semFicha = n('sem');

  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo fichas-busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar produto" aria-label="Buscar produto" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        {todos.length > 0 && (
          <Segmentado<Filtro>
            rotulo="Situação da ficha"
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { valor: 'todas', rotulo: 'Todos' },
              { valor: 'sem', rotulo: <>Sem ficha{semFicha ? <span class="contador">{semFicha}</span> : null}</> },
              { valor: 'incompleta', rotulo: `Incompletas (${n('incompleta')})` },
              { valor: 'completa', rotulo: `Completas (${n('completa')})` },
            ]}
          />
        )}
      </div>
      {todos.length > 0 && <p class="fraco">Do mais vendido ao menos vendido nos últimos 30 dias{semFicha > 0 ? <>. Comece pelos primeiros: {plural(semFicha, 'produto ainda está', 'produtos ainda estão')} sem ficha técnica.</> : '.'}</p>}
      <Dados consulta={lista} recurso="Os produtos" esqueleto={<div class="produtos-grade">{[0, 1, 2, 3, 4, 5].map((k) => <span key={k} class="esqueleto" style={{ height: '232px' }} />)}</div>}>
        {() =>
          linhas.length ? (
            <ul class="produtos-grade" aria-label="Produtos da Eyemobile">
              {linhas.map((f) => <li key={f.eye_product_id}><CartaoProduto f={f} posicao={posicao.get(f.eye_product_id)!} aoAbrir={() => setAberta(alvoDoProduto(f))} /></li>)}
            </ul>
          ) : todos.length ? (
            <Vazio compacto titulo={busca ? 'Nenhum produto com essa busca' : 'Nenhum produto nesta situação'}>{filtro === 'sem' ? 'Todos os produtos vendidos têm ficha.' : undefined}</Vazio>
          ) : (
            <Vazio icone={<UtensilsCrossed aria-hidden="true" />} titulo="Nenhum produto vendido nos últimos 30 dias">Os produtos aparecem aqui quando as vendas chegam da Eyemobile. Aí é só abrir cada um e cadastrar os ingredientes.</Vazio>
          )
        }
      </Dados>
      <GavetaFicha alvo={aberta} aoFechar={() => setAberta(null)} responsavel={responsavel} />
    </>
  );
}

function CartaoProduto({ f, posicao, aoAbrir }: { f: FichaLista; posicao: number; aoAbrir: () => void }) {
  const s = situacaoFicha(f);
  const foto = fotoDoCatalogo(f.catalogo_item_id);
  return (
    <button type="button" class="produto-cartao" data-situacao={s} onClick={aoAbrir} aria-label={`${f.produto}: ${SITUACAO_FICHA[s].rotulo}`}>
      <span class={foto ? 'produto-cartao__foto' : 'produto-cartao__foto produto-cartao__foto--vazia'}>
        {foto ? (
          <img src={foto.src} alt="" loading="lazy" decoding="async" width={320} height={320} />
        ) : (
          <span class="produto-cartao__sem-foto">
            <UtensilsCrossed aria-hidden="true" />
            <span>{f.catalogo_item_id === undefined || f.catalogo_item_id === null ? 'Não vinculado' : 'Sem foto'}</span>
          </span>
        )}
        {posicao <= 10 && <span class="produto-cartao__posicao" title="Posição em vendas nos últimos 30 dias">{posicao}º</span>}
      </span>
      <span class="produto-cartao__corpo">
        <span class="produto-cartao__nome">{f.produto}</span>
        <span class="produto-cartao__grupo"><span>{f.grupo ?? 'Sem grupo'}</span> · <span class="num">{decimal(f.quantidade_periodo, 0)}</span> vendidos</span>
        <span class="produto-cartao__numeros">
          <span><span class="produto-cartao__rotulo">Preço</span><strong class="num">{moeda(f.preco_pdv)}</strong></span>
          <span><span class="produto-cartao__rotulo">Custo</span><strong class={`num${s === 'completa' ? '' : ' fraco'}`}>{s === 'completa' ? moeda(f.ficha!.custo_porcao_hoje) : '—'}</strong></span>
        </span>
        <Situacao tom={SITUACAO_FICHA[s].tom} destaque={s === 'sem'}>{SITUACAO_FICHA[s].rotulo}</Situacao>
      </span>
    </button>
  );
}

/** Ficha de um produto do PDV ou de um preparo: preço, custo, margem parcial, ingredientes, versões e o editor. */
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
      subtitulo={alvo ? (preparo ? `Preparo da casa${alvo.unidade ? ` · em ${UNIDADE[alvo.unidade]}` : ''}` : `Produto da Eyemobile · ${alvo.grupo ?? 'sem grupo'}`) : undefined}
      largura="media"
      rodape={!editando && alvo && (semFicha || f) ? <Botao variante="primario" icone={f ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />} onClick={() => setEditando(true)}>{f ? 'Editar ficha' : 'Cadastrar ficha'}</Botao> : undefined}
    >
      {!alvo ? null : editando ? (
        <EditorFicha alvo={alvo} atual={f} aoTerminar={(ok) => { setEditando(false); if (ok) { setSalvou(true); consulta.recarregar(); } }} />
      ) : semFicha ? (
        <div class="pilha">
          {!preparo && <Vinculo alvo={alvo} />}
          <Vazio icone={<FileText aria-hidden="true" />} titulo={preparo ? 'Este preparo ainda não tem ficha técnica' : 'Este produto ainda não tem ficha técnica'}>
            {preparo ? 'Sem ficha, o preparo não tem custo e os produtos que o usam ficam incompletos.' : `Liste os ingredientes do estoque e a quantidade de cada um. Preço de venda: ${moeda(alvo.preco)}.`}
          </Vazio>
        </div>
      ) : consulta.erro && !consulta.dados ? (
        <Falha erro={consulta.erro} aoTentar={consulta.recarregar} recurso="A ficha" />
      ) : (
        <Dados consulta={consulta} recurso="A ficha" esqueleto={<Esqueleto linhas={8} />}>
          {(f: FichaDetalhe) => {
            const nomes = new Map(f.itens.map((i) => [i.insumo_id, i.insumo]));
            const custoOk = !f.insumos_sem_custo.length && f.custo_porcao !== null;
            const preco = num(alvo.preco);
            const contribuicao = custoOk && preco !== null && !salvou ? preco - Number(f.custo_porcao) : null;
            return (
              <>
                {!preparo && <Vinculo alvo={alvo} />}
                <section class="ficha-numeros" aria-label="Custo e margem">
                  {preparo ? (
                    <>
                      <div><span class="ficha-numeros__rotulo">Custo por {alvo.unidade ? UNIDADE_CURTA[alvo.unidade] : 'unidade'}</span><strong class="num">{custoOk ? moeda(f.custo_porcao) : <span class="fraco">Indisponível</span>}</strong></div>
                      <div><span class="ficha-numeros__rotulo">Custo da receita</span><strong class="num">{custoOk ? moeda(f.custo_receita) : <span class="fraco">Indisponível</span>}</strong></div>
                    </>
                  ) : (
                    <>
                      <div><span class="ficha-numeros__rotulo">Preço de venda</span><strong class="num">{moeda(alvo.preco)}</strong></div>
                      <div><span class="ficha-numeros__rotulo">Custo dos ingredientes</span><strong class="num">{custoOk ? moeda(f.custo_porcao) : <span class="fraco">Indisponível</span>}</strong></div>
                      <div>
                        <span class="ficha-numeros__rotulo">Margem de contribuição parcial</span>
                        <strong class="num">{contribuicao !== null ? <>{moeda(contribuicao)} <span class="fraco">({pct(alvo.margem)})</span></> : <span class="fraco">—</span>}</strong>
                      </div>
                    </>
                  )}
                  <div><span class="ficha-numeros__rotulo">Rendimento</span><strong class="num">{preparo && alvo.unidade ? quantidade(f.rendimento, alvo.unidade) : `${decimal(f.rendimento, 2)} ${num(f.rendimento) === 1 ? 'porção' : 'porções'}`}</strong></div>
                </section>
                {!preparo && contribuicao !== null && <p class="fraco" data-teste="aviso-margem">Preço de venda − custo dos ingredientes. Não é lucro líquido: não inclui mão de obra, embalagens, taxas nem despesas fixas.</p>}
                {!preparo && salvou && <p class="fraco">Margem atualizada na lista de produtos.</p>}
                {f.insumos_sem_custo.length > 0 && (
                  <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
                    <strong>Custo indisponível:</strong> {f.insumos_sem_custo.map((id) => nomes.get(id) ?? 'insumo').join(', ')} ainda sem preço (nenhuma compra conferida com valor). Custo e margem ficam sem número até lá.
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
                          <td class="num">{i.custo === null ? <span class="fraco">sem preço</span> : moeda(i.custo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p class="fraco" data-teste="aviso-ingredientes">O custo considera só os ingredientes listados: confira se a receita está completa.{f.observacao ? ` · ${f.observacao}` : ''}</p>
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

/** Vínculo do produto da Eyemobile com o catálogo oficial. Nunca deduzido por nome ou preço: só o id que o backend
 *  guardar. Enquanto o backend não guarda vínculo nenhum (08/11/2026), o produto aparece "Não vinculado" e não há
 *  seleção manual — salvar um vínculo que o backend descarta seria fingir. */
function Vinculo({ alvo }: { alvo: AlvoFicha }) {
  const foto = fotoDoCatalogo(alvo.catalogo);
  if (foto) return <img class="ficha-foto" src={foto.src} alt={foto.alt} width={320} height={320} />;
  return (
    <p class="ficha-vinculo">
      <Etiqueta icone={<Link2Off aria-hidden="true" />}>Não vinculado</Etiqueta>
      <span class="fraco">{alvo.catalogo === undefined ? 'O vínculo com o cardápio do site ainda não pode ser feito pelo painel; a foto aparece quando existir.' : 'Sem produto do cardápio ligado a este item da Eyemobile.'}</span>
    </p>
  );
}

interface LinhaFicha {
  insumo: OpcaoAuto | null;
  unidade: UnidadeBase | null;
  /** Unidade em que a quantidade foi digitada: 1000 = kg/L, 1 = g/ml/un. */
  fator: 1 | 1000;
  quantidade: string;
  perda: string;
  opcional: boolean;
}
const linhaNova = (): LinhaFicha => ({ insumo: null, unidade: null, fator: 1, quantidade: '', perda: '', opcional: false });
const decimalDigitado = (t: string) => quantidadeDigitada(t) ?? String(Number(t.replace(',', '.')));

function EditorFicha({ alvo, atual, aoTerminar }: { alvo: AlvoFicha; atual: FichaDetalhe | null; aoTerminar: (salvou: boolean) => void }) {
  const [linhas, setLinhas] = useState<LinhaFicha[]>(() =>
    atual?.itens.length
      ? atual.itens.map((i) => ({ insumo: { valor: i.insumo_id, rotulo: i.insumo }, unidade: i.unidade_base, fator: 1, quantidade: String(Number(i.quantidade)).replace('.', ','), perda: Number(i.perda_percentual) ? String(Number(i.perda_percentual)).replace('.', ',') : '', opcional: i.opcional }))
      : [linhaNova()],
  );
  const [rendimento, setRendimento] = useState(atual ? String(Number(atual.rendimento)).replace('.', ',') : '1');
  const [obs, setObs] = useState(atual?.observacao ?? '');
  const [erro, setErro] = useState<string | null>(null);
  // O que a busca trouxe de cada insumo: unidade e preço médio (só para mostrar; o custo oficial é o do backend).
  const [conhecidos] = useState(() => new Map<string, { unidade: UnidadeBase; custo: Dec | null }>(atual?.itens.map((i) => [i.insumo_id, { unidade: i.unidade_base, custo: i.custo_unitario }]) ?? []));
  const { confirmar, elemento } = useConfirmacao();
  const set = (k: number, m: Partial<LinhaFicha>) => setLinhas(linhas.map((l, i) => (i === k ? { ...l, ...m } : l)));
  const buscar = async (t: string): Promise<OpcaoAuto[]> =>
    (await estoque.insumos({ busca: t.trim() || undefined, limite: 20 })).itens
      // Um preparo não entra na própria ficha (o backend recusa ciclo).
      .filter((i) => i.ativo && !(alvo.alvo === 'preparo' && i.id === alvo.id))
      .map((i) => {
        conhecidos.set(i.id, { unidade: i.unidade_base, custo: i.custo_medio });
        return { valor: i.id, rotulo: i.nome, detalhe: `${i.tipo === 'preparo' ? 'preparo · ' : ''}${i.custo_medio !== null ? custoBase(i.custo_medio, i.unidade_base) : 'sem preço'}` };
      });

  function salvar(e: Event) {
    e.preventDefault();
    const usadas = linhas.filter((l) => l.insumo || l.quantidade);
    if (!usadas.length) return setErro('Adicione pelo menos um ingrediente.');
    const itens: { insumo_id: string; quantidade: string; perda_percentual: string; opcional: boolean }[] = [];
    for (const l of usadas) {
      if (!l.insumo) return setErro('Escolha o ingrediente de cada linha (só insumos cadastrados no estoque).');
      const q = paraBase(l.quantidade, l.fator);
      if (!q || !(Number(q) > 0)) return setErro(`${l.insumo.rotulo}: informe a quantidade.`);
      const p = Number(decimalDigitado(l.perda || '0'));
      if (!(p >= 0 && p < 100)) return setErro(`${l.insumo.rotulo}: a perda vai de 0 a 99%.`);
      itens.push({ insumo_id: l.insumo.valor, quantidade: q, perda_percentual: decimalDigitado(l.perda || '0'), opcional: l.opcional });
    }
    if (new Set(itens.map((l) => l.insumo_id)).size !== itens.length) return setErro('Cada ingrediente entra uma vez só: some as quantidades na mesma linha.');
    if (!(Number(decimalDigitado(rendimento)) > 0)) return setErro('O rendimento precisa ser maior que zero.');
    setErro(null);
    const semPreco = usadas.filter((l) => l.insumo && !l.opcional && conhecidos.get(l.insumo.valor)?.custo === null).map((l) => l.insumo!.rotulo);
    confirmar({
      titulo: atual ? `Salvar a versão ${atual.versao + 1} da ficha?` : 'Cadastrar a ficha técnica?',
      texto: `${plural(itens.length, 'ingrediente', 'ingredientes')}. A ficha passa a valer agora para custo e margem; vendas que já aconteceram não mudam.${semPreco.length ? ` Sem preço ainda: ${semPreco.join(', ')} — o custo fica incompleto até a primeira compra.` : ''}`,
      confirmar: 'Salvar ficha',
      acao: async () => {
        try {
          await estoque.salvarFicha(alvo.alvo, alvo.id, { rendimento: decimalDigitado(rendimento), itens, observacao: obs.trim() || undefined });
        } finally {
          atualizarEstoque();
        }
        aoTerminar(true);
      },
      sucesso: 'Ficha técnica salva.',
    });
  }

  return (
    <form class="pilha" onSubmit={salvar} noValidate>
      <h3 class="secao-titulo">{atual ? `Editar ficha (nova versão ${atual.versao + 1})` : 'Nova ficha técnica'}</h3>
      <p class="suave">Ingredientes do estoque e quanto vai em {alvo.alvo === 'preparo' ? 'uma receita' : 'uma porção (ou na receita inteira, com o rendimento)'}. Perda é o que se joga fora no preparo (casca, aparas). Opcional não entra no custo.</p>
      <div class="linhas-edicao">
        {linhas.map((l, k) => {
          const conhecido = l.insumo ? conhecidos.get(l.insumo.valor) : undefined;
          const unidades = l.unidade ? unidadesDaBase(l.unidade) : [];
          return (
            <div class="linha-edicao linha-edicao--ficha" key={k}>
              <div class="campo">
                <span class="campo__rotulo">Ingrediente {k + 1}</span>
                <Autocompletar
                  rotulo={`Ingrediente ${k + 1}`}
                  placeholder="Buscar no estoque"
                  valor={l.insumo}
                  buscar={buscar}
                  aoEscolher={(o) => { const u = o ? conhecidos.get(o.valor)?.unidade ?? null : null; set(k, { insumo: o, unidade: u, fator: 1 }); }}
                />
                {l.insumo && conhecido && <span class="campo__ajuda">{conhecido.custo !== null ? `Preço médio ${custoBase(conhecido.custo, conhecido.unidade)}` : 'Sem preço ainda: o custo fica incompleto'}</span>}
              </div>
              <Campo rotulo="Quantidade">{(id) => <input id={id} class="entrada num" inputMode="decimal" value={l.quantidade} onInput={(e) => set(k, { quantidade: e.currentTarget.value })} />}</Campo>
              {unidades.length > 1 ? (
                <Campo rotulo="Unid.">
                  {(id) => (
                    <select id={id} class="selecao" value={String(l.fator)} onChange={(e) => set(k, { fator: Number(e.currentTarget.value) as 1 | 1000 })}>
                      {unidades.map((u) => <option key={u.valor} value={String(u.fator)}>{u.valor}</option>)}
                    </select>
                  )}
                </Campo>
              ) : (
                <Campo rotulo="Unid.">{(id) => <output id={id} class="entrada fraco" style={{ display: 'flex', alignItems: 'center' }}>{l.unidade ? UNIDADE_CURTA[l.unidade] : '—'}</output>}</Campo>
              )}
              <Campo rotulo="Perda %">{(id) => <input id={id} class="entrada num" inputMode="decimal" placeholder="0" value={l.perda} onInput={(e) => set(k, { perda: e.currentTarget.value })} />}</Campo>
              <label class="marcar ficha-opcional"><input type="checkbox" checked={l.opcional} onChange={(e) => set(k, { opcional: e.currentTarget.checked })} /> Opcional</label>
              <Botao so_icone variante="fantasma" aria-label={`Remover o ingrediente ${k + 1}`} icone={<Trash2 aria-hidden="true" />} disabled={linhas.length === 1} onClick={() => setLinhas(linhas.filter((_, i) => i !== k))} />
            </div>
          );
        })}
        <Botao tamanho="p" icone={<Plus aria-hidden="true" />} style={{ alignSelf: 'flex-start' }} onClick={() => setLinhas([...linhas, linhaNova()])}>Adicionar ingrediente</Botao>
      </div>
      <div class="grade-campos">
        <Campo
          rotulo={alvo.alvo === 'preparo' ? `Rendimento (${alvo.unidade ? UNIDADE_CURTA[alvo.unidade] : 'unidade do preparo'})` : 'Rendimento (porções)'}
          ajuda={alvo.alvo === 'preparo' ? 'Quanto a receita inteira rende, na unidade do preparo.' : 'Quantas porções a receita rende. Feito na hora, uma porção: 1.'}
        >
          {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={rendimento} onInput={(e) => setRendimento(e.currentTarget.value)} />}
        </Campo>
        <Campo rotulo="Observação" opcional>{(id) => <input id={id} class="entrada" maxLength={300} value={obs} onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
      </div>
      <p class="fraco">O custo é calculado pelo sistema ao salvar, com os preços conhecidos dos insumos. Ingrediente sem preço não ganha custo inventado.</p>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={() => aoTerminar(false)}>Voltar</Botao>
        <Botao type="submit" variante="primario">Revisar e salvar</Botao>
      </div>
      {elemento}
    </form>
  );
}
