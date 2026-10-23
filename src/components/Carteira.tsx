/** @jsxImportSource preact */
// Carteira do Clube Âmbar — o cartão de membro (vinho, guilhoché de espirais caramelo, costura tracejada e dois furos de
// comanda). Componente Preact: vivo na área do membro (islands/ClubeArea) e estático na prévia local.
// Só mostra o que vem da API: o nome, desde quando é membro e — SÓ com o programa ativo — os pontos disponíveis. Com o
// programa desligado, o lugar dos pontos diz “em breve”; sem dados, nome e data viram marcações de lugar.
interface Props {
  /** membro = dados da API · vazia = carregando (sem nada pessoal) */
  estado: 'membro' | 'vazia';
  nome?: string;
  /** “10/2026” */
  desde?: string;
  /** pontos disponíveis vindos da API; `null` = programa desligado (mostra “em breve”) */
  pontos?: number | null;
  class?: string;
}

const fmt = new Intl.NumberFormat('pt-BR');
/** espirais concêntricas do fundo (o traço da espiral da Roll, repetido como guilhoché de cédula) */
const GUILHOCHE = Array.from({ length: 9 }, (_, i) => 18 + i * 17);

export default function Carteira({ estado, nome, desde, pontos, class: cls }: Props) {
  const vazia = estado !== 'membro';
  return (
    <div class={`carteira${cls ? ` ${cls}` : ''}`} data-estado={estado} {...(vazia ? { 'aria-hidden': 'true' } : { role: 'group', 'aria-label': 'Seu cartão do Clube Âmbar' })}>
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
          <div class="carteira__saldo" data-pontos={typeof pontos === 'number' ? 'sim' : 'nao'}>
            <dt>pontos</dt>
            <dd>{typeof pontos === 'number' ? fmt.format(pontos) : vazia ? <span class="carteira__traco">—</span> : <span class="carteira__breve">em breve</span>}</dd>
          </div>
        </dl>
        <p class="carteira__numero">{desde ? `membro desde ${desde}` : '•• / ••••'}</p>
      </div>
    </div>
  );
}
