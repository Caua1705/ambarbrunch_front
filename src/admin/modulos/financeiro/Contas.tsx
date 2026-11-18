// Contas a pagar (fase final, 0031): o que falta pagar, quanto, quando vence, o que atrasou e o que já foi pago. Os
// três tipos de obrigação ficam aqui, sem outra aba: AVULSA (despesa única), RECORRENTE (conta fixa: aluguel,
// internet, sistemas — a obrigação de cada mês nasce sozinha) e PARCELADA (compra em parcelas). O botão
// "+ Conta a pagar" usa a MESMA estrutura das despesas (avulsa e parcelada = despesa a pagar; recorrente = conta fixa
// que gera a despesa de cada mês): nunca uma obrigação e uma despesa separadas para o mesmo gasto. Sem filtros: uma
// lista só, com todas as contas em aberto (vencidas primeiro) e as pagas dos últimos meses; as contas recorrentes são
// administradas no bloco recolhível "Contas recorrentes". Paga, a conta é a mesma despesa de Movimentações →
// Despesas: nada é contado duas vezes.
// Conciliação (0038): "Pagamentos encontrados" no topo sugere o pagamento já registrado (Júlia ou painel) que é desta
// conta — Conciliar / Não corresponde; sem sugestão, "Buscar pagamento" na linha. Nada é baixado sem confirmação.
// Situação (17/11, os mesmos nomes de Movimentações): A pagar · Parcialmente paga · Vencida · Paga. "Previsto" NÃO é
// situação: é o valor de uma conta de valor VARIÁVEL (gás, energia) ainda não confirmado — a conta continua A pagar,
// soma no "Total a pagar" como previsão (destacada) e só vira despesa paga quando alguém paga informando o valor real.
// Nunca aparece como paga nem entra em Movimentações → Despesas (que só lista pagamentos).
// Rotas: GET /contas-a-pagar, POST /parcelas/{id}/pagamentos, POST /despesas, GET/POST/PATCH /recorrencias,
// /conciliacao-contas/* e /parcelas/{id}/conciliar.
import { useEffect, useState } from 'preact/hooks';
import { Banknote, Search, Plus, Pencil, Link2, Undo2 } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, hojeISO, inicioMes, fimMes, somarMeses } from '../../lib/formato';

/** Período pelo VENCIMENTO da parcela. Padrão: todo o período (nada vencido fica escondido). */
type PeriodoContas = 'todo' | 'mes' | 'anterior' | 'proximo';
function periodoContas(p: PeriodoContas): { de?: string; ate?: string } {
  const mes = inicioMes(hojeISO());
  if (p === 'mes') return { de: mes, ate: fimMes(mes) };
  if (p === 'anterior') { const a = somarMeses(mes, -1); return { de: a, ate: fimMes(a) }; }
  if (p === 'proximo') { const a = somarMeses(mes, 1); return { de: a, ate: fimMes(a) }; }
  return {};
}
import { gravarParams } from '../../lib/rotas';
import { Suspenso } from '../../ui/camadas';
import { Botao, Cartao, Etiqueta, Segmentado, Situacao } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { ContaPagar, ListaContas } from '../../lib/tipos/financeiro';
import { useNomeCategoria, temPermissao } from './comum';
import { Pagar, type ContaParaPagar } from './Pagar';
import { EditarRecorrencia } from './ContasFixas';
import { NovaDespesa, EditarDespesa } from './NovaDespesa';
import { SugestoesConciliacao, BuscarPagamento, DesfazerConciliacao } from './ConciliacaoContas';

type TipoNova = 'avulsa' | 'parcelada' | 'recorrente';
type Modo = 'pendentes' | 'pagas';
export const TIPO_CONTA: Record<string, string> = { avulsa: 'Avulsa', recorrente: 'Recorrente', parcelada: 'Parcelada' };

