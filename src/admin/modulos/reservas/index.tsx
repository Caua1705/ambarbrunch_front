// Reservas: a gerente abre e entende o movimento do dia em segundos. Visões do painel anterior, cada uma numa aba: Dia
// (principal, com resumo e ações), Semana, Mês (calendário), Lista (Hoje/Amanhã/Próximos 7 dias/Todas, com busca) e
// Ambientes. Aprovações pendentes em destaque, detalhe em gaveta. Tudo pelas rotas reais /admin/reservas* (no ar).
// Sem tempo real no backend: a agenda é relida a cada minuto com a aba visível, ao voltar para a aba e no Atualizar.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight, Plus, Search, CalendarClock, Check, UserCheck, MoreHorizontal, X, Users, CalendarCheck, CalendarX2, Phone, RotateCw, Lock } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { hojeISO, somarDias, dataLonga, dataCurta, hora, plural, inteiro, telefone, inicioMes } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz, useConfirmacao, Suspenso, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Cabecalho, Indicador, Segmentado, Cartao, Aviso, Abas } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { OperacaoReserva, ReservaPainel } from '../../lib/tipos/reservas';
import { statusBase, SituacaoReserva, statusDe, emAberto, confirmadaBase, comecou, aceitaChegada, atualizarReservas, registrarComparecimento, janelaDe, CANAL } from './comum';
import { DetalheReserva, pedirCancelamento } from './Detalhe';
import { pode } from '../../lib/permissoes';
import { NovaReserva } from './NovaReserva';
import { Pendentes } from './Pendentes';
import { Semana } from './Semana';
import { Mes } from './Mes';
import { Lista } from './Lista';
import { Ambientes } from './Ambientes';
import { lerPeriodo, type Periodo } from './periodo';

type FiltroStatus = 'todas' | 'pendente' | 'confirmada' | 'chegou' | 'cancelada';
type Vista = 'dia' | 'semana' | 'mes' | 'lista' | 'ambientes';
const VISTAS: { id: Vista; rotulo: string }[] = [
  { id: 'dia', rotulo: 'Dia' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'lista', rotulo: 'Lista' },
  { id: 'ambientes', rotulo: 'Ambientes' },
];
const lerVista = (v: string | null): Vista => (VISTAS.some((x) => x.id === v) ? (v as Vista) : 'dia');
const ehData = (v: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? '');

