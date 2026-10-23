// Contrato PROPOSTO da CARTEIRA do Clube Âmbar (/clube/membro, islands/ClubeMembro.tsx) — ainda não validado.
// 2026-10-23: o backend fechou um contrato real diferente para o acesso (Bearer, /clube/me…). O cadastro e o acesso
// unificado de /clube seguem o contrato real em clube-acesso.ts; a carteira continua aqui até ser alinhada a /clube/me.
// Documento: docs/technical/CONTRATO-API-CLUBE.md. Mudou o contrato? Ajustar AQUI (tipos) e em clube-http.ts (rotas).
// Regras que o contrato preserva:
//  - adesão voluntária e separada da reserva; consentimento de marketing separado da adesão;
//  - pontos só por compras identificadas (o NFC/QR da mesa só abre a página e atribui a ORIGEM do cadastro);
//  - nada de pontuação, saldo ou sessão calculados no navegador: tudo vem da API; a sessão é um cookie httpOnly do backend
//    (o site não guarda token nem dado pessoal em localStorage).
import type { DataISO } from './contrato';

/** De onde veio o cadastro (atribuição). Lido da URL, nunca digitado pela pessoa. */
export type Canal = 'nfc' | 'qr' | 'site' | 'reserva' | 'instagram' | 'whatsapp';
export interface OrigemCadastro {
  canal: Canal;
  /** identificador da mesa gravado na plaquinha (NFC) ou no QR Code */
  mesa?: string;
  /** campanha interna (ex.: cardápio impresso, evento) */
  campanha?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
}

/** GET /clube/config */
export interface ClubeConfig {
  /** false até as regras do Clube serem aprovadas: a ficha continua fechada */
  inscricoesAbertas: boolean;
  /** regulamento vigente; sem ele não há adesão */
  regulamento: { versao: string; url: string } | null;
  privacidadeVersao?: string;
  /** canais em que a pessoa pode autorizar comunicações promocionais (separado da adesão) */
  marketing: { canais: ('whatsapp' | 'email')[] };
  /** código de verificação do telefone */
  codigo: { digitos: number };
}

/** POST /clube/acesso { telefone } → 202 DesafioCodigo (entrar na carteira, sem senha) */
export interface DesafioCodigo {
  desafioId: string;
  canal: 'whatsapp' | 'sms';
  /** destino mascarado para conferência: “(85) •••••-0000” */
  destino: string;
  /** segundos até poder pedir outro código */
  reenvioEm: number;
}

/** POST /clube/acesso/verificar { desafioId, codigo } → 200 Membro + cookie de sessão (httpOnly, Secure, SameSite) */
export interface Membro {
  nome: string;
  /** número de membro impresso na carteira */
  numero: string;
  desde: DataISO;
  /** null = saldo ainda não sincronizado (ex.: integração com o caixa fora do ar) — nunca mostrar um número inventado */
  saldo: { pontos: number; atualizadoEm: string } | null;
  marketing: { autorizado: boolean };
}

/** GET /clube/membro/extrato?cursor= */
export interface Movimento {
  id: string;
  data: string;                     // ISO 8601
  tipo: 'credito' | 'resgate' | 'ajuste' | 'expiracao';
  descricao: string;                // texto da API (ex.: “Compra identificada”)
  pontos: number;                   // com sinal
}
export interface Extrato { itens: Movimento[]; proximo: string | null }

/** GET /clube/recompensas — `publicadas: false` enquanto as recompensas não forem aprovadas */
export interface Recompensa { id: string; nome: string; descricao?: string; pontos: number; disponivel: boolean }
export interface Recompensas { publicadas: boolean; itens: Recompensa[] }

/** Erros normalizados para a interface. `sessao` = 401 (sem sessão ou sessão vencida). */
export type TipoErroClube = 'rede' | 'tempo' | 'validacao' | 'ja-membro' | 'codigo' | 'limite' | 'fechado' | 'sessao' | 'versao' | 'indisponivel' | 'servidor';
export class ErroClube extends Error {
  constructor(public tipo: TipoErroClube, mensagem: string, public campos: Record<string, string> = {}) { super(mensagem); }
}

export interface ClubeApi {
  config(): Promise<ClubeConfig>;
  pedirCodigo(telefone: string): Promise<DesafioCodigo>;
  verificar(desafioId: string, codigo: string): Promise<Membro>;
  membro(): Promise<Membro>;
  extrato(cursor?: string | null): Promise<Extrato>;
  recompensas(): Promise<Recompensas>;
  marketing(autorizado: boolean): Promise<Membro['marketing']>;
  sair(): Promise<void>;
}
