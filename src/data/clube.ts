// CLUBE ÂMBAR — conteúdo da seção da home, da página /clube e da carteira.
// Regras fixas do responsável (2026-10-20): sem aplicativo; adesão voluntária e independente da reserva; pontos só por
// compras identificadas (nunca por presença nem por aproximar o celular do NFC); marketing com autorização separada.
// NÃO inventar pontuação, recompensas, descontos ou vantagens: enquanto não forem aprovadas (dependem dos testes com a
// Eyemobile), ficam como `pendente(...)` e a página diz que estão em definição — sem número nem promessa.
import { pendente, type Pendente } from '../lib/conteudo';

export interface Passo { titulo: string; texto: string }
/** marco da Jornada Âmbar (Passaporte, components/ClubeJornada.astro). `definicao` = campo pendente que decide o texto */
export interface Marco { id: string; titulo: string; texto: string; icone: 'telefone' | 'xicara' | 'espiral' | 'bolo' | 'presente'; definicao?: 'aniversario' | 'recompensas' }

export const clube = {
  nome: 'Clube Âmbar',
  /** convite da home (sections/ClubeConvite, 2026-10-23): uma frase e dois micro-benefícios genéricos — o espírito do
   *  Clube, não itens aprovados (nada de número, desconto ou recompensa específica) */
  convite: {
    frase: 'Feito para quem volta sempre.',
    marcas: ['vantagens especiais', 'mimos da casa'],
    botao: 'Quero fazer parte',
  },
  /** frase curta do topo da página /clube */
  lead:'O clube de pontos do Âmbar, direto no navegador: sem aplicativo, só com o seu telefone.',
  /** três marcas curtas (todas são regras já decididas, não benefícios inventados) */
  marcas: ['sem aplicativo', 'pontos em compras identificadas', 'entrada opcional'],
  passos: [
    { titulo: 'Entre no Clube', texto: 'Pelo site, com nome e telefone. Sem aplicativo e sem senha: um código enviado ao seu telefone confirma que o número é seu.' },
    { titulo: 'Compre identificado', texto: 'Cada compra identificada como sua no Âmbar soma pontos na sua carteira.' },
    { titulo: 'Acompanhe e troque', texto: 'Saldo, histórico e recompensas ficam na sua carteira, aberta no navegador quando você quiser.' },
  ] satisfies Passo[],
  /** o que já está decidido e vale desde o primeiro dia */
  regras: [
    'O Clube funciona no navegador: não precisa baixar aplicativo.',
    'Entrar é opcional e não tem relação com reservas: reservar não inscreve ninguém, e ninguém precisa do Clube para reservar.',
    'Pontos vêm de compras identificadas. Visitar o Âmbar ou encostar o celular na plaquinha da mesa não soma pontos.',
    'Promoções e novidades só chegam com uma autorização à parte, que você dá (ou não) e pode retirar quando quiser.',
  ],
  /** dependem da decisão sobre a fidelidade (testes com a Eyemobile) */
  /** Jornada Âmbar (2026-10-22): os três primeiros marcos são regras já decididas (ver `passos`); aniversário e
   *  recompensas aparecem “em definição” enquanto os campos abaixo forem pendentes — sem número nem promessa. */
  jornada: [
    { id: 'entrar', titulo: 'Entre', texto: 'pelo site, com nome e telefone', icone: 'telefone' },
    { id: 'comprar', titulo: 'Compre identificado', texto: 'cada compra identificada soma pontos', icone: 'xicara' },
    { id: 'acompanhar', titulo: 'Acompanhe', texto: 'saldo e histórico no navegador', icone: 'espiral' },
    { id: 'aniversario', titulo: 'Seu aniversário', texto: '', icone: 'bolo', definicao: 'aniversario' },
    { id: 'recompensas', titulo: 'Recompensas', texto: '', icone: 'presente', definicao: 'recompensas' },
  ] satisfies Marco[],
  aniversario: pendente('Se haverá algo no aniversário do membro e o quê') as Pendente | string,
  pontuacao: pendente('Quantos pontos cada compra soma e como a compra é identificada no caixa') as Pendente | string,
  recompensas: pendente('Lista de recompensas e quantos pontos cada uma pede') as Pendente | string[],
  regulamento: pendente('Regulamento do Clube Âmbar (versão e link)') as Pendente | { versao: string; url: string },
  /** mesas com plaquinha NFC/QR já instaladas? Enquanto não, a página fala em “em breve” */
  mesas: { ativas: false },
} as const;
