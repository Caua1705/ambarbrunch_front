// Gaveta do insumo: quantidade, mínimo, ideal (quando o backend guardar), custo médio, última compra e última conferência,
// o histórico do livro (com o nome de quem registrou, nunca o id) e duas ações — Ajustar estoque (entrada, perda ou
// correção de inventário, em Movimento.tsx) e Editar cadastro. Cadastro (novo, rápido, editar) também mora aqui. Nada é
// calculado: tudo vem do backend; o painel só converte kg/L para a unidade-base.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Pencil, Info, ChefHat, SlidersHorizontal } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { custoBase, relativo, dataHora, plural } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { Insumo, InsumoDetalhe, MovimentoEstoque, UnidadeBase } from '../../lib/tipos/estoque';
import {
  UNIDADE, rotuloMovimento, ehUsoInterno, atualizarEstoque, situacaoEstoque, SituacaoEstoque, unidadeExibicao, numeroEm, paraBase, textoMotivo,
  UNIDADES_CADASTRO, unidadeCadastro, unidadesDaBase, aceitaEstoqueIdeal, type UnidadeCadastro, type PermissoesEstoque,
} from './comum';
import { escolhidoDe, type InsumoEscolhido } from './SeletorInsumo';

const CONTROLE = { explodir: 'Sai a cada venda', lote: 'Produção em lote' } as const;

export function DetalheInsumo({ id, perm, inicioControle, responsavel, aoFechar, aoAjustar, aoFicha }: {
  id: string | null;
  perm: PermissoesEstoque;
  inicioControle: string | null;
  responsavel: (r: string | null | undefined, nome?: string | null) => string | null;
  aoFechar: () => void;
  aoAjustar: (insumo: Insumo) => void;
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
      {perm.visualizar && <Botao variante="primario" icone={<SlidersHorizontal aria-hidden="true" />} onClick={() => aoAjustar(alvo)}>Ajustar estoque</Botao>}
      {perm.editar && <Botao icone={<Pencil aria-hidden="true" />} onClick={() => setEditando(true)}>Editar cadastro</Botao>}
      {perm.editar && i.tipo === 'preparo' && <Botao variante="fantasma" icone={<ChefHat aria-hidden="true" />} onClick={() => aoFicha(i)}>Ficha do preparo</Botao>}
    </div>
  ) : undefined;

  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      titulo={i?.nome ?? 'Insumo'}
      subtitulo={i ? [i.categoria, i.tipo === 'preparo' ? 'preparo da casa' : null, `em ${UNIDADE[i.unidade_base]}`, i.ativo ? null : 'inativo'].filter(Boolean).join(' · ') : undefined}
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
      {s === 'nao_conferido' && <p class="fraco" data-teste="nao-conferido">{semNumero ? 'Quantidade ainda não registrada.' : 'Soma só as compras registradas.'} Registre a contagem em “Ajustar estoque”.</p>}
      {i.motivo_nao_confiavel === 'ficou_negativo' && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}><strong>O saldo ficou negativo.</strong> Alguma compra não foi registrada: confira a quantidade.</Aviso>}
      <dl class="definicoes">
        <dt>Estoque mínimo</dt>
        <dd class="num">{i.estoque_minimo === null ? <span class="fraco">Não definido</span> : `${numeroEm(i.estoque_minimo, u.fator)} ${u.rotulo}`}</dd>
        <dt>Estoque ideal</dt>
        <dd class="num">{!aceitaEstoqueIdeal(i) ? <span class="fraco">Ainda não salvo pelo sistema</span> : i.estoque_ideal == null ? <span class="fraco">Não definido</span> : `${numeroEm(i.estoque_ideal, u.fator)} ${u.rotulo}`}</dd>
        <dt>Custo médio</dt>
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
  const [f, setF] = useState({ nome: i.nome, minimo: emTexto(i.estoque_minimo, inicial), ideal: emTexto(i.estoque_ideal, inicial), prazo: i.prazo_reposicao_dias === null ? '' : String(i.prazo_reposicao_dias), ativo: i.ativo, controle: i.controle_preparo ?? 'explodir' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const comIdeal = aceitaEstoqueIdeal(i);
  const rotuloU = unidadesDaBase(i.unidade_base).find((u) => u.fator === fator)?.valor ?? i.unidade_base;
  async function salvar(e: Event) {
    e.preventDefault();
    if (!f.nome.trim()) return setErro(new ErroApi('validacao', 'Informe o nome.'));
    if (!f.minimo.trim()) return setErro(new ErroApi('validacao', 'Informe o estoque mínimo: é ele que dispara o alerta.'));
    const minimo = paraBase(f.minimo, fator);
    if (minimo === null) return setErro(new ErroApi('validacao', 'Estoque mínimo inválido.'));
    const ideal = comIdeal && f.ideal.trim() ? paraBase(f.ideal, fator) : undefined;
    if (ideal === null) return setErro(new ErroApi('validacao', 'Estoque ideal inválido.'));
    if (ideal !== undefined && Number(ideal) < Number(minimo)) return setErro(new ErroApi('validacao', 'O ideal não pode ser menor que o mínimo.'));
    const prazo = f.prazo.trim() ? Number(f.prazo) : undefined;
    if (prazo !== undefined && !(Number.isInteger(prazo) && prazo >= 0 && prazo <= 90)) return setErro(new ErroApi('validacao', 'O prazo vai de 0 a 90 dias.'));
    setEnviando(true);
    setErro(null);
    try {
      // Campo em branco não é enviado: o backend só muda o que chega.
      await estoque.alterarInsumo(i.id, {
        versao: i.versao,
        nome: f.nome.trim(),
        estoque_minimo: minimo,
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
      <h3 class="secao-titulo">Editar cadastro</h3>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro.message}</Aviso>}
      <div class="grade-campos">
        <Campo rotulo="Nome" class="inteiro" erro={erro?.campos.nome}>{(id) => <input id={id} class="entrada" maxLength={120} value={f.nome} onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} />}</Campo>
        <Campo rotulo="Unidade das quantidades">{(id) => <SeletorUnidade id={id} base={i.unidade_base} valor={fator} aoMudar={setFator} />}</Campo>
        <Campo rotulo={`Estoque mínimo (${rotuloU})`} ajuda={AJUDA_MINIMO}>{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} aria-required="true" value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
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
      <p class="fraco">Unidade cadastrada: {UNIDADE[i.unidade_base]}.</p>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar} disabled={enviando}>Voltar</Botao>
        <Botao type="submit" variante="primario" carregando={enviando}>Salvar</Botao>
      </div>
    </form>
  );
}

