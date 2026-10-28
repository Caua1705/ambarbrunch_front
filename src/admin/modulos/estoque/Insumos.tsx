// Insumos: ingredientes com saldo, custo médio e confiabilidade. Detalhe, histórico, perda e edição em gaveta;
// contagem física numa gaveta própria. Nada de página nova para cada ação.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Search, ClipboardList, Plus, Trash2, Pencil, ShieldAlert, Info } from 'lucide-preact';
import type { Papel } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { quantidade, custoBase, relativo, dataHora, num } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Cartao, Aviso, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Insumo, InsumoDetalhe, MovimentoEstoque, UnidadeBase } from '../../lib/tipos/estoque';
import { SituacaoSaldo, CONFIABILIDADE, UNIDADE, UNIDADE_CURTA, atualizarEstoque } from './comum';
import { Contagem } from './Contagem';

export function Insumos({ papel }: { papel: Papel }) {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [contagem, setContagem] = useState(false);
  const [novo, setNovo] = useState(false);
  const gerencia = pode(papel, 'estoque.catalogo');
  const lista = useConsulta(`estoque/insumos?${situacao}`, () => estoque.insumos({ situacao: situacao || undefined }));

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (lista.dados?.itens ?? []).filter((i) => !t || i.nome.toLowerCase().includes(t) || (i.categoria ?? '').toLowerCase().includes(t));
  }, [lista.dados, busca]);

  const colunas: Coluna<Insumo>[] = [
    { id: 'nome', titulo: 'Insumo', ordenar: (i) => i.nome, celula: (i) => <><span class="principal-celula">{i.nome}</span>{i.categoria && <span class="sub">{i.categoria}</span>}</> },
    { id: 'unidade', titulo: 'Unidade', prioridade: 'baixa', celula: (i) => <span class="fraco">{UNIDADE_CURTA[i.unidade_base]}</span> },
    { id: 'saldo', titulo: 'Saldo', numero: true, ordenar: (i) => num(i.saldo), celula: (i) => <span class={`num${Number(i.saldo) < 0 ? ' forte' : ''}`} style={Number(i.saldo) < 0 ? { color: 'var(--perigo)' } : undefined}>{quantidade(i.saldo, i.unidade_base)}</span> },
    { id: 'custo', titulo: 'Custo médio', numero: true, prioridade: 'media', ordenar: (i) => num(i.custo_medio), celula: (i) => <span class="num">{custoBase(i.custo_medio, i.unidade_base)}</span> },
    { id: 'atualizado', titulo: 'Última atualização', prioridade: 'baixa', ordenar: (i) => ultima(i) ?? '', celula: (i) => <span class="fraco">{ultima(i) ? relativo(ultima(i)) : 'Nunca'}</span> },
    { id: 'confiavel', titulo: 'Saldo', prioridade: 'media', celula: (i) => <SituacaoSaldo i={i} /> },
  ];

  return (
    <>
      <Cartao justo>
        <div class="filtros" style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }}>
          <div class="entrada-grupo">
            <Search aria-hidden="true" />
            <input class="entrada" type="search" placeholder="Buscar insumo ou categoria" aria-label="Buscar insumo" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
          </div>
          <select class="selecao" aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.currentTarget.value)}>
            <option value="">Todos os ativos</option>
            <option value="abaixo_minimo">Abaixo do mínimo</option>
            <option value="negativo">Saldo negativo</option>
            <option value="inativo">Inativos</option>
          </select>
          <span style={{ flex: 1 }} />
          <Botao icone={<ClipboardList aria-hidden="true" />} onClick={() => setContagem(true)}>Contagem</Botao>
          {gerencia && <Botao icone={<Plus aria-hidden="true" />} onClick={() => setNovo(true)}>Novo insumo</Botao>}
        </div>
        <Dados consulta={lista} recurso="Os insumos" esqueleto={<EsqueletoTabela />}>
          {() => (
            <Tabela
              rotulo="Insumos"
              colunas={colunas}
              linhas={filtrados}
              chave={(i) => i.id}
              aoAbrir={(i) => setAberto(i.id)}
              destaque={(i) => i.motivo_nao_confiavel === 'ficou_negativo'}
              apagada={(i) => !i.ativo}
              vazio={<Vazio compacto titulo={busca ? 'Nenhum insumo com esse nome' : 'Nenhum insumo nesta situação'}>{gerencia ? 'Cadastre cada ingrediente uma vez; as compras passam a alimentar o saldo.' : undefined}</Vazio>}
            />
          )}
        </Dados>
      </Cartao>
      <DetalheInsumo id={aberto} aoFechar={() => setAberto(null)} gerencia={gerencia} />
      <Contagem aberta={contagem} aoFechar={() => setContagem(false)} />
      <NovoInsumo aberto={novo} aoFechar={() => setNovo(false)} aoCriar={(id) => { setNovo(false); setAberto(id); }} />
    </>
  );
}

