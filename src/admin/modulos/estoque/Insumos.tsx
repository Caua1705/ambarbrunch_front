// Insumos: ingredientes com saldo, custo médio, cobertura e confiabilidade — tudo calculado pelo backend. Detalhe,
// histórico, perda e edição em gaveta; a ficha técnica de um preparo abre da mesma gaveta. A contagem física tem aba
// própria (Contagem). Catálogo e edição: estoque.editar; perda: estoque.visualizar.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Search, ClipboardList, Plus, Trash2, Pencil, ShieldAlert, Info, ChefHat } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque, type FiltroInsumos } from '../../lib/api/estoque';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { quantidade, custoBase, relativo, dataHora, num, decimal, plural } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Cartao, Aviso, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { Insumo, InsumoDetalhe, MovimentoEstoque, UnidadeBase } from '../../lib/tipos/estoque';
import { SituacaoSaldo, CONFIABILIDADE, UNIDADE, UNIDADE_CURTA, TIPO_MOVIMENTO, atualizarEstoque, quantidadeDigitada, type PermissoesEstoque } from './comum';
import { GavetaFicha, type AlvoFicha } from './Fichas';
import type { AbaEstoque } from './index';

const ESPERA_BUSCA_MS = 250;
const CONTROLE = { explodir: 'Explode na venda', lote: 'Produção em lote' } as const;

export function Insumos({ perm, aoIr }: { perm: PermissoesEstoque; aoIr: (aba: AbaEstoque) => void }) {
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<FiltroInsumos['situacao'] | ''>('');
  const [tipo, setTipo] = useState<FiltroInsumos['tipo'] | ''>('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [ficha, setFicha] = useState<AlvoFicha | null>(null);
  // A busca vai ao backend (nome e código), com uma pequena espera para não consultar a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusca(digitado.trim()), ESPERA_BUSCA_MS);
    return () => clearTimeout(t);
  }, [digitado]);
  const lista = useConsulta(`estoque/insumos?${situacao}:${tipo}:${busca}`, () => estoque.insumos({ busca: busca || undefined, situacao: situacao || undefined, tipo: tipo || undefined }));

  const colunas: Coluna<Insumo>[] = [
    { id: 'nome', titulo: 'Insumo', ordenar: (i) => i.nome, celula: (i) => <><span class="principal-celula">{i.nome}</span><span class="sub">{[i.categoria, i.tipo === 'preparo' ? `preparo · ${CONTROLE[i.controle_preparo ?? 'explodir'].toLowerCase()}` : null].filter(Boolean).join(' · ') || UNIDADE[i.unidade_base]}</span></> },
    { id: 'saldo', titulo: 'Saldo', numero: true, ordenar: (i) => num(i.saldo), celula: (i) => <><span class={`num${Number(i.saldo) < 0 || i.abaixo_minimo ? ' forte' : ''}`} style={Number(i.saldo) < 0 || (i.abaixo_minimo && i.saldo_confiavel) ? { color: 'var(--perigo)' } : undefined}>{quantidade(i.saldo, i.unidade_base)}</span>{i.abaixo_minimo && <span class="sub">abaixo do mínimo</span>}</> },
    { id: 'minimo', titulo: 'Mínimo', numero: true, prioridade: 'baixa', ordenar: (i) => num(i.estoque_minimo), celula: (i) => <span class="num fraco">{quantidade(i.estoque_minimo, i.unidade_base)}</span> },
    { id: 'custo', titulo: 'Custo médio', numero: true, prioridade: 'media', ordenar: (i) => num(i.custo_medio), celula: (i) => <span class="num">{custoBase(i.custo_medio, i.unidade_base)}</span> },
    { id: 'cobertura', titulo: 'Cobertura', numero: true, prioridade: 'baixa', ordenar: (i) => num(i.cobertura_dias), celula: (i) => <span class="num fraco">{i.saldo_confiavel && i.cobertura_dias !== null ? `${decimal(i.cobertura_dias, 1)} dias` : '—'}</span> },
    { id: 'compra', titulo: 'Última compra', prioridade: 'baixa', ordenar: (i) => i.ultima_compra_em ?? '', celula: (i) => <span class="fraco">{i.ultima_compra_em ? relativo(i.ultima_compra_em) : 'Nunca'}</span> },
    { id: 'confiavel', titulo: 'Confiabilidade', prioridade: 'media', celula: (i) => <SituacaoSaldo i={i} /> },
  ];

  return (
    <>
      <Cartao justo>
        <div class="filtros" style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }}>
          <div class="entrada-grupo">
            <Search aria-hidden="true" />
            <input class="entrada" type="search" placeholder="Buscar por nome ou código" aria-label="Buscar insumo" value={digitado} onInput={(e) => setDigitado(e.currentTarget.value)} />
          </div>
          <select class="selecao" aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.currentTarget.value as FiltroInsumos['situacao'] | '')}>
            <option value="">Todos os ativos</option>
            <option value="abaixo_minimo">Abaixo do mínimo</option>
            <option value="negativo">Saldo negativo</option>
            <option value="inativo">Inativos</option>
          </select>
          <select class="selecao" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.currentTarget.value as FiltroInsumos['tipo'] | '')}>
            <option value="">Comprados e preparos</option>
            <option value="comprado">Só comprados</option>
            <option value="preparo">Só preparos</option>
          </select>
          <span style={{ flex: 1 }} />
          <Botao icone={<ClipboardList aria-hidden="true" />} onClick={() => aoIr('contagem')}>Contagem</Botao>
          {perm.editar && <Botao icone={<Plus aria-hidden="true" />} onClick={() => setNovo(true)}>Novo insumo</Botao>}
        </div>
        <Dados consulta={lista} recurso="Os insumos" esqueleto={<EsqueletoTabela />}>
          {(d) => (
            <>
              <Tabela
                rotulo="Insumos"
                colunas={colunas}
                linhas={d.itens}
                chave={(i) => i.id}
                aoAbrir={(i) => setAberto(i.id)}
                destaque={(i) => i.motivo_nao_confiavel === 'ficou_negativo'}
                apagada={(i) => !i.ativo}
                vazio={<Vazio compacto titulo={busca ? 'Nenhum insumo com essa busca' : 'Nenhum insumo nesta situação'}>{perm.editar && !busca ? 'Cadastre cada ingrediente uma vez; as compras passam a alimentar o saldo.' : undefined}</Vazio>}
              />
              {d.total > d.itens.length && <div class="cartao__rodape">Mostrando {d.itens.length} de {plural(d.total, 'insumo', 'insumos')}: use a busca para achar os demais.</div>}
            </>
          )}
        </Dados>
      </Cartao>
      <DetalheInsumo id={aberto} aoFechar={() => setAberto(null)} perm={perm} aoFicha={(i) => { setAberto(null); setFicha({ alvo: 'preparo', id: i.id, nome: i.nome, unidade: i.unidade_base }); }} />
      <NovoInsumo aberto={novo} aoFechar={() => setNovo(false)} aoCriar={(id) => { setNovo(false); setAberto(id); }} />
      <GavetaFicha alvo={ficha} aoFechar={() => setFicha(null)} />
    </>
  );
}

