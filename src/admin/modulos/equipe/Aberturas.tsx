// Equipe → Abertura: os checklists de abertura feitos no tablet, um por dia (Gerente e Proprietário, `abertura.consultar`).
// Lista do mês e, ao abrir um dia, as tarefas, o vídeo (link assinado de minutos do bucket privado) e o envio ao WhatsApp.
// A responsável é a pessoa que tocou no próprio nome no tablet: identificação declarada, sem aprovação do gestor.
// Recuperação supervisionada: a gerência conclui sem vídeo (defeito técnico real, com motivo) e o Proprietário reenvia o
// vídeo ao WhatsApp depois de uma falha (limitado; nunca com outro envio saindo).
import { useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight, ClipboardCheck, Send, Video, VideoOff } from 'lucide-preact';
import { abertura, conteudoDoVideo } from '../../lib/api/operacao';
import { invalidar, useConsulta } from '../../lib/consulta';
import { dataCurta, dataHora, fimMes, hojeISO, horaDe, inicioMes, mesAno, somarMeses } from '../../lib/formato';
import type { ChecklistAbertura, WhatsappAbertura } from '../../lib/tipos/abertura';
import { Aviso, Botao, Cartao, Situacao, type Tom } from '../../ui/base';
import { avisar, avisarErro, Gaveta } from '../../ui/camadas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';

const duracao = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

const SITUACAO_WHATSAPP: Record<NonNullable<WhatsappAbertura['status']>, [string, Tom]> = {
  aguardando_midia: ['aguardando', 'apagado'],
  pendente: ['na fila', 'info'],
  enviando: ['enviando', 'info'],
  aceita: ['aceita pela Z-API', 'info'],
  entregue: ['entregue', 'ok'],
  lida: ['entregue e vista', 'ok'],
  falhou: ['falhou', 'perigo'],
  bloqueada: ['bloqueada', 'atencao'],
  cancelada: ['não enviada', 'atencao'],
};

function Whatsapp({ w }: { w?: WhatsappAbertura }) {
  if (!w || !w.status) return <span class="fraco">{w?.modo === 'desligado' ? 'desligado' : '—'}</span>;
  const [rotulo, tom] = SITUACAO_WHATSAPP[w.status];
  return <span class="linha" style={{ gap: '6px', flexWrap: 'wrap' }}><Situacao tom={tom}>{rotulo}</Situacao>{w.grupo === 'teste' && <span class="fraco">teste</span>}</span>;
}

