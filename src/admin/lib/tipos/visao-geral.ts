// Visão Geral — GET /admin/visao-geral e /admin/visao-geral/radar (CONTRATO-PAINEL-FINANCEIRO-ESTOQUE.md §2 e §10.1).
// Ainda NÃO publicado em produção: a tela monta os cartões de Reservas direto das rotas de Reservas (já no ar).
import type { Data, Dec, Instante } from './comum';
import type { AvisoConciliacao, ContasResumo, NivelQualidade } from './financeiro';

export interface RadarInsight {
  id: number;
  tipo: string;
  severidade: 'info' | 'atencao' | 'critico';
  titulo: string;
  problema: string;
  acao_sugerida: string;
  evidencias: Record<string, unknown>;
  periodo: { de: Data; ate: Data; comparado_com?: { de: Data; ate: Data } } | null;
  fonte: string;
  qualidade: 'confiavel' | 'parcial';
  rota: string | null;
  status: 'pendente' | 'visto' | 'resolvido' | 'descartado';
  ocorrencias: number;
  criado_em: Instante;
  atualizado_em: Instante;
}

export interface VisaoGeral {
  dia: Data;
  reservas: { hoje: number; pessoas: number };
  atendimento: { com_equipe: number };
  clube: { ativos: number };
  estoque: { abaixo_minimo: number; compras_em_conferencia: number; produtos_sem_ficha: number; cobertura_fichas_30d: Dec | null };
  alertas: { criticos: number; abertos: number };
  financeiro: null | {
    receita_hoje: Dec | null;
    receita_mes: Dec | null;
    receita_mes_anterior_ate_o_mesmo_dia: Dec | null;
    resultado_parcial: Dec | null;
    qualidade: NivelQualidade;
    contas: ContasResumo;
    conciliacao_mes_anterior: AvisoConciliacao | null;
  };
  radar: RadarInsight[] | null;
}
