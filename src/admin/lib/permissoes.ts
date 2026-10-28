// Permissões do painel: ESPELHO das regras do backend (que é quem decide — toda rota confere o papel e devolve 403).
// O painel só usa isto para não mostrar o que a pessoa não pode usar. Papéis reais do backend: admin, gerente, operador
// (CONTRATO-PAINEL-ADMIN.md §2; H7 em CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md §1). Não existe papel "sócio" no backend.
import type { Papel } from './sessao';

export type Modulo = 'visao-geral' | 'reservas' | 'atendimento' | 'clube' | 'financeiro' | 'estoque';

const TODOS: Papel[] = ['admin', 'gerente', 'operador'];
const GERENCIA: Papel[] = ['admin', 'gerente'];
const ADMIN: Papel[] = ['admin'];

const MODULOS: Record<Modulo, Papel[]> = {
  'visao-geral': TODOS,
  reservas: TODOS,
  atendimento: TODOS,
  clube: TODOS,
  // Financeiro: gerente e admin (o operador só lê categorias e fornecedores, para conferir compras).
  financeiro: GERENCIA,
  estoque: TODOS,
};

const ACOES = {
  'reservas.configurar': GERENCIA,
  'clientes.editar': GERENCIA,
  'clube.suspender': GERENCIA,
  'clube.revogar_sessoes': GERENCIA,
  'clube.confirmar_telefone': GERENCIA,
  'clube.reativar': ADMIN,
  'financeiro.ver': GERENCIA,
  'financeiro.conciliar_mes': GERENCIA,
  'financeiro.reabrir_mes': ADMIN,
  'financeiro.fechar_apuracao': ADMIN,
  'financeiro.configurar': GERENCIA,
  'visao.financeiro': GERENCIA,
  'visao.radar': GERENCIA,
  'estoque.catalogo': GERENCIA,
  'estoque.fichas': GERENCIA,
  'estoque.analises_custo': GERENCIA,
  'estoque.cancelar_compra': GERENCIA,
  'estoque.estornar_producao': GERENCIA,
  'julia.monitoramento': GERENCIA,
} satisfies Record<string, Papel[]>;

export type Acao = keyof typeof ACOES;

export const podeVer = (papel: Papel, modulo: Modulo) => MODULOS[modulo].includes(papel);
export const pode = (papel: Papel, acao: Acao) => (ACOES[acao] as Papel[]).includes(papel);
