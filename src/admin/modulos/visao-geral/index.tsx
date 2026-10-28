// Visão Geral: "o que está acontecendo no Âmbar e o que exige minha atenção agora?"
// Fontes: /admin/reservas/operacao (no ar) + /admin/visao-geral, /financeiro/resumo, /financeiro/relatorios/evolucao e
// /estoque/compras (código pronto, ainda não publicados). Cada bloco cai sozinho no estado "ainda não está no ar".
import { useState } from 'preact/hooks';
import { CalendarCheck, Users, Wallet, Scale, BellRing, ChevronRight, CalendarClock, Receipt, PackageCheck, Landmark, MessagesSquare, UserCheck, Radar, FileWarning, ArrowRight, Sparkles } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { pode, type Modulo } from '../../lib/permissoes';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { financeiro } from '../../lib/api/financeiro';
import { estoque, visaoGeral } from '../../lib/api/estoque';
import { atendimento } from '../../lib/api/atendimento-clube';
import { moeda, num, hojeISO, dataLonga, hora, mesCurto, relativo, plural, inteiro } from '../../lib/formato';
import { rotaPainel } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Indicador, Cartao, Segmentado, Variacao, Etiqueta, Situacao } from '../../ui/base';
import { Dados, Esqueleto, Vazio, Falha } from '../../ui/estados';
import { GraficoLinhas, Legenda } from '../../ui/graficos';
import type { RadarInsight } from '../../lib/tipos/visao-geral';
import type { NivelQualidade } from '../../lib/tipos/financeiro';

export const QUALIDADE: Record<NivelQualidade, { rotulo: string; tom: 'ok' | 'atencao' | 'perigo' | 'apagado' }> = {
  completo: { rotulo: 'Completo', tom: 'ok' },
  parcial: { rotulo: 'Parcial', tom: 'atencao' },
  estimado: { rotulo: 'Estimado', tom: 'atencao' },
  indisponivel: { rotulo: 'Indisponível', tom: 'apagado' },
};

