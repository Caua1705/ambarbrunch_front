// "Registrar movimento": a ÚNICA porta para mexer no saldo à mão. Três escolhas, todas com histórico no backend:
//  - Entrada: mercadoria chegou → vai para o recebimento (com nota ou sem nota) e só entra no estoque ao confirmar;
//  - Saída: perda, uso interno ou outra saída justificada → POST /admin/estoque/perdas (sai ao custo médio);
//  - Ajuste: o saldo real é outro → uma contagem de UM item (abre, conta, fecha), que lança o ajuste pela diferença com
//    o nome de quem fez. O backend não tem ajuste avulso: a contagem é o caminho rastreável que ele oferece.
// Ninguém digita um saldo novo direto: tudo vira movimento. Quem registra é quem está logado (o backend grava).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ArrowDownToLine, ArrowUpFromLine, Scale, FileText, PencilLine, Info, CheckCircle2, ClipboardList } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi, novaChave } from '../../lib/api/cliente';
import { hojeISO } from '../../lib/formato';
import type { Usuario } from '../../lib/sessao';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Aviso } from '../../ui/base';
import { Autocompletar, type OpcaoAuto } from '../../ui/entradas';
import type { FechamentoInventario, Insumo } from '../../lib/tipos/estoque';
import { atualizarEstoque, conferido, numeroEm, paraBase, unidadeExibicao, UNIDADE_CURTA, type PermissoesEstoque } from './comum';
import type { TipoMovimentoManual } from './DetalheInsumo';

export type ModoEntrada = 'nota' | 'manual';
type Passo = 'escolher' | TipoMovimentoManual;

export function RegistrarMovimento({ aberto, tipo, insumo, perm, eu, inicioControle, aoFechar, aoEntrada, aoIrContagem, aoIrRecebimentos }: {
  aberto: boolean;
  tipo: TipoMovimentoManual | null;
  insumo: Insumo | null;
  perm: PermissoesEstoque;
  eu: Usuario;
  inicioControle: string | null;
  aoFechar: () => void;
  aoEntrada: (modo: ModoEntrada, insumo: Insumo | null) => void;
  aoIrContagem: () => void;
  aoIrRecebimentos: () => void;
}) {
  const [passo, setPasso] = useState<Passo>('escolher');
  const [alvo, setAlvo] = useState<Insumo | null>(null);
  useEffect(() => {
    if (aberto) {
      setPasso(tipo ?? 'escolher');
      setAlvo(insumo);
    }
  }, [aberto, tipo, insumo]);

  const titulo = passo === 'entrada' ? 'Entrada' : passo === 'saida' ? 'Saída' : passo === 'ajuste' ? 'Ajuste de saldo' : 'Registrar movimento';
  const sub = alvo && passo !== 'escolher' ? alvo.nome : passo === 'escolher' ? 'O que aconteceu com o estoque?' : undefined;
  const voltar = !tipo && passo !== 'escolher' ? () => setPasso('escolher') : null;

  return (
    <Gaveta aberta={aberto} aoFechar={aoFechar} titulo={titulo} subtitulo={sub}>
      {passo === 'escolher' && (
        <div class="escolha-movimento" role="group" aria-label="Escolha uma opção">
          {perm.conferir && <Opcao icone={<ArrowDownToLine aria-hidden="true" />} titulo="Entrada" texto="Produto chegou ao café." aoEscolher={() => setPasso('entrada')} />}
          <Opcao icone={<ArrowUpFromLine aria-hidden="true" />} titulo="Saída" texto="Perda, uso interno ou outra saída justificada." aoEscolher={() => setPasso('saida')} />
          <Opcao icone={<Scale aria-hidden="true" />} titulo="Ajuste" texto="Corrigir o saldo depois de contar ou achar uma diferença." aoEscolher={() => setPasso('ajuste')} />
        </div>
      )}
      {passo === 'entrada' && (
        <div class="pilha">
          <div class="escolha-movimento" role="group" aria-label="Escolha uma opção">
            <Opcao icone={<FileText aria-hidden="true" />} titulo="Com nota fiscal" texto="Foto, PDF ou XML. Os itens são lidos e você confere." aoEscolher={() => aoEntrada('nota', alvo)} />
            <Opcao icone={<PencilLine aria-hidden="true" />} titulo="Sem nota" texto="Feira, mercado sem cupom: informe fornecedor, itens e valores." aoEscolher={() => aoEntrada('manual', alvo)} />
          </div>
          <p class="fraco">
            Pagou e mandou o comprovante para a Júlia? A compra já está em{' '}
            <button type="button" class="link" onClick={aoIrRecebimentos}>Recebimentos</button>: confira por lá, sem criar outra.
          </p>
          {voltar && <Botao variante="fantasma" onClick={voltar} style={{ alignSelf: 'flex-start' }}>Voltar</Botao>}
        </div>
      )}
      {passo === 'saida' && <Saida alvo={alvo} aoAlvo={setAlvo} eu={eu} aoVoltar={voltar} aoTerminar={aoFechar} />}
      {passo === 'ajuste' && <Ajuste alvo={alvo} aoAlvo={setAlvo} eu={eu} inicioControle={inicioControle} aoVoltar={voltar} aoTerminar={aoFechar} aoIrContagem={aoIrContagem} />}
    </Gaveta>
  );
}

