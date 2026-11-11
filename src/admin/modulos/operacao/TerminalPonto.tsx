// Seção Ponto do Modo Operação: o terminal OFICIAL de ponto (/ponto) embutido, sem reimplementar nada. Quem fala com a
// API do ponto é o TABLET pareado pelo Proprietário (cookie HttpOnly do aparelho, Equipe → Tablets), e quem bate o ponto é
// o funcionário identificado pelo rosto no backend — nunca a conta do Atendente logada no painel. Câmera, rede, rosto
// desconhecido, baixa confiança, prova de vida, marcação repetida e "procure o gestor" (registro assistido) são tratados
// pelo próprio terminal, com as mensagens do backend. Sem o tablet pareado, o terminal pede o pareamento ao gestor.
// A página do Modo Operação libera a câmera (Permissions-Policy) só para si e para este iframe da mesma origem.
import { useState } from 'preact/hooks';
import { RefreshCw } from 'lucide-preact';
import { Botao } from '../../ui/base';

export function TerminalPonto() {
  const [chave, setChave] = useState(0);
  return (
    <section class="op-ponto" aria-label="Ponto">
      <div class="op-ponto__barra">
        <p class="fraco">O funcionário fica de frente para a câmera. O ponto é de quem aparece, não de quem está logado.</p>
        <Botao tamanho="p" variante="fantasma" icone={<RefreshCw aria-hidden="true" />} onClick={() => setChave((k) => k + 1)}>Reiniciar terminal</Botao>
      </div>
      <iframe
        key={chave}
        class="op-ponto__terminal"
        src="/ponto"
        title="Terminal de ponto"
        allow="camera"
        referrerpolicy="no-referrer"
      />
    </section>
  );
}
