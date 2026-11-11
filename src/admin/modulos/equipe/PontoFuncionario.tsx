// Ponto de um funcionário, dia a dia: entrada, saída, intervalo, horas trabalhadas e saldo, com o saldo acumulado do
// período. Dados reais do espelho (GET /relatorios/espelho): nada é recalculado além da soma dos saldos. Saldo do dia =
// `diferenca_min` do backend (trabalhado − previsto, só com a jornada encerrada); falta (ausente) conta o previsto inteiro
// como negativo; dia em andamento, folga e sem escala não entram. Abrir o dia leva às marcações e às correções.
import { useState } from 'preact/hooks';
import { equipe } from '../../lib/api/equipe';
import { useConsulta } from '../../lib/consulta';
import { dataCurta, hojeISO, horaDe, inicioMes, somarDias } from '../../lib/formato';
import type { LinhaEspelho } from '../../lib/tipos/equipe';
import { Situacao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { DetalheDia } from './Registros';
import { ROTULO_STATUS, TOM_STATUS, type PermissoesEquipe } from './comum';

const PERIODOS = [{ v: '7', r: 'Últimos 7 dias' }, { v: 'mes', r: 'Este mês' }, { v: 'anterior', r: 'Mês anterior' }, { v: '30', r: 'Últimos 30 dias' }] as const;
type Periodo = (typeof PERIODOS)[number]['v'];

function intervaloDe(p: Periodo, hoje: string): [string, string] {
  if (p === 'mes') return [inicioMes(hoje), hoje];
  if (p === 'anterior') { const fim = somarDias(inicioMes(hoje), -1); return [inicioMes(fim), fim]; }
  return [somarDias(hoje, p === '7' ? -6 : -29), hoje];
}

/** Saldo do dia em minutos, ou null quando o dia não conta (em andamento, folga, sem escala). */
export function saldoDoDia(l: LinhaEspelho): number | null {
  if (l.diferenca_min !== null && l.diferenca_min !== undefined) return l.diferenca_min;
  if (l.status === 'ausente') return -(l.previsto.previsto_min || 0);
  return null;
}

/** 485 → "8h05"; 5 → "5min". */
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}min`);
export const saldoTexto = (m: number | null) => (m === null ? '—' : m === 0 ? '0min' : `${m > 0 ? '+' : '−'}${hm(Math.abs(m))}`);
const tomSaldo = (m: number | null) => (m === null || m === 0 ? undefined : m > 0 ? 'var(--ok)' : 'var(--perigo)');

export function PontoFuncionario({ funcionarioId, perm }: { funcionarioId: string; perm: PermissoesEquipe }) {
  const hoje = hojeISO();
  const [periodo, setPeriodo] = useState<Periodo>('7');
  const [aberta, setAberta] = useState<LinhaEspelho | null>(null);
  const [de, ate] = intervaloDe(periodo, hoje);
  const q = { de, ate, funcionario_id: funcionarioId, limite: 200 };
  const consulta = useConsulta(`equipe:espelho?${JSON.stringify(q)}`, () => equipe.espelho(q));

  const colunas: Coluna<LinhaEspelho>[] = [
    { id: 'data', titulo: 'Data', celula: (l) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(l.data, { semana: true })}</span> },
    { id: 'entrada', titulo: 'Entrada', celula: (l) => <span class="num">{horaDe(l.entrada)}</span> },
    { id: 'saida', titulo: 'Saída', celula: (l) => <span class="num">{horaDe(l.saida)}</span> },
    { id: 'intervalo', titulo: 'Intervalo', prioridade: 'media', celula: (l) => <span class="num">{l.intervalo_min ? hm(l.intervalo_min) : '—'}</span> },
    { id: 'trabalhadas', titulo: 'Trabalhadas', numero: true, celula: (l) => (l.jornadas_ids.length ? hm(l.trabalhado_min) : <Situacao tom={TOM_STATUS[l.status]}>{ROTULO_STATUS[l.status]}</Situacao>) },
    { id: 'saldo', titulo: 'Saldo', numero: true, celula: (l) => { const s = saldoDoDia(l); return <span class="num forte" style={{ color: tomSaldo(s) }}>{saldoTexto(s)}</span>; } },
  ];

  return (
    <div class="pilha">
      <div class="linha linha--entre">
        <select class="selecao selecao--auto" aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.currentTarget.value as Periodo)}>
          {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.r}</option>)}
        </select>
      </div>
      <Dados consulta={consulta} esqueleto={<EsqueletoTabela linhas={4} />}>
        {(p) => {
          // Dias sem nada a mostrar (folga/sem escala sem batida) só ocupam espaço.
          const linhas = p.itens
            .filter((l) => l.jornadas_ids.length || !['folga', 'sem_escala', 'previsto'].includes(l.status))
            .sort((a, b) => b.data.localeCompare(a.data));
          const saldos = linhas.map(saldoDoDia).filter((s): s is number => s !== null);
          const acumulado = saldos.reduce((t, s) => t + s, 0);
          const trabalhado = linhas.reduce((t, l) => t + (l.trabalhado_min || 0), 0);
          return (
            <>
              <div class="equipe-saldo">
                <div><span>Trabalhadas no período</span><strong class="num">{hm(trabalhado)}</strong></div>
                <div><span>Saldo acumulado</span><strong class="num" style={{ color: tomSaldo(saldos.length ? acumulado : null) }}>{saldos.length ? saldoTexto(acumulado) : '—'}</strong></div>
              </div>
              <Tabela
                rotulo="Ponto por dia"
                colunas={colunas}
                linhas={linhas}
                chave={(l) => l.data}
                aoAbrir={setAberta}
                movel={(l) => (
                  <div class="linha linha--entre">
                    <span><strong>{dataCurta(l.data, { semana: true })}</strong> <span class="fraco num">{horaDe(l.entrada)}–{horaDe(l.saida)} · {l.jornadas_ids.length ? hm(l.trabalhado_min) : ROTULO_STATUS[l.status]}</span></span>
                    <span class="num forte" style={{ color: tomSaldo(saldoDoDia(l)) }}>{saldoTexto(saldoDoDia(l))}</span>
                  </div>
                )}
                vazio={<Vazio compacto titulo="Sem registros neste período" />}
              />
              {p.total > p.itens.length && <p class="fraco equipe-rodape">Mostrando {p.itens.length} de {p.total} dias.</p>}
            </>
          );
        }}
      </Dados>
      {aberta && <DetalheDia linha={aberta} perm={perm} aoFechar={() => setAberta(null)} />}
    </div>
  );
}
