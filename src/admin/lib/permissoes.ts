// Permissões do painel: ESPELHO da matriz do backend (app/modulos/usuarios/permissoes.py — quem decide: toda rota
// confere e devolve 403). O painel só usa isto para não mostrar o que a pessoa não pode usar.
// Três perfis: Proprietário (admin), Gerente (gerente), Atendente (operador). Docs: PERFIS-E-PERMISSOES.md no backend.
import type { Papel } from './sessao';

export type Modulo = 'visao-geral' | 'reservas' | 'atendimento' | 'clube' | 'financeiro' | 'estoque';
// Clientes não é módulo próprio de liberação: acompanha Reservas (mesmo cadastro de quem reserva).
export type Area = Modulo | 'clientes' | 'configuracoes';

const TODOS: Papel[] = ['admin', 'gerente', 'operador'];
const GERENCIA: Papel[] = ['admin', 'gerente'];
const ADMIN: Papel[] = ['admin'];

// O Atendente vê só Reservas e Atendimento (e entra direto em Reservas).
const MODULOS: Record<Area, Papel[]> = {
  'visao-geral': GERENCIA,
  reservas: TODOS,
  clientes: GERENCIA,
  atendimento: TODOS,
  clube: GERENCIA,
  financeiro: GERENCIA,
  estoque: GERENCIA,
  configuracoes: GERENCIA,
};

const ACOES = {
  // Reservas: o Atendente consulta a agenda (sem contato do cliente) e registra a chegada no dia.
  'reservas.criar': GERENCIA,
  'reservas.alterar': GERENCIA,
  'reservas.mudar_status': GERENCIA,
  'reservas.registrar_chegada': TODOS,
  'reservas.ver_contato': GERENCIA,
  // Capacidade, política e grade semanal: regra da casa (Proprietário).
  'reservas.configurar': ADMIN,
  'usuarios.gerenciar': ADMIN,
  'clientes.editar': GERENCIA,
  'clube.suspender': GERENCIA,
  'clube.revogar_sessoes': GERENCIA,
  'clube.confirmar_telefone': GERENCIA,
  'clube.reativar': ADMIN,
  'financeiro.ver': GERENCIA,
  'financeiro.conciliar_mes': GERENCIA,
  'financeiro.reabrir_mes': ADMIN,
  'financeiro.fechar_apuracao': ADMIN,
  // Parâmetros críticos e retiradas dos sócios: só o Proprietário (o backend omite os campos para o Gerente).
  'financeiro.configurar': ADMIN,
  'financeiro.ver_societario': ADMIN,
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

export const podeVer = (papel: Papel, area: Area) => MODULOS[area].includes(papel);
/** Primeira tela de cada perfil: o Atendente abre direto em Reservas. */
export const inicioDo = (papel: Papel) => (podeVer(papel, 'visao-geral') ? '/admin' : '/admin/reservas');
export const pode = (papel: Papel, acao: Acao) => (ACOES[acao] as Papel[]).includes(papel);