/** O que cada número quer dizer, igual no cadastro e na edição. */
const AJUDA_MINIMO = 'Abaixo dele, o insumo aparece como baixo.';

/** Estoque ideal: ligado só quando o backend guarda o campo (aceitaEstoqueIdeal). Desligado, diz por quê — nunca finge
 *  que salvou. */
function CampoIdeal({ ativo, rotuloU, valor, aoMudar }: { ativo: boolean; rotuloU: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <Campo rotulo={`Estoque ideal (${rotuloU})`} opcional ajuda={ativo ? undefined : 'Ainda não é salvo pelo sistema.'}>
      {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={ativo ? valor : ''} disabled={!ativo} onInput={(e) => aoMudar(e.currentTarget.value)} />}
    </Campo>
  );
}

const VAZIO_NOVO = { nome: '', unidade: 'kg' as UnidadeCadastro, inicial: '', minimo: '', ideal: '', tipo: 'comprado' as 'comprado' | 'preparo' };
const UNIDADE_DA_BASE: Record<UnidadeBase, UnidadeCadastro> = { g: 'kg', ml: 'L', un: 'un' };

/** Cadastro rápido aberto pelo seletor de insumos (Compras, Fichas): um insumo só, já com o nome digitado; ao cadastrar,
 *  devolve o insumo ao fluxo que abriu e fecha. */
export interface PedidoCadastroRapido {
  nome: string;
  unidade?: UnidadeBase | null;
  aoConcluir: (i: InsumoEscolhido | null) => void;
}

