// Repasses ÂMBAR × ROLL (17/11): QUEM PAGOU (a conta de onde o dinheiro saiu) × QUEM É RESPONSÁVEL pelo gasto, pagamento a
// pagamento. Os valores vêm PRONTOS do backend (GET /admin/financeiro/repasses/historicos?de=&ate=): todos os pagamentos
// vivos — histórico importado e lançamentos da Júlia/painel —, filtrados pela DATA DO PAGAMENTO. O painel não recalcula.
//  - ÂMBAR pagou despesa da ÂMBARXROLL → a ROLL ressarce a parte dela (rateio, padrão 50%); o inverso quando a ROLL paga;
//  - despesa de um lado paga pelo outro → 100%; paga pela conta conjunta → nada a ressarcir;
//  - conta a pagar em aberto não entra (só pagamento realizado); agrupamento não soma de novo;
//  - antes de 26/10/2026 a ROLL não participava das despesas conjuntas (nada retroativo).
// Cada linha abre a despesa de origem. Só leitura: não cria transferência nem baixa saldo.
import { useMemo, useState } from 'preact/hooks';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, plural, dataCurta, hojeISO, inicioMes, fimMes, somarMeses } from '../../lib/formato';
import { Gaveta, type PedidoConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Etiqueta } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { ItemRessarcimento, Ressarcimentos, EmpresaPagadora } from '../../lib/tipos/financeiro';
import { RESPONSAVEL, EMPRESA } from './comum';
import { DetalheDespesa } from './DetalheDespesa';

type Lado = 'ambar' | 'roll';
type Periodo = 'todo' | 'mes' | 'anterior' | 'personalizado';
const pct = (v: string | number) => `${Math.round(Number(v) * 100)}%`;
const PENDENCIA: Record<string, { titulo: string; texto: string }> = {
  sem_pagador: { titulo: 'Sem pagador identificado', texto: 'Defina a conta que pagou em Pendências: até lá o pagamento não entra no cálculo.' },
  antes_da_divisao: { titulo: 'Despesa conjunta paga antes de 26/10', texto: 'A ROLL só participa das despesas conjuntas a partir de 26/10/2026: não é cobrada aqui. Confira se a responsabilidade está certa.' },
  conjunta_pagou_de_um_lado: { titulo: 'Conta conjunta pagou despesa de um lado só', texto: 'Saiu da conta da ÂMBARXROLL, mas a despesa é só do ÂMBAR ou só da ROLL: confira a responsabilidade.' },
};

function intervalo(p: Periodo, de: string, ate: string): { de?: string; ate?: string } {
  const mes = inicioMes(hojeISO());
  if (p === 'mes') return { de: mes, ate: fimMes(mes) };
  if (p === 'anterior') { const a = somarMeses(mes, -1); return { de: a, ate: fimMes(a) }; }
  if (p === 'personalizado') return { de: de || undefined, ate: ate || undefined };
  return {};
}

