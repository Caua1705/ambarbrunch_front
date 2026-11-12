// Equipe → Abertura: os checklists de abertura enviados pelo tablet, um por dia (Gerente e Proprietário,
// `abertura.consultar`). Lista do mês e, ao abrir um dia, as tarefas, observações e o vídeo. Quando a responsável foi
// escolhida pelo nome (sem o rosto), o gestor confirma aqui. Só consulta: nada disso manda mensagem.
import { useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight, ClipboardCheck, ShieldCheck, Video, VideoOff } from 'lucide-preact';
import { abertura, conteudoDoVideo } from '../../lib/api/operacao';
import { invalidar, useConsulta } from '../../lib/consulta';
import { dataCurta, dataHora, fimMes, hojeISO, horaDe, inicioMes, mesAno, somarMeses } from '../../lib/formato';
import type { ChecklistAbertura } from '../../lib/tipos/abertura';
import { Aviso, Botao, Cartao, Situacao } from '../../ui/base';
import { avisar, avisarErro, Gaveta } from '../../ui/camadas';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';

const duracao = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

function Responsavel({ c }: { c: ChecklistAbertura }) {
  const r = c.responsavel;
  return (
    <span class="linha" style={{ gap: '6px', flexWrap: 'wrap' }}>
      <span class="principal-celula">{r.nome_exibicao}</span>
      {r.metodo === 'facial'
        ? <Situacao tom="ok">pelo rosto</Situacao>
        : r.verificada ? <Situacao tom="ok">confirmada</Situacao> : <Situacao tom="atencao">a confirmar</Situacao>}
    </span>
  );
}

export function Aberturas() {
  const [mes, setMes] = useState(() => inicioMes(hojeISO()));
  const [aberto, setAberto] = useState<string | null>(null);
  const chave = `abertura:lista?${mes}`;
  const consulta = useConsulta(chave, () => abertura.listar(mes, fimMes(mes)));

  const colunas: Coluna<ChecklistAbertura>[] = [
    { id: 'data', titulo: 'Data', celula: (c) => <span class="num">{dataCurta(c.data, { semana: true })}</span> },
    { id: 'responsavel', titulo: 'Responsável', celula: (c) => <Responsavel c={c} /> },
    { id: 'tarefas', titulo: 'Tarefas', celula: (c) => <span class="num">{c.resumo.feitos}/{c.resumo.total}</span> },
    { id: 'nao', titulo: 'Não feitas', prioridade: 'media', celula: (c) => (c.nao_feitos.length ? <span>{c.nao_feitos.map((n) => n.titulo).join(', ')}</span> : <span class="fraco">—</span>) },
    { id: 'concluido', titulo: 'Concluído', celula: (c) => (c.estado === 'concluido' ? <span class="num">{horaDe(c.concluido_em)}</span> : <Situacao tom="atencao">não concluído</Situacao>) },
    { id: 'video', titulo: 'Vídeo', celula: (c) => (c.video ? <span class="linha"><Video aria-label="Com vídeo" /> {duracao(c.video.duracao_s)}</span> : <VideoOff class="fraco" aria-label="Sem vídeo" />) },
  ];

  return (
    <div class="pilha">
      <Cartao
        titulo="Checklists de abertura"
        descricao="Um por dia, preenchido no tablet por quem assumiu a abertura."
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
                  <Responsavel c={c} />
                  <span class="fraco">{c.resumo.feitos}/{c.resumo.total} feitas{c.nao_feitos.length ? ` · não feitas: ${c.nao_feitos.map((n) => n.titulo).join(', ')}` : ''}{c.video ? ' · com vídeo' : ' · sem vídeo'}</span>
                </div>
              )}
              vazio={<Vazio compacto icone={<ClipboardCheck aria-hidden="true" />} titulo="Nenhum checklist neste mês">O checklist é preenchido no tablet, em Modo Operação → Ponto → Checklist de abertura.</Vazio>}
            />
          )}
        </Dados>
      </Cartao>
      <Detalhe id={aberto} aoFechar={() => setAberto(null)} aoMudar={() => invalidar(chave)} />
    </div>
  );
}

function Detalhe({ id, aoFechar, aoMudar }: { id: string | null; aoFechar: () => void; aoMudar: () => void }) {
  const consulta = useConsulta(id ? `abertura:detalhe/${id}` : null, () => abertura.detalhe(id!));
  const [confirmando, setConfirmando] = useState(false);
  const confirmar = async (c: ChecklistAbertura) => {
    setConfirmando(true);
    try {
      await abertura.confirmarResponsavel(c.id);
      avisar('Responsável confirmada.', 'ok');
      invalidar(`abertura:detalhe/${c.id}`);
      aoMudar();
    } catch (e) {
      avisarErro(e);
    } finally {
      setConfirmando(false);
    }
  };
  return (
    <Gaveta aberta={!!id} aoFechar={aoFechar} largura="media" titulo={consulta.dados ? `Abertura de ${dataCurta(consulta.dados.data, { semana: true })}` : 'Abertura'} subtitulo={consulta.dados ? `Assumida às ${horaDe(consulta.dados.assumido_em)}` : undefined}>
      <Dados consulta={consulta} recurso="O checklist">
        {(c) => (
          <div class="pilha">
            <div class="pilha pilha--p">
              <span class="fraco">Responsável</span>
              <Responsavel c={c} />
              {c.responsavel.metodo === 'declarada' && !c.responsavel.verificada && (
                <Aviso tom="atencao">
                  <span class="pilha pilha--p">
                    <span>Escolhida pelo nome no tablet (sem reconhecimento facial). Confira com a equipe e confirme.</span>
                    <span><Botao tamanho="p" icone={<ShieldCheck aria-hidden="true" />} carregando={confirmando} onClick={() => confirmar(c)}>Confirmar responsável</Botao></span>
                  </span>
                </Aviso>
              )}
              {c.responsavel.confirmado_por && <span class="fraco">Confirmada por {c.responsavel.confirmado_por} em {dataHora(c.responsavel.confirmado_em)}</span>}
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
              {c.video ? <PlayerVideo id={c.id} /> : <p>{c.sem_video_motivo ? `Sem vídeo: ${c.sem_video_motivo}` : 'Sem vídeo.'}</p>}
            </div>
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
