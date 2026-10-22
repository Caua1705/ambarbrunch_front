// Origem do cadastro no Clube (atribuição): lida da URL de entrada, validada por lista fechada.
// Plaquinhas das mesas: NFC → /clube/?canal=nfc&mesa=12 · QR Code → /clube/?canal=qr&mesa=12
// Convite depois da reserva: /clube/?canal=reserva · campanhas: &campanha=… e utm_source/utm_medium/utm_campaign.
// Encostar o celular na plaquinha SÓ abre a página e marca a origem: não gera ponto nem registra presença.
// A origem não é dado pessoal; fica na sessionStorage para sobreviver a uma ida à home e volta (some ao fechar a aba).
import type { Canal, OrigemCadastro } from './api/clube-contrato';

const CANAIS: readonly Canal[] = ['nfc', 'qr', 'site', 'reserva', 'instagram', 'whatsapp'];
const CHAVE = 'ambar:clube:origem';
const MESA = /^[A-Za-z0-9-]{1,8}$/;
const TEXTO = /^[\w.-]{1,64}$/;

const limpo = (v: string | null, re: RegExp) => (v && re.test(v) ? v : undefined);

/** Origem a partir de uma query string. Sem canal válido = `null` (a página foi aberta sem atribuição). */
export function lerOrigem(busca: string): OrigemCadastro | null {
  const q = new URLSearchParams(busca);
  const canal = q.get('canal') as Canal | null;
  const utm = { source: limpo(q.get('utm_source'), TEXTO), medium: limpo(q.get('utm_medium'), TEXTO), campaign: limpo(q.get('utm_campaign'), TEXTO) };
  const temUtm = Object.values(utm).some(Boolean);
  if (!(canal && CANAIS.includes(canal)) && !temUtm) return null;
  const o: OrigemCadastro = { canal: canal && CANAIS.includes(canal) ? canal : 'site' };
  const mesa = limpo(q.get('mesa'), MESA);
  if (mesa && (o.canal === 'nfc' || o.canal === 'qr')) o.mesa = mesa;
  const campanha = limpo(q.get('campanha'), TEXTO);
  if (campanha) o.campanha = campanha;
  if (temUtm) o.utm = Object.fromEntries(Object.entries(utm).filter(([, v]) => v)) as OrigemCadastro['utm'];
  return o;
}

/** Origem desta visita: a da URL (guardada para a sessão) ou a guardada antes; sem nenhuma, “site”. */
export function origemDaVisita(): OrigemCadastro {
  const daUrl = lerOrigem(location.search);
  try {
    if (daUrl) { sessionStorage.setItem(CHAVE, JSON.stringify(daUrl)); return daUrl; }
    const salva = sessionStorage.getItem(CHAVE);
    if (salva) { const o = lerOrigem(new URLSearchParams(Object.entries(achatar(JSON.parse(salva)))).toString()); if (o) return o; }
  } catch { /* armazenamento bloqueado: vale só a URL */ }
  return daUrl ?? { canal: 'site' };
}

/** Revalida o que veio da sessionStorage pelo mesmo filtro da URL (nada salvo é aceito sem passar pela lista fechada). */
function achatar(o: Partial<OrigemCadastro>): Record<string, string> {
  const r: Record<string, string> = {};
  if (o.canal) r.canal = o.canal;
  if (o.mesa) r.mesa = o.mesa;
  if (o.campanha) r.campanha = o.campanha;
  if (o.utm?.source) r.utm_source = o.utm.source;
  if (o.utm?.medium) r.utm_medium = o.utm.medium;
  if (o.utm?.campaign) r.utm_campaign = o.utm.campaign;
  return r;
}