function Opcao({ icone, titulo, texto, aoEscolher }: { icone: ComponentChildren; titulo: string; texto: string; aoEscolher: () => void }) {
  return (
    <button type="button" class="escolha-movimento__opcao" onClick={aoEscolher}>
      <span class="escolha-movimento__icone">{icone}</span>
      <span class="escolha-movimento__texto">
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </span>
    </button>
  );
}

/** Insumo do movimento: o que veio da gaveta, ou escolhido aqui no cadastro. */
function EscolherInsumo({ alvo, aoAlvo }: { alvo: Insumo | null; aoAlvo: (i: Insumo | null) => void }) {
  const catalogo = useConsulta('estoque/insumos?catalogo', () => estoque.insumos({ limite: 200 }));
  const achados = useRef(new Map<string, Insumo>());
  const buscar = async (t: string): Promise<OpcaoAuto[]> => {
    const lista = catalogo.dados && catalogo.dados.total <= catalogo.dados.itens.length ? catalogo.dados.itens : (await estoque.insumos({ busca: t.trim() || undefined, limite: 20 })).itens;
    const q = t.trim().toLowerCase();
    return lista
      .filter((i) => i.ativo && (!q || i.nome.toLowerCase().includes(q)))
      .slice(0, 20)
      .map((i) => {
        achados.current.set(i.id, i);
        return { valor: i.id, rotulo: i.nome, detalhe: `em ${UNIDADE_CURTA[i.unidade_base]}` };
      });
  };
  return (
    <Campo rotulo="Insumo">
      {(id) => <Autocompletar id={id} rotulo="Insumo" placeholder="Buscar insumo (ex.: leite)" valor={alvo ? { valor: alvo.id, rotulo: alvo.nome } : null} buscar={buscar} aoEscolher={(o) => aoAlvo(o ? achados.current.get(o.valor) ?? null : null)} />}
    </Campo>
  );
}

/** Quantidade com a unidade que as pessoas usam: kg/L ou g/ml (o backend recebe a unidade-base). */
function CampoQuantidade({ rotulo, alvo, valor, aoMudar, fator, aoFator, ajuda }: { rotulo: string; alvo: Insumo; valor: string; aoMudar: (v: string) => void; fator: 1 | 1000; aoFator: (f: 1 | 1000) => void; ajuda?: string }) {
  const base = alvo.unidade_base;
  return (
    <div class="campo-quantidade">
      <Campo rotulo={rotulo} ajuda={ajuda}>
        {(id, d) => <input id={id} class="entrada num" inputMode="decimal" aria-describedby={d} value={valor} onInput={(e) => aoMudar(e.currentTarget.value)} data-autofoco />}
      </Campo>
      {base === 'un' ? (
        <span class="campo-quantidade__unidade">un</span>
      ) : (
        <Campo rotulo="Unidade">
          {(id) => (
            <select id={id} class="selecao" value={String(fator)} onChange={(e) => aoFator(Number(e.currentTarget.value) as 1 | 1000)}>
              <option value="1000">{base === 'g' ? 'kg' : 'L'}</option>
              <option value="1">{base}</option>
            </select>
          )}
        </Campo>
      )}
    </div>
  );
}

const MOTIVOS_SAIDA = [
  ['vencido', 'Venceu'],
  ['quebra', 'Quebrou ou estragou'],
  ['preparo', 'Sobra de preparo descartada'],
  ['uso_interno', 'Uso interno'],
  ['outro', 'Outro motivo'],
] as const;
type MotivoSaida = (typeof MOTIVOS_SAIDA)[number][0];

