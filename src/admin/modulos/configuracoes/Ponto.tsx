// Configurações → Ponto: Tablets autorizados e Auditoria do ponto, os MESMOS componentes que eram abas da Equipe, com as
// mesmas rotas e permissões (ponto.dispositivos e auditoria.visualizar, hoje só o Proprietário; o backend confere de novo).
// Escolhidos por ?item=. Os endereços antigos /admin/equipe?aba=tablets|auditoria trazem para cá.
import { useEffect, useState } from 'preact/hooks';
import type { Papel } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Segmentado } from '../../ui/base';
import { Tablets } from '../equipe/Tablets';
import { Auditoria } from '../equipe/Auditoria';
import { useTecladoNaTela } from '../equipe/tablet';
import '../../estilos/equipe.css';

type Item = 'tablets' | 'auditoria';

export const vePonto = (papel: Papel) => pode(papel, 'ponto.dispositivos') || pode(papel, 'auditoria.visualizar');

export function ConfiguracoesPonto({ papel }: { papel: Papel }) {
  const itens: { valor: Item; rotulo: string }[] = [
    ...(pode(papel, 'ponto.dispositivos') ? [{ valor: 'tablets' as const, rotulo: 'Tablets' }] : []),
    ...(pode(papel, 'auditoria.visualizar') ? [{ valor: 'auditoria' as const, rotulo: 'Auditoria' }] : []),
  ];
  const [item, setItem] = useState<Item>(() => {
    const lido = lerParam('item');
    return itens.some((i) => i.valor === lido) ? (lido as Item) : itens[0].valor;
  });
  useEffect(() => gravarParams({ item: item === itens[0].valor ? null : item }), [item]);
  useTecladoNaTela();

  return (
    <div class="pilha">
      {itens.length > 1 && <Segmentado<Item> rotulo="Ponto" valor={item} aoMudar={setItem} opcoes={itens} />}
      {item === 'tablets' ? <Tablets /> : <Auditoria />}
    </div>
  );
}
