// O que as telas de Equipe compartilham: rótulos, permissões do módulo e lista de funcionários. Minutos e status vêm do
// backend; aqui só se formata.
import type { Papel } from '../../lib/sessao';
import { pode } from '../../lib/permissoes';
import { useConsulta } from '../../lib/consulta';
import { equipe } from '../../lib/api/equipe';
import type { Tom } from '../../ui/base';
import type { BiometriaEstado, OrigemMarcacao, StatusDia } from '../../lib/tipos/equipe';

export const permissoesEquipe = (papel: Papel) => ({
  gerenciar: pode(papel, 'equipe.gerenciar'),
  ajustar: pode(papel, 'ponto.ajustar'),
  biometria: pode(papel, 'ponto.biometria'),
  dispositivos: pode(papel, 'ponto.dispositivos'),
  auditoria: pode(papel, 'auditoria.visualizar'),
});
export type PermissoesEquipe = ReturnType<typeof permissoesEquipe>;

export const ROTULO_STATUS: Record<StatusDia, string> = {
  trabalhando: 'Trabalhando',
  em_intervalo: 'Em intervalo',
  encerrada: 'Encerrada',
  pendente_revisao: 'Precisa de revisão',
  previsto: 'Previsto',
  aguardando: 'Aguardando',
  atrasado: 'Atrasado',
  // Fim do turno sem nenhuma marcação: pode ser falta OU falha do tablet. Não é falta confirmada até o gestor conferir
  // (regularizar com Incluir batida, ou manter como falta).
  ausente: 'Sem marcação',
  folga: 'Folga',
  sem_escala: 'Sem escala',
};

export const TOM_STATUS: Record<StatusDia, Tom> = {
  trabalhando: 'ok',
  em_intervalo: 'info',
  encerrada: 'neutro',
  pendente_revisao: 'atencao',
  previsto: 'apagado',
  aguardando: 'apagado',
  atrasado: 'atencao',
  ausente: 'atencao',
  folga: 'apagado',
  sem_escala: 'apagado',
};

export const ROTULO_BIOMETRIA: Record<BiometriaEstado, string> = {
  nao_cadastrada: 'Sem cadastro',
  pendente: 'Pendente',
  ativa: 'Ativa',
  revogada: 'Revogada',
};

export const TOM_BIOMETRIA: Record<BiometriaEstado, Tom> = { nao_cadastrada: 'apagado', pendente: 'atencao', ativa: 'ok', revogada: 'neutro' };

export const ROTULO_ORIGEM: Record<OrigemMarcacao, string> = { facial: 'Tablet', assistida: 'Registro assistido', ajuste: 'Correção do gestor' };

export const ROTULO_SINAL: Record<string, string> = {
  atraso: 'Atraso',
  saida_antecipada: 'Saída antecipada',
  possivel_excedente: 'Possível excedente',
  fora_da_escala: 'Fora da escala',
  sem_escala: 'Sem escala',
  intervalo_nao_registrado: 'Intervalo não registrado',
  saida_nao_registrada: 'Saída não registrada',
  sequencia_inconsistente: 'Sequência inconsistente',
  jornada_anterior_pendente: 'Jornada anterior pendente',
  jornada_adicional: 'Jornada adicional',
  tipo_informado_pelo_funcionario: 'Tipo informado pelo funcionário',
  ajuste_administrativo: 'Corrigida pelo gestor',
  jornada_anulada: 'Jornada anulada',
};

export const ROTULO_AJUSTE = { inclusao: 'Inclusão', correcao: 'Correção', anulacao: 'Anulação' } as const;

/** 485 → "8h 05". */
export function minutos(m: number | null | undefined): string {
  if (m === null || m === undefined) return '—';
  const n = Math.abs(m);
  return `${m < 0 ? '−' : ''}${Math.floor(n / 60)}h ${String(n % 60).padStart(2, '0')}`;
}

export const JUSTIFICATIVA_MIN = 10;
export const JUSTIFICATIVA_MAX = 500;

export const useFuncionariosAtivos = () => useConsulta('equipe:funcionarios:ativos', () => equipe.funcionarios({ ativo: true, limite: 200 }));

export const ROTULO_DIA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
