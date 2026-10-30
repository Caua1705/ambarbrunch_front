// Vendas: faturamento do PDV (Eyemobile) por dia, semana ou mês, com ticket médio e o recebido por meio.
// Rota: GET /admin/financeiro/relatorios/vendas?de&ate&agrupar=dia|semana|mes (até 400 dias). Os números vêm prontos do
// backend (view oficial v_vendas_dia): aqui só se escolhe o período e se formata. Sem a loja ligada, "—", nunca zero.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Wallet, Receipt, Percent, HandCoins, RefreshCw, Store } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, num, inteiro, plural, dataCurta, mesAno, mesCurto, hojeISO, inicioMes, fimMes, somarDias, somarMeses, relativo, dataHora } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Cabecalho, Cartao, Segmentado, Indicador, Aviso } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import { GraficoBarras, Legenda } from '../../ui/graficos';
import type { AgrupamentoVendas, PeriodoVendas, RelatorioVendas } from '../../lib/tipos/financeiro';
import { MEIO } from './comum';

type Periodo = '7dias' | 'mes' | 'mes_anterior' | '90dias' | '12meses' | 'personalizado';
const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: '7dias', rotulo: 'Últimos 7 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'mes_anterior', rotulo: 'Mês passado' },
  { valor: '90dias', rotulo: 'Últimos 90 dias' },
  { valor: '12meses', rotulo: 'Últimos 12 meses' },
  { valor: 'personalizado', rotulo: 'Escolher datas…' },
];
const AGRUPAR: AgrupamentoVendas[] = ['dia', 'semana', 'mes'];

/** Datas do período escolhido (só o calendário; os números são todos do backend). */
function intervalo(p: Periodo, de: string, ate: string): [string, string] {
  const hoje = hojeISO();
  if (p === '7dias') return [somarDias(hoje, -6), hoje];
  if (p === 'mes') return [inicioMes(hoje), hoje];
  if (p === 'mes_anterior') {
    const a = somarMeses(inicioMes(hoje), -1);
    return [a, fimMes(a)];
  }
  if (p === '90dias') return [somarDias(hoje, -89), hoje];
  if (p === '12meses') return [somarMeses(inicioMes(hoje), -11), hoje];
  return [de || inicioMes(hoje), ate || hoje];
}

function rotuloPeriodo(agrupar: AgrupamentoVendas, p: PeriodoVendas) {
  if (agrupar === 'mes') return mesAno(p.inicio);
  if (agrupar === 'semana') return `${dataCurta(p.primeiro_dia)} a ${dataCurta(p.ultimo_dia)}`;
  return dataCurta(p.inicio, { semana: true });
}

function rotuloCurto(agrupar: AgrupamentoVendas, p: PeriodoVendas) {
  if (agrupar === 'mes') return mesCurto(p.inicio);
  return dataCurta(agrupar === 'semana' ? p.primeiro_dia : p.inicio);
}

