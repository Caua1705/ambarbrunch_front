// Reservas: a gerente abre e entende o movimento do dia em segundos. Lista do dia (principal), semana (alternativa),
// aprovações pendentes em destaque, detalhe em gaveta. Tudo pelas rotas reais /admin/reservas* (no ar em produção).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight, Plus, Search, CalendarClock, Check, UserCheck, MoreHorizontal, X, Users, CalendarCheck, CalendarX2, List, CalendarDays, Phone } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { hojeISO, somarDias, dataLonga, dataCurta, hora, plural, inteiro, telefone } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz, useConfirmacao, Suspenso, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Cabecalho, Indicador, Segmentado, Cartao, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { OperacaoReserva, ReservaPainel } from '../../lib/tipos/reservas';
import { SituacaoReserva, statusDe, emAberto, confirmadaBase, comecou, atualizarReservas, registrarComparecimento, CANAL } from './comum';
import { DetalheReserva } from './Detalhe';
import { NovaReserva } from './NovaReserva';
import { Pendentes } from './Pendentes';
import { Semana } from './Semana';

type FiltroStatus = 'todas' | 'pendente' | 'confirmada' | 'chegou' | 'cancelada';

export default function Reservas({ contexto }: { contexto: ContextoPainel }) {
  const hoje = hojeISO();
  const [data, setData] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(lerParam('data') ?? '') ? lerParam('data')! : hoje));
  const [vista, setVista] = useState<'lista' | 'semana'>(lerParam('vista') === 'semana' ? 'semana' : 'lista');
  const [filtro, setFiltro] = useState<FiltroStatus>('todas');
  const [ambiente, setAmbiente] = useState('');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<string | null>(lerParam('reserva'));
  const [nova, setNova] = useState(false);
  const [verPendentes, setVerPendentes] = useState(lerParam('status') === 'pendente');
  const { confirmar, elemento: dialogo } = useConfirmacao();

  useEffect(() => gravarParams({ data: data === hoje ? null : data, vista: vista === 'lista' ? null : vista, reserva: aberta, status: verPendentes ? 'pendente' : null }), [data, vista, aberta, verPendentes]);

  const dia = useConsulta(`reservas/operacao:${data}`, () => reservas.operacao(data));
  const ambientes = useConsulta('reservas/ambientes', () => reservas.ambientes());
  const pendentes = useConsulta(`reservas?pendentes:${hoje}`, () => reservas.listar({ data_de: hoje, status: ['pendente'], limite: 100 }));

  const lista = dia.dados ?? [];
  const ativas = lista.filter((r) => r.status_reserva !== 'cancelada');
  const resumo = {
    reservas: ativas.length,
    pessoas: ativas.reduce((s, r) => s + r.pessoas, 0),
    pendentes: lista.filter((r) => statusDe(r) === 'pendente').length,
    confirmadas: lista.filter((r) => confirmadaBase(r) && emAberto(r)).length,
    chegaram: lista.filter((r) => r.comparecimento === 'compareceu').length,
    canceladas: lista.filter((r) => r.status_reserva === 'cancelada').length,
  };

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const digitos = t.replace(/\D/g, '');
    return lista.filter((r) => {
      const s = statusDe(r);
      if (filtro === 'pendente' && s !== 'pendente') return false;
      if (filtro === 'confirmada' && !(confirmadaBase(r) && emAberto(r))) return false;
      if (filtro === 'chegou' && s !== 'compareceu') return false;
      if (filtro === 'cancelada' && s !== 'cancelada') return false;
      if (filtro === 'todas' && s === 'cancelada') return false;
      if (ambiente && r.ambiente_id !== ambiente) return false;
      if (t && !(r.contato_nome.toLowerCase().includes(t) || r.codigo.toLowerCase().includes(t) || (digitos.length >= 3 && (r.contato_telefone_e164 ?? '').includes(digitos)))) return false;
      return true;
    });
  }, [lista, filtro, ambiente, busca]);

  async function aprovar(r: ReservaPainel) {
    try {
      await reservas.mudarStatus(r.id, 'confirmada');
      atualizarReservas();
      avisar(`Reserva de ${r.contato_nome} aprovada.`, 'ok');
    } catch (e) {
      avisarErro(e);
      atualizarReservas();
    }
  }
  const recusar = (r: ReservaPainel) =>
    confirmar({
      titulo: `Recusar a reserva de ${r.contato_nome}?`,
      texto: 'A reserva fica cancelada. Se o cliente precisar ser avisado, o painel mostra o lembrete depois.',
      confirmar: 'Recusar reserva',
      perigo: true,
      motivo: { rotulo: 'Motivo', obrigatorio: false, ajuda: 'Opcional. Fica no histórico da reserva.' },
      acao: async (motivo) => {
        await reservas.mudarStatus(r.id, 'cancelada', motivo || undefined);
        atualizarReservas();
      },
      sucesso: 'Reserva recusada.',
    });
  const chegou = async (r: ReservaPainel) => {
    try {
      await registrarComparecimento(r.id, 'compareceu');
      avisar(`Chegada de ${r.contato_nome} registrada.`, 'ok');
    } catch (e) {
      avisarErro(e);
    }
  };

  const colunas: Coluna<OperacaoReserva>[] = [
    { id: 'hora', titulo: 'Horário', ordenar: (r) => r.hora, largura: '88px', celula: (r) => <span class="num forte">{hora(r.hora)}</span> },
    {
      id: 'cliente', titulo: 'Cliente', ordenar: (r) => r.contato_nome,
      celula: (r) => (
        <>
          <span class="principal-celula">{r.contato_nome}</span>
          <span class="sub">
            {telefone(r.contato_telefone_e164)}
            {r.observacoes ? ` · ${r.observacoes}` : ''}
          </span>
        </>
      ),
    },
    { id: 'pessoas', titulo: 'Pessoas', numero: true, ordenar: (r) => r.pessoas, largura: '80px', celula: (r) => <span class="num">{r.pessoas}</span> },
    { id: 'ambiente', titulo: 'Ambiente', ordenar: (r) => r.ambiente, prioridade: 'media', celula: (r) => r.ambiente },
    { id: 'canal', titulo: 'Origem', prioridade: 'baixa', celula: (r) => <span class="fraco">{CANAL[r.canal] ?? r.canal}</span> },
    { id: 'status', titulo: 'Situação', ordenar: (r) => statusDe(r), prioridade: 'media', celula: (r) => <SituacaoReserva r={r} atrasoMin={r.atrasada ? r.minutos_de_atraso : null} passou={emAberto(r) && confirmadaBase(r) && new Date(r.fim).getTime() < Date.now()} /> },
    {
      id: 'acoes', titulo: '',
      celula: (r) => (
        <div class="linha" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          {statusDe(r) === 'pendente' && (
            <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} onClick={() => aprovar(r)} aria-label={`Aprovar a reserva de ${r.contato_nome}`}>
              Aprovar
            </Botao>
          )}
          {confirmadaBase(r) && emAberto(r) && comecou(r) && (
            <Botao tamanho="p" icone={<UserCheck aria-hidden="true" />} onClick={() => chegou(r)} aria-label={`Registrar que ${r.contato_nome} chegou`}>
              Chegou
            </Botao>
          )}
          <Suspenso rotulo={`Mais ações para ${r.contato_nome}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone {...p} icone={<MoreHorizontal aria-hidden="true" />} />}>
            {(fechar) => (
              <>
                <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setAberta(r.id); }}>Ver detalhes</button>
                {r.contato_telefone_e164 && <a class="suspenso__item" role="menuitem" href={`tel:${r.contato_telefone_e164}`}><Phone aria-hidden="true" /> Ligar</a>}
                {statusDe(r) === 'pendente' && <button class="suspenso__item suspenso__item--perigo" role="menuitem" onClick={() => { fechar(); recusar(r); }}><X aria-hidden="true" /> Recusar</button>}
              </>
            )}
          </Suspenso>
        </div>
      ),
    },
  ];

  const nPend = pendentes.dados?.total ?? 0;
  const ehHoje = data === hoje;

  return (
    <Raiz>
      <Cabecalho
        titulo={ehHoje ? 'Reservas de hoje' : 'Reservas'}
        descricao={dataLonga(data)}
        acoes={
          <>
            <Segmentado rotulo="Visualização" valor={vista} aoMudar={setVista} opcoes={[{ valor: 'lista', rotulo: <><List size={14} aria-hidden="true" /> Dia</> }, { valor: 'semana', rotulo: <><CalendarDays size={14} aria-hidden="true" /> Semana</> }]} />
            <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Nova reserva</Botao>
          </>
        }
      />

      {nPend > 0 && (
        <div class="aviso aviso--atencao" style={{ alignItems: 'center' }}>
          <CalendarClock aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <strong>{plural(nPend, 'reserva aguarda', 'reservas aguardam')} aprovação</strong> <span class="suave">— hoje e próximos dias</span>
          </div>
          <Botao tamanho="p" variante="primario" onClick={() => setVerPendentes(true)}>Revisar</Botao>
        </div>
      )}

      <div class="linha" style={{ gap: '8px' }}>
        <Botao so_icone aria-label="Dia anterior" icone={<ChevronLeft aria-hidden="true" />} onClick={() => setData(somarDias(data, -1))} />
        <Botao onClick={() => setData(hoje)} disabled={ehHoje}>Hoje</Botao>
        <Botao so_icone aria-label="Próximo dia" icone={<ChevronRight aria-hidden="true" />} onClick={() => setData(somarDias(data, 1))} />
        <label class="sr" for="data-reservas">Escolher data</label>
        <input id="data-reservas" type="date" class="entrada" style={{ width: 'auto' }} value={data} onChange={(e) => e.currentTarget.value && setData(e.currentTarget.value)} />
        {dia.atualizando && <span class="fraco">Atualizando…</span>}
      </div>

      {vista === 'semana' ? (
        <Semana inicio={data} aoEscolherDia={(d) => { setData(d); setVista('lista'); }} aoAbrir={setAberta} />
      ) : (
        <>
          <section class="indicadores" aria-label="Resumo do dia">
            <Indicador rotulo="Reservas" icone={<CalendarCheck aria-hidden="true" />} carregando={dia.carregando} valor={inteiro(resumo.reservas)} rodape={`${plural(resumo.confirmadas, 'confirmada', 'confirmadas')} a chegar`} />
            <Indicador rotulo="Pessoas" icone={<Users aria-hidden="true" />} carregando={dia.carregando} valor={inteiro(resumo.pessoas)} rodape={resumo.chegaram ? `${plural(resumo.chegaram, 'reserva chegou', 'reservas chegaram')}` : 'Total esperado no dia'} />
            <Indicador rotulo="Aguardando aprovação" icone={<CalendarClock aria-hidden="true" />} carregando={dia.carregando} valor={inteiro(resumo.pendentes)} rodape={resumo.pendentes ? 'Neste dia' : 'Nenhuma neste dia'} />
            <Indicador rotulo="Canceladas" icone={<CalendarX2 aria-hidden="true" />} carregando={dia.carregando} valor={inteiro(resumo.canceladas)} rodape="Não ocupam lugar" />
          </section>

          <Cartao justo>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }} class="filtros">
              <div class="entrada-grupo">
                <Search aria-hidden="true" />
                <input class="entrada" type="search" placeholder="Buscar nome, telefone ou código" aria-label="Buscar reserva" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
              </div>
              <select class="selecao" aria-label="Ambiente" value={ambiente} onChange={(e) => setAmbiente(e.currentTarget.value)}>
                <option value="">Todos os ambientes</option>
                {(ambientes.dados ?? []).filter((a) => a.ativo).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <Segmentado
                rotulo="Situação"
                valor={filtro}
                aoMudar={setFiltro}
                opcoes={[
                  { valor: 'todas', rotulo: 'Ativas' },
                  { valor: 'pendente', rotulo: `Pendentes${resumo.pendentes ? ` (${resumo.pendentes})` : ''}` },
                  { valor: 'confirmada', rotulo: 'A chegar' },
                  { valor: 'chegou', rotulo: 'Chegaram' },
                  { valor: 'cancelada', rotulo: 'Canceladas' },
                ]}
              />
            </div>
            <Dados consulta={dia} recurso="A agenda de reservas" esqueleto={<EsqueletoTabela />}>
              {() => (
                <Tabela
                  rotulo={`Reservas de ${dataCurta(data)}`}
                  colunas={colunas}
                  linhas={filtradas}
                  chave={(r) => r.id}
                  aoAbrir={(r) => setAberta(r.id)}
                  destaque={(r) => statusDe(r) === 'pendente'}
                  apagada={(r) => r.status_reserva === 'cancelada'}
                  porPagina={100}
                  movel={(r) => (
                    <>
                      <span class="num forte" style={{ width: '46px', flex: 'none', paddingTop: '1px' }}>{hora(r.hora)}</span>
                      <span class="pilha" style={{ gap: '2px', flex: 1, minWidth: 0 }}>
                        <span class="principal-celula">{r.contato_nome}</span>
                        <span class="fraco">{plural(r.pessoas, 'pessoa', 'pessoas')} · {r.ambiente}</span>
                        <SituacaoReserva r={r} atrasoMin={r.atrasada ? r.minutos_de_atraso : null} passou={emAberto(r) && confirmadaBase(r) && new Date(r.fim).getTime() < Date.now()} />
                      </span>
                      {statusDe(r) === 'pendente' ? (
                        <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} onClick={() => aprovar(r)} aria-label={`Aprovar a reserva de ${r.contato_nome}`}>Aprovar</Botao>
                      ) : confirmadaBase(r) && emAberto(r) && comecou(r) ? (
                        <Botao tamanho="p" icone={<UserCheck aria-hidden="true" />} onClick={() => chegou(r)} aria-label={`Registrar que ${r.contato_nome} chegou`}>Chegou</Botao>
                      ) : null}
                    </>
                  )}
                  vazio={
                    lista.length ? (
                      <Vazio compacto titulo="Nenhuma reserva com esses filtros" acao={<Botao tamanho="p" onClick={() => { setFiltro('todas'); setAmbiente(''); setBusca(''); }}>Limpar filtros</Botao>} />
                    ) : (
                      <Vazio icone={<CalendarCheck aria-hidden="true" />} titulo={ehHoje ? 'Nenhuma reserva para hoje' : 'Nenhuma reserva neste dia'}>
                        Reservas feitas pelo site aparecem aqui automaticamente.
                      </Vazio>
                    )
                  }
                />
              )}
            </Dados>
          </Cartao>
          {ambientes.erro && <Aviso tom="atencao">Não foi possível carregar os ambientes: {ambientes.erro.message}</Aviso>}
        </>
      )}

      <DetalheReserva id={aberta} aoFechar={() => setAberta(null)} confirmar={confirmar} />
      <NovaReserva aberta={nova} aoFechar={() => setNova(false)} unidade={contexto.unidade?.codigo ?? null} dataInicial={data} aoCriar={(r) => { setNova(false); setData(r.data); setAberta(r.id); }} />
      <Pendentes aberta={verPendentes} aoFechar={() => setVerPendentes(false)} aoAprovar={aprovar} aoRecusar={recusar} aoAbrir={(id) => { setVerPendentes(false); setAberta(id); }} />
      {dialogo}
    </Raiz>
  );
}
