// Configurações → Financeiro: os cadastros administrativos do Financeiro, os MESMOS componentes de antes (Categorias e
// Fornecedores, com as rotas e permissões de sempre), escolhidos por ?cadastro=. O que é usado no dia a dia fica onde é
// usado, com atalho daqui: contas recorrentes (Contas a pagar). As ferramentas administrativas que saíram de Pendências
// (fase final) — documentos da Júlia que não viraram lançamento, Banco/extratos, Stone e recebíveis (taxas) e Acertos —
// continuam no backend e abrem por estes atalhos, só para quem tem a permissão.
import { useEffect, useState } from 'preact/hooks';
import { ChevronRight } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Cartao, Segmentado } from '../../ui/base';
import { Categorias } from '../financeiro/Categorias';
import { Fornecedores } from '../financeiro/Fornecedores';
import { ContasPagadoras } from '../financeiro/ContasPagadoras';
import { UsuarioFinanceiro, UnidadesFinanceiro, temPermissao } from '../financeiro/comum';
import '../../estilos/financeiro.css';

type Cadastro = 'categorias' | 'fornecedores' | 'contas';

type Atalho = { href: string; titulo: string; detalhe: string; permissao?: 'financeiro.conciliar' | 'financeiro.ver_societario' };
const ATALHOS: Atalho[] = [
  { href: '/admin/financeiro?aba=contas&situacao=recorrentes', titulo: 'Contas recorrentes', detalhe: 'Aluguel, internet, sistemas: ficam em Contas a pagar → Recorrentes' },
  { href: '/admin/financeiro?aba=pendencias&vista=revisao', titulo: 'Documentos da Júlia para conferir', detalhe: 'Comprovantes que não viraram lançamento (ilegível, sem data, possível duplicado)' },
  { href: '/admin/financeiro?aba=pendencias&vista=stone', titulo: 'Stone e recebíveis', detalhe: 'Vendido, líquido estimado e taxas contratadas da adquirente', permissao: 'financeiro.conciliar' },
  { href: '/admin/financeiro?aba=pendencias&vista=banco', titulo: 'Banco e extratos (opcional)', detalhe: 'Importar OFX ou CSV para conferir', permissao: 'financeiro.conciliar' },
  { href: '/admin/financeiro?aba=acertos', titulo: 'Acertos Âmbar × Roll', detalhe: 'Adiantamentos, reembolsos e compensações entre os grupos', permissao: 'financeiro.ver_societario' },
];

export function CadastrosFinanceiro({ contexto }: { contexto: ContextoPainel }) {
  const configurar = temPermissao(contexto.usuario, 'financeiro.configurar');
  const [cadastro, setCadastro] = useState<Cadastro>(() => { const c = lerParam('cadastro'); return c === 'fornecedores' || (c === 'contas' && configurar) ? c : 'categorias'; });
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
            opcoes={[{ valor: 'categorias', rotulo: 'Categorias' }, { valor: 'fornecedores', rotulo: 'Fornecedores' }, ...(configurar ? [{ valor: 'contas' as const, rotulo: 'Contas e pagadores' }] : [])]}
          />
          {cadastro === 'categorias' ? <Categorias contexto={contexto} /> : cadastro === 'contas' ? <ContasPagadoras /> : <Fornecedores lancar={lancar} />}
          <Cartao titulo="Ferramentas do Financeiro" descricao="O que fica fora das três abas, para conferências e administração" justo>
            <ul class="lista">
              {ATALHOS.filter((l) => !l.permissao || temPermissao(contexto.usuario, l.permissao)).map((l) => (
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
