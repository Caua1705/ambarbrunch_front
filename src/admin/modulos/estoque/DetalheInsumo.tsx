// Gaveta do insumo: quantidade, mínimo, ideal (quando o backend guardar), preço médio, última compra e última conferência,
// o histórico do livro (com o nome de quem registrou, nunca o id) e as ações — Conferir quantidade, Perda ou uso interno,
// Corrigir saldo, Editar. Cadastro (novo, editar) também mora aqui. Nada é calculado: tudo vem do backend; o painel só
// converte kg/L para a unidade-base.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Pencil, Info, ChefHat, Scale, ArrowUpFromLine, ClipboardCheck } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { custoBase, relativo, dataHora, plural } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { Insumo, InsumoDetalhe, MovimentoEstoque } from '../../lib/tipos/estoque';
import {
  UNIDADE, rotuloMovimento, ehUsoInterno, atualizarEstoque, situacaoEstoque, SituacaoEstoque, unidadeExibicao, numeroEm, paraBase, textoMotivo,
  UNIDADES_CADASTRO, unidadeCadastro, unidadesDaBase, aceitaEstoqueIdeal, type UnidadeCadastro, type PermissoesEstoque,
} from './comum';
import type { TipoMovimentoManual } from './Movimento';

const CONTROLE = { explodir: 'Sai a cada venda', lote: 'Produção em lote' } as const;

export function DetalheInsumo({ id, perm, inicioControle, responsavel, aoFechar, aoMovimento, aoFicha }: {
  id: string | null;
  perm: PermissoesEstoque;
  inicioControle: string | null;
  responsavel: (r: string | null | undefined, nome?: string | null) => string | null;
  aoFechar: () => void;
  aoMovimento: (tipo: TipoMovimentoManual, insumo: Insumo) => void;
  aoFicha: (i: InsumoDetalhe) => void;
}) {
  const consulta = useConsulta(id ? `estoque/insumos/${id}` : null, () => estoque.insumo(id!));
  // A linha da lista (mesmo cache da tela principal) traz a última compra e a última conferência.
  const catalogo = useConsulta(id ? 'estoque/insumos?catalogo' : null, () => estoque.insumos({ limite: 200 }));
  const linha = catalogo.dados?.itens.find((x) => x.id === id) ?? null;
  const [editando, setEditando] = useState(false);
  const [movs, setMovs] = useState<{ itens: MovimentoEstoque[]; proximo: number | null; carregando: boolean } | null>(null);
  const [versao, setVersao] = useState(0);
  const i = consulta.dados;

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    setEditando(false);
    setMovs({ itens: [], proximo: null, carregando: true });
    estoque.movimentos(id).then((r) => vivo && setMovs({ itens: r.itens, proximo: r.proximo, carregando: false })).catch(() => vivo && setMovs({ itens: [], proximo: null, carregando: false }));
    return () => void (vivo = false);
  }, [id, versao]);
  // Um movimento registrado em outra gaveta (invalidar('estoque')) recarrega o detalhe; se o saldo mudou, o histórico
  // vem junto (só depois da primeira carga, para não buscar duas vezes ao abrir).
  const saldoVisto = useRef<{ id: string | null; saldo: string | undefined }>({ id: null, saldo: undefined });
  useEffect(() => {
    const visto = saldoVisto.current;
    if (visto.id === id && visto.saldo !== undefined && i?.saldo !== undefined && visto.saldo !== i.saldo) setVersao((v) => v + 1);
    saldoVisto.current = { id, saldo: i?.saldo };
  }, [id, i?.saldo]);
  const mais = async () => {
    if (!movs?.proximo || !id) return;
    setMovs({ ...movs, carregando: true });
    try {
      const r = await estoque.movimentos(id, movs.proximo);
      setMovs({ itens: [...movs.itens, ...r.itens], proximo: r.proximo, carregando: false });
    } catch {
      setMovs({ ...movs, carregando: false });
    }
  };

  // Para as ações, a linha da lista (com saldo e contagem); sem ela, o detalhe basta.
  const alvo: Insumo | null = linha ?? (i ? { ...i, ultimo_custo_compra: null, ultima_compra_em: null, ultima_contagem_em: null, cobertura_dias: null, abaixo_minimo: false } : null);
  const rodape = i && !editando && alvo ? (
    <div class="estoque-acoes-insumo">
      {perm.visualizar && <Botao variante="primario" icone={<ClipboardCheck aria-hidden="true" />} onClick={() => aoMovimento('conferir', alvo)}>Conferir quantidade</Botao>}
      {perm.visualizar && <Botao icone={<ArrowUpFromLine aria-hidden="true" />} onClick={() => aoMovimento('saida', alvo)}>Perda ou uso interno</Botao>}
      {perm.visualizar && <Botao icone={<Scale aria-hidden="true" />} onClick={() => aoMovimento('corrigir', alvo)}>Corrigir saldo</Botao>}
      {perm.editar && i.tipo === 'preparo' && <Botao icone={<ChefHat aria-hidden="true" />} onClick={() => aoFicha(i)}>Ficha do preparo</Botao>}
      {perm.editar && <Botao variante="fantasma" icone={<Pencil aria-hidden="true" />} onClick={() => setEditando(true)}>Editar</Botao>}
    </div>
  ) : undefined;

  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      titulo={i?.nome ?? 'Insumo'}
      subtitulo={i ? [i.categoria, i.tipo === 'preparo' ? 'preparo da casa' : null, `medido em ${UNIDADE[i.unidade_base]}`, i.ativo ? null : 'inativo'].filter(Boolean).join(' · ') : undefined}
      largura="media"
      rodape={rodape}
    >
      <Dados consulta={consulta} recurso="O insumo" esqueleto={<Esqueleto linhas={8} />}>
        {(i: InsumoDetalhe) =>
          editando ? (
            <EditarInsumo i={i} aoTerminar={() => { setEditando(false); consulta.recarregar(); }} />
          ) : (
            <Resumo i={i} linha={linha} inicioControle={inicioControle} movs={movs} responsavel={responsavel} aoMais={mais} />
          )
        }
      </Dados>
    </Gaveta>
  );
}