function Saida({ alvo, aoAlvo, eu, aoVoltar, aoTerminar }: { alvo: Insumo | null; aoAlvo: (i: Insumo | null) => void; eu: Usuario; aoVoltar: (() => void) | null; aoTerminar: () => void }) {
  const [qtd, setQtd] = useState('');
  const [fator, setFator] = useState<1 | 1000>(1);
  const [motivo, setMotivo] = useState<MotivoSaida>('vencido');
  const [obs, setObs] = useState('');
  const [data, setData] = useState(hojeISO());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Uma chave por formulário: reenviar depois de uma falha de rede não lança a saída duas vezes.
  const chave = useRef(novaChave());
  useEffect(() => {
    if (alvo) setFator(unidadeExibicao(alvo.unidade_base, alvo.saldo, alvo.estoque_minimo).fator);
  }, [alvo?.id]);

  async function enviar(e: Event) {
    e.preventDefault();
    if (!alvo) return setErro('Escolha o insumo.');
    const q = paraBase(qtd, fator);
    if (!q || !(Number(q) > 0)) return setErro('Informe a quantidade que saiu.');
    const texto = obs.trim();
    if (motivo === 'outro' && texto.length < 3) return setErro('Conte rapidamente o que aconteceu.');
    const observacao = motivo === 'uso_interno' ? `Uso interno${texto ? `: ${texto}` : ''}` : texto || undefined;
    setEnviando(true);
    setErro(null);
    try {
      await estoque.registrarPerda(
        { insumo_id: alvo.id, quantidade: q, motivo: motivo === 'uso_interno' ? 'outro' : motivo, observacao: observacao?.slice(0, 200), ...(data !== hojeISO() ? { ocorreu_em: `${data}T12:00:00-03:00` } : {}) },
        chave.current,
      );
      atualizarEstoque();
      avisar(`Saída registrada: ${alvo.nome}.`, 'ok');
      aoTerminar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível registrar.');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form class="pilha" onSubmit={enviar} noValidate>
      <EscolherInsumo alvo={alvo} aoAlvo={aoAlvo} />
      {alvo && <CampoQuantidade rotulo="Quantidade que saiu" alvo={alvo} valor={qtd} aoMudar={setQtd} fator={fator} aoFator={setFator} />}
      <div class="grade-campos">
        <Campo rotulo="Motivo">
          {(id) => (
            <select id={id} class="selecao" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value as MotivoSaida)}>
              {MOTIVOS_SAIDA.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Data">{(id) => <input id={id} type="date" class="entrada" max={hojeISO()} value={data} onChange={(e) => setData(e.currentTarget.value || hojeISO())} />}</Campo>
        <Campo rotulo="Observação" opcional={motivo !== 'outro'} class="inteiro">{(id) => <textarea id={id} class="area" maxLength={180} value={obs} placeholder={motivo === 'uso_interno' ? 'Ex.: café da equipe' : undefined} onInput={(e) => setObs(e.currentTarget.value)} />}</Campo>
      </div>
      <p class="fraco">Sai do saldo ao custo médio. Registrado por {eu.nome}.</p>
      {erro && <Aviso tom="perigo" icone={<Info aria-hidden="true" />}>{erro}</Aviso>}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        {aoVoltar && <Botao onClick={aoVoltar} disabled={enviando}>Voltar</Botao>}
        <Botao type="submit" variante="primario" carregando={enviando} disabled={!alvo}>Registrar saída</Botao>
      </div>
    </form>
  );
}

function Ajuste({ alvo, aoAlvo, eu, inicioControle, aoVoltar, aoTerminar, aoIrContagem }: {
  alvo: Insumo | null;
  aoAlvo: (i: Insumo | null) => void;
  eu: Usuario;
  inicioControle: string | null;
  aoVoltar: (() => void) | null;
  aoTerminar: () => void;
  aoIrContagem: () => void;
}) {
  const [qtd, setQtd] = useState('');
  const [fator, setFator] = useState<1 | 1000>(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [feito, setFeito] = useState<FechamentoInventario | null>(null);
  useEffect(() => {
    if (alvo) setFator(unidadeExibicao(alvo.unidade_base, alvo.saldo, alvo.estoque_minimo).fator);
    setFeito(null);
    setErro(null);
  }, [alvo?.id]);

  const abertura = !!alvo && !conferido(alvo, inicioControle);
  const contado = paraBase(qtd, fator);
  const rotuloU = alvo ? (fator === 1000 ? (alvo.unidade_base === 'g' ? 'kg' : 'L') : alvo.unidade_base) : '';
  // Prévia: o ajuste oficial é calculado pelo backend no instante de confirmar (o saldo pode mudar até lá).
  const previa = alvo && contado !== null && !abertura ? Number(contado) - Number(alvo.saldo) : null;

  async function ajustar(e: Event) {
    e.preventDefault();
    if (!alvo) return setErro(new ErroApi('validacao', 'Escolha o insumo.'));
    if (contado === null) return setErro(new ErroApi('validacao', 'Informe quanto há de verdade agora (pode ser 0).'));
    setEnviando(true);
    setErro(null);
    let inventario: string | null = null;
    try {
      inventario = (await estoque.abrirInventario('lista', [alvo.id])).id;
      await estoque.contar(inventario, alvo.id, contado);
      const r = await estoque.fecharInventario(inventario);
      inventario = null;
      setFeito(r);
      atualizarEstoque();
    } catch (x) {
      // Não deixa uma contagem de um item só aberta pela metade: o que não fechou é cancelado (nada foi ajustado).
      if (inventario) await estoque.cancelarInventario(inventario).catch(() => undefined);
      setErro(x instanceof ErroApi ? x : new ErroApi('servidor', 'Não foi possível ajustar.'));
    } finally {
      setEnviando(false);
    }
  }

  if (feito && alvo) {
    const a = feito.ajustes[0];
    const u = unidadeExibicao(alvo.unidade_base, a?.sistema, a?.contado);
    return (
      <div class="pilha">
        <div class="estado" style={{ paddingBottom: '4px' }}>
          <span class="estado__icone" style={{ background: 'var(--ok-suave)', color: 'var(--ok)' }}><CheckCircle2 aria-hidden="true" /></span>
          <h3>{a && Number(a.diferenca) !== 0 ? 'Saldo ajustado' : 'Saldo conferido, sem diferença'}</h3>
        </div>
        {a && (
          <dl class="definicoes">
            <dt>Antes</dt><dd class="num">{numeroEm(a.sistema, u.fator)} {u.rotulo}</dd>
            <dt>Contado</dt><dd class="num">{numeroEm(a.contado, u.fator)} {u.rotulo}</dd>
            <dt>Diferença</dt><dd class="num"><strong>{Number(a.diferenca) > 0 ? '+' : ''}{numeroEm(a.diferenca, u.fator)} {u.rotulo}</strong></dd>
          </dl>
        )}
        <p class="fraco">Registrado como contagem, com o nome de {eu.nome} e o horário. Aparece no histórico do insumo e em Contagem.</p>
        <Botao variante="primario" onClick={aoTerminar} style={{ alignSelf: 'flex-end' }}>Concluir</Botao>
      </div>
    );
  }

  const aberta = erro?.codigo === 'inventario_aberto';
  return (
    <form class="pilha" onSubmit={ajustar} noValidate>
      <EscolherInsumo alvo={alvo} aoAlvo={aoAlvo} />
      {alvo && (
        <>
          <dl class="definicoes">
            <dt>Saldo registrado</dt>
            <dd class="num">{abertura ? <span class="fraco">Não conferido</span> : `${numeroEm(alvo.saldo, fator)} ${rotuloU}`}</dd>
          </dl>
          <CampoQuantidade rotulo="Quantidade real agora" alvo={alvo} valor={qtd} aoMudar={setQtd} fator={fator} aoFator={setFator} ajuda={abertura ? 'Primeira contagem: vira o saldo de partida deste insumo.' : undefined} />
          {previa !== null && (
            <p class="ajuste-previa" role="status">
              Diferença prevista: <strong class="num" data-sinal={previa < 0 ? '-' : '+'}>{previa > 0 ? '+' : ''}{numeroEm(previa, fator)} {rotuloU}</strong>
            </p>
          )}
        </>
      )}
      <p class="fraco">O ajuste é registrado como uma contagem deste item, com o seu nome e o horário: o histórico guarda o antes, o contado e a diferença.</p>
      {erro && (
        <Aviso tom={aberta ? 'atencao' : 'perigo'} icone={<Info aria-hidden="true" />}>
          {aberta ? 'Há uma contagem em andamento nesta unidade. Informe a quantidade por ela: o ajuste entra quando ela for confirmada.' : erro.message}
          {aberta && <div style={{ marginTop: '6px' }}><Botao tamanho="p" icone={<ClipboardList aria-hidden="true" />} onClick={aoIrContagem}>Ir para a contagem</Botao></div>}
        </Aviso>
      )}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        {aoVoltar && <Botao onClick={aoVoltar} disabled={enviando}>Voltar</Botao>}
        <Botao type="submit" variante="primario" carregando={enviando} disabled={!alvo}>{abertura ? 'Registrar contagem inicial' : 'Registrar ajuste'}</Botao>
      </div>
    </form>
  );
}
