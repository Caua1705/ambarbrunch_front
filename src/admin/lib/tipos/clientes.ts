// Clientes — cadastro único de quem reservou (backend: app/modulos/reservas/api_clientes.py e esquemas.py
// `ClientePainel`, `ClienteDetalhe`, `ClienteAlteracao`). Só Gerente e Proprietário (clientes.visualizar).
import type { Data, Instante, Uuid, Pagina } from './comum';
import type { FrequenciaCliente, ReservaPainel } from './reservas';

export interface ClientePainel {
  id: Uuid;
  nome: string;
  telefone_e164: string | null;
  /** Telefone confirmado pelo próprio cliente (código no WhatsApp): não se troca pelo painel. */
  telefone_verificado: boolean;
  email: string | null;
  /** Canal do primeiro contato: site, telefone, whatsapp, balcao, instagram, nfc, painel, pdv, importacao. */
  origem_inicial: string;
  origem_detalhe: string | null;
  /** Veio do cadastro do Giardini. */
  importado: boolean;
  criado_em: Instante;
  reservas_total: number;
  /** Reservas de hoje em diante ainda em aberto. */
  reservas_em_aberto: number;
  ultima_reserva: Data | null;
  proxima_reserva: Data | null;
  frequencia: FrequenciaCliente;
}

export type ListaClientes = Pagina<ClientePainel>;

export interface CanalCliente {
  canal: string;
  detalhe: string;
  primeiro_em: Instante;
  ultimo_em: Instante;
  ocorrencias: number;
}

export interface ConsentimentoCliente {
  /** privacidade_reserva, whatsapp_operacional, marketing_whatsapp, marketing_email, clube… */
  finalidade: string;
  /** concedido / revogado (texto do backend). */
  acao: string;
  canal: string;
  texto_versao: string;
  registrado_em: Instante;
}

export interface ClienteDetalhe extends ClientePainel {
  canais: CanalCliente[];
  consentimentos: ConsentimentoCliente[];
  /** Reservas do cliente nas unidades que o usuário enxerga (até 200, da mais antiga para a mais nova). */
  reservas: ReservaPainel[];
}

/** PATCH /admin/clientes/{id}: só os campos enviados mudam. `email: null` apaga o e-mail. */
export interface ClienteAlteracao {
  nome?: string;
  telefone?: string;
  email?: string | null;
}
