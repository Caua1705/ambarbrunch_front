// Contrato entre o site e a API de reservas do Âmbar (backend giardini_back, pacote app/).
// Fonte: docs/auditoria-ambar/arquitetura/CONTRATO-API-RESERVAS.md, no repositório do backend.
// Mudou o contrato? Ajustar AQUI (tipos) e em http.ts (rotas e mapeamento) — a interface da ilha não muda.

/** Data local no formato AAAA-MM-DD e hora HH:MM, no fuso do restaurante (a confirmar). */
export type DataISO = string;
export type Hora = string;

/** `datasFechadas`: dias da janela em que o ambiente não tem nenhum horário (dia fechado, feriado, evento) — o
 *  calendário nem os oferece. Dia lotado não vem aqui: lotação é da disponibilidade. */
export interface Ambiente { id: string; nome: string; capacidadeMax?: number; pessoasMin?: number; pessoasMax?: number;
  datasFechadas?: DataISO[] }

/** GET /reservas/config */
export interface ReservaConfig {
  ambientes: Ambiente[];
  pessoas: { min: number; max: number };          // faixa geral; o limite de cada ambiente vem em ambientes[].pessoasMin/Max
  antecedencia: { diasMax: number; horasMin?: number };
  exigeEmail: boolean;
  fusoHorario?: string;                            // "America/Fortaleza"
  privacidadeVersao?: string;
}

/** GET /reservas/disponibilidade?data=&pessoas=&ambiente= */
export interface Disponibilidade { data: DataISO; horarios: { hora: Hora; disponivel: boolean }[] }

/** POST /reservas  (cabeçalho Idempotency-Key: uuid por tentativa de envio) */
export interface NovaReserva {
  ambienteId: string;
  pessoas: number;
  data: DataISO;
  hora: Hora;
  nome: string;
  telefone: string;            // só dígitos, com DDD
  email?: string;
  observacoes?: string;
  consentimentoPrivacidade: true;
  origem: 'site';
}

/** Convite OPCIONAL ao Clube Âmbar: só aparece depois da reserva registrada; aceitar só abre a página do Clube. */
export interface ConviteClube { convite: boolean; url: string | null }

/** 201 Created */
export interface ReservaCriada {
  codigo: string;
  status: 'confirmada' | 'pendente';   // “pendente” = o ambiente pede aprovação da equipe
  ambienteId: string; pessoas: number; data: DataISO; hora: Hora;
  duracaoMin?: number;                 // duração da reserva (arquivo de agenda)
  clube?: ConviteClube;
}

/** Erros normalizados para a interface. */
export type TipoErro = 'rede' | 'tempo' | 'validacao' | 'conflito' | 'limite' | 'indisponivel' | 'servidor';
export class ErroReserva extends Error {
  constructor(public tipo: TipoErro, mensagem: string, public campos: Record<string, string> = {}) { super(mensagem); }
}

export interface ReservasApi {
  /** Nome do modo, para a interface deixar claro o que está acontecendo. */
  readonly modo: 'simulado' | 'api';
  config(): Promise<ReservaConfig>;
  disponibilidade(q: { data: DataISO; pessoas: number; ambienteId: string }, sinal?: AbortSignal): Promise<Disponibilidade>;
  criar(r: NovaReserva, chaveIdempotencia: string): Promise<ReservaCriada>;
}
