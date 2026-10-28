import type { ContextoPainel } from '../../lib/sessao';
import { Raiz } from '../../ui/camadas';

export default function Atendimento({ contexto }: { contexto: ContextoPainel }) {
  void contexto;
  return <Raiz><p>…</p></Raiz>;
}
