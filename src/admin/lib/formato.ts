// Formatação pt-BR. Valor desconhecido (null/undefined) vira "—", nunca "R$ 0,00".
const FUSO = 'America/Fortaleza';
const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const numFmt = new Intl.NumberFormat('pt-BR');

export const VAZIO = '—';

export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function moeda(v: string | number | null | undefined, opcoes: { compacta?: boolean } = {}): string {
  const n = num(v);
  if (n === null) return VAZIO;
  return opcoes.compacta && Math.abs(n) >= 10_000 ? moedaCurta.format(n) : moedaFmt.format(n);
}

export function inteiro(v: string | number | null | undefined): string {
  const n = num(v);
  return n === null ? VAZIO : numFmt.format(Math.round(n));
}

export function decimal(v: string | number | null | undefined, casas = 1): string {
  const n = num(v);
  return n === null ? VAZIO : n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

/** "55.0" → "55%"; 0..1 com `fracao` → ×100. */
export function pct(v: string | number | null | undefined, opcoes: { fracao?: boolean; casas?: number; sinal?: boolean } = {}): string {
  let n = num(v);
  if (n === null) return VAZIO;
  if (opcoes.fracao) n *= 100;
  const s = n.toLocaleString('pt-BR', { maximumFractionDigits: opcoes.casas ?? 1 });
  return `${opcoes.sinal && n > 0 ? '+' : ''}${s}%`;
}

/** Quantidade na unidade-base, legível: 12000 g → "12 kg"; 1500 ml → "1,5 L". */
export function quantidade(v: string | number | null | undefined, unidade: string | null | undefined): string {
  const n = num(v);
  if (n === null) return VAZIO;
  if (unidade === 'g' && Math.abs(n) >= 1000) return `${decimal(n / 1000, 2)} kg`;
  if (unidade === 'ml' && Math.abs(n) >= 1000) return `${decimal(n / 1000, 2)} L`;
  return `${decimal(n, 2)} ${unidade ?? ''}`.trim();
}

/** Custo por unidade-base, na unidade de compra que as pessoas usam: R$ 0,036/g → "R$ 36,00/kg". */
export function custoBase(v: string | number | null | undefined, unidade: string | null | undefined): string {
  const n = num(v);
  if (n === null) return VAZIO;
  if (unidade === 'g') return `${moedaFmt.format(n * 1000)}/kg`;
  if (unidade === 'ml') return `${moedaFmt.format(n * 1000)}/L`;
  return `${moedaFmt.format(n)}/un`;
}

/** Data "AAAA-MM-DD" sem passar por fuso (evita o dia anterior). */
export function dataCurta(d: string | null | undefined, opcoes: { ano?: boolean; semana?: boolean } = {}): string {
  if (!d) return VAZIO;
  const [a, m, dia] = d.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, dia, 12));
  return dt.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', ...(opcoes.ano ? { year: 'numeric' } : {}), ...(opcoes.semana ? { weekday: 'short' } : {}) }).replace(/\./g, '');
}

export function dataLonga(d: string | null | undefined): string {
  if (!d) return VAZIO;
  const [a, m, dia] = d.slice(0, 10).split('-').map(Number);
  const s = new Date(Date.UTC(a, m - 1, dia, 12)).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function mesAno(d: string | null | undefined): string {
  if (!d) return VAZIO;
  const [a, m] = d.slice(0, 7).split('-').map(Number);
  const s = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function mesCurto(d: string): string {
  const [a, m] = d.slice(0, 7).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'short' }).replace('.', '');
}

/** "19:30:00" → "19:30". */
export const hora = (h: string | null | undefined) => (h ? h.slice(0, 5) : VAZIO);

export function dataHora(i: string | null | undefined): string {
  if (!i) return VAZIO;
  return new Date(i).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '');
}

export function horaDe(i: string | null | undefined): string {
  if (!i) return VAZIO;
  return new Date(i).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
}

/** "há 5 min", "ontem às 14:02". */
export function relativo(i: string | null | undefined): string {
  if (!i) return VAZIO;
  const t = new Date(i).getTime();
  const seg = Math.round((Date.now() - t) / 1000);
  if (seg < 60) return 'agora';
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400 && hojeISO() === isoEm(t)) return `hoje às ${horaDe(i)}`;
  if (isoEm(t) === somarDias(hojeISO(), -1)) return `ontem às ${horaDe(i)}`;
  return dataHora(i);
}

/** Data de hoje em Fortaleza, "AAAA-MM-DD". */
export function hojeISO(): string {
  return isoEm(Date.now());
}

function isoEm(t: number): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  return p;
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias, 12));
  return dt.toISOString().slice(0, 10);
}

export function inicioMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function fimMes(iso: string): string {
  const [a, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0, 12)).toISOString().slice(0, 10);
}

export function somarMeses(iso: string, meses: number): string {
  const [a, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + meses, 1, 12)).toISOString().slice(0, 10);
}

/** +5585999991111 → (85) 99999-1111. Mascarados do backend passam como vieram. */
export function telefone(t: string | null | undefined): string {
  if (!t) return VAZIO;
  const d = t.replace(/\D/g, '');
  const n = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return t;
}

export function linkWhatsApp(t: string | null | undefined): string | null {
  const d = t?.replace(/\D/g, '');
  return d && d.length >= 12 ? `https://wa.me/${d}` : null;
}

/** "1.234,50" | "1234.5" | "1234,5" → "1234.50" (string decimal para o backend) ou null. */
export function paraDecimal(texto: string): string | null {
  const t = texto.trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null;
  return Number(normal).toFixed(2);
}

export const plural = (n: number, um: string, varios: string) => `${inteiro(n)} ${n === 1 ? um : varios}`;
