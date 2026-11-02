// Financeiro: cinco áreas, cada uma com uma função — Lançamentos (consultar e registrar), Contas a pagar (obrigações e
// recorrentes), Revisão (o que a Júlia não resolveu e o que falta classificar), Conciliação (banco, Stone/recebíveis e
// divergências) e Relatórios e cadastros (resultado, vendas, categorias, fornecedores). O painel executivo é a Visão
// Geral: aqui não há um segundo dashboard. Gerente e Proprietário; o que é só do Proprietário (participação, fechar e
// reabrir) segue as permissões que o backend manda.
import { useEffect, useState } from 'preact/hooks';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Abas } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import { Lancamentos } from './Lancamentos';
import { Contas } from './Contas';
import { Revisao } from './Revisao';
import { Conciliacao } from './Conciliacao';
import { Relatorios } from './Relatorios';
import { UsuarioFinanceiro, UnidadesFinanceiro, temPermissao } from './comum';
import '../../estilos/financeiro.css';

export type Aba = 'lancamentos' | 'contas' | 'revisao' | 'conciliacao' | 'relatorios';
const ABAS: Aba[] = ['lancamentos', 'contas', 'revisao', 'conciliacao', 'relatorios'];

/**
 * Aba da URL, aceitando os endereços antigos (links salvos, sino, Estoque e o backend ainda mandam alguns). Cada endereço
 * antigo cai na tela nova que faz a mesma coisa, com o parâmetro que escolhe a sub-tela.
 */
function abaDaUrl(): Aba {
  const a = lerParam('aba');
  const mudar = (extras: Record<string, string | null>) => gravarParams(extras);
  if (a === 'resumo' || a === null) return 'lancamentos';
  if (a === 'lancamentos' && lerParam('revisar') === '1') {
    mudar({ revisar: null });
    return 'revisao';
  }
  if (a === 'lancamentos' && lerParam('vista') === 'banco') {
    mudar({ vista: 'banco' });
    return 'conciliacao';
  }
  if (a === 'vendas') {
    mudar({ relatorio: 'vendas' });
    return 'relatorios';
  }
  if (a === 'resultado') {
    // A antiga aba Resultado tinha sub-vistas (resultado, categorias, evolução, fechamento): viram itens de Relatórios.
    const vista = lerParam('vista');
    mudar({ relatorio: vista && ['categorias', 'evolucao', 'fechamento'].includes(vista) ? (vista === 'categorias' ? 'por-categoria' : vista) : lerParam('relatorio') ?? 'resultado', vista: null });
    return 'relatorios';
  }
  if (a === 'categorias') {
    mudar({ relatorio: 'categorias' });
    return 'relatorios';
  }
  if (a === 'contas-fixas' || a === 'configuracoes' || a === 'fixas') {
    mudar({ vista: 'recorrentes' });
    return 'contas';
  }
  if (a === 'taxas') {
    mudar({ vista: 'stone' });
    return 'conciliacao';
  }
  return (ABAS as string[]).includes(a) ? (a as Aba) : 'lancamentos';
}

export default function Financeiro({ contexto }: { contexto: ContextoPainel }) {
  // A aba e os filtros vêm da URL, que o servidor não repassa à ilha: o conteúdo só é desenhado no navegador, depois da
  // hidratação (senão o HTML do servidor divergiria do da página aberta em ?aba=contas).
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto ? <Conteudo contexto={contexto} /> : <Raiz><Esqueleto linhas={6} altura={32} /></Raiz>;
}

function Conteudo({ contexto }: { contexto: ContextoPainel }) {
  const [aba, setAba] = useState<Aba>(abaDaUrl);
  useEffect(() => gravarParams({ aba: aba === 'lancamentos' ? null : aba }), [aba]);
  const conciliar = temPermissao(contexto.usuario, 'financeiro.conciliar');

  // Contagens nas abas, só do que precisa de alguém (as mesmas do sino, do mesmo backend).
  const resumo = useConsulta('financeiro/resumo', () => financeiro.resumo());
  const revisar = resumo.dados ? resumo.dados.revisao.despesas + resumo.dados.revisao.documentos : null;
  const vencidas = resumo.dados ? resumo.dados.contas.vencidas.qtd : null;

  const ir = (a: Aba, extras: Record<string, string | null> = {}) => {
    gravarParams(extras);
    setAba(a);
    window.scrollTo({ top: 0 });
  };

  const abas: { id: Aba; rotulo: string; contagem?: number | null }[] = [
    { id: 'lancamentos', rotulo: 'Lançamentos' },
    { id: 'contas', rotulo: 'Contas a pagar', contagem: vencidas },
    { id: 'revisao', rotulo: 'Revisão', contagem: revisar },
    ...(conciliar ? [{ id: 'conciliacao' as const, rotulo: 'Conciliação' }] : []),
    { id: 'relatorios', rotulo: 'Relatórios e cadastros' },
  ];

  return (
    <UsuarioFinanceiro.Provider value={contexto.usuario}>
      <UnidadesFinanceiro.Provider value={{ unidade: contexto.unidade, unidades: contexto.unidades }}>
        <Raiz>
          <Abas<Aba> atual={aba} aoMudar={(a) => ir(a, { situacao: null, revisar: null, vista: null, despesa: null, mes: null, relatorio: null, filtro: null })} abas={abas} />
          <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} class="pilha" style={{ gap: '20px' }}>
            {aba === 'lancamentos' && <Lancamentos contexto={contexto} ir={ir} />}
            {aba === 'contas' && <Contas contexto={contexto} />}
            {aba === 'revisao' && <Revisao contexto={contexto} />}
            {aba === 'conciliacao' && conciliar && <Conciliacao contexto={contexto} />}
            {aba === 'relatorios' && <Relatorios contexto={contexto} />}
          </div>
        </Raiz>
      </UnidadesFinanceiro.Provider>
    </UsuarioFinanceiro.Provider>
  );
}

export type IrPara = (a: Aba, extras?: Record<string, string | null>) => void;
