// Contrato PROPOSTO entre o site e a API FastAPI de reservas.
// ⚠️ Ainda NÃO validado com o backend. Documentação e perguntas abertas: docs/technical/CONTRATO-API-RESERVAS.md.
// Quando o contrato real chegar, ajustar AQUI (tipos) e em http.ts (rotas e mapeamento) — a interface da ilha não muda.

/** Data local no formato AAAA-MM-DD e hora HH:MM, no fuso do restaurante (a confirmar). */
export type DataISO = string;
export type Hora = string;

export interface Ambiente { id: string; nome: string; capacidadeMax?: number }

/** GET /reservas/config */
export interface ReservaConfig {
  ambientes: Ambiente[];
  pessoas: { min: number; max: number };          // acima do máximo: encaminhar para contato direto
  antecedencia: { diasMax: number; horasMin?: number };
  exigeEmail: boolean;
  fusoHorario?: string;                            // ex.: "America/Fortaleza" (a confirmar)
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

/** 201 Created */
export interface ReservaCriada {
  codigo: string;
  status: 'confirmada' | 'pendente';   // “pendente” = o restaurante confirma depois (canal a definir)
  ambienteId: string; pessoas: number; data: DataISO; hora: Hora;
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
