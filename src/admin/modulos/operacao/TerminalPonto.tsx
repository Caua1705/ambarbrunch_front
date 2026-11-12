// Seção Ponto do Modo Operação: "Registrar ponto" (o terminal facial, autenticado pela conta logada — sem código de tablet)
// e "Checklist de abertura". Quem bate o ponto é sempre o rosto identificado no backend, nunca a conta do tablet.
// Sem reconhecimento facial liberado, sem câmera ou sem internet, a tela diz que nada foi registrado e mostra o caminho do
// gestor (registro pelo painel, com horário, motivo e auditoria).
import { useEffect, useState } from 'preact/hooks';
import { ClipboardCheck, ScanFace } from 'lucide-preact';
import { terminal } from '../../lib/api/operacao';
import { useConsulta } from '../../lib/consulta';
import { lerParam, gravarParams } from '../../lib/rotas';
import { Botao } from '../../ui/base';
import { Esqueleto, Vazio } from '../../ui/estados';
import { RegistrarPonto } from './RegistrarPonto';
import { Abertura } from './Abertura';
import { Contingencia } from './comum-ponto';

type Aba = 'registrar' | 'abertura';

export function TerminalPonto({ apiUrl }: { apiUrl: string | null }) {
  const [aba, setAba] = useState<Aba>(() => (lerParam('ponto') === 'abertura' ? 'abertura' : 'registrar'));
  useEffect(() => gravarParams({ ponto: aba === 'abertura' ? 'abertura' : null }), [aba]);
  // Configuração do terminal (relógio do servidor, biometria liberada): relida a cada 5 min.
  const config = useConsulta('ponto:terminal', () => terminal.configuracao(), { intervalo: 5 * 60_000 });
  const desligado = config.erro?.codigo === 'ponto_desativado';

  return (
    <section class="op-ponto" aria-label="Ponto">
      <div class="op-ponto__abas" role="tablist" aria-label="Ponto">
        <button type="button" role="tab" id="aba-registrar" class="op-ponto__aba" aria-selected={aba === 'registrar'} aria-controls="painel-ponto" onClick={() => setAba('registrar')}>
          <ScanFace aria-hidden="true" /> Registrar ponto
        </button>
        <button type="button" role="tab" id="aba-abertura" class="op-ponto__aba" aria-selected={aba === 'abertura'} aria-controls="painel-ponto" onClick={() => setAba('abertura')}>
          <ClipboardCheck aria-hidden="true" /> Checklist de abertura
        </button>
      </div>
      <div role="tabpanel" id="painel-ponto" aria-labelledby={`aba-${aba}`} class="op-ponto__painel">
        {desligado ? (
          <Vazio titulo="Controle de ponto desligado">O ponto e o checklist ficam disponíveis quando o módulo for ativado no sistema do Âmbar.</Vazio>
        ) : aba === 'abertura' ? (
          <Abertura config={config.dados ?? null} apiUrl={apiUrl} />
        ) : config.dados ? (
          <RegistrarPonto config={config.dados} apiUrl={apiUrl} aoRecarregar={config.recarregar} />
        ) : config.erro ? (
          <div class="op-terminal">
            <div class="op-terminal__cartao op-terminal__cartao--atencao" role="alert">
              <h2>Não foi possível abrir o ponto</h2>
              <p>{config.erro.message} <strong>Nenhum ponto foi registrado.</strong></p>
              <Botao onClick={config.recarregar}>Tentar de novo</Botao>
            </div>
            <Contingencia />
          </div>
        ) : (
          <Esqueleto linhas={3} altura={64} />
        )}
      </div>
    </section>
  );
}
