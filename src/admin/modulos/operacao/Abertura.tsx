// Checklist de ABERTURA no tablet (um por dia; sem fechamento nesta etapa e sem nenhuma mensagem no WhatsApp).
//   1. Uma funcionária assume a abertura: pelo rosto (identificação do terminal, gasta nisso) ou, sem reconhecimento
//      facial, escolhendo o nome — aí fica "aguardando confirmação do gestor", porque a conta do tablet é compartilhada.
//   2. Marca cada tarefa como Feito / Não feito (com observação quando não feito). Cada toque é salvo no servidor.
//   3. Grava o vídeo da abertura (um só) e envia.
//   4. Conclui e envia. O Proprietário acompanha em Equipe → Abertura.
import { useRef, useState } from 'preact/hooks';
import { Check, CheckCircle2, CircleAlert, CloudOff, LoaderCircle, ScanFace, ShieldCheck, UserRound, Video, X } from 'lucide-preact';
import { ErroApi } from '../../lib/api/cliente';
import { abertura } from '../../lib/api/operacao';
import { invalidar, useConsulta } from '../../lib/consulta';
import type { AberturaHoje, ChecklistAbertura, ConfiguracaoQuiosque, ItemChecklist, SituacaoItem } from '../../lib/tipos/abertura';
import { Aviso, Botao, Situacao } from '../../ui/base';
import { avisar, avisarErro, Dialogo } from '../../ui/camadas';
import { Dados } from '../../ui/estados';
import { Identificacao, mensagemDeErro, type FimIdentificacao } from './Identificacao';
import { GravadorVideo } from './GravadorVideo';

const CHAVE = 'abertura:hoje';
const horaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' });
const hora = (iso: string | null) => (iso ? horaFmt.format(new Date(iso)) : '');
const dataCurta = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

export function Abertura({ config, apiUrl }: { config: ConfiguracaoQuiosque | null; apiUrl: string | null }) {
  // Sem releitura periódica: o que está na tela (inclusive o que está sendo digitado) é a fonte até salvar.
  const consulta = useConsulta(CHAVE, () => abertura.hoje());
  return (
    <Dados consulta={consulta} recurso="O checklist de abertura">
      {(hoje) => (hoje.checklist
        ? <Checklist key={hoje.checklist.id} inicial={hoje.checklist} hoje={hoje} apiUrl={apiUrl} />
        : <Assumir hoje={hoje} config={config} apiUrl={apiUrl} />)}
    </Dados>
  );
}

// --- 1. assumir ----------------------------------------------------------------------------------