export function Repasses({ confirmar }: { confirmar: (p: PedidoConfirmacao) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>('todo');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const q = intervalo(periodo, de, ate);
  const invalido = !!(q.de && q.ate && q.de > q.ate);
  const dados = useConsulta(invalido ? null : `financeiro/repasses/historicos?${JSON.stringify(q)}`, () => financeiro.ressarcimentos(q));
  const [calculo, setCalculo] = useState<EmpresaPagadora | null>(null);
  const [despesa, setDespesa] = useState<string | null>(null);
  return (
    <>
      <div class="barra-ferramentas">
        <select class="selecao selecao--auto" aria-label="Período do pagamento" value={periodo} onChange={(e) => setPeriodo(e.currentTarget.value as Periodo)}>
          <option value="todo">Todo o período</option>
          <option value="mes">Pagos este mês</option>
          <option value="anterior">Pagos no mês anterior</option>
          <option value="personalizado">Escolher datas…</option>
        </select>
        {periodo === 'personalizado' && (
          <>
            <input type="date" class="entrada entrada--data" aria-label="Pagos de" value={de} onChange={(e) => setDe(e.currentTarget.value)} />
            <input type="date" class="entrada entrada--data" aria-label="Pagos até" value={ate} onChange={(e) => setAte(e.currentTarget.value)} />
          </>
        )}
      </div>
      {invalido ? <Cartao><Vazio compacto titulo="Período inválido">A data inicial é depois da final.</Vazio></Cartao> : (
        <Dados consulta={dados} recurso="Os repasses" esqueleto={<Cartao><Esqueleto linhas={3} /></Cartao>}>
          {(r: Ressarcimentos) => (!r.disponivel ? (
            <Cartao><Vazio compacto titulo="Sem repasses">Nenhum pagamento registrado nesta unidade.</Vazio></Cartao>
          ) : (
            <>
              <div class="fin-repasses">
                {(['ambar', 'roll'] as Lado[]).map((e) => (
                  <Cartao key={e} titulo={`${EMPRESA[e]} a receber`}>
                    <p class="fin-saldo" style={{ marginBottom: '12px' }}><strong class="num">{moeda(r.empresas[e].a_receber)}</strong></p>
                    <Botao tamanho="p" onClick={() => setCalculo(e)}>Ver cálculo</Botao>
                  </Cartao>
                ))}
              </div>
              <Pendencias r={r} abrir={setDespesa} />
              <Calculo empresa={calculo} r={r} aoFechar={() => setCalculo(null)} abrir={(id) => { setCalculo(null); setDespesa(id); }} />
            </>
          ))}
        </Dados>
      )}
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
    </>
  );
}

function Pendencias({ r, abrir }: { r: Ressarcimentos; abrir: (id: string) => void }) {
  const lista = Object.entries(r.pendencias ?? {}).filter(([, p]) => p.quantidade > 0);
  if (!lista.length) return null;
  return (
    <Cartao titulo="Para conferir" acoes={<Etiqueta tom="atencao">{plural(lista.reduce((t, [, p]) => t + p.quantidade, 0), 'pagamento', 'pagamentos')}</Etiqueta>}>
      <div class="pilha pilha--p">
        {lista.map(([k, p]) => (
          <section key={k}>
            <h3 class="secao-titulo">{PENDENCIA[k]?.titulo ?? k} · {moeda(p.valor)}</h3>
            <p class="fraco" style={{ margin: '0 0 6px' }}>{PENDENCIA[k]?.texto}</p>
            <ul class="fin-lista-simples">
              {p.itens.map((i) => (
                <li key={i.pagamento_id}>
                  <button type="button" class="link" onClick={() => abrir(i.despesa_id)}>{i.descricao}</button>
                  {' '}<span class="num">{moeda(i.valor_original)}</span>{i.data_pagamento ? ` · pago em ${dataCurta(i.data_pagamento)}` : ''}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Cartao>
  );
}

function Pagador({ i }: { i: ItemRessarcimento }) {
  // 17/11 (pedido do dono): só a empresa — sem conta nem "pessoal".
  if (!i.pagador_empresa) return <span class="fin-falta">Não identificado</span>;
  return <span>{EMPRESA[i.pagador_empresa]}</span>;
}

function Calculo({ empresa, r, aoFechar, abrir }: { empresa: EmpresaPagadora | null; r: Ressarcimentos; aoFechar: () => void; abrir: (despesaId: string) => void }) {
  const itens = empresa ? r.empresas[empresa].itens : [];
  // Soma da coluna "Valor pago" (inclui os pagamentos com 0%); só exibição, em centavos.
  const gasto = useMemo(() => itens.reduce((t, i) => t + Math.round(Number(i.valor_original) * 100), 0) / 100, [itens]);
  if (!empresa) return null;
  const conjunta = empresa === 'ambarxroll';
  const periodo = r.de || r.ate ? ` · pagos ${r.de ? `de ${dataCurta(r.de, { ano: true })} ` : ''}${r.ate ? `até ${dataCurta(r.ate, { ano: true })}` : ''}` : '';
  return (
    <Gaveta aberta largura="larga" aoFechar={aoFechar}
      titulo={conjunta ? 'Pago pela conta conjunta (ÂMBARXROLL)' : `Cálculo · ${EMPRESA[empresa]} a receber`}
      subtitulo={`${plural(itens.length, 'pagamento', 'pagamentos')}${periodo}`}>
      {conjunta && <p class="fraco" style={{ margin: '0 0 12px' }}>Saíram da própria conta da ÂMBARXROLL: nenhum lado adiantou dinheiro, então não há ressarcimento.</p>}
      {itens.length === 0 ? <Vazio compacto titulo="Nenhum pagamento no período" /> : (
        <div class="tabela-rolagem fin-calculo">
          <table class="tabela" aria-label={conjunta ? 'Pagamentos da conta conjunta' : `Cálculo do que ${EMPRESA[empresa]} tem a receber`}>
            <thead>
              <tr>
                <th>Pago em</th><th>Despesa</th><th class="num">Valor pago</th><th data-prioridade="media">Pagador</th>
                <th data-prioridade="media">Responsabilidade</th><th class="num">%</th><th class="num">A receber</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.pagamento_id} tabIndex={0} title="Abrir a despesa de origem" style={{ cursor: 'pointer' }}
                  onClick={() => abrir(i.despesa_id)} onKeyDown={(e) => { if (e.key === 'Enter') abrir(i.despesa_id); }}>
                  <td>{i.data_pagamento ? dataCurta(i.data_pagamento) : <span class="fraco">sem data</span>}</td>
                  <td>{i.descricao}{i.pendencia && <span class="sub"><Etiqueta tom="atencao">conferir</Etiqueta></span>}</td>
                  <td class="num">{moeda(i.valor_original)}</td>
                  <td data-prioridade="media"><Pagador i={i} /></td>
                  <td data-prioridade="media">{RESPONSAVEL[i.responsavel] ?? i.responsavel}</td>
                  <td class="num">{pct(i.percentual_ressarcimento)}</td>
                  <td class="num forte">{moeda(i.valor_a_receber)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td /><td><strong>Total</strong></td>
                <td class="num forte" title="Total pago">{moeda(gasto)}</td>
                <td data-prioridade="media" /><td data-prioridade="media" /><td />
                <td class="num forte" title="Total a receber">{moeda(r.empresas[empresa].a_receber)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Gaveta>
  );
}
