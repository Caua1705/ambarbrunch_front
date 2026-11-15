// Checklist de ABERTURA no tablet (um por dia; sem fechamento). O caminho inteiro, sem modal e sem aprovação:
//   1. Os nomes das funcionárias ativas aparecem na hora; a pessoa toca no próprio nome e o checklist abre.
//      (Identificação DECLARADA: o histórico guarda o nome escolhido, a conta do tablet e o horário. Não é biometria.)
//   2. Cada tarefa: Feito / Não feito (Não feito pede o motivo). Cada toque é salvo sozinho no servidor.
//   3. Grava o vídeo da abertura (GravadorVideo) e envia.
//   4. Concluir só liberado com tudo marcado e o vídeo salvo no servidor.
// Já existe abertura hoje: volta direto para ela. Tocou no nome errado: "Voltar" mostra os nomes de novo e o toque em outro
// nome troca a responsável (só em andamento; marcações e vídeo ficam; fica na auditoria). Sem vídeo, quem conclui é a
// gerência pelo painel (Equipe → Abertura).
import { useEffect, useRef, useState } from 'preact/hooks';
import { ArrowLeft, Check, CheckCircle2, CloudOff, LoaderCircle, RotateCcw, X } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { abertura } from '../../lib/api/operacao';
import { invalidar, useConsulta } from '../../lib/consulta';
import type { AberturaHoje, ChecklistAbertura, ItemChecklist, SituacaoItem } from '../../lib/tipos/abertura';
import { Aviso, Botao } from '../../ui/base';
import { avisarErro } from '../../ui/camadas';
import { Dados } from '../../ui/estados';
import { GravadorVideo } from './GravadorVideo';

const CHAVE = 'abertura:hoje';
const horaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' });
const hora = (iso: string | null) => (iso ? horaFmt.format(new Date(iso)) : '');
const dataCurta = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const minSeg = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

export function Abertura({ apiUrl }: { apiUrl: string | null }) {
  // Sem releitura periódica: o que está na tela (inclusive o que está sendo digitado) é a fonte até salvar.
  const consulta = useConsulta(CHAVE, () => abertura.hoje());
  // null: o checklist. 'lista': voltou aos nomes. <id>: escolheu esse nome — os nomes ficam na tela (com o carregando no
  // nome tocado) até o servidor devolver o checklist já com essa responsável; nunca aparece o nome antigo.
  const [nomes, setNomes] = useState<string | null>(null);
  return (
    <Dados consulta={consulta} recurso="O checklist de abertura">
      {(hoje) => {
        const c = hoje.checklist;
        const mostrarNomes = !c || (c.estado === 'em_andamento' && nomes !== null
          && (nomes === 'lista' || c.responsavel.funcionario_id !== nomes));
        return mostrarNomes
          ? <EscolherNome hoje={hoje} aoEscolher={(id) => setNomes(id)} />
          : <Checklist key={`${c!.id}:${c!.responsavel.funcionario_id}`} inicial={c!} hoje={hoje} apiUrl={apiUrl} aoVoltar={() => setNomes('lista')} />;
      }}
    </Dados>
  );
}

// --- 1. quem está abrindo ------------------------------------------------------------------------

