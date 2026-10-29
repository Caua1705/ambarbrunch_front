// Agenda do dia no tablet: resumo em quatro números, próximas reservas primeiro e "Cliente chegou" com um toque.
// Dados só de GET /reservas/operacao (relido a cada minuto); a chegada vai pela mesma rota real do painel de Reservas.
import { useMemo, useRef, useState } from 'preact/hooks';
import { UserCheck, Users, Check, RotateCw, MapPin, MessageSquareText, UserX, ExternalLink, CalendarCheck, Clock3, AlertTriangle, Undo2 } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import type { OperacaoReserva } from '../../lib/tipos/reservas';
import { useConsulta } from '../../lib/consulta';
import { reservas } from '../../lib/api/reservas';
import { hojeISO, hora, horaDe, inteiro, plural, dataLonga } from '../../lib/formato';
import { pode } from '../../lib/permissoes';
import { avisar, avisarErro, Gaveta, useConfirmacao } from '../../ui/camadas';
import { Botao, Situacao, type Tom } from '../../ui/base';
import { Falha, Vazio } from '../../ui/estados';
import { CANAL, registrarComparecimento, emAberto } from '../reservas/comum';
import { momento, resumir, proximas, diaInteiro, ehAtencao, aceitaChegada, chegadaAntecipada, aceitaAusencia, comChegada, type Momento } from './regras';

type Vista = 'proximas' | 'atencao' | 'dia';
const RELER_MS = 60_000;
/** A chegada confirmada pelo servidor vale na tela até a próxima leitura da agenda mostrar o mesmo (ou 2 min). */
const VALIDADE_LOCAL_MS = 120_000;

function rotuloSituacao(r: OperacaoReserva, m: Momento, agora: number): { tom: Tom; texto: string } {
  switch (m) {
    case 'atrasada':
      return { tom: 'perigo', texto: r.minutos_de_atraso ? `Atrasada ${r.minutos_de_atraso} min` : 'Atrasada' };
    case 'agora':
      return { tom: 'info', texto: 'No horário' };
    case 'em_breve': {
      const min = Math.max(1, Math.ceil((new Date(r.inicio).getTime() - agora) / 60_000));
      return { tom: 'info', texto: `Em ${min} min` };
    }
    case 'mais_tarde':
      return { tom: 'ok', texto: 'Confirmada' };
    case 'sem_registro':
      return { tom: 'atencao', texto: 'Chegada não registrada' };
    case 'pendente':
      return { tom: 'atencao', texto: 'Aguardando aprovação' };
    case 'chegou':
      return { tom: 'marca', texto: 'Chegou' };
    case 'nao_veio':
      return { tom: 'perigo', texto: 'Não veio' };
    case 'cancelada':
      return { tom: 'apagado', texto: 'Cancelada' };
  }
}

const nomeDe = (r: OperacaoReserva) => r.contato_nome?.trim() || 'Cliente';
const primeiroNome = (r: OperacaoReserva) => nomeDe(r).split(/\s+/)[0];

