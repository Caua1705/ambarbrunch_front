// Nova conversa (e "Enviar template" de uma conversa existente): escolher o contato — um cadastro achado pela busca ou um
// telefone digitado — e a mensagem — um template aprovado (com os parâmetros e a prévia ao vivo) ou texto livre, que só sai
// dentro da janela de 24 h do cliente (409 fora_da_janela_24h). O backend normaliza o telefone (422 telefone_invalido),
// reaproveita a conversa que já existir com aquele número e faz quem iniciou assumir a conversa.
// Nunca mostra sucesso se a mensagem voltou com status "falhou": o erro da Meta aparece e a conversa abre com a falha à vista.
import { useEffect, useState } from 'preact/hooks';
import { Search, Phone, MessageSquare, Send, UserRound } from 'lucide-preact';
import { useConsulta, invalidar } from '../../lib/consulta';
import { atendimento } from '../../lib/api/atendimento-clube';
import { ErroApi } from '../../lib/api/cliente';
import { telefone as fmtTel } from '../../lib/formato';
import { Gaveta, avisar } from '../../ui/camadas';
import { Botao, Campo, Segmentado, Aviso, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto } from '../../ui/estados';
import type { ContatoBusca, NovaConversaEntrada, TemplateWhatsapp } from '../../lib/tipos/atendimento-clube';
import { TEXTO_MAX, mensagemDeEnvio, origemContato, preencherTemplate, telefoneValido } from './comum';

/** Quem já vem escolhido (a partir de uma conversa: o telefone dela). */
export interface DestinoInicial {
  telefone?: string;
  nome?: string;
  conversaId?: string;
}

type Destino = { tipo: 'contato'; c: ContatoBusca } | { tipo: 'telefone'; telefone: string; nome: string };