export default function Reservas({ contexto }: { contexto: ContextoPainel }) {
  const hoje = hojeISO();
  const papel = contexto.usuario.papel;
  // Atendente: de hoje até 14 dias à frente (o backend responde 403 fora disso).
  const janela = janelaDe(papel);
  const limitar = (d: string) => (janela ? (d < janela.de ? janela.de : d > janela.ate ? janela.ate : d) : d);
  const [data, setData] = useState(() => limitar(ehData(lerParam('data')) ? lerParam('data')! : hoje));
  const [vista, setVista] = useState<Vista>(() => lerVista(lerParam('vista')));
  const [periodo, setPeriodo] = useState<Periodo>(() => lerPeriodo(lerParam('periodo')));
  const [mes, setMes] = useState(() => inicioMes(ehData(lerParam('mes')) ? lerParam('mes')! : hoje));
  const [diaMes, setDiaMes] = useState<string | null>(() => (ehData(lerParam('dia')) ? lerParam('dia') : hoje));
  const [filtro, setFiltro] = useState<FiltroStatus>('todas');
  const [ambiente, setAmbiente] = useState('');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<string | null>(lerParam('reserva'));
  const [nova, setNova] = useState(false);
  const [verPendentes, setVerPendentes] = useState(lerParam('status') === 'pendente');
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const gerencia = pode(papel, 'reservas.mudar_status');
  const verContato = pode(papel, 'reservas.ver_contato');

  useEffect(
    () =>
      gravarParams({
        data: data === hoje || vista !== 'dia' ? null : data,
        vista: vista === 'dia' ? null : vista,
        periodo: vista === 'lista' || vista === 'ambientes' ? periodo : null,
        mes: vista === 'mes' && mes !== inicioMes(hoje) ? mes : null,
        dia: vista === 'mes' && diaMes && diaMes !== hoje ? diaMes : null,
        reserva: aberta,
        status: verPendentes ? 'pendente' : null,
      }),
    [data, vista, periodo, mes, diaMes, aberta, verPendentes],
  );

  // Dia: relido a cada minuto (o resumo, os atrasos e as chegadas mudam sem a tela saber).
  const dia = useConsulta(vista === 'dia' ? `reservas/operacao:${data}` : null, () => reservas.operacao(data), { intervalo: 60_000 });
  const ambientes = useConsulta('reservas/ambientes', () => reservas.ambientes());
  const pendentes = useConsulta(gerencia ? `reservas?pendentes:${hoje}` : null, () => reservas.listar({ data_de: hoje, status: ['pendente'], limite: 100 }));
  const ambientesAtivos = (ambientes.dados ?? []).filter((a) => a.ativo);

  const lista = dia.dados ?? [];
  const ativas = lista.filter((r) => statusBase(r) !== 'cancelada');
  const proxima = ativas.filter((r) => emAberto(r) && confirmadaBase(r) && !comecou(r)).sort((a, b) => a.hora.localeCompare(b.hora))[0];
  const resumo = {
    reservas: ativas.length,
    pessoas: ativas.reduce((s, r) => s + r.pessoas, 0),
    pendentes: lista.filter((r) => statusDe(r) === 'pendente').length,
    confirmadas: lista.filter((r) => confirmadaBase(r) && emAberto(r)).length,
    chegaram: lista.filter((r) => r.comparecimento === 'compareceu').length,
    canceladas: lista.filter((r) => statusBase(r) === 'cancelada').length,
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
      if (t && !(r.contato_nome.toLowerCase().includes(t) || r.codigo.toLowerCase().includes(t) || (r.contato_email ?? '').toLowerCase().includes(t) || (digitos.length >= 3 && (r.contato_telefone_e164 ?? '').includes(digitos)))) return false;
      return true;
    });
  }, [lista, filtro, ambiente, busca]);

  async function aprovar(r: ReservaPainel) {
    try {
      await reservas.mudarStatus(r.id, 'confirmada');
      avisar(`Reserva de ${r.contato_nome} aprovada.`, 'ok');
    } catch (e) {
      avisarErro(e);
    } finally {
      atualizarReservas();
    }
  }
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
            {verContato ? telefone(r.contato_telefone_e164) : r.codigo}
            {r.observacoes ? ` · ${r.observacoes}` : ''}
          </span>
        </>
      ),
    },
    { id: 'pessoas', titulo: 'Pessoas', numero: true, ordenar: (r) => r.pessoas, largura: '80px', celula: (r) => <span class="num">{r.pessoas}</span> },
    { id: 'ambiente', titulo: 'Ambiente', ordenar: (r) => r.ambiente, prioridade: 'media', celula: (r) => r.ambiente },
    { id: 'canal', titulo: 'Origem', prioridade: 'baixa', celula: (r) => <span class="fraco">{r.importada_de ? 'Importada' : CANAL[r.canal] ?? r.canal}</span> },
    { id: 'status', titulo: 'Situação', ordenar: (r) => statusDe(r), prioridade: 'media', celula: (r) => <SituacaoReserva r={r} atrasoMin={r.atrasada ? r.minutos_de_atraso : null} passou={emAberto(r) && confirmadaBase(r) && new Date(r.fim).getTime() < Date.now()} /> },
    {
      id: 'acoes', titulo: '',
      celula: (r) => (
        <div class="linha" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          {statusDe(r) === 'pendente' && gerencia && (
            <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} onClick={() => aprovar(r)} aria-label={`Aprovar a reserva de ${r.contato_nome}`}>
              Aprovar
            </Botao>
          )}
          {aceitaChegada(r, papel) && comecou(r) && (
            <Botao tamanho="p" icone={<UserCheck aria-hidden="true" />} onClick={() => chegou(r)} aria-label={`Registrar que ${r.contato_nome} chegou`}>
              Chegou
            </Botao>
          )}
          <Suspenso rotulo={`Mais ações para ${r.contato_nome}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone {...p} icone={<MoreHorizontal aria-hidden="true" />} />}>
            {(fechar) => (
              <>
                <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setAberta(r.id); }}>Ver detalhes</button>
                {/* Cliente que chega antes do horário: a chegada vale a partir do dia da reserva. */}
                {aceitaChegada(r, papel) && !comecou(r) && <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); void chegou(r); }}><UserCheck aria-hidden="true" /> Chegou antes do horário</button>}
                {verContato && r.contato_telefone_e164 && <a class="suspenso__item" role="menuitem" href={`tel:${r.contato_telefone_e164}`}><Phone aria-hidden="true" /> Ligar</a>}
                {gerencia && emAberto(r) && (
                  <button class="suspenso__item suspenso__item--perigo" role="menuitem" onClick={() => { fechar(); pedirCancelamento(r, confirmar); }}><X aria-hidden="true" /> {statusDe(r) === 'pendente' ? 'Recusar' : 'Cancelar reserva'}</button>
                )}
              </>
            )}
          </Suspenso>
        </div>
      ),
    },
  ];

  const nPend = pendentes.dados?.total ?? 0;
  const ehHoje = data === hoje;
  const titulo = vista === 'dia' ? (ehHoje ? 'Reservas de hoje' : 'Reservas') : 'Reservas';

  return (
    <Raiz>
      <Cabecalho
        titulo={titulo}
        descricao={vista === 'dia' ? dataLonga(data) : janela ? 'De hoje até 14 dias à frente' : 'Agenda, calendário, lista e ambientes'}
        acoes={
          <>
            <Botao variante="fantasma" so_icone aria-label="Atualizar agora" icone={<RotateCw aria-hidden="true" />} onClick={atualizarReservas} />
            {pode(papel, 'reservas.criar') && <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)}>Nova reserva</Botao>}
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

      <Abas abas={VISTAS} atual={vista} aoMudar={setVista} />

      <div role="tabpanel" id={`painel-${vista}`} aria-labelledby={`aba-${vista}`} class="pilha">
        {vista === 'dia' && (
          <>
            <div class="linha" style={{ gap: '8px' }}>
              <Botao so_icone aria-label="Dia anterior" icone={<ChevronLeft aria-hidden="true" />} disabled={!!janela && data <= janela.de} onClick={() => setData(limitar(somarDias(data, -1)))} />
              <Botao onClick={() => setData(hoje)} disabled={ehHoje}>Hoje</Botao>
              <Botao so_icone aria-label="Próximo dia" icone={<ChevronRight aria-hidden="true" />} disabled={!!janela && data >= janela.ate} onClick={() => setData(limitar(somarDias(data, 1)))} />
              <label class="sr" for="data-reservas">Escolher data</label>
              <input id="data-reservas" type="date" class="entrada" style={{ width: 'auto' }} min={janela?.de} max={janela?.ate} value={data} onChange={(e) => e.currentTarget.value && setData(limitar(e.currentTarget.value))} />
              {dia.atualizando && <span class="fraco">Atualizando…</span>}
            </div>

            <section class="indicadores" aria-label="Resumo do dia">
              <Indicador rotulo="Reservas" icone={<CalendarCheck aria-hidden="true" />} carregando={dia.carregando} valor={inteiro(resumo.reservas)} rodape={ehHoje && proxima ? `Próxima às ${hora(proxima.hora)} · ${proxima.contato_nome.split(' ')[0]}` : `${plural(resumo.confirmadas, 'confirmada', 'confirmadas')} a chegar`} />
              <Indicador rotulo="Pessoas" icone={<Users aria-hidden="true" />} carregando={dia.carregando} valor={inteiro(resumo.pessoas)} rodape={resumo.chegaram ? `${plural(resumo.chegaram, 'reserva chegou', 'reservas chegaram')}` : 'Total esperado no dia'} />
              <Indicador rotulo="Aguardando aprovação" icone={<CalendarClock aria-hidden="true" />} carregando={dia.carregando} valor={inteiro(resumo.pendentes)} rodape={resumo.pendentes ? 'Neste dia' : 'Nenhuma neste dia'} />
              <Indicador rotulo="Canceladas" icone={<CalendarX2 aria-hidden="true" />} carregando={dia.carregando} valor={inteiro(resumo.canceladas)} rodape="Não ocupam lugar" />
            </section>

            <Cartao justo>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }} class="filtros">
                <div class="entrada-grupo">
                  <Search aria-hidden="true" />
                  <input class="entrada" type="search" placeholder={verContato ? 'Buscar nome, telefone ou código' : 'Buscar nome ou código'} aria-label="Buscar reserva" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
                </div>
                <select class="selecao" aria-label="Ambiente" value={ambiente} onChange={(e) => setAmbiente(e.currentTarget.value)}>
                  <option value="">Todos os ambientes</option>
                  {ambientesAtivos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
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
                    apagada={(r) => statusBase(r) === 'cancelada'}
                    porPagina={100}
                    movel={(r) => (
                      <>
                        <span class="num forte" style={{ width: '46px', flex: 'none', paddingTop: '1px' }}>{hora(r.hora)}</span>
                        <span class="pilha" style={{ gap: '2px', flex: 1, minWidth: 0 }}>
                          <span class="principal-celula">{r.contato_nome}</span>
                          <span class="fraco">{plural(r.pessoas, 'pessoa', 'pessoas')} · {r.ambiente}</span>
                          <SituacaoReserva r={r} atrasoMin={r.atrasada ? r.minutos_de_atraso : null} passou={emAberto(r) && confirmadaBase(r) && new Date(r.fim).getTime() < Date.now()} />
                        </span>
                        {statusDe(r) === 'pendente' && gerencia ? (
                          <Botao tamanho="p" variante="primario" icone={<Check aria-hidden="true" />} onClick={() => aprovar(r)} aria-label={`Aprovar a reserva de ${r.contato_nome}`}>Aprovar</Botao>
                        ) : aceitaChegada(r, papel) && comecou(r) ? (
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
            {!verContato && <p class="fraco linha" style={{ gap: '6px' }}><Lock size={14} aria-hidden="true" /> Telefone e e-mail dos clientes ficam com a gerência.</p>}
          </>
        )}

        {vista === 'semana' && <Semana inicio={data} aoEscolherDia={(d) => { setData(limitar(d)); setVista('dia'); }} aoAbrir={setAberta} />}
        {vista === 'mes' && <Mes mes={mes} aoMudarMes={setMes} dia={diaMes} aoEscolherDia={setDiaMes} aoAbrirDia={(d) => { setData(limitar(d)); setVista('dia'); }} aoAbrir={setAberta} />}
        {vista === 'lista' && <Lista periodo={periodo} aoMudarPeriodo={setPeriodo} papel={papel} ambientes={ambientesAtivos} aoAbrir={setAberta} confirmar={confirmar} />}
        {vista === 'ambientes' && <Ambientes periodo={periodo} aoMudarPeriodo={setPeriodo} ambientes={ambientes.dados ?? []} aoAbrir={setAberta} />}
        {ambientes.erro && <Aviso tom="atencao">Não foi possível carregar os ambientes: {ambientes.erro.message}</Aviso>}
      </div>

      <DetalheReserva id={aberta} aoFechar={() => setAberta(null)} confirmar={confirmar} papel={papel} />
      <NovaReserva aberta={nova} aoFechar={() => setNova(false)} unidade={contexto.unidade?.codigo ?? null} dataInicial={data} aoCriar={(r) => { setNova(false); setVista('dia'); setData(r.data); setAberta(r.id); }} />
      <Pendentes aberta={verPendentes} aoFechar={() => setVerPendentes(false)} aoAprovar={aprovar} aoRecusar={(r) => pedirCancelamento(r, confirmar)} aoAbrir={(id) => { setVerPendentes(false); setAberta(id); }} />
      {dialogo}
    </Raiz>
  );
}
