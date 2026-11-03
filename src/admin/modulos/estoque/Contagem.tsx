// Contagem (inventário) em três passos: 1) selecionar itens → 2) informar quantidades → 3) revisar e confirmar.
// Há no máximo uma contagem aberta por unidade e quem diz qual é o backend (GET …/inventarios?status=aberto): ela pode ser
// retomada em qualquer aparelho, e cada número é salvo ao sair do campo. A revisão mostra a diferença PREVISTA (contado
// − saldo de agora); o ajuste oficial é o do backend, calculado no instante da confirmação, e cada ajuste vira um
// movimento ligado à contagem e a quem confirmou. Item nunca conferido é "abertura": a contagem vira o saldo de partida.
import { useMemo, useState } from 'preact/hooks';
import { Check, Info, Search, CheckCircle2, History, ArrowLeft } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { relativo, plural, dataHora } from '../../lib/formato';
import { Gaveta, useConfirmacao, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Aviso, Etiqueta, Cartao, Situacao, type Tom } from '../../ui/base';
import { Dados, Esqueleto, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { FechamentoInventario, Insumo, Inventario, InventarioResumo, StatusInventario, UnidadeBase } from '../../lib/tipos/estoque';
import { atualizarEstoque, conferido, numeroEm, paraBase, situacaoEstoque, unidadeExibicao, type PermissoesEstoque } from './comum';

const STATUS: Record<StatusInventario, { rotulo: string; tom: Tom }> = { aberto: { rotulo: 'Em andamento', tom: 'atencao' }, fechado: { rotulo: 'Confirmada', tom: 'ok' }, cancelado: { rotulo: 'Cancelada', tom: 'apagado' } };
const atualizarContagem = () => invalidar('estoque/inventarios');
type Escopo = 'prioritarios' | 'todos' | 'escolher';

export function Contagem({ perm, inicioControle, responsavel }: { perm: PermissoesEstoque; inicioControle: string | null; responsavel: (r: string | null | undefined, nome?: string | null) => string | null }) {
  const aberta = useConsulta('estoque/inventarios?aberto', () => estoque.inventarios({ status: 'aberto', limite: 1 }));
  const catalogo = useConsulta('estoque/insumos?catalogo', () => estoque.insumos({ limite: 200 }));
  const [revisar, setRevisar] = useState(false);
  const [resultado, setResultado] = useState<{ r: FechamentoInventario; aberturas: Set<string> } | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  const id = aberta.dados?.[0]?.id ?? null;
  const porId = useMemo(() => new Map((catalogo.dados?.itens ?? []).map((i) => [i.id, i])), [catalogo.dados]);
  const passo = resultado ? 3 : !id ? 1 : revisar ? 3 : 2;

  return (
    <>
      <Passos atual={passo} />
      {resultado ? (
        <Resultado r={resultado.r} aberturas={resultado.aberturas} aoConcluir={() => setResultado(null)} />
      ) : (
        <Dados consulta={aberta} recurso="A contagem" esqueleto={<Esqueleto linhas={8} />}>
          {() =>
            !id ? (
              <Selecionar perm={perm} catalogo={catalogo.dados?.itens ?? []} inicioControle={inicioControle} />
            ) : (
              <ContagemAberta id={id} perm={perm} porId={porId} inicioControle={inicioControle} revisar={revisar} aoRevisar={setRevisar} aoConfirmar={(r, aberturas) => { setRevisar(false); setResultado({ r, aberturas }); }} />
            )
          }
        </Dados>
      )}
      <Historico responsavel={responsavel} aoVer={setVer} />
      <DetalheContagem id={ver} aoFechar={() => setVer(null)} />
    </>
  );
}

const PASSOS = ['Selecionar itens', 'Informar quantidades', 'Revisar e confirmar'];
function Passos({ atual }: { atual: number }) {
  return (
    <ol class="guia-passos" aria-label="Passos da contagem">
      {PASSOS.map((p, i) => {
        const n = i + 1;
        const estado = n < atual ? 'feito' : n === atual ? 'atual' : 'depois';
        return (
          <li key={p} class={`guia-passos__item guia-passos__item--${estado}`} aria-current={estado === 'atual' ? 'step' : undefined}>
            <span class="guia-passos__num" aria-hidden="true">{estado === 'feito' ? <Check /> : n}</span>
            <span class="guia-passos__texto">{p}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Passo 1: o que contar. Prioritários = abaixo do mínimo/sem estoque + o que o backend sugere (negativos, nunca contados,
 *  mais usados). Um botão só para começar. */
function Selecionar({ perm, catalogo, inicioControle }: { perm: PermissoesEstoque; catalogo: Insumo[]; inicioControle: string | null }) {
  const sugestao = useConsulta('estoque/inventarios/sugestao', () => estoque.sugestaoInventario());
  const [escopo, setEscopo] = useState<Escopo>('prioritarios');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ativos = catalogo.filter((i) => i.ativo);
  const prioritarios = useMemo(() => {
    const ids = new Set<string>();
    for (const i of ativos) {
      const s = situacaoEstoque(i, inicioControle);
      if (s === 'baixo' || s === 'sem') ids.add(i.id);
    }
    for (const s of sugestao.dados ?? []) ids.add(s.insumo_id);
    return [...ids];
  }, [catalogo, sugestao.dados, inicioControle]);
  const nomes = new Map(ativos.map((i) => [i.id, i.nome]));
  for (const s of sugestao.dados ?? []) if (!nomes.has(s.insumo_id)) nomes.set(s.insumo_id, s.insumo);
  const naoConferidos = ativos.filter((i) => !conferido(i, inicioControle)).length;
  const t = busca.trim().toLowerCase();
  const visiveis = ativos.filter((i) => !t || i.nome.toLowerCase().includes(t) || (i.categoria ?? '').toLowerCase().includes(t));
  const quantos = escopo === 'prioritarios' ? prioritarios.length : escopo === 'todos' ? ativos.length : marcados.size;

  async function comecar() {
    if (!quantos) return;
    setEnviando(true);
    try {
      if (escopo === 'todos') await estoque.abrirInventario('total');
      else await estoque.abrirInventario('lista', escopo === 'prioritarios' ? prioritarios : [...marcados]);
      avisar('Contagem começada. Pode continuar em outro aparelho.', 'ok');
    } catch (e) {
      // Outra pessoa começou uma contagem neste meio-tempo: retoma a mesma.
      if (e instanceof ErroApi && e.codigo === 'inventario_aberto') avisar('Já havia uma contagem em andamento: retomando.', 'info');
      else avisarErro(e);
    } finally {
      setEnviando(false);
      atualizarContagem();
    }
  }
  const alternar = (id: string) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setMarcados(n);
  };

  return (
    <Cartao>
      <div class="pilha">
        <fieldset class="opcoes-contagem">
          <legend class="oculto-visual">O que contar</legend>
          <label class="opcao">
            <input type="radio" name="escopo" checked={escopo === 'prioritarios'} onChange={() => setEscopo('prioritarios')} />
            <span class="opcao__texto">
              <strong>Itens prioritários{sugestao.dados ? ` (${prioritarios.length})` : ''}</strong>
              <span>Abaixo do mínimo, sem estoque, nunca contados e os mais usados.</span>
              {escopo === 'prioritarios' && prioritarios.length > 0 && <span class="fraco">{prioritarios.slice(0, 8).map((id) => nomes.get(id) ?? 'Insumo').join(', ')}{prioritarios.length > 8 ? ` e mais ${prioritarios.length - 8}` : ''}.</span>}
            </span>
          </label>
          <label class="opcao">
            <input type="radio" name="escopo" checked={escopo === 'todos'} onChange={() => setEscopo('todos')} />
            <span class="opcao__texto">
              <strong>Todos os insumos ({ativos.length})</strong>
              <span>Inventário completo. Bom para a contagem inicial.</span>
            </span>
          </label>
          <label class="opcao">
            <input type="radio" name="escopo" checked={escopo === 'escolher'} onChange={() => setEscopo('escolher')} />
            <span class="opcao__texto">
              <strong>Escolher insumos{marcados.size ? ` (${marcados.size})` : ''}</strong>
              <span>Ex.: só a câmara fria ou o que acabou de chegar.</span>
            </span>
          </label>
        </fieldset>
        {escopo === 'escolher' && (
          <div class="pilha pilha--p">
            <div class="entrada-grupo" style={{ maxWidth: '360px' }}>
              <Search aria-hidden="true" />
              <input class="entrada" type="search" placeholder="Buscar insumo ou categoria" aria-label="Buscar insumo para contar" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
            </div>
            {visiveis.length ? (
              <ul class="escolha-insumos">
                {visiveis.map((i) => (
                  <li key={i.id}>
                    <label class="marcar">
                      <input type="checkbox" checked={marcados.has(i.id)} onChange={() => alternar(i.id)} />
                      <span>{i.nome}</span>
                      <span class="fraco">{i.categoria ?? ''}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio compacto titulo="Nenhum insumo com esse nome" />
            )}
          </div>
        )}
        {naoConferidos > 0 && <p class="fraco">{plural(naoConferidos, 'insumo ainda não foi conferido', 'insumos ainda não foram conferidos')}: a primeira contagem de cada um vira o saldo de partida (abertura do estoque).</p>}
        {perm.visualizar && (
          <Botao variante="primario" carregando={enviando} disabled={!quantos} onClick={comecar} style={{ alignSelf: 'flex-start' }}>
            Começar contagem{quantos ? ` (${plural(quantos, 'item', 'itens')})` : ''}
          </Botao>
        )}
      </div>
    </Cartao>
  );
}

type ItemInv = Inventario['itens'][number];

/** Unidade em que a linha é contada: a mesma da tela principal (kg/L para números grandes). */
function unidadeDaLinha(it: ItemInv, linha: Insumo | undefined) {
  return unidadeExibicao(it.unidade_base, linha?.saldo, linha?.estoque_minimo, it.quantidade_contada);
}

function ContagemAberta({ id, perm, porId, inicioControle, revisar, aoRevisar, aoConfirmar }: {
  id: string;
  perm: PermissoesEstoque;
  porId: Map<string, Insumo>;
  inicioControle: string | null;
  revisar: boolean;
  aoRevisar: (v: boolean) => void;
  aoConfirmar: (r: FechamentoInventario, aberturas: Set<string>) => void;
}) {
  const inv = useConsulta(`estoque/inventarios/${id}`, () => estoque.inventario(id));
  const [busca, setBusca] = useState('');
  const { confirmar, elemento } = useConfirmacao();
  const d = inv.dados;
  const contados = d?.itens.filter((i) => i.quantidade_contada !== null) ?? [];
  const total = d?.itens.length ?? 0;

  const cancelar = () =>
    confirmar({
      titulo: 'Cancelar a contagem?',
      texto: 'O que foi digitado é descartado e o estoque não muda.',
      confirmar: 'Cancelar contagem',
      perigo: true,
      acao: async () => {
        try {
          await estoque.cancelarInventario(id);
        } finally {
          aoRevisar(false);
          atualizarContagem();
        }
      },
      sucesso: 'Contagem cancelada.',
    });
  const fechar = () =>
    confirmar({
      titulo: 'Confirmar a contagem?',
      texto: `${plural(contados.length, 'item contado', 'itens contados')}. Cada diferença vira um ajuste no histórico, com o seu nome. O saldo usado é o deste instante.${total - contados.length ? ` ${plural(total - contados.length, 'item sem número fica', 'itens sem número ficam')} como está.` : ''}`,
      confirmar: 'Confirmar contagem',
      acao: async () => {
        try {
          const aberturas = new Set(contados.filter((i) => { const l = porId.get(i.insumo_id); return !l || !conferido(l, inicioControle); }).map((i) => i.insumo_id));
          aoConfirmar(await estoque.fecharInventario(id), aberturas);
        } finally {
          atualizarEstoque();
        }
      },
      sucesso: 'Contagem confirmada e estoque ajustado.',
    });

  const t = busca.trim().toLowerCase();
  const visiveis = (d?.itens ?? []).filter((i) => !t || i.insumo.toLowerCase().includes(t));

  return (
    <Cartao
      titulo={revisar ? 'Revisar as diferenças' : 'Informe o que tem na prateleira'}
      descricao={d ? `Começou ${relativo(d.aberto_em)} · ${contados.length} de ${total} contados` : undefined}
      acoes={perm.visualizar && d ? <Botao tamanho="p" variante="fantasma" onClick={cancelar}>Cancelar contagem</Botao> : undefined}
      justo
    >
      <Dados consulta={inv} recurso="A contagem" esqueleto={<div class="cartao__corpo"><Esqueleto linhas={8} /></div>}>
        {(d: Inventario) =>
          revisar ? (
            <Revisao itens={contados} faltam={total - contados.length} porId={porId} inicioControle={inicioControle} aoVoltar={() => aoRevisar(false)} aoConfirmar={fechar} />
          ) : (
            <div class="contagem-lista">
              {d.itens.length > 8 && (
                <div class="entrada-grupo contagem-lista__busca">
                  <Search aria-hidden="true" />
                  <input class="entrada" type="search" placeholder="Buscar insumo" aria-label="Buscar insumo na contagem" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
                </div>
              )}
              <div class="tabela-rolagem">
                <table class="tabela tabela-contagem" aria-label="Quantidades contadas">
                  <thead>
                    <tr><th>Insumo</th><th class="num" data-prioridade="media">Registrado</th><th class="num">Contado</th><th>Unidade</th></tr>
                  </thead>
                  <tbody>
                    {visiveis.map((it) => (
                      <LinhaContagem key={it.insumo_id} inventario={d.id} it={it} linha={porId.get(it.insumo_id)} inicioControle={inicioControle} editavel={perm.visualizar} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div class="contagem-lista__rodape">
                <span class="fraco">Cada número é salvo ao sair do campo: dá para continuar depois, em outro aparelho.</span>
                <Botao variante="primario" disabled={!contados.length} onClick={() => aoRevisar(true)}>Revisar diferenças</Botao>
              </div>
            </div>
          )
        }
      </Dados>
      {elemento}
    </Cartao>
  );
}

function LinhaContagem({ inventario, it, linha, inicioControle, editavel }: { inventario: string; it: ItemInv; linha: Insumo | undefined; inicioControle: string | null; editavel: boolean }) {
  const u = unidadeDaLinha(it, linha);
  const [valor, setValor] = useState(it.quantidade_contada === null ? '' : numeroEm(it.quantidade_contada, u.fator).replace(/\./g, ''));
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState<string | null>(it.quantidade_contada);
  const [erro, setErro] = useState<string | null>(null);
  const abertura = !linha || !conferido(linha, inicioControle);
  async function salvar() {
    if (!valor.trim()) return;
    const base = paraBase(valor, u.fator);
    if (base === null) return setErro('Número inválido');
    if (salvo !== null && Number(salvo) === Number(base)) return setErro(null);
    setSalvando(true);
    setErro(null);
    try {
      const r = await estoque.contar(inventario, it.insumo_id, base);
      setSalvo(r.quantidade_contada);
      atualizarContagem();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não salvou');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <tr>
      <td>
        <span class="principal-celula">{it.insumo}</span>
        <span class="sub" role="status">{erro ? <span style={{ color: 'var(--perigo)' }}>{erro}</span> : salvando ? 'Salvando…' : salvo !== null ? 'Salvo' : abertura ? 'Primeira contagem' : ''}</span>
      </td>
      <td class="num fraco" data-prioridade="media">{abertura ? 'Não conferido' : numeroEm(linha?.saldo, u.fator)}</td>
      <td class="num">
        <input
          class="entrada num entrada-contagem"
          inputMode="decimal"
          aria-label={`Quantidade contada de ${it.insumo} em ${u.rotulo}`}
          placeholder="0"
          value={valor}
          disabled={!editavel}
          onInput={(e) => setValor(e.currentTarget.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        />
      </td>
      <td class="fraco">{u.rotulo}</td>
    </tr>
  );
}

/** Passo 3: o que vai mudar. Diferença PREVISTA (contado − saldo de agora), em cada unidade; abertura não tem diferença. */
function Revisao({ itens, faltam, porId, inicioControle, aoVoltar, aoConfirmar }: { itens: ItemInv[]; faltam: number; porId: Map<string, Insumo>; inicioControle: string | null; aoVoltar: () => void; aoConfirmar: () => void }) {
  const linhas = itens.map((it) => {
    const l = porId.get(it.insumo_id);
    const abertura = !l || !conferido(l, inicioControle);
    const dif = abertura || !l ? null : Number(it.quantidade_contada) - Number(l.saldo);
    return { it, l, abertura, dif, u: unidadeDaLinha(it, l) };
  });
  const mudam = linhas.filter((x) => x.abertura || (x.dif !== null && x.dif !== 0)).length;
  return (
    <div class="pilha" style={{ padding: 'var(--e-4) var(--e-5)' }}>
      <div class="tabela-rolagem">
        <table class="tabela" aria-label="Diferenças da contagem">
          <thead><tr><th>Insumo</th><th class="num">Sistema</th><th class="num">Contagem</th><th class="num">Diferença</th></tr></thead>
          <tbody>
            {linhas.map(({ it, l, abertura, dif, u }) => (
              <tr key={it.insumo_id}>
                <td><span class="principal-celula">{it.insumo}</span></td>
                <td class="num fraco">{abertura ? '—' : `${numeroEm(l?.saldo, u.fator)} ${u.rotulo}`}</td>
                <td class="num">{numeroEm(it.quantidade_contada, u.fator)} {u.rotulo}</td>
                <td class="num">
                  {abertura ? <Etiqueta tom="info">Saldo inicial</Etiqueta> : dif === 0 ? <span class="fraco">sem diferença</span> : <strong class="diferenca" data-sinal={dif! < 0 ? '-' : '+'}>{dif! > 0 ? '+' : ''}{numeroEm(dif, u.fator)} {u.rotulo}</strong>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Aviso tom="info" icone={<Info aria-hidden="true" />}>
        {plural(mudam, 'insumo muda', 'insumos mudam')} de saldo{faltam ? `; ${plural(faltam, 'item sem número fica', 'itens sem número ficam')} como está` : ''}. A diferença final é calculada na confirmação, com o saldo daquele instante, e fica no histórico com o seu nome.
      </Aviso>
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao icone={<ArrowLeft aria-hidden="true" />} onClick={aoVoltar}>Voltar e corrigir</Botao>
        <Botao variante="primario" icone={<Check aria-hidden="true" />} onClick={aoConfirmar}>Confirmar contagem</Botao>
      </div>
    </div>
  );
}

interface LinhaAjuste {
  /** Primeira contagem do insumo: o contado vira o saldo de partida (não é uma diferença). */
  abertura?: boolean;
  insumo_id: string;
  insumo: string;
  unidade_base: UnidadeBase;
  sistema: string | null;
  contado: string | null;
  diferenca: string | null;
}
function TabelaAjustes({ linhas, rotulo }: { linhas: LinhaAjuste[]; rotulo: string }) {
  const colunas: Coluna<LinhaAjuste>[] = [
    { id: 'insumo', titulo: 'Insumo', ordenar: (l) => l.insumo, celula: (l) => <span class="principal-celula">{l.insumo}</span> },
    { id: 'sistema', titulo: 'Sistema', numero: true, prioridade: 'media', celula: (l) => { if (l.abertura) return <span class="fraco">—</span>; const u = unidadeExibicao(l.unidade_base, l.sistema, l.contado); return <span class="num">{numeroEm(l.sistema, u.fator)} {l.sistema !== null ? u.rotulo : ''}</span>; } },
    { id: 'contado', titulo: 'Contado', numero: true, celula: (l) => { const u = unidadeExibicao(l.unidade_base, l.sistema, l.contado); return <span class="num">{numeroEm(l.contado, u.fator)} {l.contado !== null ? u.rotulo : ''}</span>; } },
    {
      id: 'diferenca',
      titulo: 'Diferença',
      numero: true,
      ordenar: (l) => Number(l.diferenca ?? 0),
      celula: (l) => {
        if (l.abertura) return <Etiqueta tom="info">Saldo inicial</Etiqueta>;
        if (l.diferenca === null) return <span class="fraco">—</span>;
        const n = Number(l.diferenca);
        const u = unidadeExibicao(l.unidade_base, l.sistema, l.contado);
        return n === 0 ? <span class="fraco">sem diferença</span> : <strong class="num diferenca" data-sinal={n < 0 ? '-' : '+'}>{n > 0 ? '+' : ''}{numeroEm(l.diferenca, u.fator)} {u.rotulo}</strong>;
      },
    },
  ];
  return <Tabela rotulo={rotulo} colunas={colunas} linhas={linhas} chave={(l) => l.insumo_id} />;
}

/** Resultado oficial do backend: o que foi ajustado. */
function Resultado({ r, aberturas, aoConcluir }: { r: FechamentoInventario; aberturas: Set<string>; aoConcluir: () => void }) {
  const mudaram = r.ajustes.filter((a) => Number(a.diferenca) !== 0 && !aberturas.has(a.insumo_id)).length;
  return (
    <Cartao
      titulo={<span class="linha"><CheckCircle2 size={16} aria-hidden="true" /> Contagem confirmada</span>}
      descricao={`${plural(r.ajustes.length, 'item contado', 'itens contados')} · ${plural(mudaram, 'ajuste lançado', 'ajustes lançados')}${aberturas.size ? ` · ${plural(aberturas.size, 'saldo inicial', 'saldos iniciais')}` : ''}${r.nao_contados ? ` · ${plural(r.nao_contados, 'item sem número ficou', 'itens sem número ficaram')} como estava` : ''}`}
      acoes={<Botao tamanho="p" variante="primario" onClick={aoConcluir}>Concluir</Botao>}
      justo
    >
      {r.ajustes.length ? <TabelaAjustes rotulo="Ajustes da contagem" linhas={r.ajustes.map((a) => ({ abertura: aberturas.has(a.insumo_id), insumo_id: a.insumo_id, insumo: a.insumo, unidade_base: a.unidade_base, sistema: a.sistema, contado: a.contado, diferenca: a.diferenca }))} /> : <Vazio compacto titulo="Nenhum ajuste" />}
    </Cartao>
  );
}

function Historico({ responsavel, aoVer }: { responsavel: (r: string | null | undefined, nome?: string | null) => string | null; aoVer: (id: string) => void }) {
  const lista = useConsulta('estoque/inventarios?historico', () => estoque.inventarios({ limite: 20 }));
  const colunas: Coluna<InventarioResumo>[] = [
    { id: 'data', titulo: 'Data', ordenar: (i) => i.fechado_em ?? i.aberto_em, celula: (i) => <span class="principal-celula">{dataHora(i.fechado_em ?? i.aberto_em)}</span> },
    { id: 'quem', titulo: 'Responsável', prioridade: 'media', celula: (i) => <span>{responsavel(i.aberto_por, i.aberto_por_nome) ?? '—'}</span> },
    { id: 'itens', titulo: 'Itens', numero: true, celula: (i) => <span class="num">{i.itens}</span> },
    { id: 'status', titulo: 'Situação', celula: (i) => <Situacao tom={STATUS[i.status].tom}>{STATUS[i.status].rotulo}</Situacao> },
  ];
  return (
    <Cartao titulo={<span class="linha"><History size={16} aria-hidden="true" /> Contagens anteriores</span>} justo>
      <Dados consulta={lista} recurso="As contagens" esqueleto={<EsqueletoTabela linhas={3} />}>
        {(l) => <Tabela rotulo="Contagens anteriores" colunas={colunas} linhas={l.filter((i) => i.status !== 'aberto')} chave={(i) => i.id} aoAbrir={(i) => aoVer(i.id)} apagada={(i) => i.status === 'cancelado'} porPagina={10} vazio={<Vazio compacto titulo="Nenhuma contagem ainda">A primeira contagem dá o saldo de partida de cada insumo.</Vazio>} />}
      </Dados>
    </Cartao>
  );
}

function DetalheContagem({ id, aoFechar }: { id: string | null; aoFechar: () => void }) {
  const c = useConsulta(id ? `estoque/inventarios/${id}` : null, () => estoque.inventario(id!));
  const d = c.dados;
  return (
    <Gaveta aberta={!!id} aoFechar={aoFechar} titulo="Contagem" subtitulo={d ? `${STATUS[d.status].rotulo} · ${dataHora(d.fechado_em ?? d.aberto_em)}` : undefined} largura="media">
      <Dados consulta={c} recurso="A contagem" esqueleto={<Esqueleto linhas={8} />}>
        {(d: Inventario) => (
          <div class="pilha">
            {d.status === 'cancelado' && <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>Contagem cancelada: nada foi ajustado no estoque.</Aviso>}
            <TabelaAjustes rotulo="Itens da contagem" linhas={d.itens.map((i) => ({ insumo_id: i.insumo_id, insumo: i.insumo, unidade_base: i.unidade_base, sistema: i.quantidade_sistema, contado: i.quantidade_contada, diferenca: i.diferenca }))} />
          </div>
        )}
      </Dados>
    </Gaveta>
  );
}
