// Contas a pagar (Movimentações → A pagar): o que tenho que pagar, quanto, quando vence, o que atrasou e o que já foi
// pago. As contas fixas (recorrências) abrem pelo botão "Contas fixas" (?vista=recorrentes): conta prevista não é
// pagamento feito, e nada aqui cria conta sozinho. A busca e o detalhe da despesa vêm de Movimentações.
// Previsto (conta fixa) × devido (a conta do mês) × pago × saldo nunca se misturam. Conta de valor variável paga com o
// valor real, sem mudar a conta fixa. Rotas: GET /contas-a-pagar, POST /parcelas/{id}/pagamentos.
import { useEffect, useState } from 'preact/hooks';
import { Banknote, Repeat, ArrowLeft } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, num, hojeISO, inicioMes, somarMeses, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Botao, Cartao, Segmentado, Situacao, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { ContaPagar, ListaContas } from '../../lib/tipos/financeiro';
import { SITUACAO_CONTA, useNomeCategoria, temPermissao } from './comum';
import { Pagar, type ContaParaPagar } from './Pagar';
import { Recorrencias } from './ContasFixas';

type Filtro = 'vencidas' | 'hoje' | 'proximas' | 'abertas' | 'pagas' | 'todas';
const FILTROS: Filtro[] = ['vencidas', 'hoje', 'proximas', 'abertas', 'pagas', 'todas'];

interface PropsContas {
  contexto: ContextoPainel;
  /** Busca da barra de Movimentações (descrição ou fornecedor), aplicada às contas carregadas. */
  busca: string;
  abrirDespesa: (id: string) => void;
}

export function Contas({ contexto, busca, abrirDespesa }: PropsContas) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const [vista, setVista] = useState<'contas' | 'recorrentes'>(lerParam('vista') === 'recorrentes' ? 'recorrentes' : 'contas');
  useEffect(() => gravarParams({ vista: vista === 'recorrentes' ? 'recorrentes' : null }), [vista]);
  if (vista === 'recorrentes') {
    return (
      <>
        <div class="barra-ferramentas">
          <Botao tamanho="p" variante="fantasma" icone={<ArrowLeft aria-hidden="true" />} onClick={() => setVista('contas')}>Voltar às contas a pagar</Botao>
        </div>
        <Recorrencias lancar={lancar} />
      </>
    );
  }
  return <ListaContasPagar contexto={contexto} busca={busca} abrirDespesa={abrirDespesa} aoVerRecorrentes={() => setVista('recorrentes')} />;
}

function ListaContasPagar({ contexto, busca, abrirDespesa, aoVerRecorrentes }: PropsContas & { aoVerRecorrentes: () => void }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const inicial = lerParam('situacao') as Filtro | null;
  const [filtro, setFiltro] = useState<Filtro>(inicial && FILTROS.includes(inicial) ? inicial : 'abertas');
  const [pagar, setPagar] = useState<ContaParaPagar | null>(null);
  const nome = useNomeCategoria();
  useEffect(() => gravarParams({ situacao: filtro === 'abertas' ? null : filtro }), [filtro]);

  // Pagas e todas: dos últimos meses (a lista completa não cabe numa tela).
  const q = filtro === 'pagas' || filtro === 'todas' ? { situacao: filtro, de: somarMeses(inicioMes(hojeISO()), -2) } : { situacao: filtro };
  const lista = useConsulta(`financeiro/contas:${JSON.stringify(q)}`, () => financeiro.contas(q));
  const resumo = useConsulta('financeiro/resumo', () => financeiro.resumo());
  const n = resumo.dados?.contas;

  const colunas: Coluna<ContaPagar>[] = [
    { id: 'vencimento', titulo: 'Vencimento', prioridade: 'media', ordenar: (c) => c.vencimento, largura: '108px', celula: (c) => <span class="num" style={{ whiteSpace: 'nowrap' }}>{dataCurta(c.vencimento)}</span> },
    {
      id: 'descricao', titulo: 'Conta', ordenar: (c) => c.descricao,
      celula: (c) => (
        <>
          <span class="principal-celula">{c.descricao}{c.numero > 1 || c.compra_id ? <span class="fraco"> · {c.numero}ª</span> : null}</span>
          <span class="sub">
            <span class="fin-so-celular"><strong style={{ color: c.situacao_painel === 'vencida' ? 'var(--perigo)' : undefined }}>{SITUACAO_CONTA[c.situacao_painel].rotulo}</strong> · {dataCurta(c.vencimento)} · </span>
            {[c.fornecedor, nome(c.categoria)].filter(Boolean).join(' · ')}
            {c.recorrencia_id && ' · Conta fixa'}
          </span>
        </>
      ),
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
      <div class="barra-ferramentas">
        <Segmentado<Filtro>
          rotulo="Situação das contas"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: 'abertas', rotulo: 'Em aberto' },
            { valor: 'vencidas', rotulo: <>Vencidas{n?.vencidas.qtd ? <span class="contador contador--perigo">{n.vencidas.qtd}</span> : null}</> },
            ...(filtro === 'hoje' || n?.hoje.qtd ? [{ valor: 'hoje' as const, rotulo: <>Vencem hoje{n?.hoje.qtd ? <span class="contador contador--atencao">{n.hoje.qtd}</span> : null}</> }] : []),
            { valor: 'proximas', rotulo: 'Próximos 7 dias' },
            { valor: 'pagas', rotulo: 'Pagas' },
            { valor: 'todas', rotulo: 'Todas' },
          ]}
        />
        <div class="barra-ferramentas__acoes">
          <Botao tamanho="p" variante="fantasma" icone={<Repeat aria-hidden="true" />} onClick={aoVerRecorrentes}>Contas fixas</Botao>
        </div>
      </div>
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
                  : <Vazio compacto titulo={filtro === 'vencidas' ? 'Nenhuma conta vencida' : filtro === 'hoje' ? 'Nada vence hoje' : 'Nenhuma conta aqui'}>{filtro === 'pagas' ? 'Pagamentos dos últimos meses aparecem aqui.' : 'Contas novas entram por “Nova despesa”, pelas compras ou pelas contas fixas.'}</Vazio>}
              />
              {r.total > r.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {r.itens.length} de {r.total}.</p>}
            </>
            );
          }}
        </Dados>
      </Cartao>

      <Pagar conta={pagar} aoFechar={() => setPagar(null)} />
    </>
  );
}