export function Vendas(_: { contexto: ContextoPainel }) {
  const inicialAgrupar = lerParam('agrupar') as AgrupamentoVendas | null;
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [agrupar, setAgrupar] = useState<AgrupamentoVendas>(inicialAgrupar && AGRUPAR.includes(inicialAgrupar) ? inicialAgrupar : 'dia');
  useEffect(() => gravarParams({ agrupar: agrupar === 'dia' ? null : agrupar }), [agrupar]);
  useEffect(() => () => gravarParams({ agrupar: null }), []);

  const [d1, d2] = intervalo(periodo, de, ate);
  const consulta = useConsulta(`financeiro/vendas:${d1}:${d2}:${agrupar}`, () => financeiro.vendas(d1, d2, agrupar));

  const mudarPeriodo = (p: Periodo) => {
    setPeriodo(p);
    // 12 meses por dia vira uma tabela enorme: agrupa por mês, como no painel antigo.
    if (p === '12meses' && agrupar === 'dia') setAgrupar('mes');
  };

  return (
    <>
      <Cabecalho titulo="Vendas" descricao="Faturamento do PDV (Eyemobile) por período" />
      <div class="filtros">
        <select class="selecao" aria-label="Período" value={periodo} onChange={(e) => mudarPeriodo(e.currentTarget.value as Periodo)}>
          {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
        </select>
        {periodo === 'personalizado' && (
          <>
            <input type="date" class="entrada" style={{ width: 'auto' }} aria-label="De" value={de || d1} max={ate || d2} onChange={(e) => setDe(e.currentTarget.value)} />
            <input type="date" class="entrada" style={{ width: 'auto' }} aria-label="Até" value={ate || d2} min={de || d1} max={hojeISO()} onChange={(e) => setAte(e.currentTarget.value)} />
          </>
        )}
        <Segmentado<AgrupamentoVendas> rotulo="Agrupar por" valor={agrupar} aoMudar={setAgrupar} opcoes={[{ valor: 'dia', rotulo: 'Dia' }, { valor: 'semana', rotulo: 'Semana' }, { valor: 'mes', rotulo: 'Mês' }]} />
      </div>
      <Dados consulta={consulta} recurso="O relatório de vendas" esqueleto={<Esqueleto linhas={8} altura={28} />}>
        {(r: RelatorioVendas) => (r.disponivel ? <Relatorio r={r} /> : (
          <Cartao>
            <Vazio icone={<Store aria-hidden="true" />} titulo="Vendas indisponíveis">{r.motivo}</Vazio>
          </Cartao>
        ))}
      </Dados>
    </>
  );
}

function Relatorio({ r }: { r: Extract<RelatorioVendas, { disponivel: true }> }) {
  const t = r.totais;
  const s = r.sincronizacao;
  const colunas: Coluna<PeriodoVendas>[] = useMemo(() => [
    { id: 'periodo', titulo: r.agrupar === 'mes' ? 'Mês' : r.agrupar === 'semana' ? 'Semana' : 'Dia', ordenar: (p) => p.inicio, celula: (p) => <span style={{ whiteSpace: 'nowrap' }}>{rotuloPeriodo(r.agrupar, p)}</span> },
    { id: 'vendas', titulo: 'Vendas', numero: true, prioridade: 'media', ordenar: (p) => p.vendas, celula: (p) => <span class="num">{inteiro(p.vendas)}</span> },
    { id: 'bruto', titulo: 'Bruto', numero: true, prioridade: 'baixa', ordenar: (p) => num(p.faturamento_bruto), celula: (p) => <span class="num">{moeda(p.faturamento_bruto)}</span> },
    { id: 'descontos', titulo: 'Descontos', numero: true, prioridade: 'baixa', celula: (p) => <span class="num">{moeda(p.descontos)}</span> },
    { id: 'devolucoes', titulo: 'Devoluções', numero: true, prioridade: 'baixa', celula: (p) => <span class="num">{moeda(p.devolucoes)}</span> },
    { id: 'liquida', titulo: 'Receita líquida', numero: true, ordenar: (p) => num(p.receita_liquida), celula: (p) => <span class="num forte" style={{ whiteSpace: 'nowrap' }}>{moeda(p.receita_liquida)}</span> },
    { id: 'ticket', titulo: 'Ticket médio', numero: true, prioridade: 'media', ordenar: (p) => num(p.ticket_medio), celula: (p) => <span class="num">{moeda(p.ticket_medio)}</span> },
    { id: 'servico', titulo: 'Taxa de serviço*', numero: true, prioridade: 'baixa', celula: (p) => <span class="num">{moeda(p.taxa_servico)}</span> },
  ], [r.agrupar]);

  return (
    <>
      {s.atrasada ? (
        <Aviso tom="atencao" icone={<RefreshCw aria-hidden="true" />}>
          <strong>Sincronização da Eyemobile atrasada ou com falhas</strong> (última com sucesso: {dataHora(s.ultimo_sucesso_em)}; falhas seguidas: {inteiro(s.falhas_seguidas)}). Os números de vendas podem estar incompletos.
        </Aviso>
      ) : (
        <p class="fraco">Eyemobile sincronizada {relativo(s.ultimo_sucesso_em)}.</p>
      )}

      <section class="indicadores" aria-label="Totais do período">
        <Indicador rotulo="Receita líquida" medio icone={<Wallet aria-hidden="true" />} valor={moeda(t.receita_liquida)} rodape={plural(t.vendas, 'venda', 'vendas')} />
        <Indicador rotulo="Ticket médio" medio icone={<Receipt aria-hidden="true" />} valor={moeda(t.ticket_medio)} rodape={`Faturamento bruto ${moeda(t.faturamento_bruto)}`} />
        <Indicador rotulo="Descontos" medio icone={<Percent aria-hidden="true" />} valor={moeda(t.descontos)} rodape={`Devoluções ${moeda(t.devolucoes)} · ${plural(t.vendas_canceladas, 'cancelada', 'canceladas')}`} />
        <Indicador rotulo="Taxa de serviço" medio icone={<HandCoins aria-hidden="true" />} valor={moeda(t.taxa_servico)} rodape="Fora da receita (vai para a equipe)" />
      </section>

      {r.periodos.length > 1 && (
        <Cartao titulo="Receita líquida por período" descricao={`${dataCurta(r.de, { ano: true })} a ${dataCurta(r.ate, { ano: true })}`}>
          <div class="pilha">
            <GraficoBarras
              rotulo="Receita líquida de vendas por período"
              rotulos={r.periodos.map((p) => rotuloCurto(r.agrupar, p))}
              formatar={(v) => moeda(v)}
              series={[{ nome: 'Receita líquida', cor: 'var(--grafico-1)', valores: r.periodos.map((p) => num(p.receita_liquida)) }]}
            />
            <Legenda series={[{ nome: 'Receita líquida', cor: 'var(--grafico-1)' }]} />
          </div>
        </Cartao>
      )}

      <div class="duas-colunas">
        <Cartao titulo="Vendas por período" justo>
          <Tabela
            rotulo="Vendas por período"
            colunas={colunas}
            linhas={r.periodos}
            chave={(p) => p.inicio}
            ordemInicial={{ coluna: 'periodo', desc: true }}
            vazio={<Vazio compacto titulo="Nenhuma venda no período">Mude o período. Dias sem venda (loja fechada) não aparecem.</Vazio>}
          />
        </Cartao>
        <Cartao titulo="Recebido por meio" descricao="Registrado no PDV, não o crédito no banco" justo>
          {r.por_meio.length ? (
            <ul class="lista">
              {r.por_meio.map((m) => (
                <li key={m.meio} class="lista__item">
                  <span class="lista__texto"><strong>{MEIO[m.meio] ?? m.meio}</strong><span>{plural(m.pagamentos, 'pagamento', 'pagamentos')}</span></span>
                  <span class="lista__fim" style={{ color: 'var(--texto)' }}><span class="num forte">{moeda(m.valor)}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio compacto titulo="Nenhum pagamento no período" />
          )}
        </Cartao>
      </div>
      <p class="fraco">* {r.observacao}</p>
    </>
  );
}