/** Cadastro de insumo: nome, unidade (g, kg, ml, L ou un), tipo, quantidade inicial, mínimo (obrigatório: é ele que liga
 *  o alerta) e ideal. Em sequência: cadastrou, o formulário limpa (mantém a unidade) e volta ao nome; a lista "Cadastrados
 *  agora" abre cada um. A quantidade inicial vira a primeira conferência do insumo (POST /ajustes), registrada logo depois
 *  do cadastro. Tipo "preparo da casa" não muda depois (o backend não deixa): fica num campo discreto. No modo rápido
 *  (`rapido`), cadastra um só e devolve ao fluxo que pediu. O custo vem da primeira compra conferida (o backend ainda não
 *  aceita custo inicial). */
export function NovoInsumo({ aberto, aoFechar, aoAbrir, rapido }: { aberto: boolean; aoFechar: () => void; aoAbrir: (id: string) => void; rapido?: PedidoCadastroRapido | null }) {
  const [f, setF] = useState(VAZIO_NOVO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [feitos, setFeitos] = useState<{ id: string; nome: string; aviso?: boolean }[]>([]);
  const nome = useRef<HTMLInputElement>(null);
  const catalogo = useConsulta(aberto ? 'estoque/insumos?catalogo' : null, () => estoque.insumos({ limite: 200 }));
  const comIdeal = aceitaEstoqueIdeal(catalogo.dados?.itens[0]);
  useEffect(() => {
    if (aberto) {
      setErro(null);
      setFeitos([]);
      setF(rapido ? { ...VAZIO_NOVO, nome: rapido.nome, unidade: rapido.unidade ? UNIDADE_DA_BASE[rapido.unidade] : VAZIO_NOVO.unidade } : VAZIO_NOVO);
    }
  }, [aberto, rapido]);
  const u = unidadeCadastro(f.unidade);
  const preparo = f.tipo === 'preparo';
  const fechar = () => {
    rapido?.aoConcluir(null);
    aoFechar();
  };

  function proximo(id: string, nomeFeito: string, aviso?: boolean) {
    setFeitos((x) => [{ id, nome: nomeFeito, aviso }, ...x]);
    setF({ ...VAZIO_NOVO, unidade: f.unidade });
    setTimeout(() => nome.current?.focus(), 0);
  }

  async function criar(e: Event) {
    e.preventDefault();
    if (enviando) return;
    if (!f.nome.trim()) return setErro(new ErroApi('validacao', 'Informe o nome do insumo.', 0, null, { nome: 'Informe o nome.' }));
    const conv = (t: string, rotulo: string) => {
      if (!t.trim()) return { v: null as string | null };
      const v = paraBase(t, u.fator);
      return v === null ? { erro: `${rotulo} inválido.` } : { v };
    };
    const inicial = conv(rapido ? '' : f.inicial, 'Quantidade inicial');
    const minimo = conv(f.minimo, 'Estoque mínimo');
    const ideal = comIdeal ? conv(f.ideal, 'Estoque ideal') : { v: null };
    const falha = inicial.erro ?? minimo.erro ?? ideal.erro;
    if (falha) return setErro(new ErroApi('validacao', falha));
    if (!minimo.v) return setErro(new ErroApi('validacao', 'Informe o estoque mínimo: é ele que dispara o alerta.', 0, null, { estoque_minimo: 'Informe o mínimo (pode ser 0).' }));
    if (ideal.v && Number(ideal.v) < Number(minimo.v)) return setErro(new ErroApi('validacao', 'O ideal não pode ser menor que o mínimo.'));
    setEnviando(true);
    setErro(null);
    let criado: string | null = null;
    const nomeFeito = f.nome.trim();
    try {
      const r = await estoque.criarInsumo({
        nome: nomeFeito, unidade_base: u.base, tipo: f.tipo, controle_preparo: preparo ? 'explodir' : null,
        estoque_minimo: minimo.v, ...(comIdeal && ideal.v ? { estoque_ideal: ideal.v } : {}),
      });
      criado = r.id;
      if (rapido) {
        atualizarEstoque();
        avisar(`${r.nome} cadastrado.`, 'ok');
        rapido.aoConcluir({ id: r.id, nome: r.nome, unidade_base: r.unidade_base, tipo: r.tipo, custo_medio: null });
        aoFechar();
        return;
      }
      if (inicial.v !== null && inicial.v !== undefined) await estoque.ajustar({ insumo_id: r.id, quantidade: inicial.v, motivo: 'contagem_fisica', observacao: 'Quantidade inicial no cadastro' });
      atualizarEstoque();
      proximo(r.id, nomeFeito);
    } catch (x) {
      if (criado && !rapido) {
        // Cadastrou, mas a quantidade inicial não entrou: o insumo existe; a pessoa registra pela gaveta dele.
        atualizarEstoque();
        avisar(`${nomeFeito} cadastrado, mas a quantidade inicial não foi registrada. Abra o insumo e use “Ajustar estoque”.`, 'erro');
        proximo(criado, nomeFeito, true);
      } else setErro(x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível cadastrar.'));
    } finally {
      setEnviando(false);
    }
  }
  // 409 nome_ja_existe traz o id do insumo que já existe em dados.insumo_id: no modo rápido, usar o que já existe.
  const existente = erro?.codigo === 'nome_ja_existe' && typeof erro.dados?.insumo_id === 'string' ? erro.dados.insumo_id : null;
  async function usarExistente(id: string) {
    try {
      const i = await estoque.insumo(id);
      rapido?.aoConcluir(escolhidoDe(i));
      aoFechar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível abrir o insumo existente.'));
    }
  }
  return (
    <Gaveta
      aberta={aberto}
      aoFechar={fechar}
      titulo={rapido ? 'Cadastrar insumo' : 'Novo insumo'}
      rodape={<><Botao onClick={fechar}>{feitos.length ? 'Concluir' : 'Cancelar'}</Botao><Botao variante="primario" type="submit" form="form-novo-insumo" carregando={enviando}>{rapido ? 'Cadastrar e usar' : 'Cadastrar'}</Botao></>}
    >
      <form id="form-novo-insumo" class="pilha" onSubmit={criar} noValidate>
        {erro && (
          <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>
            {erro.message}
            {existente && (
              <div style={{ marginTop: '6px' }}>
                {rapido ? <Botao tamanho="p" onClick={() => usarExistente(existente)}>Usar o insumo existente</Botao> : <Botao tamanho="p" onClick={() => aoAbrir(existente)}>Abrir o insumo existente</Botao>}
              </div>
            )}
          </Aviso>
        )}
        <div class="grade-campos">
          <Campo rotulo="Nome" class="inteiro" erro={erro?.campos.nome}>{(id) => <input id={id} ref={nome} class="entrada" maxLength={120} value={f.nome} placeholder={preparo ? 'Ex.: Molho da casa' : 'Ex.: Leite integral'} onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} data-autofoco />}</Campo>
          <Campo rotulo="Unidade">
            {(id) => (
              <select id={id} class="selecao" value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.currentTarget.value as UnidadeCadastro })}>
                {UNIDADES_CADASTRO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Tipo">
            {(id) => (
              <select id={id} class="selecao" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.currentTarget.value as 'comprado' | 'preparo' })}>
                <option value="comprado">Comprado</option>
                <option value="preparo">Preparo da casa</option>
              </select>
            )}
          </Campo>
          {!rapido && <Campo rotulo={`Quantidade inicial (${u.valor})`} opcional ajuda="O que há agora; vira a primeira contagem.">{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={f.inicial} onInput={(e) => setF({ ...f, inicial: e.currentTarget.value })} />}</Campo>}
          <Campo rotulo={`Estoque mínimo (${u.valor})`} ajuda={AJUDA_MINIMO} erro={erro?.campos.estoque_minimo}>{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} aria-required="true" value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
          <CampoIdeal ativo={comIdeal} rotuloU={u.valor} valor={f.ideal} aoMudar={(v) => setF({ ...f, ideal: v })} />
        </div>
        {feitos.length > 0 && (
          <section class="pilha pilha--p" aria-label="Cadastrados agora" aria-live="polite">
            <h3 class="secao-titulo">Cadastrados agora ({feitos.length})</h3>
            <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '12px' }}>
              {feitos.map((x) => (
                <li key={x.id}>
                  <button type="button" class="lista__item lista__item--botao" onClick={() => aoAbrir(x.id)}>
                    <span class="lista__texto"><strong>{x.nome}</strong>{x.aviso && <span class="fraco">quantidade inicial não registrada</span>}</span>
                    <span class="lista__fim fraco">Abrir</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </form>
    </Gaveta>
  );
}
