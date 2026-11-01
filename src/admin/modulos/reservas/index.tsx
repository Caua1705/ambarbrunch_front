// Reservas: a agenda primeiro. Uma barra só com a navegação (‹ Hoje ›), o intervalo na tela e a visualização — Dia (por
// horário, com as ações), Semana, Mês (calendário), Lista (com busca) e Por ambiente. Sem cartões de indicador: o resumo
// do dia é uma linha (reservas · pessoas) e as aprovações pendentes abrem numa gaveta. Detalhe em gaveta. Rotas reais
// /admin/reservas* (no ar); o fluxo público e as mensagens do WhatsApp não passam por aqui.
// Sem tempo real no backend: a agenda é relida a cada minuto com a aba visível, ao voltar para a aba e no Atualizar.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight, Plus, Search, CalendarClock, Check, UserCheck, MoreHorizontal, X, CalendarCheck, Phone, RotateCw, Lock } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { hojeISO, somarDias, somarMeses, dataLonga, dataCurta, mesAno, hora, plural, inteiro, telefone, inicioMes } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz, useConfirmacao, Suspenso, avisar, avisarErro } from '../../ui/camadas';
import { Botao, Segmentado, Cartao, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { OperacaoReserva, ReservaPainel } from '../../lib/tipos/reservas';
import { statusBase, SituacaoReserva, statusDe, emAberto, confirmadaBase, comecou, aceitaChegada, atualizarReservas, registrarComparecimento, janelaDe, CANAL, criacaoManualDesligada, segundaDe } from './comum';
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
  { id: 'ambientes', rotulo: 'Por ambiente' },
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
    chegaram: lista.filter((r) => r.comparecimento === 'compareceu').length,
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
  const calendario = vista === 'dia' || vista === 'semana' || vista === 'mes';
  const inicioSemana = segundaDe(data);
  // Navegação única para Dia, Semana e Mês: ‹ Hoje › mais o título do intervalo que está na tela.
  const passo = (n: number) => {
    if (vista === 'mes') return setMes(somarMeses(mes, n));
    setData(limitar(somarDias(data, vista === 'semana' ? 7 * n : n)));
  };
  const irHoje = () => {
    setData(hoje);
    setMes(inicioMes(hoje));
    setDiaMes(hoje);
  };
  const noHoje = vista === 'mes' ? mes === inicioMes(hoje) : vista === 'semana' ? inicioSemana === segundaDe(hoje) : ehHoje;
  const tituloIntervalo =
    vista === 'dia' ? (ehHoje ? `Hoje, ${dataLonga(data).toLowerCase()}` : dataLonga(data))
    : vista === 'semana' ? `${dataCurta(inicioSemana)} – ${dataCurta(somarDias(inicioSemana, 6), { ano: true })}`
    : mesAno(mes);
  const podeCriar = pode(papel, 'reservas.criar');
  const criacaoDesligada = podeCriar && criacaoManualDesligada();

  return (
    <Raiz>
      <div class="agenda-barra">
        {calendario ? (
          <div class="agenda-barra__nav">
            <Botao so_icone variante="fantasma" aria-label={vista === 'mes' ? 'Mês anterior' : vista === 'semana' ? 'Semana anterior' : 'Dia anterior'} icone={<ChevronLeft aria-hidden="true" />} disabled={vista !== 'mes' && !!janela && data <= janela.de} onClick={() => passo(-1)} />
            <Botao tamanho="p" onClick={irHoje} disabled={noHoje}>Hoje</Botao>
            <Botao so_icone variante="fantasma" aria-label={vista === 'mes' ? 'Próximo mês' : vista === 'semana' ? 'Próxima semana' : 'Próximo dia'} icone={<ChevronRight aria-hidden="true" />} disabled={vista !== 'mes' && !!janela && data >= janela.ate} onClick={() => passo(1)} />
            <h2 class="agenda-barra__titulo" aria-live="polite">{tituloIntervalo}</h2>
            {vista === 'dia' && (
              <>
                <label class="sr" for="data-reservas">Escolher data</label>
                <input id="data-reservas" type="date" class="entrada entrada--data entrada--p" min={janela?.de} max={janela?.ate} value={data} onChange={(e) => e.currentTarget.value && setData(limitar(e.currentTarget.value))} />
              </>
            )}
          </div>
        ) : (
          <h2 class="agenda-barra__titulo">{vista === 'lista' ? 'Lista de reservas' : 'Reservas por ambiente'}</h2>
        )}
        <div class="agenda-barra__acoes">
          <Segmentado rotulo="Visualização" valor={vista} aoMudar={setVista} opcoes={VISTAS.map((v) => ({ valor: v.id, rotulo: v.rotulo }))} />
          <Botao variante="fantasma" so_icone aria-label="Atualizar agora" title="Atualizar agora" icone={<RotateCw aria-hidden="true" />} onClick={atualizarReservas} />
          {podeCriar && (
            <Botao variante="primario" icone={<Plus aria-hidden="true" />} onClick={() => setNova(true)} title={criacaoDesligada ? 'A criação de reservas pelo painel está desligada no sistema do Âmbar' : undefined} aria-describedby={criacaoDesligada ? 'criacao-desligada' : undefined}>
              Nova reserva
            </Botao>
          )}
        </div>
      </div>

      {(vista === 'dia' || (gerencia && nPend > 0) || criacaoDesligada) && (
        <div class="agenda-resumo">
          {vista === 'dia' && (
            <span aria-live="polite">
              {dia.dados ? (
                <>
                  <strong class="num">{inteiro(resumo.reservas)}</strong> {resumo.reservas === 1 ? 'reserva' : 'reservas'} · <strong class="num">{inteiro(resumo.pessoas)}</strong> {resumo.pessoas === 1 ? 'pessoa' : 'pessoas'}
                  {resumo.chegaram > 0 && <span class="fraco"> · {plural(resumo.chegaram, 'chegou', 'chegaram')}</span>}
                  {ehHoje && proxima && <span class="fraco"> · próxima às {hora(proxima.hora)}</span>}
                  {dia.atualizando && <span class="fraco"> · atualizando…</span>}
                </>
              ) : dia.carregando ? (
                <span class="fraco">Carregando o dia…</span>
              ) : null}
            </span>
          )}
          {gerencia && nPend > 0 && (
            <button type="button" class="pilula pilula--atencao" onClick={() => setVerPendentes(true)}>
              <CalendarClock aria-hidden="true" /> {plural(nPend, 'aguardando aprovação', 'aguardando aprovação')}
            </button>
          )}
          {criacaoDesligada && <span id="criacao-desligada" class="fraco">Criação pelo painel desligada no sistema: reservas novas só pelo site.</span>}
        </div>
      )}

      <div class="pilha">
        {vista === 'dia' && (
          <>
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

        {vista === 'semana' && <Semana inicio={inicioSemana} aoEscolherDia={(d) => { setData(limitar(d)); setVista('dia'); }} aoAbrir={setAberta} />}
        {vista === 'mes' && <Mes mes={mes} dia={diaMes} aoEscolherDia={setDiaMes} aoAbrirDia={(d) => { setData(limitar(d)); setVista('dia'); }} aoAbrir={setAberta} />}
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
