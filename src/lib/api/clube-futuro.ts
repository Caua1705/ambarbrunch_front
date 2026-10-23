// RECURSOS FUTUROS do Clube Âmbar — histórico de pontos, catálogo de recompensas e resgate por QR Code.
// O backend (giardini_back, CLUBE.md, “Fora desta etapa”) ainda NÃO publica rota para o site: o livro de pontos, os
// resgates e o serviço de resgate existem lá dentro, mas sem contrato público. Por isso aqui só há:
//  - os TIPOS que as telas consomem (o formato mínimo de que a interface precisa — a confirmar com o contrato real);
//  - as BANDEIRAS de cada recurso, todas desligadas.
// Não há cliente HTTP, rota inventada nem dado de exemplo neste arquivo. As telas (components/clube/) recebem os dados
// por props; a prévia local (pages/clube/previa) é o único lugar com dados de mentira, e não entra no build de produção.
// Quando o backend publicar as rotas: tipar a resposta aqui, criar as chamadas em clube-acesso.ts e ligar a bandeira.

/** cada recurso só aparece com a bandeira ligada E o programa ativo (`/clube/config` → `programaAtivo` e
 *  `/clube/me` → `membro.programa.ativo`). Enquanto falso, a tela mostra o estado “em preparação”. */
export const RECURSOS = {
  historico: false,
  recompensas: false,
  resgates: false,
} as const;
export type Recurso = keyof typeof RECURSOS;

/** movimento do livro de pontos (o backend registra crédito, estorno, liberação, reserva, resgate, cancelamento,
 *  expiração e ajuste; a tela agrupa nestes tipos) */
export interface Movimento {
  id: string;
  /** ISO 8601 */
  data: string;
  tipo: 'ganho' | 'uso' | 'estorno' | 'expiracao' | 'ajuste';
  /** pendente = compra ainda em liberação (não pode ser usada) */
  situacao: 'pendente' | 'disponivel';
  /** texto vindo do backend (ex.: “Compra no Âmbar”) — nunca montado no navegador */
  descricao: string;
  /** com sinal */
  pontos: number;
}

export interface Recompensa {
  id: string;
  nome: string;
  descricao: string | null;
  pontos: number;
  /** URL da foto servida pelo backend (ou null: a tela usa a moldura sem foto) */
  foto: string | null;
  disponivel: boolean;
}

/** o QR Code vem PRONTO do backend (imagem), nunca gerado no navegador a partir de um id previsível */
export interface Resgate {
  id: string;
  recompensa: { nome: string; pontos: number; foto: string | null };
  situacao: 'aguardando' | 'utilizado' | 'expirado' | 'cancelado';
  /** imagem do QR Code (data: URL ou endereço do backend); só com a situação “aguardando” */
  qr: string | null;
  /** código curto para o caixa digitar, se o leitor falhar (vem do backend) */
  codigo: string | null;
  /** ISO 8601 */
  criadoEm: string;
  validoAte: string | null;
  utilizadoEm: string | null;
}
