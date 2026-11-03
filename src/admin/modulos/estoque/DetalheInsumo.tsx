// Gaveta do insumo: quantidade, mínimo, custo médio (quando há), última entrada e última contagem, o histórico do livro
// (com o nome de quem registrou, nunca o id) e as três ações — Entrada, Saída, Ajuste — que abrem o mesmo "Registrar
// movimento" já com este insumo. Cadastro (novo, editar) também mora aqui. Nada é calculado: tudo vem do backend.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Pencil, Info, ChefHat, ArrowDownToLine, ArrowUpFromLine, Scale } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { custoBase, relativo, dataHora, plural } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { Insumo, InsumoDetalhe, MovimentoEstoque, UnidadeBase } from '../../lib/tipos/estoque';
import {
  UNIDADE, UNIDADE_CURTA, TIPO_MOVIMENTO, atualizarEstoque, quantidadeDigitada, situacaoEstoque, SituacaoEstoque, unidadeExibicao, numeroEm, textoMotivo,
  type PermissoesEstoque,
} from './comum';

export type TipoMovimentoManual = 'entrada' | 'saida' | 'ajuste';
const CONTROLE = { explodir: 'Explode na venda', lote: 'Produção em lote' } as const;

export function DetalheInsumo({ id, perm, inicioControle, responsavel, aoFechar, aoMovimento, aoFicha }: {
  id: string | null;
  perm: PermissoesEstoque;
  inicioControle: string | null;
  responsavel: (r: string | null | undefined) => string | null;
  aoFechar: () => void;
  aoMovimento: (tipo: TipoMovimentoManual, insumo: Insumo) => void;
  aoFicha: (i: InsumoDetalhe) => void;
}) {
  const consulta = useConsulta(id ? `estoque/insumos/${id}` : null, () => estoque.insumo(id!));
  // A linha da lista (mesmo cache da tela principal) traz a última entrada e a última contagem.
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
      {perm.conferir && i.tipo === 'comprado' && <Botao icone={<ArrowDownToLine aria-hidden="true" />} onClick={() => aoMovimento('entrada', alvo)}>Entrada</Botao>}
      {perm.visualizar && <Botao icone={<ArrowUpFromLine aria-hidden="true" />} onClick={() => aoMovimento('saida', alvo)}>Saída</Botao>}
      {perm.visualizar && <Botao icone={<Scale aria-hidden="true" />} onClick={() => aoMovimento('ajuste', alvo)}>Ajuste</Botao>}
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
  responsavel: (r: string | null | undefined) => string | null;
  aoMais: () => void;
}) {
  const s = situacaoEstoque({ saldo: i.saldo, abaixo_minimo: linha?.abaixo_minimo ?? false, ultima_contagem_em: linha?.ultima_contagem_em ?? null, motivo_nao_confiavel: i.motivo_nao_confiavel }, inicioControle);
  const u = unidadeExibicao(i.unidade_base, i.saldo, i.estoque_minimo);
  const semNumero = s === 'nao_conferido' && (i.motivo_nao_confiavel === 'sem_movimento' || Number(i.saldo) === 0);
  const ultimaEntrada = linha?.ultima_compra_em ?? i.precos[0]?.ocorreu_em ?? null;

  return (
    <>
      <div class="insumo-saldo">
        <div>
          <span class="insumo-saldo__rotulo">Disponível</span>
          <span class={`insumo-saldo__valor num${s === 'nao_conferido' ? ' fraco' : ''}`}>{semNumero ? '—' : `${numeroEm(i.saldo, u.fator)} ${u.rotulo}`}</span>
        </div>
        <SituacaoEstoque codigo={s} />
      </div>
      {s === 'nao_conferido' && (
        <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>
          <strong>Ainda sem contagem.</strong> {semNumero ? 'O sistema não sabe quanto há.' : 'O número acima soma só as entradas registradas, sem o que já havia.'} Uma contagem (Ajuste ou Contagem) dá o saldo de partida.
        </Aviso>
      )}
      {i.motivo_nao_confiavel === 'ficou_negativo' && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}><strong>O saldo ficou negativo.</strong> Alguma entrada não foi registrada: conte de novo.</Aviso>}
      <dl class="definicoes">
        <dt>Mínimo</dt>
        <dd class="num">{i.estoque_minimo === null ? <span class="fraco">Não definido</span> : `${numeroEm(i.estoque_minimo, u.fator)} ${u.rotulo}`}</dd>
        <dt>Custo médio</dt>
        <dd class="num">{i.custo_medio === null ? <span class="fraco">Sem custo registrado</span> : custoBase(i.custo_medio, i.unidade_base)}</dd>
        <dt>Última entrada</dt>
        <dd>{ultimaEntrada ? relativo(ultimaEntrada) : <span class="fraco">Nenhuma</span>}</dd>
        <dt>Última contagem</dt>
        <dd>{linha?.ultima_contagem_em ? relativo(linha.ultima_contagem_em) : <span class="fraco">Nunca contado</span>}</dd>
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
                const quem = responsavel(m.registrado_por);
                const mu = unidadeExibicao(i.unidade_base, m.quantidade, m.saldo_apos);
                const rotulo = TIPO_MOVIMENTO[m.tipo] ?? m.tipo;
                const motivo = m.tipo === 'ajuste_inventario' ? null : textoMotivo(m.motivo);
                return (
                  <li key={m.id} class="movimento">
                    <span class="movimento__texto">
                      <strong>{rotulo}</strong>
                      <span class="fraco">{[dataHora(m.ocorreu_em), motivo, quem].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span class="movimento__qtd num">
                      <strong data-sinal={q < 0 ? '-' : '+'}>{q > 0 ? '+' : ''}{numeroEm(m.quantidade, mu.fator)} {mu.rotulo}</strong>
                      {m.saldo_apos !== null && <span class="fraco">saldo {numeroEm(m.saldo_apos, mu.fator)} {mu.rotulo}</span>}
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

function EditarInsumo({ i, aoTerminar }: { i: InsumoDetalhe; aoTerminar: () => void }) {
  const [f, setF] = useState({ nome: i.nome, categoria: i.categoria ?? '', minimo: i.estoque_minimo === null ? '' : String(Number(i.estoque_minimo)), prazo: i.prazo_reposicao_dias === null ? '' : String(i.prazo_reposicao_dias), ativo: i.ativo, controle: i.controle_preparo ?? 'explodir' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  async function salvar(e: Event) {
    e.preventDefault();
    if (!f.nome.trim()) return setErro(new ErroApi('validacao', 'Informe o nome.'));
    const minimo = f.minimo.trim() ? quantidadeDigitada(f.minimo) : undefined;
    if (minimo === null) return setErro(new ErroApi('validacao', 'Estoque mínimo inválido.'));
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
        <Campo rotulo="Categoria" opcional>{(id) => <input id={id} class="entrada" maxLength={60} value={f.categoria} onInput={(e) => setF({ ...f, categoria: e.currentTarget.value })} />}</Campo>
        <Campo rotulo={`Estoque mínimo (${UNIDADE_CURTA[i.unidade_base]})`} opcional ajuda={i.unidade_base === 'g' ? 'Em gramas: 1 kg = 1000.' : i.unidade_base === 'ml' ? 'Em mililitros: 1 L = 1000.' : undefined}>{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
        <Campo rotulo="Prazo de entrega do fornecedor (dias)" opcional>{(id) => <input id={id} class="entrada num" type="number" min={0} max={90} value={f.prazo} onInput={(e) => setF({ ...f, prazo: e.currentTarget.value })} />}</Campo>
        {i.tipo === 'preparo' && (
          <Campo rotulo="Controle do preparo" ajuda="Explodir: os ingredientes saem a cada venda. Lote: saem quando a produção é registrada.">
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
      <p class="fraco">A unidade ({UNIDADE[i.unidade_base]}) não muda depois que há movimentos.</p>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar} disabled={enviando}>Voltar</Botao>
        <Botao type="submit" variante="primario" carregando={enviando}>Salvar</Botao>
      </div>
    </form>
  );
}

export function NovoInsumo({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const vazio = { nome: '', unidade: 'g' as UnidadeBase, tipo: 'comprado' as 'comprado' | 'preparo', controle: 'explodir' as 'explodir' | 'lote', categoria: '', minimo: '' };
  const [f, setF] = useState(vazio);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  useEffect(() => {
    if (aberto) setErro(null);
  }, [aberto]);
  async function criar(e: Event) {
    e.preventDefault();
    if (!f.nome.trim()) return setErro(new ErroApi('validacao', 'Informe o nome do insumo.'));
    const minimo = f.minimo.trim() ? quantidadeDigitada(f.minimo) : null;
    if (f.minimo.trim() && minimo === null) return setErro(new ErroApi('validacao', 'Estoque mínimo inválido.'));
    setEnviando(true);
    setErro(null);
    try {
      const r = await estoque.criarInsumo({ nome: f.nome.trim(), unidade_base: f.unidade, tipo: f.tipo, controle_preparo: f.tipo === 'preparo' ? f.controle : null, categoria: f.categoria.trim() || null, estoque_minimo: minimo });
      atualizarEstoque();
      avisar('Insumo cadastrado.', 'ok');
      setF(vazio);
      aoCriar(r.id);
    } catch (x) {
      setErro(x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível cadastrar.'));
    } finally {
      setEnviando(false);
    }
  }
  // 409 nome_ja_existe traz o id do insumo que já existe em dados.insumo_id.
  const existente = erro?.codigo === 'nome_ja_existe' && typeof erro.dados?.insumo_id === 'string' ? erro.dados.insumo_id : null;
  return (
    <Gaveta aberta={aberto} aoFechar={aoFechar} titulo="Novo insumo" rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-novo-insumo" carregando={enviando}>Cadastrar</Botao></>}>
      <form id="form-novo-insumo" class="pilha" onSubmit={criar} noValidate>
        {erro && (
          <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>
            {erro.message}
            {existente && <div style={{ marginTop: '6px' }}><Botao tamanho="p" onClick={() => aoCriar(existente)}>Abrir o insumo existente</Botao></div>}
          </Aviso>
        )}
        <Campo rotulo="Nome">{(id) => <input id={id} class="entrada" maxLength={120} value={f.nome} placeholder="Ex.: Leite integral" onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} data-autofoco />}</Campo>
        <Campo rotulo="Unidade de medida" ajuda="Compras em kg, caixa ou litro são convertidas para ela na conferência.">
          {(id, d) => (
            <select id={id} class="selecao" aria-describedby={d} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.currentTarget.value as UnidadeBase })}>
              <option value="g">Gramas (g) — sólidos</option>
              <option value="ml">Mililitros (ml) — líquidos</option>
              <option value="un">Unidades (un) — ovos, pães…</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} class="selecao" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.currentTarget.value as 'comprado' | 'preparo' })}>
              <option value="comprado">Comprado pronto</option>
              <option value="preparo">Preparo da casa (tem ficha técnica)</option>
            </select>
          )}
        </Campo>
        {f.tipo === 'preparo' && (
          <Campo rotulo="Controle do preparo" ajuda="Explodir: os ingredientes saem a cada venda (padrão). Lote: saem quando a produção é registrada.">
            {(id, d) => (
              <select id={id} class="selecao" aria-describedby={d} value={f.controle} onChange={(e) => setF({ ...f, controle: e.currentTarget.value as 'explodir' | 'lote' })}>
                <option value="explodir">{CONTROLE.explodir}</option>
                <option value="lote">{CONTROLE.lote}</option>
              </select>
            )}
          </Campo>
        )}
        <Campo rotulo="Categoria" opcional>{(id) => <input id={id} class="entrada" maxLength={60} value={f.categoria} placeholder="Ex.: Laticínios" onInput={(e) => setF({ ...f, categoria: e.currentTarget.value })} />}</Campo>
        <Campo rotulo={`Estoque mínimo (${f.unidade})`} opcional>{(id) => <input id={id} class="entrada num" inputMode="decimal" value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
      </form>
    </Gaveta>
  );
}
