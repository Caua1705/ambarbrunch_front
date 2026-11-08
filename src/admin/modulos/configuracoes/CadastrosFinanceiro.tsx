// Configurações → Financeiro: os cadastros administrativos do Financeiro, os MESMOS componentes de antes (Categorias e
// Fornecedores, com as rotas e permissões de sempre), escolhidos por ?cadastro=. O que é usado no dia a dia fica onde é
// usado, com atalho daqui: contas fixas (Movimentações → A pagar), taxas da adquirente (Pendências → Stone e
// recebíveis) e contas bancárias (Pendências → Banco, onde a importação de extrato cadastra a conta).
import { useEffect, useState } from 'preact/hooks';
import { ChevronRight } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Cartao, Segmentado } from '../../ui/base';
import { Categorias } from '../financeiro/Categorias';
import { Fornecedores } from '../financeiro/Fornecedores';
import { UsuarioFinanceiro, UnidadesFinanceiro, temPermissao } from '../financeiro/comum';
import '../../estilos/financeiro.css';

type Cadastro = 'categorias' | 'fornecedores';

const ATALHOS = [
  { href: '/admin/financeiro?tipo=a-pagar&vista=recorrentes', titulo: 'Contas fixas (recorrentes)', detalhe: 'Aluguel, internet, folha: ficam em Movimentações → A pagar' },
  { href: '/admin/financeiro?aba=pendencias&vista=stone', titulo: 'Taxas contratadas da adquirente', detalhe: 'Crédito, débito e Pix, com vigência: em Pendências → Stone e recebíveis' },
  { href: '/admin/financeiro?aba=pendencias&vista=banco', titulo: 'Contas bancárias e extratos', detalhe: 'Cadastrar a conta e importar o extrato: em Pendências → Banco' },
];

export function CadastrosFinanceiro({ contexto }: { contexto: ContextoPainel }) {
  const [cadastro, setCadastro] = useState<Cadastro>(() => (lerParam('cadastro') === 'fornecedores' ? 'fornecedores' : 'categorias'));
  useEffect(() => gravarParams({ cadastro: cadastro === 'categorias' ? null : cadastro }), [cadastro]);
  const lancar = temPermissao(contexto.usuario, 'financeiro.lancar');

  return (
    <UsuarioFinanceiro.Provider value={contexto.usuario}>
      <UnidadesFinanceiro.Provider value={{ unidade: contexto.unidade, unidades: contexto.unidades }}>
        <div class="config-cadastros">
          <Segmentado<Cadastro>
            rotulo="Cadastros do Financeiro"
            valor={cadastro}
            aoMudar={setCadastro}
            opcoes={[{ valor: 'categorias', rotulo: 'Categorias' }, { valor: 'fornecedores', rotulo: 'Fornecedores' }]}
          />
          {cadastro === 'categorias' ? <Categorias contexto={contexto} /> : <Fornecedores lancar={lancar} />}
          <Cartao titulo="No Financeiro" descricao="Cadastros usados no dia a dia, que ficam onde são usados" justo>
            <ul class="lista">
              {ATALHOS.map((l) => (
                <li key={l.href}>
                  <a class="lista__item" href={l.href}>
                    <span class="lista__texto"><strong>{l.titulo}</strong><span>{l.detalhe}</span></span>
                    <span class="lista__fim"><ChevronRight aria-hidden="true" /></span>
                  </a>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>
      </UnidadesFinanceiro.Provider>
    </UsuarioFinanceiro.Provider>
  );
}
