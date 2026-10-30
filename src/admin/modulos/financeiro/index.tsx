// Financeiro: exatamente sete abas, as mesmas do painel antigo do backend (app/painel/financeiro.html): Resumo, Vendas,
// Lançamentos, Contas a pagar, Revisão, Resultado e Contas fixas e taxas. A conciliação bancária (Banco, extratos) vive
// dentro de Lançamentos e o fechamento do mês dentro de Resultado — nunca como módulo próprio. Gerente e Proprietário;
// o que é só do Proprietário (participação, fechar/reabrir) segue as permissões que o backend manda.
import { useEffect, useState } from 'preact/hooks';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Abas } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import { Resumo } from './Resumo';
import { Vendas } from './Vendas';
import { Lancamentos } from './Lancamentos';
import { Contas } from './Contas';
import { Revisao } from './Revisao';
import { Resultado } from './Resultado';
import { ContasFixas } from './ContasFixas';
import { UsuarioFinanceiro } from './comum';
import '../../estilos/financeiro.css';

export type Aba = 'resumo' | 'vendas' | 'lancamentos' | 'contas' | 'revisao' | 'resultado' | 'contas-fixas';
const ABAS: Aba[] = ['resumo', 'vendas', 'lancamentos', 'contas', 'revisao', 'resultado', 'contas-fixas'];

/** Aba da URL, aceitando os endereços antigos (Visão Geral, Estoque e links salvos ainda usam alguns). */
function abaDaUrl(): Aba {
  const a = lerParam('aba');
  if (a === 'relatorios') return 'resultado';
  if (a === 'configuracoes' || a === 'fixas') return 'contas-fixas';
  if (a === 'lancamentos' && lerParam('revisar') === '1') return 'revisao';
  return a && (ABAS as string[]).includes(a) ? (a as Aba) : 'resumo';
}

export default function Financeiro({ contexto }: { contexto: ContextoPainel }) {
  // A aba e os filtros vêm da URL, que o servidor não repassa à ilha: o conteúdo só é desenhado no navegador, depois da
  // hidratação (senão o HTML do servidor, sempre no Resumo, divergiria do da página aberta em ?aba=contas).
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto ? <Conteudo contexto={contexto} /> : <Raiz><Esqueleto linhas={6} altura={32} /></Raiz>;
}

function Conteudo({ contexto }: { contexto: ContextoPainel }) {
  const [aba, setAba] = useState<Aba>(abaDaUrl);
  useEffect(() => gravarParams({ aba: aba === 'resumo' ? null : aba, revisar: null }), [aba]);

  // Contagens nas abas: o que precisa de alguém.
  const resumo = useConsulta('financeiro/resumo', () => financeiro.resumo());
  const revisar = resumo.dados ? resumo.dados.revisao.despesas + resumo.dados.revisao.documentos : null;
  const vencidas = resumo.dados ? resumo.dados.contas.vencidas.qtd + resumo.dados.contas.hoje.qtd : null;

  const ir = (a: Aba, extras: Record<string, string | null> = {}) => {
    gravarParams(extras);
    setAba(a);
    window.scrollTo({ top: 0 });
  };

  return (
    <UsuarioFinanceiro.Provider value={contexto.usuario}>
      <Raiz>
        <Abas<Aba>
          atual={aba}
          aoMudar={(a) => ir(a, { situacao: null, revisar: null, vista: null, despesa: null, mes: null })}
          abas={[
            { id: 'resumo', rotulo: 'Resumo' },
            { id: 'vendas', rotulo: 'Vendas' },
            { id: 'lancamentos', rotulo: 'Lançamentos' },
            { id: 'contas', rotulo: 'Contas a pagar', contagem: vencidas },
            { id: 'revisao', rotulo: 'Revisão', contagem: revisar },
            { id: 'resultado', rotulo: 'Resultado' },
            { id: 'contas-fixas', rotulo: 'Contas fixas e taxas' },
          ]}
        />
        <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} class="pilha" style={{ gap: '20px' }}>
          {aba === 'resumo' && <Resumo contexto={contexto} ir={ir} />}
          {aba === 'vendas' && <Vendas contexto={contexto} />}
          {aba === 'lancamentos' && <Lancamentos contexto={contexto} ir={ir} />}
          {aba === 'contas' && <Contas contexto={contexto} ir={ir} />}
          {aba === 'revisao' && <Revisao contexto={contexto} />}
          {aba === 'resultado' && <Resultado contexto={contexto} />}
          {aba === 'contas-fixas' && <ContasFixas contexto={contexto} />}
        </div>
      </Raiz>
    </UsuarioFinanceiro.Provider>
  );
}

export type IrPara = (a: Aba, extras?: Record<string, string | null>) => void;