function Resumo({ i, linha, inicioControle, movs, responsavel, aoMais }: {
  i: InsumoDetalhe;
  linha: Insumo | null;
  inicioControle: string | null;
  movs: { itens: MovimentoEstoque[]; proximo: number | null; carregando: boolean } | null;
  responsavel: (r: string | null | undefined, nome?: string | null) => string | null;
  aoMais: () => void;
}) {
  const s = situacaoEstoque({ saldo: i.saldo, abaixo_minimo: linha?.abaixo_minimo ?? false, ultima_contagem_em: linha?.ultima_contagem_em ?? null, motivo_nao_confiavel: i.motivo_nao_confiavel }, inicioControle);
  const u = unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo, i.estoque_ideal);
  const semNumero = s === 'nao_conferido' && (i.motivo_nao_confiavel === 'sem_movimento' || Number(i.saldo) === 0);
  const ultimaEntrada = linha?.ultima_compra_em ?? i.precos[0]?.ocorreu_em ?? null;

  return (
    <>
      <div class="insumo-saldo">
        <div>
          <span class="insumo-saldo__rotulo">Quantidade estimada</span>
          <span class={`insumo-saldo__valor num${s === 'nao_conferido' ? ' fraco' : ''}`}>{semNumero ? '—' : `${numeroEm(i.saldo, u.fator)} ${u.rotulo}`}</span>
        </div>
        <SituacaoEstoque codigo={s} />
      </div>
      {s === 'nao_conferido' && (
        <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
          <strong>Ainda não conferido.</strong> {semNumero ? 'O sistema não sabe quanto há.' : 'O número acima soma só as compras registradas, sem o que já havia.'} “Conferir quantidade” registra o ponto de partida.
        </Aviso>
      )}
      {i.motivo_nao_confiavel === 'ficou_negativo' && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}><strong>O saldo ficou negativo.</strong> Alguma compra não foi registrada: confira a quantidade.</Aviso>}
      <dl class="definicoes">
        <dt>Estoque mínimo</dt>
        <dd class="num">{i.estoque_minimo === null ? <span class="fraco">Não definido</span> : `${numeroEm(i.estoque_minimo, u.fator)} ${u.rotulo}`}</dd>
        {aceitaEstoqueIdeal(i) && <><dt>Estoque ideal</dt><dd class="num">{i.estoque_ideal == null ? <span class="fraco">Não definido</span> : `${numeroEm(i.estoque_ideal, u.fator)} ${u.rotulo}`}</dd></>}
        <dt>Preço médio</dt>
        <dd class="num">{i.custo_medio === null ? <span class="fraco">Sem compra com preço</span> : custoBase(i.custo_medio, i.unidade_base)}</dd>
        <dt>Última compra</dt>
        <dd>{ultimaEntrada ? relativo(ultimaEntrada) : <span class="fraco">Nenhuma</span>}</dd>
        <dt>Última conferência</dt>
        <dd>{linha?.ultima_contagem_em ? relativo(linha.ultima_contagem_em) : <span class="fraco">Nunca</span>}</dd>
        {i.tipo === 'preparo' && <><dt>Preparo</dt><dd>{CONTROLE[i.controle_preparo ?? 'explodir']}</dd></>}
        {i.usado_em.length > 0 && <><dt>Usado em</dt><dd>{plural(i.usado_em.length, 'ficha técnica', 'fichas técnicas')}</dd></>}
      </dl>

      <section class="pilha pilha--p" aria-label="Histórico de movimentações">
        <h3 class="secao-titulo">Histórico</h3>
        {movs && movs.itens.length ? (
          <>
            <ul class="movimentos">
              {movs.itens.map((m) => {
                const q = Number(m.quantidade);
                const quem = responsavel(m.registrado_por, m.registrado_por_nome);
                const mu = unidadeExibicao(i.unidade_base, m.quantidade, m.saldo_apos);
                const rotulo = rotuloMovimento(m);
                const motivo = motivoDoHistorico(m);
                return (
                  <li key={m.id} class="movimento">
                    <span class="movimento__texto">
                      <strong>{rotulo}</strong>
                      <span class="fraco">{[dataHora(m.ocorreu_em), motivo, quem].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span class="movimento__qtd num">
                      <strong data-sinal={q < 0 ? '-' : '+'}>{q > 0 ? '+' : ''}{numeroEm(m.quantidade, mu.fator)} {mu.rotulo}</strong>
                      {m.saldo_apos !== null && (
                        <span class="fraco">
                          {m.tipo === 'ajuste_inventario' ? <>de {numeroEm(Number(m.saldo_apos) - q, mu.fator)} para </> : 'saldo '}
                          {numeroEm(m.saldo_apos, mu.fator)} {mu.rotulo}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {movs.proximo && <Botao tamanho="p" carregando={movs.carregando} onClick={aoMais} style={{ alignSelf: 'flex-start' }}>Ver mais antigas</Botao>}
          </>
        ) : movs?.carregando ? (
          <Esqueleto linhas={3} />
        ) : (
          <p class="fraco">Nenhuma movimentação ainda.</p>
        )}
      </section>
    </>
  );
}

/** O que explica o movimento, sem repetir o rótulo: a observação do uso interno, o motivo do ajuste avulso; a
 *  "contagem física" genérica do inventário não diz nada além do rótulo. */
function motivoDoHistorico(m: MovimentoEstoque): string | null {
  if (!m.motivo) return null;
  if (ehUsoInterno(m)) return m.motivo.replace(/^uso_interno:?\s*/, '').replace(/^outro: Uso interno:?\s*/, '') || null;
  if (m.tipo === 'ajuste_inventario' && /^(abertura$|contagem física$)/.test(m.motivo)) return null;
  if (m.tipo === 'entrada_compra') return null;
  return textoMotivo(m.motivo);
}

/** Valor guardado na base (g/ml/un) → texto na unidade escolhida (12500 g em kg → "12,5"). */
const emTexto = (v: string | null | undefined, fator: 1 | 1000) => (v === null || v === undefined ? '' : numeroEm(v, fator).replace(/\./g, ''));

/** Campos de quantidade do cadastro (mínimo, ideal, inicial) numa unidade só, escolhida uma vez. */
function SeletorUnidade({ id, base, valor, aoMudar }: { id: string; base: InsumoDetalhe['unidade_base']; valor: 1 | 1000; aoMudar: (f: 1 | 1000) => void }) {
  const opcoes = unidadesDaBase(base);
  if (opcoes.length === 1) return <span class="campo-quantidade__unidade">un</span>;
  return (
    <select id={id} class="selecao" aria-label="Unidade das quantidades" value={String(valor)} onChange={(e) => aoMudar(Number(e.currentTarget.value) as 1 | 1000)}>
      {opcoes.map((o) => <option key={o.valor} value={String(o.fator)}>{o.valor}</option>)}
    </select>
  );
}

function EditarInsumo({ i, aoTerminar }: { i: InsumoDetalhe; aoTerminar: () => void }) {
  const inicial = unidadeExibicao(i.unidade_base, i.estoque_minimo, i.estoque_ideal).fator;
  const [fator, setFator] = useState<1 | 1000>(inicial);
  const [f, setF] = useState({ nome: i.nome, categoria: i.categoria ?? '', minimo: emTexto(i.estoque_minimo, inicial), ideal: emTexto(i.estoque_ideal, inicial), prazo: i.prazo_reposicao_dias === null ? '' : String(i.prazo_reposicao_dias), ativo: i.ativo, controle: i.controle_preparo ?? 'explodir' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const comIdeal = aceitaEstoqueIdeal(i);
  const rotuloU = unidadesDaBase(i.unidade_base).find((u) => u.fator === fator)?.valor ?? i.unidade_base;
  async function salvar(e: Event) {
    e.preventDefault();
    if (!f.nome.trim()) return setErro(new ErroApi('validacao', 'Informe o nome.'));
    const minimo = f.minimo.trim() ? paraBase(f.minimo, fator) : undefined;
    if (minimo === null) return setErro(new ErroApi('validacao', 'Estoque mínimo inválido.'));
    const ideal = comIdeal && f.ideal.trim() ? paraBase(f.ideal, fator) : undefined;
    if (ideal === null) return setErro(new ErroApi('validacao', 'Estoque ideal inválido.'));
    if (ideal !== undefined && minimo !== undefined && Number(ideal) < Number(minimo)) return setErro(new ErroApi('validacao', 'O ideal não pode ser menor que o mínimo.'));
    const prazo = f.prazo.trim() ? Number(f.prazo) : undefined;
    if (prazo !== undefined && !(Number.isInteger(prazo) && prazo >= 0 && prazo <= 90)) return setErro(new ErroApi('validacao', 'O prazo vai de 0 a 90 dias.'));
    setEnviando(true);
    setErro(null);
    try {
      // Campo em branco não é enviado: o backend só muda o que chega.
      await estoque.alterarInsumo(i.id, {
        versao: i.versao,
        nome: f.nome.trim(),
        ...(f.categoria.trim() ? { categoria: f.categoria.trim() } : {}),
        ...(minimo !== undefined ? { estoque_minimo: minimo } : {}),
        ...(ideal !== undefined ? { estoque_ideal: ideal } : {}),
        ...(prazo !== undefined ? { prazo_reposicao_dias: prazo } : {}),
        ...(i.tipo === 'preparo' ? { controle_preparo: f.controle } : {}),
        ativo: f.ativo,
      });
      atualizarEstoque();
      avisar('Cadastro salvo.', 'ok');
      aoTerminar();
    } catch (x) {
      const er = x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível salvar.');
      setErro(er);
      if (er.codigo === 'conflito_versao') atualizarEstoque();
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form class="pilha" onSubmit={salvar} noValidate>
      <h3 class="secao-titulo">Editar insumo</h3>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
      <div class="grade-campos">
        <Campo rotulo="Nome" class="inteiro" erro={erro?.campos.nome}>{(id) => <input id={id} class="entrada" maxLength={120} value={f.nome} onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} />}</Campo>
        <Campo rotulo="Categoria" opcional>{(id) => <input id={id} class="entrada" maxLength={60} list="categorias-insumo" value={f.categoria} onInput={(e) => setF({ ...f, categoria: e.currentTarget.value })} />}</Campo>
        <Campo rotulo="Unidade das quantidades">{(id) => <SeletorUnidade id={id} base={i.unidade_base} valor={fator} aoMudar={setFator} />}</Campo>
        <Campo rotulo={`Estoque mínimo (${rotuloU})`} opcional ajuda="Abaixo disso, o insumo aparece como baixo.">{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
        <CampoIdeal ativo={comIdeal} rotuloU={rotuloU} valor={f.ideal} aoMudar={(v) => setF({ ...f, ideal: v })} />
        <Campo rotulo="Prazo de entrega do fornecedor (dias)" opcional>{(id) => <input id={id} class="entrada num" type="number" min={0} max={90} value={f.prazo} onInput={(e) => setF({ ...f, prazo: e.currentTarget.value })} />}</Campo>
        {i.tipo === 'preparo' && (
          <Campo rotulo="Controle do preparo" ajuda="Sai a cada venda: os ingredientes saem quando o produto é vendido. Lote: saem quando a produção é registrada.">
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={f.controle} onChange={(e) => setF({ ...f, controle: e.currentTarget.value as 'explodir' | 'lote' })}>
                <option value="explodir">{CONTROLE.explodir}</option>
                <option value="lote">{CONTROLE.lote}</option>
              </select>
            )}
          </Campo>
        )}
        <label class="marcar inteiro"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.currentTarget.checked })} /> Insumo ativo</label>
      </div>
      <ListaCategorias />
      <p class="fraco">A unidade-base ({UNIDADE[i.unidade_base]}) não muda depois que há movimentos.</p>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar} disabled={enviando}>Voltar</Botao>
        <Botao type="submit" variante="primario" carregando={enviando}>Salvar</Botao>
      </div>
    </form>
  );
}

/** Estoque ideal: ligado só quando o backend guarda o campo (aceitaEstoqueIdeal). Desligado, diz por quê — nunca finge
 *  que salvou. */
function CampoIdeal({ ativo, rotuloU, valor, aoMudar }: { ativo: boolean; rotuloU: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <Campo rotulo={`Estoque ideal (${rotuloU})`} opcional ajuda={ativo ? 'Até onde repor numa compra.' : 'Ainda não é guardado pelo sistema.'}>
      {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={ativo ? valor : ''} disabled={!ativo} onInput={(e) => aoMudar(e.currentTarget.value)} />}
    </Campo>
  );
}

/** Sugestões de categoria: as que já existem no cadastro (digitar uma nova continua valendo). */
function ListaCategorias() {
  const catalogo = useConsulta('estoque/insumos?catalogo', () => estoque.insumos({ limite: 200 }));
  const cats = [...new Set((catalogo.dados?.itens ?? []).map((i) => i.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return <datalist id="categorias-insumo">{cats.map((c) => <option key={c} value={c} />)}</datalist>;
}

const VAZIO_NOVO = { nome: '', unidade: 'kg' as UnidadeCadastro, categoria: '', inicial: '', minimo: '', ideal: '', tipo: 'comprado' as 'comprado' | 'preparo', controle: 'explodir' as 'explodir' | 'lote' };

/** Cadastro simples: nome, categoria, unidade (g, kg, ml, L ou un), quantidade inicial, mínimo e ideal. A quantidade
 *  inicial vira a primeira conferência do insumo (POST /ajustes, abertura do estoque), registrada logo depois do cadastro.
 *  O custo não é digitado aqui: vem da primeira compra conferida (o backend ainda não aceita custo inicial). */
export function NovoInsumo({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [f, setF] = useState(VAZIO_NOVO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const catalogo = useConsulta(aberto ? 'estoque/insumos?catalogo' : null, () => estoque.insumos({ limite: 200 }));
  const comIdeal = aceitaEstoqueIdeal(catalogo.dados?.itens[0]);
  useEffect(() => {
    if (aberto) setErro(null);
  }, [aberto]);
  const u = unidadeCadastro(f.unidade);

  async function criar(e: Event) {
    e.preventDefault();
    if (!f.nome.trim()) return setErro(new ErroApi('validacao', 'Informe o nome do insumo.'));
    const conv = (t: string, rotulo: string) => {
      if (!t.trim()) return { v: null as string | null };
      const v = paraBase(t, u.fator);
      return v === null ? { erro: `${rotulo} inválido.` } : { v };
    };
    const inicial = conv(f.inicial, 'Quantidade inicial');
    const minimo = conv(f.minimo, 'Estoque mínimo');
    const ideal = comIdeal ? conv(f.ideal, 'Estoque ideal') : { v: null };
    const falha = inicial.erro ?? minimo.erro ?? ideal.erro;
    if (falha) return setErro(new ErroApi('validacao', falha));
    if (ideal.v && minimo.v && Number(ideal.v) < Number(minimo.v)) return setErro(new ErroApi('validacao', 'O ideal não pode ser menor que o mínimo.'));
    setEnviando(true);
    setErro(null);
    let criado: string | null = null;
    try {
      const r = await estoque.criarInsumo({
        nome: f.nome.trim(), unidade_base: u.base, tipo: f.tipo, controle_preparo: f.tipo === 'preparo' ? f.controle : null, categoria: f.categoria.trim() || null,
        estoque_minimo: minimo.v ?? null, ...(comIdeal && ideal.v ? { estoque_ideal: ideal.v } : {}),
      });
      criado = r.id;
      if (inicial.v !== null && inicial.v !== undefined) await estoque.ajustar({ insumo_id: r.id, quantidade: inicial.v, motivo: 'contagem_fisica', observacao: 'Quantidade inicial no cadastro' });
      atualizarEstoque();
      avisar(inicial.v ? 'Insumo cadastrado com a quantidade inicial.' : 'Insumo cadastrado.', 'ok');
      setF(VAZIO_NOVO);
      aoCriar(r.id);
    } catch (x) {
      if (criado) {
        // Cadastrou, mas a quantidade inicial não entrou: o insumo existe e abre; a pessoa confere por lá.
        atualizarEstoque();
        avisar('Insumo cadastrado, mas a quantidade inicial não foi registrada. Use “Conferir quantidade”.', 'erro');
        setF(VAZIO_NOVO);
        aoCriar(criado);
      } else setErro(x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível cadastrar.'));
    } finally {
      setEnviando(false);
    }
  }
  // 409 nome_ja_existe traz o id do insumo que já existe em dados.insumo_id.
  const existente = erro?.codigo === 'nome_ja_existe' && typeof erro.dados?.insumo_id === 'string' ? erro.dados.insumo_id : null;
  const comInicial = !!f.inicial.trim();
  return (
    <Gaveta
      aberta={aberto}
      aoFechar={aoFechar}
      titulo="Novo insumo"
      rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-novo-insumo" carregando={enviando}>{comInicial ? 'Cadastrar com a quantidade' : 'Cadastrar'}</Botao></>}
    >
      <form id="form-novo-insumo" class="pilha" onSubmit={criar} noValidate>
        {erro && (
          <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>
            {erro.message}
            {existente && <div style={{ marginTop: '6px' }}><Botao tamanho="p" onClick={() => aoCriar(existente)}>Abrir o insumo existente</Botao></div>}
          </Aviso>
        )}
        <div class="grade-campos">
          <Campo rotulo="Nome" class="inteiro">{(id) => <input id={id} class="entrada" maxLength={120} value={f.nome} placeholder="Ex.: Leite integral" onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} data-autofoco />}</Campo>
          <Campo rotulo="Categoria" opcional>{(id) => <input id={id} class="entrada" maxLength={60} list="categorias-insumo" value={f.categoria} placeholder="Ex.: Laticínios" onInput={(e) => setF({ ...f, categoria: e.currentTarget.value })} />}</Campo>
          <Campo rotulo="Unidade" ajuda="Compras em caixa ou pacote são convertidas na conferência.">
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.currentTarget.value as UnidadeCadastro })}>
                {UNIDADES_CADASTRO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo={`Quantidade inicial (${u.valor})`} opcional ajuda="O que há agora na prateleira. Vira a primeira conferência.">{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={f.inicial} onInput={(e) => setF({ ...f, inicial: e.currentTarget.value })} />}</Campo>
          <Campo rotulo={`Estoque mínimo (${u.valor})`} opcional ajuda="Abaixo disso, aparece como baixo.">{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
          <CampoIdeal ativo={comIdeal} rotuloU={u.valor} valor={f.ideal} aoMudar={(v) => setF({ ...f, ideal: v })} />
        </div>
        <p class="fraco">O preço médio vem das compras conferidas em Compras.</p>
        <details class="mais-opcoes">
          <summary>Mais opções</summary>
          <div class="grade-campos">
            <Campo rotulo="Tipo">
              {(id) => (
                <select id={id} class="selecao" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.currentTarget.value as 'comprado' | 'preparo' })}>
                  <option value="comprado">Comprado pronto</option>
                  <option value="preparo">Preparo da casa (tem ficha técnica)</option>
                </select>
              )}
            </Campo>
            {f.tipo === 'preparo' && (
              <Campo rotulo="Controle do preparo" ajuda="Sai a cada venda (padrão) ou em lote, quando a produção é registrada.">
                {(id, d) => (
                  <select id={id} class="selecao" aria-describedby={d} value={f.controle} onChange={(e) => setF({ ...f, controle: e.currentTarget.value as 'explodir' | 'lote' })}>
                    <option value="explodir">{CONTROLE.explodir}</option>
                    <option value="lote">{CONTROLE.lote}</option>
                  </select>
                )}
              </Campo>
            )}
          </div>
        </details>
        <ListaCategorias />
      </form>
    </Gaveta>
  );
}
