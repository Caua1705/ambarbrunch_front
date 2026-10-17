// SALADAS & BOWLS — pratos do “menu saudável” do cardápio do cliente, um de cada vez: foto com marcadores, ingredientes,
// alergênicos e ficha nutricional. Nome, descrição e ingredientes: cardápio do cliente. Fotos: ilustrativas (arte da
// proposta e recorte de IA, ver lib/conteudo.ts → Origem), sempre com o selo.
//
// ALERGÊNICOS E FICHA NUTRICIONAL: ainda sem a ficha técnica validada. Até lá, o site publicado só diz que estão em
// validação (nunca números ou alergênicos deduzidos dos ingredientes). `fichaDemo` são números FICTÍCIOS do kit criativo,
// só para a revisão visual interna (PUBLIC_REVISAO=1). Para publicar: preencher `ficha` e `alergenicos` com os dados
// validados (nutricionista/fornecedor) — o componente passa a mostrá-los sem mudança de código.
import { pendente, type Pendente, type Origem } from '../lib/conteudo';

export interface Nutriente { rotulo: string; valor: number; unidade: string; max: number }
export interface Ficha { porcao: string; valores: Nutriente[] }
export interface Prato {
  id: string;
  nome: string;
  linha: string;
  texto: string;
  ingredientes: string[];
  /** marcadores sobre a foto (só o que aparece nela) — posição em % da foto */
  marcadores: { nome: string; x: number; y: number }[];
  foto: { src: string; alt: string; origem: Origem };
  alergenicos: string[] | Pendente;
  ficha: Ficha | Pendente;
  /** números FICTÍCIOS, só no modo de revisão */
  fichaDemo?: Ficha;
}

const demo = (porcao: string, v: [number, number, number, number, number, number]): Ficha => ({
  porcao,
  valores: [
    { rotulo: 'Energia', valor: v[0], unidade: 'kcal', max: 600 },
    { rotulo: 'Proteínas', valor: v[1], unidade: 'g', max: 40 },
    { rotulo: 'Carboidratos', valor: v[2], unidade: 'g', max: 80 },
    { rotulo: 'Gorduras totais', valor: v[3], unidade: 'g', max: 40 },
    { rotulo: 'Fibra alimentar', valor: v[4], unidade: 'g', max: 15 },
    { rotulo: 'Sódio', valor: v[5], unidade: 'mg', max: 1200 },
  ],
});

export const pratos: Prato[] = [
  {
    id: 'salada-atum',
    nome: 'Salada de atum',
    linha: 'salada',
    texto: 'Atum, abacate e folhas frescas, com shoyu e a doçura da manga.',
    ingredientes: ['atum', 'abacate', 'mix de folhas', 'pepino', 'shoyu', 'manga'],
    marcadores: [
      { nome: 'atum', x: 66, y: 30 },
      { nome: 'abacate', x: 30, y: 26 },
      { nome: 'pepino', x: 84, y: 60 },
      { nome: 'folhas', x: 14, y: 62 },
    ],
    foto: { src: 'cardapio/salada-atum.webp', alt: 'Salada de atum com abacate, pepino, tomate e folhas numa tigela clara', origem: 'ilustrativa' },
    alergenicos: pendente('Alergênicos da salada de atum (ficha técnica)'),
    ficha: pendente('Ficha nutricional da salada de atum (ficha técnica validada)'),
    fichaDemo: demo('300 g', [320, 14, 24, 18, 5, 410]),
  },
  {
    id: 'poke',
    nome: 'Poke',
    linha: 'bowl',
    texto: 'Arroz, salmão, milho crocante, abacate e gergelim, montados na tigela.',
    ingredientes: ['arroz', 'salmão', 'milho crocante', 'abacate', 'gergelim'],
    marcadores: [
      { nome: 'salmão', x: 44, y: 44 },
      { nome: 'milho', x: 80, y: 62 },
      { nome: 'arroz', x: 12, y: 34 },
      { nome: 'abacate', x: 30, y: 80 },
    ],
    foto: { src: 'cardapio/poke-prato.webp', alt: 'Poke com arroz, cubos de salmão, milho, abacate e gergelim numa tigela de cerâmica', origem: 'ilustrativa' },
    alergenicos: pendente('Alergênicos do poke (ficha técnica)'),
    ficha: pendente('Ficha nutricional do poke (ficha técnica validada)'),
    fichaDemo: demo('350 g', [480, 26, 58, 16, 6, 520]),
  },
];

/** texto do site publicado enquanto não há ficha técnica validada */
export const fichaEmValidacao = 'Alergênicos e informação nutricional em validação com a cozinha. Se você tem alguma restrição alimentar, fale com a equipe antes de pedir.';
