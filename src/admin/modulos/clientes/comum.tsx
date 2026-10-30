// Rótulos do cadastro de clientes (os mesmos do painel anterior, app/painel/js/clientes.js) e o selo de frequência.
import { Repeat, UserX, CalendarClock } from 'lucide-preact';
import { plural } from '../../lib/formato';
import { Etiqueta, type Tom } from '../../ui/base';
import type { FrequenciaCliente } from '../../lib/tipos/reservas';

export const ORIGEM: Record<string, string> = {
  site: 'Site', telefone: 'Ligação', whatsapp: 'WhatsApp', balcao: 'Balcão', instagram: 'Instagram',
  nfc: 'NFC', painel: 'Painel', pdv: 'PDV', importacao: 'Importado',
};

export const FINALIDADE: Record<string, string> = {
  privacidade_reserva: 'Privacidade (reserva)', whatsapp_operacional: 'WhatsApp operacional',
  marketing_whatsapp: 'Marketing por WhatsApp', marketing_email: 'Marketing por e-mail', clube: 'Clube Âmbar',
};

export const PERFIL: Record<FrequenciaCliente['perfil'], { rotulo: string; tom: Tom }> = {
  novo: { rotulo: 'Novo', tom: 'info' },
  visitante: { rotulo: 'Veio 1 vez', tom: 'neutro' },
  recorrente: { rotulo: 'Recorrente', tom: 'marca' },
};

/** Novo / visitante / recorrente e o aviso de faltas, como o backend calcula em FrequenciaCliente. */
export function Frequencia({ f }: { f: FrequenciaCliente }) {
  const p = PERFIL[f.perfil] ?? { rotulo: f.perfil, tom: 'neutro' as Tom };
  return (
    <span class="linha" style={{ gap: '4px' }}>
      <Etiqueta tom={p.tom} icone={f.perfil === 'recorrente' ? <Repeat size={12} aria-hidden="true" /> : f.perfil === 'novo' ? <CalendarClock size={12} aria-hidden="true" /> : undefined}>{p.rotulo}</Etiqueta>
      {f.faltas > 0 && <Etiqueta tom="perigo" icone={<UserX size={12} aria-hidden="true" />}>{plural(f.faltas, 'falta', 'faltas')}</Etiqueta>}
    </span>
  );
}
