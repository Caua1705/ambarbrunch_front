// Clube Âmbar — área administrativa preparada para o lançamento, sem ativar nada: as flags vêm do backend
// (inscricoes_abertas, programa_ativo) e os convites pelo WhatsApp só ligam com PAINEL_CLUBE_CONVITES no servidor.
// Pontos, recompensas e resgate não têm regra comercial nem rota: a tela diz isso, sem números inventados.
import { useEffect, useState } from 'preact/hooks';
import { Users, UserPlus, Ban, RotateCcw, LogOut, Search, Award, Clock, PhoneCall, Gift, Info, Send } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { useConsulta, invalidar } from '../../lib/consulta';
import { clube } from '../../lib/api/atendimento-clube';
import { dataHora, dataCurta, moeda, inteiro, telefone, relativo, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz, Gaveta, useConfirmacao, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Cabecalho, Indicador, Segmentado, Situacao, Aviso, Etiqueta, Cartao, type Tom } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio, Esqueleto } from '../../ui/estados';
import { Tabela } from '../../ui/tabela';
import type { EstadoMembro, MembroLista, VendaClube, ConviteClube } from '../../lib/tipos/atendimento-clube';

type Secao = 'geral' | 'membros' | 'vendas' | 'convites';
const ESTADO: Record<EstadoMembro, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: 'Cadastro iniciado', tom: 'atencao' },
  ativo: { rotulo: 'Ativo', tom: 'ok' },
  suspenso: { rotulo: 'Suspenso', tom: 'perigo' },
  encerrado: { rotulo: 'Encerrado', tom: 'apagado' },
};
const ORIGEM: Record<string, string> = { site: 'Site', convite_caixa: 'Convite no caixa', venda: 'Venda no caixa', painel: 'Painel', whatsapp: 'WhatsApp' };
const TEXTO_CONVITE = '2026-10';

export default function Clube({ contexto }: { contexto: ContextoPainel }) {
  const papel = contexto.usuario.papel;
  const [secao, setSecao] = useState<Secao>((lerParam('secao') as Secao) || 'geral');
  const [membro, setMembro] = useState<string | null>(lerParam('membro'));
  const { confirmar, elemento: dialogo } = useConfirmacao();
  useEffect(() => gravarParams({ secao: secao === 'geral' ? null : secao, membro }), [secao, membro]);
  const resumo = useConsulta('clube/resumo', () => clube.resumo());
  const r = resumo.dados;

  return (
    <Raiz>
      <Cabecalho
        titulo="Clube Âmbar"
        descricao={<span class="linha" style={{ gap: '8px' }}><Etiqueta tom="atencao">Pré-lançamento</Etiqueta> Área preparada para o lançamento do programa</span>}
        acoes={<Segmentado rotulo="Seção do Clube" valor={secao} aoMudar={setSecao} opcoes={[{ valor: 'geral', rotulo: 'Resumo' }, { valor: 'membros', rotulo: 'Membros' }, { valor: 'vendas', rotulo: 'Vendas no caixa' }, { valor: 'convites', rotulo: 'Convites' }]} />}
      />

      {r && (
        <Aviso tom="info" icone={<Info aria-hidden="true" />}>
          <strong>O Clube ainda não foi lançado ao público.</strong> No sistema: inscrições {r.inscricoes_abertas ? 'abertas' : 'fechadas'}, programa de pontos {r.programa_ativo ? 'ligado' : 'desligado'}
          {r.credito_automatico ? ', crédito automático ligado' : ''}. O site continua com o Clube escondido; nada aqui liga o programa.
        </Aviso>
      )}

      {secao === 'geral' && <Resumo consulta={resumo} irPara={setSecao} />}
      {secao === 'membros' && <Membros aoAbrir={setMembro} />}
      {secao === 'vendas' && <Vendas papel={papel} convites={contexto.clubeConvites} confirmar={confirmar} />}
      {secao === 'convites' && <Convites />}

      <FichaMembro id={membro} aoFechar={() => setMembro(null)} papel={papel} confirmar={confirmar} />
      {dialogo}
    </Raiz>
  );
}

