// Fechamento do mês (aba Resultado → Fechamento): checklist assistido, conciliação do extrato por conta e a apuração
// (conferir, fechar, reabrir). Rotas /fechamento/{mes}, /conciliacao/meses/* e /apuracoes/{mes}.
import { useState } from 'preact/hooks';
import { ChevronRight, CircleCheck, AlertTriangle, Info, Lock, Unlock, ClipboardCheck } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { ErroApi } from '../../lib/api/cliente';
import { moeda, mesAno, hojeISO, dataCurta, plural } from '../../lib/formato';
import { rotaPainel } from '../../lib/rotas';
import { useConfirmacao } from '../../ui/camadas';
import { Botao, Cartao, Situacao, Aviso } from '../../ui/base';
import { Dados, Esqueleto, Vazio } from '../../ui/estados';
import type { Fechamento } from '../../lib/tipos/financeiro';
import { SeloQualidade, ESTADO_CONCILIACAO, atualizarFinanceiro, avisar, avisarFalha, temPermissao } from './comum';

/** Pendência do fechamento → a tela que resolve (dentro do Financeiro, abre direto a fila ou o Banco). */
function destinoPendencia(rota: string | null) {
  if (!rota) return null;
  if (rota.startsWith('/admin/financeiro/revisao')) return '/admin/financeiro?aba=revisao';
  if (rota.startsWith('/admin/financeiro/conciliacao') || rota.startsWith('/admin/financeiro/extratos') || rota.startsWith('/admin/financeiro/contas-bancarias')) return '/admin/financeiro?aba=conciliacao';
  return rotaPainel(rota);
}