const ultima = (i: Insumo) => [i.ultima_compra_em, i.ultima_contagem_em].filter(Boolean).sort().at(-1) ?? null;

const TIPO_MOV: Record<MovimentoEstoque['tipo'], string> = {
  saldo_inicial: 'Saldo inicial',
  entrada_compra: 'Compra recebida',
  consumo_venda: 'Venda',
  estorno_consumo: 'Venda cancelada (volta)',
  producao_saida: 'Usado em preparo',
  producao_entrada: 'Preparo produzido',
  perda: 'Perda',
  ajuste_inventario: 'Ajuste da contagem',
  estorno: 'Estorno',
};
const MOTIVO_PERDA = { vencido: 'Venceu', quebra: 'Quebrou ou estragou', preparo: 'Sobra de preparo', outro: 'Outro motivo' } as const;

function DetalheInsumo({ id, aoFechar, gerencia }: { id: string | null; aoFechar: () => void; gerencia: boolean }) {
  const consulta = useConsulta(id ? `estoque/insumos/${id}` : null, () => estoque.insumo(id!));
  const [modo, setModo] = useState<'ver' | 'editar' | 'perda'>('ver');
  const [movs, setMovs] = useState<{ id: string; itens: MovimentoEstoque[]; proximo: number | null; carregando: boolean } | null>(null);
  const i = consulta.dados;

  const [versaoMovs, setVersaoMovs] = useState(0);
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    setModo('ver');
    setMovs({ id, itens: [], proximo: null, carregando: true });
    estoque.movimentos(id).then((r) => vivo && setMovs({ id, itens: r.itens, proximo: r.proximo, carregando: false })).catch(() => vivo && setMovs({ id, itens: [], proximo: null, carregando: false }));
    return () => void (vivo = false);
  }, [id, versaoMovs]);
  const mais = async () => {
    if (!movs?.proximo || !id) return;
    setMovs({ ...movs, carregando: true });
    try {
      const r = await estoque.movimentos(id, movs.proximo);
      setMovs({ id, itens: [...movs.itens, ...r.itens], proximo: r.proximo, carregando: false });
    } catch {
      setMovs({ ...movs, carregando: false });
    }
  };
  const recarregarMovs = () => setVersaoMovs((v) => v + 1);

  return (
    <Gaveta
      aberta={!!id}
      aoFechar={aoFechar}
      titulo={i?.nome ?? 'Insumo'}
      subtitulo={i ? `${i.categoria ?? 'Sem categoria'} · em ${UNIDADE[i.unidade_base]}` : undefined}
      largura="media"
      rodape={
        i && modo === 'ver' ? (
          <>
            <Botao icone={<Trash2 aria-hidden="true" />} onClick={() => setModo('perda')}>Registrar perda</Botao>
            {gerencia && <Botao icone={<Pencil aria-hidden="true" />} onClick={() => setModo('editar')}>Editar</Botao>}
          </>
        ) : undefined
      }
    >
      <Dados consulta={consulta} recurso="O insumo" esqueleto={<Esqueleto linhas={8} />}>
        {(i: InsumoDetalhe) =>
          modo === 'editar' ? (
            <EditarInsumo i={i} aoTerminar={() => { setModo('ver'); consulta.recarregar(); }} />
          ) : modo === 'perda' ? (
            <Perda i={i} aoTerminar={(ok) => { setModo('ver'); if (ok) { consulta.recarregar(); recarregarMovs(); } }} />
          ) : (
            <>
              <section class="indicadores indicadores--3" style={{ gap: '10px' }}>
                <div class="cartao indicador"><span class="indicador__rotulo">Saldo registrado</span><span class="indicador__valor indicador__valor--m num">{quantidade(i.saldo, i.unidade_base)}</span></div>
                <div class="cartao indicador"><span class="indicador__rotulo">Custo médio</span><span class="indicador__valor indicador__valor--m num">{custoBase(i.custo_medio, i.unidade_base)}</span></div>
                <div class="cartao indicador"><span class="indicador__rotulo">Mínimo</span><span class="indicador__valor indicador__valor--m num">{quantidade(i.estoque_minimo, i.unidade_base)}</span></div>
              </section>
              {!i.saldo_confiavel && i.motivo_nao_confiavel && (
                <Aviso tom={i.motivo_nao_confiavel === 'ficou_negativo' ? 'perigo' : 'atencao'} icone={<ShieldAlert aria-hidden="true" />}>
                  <strong>{CONFIABILIDADE[i.motivo_nao_confiavel].rotulo}.</strong> {CONFIABILIDADE[i.motivo_nao_confiavel].explica}
                </Aviso>
              )}
              <dl class="definicoes">
                <dt>Prazo de reposição</dt>
                <dd>{i.prazo_reposicao_dias ? `${i.prazo_reposicao_dias} dias` : <span class="fraco">Não informado</span>}</dd>
                <dt>Tipo</dt>
                <dd>{i.tipo === 'preparo' ? 'Preparo da casa' : 'Comprado pronto'}</dd>
                <dt>Situação</dt>
                <dd>{i.ativo ? 'Ativo' : 'Inativo'}</dd>
              </dl>

              <section class="pilha pilha--p">
                <h3 class="secao-titulo">Últimos preços pagos</h3>
                {i.precos.length ? (
                  <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '10px' }}>
                    {i.precos.slice(0, 6).map((p, k) => (
                      <li key={k} class="linha linha--entre" style={{ padding: '8px 14px' }}>
                        <span class="fraco">{dataHora(p.ocorreu_em)}</span>
                        <span class="num">{quantidade(p.quantidade, i.unidade_base)} · <strong>{custoBase(p.custo_unitario, i.unidade_base)}</strong></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p class="fraco">Nenhuma compra registrada ainda.</p>
                )}
              </section>

              {i.usado_em.length > 0 && (
                <section class="pilha pilha--p">
                  <h3 class="secao-titulo">Usado em</h3>
                  <div class="linha">{i.usado_em.map((u) => <Etiqueta key={u.nome}>{u.nome} · {quantidade(u.quantidade, i.unidade_base)}</Etiqueta>)}</div>
                </section>
              )}

              <section class="pilha pilha--p">
                <h3 class="secao-titulo">Movimentações</h3>
                {movs && movs.itens.length ? (
                  <>
                    <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '10px' }}>
                      {movs.itens.map((m) => (
                        <li key={m.id} style={{ padding: '10px 14px' }}>
                          <div class="linha linha--entre" style={{ flexWrap: 'nowrap' }}>
                            <span>
                              <strong style={{ fontWeight: 500 }}>{TIPO_MOV[m.tipo] ?? m.tipo}</strong>
                              <span class="fraco" style={{ display: 'block' }}>{dataHora(m.ocorreu_em)}{m.motivo ? ` · ${MOTIVO_PERDA[m.motivo as keyof typeof MOTIVO_PERDA] ?? m.motivo}` : ''}{m.registrado_por ? ` · ${m.registrado_por}` : ''}</span>
                            </span>
                            <span class="num direita">
                              <strong style={{ color: Number(m.quantidade) < 0 ? 'var(--perigo)' : 'var(--ok)' }}>{Number(m.quantidade) > 0 ? '+' : ''}{quantidade(m.quantidade, i.unidade_base)}</strong>
                              <span class="fraco" style={{ display: 'block' }}>saldo {quantidade(m.saldo_apos, i.unidade_base)}</span>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {movs.proximo && <Botao tamanho="p" carregando={movs.carregando} onClick={mais}>Carregar mais</Botao>}
                  </>
                ) : movs?.carregando ? (
                  <Esqueleto linhas={3} />
                ) : (
                  <p class="fraco">Nenhuma movimentação.</p>
                )}
              </section>
            </>
          )
        }
      </Dados>
    </Gaveta>
  );
}

function EditarInsumo({ i, aoTerminar }: { i: InsumoDetalhe; aoTerminar: () => void }) {
  const [f, setF] = useState({ nome: i.nome, categoria: i.categoria ?? '', minimo: i.estoque_minimo === null ? '' : String(Number(i.estoque_minimo)), prazo: i.prazo_reposicao_dias === null ? '' : String(i.prazo_reposicao_dias), ativo: i.ativo });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  async function salvar(e: Event) {
    e.preventDefault();
    if (!f.nome.trim()) return setErro(new ErroApi('validacao', 'Informe o nome.'));
    setEnviando(true);
    setErro(null);
    try {
      await estoque.alterarInsumo(i.id, { versao: i.versao, nome: f.nome.trim(), categoria: f.categoria.trim() || null, estoque_minimo: f.minimo === '' ? null : String(Number(f.minimo.replace(',', '.'))), prazo_reposicao_dias: f.prazo === '' ? null : Number(f.prazo), ativo: f.ativo });
      atualizarEstoque();
      avisar('Insumo atualizado.', 'ok');
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
        <Campo rotulo="Nome" class="inteiro" erro={erro?.campos.nome}>{(id) => <input id={id} class="entrada" value={f.nome} onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} />}</Campo>
        <Campo rotulo="Categoria" opcional>{(id) => <input id={id} class="entrada" value={f.categoria} onInput={(e) => setF({ ...f, categoria: e.currentTarget.value })} />}</Campo>
        <Campo rotulo={`Estoque mínimo (${UNIDADE_CURTA[i.unidade_base]})`} opcional ajuda="Abaixo disso, o insumo aparece no Resumo.">{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
        <Campo rotulo="Prazo de reposição (dias)" opcional ajuda="Quanto o fornecedor leva para entregar.">{(id, d) => <input id={id} class="entrada num" type="number" min={0} max={90} aria-describedby={d} value={f.prazo} onInput={(e) => setF({ ...f, prazo: e.currentTarget.value })} />}</Campo>
        <label class="marcar inteiro"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.currentTarget.checked })} /> Insumo ativo (aparece nas buscas e nas compras)</label>
      </div>
      <p class="fraco">A unidade-base ({UNIDADE[i.unidade_base]}) não muda por aqui: ela define como todas as compras e fichas são convertidas.</p>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={aoTerminar} disabled={enviando}>Voltar</Botao>
        <Botao type="submit" variante="primario" carregando={enviando}>Salvar</Botao>
      </div>
    </form>
  );
}

