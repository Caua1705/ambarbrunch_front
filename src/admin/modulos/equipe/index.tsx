// Equipe em abas: Hoje, Funcionários (ponto dia a dia e dias e horários na ficha; escalas em ?vista=escalas) e Abertura
// (os checklists de abertura enviados pelo tablet, para a gerência).
// Registros (revisão e correções) segue em ?aba=registros, fora da navegação. Tablets e Auditoria moram em Configurações →
// Ponto. Endereços antigos continuam valendo (abaDaUrl). O painel só esconde o que daria 403: quem decide é o backend. Com o
// módulo desligado no backend, a área mostra isso de forma honesta, sem dados de exemplo.
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
import { Registros } from './Registros';
import { Aberturas } from './Aberturas';
import { pode } from '../../lib/permissoes';
import { useFilasRevisao } from './Correcoes';
import { useTecladoNaTela } from './tablet';

type Aba = 'hoje' | 'funcionarios' | 'registros' | 'abertura';

export const hrefPonto = (item?: 'auditoria') => `/admin/configuracoes?secao=ponto${item ? `&item=${item}` : ''}`;

/** Aba e vista a partir da URL, inclusive dos endereços de antes das três abas. `redirecionar`: a área mudou de lugar. */
function abaDaUrl(): { aba: Aba; vista?: string; redirecionar?: string } {
  const aba = lerParam('aba');
  if (aba === 'funcionarios' || aba === 'registros' || aba === 'abertura') return { aba };
  if (aba === 'escalas') return { aba: 'funcionarios', vista: 'escalas' };
  if (aba === 'correcoes') return { aba: 'registros', vista: 'revisar' };
  if (aba === 'tablets') return { aba: 'hoje', redirecionar: hrefPonto() };
  if (aba === 'auditoria') return { aba: 'hoje', redirecionar: hrefPonto('auditoria') };
  return { aba: 'hoje' };
}

export default function Equipe({ contexto }: { contexto: ContextoPainel }) {
  const perm = permissoesEquipe(contexto.usuario.papel);
  const painel = useConsulta('equipe:painel', () => equipe.painel());
  const desligado = painel.erro?.codigo === 'ponto_desativado';
  const filas = useFilasRevisao(!desligado);
  const veAbertura = pode(contexto.usuario.papel, 'abertura.consultar');
  const abas: { id: Aba; rotulo: string; contagem?: number | null }[] = [
    { id: 'hoje', rotulo: 'Hoje' },
    { id: 'funcionarios', rotulo: 'Funcionários' },
    ...(veAbertura ? [{ id: 'abertura' as const, rotulo: 'Abertura' }] : []),
  ];
  const [aba, setAba] = useState<Aba | null>(null);
  // Tocar na aba (mesmo a atual) volta à vista principal dela: o painel remonta.
  const [volta, setVolta] = useState(0);
  useTecladoNaTela();
  useEffect(() => {
    const lida = abaDaUrl();
    if (lida.redirecionar) {
      location.replace(lida.redirecionar);
      return;
    }
    if (lida.vista) gravarParams({ vista: lida.vista });
    setAba(lida.aba);
  }, []);
  useEffect(() => {
    if (aba) gravarParams({ aba: aba === 'hoje' ? null : aba });
  }, [aba]);
  /** Trocar de aba limpa o que era da anterior (vista, pessoa aberta ou filtrada) antes de a nova ler a URL. */
  const mudarAba = (nova: Aba, vista?: string) => {
    gravarParams({ vista: vista ?? null, funcionario: null });
    setAba(nova);
    setVolta((v) => v + 1);
  };

  if (desligado) {
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
        {aba ? <Abas abas={abas} atual={aba === 'registros' ? 'funcionarios' : aba} aoMudar={(a) => mudarAba(a)} /> : <Esqueleto linhas={1} altura={36} />}
        {aba && (
          <div key={volta} role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
            {aba === 'hoje' && <Hoje consulta={painel} perm={perm} aoCadastrar={() => mudarAba('funcionarios')} aoRevisar={() => mudarAba('registros', 'revisar')} aRevisar={filas.total} />}
            {aba === 'funcionarios' && <Funcionarios perm={perm} />}
            {aba === 'registros' && <Registros perm={perm} />}
            {aba === 'abertura' && veAbertura && <Aberturas />}
          </div>
        )}
      </div>
    </Raiz>
  );
}
