// Rótulos e regras de exibição que só o Atendimento compartilha entre a caixa de entrada, a conversa, a ficha do contato,
// a nova conversa e as gavetas da gerência (campanhas, base de conhecimento, cadastros duplicados). O servidor decide tudo;
// aqui só se traduz código do backend para o que a equipe lê.
import { ErroApi } from '../../lib/api/cliente';
import type { Tom } from '../../ui/base';
import type { EstadoConversa, TemplateWhatsapp } from '../../lib/tipos/atendimento-clube';

/** Limite de texto da resposta da equipe (servico.TEXTO_MAX do backend; o que passar é cortado lá). */
export const TEXTO_MAX = 2000;

export const ESTADO: Record<EstadoConversa, { rotulo: string; tom: Tom }> = {
  automatico: { rotulo: 'Assistente', tom: 'info' },
  esperando: { rotulo: 'Esperando equipe', tom: 'atencao' },
  em_atendimento: { rotulo: 'Equipe', tom: 'marca' },
  encerrada: { rotulo: 'Encerrada', tom: 'apagado' },
};

/** Prefixo da última mensagem na lista: quem falou por último, quando não foi o cliente. */
export const PREFIXO_ORIGEM: Record<string, string> = {
  robo: 'Assistente: ',
  equipe: 'Equipe: ',
  campanha: 'Campanha: ',
  automacao: 'Automático: ',
};

const MOTIVO_HUMANO: Record<string, string> = {
  atendimento_humano: 'o cliente pediu para falar com alguém',
  encomenda: 'encomenda',
  reclamacao: 'reclamação',
  assistente_desligado: 'assistente desligado',
  assistente_desligado_no_painel: 'assistente desligado nesta conversa pela equipe',
  falha_na_ia: 'o assistente não conseguiu responder',
};

/** Por que a conversa foi para a equipe (motivo_humano do backend), em português. Prefixos viram uma frase só. */
export function motivoHumano(m: string): string {
  if (MOTIVO_HUMANO[m]) return MOTIVO_HUMANO[m];
  if (m.startsWith('botao_')) return 'clique de botão que não pôde ser aplicado';
  if (m.startsWith('clube_')) return `assunto do Clube Âmbar (${m.slice(6).replace(/_/g, ' ')})`;
  if (m.startsWith('sem_link_')) return `o assistente não tinha o link (${m.slice(9).replace(/_/g, ' ')})`;
  return m.replace(/_/g, ' ');
}

/** Origem do cadastro (origem_inicial do backend). */
export const ORIGEM: Record<string, string> = {
  site: 'Site', telefone: 'Ligação', whatsapp: 'WhatsApp', balcao: 'Balcão', instagram: 'Instagram',
  nfc: 'NFC', painel: 'Painel', pdv: 'PDV', importacao: 'Importado',
};

/** Cliente antigo importado do Giardini ou cadastro do Âmbar. */
export const origemContato = (giardini: boolean) => (giardini ? 'Cliente antigo Giardini' : 'Âmbar');

export const FINALIDADE: Record<string, string> = {
  privacidade_reserva: 'Privacidade (reserva)', whatsapp_operacional: 'WhatsApp operacional',
  marketing_whatsapp: 'Marketing por WhatsApp', marketing_email: 'Marketing por e-mail', clube: 'Clube Âmbar', regulamento: 'Regulamento do Clube',
};

export const SITUACAO_CONSENTIMENTO: Record<string, { rotulo: string; tom: Tom }> = {
  concedido: { rotulo: 'Autorizou', tom: 'ok' },
  aceite: { rotulo: 'Aceitou', tom: 'ok' },
  revogado: { rotulo: 'Revogou', tom: 'perigo' },
  recusado: { rotulo: 'Recusou', tom: 'apagado' },
};

export const MOTIVO_FOLLOWUP: Record<string, string> = {
  pediu_para_parar: 'o cliente pediu para parar',
  desligado_pela_equipe: 'desligado pela equipe',
};

/** Motivo de um destinatário de campanha não receber (bloqueio do servidor ou erro da Meta). */
export const MOTIVO_BLOQUEIO: Record<string, string> = {
  nao_e_numero_de_teste: 'não é número de teste',
  sem_consentimento_marketing: 'sem autorização de marketing',
  pediu_para_parar: 'pediu para parar',
  campanha_cancelada: 'campanha cancelada',
};

/** Prévia do template como o cliente deve ver: {{1}}, {{2}}… trocados pelos valores (ou pelo rótulo entre colchetes). */
export function preencherTemplate(t: Pick<TemplateWhatsapp, 'texto' | 'parametros'>, valores: string[]): string {
  return t.texto.replace(/\{\{(\d+)\}\}/g, (todo, n: string) => {
    const i = Number(n) - 1;
    const v = valores[i]?.trim();
    return v ? v : t.parametros[i] ? `[${t.parametros[i]}]` : todo;
  });
}

/** Validação leve do telefone no navegador (o backend normaliza e é quem decide: 422 telefone_invalido). */
export function telefoneValido(texto: string): boolean {
  const d = texto.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13;
}

/** Mensagem humana para os erros de envio do Atendimento (o resto usa a mensagem do próprio backend). */
export function mensagemDeEnvio(e: unknown): string {
  if (!(e instanceof ErroApi)) return 'Não foi possível concluir.';
  switch (e.codigo) {
    case 'fora_da_janela_24h':
      return 'Passou de 24 h da última mensagem do cliente: a Meta só aceita template aprovado. Envie um template ou ligue para o cliente.';
    case 'conversa_ja_assumida':
      return 'Outra pessoa da equipe assumiu esta conversa antes. Nada foi enviado.';
    case 'assistente_desligado':
      return 'O assistente virtual está desligado na configuração do servidor: a conversa continua com a equipe.';
    case 'telefone_invalido':
      return e.message || 'Telefone inválido. Confira o DDD e o número.';
    case 'template_indisponivel':
      return 'Este template não está entre os aprovados configurados no servidor.';
    default:
      return e.message;
  }
}

/** Chave da base de conhecimento a partir do tema: minúsculas, sem acento, `_` no lugar do resto (2 a 40 caracteres). */
export function chaveDoTema(tema: string): string {
  return tema
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
