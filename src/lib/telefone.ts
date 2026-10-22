// Telefone brasileiro com DDD: máscara de digitação e validação (Clube Âmbar). Mesma regra da comanda de reserva.
export const soDigitos = (s: string) => s.replace(/\D/g, '');
export const telefoneValido = (s: string) => { const n = soDigitos(s).length; return n === 10 || n === 11; };
export const mascaraTel = (s: string) => {
  const d = soDigitos(s).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
export const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
