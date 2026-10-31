// Validação dos dados de contato da comanda antes do envio. O BACKEND é a autoridade; aqui só se evita o erro de
// digitação, com os mesmos limites dele.
import { conferirTelefone } from '../telefone';

export interface DadosContato { nome: string; telefone: string; email: string; observacoes: string; consentimento: boolean }

/** Limites do backend (esquemas.py: nome até 120; e-mail validado como EmailStr, com domínio e terminação). */
export const NOME_MAX = 120;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

export function validar(d: DadosContato, exigeEmail: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.nome.trim().length < 2) e.nome = 'Diga como podemos chamar você.';
  else if (d.nome.trim().length > NOME_MAX) e.nome = `Use até ${NOME_MAX} caracteres.`;
  // as regras do backend (lib/telefone.ts): celular sem o nono dígito é recusado com a explicação, nunca completado
  const tel = conferirTelefone(d.telefone);
  if (!tel.ok) e.telefone = tel.mensagem;
  if (exigeEmail && !d.email.trim()) e.email = 'Informe o e-mail.';
  else if (d.email.trim() && !EMAIL.test(d.email.trim())) e.email = 'Confira o e-mail.';
  if (!d.consentimento) e.consentimento = 'Para reservar, é preciso concordar com o uso dos dados.';
  return e;
}
