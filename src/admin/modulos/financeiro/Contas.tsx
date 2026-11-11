// Contas a pagar (fase final, 0031): o que falta pagar, quanto, quando vence, o que atrasou e o que já foi pago. Os
// três tipos de obrigação ficam aqui, sem outra aba: AVULSA (despesa única), RECORRENTE (conta fixa: aluguel,
// internet, sistemas — a obrigação de cada mês nasce sozinha) e PARCELADA (compra em parcelas). O botão
// "+ Conta a pagar" usa a MESMA estrutura das despesas (avulsa e parcelada = despesa a pagar; recorrente = conta fixa
// que gera a despesa de cada mês): nunca uma obrigação e uma despesa separadas para o mesmo gasto. As contas fixas
// são administradas na visão "Recorrentes" (o antigo botão "Contas fixas" saiu). Paga, a conta continua no
// histórico (Pagas) e é a mesma despesa de Movimentações → Despesas: nada é contado duas vezes.
// Rotas: GET /contas-a-pagar, POST /parcelas/{id}/pagamentos, POST /despesas, GET/POST/PATCH /recorrencias.
import { useEffect, useState } from 'preact/hooks';
import { Banknote, Search, Plus } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, num, hojeISO, inicioMes, somarMeses, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Suspenso } from '../../ui/camadas';
import { Botao, Cartao, Segmentado, Situacao, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { ContaPagar, ListaContas } from '../../lib/tipos/financeiro';
import { SITUACAO_CONTA, useNomeCategoria, temPermissao } from './comum';
import { Pagar, type ContaParaPagar } from './Pagar';
import { Recorrencias, EditarRecorrencia } from './ContasFixas';
import { NovaDespesa } from './NovaDespesa';

type Filtro = 'vencidas' | 'hoje' | 'proximas' | 'abertas' | 'recorrentes' | 'pagas' | 'todas';
const FILTROS: Filtro[] = ['vencidas', 'hoje', 'proximas', 'abertas', 'recorrentes', 'pagas', 'todas'];
type TipoNova = 'avulsa' | 'parcelada' | 'recorrente';
export const TIPO_CONTA: Record<string, string> = { avulsa: 'Avulsa', recorrente: 'Recorrente', parcelada: 'Parcelada' };

/** Aba Contas a pagar: busca, "+ Conta a pagar" (avulsa, parcelada ou recorrente) e a lista. */
export function ContasAPagar({ contexto, abrirDespesa }: { contexto: ContextoPainel; abrirDespesa: (id: string) => void }) {
  const [busca, setBusca] = useState('');
  const [nova, setNova] = useState<TipoNova | null>(null);
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  return (
    <>
      <div class="barra-ferramentas">
        <div class="entrada-grupo barra-ferramentas__busca">
          <Search aria-hidden="true" />
          <input class="entrada" type="search" placeholder="Buscar conta ou fornecedor" aria-label="Buscar conta a pagar" maxLength={80} value={busca} onInput={(e) => setBusca(e.currentTarget.value)} />
        </div>
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
      <ListaContasPagar contexto={contexto} busca={busca} abrirDespesa={abrirDespesa} />
      <NovaDespesa aberta={nova === 'avulsa' || nova === 'parcelada'} situacaoInicial={nova === 'parcelada' ? 'parcelada' : 'a_pagar'} aoFechar={() => setNova(null)} aoCriar={abrirDespesa} />
      <EditarRecorrencia alvo={nova === 'recorrente' ? 'nova' : null} aoFechar={() => setNova(null)} />
    </>
  );
}

function filtroInicial(): Filtro {
  // Endereços antigos: ?vista=recorrentes (o antigo "Contas fixas") abre a visão Recorrentes.
  if (lerParam('vista') === 'recorrentes') return 'recorrentes';
  const s = lerParam('situacao') as Filtro | null;
  return s && FILTROS.includes(s) ? s : 'abertas';
}

function ListaContasPagar({ contexto, busca, abrirDespesa }: { contexto: ContextoPainel; busca: string; abrirDespesa: (id: string) => void }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [pagar, setPagar] = useState<ContaParaPagar | null>(null);
  const nome = useNomeCategoria();
  useEffect(() => gravarParams({ situacao: filtro === 'abertas' ? null : filtro, vista: null }), [filtro]);

  // Pagas e todas: dos últimos meses (a lista completa não cabe numa tela).
  const q = filtro === 'pagas' || filtro === 'todas' ? { situacao: filtro, de: somarMeses(inicioMes(hojeISO()), -2) } : { situacao: filtro };
  const lista = useConsulta(filtro === 'recorrentes' ? null : `financeiro/contas:${JSON.stringify(q)}`, () => financeiro.contas(q));
  const resumo = useConsulta('financeiro/resumo', () => financeiro.resumo());
  const n = resumo.dados?.contas;

  const colunas: Coluna<ContaPagar>[] = [
    { id: 'vencimento', titulo: 'Vencimento', prioridade: 'media', ordenar: (c) => c.vencimento, largura: '108px', celula: (c) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(c.vencimento)}</span> },
    {
      id: 'descricao', titulo: 'Conta', ordenar: (c) => c.descricao,
      celula: (c) => (
        <>
          <span class="principal-celula">{c.descricao}</span>
          <span class="sub">
            <span class="fin-so-celular"><strong style={{ color: c.situacao_painel === 'vencida' ? 'var(--perigo)' : undefined }}>{SITUACAO_CONTA[c.situacao_painel].rotulo}</strong> · {dataCurta(c.vencimento)} · </span>
            {[c.fornecedor, nome(c.categoria)].filter(Boolean).join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'tipo', titulo: 'Tipo', prioridade: 'media', ordenar: (c) => c.tipo_conta ?? '',
      celula: (c) => <span class="fraco">{TIPO_CONTA[c.tipo_conta ?? (c.recorrencia_id ? 'recorrente' : 'avulsa')]}{c.tipo_conta === 'parcelada' && c.parcelas_total ? ` · ${c.numero}/${c.parcelas_total}` : ''}</span>,
    },
    {
      id: 'valor', titulo: 'Valor', numero: true, prioridade: 'media', ordenar: (c) => Number(c.valor),
      celula: (c) => (c.valor_a_confirmar ? <><span class="num">{moeda(c.valor)}</span><span class="sub">previsto</span></> : <span class="num">{moeda(c.valor)}</span>),
    },
    { id: 'pago', titulo: 'Pago', numero: true, prioridade: 'baixa', celula: (c) => <span class="num">{num(c.valor_pago) ? moeda(c.valor_pago) : '—'}</span> },
    { id: 'saldo', titulo: 'Falta pagar', numero: true, ordenar: (c) => Number(c.saldo), celula: (c) => <span class="num forte" style={{ whiteSpace: 'nowrap' }}>{c.situacao === 'paga' ? '—' : c.valor_a_confirmar ? 'a confirmar' : moeda(c.saldo)}</span> },
    {
      id: 'situacao', titulo: 'Situação', prioridade: 'media',
      celula: (c) => (
        <span class="linha" style={{ gap: '6px' }}>
          <Situacao tom={SITUACAO_CONTA[c.situacao_painel].tom} destaque={SITUACAO_CONTA[c.situacao_painel].destaque}>{SITUACAO_CONTA[c.situacao_painel].rotulo}</Situacao>
          {c.status_despesa === 'em_revisao' && <Etiqueta tom="atencao">em revisão</Etiqueta>}
        </span>
      ),
    },
    {
      id: 'acoes', titulo: '',
      celula: (c) => (c.situacao === 'paga' || !lancar ? null : (
        <Botao tamanho="p" variante={c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje' ? 'primario' : 'secundario'} icone={<Banknote aria-hidden="true" />} onClick={() => setPagar(c)}>
          Pagar
        </Botao>
      )),
    },
  ];

  return (
    <>
      <Segmentado<Filtro>
        rotulo="Situação das contas"
        valor={filtro}
        aoMudar={setFiltro}
        opcoes={[
          { valor: 'abertas', rotulo: 'Em aberto' },
          { valor: 'vencidas', rotulo: <>Vencidas{n?.vencidas.qtd ? <span class="contador contador--perigo">{n.vencidas.qtd}</span> : null}</> },
          ...(filtro === 'hoje' ? [{ valor: 'hoje' as const, rotulo: 'Vencem hoje' }] : []),
          ...(filtro === 'proximas' ? [{ valor: 'proximas' as const, rotulo: 'Próximos 7 dias' }] : []),
          { valor: 'recorrentes', rotulo: 'Recorrentes' },
          { valor: 'pagas', rotulo: 'Pagas' },
          { valor: 'todas', rotulo: 'Todas' },
        ]}
      />
      {filtro === 'recorrentes' ? <Recorrencias lancar={lancar} /> : (
        <Cartao justo>
          <Dados consulta={lista} recurso="As contas a pagar" esqueleto={<EsqueletoTabela />}>
            {(r: ListaContas) => {
              const termo = busca.trim().toLocaleLowerCase('pt-BR');
              const linhas = termo ? r.itens.filter((c) => `${c.descricao} ${c.fornecedor ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)) : r.itens;
              return (
                <>
                  {r.itens.length > 0 && (
                    <div class="fin-totais">
                      <div><span>{plural(r.total, 'conta', 'contas')}</span><strong class="num">{moeda(r.totais.valor)}</strong></div>
                      {filtro !== 'pagas' && <div><span>Falta pagar</span><strong class="num">{moeda(r.totais.saldo)}</strong></div>}
                    </div>
                  )}
                  <Tabela
                    rotulo="Contas a pagar"
                    colunas={colunas}
                    linhas={linhas}
                    chave={(c) => c.parcela_id}
                    aoAbrir={(c) => abrirDespesa(c.despesa_id)}
                    destaque={(c) => c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje'}
                    ordemInicial={{ coluna: 'vencimento', desc: filtro === 'pagas' }}
                    vazio={termo
                      ? <Vazio compacto titulo="Nenhuma conta com essa busca">Procure pela descrição ou pelo fornecedor.</Vazio>
                      : <Vazio compacto titulo={filtro === 'vencidas' ? 'Nenhuma conta vencida' : filtro === 'hoje' ? 'Nada vence hoje' : 'Nenhuma conta aqui'}>{filtro === 'pagas' ? 'Pagamentos dos últimos meses aparecem aqui.' : 'Contas novas entram por “+ Conta a pagar”, pelas compras ou pelas recorrentes.'}</Vazio>}
                  />
                  {r.total > r.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {r.itens.length} de {r.total}.</p>}
                </>
              );
            }}
          </Dados>
        </Cartao>
      )}

      <Pagar conta={pagar} aoFechar={() => setPagar(null)} />
    </>
  );
}