export default function VisaoGeral({ contexto }: { contexto: ContextoPainel }) {
  const papel = contexto.usuario.papel;
  // Só consulta e mostra o que está liberado neste ambiente (PAINEL_MODULOS) e permitido ao papel.
  const liberado = (m: Modulo) => contexto.modulos.includes(m);
  const comReservas = liberado('reservas');
  const gerencia = pode(papel, 'visao.financeiro') && liberado('financeiro');
  const hoje = hojeISO();
  const [periodo, setPeriodo] = useState<'hoje' | 'mes'>('mes');

  const operacao = useConsulta(comReservas ? `reservas/operacao:${hoje}` : null, () => reservas.operacao(hoje));
  const pendentesAprov = useConsulta(comReservas ? `reservas?pendentes:${hoje}` : null, () => reservas.listar({ data_de: hoje, status: ['pendente'], limite: 50 }));
  const visao = useConsulta('visao-geral', () => visaoGeral.obter());
  const resumoFin = useConsulta(gerencia ? 'financeiro/resumo' : null, () => financeiro.resumo());
  const evolucao = useConsulta(gerencia ? 'financeiro/evolucao:6' : null, () => financeiro.evolucao(6));
  const compras = useConsulta(liberado('estoque') ? 'estoque/compras?conferir' : null, () => estoque.compras({ etapa: 'aguardando_conferencia', limite: 20 }));
  const comparecimento = useConsulta(comReservas ? `reservas/comparecimento:${hoje}` : null, () => reservas.pendentesComparecimento({ data_de: hoje, data_ate: hoje }));
  const atend = useConsulta(liberado('atendimento') ? 'atendimento/resumo' : null, () => atendimento.resumo());

  const ativas = operacao.dados?.filter((r) => r.status_reserva !== 'cancelada') ?? [];
  const pessoas = ativas.reduce((s, r) => s + r.pessoas, 0);
  // o bloco financeiro da Visão Geral só aparece com o Financeiro liberado, mesmo que o backend o envie
  const fin = gerencia ? visao.dados?.financeiro ?? null : null;

  // Atenção necessária: só o que tem tela para resolver, do mais urgente para o menos.
  type Item = { id: string; icone: preact.ComponentChildren; tom: 'perigo' | 'atencao' | 'marca' | 'info'; titulo: string; detalhe: string; href: string };
  const itens: Item[] = [];
  const nPend = pendentesAprov.dados?.total ?? 0;
  if (nPend) itens.push({ id: 'aprovar', icone: <CalendarClock />, tom: 'marca', titulo: plural(nPend, 'reserva aguardando aprovação', 'reservas aguardando aprovação'), detalhe: 'Aprovar ou recusar antes do horário', href: '/admin/reservas?status=pendente' });
  const nComp = comparecimento.dados?.length ?? 0;
  if (nComp) itens.push({ id: 'comparecimento', icone: <UserCheck />, tom: 'info', titulo: plural(nComp, 'chegada para registrar', 'chegadas para registrar'), detalhe: 'Reservas de hoje que já começaram', href: '/admin/reservas' });
  if (fin?.contas.vencidas.qtd) itens.push({ id: 'vencidas', icone: <Receipt />, tom: 'perigo', titulo: plural(fin.contas.vencidas.qtd, 'conta vencida', 'contas vencidas'), detalhe: `${moeda(fin.contas.vencidas.valor)} em aberto`, href: '/admin/financeiro?aba=contas&situacao=vencidas' });
  if (fin?.contas.hoje.qtd) itens.push({ id: 'hoje', icone: <Receipt />, tom: 'atencao', titulo: plural(fin.contas.hoje.qtd, 'conta vence hoje', 'contas vencem hoje'), detalhe: moeda(fin.contas.hoje.valor), href: '/admin/financeiro?aba=contas&situacao=hoje' });
  const rev = resumoFin.dados?.revisao;
  if (rev && rev.despesas + rev.documentos > 0) itens.push({ id: 'revisao', icone: <FileWarning />, tom: 'atencao', titulo: plural(rev.despesas + rev.documentos, 'lançamento para revisar', 'lançamentos para revisar'), detalhe: 'Comprovantes da Júlia e despesas sem categoria', href: '/admin/financeiro?aba=lancamentos&revisar=1' });
  const nCompras = compras.dados?.total ?? 0;
  if (nCompras) itens.push({ id: 'compras', icone: <PackageCheck />, tom: 'atencao', titulo: plural(nCompras, 'compra aguardando conferência', 'compras aguardando conferência'), detalhe: 'Conferir itens antes de entrar no estoque', href: '/admin/estoque?aba=compras' });
  const conc = fin?.conciliacao_mes_anterior;
  if (conc) itens.push({ id: 'conciliacao', icone: <Landmark />, tom: 'info', titulo: 'Conciliação bancária incompleta', detalhe: conc.texto, href: rotaPainel(conc.rota) ?? '/admin/financeiro?aba=relatorios' });
  const nAtend = atend.dados?.aguardando_equipe ?? 0;
  if (nAtend) itens.push({ id: 'atendimento', icone: <MessagesSquare />, tom: 'marca', titulo: plural(nAtend, 'conversa esperando a equipe', 'conversas esperando a equipe'), detalhe: 'Clientes no WhatsApp aguardando resposta', href: '/admin/atendimento?filtro=aguardando' });

  const carregandoAtencao = operacao.carregando || pendentesAprov.carregando;
  const foraDoAr = [gerencia ? visao : null, compras, atend].filter((c) => c?.erro?.tipo === 'nao_implantado').length;

  return (
    <Raiz>
      <header class="cabecalho">
        <div>
          <h2>{saudacao()}, {contexto.usuario.nome.split(' ')[0]}</h2>
          <p>{dataLonga(hoje)}</p>
        </div>
        {gerencia && <Segmentado rotulo="Período dos indicadores" valor={periodo} aoMudar={setPeriodo} opcoes={[{ valor: 'hoje', rotulo: 'Hoje' }, { valor: 'mes', rotulo: 'Este mês' }]} />}
      </header>

      <section class="indicadores" aria-label="Indicadores principais">
        {gerencia ? (
          <>
            <Indicador
              rotulo={periodo === 'hoje' ? 'Faturamento de hoje' : 'Faturamento do mês'}
              icone={<Wallet aria-hidden="true" />}
              href="/admin/financeiro"
              carregando={visao.carregando}
              valor={fin ? moeda(periodo === 'hoje' ? fin.receita_hoje : fin.receita_mes) : '—'}
              rodape={
                !fin ? (visao.erro?.tipo === 'nao_implantado' ? 'Financeiro ainda não está no ar' : 'Indisponível') : periodo === 'mes' ? (
                  <>
                    <Variacao atual={num(fin.receita_mes)} anterior={num(fin.receita_mes_anterior_ate_o_mesmo_dia)} /> vs. mês anterior até hoje
                  </>
                ) : (
                  'Vendas do PDV de hoje'
                )
              }
            />
            <Indicador
              rotulo="Resultado gerencial parcial"
              icone={<Scale aria-hidden="true" />}
              href="/admin/financeiro?aba=relatorios"
              carregando={visao.carregando}
              valor={fin ? moeda(fin.resultado_parcial) : '—'}
              rodape={fin ? <><Situacao tom={QUALIDADE[fin.qualidade].tom}>{QUALIDADE[fin.qualidade].rotulo}</Situacao> · receita menos despesas do mês, não é lucro</> : 'Indisponível'}
            />
          </>
        ) : (
          <>
            <Indicador rotulo="Pessoas esperadas hoje" icone={<Users aria-hidden="true" />} href="/admin/reservas" carregando={operacao.carregando} valor={operacao.dados ? inteiro(pessoas) : '—'} rodape={operacao.dados ? `${plural(ativas.length, 'reserva', 'reservas')}` : 'Indisponível'} />
            {liberado('estoque') ? (
              <Indicador rotulo="Compras para conferir" icone={<PackageCheck aria-hidden="true" />} href="/admin/estoque?aba=compras" carregando={compras.carregando} valor={compras.dados ? inteiro(nCompras) : '—'} rodape={compras.dados ? 'Notas e pagamentos de insumos' : compras.erro?.tipo === 'nao_implantado' ? 'Estoque ainda não está no ar' : 'Indisponível'} />
            ) : (
              <Indicador rotulo="Aguardando aprovação" icone={<CalendarClock aria-hidden="true" />} href="/admin/reservas?status=pendente" carregando={pendentesAprov.carregando} valor={pendentesAprov.dados ? inteiro(nPend) : '—'} rodape="Hoje e próximos dias" />
            )}
          </>
        )}
        <Indicador
          rotulo="Reservas de hoje"
          icone={<CalendarCheck aria-hidden="true" />}
          href="/admin/reservas"
          carregando={operacao.carregando}
          valor={operacao.dados ? inteiro(ativas.length) : '—'}
          rodape={operacao.dados ? `${plural(pessoas, 'pessoa', 'pessoas')} · ${plural(ativas.filter((r) => r.status_reserva === 'pendente').length, 'pendente', 'pendentes')}` : operacao.erro?.message}
        />
        <Indicador
          rotulo="Pendências"
          icone={<BellRing aria-hidden="true" />}
          href="#atencao"
          carregando={carregandoAtencao}
          valor={inteiro(itens.length)}
          rodape={itens.length ? 'Itens que precisam de alguém' : 'Nada urgente agora'}
        />
      </section>

      <div class="duas-colunas">
        <div class="pilha">
          {gerencia && (
            <Cartao titulo="Evolução do faturamento" descricao="Receita líquida e resultado gerencial dos últimos 6 meses" acoes={<a class="btn btn--p btn--fantasma" href="/admin/financeiro?aba=relatorios">Relatórios <ChevronRight size={14} aria-hidden="true" /></a>}>
              <Dados consulta={evolucao} recurso="O relatório financeiro" esqueleto={<Esqueleto linhas={6} altura={28} />} compacto>
                {(meses) =>
                  meses.every((m) => m.receita_liquida === null) ? (
                    <Vazio compacto titulo="Sem vendas sincronizadas ainda">As vendas do PDV aparecem aqui assim que a sincronização com a Eyemobile começar.</Vazio>
                  ) : (
                    <div class="pilha">
                      <GraficoLinhas
                        rotulo="Receita líquida e resultado gerencial por mês"
                        rotulos={meses.map((m) => mesCurto(m.mes))}
                        formatar={(v) => moeda(v)}
                        series={[
                          { nome: 'Receita líquida', cor: 'var(--grafico-1)', valores: meses.map((m) => num(m.receita_liquida)) },
                          { nome: 'Resultado gerencial', cor: 'var(--grafico-2)', valores: meses.map((m) => num(m.resultado_gerencial)), tracejada: true },
                        ]}
                      />
                      <div class="linha linha--entre">
                        <Legenda series={[{ nome: 'Receita líquida', cor: 'var(--grafico-1)' }, { nome: 'Resultado gerencial', cor: 'var(--grafico-2)', tracejada: true }]} />
                        {meses.some((m) => m.qualidade !== 'completo') && <span class="fraco">Meses parciais ou estimados estão marcados nos Relatórios</span>}
                      </div>
                    </div>
                  )
                }
              </Dados>
            </Cartao>
          )}

          <Cartao titulo="Hoje no salão" descricao="Próximas chegadas" justo acoes={<a class="btn btn--p btn--fantasma" href="/admin/reservas">Ver todas <ChevronRight size={14} aria-hidden="true" /></a>}>
            <Dados consulta={operacao} recurso="A agenda" compacto esqueleto={<div class="cartao__corpo"><Esqueleto linhas={4} /></div>}>
              {(lista) => {
                const agora = Date.now();
                const proximas = lista.filter((r) => r.status_reserva !== 'cancelada' && r.comparecimento === 'nao_registrado' && new Date(r.fim).getTime() > agora).slice(0, 6);
                return proximas.length ? (
                  <ul class="lista">
                    {proximas.map((r) => (
                      <li key={r.id}>
                        <a class="lista__item" href={`/admin/reservas?reserva=${r.id}`}>
                          <span class="lista__icone num forte" style={{ width: '52px', fontSize: '13px', color: 'var(--texto)' }}>{hora(r.hora)}</span>
                          <span class="lista__texto">
                            <strong>{r.contato_nome}</strong>
                            <span>{plural(r.pessoas, 'pessoa', 'pessoas')} · {r.ambiente}</span>
                          </span>
                          <span class="lista__fim">
                            {r.status_reserva === 'pendente' ? <Situacao tom="atencao" destaque>Aguardando aprovação</Situacao> : r.atrasada ? <Situacao tom="perigo">Atrasada</Situacao> : <Situacao tom="ok">Confirmada</Situacao>}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio compacto icone={<CalendarCheck aria-hidden="true" />} titulo="Nenhuma chegada pendente hoje">As reservas do dia aparecem aqui por ordem de horário.</Vazio>
                );
              }}
            </Dados>
          </Cartao>
        </div>

        <div class="pilha">
          <Cartao titulo="Atenção necessária" descricao="Do mais urgente para o menos" justo id="atencao">
            {carregandoAtencao ? (
              <div class="cartao__corpo"><Esqueleto linhas={3} /></div>
            ) : itens.length ? (
              <ul class="lista">
                {itens.map((i) => (
                  <li key={i.id}>
                    <a class="lista__item" href={i.href}>
                      <span class={`lista__icone lista__icone--${i.tom}`} aria-hidden="true">{i.icone}</span>
                      <span class="lista__texto">
                        <strong>{i.titulo}</strong>
                        <span>{i.detalhe}</span>
                      </span>
                      <span class="lista__fim"><ChevronRight aria-hidden="true" /></span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio compacto icone={<Sparkles aria-hidden="true" />} titulo="Tudo em dia">Nenhuma pendência nas áreas disponíveis.</Vazio>
            )}
            {foraDoAr > 0 && <div class="cartao__rodape">Algumas áreas liberadas ainda não estão no ar no sistema do Âmbar e não entram nesta lista.</div>}
          </Cartao>

          {pode(papel, 'visao.radar') && (liberado('financeiro') || liberado('estoque')) && <RadarLucro consulta={visao} />}

          <AtividadeRecente reservasLiberadas={comReservas} estoqueLiberado={liberado('estoque')} />
        </div>
      </div>
    </Raiz>
  );
}

function saudacao() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza', hour: 'numeric', hour12: false }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

const SEVERIDADE: Record<RadarInsight['severidade'], { rotulo: string; tom: 'perigo' | 'atencao' | 'info' }> = {
  critico: { rotulo: 'Crítico', tom: 'perigo' },
  atencao: { rotulo: 'Atenção', tom: 'atencao' },
  info: { rotulo: 'Informativo', tom: 'info' },
};

function RadarLucro({ consulta }: { consulta: ReturnType<typeof useConsulta<import('../../lib/tipos/visao-geral').VisaoGeral>> }) {
  return (
    <Cartao titulo={<span class="linha"><Radar size={16} aria-hidden="true" /> Radar de Lucro</span>} descricao="Os achados mais importantes, com a evidência" justo>
      {consulta.erro && !consulta.dados ? (
        <Falha erro={consulta.erro} compacto recurso="O Radar de Lucro" aoTentar={consulta.recarregar} />
      ) : consulta.carregando ? (
        <div class="cartao__corpo"><Esqueleto linhas={3} /></div>
      ) : !consulta.dados?.radar?.length ? (
        <Vazio compacto icone={<Radar aria-hidden="true" />} titulo="Nenhum achado aberto">
          O Radar só aponta algo com dados suficientes (vendas, fichas e compras). Sem achado não quer dizer sem problema.
        </Vazio>
      ) : (
        <ul class="lista">
          {consulta.dados.radar.slice(0, 3).map((a) => (
            <li key={a.id} style={{ padding: '14px 20px' }} class="pilha pilha--p">
              <div class="linha">
                <Etiqueta tom={SEVERIDADE[a.severidade].tom}>{SEVERIDADE[a.severidade].rotulo}</Etiqueta>
                <span class="fraco">{a.qualidade === 'confiavel' ? 'Dados confiáveis' : 'Dados parciais'}</span>
              </div>
              <strong style={{ fontWeight: 600 }}>{a.titulo}</strong>
              <span class="suave pequeno">{a.problema}</span>
              <span class="fraco">Fonte: {a.fonte}</span>
              {rotaPainel(a.rota) && (
                <a class="btn btn--p" style={{ alignSelf: 'flex-start' }} href={rotaPainel(a.rota)!}>
                  Investigar <ArrowRight size={14} aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/** Não há rota de auditoria geral no backend: a atividade vem dos próprios registros (reservas criadas e compras recebidas). */
function AtividadeRecente({ reservasLiberadas, estoqueLiberado }: { reservasLiberadas: boolean; estoqueLiberado: boolean }) {
  const hoje = hojeISO();
  const recentes = useConsulta(reservasLiberadas ? `reservas?recentes:${hoje}` : null, () => reservas.listar({ data_de: hoje, limite: 200 }));
  const compras = useConsulta(estoqueLiberado ? 'estoque/compras?recentes' : null, () => estoque.compras({ limite: 5 }));
  type Ev = { id: string; em: string; texto: string; detalhe: string; href: string; icone: preact.ComponentChildren };
  const ev: Ev[] = [];
  for (const r of recentes.dados?.itens ?? []) ev.push({ id: r.id, em: r.criado_em, texto: `Reserva de ${r.contato_nome}`, detalhe: `${plural(r.pessoas, 'pessoa', 'pessoas')} · ${r.data.split('-').reverse().slice(0, 2).join('/')} às ${hora(r.hora)}`, href: `/admin/reservas?reserva=${r.id}`, icone: <CalendarCheck /> });
  for (const c of compras.dados?.itens ?? []) ev.push({ id: c.id, em: c.criado_em, texto: `Compra ${c.fornecedor ? `de ${c.fornecedor}` : 'recebida'}`, detalhe: `${c.origem === 'julia' ? 'Pela Júlia' : 'Pelo painel'} · ${moeda(c.valor_total)}`, href: `/admin/estoque?aba=compras&compra=${c.id}`, icone: <PackageCheck /> });
  ev.sort((a, b) => b.em.localeCompare(a.em));
  return (
    <Cartao titulo="Atividade recente" justo>
      {recentes.carregando ? (
        <div class="cartao__corpo"><Esqueleto linhas={3} /></div>
      ) : ev.length ? (
        <ul class="lista">
          {ev.slice(0, 6).map((e) => (
            <li key={e.id}>
              <a class="lista__item" href={e.href}>
                <span class="lista__icone" aria-hidden="true">{e.icone}</span>
                <span class="lista__texto">
                  <strong>{e.texto}</strong>
                  <span>{e.detalhe}</span>
                </span>
                <span class="lista__fim">{relativo(e.em)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio compacto titulo="Sem atividade recente" />
      )}
    </Cartao>
  );
}
