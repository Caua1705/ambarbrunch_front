/** @jsxImportSource preact */
// Carteira do Clube Âmbar — o cartão de membro (vinho, guilhoché de espirais caramelo, costura tracejada e dois furos de
// comanda). Componente Preact: renderizado estático nas páginas (convite, sem dados) e vivo na área de membro (ilha).
// Sem dados reais, o cartão NÃO mostra número: nome e número viram marcações de lugar e o saldo, um traço.
interface Props {
  /** convite = ilustração (home e /clube) · membro = dados da API · vazia = área de membro sem sessão */
  estado: 'convite' | 'membro' | 'vazia';
  nome?: string;
  numero?: string;
  /** pontos vindos da API; `null` = saldo ainda não sincronizado */
  pontos?: number | null;
  class?: string;
}

const fmt = new Intl.NumberFormat('pt-BR');
/** espirais concêntricas do fundo (o traço da espiral da Roll, repetido como guilhoché de cédula) */
const GUILHOCHE = Array.from({ length: 9 }, (_, i) => 18 + i * 17);

export default function Carteira({ estado, nome, numero, pontos, class: cls }: Props) {
  const ilustracao = estado !== 'membro';
  return (
    <div class={`carteira${cls ? ` ${cls}` : ''}`} data-estado={estado} {...(ilustracao ? { 'aria-hidden': 'true' } : { role: 'group', 'aria-label': 'Sua carteira do Clube Âmbar' })}>
      <div class="carteira__papel">
        <svg class="carteira__guilhoche" viewBox="0 0 340 214" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {GUILHOCHE.map((r) => <circle cx="300" cy="22" r={r * 1.9} />)}
          <path d="M300 60c-24 0-36-20-26-38 9-16 34-16 42 0 6 12-2 25-14 25-9 0-14-8-10-15" />
        </svg>
        <p class="carteira__marca"><span>Clube</span><strong>Âmbar</strong></p>
        <svg class="carteira__selo" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="29" />
          <path d="M32 21c-8 2-7 13-1 14 7 1 9-8 3-10-5-1-6 4-3 6" />
        </svg>
        <dl class="carteira__dados">
          <div>
            <dt>membro</dt>
            <dd class="carteira__nome">{nome ?? <em>seu nome aqui</em>}</dd>
          </div>
          <div class="carteira__saldo">
            <dt>pontos</dt>
            <dd>{typeof pontos === 'number' ? fmt.format(pontos) : <span class="carteira__traco" aria-label="sem saldo">—</span>}</dd>
          </div>
        </dl>
        <p class="carteira__numero">{numero ?? '•••• ••••'}</p>
      </div>
    </div>
  );
}
