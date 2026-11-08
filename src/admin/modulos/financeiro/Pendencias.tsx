// Pendências: tudo o que precisa de uma pessoa, num seletor só (?vista=): a Revisão da Júlia (comprovantes, despesas
// sem categoria ou para conferir: Revisao.tsx, regras intactas) e a Conciliação em três partes — Banco (extrato e
// importação), Stone e recebíveis, Divergências (Conciliacao.tsx). A Conciliação só aparece para quem tem
// financeiro.conciliar. Contagens: a da Revisão vem do resumo (despesas em revisão + comprovantes pendentes, as mesmas
// do sino); a do Banco são as movimentações do extrato deste mês ainda sem decisão. Nada já resolvido entra na conta.
import { useEffect, useState } from 'preact/hooks';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { hojeISO } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Segmentado } from '../../ui/base';
import { Revisao } from './Revisao';
import { Conciliacao, type VistaConciliacao } from './Conciliacao';
import { temPermissao } from './comum';

export type VistaPendencias = 'revisao' | VistaConciliacao;
const VISTAS: VistaPendencias[] = ['revisao', 'banco', 'stone', 'divergencias'];

const contagem = (rotulo: string, n: number | null | undefined) => (
  <>
    {rotulo}
    {n ? <span class="contador">{n}</span> : null}
  </>
);

export function Pendencias({ contexto, revisar }: { contexto: ContextoPainel; revisar: number | null }) {
  const conciliar = temPermissao(contexto.usuario, 'financeiro.conciliar');
  const [vista, setVista] = useState<VistaPendencias>(() => {
    const v = lerParam('vista') as VistaPendencias | null;
    return v && VISTAS.includes(v) && (v === 'revisao' || conciliar) ? v : 'revisao';
  });
  useEffect(() => gravarParams({ vista: vista === 'revisao' ? null : vista }), [vista]);

  // Banco: as movimentações do extrato deste mês ainda abertas, por conta — a mesma conta do fechamento no backend
  // (pendentes + parciais + conflitos, grupos que não se repetem). Conciliadas e duplicadas descartadas não entram.
  const mes = hojeISO().slice(0, 7);
  const estadoMes = useConsulta(`financeiro/conciliacao-mes:${mes}`, () => (conciliar ? financeiro.conciliacaoMes(mes) : Promise.resolve(null)));
  const banco = estadoMes.dados && estadoMes.dados.estado !== 'sem_contas' ? estadoMes.dados.contas.reduce((s, c) => s + (c.pendentes ?? 0) + (c.parciais ?? 0) + (c.conflitos ?? 0), 0) : null;

  const mudar = (v: VistaPendencias) => {
    gravarParams({ filtro: null, mes: null });
    setVista(v);
  };

  return (
    <>
      <Segmentado<VistaPendencias>
        rotulo="Pendências"
        valor={vista}
        aoMudar={mudar}
        opcoes={[
          { valor: 'revisao', rotulo: contagem('Revisão da Júlia', revisar) },
          ...(conciliar
            ? [
                { valor: 'banco' as const, rotulo: contagem('Banco', banco) },
                { valor: 'stone' as const, rotulo: 'Stone e recebíveis' },
                { valor: 'divergencias' as const, rotulo: 'Divergências' },
              ]
            : []),
        ]}
      />
      {vista === 'revisao' ? <Revisao contexto={contexto} /> : <Conciliacao contexto={contexto} vista={vista} aoMudarVista={mudar} />}
    </>
  );
}
