// Registros de ponto: uma linha por pessoa e dia, do jeito que o backend calculou. Abrir a linha mostra as marcações, as
// correções feitas e permite corrigir: nada é apagado ou substituído em silêncio.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Download, Plus } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { baixarRelatorio, equipe, novaChave } from '../../lib/api/equipe';
import { invalidar, useConsulta } from '../../lib/consulta';
import { dataCurta, dataHora, hojeISO, horaDe, inicioMes, somarDias } from '../../lib/formato';
import { lerParam } from '../../lib/rotas';
import { ROTULO_BATIDA, type TipoBatida } from '../../../lib/ponto/contrato';
import type { JornadaDetalhe, LinhaEspelho, Marcacao, StatusDia } from '../../lib/tipos/equipe';
import { Aviso, Botao, Campo, Cartao, Etiqueta, Situacao } from '../../ui/base';
import { avisar, avisarErro, Dialogo, Gaveta } from '../../ui/camadas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { JUSTIFICATIVA_MAX, JUSTIFICATIVA_MIN, minutos, ROTULO_AJUSTE, ROTULO_ORIGEM, ROTULO_SINAL, ROTULO_STATUS, TOM_STATUS, useFuncionariosAtivos, type PermissoesEquipe } from './comum';

const TIPOS: TipoBatida[] = ['ENTRADA', 'INICIO_INTERVALO', 'FIM_INTERVALO', 'SAIDA'];
const PERIODOS = [{ v: 'hoje', r: 'Hoje' }, { v: 'semana', r: 'Últimos 7 dias' }, { v: 'mes', r: 'Este mês' }, { v: 'outro', r: 'Outro período' }] as const;

/** Instante digitado é hora de Fortaleza, seja qual for o relógio do aparelho. */
const paraInstante = (local: string) => `${local}:00-03:00`;

