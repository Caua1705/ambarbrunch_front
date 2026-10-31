import { Fragment } from 'preact';
import { AlertTriangle, Handshake } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, pct, mesAno } from '../../lib/formato';
import { Aviso, Cartao } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { Participacao as DadosParticipacao } from '../../lib/tipos/financeiro';
import { BASE_PARTICIPACAO } from './comum';

/** Participação (ex.: Roll). Sem regra aprovada por escrito, só SIMULAÇÃO: nada aqui é oficial nem é pago ou distribuído
 *  pelo sistema. Os valores vêm prontos do backend (apuracao.py); a tela não calcula base nem percentual. */
export function Participacao({ mes }: { mes: string }) {
  const r = useConsulta(`financeiro/participacao:${mes}`, () => financeiro.participacao(mes));
  return (
    <Dados consulta={r} recurso="A participação" compacto esqueleto={<Esqueleto linhas={4} />}>
      {(p: DadosParticipacao) =>
        p.tipo === 'oficial' ? (
          <Cartao titulo={<span class="linha"><Handshake size={16} aria-hidden="true" /> Participação · regra aprovada</span>} descricao={mesAno(`${mes}-01`)}>
            {p.oficiais.length ? (
              <dl class="definicoes">
                {p.oficiais.map((o) => (
                  <Fragment key={o.regra_id}>
                    <dt key={`t-${o.regra_id}`}>{o.beneficiario}</dt>
                    <dd key={`d-${o.regra_id}`}>
                      <span class="num forte">{moeda(o.valor)}</span>
                      <span class="fraco"> · {pct(o.percentual)} de {(BASE_PARTICIPACAO[o.base] ?? o.base).toLowerCase()} ({moeda(o.valor_base)}){o.documento_referencia ? ` · ${o.documento_referencia}` : ''}</span>
                    </dd>
                  </Fragment>
                ))}
              </dl>
            ) : (
              <Vazio compacto titulo="Nenhuma participação neste mês" />
            )}
          </Cartao>
        ) : (
          <Cartao titulo={<span class="linha"><Handshake size={16} aria-hidden="true" /> Participação da Roll — simulação</span>} descricao={mesAno(`${mes}-01`)}>
            <Aviso tom="atencao" icone={<AlertTriangle aria-hidden="true" />}>
              <strong>Simulação:</strong> a base da participação ainda não foi aprovada por escrito. Nenhum valor aqui é oficial nem será pago ou distribuído pelo sistema.
            </Aviso>
            <div class="pilha" style={{ marginTop: '12px' }}>
              {Object.entries(p.simulacao).map(([beneficiario, sim]) => (
                <section key={beneficiario} class="pilha pilha--p">
                  <h3 class="secao-titulo">
                    {beneficiario === 'sem_regra_registrada' ? 'Nenhuma regra registrada' : beneficiario}
                    {sim.percentual !== null && sim.percentual !== undefined && <span class="fraco"> · {pct(sim.percentual)}</span>}
                  </h3>
                  <div class="tabela-rolagem">
                    <table class="tabela" aria-label={`Simulação da participação — ${beneficiario === 'sem_regra_registrada' ? 'sem regra' : beneficiario}`}>
                      <thead><tr><th>Base possível</th><th class="num">Valor da base</th><th class="num">Participação simulada</th></tr></thead>
                      <tbody>
                        {Object.entries(sim.bases).map(([base, b]) => (
                          <tr key={base}>
                            <td>{BASE_PARTICIPACAO[base] ?? base}</td>
                            <td class="num">{moeda(b?.valor_base ?? null)}</td>
                            <td class="num forte">{moeda(b?.valor ?? null)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          </Cartao>
        )
      }
    </Dados>
  );
}
