// Contas a pagar: o que vence, o que venceu, o que foi pago. As contas fixas (recorrências) têm a aba própria.
// Previsto (conta fixa) × devido (a conta do mês) × pago × saldo nunca se misturam. Conta de valor variável paga com o
// valor real, sem mudar a conta fixa. Rotas: GET /contas-a-pagar, POST /parcelas/{id}/pagamentos.
import { useEffect, useState } from 'preact/hooks';
import { Banknote, Repeat, ChevronRight } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { moeda, dataCurta, num, hojeISO, inicioMes, somarMeses, plural } from '../../lib/formato';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConfirmacao } from '../../ui/camadas';
import { Botao, Cabecalho, Cartao, Segmentado, Situacao, Etiqueta } from '../../ui/base';
import { Dados, EsqueletoTabela, Vazio } from '../../ui/estados';
import { Tabela, type Coluna } from '../../ui/tabela';
import type { ContaPagar, ListaContas } from '../../lib/tipos/financeiro';
import { SITUACAO_CONTA, useNomeCategoria, temPermissao } from './comum';
import { Pagar, type ContaParaPagar } from './Pagar';
import { DetalheDespesa } from './DetalheDespesa';
import type { IrPara } from './index';

type Filtro = 'vencidas' | 'hoje' | 'proximas' | 'abertas' | 'pagas' | 'todas';
const FILTROS: Filtro[] = ['vencidas', 'hoje', 'proximas', 'abertas', 'pagas', 'todas'];

export function Contas({ contexto, ir }: { contexto: ContextoPainel; ir: IrPara }) {
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const inicial = lerParam('situacao') as Filtro | null;
  const [filtro, setFiltro] = useState<Filtro>(inicial && FILTROS.includes(inicial) ? inicial : 'abertas');
  const [pagar, setPagar] = useState<ContaParaPagar | null>(null);
  const [despesa, setDespesa] = useState<string | null>(null);
  const { confirmar, elemento: dialogo } = useConfirmacao();
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
      <Cabecalho titulo="Contas a pagar" descricao="Contas lançadas, parcelas de compras e contas fixas do mês" />
      <Segmentado<Filtro>
        rotulo="Situação das contas"
        valor={filtro}
        aoMudar={setFiltro}
        opcoes={[
          { valor: 'vencidas', rotulo: `Vencidas${n?.vencidas.qtd ? ` (${n.vencidas.qtd})` : ''}` },
          { valor: 'hoje', rotulo: `Vencem hoje${n?.hoje.qtd ? ` (${n.hoje.qtd})` : ''}` },
          { valor: 'proximas', rotulo: `Próximos 7 dias${n?.proximas.qtd ? ` (${n.proximas.qtd})` : ''}` },
          { valor: 'abertas', rotulo: 'Todas em aberto' },
          { valor: 'pagas', rotulo: 'Pagas' },
          { valor: 'todas', rotulo: 'Todas' },
        ]}
      />
      <Cartao justo>
        <Dados consulta={lista} recurso="As contas a pagar" esqueleto={<EsqueletoTabela />}>
          {(r: ListaContas) => (
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
                linhas={r.itens}
                chave={(c) => c.parcela_id}
                aoAbrir={(c) => setDespesa(c.despesa_id)}
                destaque={(c) => c.situacao_painel === 'vencida' || c.situacao_painel === 'vence_hoje'}
                ordemInicial={{ coluna: 'vencimento', desc: filtro === 'pagas' }}
                vazio={<Vazio compacto titulo={filtro === 'vencidas' ? 'Nenhuma conta vencida' : filtro === 'hoje' ? 'Nada vence hoje' : 'Nenhuma conta aqui'}>{filtro === 'pagas' ? 'Pagamentos dos últimos meses aparecem aqui.' : 'Contas novas entram por “Nova despesa”, pelas compras ou pelas contas fixas.'}</Vazio>}
              />
              {r.total > r.itens.length && <p class="fraco" style={{ padding: '10px 20px' }}>Mostrando {r.itens.length} de {r.total}.</p>}
            </>
          )}
        </Dados>
      </Cartao>

      <button class="aviso aviso--info fin-faixa" onClick={() => ir('contas-fixas')}>
        <Repeat aria-hidden="true" />
        <span style={{ flex: 1, textAlign: 'left' }}><strong>Contas fixas</strong> <span class="suave">— aluguel, internet, folha: cadastre uma vez e a conta de cada mês aparece aqui.</span></span>
        <span class="btn btn--p btn--fantasma">Contas fixas e taxas <ChevronRight aria-hidden="true" /></span>
      </button>

      <Pagar conta={pagar} aoFechar={() => setPagar(null)} />
      <DetalheDespesa id={despesa} aoFechar={() => setDespesa(null)} confirmar={confirmar} />
      {dialogo}
    </>
  );
}
