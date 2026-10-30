// Cancelamentos: vendas canceladas (ou corrigidas para menos) no PDV depois da baixa. O PDV não diz se o produto chegou
// a ser preparado, então a operação responde e só então o backend lança o movimento (estorno, perda ou nada).
// GET /admin/estoque/cancelamentos · POST …/{id}/resolver (versao + decisão; repetir a mesma decisão não lança de novo).
import { useState } from 'preact/hooks';
import { Undo2 } from 'lucide-preact';
import { useConsulta } from '../../lib/consulta';
import { estoque } from '../../lib/api/estoque';
import { ErroApi } from '../../lib/api/cliente';
import { dataCurta, dataHora, quantidade, plural } from '../../lib/formato';
import { useConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Situacao } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { CancelamentoEstoque, DecisaoCancelamento, SituacaoCancelamento } from '../../lib/tipos/estoque';
import { DECISAO, SITUACAO_CANCELAMENTO, atualizarEstoque, useCatalogo, type PermissoesEstoque } from './comum';

const FILTROS: SituacaoCancelamento[] = ['pendente', 'nao_produzido', 'produzido_descartado', 'produzido_aproveitado', 'nao_apurado', 'sem_efeito'];

export function Cancelamentos({ perm }: { perm: PermissoesEstoque }) {
  const [situacao, setSituacao] = useState<SituacaoCancelamento>('pendente');
  const lista = useConsulta(`estoque/cancelamentos?${situacao}`, () => estoque.cancelamentos(situacao));
  const catalogo = useCatalogo();
  const { confirmar, elemento } = useConfirmacao();

  const responder = (c: CancelamentoEstoque, decisao: DecisaoCancelamento) =>
    confirmar({
      titulo: `${DECISAO[decisao].rotulo}?`,
      texto: DECISAO[decisao].explica,
      confirmar: 'Registrar',
      motivo: { rotulo: 'Observação', obrigatorio: false, ajuda: 'Opcional. Fica registrada junto com a decisão.' },
      acao: async (obs) => {
        try {
          await estoque.resolverCancelamento(c.id, c.versao, decisao, obs || undefined);
        } catch (e) {
          if (e instanceof ErroApi && e.codigo === 'ja_resolvido') throw new ErroApi('conflito', 'Esta venda já foi resolvida com outra decisão.', 409, 'ja_resolvido');
          throw e;
        } finally {
          atualizarEstoque();
        }
      },
      sucesso: 'Resposta registrada.',
    });

  return (
    <>
      <div class="linha linha--entre">
        <p class="suave" style={{ margin: 0, maxWidth: '68ch' }}>Quando uma venda é cancelada depois que os ingredientes saíram do estoque, diga o que aconteceu com o produto. Nada é lançado antes da resposta.</p>
        <select class="selecao" aria-label="Situação" style={{ width: 'auto' }} value={situacao} onChange={(e) => setSituacao(e.currentTarget.value as SituacaoCancelamento)}>
          {FILTROS.map((s) => <option key={s} value={s}>{s === 'pendente' ? 'Esperando resposta' : SITUACAO_CANCELAMENTO[s].rotulo}</option>)}
        </select>
      </div>
      <Dados consulta={lista} recurso="Os cancelamentos" esqueleto={<Esqueleto linhas={6} />}>
        {(d) =>
          d.itens.length ? (
            <div class="pilha">
              <span class="fraco">{plural(d.total, 'venda', 'vendas')}{d.total > d.itens.length ? ` · mostrando as ${d.itens.length} mais antigas` : ''}</span>
              {d.itens.map((c) => (
                <Cartao key={c.id}>
                  <div class="cancelamento">
                    <div class="linha linha--entre">
                      <span class="pilha pilha--p" style={{ gap: '2px' }}>
                        <strong style={{ fontWeight: 600 }}>{c.motivo === 'venda_corrigida' ? 'Venda corrigida para menos' : 'Venda cancelada'} · {dataCurta(c.dia, { ano: true })}</strong>
                        <span class="fraco">{c.baixa_lancada ? 'Os ingredientes já tinham saído do estoque.' : 'A venda chegou já cancelada: nada saiu do estoque.'}</span>
                      </span>
                      <Situacao tom={SITUACAO_CANCELAMENTO[c.situacao].tom} destaque={c.situacao === 'pendente'}>{SITUACAO_CANCELAMENTO[c.situacao].rotulo}</Situacao>
                    </div>
                    <ul class="cancelamento__itens">
                      {c.itens.map((i) => (
                        <li key={i.insumo_id}>
                          <span>{catalogo.nome(i.insumo_id)}</span>
                          <span class="num">{quantidade(i.quantidade, catalogo.unidade(i.insumo_id))}</span>
                        </li>
                      ))}
                    </ul>
                    {c.observacao && <p class="fraco" style={{ margin: 0 }}>“{c.observacao}”</p>}
                    {c.resolvido_em && <span class="fraco">Respondido {dataHora(c.resolvido_em)}{c.resolvido_por ? ` · ${c.resolvido_por}` : ''}</span>}
                    {c.situacao === 'pendente' && perm.visualizar && (
                      <div class="linha" role="group" aria-label="O que aconteceu com o produto">
                        {(Object.keys(DECISAO) as DecisaoCancelamento[]).map((k) => (
                          <Botao key={k} tamanho="p" title={DECISAO[k].explica} onClick={() => responder(c, k)}>{DECISAO[k].rotulo}</Botao>
                        ))}
                      </div>
                    )}
                  </div>
                </Cartao>
              ))}
            </div>
          ) : (
            <Vazio icone={<Undo2 aria-hidden="true" />} titulo={situacao === 'pendente' ? 'Nenhuma venda cancelada esperando resposta' : 'Nenhum registro nesta situação'}>
              {situacao === 'pendente' ? 'Quando o PDV cancelar uma venda depois da baixa, ela aparece aqui.' : undefined}
            </Vazio>
          )
        }
      </Dados>
      {elemento}
    </>
  );
}
