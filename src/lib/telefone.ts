// Telefone brasileiro com DDD: máscara de digitação e validação (Clube Âmbar e comanda de reserva), com as regras do
// backend (giardini_back, app/modulos/clientes/telefone.py → `analisar`, commit b0b0553). O BACKEND continua a autoridade
// (identidade, associação de compras): aqui só se evita o erro de digitação antes de enviar.
// NENHUM dígito é acrescentado ou removido por palpite — nem o nono dígito. A máscara só tira o que é formatação
// (pontuação, o 0 da discagem) e mostra o código do país quando ele veio (+55, ou 55 com 12–13 dígitos, como o backend
// lê); o que sobra NÃO é cortado: fica à vista e a validação diz o que conferir.
export const soDigitos = (s: string) => s.replace(/\D/g, '');

/** DDDs em uso no Brasil (Anatel) — a mesma lista do backend. DDD fora daqui é inválido, nunca “corrigido”. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97,
  98, 99,
]);
/** o maior número possível (E.164): a máscara para aí, muito depois de a validação já ter recusado */
const MAX_DIGITOS = 15;

/** o que foi digitado, sem formatação. `pais` = veio o código do país; `nacional` = DDD + número, intocado. */
function ler(s: string): { pais: string | null; nacional: string } {
  const bruto = s.trim();
  const d = soDigitos(bruto).slice(0, MAX_DIGITOS);
  if (bruto.startsWith('+')) return d.startsWith('55') ? { pais: '55', nacional: d.slice(2) } : { pais: d, nacional: '' };
  const semZero = d.replace(/^0+/, '');   // 0 da discagem: DDD nunca começa com 0
  if ((semZero.length === 12 || semZero.length === 13) && semZero.startsWith('55')) return { pais: '55', nacional: semZero.slice(2) };
  return { pais: null, nacional: semZero };
}

/** DDD + número, como vai para a API (o backend normaliza de novo; o código do país, quando veio, já saiu aqui) */
export const telefoneNacional = (s: string) => ler(s).nacional;

/** “(85) 99143-9014” enquanto digita; “+55 (85) 99143-9014” quando veio o código do país. Dígitos a mais aparecem. */
export const mascaraTel = (s: string) => {
  const { pais, nacional: d } = ler(s);
  // código de outro país (ou ainda incompleto): sem máscara — a validação pede um número do Brasil
  if (pais !== null && pais !== '55') return `+${pais}`;
  const prefixo = pais ? '+55' : '';
  if (!d) return prefixo;
  const local = d.length <= 2 ? `(${d}`
    : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
    : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return prefixo ? `${prefixo} ${local}` : local;
};

export type ProblemaTelefone = 'vazio' | 'estrangeiro' | 'digitos_a_menos' | 'digitos_a_mais' | 'ddd_inexistente'
  | 'nono_digito_ausente' | 'fixo' | 'invalido';

/**
 * Confere o número digitado. `celular`: só celular (WhatsApp do Clube); sem ele, fixo com 10 dígitos também vale.
 * Celular com 10 dígitos (sem o nono) é recusado com a explicação — o 9 nunca é posto pelo site.
 */
export function conferirTelefone(s: string, { celular = false } = {}): { ok: true } | { ok: false; problema: ProblemaTelefone; mensagem: string } {
  const falha = (problema: ProblemaTelefone, mensagem: string) => ({ ok: false as const, problema, mensagem });
  const { pais, nacional: d } = ler(s);
  if (pais !== null && pais !== '55') return falha('estrangeiro', 'Use um número do Brasil, com DDD.');
  if (!d) return falha('vazio', celular ? 'Informe seu WhatsApp com DDD.' : 'Informe o telefone com DDD.');
  if (d.length < 10) return falha('digitos_a_menos', 'Faltam dígitos. Informe o DDD e o número.');
  if (d.length > 11) return falha('digitos_a_mais', 'Há dígitos a mais. Confira o número.');
  const ddd = d.slice(0, 2);
  if (!DDDS.has(Number(ddd))) return falha('ddd_inexistente', `O DDD ${ddd} não existe. Confira o número.`);
  const primeiro = d[2];
  if (d.length === 11) return primeiro === '9' ? { ok: true } : falha('invalido', 'Com 11 dígitos, o número começa com 9 depois do DDD. Confira.');
  // 10 dígitos: celular sem o nono dígito (começa com 6 a 9) ou fixo (2 a 5)
  if ('6789'.includes(primeiro)) return falha('nono_digito_ausente', 'Celular tem 9 dígitos depois do DDD. Confira se falta o 9.');
  if (!'2345'.includes(primeiro)) return falha('invalido', 'Número inválido. Confira o DDD e o número.');
  return celular ? falha('fixo', 'Informe um celular com WhatsApp: DDD e 9 dígitos.') : { ok: true };
}

export const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
