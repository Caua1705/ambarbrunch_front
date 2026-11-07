// Equipe: visão de hoje, funcionários, escalas, registros de ponto, correções, tablets e auditoria. A aba vive na URL. O
// painel só esconde o que daria 403: quem decide é o backend. Com o módulo desligado no backend, todas as áreas mostram isso
// de forma honesta, sem dados de exemplo.
import '../../estilos/equipe.css';
import { useEffect, useState } from 'preact/hooks';
import { ClockAlert } from 'lucide-preact';
import type { ContextoPainel } from '../../lib/sessao';
import { lerParam, gravarParams } from '../../lib/rotas';
import { useConsulta } from '../../lib/consulta';
import { equipe } from '../../lib/api/equipe';
import { Raiz } from '../../ui/camadas';
import { Abas, Cartao } from '../../ui/base';
import { Esqueleto, Vazio } from '../../ui/estados';
import { permissoesEquipe } from './comum';
import { Hoje } from './Hoje';
import { Funcionarios } from './Funcionarios';
import { Escalas } from './Escalas';
import { Registros } from './Registros';
import { Correcoes } from './Correcoes';
import { Tablets } from './Tablets';
import { Auditoria } from './Auditoria';

type Aba = 'hoje' | 'funcionarios' | 'escalas' | 'registros' | 'correcoes' | 'tablets' | 'auditoria';

export default function Equipe({ contexto }: { contexto: ContextoPainel }) {
  const perm = permissoesEquipe(contexto.usuario.papel);
  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'hoje', rotulo: 'Hoje' },
    { id: 'funcionarios', rotulo: 'Funcionários' },
    { id: 'escalas', rotulo: 'Escalas' },
    { id: 'registros', rotulo: 'Registros' },
    { id: 'correcoes', rotulo: 'Correções' },
    ...(perm.dispositivos ? [{ id: 'tablets' as const, rotulo: 'Tablets' }] : []),
    ...(perm.auditoria ? [{ id: 'auditoria' as const, rotulo: 'Auditoria' }] : []),
  ];
  const [aba, setAba] = useState<Aba | null>(null);
  useEffect(() => {
    const lida = lerParam('aba');
    setAba(abas.some((a) => a.id === lida) ? (lida as Aba) : 'hoje');
  }, []);
  useEffect(() => {
    if (aba) gravarParams({ aba: aba === 'hoje' ? null : aba });
  }, [aba]);
  const painel = useConsulta('equipe:painel', () => equipe.painel());

  if (painel.erro?.codigo === 'ponto_desativado') {
    return (
      <Raiz>
        <Cartao>
          <Vazio icone={<ClockAlert aria-hidden="true" />} titulo="Controle de ponto desligado">
            Esta área fica disponível quando o módulo for ativado no sistema do Âmbar. Nenhuma marcação é aceita enquanto ele estiver desligado.
          </Vazio>
        </Cartao>
      </Raiz>
    );
  }

  return (
    <Raiz>
      <div class="pilha">
        {aba ? <Abas abas={abas} atual={aba} aoMudar={setAba} /> : <Esqueleto linhas={1} altura={36} />}
        {aba && (
          <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
            {aba === 'hoje' && <Hoje consulta={painel} perm={perm} aoCadastrar={() => setAba('funcionarios')} />}
            {aba === 'funcionarios' && <Funcionarios perm={perm} />}
            {aba === 'escalas' && <Escalas perm={perm} />}
            {aba === 'registros' && <Registros perm={perm} />}
            {aba === 'correcoes' && <Correcoes perm={perm} />}
            {aba === 'tablets' && <Tablets />}
            {aba === 'auditoria' && <Auditoria />}
          </div>
        )}
      </div>
    </Raiz>
  );
}