export function FechamentoMes({ mes, contexto }: { mes: string; contexto: ContextoPainel }) {
  // Conciliar o mês: financeiro.conciliar. Reabrir a conciliação, fechar e reabrir a apuração: financeiro.configurar.
  const conciliar = temPermissao(contexto.usuario, 'financeiro.conciliar');
  const configurar = temPermissao(contexto.usuario, 'financeiro.configurar');
  const f = useConsulta(`financeiro/fechamento:${mes}`, () => financeiro.fechamento(mes));
  const { confirmar, elemento: dialogo } = useConfirmacao();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const emAndamento = mes >= hojeISO().slice(0, 7);

  async function executar(rotulo: string, fn: () => Promise<unknown>, ok: string) {
    setOcupado(rotulo);
    try {
      await fn();
      atualizarFinanceiro();
      avisar(ok, 'ok');
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'pendencias') {
        const p = (e.dados?.pendencias as { codigo: string }[] | undefined)?.map((x) => x.codigo.replace(/_/g, ' ')).join(', ');
        avisar(`Ainda há pendências na conta: ${p ?? 'confira a lista'}.`, 'erro');
      } else avisarFalha(e);
    } finally {
      setOcupado(null);
    }
  }

  const fechar = () =>
    confirmar({
      titulo: `Fechar a apuração de ${mesAno(`${mes}-01`).toLowerCase()}?`,
      texto: 'Os números ficam congelados. Só o Proprietário reabre.',
      confirmar: 'Fechar apuração',
      acao: async () => {
        try {
          await financeiro.fecharApuracao(mes);
        } catch (e) {
          if (e instanceof ErroApi && e.codigo === 'conciliacao_pendente') {
            setTimeout(() => confirmar({ titulo: 'O extrato do mês não está conciliado', texto: 'Para fechar mesmo assim, registre o motivo. A incompletude continua visível na apuração.', confirmar: 'Fechar com exceção', perigo: true, motivo: { rotulo: 'Motivo da exceção', minimo: 10 }, acao: async (m) => { await financeiro.fecharApuracao(mes, m); atualizarFinanceiro(); }, sucesso: 'Apuração fechada com exceção registrada.' }), 50);
            return;
          }
          throw e;
        }
        atualizarFinanceiro();
        avisar('Apuração fechada.', 'ok');
      },
    });

  return (
    <>
      <Dados consulta={f} recurso="O fechamento do mês" esqueleto={<Esqueleto linhas={8} />}>
        {(x: Fechamento) => (
          <div class="duas-colunas">
            <Cartao titulo={`Fechamento de ${mesAno(x.mes).toLowerCase()}`} descricao={x.concluido ? 'Tudo conferido' : `${plural(x.pendencias.length, 'item pede atenção', 'itens pedem atenção')}`} justo acoes={x.concluido ? <Situacao tom="ok">Pronto</Situacao> : undefined}>
              {emAndamento && <div style={{ padding: '14px 20px 0' }}><Aviso tom="info" icone={<Info aria-hidden="true" />}>Este mês ainda está em andamento: o fechamento é feito depois do último dia.</Aviso></div>}
              {x.pendencias.length ? (
                <ul class="lista">
                  {x.pendencias.map((p) => {
                    const destino = destinoPendencia(p.rota);
                    const corpo = (
                      <>
                        <span class={`lista__icone lista__icone--${p.situacao === 'pendente' ? 'perigo' : p.situacao === 'atencao' ? 'atencao' : 'info'}`} aria-hidden="true">{p.situacao === 'indisponivel' ? <Info /> : <AlertTriangle />}</span>
                        <span class="lista__texto">
                          <strong>{p.titulo}</strong>
                          <span>{[p.quantidade ? plural(p.quantidade, 'item', 'itens') : null, p.valor ? moeda(p.valor) : null, p.detalhe].filter(Boolean).join(' · ') || (p.situacao === 'indisponivel' ? 'Indisponível por enquanto' : 'Conferir')}</span>
                        </span>
                        {destino && <span class="lista__fim"><ChevronRight aria-hidden="true" /></span>}
                      </>
                    );
                    return <li key={p.codigo}>{destino ? <a class="lista__item" href={destino}>{corpo}</a> : <div class="lista__item">{corpo}</div>}</li>;
                  })}
                </ul>
              ) : (
                <Vazio compacto icone={<CircleCheck aria-hidden="true" />} titulo="Nenhuma pendência">Vendas, contas, revisões, extrato e compras do mês estão em dia.</Vazio>
              )}
            </Cartao>

            <div class="pilha">
              <Cartao titulo="Extrato bancário" descricao={ESTADO_CONCILIACAO[x.conciliacao.estado].rotulo} justo>
                {x.conciliacao.contas.length ? (
                  <ul class="lista">
                    {x.conciliacao.contas.map((c) => (
                      <li key={c.conta.id} class="lista__item" style={{ flexWrap: 'wrap' }}>
                        <span class="lista__texto" style={{ minWidth: '160px' }}>
                          <strong>{c.conta.apelido}</strong>
                          <span>
                            {c.lacunas.length ? `Faltam ${c.lacunas.map((l) => `${dataCurta(l.de)}–${dataCurta(l.ate)}`).join(', ')}` : c.cobertura_integral ? 'Mês inteiro importado' : 'Sem extrato'}
                            {c.pendentes ? ` · ${plural(c.pendentes, 'movimento para conferir', 'movimentos para conferir')}` : ''}
                          </span>
                        </span>
                        <span class="lista__fim">
                          <Situacao tom={ESTADO_CONCILIACAO[c.estado].tom}>{ESTADO_CONCILIACAO[c.estado].rotulo}</Situacao>
                          {c.estado === 'integral_informado' && conciliar && (
                            <Botao tamanho="p" variante="primario" carregando={ocupado === `c-${c.conta.id}`} onClick={() => executar(`c-${c.conta.id}`, () => financeiro.conciliarMes(mes, c.conta.id), 'Mês conciliado nesta conta.')}>Conciliar mês</Botao>
                          )}
                          {c.estado === 'conciliado' && configurar && (
                            <Botao tamanho="p" variante="fantasma" onClick={() => confirmar({ titulo: 'Reabrir a conciliação desta conta?', confirmar: 'Reabrir', motivo: { rotulo: 'Motivo' }, acao: async (m) => { await financeiro.reabrirMes(mes, c.conta.id, m); atualizarFinanceiro(); }, sucesso: 'Conciliação reaberta.' })}>Reabrir</Botao>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio compacto titulo="Nenhuma conta bancária">Cadastre a conta ao importar o primeiro extrato (Lançamentos → Banco → Importar extrato).</Vazio>
                )}
              </Cartao>

              <Cartao titulo="Apuração do mês" descricao="Os números oficiais do mês para a gestão" acoes={<Situacao tom={x.apuracao.status === 'fechada' ? 'ok' : x.apuracao.status === 'conferida' ? 'info' : 'neutro'}>{x.apuracao.status === 'fechada' ? 'Fechada' : x.apuracao.status === 'conferida' ? 'Conferida' : 'Rascunho'}</Situacao>}>
                <dl class="definicoes">
                  <dt>Qualidade</dt>
                  <dd><SeloQualidade q={x.apuracao.qualidade ?? 'indisponivel'} /></dd>
                  {x.apuracao.excecao_conciliacao && (
                    <>
                      <dt>Fechada com exceção</dt>
                      <dd>“{x.apuracao.excecao_conciliacao.motivo}” · {x.apuracao.excecao_conciliacao.por}</dd>
                    </>
                  )}
                </dl>
                <div class="linha" style={{ marginTop: '14px' }}>
                  {x.apuracao.status === 'rascunho' && !emAndamento && (
                    <Botao icone={<ClipboardCheck aria-hidden="true" />} carregando={ocupado === 'conferir'} onClick={() => executar('conferir', () => financeiro.conferirApuracao(mes), 'Apuração conferida.')}>Marcar como conferida</Botao>
                  )}
                  {x.apuracao.status === 'conferida' && configurar && (
                    <Botao variante="primario" icone={<Lock aria-hidden="true" />} onClick={fechar}>Fechar apuração</Botao>
                  )}
                  {x.apuracao.status === 'fechada' && configurar && (
                    <Botao variante="fantasma" icone={<Unlock aria-hidden="true" />} onClick={() => confirmar({ titulo: 'Reabrir a apuração?', texto: 'Os números voltam a ser recalculados.', confirmar: 'Reabrir', perigo: true, motivo: { rotulo: 'Motivo' }, acao: async (m) => { await financeiro.reabrirApuracao(mes, m); atualizarFinanceiro(); }, sucesso: 'Apuração reaberta.' })}>Reabrir apuração</Botao>
                  )}
                  {x.apuracao.status === 'conferida' && !configurar && <span class="fraco">Fechar a apuração é do Proprietário.</span>}
                </div>
              </Cartao>
            </div>
          </div>
        )}
      </Dados>
      {dialogo}
    </>
  );
}