/** Aba Contas a pagar: busca, "+ Conta a pagar" (avulsa, parcelada ou recorrente) e a lista. */
export function ContasAPagar({ contexto, abrirDespesa }: { contexto: ContextoPainel; abrirDespesa: (id: string) => void }) {
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoContas>('todo');
  const [nova, setNova] = useState<TipoNova | null>(null);
  const [modo, setModo] = useState<Modo>('pendentes');
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  return (
    <>
      <div class="barra-ferramentas">
        <Segmentado<Modo> rotulo="Contas pendentes ou pagas" valor={modo} aoMudar={setModo} opcoes={[{ valor: 'pendentes', rotulo: 'Pendentes' }, { valor: 'pagas', rotulo: 'Pagas' }]} />
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar conta ou fornecedor" aria-label="Buscar conta a pagar" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
        <select class="selecao selecao--auto" aria-label="Período do vencimento" value={periodo} onChange={(e) => setPeriodo(e.currentTarget.value as PeriodoContas)}>
          <option value="todo">Todo o período</option>
          <option value="mes">Este mês</option>
          <option value="anterior">Mês passado</option>
          <option value="proximo">Próximo mês</option>
        </select>
        {lancar && (
          <div class="barra-ferramentas__acoes">
            <Suspenso rotulo="Tipo da conta a pagar" gatilho={(g) => <Botao tamanho="p" variante="primario" icone={<Plus aria-hidden="true" />} {...g}>Conta a pagar</Botao>}>
              {(fechar) => (
                <>
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setNova('avulsa'); }}>Avulsa <span class="fraco">· uma vez</span></button>
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setNova('parcelada'); }}>Parcelada <span class="fraco">· em parcelas</span></button>
                  <button class="suspenso__item" role="menuitem" onClick={() => { fechar(); setNova('recorrente'); }}>Recorrente <span class="fraco">· todo mês</span></button>
                </>
              )}
            </Suspenso>
          </div>
        )}
      </div>
      {lancar && modo === 'pendentes' && <SugestoesConciliacao />}
      <ListaContasPagar contexto={contexto} busca={busca} periodo={periodo} modo={modo} abrirDespesa={abrirDespesa} />
      <NovaDespesa aberta={nova === 'avulsa' || nova === 'parcelada'} situacaoInicial={nova === 'parcelada' ? 'parcelada' : 'a_pagar'} aoFechar={() => setNova(null)} aoCriar={abrirDespesa} />
      <EditarRecorrencia alvo={nova === 'recorrente' ? 'nova' : null} aoFechar={() => setNova(null)} />
    </>
  );
}


