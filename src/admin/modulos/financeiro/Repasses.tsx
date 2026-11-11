// Repasses: quanto Âmbar e Roll têm a receber da operação conjunta (Âmbarxroll) pelos gastos que adiantaram. Não existe
// dívida direta entre os parceiros. Os valores vêm PRONTOS do backend (GET /admin/financeiro/repasses/historicos, que lê
// as views v_repasses_historicos_*): o painel não recalcula. Só leitura: não cria transferência nem baixa saldo.
import { useState } from 'preact/hooks';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, plural } from '../../lib/formato';
import { Gaveta } from '../../ui/camadas';
import { Botao, Cartao } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { ItemRessarcimento } from '../../lib/tipos/financeiro';
import { RESPONSAVEL } from './comum';

type Empresa = 'ambar' | 'roll';
const NOME: Record<string, string> = { ambar: 'Âmbar', roll: 'Roll', ambarxroll: 'Âmbarxroll' };
const pct = (v: string | number) => `${Math.round(Number(v) * 100)}%`;

export function Repasses() {
  const dados = useConsulta('financeiro/repasses/historicos', () => financeiro.ressarcimentos());
  const [calculo, setCalculo] = useState<Empresa | null>(null);
  return (
    <Dados consulta={dados} recurso="Os repasses" esqueleto={<Cartao><Esqueleto linhas={3} /></Cartao>}>
      {(r) => (!r.disponivel ? (
        <Cartao><Vazio compacto titulo="Sem histórico de repasses">O histórico de gastos adiantados ainda não foi carregado nesta unidade.</Vazio></Cartao>
      ) : (
        <>
          <div class="fin-repasses">
            {(['ambar', 'roll'] as Empresa[]).map((e) => (
              <Cartao key={e} titulo={`${NOME[e]} a receber`}>
                <p class="fin-saldo"><strong class="num">{moeda(r.empresas[e].a_receber)}</strong></p>
                <Botao tamanho="p" onClick={() => setCalculo(e)}>Ver cálculo</Botao>
              </Cartao>
            ))}
          </div>
          <div class="fin-totais"><div><span>Total geral a receber</span><strong class="num">{moeda(r.total_a_receber)}</strong></div></div>
          <Calculo empresa={calculo} itens={calculo ? r.empresas[calculo].itens : []} total={calculo ? r.empresas[calculo].a_receber : '0'} aoFechar={() => setCalculo(null)} />
        </>
      ))}
    </Dados>
  );
}

function Calculo({ empresa, itens, total, aoFechar }: { empresa: Empresa | null; itens: ItemRessarcimento[]; total: string; aoFechar: () => void }) {
  if (!empresa) return null;
  return (
    <Gaveta aberta largura="larga" aoFechar={aoFechar} titulo={`Cálculo · ${NOME[empresa]} a receber`} subtitulo={plural(itens.length, 'gasto pago', 'gastos pagos')}>
      <div class="tabela-rolagem">
        <table class="tabela" aria-label={`Cálculo do que ${NOME[empresa]} tem a receber`}>
          <thead>
            <tr><th>Descrição</th><th class="num">Valor original</th><th data-prioridade="media">Pagador</th><th data-prioridade="media">Responsabilidade</th><th class="num">%</th><th class="num">A receber</th></tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.pagamento_id}>
                <td>{i.descricao}</td>
                <td class="num">{moeda(i.valor_original)}</td>
                <td data-prioridade="media">{NOME[i.pagador_empresa] ?? i.pagador_empresa}</td>
                <td data-prioridade="media">{RESPONSAVEL[i.responsavel] ?? i.responsavel}</td>
                <td class="num">{pct(i.percentual_ressarcimento)}</td>
                <td class="num forte">{moeda(i.valor_a_receber)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={5}><strong>Total</strong></td><td class="num forte">{moeda(total)}</td></tr>
          </tfoot>
        </table>
      </div>
    </Gaveta>
  );
}