function EscolherNome({ hoje, aoEscolher }: { hoje: AberturaHoje; aoEscolher: (id: string | null) => void }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const atual = hoje.checklist;

  const escolher = async (id: string) => {
    if (enviando) return;   // um toque só
    // Voltou e tocou no mesmo nome: só volta ao checklist.
    if (atual?.responsavel.funcionario_id === id) return aoEscolher(id);
    setEnviando(id);
    setErro(null);
    try {
      if (atual) await abertura.trocarResponsavel(atual.id, id);
      else await abertura.assumirDeclarada(id);
      aoEscolher(id);
      invalidar(CHAVE);
    } catch (e) {
      // Outra pessoa abriu antes: a tela volta direto para a abertura que já existe.
      if (e instanceof ErroApi && (e.codigo === 'abertura_ja_assumida' || e.codigo === 'checklist_concluido')) {
        aoEscolher(null);
        return invalidar(CHAVE);
      }
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível abrir o checklist. Tente de novo.');
      setEnviando(null);
    }
  };

  return (
    <div class="op-abertura">
      <div class="op-abertura__cabeca">
        <h2>Quem está abrindo hoje?</h2>
        <p>Toque no seu nome · {dataCurta(hoje.data)}</p>
      </div>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
      {!hoje.funcionarios?.length ? <Aviso tom="atencao">Nenhuma funcionária ativa cadastrada. Avise o gestor.</Aviso> : (
        <ul class="op-nomes">
          {hoje.funcionarios.map((f) => (
            <li key={f.id}>
              <button type="button" class="op-nome" disabled={!!enviando} aria-busy={enviando === f.id || undefined} aria-current={atual?.responsavel.funcionario_id === f.id || undefined} onClick={() => escolher(f.id)}>
                <span class="op-nome__inicial" aria-hidden="true">{enviando === f.id ? <LoaderCircle class="girando" /> : iniciais(f.nome_exibicao)}</span>
                <span class="op-nome__texto">{f.nome_exibicao}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- 2–4. tarefas, vídeo, concluir ---------------------------------------------------------------

type EstadoSalvo = 'salvo' | 'salvando' | 'erro';

function Checklist({ inicial, hoje, apiUrl, aoVoltar }: { inicial: ChecklistAbertura; hoje: AberturaHoje; apiUrl: string | null; aoVoltar: () => void }) {
  const [c, setC] = useState(inicial);
  const [itens, setItens] = useState<ItemChecklist[]>(inicial.itens ?? []);
  const [salvo, setSalvo] = useState<EstadoSalvo>('salvo');
  const [regravar, setRegravar] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [foco, setFoco] = useState<string | null>(null);
  const pendentesRef = useRef(new Map<string, ItemChecklist>());
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const digitandoRef = useRef(new Map<string, number>());
  const editavel = c.estado === 'em_andamento';

  /** Salva no servidor em fila (um envio por vez, na ordem dos toques); o que falhar fica pendente e é reenviado. */
  const salvar = (mudados: ItemChecklist[]) => {
    mudados.forEach((i) => pendentesRef.current.set(i.id, i));
    setSalvo('salvando');
    filaRef.current = filaRef.current.then(async () => {
      const lote = [...pendentesRef.current.values()];
      if (!lote.length) return setSalvo('salvo');
      try {
        const r = await abertura.salvar(c.id, lote.map((i) => ({ id: i.id, situacao: i.situacao, observacao: i.observacao })));
        lote.forEach((i) => { if (pendentesRef.current.get(i.id) === i) pendentesRef.current.delete(i.id); });
        setC(r);
        setSalvo(pendentesRef.current.size ? 'salvando' : 'salvo');
      } catch (e) {
        setSalvo('erro');
        if (e instanceof ErroApi && e.tipo === 'conflito') {
          avisarErro(e);
          invalidar(CHAVE);
        }
      }
    });
  };
  // Sem internet por um instante: tenta salvar de novo sozinho a cada 15 s.
  useEffect(() => {
    if (salvo !== 'erro') return;
    const t = setTimeout(() => salvar([]), 15_000);
    return () => clearTimeout(t);
  }, [salvo]);
  useEffect(() => () => digitandoRef.current.forEach((t) => clearTimeout(t)), []);

  const marcar = (item: ItemChecklist, situacao: SituacaoItem) => {
    const nova = item.situacao === situacao ? null : situacao;   // tocar de novo desmarca
    const novo = { ...item, situacao: nova, observacao: nova === 'nao_feito' ? item.observacao : null };
    setItens((lista) => lista.map((i) => (i.id === item.id ? novo : i)));
    if (nova === 'nao_feito' && !novo.observacao) setFoco(item.id);
    salvar([novo]);
  };

  /** Motivo do "Não feito": salva sozinho quando a pessoa para de digitar (ou sai do campo). */
  const escrever = (item: ItemChecklist, texto: string, agora = false) => {
    const novo = { ...item, observacao: texto.trim() ? texto : null };
    setItens((lista) => lista.map((i) => (i.id === item.id ? novo : i)));
    clearTimeout(digitandoRef.current.get(item.id));
    const fazer = () => salvar([{ ...novo, observacao: texto.trim() || null }]);
    if (agora) fazer();
    else digitandoRef.current.set(item.id, window.setTimeout(fazer, 800));
  };

  const marcadas = itens.filter((i) => i.situacao).length;
  const pendentes = itens.length - marcadas;
  const semMotivo = itens.filter((i) => i.situacao === 'nao_feito' && !i.observacao?.trim()).length;
  const temVideo = !!c.video;
  const podeConcluir = editavel && !pendentes && !semMotivo && temVideo && salvo === 'salvo';
  const falta = pendentes ? `Falta${pendentes > 1 ? 'm' : ''} ${pendentes} tarefa${pendentes > 1 ? 's' : ''}.`
    : semMotivo ? 'Escreva o motivo de cada tarefa não feita.'
      : !temVideo ? 'Falta o vídeo da abertura.'
        : salvo !== 'salvo' ? 'Salvando…' : '';

  const concluir = async () => {
    setConcluindo(true);
    try {
      await filaRef.current;
      const r = await abertura.concluir(c.id);
      setC(r);
      invalidar(CHAVE);
    } catch (e) {
      avisarErro(e);
    } finally {
      setConcluindo(false);
    }
  };

  if (!editavel) {
    return (
      <div class="op-abertura">
        <div class="op-recibo" role="status">
          <CheckCircle2 aria-hidden="true" />
          <p class="op-recibo__rotulo">Abertura concluída · {dataCurta(c.data)}</p>
          <h2>{c.responsavel.nome_exibicao}</h2>
          <p class="op-recibo__tipo">{c.resumo.feitos} de {c.resumo.total} tarefas feitas</p>
          {c.nao_feitos.length > 0 && <p>Não feita{c.nao_feitos.length > 1 ? 's' : ''}: {c.nao_feitos.map((n) => n.titulo).join(', ')}</p>}
          <p class="op-recibo__data">{c.video ? 'Vídeo salvo' : 'Sem vídeo'} · concluída às {hora(c.concluido_em)}</p>
        </div>
      </div>
    );
  }

  // Antes de voltar aos nomes, termina de salvar o que já foi marcado.
  const voltar = async () => {
    await filaRef.current;
    aoVoltar();
  };

  return (
    <div class="op-abertura">
      <button type="button" class="op-voltar" onClick={voltar}>
        <ArrowLeft aria-hidden="true" /> Voltar
      </button>
      <div class="op-abertura__cabeca op-abertura__cabeca--linha">
        <div>
          <h2>Abertura · {dataCurta(c.data)}</h2>
          <p>Responsável: <strong>{c.responsavel.nome_exibicao}</strong></p>
        </div>
        <span class={`op-salvo op-salvo--${salvo}`} role="status">
          {salvo === 'salvo' ? <><Check aria-hidden="true" /> Salvo</> : salvo === 'salvando' ? <><LoaderCircle class="girando" aria-hidden="true" /> Salvando…</> : <><CloudOff aria-hidden="true" /> Sem conexão</>}
        </span>
      </div>

      {salvo === 'erro' && (
        <Aviso tom="perigo">
          <span class="linha linha--entre" style={{ width: '100%' }}>
            <span>Sem conexão. As marcações estão na tela e serão salvas assim que a internet voltar.</span>
            <Botao tamanho="p" onClick={() => salvar([])}>Tentar agora</Botao>
          </span>
        </Aviso>
      )}

      <div class="op-progresso" role="status" aria-label={`${marcadas} de ${itens.length} tarefas`}>
        <strong>{marcadas} de {itens.length} tarefas</strong>
        <span class="op-progresso__barra" aria-hidden="true"><span style={{ width: `${itens.length ? (marcadas / itens.length) * 100 : 0}%` }} /></span>
      </div>

      <ol class="op-tarefas">
        {itens.map((i) => (
          <li key={i.id} class={`op-tarefa${i.situacao ? ` op-tarefa--${i.situacao}` : ''}`}>
            <div class="op-tarefa__linha">
              <span class="op-tarefa__titulo">{i.titulo}</span>
              <div class="op-tarefa__botoes" role="group" aria-label={i.titulo}>
                <button type="button" class="op-marca op-marca--feito" aria-pressed={i.situacao === 'feito'} onClick={() => marcar(i, 'feito')}>
                  <Check aria-hidden="true" /> Feito
                </button>
                <button type="button" class="op-marca op-marca--nao" aria-pressed={i.situacao === 'nao_feito'} onClick={() => marcar(i, 'nao_feito')}>
                  <X aria-hidden="true" /> Não feito
                </button>
              </div>
            </div>
            {i.situacao === 'nao_feito' && (
              <label class="op-tarefa__obs">
                <span class="sr">Motivo: {i.titulo}</span>
                <input
                  class="entrada"
                  type="text"
                  maxLength={300}
                  placeholder="Por que não foi feito?"
                  value={i.observacao ?? ''}
                  ref={(el) => { if (el && foco === i.id) { el.focus(); setFoco(null); } }}
                  aria-invalid={!i.observacao?.trim() ? true : undefined}
                  onInput={(e) => escrever(i, e.currentTarget.value)}
                  onBlur={(e) => escrever(i, e.currentTarget.value, true)}
                />
              </label>
            )}
          </li>
        ))}
      </ol>

      <section class="op-abertura__video" aria-label="Vídeo da abertura">
        <h3>Vídeo da abertura</h3>
        {temVideo && !regravar ? (
          <div class="op-feito-video">
            <CheckCircle2 aria-hidden="true" />
            <span>Vídeo salvo{c.video!.duracao_s ? ` · ${minSeg(c.video!.duracao_s)}` : ''}</span>
            <Botao tamanho="p" variante="fantasma" icone={<RotateCcw aria-hidden="true" />} onClick={() => setRegravar(true)}>Gravar de novo</Botao>
          </div>
        ) : (
          <>
            <p>Grave um vídeo mostrando o salão, vitrines, banheiros, entrada e jardim.</p>
            <GravadorVideo
              checklistId={c.id}
              maxMb={hoje.video.max_mb}
              maxSegundos={hoje.video.max_segundos}
              apiUrl={apiUrl}
              aoCancelar={temVideo ? () => setRegravar(false) : undefined}
              aoSalvar={(novo) => { setC(novo); setRegravar(false); }}
            />
            {temVideo && <Botao variante="fantasma" onClick={() => setRegravar(false)}>Manter o vídeo salvo</Botao>}
          </>
        )}
      </section>

      <div class="op-abertura__fim">
        {falta && <p class="op-abertura__falta" role="status">{falta}</p>}
        <button type="button" class="op-terminal__principal" disabled={!podeConcluir || concluindo} onClick={concluir}>
          {concluindo ? <LoaderCircle class="girando" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} Concluir abertura
        </button>
        {!temVideo && <p class="op-abertura__ajuda">Não consegue enviar o vídeo? Avise o gestor.</p>}
      </div>
    </div>
  );
}
