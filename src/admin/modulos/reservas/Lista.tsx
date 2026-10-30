// Lista de reservas por período (Hoje, Amanhã, Próximos 7 dias, Todas), com busca e filtro de situação — a "Lista" do
// painel anterior. A busca roda sobre o que já veio do backend (nome, código, e-mail e telefone), sem uma consulta por tecla.
import { useMemo, useState } from 'preact/hooks';
import { Search, MoreHorizontal, X, CalendarSearch, Lock } from 'lucide-preact';
import { dataCurta, hora, plural, telefone } from '../../lib/formato';
import { pode } from '../../lib/permissoes';
import type { Papel } from '../../lib/sessao';
import type { AmbienteOperacao, ReservaPainel } from '../../lib/tipos/reservas';
import { Suspenso, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Segmentado, Aviso } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { SituacaoReserva, statusDe, statusBase, emAberto, confirmadaBase, comecou, GRUPOS_STATUS, type GrupoStatus, CANAL } from './comum';
import { PERIODOS, useReservasDoPeriodo, ordenar, type Periodo } from './periodo';
import { pedirCancelamento } from './Detalhe';

type FiltroSituacao = '' | GrupoStatus | 'a_chegar';

const SITUACOES: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas as situações' },
  { valor: 'a_chegar', rotulo: 'A chegar' },
  { valor: 'confirmada', rotulo: 'Confirmadas' },
  { valor: 'pendente', rotulo: 'Aguardando aprovação' },
  { valor: 'encerradas', rotulo: 'Comparecimentos' },
  { valor: 'cancelada', rotulo: 'Canceladas' },
];

const digitos = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '');

