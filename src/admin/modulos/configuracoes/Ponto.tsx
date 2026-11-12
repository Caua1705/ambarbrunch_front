// Configurações → Ponto: as tarefas do Checklist de abertura e a Auditoria do ponto (abertura.configurar e
// auditoria.visualizar, hoje só o Proprietário; o backend confere de novo). Escolhidos por ?item=.
// Não existe mais "Tablets": desde 12/11/2026 o terminal de ponto é o Modo Operação, autenticado pela conta logada, sem
// código de tablet. Os endereços antigos (?item=tablets, /admin/equipe?aba=tablets) caem aqui.
import { useEffect, useState } from 'preact/hooks';
import type { Papel } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Segmentado } from '../../ui/base';
import { Auditoria } from '../equipe/Auditoria';
import { ModeloAbertura } from './ModeloAbertura';
import { useTecladoNaTela } from '../equipe/tablet';
import '../../estilos/equipe.css';

type Item = 'checklist' | 'auditoria';

export const vePonto = (papel: Papel) => pode(papel, 'abertura.configurar') || pode(papel, 'auditoria.visualizar');

export function ConfiguracoesPonto({ papel }: { papel: Papel }) {
  const itens: { valor: Item; rotulo: string }[] = [
    ...(pode(papel, 'abertura.configurar') ? [{ valor: 'checklist' as const, rotulo: 'Checklist de abertura' }] : []),
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
      {item === 'checklist' ? <ModeloAbertura /> : <Auditoria />}
    </div>
  );
}
