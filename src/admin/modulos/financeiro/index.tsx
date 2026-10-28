// Financeiro: exatamente quatro abas (Resumo, Lançamentos, Contas a pagar, Relatórios). A conciliação bancária vive
// dentro de Lançamentos (Banco) e do Fechamento (Relatórios) — nunca como módulo próprio. Gerente e admin.
import { useEffect, useState } from 'preact/hooks';
import type { ContextoPainel } from '../../lib/sessao';
import { useConsulta } from '../../lib/consulta';
import { financeiro } from '../../lib/api/financeiro';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Raiz } from '../../ui/camadas';
import { Abas } from '../../ui/base';
import { Esqueleto } from '../../ui/estados';
import { Resumo } from './Resumo';
import { Lancamentos } from './Lancamentos';
import { Contas } from './Contas';
import { Relatorios } from './Relatorios';
import '../../estilos/financeiro.css';

type Aba = 'resumo' | 'lancamentos' | 'contas' | 'relatorios';
const ABAS: Aba[] = ['resumo', 'lancamentos', 'contas', 'relatorios'];

export default function Financeiro({ contexto }: { contexto: ContextoPainel }) {
  // A aba e os filtros vêm da URL, que o servidor não repassa à ilha: o conteúdo só é desenhado no navegador, depois da
  // hidratação (senão o HTML do servidor, sempre no Resumo, divergiria do da página aberta em ?aba=contas).
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto ? <Conteudo contexto={contexto} /> : <Raiz><Esqueleto linhas={6} altura={32} /></Raiz>;
}

function Conteudo({ contexto }: { contexto: ContextoPainel }) {
  const inicial = lerParam('aba') as Aba | null;
  const [aba, setAba] = useState<Aba>(inicial && ABAS.includes(inicial) ? inicial : 'resumo');
  useEffect(() => gravarParams({ aba: aba === 'resumo' ? null : aba }), [aba]);

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
    <Raiz>
      <Abas<Aba>
        atual={aba}
        aoMudar={(a) => ir(a, { situacao: null, revisar: null, vista: null })}
        abas={[
          { id: 'resumo', rotulo: 'Resumo' },
          { id: 'lancamentos', rotulo: 'Lançamentos', contagem: revisar },
          { id: 'contas', rotulo: 'Contas a pagar', contagem: vencidas },
          { id: 'relatorios', rotulo: 'Relatórios' },
        ]}
      />
      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} class="pilha" style={{ gap: '20px' }}>
        {aba === 'resumo' && <Resumo contexto={contexto} ir={ir} />}
        {aba === 'lancamentos' && <Lancamentos contexto={contexto} />}
        {aba === 'contas' && <Contas contexto={contexto} />}
        {aba === 'relatorios' && <Relatorios contexto={contexto} />}
      </div>
    </Raiz>
  );
}

export type IrPara = (a: Aba, extras?: Record<string, string | null>) => void;