export function Lista({ periodo, aoMudarPeriodo, papel, ambientes, aoAbrir, confirmar }: { periodo: Periodo; aoMudarPeriodo: (p: Periodo) => void; papel: Papel; ambientes: AmbienteOperacao[]; aoAbrir: (id: string) => void; confirmar: (p: PedidoConfirmacao) => void }) {
  const consulta = useReservasDoPeriodo(periodo);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<FiltroSituacao>('');
  const [ambiente, setAmbiente] = useState('');
  const verContato = pode(papel, 'reservas.ver_contato');
  const gerencia = pode(papel, 'reservas.mudar_status');

  const todas = consulta.dados?.itens ?? [];
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const d = digitos(t);
    return ordenar(
      todas.filter((r) => {
        if (situacao === 'a_chegar' && !(emAberto(r) && !comecou(r))) return false;
        if (situacao && situacao !== 'a_chegar' && !(GRUPOS_STATUS[situacao] as string[]).includes(statusDe(r))) return false;
        if (ambiente && r.ambiente_id !== ambiente) return false;
        if (t && !(r.contato_nome.toLowerCase().includes(t) || r.codigo.toLowerCase().includes(t) || (r.contato_email ?? '').toLowerCase().includes(t) || (d.length >= 3 && digitos(r.contato_telefone_e164).includes(d)))) return false;
        return true;
      }),
    );
  }, [todas, busca, situacao, ambiente]);

  const colunas: Coluna<ReservaPainel>[] = [
    { id: 'data', titulo: 'Data', ordenar: (r) => r.data + r.hora, largura: '120px', celula: (r) => <><span class="principal-celula">{dataCurta(r.data, { semana: true })}</span><span class="sub num">{hora(r.hora)}</span></> },
    { id: 'cliente', titulo: 'Cliente', ordenar: (r) => r.contato_nome, celula: (r) => <><span class="principal-celula">{r.contato_nome}</span><span class="sub">{r.codigo}{r.observacoes ? ` · ${r.observacoes}` : ''}</span></> },
    { id: 'telefone', titulo: 'Telefone', prioridade: 'baixa', celula: (r) => (verContato ? <span class="num">{telefone(r.contato_telefone_e164)}</span> : <span class="fraco linha" style={{ gap: '4px' }}><Lock size={12} aria-hidden="true" /> Restrito</span>) },
    { id: 'ambiente', titulo: 'Ambiente', ordenar: (r) => r.ambiente, prioridade: 'media', celula: (r) => r.ambiente },
    { id: 'pessoas', titulo: 'Pessoas', numero: true, ordenar: (r) => r.pessoas, largura: '80px', celula: (r) => <span class="num">{r.pessoas}</span> },
    { id: 'canal', titulo: 'Origem', prioridade: 'baixa', celula: (r) => <span class="fraco">{r.importada_de ? 'Importada' : CANAL[r.canal] ?? r.canal}</span> },
    { id: 'status', titulo: 'Situação', ordenar: (r) => statusDe(r), prioridade: 'media', celula: (r) => <SituacaoReserva r={r} /> },
    {
      id: 'acoes', titulo: '',
      celula: (r) => (
        <Suspenso rotulo={`Ações da reserva de ${r.contato_nome}`} gatilho={(p) => <Botao tamanho="p" variante="fantasma" so_icone {...p} icone={<MoreHorizontal aria-hidden="true" />} />}>
          {(fechar) => (
            <>
              <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); aoAbrir(r.id); }}>Ver detalhes</button>
              {gerencia && emAberto(r) && (confirmadaBase(r) || statusDe(r) === 'pendente') && (
                <button class="suspenso__item suspenso__item--perigo" role="menuitem" onClick={() => { fechar(); pedirCancelamento(r, confirmar); }}><X aria-hidden="true" /> {statusDe(r) === 'pendente' ? 'Recusar' : 'Cancelar'}</button>
              )}
            </>
          )}
        </Suspenso>
      ),
    },
  ];

  const filtrou = !!(busca || situacao || ambiente);
  const total = consulta.dados?.total ?? 0;
  return (
    <Cartao justo>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--borda)' }} class="pilha pilha--p">
        <div class="filtros">
          <Segmentado rotulo="Período" valor={periodo} aoMudar={aoMudarPeriodo} opcoes={PERIODOS} />
          {consulta.atualizando && <span class="fraco">Atualizando…</span>}
        </div>
        <div class="filtros">
          <div class="entrada-grupo">
            <Search aria-hidden="true" />
            <input class="entrada" type="search" placeholder={verContato ? 'Nome, telefone, e-mail ou código' : 'Nome ou código'} aria-label="Buscar na lista" value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
          </div>
          <select class="selecao" aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.currentTarget.value as FiltroSituacao)}>
            {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
          </select>
          <select class="selecao" aria-label="Ambiente da lista" value={ambiente} onChange={(e) => setAmbiente(e.currentTarget.value)}>
            <option value="">Todos os ambientes</option>
            {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          {consulta.dados && <span class="fraco" aria-live="polite">{plural(filtradas.length, 'reserva', 'reservas')}</span>}
        </div>
        {periodo === 'todas' && <p class="fraco pequeno">Desde 30 dias atrás. Reservas mais antigas ficam na ficha do cliente.</p>}
        {consulta.dados && total > consulta.dados.itens.length && (
          <Aviso tom="atencao">Mostrando {plural(consulta.dados.itens.length, 'reserva', 'reservas')} de {total}. Escolha um período menor para ver todas.</Aviso>
        )}
      </div>
      <Dados consulta={consulta} recurso="A lista de reservas" esqueleto={<EsqueletoTabela />}>
        {() => (
          <Tabela
            rotulo="Lista de reservas"
            colunas={colunas}
            linhas={filtradas}
            chave={(r) => r.id}
            aoAbrir={(r) => aoAbrir(r.id)}
            destaque={(r) => statusDe(r) === 'pendente'}
            apagada={(r) => statusBase(r) === 'cancelada'}
            porPagina={50}
            movel={(r) => (
              <>
                <span class="pilha" style={{ gap: '2px', width: '64px', flex: 'none' }}>
                  <span class="forte">{dataCurta(r.data)}</span>
                  <span class="num fraco">{hora(r.hora)}</span>
                </span>
                <span class="pilha" style={{ gap: '2px', flex: 1, minWidth: 0 }}>
                  <span class="principal-celula">{r.contato_nome}</span>
                  <span class="fraco">{plural(r.pessoas, 'pessoa', 'pessoas')} · {r.ambiente}</span>
                  <SituacaoReserva r={r} />
                </span>
              </>
            )}
            vazio={
              filtrou && todas.length ? (
                <Vazio compacto titulo="Nenhuma reserva com esses filtros" acao={<Botao tamanho="p" onClick={() => { setBusca(''); setSituacao(''); setAmbiente(''); }}>Limpar filtros</Botao>} />
              ) : (
                <Vazio icone={<CalendarSearch aria-hidden="true" />} titulo="Nenhuma reserva neste período">Reservas novas chegam pelo site e aparecem aqui sozinhas.</Vazio>
              )
            }
          />
        )}
      </Dados>
    </Cartao>
  );
}