export function Agenda({ contexto, agora }: { contexto: ContextoPainel; agora: number }) {
  const unidade = contexto.unidade!.codigo;
  const papel = contexto.usuario.papel;
  const gerencia = pode(papel, 'reservas.mudar_status');
  const hoje = hojeISO();
  const dia = useConsulta(`reservas/operacao:${hoje}:${unidade}`, () => reservas.operacao(hoje, unidade), { intervalo: RELER_MS });
  const ambientes = useConsulta(`reservas/ambientes:${unidade}`, () => reservas.ambientes(unidade));

  const [vista, setVista] = useState<Vista>('proximas');
  const [ambiente, setAmbiente] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [chegadas, setChegadas] = useState<Record<string, number>>({});
  // Trava por reserva: o segundo toque (ou um toque duplo) não manda outro pedido enquanto o primeiro não volta.
  const emCurso = useRef(new Set<string>());
  const [enviando, setEnviando] = useState<string[]>([]);
  const { confirmar, elemento: dialogo } = useConfirmacao();

  const lista = useMemo(
    () => (dia.dados ?? []).map((r) => (chegadas[r.id] && emAberto(r) && Date.now() - chegadas[r.id] < VALIDADE_LOCAL_MS ? comChegada(r, new Date(chegadas[r.id]).toISOString()) : r)),
    [dia.dados, chegadas],
  );
  const resumo = resumir(lista, agora);
  const doAmbiente = ambiente ? lista.filter((r) => r.ambiente_id === ambiente) : lista;
  const visiveis = vista === 'dia' ? diaInteiro(doAmbiente) : vista === 'atencao' ? proximas(doAmbiente, agora).filter((r) => ehAtencao(momento(r, agora))) : proximas(doAmbiente, agora);
  const nomesAmbientes = (ambientes.dados ?? []).filter((a) => a.ativo);
  const aberto = aberta ? lista.find((r) => r.id === aberta) ?? null : null;

  async function registrarChegada(r: OperacaoReserva) {
    if (emCurso.current.has(r.id)) return;
    emCurso.current.add(r.id);
    setEnviando([...emCurso.current]);
    try {
      await registrarComparecimento(r.id, 'compareceu');
      setChegadas((c) => ({ ...c, [r.id]: Date.now() }));
      setConfirmando(null);
      avisar(`Chegada de ${primeiroNome(r)} registrada.`, 'ok');
    } catch (e) {
      avisarErro(e);
    } finally {
      emCurso.current.delete(r.id);
      setEnviando([...emCurso.current]);
    }
  }

  const tocarChegou = (r: OperacaoReserva) => {
    if (chegadaAntecipada(r, agora) && confirmando !== r.id) setConfirmando(r.id);
    else void registrarChegada(r);
  };

  const naoVeio = (r: OperacaoReserva) =>
    confirmar({
      titulo: `${nomeDe(r)} não veio?`,
      texto: 'Isso entra no histórico de frequência do cliente. Para desfazer, use o painel de Reservas.',
      confirmar: 'Registrar que não veio',
      perigo: true,
      acao: () => registrarComparecimento(r.id, 'nao_compareceu'),
      sucesso: 'Ausência registrada.',
    });

  const acao = (r: OperacaoReserva, m: Momento, noDetalhe = false) => {
    const ocupado = enviando.includes(r.id);
    if (aceitaChegada(r, hoje)) {
      if (confirmando === r.id && !noDetalhe) {
        return (
          <div class="op-confirmar" role="group" aria-label={`Confirmar a chegada de ${nomeDe(r)}`}>
            <span class="op-confirmar__texto">Chegou antes do horário ({hora(r.hora)})?</span>
            <Botao variante="fantasma" icone={<Undo2 aria-hidden="true" />} onClick={() => setConfirmando(null)} disabled={ocupado}>Voltar</Botao>
            <Botao variante="primario" icone={<Check aria-hidden="true" />} carregando={ocupado} onClick={() => void registrarChegada(r)} data-autofoco>Confirmar</Botao>
          </div>
        );
      }
      return (
        <Botao variante="primario" class="op-chegou" icone={<UserCheck aria-hidden="true" />} carregando={ocupado} onClick={() => (noDetalhe ? void registrarChegada(r) : tocarChegou(r))} aria-label={`Cliente chegou: ${nomeDe(r)}, ${hora(r.hora)}`}>
          Cliente chegou
        </Botao>
      );
    }
    if (m === 'chegou') {
      const em = r.comparecimento_registrado_em ?? r.fechada_em;
      return (
        <span class="op-feito">
          <Check aria-hidden="true" /> {em ? `Chegou às ${horaDe(em)}` : 'Chegou'}
        </span>
      );
    }
    return null;
  };

  if (!dia.dados && dia.erro) {
    return (
      <div class="op-cartao">
        <Falha erro={dia.erro} aoTentar={dia.recarregar} recurso="A agenda de reservas" />
      </div>
    );
  }

  const carregando = dia.carregando;
  return (
    <>
      <section class="op-resumo" aria-label="Resumo de hoje">
        <Numero rotulo="Reservas hoje" valor={resumo.reservas} carregando={carregando} rodape={resumo.aChegar ? `${plural(resumo.aChegar, 'a chegar', 'a chegar')}` : resumo.reservas ? 'Nenhuma a chegar' : 'Sem reservas'} />
        <Numero rotulo="Pessoas esperadas" valor={resumo.pessoas} carregando={carregando} rodape={`em ${plural(resumo.reservas, 'reserva', 'reservas')}`} />
        <Numero rotulo="Já chegaram" valor={resumo.chegaram} carregando={carregando} rodape={plural(resumo.pessoasChegaram, 'pessoa', 'pessoas')} />
        <Numero
          rotulo="Precisam de atenção"
          valor={resumo.atencao}
          carregando={carregando}
          tom={resumo.atencao ? 'atencao' : undefined}
          rodape={resumo.atencao ? 'Toque para ver' : 'Tudo em dia'}
          aoTocar={resumo.atencao ? () => setVista('atencao') : undefined}
        />
      </section>

      <div class="op-barra">
        <div class="segmentado op-vistas" role="group" aria-label="O que mostrar">
          {([
            ['proximas', 'Próximas'],
            ['atencao', `Atenção${resumo.atencao ? ` (${resumo.atencao})` : ''}`],
            ['dia', 'Dia inteiro'],
          ] as [Vista, string][]).map(([v, t]) => (
            <button type="button" key={v} aria-pressed={vista === v} onClick={() => setVista(v)}>{t}</button>
          ))}
        </div>
        <div class="op-atualizado">
          <span class="fraco" aria-live="polite">{dia.atualizando ? 'Atualizando…' : dia.dados ? 'Atualiza sozinho a cada minuto' : ''}</span>
          <Botao variante="fantasma" so_icone icone={<RotateCw aria-hidden="true" class={dia.atualizando ? 'girando' : undefined} />} aria-label="Atualizar agora" onClick={dia.recarregar} disabled={dia.atualizando} />
        </div>
      </div>

      {nomesAmbientes.length > 1 && (
        <div class="op-ambientes" role="group" aria-label="Ambiente">
          <button type="button" class="op-chip" aria-pressed={ambiente === ''} onClick={() => setAmbiente('')}>Todos</button>
          {nomesAmbientes.map((a) => (
            <button type="button" key={a.id} class="op-chip" aria-pressed={ambiente === a.id} onClick={() => setAmbiente(ambiente === a.id ? '' : a.id)}>{a.nome}</button>
          ))}
        </div>
      )}

      {dia.erro && dia.dados && (
        <div class="aviso aviso--atencao" role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            Mostrando a última agenda carregada. {dia.erro.message}{' '}
            <button type="button" class="btn btn--p btn--fantasma" onClick={dia.recarregar}>Tentar de novo</button>
          </div>
        </div>
      )}

      <section class="op-cartao" aria-label={vista === 'dia' ? 'Todas as reservas de hoje' : vista === 'atencao' ? 'Reservas que precisam de atenção' : 'Próximas reservas'}>
        {carregando ? (
          <div class="op-lista" aria-busy="true" aria-label="Carregando a agenda">
            {[0, 1, 2, 3].map((i) => <div key={i} class="op-reserva op-reserva--carregando"><span class="esqueleto" style={{ height: '28px', width: '64px' }} /><span class="esqueleto" style={{ height: '20px', flex: 1 }} /><span class="esqueleto" style={{ height: '48px', width: '160px' }} /></div>)}
          </div>
        ) : visiveis.length ? (
          <ul class="op-lista">
            {visiveis.map((r) => {
              const m = momento(r, agora);
              const s = rotuloSituacao(r, m, agora);
              return (
                <li key={r.id} class={`op-reserva op-reserva--${m}`}>
                  <button type="button" class="op-reserva__abrir" onClick={() => setAberta(r.id)}>
                    <span class="op-reserva__hora num">{hora(r.hora)}</span>
                    <span class="op-reserva__info">
                      <span class="op-reserva__nome">{nomeDe(r)}</span>
                      <span class="op-reserva__meta">
                        <span><Users aria-hidden="true" /> {plural(r.pessoas, 'pessoa', 'pessoas')}</span>
                        <span><MapPin aria-hidden="true" /> {r.ambiente}</span>
                      </span>
                      {r.observacoes && <span class="op-reserva__obs"><MessageSquareText aria-hidden="true" /> {r.observacoes}</span>}
                    </span>
                    <span class="op-reserva__situacao"><Situacao tom={s.tom} destaque={m === 'atrasada' || m === 'pendente'}>{s.texto}</Situacao></span>
                    <span class="sr">: ver detalhes</span>
                  </button>
                  <div class="op-reserva__acao">{acao(r, m)}</div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Vazio
            icone={vista === 'atencao' ? <Check aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}
            titulo={
              !lista.length ? 'Nenhuma reserva para hoje' : ambiente && !doAmbiente.length ? 'Nenhuma reserva neste ambiente hoje' : vista === 'atencao' ? 'Nada precisa de atenção' : 'Nenhuma reserva a chegar'
            }
            acao={ambiente ? <Botao onClick={() => setAmbiente('')}>Ver todos os ambientes</Botao> : vista !== 'dia' && lista.length ? <Botao onClick={() => setVista('dia')}>Ver o dia inteiro</Botao> : undefined}
          >
            {!lista.length ? 'As reservas feitas pelo site aparecem aqui sozinhas.' : vista === 'proximas' ? 'Todas as reservas de hoje já foram atendidas.' : undefined}
          </Vazio>
        )}
      </section>

      <Gaveta
        aberta={!!aberto}
        aoFechar={() => setAberta(null)}
        titulo={aberto ? nomeDe(aberto) : 'Reserva'}
        subtitulo={aberto ? `${hora(aberto.hora)} · ${plural(aberto.pessoas, 'pessoa', 'pessoas')} · ${aberto.ambiente}` : undefined}
        rodape={
          aberto && (
            <>
              {gerencia && aceitaAusencia(aberto, agora) && (
                <Botao icone={<UserX aria-hidden="true" />} onClick={() => naoVeio(aberto)}>Não veio</Botao>
              )}
              {acao(aberto, momento(aberto, agora), true)}
            </>
          )
        }
      >
        {aberto && <Detalhe r={aberto} m={momento(aberto, agora)} agora={agora} gerencia={gerencia} />}
      </Gaveta>
      {dialogo}
    </>
  );
}

function Numero({ rotulo, valor, rodape, carregando, tom, aoTocar }: { rotulo: string; valor: number; rodape?: string; carregando?: boolean; tom?: 'atencao'; aoTocar?: () => void }) {
  const corpo = (
    <>
      <span class="op-numero__rotulo">{rotulo}</span>
      {carregando ? <span class="esqueleto" style={{ height: '40px', width: '50%' }} /> : <strong class="op-numero__valor num">{inteiro(valor)}</strong>}
      {!carregando && rodape && <span class="op-numero__rodape">{rodape}</span>}
    </>
  );
  const cls = `op-numero${tom ? ` op-numero--${tom}` : ''}`;
  return aoTocar ? <button type="button" class={cls} onClick={aoTocar}>{corpo}</button> : <div class={cls}>{corpo}</div>;
}

function Detalhe({ r, m, agora, gerencia }: { r: OperacaoReserva; m: Momento; agora: number; gerencia: boolean }) {
  const s = rotuloSituacao(r, m, agora);
  return (
    <>
      <div class="linha linha--entre">
        <Situacao tom={s.tom} destaque>{s.texto}</Situacao>
        <span class="fraco num">{r.codigo}</span>
      </div>
      {m === 'pendente' && (
        <div class="aviso aviso--info">
          <Clock3 aria-hidden="true" />
          <div>Esta reserva ainda aguarda aprovação da gerência. A chegada só pode ser registrada depois de aprovada.</div>
        </div>
      )}
      <dl class="definicoes op-definicoes">
        <dt>Dia</dt>
        <dd>{dataLonga(r.data)}</dd>
        <dt>Horário</dt>
        <dd class="num">{hora(r.hora)} <span class="fraco">· {r.duracao_min} min</span></dd>
        <dt>Pessoas</dt>
        <dd class="num">{r.pessoas}</dd>
        <dt>Ambiente</dt>
        <dd>{r.ambiente}</dd>
        <dt>Observações</dt>
        <dd>{r.observacoes || <span class="fraco">Nenhuma</span>}</dd>
        <dt>Origem</dt>
        <dd>{CANAL[r.canal] ?? r.canal}</dd>
      </dl>
      {gerencia && (
        <p class="fraco">
          Telefone, alterações e cancelamento ficam no painel de Reservas.{' '}
          <a href={`/admin/reservas?data=${r.data}&reserva=${r.id}`}>Abrir no painel <ExternalLink size={13} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /></a>
        </p>
      )}
    </>
  );
}