const MOTIVO_PERDA = { vencido: 'Venceu', quebra: 'Quebrou ou estragou', preparo: 'Sobra de preparo', outro: 'Outro motivo' } as const;

function DetalheInsumo({ id, aoFechar, perm, aoFicha }: { id: string | null; aoFechar: () => void; perm: PermissoesEstoque; aoFicha: (i: InsumoDetalhe) => void }) {
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
      subtitulo={i ? `${i.tipo === 'preparo' ? 'Preparo da casa' : 'Comprado'} · ${i.categoria ?? 'sem categoria'} · em ${UNIDADE[i.unidade_base]}${i.ativo ? '' : ' · inativo'}` : undefined}
      largura="media"
      rodape={
        i && modo === 'ver' ? (
          <>
            {perm.editar && i.tipo === 'preparo' && <Botao icone={<ChefHat aria-hidden="true" />} onClick={() => aoFicha(i)}>Ficha técnica do preparo</Botao>}
            {perm.visualizar && <Botao icone={<Trash2 aria-hidden="true" />} onClick={() => setModo('perda')}>Registrar perda</Botao>}
            {perm.editar && <Botao icone={<Pencil aria-hidden="true" />} onClick={() => setModo('editar')}>Editar</Botao>}
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
                <dt>Código</dt>
                <dd class="num">{i.codigo}</dd>
                <dt>Prazo de reposição</dt>
                <dd>{i.prazo_reposicao_dias !== null ? plural(i.prazo_reposicao_dias, 'dia', 'dias') : <span class="fraco">Não informado</span>}</dd>
                <dt>Tipo</dt>
                <dd>{i.tipo === 'preparo' ? `Preparo da casa · ${CONTROLE[i.controle_preparo ?? 'explodir'].toLowerCase()}` : 'Comprado pronto'}</dd>
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
                  <p class="fraco">Nenhuma compra confirmada deste insumo.</p>
                )}
              </section>

              <section class="pilha pilha--p">
                <h3 class="secao-titulo">Usado em</h3>
                {i.usado_em.length ? (
                  <div class="linha">{i.usado_em.map((u, k) => <Etiqueta key={k}>{u.nome ?? u.eye_product_id ?? 'Ficha'}{u.alvo === 'preparo' ? ' (preparo)' : ''} · {quantidade(u.quantidade, i.unidade_base)}</Etiqueta>)}</div>
                ) : (
                  <p class="fraco">Nenhuma ficha técnica usa este insumo.</p>
                )}
              </section>

              <section class="pilha pilha--p">
                <h3 class="secao-titulo">Movimentações</h3>
                {movs && movs.itens.length ? (
                  <>
                    <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '10px' }}>
                      {movs.itens.map((m) => (
                        <li key={m.id} style={{ padding: '10px 14px' }}>
                          <div class="linha linha--entre" style={{ flexWrap: 'nowrap' }}>
                            <span>
                              <strong style={{ fontWeight: 500 }}>{TIPO_MOVIMENTO[m.tipo] ?? m.tipo}</strong>
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
                    {movs.proximo && <Botao tamanho="p" carregando={movs.carregando} onClick={mais}>Ver mais antigas</Botao>}
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
        <Campo rotulo={`Estoque mínimo (${UNIDADE_CURTA[i.unidade_base]})`} opcional ajuda="Abaixo disso, o insumo aparece no Resumo.">{(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={f.minimo} onInput={(e) => setF({ ...f, minimo: e.currentTarget.value })} />}</Campo>
        <Campo rotulo="Prazo de reposição (dias)" opcional ajuda="Quanto o fornecedor leva para entregar. Entra na sugestão de reposição.">{(id, d) => <input id={id} class="entrada num" type="number" min={0} max={90} aria-describedby={d} value={f.prazo} onInput={(e) => setF({ ...f, prazo: e.currentTarget.value })} />}</Campo>
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
        <label class="marcar inteiro"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.currentTarget.checked })} /> Insumo ativo (aparece nas buscas, nas compras e na contagem)</label>
      </div>
      <p class="fraco">A unidade-base ({UNIDADE[i.unidade_base]}) não muda por aqui depois que há movimentos: ela define como todas as compras e fichas são convertidas.</p>
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
  // Uma chave por formulário: reenviar depois de uma falha de rede não lança a perda duas vezes.
  const chave = useRef(novaChave());
  async function enviar(e: Event) {
    e.preventDefault();
    const q = quantidadeDigitada(qtd);
    if (!q || !(Number(q) > 0)) return setErro('Informe a quantidade perdida.');
    if (motivo === 'outro' && obs.trim().length < 3) return setErro('Conte rapidamente o que aconteceu.');
    setEnviando(true);
    setErro(null);
    try {
      await estoque.registrarPerda({ insumo_id: i.id, quantidade: q, motivo, observacao: obs.trim() || undefined }, chave.current);
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
      <p class="suave">Para perdas que valem registro (vencido, quebra, sobra de preparo). Sai do saldo ao custo médio; pequenas variações ficam para a contagem.</p>
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
        <Campo rotulo="Observação" opcional={motivo !== 'outro'} class="inteiro">{(id) => <textarea id={id} class="area" maxLength={200} value={obs} onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
      </div>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao onClick={() => aoTerminar(false)} disabled={enviando}>Voltar</Botao>
        <Botao type="submit" variante="primario" carregando={enviando}>Registrar perda</Botao>
      </div>
    </form>
  );
}

function NovoInsumo({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (id: string) => void }) {
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
    <Gaveta aberta={aberto} aoFechar={aoFechar} titulo="Novo insumo" subtitulo="Cada ingrediente uma vez só" rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-novo-insumo" carregando={enviando}>Cadastrar</Botao></>}>
      <form id="form-novo-insumo" class="pilha" onSubmit={criar} noValidate>
        {erro && (
          <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>
            {erro.message}
            {existente && <div style={{ marginTop: '6px' }}><Botao tamanho="p" onClick={() => aoCriar(existente)}>Abrir o insumo existente</Botao></div>}
          </Aviso>
        )}
        <Campo rotulo="Nome">{(id) => <input id={id} class="entrada" maxLength={120} value={f.nome} placeholder="Ex.: Leite integral" onInput={(e) => setF({ ...f, nome: e.currentTarget.value })} data-autofoco />}</Campo>
        <Campo rotulo="Unidade-base" ajuda="Como o insumo é medido nas fichas. Compras em kg, caixa ou litro são convertidas para ela.">
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
