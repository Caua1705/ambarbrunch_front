// Contagem física (inventário), aba própria: sugestão do que mais vale contar → abrir → contar item a item → fechar.
// Há no máximo uma contagem aberta por unidade e é o servidor quem diz qual (GET …/inventarios?status=aberto): ela pode
// ser retomada em qualquer aparelho. Fechar ajusta o saldo pela diferença do INSTANTE do fechamento — a diferença e o
// valor só existem depois disso, e vêm do backend (nada é calculado aqui).
import { useMemo, useState } from 'preact/hooks';
import { ClipboardList, Check, Info, ListChecks, Search, CheckCircle2, History } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { quantidade, moeda, relativo, plural, dataHora, num } from '../../lib/formato';
import { Gaveta, useConfirmacao, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Aviso, Etiqueta, Cartao, Situacao, type Tom } from '../../ui/base';
import { Dados, Esqueleto, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { EscopoInventario, FechamentoInventario, Inventario, InventarioResumo, StatusInventario } from '../../lib/tipos/estoque';
import { UNIDADE_CURTA, atualizarEstoque, quantidadeDigitada, type PermissoesEstoque } from './comum';

const MOTIVO = { negativo: 'Saldo negativo', nunca_contado: 'Nunca contado', curva_a: 'Mais usado' } as const;
const ESCOPO: Record<EscopoInventario, string> = { sugerido: 'Sugerida', lista: 'Escolhida', total: 'Total' };
const STATUS: Record<StatusInventario, { rotulo: string; tom: Tom }> = { aberto: { rotulo: 'Aberta', tom: 'atencao' }, fechado: { rotulo: 'Fechada', tom: 'ok' }, cancelado: { rotulo: 'Cancelada', tom: 'apagado' } };
const atualizarContagem = () => invalidar('estoque/inventarios');

export function Contagem({ perm }: { perm: PermissoesEstoque }) {
  const aberta = useConsulta('estoque/inventarios?aberto', () => estoque.inventarios({ status: 'aberto', limite: 1 }));
  const [resultado, setResultado] = useState<FechamentoInventario | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  const id = aberta.dados?.[0]?.id ?? null;

  return (
    <>
      {resultado && <Resultado r={resultado} aoFechar={() => setResultado(null)} />}
      <Dados consulta={aberta} recurso="A contagem" esqueleto={<Esqueleto linhas={8} />}>
        {() => (id ? <ContagemAberta id={id} perm={perm} aoFechar={setResultado} /> : <NovaContagem perm={perm} aoAbrir={() => setResultado(null)} />)}
      </Dados>
      <Historico aoVer={setVer} />
      <DetalheContagem id={ver} aoFechar={() => setVer(null)} />
    </>
  );
}

/** Nenhuma contagem aberta: o que vale contar e as três formas de abrir (sugerida, total, escolhida). */
function NovaContagem({ perm, aoAbrir }: { perm: PermissoesEstoque; aoAbrir: () => void }) {
  const sugestao = useConsulta('estoque/inventarios/sugestao', () => estoque.sugestaoInventario());
  const [escolher, setEscolher] = useState(false);
  const { confirmar, elemento } = useConfirmacao();

  async function abrir(escopo: EscopoInventario, insumos?: string[]) {
    try {
      await estoque.abrirInventario(escopo, insumos);
      aoAbrir();
      avisar('Contagem aberta. Pode continuar em outro aparelho.', 'ok');
    } catch (e) {
      // Outra pessoa abriu uma contagem neste meio-tempo: retoma a mesma (dados.inventario_id).
      if (e instanceof ErroApi && e.codigo === 'inventario_aberto' && typeof e.dados?.inventario_id === 'string') avisar('Já havia uma contagem aberta: retomando.', 'info');
      else throw e;
    } finally {
      atualizarContagem();
    }
  }
  const pedir = (escopo: 'sugerido' | 'total') =>
    confirmar({
      titulo: escopo === 'total' ? 'Abrir o inventário total?' : 'Abrir a contagem sugerida?',
      texto: escopo === 'total' ? 'Todos os insumos ativos entram na lista.' : 'Entram os itens sugeridos: negativos, nunca contados e os mais usados.',
      confirmar: 'Abrir contagem',
      acao: () => abrir(escopo),
    });

  return (
    <Cartao
      titulo={<span class="linha"><ClipboardList size={16} aria-hidden="true" /> Nova contagem</span>}
      descricao="Contar os itens que mais pesam é o que torna os saldos confiáveis. Conte na unidade-base de cada insumo (g, ml ou un)."
      acoes={
        perm.visualizar ? (
          <>
            <Botao tamanho="p" icone={<ListChecks aria-hidden="true" />} onClick={() => setEscolher(true)}>Escolher os insumos</Botao>
            <Botao tamanho="p" onClick={() => pedir('total')}>Contar tudo</Botao>
            <Botao tamanho="p" variante="primario" icone={<ClipboardList aria-hidden="true" />} onClick={() => pedir('sugerido')}>Contar os sugeridos</Botao>
          </>
        ) : undefined
      }
      justo
    >
      <Dados consulta={sugestao} recurso="A sugestão de contagem" compacto esqueleto={<div class="cartao__corpo"><Esqueleto linhas={6} /></div>}>
        {(lista) =>
          lista.length ? (
            <ul class="lista">
              {lista.map((s) => (
                <li key={s.insumo_id} class="lista__item">
                  <span class="lista__texto">
                    <strong>{s.insumo}</strong>
                    <span class="num">Sistema: {quantidade(s.saldo_sistema, s.unidade_base)} · {s.ultima_contagem_em ? `contado ${relativo(s.ultima_contagem_em)}` : 'nunca contado'}</span>
                  </span>
                  <span class="lista__fim"><Etiqueta tom={s.motivo === 'negativo' ? 'perigo' : s.motivo === 'nunca_contado' ? 'atencao' : 'neutro'}>{MOTIVO[s.motivo]}</Etiqueta></span>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio compacto titulo="Nada sugerido agora">Nenhum insumo comprado cadastrado para contar. Se quiser, conte todos.</Vazio>
          )
        }
      </Dados>
      <EscolherInsumos aberta={escolher} aoFechar={() => setEscolher(false)} aoAbrir={async (ids) => { await abrir('lista', ids); setEscolher(false); }} />
      {elemento}
    </Cartao>
  );
}

/** Escopo "lista": a pessoa marca quais insumos contar (ex.: só a câmara fria). */
function EscolherInsumos({ aberta, aoFechar, aoAbrir }: { aberta: boolean; aoFechar: () => void; aoAbrir: (ids: string[]) => Promise<void> }) {
  const lista = useConsulta(aberta ? 'estoque/insumos?catalogo' : null, () => estoque.insumos({ limite: 200 }));
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (lista.dados?.itens ?? []).filter((i) => !t || i.nome.toLowerCase().includes(t) || (i.categoria ?? '').toLowerCase().includes(t));
  }, [lista.dados, busca]);
  const alternar = (id: string) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setMarcados(n);
  };
  async function enviar() {
    setEnviando(true);
    try {
      await aoAbrir([...marcados]);
      setMarcados(new Set());
    } catch (e) {
      avisarErro(e);
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Escolher os insumos"
      subtitulo="Só os marcados entram na contagem"
      largura="media"
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante="primario" carregando={enviando} disabled={!marcados.size} onClick={enviar}>Abrir contagem ({marcados.size})</Botao>
        </>
      }
    >
      <div class="entrada-grupo">
        <Search aria-hidden="true" />
        <input class="entrada" type="search" placeholder="Buscar insumo ou categoria" aria-label="Buscar insumo" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} data-autofoco />
      </div>
      <Dados consulta={lista} recurso="Os insumos" esqueleto={<Esqueleto linhas={8} />}>
        {() =>
          visiveis.length ? (
            <ul class="escolha-insumos">
              {visiveis.map((i) => (
                <li key={i.id}>
                  <label class="marcar">
                    <input type="checkbox" checked={marcados.has(i.id)} onChange={() => alternar(i.id)} />
                    <span>{i.nome}</span>
                    <span class="fraco">{i.categoria ? `${i.categoria} · ` : ''}{UNIDADE_CURTA[i.unidade_base]}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio compacto titulo="Nenhum insumo com esse nome" />
          )
        }
      </Dados>
    </Gaveta>
  );
}

function ContagemAberta({ id, perm, aoFechar }: { id: string; perm: PermissoesEstoque; aoFechar: (r: FechamentoInventario) => void }) {
  const inv = useConsulta(`estoque/inventarios/${id}`, () => estoque.inventario(id));
  const [busca, setBusca] = useState('');
  const { confirmar, elemento } = useConfirmacao();
  const d = inv.dados;
  const contados = d?.itens.filter((i) => i.quantidade_contada !== null).length ?? 0;
  const total = d?.itens.length ?? 0;

  const fechar = () =>
    confirmar({
      titulo: 'Fechar a contagem?',
      texto: `${plural(contados, 'item contado', 'itens contados')} de ${total}. O estoque é ajustado pela diferença entre o contado e o saldo do sistema neste instante.${total - contados ? ` ${plural(total - contados, 'item sem contagem fica', 'itens sem contagem ficam')} como está.` : ''}`,
      confirmar: 'Fechar e ajustar',
      acao: async () => {
        try {
          aoFechar(await estoque.fecharInventario(id));
        } finally {
          atualizarEstoque();
        }
      },
      sucesso: 'Contagem fechada e estoque ajustado.',
    });
  const cancelar = () =>
    confirmar({
      titulo: 'Cancelar a contagem?',
      texto: 'O que foi contado é descartado e o estoque não muda.',
      confirmar: 'Cancelar contagem',
      perigo: true,
      acao: async () => {
        try {
          await estoque.cancelarInventario(id);
        } finally {
          atualizarContagem();
        }
      },
      sucesso: 'Contagem cancelada.',
    });

  const t = busca.trim().toLowerCase();
  return (
    <Cartao
      titulo={<span class="linha"><ClipboardList size={16} aria-hidden="true" /> Contagem {d ? ESCOPO[d.escopo].toLowerCase() : ''} aberta</span>}
      descricao={d ? `Aberta ${relativo(d.aberto_em)} · ${contados} de ${total} contados` : undefined}
      acoes={
        perm.visualizar && d ? (
          <>
            <Botao tamanho="p" variante="fantasma" onClick={cancelar}>Cancelar contagem</Botao>
            <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} disabled={!contados} onClick={fechar}>Fechar e ajustar o estoque</Botao>
          </>
        ) : undefined
      }
    >
      <Dados consulta={inv} recurso="A contagem" esqueleto={<Esqueleto linhas={8} />}>
        {(d: Inventario) => (
          <div class="pilha">
            <Aviso tom="info" icone={<Info aria-hidden="true" />}>
              Digite o que tem na prateleira, na unidade-base de cada insumo. Cada número é salvo ao sair do campo: pode fechar esta tela e continuar depois, inclusive em outro aparelho.
            </Aviso>
            {d.itens.length > 8 && (
              <div class="entrada-grupo" style={{ maxWidth: '360px' }}>
                <Search aria-hidden="true" />
                <input class="entrada" type="search" placeholder="Buscar insumo" aria-label="Buscar insumo na contagem" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
              </div>
            )}
            <div>
              {d.itens.filter((i) => !t || i.insumo.toLowerCase().includes(t)).map((it) => (
                <ItemContagem key={it.insumo_id} inventario={d.id} it={it} editavel={perm.visualizar} />
              ))}
            </div>
          </div>
        )}
      </Dados>
      {elemento}
    </Cartao>
  );
}

function ItemContagem({ inventario, it, editavel }: { inventario: string; it: Inventario['itens'][number]; editavel: boolean }) {
  const [valor, setValor] = useState(it.quantidade_contada === null ? '' : String(Number(it.quantidade_contada)));
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState<{ quantidade: string | null; em: string | null }>({ quantidade: it.quantidade_contada, em: it.contado_em });
  const [erro, setErro] = useState<string | null>(null);
  async function salvar() {
    if (!valor.trim()) return;
    const texto = quantidadeDigitada(valor);
    if (texto === null) return setErro('Valor inválido');
    if (salvo.quantidade !== null && Number(salvo.quantidade) === Number(texto)) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await estoque.contar(inventario, it.insumo_id, texto);
      setSalvo({ quantidade: r.quantidade_contada, em: r.contado_em });
      atualizarContagem();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não salvou');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div class="contagem-item">
      <div style={{ minWidth: 0 }}>
        <strong style={{ fontWeight: 500 }}>{it.insumo}</strong>
        <span class="fraco" style={{ display: 'block' }} role="status">
          {erro ? <span style={{ color: 'var(--perigo)' }}>{erro}</span> : salvando ? 'Salvando…' : salvo.em ? `Contado ${relativo(salvo.em)}` : 'Ainda não contado'}
        </span>
      </div>
      <div class="entrada-grupo">
        <input
          class="entrada num"
          inputMode="decimal"
          aria-label={`Quantidade contada de ${it.insumo} em ${UNIDADE_CURTA[it.unidade_base]}`}
          placeholder="Contado"
          value={valor}
          disabled={!editavel}
          style={{ paddingRight: '40px' }}
          onInput={(e) => setValor(e.currentTarget.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        />
        <span class="fraco" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }}>{UNIDADE_CURTA[it.unidade_base]}</span>
      </div>
    </div>
  );
}

/** Resultado do fechamento como o backend devolve: cada ajuste, o valor total e quantos ficaram sem contagem. */
function Resultado({ r, aoFechar }: { r: FechamentoInventario; aoFechar: () => void }) {
  return (
    <Cartao titulo={<span class="linha"><CheckCircle2 size={16} aria-hidden="true" /> Contagem fechada</span>} descricao={`${plural(r.ajustes.length, 'insumo ajustado', 'insumos ajustados')} · ${moeda(r.valor_total)} ao custo médio${r.nao_contados ? ` · ${plural(r.nao_contados, 'item não contado ficou', 'itens não contados ficaram')} como estava` : ''}`} acoes={<Botao tamanho="p" variante="fantasma" onClick={aoFechar}>Dispensar</Botao>} justo>
      {r.ajustes.length ? <TabelaAjustes linhas={r.ajustes.map((a) => ({ insumo_id: a.insumo_id, insumo: a.insumo, unidade_base: a.unidade_base, sistema: a.sistema, contado: a.contado, diferenca: a.diferenca, valor: a.valor }))} /> : <Vazio compacto titulo="Nenhum ajuste" />}
    </Cartao>
  );
}

interface LinhaAjuste {
  insumo_id: string;
  insumo: string;
  unidade_base: Inventario['itens'][number]['unidade_base'];
  sistema: string | null;
  contado: string | null;
  diferenca: string | null;
  valor: string | null;
}
function TabelaAjustes({ linhas }: { linhas: LinhaAjuste[] }) {
  const colunas: Coluna<LinhaAjuste>[] = [
    { id: 'insumo', titulo: 'Insumo', ordenar: (l) => l.insumo, celula: (l) => <span class="principal-celula">{l.insumo}</span> },
    { id: 'sistema', titulo: 'Sistema', numero: true, prioridade: 'media', celula: (l) => <span class="num">{quantidade(l.sistema, l.unidade_base)}</span> },
    { id: 'contado', titulo: 'Contado', numero: true, celula: (l) => <span class="num">{quantidade(l.contado, l.unidade_base)}</span> },
    {
      id: 'diferenca',
      titulo: 'Diferença',
      numero: true,
      ordenar: (l) => num(l.diferenca),
      celula: (l) => {
        const n = num(l.diferenca);
        return <span class="num" style={n ? { color: n < 0 ? 'var(--perigo)' : 'var(--ok)', fontWeight: 600 } : undefined}>{n !== null && n > 0 ? '+' : ''}{quantidade(l.diferenca, l.unidade_base)}</span>;
      },
    },
    { id: 'valor', titulo: 'Valor', numero: true, ordenar: (l) => num(l.valor), celula: (l) => <span class="num">{moeda(l.valor)}</span> },
  ];
  return <Tabela rotulo="Ajustes da contagem" colunas={colunas} linhas={linhas} chave={(l) => l.insumo_id} />;
}

function Historico({ aoVer }: { aoVer: (id: string) => void }) {
  const lista = useConsulta('estoque/inventarios?historico', () => estoque.inventarios({ limite: 20 }));
  const colunas: Coluna<InventarioResumo>[] = [
    { id: 'aberto', titulo: 'Aberta em', ordenar: (i) => i.aberto_em, celula: (i) => <><span class="principal-celula">{dataHora(i.aberto_em)}</span>{i.aberto_por && <span class="sub">{i.aberto_por}</span>}</> },
    { id: 'escopo', titulo: 'Tipo', prioridade: 'media', celula: (i) => ESCOPO[i.escopo] },
    { id: 'itens', titulo: 'Itens', numero: true, prioridade: 'baixa', celula: (i) => <span class="num">{i.itens}</span> },
    { id: 'fechado', titulo: 'Fechada em', prioridade: 'media', celula: (i) => <span class="fraco">{i.fechado_em ? dataHora(i.fechado_em) : '—'}</span> },
    { id: 'status', titulo: 'Situação', celula: (i) => <Situacao tom={STATUS[i.status].tom}>{STATUS[i.status].rotulo}</Situacao> },
  ];
  return (
    <Cartao titulo={<span class="linha"><History size={16} aria-hidden="true" /> Contagens anteriores</span>} descricao="As 20 mais recentes desta unidade" justo>
      <Dados consulta={lista} recurso="As contagens" esqueleto={<EsqueletoTabela linhas={4} />}>
        {(l) => <Tabela rotulo="Contagens anteriores" colunas={colunas} linhas={l} chave={(i) => i.id} aoAbrir={(i) => aoVer(i.id)} apagada={(i) => i.status === 'cancelado'} vazio={<Vazio compacto titulo="Nenhuma contagem ainda">A primeira contagem dá o saldo de partida de cada insumo.</Vazio>} />}
      </Dados>
    </Cartao>
  );
}

function DetalheContagem({ id, aoFechar }: { id: string | null; aoFechar: () => void }) {
  const c = useConsulta(id ? `estoque/inventarios/${id}` : null, () => estoque.inventario(id!));
  const d = c.dados;
  return (
    <Gaveta aberta={!!id} aoFechar={aoFechar} titulo={d ? `Contagem ${ESCOPO[d.escopo].toLowerCase()}` : 'Contagem'} subtitulo={d ? `${STATUS[d.status].rotulo} · aberta em ${dataHora(d.aberto_em)}${d.fechado_em ? ` · fechada em ${dataHora(d.fechado_em)}` : ''}` : undefined} largura="media">
      <Dados consulta={c} recurso="A contagem" esqueleto={<Esqueleto linhas={8} />}>
        {(d: Inventario) => (
          <div class="pilha">
            {d.status === 'aberto' && <Aviso tom="info" icone={<Info aria-hidden="true" />}>Contagem em andamento: a diferença e o valor aparecem quando ela for fechada.</Aviso>}
            {d.status === 'cancelado' && <Aviso tom="atencao" icone={<Info aria-hidden="true" />}>Contagem cancelada: nada foi ajustado no estoque.</Aviso>}
            <TabelaAjustes linhas={d.itens.map((i) => ({ insumo_id: i.insumo_id, insumo: i.insumo, unidade_base: i.unidade_base, sistema: i.quantidade_sistema, contado: i.quantidade_contada, diferenca: i.diferenca, valor: i.valor_diferenca }))} />
          </div>
        )}
      </Dados>
    </Gaveta>
  );
}
