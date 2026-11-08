// Financeiro: três abas, cada uma com uma função — Movimentações (despesas, outras receitas, contas a pagar e
// pagamentos: consultar e registrar), Pendências (Revisão da Júlia e Conciliação: banco, Stone/recebíveis,
// divergências e importação de extrato) e Relatórios (resultado, despesas por categoria, evolução; fechamento e vendas
// num grupo discreto). Cadastros (categorias, fornecedores) ficam em Configurações → Financeiro. O painel executivo é a
// Visão Geral: aqui não há um segundo dashboard. Gerente e Proprietário; o que é só do Proprietário (participação,
// fechar e reabrir) segue as permissões que o backend manda.
import { useEffect, useState } from 'preact/hooks';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Abas } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import { Movimentacoes } from './Movimentacoes';
import { Pendencias } from './Pendencias';
import { Relatorios } from './Relatorios';
import { UsuarioFinanceiro, UnidadesFinanceiro } from './comum';
import '../../estilos/financeiro.css';

export type Aba = 'movimentacoes' | 'pendencias' | 'relatorios';
const ABAS: Aba[] = ['movimentacoes', 'pendencias', 'relatorios'];

/** Cadastro que saiu do Financeiro: o endereço antigo leva à seção de Configurações que o mostra agora. */
const CADASTROS = ['categorias', 'fornecedores'];
export const hrefCadastro = (c: string) => `/admin/configuracoes?secao=financeiro&cadastro=${c}`;

/**
 * Aba da URL, aceitando os endereços antigos (links salvos, sino, Estoque, a Visão Geral e o backend ainda mandam
 * alguns). Cada endereço antigo cai na aba nova que faz a mesma coisa, com o parâmetro que escolhe a parte; o que não
 * existe mais (um parâmetro de outra tela) é limpo para não confundir a tela nova.
 */
function abaDaUrl(): Aba {
  const a = lerParam('aba');
  const mudar = (extras: Record<string, string | null>) => gravarParams(extras);
  const vista = lerParam('vista');
  const relatorio = lerParam('relatorio');

  // Cadastros (antes em Relatórios e cadastros): vão para Configurações.
  const cadastro = a === 'categorias' ? 'categorias' : a === 'relatorios' && relatorio && CADASTROS.includes(relatorio) ? relatorio : null;
  if (cadastro) {
    location.replace(hrefCadastro(cadastro));
    return 'relatorios';
  }

  if (a === null || a === 'resumo') return 'movimentacoes';
  if (a === 'lancamentos') {
    // ?aba=lancamentos&revisar=1 era a Revisão; &vista=banco, o extrato.
    if (lerParam('revisar') === '1') {
      mudar({ revisar: null, vista: null });
      return 'pendencias';
    }
    if (vista === 'banco') return 'pendencias';
    mudar({ vista: null });
    return 'movimentacoes';
  }
  if (a === 'contas') {
    mudar({ tipo: 'a-pagar', vista: vista === 'recorrentes' ? 'recorrentes' : null });
    return 'movimentacoes';
  }
  if (a === 'contas-fixas' || a === 'configuracoes' || a === 'fixas') {
    mudar({ tipo: 'a-pagar', vista: 'recorrentes' });
    return 'movimentacoes';
  }
  if (a === 'revisao') {
    mudar({ vista: null });
    return 'pendencias';
  }
  if (a === 'conciliacao') {
    // Sem parte escolhida, a antiga aba Conciliação abria no Banco.
    mudar({ vista: vista === 'stone' || vista === 'divergencias' ? vista : 'banco' });
    return 'pendencias';
  }
  if (a === 'taxas') {
    mudar({ vista: 'stone' });
    return 'pendencias';
  }
  if (a === 'vendas') {
    mudar({ relatorio: 'vendas' });
    return 'relatorios';
  }
  if (a === 'resultado') {
    // A antiga aba Resultado tinha sub-vistas (resultado, categorias, evolução, fechamento): viram itens de Relatórios.
    mudar({ relatorio: vista && ['categorias', 'evolucao', 'fechamento'].includes(vista) ? (vista === 'categorias' ? 'por-categoria' : vista) : relatorio ?? 'resultado', vista: null });
    return 'relatorios';
  }
  return (ABAS as string[]).includes(a) ? (a as Aba) : 'movimentacoes';
}

export default function Financeiro({ contexto }: { contexto: ContextoPainel }) {
  // A aba e os filtros vêm da URL, que o servidor não repassa à ilha: o conteúdo só é desenhado no navegador, depois da
  // hidratação (senão o HTML do servidor divergiria do da página aberta em ?aba=pendencias).
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto ? <Conteudo contexto={contexto} /> : <Raiz><Esqueleto linhas={6} altura={32} /></Raiz>;
}

function Conteudo({ contexto }: { contexto: ContextoPainel }) {
  const [aba, setAba] = useState<Aba>(abaDaUrl);
  useEffect(() => gravarParams({ aba: aba === 'movimentacoes' ? null : aba }), [aba]);

  // Contagens nas abas, só do que está em aberto (as mesmas do sino, do mesmo backend): contas vencidas em
  // Movimentações; despesas em revisão + comprovantes pendentes em Pendências.
  const resumo = useConsulta('financeiro/resumo', () => financeiro.resumo());
  const revisar = resumo.dados ? resumo.dados.revisao.despesas + resumo.dados.revisao.documentos : null;
  const vencidas = resumo.dados ? resumo.dados.contas.vencidas.qtd : null;

  const ir = (a: Aba) => {
    gravarParams({ tipo: null, situacao: null, revisar: null, vista: null, despesa: null, mes: null, relatorio: null, filtro: null, agrupar: null });
    setAba(a);
    window.scrollTo({ top: 0 });
  };

  const abas: { id: Aba; rotulo: string; contagem?: number | null }[] = [
    { id: 'movimentacoes', rotulo: 'Movimentações', contagem: vencidas },
    { id: 'pendencias', rotulo: 'Pendências', contagem: revisar },
    { id: 'relatorios', rotulo: 'Relatórios' },
  ];

  return (
    <UsuarioFinanceiro.Provider value={contexto.usuario}>
      <UnidadesFinanceiro.Provider value={{ unidade: contexto.unidade, unidades: contexto.unidades }}>
        <Raiz>
          <Abas<Aba> atual={aba} aoMudar={ir} abas={abas} />
          <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} class="pilha" style={{ gap: '20px' }}>
            {aba === 'movimentacoes' && <Movimentacoes contexto={contexto} />}
            {aba === 'pendencias' && <Pendencias contexto={contexto} revisar={revisar} />}
            {aba === 'relatorios' && <Relatorios contexto={contexto} />}
          </div>
        </Raiz>
      </UnidadesFinanceiro.Provider>
    </UsuarioFinanceiro.Provider>
  );
}