function Resumo({ consulta, irPara }: { consulta: ReturnType<typeof useConsulta<import('../../lib/tipos/atendimento-clube').ResumoClube>>; irPara: (s: Secao) => void }) {
  return (
    <Dados consulta={consulta} recurso="O Clube Âmbar" esqueleto={<Esqueleto linhas={4} altura={60} />}>
      {(r) => {
        const p = r.pendencias;
        const pend = [
          { n: p.vendas_com_telefone_correcao_provavel, t: ['venda com telefone para conferir', 'vendas com telefone para conferir'], s: 'vendas' as Secao },
          { n: p.vendas_com_telefone_sem_cliente_verificado, t: ['venda de quem ainda não é membro', 'vendas de quem ainda não é membro'], s: 'vendas' as Secao },
          { n: p.vendas_com_telefone_invalido, t: ['venda com telefone inválido no PDV', 'vendas com telefone inválido no PDV'], s: 'vendas' as Secao },
          { n: p.eventos_de_venda_sem_processar, t: ['venda ainda não processada', 'vendas ainda não processadas'], s: 'vendas' as Secao },
        ].filter((x) => x.n > 0);
        return (
          <>
            <section class="indicadores" aria-label="Membros do Clube">
              <Indicador rotulo="Membros ativos" icone={<Users aria-hidden="true" />} valor={inteiro(r.membros.ativo)} rodape="Cadastro completo" />
              <Indicador rotulo="Cadastros iniciados" icone={<UserPlus aria-hidden="true" />} valor={inteiro(r.membros.pendente)} rodape="Ainda não concluíram" />
              <Indicador rotulo="Convites aguardando" icone={<Send aria-hidden="true" />} valor={inteiro(r.convites_aguardando)} rodape="Link enviado, não usado" />
              <Indicador rotulo="Suspensos" icone={<Ban aria-hidden="true" />} valor={inteiro(r.membros.suspenso)} rodape={r.mensagens_falhas_7_dias ? `${r.mensagens_falhas_7_dias} mensagens falharam em 7 dias` : 'Contestação ou suspeita'} />
            </section>
            <div class="colunas-iguais">
              <Cartao titulo="Pendências do caixa" descricao="Vendas com telefone que precisam de alguém" justo>
                {pend.length ? (
                  <ul class="lista">
                    {pend.map((x) => (
                      <li key={x.t[0]}>
                        <button class="lista__item" onClick={() => irPara(x.s)}>
                          <span class="lista__icone lista__icone--atencao" aria-hidden="true"><PhoneCall /></span>
                          <span class="lista__texto"><strong>{plural(x.n, x.t[0], x.t[1])}</strong></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio compacto titulo="Nenhuma pendência" />
                )}
              </Cartao>
              <Cartao titulo={<span class="linha"><Gift size={16} aria-hidden="true" /> Pontos e recompensas</span>}>
                <div class="pilha pilha--p">
                  <p class="suave">
                    {r.programa_ativo ? 'O programa de pontos está ligado no sistema.' : 'O programa de pontos está desligado: nenhum ponto é creditado e nenhum saldo é mostrado aos clientes.'}
                  </p>
                  <p class="fraco">Recompensas, resgate no caixa e QR Code dependem das regras comerciais do Clube e ainda não existem no sistema. Quando forem definidas, aparecem aqui.</p>
                </div>
              </Cartao>
            </div>
          </>
        );
      }}
    </Dados>
  );
}

function Membros({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const [estado, setEstado] = useState<EstadoMembro | ''>('');
  const [busca, setBusca] = useState('');
  const [aplicada, setAplicada] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);
  const consulta = useConsulta(`clube/membros?${estado}:${aplicada}`, () => clube.membros({ estado: estado || undefined, busca: aplicada || undefined, limite: 200 }));
  return (
    <Cartao justo>
      <div class="filtros" style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }}>
        <div class="entrada-grupo">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Nome ou 4 últimos dígitos" aria-label="Buscar membro" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        <select class="selecao" aria-label="Situação do membro" value={estado} onChange={(e) => setEstado(e.currentTarget.value as EstadoMembro | '')}>
          <option value="">Todas as situações</option>
          {(Object.keys(ESTADO) as EstadoMembro[]).map((k) => <option key={k} value={k}>{ESTADO[k].rotulo}</option>)}
        </select>
      </div>
      <Dados consulta={consulta} recurso="A lista de membros" esqueleto={<EsqueletoTabela />}>
        {({ itens, total }) => (
          <Tabela<MembroLista>
            rotulo={`Membros do Clube (${total})`}
            linhas={itens}
            chave={(m) => m.cliente_id}
            aoAbrir={(m) => aoAbrir(m.cliente_id)}
            vazio={<Vazio compacto icone={<Award aria-hidden="true" />} titulo="Nenhum membro encontrado" />}
            colunas={[
              { id: 'nome', titulo: 'Nome', ordenar: (m) => m.nome ?? '', celula: (m) => <span class="principal-celula">{m.nome ?? 'Sem nome'}</span> },
              { id: 'tel', titulo: 'Telefone', celula: (m) => <span class="num">{m.telefone}</span> },
              { id: 'estado', titulo: 'Situação', ordenar: (m) => m.estado, celula: (m) => <Situacao tom={ESTADO[m.estado].tom}>{ESTADO[m.estado].rotulo}</Situacao> },
              { id: 'origem', titulo: 'Origem', prioridade: 'baixa', celula: (m) => <span class="fraco">{ORIGEM[m.origem] ?? m.origem}</span> },
              { id: 'desde', titulo: 'Desde', prioridade: 'media', ordenar: (m) => m.ativado_em ?? m.cadastro_iniciado_em ?? '', celula: (m) => dataCurta(m.ativado_em ?? m.cadastro_iniciado_em, { ano: true }) },
            ]}
          />
        )}
      </Dados>
    </Cartao>
  );
}

function FichaMembro({ id, aoFechar, papel, confirmar }: { id: string | null; aoFechar: () => void; papel: ContextoPainel['usuario']['papel']; confirmar: ReturnType<typeof useConfirmacao>['confirmar'] }) {
  const ficha = useConsulta(id ? `clube/membros/${id}` : null, () => clube.membro(id!));
  const hist = useConsulta(id ? `clube/membros/${id}/historico` : null, () => clube.historico(id!));
  const f = ficha.dados;
  const recarregar = () => invalidar('clube');
  const rodape = f && (
    <>
      {f.membro.estado === 'suspenso' && pode(papel, 'clube.reativar') && (
        <Botao icone={<RotateCcw aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Reativar este membro?', texto: 'Volta ao estado de antes da suspensão. Use só depois da apuração.', confirmar: 'Reativar', motivo: { rotulo: 'Motivo da reativação' }, acao: async (m) => { await clube.reativar(f.cliente.id, m); recarregar(); }, sucesso: 'Membro reativado.' })}>Reativar</Botao>
      )}
      {f.membro.estado !== 'suspenso' && pode(papel, 'clube.revogar_sessoes') && f.sessoes_ativas > 0 && (
        <Botao icone={<LogOut aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Desconectar o cliente de todos os aparelhos?', confirmar: 'Desconectar', motivo: { rotulo: 'Motivo' }, acao: async (m) => { await clube.revogarSessoes(f.cliente.id, m); recarregar(); }, sucesso: 'Sessões encerradas.' })}>Desconectar aparelhos</Botao>
      )}
      {f.membro.estado !== 'suspenso' && pode(papel, 'clube.suspender') && (
        <Botao variante="perigo" icone={<Ban aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Suspender este membro?', texto: 'Bloqueia o acesso, derruba as sessões e cancela mensagens na fila. Use em contestação (“não fui eu”) ou suspeita de fraude.', confirmar: 'Suspender', perigo: true, motivo: { rotulo: 'Motivo da suspensão' }, acao: async (m) => { await clube.suspender(f.cliente.id, m); recarregar(); }, sucesso: 'Membro suspenso.' })}>Suspender</Botao>
      )}
    </>
  );
  return (
    <Gaveta aberta={!!id} aoFechar={aoFechar} titulo={f?.cliente.nome ?? 'Membro'} subtitulo={f ? ESTADO[f.membro.estado].rotulo : undefined} rodape={rodape}>
      <Dados consulta={ficha} recurso="A ficha do membro" esqueleto={<Esqueleto linhas={8} />}>
        {(f) => (
          <>
            {f.membro.suspensao && (
              <Aviso tom="perigo" icone={<Ban aria-hidden="true" />}>
                <strong>Suspenso em {dataHora(f.membro.suspensao.em)}</strong> {f.membro.suspensao.por ? `por ${f.membro.suspensao.por}` : ''}: “{f.membro.suspensao.motivo}”
              </Aviso>
            )}
            <section class="pilha pilha--p">
              <h3 class="secao-titulo">Cadastro</h3>
              <dl class="definicoes">
                <dt>Telefone</dt>
                <dd class="num">{telefone(f.cliente.telefone)} {f.cliente.telefone_verificado_em && <Etiqueta tom="ok">verificado</Etiqueta>}</dd>
                <dt>E-mail</dt>
                <dd>{f.cliente.email ?? <span class="fraco">Não informado</span>}</dd>
                <dt>Origem</dt>
                <dd>{ORIGEM[f.membro.origem] ?? f.membro.origem}</dd>
                <dt>Ativado em</dt>
                <dd>{dataHora(f.membro.ativado_em)}</dd>
                <dt>Aniversário</dt>
                <dd>{f.membro.aniversario ? f.membro.aniversario.split('-').reverse().join('/') : '—'}</dd>
                <dt>Marketing</dt>
                <dd>{f.membro.marketing_autorizado ? 'Autorizado' : 'Não autorizado'}</dd>
                <dt>Aparelhos conectados</dt>
                <dd>{f.sessoes_ativas}</dd>
              </dl>
            </section>
            <section class="pilha pilha--p">
              <h3 class="secao-titulo">Pontos</h3>
              {f.pontos.programa_ativo ? (
                <dl class="definicoes">
                  <dt>Disponível</dt><dd class="num">{String(f.pontos.disponivel)}</dd>
                  <dt>Pendente</dt><dd class="num">{String(f.pontos.pendente)}</dd>
                  <dt>Reservado</dt><dd class="num">{String(f.pontos.reservado)}</dd>
                </dl>
              ) : (
                <p class="fraco">Programa de pontos desligado — nenhum saldo existe ainda.</p>
              )}
            </section>
            <section class="pilha pilha--p">
              <h3 class="secao-titulo">Compras identificadas ({f.compras.total})</h3>
              {f.compras.ultimas.length ? (
                <ul class="lista" style={{ border: '1px solid var(--borda)', borderRadius: '10px' }}>
                  {f.compras.ultimas.map((v) => (
                    <li key={v.id} class="linha linha--entre" style={{ padding: '10px 14px' }}>
                      <span>{dataHora(v.data_hora)} · comanda {v.comanda ?? '—'}</span>
                      <span class="num forte">{moeda(v.total)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p class="fraco">Nenhuma compra ligada a este cadastro.</p>}
            </section>
            <section class="pilha pilha--p">
              <h3 class="secao-titulo">Histórico</h3>
              {hist.dados?.length ? (
                <ul class="lista">
                  {hist.dados.map((h, i) => (
                    <li key={i} style={{ padding: '8px 0' }} class="linha linha--entre">
                      <span>{h.acao.replace(/_/g, ' ')}{h.ator ? ` · ${h.ator}` : ''}</span>
                      <span class="fraco">{relativo(h.em)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p class="fraco">Sem eventos.</p>}
            </section>
          </>
        )}
      </Dados>
    </Gaveta>
  );
}

function Vendas({ papel, convites, confirmar }: { papel: ContextoPainel['usuario']['papel']; convites: boolean; confirmar: ReturnType<typeof useConfirmacao>['confirmar'] }) {
  const [situacao, setSituacao] = useState<'todas' | 'sem_cliente' | 'conferir_telefone' | 'ligadas'>('conferir_telefone');
  const consulta = useConsulta(`clube/vendas?${situacao}`, () => clube.vendas({ situacao, limite: 100 }));
  const [enviando, setEnviando] = useState<string | null>(null);
  async function convidar(v: VendaClube) {
    setEnviando(v.id);
    try {
      await clube.convidarPorVenda(v.id, TEXTO_CONVITE);
      avisar('Convite enviado pelo WhatsApp.', 'ok');
    } catch (e) {
      avisarErro(e);
    } finally {
      invalidar('clube');
      setEnviando(null);
    }
  }
  return (
    <Cartao justo>
      <div class="filtros" style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }}>
        <Segmentado rotulo="Vendas" valor={situacao} aoMudar={setSituacao} opcoes={[{ valor: 'conferir_telefone', rotulo: 'Conferir telefone' }, { valor: 'sem_cliente', rotulo: 'Sem cadastro' }, { valor: 'ligadas', rotulo: 'De membros' }, { valor: 'todas', rotulo: 'Todas' }]} />
        {!convites && <span class="fraco">Convites pelo WhatsApp ficam disponíveis no lançamento do Clube.</span>}
      </div>
      <Dados consulta={consulta} recurso="As vendas do Clube" esqueleto={<EsqueletoTabela />}>
        {({ itens }) => (
          <Tabela<VendaClube>
            rotulo="Vendas com telefone"
            linhas={itens}
            chave={(v) => v.id}
            vazio={<Vazio compacto titulo="Nenhuma venda nesta lista" />}
            colunas={[
              { id: 'quando', titulo: 'Quando', ordenar: (v) => v.data_hora, celula: (v) => <><span class="principal-celula">{dataHora(v.data_hora)}</span><span class="sub">Comanda {v.comanda ?? '—'}</span></> },
              { id: 'valor', titulo: 'Valor', numero: true, celula: (v) => <span class="num">{moeda(v.total)}</span> },
              { id: 'tel', titulo: 'Telefone', celula: (v) => <><span class="num">{v.telefone ?? '—'}</span>{v.aviso && <span class="sub" style={{ color: 'var(--atencao)', fontWeight: 600 }}>{v.aviso}</span>}</> },
              { id: 'cliente', titulo: 'Cliente', prioridade: 'media', celula: (v) => v.cliente ? <Situacao tom="ok">{v.cliente.nome ?? 'Membro'}</Situacao> : <span class="fraco">Sem cadastro</span> },
              {
                id: 'acoes', titulo: '',
                celula: (v) => (
                  <div class="linha" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                    {v.candidato_membro && !v.cliente && pode(papel, 'clube.confirmar_telefone') && (
                      <Botao tamanho="p" onClick={() => confirmar({ titulo: 'Ligar esta venda ao membro?', texto: 'Confirme antes com o cliente que o número corrigido é dele.', confirmar: 'Confirmar telefone', motivo: { rotulo: 'Como foi conferido', ajuda: 'Ex.: cliente confirmou no caixa. Fica registrado.' }, acao: async (m) => { await clube.confirmarTelefone(v.id, m); invalidar('clube'); }, sucesso: 'Venda ligada ao membro.' })}>
                        Confirmar telefone
                      </Botao>
                    )}
                    {convites && v.convite.pode && (
                      <Botao tamanho="p" variante="primario" carregando={enviando === v.id} onClick={() => convidar(v)}>Convidar</Botao>
                    )}
                    {!convites && v.convite.pode && <span class="fraco" title="Disponível no lançamento"><Clock size={14} aria-hidden="true" /></span>}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Dados>
    </Cartao>
  );
}

const SITUACAO_CONVITE: Record<ConviteClube['situacao'], { rotulo: string; tom: Tom }> = {
  aguardando: { rotulo: 'Aguardando', tom: 'atencao' },
  usado: { rotulo: 'Usado', tom: 'ok' },
  substituido: { rotulo: 'Substituído', tom: 'apagado' },
  expirado: { rotulo: 'Expirado', tom: 'apagado' },
};

function Convites() {
  const consulta = useConsulta('clube/convites', () => clube.convites({ limite: 100 }));
  return (
    <Cartao justo>
      <Dados consulta={consulta} recurso="Os convites do Clube" esqueleto={<EsqueletoTabela />}>
        {({ itens }) => (
          <Tabela<ConviteClube>
            rotulo="Convites"
            linhas={itens}
            chave={(c) => c.id}
            vazio={<Vazio compacto icone={<Send aria-hidden="true" />} titulo="Nenhum convite enviado" />}
            colunas={[
              { id: 'tel', titulo: 'Telefone', celula: (c) => <span class="num">{c.telefone}</span> },
              { id: 'quando', titulo: 'Enviado', ordenar: (c) => c.criado_em, celula: (c) => <><span>{relativo(c.criado_em)}</span>{c.criado_por && <span class="sub">por {c.criado_por}</span>}</> },
              { id: 'sit', titulo: 'Situação', celula: (c) => <Situacao tom={SITUACAO_CONVITE[c.situacao].tom}>{SITUACAO_CONVITE[c.situacao].rotulo}</Situacao> },
              { id: 'msg', titulo: 'Mensagem', prioridade: 'media', celula: (c) => <span class="fraco">{c.mensagem ? (c.mensagem.erro ?? c.mensagem.status) : '—'}</span> },
              { id: 'expira', titulo: 'Expira', prioridade: 'baixa', celula: (c) => dataCurta(c.expira_em) },
            ]}
          />
        )}
      </Dados>
    </Cartao>
  );
}