function ListaContasPagar({ contexto, busca, periodo, modo, abrirDespesa }: { contexto: ContextoPainel; busca: string; periodo: PeriodoContas; modo: Modo; abrirDespesa: (id: string) => void }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const [pagar, setPagar] = useState<ContaParaPagar | null>(null);
  const [editar, setEditar] = useState<string | null>(null);
  const [buscar, setBuscar] = useState<string | null>(null);
  const [desfazer, setDesfazer] = useState<ContaPagar | null>(null);
  const nome = useNomeCategoria();
  // Endereços antigos (?situacao=): os filtros saíram.
  useEffect(() => gravarParams({ situacao: null }), []);
  useEffect(() => { setBuscar(null); setDesfazer(null); }, [modo]);

  // Pendentes: o que falta pagar (em aberto e vencidas). Pagas: só o que foi conta a pagar (as despesas avulsas que já
  // nasceram pagas ficam em Movimentações → Despesas).
  const pagas = modo === 'pagas';
  const q = pagas ? { situacao: 'pagas', so_contas: true, ...periodoContas(periodo) } : { situacao: 'abertas', ...periodoContas(periodo) };
  const lista = useConsulta(`financeiro/contas:${JSON.stringify(q)}`, () => financeiro.contas(q));
  const vencida = (c: ContaPagar) => c.situacao === 'aberta' && c.situacao_painel === 'vencida';
  const parcial = (c: ContaPagar) => c.situacao === 'aberta' && Number(c.valor_pago) > 0;
  const rotuloSituacao = (c: ContaPagar) => (c.situacao === 'paga' ? 'Paga' : vencida(c) ? (parcial(c) ? 'Parcial · vencida' : 'Vencida') : parcial(c) ? 'Parcialmente paga' : 'A pagar');
  const tomSituacao = (c: ContaPagar) => (c.situacao === 'paga' ? 'ok' : vencida(c) ? 'perigo' : parcial(c) ? 'atencao' : 'neutro');

  const colunas: Coluna<ContaPagar>[] = [
    { id: 'vencimento', titulo: 'Vencimento', prioridade: 'media', ordenar: (c) => c.vencimento, largura: '108px', celula: (c) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(c.vencimento)}</span> },
    {
      id: 'descricao', titulo: 'Descrição', ordenar: (c) => c.descricao,
      celula: (c) => (
        <>
          <span class="principal-celula">{c.descricao}</span>
          <span class="sub">
            <span class="fin-so-celular"><strong style={{ color: vencida(c) ? 'var(--perigo)' : undefined }}>{rotuloSituacao(c)}</strong> · {dataCurta(c.vencimento)} · </span>
            {[c.fornecedor, nome(c.categoria)].filter(Boolean).join(' · ')}
          </span>
        </>
      ),
    },
    {
      // O que falta pagar desta conta (parcial: o saldo; valor variável: o previsto). Paga: o que foi pago.
      id: 'valor', titulo: 'Valor', numero: true, ordenar: (c) => Number(pagas ? c.valor_pago : c.saldo),
      celula: (c) => (c.situacao === 'paga' ? <span class="num forte" style={{ whiteSpace: 'nowrap' }}>{moeda(c.valor_pago)}</span>
        : c.valor_a_confirmar ? <><span class="num forte" title="Valor previsto: conta de valor variável; o valor real é informado ao pagar.">{moeda(c.valor)}</span><span class="sub">valor previsto</span></>
        : <><span class="num forte" style={{ whiteSpace: 'nowrap' }}>{moeda(c.saldo)}</span>{parcial(c) && <span class="sub">de {moeda(c.valor)}</span>}</>),
    },
    {
      id: 'situacao', titulo: 'Situação', prioridade: 'media',
      celula: (c) => (
        <span class="linha" style={{ gap: '4px', flexWrap: 'wrap' }}>
          <Situacao tom={tomSituacao(c)} destaque={vencida(c)}>{rotuloSituacao(c)}</Situacao>
          {c.conciliacao_id && <Etiqueta tom="info">Conciliada</Etiqueta>}
        </span>
      ),
    },
    {
      id: 'acoes', titulo: '',
      celula: (c) => (!lancar ? null : (
        <span class="linha" style={{ gap: '4px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          {c.conciliacao_id && <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Desfazer conciliação de ${c.descricao}`} title="Desfazer conciliação" icone={<Undo2 aria-hidden="true" />} onClick={() => { setBuscar(null); setDesfazer(c); }} />}
          {c.situacao !== 'paga' && (
            <>
              <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Editar ${c.descricao}`} icone={<Pencil aria-hidden="true" />} onClick={() => setEditar(c.despesa_id)} />
              <Botao tamanho="p" variante="fantasma" so_icone aria-label={`Buscar pagamento de ${c.descricao}`} title="Buscar pagamento já registrado" icone={<Link2 aria-hidden="true" />} onClick={() => { setDesfazer(null); setBuscar(c.parcela_id); }} />
              <Botao tamanho="p" variante={c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje' ? 'primario' : 'secundario'} icone={<Banknote aria-hidden="true" />} aria-label="Pagar" title="Pagar" onClick={() => setPagar(c)}>
                {/* Celular: só o ícone (com Editar e Buscar pagamento, o texto empurraria o botão para fora). */}
                <span class="so-desktop">Pagar</span>
              </Botao>
            </>
          )}
        </span>
      )),
    },
  ];

  return (
    <>
      {buscar && <BuscarPagamento parcelaId={buscar} aoFechar={() => setBuscar(null)} />}
      {desfazer?.conciliacao_id && <DesfazerConciliacao conciliacaoId={desfazer.conciliacao_id} descricao={desfazer.descricao} aoFechar={() => setDesfazer(null)} />}
      {(
        <Cartao justo>
          <Dados consulta={lista} recurso="As contas a pagar" esqueleto={<EsqueletoTabela />}>
            {(r: ListaContas) => {
              const termo = busca.trim().toLocaleLowerCase('pt-BR');
              const todas = pagas ? r.itens.filter((c) => c.situacao === 'paga') : r.itens.filter((c) => c.situacao !== 'paga');
              const linhas = termo ? todas.filter((c) => `${c.descricao} ${c.fornecedor ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)) : todas;
              const soma = (f: (c: ContaPagar) => string) => (linhas.reduce((s, c) => s + Math.round(Number(f(c)) * 100), 0) / 100).toFixed(2);
              const previstas = pagas ? [] : linhas.filter((c) => c.valor_a_confirmar && Number(c.valor_pago) === 0);
              const previsto = previstas.reduce((s, c) => s + Math.round(Number(c.saldo) * 100), 0) / 100;
              return (
                <>
                  {r.itens.length > 0 && (
                    // Acompanha período e busca. Sem busca: totais do servidor (todas as contas do período); com
                    // busca: soma das linhas encontradas. "A pagar" = saldo (já desconta pagamentos parciais).
                    <div class="fin-totais">
                      <div><span>{pagas ? 'Contas pagas' : 'Contas pendentes'}</span><strong class="num">{termo ? linhas.length : r.total}</strong></div>
                      {pagas
                        ? <div><span>Total pago</span><strong class="num">{moeda(soma((c) => c.valor_pago))}</strong></div>
                        : <div><span>Total a pagar</span><strong class="num">{moeda(termo ? soma((c) => c.saldo) : r.totais.saldo)}</strong></div>}
                      {previstas.length > 0 && <div><span>Dos quais previstos</span><strong class="num" title="Contas de valor variável: previsão, não valor confirmado.">{moeda(previsto)}</strong></div>}
                    </div>
                  )}
                  <Tabela
                    rotulo="Contas a pagar"
                    colunas={colunas}
                    linhas={linhas}
                    chave={(c) => c.parcela_id}
                    aoAbrir={(c) => abrirDespesa(c.despesa_id)}
                    destaque={(c) => c.situacao === 'aberta' && (c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje')}
                    vazio={termo
                      ? <Vazio compacto titulo="Nenhuma conta com essa busca">Procure pela descrição ou pelo fornecedor.</Vazio>
                      : pagas
                        ? <Vazio compacto titulo="Nenhuma conta paga no período">As contas pagas (pelo botão Pagar ou conciliadas) aparecem aqui.</Vazio>
                        : <Vazio compacto titulo="Nenhuma conta a pagar">Contas novas entram por “+ Conta a pagar”, pelas compras ou pelas recorrentes.</Vazio>}
                  />
                  {r.total > r.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {r.itens.length} de {r.total} {pagas ? 'pagas' : 'em aberto'}.</p>}
                </>
              );
            }}
          </Dados>
        </Cartao>
      )}

      <Pagar conta={pagar} aoFechar={() => setPagar(null)} />
      <EditarDespesa id={editar} aoFechar={() => setEditar(null)} />
    </>
  );
}
