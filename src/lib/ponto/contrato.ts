// Contrato do quiosque de ponto (app/modulos/equipe/esquemas.py e docs/equipe-ponto/API.md, no backend). Campos e códigos
// exatamente como o backend: esta camada não traduz nada.

export type TipoBatida = 'ENTRADA' | 'INICIO_INTERVALO' | 'FIM_INTERVALO' | 'SAIDA';

export const ROTULO_BATIDA: Record<TipoBatida, string> = {
  ENTRADA: 'Entrada',
  INICIO_INTERVALO: 'Início do intervalo',
  FIM_INTERVALO: 'Fim do intervalo',
  SAIDA: 'Saída',
};

export interface ConfiguracaoQuiosque {
  dispositivo: string;
  unidade: string;
  horario_servidor: string;
  fuso: string;
  biometria_disponivel: boolean;
  /** Trava própria da marcação pelo rosto. Desligada, o ponto é registrado pelo gestor no painel. */
  identificacao_automatica?: boolean;
  quadros_min: number;
  quadros_max: number;
  quadro_max_kb: number;
  quadro_lado_max: number;
  sessao_segundos: number;
  poses: Record<string, string>;
}

export interface SessaoAberta {
  sessao_id: string;
  nonce: string;
  desafio: string[];
  expira_em: string;
  quadros_min: number;
  quadros_max: number;
}

export interface ProximaBatida {
  acao: 'registrar' | 'escolher' | 'supervisao' | 'ja_registrada';
  tipo: TipoBatida | null;
  opcoes: TipoBatida[];
  motivo: string;
}

export interface ResultadoCaptura {
  sessao_id: string;
  resultado: string;
  motivo?: string | null;
  mensagem: string;
  nova_tentativa: boolean;
  encaminhar_gestor?: boolean;
  autorizacao?: string | null;
  autorizacao_expira_em?: string | null;
  nome_exibicao?: string | null;
  proxima_batida?: ProximaBatida | null;
}

export interface Recibo {
  marcacao_id: string;
  nome_exibicao: string;
  tipo: TipoBatida;
  instante_utc: string;
  data: string;
  hora: string;
  fuso: string;
  dispositivo: string | null;
  repetida: boolean;
  sinalizacoes: string[];
  natureza: 'comprovante_operacional';
}

/** Orientação extra para a recusa da prova de vida: a mensagem do backend diz o quê; esta diz como acertar. */
export function orientacaoDoMotivo(motivo: string | null | undefined): string | null {
  if (motivo === 'movimento_insuficiente') return 'Vire a cabeça inteira para o lado pedido, não só os olhos ou o rosto.';
  if (motivo === 'desafio_nao_cumprido') return 'Siga as setas na ordem, devagar, voltando ao centro entre uma e outra.';
  return null;
}

/** Erro de uma chamada ao quiosque. `rede`: sem resposta do servidor, e nada foi confirmado. */
export class ErroPonto extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo: string | null,
    public dados: Record<string, unknown> | null = null,
    public rede = false,
  ) {
    super(message);
  }
}
