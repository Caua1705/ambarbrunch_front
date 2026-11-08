// Relatórios: os relatórios gerenciais do Financeiro, numa lista ao lado (sem sub-abas dentro de abas). Primeiro os três
// de uso diário — Resultado do mês (DRE gerencial, participação da Roll para o Proprietário), Despesas por categoria e
// Evolução —; depois, num grupo discreto, Fechamento do mês e Vendas (Eyemobile). Os cadastros (Categorias,
// Fornecedores) moram em Configurações → Financeiro; contas fixas em Movimentações → A pagar; taxas da adquirente em
// Pendências → Stone e recebíveis, onde são usadas. ?relatorio= antigo de cadastro é levado a Configurações (index.tsx).
import { useEffect, useState } from 'preact/hooks';
import { FileBarChart, PieChart, TrendingUp, CalendarCheck2, ShoppingBag } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Resultado, type VistaResultado } from './Resultado';
import { Vendas } from './Vendas';

type Item = VistaResultado | 'vendas';
const GRUPOS: { titulo: string; discreto?: boolean; itens: { id: Item; rotulo: string; icone: typeof FileBarChart }[] }[] = [
  {
    titulo: 'Principais',
    itens: [
      { id: 'resultado', rotulo: 'Resultado do mês', icone: FileBarChart },
      { id: 'por-categoria', rotulo: 'Despesas por categoria', icone: PieChart },
      { id: 'evolucao', rotulo: 'Evolução financeira', icone: TrendingUp },
    ],
  },
  {
    titulo: 'Mais relatórios',
    discreto: true,
    itens: [
      { id: 'fechamento', rotulo: 'Fechamento do mês', icone: CalendarCheck2 },
      { id: 'vendas', rotulo: 'Vendas (Eyemobile)', icone: ShoppingBag },
    ],
  },
];
const TODOS = GRUPOS.flatMap((g) => g.itens.map((i) => i.id));
const lerItem = (v: string | null): Item => (v && (TODOS as string[]).includes(v) ? (v as Item) : 'resultado');

export function Relatorios({ contexto }: { contexto: ContextoPainel }) {
  const [item, setItem] = useState<Item>(() => lerItem(lerParam('relatorio')));
  useEffect(() => gravarParams({ relatorio: item === 'resultado' ? null : item }), [item]);
  const atual = GRUPOS.flatMap((g) => g.itens).find((i) => i.id === item)!;

  return (
    <div class="sub-navegacao">
      <nav class="sub-navegacao__menu" aria-label="Relatórios">
        {GRUPOS.map((g, n) => (
          <div key={g.titulo} class={`sub-navegacao__grupo${g.discreto ? ' sub-navegacao__grupo--discreto' : ''}`}>
            <span class="sub-navegacao__titulo" id={`relatorios-grupo-${n}`}>{g.titulo}</span>
            <ul aria-labelledby={`relatorios-grupo-${n}`}>
              {g.itens.map((i) => (
                <li key={i.id}>
                  <button type="button" aria-current={i.id === item ? 'page' : undefined} onClick={() => { gravarParams({ mes: null, agrupar: null }); setItem(i.id); }}>
                    <i.icone aria-hidden="true" />
                    {i.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <section class="sub-navegacao__conteudo pilha" aria-labelledby="relatorio-titulo">
        <h2 class="sub-navegacao__h2" id="relatorio-titulo">{atual.rotulo}</h2>
        {item === 'vendas' ? <Vendas contexto={contexto} /> : <Resultado contexto={contexto} vista={item} />}
      </section>
    </div>
  );
}