export function Aberturas({ podeReenviar }: { podeReenviar: boolean }) {
  const [mes, setMes] = useState(() => inicioMes(hojeISO()));
  const [aberto, setAberto] = useState<string | null>(null);
  const chave = `abertura:lista?${mes}`;
  const consulta = useConsulta(chave, () => abertura.listar(mes, fimMes(mes)));

  const colunas: Coluna<ChecklistAbertura>[] = [
    { id: 'data', titulo: 'Data', celula: (c) => <span class="num">{dataCurta(c.data, { semana: true })}</span> },
    { id: 'responsavel', titulo: 'Responsável', celula: (c) => <span class="principal-celula">{c.responsavel.nome_exibicao}</span> },
    { id: 'tarefas', titulo: 'Tarefas', celula: (c) => <span class="num">{c.resumo.feitos}/{c.resumo.total}</span> },
    { id: 'nao', titulo: 'Não feitas', prioridade: 'media', celula: (c) => (c.nao_feitos.length ? <span>{c.nao_feitos.map((n) => n.titulo).join(', ')}</span> : <span class="fraco">—</span>) },
    { id: 'concluido', titulo: 'Concluído', celula: (c) => (c.estado === 'concluido' ? <span class="num">{horaDe(c.concluido_em)}</span> : <Situacao tom="atencao">não concluído</Situacao>) },
    { id: 'video', titulo: 'Vídeo', celula: (c) => (c.video ? <span class="linha"><Video aria-label="Com vídeo" /> {duracao(c.video.duracao_s)}</span> : <VideoOff class="fraco" aria-label="Sem vídeo" />) },
    { id: 'whatsapp', titulo: 'WhatsApp', prioridade: 'media', celula: (c) => <Whatsapp w={c.whatsapp} /> },
  ];

  return (
    <div class="pilha">
      <Cartao
        titulo="Checklists de abertura"
        descricao="Um por dia, feito no tablet por quem tocou no próprio nome."
        acoes={(
          <div class="linha">
            <Botao tamanho="p" variante="fantasma" so_icone aria-label="Mês anterior" icone={<ChevronLeft aria-hidden="true" />} onClick={() => setMes(somarMeses(mes, -1))} />
            <strong class="num" style={{ minWidth: '9ch', textAlign: 'center' }}>{mesAno(mes)}</strong>
            <Botao tamanho="p" variante="fantasma" so_icone aria-label="Próximo mês" icone={<ChevronRight aria-hidden="true" />} disabled={mes >= inicioMes(hojeISO())} onClick={() => setMes(somarMeses(mes, 1))} />
          </div>
        )}
        justo
      >
        <Dados consulta={consulta} recurso="Os checklists de abertura" esqueleto={<EsqueletoTabela />}>
          {(p) => (
            <Tabela
              rotulo="Checklists de abertura"
              colunas={colunas}
              linhas={p.itens}
              chave={(c) => c.id}
              aoAbrir={(c) => setAberto(c.id)}
              movel={(c) => (
                <div class="pilha pilha--p">
                  <div class="linha linha--entre"><strong class="num">{dataCurta(c.data, { semana: true })}</strong>{c.estado === 'concluido' ? <Situacao tom="ok">concluído {horaDe(c.concluido_em)}</Situacao> : <Situacao tom="atencao">não concluído</Situacao>}</div>
                  <span class="principal-celula">{c.responsavel.nome_exibicao}</span>
                  <span class="fraco">{c.resumo.feitos}/{c.resumo.total} feitas{c.nao_feitos.length ? ` · não feitas: ${c.nao_feitos.map((n) => n.titulo).join(', ')}` : ''}{c.video ? ' · com vídeo' : ' · sem vídeo'}</span>
                  <Whatsapp w={c.whatsapp} />
                </div>
              )}
              vazio={<Vazio compacto icone={<ClipboardCheck aria-hidden="true" />} titulo="Nenhum checklist neste mês">O checklist é feito no tablet, em Modo Operação → Ponto → Checklist de abertura.</Vazio>}
            />
          )}
        </Dados>
      </Cartao>
      <Detalhe id={aberto} podeReenviar={podeReenviar} aoFechar={() => setAberto(null)} aoMudar={() => invalidar(chave)} />
    </div>
  );
}

