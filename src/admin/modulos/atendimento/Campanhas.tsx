// Campanhas (Gerente e Proprietário: atendimento.campanhas): um template aprovado para vários contatos. Tudo numa gaveta:
// lista, nova campanha (rascunho: nada sai) e o detalhe com os destinatários e os motivos de bloqueio do servidor
// (número fora da lista de teste, sem autorização de marketing, pediu para parar). O envio é em lotes — a tela chama
// "enviar" de novo enquanto houver pendentes — e só depois de uma confirmação que diz quantos saem e se é teste.
// Campanha de TESTE (o padrão) só sai para os números de teste configurados no servidor. Cada envio vira uma mensagem na
// conversa daquele contato (autor "campanha"), sem mudar o modo da conversa.
import { useEffect, useState } from 'preact/hooks';
import { Megaphone, Plus, ArrowLeft, Send, Ban, FlaskConical } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { ErroApi } from '../../lib/api/cliente';
import { dataHora, plural, relativo, telefone as fmtTel, inteiro } from '../../lib/formato';
import { Gaveta, avisar, type useConfirmacao } from '../../ui/camadas';
import { Botao, Campo, Situacao, Etiqueta, Aviso, type Tom } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { Campanha, CampanhaDetalhe, NovaCampanhaEntrada, SituacaoCampanha, SituacaoDestinatario } from '../../lib/tipos/atendimento-clube';
import { MOTIVO_BLOQUEIO, telefoneValido } from './comum';
import { EscolhaTemplate } from './NovaConversa';

type Confirmar = ReturnType<typeof useConfirmacao>['confirmar'];
type Vista = { tipo: 'lista' } | { tipo: 'nova' } | { tipo: 'detalhe'; id: number };

/** Limite do backend (campanhas.DESTINATARIOS_MAX). */
const DESTINATARIOS_MAX = 500;
/** Trava de segurança do laço de lotes (o backend manda até AMBAR_ATENDIMENTO_CAMPANHA_LOTE por chamada). */
const LOTES_MAX = 200;

const SITUACAO: Record<SituacaoCampanha, { rotulo: string; tom: Tom }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutro' },
  enviando: { rotulo: 'Enviando', tom: 'info' },
  concluida: { rotulo: 'Concluída', tom: 'ok' },
  cancelada: { rotulo: 'Cancelada', tom: 'apagado' },
};
const SITUACAO_DEST: Record<SituacaoDestinatario, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: 'Pendente', tom: 'neutro' },
  enviada: { rotulo: 'Enviada', tom: 'ok' },
  falhou: { rotulo: 'Falhou', tom: 'perigo' },
  bloqueada: { rotulo: 'Bloqueada', tom: 'atencao' },
  cancelada: { rotulo: 'Cancelada', tom: 'apagado' },
};

export function Campanhas({ aberta, aoFechar, aoAbrirConversa, confirmar }: { aberta: boolean; aoFechar: () => void; aoAbrirConversa: (id: string) => void; confirmar: Confirmar }) {
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  useEffect(() => {
    if (aberta) setVista({ tipo: 'lista' });
  }, [aberta]);
  const voltar = vista.tipo !== 'lista' && (
    <Botao tamanho="p" variante="fantasma" icone={<ArrowLeft aria-hidden="true" />} onClick={() => setVista({ tipo: 'lista' })}>Campanhas</Botao>
  );
  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      largura="larga"
      titulo={vista.tipo === 'nova' ? 'Nova campanha' : 'Campanhas'}
      subtitulo="Template aprovado para vários contatos. Cada envio aparece na conversa do contato."
      acoesTopo={voltar || undefined}
    >
      {vista.tipo === 'lista' && <Lista aoNova={() => setVista({ tipo: 'nova' })} aoAbrir={(id) => setVista({ tipo: 'detalhe', id })} />}
      {vista.tipo === 'nova' && <NovaCampanha aoCriar={(id) => setVista({ tipo: 'detalhe', id })} />}
      {vista.tipo === 'detalhe' && <Detalhe id={vista.id} confirmar={confirmar} aoAbrirConversa={aoAbrirConversa} />}
    </Gaveta>
  );
}