function Perda({ i, aoTerminar }: { i: InsumoDetalhe; aoTerminar: (ok: boolean) => void }) {
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState<keyof typeof MOTIVO_PERDA>('vencido');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const chave = useRef(novaChave());
  const n = Number(qtd.replace(',', '.'));
  async function enviar(e: Event) {
    e.preventDefault();
    if (!(n > 0)) return setErro('Informe a quantidade perdida.');
    if (motivo === 'outro' && obs.trim().length < 3) return setErro('Conte rapidamente o que aconteceu.');
    setEnviando(true);
    setErro(null);
    try {
      await estoque.registrarPerda({ insumo_id: i.id, quantidade: String(n), motivo, observacao: obs.trim() || undefined }, chave.current);
      atualizarEstoque();
      avisar('Perda registrada.', 'ok');
      aoTerminar(true);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível registrar.');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form class="pilha" onSubmit={enviar} noValidate>
      <h3 class="secao-titulo">Registrar perda</h3>
      <p class="suave">Para perdas que valem registro (vencido, quebra, sobra de preparo). Sai do saldo ao custo médio.</p>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <div class="grade-campos">
        <Campo rotulo={`Quantidade (${UNIDADE_CURTA[i.unidade_base]})`} ajuda={i.unidade_base === 'g' ? 'Em gramas: 1 kg = 1000.' : i.unidade_base === 'ml' ? 'Em mililitros: 1 L = 1000.' : undefined}>
          {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={qtd} onInput={(e) => setQtd(e.currentTarget.value)} data-autofoco />}
        </Campo>
        <Campo rotulo="Motivo">
          {(id) => (
            <select id={id} class="selecao" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value as keyof typeof MOTIVO_PERDA)}>
              {Object.entries(MOTIVO_PERDA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Observação" opcional={motivo !== 'outro'} class="inteiro">{(id) => <textarea id={id} class="area" maxLength={300} value={obs} onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
      </div>
      {n > 0 && i.custo_medio && <p class="fraco">Valor estimado da perda: <strong class="num">{(n * Number(i.custo_medio)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={() => aoTerminar(false)} disabled={enviando}>Voltar</Botao>
        <Botao type="submit" variante="primario" carregando={enviando}>Registrar perda</Botao>
      </div>
    </form>
  );
}

function NovoInsumo({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [f, setF] = useState({ nome: '', unidade: 'g' as UnidadeBase, categoria: '', minimo: '' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  async function criar(e: Event) {
    e.preventDefault();
    if (f.nome.trim().length < 2) return setErro(new ErroApi('validacao', 'Informe o nome do insumo.'));
    setEnviando(true);
    setErro(null);
    try {
      const r = await estoque.criarInsumo({ nome: f.nome.trim(), unidade_base: f.unidade, categoria: f.categoria.trim() || null, estoque_minimo: f.minimo ? String(Number(f.minimo.replace(',', '.'))) : null });
      atualizarEstoque();
      avisar('Insumo cadastrado.', 'ok');
      setF({ nome: '', unidade: 'g', categoria: '', minimo: '' });
      aoCriar(r.id);
    } catch (x) {
      setErro(x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível cadastrar.'));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Gaveta aberta={aberto} aoFechar={aoFechar} titulo="Novo insumo" subtitulo="Cada ingrediente uma vez só" rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-novo-insumo" carregando={enviando}>Cadastrar</Botao></>}>
      <form id="form-novo-insumo" class="pilha" onSubmit={criar} noValidate>
        {erro && (
          <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>
            {erro.message}
            {erro.codigo === 'nome_ja_existe' && typeof erro.dados?.id === 'string' && <div style={{ marginTop: '6px' }}><Botao tamanho="p" onClick={() => aoCriar(String(erro.dados!.id))}>Abrir o insumo existente</Botao></div>}
          </Aviso>
        )}
        <Campo rotulo="Nome">{(id) => <input id={id} class="entrada" value={f.nome} placeholder="Ex.: Leite integral" onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} data-autofoco />}</Campo>
        <Campo rotulo="Unidade-base" ajuda="Como o insumo é medido nas fichas. Compras em kg, caixa ou litro são convertidas para ela.">
          {(id, d) => (
            <select id={id} class="selecao" aria-describedby={d} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.currentTarget.value as UnidadeBase })}>
              <option value="g">Gramas (g) — sólidos</option>
              <option value="ml">Mililitros (ml) — líquidos</option>
              <option value="un">Unidades (un) — ovos, pães…</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Categoria" opcional>{(id) => <input id={id} class="entrada" value={f.categoria} placeholder="Ex.: Laticínios" onInput={(e) => setF({ ...f, categoria: e.currentTarget.value })} />}</Campo>
        <Campo rotulo={`Estoque mínimo (${f.unidade})`} opcional>{(id) => <input id={id} class="entrada num" inputMode="decimal" value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
      </form>
    </Gaveta>
  );
}