export function Registros({ perm }: { perm: PermissoesEquipe }) {
  const hoje = hojeISO();
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['v']>('semana');
  const [de, setDe] = useState(somarDias(hoje, -6));
  const [ate, setAte] = useState(hoje);
  const [funcionario, setFuncionario] = useState('');
  const [status, setStatus] = useState<StatusDia | ''>('');
  const [aberta, setAberta] = useState<LinhaEspelho | null>(null);
  const [baixando, setBaixando] = useState(false);
  const pessoas = useFuncionariosAtivos();
  useEffect(() => setFuncionario(lerParam('funcionario') ?? ''), []);

  const mudarPeriodo = (p: typeof periodo) => {
    setPeriodo(p);
    if (p === 'hoje') { setDe(hoje); setAte(hoje); }
    if (p === 'semana') { setDe(somarDias(hoje, -6)); setAte(hoje); }
    if (p === 'mes') { setDe(inicioMes(hoje)); setAte(hoje); }
  };
  const q = { de, ate, funcionario_id: funcionario || undefined, status: status || undefined, limite: 200 };
  const consulta = useConsulta(de && ate ? `equipe:espelho?${JSON.stringify(q)}` : null, () => equipe.espelho(q));

  const colunas: Coluna<LinhaEspelho>[] = [
    { id: 'nome', titulo: 'Funcionário', ordenar: (l) => l.nome_exibicao, celula: (l) => <strong>{l.nome_exibicao}</strong> },
    { id: 'data', titulo: 'Data', ordenar: (l) => l.data, celula: (l) => dataCurta(l.data, { semana: true }) },
    { id: 'entrada', titulo: 'Entrada', celula: (l) => <span class="num">{horaDe(l.entrada)}</span> },
    { id: 'pausa', titulo: 'Início do intervalo', prioridade: 'media', celula: (l) => <span class="num">{horaDe(l.intervalos[0]?.inicio)}</span> },
    { id: 'volta', titulo: 'Retorno', prioridade: 'media', celula: (l) => <span class="num">{horaDe(l.intervalos[0]?.fim)}</span> },
    { id: 'saida', titulo: 'Saída', celula: (l) => <span class="num">{horaDe(l.saida)}</span> },
    { id: 'horas', titulo: 'Horas', numero: true, ordenar: (l) => l.trabalhado_min, celula: (l) => (l.jornadas_ids.length ? minutos(l.trabalhado_min) : '—') },
    { id: 'estado', titulo: 'Situação', ordenar: (l) => l.status, celula: (l) => <Situacao tom={TOM_STATUS[l.status]}>{ROTULO_STATUS[l.status]}</Situacao> },
  ];

  const exportar = async () => {
    setBaixando(true);
    try {
      await baixarRelatorio('espelho', de, ate, funcionario || undefined);
    } catch (e) {
      avisarErro(e);
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Cartao
      titulo="Registros de ponto"
      descricao="Registro operacional do Âmbar. Não é folha de pagamento nem hora extra aprovada."
      acoes={<Botao icone={<Download aria-hidden="true" />} onClick={exportar} carregando={baixando}>Exportar CSV</Botao>}
      justo
    >
      <div class="filtros equipe-filtros">
        <select class="selecao" aria-label="Funcionário" value={funcionario} onChange={(e) => setFuncionario(e.currentTarget.value)}>
          <option value="">Todos</option>
          {pessoas.dados?.itens.map((f) => <option key={f.id} value={f.id}>{f.nome_exibicao}</option>)}
        </select>
        <select class="selecao" aria-label="Período" value={periodo} onChange={(e) => mudarPeriodo(e.currentTarget.value as typeof periodo)}>
          {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.r}</option>)}
        </select>
        {periodo === 'outro' && (
          <>
            <input class="entrada equipe-data" type="date" aria-label="De" value={de} max={ate} onInput={(e) => setDe(e.currentTarget.value)} />
            <input class="entrada equipe-data" type="date" aria-label="Até" value={ate} min={de} onInput={(e) => setAte(e.currentTarget.value)} />
          </>
        )}
        <select class="selecao" aria-label="Situação" value={status} onChange={(e) => setStatus(e.currentTarget.value as StatusDia | '')}>
          <option value="">Todas as situações</option>
          {(Object.keys(ROTULO_STATUS) as StatusDia[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
        </select>
      </div>
      <Dados consulta={consulta} esqueleto={<EsqueletoTabela />}>
        {(p) => (
          <>
            <Tabela
              rotulo="Registros de ponto"
              colunas={colunas}
              linhas={p.itens}
              chave={(l) => `${l.funcionario_id}-${l.data}`}
              aoAbrir={setAberta}
              ordemInicial={{ coluna: 'data', desc: true }}
              movel={(l) => (
                <div class="pilha pilha--p">
                  <div class="linha linha--entre"><strong>{l.nome_exibicao}</strong><Situacao tom={TOM_STATUS[l.status]}>{ROTULO_STATUS[l.status]}</Situacao></div>
                  <span class="fraco">{dataCurta(l.data, { semana: true })} · {horaDe(l.entrada)} às {horaDe(l.saida)} · {minutos(l.trabalhado_min)}</span>
                </div>
              )}
              vazio={<Vazio titulo="Nenhum registro neste período">Mude o período ou os filtros.</Vazio>}
            />
            {p.total > p.itens.length && <p class="fraco equipe-rodape">Mostrando {p.itens.length} de {p.total} linhas. Reduza o período para ver o restante.</p>}
          </>
        )}
      </Dados>
      {aberta && <DetalheDia linha={aberta} perm={perm} aoFechar={() => setAberta(null)} />}
    </Cartao>
  );
}

type AlvoAjuste =
  | { modo: 'inclusao'; jornada_id?: string; tipo?: TipoBatida; instante: string }
  | { modo: 'correcao'; marcacao: Marcacao; tipo?: TipoBatida }
  | { modo: 'anulacao'; marcacao: Marcacao };

export function DetalheDia({ linha, perm, aoFechar }: { linha: LinhaEspelho; perm: PermissoesEquipe; aoFechar: () => void }) {
  const ids = linha.jornadas_ids;
  const consulta = useConsulta(`equipe:dia/${linha.funcionario_id}/${linha.data}`, () => Promise.all(ids.map((id) => equipe.jornada(id))));
  const [alvo, setAlvo] = useState<AlvoAjuste | null>(null);
  const incluir = () => setAlvo({ modo: 'inclusao', jornada_id: ids.at(-1), instante: `${linha.data}T12:00` });
  return (
    <Gaveta
      aberta
      aoFechar={aoFechar}
      largura="media"
      titulo={linha.nome_exibicao}
      subtitulo={dataCurta(linha.data, { semana: true, ano: true })}
      acoesTopo={perm.ajustar && <Botao tamanho="p" icone={<Plus aria-hidden="true" />} onClick={incluir}>Incluir batida</Botao>}
    >
      <div class="pilha">
        <dl class="definicoes">
          <dt>Situação</dt><dd><Situacao tom={TOM_STATUS[linha.status]}>{ROTULO_STATUS[linha.status]}</Situacao></dd>
          <dt>Previsto</dt><dd>{linha.previsto.entrada ? `${horaDe(linha.previsto.entrada)} às ${horaDe(linha.previsto.saida)}` : 'Sem previsão'}</dd>
          <dt>Trabalhado</dt><dd>{minutos(linha.trabalhado_min)}</dd>
          <dt>Intervalo</dt><dd>{minutos(linha.intervalo_min)}</dd>
          {linha.atraso_min > 0 && <><dt>Atraso</dt><dd>{minutos(linha.atraso_min)}</dd></>}
          {linha.excedente_min > 0 && <><dt>Tempo medido a mais</dt><dd>{minutos(linha.excedente_min)}</dd></>}
        </dl>
        {!!linha.sinalizacoes.length && <div class="linha">{linha.sinalizacoes.map((s) => <Etiqueta key={s} tom="atencao">{ROTULO_SINAL[s] ?? s}</Etiqueta>)}</div>}
        {!ids.length ? <Vazio compacto titulo="Sem batidas neste dia">Se a pessoa trabalhou, use Incluir batida.</Vazio> : (
          <Dados consulta={consulta}>
            {(jornadas) => <>{jornadas.map((j) => <Jornada key={j.id} jornada={j} perm={perm} aoAjustar={setAlvo} />)}</>}
          </Dados>
        )}
      </div>
      {alvo && <Ajuste alvo={alvo} funcionarioId={linha.funcionario_id} data={linha.data} aoFechar={() => setAlvo(null)} />}
    </Gaveta>
  );
}

function Jornada({ jornada, perm, aoAjustar }: { jornada: JornadaDetalhe; perm: PermissoesEquipe; aoAjustar: (a: AlvoAjuste) => void }) {
  const marcacoes = useMemo(() => [...jornada.marcacoes].sort((a, b) => a.instante_utc.localeCompare(b.instante_utc)), [jornada]);
  return (
    <>
      <h3 class="secao-titulo">Marcações</h3>
      <ul class="lista" aria-label="Marcações">
        {marcacoes.map((m) => (
          <li key={m.id}>
            <div class="lista__item equipe-marcacao" data-apagado={m.efetiva ? undefined : ''}>
              <div class="pilha pilha--p">
                <span><strong class="num">{horaDe(m.instante_utc)}</strong> {ROTULO_BATIDA[m.tipo]}{!m.efetiva && <span class="fraco"> · substituída ou anulada</span>}</span>
                <span class="fraco">{ROTULO_ORIGEM[m.origem]}{m.registrado_por_nome ? ` por ${m.registrado_por_nome}` : ''}</span>
                {m.justificativa && <span class="fraco">{m.justificativa}</span>}
              </div>
              {perm.ajustar && m.efetiva && (
                <div class="linha">
                  <Botao tamanho="p" onClick={() => aoAjustar({ modo: 'correcao', marcacao: m })}>Corrigir</Botao>
                  <Botao tamanho="p" variante="fantasma" onClick={() => aoAjustar({ modo: 'anulacao', marcacao: m })}>Anular</Botao>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!!jornada.ajustes.length && (
        <>
          <h3 class="secao-titulo">Correções feitas</h3>
          <ul class="lista" aria-label="Correções feitas">
            {jornada.ajustes.map((a) => (
              <li key={a.id}>
                <div class="lista__item">
                  <div class="pilha pilha--p">
                    <span><strong>{ROTULO_AJUSTE[a.tipo]}</strong> {textoAjuste(a.valor_anterior, a.valor_ajustado)}</span>
                    <span class="fraco">{a.responsavel_nome ?? 'Gestor'}, {dataHora(a.ocorreu_em)}</span>
                    <span class="fraco">{a.justificativa}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function textoAjuste(antes: { tipo?: TipoBatida; instante_utc?: string } | null, depois: { tipo?: TipoBatida; instante_utc?: string } | null): string {
  const t = (v: typeof antes) => (v?.tipo ? `${ROTULO_BATIDA[v.tipo]} ${horaDe(v.instante_utc)}` : '');
  if (antes && depois) return `${t(antes)} → ${t(depois)}`;
  return t(depois) || t(antes);
}

export function Ajuste({ alvo, funcionarioId, data, aoFechar }: { alvo: AlvoAjuste; funcionarioId: string; data: string; aoFechar: () => void }) {
  const inicial = alvo.modo === 'inclusao' ? alvo.instante : alvo.marcacao.instante_local.slice(0, 16);
  const tipoInicial = alvo.modo === 'inclusao' ? alvo.tipo ?? 'ENTRADA' : alvo.modo === 'correcao' ? alvo.tipo ?? alvo.marcacao.tipo : alvo.marcacao.tipo;
  const [instante, setInstante] = useState(inicial);
  const [tipo, setTipo] = useState<TipoBatida>(tipoInicial);
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const chave = useRef(novaChave());
  const valido = justificativa.trim().length >= JUSTIFICATIVA_MIN && !!instante;
  const titulo = alvo.modo === 'inclusao' ? 'Incluir batida esquecida' : alvo.modo === 'correcao' ? 'Corrigir marcação' : 'Anular marcação';

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    const base = { justificativa: justificativa.trim() };
    const corpo = alvo.modo === 'inclusao'
      ? { ...base, tipo: 'inclusao' as const, funcionario_id: funcionarioId, jornada_id: alvo.jornada_id, tipo_batida: tipo, instante: paraInstante(instante) }
      : alvo.modo === 'correcao'
        ? { ...base, tipo: 'correcao' as const, marcacao_id: alvo.marcacao.id, tipo_batida: tipo, instante: paraInstante(instante) }
        : { ...base, tipo: 'anulacao' as const, marcacao_id: alvo.marcacao.id };
    try {
      await equipe.ajustar(corpo, chave.current);
      avisar('Correção registrada.', 'ok');
      invalidar('equipe');
      aoFechar();
    } catch (e) {
      const m = e instanceof ErroApi ? e : null;
      if (m?.codigo === 'marcacao_ja_ajustada') setErro('Esta marcação já foi corrigida. Abra o dia de novo e corrija a marcação vigente.');
      else if (m?.codigo === 'ajuste_no_futuro') setErro('O horário não pode estar no futuro.');
      else setErro(m?.message ?? 'Não foi possível registrar.');
      if (m?.tipo === 'validacao' || m?.tipo === 'conflito') chave.current = novaChave();
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo
      aberto
      aoFechar={() => !enviando && aoFechar()}
      titulo={titulo}
      alerta={alvo.modo === 'anulacao'}
      acoes={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao variante={alvo.modo === 'anulacao' ? 'perigo' : 'primario'} onClick={enviar} carregando={enviando} disabled={!valido}>
            {alvo.modo === 'anulacao' ? 'Confirmar anulação' : 'Confirmar correção'}
          </Botao>
        </>
      }
    >
      <p>{alvo.modo === 'inclusao' ? `Batida de ${dataCurta(data)}.` : `Original: ${ROTULO_BATIDA[alvo.marcacao.tipo]} às ${horaDe(alvo.marcacao.instante_utc)}. Ela continua guardada.`}</p>
      {alvo.modo !== 'anulacao' && (
        <div class="grade-campos">
          <Campo rotulo="Tipo">
            {(id) => (
              <select id={id} class="selecao" value={tipo} onChange={(e) => setTipo(e.currentTarget.value as TipoBatida)}>
                {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_BATIDA[t]}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Data e hora">
            {(id) => <input id={id} class="entrada" type="datetime-local" required value={instante} onInput={(e) => setInstante(e.currentTarget.value)} />}
          </Campo>
        </div>
      )}
      <Campo rotulo="Justificativa" ajuda={`Pelo menos ${JUSTIFICATIVA_MIN} caracteres. Seu nome e este texto ficam na auditoria.`}>
        {(id, d) => <textarea id={id} class="area" aria-describedby={d} maxLength={JUSTIFICATIVA_MAX} value={justificativa} onInput={(e) => setJustificativa(e.currentTarget.value)} data-autofoco />}
      </Campo>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Dialogo>
  );
}