function Detalhe({ id, podeReenviar, aoFechar, aoMudar }: { id: string | null; podeReenviar: boolean; aoFechar: () => void; aoMudar: () => void }) {
  const consulta = useConsulta(id ? `abertura:detalhe/${id}` : null, () => abertura.detalhe(id!));
  const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const mudou = (c: ChecklistAbertura, texto: string) => {
    avisar(texto, 'ok');
    invalidar(`abertura:detalhe/${c.id}`);
    aoMudar();
  };
  const reenviar = async (c: ChecklistAbertura) => {
    setOcupado(true);
    try {
      await abertura.reenviarWhatsapp(c.id);
      mudou(c, 'Vídeo colocado na fila de novo.');
    } catch (e) {
      avisarErro(e);
    } finally {
      setOcupado(false);
    }
  };
  const concluirSemVideo = async (c: ChecklistAbertura) => {
    setOcupado(true);
    try {
      await abertura.concluir(c.id, motivo);
      setMotivo(null);
      mudou(c, 'Abertura concluída sem vídeo.');
    } catch (e) {
      avisarErro(e);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Gaveta aberta={!!id} aoFechar={aoFechar} largura="media" titulo={consulta.dados ? `Abertura de ${dataCurta(consulta.dados.data, { semana: true })}` : 'Abertura'} subtitulo={consulta.dados ? `Iniciada às ${horaDe(consulta.dados.assumido_em)}` : undefined}>
      <Dados consulta={consulta} recurso="O checklist">
        {(c) => (
          <div class="pilha">
            <div class="pilha pilha--p">
              <span class="fraco">Responsável</span>
              <span class="principal-celula">{c.responsavel.nome_exibicao}</span>
              <span class="fraco">{c.responsavel.metodo === 'facial' ? 'Identificada pelo rosto.' : 'Nome escolhido no tablet (identificação declarada, sem biometria).'}</span>
            </div>
            <p>{c.estado === 'concluido' ? <>Concluído às <strong class="num">{horaDe(c.concluido_em)}</strong></> : <Situacao tom="atencao">Não concluído</Situacao>} · {c.resumo.feitos} de {c.resumo.total} feitas</p>
            <ol class="lista lista-abertura">
              {(c.itens ?? []).map((i) => (
                <li key={i.id} class="lista__item">
                  <span class="lista__texto">
                    <strong>{i.titulo}</strong>
                    {i.observacao && <span>{i.observacao}</span>}
                  </span>
                  <span class="lista__fim">{i.situacao === 'feito' ? <Situacao tom="ok">Feito</Situacao> : i.situacao === 'nao_feito' ? <Situacao tom="perigo">Não feito</Situacao> : <Situacao tom="apagado">Sem marcação</Situacao>}</span>
                </li>
              ))}
            </ol>
            {c.observacao && <div class="pilha pilha--p"><span class="fraco">Observações gerais</span><p>{c.observacao}</p></div>}
            <div class="pilha pilha--p">
              <span class="fraco">Vídeo da abertura</span>
              {c.video ? <PlayerVideo id={c.id} /> : <p>{c.sem_video_motivo ? `Concluída sem vídeo: ${c.sem_video_motivo}` : 'Sem vídeo.'}</p>}
            </div>

            {c.estado === 'em_andamento' && !c.video && c.data === hojeISO() && (
              <div class="pilha pilha--p">
                <span class="fraco">Recuperação (defeito técnico)</span>
                {motivo === null ? (
                  <span><Botao tamanho="p" variante="secundario" onClick={() => setMotivo('')}>Concluir sem vídeo</Botao></span>
                ) : (
                  <>
                    <label class="pilha pilha--p">
                      <span>Por que a abertura fica sem vídeo?</span>
                      <input class="entrada" type="text" maxLength={500} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} />
                    </label>
                    <span class="linha">
                      <Botao tamanho="p" variante="primario" carregando={ocupado} disabled={motivo.trim().length < 3} onClick={() => concluirSemVideo(c)}>Concluir sem vídeo</Botao>
                      <Botao tamanho="p" variante="fantasma" onClick={() => setMotivo(null)}>Cancelar</Botao>
                    </span>
                    <span class="fraco">Todas as tarefas precisam estar marcadas. Se o vídeo chegar depois, ainda hoje, ele é guardado e enviado.</span>
                  </>
                )}
              </div>
            )}

            {c.whatsapp && (
              <div class="pilha pilha--p">
                <span class="fraco">WhatsApp</span>
                {!c.whatsapp.status ? (
                  <p>{c.whatsapp.modo === 'desligado' ? 'Envio ao WhatsApp desligado.' : c.estado === 'concluido' && c.video ? 'Nenhum envio registrado.' : 'Sai quando a abertura for concluída com o vídeo salvo.'}</p>
                ) : (
                  <>
                    <Whatsapp w={c.whatsapp} />
                    <span class="fraco">
                      {c.whatsapp.grupo === 'teste' ? 'Grupo de teste' : 'Grupo ADM'}
                      {c.whatsapp.aceito_em ? ` · aceita às ${horaDe(c.whatsapp.aceito_em)}` : ''}
                      {c.whatsapp.entregue_em ? ` · entregue às ${horaDe(c.whatsapp.entregue_em)}` : ''}
                      {c.whatsapp.envios > 1 ? ` · ${c.whatsapp.envios} envios` : ''}
                    </span>
                    {c.whatsapp.zapi_message_id && <span class="fraco">ID da mensagem: <span class="num">{c.whatsapp.zapi_message_id}</span></span>}
                    {(c.whatsapp.status === 'falhou' || c.whatsapp.status === 'bloqueada' || c.whatsapp.status === 'cancelada') && (
                      <Aviso tom="atencao">O vídeo e o checklist estão salvos; só a mensagem não saiu{c.whatsapp.motivo ? ` (${c.whatsapp.motivo})` : ''}.</Aviso>
                    )}
                    {podeReenviar && c.whatsapp.pode_reenviar && (
                      <span><Botao tamanho="p" icone={<Send aria-hidden="true" />} carregando={ocupado} onClick={() => reenviar(c)}>Reenviar ao WhatsApp</Botao></span>
                    )}
                    {c.whatsapp.criado_em && <span class="fraco">Na fila desde {dataHora(c.whatsapp.criado_em)}</span>}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Dados>
    </Gaveta>
  );
}

/** Link assinado do armazenamento privado (expira em minutos), pedido só quando a pessoa abre o dia. */
function PlayerVideo({ id }: { id: string }) {
  const link = useConsulta(`abertura:video/${id}`, () => abertura.linkVideo(id));
  return (
    <Dados consulta={link} recurso="O vídeo" compacto>
      {(l) => <video class="video-abertura" src={l.url ?? conteudoDoVideo(id)} controls playsInline preload="metadata" />}
    </Dados>
  );
}
