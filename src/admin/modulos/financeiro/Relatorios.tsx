// Relatórios e cadastros: o acesso secundário do Financeiro, num nível só (lista ao lado, sem sub-abas dentro de abas).
// Relatórios: Resultado do mês (DRE gerencial, participação da Roll para o Proprietário), Despesas por categoria,
// Evolução, Fechamento do mês e Vendas (Eyemobile). Cadastros: Categorias e Fornecedores. Taxas da adquirente: em
// Conciliação → Stone e recebíveis, onde são usadas.
import { useEffect, useState } from 'preact/hooks';
import { FileBarChart, PieChart, TrendingUp, CalendarCheck2, ShoppingBag, Tags, Truck } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Resultado, type VistaResultado } from './Resultado';
import { Vendas } from './Vendas';
import { Categorias } from './Categorias';
import { Fornecedores } from './Fornecedores';
import { temPermissao } from './comum';

type Item = VistaResultado | 'vendas' | 'categorias' | 'fornecedores';
const GRUPOS: { titulo: string; itens: { id: Item; rotulo: string; icone: typeof FileBarChart }[] }[] = [
  {
    titulo: 'Relatórios',
    itens: [
      { id: 'resultado', rotulo: 'Resultado do mês', icone: FileBarChart },
      { id: 'por-categoria', rotulo: 'Despesas por categoria', icone: PieChart },
      { id: 'evolucao', rotulo: 'Evolução', icone: TrendingUp },
      { id: 'fechamento', rotulo: 'Fechamento do mês', icone: CalendarCheck2 },
      { id: 'vendas', rotulo: 'Vendas (Eyemobile)', icone: ShoppingBag },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { id: 'categorias', rotulo: 'Categorias', icone: Tags },
      { id: 'fornecedores', rotulo: 'Fornecedores', icone: Truck },
    ],
  },
];
const TODOS = GRUPOS.flatMap((g) => g.itens.map((i) => i.id));
const lerItem = (v: string | null): Item => (v && (TODOS as string[]).includes(v) ? (v as Item) : 'resultado');

export function Relatorios({ contexto }: { contexto: ContextoPainel }) {
  const [item, setItem] = useState<Item>(() => lerItem(lerParam('relatorio')));
  useEffect(() => gravarParams({ relatorio: item === 'resultado' ? null : item }), [item]);
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');
  const atual = GRUPOS.flatMap((g) => g.itens).find((i) => i.id === item)!;

  return (
    <div class="sub-navegacao">
      <nav class="sub-navegacao__menu" aria-label="Relatórios e cadastros">
        {GRUPOS.map((g) => (
          <div key={g.titulo} class="sub-navegacao__grupo">
            <span class="sub-navegacao__titulo" id={`grupo-${g.titulo}`}>{g.titulo}</span>
            <ul aria-labelledby={`grupo-${g.titulo}`}>
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
        {(item === 'resultado' || item === 'por-categoria' || item === 'evolucao' || item === 'fechamento') && <Resultado contexto={contexto} vista={item} />}
        {item === 'vendas' && <Vendas contexto={contexto} />}
        {item === 'categorias' && <Categorias contexto={contexto} />}
        {item === 'fornecedores' && <Fornecedores lancar={lancar} />}
      </section>
    </div>
  );
}