function Lista({ aoNova, aoAbrir }: { aoNova: () => void; aoAbrir: (id: number) => void }) {
  const consulta = useConsulta('atendimento/campanhas', () => atendimento.campanhas());
  return (
    <div class="pilha">
      <div class="linha linha--entre">
        <p class="fraco">Campanha de teste só envia para os números de teste do servidor.</p>
        <Botao tamanho="p" variante="primario" icone={<Plus aria-hidden="true" />} onClick={aoNova}>Nova campanha</Botao>
      </div>
      <Dados consulta={consulta} recurso="As campanhas" esqueleto={<Esqueleto linhas={4} altura={40} />}>
        {(lista) =>
          lista.length ? (
            <ul class="lista lista--borda" aria-label="Campanhas">
              {lista.map((c) => (
                <li key={c.id}>
                  <button type="button" class="lista__item" onClick={() => aoAbrir(c.id)}>
                    <span class="lista__icone lista__icone--marca" aria-hidden="true"><Megaphone /></span>
                    <span class="lista__texto">
                      <strong>{c.nome} {c.teste && <Etiqueta tom="info">Teste</Etiqueta>}</strong>
                      <span>{c.template_nome} · {resumoContagem(c)} · {relativo(c.criada_em)}</span>
                    </span>
                    <Situacao tom={SITUACAO[c.situacao]?.tom ?? 'neutro'}>{SITUACAO[c.situacao]?.rotulo ?? c.situacao}</Situacao>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio icone={<Megaphone aria-hidden="true" />} titulo="Nenhuma campanha ainda">Crie uma campanha de teste para conferir o template antes de enviar a clientes.</Vazio>
          )
        }
      </Dados>
    </div>
  );
}

function resumoContagem(c: Campanha): string {
  const d = c.destinatarios;
  return [
    plural(d.enviada, 'enviada', 'enviadas'),
    d.pendente && plural(d.pendente, 'pendente', 'pendentes'),
    d.bloqueada && plural(d.bloqueada, 'bloqueada', 'bloqueadas'),
    d.falhou && plural(d.falhou, 'falhou', 'falharam'),
    c.conversas_que_responderam && plural(c.conversas_que_responderam, 'respondeu', 'responderam'),
  ].filter(Boolean).join(' · ');
}

/** "telefone" ou "telefone;param1;param2" por linha; sem parâmetros na linha, valem os comuns. */
function lerDestinatarios(texto: string, comuns: string[], quantos: number) {
  const destinatarios: NovaCampanhaEntrada['destinatarios'] = [];
  const erros: string[] = [];
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linha = bruta.trim();
    if (!linha) return;
    const partes = linha.split(';').map((p) => p.trim());
    const telefone = partes[0];
    const parametros = partes.length > 1 ? partes.slice(1) : comuns.map((p) => p.trim());
    if (!telefoneValido(telefone)) erros.push(`Linha ${i + 1}: telefone inválido (${telefone || 'vazio'}).`);
    else if (parametros.length !== quantos || parametros.some((p) => !p)) erros.push(`Linha ${i + 1}: o template pede ${plural(quantos, 'campo', 'campos')}.`);
    else destinatarios.push({ telefone, parametros });
  });
  return { destinatarios, erros };
}

function NovaCampanha({ aoCriar }: { aoCriar: (id: number) => void }) {
  const templates = useConsulta('atendimento/templates', () => atendimento.templates());
  const [nome, setNome] = useState('');
  const [templateNome, setTemplateNome] = useState('');
  const [comuns, setComuns] = useState<string[]>([]);
  const [teste, setTeste] = useState(true);
  const [linhas, setLinhas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const lista = templates.dados ?? [];
  const modelo = lista.find((t) => t.nome === templateNome);
  const quantos = modelo?.parametros.length ?? 0;
  const lidos = modelo ? lerDestinatarios(linhas, comuns, quantos) : { destinatarios: [], erros: [] };

  const faltando = nome.trim().length < 2 ? 'Dê um nome à campanha.' : !modelo ? 'Escolha o template.' : !lidos.destinatarios.length ? 'Cole pelo menos um telefone.' : lidos.erros.length ? 'Corrija as linhas indicadas.' : lidos.destinatarios.length > DESTINATARIOS_MAX ? `No máximo ${DESTINATARIOS_MAX} destinatários.` : null;

  async function criar(e: Event) {
    e.preventDefault();
    if (faltando || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const c = await atendimento.criarCampanha({ nome: nome.trim(), template: templateNome, teste, destinatarios: lidos.destinatarios });
      invalidar('atendimento/campanhas');
      avisar(`Rascunho criado: ${plural(c.destinatarios.pendente, 'pronto para enviar', 'prontos para enviar')}, ${plural(c.destinatarios.bloqueada, 'bloqueado', 'bloqueados')}. Nada foi enviado ainda.`, 'ok');
      aoCriar(c.id);
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível criar a campanha.');
    } finally {
      setEnviando(false);
    }
  }

  if (templates.dados === undefined) {
    return templates.erro ? <Aviso tom="perigo">Não foi possível carregar os templates: {templates.erro.message}</Aviso> : <Esqueleto linhas={6} />;
  }
  if (!lista.length) return <Aviso tom="info">Nenhum template aprovado configurado no servidor: sem template, não há campanha.</Aviso>;

  return (
    <form class="pilha" onSubmit={criar}>
      <Campo rotulo="Nome da campanha" ajuda="Só a equipe vê (ex.: Brunch de domingo — novembro).">
        {(id, descr) => <input id={id} class="entrada" maxLength={120} aria-describedby={descr} value={nome} onInput={(e) => setNome(e.currentTarget.value)} data-autofoco />}
      </Campo>
      <EscolhaTemplate
        lista={lista}
        modelo={modelo}
        params={comuns}
        aoEscolher={(n) => { setTemplateNome(n); setComuns((lista.find((t) => t.nome === n)?.parametros ?? []).map(() => '')); }}
        aoMudarParam={(i, v) => setComuns((p) => p.map((x, j) => (j === i ? v : x)))}
        rotuloParametros="Valores iguais para todos (uma linha com “telefone;valor1;valor2” usa os valores dela)."
      />
      <label class="marcar">
        <input type="checkbox" checked={teste} onChange={(e) => setTeste(e.currentTarget.checked)} />
        <span>
          <strong>Campanha de teste</strong>
          <br />
          <span class="fraco">Só envia para os números de teste configurados no servidor; os outros ficam bloqueados. Desmarque só para a campanha de verdade.</span>
        </span>
      </label>
      {!teste && (
        <Aviso tom="atencao">Campanha real: sai para clientes. Template de marketing só vai para quem autorizou mensagens promocionais; quem pediu para parar nunca recebe.</Aviso>
      )}
      <Campo rotulo="Destinatários" ajuda={`Um telefone por linha, com DDD. Até ${DESTINATARIOS_MAX}. Números repetidos entram uma vez.`}>
        {(id, descr) => <textarea id={id} class="area num" rows={7} aria-describedby={descr} placeholder={'85 99999-0000\n85 98888-1111;Ana'} value={linhas} onInput={(e) => setLinhas(e.currentTarget.value)} />}
      </Campo>
      {modelo && linhas.trim() && (
        <p class="fraco">
          {plural(lidos.destinatarios.length, 'destinatário válido', 'destinatários válidos')}
          {lidos.erros.length ? ` · ${plural(lidos.erros.length, 'linha com problema', 'linhas com problema')}` : ''}
        </p>
      )}
      {lidos.erros.length > 0 && (
        <Aviso tom="atencao">
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {lidos.erros.slice(0, 8).map((x) => <li key={x}>{x}</li>)}
            {lidos.erros.length > 8 && <li>…e mais {lidos.erros.length - 8}.</li>}
          </ul>
        </Aviso>
      )}
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
      <div class="linha" style={{ justifyContent: 'flex-end' }}>
        <Botao type="submit" variante="primario" carregando={enviando} disabled={!!faltando} title={faltando ?? undefined}>Criar rascunho</Botao>
      </div>
      <p class="fraco">Criar não envia nada: o envio é o próximo passo, com confirmação.</p>
    </form>
  );
}

function Detalhe({ id, confirmar, aoAbrirConversa }: { id: number; confirmar: Confirmar; aoAbrirConversa: (id: string) => void }) {
  const consulta = useConsulta(`atendimento/campanhas/${id}`, () => atendimento.campanha(id));
  return (
    <Dados consulta={consulta} recurso="A campanha" esqueleto={<Esqueleto linhas={8} />}>
      {(c: CampanhaDetalhe) => {
        const d = c.destinatarios;
        const aberta = c.situacao === 'rascunho' || c.situacao === 'enviando';
        const enviar = () =>
          confirmar({
            titulo: c.teste ? `Enviar a campanha de TESTE “${c.nome}”?` : `Enviar a campanha “${c.nome}” para clientes?`,
            texto: `${plural(d.pendente, 'mensagem sai', 'mensagens saem')} agora com o template ${c.template_nome}${c.teste ? ', só para os números de teste do servidor' : ''}. ${d.bloqueada ? `${plural(d.bloqueada, 'destinatário bloqueado fica', 'destinatários bloqueados ficam')} de fora. ` : ''}O envio é em lotes; não feche a tela até terminar.`,
            confirmar: c.teste ? 'Enviar teste' : `Enviar ${inteiro(d.pendente)}`,
            acao: async () => {
              let atual: Campanha = c;
              try {
                for (let lote = 0; lote < LOTES_MAX && atual.destinatarios.pendente > 0; lote++) {
                  const antes = atual.destinatarios.pendente;
                  atual = await atendimento.enviarLote(c.id);
                  if (atual.destinatarios.pendente >= antes) break; // nada andou: para e mostra o que houve
                }
              } finally {
                invalidar('atendimento');
              }
              const x = atual.destinatarios;
              avisar(`Envio ${x.pendente ? 'interrompido' : 'concluído'}: ${plural(x.enviada, 'enviada', 'enviadas')}${x.falhou ? `, ${plural(x.falhou, 'falhou', 'falharam')}` : ''}${x.bloqueada ? `, ${plural(x.bloqueada, 'bloqueada', 'bloqueadas')}` : ''}${x.pendente ? `, ${inteiro(x.pendente)} ainda pendente(s)` : ''}.`, x.falhou || x.pendente ? 'erro' : 'ok');
            },
          });
        const cancelar = () =>
          confirmar({
            titulo: `Cancelar a campanha “${c.nome}”?`,
            texto: 'Quem ainda não recebeu não recebe mais. O que já saiu continua nas conversas.',
            confirmar: 'Cancelar campanha',
            perigo: true,
            acao: async () => {
              try {
                await atendimento.cancelarCampanha(c.id);
              } finally {
                invalidar('atendimento');
              }
            },
            sucesso: 'Campanha cancelada.',
          });
        return (
          <div class="pilha">
            <div class="linha linha--entre">
              <div class="pilha pilha--p" style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '16px' }}>{c.nome}</h3>
                <span class="linha" style={{ gap: '6px' }}>
                  <Situacao tom={SITUACAO[c.situacao]?.tom ?? 'neutro'}>{SITUACAO[c.situacao]?.rotulo ?? c.situacao}</Situacao>
                  {c.teste && <Etiqueta tom="info" icone={<FlaskConical size={12} aria-hidden="true" />}>Teste</Etiqueta>}
                  <span class="fraco">{c.template_nome} · {c.categoria === 'marketing' ? 'Marketing' : 'Utilidade'} · criada {dataHora(c.criada_em)}</span>
                </span>
              </div>
              {aberta && (
                <div class="linha" style={{ gap: '6px' }}>
                  <Botao tamanho="p" icone={<Ban aria-hidden="true" />} onClick={cancelar}>Cancelar</Botao>
                  <Botao tamanho="p" variante="primario" icone={<Send aria-hidden="true" />} disabled={!d.pendente} onClick={enviar}>Enviar</Botao>
                </div>
              )}
            </div>
            {c.teste && aberta && <Aviso tom="info">Campanha de teste: só sai para os números de teste configurados no servidor. Os outros aparecem como bloqueados (“não é número de teste”).</Aviso>}
            <dl class="totais-campanha">
              {(['pendente', 'enviada', 'bloqueada', 'falhou', 'cancelada'] as const).map((k) => (
                <div key={k}><dt>{SITUACAO_DEST[k].rotulo}</dt><dd class="num">{inteiro(d[k])}</dd></div>
              ))}
              <div><dt>Entregues</dt><dd class="num">{inteiro(c.entrega.entregue + c.entrega.lida)}</dd></div>
              <div><dt>Lidas</dt><dd class="num">{inteiro(c.entrega.lida)}</dd></div>
              <div><dt>Responderam</dt><dd class="num">{inteiro(c.conversas_que_responderam)}</dd></div>
            </dl>
            <section class="pilha pilha--p">
              <h3 class="secao-titulo">Destinatários</h3>
              <ul class="lista lista--borda" aria-label="Destinatários">
                {c.lista.map((x) => {
                  const s = SITUACAO_DEST[x.situacao] ?? { rotulo: x.situacao, tom: 'neutro' as Tom };
                  return (
                    <li key={x.id} class="linha linha--entre" style={{ padding: '8px 14px', gap: '8px' }}>
                      <span class="num">{fmtTel(x.telefone_e164)}</span>
                      <span class="linha" style={{ gap: '6px' }}>
                        {x.motivo && <span class="fraco">{MOTIVO_BLOQUEIO[x.motivo] ?? x.motivo}</span>}
                        <Situacao tom={s.tom}>{s.rotulo}</Situacao>
                        {x.conversa_id && <Botao tamanho="p" variante="fantasma" onClick={() => aoAbrirConversa(x.conversa_id!)}>Conversa</Botao>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        );
      }}
    </Dados>
  );
}