export function NovaConversa({ aberta, inicial, aoFechar, aoAbrirConversa }: { aberta: boolean; inicial: DestinoInicial; aoFechar: () => void; aoAbrirConversa: (id: string) => void }) {
  const [destino, setDestino] = useState<Destino | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [modo, setModo] = useState<'template' | 'texto'>('template');
  const [templateNome, setTemplateNome] = useState('');
  const [params, setParams] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [erroTelefone, setErroTelefone] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Cada abertura começa do zero (ou com o telefone da conversa de onde veio).
  useEffect(() => {
    if (!aberta) return;
    setDestino(inicial.telefone ? { tipo: 'telefone', telefone: inicial.telefone, nome: inicial.nome ?? '' } : null);
    setBusca('');
    setBuscaAplicada('');
    setModo('template');
    setTemplateNome('');
    setParams([]);
    setTexto('');
    setErro(null);
    setErroTelefone(null);
  }, [aberta, inicial.telefone]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const templates = useConsulta(aberta ? 'atendimento/templates' : null, () => atendimento.templates());
  const buscar = aberta && !destino && buscaAplicada.length >= 2;
  const contatos = useConsulta(buscar ? `atendimento/contatos?${buscaAplicada}` : null, () => atendimento.contatos(buscaAplicada));

  const lista = templates.dados ?? [];
  const semTemplates = templates.dados !== undefined && lista.length === 0;
  const modoEfetivo = semTemplates ? 'texto' : modo;
  const modelo = lista.find((t) => t.nome === templateNome);
  const digitos = busca.replace(/\D/g, '');

  const escolherTemplate = (nome: string) => {
    setTemplateNome(nome);
    setParams((lista.find((t) => t.nome === nome)?.parametros ?? []).map(() => ''));
    setErro(null);
  };

  const faltando = (() => {
    if (!destino) return 'Escolha o contato ou digite o telefone.';
    if (destino.tipo === 'telefone' && !telefoneValido(destino.telefone)) return 'Telefone com DDD (10 ou 11 dígitos).';
    if (modoEfetivo === 'template') {
      if (!modelo) return 'Escolha o template.';
      if (params.some((p) => !p.trim())) return 'Preencha todos os campos do template.';
    } else if (!texto.trim()) return 'Escreva a mensagem.';
    return null;
  })();

  async function enviar(e?: Event) {
    e?.preventDefault();
    if (faltando || enviando || !destino) return;
    setEnviando(true);
    setErro(null);
    setErroTelefone(null);
    const corpo: NovaConversaEntrada = { parametros: modoEfetivo === 'template' ? params.map((p) => p.trim()) : [] };
    if (destino.tipo === 'contato') corpo.cliente_id = destino.c.cliente_id;
    else {
      corpo.telefone = destino.telefone;
      if (destino.nome.trim()) corpo.nome = destino.nome.trim();
    }
    if (modoEfetivo === 'template') corpo.template = templateNome;
    else corpo.texto = texto.trim();
    try {
      const c = await atendimento.novaConversa(corpo);
      const ultima = [...c.mensagens].reverse().find((m) => m.direcao === 'saida' && m.autor === 'equipe');
      if (ultima?.status === 'falhou') avisar(`A mensagem não saiu: ${ultima.erro ?? 'a Meta recusou o envio'}`, 'erro');
      else if (ultima?.status === 'pendente') avisar('Mensagem na fila de envio.', 'info');
      else avisar('Mensagem enviada.', 'ok');
      aoAbrirConversa(c.id);
    } catch (err) {
      if (err instanceof ErroApi && err.codigo === 'telefone_invalido') setErroTelefone(mensagemDeEnvio(err));
      else setErro(mensagemDeEnvio(err));
    } finally {
      // a conversa pode ter sido criada (e assumida) mesmo quando a mensagem não pôde sair
      invalidar('atendimento');
      setEnviando(false);
    }
  }

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      largura="media"
      titulo={inicial.telefone ? 'Enviar template' : 'Nova conversa'}
      subtitulo="Pelo WhatsApp oficial do Âmbar. Quem inicia a conversa fica com ela."
      rodape={
        <>
          <Botao onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao variante="primario" icone={<Send aria-hidden="true" />} carregando={enviando} disabled={!!faltando} title={faltando ?? undefined} onClick={() => enviar()}>Enviar</Botao>
        </>
      }
    >
      <form class="pilha" onSubmit={enviar}>
        <section class="pilha pilha--p" aria-label="Para quem">
          <h3 class="secao-titulo">Para quem</h3>
          {destino ? (
            <div class="destino">
              <span class="avatar" aria-hidden="true">{(destino.tipo === 'contato' ? destino.c.nome : destino.nome || '#').slice(0, 1).toUpperCase()}</span>
              <span class="lista__texto" style={{ flex: 1 }}>
                <strong>{destino.tipo === 'contato' ? destino.c.nome : destino.nome || 'Número digitado'}</strong>
                <span class="num">{fmtTel(destino.tipo === 'contato' ? destino.c.telefone_e164 : destino.telefone)}{destino.tipo === 'contato' ? ` · ${origemContato(destino.c.giardini)}` : ''}</span>
              </span>
              {!inicial.telefone && <Botao tamanho="p" variante="fantasma" onClick={() => { setDestino(null); setErroTelefone(null); }}>Trocar</Botao>}
            </div>
          ) : (
            <>
              <div class="entrada-grupo">
                <Search aria-hidden="true" />
                <input class="entrada" type="search" placeholder="Nome ou telefone com DDD" aria-label="Buscar contato ou digitar telefone" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} data-autofoco />
              </div>
              {digitos.length >= 10 && (
                <button type="button" class="lista__item lista__item--borda" onClick={() => setDestino({ tipo: 'telefone', telefone: busca.trim(), nome: '' })}>
                  <span class="lista__icone lista__icone--marca" aria-hidden="true"><Phone /></span>
                  <span class="lista__texto"><strong>Usar o número {fmtTel(digitos)}</strong><span>Sem procurar cadastro</span></span>
                </button>
              )}
              {buscar && (
                <Dados consulta={contatos} recurso="A busca de contatos" compacto esqueleto={<Esqueleto linhas={2} />}>
                  {(achados) =>
                    achados.length ? (
                      <ul class="lista lista--borda" aria-label="Contatos encontrados">
                        {achados.map((c) => (
                          <li key={c.cliente_id} class="destino-opcao">
                            <button type="button" class="lista__item" onClick={() => setDestino({ tipo: 'contato', c })}>
                              <span class="lista__icone" aria-hidden="true"><UserRound /></span>
                              <span class="lista__texto">
                                <strong>{c.nome}</strong>
                                <span>{fmtTel(c.telefone_e164)} · {origemContato(c.giardini)}</span>
                              </span>
                            </button>
                            {c.conversa_id && (
                              <Botao tamanho="p" variante="fantasma" icone={<MessageSquare aria-hidden="true" />} onClick={() => aoAbrirConversa(c.conversa_id!)}>
                                Abrir conversa
                              </Botao>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p class="fraco">Nenhum cadastro com essa busca.{digitos.length < 10 ? ' Para um número sem cadastro, digite o telefone com DDD.' : ''}</p>
                    )
                  }
                </Dados>
              )}
            </>
          )}
          {destino?.tipo === 'telefone' && !inicial.telefone && (
            <div class="grade-campos" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <Campo rotulo="Telefone" erro={erroTelefone ?? (destino.telefone && !telefoneValido(destino.telefone) ? 'Telefone com DDD (10 ou 11 dígitos).' : null)}>
                {(id, descr) => <input id={id} class="entrada num" inputMode="tel" aria-describedby={descr} aria-invalid={!!erroTelefone || undefined} value={destino.telefone} maxLength={40} onInput={(e) => { setErroTelefone(null); setDestino({ ...destino, telefone: e.currentTarget.value }); }} />}
              </Campo>
              <Campo rotulo="Nome" opcional>
                {(id) => <input id={id} class="entrada" value={destino.nome} maxLength={120} onInput={(e) => setDestino({ ...destino, nome: e.currentTarget.value })} />}
              </Campo>
            </div>
          )}
          {erroTelefone && inicial.telefone && <Aviso tom="perigo">{erroTelefone}</Aviso>}
        </section>

        <section class="pilha pilha--p" aria-label="Mensagem">
          <h3 class="secao-titulo">Mensagem</h3>
          {templates.erro && templates.dados === undefined ? (
            <Aviso tom="atencao">Não foi possível carregar os templates ({templates.erro.message}). Texto livre continua disponível.</Aviso>
          ) : semTemplates ? (
            <Aviso tom="info">Nenhum template aprovado configurado no servidor. Só dá para mandar texto livre, e só para quem escreveu nas últimas 24 h.</Aviso>
          ) : (
            <Segmentado rotulo="Tipo de mensagem" valor={modo} aoMudar={(m) => { setModo(m); setErro(null); }} opcoes={[{ valor: 'template', rotulo: 'Template aprovado' }, { valor: 'texto', rotulo: 'Texto livre' }]} />
          )}
          {modoEfetivo === 'template' ? (
            templates.dados === undefined && !templates.erro ? (
              <Esqueleto linhas={2} />
            ) : (
              <EscolhaTemplate lista={lista} modelo={modelo} params={params} aoEscolher={escolherTemplate} aoMudarParam={(i, v) => setParams((p) => p.map((x, j) => (j === i ? v : x)))} />
            )
          ) : (
            <Campo rotulo="Texto" ajuda="Só sai se o cliente escreveu nas últimas 24 h; fora disso, a Meta só aceita template aprovado.">
              {(id, descr) => <textarea id={id} class="area" rows={4} maxLength={TEXTO_MAX} aria-describedby={descr} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />}
            </Campo>
          )}
        </section>

        {erro && <Aviso tom="perigo">{erro}</Aviso>}
      </form>
    </Gaveta>
  );
}

/** Escolha do template com um campo por parâmetro e a prévia do texto preenchida ao vivo. */
export function EscolhaTemplate({ lista, modelo, params, aoEscolher, aoMudarParam, rotuloParametros }: {
  lista: TemplateWhatsapp[];
  modelo: TemplateWhatsapp | undefined;
  params: string[];
  aoEscolher: (nome: string) => void;
  aoMudarParam: (i: number, v: string) => void;
  /** Texto de ajuda acima dos parâmetros (campanha: "iguais para todos"). */
  rotuloParametros?: string;
}) {
  return (
    <div class="pilha pilha--p">
      <Campo rotulo="Template">
        {(id) => (
          <select id={id} class="selecao" value={modelo?.nome ?? ''} onChange={(e) => aoEscolher(e.currentTarget.value)}>
            <option value="" disabled>Escolha um template aprovado…</option>
            {lista.map((t) => (
              <option key={t.nome} value={t.nome}>{t.nome} · {t.categoria === 'marketing' ? 'Marketing' : 'Utilidade'}</option>
            ))}
          </select>
        )}
      </Campo>
      {modelo && (
        <>
          {modelo.parametros.length > 0 && (
            <div class="pilha pilha--p">
              {rotuloParametros && <p class="fraco">{rotuloParametros}</p>}
              <div class="grade-campos" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                {modelo.parametros.map((rotulo, i) => (
                  <Campo key={`${modelo.nome}-${i}`} rotulo={rotulo || `Campo ${i + 1}`}>
                    {(id) => <input id={id} class="entrada" maxLength={200} value={params[i] ?? ''} onInput={(e) => aoMudarParam(i, e.currentTarget.value)} />}
                  </Campo>
                ))}
              </div>
            </div>
          )}
          <div class="previa-template" role="group" aria-label="Prévia da mensagem">
            <span class="previa-template__selo">
              <Etiqueta tom="info">Template</Etiqueta>
              {modelo.categoria === 'marketing' && <Etiqueta tom="atencao">Marketing</Etiqueta>}
            </span>
            {preencherTemplate(modelo, params)}
          </div>
        </>
      )}
    </div>
  );
}
