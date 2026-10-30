// Clientes — rotas reais /admin/clientes* (publicadas em produção). Leitura: clientes.visualizar; correção: clientes.editar.
import { pedir } from './cliente';
import type { ClienteAlteracao, ClienteDetalhe, ClientePainel, ListaClientes } from '../tipos/clientes';

export const POR_PAGINA_CLIENTES = 50;

export const clientes = {
  /** Busca por nome, e-mail ou dígitos do telefone (4+); ordem: próxima reserva, depois a última. */
  listar: (q: { busca?: string; limite?: number; deslocamento?: number }) => pedir<ListaClientes>('clientes', { query: { limite: POR_PAGINA_CLIENTES, ...q } }),
  obter: (id: string) => pedir<ClienteDetalhe>(`clientes/${id}`),
  /** Telefone ou e-mail verificados pelo cliente não se trocam aqui (422 do backend). */
  alterar: (id: string, a: ClienteAlteracao) => pedir<ClientePainel>(`clientes/${id}`, { metodo: 'PATCH', corpo: a }),
};