function Assumir({ hoje, config, apiUrl }: { hoje: AberturaHoje; config: ConfiguracaoQuiosque | null; apiUrl: string | null }) {
  const pelo_rosto = hoje.biometria_disponivel && !!config;
  const [modo, setModo] = useState<'inicio' | 'camera' | 'lista'>('inicio');
  const [identificada, setIdentificada] = useState<{ nome: string; sessao_id: string; autorizacao: string } | null>(null);
  const [escolhida, setEscolhida] = useState<{ id: string; nome: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const concluir = async (fazer: () => Promise<ChecklistAbertura>) => {
    setEnviando(true);
    setErro(null);
    try {
      await fazer();
      avisar('Abertura assumida.', 'ok');
      invalidar(CHAVE);
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'abertura_ja_assumida') invalidar(CHAVE);
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível assumir. Tente de novo.');
      setIdentificada(null);
      setEscolhida(null);
      setModo('inicio');
    } finally {
      setEnviando(false);
    }
  };

  const aoIdentificar = (fim: FimIdentificacao) => {
    if (fim.tipo === 'cancelada') return setModo('inicio');
    if (fim.tipo === 'erro') {
      const m = mensagemDeErro(fim.erro);
      setErro(`${m.titulo}. ${m.mensagem}`);
      return setModo('inicio');
    }
    const r = fim.resultado;
    if (r.resultado !== 'aprovado' || !r.autorizacao) {
      setErro(r.mensagem);
      return setModo('inicio');
    }
    setIdentificada({ nome: r.nome_exibicao ?? '', sessao_id: fim.sessao.sessao_id, autorizacao: r.autorizacao });
    setModo('inicio');
  };

  return (
    <div class="op-abertura">
      <div class="op-abertura__topo">
        <div>
          <h2>Abertura de hoje · {dataCurta(hoje.data)}</h2>
          <p class="fraco">Ninguém assumiu ainda. Uma pessoa assume e preenche; as outras só registram o ponto.</p>
        </div>
        <Situacao tom="atencao">Não iniciada</Situacao>
      </div>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}

      {modo === 'camera' && config && <Identificacao config={config} apiUrl={apiUrl} aoTerminar={aoIdentificar} />}

      {modo === 'inicio' && (
        <div class="op-abertura__assumir">
          {pelo_rosto && (
            <button type="button" class="op-terminal__principal" onClick={() => { setErro(null); setModo('camera'); }} disabled={enviando}>
              <ScanFace aria-hidden="true" /> Assumir a abertura
            </button>
          )}
          <Botao variante={pelo_rosto ? 'fantasma' : 'primario'} icone={<UserRound aria-hidden="true" />} onClick={() => { setErro(null); setModo('lista'); }}>
            {pelo_rosto ? 'Sem reconhecimento facial? Escolher meu nome' : 'Assumir a abertura: escolher meu nome'}
          </Botao>
          {!pelo_rosto && <p class="fraco">O reconhecimento facial não está disponível: quem assumir pelo nome fica <strong>aguardando confirmação do gestor</strong>.</p>}
          {!!hoje.tarefas?.length && <p class="fraco">{hoje.tarefas.length} tarefas no checklist de hoje.</p>}
        </div>
      )}

      {modo === 'lista' && (
        <div class="op-abertura__nomes">
          <p><strong>Quem vai abrir hoje?</strong> Toque no seu nome.</p>
          {!hoje.funcionarios?.length ? <Aviso tom="atencao">Nenhuma funcionária ativa cadastrada. Fale com o gestor.</Aviso> : (
            <ul class="op-abertura__lista-nomes">
              {hoje.funcionarios.map((f) => (
                <li key={f.id}>
                  <button type="button" class="op-nome" onClick={() => setEscolhida({ id: f.id, nome: f.nome_exibicao })}>
                    <span class="avatar" aria-hidden="true">{f.nome_exibicao.slice(0, 1).toUpperCase()}</span>
                    <span>{f.nome_exibicao}</span>
                    {f.ponto_hoje && <small class="fraco">ponto registrado hoje</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Botao variante="fantasma" onClick={() => setModo('inicio')}>Voltar</Botao>
        </div>
      )}

      <Dialogo
        aberto={!!identificada}
        aoFechar={() => setIdentificada(null)}
        titulo={`${identificada?.nome ?? ''}, assumir a abertura de hoje?`}
        acoes={<>
          <Botao variante="fantasma" onClick={() => setIdentificada(null)}>Não sou eu</Botao>
          <Botao variante="primario" carregando={enviando} onClick={() => identificada && concluir(() => abertura.assumirPeloRosto(identificada.sessao_id, identificada.autorizacao))}>Assumir</Botao>
        </>}
      >
        <p>Você fica como responsável pelo checklist e pelo vídeo de hoje. Identificada pelo rosto.</p>
      </Dialogo>
      <Dialogo
        aberto={!!escolhida}
        aoFechar={() => setEscolhida(null)}
        titulo={`Assumir a abertura como ${escolhida?.nome ?? ''}?`}
        acoes={<>
          <Botao variante="fantasma" onClick={() => setEscolhida(null)}>Cancelar</Botao>
          <Botao variante="primario" carregando={enviando} onClick={() => escolhida && concluir(() => abertura.assumirDeclarada(escolhida.id))}>Assumir</Botao>
        </>}
      >
        <p>Sem o rosto, o sistema registra que a abertura foi assumida pelo nome escolhido neste tablet e o gestor confirma depois. Só escolha o seu próprio nome.</p>
      </Dialogo>
    </div>
  );
}

// --- 2–4. preencher, vídeo, concluir -------------------------------------------------------------

type EstadoSalvo = 'salvo' | 'salvando' | 'erro';

function Checklist({ inicial, hoje, apiUrl }: { inicial: ChecklistAbertura; hoje: AberturaHoje; apiUrl: string | null }) {
  const [c, setC] = useState(inicial);
  const [itens, setItens] = useState<ItemChecklist[]>(inicial.itens ?? []);
  const [obsGeral, setObsGeral] = useState(inicial.observacao ?? '');
  const [salvo, setSalvo] = useState<EstadoSalvo>('salvo');
  const [gravando, setGravando] = useState(false);
  const [semVideo, setSemVideo] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const pendentesRef = useRef(new Map<string, ItemChecklist>());
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const editavel = c.estado === 'em_andamento';

  /** Salva no servidor em fila (um envio por vez, na ordem dos toques); o que falhar fica pendente e é reenviado. */
  const salvar = (mudados: ItemChecklist[], observacao?: string) => {
    mudados.forEach((i) => pendentesRef.current.set(i.id, i));
    setSalvo('salvando');
    filaRef.current = filaRef.current.then(async () => {
      const lote = [...pendentesRef.current.values()];
      if (!lote.length && observacao === undefined) return setSalvo('salvo');
      try {
        const r = await abertura.salvar(c.id, lote.map((i) => ({ id: i.id, situacao: i.situacao, observacao: i.observacao })), observacao);
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

  const mudar = (item: ItemChecklist, situacao: SituacaoItem | null, observacao = item.observacao) => {
    const novo = { ...item, situacao, observacao };
    setItens((lista) => lista.map((i) => (i.id === item.id ? novo : i)));
    if (situacao === 'nao_feito' && !observacao) setAberta(item.id);
    salvar([novo]);
  };

  const feitos = itens.filter((i) => i.situacao === 'feito').length;
  const naoFeitos = itens.filter((i) => i.situacao === 'nao_feito');
  const pendentes = itens.filter((i) => !i.situacao).length;
  const semMotivo = naoFeitos.filter((i) => !i.observacao?.trim()).length;
  const temVideo = !!c.video;
  const motivoOk = (semVideo ?? '').trim().length >= 3;
  const podeConcluir = editavel && !pendentes && !semMotivo && (temVideo || motivoOk) && salvo === 'salvo';

  const concluir = async () => {
    setConcluindo(true);
    try {
      await filaRef.current;
      const r = await abertura.concluir(c.id, temVideo ? null : semVideo);
      setC(r);
      avisar('Abertura concluída e enviada.', 'ok');
      invalidar(CHAVE);
    } catch (e) {
      avisarErro(e);
    } finally {
      setConcluindo(false);
    }
  };

  const r = c.responsavel;
  return (
    <div class="op-abertura">
      <div class="op-abertura__topo">
        <div>
          <h2>Abertura de hoje · {dataCurta(c.data)}</h2>
          <p class="op-abertura__quem">
            Responsável: <strong>{r.nome_exibicao}</strong>
            {r.metodo === 'facial'
              ? <Situacao tom="ok"><ShieldCheck aria-hidden="true" /> pelo rosto</Situacao>
              : r.verificada ? <Situacao tom="ok">confirmada pelo gestor</Situacao> : <Situacao tom="atencao">aguardando confirmação do gestor</Situacao>}
            <span class="fraco"> · assumiu às {hora(c.assumido_em)}</span>
          </p>
        </div>
        {editavel
          ? <span class={`op-salvo op-salvo--${salvo}`} role="status">{salvo === 'salvo' ? <><Check aria-hidden="true" /> Salvo</> : salvo === 'salvando' ? <><LoaderCircle class="girando" aria-hidden="true" /> Salvando…</> : <><CloudOff aria-hidden="true" /> Não salvo</>}</span>
          : <Situacao tom="ok">Concluída às {hora(c.concluido_em)}</Situacao>}
      </div>

      {salvo === 'erro' && (
        <Aviso tom="perigo">
          <span class="linha linha--entre" style={{ width: '100%' }}>
            <span>Sem conexão: as últimas marcações ainda não foram salvas no sistema (continuam na tela).</span>
            <Botao tamanho="p" onClick={() => salvar([])}>Tentar de novo</Botao>
          </span>
        </Aviso>
      )}

      <p class="op-abertura__contagem">{feitos} de {itens.length} feitas{naoFeitos.length ? ` · ${naoFeitos.length} não feita${naoFeitos.length > 1 ? 's' : ''}` : ''}{pendentes ? ` · ${pendentes} por marcar` : ''}</p>

      <ol class="op-tarefas">
        {itens.map((i) => (
          <li key={i.id} class={`op-tarefa${i.situacao ? ` op-tarefa--${i.situacao}` : ''}`}>
            <div class="op-tarefa__linha">
              <span class="op-tarefa__titulo">{i.titulo}</span>
              <div class="op-tarefa__botoes" role="group" aria-label={i.titulo}>
                <button type="button" class="op-marca op-marca--feito" aria-pressed={i.situacao === 'feito'} disabled={!editavel} onClick={() => mudar(i, i.situacao === 'feito' ? null : 'feito')}>
                  <Check aria-hidden="true" /> Feito
                </button>
                <button type="button" class="op-marca op-marca--nao" aria-pressed={i.situacao === 'nao_feito'} disabled={!editavel} onClick={() => mudar(i, i.situacao === 'nao_feito' ? null : 'nao_feito')}>
                  <X aria-hidden="true" /> Não feito
                </button>
              </div>
            </div>
            {(aberta === i.id || i.observacao || i.situacao === 'nao_feito') && (
              <label class="op-tarefa__obs">
                <span class="sr">Observação sobre {i.titulo}</span>
                <input
                  class="entrada"
                  type="text"
                  maxLength={500}
                  placeholder={i.situacao === 'nao_feito' ? 'Por que não foi feito? (obrigatório)' : 'Observação (opcional)'}
                  value={i.observacao ?? ''}
                  disabled={!editavel}
                  aria-invalid={i.situacao === 'nao_feito' && !i.observacao?.trim() ? true : undefined}
                  onInput={(e) => { const v = e.currentTarget.value; setItens((l) => l.map((x) => (x.id === i.id ? { ...x, observacao: v || null } : x))); }}
                  onBlur={(e) => { const v = e.currentTarget.value.trim() || null; if (v !== (inicialDe(c, i.id)?.observacao ?? null)) mudar({ ...i, observacao: v }, i.situacao, v); }}
                />
              </label>
            )}
            {editavel && aberta !== i.id && !i.observacao && i.situacao !== 'nao_feito' && (
              <button type="button" class="op-tarefa__mais" onClick={() => setAberta(i.id)}>+ observação</button>
            )}
          </li>
        ))}
      </ol>

      <label class="op-abertura__geral">
        <span>Observações gerais <span class="fraco">(opcional)</span></span>
        <textarea class="entrada" rows={2} maxLength={1000} value={obsGeral} disabled={!editavel}
          onInput={(e) => setObsGeral(e.currentTarget.value)}
          onBlur={() => { if ((obsGeral.trim() || null) !== (c.observacao ?? null)) salvar([], obsGeral.trim()); }} />
      </label>

      <section class="op-abertura__video" aria-label="Vídeo da abertura">
        <h3><Video aria-hidden="true" /> Vídeo da abertura</h3>
        {temVideo && !gravando && (
          <p class="op-feito-video"><CheckCircle2 aria-hidden="true" /> Vídeo enviado às {hora(c.video!.enviado_em)}{c.video!.duracao_s ? ` · ${Math.floor(c.video!.duracao_s / 60)}:${String(c.video!.duracao_s % 60).padStart(2, '0')}` : ''}
            {editavel && <Botao tamanho="p" variante="fantasma" onClick={() => setGravando(true)}>Refazer o vídeo</Botao>}</p>
        )}
        {!temVideo && !gravando && (editavel || !c.video) && (
          <>
            {c.sem_video_motivo && <p class="fraco">Concluída sem vídeo: {c.sem_video_motivo}</p>}
            <Botao variante={editavel ? 'primario' : 'secundario'} icone={<Video aria-hidden="true" />} onClick={() => setGravando(true)}>Gravar vídeo da abertura</Botao>
          </>
        )}
        {gravando && (
          <GravadorVideo
            checklistId={c.id}
            maxMb={hoje.video.max_mb}
            maxSegundos={hoje.video.max_segundos}
            apiUrl={apiUrl}
            aoCancelar={() => setGravando(false)}
            aoEnviar={(novo) => { setC(novo); setGravando(false); avisar('Vídeo enviado.', 'ok'); }}
          />
        )}
      </section>

      {editavel && (
        <div class="op-abertura__fim">
          {!temVideo && (
            semVideo === null
              ? <button type="button" class="op-tarefa__mais" onClick={() => setSemVideo('')}>Não foi possível gravar o vídeo?</button>
              : (
                <label class="op-abertura__geral">
                  <span>Por que não há vídeo? <span class="fraco">(obrigatório para concluir sem vídeo)</span></span>
                  <input class="entrada" type="text" maxLength={500} value={semVideo} onInput={(e) => setSemVideo(e.currentTarget.value)} />
                </label>
              )
          )}
          {!podeConcluir && (
            <p class="fraco" role="status">
              <CircleAlert aria-hidden="true" />{' '}
              {pendentes ? `Marque as ${pendentes} tarefas que faltam.` : semMotivo ? 'Explique por que cada tarefa não foi feita.' : !temVideo && !motivoOk ? 'Grave o vídeo (ou diga por que não foi possível).' : salvo !== 'salvo' ? 'Aguarde salvar.' : ''}
            </p>
          )}
          <button type="button" class="op-terminal__principal" disabled={!podeConcluir || concluindo} onClick={concluir}>
            {concluindo ? <LoaderCircle class="girando" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} Concluir e enviar
          </button>
        </div>
      )}
      {!editavel && <Aviso tom="ok">Checklist de hoje concluído. O gestor acompanha pelo painel.</Aviso>}
    </div>
  );
}

function inicialDe(c: ChecklistAbertura, id: string) {
  return c.itens?.find((i) => i.id === id);
}
